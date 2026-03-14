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
 *  - PRIMARY: userId from AuthProvider context → PostgREST query for user_status
 *    NEVER calls getSession() — in auth-js v2.65.1 it triggers _callRefreshToken()
 *    which races with autoRefreshToken and causes spurious SIGNED_OUT events.
 *  - FALLBACK: getWaitlistStatus() edge function via callEdgeFunction
 *    Provides richer data but has manual auth that can fail on stale sessions.
 *
 * Auth state is read from AuthProvider (single source of truth).
 * Navigation uses imperative router.replace() to avoid re-fire issues.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { getWaitlistStatus } from '@/src/services/api/waitlist';
const DISABLE_SCREEN_PICKER = __DEV__ ? require('./(dev)/screen-picker').DISABLE_SCREEN_PICKER : true;
const DEV_DIRECT_SCREEN = __DEV__ ? require('./(dev)/screen-picker').DEV_DIRECT_SCREEN : null;
import { SkeletonLoader } from '@/src/components';
import { ForceUpdateModal } from '@/src/components/ui/ForceUpdateModal';
import { useAuthContext } from '@/src/providers';
import { useForceUpdate } from '@/src/hooks/useForceUpdate';
import { useUploadStore } from '@/src/stores/upload';
import { usePaymentStore } from '@/src/stores/payment';
import { isReviewMode } from '@/src/review/reviewMode';
import { isJourneyMode, getJourneyRouteTarget } from '@/src/review/journeyMode';
import { addBreadcrumb } from '@/src/config/sentry';
import { supabase } from '@/src/services/supabase/client';
import { waitForColdStartOTA, reloadApp } from '@/src/config/updates';

const LAST_ROUTE_KEY = 'flent_last_journey_target';

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
 * Accepts userId from AuthProvider context — NEVER calls getSession().
 * In auth-js v2.65.1, getSession() calls _callRefreshToken() when the JWT
 * is expired. This races with autoRefreshToken — both consume the refresh
 * token simultaneously. With refresh token rotation (Supabase default),
 * the second attempt gets 401 → _removeSession() → SIGNED_OUT → logout.
 *
 * The PostgREST query uses the Supabase client's internal token (managed
 * by the SDK). If the token is expired, PostgREST returns 401, and we
 * fall through to the edge function fallback.
 */
/**
 * Wait for the Supabase SDK's autoRefreshToken to fire TOKEN_REFRESHED.
 * On cold start with an expired JWT, the SDK automatically attempts a
 * refresh but it's async. This helper lets the journey router wait for
 * fresh tokens before retrying PostgREST queries.
 *
 * Returns true if TOKEN_REFRESHED fires within the timeout, false otherwise.
 */
async function waitForTokenRefresh(timeoutMs: number = 5000): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        subscription.unsubscribe();
        resolve(true);
      } else if (event === 'SIGNED_OUT') {
        subscription.unsubscribe();
        resolve(false);
      }
    });
    setTimeout(() => { subscription.unsubscribe(); resolve(false); }, timeoutMs);
  });
}

