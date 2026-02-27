/**
 * Auth Guard Hook
 *
 * Passive guard that reads auth state from AuthProvider context.
 * No listeners, no navigation — AuthProvider handles sign-out redirect.
 *
 * In DEV mode, respects devAuthBypass flag from DevNavigator
 * so protected screens can be reached without a real Supabase session.
 *
 * Usage in a protected layout:
 *   const { isReady } = useRequireAuth();
 *   if (!isReady) return null; // or loading spinner
 */

import { useAuthContext } from '@/src/providers';

/**
 * Returns { isReady, isAuthenticated } from centralized AuthProvider.
 * Same interface as before — all 7 protected layouts work unchanged.
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuthContext();

  // In dev mode, check if DevNavigator has set the auth bypass flag.
  // Uses getState() (not the hook) to avoid rules-of-hooks violation.
  if (__DEV__) {
    try {
      const { useDevStore } = require('@/src/__dev__/devStore');
      const devAuthBypass = (useDevStore as any).getState().devAuthBypass;
      if (devAuthBypass) {
        return { isReady: true, isAuthenticated: true };
      }
    } catch {
      // devStore not available — ignore
    }
  }

  return { isReady: !isLoading, isAuthenticated };
}
