/**
 * resetForReupload — single-call helper invoked when the user chooses to
 * re-upload after a terminal extraction failure (or any flow state where
 * the existing agreement record is no longer trustworthy).
 *
 * PR-4: penny-drop preservation across re-uploads.
 *   Before PR-4, this function hard-deleted the user's pre-waitlist landlord
 *   bank_accounts row. That meant every re-upload re-charged Cashfree's
 *   penny-drop fee (~Rs 3-5) on the next bank verification — even though the
 *   bank account itself was still legitimately verified (only the agreement
 *   name match against the new agreement is invalid).
 *
 *   Now the function PRESERVES the verified bank row and clears ONLY the
 *   agreement-name-match fields. AddBankForm re-runs the cheap, no-Cashfree
 *   rematch (rematch-bank-name edge function) against the new agreement on
 *   mount. If that succeeds, the user proceeds without re-paying. If it
 *   fails (different landlord), the user is asked to enter new bank details
 *   and the penny-drop fires for the genuinely different bank — once.
 *
 * Behaviour:
 *   1. For pre-waitlist users (user_status in {signed_up, agreement_confirmed,
 *      waitlisted}): if a verified=true landlord bank row exists, UPDATE it
 *      to clear agreement_name_matched / agreement_name_match_score /
 *      agreement_name_match_details. Verified bank-account proofs (verified,
 *      pan_verified, verified_at, verified_account_holder_name, etc.) are
 *      preserved.
 *
 *      For unverified rows (verified=false — e.g. last verify-bank attempt
 *      failed name match) we still hard-delete: there's no investment to
 *      preserve and a stale row would interfere with re-entry.
 *
 *      For non-pre-waitlist users (user_status in {approved, active,
 *      not_eligible}) we leave bank_accounts alone — re-upload semantics
 *      differ post-approval and PR-4 is scoped to the pre-waitlist flow.
 *
 *   2. Mark the current extraction as "dismissed" via prepareForReupload —
 *      this prevents useMountDiscovery from resurrecting the failed
 *      extraction on the next mount.
 *
 *   3. Reset the manual-agreement store so downstream forms don't read
 *      stale fields from the old run.
 *
 *   4. PR-2: call revert_to_signed_up so the server invariant holds — a
 *      user mid-flow whose extraction goes invalid drops from waitlisted
 *      back to signed_up. The RPC is idempotent and only acts when the user
 *      is currently waitlisted; safe to call regardless.
 *
 * The old extracted_rental_info row is intentionally NOT hard-deleted: it
 * remains in the DB for audit / support, and the dismissedExtractionId
 * mechanism stops it from driving routing.
 */

import { supabase } from '@/src/services/supabase/client';
import { useUploadStore } from '@/src/stores/upload';
import { useManualAgreementStore } from '@/src/stores/manualAgreement';
import { useAuthStore } from '@/src/stores/auth';

interface ResetForReuploadOptions {
  /** User id used to scope the bank_accounts cleanup. */
  userId: string;
  /** Current extraction id (if any) — gets marked dismissed. Optional; the
   *  store falls back to its own state.extractionId when null. */
  extractionId?: string | null;
}

/** user_status values that count as "pre-waitlist" for the purposes of bank
 *  row preservation. waitlisted is included because PR-2 may have advanced
 *  the user there before the new extraction came back invalid; we still
 *  want to preserve their verified bank row across the bounce back to
 *  signed_up. */
const PRE_WAITLIST_STATUSES = new Set([
  'signed_up',
  'agreement_confirmed',
  'waitlisted',
]);

export async function resetForReupload(opts: ResetForReuploadOptions): Promise<void> {
  const { userId, extractionId } = opts;
  const userStatus = useAuthStore.getState().userStatus;
  const isPreWaitlist = userStatus === null || PRE_WAITLIST_STATUSES.has(userStatus);

  // 1. Preserve OR clear bank_accounts row depending on pre-waitlist scope.
  if (isPreWaitlist) {
    try {
      // Look up the user's landlord bank row. We branch on verified:
      //   verified=true  → UPDATE: clear only agreement_name_match_* fields,
      //                    keep penny-drop / PAN proofs.
      //   verified=false → DELETE: nothing worth preserving; a stale
      //                    unverified row would fail bankDetailsAreSettled
      //                    and confuse re-entry.
      const { data: existing, error: lookupErr } = await supabase
        .from('bank_accounts')
        .select('id, verified')
        .eq('user_id', userId)
        .eq('party_type', 'landlord')
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupErr) {
        console.warn('[resetForReupload] bank lookup failed:', lookupErr.message);
      } else if (existing) {
        if (existing.verified === true) {
          // Preserve the row. Clear ONLY the fields that depend on the
          // agreement: agreement_name_matched + score + details. Penny-drop
          // / PAN data + cf_beneficiary_id remain intact.
          const { error: updateErr } = await supabase
            .from('bank_accounts')
            .update({
              agreement_name_matched: false,
              agreement_name_match_score: null,
              agreement_name_match_details: null,
            })
            .eq('id', existing.id)
            .eq('user_id', userId);
          if (updateErr) {
            console.warn(
              '[resetForReupload] bank_accounts update (clear name match) failed:',
              updateErr.message
            );
          }
        } else {
          // Unverified row — no investment, hard-delete.
          const { error: delErr } = await supabase
            .from('bank_accounts')
            .delete()
            .eq('id', existing.id)
            .eq('user_id', userId);
          if (delErr) {
            console.warn(
              '[resetForReupload] bank_accounts delete (unverified row) failed:',
              delErr.message
            );
          }
        }
      }
      // else: no row exists — nothing to do.
    } catch (err) {
      console.warn('[resetForReupload] bank_accounts cleanup threw:', err);
    }
  }
  // else: post-approval re-upload — leave bank_accounts alone (out of scope).

  // 2. PR-2: drop user_status back to signed_up if currently waitlisted.
  // Idempotent — no-op when the user is already signed_up / approved / active.
  try {
    const { error: revertErr } = await supabase.rpc('revert_to_signed_up', {
      p_user_id: userId,
    });
    if (revertErr) {
      console.warn(
        '[resetForReupload] revert_to_signed_up failed (non-fatal):',
        revertErr.message
      );
    }
  } catch (err) {
    console.warn('[resetForReupload] revert_to_signed_up threw:', err);
  }

  // 3. Mark the existing extraction as dismissed so the upload screen lands
  // in idle state instead of resurrecting the failed run.
  useUploadStore.getState().prepareForReupload({
    extractionId: extractionId ?? null,
    errorCode: 'REUPLOAD_REQUIRED',
    errorMessage: 'Please re-upload your agreement to continue.',
  });

  // 4. Clear the bank-details-completed SecureStore flag. The bank row's
  // agreement_name_matched was just nulled (or the row preserved while the
  // agreement was invalidated) — both states mean bank is no longer "settled"
  // for the journey router's bankDetailsAreSettled check. Without this clear,
  // the router would still treat the user as past the bank gate and route
  // them to /(waitlist) before the rematch flow runs.
  useUploadStore.getState().setBankDetailsCompleted(false);

  // 5. Wipe the in-memory manual-agreement form so downstream screens don't
  // read stale fields from the discarded extraction.
  useManualAgreementStore.getState().reset();
}
