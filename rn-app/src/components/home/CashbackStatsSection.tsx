/**
 * CashbackStatsSection Component
 * Earned + Potential/yr side-by-side stats with subtitle.
 * Figma Reference: 4109:66469 (Frame 2095586757)
 *
 * - Two columns: EARNED (left) and POTENTIAL/yr (right)
 * - Value: SemiBold/32px/48lh/-1ls/#FF9A6D
 * - Label: Medium/12px/20lh/#A9A9A9
 * - Subtitle: Regular/14px/20lh/#878787
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface CashbackStatsSectionProps {
  earned: number;
  potential: number;
  subtitle?: string;
  /** Rendered after subtitle inside the same gap=12 container (chart goes here) */
  children?: React.ReactNode;
}

function CashbackStatsSectionComponent({
  earned,
  potential,
  subtitle = 'savings on rent so far',
  children,
}: CashbackStatsSectionProps) {
  const formatAmount = (amount: number) =>
    `\u20B9 ${amount.toLocaleString('en-IN')}`;

  return (
    <View style={styles.container}>
      {/* Earned / Potential Row */}
      <View style={styles.statsRow}>
        {/* Left: EARNED */}
        <View style={styles.statColumnLeft}>
          <Text style={styles.statLabel}>EARNED</Text>
          <Text style={styles.statValue}>{formatAmount(earned)}</Text>
        </View>

        {/* Right: POTENTIAL/yr */}
        <View style={styles.statColumnRight}>
          <Text style={[styles.statLabel, styles.textRight]}>POTENTIAL/yr</Text>
          <Text style={[styles.statValue, styles.textRight]}>
            {formatAmount(potential)}
          </Text>
        </View>
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>{subtitle}</Text>

      {/* Chart (rendered inside same gap=12 container per Figma 2095586757) */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12, // Figma: 12px gap between stats row and subtitle
    alignSelf: 'stretch',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16, // Figma: 16px between columns
  },
  statColumnLeft: {
    flex: 1,
    gap: 8, // Figma: 8px between label and value
  },
  statColumnRight: {
    flex: 1,
    gap: 8,
    alignItems: 'flex-end', // Figma: counterAxisAlignItems MAX
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 12, // Figma: 12px
    lineHeight: 20, // Figma: 20px
    letterSpacing: 0, // Figma: 0
    color: colors.neutral[500], // Figma: #A9A9A9
  },
  statValue: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 32,
    lineHeight: 48,
    letterSpacing: -1,
    color: colors.brand[500], // Figma: #FF9A6D
  },
  textRight: {
    textAlign: 'right',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[600], // Figma: #878787
  },
});

export const CashbackStatsSection = memo(CashbackStatsSectionComponent);
