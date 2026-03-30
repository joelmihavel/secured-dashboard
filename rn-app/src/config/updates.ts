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
import * as SecureStore from 'expo-secure-store';
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
// OTA RELOAD MARKER (for extended auth debounce)
// ==============================================
// Written before Updates.reloadAsync(). AuthProvider reads this after
// restart to extend the SIGNED_OUT debounce from 3s to 5s, giving the
// SDK more time to recover the session from SecureStore.

export const OTA_RELOAD_MARKER_KEY = 'flent_ota_reload_ts';

// ==============================================
// TOKEN REFRESH TRACKING (for safe OTA reloads)
// ==============================================
// Promise-based tracking resolved by AuthProvider when TOKEN_REFRESHED fires.
// reloadApp() awaits this promise (with timeout) to ensure the SDK finishes
// persisting tokens to SecureStore before killing the JS runtime.
//
// Why not a boolean flag: booleans can get stuck if TOKEN_REFRESHED is missed.
// The Promise is always resolved via timeout in reloadApp() as a safety net.

let _tokenRefreshPromise: Promise<void> | null = null;
let _tokenRefreshResolve: (() => void) | null = null;

/** Called by AuthProvider when a token refresh is expected (JWT near-expiry on cold start). */
export function beginTokenRefreshTracking(): void {
  if (_tokenRefreshPromise) return; // already tracking
  _tokenRefreshPromise = new Promise<void>((resolve) => {
    _tokenRefreshResolve = resolve;
  });
}

/** Called by AuthProvider on TOKEN_REFRESHED, SIGNED_OUT, or SIGNED_IN to clear the wait. */
export function endTokenRefreshTracking(): void {
  if (_tokenRefreshResolve) {
    _tokenRefreshResolve();
    _tokenRefreshResolve = null;
  }
  _tokenRefreshPromise = null;
}

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
 * Check whether a cold-start OTA download completed (or wait briefly for one).
 *
 * Returns true if an update was downloaded and a reload is recommended.
 * The native splash is still visible when this runs, so waiting adds no
 * visual delay — the user just sees the splash icon a bit longer.
 *
 * @param maxWaitMs - Maximum time to wait for an in-progress download (default 2s).
 *   Caller (index.tsx) passes a dynamically capped value to stay under the
 *   6s safety timeout. On Indian 4G (5-15 Mbps), a JS bundle delta
 *   (100-500KB) typically downloads in 0.5-2s.
 */
export async function waitForColdStartOTA(maxWaitMs: number = 2000): Promise<boolean> {
  if (__DEV__ || !Updates) return false;

  // Already downloaded — reload immediately
  if (_otaUpdateDownloaded) return true;

  // No update detected — don't wait
  if (!_otaUpdateDetected) return false;

  // Update detected but still downloading — wait with bounded timeout.
  // The native splash is still covering the screen, so this is invisible.
  return new Promise<boolean>((resolve) => {
    _otaWaiters.push(resolve);

    setTimeout(() => {
      // If notifyUpdateDownloaded() already resolved us, the array was replaced
      // with a new empty one — indexOf returns -1, nothing happens.
      const idx = _otaWaiters.indexOf(resolve);
      if (idx !== -1) {
        _otaWaiters.splice(idx, 1);
        resolve(false); // Timed out — apply on next launch
      }
    }, maxWaitMs);
  });
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

    // Check if critical BEFORE downloading — manifest is available from checkForUpdateAsync
    const critical = isCriticalUpdate(update.manifest);
    notifyUpdateDetected();
    addBreadcrumb(`OTA update available (critical: ${critical}), hook will handle download`, 'updates');
    return { status: 'downloading', isCritical: critical };
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
 * Trigger an immediate app reload to apply a downloaded update.
 *
 * Token safety protocol:
 * 1. Stop the SDK's auto-refresh timer (prevents starting NEW refreshes)
 * 2. If a refresh is in-flight (tracked via beginTokenRefreshTracking),
 *    wait up to 3s for TOKEN_REFRESHED to fire — the SDK persists tokens
 *    to SecureStore internally via _saveSession() on that event.
 * 3. Write an OTA reload marker so AuthProvider extends the SIGNED_OUT
 *    debounce from 3s to 5s after restart.
 * 4. Reload.
 *
 * IMPORTANT: Does NOT call getSession() or setSession(). In auth-js v2.65.1:
 * - getSession() calls _callRefreshToken() when JWT is expired → race with autoRefresh
 * - setSession() calls _callRefreshToken() (expired) or _getUser() (valid) → side effects
 * Both trigger the exact race conditions that cause spurious SIGNED_OUT events.
 */
export async function reloadApp(): Promise<boolean> {
  if (!Updates) return false;

  try {
    // Step 1: Stop auto-refresh timer. Prevents the SDK from starting a NEW
    // refresh between now and reloadAsync(). Any in-flight refresh continues.
    // The SDK restarts auto-refresh on the new JS context (constructor calls _initialize).
    try {
      const { supabase } = require('../services/supabase/client');
      supabase.auth.stopAutoRefresh();
    } catch {
      // Non-fatal — proceed without stopping (same risk as before this fix)
    }

    // Step 2: Wait for in-flight token refresh to complete and persist.
    // The Promise is created by beginTokenRefreshTracking() in AuthProvider
    // and resolved by endTokenRefreshTracking() on TOKEN_REFRESHED/SIGNED_OUT.
    if (_tokenRefreshPromise) {
      trackEvent('ota_reload_deferred_token_refresh');
      addBreadcrumb('OTA reload waiting for token refresh', 'updates');
      await Promise.race([
        _tokenRefreshPromise,
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ]);
    }

    // Step 3: Write OTA reload marker. AuthProvider reads this after restart
    // to extend SIGNED_OUT debounce (3s → 5s), giving more recovery time.
    await SecureStore.setItemAsync(OTA_RELOAD_MARKER_KEY, String(Date.now())).catch(() => {});

    trackEvent('ota_reload');
    await Updates.reloadAsync({
      reloadScreenOptions: {
        backgroundColor: '#131313',
        image: require('../../assets/images/splash-icon.png'),
        imageResizeMode: 'contain',
        fade: true,
        spinner: {
          enabled: true,
          color: '#FF9A6D',  // Brand accent — small loader at bottom
          size: 'small',
        },
      },
    });
    return true;
  } catch {
    // Restart auto-refresh if we stopped it but reload failed.
    // Without this, the SDK's periodic token refresh stays stopped for the
    // rest of the session → tokens expire → 401 → user effectively logged out.
    try {
      const { supabase } = require('../services/supabase/client');
      supabase.auth.startAutoRefresh();
    } catch {
      // Non-fatal
    }
    return false;
  }
}
