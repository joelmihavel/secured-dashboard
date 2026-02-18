/**
 * ScreenTitle Component
 * Figma: Two-color screen title pattern used across all screens
 *
 * EXACT Figma Values:
 * - Font: Plus Jakarta Sans Regular (400)
 * - Size: 48px, line-height 64px, letterSpacing -2
 * - Gray variant: #A9A9A9 (neutral/500) — used for "Let's get to", "Verify your", "My"
 * - White variant: #FFFFFF — used for "Add your", "Invite your"
 * - Accent: #FF9A6D (brand/500) — highlighted word/line
 *
 * Usage:
 * <ScreenTitle gray="Let's get to" accent="know you" />
 * <ScreenTitle white="Add your" accent="UPI Method" />
 * <ScreenTitle gray="My " accent="Profile" singleLine />
 */

import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from './Text';

interface ScreenTitleProps {
  /** Text in gray (#A9A9A9) — mutually exclusive with `white` */
  gray?: string;
  /** Text in white (#FFFFFF) — mutually exclusive with `gray` */
  white?: string;
  /** Text in accent orange (#FF9A6D) */
  accent: string;
  /** If true, render on a single line instead of two lines */
  singleLine?: boolean;
  /** Maximum width for text wrapping (default: none) */
  maxWidth?: number;
}

function ScreenTitleComponent({ gray, white, accent, singleLine = false, maxWidth }: ScreenTitleProps) {
  const primaryColor = gray ? '#A9A9A9' : '#FFFFFF';
  const primaryText = gray ?? white ?? '';
  const separator = singleLine ? '' : '\n';

  return (
    <Text
      style={[
        styles.base,
        { color: primaryColor },
        maxWidth ? { maxWidth } : undefined,
      ]}
    >
      {primaryText}{separator}
      <Text inherit style={styles.accent}>{accent}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  accent: {
    color: '#FF9A6D',
  },
});

export const ScreenTitle = memo(ScreenTitleComponent);
