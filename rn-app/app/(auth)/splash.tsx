/**
 * Splash Screen (Get Started)
 * Figma Node: 1-28055
 *
 * PIXEL-PERFECT Figma Values:
 * - Background: #131313 (black.700)
 * - Container width: 297px (Figma: main text/button width)
 * - Container padding: 48px horizontal (centered)
 * - Logo: 33.375px x 40px (Figma exact: vector_1)
 * - Heading: Plus Jakarta Sans Regular, 48px, line-height 64px, tracking -2px
 * - Heading gray text: #A9A9A9 (neutral.500) - "Make" and "your rent"
 * - Heading accent text: #FF9A6D (brand.500) - "work for you->"
 * - Body: 14px, line-height 20px, color #A6A6A6 (black.200)
 * - Divider: 24px width, 2px height, #4D4D4D (black.400), radius 200px
 * - Button: 297px width, 56px height, border #FF9A6D, radius 8px
 * - Button shadow: #995C41, offset 0,6, blur 12
 * - Button text: Plus Jakarta Sans Medium, 16px, line-height 24px, white, centered
 * - Login text: 12px, line-height 20px, white, centered (Figma base style)
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text, PrimaryButton } from '@/src/components';
import { DottedPattern } from '@/src/components';
import { colors, typography, spacing, radius, scaled, scaledSpacing, scaledWidth } from '@/src/theme';

// Exact Figma color values mapped to theme tokens
const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  headingGray: colors.neutral[500],    // #A9A9A9
  headingAccent: colors.brand[500],    // #FF9A6D
  bodyText: colors.black[200],         // #A6A6A6
  divider: colors.black[400],          // #4D4D4D
  buttonBorder: colors.brand[500],     // #FF9A6D
  buttonShadow: '#995C41',             // Figma exact
  textWhite: colors.white,             // #FFFFFF
  loginText: colors.black[300],         // #797979 - Figma node 1:28070 base color
} as const;

// Figma dimensions that need responsive scaling (not covered by tokens)
const FIGMA_DIMENSIONS = {
  contentWidth: 297,                   // Figma: main_Heading width, button width
  logoHeight: 40,                      // Figma: vector_1 height (width scales from this)
} as const;

// Token mappings for reference (actual values from extracted-values.json):
// - containerPadding: 48 → spacing.xxxl
// - logoToHeading: 40 → spacing.xxl
// - headingToBody: 16 → spacing.md
// - buttonToLogin: 24 → spacing.lg
// - bottomPadding: 64 → spacing.huge
// - divider: 24x2, radius 200, #4D4D4D → handled by PrimaryButton
// - button: radius 8, padding 16 → handled by PrimaryButton

export default function SplashScreen() {
  const router = useRouter();

  const handleGetStarted = useCallback(() => {
    router.push('/(auth)/carousel');
  }, [router]);

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/sign-up');
  }, [router]);

  return (
    <Screen padded={false} style={{ backgroundColor: FIGMA_COLORS.background }} testID="splash-screen">
      {/* Background Pattern - 8% opacity per Figma (built into component) */}
      {/* Splash screen uses unique "Background Shape" silhouette (node 1:28057) */}
      <DottedPattern backgroundShape="splash" />

      {/* Outer Container - pushes main content to bottom per Figma */}
      <View style={styles.outerContainer}>
        {/* Main Container - Figma node 1:28061: height 613, space-between */}
        <View style={styles.mainContent}>
          {/* Top Section - Logo and Hero Text */}
          <View style={styles.topSection}>
            {/* Logo - Figma exact: 33.375x40 */}
            <View style={styles.logoContainer}>
              <Logo size={40} />
            </View>

            {/* Hero Text */}
            <View style={styles.textContainer}>
              {/* Heading - Figma node 1:28066: "Make  your rent  work for you→" */}
              {/* Figma styleOverrideTable: style 9 = gray (#A9A9A9), style 7 = brand (#FF9A6D) */}
              {/* "Make" + "your rent" = gray, "work for you→" = brand accent */}
              <Text style={styles.headingGray}>
                Make{'\n'}your rent{'\n'}
                <Text style={styles.headingAccent}>work for you→</Text>
              </Text>

              {/* Body Text - Figma: Subheading (node 1:28067) */}
              {/* Uses curly apostrophe (') per Figma exact text */}
              <Text style={styles.bodyText}>
                Secured is India{'\u2019'}s first rent payment app built to reward reliable tenants.
              </Text>
            </View>
          </View>

          {/* Bottom CTA Section */}
          <View style={styles.bottomSection}>
            {/* Get Started Button with divider above */}
            <PrimaryButton
              title="Get Started"
              onPress={handleGetStarted}
              showDivider={true}
              testID="get-started-button"
            />

            {/* Login Link - Figma node 1:28070: "Already a user? Log in" */}
            {/* styleOverrideTable: style 16 = white, style 17 = white + UNDERLINE */}
            <Pressable
              onPress={handleLogin}
              style={styles.loginContainer}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.loginText}>
                Already a user? <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Outer container pushes main content to bottom per Figma
  // NOTE: Using flexGrow: 1 instead of flex: 1 for layout safety on small screens
  outerContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end', // Aligns mainContent to bottom
  },
  // Main Content - Figma node 1:28061: Container
  // height: 613, layoutMode: VERTICAL, primaryAxisAlignItems: SPACE_BETWEEN
  // paddingBottom: 64, itemSpacing: 48
  mainContent: {
    height: 852, // Figma root screen height (node 1:28055)
    justifyContent: 'space-between', // Figma: primaryAxisAlignItems: SPACE_BETWEEN
    paddingBottom: spacing.huge, // Figma: paddingBottom = 64 → spacing.huge
    gap: spacing.xxxl, // Figma: itemSpacing = 48 → minimum gap between sections
  },
  // Top section with horizontal padding - Figma: paddingLeft/Right = 48
  // Figma node 1:28062 "Container": layoutSizingHorizontal: FILL
  topSection: {
    width: '100%',
    paddingHorizontal: spacing.xxxl, // Figma: 48px
  },
  logoContainer: {
    // Figma: Logo to heading gap = 40 → spacing.xxl
    marginBottom: spacing.xxl,
  },
  textContainer: {
    // Figma node 1:28065 "Text Container": layoutSizingHorizontal: FILL
    width: '100%',
    // Figma: Text Container gap = 16 → spacing.md
    gap: spacing.md,
  },
  headingGray: {
    // Figma: Main Heading (node 1:28066) - single text with mixed colors
    // Typography: Plus Jakarta Sans, 48px, 400 weight, lineHeight 64, letterSpacing -2
    ...typography.h1,
    // Explicit Figma overrides to guard against token drift (pixel-feedback fix)
    fontWeight: '400',
    lineHeight: 64,
    letterSpacing: -2,
    color: FIGMA_COLORS.headingGray,
    // Figma node 1:28066 "Main Heading": layoutSizingHorizontal: FILL
    width: '100%',
  },
  headingAccent: {
    // Nested <Text> inherits typography from parent headingGray — only set color here
    // Do NOT re-spread ...typography.h1 (pixel-feedback fix: avoids style conflicts in nested Text)
    color: FIGMA_COLORS.headingAccent,
  },
  bodyText: {
    // Figma: typography.bodyMd2 (14/20/400)
    ...typography.bodyMd2,
    color: FIGMA_COLORS.bodyText,
    // Figma node 1:28067 "Subheading": layoutSizingHorizontal: FILL
    width: '100%',
  },
  // Bottom section with horizontal padding - Figma: paddingLeft/Right = 48
  bottomSection: {
    paddingHorizontal: spacing.xxxl, // Figma: 48px
    // Figma: Button Container gap = 24 → spacing.lg
    gap: spacing.lg,
    alignItems: 'center',
  },
  loginContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    // Figma: width 297 - removed explicit width, let padding control (Gemini fix)
    // width: scaledWidth(FIGMA_DIMENSIONS.contentWidth),
  },
  loginText: {
    // Figma node 1:28070: base fontSize 12 / #797979, but styleOverrideTable[16] overrides ALL
    // characters to fontSize 14, color #FFFFFF. Use override values since they apply to full text.
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,                                           // Figma: styleOverrideTable[16] = 14
    lineHeight: 20,
    color: FIGMA_COLORS.textWhite,                          // Figma: styleOverrideTable[16] = #FFFFFF
    textAlign: 'center',             // Figma: textAlignHorizontal: CENTER
    // Figma node 1:28070 "Login Text": layoutSizingHorizontal: FILL
    width: '100%',
  },
  loginLink: {
    // Figma styleOverrideTable[17]: fontSize 14, color #FFFFFF, underline
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,                                           // Figma: 14 (was 12)
    lineHeight: 20,
    color: FIGMA_COLORS.textWhite,                          // Figma: #FFFFFF (was #797979)
    textDecorationLine: 'underline',
  },
});
