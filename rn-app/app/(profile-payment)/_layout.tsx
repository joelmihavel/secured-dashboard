/**
 * Profile Payment Route Group Layout
 * Handles navigation for profile-related payment screens
 */

import { Stack } from 'expo-router';
import { colors } from '@/src/theme';

export default function ProfilePaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',
      }}
    />
  );
}
