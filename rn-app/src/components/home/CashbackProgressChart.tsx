/**
 * CashbackProgressChart Component
 * 12-bar ascending chart showing cashback earnings over months.
 * Figma Reference: 4109:66469 (Frame 2095586714)
 *
 * - Container: horizontal, gap=2, height=40, bars bottom-aligned
 * - 12 bars: flex=1, r=200, ascending heights [5..40]
 * - Colors: earned=#FF9A6D, missed=#E5484D, future=#4D4D4D
 *
 * Each bar represents one month of the lease year. As each month passes
 * and gets a stamp (on_time / late / missed), the corresponding bar
 * picks up a colour. Months not yet reached stay 'future' (gray).
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/src/theme';

import type { BarStatus } from '@/src/services/api/dashboard';
export type { BarStatus };

export interface CashbackProgressChartProps {
  /** Array of 12 bar statuses, oldest → newest. Defaults to all 'future'. */
  bars?: BarStatus[];
}

const BAR_HEIGHTS = [5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40];

const BAR_COLORS: Record<BarStatus, string> = {
  earned: colors.brand[500], // Figma: #FF9A6D
  missed: colors.error.radix, // Figma: #E5484D
  future: colors.black[400], // Figma: #4D4D4D
};

const DEFAULT_BARS: BarStatus[] = Array(12).fill('future');

function CashbackProgressChartComponent({ bars = DEFAULT_BARS }: CashbackProgressChartProps) {
  return (
    <View style={styles.container}>
      {BAR_HEIGHTS.map((height, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height,
              backgroundColor: BAR_COLORS[bars[index] ?? 'future'],
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
    alignItems: 'flex-end', // Figma: counterAxisAlignItems MAX (bottom-aligned)
    height: 40, // Figma: 40px chart area
    gap: 2, // Figma: 2px between bars
    alignSelf: 'stretch',
  },
  bar: {
    flex: 1, // Figma: FILL (flex grow=1)
    borderRadius: 200, // Figma: pill shape
  },
});

export const CashbackProgressChart = memo(CashbackProgressChartComponent);
