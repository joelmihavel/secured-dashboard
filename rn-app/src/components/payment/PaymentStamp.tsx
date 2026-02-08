/**
 * Payment Stamp Component
 * Figma: Circular stamp for payment status
 *
 * States from Figma analysis:
 * - paid: #06C270 (success.approved) with checkmark
 * - failed: #FF8080 (error) with X
 * - refunded: #A9A9A9 (neutral.500) with return arrow
 * - pending: #A9A9A9 (neutral.500) with hourglass
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Typography';

export type PaymentStampStatus = 'paid' | 'failed' | 'refunded' | 'pending';

export interface PaymentStampProps {
  status: PaymentStampStatus;
  size?: number;
}

// Colors from Figma analysis
const STAMP_CONFIG: Record<PaymentStampStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}> = {
  paid: {
    icon: 'checkmark',
    label: 'PAID',
    color: '#06C270',    // success.approved per 41-9388
  },
  failed: {
    icon: 'close',
    label: 'FAILED',
    color: '#FF8080',    // error per 41-9511
  },
  refunded: {
    icon: 'return-up-back',
    label: 'REFUND',
    color: '#A9A9A9',    // neutral.500 for refunded state
  },
  pending: {
    icon: 'hourglass',
    label: 'PENDING',
    color: '#A9A9A9',    // neutral.500 per 41-9460
  },
};

function PaymentStampComponent({ status, size = 64 }: PaymentStampProps) {
  const config = STAMP_CONFIG[status];
  const innerSize = size - 10;
  const iconSize = size * 0.19;
  const fontSize = size * 0.125;
  const starSize = size * 0.08;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ rotate: '-15deg' }],
        },
      ]}
    >
      {/* Outer dashed circle */}
      <View
        style={[
          styles.outerCircle,
          {
            width: size,
            height: size,
            borderColor: config.color,
          },
        ]}
      />

      {/* Inner circle */}
      <View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderColor: `${config.color}80`,
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Top stars */}
        <View style={styles.starsRow}>
          {[0, 1, 2].map((i) => (
            <Ionicons
              key={`top-${i}`}
              name="star"
              size={starSize}
              color={config.color}
              style={styles.star}
            />
          ))}
        </View>

        {/* Icon */}
        <Ionicons
          name={config.icon}
          size={iconSize}
          color={config.color}
        />

        {/* Label */}
        <Text
          style={[
            styles.label,
            { color: config.color, fontSize },
          ]}
        >
          {config.label}
        </Text>

        {/* Bottom stars */}
        <View style={styles.starsRow}>
          {[0, 1, 2].map((i) => (
            <Ionicons
              key={`bottom-${i}`}
              name="star"
              size={starSize}
              color={config.color}
              style={styles.star}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  innerCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  star: {
    // Style applied via size prop
  },
  label: {
    fontFamily: 'PlusJakartaSans-Bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export const PaymentStamp = memo(PaymentStampComponent);
