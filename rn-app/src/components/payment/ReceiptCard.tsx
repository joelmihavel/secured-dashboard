/**
 * Receipt Card Component
 * Figma: Receipt-style card with ticket cutout edges
 *
 * From Figma analysis 41-9388, 41-9460, 41-9511:
 * - Card background: #202020 (black.500 - Rectangle 136)
 * - Cutout background: #131313 (black.700 - screen bg)
 * - Border radius: 16px
 * - Cutout size: 20x40px semicircle
 */

import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { spacing } from '@/src/theme';

// Figma colors
const FIGMA_COLORS = {
  cardBg: '#202020',       // black.500 - Rectangle 136
  screenBg: '#131313',     // black.700 - screen background
};

export interface ReceiptCardProps {
  children: ReactNode;
  style?: ViewStyle;
}

function ReceiptCardComponent({ children, style }: ReceiptCardProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Left ticket cutout */}
      <View style={[styles.cutout, styles.cutoutLeft]}>
        <View style={styles.cutoutCircle} />
      </View>

      {/* Right ticket cutout */}
      <View style={[styles.cutout, styles.cutoutRight]}>
        <View style={styles.cutoutCircle} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const CUTOUT_SIZE = 20; // 20px width, 40px height (semicircle)

const styles = StyleSheet.create({
  container: {
    backgroundColor: FIGMA_COLORS.cardBg,  // black.500 #202020
    borderRadius: 16,  // Per Figma
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    padding: spacing.lg,
  },
  cutout: {
    position: 'absolute',
    top: '50%',
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE * 2,
    marginTop: -CUTOUT_SIZE,
    overflow: 'hidden',
    zIndex: 1,
  },
  cutoutLeft: {
    left: -CUTOUT_SIZE / 2,
  },
  cutoutRight: {
    right: -CUTOUT_SIZE / 2,
  },
  cutoutCircle: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE * 2,
    borderRadius: CUTOUT_SIZE,
    backgroundColor: FIGMA_COLORS.screenBg,  // black.700 #131313
  },
});

export const ReceiptCard = memo(ReceiptCardComponent);
