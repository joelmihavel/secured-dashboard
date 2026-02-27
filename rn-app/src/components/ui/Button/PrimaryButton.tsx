/**
 * Primary Button Component
 * Figma Node: I1:28069;100:1564 (active state from splash screen)
 *
 * FRESH Figma REST API Values (fetched 2026-02-13 from node 1-28068):
 *
 * ACTIVE STATE (Frame 2095586312):
 * - Size: 297x56, layoutSizingHorizontal: FILL, layoutSizingVertical: HUG
 * - Fill: LINEAR_GRADIENT vertical — #202020 (pos 0) → #0D0D0D (pos 1.0), handle y=0.9018
 * - Stroke: #FF9A6D, strokeWeight: 0.1px, strokeAlign: INSIDE
 * - Corner radius: 8px
 * - Padding: 16px all sides
 * - Effects:
 *   1. DROP_SHADOW: rgba(153,92,65,0.24), offset(0,6), blur 12, spread -2
 *   2. INNER_SHADOW (visible): rgba(255,255,255,0.12), offset(0,-3), blur 4, spread 1
 *   3. INNER_SHADOW (hidden): skip
 *   4. INNER_SHADOW (visible): rgba(0,0,0,1), offset(-2,-4), blur 0, spread 1
 * - Text: Plus Jakarta Sans Medium 500, 16px, lineHeight 24px, #FFFFFF
 *
 * BUTTON INSTANCE (1:28069):
 * - Layout: VERTICAL, counterAxisAlignItems: CENTER, itemSpacing: 8
 * - Width: 297 (FIXED), cornerRadius: 12
 * - Divider (Rectangle 140): 24x2, #4D4D4D, cornerRadius 200
 *
 * DISABLED STATE:
 * - bg: #202020, border: 1px #202020, radius 12px, padding 16px
 * - Text: PlusJakartaSans-Medium 16px/24px #444444
 */

