/**
 * Auth Layout
 * Stack navigation for authentication flow
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="beta-splash" />
      <Stack.Screen name="carousel" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen
        name="otp"
        options={{
          presentation: 'containedTransparentModal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
