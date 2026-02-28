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
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >

      <Stack.Screen name="enter-rent" options={{ animation: 'none' }} />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="status" options={{
        presentation: 'card',
        animation: 'fade',
        contentStyle: { backgroundColor: colors.black[700] },
      }} />
    </Stack>
  );
}
