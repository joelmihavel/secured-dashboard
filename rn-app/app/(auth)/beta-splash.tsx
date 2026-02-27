/**
 * Beta Splash Screen
 * Figma Node: 1-28071 (Splash / get-started --animation 2)
 *
 * PIXEL-PERFECT Figma Values:
 * - Background: #131313 (black.700)
 * - Dotted pattern: 8% opacity, no background shape
 * - Logo Container (176:2750): 33.375x40px at y=406 in 852-height frame
 *   -> vertically centered (center at y=426 = 50% of 852)
 *   -> constraints: horizontal CENTER, vertical CENTER
 * - Badge Frame (176:2752): HUG content, at y=458
 *   -> background #FF9A6D (brand.500), borderRadius 4px (radius.xs)
 *   -> padding: 8px horizontal (spacing.xs), 4px vertical (spacing.xxs)
 *   -> layout: row, justifyContent center, alignItems center, gap 10
 *   -> constraints: horizontal CENTER
 * - Badge Text (176:2753): "BETA LAUNCH"
 *   -> fontSize 12, lineHeight 20, fontFamily PlusJakartaSans-Medium
 *   -> letterSpacing -0.2, color #000000, textAlign center
 * - Logo-to-badge gap: 12px (458 - 446 = 12)
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import { Screen, Logo, Text, DottedGridPattern } from '@/src/components';
import { colors, duration, spacing, radius } from '@/src/theme';

// Exact Figma color values mapped to theme tokens
const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  badgeBackground: colors.brand[500],  // #FF9A6D
  badgeText: colors.black[900],        // #000000
} as const;

// Exact Figma dimensions (from blueprint 1-28071)
const FIGMA_DIMENSIONS = {
  // Logo Container (176:2750): 33.375 x 40px
  logoHeight: 40,
  // Gap: Logo bottom (y=406+40=446) to Badge top (y=458) = 12px
  logoToBadgeGap: 12,
} as const;

export default function BetaSplashScreen() {
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const badgeOpacity = useSharedValue(0);
  const badgeTranslateY = useSharedValue(10);

  useEffect(() => {
    // Animate logo
    logoOpacity.value = withTiming(1, { duration: duration.slow });
    logoScale.value = withTiming(1, { duration: duration.slow });

    // Animate badge with delay
    badgeOpacity.value = withDelay(300, withTiming(1, { duration: duration.normal }));
    badgeTranslateY.value = withDelay(300, withTiming(0, { duration: duration.normal }));

    // Navigate to splash (Get Started) screen after animation completes
    // Skip auto-navigate in preview mode (used for dev screenshots)
    if (preview === 'true') return;
    const timeout = setTimeout(() => {
      router.replace('/(auth)/splash');
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeTranslateY.value }],
  }));

  return (
    <Screen
      padded={false} safeAreaTop={false} safeAreaBottom={false}
      style={{ backgroundColor: FIGMA_COLORS.background }}
      testID="beta-splash-screen"
    >
      {/* Background Pattern - 8% opacity, no background shape on this screen */}
      <DottedGridPattern fadeMask={false} />

      {/* Content centered vertically per Figma constraints (CENTER/CENTER) */}
      {/* Logo center at y=426 in 852-height frame = exactly 50% */}
      <View style={styles.container}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Logo size={FIGMA_DIMENSIONS.logoHeight} />
        </Animated.View>

        {/* Badge - Figma: Frame 1686557110 (176:2752) */}
        <Animated.View style={[styles.badge, badgeAnimatedStyle]}>
          <Text
            variant="bodySmMedium"
            style={styles.badgeText}
          >
            BETA LAUNCH
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    // 12px gap below logo to badge (Figma: 458 - 446 = 12)
    marginBottom: FIGMA_DIMENSIONS.logoToBadgeGap,
  },
  badge: {
    // HUG content sizing (no fixed width)
    backgroundColor: FIGMA_COLORS.badgeBackground,
    borderRadius: radius.xs,                    // 4px (Figma: borderRadius = 4)
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,              // 8px (Figma: paddingLeft/Right = 8)
    paddingVertical: spacing.xxs,               // 4px (Figma: paddingTop/Bottom = 4)
  },
  badgeText: {
    // typography.bodySmMedium provides: fontSize 12, lineHeight 20,
    // fontFamily PlusJakartaSans-Medium - matches Figma exactly
    // Override letterSpacing and color per Figma blueprint
    letterSpacing: -0.2,                        // Figma: -0.2px
    color: FIGMA_COLORS.badgeText,              // #000000
    textAlign: 'center',
  },
});
