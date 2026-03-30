/**
 * Agreement Flow Layout
 * Protected — requires authentication
 *
 * CRITICAL: Always render <Stack> on every render, even while auth is loading.
 * Returning a plain <View> destroys the native screen container, causing
 * "PropertyDOM doesn't exist" crash when the app resumes from background
 * (same class of bug as lesson #28 — never unmount a navigator).
 */

import React from 'react';
import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function AgreementLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
        freezeOnBlur: true, // Prevent PropertyDOM crash on background resume
      }}
    >
      <Stack.Screen name="upload" />
      <Stack.Screen name="add-bank-details" />
    </Stack>
  );
}
