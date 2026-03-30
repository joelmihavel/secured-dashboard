/**
 * AuthProvider — Single Source of Truth for Auth State
 *
 * Consolidates all onAuthStateChange listeners into one location.
 * Eliminates race conditions from multiple listeners competing to navigate.
 *
 * Provides: { session, isLoading, isAuthenticated }
 * Handles: sign-out navigation (single controlled redirect)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/src/services/supabase/client';
import { clearAllStores } from '@/src/stores/resetAll';
import { registerForPushNotifications } from '@/src/services/notifications';
import { isReviewMode, deactivateReviewMode } from '@/src/review/reviewMode';
import { isJourneyMode, deactivateJourneyMode } from '@/src/review/journeyMode';
import { useSessionMonitor } from '@/src/hooks/useSessionMonitor';
import { beginTokenRefreshTracking, endTokenRefreshTracking, OTA_RELOAD_MARKER_KEY } from '@/src/config/updates';
import { detectAndHandleFreshInstall, detectAndHandleVersionChange } from '@/src/utils/installDetection';
import type { Session } from '@supabase/supabase-js';

/**
 * DB migration key — bump this when switching Supabase projects.
 * On first launch after a DB migration, stale sessions (signed by the old
 * project's JWT secret) linger in iOS Keychain because Keychain data
 * persists across app uninstalls. Without cleanup, the app loads the old
 * session → all API calls 401 → degraded UX before eventual SIGNED_OUT.
 */
