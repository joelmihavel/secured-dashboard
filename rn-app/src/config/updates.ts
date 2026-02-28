/**
 * OTA Updates Configuration
 *
 * Uses expo-updates for over-the-air JavaScript bundle updates.
 * Checks for updates on app foreground and optionally prompts user to restart.
 */

import { Alert, AppState, AppStateStatus } from 'react-native';
import { addBreadcrumb } from './sentry';

// Dynamic import to prevent crash when native module isn't available (dev client without rebuild)
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch {
  // Native module not available — updates will be no-ops
}

let isChecking = false;

/**
 * Check for OTA updates and apply if available.
 *
 * In production: checks Expo's update server.
 * In development: no-op (updates are disabled in dev client).
 */
export async function checkForUpdates(silent = true): Promise<void> {
  if (__DEV__ || isChecking || !Updates) return;

  isChecking = true;

  try {
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      addBreadcrumb('OTA update available', 'updates');

      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        if (silent) {
          // Apply on next cold start
          addBreadcrumb('OTA update downloaded, will apply on restart', 'updates');
        } else {
          // Prompt user to restart
          Alert.alert(
            'Update Available',
            'A new version has been downloaded. Restart now to apply?',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Restart',
                onPress: () => Updates.reloadAsync(),
              },
            ]
          );
        }
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
 */
export function setupAutoUpdateCheck(): () => void {
  if (__DEV__) return () => {};

  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      checkForUpdates(true);
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  // Check immediately on setup
  checkForUpdates(true);

  return () => {
    subscription.remove();
  };
}