async function queryUserStatus(userId: string): Promise<string | null> {
  try {
    const { data: userRecord, error } = await supabase
      .from('users')
      .select('user_status')
      .eq('id', userId)
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
function statusToTarget(userStatus: string): JourneyTarget | null {
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
 * Check if the current user has a completed extraction awaiting backend review.
 * Used by the journey router to route signed_up users to waitlist instead of upload.
 *
 * Also checks dismissedExtractionId from the upload store — if the user clicked
 * "Re-upload Agreement", the old extraction is dismissed and should NOT cause
 * routing to waitlist/review (prevents the re-upload loop).
 */
async function checkManualReviewExtraction(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('extracted_rental_info')
      .select('id, needs_manual_review, is_city_supported')
      .eq('user_id', userId)
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
  const { isAuthenticated, isLoading: authLoading, session: authSession } = useAuthContext();
  const { isRequired: forceUpdateRequired, message: forceUpdateMessage, isLoading: forceUpdateLoading } = useForceUpdate();
  const [journeyResolved, setJourneyResolved] = useState(false);
  const [target, setTarget] = useState<JourneyTarget | string | null>(null);
  const hasNavigatedRef = useRef(false);
  const isResolvingRef = useRef(false); // Guard against concurrent journey resolutions

  const resolveAuthenticatedJourney = useCallback(async (userId: string) => {
    // Prevent re-entry: multiple auth events (INITIAL_SESSION, SIGNED_IN,
    // TOKEN_REFRESHED) cause the effect to re-fire. Without this guard,
    // concurrent resolutions flash the skeleton and can set conflicting targets.
    if (isResolvingRef.current || journeyResolved) return;
    isResolvingRef.current = true;
    try {
      // Wait for upload store hydration (max 500ms) before reading state.
      // SecureStore is fast (~10-50ms), but we need the store ready before
      // deciding whether to route to waitlist vs upload.
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

      // ── FAST PATH: Use cached last route for instant navigation ──
      // Avoids 1-3s of network calls (getUser + PostgREST) on every app open.
      // The cached route is validated in background; if stale, user gets
      // redirected on next render cycle.
      const cachedRoute = await SecureStore.getItemAsync(LAST_ROUTE_KEY).catch(() => null);
      if (cachedRoute && (cachedRoute === '/(main)' || cachedRoute === '/(setup)' || cachedRoute === '/(waitlist)')) {
        console.log('[journey-router] Fast path: using cached route', cachedRoute);
        setTarget(cachedRoute);
        setJourneyResolved(true);
        // Validate in background — if user_status changed, redirect
        queryUserStatus(userId).then(async (userStatus) => {
          if (!userStatus) return; // Network failed, keep cached route
          const correctTarget = statusToTarget(userStatus);
          if (correctTarget && correctTarget !== cachedRoute) {
            console.log('[journey-router] Background validation: route changed', cachedRoute, '->', correctTarget);
            SecureStore.setItemAsync(LAST_ROUTE_KEY, correctTarget).catch(() => {});
            router.replace(correctTarget as never);
          }
        }).catch(() => {}); // Non-fatal background check
        return;
      }

      // ── PRIMARY PATH: PostgREST query with user ID from AuthProvider context ──
      let userStatus = await queryUserStatus(userId);

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

      // ── RETRY AFTER TOKEN REFRESH ──
      // On cold start after app kill, the persisted JWT is often expired.
      // The SDK's autoRefreshToken fires TOKEN_REFRESHED async, but the
      // journey router reaches here before it completes. Wait for fresh
      // tokens and retry once before giving up.
      //
      // Always retry after the wait — TOKEN_REFRESHED may have fired
      // between the first attempt and our subscription (missed event),
      // but the Supabase client will have fresh tokens regardless.
      if (!userStatus) {
        console.log('[journey-router] Both paths failed, waiting for token refresh...');
        addBreadcrumb('waiting for token refresh before retry', 'navigation');
        await waitForTokenRefresh(5000);
        console.log('[journey-router] Retrying after token refresh wait...');
        userStatus = await queryUserStatus(userId);
        if (!userStatus) {
          const { data: retryData, error: retryError } = await getWaitlistStatus();
          if (!retryError && retryData?.userStatus) {
            userStatus = retryData.userStatus;
          }
        }
      }

      // ── ROUTE ──
      if (!userStatus) {
        // Both paths failed even after token refresh — genuine network issue.
        // Trust the cached route if available (user was here before).
        // Only default to upload if there's no prior history at all.
        const fallbackRoute = await SecureStore.getItemAsync(LAST_ROUTE_KEY).catch(() => null);
        if (fallbackRoute && (fallbackRoute === '/(main)' || fallbackRoute === '/(setup)' || fallbackRoute === '/(waitlist)')) {
          console.warn('[journey-router] Routing failed — using cached route:', fallbackRoute);
          setTarget(fallbackRoute);
        } else {
          console.warn('[journey-router] Routing failed, no cached route — defaulting to upload');
          setTarget('/(agreement)/upload');
        }
        setJourneyResolved(true);
        return;
      }

      addBreadcrumb('journey resolved', 'navigation', { userStatus });

      const resolved = statusToTarget(userStatus);
      if (resolved) {
        setTarget(resolved);
      } else {
        // signed_up — need to check extraction state to route correctly
        // First: check if there's a completed extraction awaiting backend review.
        // If so, the upload is done — route to waitlist, not back to upload.
        const manualReview = await checkManualReviewExtraction(userId);
        if (manualReview) {
          setTarget('/(waitlist)');
        } else {
          // Check upload store for async-processing vs upload
          const uploadState = useUploadStore.getState();
          if (
            (
              uploadState.uploadPhase === 'processing' ||
              uploadState.uploadPhase === 'server_processing' ||
              uploadState.uploadPhase === 'completed'
            ) &&
            uploadState.extractionId &&
            // Don't route to waitlist if this extraction was dismissed (user clicked re-upload).
            // The reset() sets dismissedExtractionId before clearing extractionId, but
            // if the app was killed before the async SecureStore write completed, the
            // persisted state may still have both fields set.
            uploadState.dismissedExtractionId !== uploadState.extractionId
          ) {
            setTarget('/(waitlist)');
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
      // Trust cached route on exceptions — don't send active users to upload
      const fallbackRoute = await SecureStore.getItemAsync(LAST_ROUTE_KEY).catch(() => null);
      if (fallbackRoute && (fallbackRoute === '/(main)' || fallbackRoute === '/(setup)' || fallbackRoute === '/(waitlist)')) {
        setTarget(fallbackRoute);
      } else {
        setTarget('/(agreement)/upload');
      }
      setJourneyResolved(true);
    } finally {
      isResolvingRef.current = false;
    }
  }, [journeyResolved]);

  // Reset journey state when user signs out so the router re-evaluates.
  // Without this, journeyResolved stays true after sign-out, and the router
  // never re-fires to redirect to beta-splash. AuthProvider navigates on
  // user-initiated sign-out, but this handles edge cases (OTA reload after
  // sign-out, transient SIGNED_OUT → recovery → genuine sign-out later).
  const wasAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticatedRef.current && !isAuthenticated && !authLoading) {
      // Auth state transitioned from true → false (sign-out)
      setJourneyResolved(false);
      setTarget(null);
      hasNavigatedRef.current = false;
      isResolvingRef.current = false;
    }
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, authLoading]);

  // Safety: always hide splash after max timeout, even if navigation fails.
  // Prevents splash from staying forever on edge cases (OTA reload timing,
  // navigation failure, slow auth resolution).
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 6000);
    return () => clearTimeout(safetyTimeout);
  }, []);

  // Resolve journey target once auth state is known.
  // IMPORTANT: Does NOT depend on authSession — only on authLoading and isAuthenticated.
  // Multiple auth events (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED) change authSession,
  // but re-firing the effect for each one causes concurrent journey resolutions that
  // flash the skeleton UI and can navigate to wrong targets.
  useEffect(() => {
    if (authLoading || journeyResolved) return;

    // Review mode — no real Supabase session exists, so check this BEFORE isAuthenticated.
    // isReviewMode() reads a module-level variable (not React state), so AuthProvider's
    // context may still have isAuthenticated=false from a stale render.
    if (isReviewMode()) {
      setTarget('/(main)');
      setJourneyResolved(true);
      return;
    }

    // Journey demo mode — route based on current stage
    if (isJourneyMode()) {
      setTarget(getJourneyRouteTarget());
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

    // Authenticated, normal mode — resolve full journey.
    // Read userId directly from authSession — no dep on authSession object
    // to avoid re-firing on every token refresh.
    const userId = authSession?.user?.id;
    if (!userId) {
      // Session exists but no user ID — shouldn't happen, safe fallback
      setTarget('/(agreement)/upload');
      setJourneyResolved(true);
      return;
    }
    resolveAuthenticatedJourney(userId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Imperative one-shot navigation — guarded by navigation readiness.
  // In release mode, SecureStore resolves auth state faster than fonts load,
  // so router.replace() can fire before _layout.tsx mounts the <Stack>.
  // useRootNavigationState().key is undefined until the navigator is mounted.
  useEffect(() => {
    if (!journeyResolved || !target || hasNavigatedRef.current) return;
    if (!rootNavigationState?.key) return;
    hasNavigatedRef.current = true;
    router.replace(target as never);
    // Cache the route for instant navigation on next app launch
    if (target === '/(main)' || target === '/(setup)' || target === '/(waitlist)') {
      SecureStore.setItemAsync(LAST_ROUTE_KEY, target).catch(() => {});
    } else if (target === '/(auth)/beta-splash') {
      // User signed out — clear cached route
      SecureStore.deleteItemAsync(LAST_ROUTE_KEY).catch(() => {});
    }
    // If an OTA update finished downloading during auth resolution, reload
    // behind the still-visible splash for a seamless update. Don't WAIT for
    // in-progress downloads -- waitForColdStartOTA() returns immediately now.
    // Updates still downloading will apply on next launch or background return.
    waitForColdStartOTA().then(async (shouldReload) => {
      if (shouldReload) {
        console.log('[journey-router] OTA update ready — reloading behind splash');
        const reloaded = await reloadApp();
        if (reloaded) return; // App is restarting — nothing more to do
        // reloadApp failed — fall through to hide splash normally
      }
      // No OTA update (or reload failed) -- hide splash after brief delay
      setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 300);
    });
  }, [journeyResolved, target, router, rootNavigationState?.key]);

  // Force update blocks ALL navigation — user must update from App Store
  if (forceUpdateRequired) {
    return <ForceUpdateModal message={forceUpdateMessage} />;
  }

  // Always render skeleton — invisible behind navigated screen, avoids ghost screen in Stack
  return <SkeletonLoader />;
}
