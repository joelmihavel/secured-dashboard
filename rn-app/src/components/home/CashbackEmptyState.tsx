/**
 * CashbackEmptyState Component
 * Shows empty cashback state with accrued info
 * Figma Reference: 243-5870
 *
 * Figma Pixel-Perfect Values:
 * - Container: paddingHorizontal 32, paddingTop 16, gap 16
 * - Section label: "CASHBACK ACCRUED", fontSize 12, fontWeight 500, lineHeight 20, color #A9A9A9
 * - Accrued amount: 3-part text (₹ 14px #444, 325 32px #FF9A6D, .00 14px #444)
 * - Dividers: height 1px (or hairlineWidth), color #1A1A1A (or #2B2B2B)
 * - Stat label: fontSize 14, lineHeight 20, color #DDDDDD
 * - Stat value: fontSize 16, lineHeight 24, color #FF9A6D
 * - Stat value decimals/avg: fontSize 14, color #444444
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/src/components/ui';

export interface CashbackEmptyStateProps {
  accruedAmount?: number;
  allTimeTotal?: number;
  cashbackRate?: number;
  showPlaceholder?: boolean;
}

const Divider = () => (
  <View style={styles.dividerContainer}>
    <Svg width="100%" height="1" viewBox="0 0 100 1" preserveAspectRatio="none">
      <Path d="M0 0.5H100" stroke="#1A1A1A" strokeWidth="1" />
    </Svg>
  </View>
);

function CashbackEmptyStateComponent({
  accruedAmount = 0,
  allTimeTotal = 0,
  cashbackRate = 0.8,
  showPlaceholder = true,
}: CashbackEmptyStateProps) {
  const formatInteger = (amount: number) => {
    return Math.floor(amount).toLocaleString('en-IN');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        {/* Cashback Accrued Label */}
        <Text style={styles.sectionLabel}>CASHBACK ACCRUED</Text>

        {/* Accrued Amount */}
        <Text style={styles.accruedContainer}>
          <Text inherit style={styles.currencySymbol}>₹  </Text>
          <Text inherit style={styles.accruedValue}>{formatInteger(accruedAmount)}</Text>
          <Text inherit style={styles.currencySymbol}>.00</Text>
        </Text>
      </View>

      <Divider />

      {/* All-time Total Row */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>All-time Total</Text>
        <Text style={styles.statValueContainer}>
          <Text inherit style={styles.currencySymbol}>₹  </Text>
          <Text inherit style={styles.statValue}>{formatInteger(allTimeTotal)}</Text>
          <Text inherit style={styles.currencySymbol}>.00</Text>
        </Text>
      </View>

      <Divider />

      {/* Cashback Rate Row */}
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Cashback Rate</Text>
        <Text style={styles.statValueContainer}>
          <Text inherit style={styles.statValue}>{cashbackRate}% </Text>
          <Text inherit style={styles.currencySymbol}>Avg</Text>
        </Text>
      </View>

      {showPlaceholder && (
        <>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32, // Figma: 32px exact
    paddingTop: 8,
    gap: 16,
    alignSelf: 'stretch', // Ensure full width in centered parent
  },
  topSection: {
    gap: 16,
    alignItems: 'flex-start',
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
  },
  accruedContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#444444', // Figma: #444444 (neutral[800])
  },
  accruedValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32,
    lineHeight: 48,
    letterSpacing: -1,
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
  dividerContainer: {
    height: 1,
    width: '100%',
    marginVertical: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#DDDDDD', // Figma: #DDDDDD (neutral[200])
    textAlign: 'left',
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#FF9A6D', // Figma: #FF9A6D (brand[500])
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
    fontFamily: 'PlusJakartaSans-Medium', // Figma: fontWeight 500
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF (white)
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 20, // Figma: lineHeight 20
    color: '#878787', // Figma: #878787 (neutral[600])
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
});

export const CashbackEmptyState = memo(CashbackEmptyStateComponent);
