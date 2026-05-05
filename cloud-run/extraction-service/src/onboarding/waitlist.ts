/**
 * Flent Secured v2 - Waitlist State Management (Cloud Run Port)
 *
 * Ported from: supabase/functions/_shared/onboarding.ts -> ensureWaitlistState
 *
 * Manages the waitlist state for a user:
 *   - Calls join_waitlist RPC
 *   - Advances user_status if needed
 *   - Triggers risk computation for new entries
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { recomputeAndStoreRisk } from "./risk.js";

// ==============================================
// TYPES
// ==============================================

export interface EnsureWaitlistStateOptions {
  supabase: SupabaseClient;
  userId: string;
  currentUserStatus?: string | null;
}

export interface EnsureWaitlistStateResult {
  entryId?: string;
  position?: number;
  isNew: boolean;
  finalUserStatus: string;
}

// ==============================================
// MAIN EXPORT
// ==============================================

/**
 * Ensures the user has a waitlist entry and advances their status.
 *
 * Steps:
 * 1. Read current user_status if not provided
 * 2. Call join_waitlist RPC (idempotent)
 * 3. Advance user_status to "waitlisted" if currently signed_up or agreement_confirmed
 * 4. Compute risk for new entries
 */
export async function ensureWaitlistState(
  options: EnsureWaitlistStateOptions
): Promise<EnsureWaitlistStateResult> {
  const { supabase, userId } = options;
  let currentUserStatus = options.currentUserStatus;

  // 1. Read current user_status if not provided
  if (!currentUserStatus) {
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("user_status")
      .eq("id", userId)
      .single();

    if (userError || !userRow) {
      throw new Error(
        `Failed to verify user status: ${userError?.message ?? "missing user"}`
      );
    }

    currentUserStatus = (userRow as Record<string, any>).user_status;
  }

  // 2. Call join_waitlist RPC (idempotent -- returns existing entry if already joined)
  // NOTE: Uses service role -- auth.uid() is not available in Cloud Run
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc("join_waitlist", { p_user_id: userId })
    .single();

  if (rpcError) {
    throw new Error(`Failed to join waitlist: ${rpcError.message}`);
  }

  const result = rpcResult as {
    entry_id: string;
    entry_position: number;
    is_new: boolean;
  };

  let finalUserStatus = currentUserStatus ?? "signed_up";

  // 3. Advance user_status to "waitlisted" if currently in early state AND
  // the latest extraction is actually usable. Without the contract_status
  // gate, users with missing_stamp_paper / invalid_document / expired
  // extractions get flipped to "waitlisted" — which is semantically wrong
  // (they're not ready for the waitlist) and causes confusion in admin
  // tooling that reads user_status alone. The journey router already
  // re-routes such users to /(agreement)/upload, so the only effect of
  // this gate is to keep status honest.
  if (
    ["signed_up", "agreement_confirmed"].includes(finalUserStatus)
  ) {
    const { data: latestExtraction } = await supabase
      .from("extracted_rental_info")
      .select("contract_status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const contractStatus = (latestExtraction as { contract_status?: string | null } | null)?.contract_status;
    const extractionUsable = !!contractStatus && !["missing_stamp_paper", "invalid_document", "expired"].includes(contractStatus);

    if (extractionUsable) {
      const { error: statusError } = await supabase
        .from("users")
        .update({
          user_status: "waitlisted",
          status_updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .in("user_status", ["signed_up", "agreement_confirmed"]);

      if (statusError) {
        console.error(
          "[onboarding] Failed to advance user_status to waitlisted:",
          statusError
        );
      } else {
        finalUserStatus = "waitlisted";
      }
    } else {
      console.log(
        `[onboarding] Skipping user_status advancement for user ${userId} — extraction contract_status=${contractStatus}`
      );
    }
  }

  // 4. Compute risk for new waitlist entries, OR retry if risk was never
  // successfully computed (PENDING / NULL). Without this retry, a transient
  // failure during the first onboarding run leaves the user stuck on
  // "Risk Score" missing forever.
  let shouldComputeRisk = result.is_new;
  if (!shouldComputeRisk) {
    const { data: existingEntry } = await supabase
      .from("waitlist_entries")
      .select("risk_level, risk_computed_at")
      .eq("id", result.entry_id)
      .maybeSingle();
    const entry = existingEntry as
      | { risk_level: string | null; risk_computed_at: string | null }
      | null;
    if (
      entry &&
      (entry.risk_computed_at == null ||
        entry.risk_level == null ||
        entry.risk_level === "PENDING")
    ) {
      shouldComputeRisk = true;
    }
  }
  if (shouldComputeRisk) {
    try {
      await recomputeAndStoreRisk(userId, supabase);
    } catch (riskError) {
      console.error(
        "[onboarding] Risk computation failed (non-fatal):",
        riskError
      );
    }
  }

  return {
    entryId: result.entry_id,
    position: result.entry_position,
    isNew: result.is_new,
    finalUserStatus,
  };
}

// ==============================================
// V1 COMPATIBILITY: UPDATE WAITLIST ENTRIES
// ==============================================

/**
 * Updates waitlist entries with extraction data.
 * Used after extraction completes to sync extraction metadata to the waitlist entry.
 */
export async function updateWaitlistEntries(
  supabase: SupabaseClient,
  entryId: string,
  payload: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from("waitlist_entries")
    .update(payload)
    .eq("id", entryId);

  if (error) {
    console.error(
      "[onboarding] Failed to update waitlist entry:",
      error
    );
  }
}
