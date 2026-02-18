/**
 * Session Monitor Hook
 *
 * Listens for AppState changes (background -> active) and refreshes
 * the Supabase session on app foreground. Re-fetches dashboard data
 * if the session is still valid.
 *
 * Usage in root layout or a top-level provider:
 *   useSessionMonitor();
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase/client';
import { dashboardKeys } from './useDashboard';

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

/** Minimum time (ms) the app must have been backgrounded before triggering a refresh */
const MIN_BACKGROUND_DURATION_MS = 5_000; // 5 seconds

/** Cooldown between session refreshes to avoid hammering the server */
const REFRESH_COOLDOWN_MS = 30_000; // 30 seconds

export interface UseSessionMonitorOptions {
  /** Whether monitoring is enabled. Defaults to true. */
  enabled?: boolean;
  /** Minimum background duration before triggering refresh. Defaults to 5s. */
  minBackgroundDuration?: number;
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

        try {
          // Refresh the Supabase session
          const { data, error } = await supabase.auth.refreshSession();

          if (error) {
            logBreadcrumb(
              'Session refresh failed on foreground',
              'auth',
              { error: error.message }
            );
            return;
          }

          if (data.session) {
            logBreadcrumb(
              'Session refreshed on foreground',
              'auth',
              { expiresAt: data.session.expires_at }
            );

            // Session is valid -- invalidate dashboard queries for fresh data
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
          } else {
            logBreadcrumb(
              'No session after refresh -- user signed out elsewhere',
              'auth'
            );
          }
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

    return () => {
      subscription.remove();
    };
  }, [enabled, minBackgroundDuration, queryClient]);
}
