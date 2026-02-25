/**
 * Splash / Get Started Screen
 * Figma Node: 684:3081
 *
 * Figma Values (from get_design_context 2026-02-25):
 * - Background: #131313 (colors.black[700])
 * - Dotted pattern: 8% opacity dots (DottedGridPattern)
 * - Background Shape (174:2668): 481x405px, opacity 48%, centered horizontally, top -100px
 * - Vector 1 (1:28057): 333.751x400px, bottom-0, right-[-120.56px], -scale-y-100, opacity 1%
 * - Content container: h-613px, centered vertically with +85.5px offset, pb-64, px-48
 * - Logo: 33.375x40px
 * - Logo→text gap: 40px
 * - Heading: PlusJakartaSans-Regular, 48/64, letterSpacing -2
 *   "Make\nyour rent\n" = #A9A9A9, "work for you→" = #FF9A6D
 * - Body: PlusJakartaSans-Regular, 14/20, #A6A6A6
 * - Heading→body gap: 16px
 * - Button: "Get Started" (PrimaryButton component)
 * - Login: "Already a user? Log in", 14/20, white, "Log in" underlined
 * - Button→login gap: 24px
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Logo, Text, PrimaryButton, DottedGridPattern } from '@/src/components';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleGetStarted = useCallback(() => {
    router.push('/(auth)/carousel');
  }, [router]);

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/sign-up');
  }, [router]);

  // Figma frame height 852, content ends at y=818, bottom safe area = 34px
  const paddingBottom = Math.max(insets.bottom, 34);

  return (
    <Screen padded={false} testID="splash-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* Dotted grid background and splash shape */}
      <DottedGridPattern fadeMask={false} />

      {/* Content — Figma: h-613, centered vertically, pb-64, px-48 */}
      <View style={[styles.outerContainer, { paddingBottom }]}>
        <View style={styles.mainContent}>
          <View style={styles.topSection}>
            <Logo size={40} />
            <View style={styles.textContainer}>
              <Text style={styles.heading}>
                Make{'\n'}your rent{'\n'}
                <Text inherit style={styles.headingAccent}>work for you→</Text>
              </Text>
              <Text style={styles.subheading}>
                Secured is India’s first rent payment app built to reward reliable tenants.
              </Text>
            </View>
          </View>

          <View style={styles.bottomSection}>
            <PrimaryButton
              title="Get Started"
              onPress={handleGetStarted}
              showDivider={true}
              testID="get-started-button"
            />
            <Pressable
              onPress={handleLogin}
              style={styles.loginContainer}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  // Content layout: Figma h-613, flex-end aligned, pb-64
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mainContent: {
    height: 613,
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingBottom: 64,
  },
  topSection: {
    width: '100%',
    flexDirection: 'column',
    paddingHorizontal: 48,
    gap: 40,
  },
  textContainer: {
    width: '100%',
    flexDirection: 'column',
    gap: 16,
  },
  // Heading: Figma 48/64, letterSpacing -2, PlusJakartaSans-Regular
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.neutral[500], // #A9A9A9
  },
  headingAccent: {
    color: colors.brand[500], // #FF9A6D
  },
  // Body: Figma 14/20, #A6A6A6
  subheading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.black[200], // #A6A6A6
  },
  bottomSection: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 48,
    gap: 24,
  },
  loginContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Login text: Figma 14/20, white
  loginText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  loginLink: {
    textDecorationLine: 'underline',
  },
});
