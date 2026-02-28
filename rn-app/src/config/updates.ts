/**
 * OTA Updates Configuration
 *
 * Enhanced OTA system with:
 * - Emergency launch detection (fallback to embedded bundle)
 * - Critical update support (force-reload via EAS Update metadata)
 * - Auto-reload for critical updates
 * - Typed results with status tracking
 * - Analytics events for all OTA lifecycle stages
 *
 * Uses expo-updates for over-the-air JavaScript bundle updates.
 */

import { AppState, AppStateStatus } from 'react-native';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';

// Dynamic import to prevent crash when native module isn't available (dev client without rebuild)
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch {
  // Native module not available — updates will be no-ops
}

// ==============================================
// TYPES
// ==============================================

export type UpdateCheckStatus =
  | 'no_update'
  | 'downloading'
  | 'downloaded'
  | 'downloaded_critical'
  | 'reloading'
  | 'error'
  | 'throttled'
  | 'unavailable';

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  isCritical: boolean;
  error?: string;
}

// ==============================================
// STATE
// ==============================================

let isChecking = false;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes (reduced from 30m for payment app)

// ==============================================
// EMERGENCY LAUNCH DETECTION
// ==============================================

export interface EmergencyLaunchInfo {
  isEmergencyLaunch: boolean;
  reason?: string;
}

/**
 * Detect if the app launched via emergency fallback (embedded bundle).
 * This happens when a previously downloaded OTA update crashes on startup.
 * Logs to Sentry + analytics but does NOT navigate (lesson 29 compliance).
 */
export function getEmergencyLaunchInfo(): EmergencyLaunchInfo {
  if (!Updates) return { isEmergencyLaunch: false };

  try {
    const isEmergency = Updates.isEmergencyLaunch;

    if (isEmergency) {
      const reason = 'App launched from embedded bundle after OTA crash';
      addBreadcrumb('OTA emergency launch detected', 'updates', { reason });
      trackEvent('ota_emergency_launch', { reason });
      return { isEmergencyLaunch: true, reason };
    }

    return { isEmergencyLaunch: false };
  } catch {
    return { isEmergencyLaunch: false };
  }
}

// ==============================================
// CRITICAL UPDATE DETECTION
// ==============================================

/**
 * Check if an update manifest contains a critical flag.
 * Set via: `eas update --metadata '{"critical": true}'`
 */
export function isCriticalUpdate(manifest: any): boolean {
  try {
    const metadata = manifest?.metadata;
    if (!metadata) return false;
    return metadata.critical === true || metadata.critical === 'true';
  } catch {
    return false;
  }
}

// ==============================================
// MAIN CHECK FUNCTION
// ==============================================

/**
 * Check for OTA updates, download if available, auto-reload for critical.
 *
 * In production: checks Expo's update server, downloads the bundle.
 * For critical updates: calls reloadAsync() after 500ms delay.
 * For normal updates: downloaded silently, applied via UI banner or next cold start.
 * In development: no-op (updates are disabled in dev client).
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (__DEV__ || !Updates) {
    return { status: 'unavailable', isCritical: false };
  }

  if (isChecking) {
    return { status: 'throttled', isCritical: false };
  }

  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL) {
    return { status: 'throttled', isCritical: false };
  }
  lastCheckTime = now;

  isChecking = true;

  try {
    trackEvent('ota_check');
    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) {
      return { status: 'no_update', isCritical: false };
    }

    addBreadcrumb('OTA update available, downloading', 'updates');
    const critical = isCriticalUpdate(update.manifest);

    const result = await Updates.fetchUpdateAsync();

    if (result.isNew) {
      trackEvent('ota_downloaded', { critical });

      if (critical) {
        addBreadcrumb('Critical OTA update — auto-reloading', 'updates');
        trackEvent('ota_critical_auto_apply');

        // Short delay to let analytics flush
        setTimeout(() => {
          try {
            Updates!.reloadAsync();
          } catch {
            // reloadAsync may throw if called too quickly
          }
        }, 500);

        return { status: 'downloaded_critical', isCritical: true };
      }

      addBreadcrumb('OTA update cached, banner will prompt user', 'updates');
      return { status: 'downloaded', isCritical: false };
    }

    return { status: 'no_update', isCritical: false };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    addBreadcrumb(`OTA check failed: ${errorMsg}`, 'updates');
    trackEvent('ota_error', { error: errorMsg });

    if (__DEV__) {
      console.log('[Updates] Check failed:', err);
    }

    return { status: 'error', isCritical: false, error: errorMsg };
  } finally {
    isChecking = false;
  }
}

// ==============================================
// AUTO-CHECK ON FOREGROUND
// ==============================================

/**
 * Set up automatic update checking when app returns to foreground.
 *
 * Call once in root layout. Returns cleanup function.
 */
export function setupAutoUpdateCheck(): () => void {
  if (__DEV__) return () => {};

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      checkForUpdates();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
  };
}

// ==============================================
// RELOAD HELPER
// ==============================================

/**
 * Trigger an immediate app reload to apply a downloaded update.
 * Returns false if Updates module is not available.
 */
export async function reloadApp(): Promise<boolean> {
  if (!Updates) return false;

  try {
    trackEvent('ota_reload');
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
