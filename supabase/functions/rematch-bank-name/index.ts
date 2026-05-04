/**
 * Flent Secured v2 - Rematch Bank Name Edge Function (PR-4)
 *
 * Re-runs the agreement-name match against an EXISTING verified pre-waitlist
 * landlord bank row, using the latest completed extraction's landlord_names.
 *
 * Why this exists:
 *   verify-bank does penny-drop + name-match in one call. Re-uploading an
 *   agreement only invalidates the *name match* (the bank account itself is
 *   still legitimately verified) — re-running verify-bank would charge an
 *   unnecessary penny drop (~Rs 3-5). This endpoint runs ONLY the
 *   agreement-name match step.
 *
 * Scope:
 *   - Pre-waitlist users only (user_status in {signed_up, agreement_confirmed,
 *     waitlisted}). Approved/active re-upload semantics are out of scope.
 *   - Requires a verified=true row already in bank_accounts with party_type
 *     = 'landlord' for this user.
 *
 * Endpoint: POST /functions/v1/rematch-bank-name
 * Auth: Required (JWT)
 *
 * Request body: {} (no fields — user is implicit from JWT, bank row resolved
 * by user_id + party_type='landlord' + verified=true)
 *
 * Response: {
 *   success: true,
 *   data: {
 *     bank_account_id: string,
 *     agreement_name_matched: boolean,
 *     agreement_match_score: number,
 *     matched_landlord_name: string | null,
 *     verified_name: string | null,
 *     candidate_landlord_names: string[],
 *     message: string,
 *   }
 * }
 *
 * Error codes:
 *   - NO_VERIFIED_BANK: user has no pre-waitlist verified landlord bank row.
 *     Caller should fall back to the standard verify-bank flow.
 *   - AGREEMENT_NOT_PROCESSED: latest extraction doesn't have landlord_names.
 *     Caller should wait or surface the same gate.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { matchAgainstAgreementNames } from "../_shared/name-match-service.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Same threshold verify-bank uses (80%) so a pass here would also pass there.
const NAME_MATCH_THRESHOLD = 0.8;

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    audit = AuditLogger.fromRequest(supabase, req, userId, "rematch-bank-name");

    // ── Locate the user's verified pre-waitlist landlord bank row ────────
    // is_primary=true ensures we touch the row currently driving downstream
    // gating (matches the row dashboard-data exposes as landlord_bank).
    const { data: bankAccount, error: bankErr } = await supabase
      .from("bank_accounts")
      .select(
        "id, verified, pan_verified, agreement_name_matched, verified_account_holder_name, account_holder_name"
      )
      .eq("user_id", userId)
      .eq("party_type", "landlord")
      .eq("verified", true)
      .eq("is_primary", true)
      .maybeSingle();

    if (bankErr) {
      console.error("[rematch-bank-name] bank lookup failed:", bankErr);
      throw new AppError("Failed to look up bank account", "DB_ERROR", 500);
    }

    if (!bankAccount) {
      throw new AppError(
        "No verified landlord bank account to rematch — please verify bank details first.",
        "NO_VERIFIED_BANK",
        409
      );
    }

    // Idempotency: already matched. Surface the existing state without re-running Gemini.
    if (bankAccount.agreement_name_matched === true) {
      return jsonResponse({
        success: true,
        data: {
          bank_account_id: bankAccount.id,
          agreement_name_matched: true,
          agreement_match_score: 100,
          matched_landlord_name: null,
          verified_name:
            bankAccount.verified_account_holder_name ??
            bankAccount.account_holder_name ??
            null,
          candidate_landlord_names: [],
          message: "Already matched — no rematch needed.",
        },
      });
    }

    // ── Pull landlord names from latest COMPLETED extraction ─────────────
    const { data: extraction } = await supabase
      .from("extracted_rental_info")
      .select("landlord_name, landlord_names, extraction_status")
      .eq("user_id", userId)
      .eq("extraction_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let allLandlordNames: string[] = [];
    if (extraction) {
      const seen = new Set<string>();
      if (
        typeof extraction.landlord_name === "string" &&
        extraction.landlord_name.trim()
      ) {
        seen.add(extraction.landlord_name);
      }
      if (Array.isArray(extraction.landlord_names)) {
        for (const n of extraction.landlord_names) {
          if (typeof n === "string" && n.trim()) seen.add(n);
        }
      }
      allLandlordNames = [...seen];
    }

    if (allLandlordNames.length === 0) {
      return jsonResponse(
        {
          error: true,
          code: "AGREEMENT_NOT_PROCESSED",
          message:
            "We couldn't read your landlord's name from your rental agreement. " +
            "Sometimes agreement processing takes some time, please try again in few minutes.",
        },
        409
      );
    }

    const verifiedName =
      bankAccount.verified_account_holder_name ??
      bankAccount.account_holder_name ??
      "";

    if (!verifiedName.trim()) {
      // Should not happen for verified=true rows, but guard anyway.
      throw new AppError(
        "Bank row has no verified holder name to match against.",
        "INVALID_BANK_ROW",
        500
      );
    }

    // ── Run the same matching logic verify-bank uses ─────────────────────
    const matchResult = await matchAgainstAgreementNames({
      verifiedName,
      candidateNames: allLandlordNames,
      context: "agreement_bank_verification",
      matchThreshold: NAME_MATCH_THRESHOLD,
    });

    const agreementMatchDetails = {
      ...matchResult.details,
      name_at_bank: verifiedName,
      rematched_at: new Date().toISOString(),
    };

    // Persist the rematch result on the bank row.
    const { error: updateErr } = await supabase
      .from("bank_accounts")
      .update({
        agreement_name_matched: matchResult.matched,
        agreement_name_match_score: matchResult.score,
        agreement_name_match_details: agreementMatchDetails,
      })
      .eq("id", bankAccount.id)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[rematch-bank-name] update failed:", updateErr);
      throw new AppError(
        "Failed to persist rematch result",
        "DB_ERROR",
        500
      );
    }

    if (matchResult.matched) {
      await audit.logSuccess(
        "BANK_NAME_REMATCH_SUCCESS",
        "verification",
        "bank_account",
        bankAccount.id,
        {
          score: matchResult.score,
          matched_landlord: matchResult.matchedName,
          candidate_count: allLandlordNames.length,
        }
      );
    } else {
      await audit.logFailure(
        "BANK_NAME_REMATCH_FAILED",
        "verification",
        "AGREEMENT_NAME_MISMATCH",
        `Bank holder "${verifiedName}" did not match new agreement landlords: ${allLandlordNames.join(", ")}`,
        "bank_account",
        bankAccount.id,
        {
          score: matchResult.score,
          candidate_count: allLandlordNames.length,
        }
      );
    }

    return jsonResponse({
      success: true,
      data: {
        bank_account_id: bankAccount.id,
        agreement_name_matched: matchResult.matched,
        agreement_match_score: matchResult.score,
        matched_landlord_name: matchResult.matchedName,
        verified_name: verifiedName,
        candidate_landlord_names: allLandlordNames,
        message: matchResult.matched
          ? "Bank holder matches the new agreement landlord."
          : "Bank holder doesn't match the new agreement landlord.",
      },
    });
  } catch (error) {
    if (audit && userId) {
      try {
        await audit.logFailure(
          "BANK_NAME_REMATCH_ERROR",
          "verification",
          (error as { code?: string })?.code ?? "UNKNOWN",
          (error as Error)?.message ?? "Unknown error",
          "bank_account",
          undefined,
          {}
        );
      } catch {
        // Don't let audit failures mask the original error.
      }
    }
    return handleError(error);
  }
});
