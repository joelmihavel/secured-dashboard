/**
 * Flent Secured v2 - Extraction Finalization for Onboarding (Cloud Run Port)
 *
 * Ported from: supabase/functions/_shared/onboarding.ts -> finalizeExtractionForOnboarding
 *
 * Main orchestrator that runs after extraction completes:
 *   1. Verify extraction record exists and is completed
 *   2. Set user_verified on extraction
 *   3. Lock user role (tenant/landlord)
 *   4. Match tenant name against agreement tenant names
 *   5. Create tenancy from extraction data
 *   6. Run deferred bank name matching (for pre-waitlist bank verification)
 *   7. Auto-activate tenancy if admin already approved
 *   8. Ensure waitlist state (join_waitlist RPC + advance status)
 *   9. Sync extraction metadata to waitlist entry
 *  10. Auto-approve demo/test users
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureTenancyForExtraction } from "./tenancy.js";
import { ensureWaitlistState } from "./waitlist.js";
import { runDeferredBankNameMatching } from "./bank-matching.js";
import { maybeAutoApproveDemoUser } from "./demo.js";
import { matchNameAgainstCandidates } from "./name-matching.js";

// ==============================================
// TYPES
// ==============================================

type ExtractionRow = Record<string, any>;

export interface FinalizeExtractionOptions {
  supabase: SupabaseClient;
  userId: string;
  extractionId: string;
  confirmedRole?: "tenant" | "landlord";
  extractionUpdates?: Record<string, any>;
  syncWaitlistFields?: Record<string, any>;
  autoApproveDemo?: boolean;
}

export interface FinalizeExtractionResult {
  extraction: ExtractionRow;
  tenancyId?: string;
  waitlistEntryId?: string;
  finalUserStatus: string;
  autoApprovedDemo: boolean;
}

// ==============================================
// INTERNAL: TENANT NAME MATCHING
// ==============================================

async function matchTenantName(
  supabase: SupabaseClient,
  userId: string,
  extraction: ExtractionRow
): Promise<void> {
  const { data: userRow } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  const tenantNames = Array.isArray(extraction.tenant_names)
    ? extraction.tenant_names
    : [];

  if (
    (userRow as Record<string, any>)?.full_name &&
    tenantNames.length > 0
  ) {
    const matchResult = await matchNameAgainstCandidates(
      (userRow as Record<string, any>).full_name,
      tenantNames,
      "tenant_verification"
    );

    const bestMatchIndex = matchResult.matched_name
      ? tenantNames.indexOf(matchResult.matched_name)
      : -1;

    await supabase
      .from("users")
      .update({
        matched_tenant_index:
          bestMatchIndex >= 0 ? bestMatchIndex : null,
        tenant_match_score: matchResult.confidence,
        tenant_match_type: matchResult.match_type,
      })
      .eq("id", userId);
    return;
  }

  // No name or no tenant names -- mark as no_match
  await supabase
    .from("users")
    .update({
      tenant_match_type: "no_match",
      tenant_match_score: 0,
    })
    .eq("id", userId);
}

// ==============================================
// MAIN EXPORT
// ==============================================

export async function finalizeExtractionForOnboarding(
  options: FinalizeExtractionOptions
): Promise<FinalizeExtractionResult> {
  const {
    supabase,
    userId,
    extractionId,
    confirmedRole = "tenant",
    extractionUpdates = {},
    syncWaitlistFields = {},
    autoApproveDemo = false,
  } = options;

  // 1. Verify extraction record exists and belongs to user
  const { data: existingExtraction, error: fetchError } = await supabase
    .from("extracted_rental_info")
    .select("*")
    .eq("id", extractionId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existingExtraction) {
    throw new Error(
      `Extraction record not found: ${fetchError?.message ?? extractionId}`
    );
  }

  if (
    (existingExtraction as ExtractionRow).extraction_status !==
    "completed"
  ) {
    throw new Error(
      `Extraction not complete: ${(existingExtraction as ExtractionRow).extraction_status}`
    );
  }

  // 2. Set user_verified on extraction
  const nextExtractionUpdates: Record<string, any> = {
    ...extractionUpdates,
  };
  if (!(existingExtraction as ExtractionRow).user_verified) {
    nextExtractionUpdates.user_verified = true;
    nextExtractionUpdates.verified_at = new Date().toISOString();
  }

  if (Object.keys(nextExtractionUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from("extracted_rental_info")
      .update(nextExtractionUpdates)
      .eq("id", extractionId);

    if (updateError) {
      throw new Error(
        `Failed to finalize extraction: ${updateError.message}`
      );
    }
  }

  // Re-fetch extraction after update
  const { data: extraction, error: refreshError } = await supabase
    .from("extracted_rental_info")
    .select("*")
    .eq("id", extractionId)
    .single();

  if (refreshError || !extraction) {
    throw new Error(
      `Failed to refresh extraction: ${refreshError?.message ?? extractionId}`
    );
  }

  // 3. Lock user role
  const { error: roleError } = await supabase
    .from("users")
    .update({
      role: confirmedRole,
      is_role_locked: true,
      role_locked_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("is_role_locked", false);

  if (roleError) {
    console.error("[onboarding] Failed to lock user role:", roleError);
  }

  // 4. Match tenant name
  try {
    await matchTenantName(
      supabase,
      userId,
      extraction as ExtractionRow
    );
  } catch (matchError) {
    console.error(
      "[onboarding] Tenant matching failed (non-fatal):",
      matchError
    );
  }

  // 5. Create tenancy
  const { tenancyId } = await ensureTenancyForExtraction({
    supabase,
    userId,
    extraction: extraction as ExtractionRow,
    confirmedRole,
  });

  // 6. Deferred name matching for pre-waitlist bank verification
  if (tenancyId) {
    try {
      await runDeferredBankNameMatching(supabase, userId, tenancyId);
    } catch (err) {
      console.error(
        "[onboarding] Deferred bank name matching failed (non-fatal):",
        err
      );
    }
  }

  // 7. Auto-activate tenancy if admin already approved (race condition handling)
  if (tenancyId) {
    const { data: waitlistRow } = await supabase
      .from("waitlist_entries")
      .select("admin_review")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      (waitlistRow as Record<string, any>)?.admin_review === "approved"
    ) {
      console.log(
        `[onboarding] User ${userId} already approved -- auto-activating tenancy ${tenancyId}`
      );
      await supabase
        .from("tenancies")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenancyId)
        .eq("status", "pending_verification");
    }
  }

  // 8. Ensure waitlist state
  const waitlistState = await ensureWaitlistState({
    supabase,
    userId,
  });

  // 9. Sync extraction metadata to waitlist entry
  const waitlistPayload: Record<string, any> = {
    extraction_id: (extraction as ExtractionRow).id,
    extraction_status: (extraction as ExtractionRow).extraction_status,
    contract_status: (extraction as ExtractionRow).contract_status,
    ...syncWaitlistFields,
  };

  // Target specific waitlist entry (not all of user's entries) to prevent
  // overwriting data on older entries if user has multiple extractions
  await supabase
    .from("waitlist_entries")
    .update(waitlistPayload)
    .eq("id", waitlistState.entryId);

  let finalUserStatus = waitlistState.finalUserStatus;
  let autoApproved = false;

  // 10. Auto-approve demo/test users
  if (autoApproveDemo) {
    const demoResult = await maybeAutoApproveDemoUser({
      supabase,
      userId,
      waitlistEntryId: waitlistState.entryId,
    });
    autoApproved = demoResult.autoApproved;
    finalUserStatus = demoResult.finalUserStatus;
  }

  return {
    extraction: extraction as ExtractionRow,
    tenancyId,
    waitlistEntryId: waitlistState.entryId,
    finalUserStatus,
    autoApprovedDemo: autoApproved,
  };
}
