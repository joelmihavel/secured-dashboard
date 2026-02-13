/**
 * Push Notification Service
 *
 * Handles push notification registration, token management, and deep link routing.
 *
 * SETUP REQUIRED:
 *   1. npx expo install expo-notifications expo-device expo-constants
 *   2. npx expo prebuild --clean
 *   3. Add "expo-notifications" to app.json plugins
 *   4. Uncomment the implementation below
 *
 * Notification payload contract (from backend):
 *   {
 *     title: string,
 *     body: string,
 *     data: {
 *       route: string,          // e.g. "/(waitlist)/approved"
 *       params?: Record<string, string>  // e.g. { paymentId: "abc" }
 *     }
 *   }
 */

// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import Constants from 'expo-constants';
// import { Platform } from 'react-native';
// import { router } from 'expo-router';
// import { supabase } from './supabase/client';

/**
 * Route map: notification type → screen route
 */
export const NOTIFICATION_ROUTES: Record<string, string> = {
  waitlist_approved: '/(waitlist)/approved',
  agreement_reviewed: '/(agreement)/success',
  payment_success: '/(payment)/success',
  payment_failed: '/(payment)/failed',
  landlord_approved: '/(setup)/pending-steps',
  new_cashback: '/(main)',
  rent_reminder: '/(payment)/select-method',
};

/**
 * Register for push notifications and save token to Supabase.
 *
 * Call this after successful authentication.
 * No-op until expo-notifications is installed.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // TODO: Uncomment when expo-notifications is installed
  // if (!Device.isDevice) {
  //   console.log('Push notifications require a physical device');
  //   return null;
  // }
  //
  // const { status: existingStatus } = await Notifications.getPermissionsAsync();
  // let finalStatus = existingStatus;
  //
  // if (existingStatus !== 'granted') {
  //   const { status } = await Notifications.requestPermissionsAsync();
  //   finalStatus = status;
  // }
  //
  // if (finalStatus !== 'granted') {
  //   console.log('Push notification permission not granted');
  //   return null;
  // }
  //
  // const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  // const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  //
  // // Save token to Supabase user profile
  // const { data: { session } } = await supabase.auth.getSession();
  // if (session) {
  //   await supabase
  //     .from('user_profiles')
  //     .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
  //     .eq('user_id', session.user.id);
  // }
  //
  // // Android: set notification channel
  // if (Platform.OS === 'android') {
  //   Notifications.setNotificationChannelAsync('default', {
  //     name: 'Flent Secured',
  //     importance: Notifications.AndroidImportance.MAX,
  //     vibrationPattern: [0, 250, 250, 250],
  //   });
  // }
  //
  // return token;

  return null;
}

/**
 * Handle a notification tap — navigate to the relevant screen.
 *
 * Call from the notification response listener in root layout.
 * No-op until expo-notifications is installed.
 */
export function handleNotificationResponse(data: Record<string, unknown>): void {
  const route = data?.route as string | undefined;
  const params = data?.params as Record<string, string> | undefined;

  if (!route) return;

  // Use expo-router to navigate
  // router.push({ pathname: route as never, params });
  console.log('[Notifications] Would navigate to:', route, params);
}

/**
 * Configure notification handlers (foreground + background).
 *
 * Call once in root layout useEffect.
 * No-op until expo-notifications is installed.
 */
export function setupNotificationHandlers(): () => void {
  // TODO: Uncomment when expo-notifications is installed
  //
  // // Handle foreground notifications
  // Notifications.setNotificationHandler({
  //   handleNotification: async () => ({
  //     shouldShowAlert: true,
  //     shouldPlaySound: true,
  //     shouldSetBadge: true,
  //   }),
  // });
  //
  // // Handle notification taps
  // const responseSubscription = Notifications.addNotificationResponseReceivedListener(
  //   (response) => {
  //     const data = response.notification.request.content.data;
  //     handleNotificationResponse(data);
  //   }
  // );
  //
  // return () => {
  //   responseSubscription.remove();
  // };

  // No-op cleanup
  return () => {};
}
