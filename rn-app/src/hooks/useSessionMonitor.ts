/**
 * Session Monitor Hook
 *
 * Listens for AppState changes (background -> active) and refreshes
 * the Supabase session on app foreground. Re-fetches dashboard data
 * if the session is still valid.
 *
 * IMPORTANT: This hook NEVER calls supabase.auth.getUser(). That method
 * triggers the SDK's internal _callRefreshToken() → _removeSession() →
 * SIGNED_OUT chain when the JWT is expired and the refresh token has been
 * rotated. Instead, we make a direct fetch to /auth/v1/user with the
 * current access token, bypassing the SDK's dangerous refresh machinery.
 *
 * Usage in root layout or a top-level provider:
 *   useSessionMonitor();
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase/client';
import { dashboardKeys } from './useDashboard';
import type { Session } from '@supabase/supabase-js';

/**
 * Lightweight breadcrumb logger.
 * Dynamically imports Sentry to avoid bundling issues in test environments
 * where @sentry/react-native ESM exports cause transform errors.
 */
function logBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
  try {
    // Dynamic require avoids breaking Jest transforms for the hooks barrel
    const sentry = require('../config/sentry');
    sentry.addBreadcrumb(message, category, data);
  } catch {
    // Sentry not available (e.g. test env) -- silent fallback
    if (__DEV__) {
      console.log(`[${category}] ${message}`, data ?? '');
    }
  }
}

/**
 * Validates a user's session against the server WITHOUT using supabase.auth.getUser().
 *
 * Why: getUser() internally calls _useSession() → __loadSession() → _callRefreshToken()
 * when the JWT is expired. If the refresh token was already consumed (rotation), the
 * server returns 401, which is non-retryable, so the SDK calls _removeSession() →
 * fires SIGNED_OUT → user gets logged out spuriously (e.g. during interrupted uploads).
 *
 * This function makes a direct HTTP call with the current access token. If the token
 * is expired, the server returns 401 — but we DON'T trigger a logout for that, because
 * token expiry is normal and the SDK's auto-refresh timer will handle renewal. We only
 * treat 403/404 as "user deleted/banned" signals.
 *
 * Returns:
 *  - 'valid': user exists on server
 *  - 'deleted': user was deleted/banned (403 or 404)
 *  - 'expired': token expired (401) — normal, let SDK auto-refresh handle it
 *  - 'network_error': couldn't reach server — keep session
 */
async function validateUserServerSide(accessToken: string): Promise<'valid' | 'deleted' | 'expired' | 'network_error'> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return 'network_error';

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
    });

    if (response.ok) return 'valid';
    if (response.status === 401) return 'expired'; // Token expired — not a deletion
    if (response.status === 403 || response.status === 404) return 'deleted';
    return 'network_error'; // 5xx, etc. — don't sign out
  } catch {
    return 'network_error';
  }
}

/** Minimum time (ms) the app must have been backgrounded before triggering a refresh */
const MIN_BACKGROUND_DURATION_MS = 5_000; // 5 seconds

/** Cooldown between session refreshes to avoid hammering the server */
const REFRESH_COOLDOWN_MS = 30_000; // 30 seconds

/** Interval for periodic server-side session validation while foregrounded.
 * This is a fallback for when realtime DELETE subscription is disconnected.
 * Set to 30 min (half of JWT expiry) for safety margin — catches expired
 * tokens before the full hour, reducing the window where API calls fail. */
const FOREGROUND_POLL_INTERVAL_MS = 30 * 60_000; // 30 minutes

export interface UseSessionMonitorOptions {
  /** Whether monitoring is enabled. Defaults to true. */
  enabled?: boolean;
  /** Minimum background duration before triggering refresh. Defaults to 5s. */
  minBackgroundDuration?: number;
  /** Current session from AuthProvider. Avoids calling getSession() internally. */
  currentSession?: Session | null;
}

/**
 * Monitors AppState transitions and refreshes the Supabase auth session
 * when the app returns to the foreground. If the session is valid,
 * dashboard queries are invalidated to fetch fresh data.
 */
export function useSessionMonitor(options: UseSessionMonitorOptions = {}): void {
  const {
    enabled = true,
    minBackgroundDuration = MIN_BACKGROUND_DURATION_MS,
  } = options;

  const queryClient = useQueryClient();
  const backgroundedAtRef = useRef<number | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Keep currentSession in a ref so the AppState listener and poll interval
  // always see the latest value without re-subscribing on every session update.
  const currentSessionRef = useRef<Session | null>(options.currentSession ?? null);
  currentSessionRef.current = options.currentSession ?? null;

  useEffect(() => {
    if (!enabled) return;

    const handleAppStateChange = async (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      // Track when app goes to background
      if (
        nextState === 'background' ||
        nextState === 'inactive'
      ) {
        if (previousState === 'active') {
          backgroundedAtRef.current = Date.now();
        }
        return;
      }

      // App returned to foreground
      if (nextState === 'active' && previousState !== 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        const now = Date.now();

        // Skip if app was only briefly backgrounded
        if (backgroundedAt && (now - backgroundedAt) < minBackgroundDuration) {
          return;
        }

        // Skip if we refreshed very recently (cooldown)
        if ((now - lastRefreshRef.current) < REFRESH_COOLDOWN_MS) {
          return;
        }

        lastRefreshRef.current = now;
        backgroundedAtRef.current = null;

        // Use the session from AuthProvider context -- NEVER call getSession() here.
        // getSession() triggers _callRefreshToken() in auth-js v2.65.1 which races
        // with autoRefreshToken and can cause SIGNED_OUT -> spurious logout.
        const session = currentSessionRef.current;
        if (!session) {
          logBreadcrumb('No session on foreground -- user signed out', 'auth');
          return;
        }

        logBreadcrumb('Session available on foreground', 'auth', {
          expiresAt: session.expires_at,
        });

        // Invalidate dashboard queries for fresh data
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

        try {
          // Server-side validation: detect deleted/banned users via direct fetch.
          // NEVER uses supabase.auth.getUser() -- that triggers the SDK's internal
          // refresh chain which can fire SIGNED_OUT on transient failures.
          const result = await validateUserServerSide(session.access_token);
          if (result === 'deleted') {
            logBreadcrumb(
              'Server confirms user deleted -- signing out locally',
              'auth',
              { result }
            );
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
          // 'expired' and 'network_error' are safe -- SDK auto-refresh handles expiry,
          // and network errors shouldn't log anyone out.
        } catch (err) {
          // Non-fatal -- session might still be valid from cache
          logBreadcrumb(
            'Session monitor error',
            'auth',
            { error: err instanceof Error ? err.message : 'unknown' }
          );
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic server-side validation while the app is foregrounded.
    // Fallback for when realtime DELETE subscription is disconnected.
    // Uses direct fetch — never supabase.auth.getUser().
    const pollInterval = setInterval(async () => {
      if (appStateRef.current !== 'active') return;
      const currentSession = currentSessionRef.current;
      if (!currentSession) return;

      try {
        const result = await validateUserServerSide(currentSession.access_token);
        if (result === 'deleted') {
          logBreadcrumb(
            'Periodic poll: user deleted — signing out',
            'auth',
            { result }
          );
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch {
        // Network error — keep session
      }
    }, FOREGROUND_POLL_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(pollInterval);
    };
  }, [enabled, minBackgroundDuration, queryClient]);
}
