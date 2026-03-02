/**
 * Push Notification Service (BE-085)
 *
 * Handles push notification registration, token management, deep link routing,
 * retry logic for failed notifications, deduplication, and quiet hours.
 *
 * Notification payload contract (from backend):
 *   {
 *     title: string,
 *     body: string,
 *     data: {
 *       route: string,          // e.g. "/(waitlist)/approved"
 *       params?: Record<string, string>,
 *       notification_id?: string // For deduplication
 *     }
 *   }
 */

// Dynamic imports to prevent crash when native module isn't available (dev client without rebuild)
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  // Native module not available — notifications will be no-ops
}
import Constants from 'expo-constants';
import { Platform, Linking, AppState } from 'react-native';
import { router } from 'expo-router';
import { addBreadcrumb } from '../config/sentry';

const APP_STORE_URL = 'https://apps.apple.com/in/app/secured-by-flent/id6757275258';

// ==============================================
// CONFIGURATION
// ==============================================

/**
 * Retry configuration for failed push notification registration.
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
} as const;

/**
 * Quiet hours configuration.
 * Notifications received during quiet hours are silenced (no alert/sound).
 */
const QUIET_HOURS = {
  enabled: true,
  startHour: 22, // 10 PM
  endHour: 8,    // 8 AM
} as const;

/**
 * Deduplication window in milliseconds (5 minutes).
 * Notifications with the same ID within this window are suppressed.
 */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// ==============================================
// DEDUPLICATION STATE
// ==============================================

/**
 * In-memory cache of recently seen notification IDs for deduplication.
 * Maps notification_id -> timestamp when first seen.
 */
const seenNotifications = new Map<string, number>();

/**
 * Cleans up expired entries from the dedup cache.
 */
function cleanupDedup(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  const entries = Array.from(seenNotifications.entries());
  for (const [id, timestamp] of entries) {
    if (timestamp < cutoff) {
      seenNotifications.delete(id);
    }
  }
}

/**
 * Checks if a notification has already been seen within the dedup window.
 * Returns true if this is a duplicate.
 */
function isDuplicate(notificationId: string | undefined): boolean {
  if (!notificationId) return false;

  cleanupDedup();

  if (seenNotifications.has(notificationId)) {
    return true;
  }

  seenNotifications.set(notificationId, Date.now());
  return false;
}

// ==============================================
// QUIET HOURS
// ==============================================

/**
 * Checks if the current time is within quiet hours.
 * Quiet hours span from startHour to endHour (next day).
 */
function isQuietHours(): boolean {
  if (!QUIET_HOURS.enabled) return false;

  const now = new Date();
  const currentHour = now.getHours();

  // Quiet hours wrap around midnight: e.g., 22:00 - 08:00
  if (QUIET_HOURS.startHour > QUIET_HOURS.endHour) {
    return currentHour >= QUIET_HOURS.startHour || currentHour < QUIET_HOURS.endHour;
  }

  return currentHour >= QUIET_HOURS.startHour && currentHour < QUIET_HOURS.endHour;
}

// ==============================================
// RETRY LOGIC
// ==============================================

/**
 * Retries an async operation with exponential backoff.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === config.maxRetries;

      if (isLastAttempt) {
        console.error(
          `[Notifications] ${operationName} failed after ${config.maxRetries + 1} attempts:`,
          error
        );
        break;
      }

      const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
      console.warn(
        `[Notifications] ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms...`
      );

      addBreadcrumb(`${operationName} retry`, 'notifications', {
        attempt: attempt + 1,
        delay,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==============================================
// ROUTE MAP
// ==============================================

/**
 * Route map: notification type -> screen route
 */
export const NOTIFICATION_ROUTES: Record<string, string> = {
  waitlist_approved: '/(waitlist)/approved',
  waitlist_rejected: '/(waitlist)',
  agreement_reviewed: '/(waitlist)',
  payment_success: '/(payment)/status',
  payment_failed: '/(payment)/status',
  rent_due: '/(payment)/enter-rent',
  rent_due_tomorrow: '/(payment)/enter-rent',
  rent_overdue: '/(payment)/enter-rent',
  settlement_complete: '/(main)',
  settlement_failed: '/(main)',
  landlord_approved: '/(setup)/pending-steps',
  landlord_confirmed: '/(setup)/pending-steps',
  landlord_rejected: '/(setup)/invite-landlord',
  new_cashback: '/(main)',
  rent_reminder: '/(payment)/enter-rent',
  app_update: '/(main)',
  reminder_utility: '/(setup)/add-utility',
  reminder_landlord_invite: '/(setup)/invite-landlord',
  reminder_agreement: '/(agreement)/upload',
};

// ==============================================
// REGISTRATION
// ==============================================

