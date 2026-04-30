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
 * Rule: BOTH the persisted `bankDetailsCompleted` flag AND a verified
 * `bank_accounts.party_type='landlord'` row must be present. The flag
 * prevents the partial-row case (verifyBank can create a row before the
 * user taps "Confirm & continue" — if they kill the app mid-flow we'd
 * otherwise treat them as done).
 *
 * Backwards-compat: legacy users on builds before the flag existed have
 * `bankDetailsCompleted=false` even when their bank row is fully verified.
 * The router will route them back to /(agreement)/add-bank-details once,
 * where handleConfirm sets the flag and forward routing works thereafter.
 */

import { supabase } from '@/src/services/supabase/client';
import { useUploadStore } from '@/src/stores/upload';

export async function userHasLandlordBankRow(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('party_type', 'landlord')
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch (err) {
    console.warn('[bankDetailsGate] bank-row query failed:', err);
    return false;
  }
}

export async function bankDetailsAreSettled(userId: string): Promise<boolean> {
  if (!useUploadStore.getState().bankDetailsCompleted) return false;
  return userHasLandlordBankRow(userId);
}
