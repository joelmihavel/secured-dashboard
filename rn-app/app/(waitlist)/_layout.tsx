/**
 * Waitlist Layout
 * Stack navigation for waitlist screens
 */

import { Stack } from 'expo-router';

export default function WaitlistLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="approved" />
    </Stack>
  );
}
