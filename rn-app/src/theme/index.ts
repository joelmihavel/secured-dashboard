/**
 * Unified Theme Export
 * Single source of truth for all design tokens
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radius';
export * from './shadows';
export * from './scale';
export * from './animations';

// Re-export combined theme object
import { colors, semanticColors, gradients, opacity } from './colors';
import { typography, fontFamily } from './typography';
import { spacing, layout } from './spacing';
import { radius, borderRadius } from './radius';
import { shadows, applyShadow } from './shadows';
import { scaled, scaledFont, scaledSpacing, widthScale, heightScale, screen } from './scale';
import { duration, springConfig, timingConfig, animationValues } from './animations';

export const theme = {
  colors,
  semanticColors,
  gradients,
  opacity,
  typography,
  fontFamily,
  spacing,
  layout,
  radius,
  borderRadius,
  shadows,
  applyShadow,
  scale: {
    scaled,
    scaledFont,
    scaledSpacing,
    widthScale,
    heightScale,
  },
  screen,
  animation: {
    duration,
    springConfig,
    timingConfig,
    animationValues,
  },
} as const;

export type Theme = typeof theme;
