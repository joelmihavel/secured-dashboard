/**
 * Cashback Pill Component
 * Displays cashback amount in a pill-shaped container
 *
 * From Figma 41-9388 analysis:
 * - Text: brand.500 #FF9A6D for applied cashback
 * - Border: brand.500 #FF9A6D
 * - Background: transparent with border
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '../ui/Typography';
import { spacing, radius } from '@/src/theme';

// Figma colors from 41-9388 (Payment Success with cashback)
const FIGMA_COLORS = {
  accentText: '#FF9A6D',    // brand.500
  accentBorder: '#FF9A6D',  // brand.500
  mutedText: '#797979',     // neutral.600 - for incentive text
  successText: '#70BF73',   // success.default
};

export interface CashbackPillProps {
  amount: number;
  label?: string;
  variant?: 'applied' | 'incentive' | 'success';
}

function CashbackPillComponent({
  amount,
  label = 'Cashback',
  variant = 'applied',
}: CashbackPillProps) {
  const getStyles = () => {
    switch (variant) {
      case 'applied':
        return {
          container: styles.containerApplied,
          text: styles.textApplied,
        };
      case 'incentive':
        return {
          container: styles.containerIncentive,
          text: styles.textIncentive,
        };
      case 'success':
        return {
          container: styles.containerSuccess,
          text: styles.textSuccess,
        };
    }
  };

  const variantStyles = getStyles();

  return (
    <View style={[styles.container, variantStyles.container]}>
      <Text style={[styles.label, variantStyles.text]}>{label}</Text>
      <Text style={[styles.amount, variantStyles.text]}>
        ₹{amount.toLocaleString('en-IN')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,  // Pill shape per Figma
    alignSelf: 'flex-start',
  },
  containerApplied: {
    borderWidth: 1,
    borderColor: FIGMA_COLORS.accentBorder,
    backgroundColor: 'transparent', // Figma: transparent bg with brand border only
  },
  containerIncentive: {
    backgroundColor: 'transparent',
  },
  containerSuccess: {
    backgroundColor: FIGMA_COLORS.successText + '20',
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
  },
  textApplied: {
    color: FIGMA_COLORS.accentText,  // brand.500 #FF9A6D
  },
  textIncentive: {
    color: FIGMA_COLORS.mutedText,   // neutral.600 #797979
  },
  textSuccess: {
    color: FIGMA_COLORS.successText, // success.default #70BF73
  },
  amount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 20,
  },
});

export const CashbackPill = memo(CashbackPillComponent);
