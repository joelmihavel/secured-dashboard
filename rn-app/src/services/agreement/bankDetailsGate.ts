/**
 * Bank-details completion gate.
 *
 * Single source of truth for "has the user finished landlord bank details?".
 * Used by every router/navigation surface that decides between
 * /(agreement)/add-bank-details and /(waitlist) or /(main):
 *
 *   - app/index.tsx           (cold-start journey router)
 *   - app/(auth)/otp.tsx      (post-OTP routing)
 *   - app/(waitlist)/approved.tsx ("Step inside" button)
 *
 * Rule: BOTH the persisted `bankDetailsCompleted` flag AND a *verified*
 * `bank_accounts.party_type='landlord'` row must be present. The flag
 * prevents the partial-row case (verifyBank/verifyUpiVpa can create a row
 * with verified=false on NAME_MISMATCH — if we accepted any row, a user
 * who entered a wrong-holder bank could be treated as "settled"). The
 * verified=true filter closes that leak.
 *
 * Backwards-compat: legacy users on builds before the flag existed have
 * `bankDetailsCompleted=false` even when their bank row is fully verified.
 * The router will route them back to /(agreement)/add-bank-details once,
 * where handleConfirm sets the flag and forward routing works thereafter.
 */

import { supabase } from '@/src/services/supabase/client';
import { useUploadStore } from '@/src/stores/upload';

/**
 * Returns true only if the user has a *verified* landlord bank row. A row
 * with verified=false (NAME_MISMATCH or failed penny-drop) does NOT count.
 *
 * Pre-fix this was a verified-agnostic existence check, which let the
 * journey router route a user with a wrong-holder unverified row straight
 * to /(main) (decideApprovedTarget) or /(waitlist) (waitlisted branch),
 * skipping the verification gate.
 */
export async function userHasLandlordBankRow(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('party_type', 'landlord')
      .eq('verified', true)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch (err) {
    console.warn('[bankDetailsGate] bank-row query failed:', err);
    return false;
  }
}

/**
 * Stricter sibling of userHasLandlordBankRow that also requires pan_verified=true.
 * Used by upload.tsx to decide whether the post-extraction bounce should land
 * on /(waitlist) directly (both gates met) or /(agreement)/add-bank-details
 * (still needs PAN). Same-shape query, just one extra filter.
 */
export async function userHasLandlordBankAndPanVerified(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('party_type', 'landlord')
      .eq('verified', true)
      .eq('pan_verified', true)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch (err) {
    console.warn('[bankDetailsGate] bank+pan query failed:', err);
    return false;
  }
}

export async function bankDetailsAreSettled(userId: string): Promise<boolean> {
  if (!useUploadStore.getState().bankDetailsCompleted) return false;
  return userHasLandlordBankRow(userId);
}
