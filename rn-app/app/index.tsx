/**
 * Entry Point — Journey-Aware Router
 *
 * Determines the correct screen based on auth + waitlist state:
 *  1. Not authenticated -> auth flow (splash/get-started)
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
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Logo, Text, DottedGridPattern, Screen } from '@/src/components';
import { colors, spacing, radius } from '@/src/theme';
import { CriticalUpdateScreen } from '@/src/components/ui/CriticalUpdateScreen';
import { useAuthContext } from '@/src/providers';
import { useUpdatePolicy, clearUpdatePolicyCache } from '@/src/hooks/useUpdatePolicy';
import { useUploadStore } from '@/src/stores/upload';
import { usePaymentStore } from '@/src/stores/payment';
import { useAuthStore } from '@/src/stores/auth';
import { isReviewMode } from '@/src/review/reviewMode';
import { isJourneyMode, getJourneyRouteTarget } from '@/src/review/journeyMode';
import { addBreadcrumb } from '@/src/config/sentry';
import { supabase } from '@/src/services/supabase/client';
import {
  bankDetailsAreSettled,
  userHasLandlordBankRow,
} from '@/src/services/agreement/bankDetailsGate';
// OTA updates handled by useOTAUpdates hook — no cold-start blocking

const LAST_ROUTE_KEY = 'flent_last_journey_target';

/** Routes the journey-router is allowed to write to + read from the cache.
 *  Used for two purposes:
 *   1. Offline fallback when queryUserStatus fails — any route here is a
 *      reasonable degraded landing, better than dumping the user on /upload.
 *   2. Fast-path display on cold-start — but ONLY for routes also in
 *      FAST_PATH_ROUTES (see below).
 *  Agreement routes (/intro, /upload, /add-bank-details) are always re-resolved
 *  from user_status — they're transient by nature. */
const VALID_CACHED_ROUTES = new Set<string>([
  '/(main)',
  '/(waitlist)',
]);

/** Routes safe to immediately navigate to on cold-start without waiting for
 *  backend validation. MUST be states whose user_status cannot flip in the
 *  background — otherwise the user briefly sees the cached route before the
 *  background validation re-routes (the "flash" bug).
 *
 *  Only /(main) qualifies:
 *    - 'active' user_status doesn't auto-rollback while the app is closed.
 *    - The dashboard refetches on mount, so any stale data is refreshed.
 *    - AuthProvider.isUserDeletedOnServer catches banned/deleted users on
 *      cold-start and signs them out gracefully.
 *

 *  Transient routes that DON'T qualify (and would flash if cached as fast-path):
 *    - /(waitlist): admin approval flips waitlisted → approved while app
 *      is closed. Cached /(waitlist) → background validation finds
 *      'approved' → re-route via decideApprovedTarget (bank-row check).
 *
 *  /(waitlist) still lives in VALID_CACHED_ROUTES (so the cache is written
 *  + used as offline fallback), it just doesn't fast-path-display. The
 *  trade-off: stable waitlisted users see a 1-3s splash on cold start
 *  instead of an instant cache hit. Worth it to never flash the wrong
 *  screen on a state-flip. The /(agreement)/add-bank-details route is
 *  never cached at all (agreement routes always re-resolve from
 *  user_status). */
const FAST_PATH_ROUTES = new Set<string>([
  '/(main)',
]);

/** Read cached route, validating it belongs to the given user (M-3 fix).
 *  Stored as "route|userId" — if userId doesn't match, returns null. */
async function readCachedRoute(userId: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(LAST_ROUTE_KEY).catch(() => null);
  if (!raw) return null;
  const [route, storedUserId] = raw.split('|');
  // Accept route if user matches OR if no userId stored (legacy format)
  if (storedUserId && storedUserId !== userId) return null;
  if (!route || !VALID_CACHED_ROUTES.has(route)) return null;
  return route;
}

/** Write cached route scoped to user ID */
function writeCachedRoute(route: string, userId: string): void {
  if (VALID_CACHED_ROUTES.has(route)) {
    SecureStore.setItemAsync(LAST_ROUTE_KEY, `${route}|${userId}`).catch(() => {});
  }
}

