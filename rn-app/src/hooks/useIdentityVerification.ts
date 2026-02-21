/**
 * Identity Verification Hooks
 *
 * Two-step non-blocking flow after OTP verification:
 * 1. useRecordConsent — persists consent to backend with accurate timestamp/IP
 * 2. useIdentityFetch — triggers Cashfree Mobile 360 using persisted consent
 */

import { useMutation } from '@tanstack/react-query';
import { recordConsent, fetchIdentityWithConsent } from '../services/api/identity';

/**
 * Records consent to the backend (identity_verifications table).
 * Called right after OTP verification when user gave Mobile 360 consent.
 * Idempotent — returns existing record if consent already recorded.
 */
export function useRecordConsent() {
  return useMutation({
    mutationFn: recordConsent,
    meta: { suppressGlobalError: true },
    onError: (err) => {
      console.warn('[identity] Consent recording failed (non-blocking):', err);
    },
    retry: 1,
  });
}

/**
 * Fire-and-forget mutation for Cashfree Mobile 360 identity fetch.
 * Called after consent is recorded.
 */
export function useIdentityFetch() {
  return useMutation({
    mutationFn: fetchIdentityWithConsent,
    meta: { suppressGlobalError: true },
    onError: (err) => {
      console.warn('[identity] Mobile 360 fetch failed (non-blocking):', err);
    },
    retry: false,
  });
}
