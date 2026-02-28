/**
 * Waitlist Layout
 * Protected — requires authentication
 */

import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '@/src/theme';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';

export default function WaitlistLayout() {
  const { isReady } = useRequireAuth();

  if (!isReady) {
    // Return a black screen with no indicator to match stack transition aesthetics
    return <View style={{ flex: 1, backgroundColor: colors.black[700] }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.black[700] },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="approved" />
    </Stack>
  );
}
