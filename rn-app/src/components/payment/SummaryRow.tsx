/**
 * Summary Row Component
 * Figma: Label-value pairs for payment summaries
 *
 * Typography from Figma analysis:
 * - Label: bodyXs (12px) or bodySm (14px), neutral.600 #878787
 * - Value: bodySmSemibold (14px, 600), neutral.200 #DDDDDD
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from '../ui/Typography';
import { colors, spacing } from '@/src/theme';

// Figma colors from 41-8695 analysis
const FIGMA_COLORS = {
  labelText: '#878787',      // neutral.600 - Rent due text
  valueText: '#DDDDDD',      // neutral.200 - Amount display
  accentText: '#FF9A6D',     // brand.500
  successText: '#70BF73',    // success.default
  errorText: '#FF8080',      // error.default
  mutedText: '#A9A9A9',      // neutral.500
};

export interface SummaryRowProps {
  label: string;
  value: string;
  valueColor?: 'primary' | 'accent' | 'success' | 'error' | 'muted';
  isBold?: boolean;
}

function SummaryRowComponent({
  label,
  value,
  valueColor = 'primary',
  isBold = false,
}: SummaryRowProps) {
  const valueColorMap = {
    primary: FIGMA_COLORS.valueText,
    accent: FIGMA_COLORS.accentText,
    success: FIGMA_COLORS.successText,
    error: FIGMA_COLORS.errorText,
    muted: FIGMA_COLORS.mutedText,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: valueColorMap[valueColor] },
          isBold && styles.bold,
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
    paddingVertical: spacing.xs,
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,     // bodySm per Figma
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,  // neutral.600 #878787
  },
  value: {
    fontFamily: 'PlusJakartaSans-SemiBold',  // bodySmSemibold per Figma
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.valueText,  // neutral.200 #DDDDDD
  },
  bold: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
  },
});

export const SummaryRow = memo(SummaryRowComponent);
