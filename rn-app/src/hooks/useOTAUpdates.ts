/**
 * useOTAUpdates — Reactive OTA Update Hook
 *
 * Wraps expo-updates useUpdates() hook with business logic for:
 * - Banner state management (hidden/downloading/ready/critical/restarting)
 * - Auto-download when update is available
 * - Auto-apply for critical updates (with retry on failure)
 * - User-triggered restart for non-critical updates
 * - Payment flow protection (defers critical reload until payment completes)
 * - Inert no-op state when native module is unavailable (dev builds)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { trackEvent } from '../config/analytics';
import { isCriticalUpdate, reloadApp, notifyUpdateDetected, notifyUpdateDownloaded } from '../config/updates';
import { usePaymentStore, selectIsProcessing } from '../stores';

// All updates auto-apply immediately after download — no manual interaction needed

// Critical update reload retry config
const MAX_RELOAD_RETRIES = 3;
const RELOAD_RETRY_DELAYS = [1500, 3000, 5000]; // escalating delays

// Auto-apply downloaded update when app returns from background after 5 minutes
const AUTO_APPLY_BACKGROUND_MS = 5 * 60 * 1000;

// Dynamic import to prevent crash in dev builds
let useUpdatesHook: (() => any) | null = null;
let fetchUpdateAsync: (() => Promise<any>) | null = null;
try {
  const Updates = require('expo-updates');
  useUpdatesHook = Updates.useUpdates;
  fetchUpdateAsync = Updates.fetchUpdateAsync;
} catch {
  // Native module not available
}

export type BannerState = 'hidden' | 'downloading' | 'ready' | 'critical' | 'restarting';

export interface UseOTAUpdatesReturn {
  bannerState: BannerState;
  downloadProgress: number;
  dismiss: () => void;
  applyUpdate: () => void;
}

const INERT_RETURN: UseOTAUpdatesReturn = {
  bannerState: 'hidden',
  downloadProgress: 0,
  dismiss: () => {},
  applyUpdate: () => {},
};

export function useOTAUpdates(): UseOTAUpdatesReturn {
  // If native module is unavailable, return inert state
  if (!useUpdatesHook || __DEV__) {
    return INERT_RETURN;
  }

  return useOTAUpdatesInner();
}

function useOTAUpdatesInner(): UseOTAUpdatesReturn {
  const updates = useUpdatesHook!();
  const isPaymentActive = usePaymentStore(selectIsProcessing);
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const hasHandledRef = useRef(false);
  const updateReadyRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether a critical update is waiting for payment to finish
  const criticalDeferredRef = useRef(false);

  /**
   * Attempt reload with retries. If all retries fail, show 'ready' banner
   * so the user can manually restart.
   */
  const attemptReloadWithRetry = useCallback((attempt: number = 0) => {
    const delay = RELOAD_RETRY_DELAYS[attempt] ?? RELOAD_RETRY_DELAYS[RELOAD_RETRY_DELAYS.length - 1];

    setTimeout(async () => {
      setBannerState('restarting');
      const success = await reloadApp();

      if (!success && attempt + 1 < MAX_RELOAD_RETRIES) {
        trackEvent('ota_reload_retry', { attempt: attempt + 1 });
        attemptReloadWithRetry(attempt + 1);
      } else if (!success) {
        // All retries exhausted — fall back to manual restart banner
        trackEvent('ota_reload_failed', { attempts: MAX_RELOAD_RETRIES });
        setBannerState('ready');
      }
      // If success, the app reloads — no further code runs
    }, delay);
  }, []);

  /**
   * Apply a critical update, respecting payment flow.
   * If a payment is in progress, defers until payment completes.
   */
  const applyCriticalUpdate = useCallback(() => {
    if (isPaymentActive) {
      criticalDeferredRef.current = true;
      trackEvent('ota_critical_deferred_payment');
      // Banner stays on 'critical' — will apply when payment finishes
      return;
    }
    attemptReloadWithRetry(0);
  }, [isPaymentActive, attemptReloadWithRetry]);

  // When payment finishes and a critical update is deferred, apply it
  useEffect(() => {
    if (!isPaymentActive && criticalDeferredRef.current) {
      criticalDeferredRef.current = false;
      trackEvent('ota_critical_resume_after_payment');
      attemptReloadWithRetry(0);
    }
  }, [isPaymentActive, attemptReloadWithRetry]);

  // Auto-download when an update becomes available
  useEffect(() => {
    if (updates.isUpdateAvailable && !updates.isDownloading && !hasHandledRef.current && !dismissed) {
      hasHandledRef.current = true;
      notifyUpdateDetected(); // Signal to index.tsx that an OTA download is starting
      // Don't show banner yet — download silently. Only show for critical updates.
      setDownloadProgress(0);

      // Safety timeout — reset after 30s regardless
      safetyTimeoutRef.current = setTimeout(() => setBannerState('hidden'), 30000);

      fetchUpdateAsync!()
        .then((result: any) => {
          notifyUpdateDownloaded(); // Signal that download completed
          // Clear safety timeout on any resolution
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }

          if (result?.isNew) {
            const critical = isCriticalUpdate(result.manifest ?? updates.availableUpdate?.manifest);

            if (critical) {
              setBannerState('critical');
              trackEvent('ota_critical_auto_apply');
              applyCriticalUpdate();
              return;
            }

            // Non-critical: download silently, apply on next cold start.
            // Don't reload — don't disturb user's journey for cosmetic changes.
            trackEvent('ota_downloaded', { critical: false });
            updateReadyRef.current = true;
            setBannerState('hidden');
            return;
          }

          // Update fetched but not new
          setBannerState('hidden');
        })
        .catch(() => {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          // Reset so a future update can be downloaded
          hasHandledRef.current = false;
          setBannerState('hidden');
        });
    }
  }, [updates.isUpdateAvailable, updates.isDownloading, dismissed, applyCriticalUpdate]);

  // Cleanup safety timeout on unmount
  useEffect(() => {
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, []);

  // Auto-apply downloaded update when app returns from background after 5+ min
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (nextState === 'active' && updateReadyRef.current && backgroundedAtRef.current) {
        const elapsed = Date.now() - backgroundedAtRef.current;
        if (elapsed >= AUTO_APPLY_BACKGROUND_MS) {
          trackEvent('ota_auto_apply_foreground', { backgroundMs: elapsed });
          updateReadyRef.current = false;
          reloadApp();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  // Track download progress
  useEffect(() => {
    if (updates.downloadProgress != null) {
      setDownloadProgress(updates.downloadProgress);
    }
  }, [updates.downloadProgress]);

  const dismiss = useCallback(() => {
    if (bannerState === 'critical' || bannerState === 'restarting') return;
    setDismissed(true);
    setBannerState('hidden');
    trackEvent('ota_banner_dismissed');
  }, [bannerState]);

  const applyUpdate = useCallback(() => {
    setBannerState('restarting');
    trackEvent('ota_banner_apply_tapped');
    reloadApp();
  }, []);

  return useMemo(() => ({
    bannerState: dismissed && bannerState !== 'critical' && bannerState !== 'restarting'
      ? 'hidden'
      : bannerState,
    downloadProgress,
    dismiss,
    applyUpdate,
  }), [bannerState, downloadProgress, dismiss, applyUpdate, dismissed]);
}