import React, { memo, useCallback } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet, ViewStyle, Text as RNText } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  interpolateColor,
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
  const pressed = useSharedValue(0);
  const isDisabled = disabled || loading;

  // 3D press: button sinks down, shadow disappears, inner shadow appears
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(pressed.value, [0, 1], [0, 2], Extrapolation.CLAMP) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.985], Extrapolation.CLAMP) },
    ],
    // Shadow completely disappears when pressed deeply
    shadowOffset: {
      width: 0,
      height: interpolate(pressed.value, [0, 1], [4, 0], Extrapolation.CLAMP),
    },
    shadowRadius: interpolate(pressed.value, [0, 1], [5, 0], Extrapolation.CLAMP),
    shadowOpacity: interpolate(pressed.value, [0, 1], [0.24, 0], Extrapolation.CLAMP),
  }));

  // Bottom highlight dims when pressed (light source effect)
  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.value,
      [0, 1],
      [colors.black[400], colors.brand[500]] // #4D4D4D -> #FF9A6D
    )
  }));

  // Unpressed state overlays (bottom shadow & highlight) disappear when pressed
  const unpressedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }));

  // Deep press overlay (top inner shadow) appears when pressed
  const deepPressOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // Bottom highlight shifts down to the very edge when the dark edge fades out
  const bottomHighlightAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(pressed.value, [0, 1], [0, 5], Extrapolation.CLAMP) }]
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
      {/* Outer container: Figma VERTICAL, CENTER, gap 8, radius 12 */}
      <View style={styles.container}>
        {/* Divider: Figma Rectangle 140 — 24x2 #4D4D4D radius 200 */}
        {showDivider && <Animated.View style={[styles.divider, dividerAnimatedStyle]} />}

        {disabled && !loading ? (
          <View style={styles.buttonDisabled}>
            <RNText style={styles.textDisabled}>{title}</RNText>
          </View>
        ) : (
          /* ACTIVE STATE — 3D button with gradient, glow border, inner shadows */
          <Animated.View style={[styles.shadowHost, buttonAnimatedStyle]}>
            {/* Main button face container */}
            <View style={styles.buttonFace}>

              {/* Unpressed Gradient Background */}
              <LinearGradient
                colors={['#202020', '#0d0d0d']}
                locations={[0, 0.9018]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Pressed Dark Matte Background */}
              <Animated.View style={[styles.pressedDarkBackground, deepPressOverlayStyle]} />

              {/* Unpressed Glow Border Overlay */}
              <Animated.View style={[styles.glowBorder, unpressedOverlayStyle]} pointerEvents="none" />

              {/* Inner shadow simulation: bottom white highlight for 3D depth */}
              <Animated.View style={[styles.bottomHighlight, bottomHighlightAnimatedStyle]} pointerEvents="none">
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.12)']}
                  locations={[0, 0.4, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.bottomHighlightGradient}
                />
              </Animated.View>

              {/* Raised Dark Edge (Unpressed) */}
              <Animated.View style={[styles.darkEdgeOverlay, unpressedOverlayStyle]} pointerEvents="none" />

              {/* Deep Press Inner Shadow (Pressed) */}
              <Animated.View style={[StyleSheet.absoluteFill, deepPressOverlayStyle]} pointerEvents="none">
                {/* Sharp dark rim for the physical edge */}
                <View style={styles.pressedInnerRim} />
                {/* Soft gradient shadow for depth */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.8)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.pressedTopShadow}
                />
              </Animated.View>

              {/* Text */}
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <RNText style={styles.textActive}>{title}</RNText>
              )}
            </View>
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
  // Figma button instance: VERTICAL, CENTER, gap 8
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  // Figma Rectangle 140: 24x2 #4D4D4D radius 200
  divider: {
    width: 24,
    height: 2,
    backgroundColor: colors.black[400], // #4D4D4D
    borderRadius: 200,
  },

  // DISABLED STATE — Figma: flat #202020, border #202020, radius 12
  buttonDisabled: {
    width: '100%',
    backgroundColor: colors.black[500],
    borderWidth: 1,
    borderColor: colors.black[500],
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Drop shadow host — Figma: rgba(153,92,65,0.24) offset(0,6) blur 12 spread -2
  // RN doesn't support spread, so we use slightly reduced shadowRadius
  shadowHost: {
    width: '100%',
    shadowColor: '#995C41',
    shadowOffset: { width: 0, height: 4 }, // Reduced offset to account for negative spread
    shadowOpacity: 0.24,
    shadowRadius: 5, // Figma blur 12 / 2.5 to simulate spread -2 tightness
    elevation: 8,
  },

  // Button face — gradient fill + thin orange border
  // Figma: stroke #FF9A6D 0.1px INSIDE, radius 8, padding 16
  buttonFace: {
    width: '100%',
    borderRadius: 8,
    borderCurve: 'continuous',
    // Compensation for 3D depth: push content up and left to center on the raised face
    paddingTop: 16,
    paddingLeft: 16,
    paddingBottom: 16 + 5,
    paddingRight: 16 + 3,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Glow border (orange tint) — only visible when unpressed
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 154, 109, 0.25)',
    borderRadius: 8,
    borderCurve: 'continuous',
  },

  // Bottom highlight — simulates Figma inner shadow:
  // inset 0px -3px 4px 1px rgba(255,255,255,0.12)
  // Gradient fade from transparent → white 12% at the bottom edge
  bottomHighlight: {
    position: 'absolute',
    left: 0,
    right: 3, // Inset from right dark edge
    bottom: 5, // Inset from bottom dark edge! This puts the highlight ON the bevel edge, not covering the black vertical drop
    height: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bottomHighlightGradient: {
    flex: 1,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },

  // Raised dark edge bottom (Unpressed)
  darkEdgeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 5, // Spread 1 + offset 4 = 5px
    borderRightWidth: 3,  // Spread 1 + offset 2 = 3px
    borderColor: '#000000',
    borderRadius: 8,
    borderCurve: 'continuous',
  },

  // Deep press flat dark background
  pressedDarkBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111111',
    borderRadius: 8,
  },

  // Sharp inner rim for pressed state
  pressedInnerRim: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    borderCurve: 'continuous',
  },

  // Soft gradient shadow for depth
  pressedTopShadow: {
    width: '100%',
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },

  // Text — Figma: PlusJakartaSans-Medium 16px/24px #444444
  textDisabled: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: colors.neutral[800], // #444444
    textAlign: 'center',
  },
  // Text — Figma: PlusJakartaSans-Medium 500, 16px/24px #FFFFFF
  // Figma: shrink-0 (natural width), centered by parent items-center + justify-center
  textActive: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    textAlign: 'center',
  },
});

export const PrimaryButton = memo(PrimaryButtonComponent);
