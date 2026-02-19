/**
 * Splash Screen (Get Started)
 * Figma Node: 1-28055
 *
 * PIXEL-PERFECT Figma Values (from blueprint 1-28055-blueprint.json):
 * - Background: #131313 (black.700)
 * - Root: 393x852, no layout (children absolutely positioned + Container)
 * - Container (1:28061): y=205, 393x613, VERTICAL, SPACE_BETWEEN, gap=48, paddingBottom=64
 *   - Container (1:28062): FILL x HUG, VERTICAL, gap=40, padding L/R=48
 *     - Logo Container (1:28063): 33.375x40 FIXED
 *     - Text Container (1:28065): FILL x HUG, VERTICAL, gap=16
 *       - Main Heading (1:28066): FILL x HUG, 48/64/400/-2, mixed colors
 *         chars 0-15: #A9A9A9 ("Make  your rent  ")
 *         chars 17-30: #FF9A6D ("work for you->")
 *       - Subheading (1:28067): FILL x HUG, 14/20/400/0, #A6A6A6
 *   - Button Container (1:28068): FILL x HUG, VERTICAL, CENTER, gap=24, padding L/R=48
 *     - button (1:28069): PrimaryButton with divider
 *     - Login Text (1:28070): FILL x HUG, base 12/20/#797979 but ALL chars overridden:
 *       chars 0-16: fontSize=14, color=#FFFFFF
 *       chars 16-22: fontSize=14, color=#FFFFFF, underline
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text, PrimaryButton } from '@/src/components';
import { DottedPattern } from '@/src/components';
import { colors, spacing, sv } from '@/src/theme';

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
} as const;

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
        {/* Main Container - Figma node 1:28061: 393x613, VERTICAL, SPACE_BETWEEN */}
        <View style={styles.mainContent}>
          {/* Top Section (1:28062) - Logo and Hero Text, padding L/R 48, gap 40 */}
          <View style={styles.topSection}>
            {/* Logo Container (1:28063) - Figma exact: 33.375x40 */}
            <View style={styles.logoContainer}>
              <Logo size={40} />
            </View>

            {/* Text Container (1:28065) - FILL x HUG, gap 16 */}
            <View style={styles.textContainer}>
              {/* Main Heading (1:28066): 48/64/400/-2 mixed colors */}
              {/* spans: 0-15 = #A9A9A9 ("Make  your rent  "), 17-30 = #FF9A6D ("work for you->") */}
              <Text style={styles.headingGray}>
                Make{'\n'}your rent{'\n'}
                <Text inherit style={styles.headingAccent}>work for you→</Text>
              </Text>

              {/* Subheading (1:28067): 14/20/400/0 #A6A6A6 */}
              <Text style={styles.bodyText}>
                Secured is India{'\u2019'}s first rent payment app built to reward reliable tenants.
              </Text>
            </View>
          </View>

          {/* Button Container (1:28068) - FILL x HUG, CENTER, gap 24, padding L/R 48 */}
          <View style={styles.bottomSection}>
            {/* Get Started Button (1:28069) with divider above */}
            <PrimaryButton
              title="Get Started"
              onPress={handleGetStarted}
              showDivider={true}
              testID="get-started-button"
            />

            {/* Login Text (1:28070): base 12/20/#797979, ALL chars overridden to 14/#FFFFFF */}
            {/* chars 16-22 ("Log in") additionally have underline */}
            <Pressable
              onPress={handleLogin}
              style={styles.loginContainer}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="link"
              accessibilityLabel="Already a user? Log in"
            >
              <Text style={styles.loginText}>
                Already a user? <Text inherit style={styles.loginLink}>Log in</Text>
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
  // Container (1:28061) starts at y=205 (852-613-34=205), so content sits in bottom ~72%
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Aligns mainContent to bottom
  },

  // Main Content - Figma node 1:28061: Container
  // width: 393 (FIXED = full screen), height: 613 (FIXED)
  // VERTICAL, SPACE_BETWEEN, gap: 48, paddingBottom: 64
  mainContent: {
    height: sv(613),
    justifyContent: 'space-between',    // Figma: primaryAxisAlignItems: SPACE_BETWEEN
    paddingBottom: spacing.huge,         // Figma: paddingBottom = 64 -> spacing.huge
    gap: spacing.xxxl,                   // Figma: itemSpacing = 48 -> spacing.xxxl
  },

  // Top section (1:28062) - Container
  // FILL x HUG, VERTICAL, gap: 40, padding L/R: 48
  topSection: {
    alignSelf: 'stretch',               // Figma: layoutSizingHorizontal: FILL
    paddingHorizontal: spacing.xxxl,     // Figma: paddingLeft/Right = 48
    gap: spacing.xxl,                    // Figma: itemSpacing = 40 -> spacing.xxl
  },

  // Logo Container (1:28063) - 33.375x40 FIXED
  // No extra margin needed; parent gap handles spacing
  logoContainer: {},

  // Text Container (1:28065) - FILL x HUG, VERTICAL, gap: 16
  textContainer: {
    alignSelf: 'stretch',               // Figma: layoutSizingHorizontal: FILL
    gap: spacing.md,                     // Figma: itemSpacing = 16 -> spacing.md
  },

  // Main Heading (1:28066): PlusJakartaSans-Regular, 48px, lineHeight 64, letterSpacing -2
  // Base fill is #FFFFFF but span override 0-15 = #A9A9A9 (gray text)
  headingGray: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: FIGMA_COLORS.headingGray,     // #A9A9A9 (span override for "Make\nyour rent\n")
    alignSelf: 'stretch',               // Figma: layoutSizingHorizontal: FILL
  },

  // Accent portion of heading - "work for you->"
  // Uses `inherit` prop so parent fontSize/lineHeight/letterSpacing are inherited
  // Only need to override color
  headingAccent: {
    color: FIGMA_COLORS.headingAccent,   // #FF9A6D
  },

  // Subheading (1:28067): PlusJakartaSans-Regular, 14/20/0, #A6A6A6
  bodyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.bodyText,        // #A6A6A6
    alignSelf: 'stretch',               // Figma: layoutSizingHorizontal: FILL
  },

  // Button Container (1:28068) - FILL x HUG, VERTICAL, CENTER, gap: 24, padding L/R: 48
  bottomSection: {
    alignSelf: 'stretch',               // Figma: layoutSizingHorizontal: FILL
    paddingHorizontal: spacing.xxxl,     // Figma: paddingLeft/Right = 48
    gap: spacing.lg,                     // Figma: itemSpacing = 24 -> spacing.lg
    alignItems: 'center',               // Figma: counterAxisAlignItems: CENTER
  },

  // Login pressable container
  loginContainer: {
    alignSelf: 'stretch',               // Figma: Login Text layoutSizingHorizontal: FILL
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Login Text (1:28070): base fontSize 12, lineHeight 20, #797979
  // But ALL characters overridden via spans to fontSize 14, color #FFFFFF
  loginText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,                        // Figma: span override (all chars) = 14
    lineHeight: 20,                      // Figma: 20
    color: FIGMA_COLORS.textWhite,       // Figma: span override (all chars) = #FFFFFF
    textAlign: 'center',                 // Figma: textAlignHorizontal: CENTER
  },

  // Login link portion ("Log in") - uses `inherit` to get parent styles
  // Only adds underline decoration per span override chars 16-22
  loginLink: {
    textDecorationLine: 'underline',     // Figma: textDecoration: underline
  },
});
