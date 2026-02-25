/**
 * Payment Flow Layout
 * Protected — requires authentication
 */

import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '@/src/theme';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';

export default function PaymentLayout() {
  const { isReady } = useRequireAuth();

  if (!isReady) {
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
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="first-rent" />
      <Stack.Screen name="confirm" />
      <Stack.Screen name="status" />
    </Stack>
  );
}
