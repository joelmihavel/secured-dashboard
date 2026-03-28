/**
 * EmptyPaymentsState Component
 * Shows empty state for Recent Payments tab when no payments exist
 * Figma Reference: 769-308865 (node 769:309108)
 *
 * Figma Pixel-Perfect Values (from 769:309108):
 * - Container: centered, gap 16 between avatar and text group
 * - Avatar (769:309110): width 32, height 32, circular, orange fill
 * - Title (769:309112): fontSize 14, fontWeight 500, lineHeight 1.41 (~19.74), letterSpacing -0.56, color white
 * - Description (769:309113): fontSize 12, fontWeight 400, lineHeight 1.41 (~16.92), letterSpacing -0.24, color #878787, width 235, center
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface EmptyPaymentsStateProps {
  title?: string;
  description?: string;
}

function EmptyPaymentsStateComponent({
  title = 'No payments yet',
  description = 'Pay your rent before the due date; receipts will appear here.',
}: EmptyPaymentsStateProps) {
  return (
    <View style={styles.container}>
      {/* Figma 769:309109: column, gap 16, center */}
      <View style={styles.innerContainer}>
        {/* Icon — Figma 769:309110: 32x32 circular orange */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>₹</Text>
        </View>

        {/* Text group — Figma 769:309111: column, gap 8, center */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.white,
    textAlign: 'center',
  },
  innerContainer: {
    alignItems: 'center',
    gap: 16, // Figma 769:309109: gap 16
  },
  textContainer: {
    alignItems: 'center',
    gap: 8, // Figma 769:309111: gap 8
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 19.74, // Figma: 1.41 * 14
    letterSpacing: -0.56, // Figma: letterSpacing -0.56
    color: '#FFFFFF', // Figma: white
    textAlign: 'center',
  },
  description: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 16.92, // Figma: 1.41 * 12
    letterSpacing: -0.24, // Figma: letterSpacing -0.24
    color: '#878787', // Figma: #878787 (neutral[600])
    textAlign: 'center',
    width: 235, // Figma 769:309113: width 235
  },
});

export const EmptyPaymentsState = memo(EmptyPaymentsStateComponent);
