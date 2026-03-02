/**
 * Waitlist Layout
 * Protected — requires authentication
 *
 * CRITICAL: Always render <Stack> — never return a plain <View>.
 * Swapping the navigator for a View destroys native screen containers
 * and causes crashes on app resume from background.
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function WaitlistLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.black[700] },
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="approved" />
    </Stack>
  );
}