/** Clear cached route (sign-out) */
function clearCachedRoute(): void {
  SecureStore.deleteItemAsync(LAST_ROUTE_KEY).catch(() => {});
}

// Global screenshot params for dev pipeline — set state for screens that need mock data
// e.g. SCREENSHOT_PARAMS = { state: 'filled' } injects state into useScreenshotParams()
export const SCREENSHOT_PARAMS: Record<string, string> | null = null;

type JourneyTarget =
  | '/(auth)/splash'
  | '/(agreement)/intro'
  | '/(agreement)/upload'
  | '/(agreement)/add-bank-details'
  | '/(waitlist)'
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

    const status = userRecord.user_status;
    console.log('[journey-router] PostgREST user_status:', status);
    // Cache for non-router consumers (e.g., AddBankForm post-submit nav).
    useAuthStore.getState().setUserStatus(status);
    return status;
  } catch (err) {
    console.warn('[journey-router] PostgREST error:', err);
    return null;
  }
}

/**
 * Approved-user routing helper. Always returns `/(main)`.
 *
 * Bank-details verification is now a pre-waitlist requirement (the
 * /(waitlist) screen's bank gate enforces it — see (waitlist)/index.tsx).
 * By the time a user has user_status='approved', they have already cleared
 * that gate, so post-approval routing should never re-route to
 * /(agreement)/add-bank-details. Doing so caused ping-pong loops with the
 * /(main) no-tenancy bounce when fresh-approval state hadn't fully
 * propagated server-side. Kept as a function (rather than inlined) so the
 * symbol still names the routing decision at the call sites.
 */
async function decideApprovedTarget(_userId: string): Promise<string> {
  return '/(main)';
}

/**
 * TEMP — legacy_post_waitlist_bank_required check.
 *
 * The 2026-05-01 release moved add-bank-details from post-waitlist to
 * pre-waitlist. Users who were already 'approved' before that release have
 * no landlord bank row and would silently fail at settlement if they paid.
 * This flag (set on a one-shot migration) routes them back through
 * /(agreement)/add-bank-details on cold start.
 *
 * Remove this helper and its callers when
 *   SELECT count(*) FROM users WHERE legacy_post_waitlist_bank_required = true
 * reaches 0. See docs/legacy-post-waitlist-bank-fix.md.
 */
async function userNeedsLegacyBank(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('users')
      .select('legacy_post_waitlist_bank_required')
      .eq('id', userId)
      .maybeSingle();
    return data?.legacy_post_waitlist_bank_required === true;
  } catch (err) {
    console.warn('[journey-router] legacy-bank flag query failed:', err);
    return false;
  }
}

/**
 * Map user_status string to a JourneyTarget route.
 * Returns null for statuses that need upload store context (signed_up).
 */
function statusToTarget(userStatus: string): JourneyTarget | null {
  switch (userStatus) {
    case 'approved':
      return null; // Needs async bank_verified check — handled by caller
    case 'active':
      return '/(main)';
    case 'agreement_confirmed':
    // ^ No production code sets this status, but it exists as a defensive enum value.
    // Backend recovery crons (extraction-recovery, pre-approval-audit) treat it
    // the same as signed_up and auto-advance to waitlisted. Handle same as waitlisted.
    case 'waitlisted':
      // Always defer — caller does the async bank-row + extraction-reupload checks.
      // The old `bankStepCompleted`/`uploadPhase`/`extractionId` fast-path was
      // removed: presence of a `bank_accounts.party_type='landlord'` row is now
      // the gate (handled in the deferred branch below).
      return null;
    case 'not_eligible':
      return '/(waitlist)';
    case 'signed_up':
      return null; // Needs upload store check — handled by caller
    default:
      return '/(agreement)/upload';
  }
}

/**
 * Check if the current user has a completed extraction that should prevent re-upload.
 * Routes signed_up users to waitlist instead of upload when they already have a
 * pending extraction (user_review, manual_review, or unsupported city).
 *
 * This is a SAFETY NET for cases where finalizeExtractionForOnboarding failed to
 * update user_status from signed_up → waitlisted (e.g., ensureWaitlistState threw).
 * In the normal flow, user_status is already 'waitlisted' and statusToTarget()
 * handles routing before this function is ever called.
 *
 * Also checks dismissedExtractionId from the upload store — if the user clicked
 * "Re-upload Agreement", the old extraction is dismissed and should NOT cause
 * routing to waitlist/review (prevents the re-upload loop).
 */
