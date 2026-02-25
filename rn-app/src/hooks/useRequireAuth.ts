/**
 * Auth Guard Hook
 *
 * Passive guard that reads auth state from AuthProvider context.
 * No listeners, no navigation — AuthProvider handles sign-out redirect.
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
  return { isReady: !isLoading, isAuthenticated };
}
