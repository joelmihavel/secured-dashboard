/**
 * Flent Secured v2 - Deferred Bank Name Matching (Cloud Run Port)
 *
 * Ported from: supabase/functions/_shared/onboarding.ts -> runDeferredBankNameMatching
 *
 * When a user adds bank details before waitlist (no tenancy yet), the penny drop
 * runs but name matching is skipped (agreement_name_match_details = { skipped: true }).
 * Once extraction completes and a tenancy is created, this function picks up those
 * pending accounts and runs Gemini name matching against the newly-available
 * landlord names from the agreement.
 *
 * Outcomes:
 * - Name matches:  bank stays verified, tenancy.bank_verified = true, attempt status advance
 * - Name mismatch: bank stays verified (penny drop confirmed), admin reviews during approval
 * - No pending banks or no landlord names: no-op (early return)
 *
 * This is intentionally non-fatal -- callers wrap in try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAgreementNames,
  matchAgainstAgreementNames,
} from "./name-matching.js";
import { recomputeAndStoreRisk } from "./risk.js";

// ==============================================
// MAIN EXPORT
// ==============================================

export async function runDeferredBankNameMatching(
  supabase: SupabaseClient,
  userId: string,
  tenancyId: string
): Promise<void> {
  // 1. Find pre-verified bank accounts (penny drop done, name match was skipped)
  const { data: pendingBanks, error: bankQueryError } = await supabase
    .from("bank_accounts")
    .select(
      "id, verified_account_holder_name, pan_registered_name, pan_verified, pan_verification_details, penny_drop_status, agreement_name_match_details"
    )
    .eq("user_id", userId)
    .eq("party_type", "landlord")
    .eq("is_primary", true)
    .eq("penny_drop_status", "SUCCESS")
    .not("agreement_name_match_details", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (bankQueryError) {
    console.error(
      "[onboarding] Deferred bank name matching -- query failed:",
      bankQueryError
    );
    return;
  }

  // Filter in code for skipped === true (more reliable than JSONB operator variations)
  const skippedBanks = (pendingBanks ?? []).filter(
    (b: any) => b.agreement_name_match_details?.skipped === true
  );

  if (skippedBanks.length === 0) return;

  // Take the most recent primary landlord bank account
  const bank = skippedBanks[0] as Record<string, any>;
  if (!bank.verified_account_holder_name) return;

  // 2. Resolve landlord names from the new tenancy/extraction
  const resolved = await resolveAgreementNames(
    supabase,
    tenancyId,
    "landlord"
  );
  if (resolved.names.length === 0) {
    console.log(
      "[onboarding] Deferred bank name matching -- no landlord names available yet"
    );
    return;
  }

  // 3. Run Gemini name matching (with Levenshtein fallback)
  const matchResult = await matchAgainstAgreementNames({
    verifiedName: bank.verified_account_holder_name,
    candidateNames: resolved.names,
    context: "agreement_bank_verification",
  });

  // 4. Update bank account with match result
  const nameMatched = matchResult.matched;
  const { error: updateError } = await supabase
    .from("bank_accounts")
    .update({
      agreement_name_matched: nameMatched,
      agreement_name_match_score: matchResult.score,
      agreement_name_match_details: {
        ...matchResult.details,
        deferred: true,
        matched_at: new Date().toISOString(),
      },
      // Keep verified = true (penny drop confirmed account exists).
      // Name match result is informational -- admin decides during approval.
    })
    .eq("id", bank.id);

  if (updateError) {
    console.error(
      `[onboarding] Deferred bank name matching -- update failed for bank ${bank.id}:`,
      updateError
    );
    return;
  }

  console.log(
    `[onboarding] Deferred name match for bank ${bank.id}: matched=${nameMatched}, score=${matchResult.score}`
  );

  // 4b. Run PAN name matching if PAN was verified pre-waitlist
  let panNameMatched: boolean | null = null;
  let panMatchScore: number | null = null;
  if (bank.pan_registered_name && bank.pan_verified) {
    try {
      const panMatchResult = await matchAgainstAgreementNames({
        verifiedName: bank.pan_registered_name,
        candidateNames: resolved.names,
        context: "pan_verification",
      });
      panNameMatched = panMatchResult.matched;
      panMatchScore = panMatchResult.score;

      await supabase
        .from("bank_accounts")
        .update({
          pan_name_matched: panMatchResult.matched,
          pan_name_match_score: panMatchResult.score,
          pan_verification_details: {
            ...(typeof bank.pan_verification_details === "object"
              ? bank.pan_verification_details
              : {}),
            ...panMatchResult.details,
            deferred: true,
            matched_at: new Date().toISOString(),
          },
        })
        .eq("id", bank.id);

      console.log(
        `[onboarding] Deferred PAN name match for bank ${bank.id}: matched=${panNameMatched}, score=${panMatchScore}`
      );
    } catch (panErr) {
      console.warn(
        "[onboarding] Deferred PAN name matching failed (non-fatal):",
        panErr
      );
    }
  }

  // 5. Always set bank_verified on tenancy -- penny drop verified the account.
  //    If name doesn't match, flag risk on waitlist entry for admin review.
  //    Admin approval = manual verification override.
  const matchedLandlordName = nameMatched
    ? matchResult.matchedName
    : null;
  await supabase
    .from("tenancies")
    .update({
      bank_verified: true,
      ...(matchedLandlordName && {
        landlord_name: matchedLandlordName,
      }),
    })
    .eq("id", tenancyId);

  // Recompute risk -- the expanded risk engine reads bank_accounts columns directly
  // (pan_name_matched, agreement_name_matched, etc.) so we don't need to manually
  // append risk_factors. This ensures one source of truth for risk computation.
  try {
    await recomputeAndStoreRisk(userId, supabase);
  } catch (riskErr) {
    console.error(
      "[onboarding] Risk recompute after deferred matching failed (non-fatal):",
      riskErr
    );
  }

  // Attempt user_status advancement (approved -> active) -- no-ops if not yet approved
  // NOTE: Uses service role -- auth.uid() is not available in Cloud Run
  try {
    await supabase.rpc("check_and_advance_to_active", {
      p_user_id: userId,
    });
  } catch (err) {
    console.warn(
      "[onboarding] check_and_advance_to_active failed (non-fatal):",
      err
    );
  }
}
