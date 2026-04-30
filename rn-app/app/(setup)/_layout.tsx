/**
 * Setup Flow Layout
 * Protected — requires authentication
 *
 * CRITICAL: Always render <Stack> — never return a plain <View>.
 * Swapping the navigator for a View destroys native screen containers
 * and causes crashes on app resume from background.
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function SetupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
        freezeOnBlur: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add-utility" />
      <Stack.Screen name="invite-landlord" />
      <Stack.Screen name="invite-landlord-form" />
    </Stack>
  );
}
