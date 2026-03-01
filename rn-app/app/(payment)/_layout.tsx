/**
 * Payment Flow Layout
 * Protected — requires authentication
 *
 * CRITICAL: Always render <Stack> — never return a plain <View>.
 * Swapping the navigator for a View destroys native screen containers
 * and causes crashes on app resume from background.
 *
 * Auth redirect is handled by the root index.tsx router —
 * unauthenticated users never reach this layout.
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function PaymentLayout() {
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
      <Stack.Screen name="status" options={{
        presentation: 'card',
        animation: 'fade',
        animationDuration: 200,
        contentStyle: { backgroundColor: colors.black[700] },
      }} />
    </Stack>
  );
}
