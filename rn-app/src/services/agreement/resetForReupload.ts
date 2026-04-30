/**
 * resetForReupload — single-call helper invoked when the user chooses to
 * re-upload after a terminal extraction failure (or any flow state where
 * the existing agreement record is no longer trustworthy).
 *
 * Per spec: when extraction fails, the user is sent back to the upload
 * screen and any pre-waitlist bank details they entered must be re-added.
 *
 * Behaviour:
 *   1. Hard-delete the user's pre-waitlist landlord bank_accounts rows —
 *      `party_type='landlord'` because the pre-waitlist "Add bank details"
 *      form collects the LANDLORD's bank for settlement (the user IS the
 *      tenant). See src/services/api/setup.ts: party_type defaults to
 *      'landlord' on insert. RLS allows the authenticated user to delete
 *      bank_accounts rows scoped to their own user_id.
 *      Limitation: if the bank was already verified (cf_beneficiary created
 *      in Cashfree), deleting here orphans the Cashfree vendor record.
 *      Acceptable trade-off — re-upload happens pre-approval and verified
 *      banks at that stage are rare. Cleanup is a server-side concern.
 *   2. Mark the current extraction as "dismissed" via prepareForReupload —
 *      this prevents useMountDiscovery from resurrecting the failed
 *      extraction on the next mount.
 *   3. Reset the manual-agreement store so downstream forms don't read
 *      stale fields from the old run.
 *
 * The old extracted_rental_info row is intentionally NOT hard-deleted: it
 * remains in the DB for audit / support, and the dismissedExtractionId
 * mechanism stops it from driving routing.
 */

import { supabase } from '@/src/services/supabase/client';
import { useUploadStore } from '@/src/stores/upload';
import { useManualAgreementStore } from '@/src/stores/manualAgreement';

interface ResetForReuploadOptions {
  /** User id used to scope the bank_accounts cleanup. */
  userId: string;
  /** Current extraction id (if any) — gets marked dismissed. Optional; the
   *  store falls back to its own state.extractionId when null. */
  extractionId?: string | null;
}

export async function resetForReupload(opts: ResetForReuploadOptions): Promise<void> {
  const { userId, extractionId } = opts;

  // 1. Hard-delete the pre-waitlist landlord bank record(s). Schema has no
  // deleted_at column on bank_accounts (verified via the table migration),
  // so this is a real DELETE. RLS scopes the row to the user.
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('party_type', 'landlord');
    if (error) {
      console.warn('[resetForReupload] bank_accounts delete failed:', error.message);
    }
  } catch (err) {
    console.warn('[resetForReupload] bank_accounts delete threw:', err);
  }

  // 2. Mark the existing extraction as dismissed so the upload screen lands
  // in idle state instead of resurrecting the failed run.
  useUploadStore.getState().prepareForReupload({
    extractionId: extractionId ?? null,
    errorCode: 'REUPLOAD_REQUIRED',
    errorMessage: 'Please re-upload your agreement to continue.',
  });

  // 3. Wipe the in-memory manual-agreement form so downstream screens don't
  // read stale fields from the discarded extraction.
  useManualAgreementStore.getState().reset();
}
