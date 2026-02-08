/**
 * Carousel Dots Component
 * Page indicator dots for onboarding carousel
 *
 * EXACT Figma Values (verified from extraction 1-28985):
 * - Active dot: 8x8px, #FF9A6D (brand/500) - Ellipse 21885
 * - Inactive dot: 8x8px, #202020 (black/500) - Ellipse 21886, 21887
 * - Gap between dots: 4px (Frame 2095586316 layout.gap)
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

// EXACT Figma values from extraction 1-28985 (carousel slide 1)
// Figma Frame 160:2678: gap: 4, 8x8 ellipses
// Active: #FF9A6D (Ellipse 21885), Inactive: #202020 (Ellipse 21886, 21887)
const FIGMA_DOTS = {
  size: 8,
  gap: 4,                     // Figma layout.gap: 4 from Frame 2095586316
  activeColor: '#FF9A6D',     // brand/500 - Figma: Ellipse 21885
  inactiveColor: '#202020',   // black/500 - Figma: Ellipse 21886, 21887 (was #4D4D4D)
} as const;

export interface CarouselDotsProps {
  count: number;
  activeIndex: number;
}

function CarouselDotsComponent({ count, activeIndex }: CarouselDotsProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <Dot key={index} isActive={index === activeIndex} />
      ))}
    </View>
  );
}

interface DotProps {
  isActive: boolean;
}

function Dot({ isActive }: DotProps) {
  return (
    <View
      style={[
        styles.dot,
        isActive ? styles.dotActive : styles.dotInactive,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FIGMA_DOTS.gap,
  },
  dot: {
    width: FIGMA_DOTS.size,
    height: FIGMA_DOTS.size,
    borderRadius: FIGMA_DOTS.size / 2,
  },
  dotActive: {
    backgroundColor: FIGMA_DOTS.activeColor,
  },
  dotInactive: {
    backgroundColor: FIGMA_DOTS.inactiveColor,
  },
});

export const CarouselDots = memo(CarouselDotsComponent);
