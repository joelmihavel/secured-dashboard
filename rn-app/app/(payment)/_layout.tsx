/**
 * Payment Flow Layout
 * Protected — requires authentication
 */

import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '@/src/theme';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';

export default function PaymentLayout() {
  const { isReady, isAuthenticated } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace('/(auth)/sign-up');
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady || !isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black[700], justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
        animation: 'slide_from_bottom',
        animationDuration: 250,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="enter-rent" options={{ animation: 'none' }} />
      <Stack.Screen name="confirm" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="status" options={{
        presentation: 'card',
        animation: 'fade',
        animationDuration: 200,
        contentStyle: { backgroundColor: colors.black[700] },
      }} />
    </Stack>
  );
}
