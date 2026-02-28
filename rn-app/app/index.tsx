/**
 * Entry Point — Journey-Aware Router
 *
 * Determines the correct screen based on auth + waitlist state:
 *  1. Not authenticated -> auth flow (beta-splash)
 *  2. Authenticated, waitlist pending/rejected -> waitlist screen
 *  3. Authenticated, waitlist approved -> main dashboard
 *     (dashboard itself handles agreement/setup prompts)
 *
 * Auth state is read from AuthProvider (single source of truth).
 * Navigation uses imperative router.replace() to avoid re-fire issues.
 *
 * In __DEV__ mode, requires real auth before showing Screen Picker.
 * Set DISABLE_SCREEN_PICKER to true to bypass picker.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { getWaitlistStatus } from '@/src/services/api/waitlist';
const DISABLE_SCREEN_PICKER = __DEV__ ? require('./(dev)/screen-picker').DISABLE_SCREEN_PICKER : true;
const DEV_DIRECT_SCREEN = __DEV__ ? require('./(dev)/screen-picker').DEV_DIRECT_SCREEN : null;
import { SkeletonLoader } from '@/src/components';
import { useAuthContext } from '@/src/providers';
import { useUploadStore } from '@/src/stores/upload';
import { addBreadcrumb } from '@/src/config/sentry';

// Global screenshot params for dev pipeline — set state for screens that need mock data
// e.g. SCREENSHOT_PARAMS = { state: 'filled' } injects state into useScreenshotParams()
export const SCREENSHOT_PARAMS: Record<string, string> | null = null;

type JourneyTarget =
  | '/(auth)/beta-splash'
  | '/(agreement)/upload'
  | '/(waitlist)'
  | '/(setup)'
  | '/(main)'
  | '/(dev)/screen-picker';

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [journeyResolved, setJourneyResolved] = useState(false);
  const [target, setTarget] = useState<JourneyTarget | string | null>(null);
  const hasNavigatedRef = useRef(false);

  const resolveAuthenticatedJourney = useCallback(async (retryCount = 0) => {
    try {
      // BUG 2: Wait for upload store hydration (max 500ms) before reading state.
      // SecureStore is fast (~10-50ms), but we need the store ready before
      // deciding whether to route to review vs upload.
      if (!useUploadStore.getState()._hasHydrated) {
        await new Promise<void>((resolve) => {
          const unsub = useUploadStore.subscribe((s) => {
            if (s._hasHydrated) { unsub(); resolve(); }
          });
          setTimeout(() => { unsub(); resolve(); }, 500);
        });
      }

      const { data, error } = await getWaitlistStatus();

      if (error || !data) {
        if (retryCount < 1) {
          setTimeout(() => resolveAuthenticatedJourney(retryCount + 1), 1000);
          return;
        }
        setTarget('/(agreement)/upload');
        setJourneyResolved(true);
        return;
      }

      switch (data.userStatus) {
        case 'signed_up': {
          // BUG 2 FIX: If the upload store has a completed extraction with a valid
          // extractionId, route directly to review — prevents jarring flash through
          // the upload screen when the app is killed and reopened during review.
          const uploadState = useUploadStore.getState();
          if (
            uploadState.uploadPhase === 'completed' &&
            uploadState.extractionId
          ) {
            setTarget('/(agreement)/review');
          } else {
            setTarget('/(agreement)/upload');
          }
          break;
        }
        case 'agreement_confirmed':
        case 'waitlisted':
        case 'not_eligible':
          setTarget('/(waitlist)');
          break;
        case 'approved':
          setTarget('/(setup)');
          break;
        case 'active':
          setTarget('/(main)');
          break;
        default:
          setTarget('/(agreement)/upload');
          break;
      }
      setJourneyResolved(true);
    } catch (err) {
      if (retryCount < 1) {
        setTimeout(() => resolveAuthenticatedJourney(retryCount + 1), 1000);
        return;
      }
      addBreadcrumb('resolveAuthenticatedJourney failed', 'navigation', {
        error: err instanceof Error ? err.message : String(err),
      });
      setTarget('/(agreement)/upload');
      setJourneyResolved(true);
    }
  }, []);

  // Resolve journey target once auth state is known
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setTarget('/(auth)/beta-splash');
      setJourneyResolved(true);
      return;
    }

    // Authenticated — check dev mode shortcuts
    if (__DEV__ && DEV_DIRECT_SCREEN) {
      setTarget(DEV_DIRECT_SCREEN);
      setJourneyResolved(true);
      return;
    }

    if (__DEV__ && !DISABLE_SCREEN_PICKER) {
      setTarget('/(dev)/screen-picker');
      setJourneyResolved(true);
      return;
    }

    // Authenticated, normal mode — resolve full journey
    resolveAuthenticatedJourney();
  }, [authLoading, isAuthenticated, resolveAuthenticatedJourney]);

  // Imperative one-shot navigation — guarded by navigation readiness.
  // In release mode, SecureStore resolves auth state faster than fonts load,
  // so router.replace() can fire before _layout.tsx mounts the <Stack>.
  // useRootNavigationState().key is undefined until the navigator is mounted.
  useEffect(() => {
    if (!journeyResolved || !target || hasNavigatedRef.current) return;
    if (!rootNavigationState?.key) return;
    hasNavigatedRef.current = true;
    router.replace(target as never);
  }, [journeyResolved, target, router, rootNavigationState?.key]);

  // Always render skeleton — invisible behind navigated screen, avoids ghost screen in Stack
  return <SkeletonLoader />;
}
