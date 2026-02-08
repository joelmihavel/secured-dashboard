/**
 * Setup Flow Layout
 * Stack navigation for setup screens with progress indicator
 *
 * Figma Screens:
 * - 41-10712: Add landlord's bank details
 * - 41-10859: Upload address proof
 * - 41-11006: Invite landlord
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
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="add-bank" />
      <Stack.Screen name="add-utility" />
      <Stack.Screen name="invite-landlord" />
      <Stack.Screen name="pending-steps" />
    </Stack>
  );
}
