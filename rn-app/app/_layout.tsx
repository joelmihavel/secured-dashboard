/**
 * Root Layout
 * App-wide providers and configuration
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';
import { colors } from '@/src/theme';
import { QueryProvider } from '@/src/providers';
import { ErrorBoundary } from '@/src/components/ui';
import { initSentry, wrapWithSentry } from '@/src/config/sentry';
import { setupNotificationHandlers } from '@/src/services/notifications';
import { setupAutoUpdateCheck } from '@/src/config/updates';
import { OfflineBanner } from '@/src/components/ui';
import { useDeepLink } from '@/src/hooks/useDeepLink';
import { useErrorNavigation } from '@/src/hooks/useErrorNavigation';
import { usePaymentRecovery } from '@/src/hooks/usePaymentRecovery';
import { markAppReady } from '@/src/services/performance';
import { installGlobalErrorHandlers } from '@/src/services/globalErrorHandlers';

// Initialize Sentry before app renders
initSentry();

// Install global error handlers (chains with Sentry's handlers)
installGlobalErrorHandlers();

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [fontsLoaded, fontError] = useFonts({
    // Plus Jakarta Sans
    'PlusJakartaSans-Regular': require('@/assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('@/assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('@/assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('@/assets/fonts/PlusJakartaSans-Bold.ttf'),
    // Inter
    'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Set up push notification handlers
  useEffect(() => {
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  // Check for OTA updates on foreground
  useEffect(() => {
    const cleanup = setupAutoUpdateCheck();
    return cleanup;
  }, []);

  // Handle deep links (ST-107)
  useDeepLink();

  // Bridge error event bus to router navigation
  useErrorNavigation();

  // Crash recovery: resume polling for in-progress payments
  usePaymentRecovery();

  // Mark app as ready for performance tracking (PR-115)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      markAppReady();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black[700] }}>
          <SafeAreaProvider>
            <StatusBar style="light" backgroundColor={colors.black[700]} />
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.black[700] },
                animation: 'fade', // Smooth cross-fade transition to avoid flashes
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="error" options={{ animation: 'fade' }} />
              <Stack.Screen name="(auth)" options={{ animation: 'slide_from_right' }} /> {/* Auth still slides in */}
              <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(setup)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(payment)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(waitlist)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(agreement)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(transactions)" />
              <Stack.Screen name="(profile)" />
              {/* Development only screens */}
              {__DEV__ && <Stack.Screen name="(dev)" />}
            </Stack>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </ErrorBoundary>
  );
}

// Wrap with Sentry for performance monitoring and error tracking
// Uses safe wrapper that returns component as-is when Sentry native module is unavailable (Expo Go)
export default wrapWithSentry(RootLayoutInner);
