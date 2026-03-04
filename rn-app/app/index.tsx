/**
 * Entry Point — Journey-Aware Router
 *
 * Determines the correct screen based on auth + waitlist state:
 *  1. Not authenticated -> auth flow (beta-splash)
 *  2. Authenticated, waitlist pending/rejected -> waitlist screen
 *  3. Authenticated, waitlist approved -> setup
 *  4. Authenticated, active -> main dashboard
 *
 * Routing uses TWO strategies (PostgREST primary, edge function fallback):
 *  - PRIMARY: getUser() (server-side validation) → PostgREST query for user_status
 *    Uses SDK's built-in auth — more robust than manual token handling.
 *  - FALLBACK: getWaitlistStatus() edge function via callEdgeFunction
 *    Provides richer data but has manual auth that can fail on stale sessions.
 *
 * Auth state is read from AuthProvider (single source of truth).
 * Navigation uses imperative router.replace() to avoid re-fire issues.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getWaitlistStatus } from '@/src/services/api/waitlist';
const DISABLE_SCREEN_PICKER = __DEV__ ? require('./(dev)/screen-picker').DISABLE_SCREEN_PICKER : true;
const DEV_DIRECT_SCREEN = __DEV__ ? require('./(dev)/screen-picker').DEV_DIRECT_SCREEN : null;
import { SkeletonLoader } from '@/src/components';
import { useAuthContext } from '@/src/providers';
import { useUploadStore } from '@/src/stores/upload';
import { usePaymentStore } from '@/src/stores/payment';
import { isReviewMode } from '@/src/review/reviewMode';
import { addBreadcrumb } from '@/src/config/sentry';
import { supabase } from '@/src/services/supabase/client';

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

/**
 * Query user_status directly via PostgREST (PRIMARY routing path).
 *
 * 1. Calls getUser() — validates token server-side and triggers refresh if expired
 * 2. Queries public.users via PostgREST — RLS policy users_select_own allows this
 *
 * This bypasses callEdgeFunction's manual auth handling. The Supabase SDK
 * manages token injection internally, which is more resilient to session edge cases.
 */
async function queryUserStatus(): Promise<string | null> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('[journey-router] getUser failed:', userError?.message);
      // If the server explicitly says user doesn't exist (deleted server-side),
      // force sign-out to clear the stale cached session. Without this, the app
      // stays in an authenticated-but-broken state showing skeleton screens.
      if (userError?.message?.includes('not found') || userError?.message?.includes('User not found') || userError?.status === 404) {
        console.warn('[journey-router] User deleted server-side — forcing sign-out');
        await supabase.auth.signOut();
      }
      return null;
    }

    const { data: userRecord, error } = await supabase
      .from('users')
      .select('user_status')
      .eq('id', user.id)
      .single();

    if (error || !userRecord?.user_status) {
      console.warn('[journey-router] PostgREST query failed:', error?.message);
      return null;
    }

    console.log('[journey-router] PostgREST user_status:', userRecord.user_status);
    return userRecord.user_status;
  } catch (err) {
    console.warn('[journey-router] PostgREST error:', err);
    return null;
  }
}

/**
 * Map user_status string to a JourneyTarget route.
 * Returns null for statuses that need upload store context (signed_up).
 */
function statusToTarget(userStatus: string): JourneyTarget | '/(agreement)/review' | null {
  switch (userStatus) {
    case 'approved':
      return '/(setup)';
    case 'active':
      return '/(main)';
    case 'agreement_confirmed':
    case 'waitlisted':
    case 'not_eligible':
      return '/(waitlist)';
    case 'signed_up':
      return null; // Needs upload store check — handled by caller
    default:
      return '/(agreement)/upload';
  }
}

/**
 * Check if the current user has a completed extraction awaiting manual review.
 * Used by the journey router to route signed_up users to waitlist instead of upload.
 *
 * Also checks dismissedExtractionId from the upload store — if the user clicked
 * "Re-upload Agreement", the old extraction is dismissed and should NOT cause
 * routing to waitlist/review (prevents the re-upload loop).
 */
