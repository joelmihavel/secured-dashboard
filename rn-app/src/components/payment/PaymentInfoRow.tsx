/**
 * Payment Info Row Component
 * Figma: Icon + text info row for payment status messages
 *
 * From 41-9460 (Processing), 41-9511 (Failed) analysis:
 * - Text: neutral.500 #A9A9A9 (bodyXs)
 * - Icon: uses passed iconColor
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Typography';
import { spacing } from '@/src/theme';

// Figma colors
const INFO_TEXT_COLOR = '#A9A9A9'; // neutral.500 per Figma analysis

export interface PaymentInfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  text: string;
}

function PaymentInfoRowComponent({ icon, iconColor, text }: PaymentInfoRowProps) {
  return (
    <View style={styles.container}>
      <Ionicons
        name={icon}
        size={20}
        color={iconColor}
        style={styles.icon}
      />
      <Text style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,  // Figma spacing
  },
  icon: {
    width: 24,
  },
  text: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma
    lineHeight: 20,
    color: INFO_TEXT_COLOR,  // neutral.500 #A9A9A9
  },
});

export const PaymentInfoRow = memo(PaymentInfoRowComponent);