/**
 * Register for push notifications and return the Expo Push Token.
 *
 * Call this after successful authentication.
 * Returns null on simulator or if permissions are denied.
 * Includes retry logic for transient failures.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  try {
    return await withRetry(async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return null;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('[Notifications] No EAS project ID configured');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      // Android: set notification channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Flent Secured',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });

        // Silent channel for quiet hours
        await Notifications.setNotificationChannelAsync('silent', {
          name: 'Silent Notifications',
          importance: Notifications.AndroidImportance.LOW,
          sound: undefined,
          vibrationPattern: undefined,
        });
      }

      addBreadcrumb('Push token registered', 'notifications', {
        tokenPrefix: token.slice(0, 20),
      });

      // Save token to backend
      try {
        const { callEdgeFunction } = await import('./supabase/client');
        await callEdgeFunction('register-device-token', {
          token,
          platform: Platform.OS,
          bundle_id: 'in.flent.secured',
          sandbox: __DEV__,
        }, true);
      } catch (err) {
        console.warn('[Notifications] Failed to save push token:', err);
      }

      return token;
    }, 'Push token registration');
  } catch (error) {
    console.error('[Notifications] Registration failed after all retries:', error);
    addBreadcrumb('Push registration failed', 'notifications', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

// ==============================================
// NOTIFICATION TAP HANDLER
// ==============================================

/**
 * Handle a notification tap -- navigate to the relevant screen.
 * Special case: app_update opens the App Store instead of in-app navigation.
 */
export function handleNotificationResponse(data: Record<string, unknown>): void {
  const route = data?.route as string | undefined;
  const params = data?.params as Record<string, string> | undefined;
  const notificationType = data?.notification_type as string | undefined;
  const storeUrl = data?.store_url as string | undefined;

  // App update: open App Store
  if (notificationType === 'app_update' || storeUrl) {
    const url = storeUrl || APP_STORE_URL;
    addBreadcrumb('App update notification tapped', 'notifications', { url });
    Linking.openURL(url).catch((err) => {
      console.warn('[Notifications] Failed to open store URL:', err);
    });
    return;
  }

  if (!route) return;

  addBreadcrumb('Notification tapped', 'notifications', { route });

  try {
    router.push({ pathname: route as never, params });
  } catch (err) {
    console.warn('[Notifications] Failed to navigate to:', route, err);
  }
}

// ==============================================
// NOTIFICATION HANDLERS SETUP
// ==============================================

/**
 * Configure notification handlers (foreground + background).
 *
 * Call once in root layout useEffect. Returns cleanup function.
 * Includes deduplication and quiet hours support.
 */
export function setupNotificationHandlers(): () => void {
  // No-op when native module isn't available
  if (!Notifications) return () => {};

  // Handle foreground notifications with quiet hours and dedup
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const notificationId = data?.notification_id as string | undefined;

      // Deduplication check
      if (isDuplicate(notificationId)) {
        console.log('[Notifications] Suppressed duplicate:', notificationId);
        addBreadcrumb('Duplicate notification suppressed', 'notifications', {
          notificationId,
        });
        return {
          shouldShowAlert: false, shouldShowBanner: false, shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }

      // Quiet hours check
      if (isQuietHours()) {
        console.log('[Notifications] Quiet hours - silencing notification');
        addBreadcrumb('Notification silenced (quiet hours)', 'notifications', {
          notificationId,
        });
        return {
          shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,   // Still show silently
          shouldPlaySound: false,  // No sound during quiet hours
          shouldSetBadge: true,    // Still update badge count
        };
      }

      return {
        shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });

  // Handle notification taps
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      handleNotificationResponse(data as Record<string, unknown>);
    }
  );

  // Clear badge on app open
  Notifications.setBadgeCountAsync(0).catch(() => {});

  // Clear badge when app returns to foreground
  const appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      Notifications?.setBadgeCountAsync(0).catch(() => {});
    }
  });

  // Periodic cleanup of dedup cache (every 10 minutes)
  const cleanupInterval = setInterval(cleanupDedup, 10 * 60 * 1000);

  return () => {
    responseSubscription.remove();
    appStateSubscription.remove();
    clearInterval(cleanupInterval);
  };
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Schedules a local notification (for testing or offline reminders).
 * Respects quiet hours by delaying to after end hour.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  delaySeconds = 0
): Promise<string | null> {
  if (!Notifications) return null;

  try {
    let triggerSeconds = delaySeconds;

    // If in quiet hours and immediate delivery requested, delay to end of quiet hours
    if (delaySeconds === 0 && isQuietHours()) {
      const now = new Date();
      const endTime = new Date(now);
      endTime.setHours(QUIET_HOURS.endHour, 0, 0, 0);

      // If end time is before now, it's tomorrow
      if (endTime <= now) {
        endTime.setDate(endTime.getDate() + 1);
      }

      triggerSeconds = Math.ceil((endTime.getTime() - now.getTime()) / 1000);
      console.log(
        `[Notifications] Quiet hours active, delaying local notification by ${triggerSeconds}s`
      );
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: isQuietHours() ? undefined : 'default',
      },
      trigger: triggerSeconds > 0
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds }
        : null,
    });

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to schedule local notification:', error);
    return null;
  }
}

/**
 * Gets the current quiet hours status for UI display.
 */
export function getQuietHoursStatus(): {
  isActive: boolean;
  startHour: number;
  endHour: number;
} {
  return {
    isActive: isQuietHours(),
    startHour: QUIET_HOURS.startHour,
    endHour: QUIET_HOURS.endHour,
  };
}

/**
 * Clears the dedup cache (useful for testing).
 */
export function clearDeduplicationCache(): void {
  seenNotifications.clear();
}
