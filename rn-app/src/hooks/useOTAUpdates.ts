/**
 * useOTAUpdates — Reactive OTA Update Hook
 *
 * Wraps expo-updates useUpdates() hook with business logic for:
 * - Banner state management (hidden/downloading/ready/critical/restarting)
 * - Auto-download when update is available
 * - Auto-apply for critical updates
 * - User-triggered restart for non-critical updates
 * - Inert no-op state when native module is unavailable (dev builds)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent } from '../config/analytics';
import { isCriticalUpdate, reloadApp } from '../config/updates';

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
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Auto-download when an update becomes available
  useEffect(() => {
    if (updates.isUpdateAvailable && !updates.isDownloading && bannerState === 'hidden' && !dismissed) {
      setBannerState('downloading');
      setDownloadProgress(0);

      fetchUpdateAsync!()
        .then((result: any) => {
          if (result?.isNew) {
            const critical = isCriticalUpdate(result.manifest ?? updates.availableUpdate?.manifest);

            if (critical) {
              setBannerState('critical');
              trackEvent('ota_critical_auto_apply');
              // Auto-reload after short delay
              setTimeout(() => {
                setBannerState('restarting');
                reloadApp();
              }, 1500);
            } else {
              setBannerState('ready');
              trackEvent('ota_downloaded', { critical: false });
            }
          }
        })
        .catch(() => {
          setBannerState('hidden');
        });
    }
  }, [updates.isUpdateAvailable, updates.isDownloading, bannerState, dismissed]);

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