const DB_MIGRATION_KEY = 'flent_db_migration';
const CURRENT_DB_VERSION = 'main_v3'; // Only bump when Supabase project changes — NOT for code fixes

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

  // Tracks current session without triggering re-renders. Used by the
  // SIGNED_OUT handler to check if TOKEN_REFRESHED recovered the session.
  const sessionRef = useRef<Session | null>(null);

  // Set by migration guard to prevent INITIAL_SESSION from re-setting a cleared session.
  // Without this, the guard calls signOut → sets session=null, but INITIAL_SESSION fires
  // with the cached (stale) session and overwrites the null → user stays "authenticated".
  const migrationGuardFiredRef = useRef(false);

  const updateSession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    setSession(s);
  }, []);

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
        // Fresh install detection: iOS Keychain persists across app delete/reinstall.
        // If the app was reinstalled, wipe all stale Keychain data before proceeding.
        // Uses a filesystem sentinel (wiped on uninstall) to detect reinstalls.
        const wasFreshInstall = await detectAndHandleFreshInstall();
        if (wasFreshInstall) {
          console.log('[AuthProvider] Fresh install detected — all Keychain data cleared');
          updateSession(null);
          setIsLoading(false);
          return;
        }

        // App version gate: wipe persisted Zustand stores when version changes.
        // Prevents old-schema data from crashing new code after forced updates.
        // Supabase session is preserved — user stays logged in.
        await detectAndHandleVersionChange();

        // DB migration guard: clear stale keychain sessions from old Supabase project.
        // iOS Keychain persists across app uninstalls, so users who had the Dev DB build
        // and install the Main DB build would load a session signed by the wrong JWT secret.
        const storedVersion = await SecureStore.getItemAsync(DB_MIGRATION_KEY).catch(() => null);
        if (storedVersion !== CURRENT_DB_VERSION) {
          console.log('[AuthProvider] DB migration detected — clearing stale keychain session');
          migrationGuardFiredRef.current = true; // Block INITIAL_SESSION from re-setting
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          await SecureStore.setItemAsync(DB_MIGRATION_KEY, CURRENT_DB_VERSION).catch(() => {});
          updateSession(null);
          setIsLoading(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!initialSession) {
          // No session found. This can happen normally (first launch) or due to a
          // Supabase URL mismatch: the SDK stores sessions under a key derived from
          // the project URL (sb-<ref>-auth-token). If an OTA changed the URL (e.g.,
          // stale Metro cache shipped Main DB URL instead of Dev DB), the session
          // stored under the old key becomes invisible. The user must sign in again.
          console.log('[AuthProvider] No session found — user needs to sign in');
        }
        if (initialSession) {
          // If the JWT is expired or near-expiry (<60s), the SDK's autoRefreshToken
          // will fire _callRefreshToken() async. Track this so reloadApp() can wait
          // for the refresh to persist tokens before killing the JS runtime.
          const expiresAt = initialSession.expires_at ?? 0;
          const nowSec = Math.floor(Date.now() / 1000);
          if (expiresAt <= nowSec + 60) {
            beginTokenRefreshTracking();
          }

          // Server-validate the cached session immediately on cold start.
          // A deleted/banned user may still have a valid JWT in SecureStore.
          // Uses direct fetch — NEVER supabase.auth.getUser() which triggers
          // the SDK's _callRefreshToken() → _removeSession() → SIGNED_OUT chain.
          const deleted = await isUserDeletedOnServer(initialSession.access_token);
          if (deleted) {
            endTokenRefreshTracking(); // Cancel tracking — session is being cleared
            await supabase.auth.signOut({ scope: 'local' });
            updateSession(null);
            return;
          }
          updateSession(initialSession);
        } else {
          updateSession(null);
        }
      } catch {
        updateSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    // 2. Single auth state change listener for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === 'SIGNED_OUT') {
          // User-initiated sign-out (from useAuth().signOut() or useDeleteAccount()).
          // Skip the 3s transient-failure debounce — navigate immediately.
          // useAuth().signOut() handles store cleanup; we just need to update
          // React state and navigate.
          if (userInitiatedSignOutRef.current) {
            userInitiatedSignOutRef.current = false;
            updateSession(null);
            // Immediately clear cached route — don't wait for clearAllStores async
            SecureStore.deleteItemAsync('flent_last_journey_target').catch(() => {});
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              routerRef.current.replace('/(auth)/splash' as never);
              setTimeout(() => { hasRedirectedRef.current = false; }, 2000);
            }
            return;
          }

          // SDK fires SIGNED_OUT on transient refresh failures (network timeout,
          // ISP DNS block, Cloudflare cold-start). If TOKEN_REFRESHED fires within
          // the debounce window, the SIGNED_OUT was transient -- ignore it.
          //
          // After OTA reload, extend debounce from 3s to 5s: the SDK needs extra
          // time to load persisted session from SecureStore and attempt recovery.
          // The marker is consume-on-read to prevent stale markers from affecting
          // future genuine sign-outs.
          //
          // NEVER call getSession() here -- it triggers _callRefreshToken() which
          // can race with autoRefreshToken and cause another SIGNED_OUT (loop).
          // Instead, wait and check if TOKEN_REFRESHED resolves the situation.
          endTokenRefreshTracking(); // Clear any pending refresh wait
          const signOutTimestamp = Date.now();

          // Read OTA reload marker and schedule debounce in an async IIFE.
          // The onAuthStateChange callback is synchronous — cannot use await directly.
          // This IIFE yields to the event loop for SecureStore read, which is
          // desirable: any TOKEN_REFRESHED event arriving during the read will
          // update sessionRef.current before the debounce timer starts.
          (async () => {
            let debounceMs = 3000;
            try {
              const markerTs = await SecureStore.getItemAsync(OTA_RELOAD_MARKER_KEY);
              if (markerTs) {
                // Consume-on-read — prevents stale marker from affecting future sign-outs
                SecureStore.deleteItemAsync(OTA_RELOAD_MARKER_KEY).catch(() => {});
                const elapsed = Date.now() - parseInt(markerTs, 10);
                if (elapsed < 15000) {
                  debounceMs = 5000; // Post-OTA: 5s for recovery
                  console.log('[AuthProvider] Post-OTA reload — extending SIGNED_OUT debounce to 5s');
                }
              }
            } catch {
              // Non-fatal — use default debounce
            }

            setTimeout(async () => {
            // If a TOKEN_REFRESHED event updated the session after this SIGNED_OUT,
            // the session ref will be non-null. Check the ref directly to avoid
            // stale closure over session state.
            if (sessionRef.current) {
              console.warn('[AuthProvider] SIGNED_OUT ignored -- session recovered via TOKEN_REFRESHED');
              return;
            }

            // No recovery -- genuine sign-out
            if (hasRedirectedRef.current) return;
            hasRedirectedRef.current = true;

            console.log('[AuthProvider] SIGNED_OUT confirmed -- clearing session', {
              elapsed: Date.now() - signOutTimestamp,
            });

            if (isReviewMode()) deactivateReviewMode();
            if (isJourneyMode()) deactivateJourneyMode();
            await clearAllStores();
            updateSession(null);

            routerRef.current.replace('/(auth)/splash' as never);

            // Reset after navigation settles
            setTimeout(() => {
              hasRedirectedRef.current = false;
            }, 2000);
          }, debounceMs);
          })(); // End async IIFE for OTA marker read + debounce scheduling
        } else if (event === 'TOKEN_REFRESHED') {
          endTokenRefreshTracking(); // Signal reloadApp() that tokens are persisted
          if (newSession) {
            // Token refresh succeeded -- update with fresh tokens
            updateSession(newSession);
          } else {
            // Token refresh failed (likely transient network error, ISP DNS block,
            // or Cloudflare proxy cold-start). DO NOT clear the session — the user
            // stays logged in with the cached (possibly expired) session. The next
            // authenticated API call will trigger another refresh attempt.
            console.warn('[AuthProvider] TOKEN_REFRESHED returned null — keeping cached session');
          }
        } else if (event === 'SIGNED_IN' && newSession) {
          endTokenRefreshTracking(); // Clear any pending refresh tracking
          updateSession(newSession);
          hasRedirectedRef.current = false;
          // Register push token after successful auth
          registerForPushNotifications().catch(() => {
            // Non-blocking — token registration failures are logged inside the function
          });
        } else if (event === 'INITIAL_SESSION') {
          // getSession() above already set the initial state. INITIAL_SESSION fires
          // with the pre-refresh (possibly expired) session BEFORE TOKEN_REFRESHED.
          // Only update if we got a valid session (don't overwrite with null).
          // SKIP if migration guard already cleared the session — prevents re-setting
          // a stale Dev DB session that the guard just removed.
          if (newSession && !migrationGuardFiredRef.current) {
            updateSession(newSession);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — subscribe once, use refs for mutable values

  // Proactively refresh session when app returns to foreground after background
  useSessionMonitor({ enabled: !isLoading && !!session, currentSession: session });

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
