/**
 * Setup Flow Layout
 * Protected — requires authentication
 */

import React from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

import { colors } from '@/src/theme';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';

export default function SetupLayout() {
  const { isReady } = useRequireAuth();

  if (!isReady) {
    // Return a black screen with no indicator to match stack transition aesthetics
    return <View style={{ flex: 1, backgroundColor: colors.black[700] }} />;
  }

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