async function checkManualReviewExtraction(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('extracted_rental_info')
      .select('id, needs_manual_review, is_city_supported')
      .eq('user_id', user.id)
      .eq('extraction_status', 'completed')
      .eq('user_verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return false;
    const row = data as unknown as Record<string, unknown>;
    const rowId = row.id as string;

    // Skip if this extraction was dismissed (user clicked "Re-upload Agreement")
    const dismissed = useUploadStore.getState().dismissedExtractionId;
    if (dismissed && rowId === dismissed) return false;

    return (row.needs_manual_review as boolean) || !(row.is_city_supported as boolean);
  } catch {
    return false;
  }
}

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [journeyResolved, setJourneyResolved] = useState(false);
  const [target, setTarget] = useState<JourneyTarget | string | null>(null);
  const hasNavigatedRef = useRef(false);

  const resolveAuthenticatedJourney = useCallback(async () => {
    try {
      // Wait for upload store hydration (max 500ms) before reading state.
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

      // ── PAYMENT RECOVERY: check for in-progress payments from app crash ──
      // Moved here from usePaymentRecovery hook in _layout.tsx because
      // navigating from _layout.tsx races with expo-router's assertIsReady.
      // By the time index.tsx navigates, the Stack is fully mounted.
      if (usePaymentStore.persist.hasHydrated()) {
        const { lastPaymentId, lastPaymentTimestamp, clearLastPayment } =
          usePaymentStore.getState();
        if (lastPaymentId && lastPaymentTimestamp) {
          const elapsed = Date.now() - lastPaymentTimestamp;
          if (elapsed <= 30 * 60 * 1000) {
            // Recent payment in progress — resume polling on status screen
            setTarget(`/(payment)/status?paymentId=${lastPaymentId}&initialStatus=pending`);
            setJourneyResolved(true);
            return;
          }
          clearLastPayment();
        }
      }

      // ── PRIMARY PATH: PostgREST (getUser validates session server-side) ──
      let userStatus = await queryUserStatus();

      // ── FALLBACK PATH: Edge function via callEdgeFunction ──
      if (!userStatus) {
        console.log('[journey-router] PostgREST failed, trying edge function...');
        addBreadcrumb('PostgREST routing failed, trying edge function', 'navigation');

        const { data, error } = await getWaitlistStatus();
        if (!error && data?.userStatus) {
          console.log('[journey-router] edge function userStatus:', data.userStatus);
          userStatus = data.userStatus;
        } else {
          console.warn('[journey-router] edge function also failed:', { error, hasData: !!data });
          addBreadcrumb('both routing paths failed', 'navigation', { error: error ?? 'no data' });
        }
      }

      // ── ROUTE ──
      if (!userStatus) {
        // Both paths failed. Verify the session is still valid — if getUser()
        // fails here, the auth user was deleted server-side. Force sign-out
        // instead of routing to upload (which would show a broken skeleton).
        const { error: verifyError } = await supabase.auth.getUser();
        if (verifyError) {
          // Distinguish auth errors (user deleted/session revoked) from network errors.
          // Network errors should NOT sign out — the session may still be valid.
          const isAuthError = verifyError.status === 401
            || verifyError.status === 403
            || verifyError.status === 404
            || verifyError.message?.includes('not found')
            || verifyError.message?.includes('User not found')
            || verifyError.message?.includes('invalid claim')
            || verifyError.message?.includes('session_not_found');

          if (isAuthError) {
            console.warn('[journey-router] Auth error, forcing sign-out:', verifyError.message);
            await supabase.auth.signOut();
            setTarget('/(auth)/beta-splash');
          } else {
            // Network/timeout error — trust cached session, route to upload as safe default
            console.warn('[journey-router] Network error (not signing out):', verifyError.message);
            setTarget('/(agreement)/upload');
          }
          setJourneyResolved(true);
          return;
        }
        // Session valid but no user_status — genuinely new user, go to upload
        setTarget('/(agreement)/upload');
        setJourneyResolved(true);
        return;
      }

      addBreadcrumb('journey resolved', 'navigation', { userStatus });

      const resolved = statusToTarget(userStatus);
      if (resolved) {
        setTarget(resolved);
      } else {
        // signed_up — need to check extraction state to route correctly
        // First: check if there's a completed extraction awaiting manual review.
        // If so, the upload is done — route to waitlist, not back to upload.
        const manualReview = await checkManualReviewExtraction();
        if (manualReview) {
          setTarget('/(waitlist)');
        } else {
          // Check upload store for review vs upload
          const uploadState = useUploadStore.getState();
          if (
            uploadState.uploadPhase === 'completed' &&
            uploadState.extractionId &&
            // Don't route to review if this extraction was dismissed (user clicked re-upload).
            // The reset() sets dismissedExtractionId before clearing extractionId, but
            // if the app was killed before the async SecureStore write completed, the
            // persisted state may still have both fields set.
            uploadState.dismissedExtractionId !== uploadState.extractionId
          ) {
            setTarget('/(agreement)/review');
          } else {
            // If extraction was dismissed but store wasn't fully persisted, clean up
            if (uploadState.dismissedExtractionId && uploadState.extractionId === uploadState.dismissedExtractionId) {
              uploadState.reset();
            }
            setTarget('/(agreement)/upload');
          }
        }
      }
      setJourneyResolved(true);
    } catch (err) {
      addBreadcrumb('resolveAuthenticatedJourney exception', 'navigation', {
        error: err instanceof Error ? err.message : String(err),
      });
      console.error('[journey-router] resolveAuthenticatedJourney error:', err);
      setTarget('/(agreement)/upload');
      setJourneyResolved(true);
    }
  }, []);

  // Resolve journey target once auth state is known
  useEffect(() => {
    if (authLoading) return;

    // Review mode — no real Supabase session exists, so check this BEFORE isAuthenticated.
    // isReviewMode() reads a module-level variable (not React state), so AuthProvider's
    // context may still have isAuthenticated=false from a stale render.
    if (isReviewMode()) {
      setTarget('/(main)');
      setJourneyResolved(true);
      return;
    }

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
    // Hide native splash AFTER navigation fires — keeps splash visible during
    // font loading, auth checks, and journey resolution (prevents black screen).
    // Small delay lets the target screen mount before the splash fades.
    setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 150);
  }, [journeyResolved, target, router, rootNavigationState?.key]);

  // Always render skeleton — invisible behind navigated screen, avoids ghost screen in Stack
  return <SkeletonLoader />;
}
