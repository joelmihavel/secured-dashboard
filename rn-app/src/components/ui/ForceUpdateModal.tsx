/**
 * Force Update Modal
 *
 * Full-screen blocking overlay shown when the app version is below
 * the admin-configured minimum. Matches error.tsx visual design.
 * No dismiss/back — user must update from the App Store.
 */

import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Screen } from '@/src/components/ui/Layout/Screen';
import { Text } from '@/src/components/ui/Typography/Text';
import { PrimaryButton } from '@/src/components/ui/Button/PrimaryButton';
import { colors, typography } from '@/src/theme';

const APP_STORE_URL = 'https://apps.apple.com/app/id6757275258';

const WarningIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={colors.brand[500]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface ForceUpdateModalProps {
  message?: string | null;
}

export function ForceUpdateModal({ message }: ForceUpdateModalProps) {
  return (
    <Screen testID="force-update-screen" padded={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <WarningIcon />
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.message}>
            {message || 'A new version of Flent Secured is available. Please update to continue using the app.'}
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Update Now"
            onPress={() => Linking.openURL(APP_STORE_URL)}
            testID="force-update-button"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 48,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    ...typography.bodyMd,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 48,
    width: '100%',
  },
});
