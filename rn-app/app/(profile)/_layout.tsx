/**
 * Profile Flow Layout
 * Protected — requires authentication
 */

import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '@/src/theme';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';

export default function ProfileLayout() {
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
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="edit-payment-method" />
      <Stack.Screen name="edit-bank-details" />
      <Stack.Screen name="agreement" />
    </Stack>
  );
}
