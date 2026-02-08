/**
 * Responsive Scaling Utilities
 * Matches iOS DesignScale.swift behavior
 */

import { Dimensions, PixelRatio } from 'react-native';

// Figma design base dimensions (iPhone 14 Pro)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Scale factors relative to base design
export const widthScale = SCREEN_WIDTH / BASE_WIDTH;
export const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;
export const scale = Math.min(widthScale, heightScale);

/**
 * Scale a value proportionally to screen size
 * @param value - Base value from Figma (designed for 393pt width)
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 */
export function scaled(value: number, min?: number, max?: number): number {
  const scaledValue = value * scale;

  if (min !== undefined && scaledValue < min) return min;
  if (max !== undefined && scaledValue > max) return max;

  return PixelRatio.roundToNearestPixel(scaledValue);
}

/**
 * Scale font size with appropriate constraints
 * Prevents fonts from getting too small or too large
 */
export function scaledFont(size: number): number {
  const minSize = size * 0.85;
  const maxSize = size * 1.15;
  return scaled(size, minSize, maxSize);
}

/**
 * Scale spacing value
 */
export function scaledSpacing(value: number): number {
  return scaled(value, value * 0.75, value * 1.25);
}

/**
 * Scale value only on width dimension
 */
export function scaledWidth(value: number): number {
  return PixelRatio.roundToNearestPixel(value * widthScale);
}

/**
 * Scale value only on height dimension
 */
export function scaledHeight(value: number): number {
  return PixelRatio.roundToNearestPixel(value * heightScale);
}

// Device size categories
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH <= 414;
export const isLargeDevice = SCREEN_WIDTH > 414;
export const deviceCategory = isSmallDevice ? 'small' : isLargeDevice ? 'large' : 'medium';

// Screen dimensions
export const screen = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};
