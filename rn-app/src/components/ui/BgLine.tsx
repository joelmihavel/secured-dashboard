/**
 * BgLine — Shared decorative background grid vector
 * Figma Reference: 768:303932 (bg_line / Vector 45)
 *
 * Canonical vector path from Figma:
 * - Left vertical: x=36.7794, 0 → 234.544
 * - Bottom horizontal: y=197.765, 0 → 369
 * - Right vertical: x=339.456, 0 → 234.544
 * - Stroke: #4D4D4D, width 0.301471
 * - ViewBox: 0 0 369 234.544
 *
 * Used behind receipt cards and decorative areas across:
 * - Payment confirm receipt
 * - Payment confirmation
 * - Payment status (success/pending/failed/refunded)
 * - Home screen (behind flip card)
 */

import React, { memo } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface BgLineProps {
  style?: StyleProp<ViewStyle>;
  /** Override stroke color (default: #4D4D4D) */
  color?: string;
  /** Override stroke width (default: 0.301471) */
  strokeWidth?: number;
}

function BgLineComponent({ style, color = '#4D4D4D', strokeWidth = 0.301471 }: BgLineProps) {
  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 369 234.544" fill="none" preserveAspectRatio="none">
        <Path
          d="M36.7794 0V234.544M0 197.765H369M339.456 0V234.544"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 369,
    height: 235,
  },
});

export const BgLine = memo(BgLineComponent);
