/**
 * Profile Flow Layout
 * Stack navigation for profile screens
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function ProfileLayout() {
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
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="help" />
      <Stack.Screen name="about" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
