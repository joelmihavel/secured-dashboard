/**
 * Error Bus → Router Bridge
 *
 * Subscribes to the error event bus and navigates to /error.
 * Must be called inside router context (RootLayoutInner).
 *
 * IMPORTANT: Suppresses transient errors during:
 * 1. Active agreement extraction (background processing)
 * 2. Recent foreground resume (WebSocket/network settling)
 * Prevents PropertyDOM crashes from navigation during screen transitions.
 */

import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { setErrorListener, type ErrorReport } from '../services/errorReporting';
import { useUploadStore } from '../stores/upload';

/** Suppress error navigation within 5s of app returning from background */
let lastForegroundTimestamp = 0;
const FOREGROUND_GRACE_PERIOD_MS = 5000;

// Track foreground transitions at module level
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    lastForegroundTimestamp = Date.now();
  }
});

/**
 * Hook that bridges the error event bus to Expo Router.
 * Uses router.replace() to avoid stacking on corrupted screens.
 */
export function useErrorNavigation(): void {
  const router = useRouter();
  const segments = useSegments();
  // Keep a ref to the latest segments so the listener closure always reads
  // the CURRENT route, not the stale value from the last effect run.
  // This prevents the error screen from appearing when the segments changed
  // between the effect subscription and the listener firing (e.g., via setTimeout).
  const segmentsRef = React.useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    const unsubscribe = setErrorListener((report: ErrorReport) => {
      // 1. Suppress during foreground grace period (WebSocket/network settling)
      const timeSinceForeground = Date.now() - lastForegroundTimestamp;
      if (timeSinceForeground < FOREGROUND_GRACE_PERIOD_MS) {
        if (__DEV__) {
          console.log('[useErrorNavigation] Suppressed (foreground grace):', report.technicalMessage);
        }
        return;
      }

      // 2. Suppress during active agreement extraction — the extraction
      // continues running in the background and transient errors (WebSocket,
      // network) resolve on their own. Navigating to /error during processing
      // destroys the native screen container → PropertyDOM crash.
      const uploadStore = useUploadStore.getState();
      const isProcessing =
        uploadStore.uploadPhase === 'uploading_file' ||
        uploadStore.uploadPhase === 'processing' ||
        uploadStore.uploadPhase === 'server_processing';
      if (isProcessing) {
        if (__DEV__) {
          console.log('[useErrorNavigation] Suppressed (active extraction):', report.technicalMessage);
        }
        return;
      }

      // 3. Suppress if currently on agreement or waitlist screens — navigation away
      // from nested stack during transitions causes PropertyDOM crash.
      // Waitlist screen: invite code errors are handled inline by UI, not globally.
      //
      // IMPORTANT: Read from ref (not closure) to get the CURRENT segments at
      // fire time, not the segments at effect subscription time. The listener
      // fires via setTimeout(0) flush from setErrorListener — by that time,
      // segments may have changed.
      const currentSegments = segmentsRef.current;
      const firstSegment = currentSegments[0] ?? '';
      if (firstSegment === '(agreement)' || firstSegment === '(waitlist)') {
        if (__DEV__) {
          console.log('[useErrorNavigation] Suppressed (on agreement/waitlist screen):', report.technicalMessage);
        }
        return;
      }

      // 4. Suppress errors whose technical message matches known inline-handled patterns.
      // These are errors that the UI handles with inline messages (e.g., invalid invite
      // code, referral errors). Even if they escape the mutation layer, they should
      // never navigate to the global error screen.
      const tech = (report.technicalMessage || '').toLowerCase();
      const INLINE_HANDLED_PATTERNS = [
        'invite', 'referral', 'invalid_code', 'invalid_invite',
        'already_claimed', 'already_applied', 'invite_code_used',
      ];
      if (INLINE_HANDLED_PATTERNS.some((p) => tech.includes(p))) {
        if (__DEV__) {
          console.log('[useErrorNavigation] Suppressed (inline-handled error):', report.technicalMessage);
        }
        return;
      }

      try {
        router.replace({
          pathname: '/error',
          params: {
            title: report.title,
            message: report.message,
            errorId: report.id,
            timestamp: String(report.timestamp),
            source: report.source,
            technicalMessage: report.technicalMessage || '',
            action: report.action || 'back',
            actionLabel: report.actionLabel || 'Try Again',
            isLooping: report.isLooping ? 'true' : 'false',
          },
        } as never);
      } catch {
        // Navigation not ready — ErrorBoundary fallback UI handles this case.
        // Swallow to prevent the fatal NSException cascade.
      }
    });

    return unsubscribe;
  }, [router, segments]);
}
