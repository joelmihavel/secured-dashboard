/**
 * Identity Verification Hook
 *
 * Fire-and-forget mutation for Cashfree Mobile 360 identity fetch.
 * Called non-blocking after authentication when user gave consent.
 */

import { useMutation } from '@tanstack/react-query';
import { fetchIdentityWithConsent } from '../services/api/identity';

export function useIdentityFetch() {
  return useMutation({
    mutationFn: fetchIdentityWithConsent,
    onError: (err) => {
      console.warn('[identity] Mobile 360 fetch failed (non-blocking):', err);
    },
    retry: false,
  });
}
