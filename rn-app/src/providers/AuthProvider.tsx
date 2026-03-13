/**
 * AuthProvider — Single Source of Truth for Auth State
 *
 * Consolidates all onAuthStateChange listeners into one location.
 * Eliminates race conditions from multiple listeners competing to navigate.
 *
 * Provides: { session, isLoading, isAuthenticated }
 * Handles: sign-out navigation (single controlled redirect)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/services/supabase/client';
import { clearAllStores } from '@/src/stores/resetAll';
import { registerForPushNotifications } from '@/src/services/notifications';
import { isReviewMode, deactivateReviewMode } from '@/src/review/reviewMode';
import { isJourneyMode, deactivateJourneyMode } from '@/src/review/journeyMode';
import { useSessionMonitor } from '@/src/hooks/useSessionMonitor';
import type { Session } from '@supabase/supabase-js';

/**
 * Validates a user exists on the server via direct fetch.
 * NEVER uses supabase.auth.getUser() — that triggers the SDK's internal
 * _callRefreshToken() → _removeSession() → SIGNED_OUT chain when the JWT
 * is expired and the refresh token has been rotated.
 */
async function isUserDeletedOnServer(accessToken: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
    });

    // Only 403/404 means user was genuinely deleted/banned.
    // 401 = token expired (normal, SDK auto-refresh will handle it).
    // 5xx = server error (transient, keep session).
    return response.status === 403 || response.status === 404;
  } catch {
    return false; // Network error — keep session
  }
}

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  isAuthenticated: false,
});

export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Use refs for values accessed inside the onAuthStateChange callback
  // to avoid re-subscribing on every navigation (router is NOT referentially stable
  // in Expo Router — it changes on every navigation state update).
  const routerRef = useRef(router);
  routerRef.current = router;

  const hasRedirectedRef = useRef(false);

  // Track whether a user-initiated sign-out is in progress.
  // When the user taps "Sign Out", useAuth().signOut() clears stores and navigates.
  // The SDK then fires SIGNED_OUT, and our delayed handler would redundantly
  // call clearAllStores() + router.replace() again. This flag prevents that.
  const userInitiatedSignOutRef = useRef(false);

  // Expose a way for useAuth().signOut() to signal that it's handling cleanup.
  // This is set via a module-level function so useAuth doesn't need a context dependency.
  useEffect(() => {
    _setUserInitiatedSignOutFlag = (value: boolean) => {
      userInitiatedSignOutRef.current = value;
    };
    return () => {
      _setUserInitiatedSignOutFlag = () => {};
    };
  }, []);

  // Subscribe once — never re-subscribe. Uses refs for mutable values.
  useEffect(() => {
    // 1. Get initial session
    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          // Server-validate the cached session immediately on cold start.
          // A deleted/banned user may still have a valid JWT in SecureStore.
          // Uses direct fetch — NEVER supabase.auth.getUser() which triggers
          // the SDK's _callRefreshToken() → _removeSession() → SIGNED_OUT chain.
          const deleted = await isUserDeletedOnServer(initialSession.access_token);
          if (deleted) {
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            return;
          }
          setSession(initialSession);
        } else {
          setSession(null);
        }
      } catch {
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // 2. Single auth state change listener for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          // If user-initiated sign-out is in progress, useAuth().signOut() already
          // handled cleanup. Just update React state and skip the delayed guard.
          if (userInitiatedSignOutRef.current) {
            userInitiatedSignOutRef.current = false;
            setSession(null);
            return;
          }

          // Guard: The SDK fires SIGNED_OUT on transient refresh failures (network
          // timeout, CF proxy cold-start, ISP DNS block). The SDK clears the
          // in-memory session BEFORE firing this event, so an immediate getSession()
          // always returns null — making it useless as a guard.
          //
          // Wait 2 seconds for the SDK's auto-refresh to potentially recover
          // (it retries on transient failures), then check if a session was restored.
          setTimeout(async () => {
            try {
              const { data: { session: recoveredSession } } = await supabase.auth.getSession();
              if (recoveredSession) {
                console.warn('[AuthProvider] SIGNED_OUT fired but session recovered after delay — ignoring (transient refresh failure)');
                setSession(recoveredSession);
                return;
              }
              // No recovered session — this is a genuine sign-out
              if (hasRedirectedRef.current) return;
              hasRedirectedRef.current = true;

              if (isReviewMode()) deactivateReviewMode();
              if (isJourneyMode()) deactivateJourneyMode();
              clearAllStores();
              setSession(null);

              routerRef.current.replace('/(auth)/beta-splash' as never);

              // Reset after navigation settles
              setTimeout(() => {
                hasRedirectedRef.current = false;
              }, 2000);
            } catch {
              // getSession() itself failed — don't log out on network errors
              console.warn('[AuthProvider] SIGNED_OUT + getSession() failed — keeping session');
            }
          }, 2000);
        } else if (event === 'TOKEN_REFRESHED') {
          if (newSession) {
            // Token refresh succeeded — update with fresh tokens
            setSession(newSession);
          } else {
            // Token refresh failed (likely transient network error, ISP DNS block,
            // or Cloudflare proxy cold-start). DO NOT clear the session — the user
            // stays logged in with the cached (possibly expired) session. The next
            // authenticated API call will trigger another refresh attempt.
            console.warn('[AuthProvider] TOKEN_REFRESHED returned null — keeping cached session');
          }
        } else if (event === 'SIGNED_IN' && newSession) {
          setSession(newSession);
          hasRedirectedRef.current = false;
          // Register push token after successful auth
          registerForPushNotifications().catch(() => {
            // Non-blocking — token registration failures are logged inside the function
          });
        } else if (event === 'INITIAL_SESSION') {
          // getSession() above already set the initial state. INITIAL_SESSION fires
          // with the pre-refresh (possibly expired) session BEFORE TOKEN_REFRESHED.
          // Only update if we got a valid session (don't overwrite with null).
          if (newSession) {
            setSession(newSession);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — subscribe once, use refs for mutable values

  // Proactively refresh session when app returns to foreground after background
  useSessionMonitor({ enabled: !isLoading && !!session });

  const value: AuthContextValue = useMemo(() => ({
    session,
    isLoading,
    isAuthenticated: !!session || isReviewMode() || isJourneyMode(),
  }), [session, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Module-level function to signal user-initiated sign-out.
 * Called by useAuth().signOut() to prevent AuthProvider's delayed
 * SIGNED_OUT handler from redundantly clearing stores + navigating.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _setUserInitiatedSignOutFlag: (value: boolean) => void = () => {};
export function markUserInitiatedSignOut(): void {
  _setUserInitiatedSignOutFlag(true);
}
