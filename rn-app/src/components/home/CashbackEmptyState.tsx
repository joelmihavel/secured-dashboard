/**
 * CashbackEmptyState Component
 * Shows empty cashback state with accrued info
 * Figma Reference: 243-6296
 *
 * Figma Pixel-Perfect Values:
 * - Container: paddingHorizontal 32, paddingVertical 24, gap 12
 * - Section label: "CASHBACK ACCRUED", fontSize 12, fontWeight 500, lineHeight 20, color #A9A9A9, letterSpacing 0.5
 * - Accrued amount: fontSize 20, fontWeight 500, color #A9A9A9
 * - Accent dot: width 12, height 12, borderRadius 6, backgroundColor #FF9A6D
 * - Stat label: fontSize 14, lineHeight 20, color #BABABA
 * - Stat value: fontSize 14, color #A9A9A9
 * - Stat value accent: fontSize 14, color #FF9A6D
 * - Empty avatar outer: width 64, height 64, borderRadius 32, backgroundColor #1A1A1A
 * - Empty avatar inner: width 48, height 48, borderRadius 24, backgroundColor #FF9A6D
 * - Placeholder title: fontSize 14, fontWeight 500, lineHeight 20, color #FFFFFF
 * - Placeholder text: fontSize 12, fontWeight 400, lineHeight 20, color #878787
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '@/src/components/ui';

export interface CashbackEmptyStateProps {
  accruedAmount?: number;
  allTimeTotal?: number;
  cashbackRate?: number;
}

function CashbackEmptyStateComponent({
  accruedAmount = 0,
  allTimeTotal = 0,
  cashbackRate = 0.8,
}: CashbackEmptyStateProps) {
  const formatAmount = (amount: number) => {
    if (amount === 0) return '0.00';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <View style={styles.container}>
      {/* Cashback Accrued Label */}
      <Text style={styles.sectionLabel}>CASHBACK ACCRUED</Text>

      {/* Accrued Amount with Orange Circle */}
      <View style={styles.accruedRow}>
        <View style={styles.accentDot} />
        <Text style={styles.accruedAmount}>
          <Text style={styles.accruedRupee}>{'₹ '}</Text>
          <Text style={styles.accruedValue}>{formatAmount(accruedAmount)}</Text>
        </Text>
      </View>

      {/* Stats Rows */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>All-time Total</Text>
          <Text style={styles.statValue}>{'₹ '}{formatAmount(allTimeTotal)}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Cashback Rate</Text>
          <Text style={styles.statValueAccent}>{cashbackRate}% Avg</Text>
        </View>
      </View>

      {/* Empty state illustration */}
      <View style={styles.emptyIllustration}>
        <View style={styles.avatarOuter}>
          <View style={styles.avatarInner} />
        </View>
      </View>

      {/* Empty state text */}
      <Text style={styles.placeholderTitle}>No Cashback Yet</Text>
      <Text style={styles.placeholderText}>
        Start spending to earn cashback on your{'\n'}
        everyday purchases.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: 32px exact
    paddingVertical: 24, // Figma: 24px
    gap: 12, // Figma: 12px gap between sections
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
    letterSpacing: 0.5, // Figma: letterSpacing 0.5
  },
  accruedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Figma: 8px gap
  },
  accentDot: {
    width: 12, // Figma: width 12
    height: 12, // Figma: height 12
    borderRadius: 6, // Figma: fully rounded
    backgroundColor: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
  accruedAmount: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 20, // Figma: fontSize 20
    fontWeight: '500', // Figma: fontWeight 500
  },
  accruedRupee: {
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
  },
  accruedValue: {
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
  },
  statsContainer: {
    marginTop: 16, // Figma: 16px gap
    gap: 12, // Figma: 12px gap between stat rows
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#BABABA', // Figma: #BABABA (neutral[400])
    textAlign: 'left', // Figma: left-aligned label in space-between row
  },
  statValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
    textAlign: 'right', // Figma: right-aligned value
  },
  statValueAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    textAlign: 'right', // Figma: right-aligned value
  },
  emptyIllustration: {
    alignItems: 'center',
    marginTop: 32, // Figma: 32px gap before illustration
    marginBottom: 16, // Figma: 16px gap after illustration
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
  placeholderTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF (white)
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: fontSize 12
    fontWeight: '400', // Figma: fontWeight 400
    lineHeight: 20, // Figma: lineHeight 20
    color: '#878787', // Figma: #878787 (neutral[600])
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
});

export const CashbackEmptyState = memo(CashbackEmptyStateComponent);