async function checkPendingExtraction(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('extracted_rental_info')
      .select('id')
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

    // Any completed, unverified extraction means the user should be on waitlist,
    // not re-uploading. This covers user_review, manual_review, and unsupported city.
    return true;
  } catch {
    return false;
  }
}

export default function Index() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading, session: authSession } = useAuthContext();
  const updatePolicy = useUpdatePolicy();
  const [journeyResolved, setJourneyResolved] = useState(false);
  const [target, setTarget] = useState<JourneyTarget | string | null>(null);
  const hasNavigatedRef = useRef(false);
  const isResolvingRef = useRef(false); // Guard against concurrent journey resolutions
  // Track when this component mounts so the OTA bounded wait can be dynamically
  // capped to stay under the 6s safety timeout. Uses a ref to capture mount time once.
  const _mountTimestamp = useRef(Date.now()).current;

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

      // ── OWNER VALIDATION: reset upload store if it belongs to a different user ──
      useUploadStore.getState().validateOwner(userId);

      // ── PAYMENT RECOVERY: check for in-progress payments from app crash ──
      // Moved here from usePaymentRecovery hook in _layout.tsx because
      // navigating from _layout.tsx races with expo-router's assertIsReady.
      // By the time index.tsx navigates, the Stack is fully mounted.
      // Window: 5 minutes (enough for SDK crash recovery, not stale redirects).
      // Always clears after use — status screen polls DB for actual outcome.
      if (usePaymentStore.persist.hasHydrated()) {
        const { lastPaymentId, lastPaymentTimestamp, clearLastPayment } =
          usePaymentStore.getState();
        if (lastPaymentId && lastPaymentTimestamp) {
          const elapsed = Date.now() - lastPaymentTimestamp;
          if (elapsed <= 5 * 60 * 1000) {
            // Verify payment belongs to current user (prevents cross-user recovery)
            const { data: paymentRow } = await supabase
              .from('payments')
              .select('id')
              .eq('id', lastPaymentId)
              .eq('user_id', userId)
              .maybeSingle();
            if (!paymentRow) {
              clearLastPayment();
            } else {
              // Recent payment in progress — resume polling on status screen
              clearLastPayment(); // Clear immediately so next cold start won't redirect again
              setTarget(`/(payment)/status?paymentId=${lastPaymentId}&initialStatus=pending`);
              setJourneyResolved(true);
              return;
            }
          }
          clearLastPayment();
        }
      }

      // ── FAST PATH: Use cached last route for instant navigation ──
      // Only kicks in for terminal/stable routes (FAST_PATH_ROUTES — currently
      // just /(main)). Transient route /(waitlist) skips the fast-path and
      // waits for background validation, otherwise it flashes the wrong
      // screen when user_status flipped while app was closed (e.g.
      // waitlisted → approved by admin). Avoids 1-3s of network calls
      // (getUser + PostgREST) on every app open for active users.
      const cachedRoute = await readCachedRoute(userId);
      if (cachedRoute && FAST_PATH_ROUTES.has(cachedRoute)) {
        console.log('[journey-router] Fast path: using cached route', cachedRoute);
        setTarget(cachedRoute);
        setJourneyResolved(true);
        // Validate in background — if user_status changed, redirect
        queryUserStatus(userId).then(async (userStatus) => {
          if (!userStatus) return; // Network failed, keep cached route
          // Wait for upload store hydration before reading extractionId / dismissedExtractionId
          if (!useUploadStore.getState()._hasHydrated) {
            await new Promise<void>((resolve) => {
              const unsub = useUploadStore.subscribe((s) => {
                if (s._hasHydrated) { unsub(); resolve(); }
              });
              setTimeout(() => { unsub(); resolve(); }, 500);
            });
          }
          let correctTarget: string | null = statusToTarget(userStatus);

          // statusToTarget returns null for deferred statuses (need async checks)
          if (!correctTarget && userStatus === 'approved') {
            const [{ data: tenancyRow }, needsLegacyBank] = await Promise.all([
              supabase.from('tenancies').select('id').eq('user_id', userId).maybeSingle(),
              userNeedsLegacyBank(userId),
            ]);
            // No tenancy = broken state — route to waitlist as safety net.
            // TEMP: legacy cohort bounce — see userNeedsLegacyBank() above.
            // Otherwise: hand off to decideApprovedTarget (-> /(main)).
            correctTarget = !tenancyRow
              ? '/(waitlist)'
              : needsLegacyBank
                ? '/(agreement)/add-bank-details'
                : await decideApprovedTarget(userId);
          } else if (!correctTarget && (userStatus === 'waitlisted' || userStatus === 'agreement_confirmed')) {
            // Background validation for waitlisted — bank-details gate covers
            // both the legacy skip cohort and the kill-mid-flow case (partial
            // bank_accounts row from verifyBank but user never tapped Confirm).
            // The reupload-on-invalid-extraction redirect still happens on the
            // waitlist screen.
            correctTarget = (await bankDetailsAreSettled(userId))
              ? '/(waitlist)'
              : '/(agreement)/add-bank-details';
          }

          if (correctTarget && correctTarget !== cachedRoute) {
            console.log('[journey-router] Background validation: route changed', cachedRoute, '->', correctTarget);
            writeCachedRoute(correctTarget, userId);
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
          useAuthStore.getState().setUserStatus(userStatus);
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
        const fallbackRoute = await readCachedRoute(userId);
        if (fallbackRoute) {
          console.warn('[journey-router] Routing failed — using cached route:', fallbackRoute);
          setTarget(fallbackRoute);
        } else {
          console.warn('[journey-router] Routing failed, no cached route — defaulting to upload');
          // Surface the silent-fallback case in the upload screen so the
          // user understands why they're here when they reopen the app.
          useUploadStore.getState().prepareForReupload({
            errorMessage: "We couldn't confirm your status — please re-upload your agreement to continue.",
          });
          setTarget('/(agreement)/upload');
        }
        setJourneyResolved(true);
        return;
      }

      addBreadcrumb('journey resolved', 'navigation', { userStatus });

      const resolved = statusToTarget(userStatus);
      if (resolved) {
        setTarget(resolved);
      } else if (userStatus === 'approved') {
        // approved — check tenancy + legacy bank flag, then route.
        const [{ data: tenancyRow }, needsLegacyBank] = await Promise.all([
          supabase.from('tenancies').select('id').eq('user_id', userId).maybeSingle(),
          userNeedsLegacyBank(userId),
        ]);

        // No tenancy = broken state (approved requires tenancy from extraction flow).
        // Route to waitlist as safety net — extraction-recovery cron will fix the state.
        // TEMP: legacy cohort bounce — see userNeedsLegacyBank() above.
        // Otherwise hand off to decideApprovedTarget (-> /(main)).
        setTarget(
          !tenancyRow
            ? '/(waitlist)'
            : needsLegacyBank
              ? '/(agreement)/add-bank-details'
              : await decideApprovedTarget(userId)
        );
      } else if (userStatus === 'waitlisted' || userStatus === 'agreement_confirmed') {
        // waitlisted — check if extraction requires reupload (invalid document / failed).
        // Without this check, the waitlist screen loads → detects requiresReupload →
        // redirects to upload, causing a visible flicker.
        const { data: extraction } = await supabase
          .from('extracted_rental_info')
          .select('extraction_status, contract_status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (extraction && (extraction.contract_status === 'invalid_document' || extraction.extraction_status === 'extraction_failed')) {
          // Prepare upload store for reupload so the upload screen shows the right state
          useUploadStore.getState().prepareForReupload({
            errorMessage: 'Please upload a valid rental agreement to continue.',
          });
          setTarget('/(agreement)/upload');
        } else if (!await bankDetailsAreSettled(userId)) {
          // Bank-details not completed (no row, partial row, or flag never set) →
          // force back to bank-details. Covers the legacy skip cohort and the
          // kill-mid-flow case.
          setTarget('/(agreement)/add-bank-details');
        } else {
          setTarget('/(waitlist)');
        }
      } else {
        // signed_up — need to check extraction state to route correctly
        // First: check if there's a completed extraction awaiting backend review.
        // If so, the upload is done — route to waitlist, not back to upload.
        const manualReview = await checkPendingExtraction(userId);
        if (manualReview) {
          // Extraction complete — bank-details gate decides waitlist vs bank-details.
          setTarget((await bankDetailsAreSettled(userId))
            ? '/(waitlist)'
            : '/(agreement)/add-bank-details');
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
            // Upload done — bank-details gate decides waitlist vs bank-details.
            setTarget((await bankDetailsAreSettled(userId))
              ? '/(waitlist)'
              : '/(agreement)/add-bank-details');
          } else {
            // If extraction was dismissed but store wasn't fully persisted, clean up
            if (uploadState.dismissedExtractionId && uploadState.extractionId === uploadState.dismissedExtractionId) {
              uploadState.reset();
            }
            // No active upload + no completed extraction = fresh onboarding.
            // Always pass through /intro before /upload so the user sees the
            // "What we verify" pitch first (matches the signup post-OTP flow).
            setTarget('/(agreement)/intro');
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
      const fallbackRoute = await readCachedRoute(userId);
      if (fallbackRoute) {
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
  // never re-fires to redirect to splash. AuthProvider navigates on
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
      // Clear cached user_status so it doesn't leak across sign-outs.
      useAuthStore.getState().setUserStatus(null);
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
      setTarget('/(auth)/splash');
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
    // Don't navigate if force update modal should be showing — the render
    // returns CriticalUpdateScreen instead. Without this guard, the navigation
    // effect can race with the force update check on the same render cycle.
    if (updatePolicy.isRequired) return;
    hasNavigatedRef.current = true;
    routerRef.current.replace(target as never);
    // Cache the route scoped to the current user for instant navigation on next launch
    const currentUserId = authSession?.user?.id;
    if (currentUserId && VALID_CACHED_ROUTES.has(target)) {
      writeCachedRoute(target, currentUserId);
    } else if (target === '/(auth)/splash') {
      clearCachedRoute();
    }
    // Skip OTA reload for payment recovery — don't interrupt active payment flow.
    // clearLastPayment() was already called, and a reload would lose the real-time
    // polling view. The update will apply on next launch or background return.
    const isPaymentRecovery = typeof target === 'string' && target.startsWith('/(payment)/');
    if (isPaymentRecovery) {
      setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 300);
      return;
    }
    // Don't block cold start for OTA updates. Non-critical updates apply on
    // next launch silently. Critical updates are handled by useOTAUpdates hook
    // after the app is visible (with native reload screen). This ensures users
    // are never blocked or delayed on app open.
    setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyResolved, target, rootNavigationState?.key, updatePolicy.isRequired]);

  // Critical update blocks ALL navigation — user must update (OTA or native)
  if (updatePolicy.isRequired) {
    return (
      <CriticalUpdateScreen
        policy={updatePolicy}
        onDismiss={() => clearUpdatePolicyCache()}
      />
    );
  }

  // OTA splash — reuses beta-splash visual (dotted pattern + logo + badge).
  // Visible as fallback if native splash hides before navigation completes.
  return (
    <Screen
      padded={false} safeAreaTop={false} safeAreaBottom={false}
      style={{ backgroundColor: colors.black[700] }}
    >
      <DottedGridPattern fadeMask={false} />
      <View style={otaSplashStyles.container}>
        <Logo size={40} />
        <View style={otaSplashStyles.badge}>
          <Text variant="bodySmMedium" style={otaSplashStyles.badgeText}>
            BETA LAUNCH
          </Text>
        </View>
        <ActivityIndicator
          size="small"
          color={colors.brand[500]}
          style={otaSplashStyles.spinner}
        />
      </View>
    </Screen>
  );
}

const otaSplashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    marginTop: 12,
    backgroundColor: colors.brand[500],
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    letterSpacing: -0.2,
    color: colors.black[900],
    textAlign: 'center',
  },
  spinner: {
    position: 'absolute',
    bottom: 80,
  },
});
