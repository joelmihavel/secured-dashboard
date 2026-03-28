/**
 * Dev Layout
 * Development-only screens
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function DevLayout() {
  // Only render in development
  if (!__DEV__) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
      }}
    >
      <Stack.Screen name="screen-picker" />
      <Stack.Screen name="critical-update-preview" />
    </Stack>
  );
}
