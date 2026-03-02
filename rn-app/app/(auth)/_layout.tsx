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
        animationDuration: 250,
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="splash" options={{ gestureEnabled: false }} />
      <Stack.Screen name="beta-splash" options={{ gestureEnabled: false }} />
      <Stack.Screen name="carousel" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen
        name="otp"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          animationDuration: 200,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}
