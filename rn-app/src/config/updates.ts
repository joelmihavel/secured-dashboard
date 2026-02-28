/**
 * OTA Updates Configuration
 *
 * Uses expo-updates for over-the-air JavaScript bundle updates.
 * Downloads updates silently in background; applies on next cold start
 * via the native ON_LOAD mechanism (configured in app.json).
 */

import { AppState, AppStateStatus } from 'react-native';
import { addBreadcrumb } from './sentry';

// Dynamic import to prevent crash when native module isn't available (dev client without rebuild)
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch {
  // Native module not available — updates will be no-ops
}

let isChecking = false;
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

/**
 * Check for OTA updates and download if available.
 *
 * In production: checks Expo's update server, downloads the bundle.
 * The update applies automatically on next cold start (native ON_LOAD).
 * In development: no-op (updates are disabled in dev client).
 */
export async function checkForUpdates(): Promise<void> {
  if (__DEV__ || isChecking || !Updates) return;

  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL) return;
  lastCheckTime = now;

  isChecking = true;

  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      addBreadcrumb('OTA update available, downloading', 'updates');

      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        addBreadcrumb('OTA update cached, will apply on next launch', 'updates');
        // No reloadAsync() — native ON_LOAD applies it on next cold start
      }
    }
  } catch (err) {
    // Silently fail — OTA is best-effort
    if (__DEV__) {
      console.log('[Updates] Check failed:', err);
    }
  } finally {
    isChecking = false;
  }
}

/**
 * Set up automatic update checking when app returns to foreground.
 *
 * Call once in root layout. Returns cleanup function.
 * Updates are downloaded silently and apply on next cold start.
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
