/**
 * Dashed Divider Component
 * Figma: Dashed line separator - Rectangle 140
 *
 * Colors from Figma analysis:
 * - Default: #4D4D4D (black.400)
 */

import React, { memo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { spacing } from '@/src/theme';

// Figma color for divider
const DIVIDER_COLOR = '#4D4D4D'; // black.400 - Rectangle 140

export interface DashedDividerProps {
  color?: string;
  dashLength?: number;
  dashGap?: number;
  style?: ViewStyle;
}

function DashedDividerComponent({
  color = DIVIDER_COLOR,
  dashLength = 6,
  dashGap = 4,
  style,
}: DashedDividerProps) {
  // 120 dashes for full width coverage across all screen sizes
  const dashes = Array.from({ length: 120 }, (_, i) => i);

  return (
    <View style={[styles.container, style]}>
      {dashes.map((i) => (
        <View
          key={i}
          style={[
            styles.dash,
            {
              width: dashLength,
              backgroundColor: color,
              marginRight: dashGap,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    height: 1,
    marginVertical: spacing.sm,
  },
  dash: {
    height: 1,
  },
});

export const DashedDivider = memo(DashedDividerComponent);
