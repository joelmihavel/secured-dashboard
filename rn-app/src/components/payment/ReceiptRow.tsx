/**
 * Receipt Row Component
 * Figma: Label-value row for receipt details
 *
 * From 41-9388 (Success), 243-6731 (Transaction Detail) analysis:
 * - Hash: brand.500 #FF9A6D
 * - Label: neutral.600 #878787 (bodyXs)
 * - Value: neutral.300 #CBCBCB (bodySmSemibold)
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '../ui/Typography';
import { spacing } from '@/src/theme';

// Figma colors
const FIGMA_COLORS = {
  hashColor: '#FF9A6D',     // brand.500
  labelText: '#878787',     // neutral.600
  valueText: '#CBCBCB',     // neutral.300
  highlightValue: '#FFFFFF', // white for total
};

export interface ReceiptRowProps {
  label: string;
  value: string;
  isHighlighted?: boolean;
  valueColor?: string;
}

function ReceiptRowComponent({
  label,
  value,
  isHighlighted = false,
  valueColor,
}: ReceiptRowProps) {
  return (
    <View style={styles.container}>
      {/* Label with # prefix */}
      <View style={styles.labelContainer}>
        <Text style={styles.hash}>#</Text>
        <Text style={[styles.label, isHighlighted && styles.labelHighlighted]}>
          {label}
        </Text>
      </View>

      {/* Value */}
      <Text
        style={[
          styles.value,
          isHighlighted && styles.valueHighlighted,
          valueColor ? { color: valueColor } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hash: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.hashColor,  // brand.500 #FF9A6D
    marginRight: spacing.xxs,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,  // neutral.600 #878787
  },
  labelHighlighted: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans-Medium',
    color: FIGMA_COLORS.highlightValue,
  },
  value: {
    fontFamily: 'PlusJakartaSans-SemiBold',  // bodySmSemibold per Figma
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.valueText,  // neutral.300 #CBCBCB
  },
  valueHighlighted: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: FIGMA_COLORS.highlightValue,
  },
});

export const ReceiptRow = memo(ReceiptRowComponent);
