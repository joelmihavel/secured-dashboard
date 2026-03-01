/**
 * Root Layout
 * App-wide providers and configuration
 */

import React, { useEffect } from 'react';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Text as RNText, TextInput } from 'react-native';

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { colors } from '@/src/theme';
import { QueryProvider, AuthProvider } from '@/src/providers';

// Custom dark theme to prevent white flashes during navigation transitions
const AppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.black[700], // #131313
    card: colors.black[700],
    border: colors.black[600],
    primary: colors.brand[500],
  },
};
// Conditional require: tree-shaken in production (DevNavigator is dev-only)
const DevNavigator = __DEV__
  ? require('@/src/components/dev/DevNavigator').DevNavigator
  : null;
import { ErrorBoundary } from '@/src/components/ui';
import { initSentry, wrapWithSentry, registerNavigationContainer } from '@/src/config/sentry';
import { setupNotificationHandlers } from '@/src/services/notifications';
import { setupAutoUpdateCheck, getEmergencyLaunchInfo } from '@/src/config/updates';
import { OfflineBanner } from '@/src/components/ui';
import { UpdateBanner } from '@/src/components/ui/Layout/UpdateBanner';
import { useDeepLink } from '@/src/hooks/useDeepLink';
import { useErrorNavigation } from '@/src/hooks/useErrorNavigation';
import { markAppReady } from '@/src/services/performance';
import { installGlobalErrorHandlers } from '@/src/services/globalErrorHandlers';

// Defer Sentry init and error handlers to avoid TurboModule contention at module scope.
// Previously ran synchronously at module scope — moved to a microtask so the JS thread
// can finish bundle evaluation before touching native modules.
Promise.resolve().then(() => {
  try {
    initSentry();
    installGlobalErrorHandlers();
  } catch (e) {
    console.error('[Sentry] Init failed:', e);
  }
});

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync().catch(() => {});

// Safety net for raw RNText usage — caps Dynamic Type scaling
if (!(RNText as any).defaultProps?.maxFontSizeMultiplier) {
  (RNText as any).defaultProps = { ...(RNText as any).defaultProps, maxFontSizeMultiplier: 1.3 };
}
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, maxFontSizeMultiplier: 1.2 };

function RootLayoutInner() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) {
      registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  const [fontsLoaded, fontError] = useFonts({
    // Plus Jakarta Sans
    'PlusJakartaSans-Regular': require('@/assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('@/assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('@/assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('@/assets/fonts/PlusJakartaSans-Bold.ttf'),
    // Inter
    'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
  });

  // NOTE: SplashScreen.hideAsync() is NOT called here on font load.
  // The native splash stays visible until index.tsx completes journey
  // resolution and navigates — prevents black screen during auth/network checks.
  // index.tsx calls SplashScreen.hideAsync() after router.replace().
  //
  // Safety net: force-hide after 8s to prevent stuck splash on edge cases
  // (e.g. index.tsx fails to mount, font loading hangs).
  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 8000);
    return () => clearTimeout(timeout);
  }, []);

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

  // Detect emergency launch (fallback to embedded bundle after OTA crash)
  useEffect(() => {
    getEmergencyLaunchInfo();
  }, []);

  // Handle deep links (ST-107)
  useDeepLink();

  // Bridge error event bus to router navigation
  useErrorNavigation();

  // Mark app as ready for performance tracking (PR-115)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      markAppReady();
    }
  }, [fontsLoaded, fontError]);

  // CRITICAL: Never return null — Expo Router requires the Root Layout to render
  // a navigator (<Stack>) on every render including the first. Returning null here
  // causes "Attempted to navigate before mounting the Root Layout component" crash.
  // The native splash screen (SplashScreen.preventAutoHideAsync) stays visible
  // until fonts load, so the user never sees unstyled content.

  return (
    <KeyboardProvider>
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black[700] }}>
            <ThemeProvider value={AppDarkTheme}>
              <SafeAreaProvider>
                <StatusBar style="light" backgroundColor={colors.black[700]} />
                <OfflineBanner />
                <UpdateBanner />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.black[700] },
                    animation: 'fade',
                    animationDuration: 200, // Snappier cross-fade
                    gestureEnabled: false,
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="error" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(auth)" options={{ animation: 'slide_from_right', animationDuration: 250 }} />
                  <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(setup)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(payment)" options={{
                    presentation: 'transparentModal',
                    animation: 'fade',
                    contentStyle: { backgroundColor: 'transparent' },
                  }} />
                  <Stack.Screen name="(waitlist)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(agreement)" options={{ animation: 'fade' }} />
                  <Stack.Screen name="(profile)" options={{ animation: 'slide_from_right', animationDuration: 250 }} />
                  {__DEV__ && <Stack.Screen name="(dev)" />}
                </Stack>
                {DevNavigator && <DevNavigator />}
              </SafeAreaProvider>
            </ThemeProvider>
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
    </KeyboardProvider>
  );
}

// Wrap with Sentry for performance monitoring and error tracking
// Uses safe wrapper that returns component as-is when Sentry native module is unavailable (Expo Go)
export default wrapWithSentry(RootLayoutInner);
