/**
 * Pill — Shared pill/tag UI component
 *
 * Figma canonical pill pattern (from 684:8436, 799:3389, etc.):
 *   - borderRadius: 12
 *   - bg: black[700] #131313 (default) or black[600] #1A1A1A
 *   - text: 12/20 PlusJakartaSans-Regular
 *   - padding: 5-8v / 12h (variant-dependent)
 *
 * Also supports "tag" shape (borderRadius: 200, full pill) used for
 * inline status tags like "Set it up", "Unavailable now", "Selected".
 */

import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText, ViewStyle, StyleProp } from 'react-native';

import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// ============================================
// VARIANT CONFIG
// ============================================

const VARIANTS = {
  // Default notification pill — bg #131313, r12
  default: {
    bg: colors.black[700],
    textColor: '#FF9A6D',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  // Muted notification — bg #1A1A1A, r12
  muted: {
    bg: colors.black[600],
    textColor: colors.neutral[200],
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  // Warning pill — bg with warning color
  warning: {
    bg: '#332306',
    textColor: '#FFC04D',
    borderRadius: 12,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
  },
  // Error pill
  error: {
    bg: '#3D1213',
    textColor: '#FF8080',
    borderRadius: 12,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
  },
  // Tag: "Set it up" — bg #202020, full pill shape
  tag: {
    bg: colors.black[500],
    textColor: colors.neutral[200],
    borderRadius: 40,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  // Tag disabled: "Unavailable now" — bg #4D4D4D
  tagDisabled: {
    bg: colors.black[400],
    textColor: colors.neutral[600],
    borderRadius: 40,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  // Selected tag — bg #1A1A1A, text brand orange
  tagSelected: {
    bg: colors.black[600],
    textColor: colors.brand[500],
    borderRadius: 200,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
  },
} as const;

export type PillVariant = keyof typeof VARIANTS;

// ============================================
// PROPS
// ============================================

export interface PillProps {
  text: string;
  variant?: PillVariant;
  /** Override text color */
  textColor?: string;
  /** Override background color */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ============================================
// COMPONENT
// ============================================

function PillComponent({
  text,
  variant = 'default',
  textColor,
  backgroundColor,
  style,
  testID,
}: PillProps) {
  const config = VARIANTS[variant];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: backgroundColor ?? config.bg,
          borderRadius: config.borderRadius,
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
        },
        style,
      ]}
      testID={testID}
    >
      <RNText style={[styles.text, { color: textColor ?? config.textColor }]}>
        {text}
      </RNText>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export const Pill = memo(PillComponent);
