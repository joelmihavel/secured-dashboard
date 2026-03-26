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
// COLD-START OTA GATE (for splash-aware reload)
// ==============================================
// index.tsx calls waitForColdStartOTA() before hiding the splash screen.
// If an OTA update downloads while the splash is still visible, we reload
// behind the splash → user sees a single continuous splash, not two.

let _otaUpdateDownloaded = false;
let _otaUpdateDetected = false;
let _otaWaiters: Array<(downloaded: boolean) => void> = [];

/** Called by useOTAUpdates when checkForUpdateAsync finds an update */
export function notifyUpdateDetected(): void {
  _otaUpdateDetected = true;
}

/** Called by useOTAUpdates when fetchUpdateAsync completes successfully */
export function notifyUpdateDownloaded(): void {
  _otaUpdateDownloaded = true;
  // Resolve all waiters
  _otaWaiters.forEach((resolve) => resolve(true));
  _otaWaiters = [];
}

/**
 * Check whether a cold-start OTA download already completed.
 * Returns true if an update was downloaded and a reload is recommended.
 * Returns false immediately otherwise -- never waits for in-progress
 * downloads. Updates that haven't finished will apply on next launch or
 * when the user backgrounds the app for 5+ minutes (useOTAUpdates).
 *
 * Called by index.tsx before SplashScreen.hideAsync() to allow
 * reloading behind the native splash (single splash experience).
 */
export async function waitForColdStartOTA(): Promise<boolean> {
  if (__DEV__ || !Updates) return false;
  // Only reload if the download already completed during auth resolution.
  // Don't wait for in-progress downloads -- that blocks cold start.
  return _otaUpdateDownloaded;
}

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
 * Check for OTA updates (check only — no download).
 *
 * Triggers checkForUpdateAsync() which updates the native state.
 * The useOTAUpdates hook reacts to isUpdateAvailable and handles
 * downloading, banner UI, and critical update reloads.
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

  isChecking = true;

  try {
    trackEvent('ota_check');
    const update = await Updates.checkForUpdateAsync();

    // Only set throttle timestamp after successful check
    lastCheckTime = Date.now();

    if (!update.isAvailable) {
      return { status: 'no_update', isCritical: false };
    }

    // Download and UI are handled by useOTAUpdates hook
    addBreadcrumb('OTA update available, hook will handle download', 'updates');
    return { status: 'downloading', isCritical: false };
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
 * Set up automatic update checking on cold start + foreground returns.
 *
 * Fires an immediate check on setup (cold start — AppState starts 'active'
 * so the change listener won't trigger). Subsequent checks fire when the
 * app returns to foreground. 5-minute throttle prevents double-checking.
 *
 * Call once in root layout. Returns cleanup function.
 */
export function setupAutoUpdateCheck(): () => void {
  if (__DEV__) return () => {};

  // Immediate check on cold start
  checkForUpdates();

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
 * Stabilize the auth session before destroying the JS context.
 *
 * Problem: reloadAsync() kills JS immediately. If the Supabase SDK's
 * autoRefreshToken was mid-rotation (sent old refresh token, received new
 * tokens, but hasn't written to SecureStore yet), the new tokens are lost.
 * On restart, the old (consumed) refresh token → 401 → SIGNED_OUT.
 *
 * Fix: pause auto-refresh, wait for any in-flight refresh to settle,
 * then reload. The SDK re-starts auto-refresh on the new JS context.
 */
async function stabilizeSessionBeforeReload(): Promise<void> {
  try {
    // Dynamic import to avoid circular dependency
    const { supabase } = require('../services/supabase/client');

    // stopAutoRefresh() prevents the SDK from starting a NEW refresh.
    // Any in-flight refresh will still complete and write to SecureStore.
    supabase.auth.stopAutoRefresh();

    // Give any in-flight refresh time to complete its write to SecureStore.
    // Token refresh round-trip is typically <500ms; 1.5s is generous.
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Read session to ensure SecureStore has the latest tokens persisted.
    // getSession() returns the in-memory session (which includes any
    // tokens from a just-completed refresh).
    await supabase.auth.getSession();
  } catch {
    // Non-fatal — proceed with reload even if stabilization fails.
    // Worst case: user has to log in again (same as before this fix).
  }
}

/**
 * Trigger an immediate app reload to apply a downloaded update.
 * Stabilizes the auth session first to prevent logout-on-reload.
 * Returns false if Updates module is not available.
 */
export async function reloadApp(): Promise<boolean> {
  if (!Updates) return false;

  try {
    trackEvent('ota_reload');
    await stabilizeSessionBeforeReload();
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
