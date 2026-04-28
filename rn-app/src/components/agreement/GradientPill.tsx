/**
 * Gradient pill button — shared across the agreement flow ("Save Changes" /
 * "Confirm & Continue" / "Verify Details" / "Edit Missing Details"), the
 * payment success screen ("Download receipt"), and the payment status screen
 * ("Try again" / "Contact support"). Figma: 0.5px brand[500] border, vertical
 * gradient #202020 → #0D0D0D, orange-tinted drop shadow, retro inset shadow.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/src/components';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

export interface GradientPillProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** When true, swap the label for a small spinner. Used by the success
   *  screen while the receipt PDF is being generated. */
  loading?: boolean;
  /** Optional additional style — e.g. minWidth on the payment status screen. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GradientPill({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
}: GradientPillProps) {
  const isInactive = disabled || loading;
  return (
    <Pressable
      onPress={isInactive ? undefined : onPress}
      disabled={isInactive}
      style={({ pressed }) => [
        styles.pill,
        disabled && styles.pillDisabled,
        pressed && !isInactive && styles.pillPressed,
        style,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
    >
      <LinearGradient
        colors={[colors.black[500], colors.black[800]]}
        locations={[0, 0.9]}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Text style={[styles.pillText, disabled && styles.pillTextDisabled]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderColor: colors.brand[500],
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: s(16),
    paddingVertical: sv(12),
    shadowColor: '#995C41',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillDisabled: {
    borderColor: colors.black[400],
    shadowOpacity: 0,
  },
  pillPressed: { opacity: 0.85 },
  pillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.white,
  },
  pillTextDisabled: { color: colors.neutral[600] },
});
