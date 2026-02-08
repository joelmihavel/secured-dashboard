/**
 * Beta Splash Screen
 * Figma Node: 1-28071
 *
 * PIXEL-PERFECT Figma Values (CORRECTED 2026-02-05):
 * - Background: #131313 (black.700)
 * - Swatch pattern opacity: 8% (opacity-8 per Figma)
 * - Logo Container (176:2750): 33.375x40px at Y=756 (lower portion of screen)
 * - Badge Frame (176:2752): 96x28px at Y=809
 * - Logo to Badge gap: 13px (calculated: 809 - 796 = 13)
 * - Badge: background #FF9A6D (brand.500)
 * - Badge padding: 8px horizontal, 4px vertical
 * - Badge border radius: 4px
 * - Badge text: Plus Jakarta Sans Medium, 12px, line-height 20px
 * - Badge text color: #000000 (black.900)
 * - Badge text tracking: -0.2px
 * - Badge width: auto (content-based per Figma)
 *
 * Layout: Logo and badge are positioned in lower portion of screen,
 * not centered. Y=756 out of 852 total = ~89% from top.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import { Screen, Logo, Text, DottedPattern } from '@/src/components';
import { colors, duration, spacing, radius, typography, scaledSpacing } from '@/src/theme';

// Exact Figma color values mapped to theme tokens
const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  badgeBackground: colors.brand[500],  // #FF9A6D
  badgeText: colors.black[900],        // #000000
} as const;

// Exact Figma dimensions (from node 1-28071, extracted 2026-02-05)
const FIGMA_DIMENSIONS = {
  // Logo Container (176:2750): 33.375 x 40px at Y=756
  logoWidth: 33.375,
  logoHeight: 40,
  // Badge Frame (176:2752): 96 x 28px at Y=809
  badgeWidth: 96,                      // Figma: frame_1686557110 width
  badgeHeight: 28,                     // Figma: frame_1686557110 height
  badgePaddingHorizontal: 8,           // Figma: paddingLeft/Right = 8
  badgePaddingVertical: 4,             // Figma: paddingTop/Bottom = 4
  badgeBorderRadius: 4,                // Figma: borderRadius = 4
  badgeTextWidth: 80,                  // Figma: login_Prompt width
  // Gap: Logo bottom (y=756+40=796) to Badge top (y=809) = 13px
  logoToBadgeGap: 13,                  // Figma exact: 809 - 796 = 13px
  // Screen dimensions for positioning calculation
  screenHeight: 852,                   // Figma frame height
  logoTopY: 756,                       // Logo Y position from Figma
  // Bottom padding: Screen height (852) - Badge bottom (809+28=837) = 15px
  bottomPadding: 15,
} as const;

export default function BetaSplashScreen() {
  const router = useRouter();

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
      padded={false}
      style={{ backgroundColor: FIGMA_COLORS.background }}
      testID="beta-splash-screen"
    >
      {/* Background Pattern - 8% opacity per Figma (opacity-8) */}
      {/* No Background Shape on this screen - only dotted pattern */}
      <DottedPattern showShape={false} />

      {/* Content positioned in lower portion of screen per Figma */}
      {/* Figma shows logo at Y=756/852 (~89% from top) */}
      <View style={styles.container}>
        <View style={styles.spacer} />

        <View style={styles.contentWrapper}>
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <Logo size={FIGMA_DIMENSIONS.logoHeight} />
          </Animated.View>

          {/* Badge - Figma: frame_1686557110 */}
          <Animated.View style={[styles.badge, badgeAnimatedStyle]}>
            <Text style={styles.badgeText}>
              BETA LAUNCH
            </Text>
          </Animated.View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  contentWrapper: {
    alignItems: 'center',
    // Bottom padding: Figma shows 15px from badge bottom to screen bottom
    paddingBottom: FIGMA_DIMENSIONS.bottomPadding,
  },
  logoContainer: {
    // 13px gap is custom (not in spacing tokens), so scale it proportionally
    marginBottom: scaledSpacing(FIGMA_DIMENSIONS.logoToBadgeGap),
  },
  badge: {
    // Width is auto (content-based), NOT fixed per Figma
    backgroundColor: FIGMA_COLORS.badgeBackground,
    // Using design tokens instead of hardcoded values:
    borderRadius: radius.xs,                    // 4pt (Figma: borderRadius = 4)
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,              // 8pt (Figma: paddingLeft/Right = 8)
    paddingVertical: spacing.xxs,               // 4pt (Figma: paddingTop/Bottom = 4)
  },
  badgeText: {
    // Using typography.bodySmMedium as base (12px Medium)
    // with custom letterSpacing override per Figma (-0.2px)
    ...typography.bodySmMedium,
    letterSpacing: -0.2,                        // Figma: tracking = -0.2px
    color: FIGMA_COLORS.badgeText,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
