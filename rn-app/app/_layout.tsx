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

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black[700] }}>
          <SafeAreaProvider>
            <StatusBar style="light" backgroundColor={colors.black[700]} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.black[700] },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(main)" />
              <Stack.Screen name="(setup)" />
              <Stack.Screen name="(payment)" />
              <Stack.Screen name="(waitlist)" />
              <Stack.Screen name="(agreement)" />
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
