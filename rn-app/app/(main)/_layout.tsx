/**
 * Main App Layout
 * Placeholder for authenticated screens
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
