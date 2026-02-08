/**
 * EmptyPaymentsState Component
 * Shows empty state with avatar and placeholder text for Recent Payments tab
 * Figma Reference: 243-5689
 *
 * Figma Pixel-Perfect Values:
 * - Container: paddingVertical 48, paddingHorizontal 32, gap 16, alignItems center
 * - Avatar outer: width 64, height 64, borderRadius 32, backgroundColor #1A1A1A
 * - Avatar inner: width 48, height 48, borderRadius 24, backgroundColor #FF9A6D
 * - Title: fontSize 14, fontWeight 500, lineHeight 20, color #FFFFFF, textAlign center
 * - Description: fontSize 12, fontWeight 400, lineHeight 20, color #878787, textAlign center
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';

export interface EmptyPaymentsStateProps {
  title?: string;
  description?: string;
}

function EmptyPaymentsStateComponent({
  title = 'No Payments Yet',
  description = 'Your recent payment history will appear here\nonce you make your first rent payment.',
}: EmptyPaymentsStateProps) {
  return (
    <View style={styles.container}>
      {/* Avatar placeholder - Figma: circular icon with inner colored circle */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarOuter}>
          <View style={styles.avatarInner} />
        </View>
      </View>

      {/* Text content - Figma: centered text group */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 48, // Figma: 48px vertical padding
    paddingHorizontal: 32, // Figma: 32px horizontal padding
    gap: 16, // Figma: 16px gap between avatar and text
  },
  avatarContainer: {
    // Figma: marginBottom handled by container gap
  },
  avatarOuter: {
    width: 64, // Figma: width 64
    height: 64, // Figma: height 64
    borderRadius: 32, // Figma: fully rounded
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (black[600])
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 48, // Figma: width 48
    height: 48, // Figma: height 48
    borderRadius: 24, // Figma: fully rounded
    backgroundColor: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
  textContainer: {
    alignItems: 'center',
    gap: 8, // Figma: 8px gap between title and description
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF (white)
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '400', // Figma: fontWeight 400
    lineHeight: 20, // Figma: lineHeight 20
    color: '#878787', // Figma: #878787 (neutral[600])
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
});

export const EmptyPaymentsState = memo(EmptyPaymentsStateComponent);
