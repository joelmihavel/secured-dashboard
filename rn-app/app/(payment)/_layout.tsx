/**
 * Payment Flow Layout
 * Stack navigation for payment screens
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function PaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="select-method" />
      <Stack.Screen name="initiate" />
      <Stack.Screen name="processing" />
      <Stack.Screen name="success" />
      <Stack.Screen name="failed" />
    </Stack>
  );
}
