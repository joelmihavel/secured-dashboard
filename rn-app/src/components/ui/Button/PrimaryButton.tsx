/**
 * Primary Button Component
 * Figma Node: 1:31151 (active), 1:81 (disabled)
 *
 * CORRECT Figma Values from get_design_context (node 1:31151):
 *
 * ACTIVE STATE:
 * - Container: flex-col, gap-8px, items-center, p-0, rounded-12px, w-297px
 * - Divider above: 24x2px, #4d4d4d, rounded-200px
 * - Button body: DARK vertical gradient from #202020 to #0d0d0d (90.179%)
 * - Border: 0.1px solid #ff9a6d (thin orange border)
 * - Border radius: 8px
 * - Padding: 16px
 * - Drop shadow: 0px 6px 12px -2px rgba(153,92,65,0.24)
 * - Inner shadows: inset -2px -4px 0px 1px black, inset 0px -3px 4px 1px rgba(255,255,255,0.12)
 * - Text: Plus Jakarta Sans Medium, 16px, line-height 24px, white
 *
 * DISABLED STATE (node 1:81):
 * - bg: #202020 (black/500)
 * - border: 1px solid #202020
 * - padding: 16px (all sides)
 * - radius: 12px
 * - Text: Plus Jakarta Sans Medium, 16px, line-height 24px, #444444
 *
 * 3D PRESS ANIMATION:
 * - On press: translateY increases (button moves down into shadows)
 * - On press: inner shadows become more prominent
 * - Spring back on release (like mechanical keyboard)
 */

import React, { memo, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet, ViewStyle, Text as RNText } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { colors, gradients, spacing } from '@/src/theme';

export interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  showDivider?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Token Mapping from Figma to Theme:
 * - var(--colours/black/500,#202020) → colors.black[500]
 * - var(--colours/black/800,#0d0d0d) → colors.black[800]
 * - var(--colours/brand/500,#ff9a6d) → colors.brand[500]
 * - var(--colours/neutral/800,#444444) → colors.neutral[800]
 * - var(--colours/black/400,#4d4d4d) → colors.black[400]
 * - var(--spacing/sp-16,16px) → spacing.md
 * - var(--spacing/sp-8,8px) → spacing.xs
 * - var(--radius/rd-8,8px) → 8
 * - var(--radius/rd-12,12px) → 12
 */
const TOKENS = {
  // Disabled state - Figma: var(--colours/black/500)
  bgDisabled: colors.black[500],
  borderDisabled: colors.black[500],
  textDisabled: colors.neutral[800],
  // Active state - Figma: gradient from var(--colours/black/500) to var(--colours/black/800)
  gradientColors: gradients.button.colors,
  gradientLocations: gradients.button.locations,
  borderActive: colors.brand[500],
  textActive: colors.white,
  // Divider - Figma: var(--colours/black/400)
  divider: colors.black[400],
  // Spacing
  padding: spacing.md,
  gap: spacing.xs,
  // Radius
  radiusOuter: 12,
  radiusInner: 8,
} as const;

// Animation constants for 3D mechanical keyboard effect
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

function PrimaryButtonComponent({
  title,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = true,
  showDivider = false,
  style,
  testID,
}: PrimaryButtonProps) {
  // Animation value: 0 = normal, 1 = pressed
  const pressed = useSharedValue(0);

  const isDisabled = disabled || loading;

  // Button press animation - moves down and enhances shadows
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(pressed.value, [0, 1], [0, 3], Extrapolation.CLAMP) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.98], Extrapolation.CLAMP) },
    ],
  }));

  // Inner shadow becomes more prominent when pressed
  const innerShadowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 1.5], Extrapolation.CLAMP),
  }));

  // Bottom highlight fades when pressed (button sinks into surface)
  const bottomHighlightAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.3], Extrapolation.CLAMP),
  }));

  const handlePressIn = useCallback(() => {
    if (isDisabled) return;
    pressed.value = withSpring(1, SPRING_CONFIG);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isDisabled, pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [pressed]);

  const handlePress = useCallback(() => {
    if (!isDisabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [isDisabled, onPress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={title}
      style={[styles.pressable, fullWidth && styles.fullWidth, style]}
    >
      {/* Container: Figma gap-8px items-center */}
      <View style={styles.container}>
        {/* Divider above button: Figma 24x2px #4d4d4d rounded-200px */}
        {showDivider && <View style={styles.divider} />}

        {isDisabled ? (
          /* DISABLED STATE - Figma: flat button with 16px padding */
          <View style={styles.buttonDisabled}>
            {loading ? (
              <ActivityIndicator color={TOKENS.textDisabled} size="small" />
            ) : (
              <RNText style={styles.textDisabled}>{title}</RNText>
            )}
          </View>
        ) : (
          /* ACTIVE STATE - Dark gradient with orange border and 3D depth */
          <Animated.View style={[styles.buttonActiveWrapper, buttonAnimatedStyle]}>
            <LinearGradient
              colors={[...TOKENS.gradientColors]}
              locations={[...TOKENS.gradientLocations]}
              start={gradients.button.start}
              end={gradients.button.end}
              style={styles.buttonActive}
            >
              {loading ? (
                <ActivityIndicator color={TOKENS.textActive} size="small" />
              ) : (
                <RNText style={styles.textActive}>{title}</RNText>
              )}

              {/* Inner shadow: inset -2px -4px 0px 1px black (bottom-right dark) */}
              <Animated.View style={[styles.innerShadowDark, innerShadowAnimatedStyle]} />

              {/* Inner shadow: inset 0px -3px 4px 1px rgba(255,255,255,0.12) (bottom highlight) */}
              <Animated.View style={[styles.innerShadowLight, bottomHighlightAnimatedStyle]} />
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  // Figma: flex-col gap-8px items-center p-0 rounded-12px w-297px
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  // Figma: 24x2px #4d4d4d rounded-200px
  divider: {
    width: 24,
    height: 2,
    backgroundColor: TOKENS.divider,
    borderRadius: 200,
  },

  // DISABLED: Figma bg-[#202020] border-[#202020] p-[16px] rounded-[12px]
  buttonDisabled: {
    width: '100%',
    backgroundColor: TOKENS.bgDisabled,
    borderWidth: 1,
    borderColor: TOKENS.borderDisabled,
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ACTIVE wrapper with drop shadow
  buttonActiveWrapper: {
    width: '100%',
    // Figma: shadow-[0px_6px_12px_-2px_rgba(153,92,65,0.24)]
    shadowColor: 'rgb(153, 92, 65)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },

  // ACTIVE: Figma dark gradient #202020 → #0d0d0d, border 0.1px #ff9a6d, radius 8px, p-16px
  buttonActive: {
    width: '100%',
    borderWidth: 0.5, // 0.1px doesn't render well, use 0.5px
    borderColor: TOKENS.borderActive,
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Figma: inset -2px -4px 0px 1px black (dark shadow at bottom-right)
  // Simulated with border since RN doesn't support inset shadows
  innerShadowDark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: -2, // offset x: -2px
    bottom: -4, // offset y: -4px
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 1)', // spread: 1px, black
    backgroundColor: 'transparent',
  },

  // Figma: inset 0px -3px 4px 1px rgba(255,255,255,0.12) (subtle bottom highlight)
  // Creates a soft glow at the bottom edge for 3D depth
  innerShadowLight: {
    position: 'absolute',
    left: 1,
    right: 1,
    bottom: 1,
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    // Blur effect approximation
    opacity: 0.8,
  },

  // Text styles - Figma: text-center
  textDisabled: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: TOKENS.textDisabled,
    textAlign: 'center',
    width: '100%', // Ensures center alignment works
  },
  // Figma: font-['Plus_Jakarta_Sans:Medium'] font-medium (500 weight, NOT SemiBold!)
  textActive: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: TOKENS.textActive,
    textAlign: 'center',
    width: '100%', // Ensures center alignment works
  },
});

export const PrimaryButton = memo(PrimaryButtonComponent);
