/**
 * Design System Animation Constants
 * Timing and easing curves for consistent animations
 */

import { Easing } from 'react-native';

// Duration constants (in milliseconds)
export const duration = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
} as const;

// Spring configurations for react-native-reanimated
export const springConfig = {
  // Snappy - for buttons and small interactions
  snappy: {
    damping: 15,
    stiffness: 400,
    mass: 1,
  },
  // Gentle - for page transitions
  gentle: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  // Bouncy - for playful feedback
  bouncy: {
    damping: 10,
    stiffness: 300,
    mass: 1,
  },
  // Stiff - for quick snaps
  stiff: {
    damping: 20,
    stiffness: 500,
    mass: 1,
  },
} as const;

// Timing configurations
export const timingConfig = {
  // Standard ease
  standard: {
    duration: duration.normal,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  // Enter screen
  enter: {
    duration: duration.slow,
    easing: Easing.bezier(0, 0, 0.2, 1),
  },
  // Exit screen
  exit: {
    duration: duration.fast,
    easing: Easing.bezier(0.4, 0, 1, 1),
  },
  // Fade
  fade: {
    duration: duration.fast,
    easing: Easing.linear,
  },
} as const;

// Common animation values
export const animationValues = {
  buttonScale: {
    pressed: 0.96,
    default: 1,
  },
  opacity: {
    pressed: 0.9,
    disabled: 0.5,
    default: 1,
  },
} as const;

// CSS Transition defaults (Reanimated 4)
export const cssTransition = {
  fast: { transitionDuration: '150ms' },
  normal: { transitionDuration: '250ms' },
  slow: { transitionDuration: '350ms' },
} as const;

// Entering animation presets (Reanimated layout animations)
// Usage: <Animated.View entering={enteringPresets.staggerItem(index)}>
export { FadeIn, FadeInDown, FadeInUp, FadeInRight } from 'react-native-reanimated';
export const enteringPresets = {
  staggerDelay: 80,
  staggerDuration: 350,
  fadeInDuration: 300,
  slideUpDuration: 300,
} as const;

export type DurationKey = keyof typeof duration;
export type SpringConfigKey = keyof typeof springConfig;
export type TimingConfigKey = keyof typeof timingConfig;
