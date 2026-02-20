import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Logo, Text, PrimaryButton } from '@/src/components';
import { colors } from '@/src/theme';

const VECTOR_1_PATH = "M124.751 400L37.2631 400L37.2631 212.062L0 212.062L0 160.217L37.2631 160.217C16.5252 79.8576 75.0667 31.6855 106.93 17.6445C200.25 -31.6081 297.028 33.8457 333.751 72.7293L333.751 400L246.263 400L246.263 116.473C195.714 33.5216 132.312 52.7474 106.93 72.7293C74.5266 128.462 120.431 154.277 147.433 160.217L192.798 160.217L192.798 212.062L124.751 212.062L124.751 400Z";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ratioX = SCREEN_WIDTH / 393; // 393 is Figma base width
const sv = (val: number) => val * ratioX;

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

  // Figma container height is 613, Y offset is 205. Total 818.
  // 852 - 818 = 34px (Figma's bottom home indicator safe area inset).
  // If the device has safe area inset > 0, use it, otherwise fallback to 34 to match Figma.
  const paddingBottom = Math.max(insets.bottom, 34);

  return (
    <Screen padded={false} testID="splash-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* 1. Deterministic Backgrounds from Figma extraction 1-28055 */}
      <Image
        source={require('@/src/assets/figma-assets/1-28055_image-149.png')}
        style={[styles.image149, { left: sv(-463), top: sv(-747), width: sv(1319), height: sv(2346) }]}
        contentFit="fill"
      />
      <View style={[styles.vector1, { left: sv(179.81), top: sv(452), width: sv(333.75), height: sv(400) }]}>
        <Svg width="100%" height="100%" viewBox="0 0 333.75 400">
          <Path d={VECTOR_1_PATH} fill="#FFFFFF" opacity={1} />
        </Svg>
      </View>
      <Image
        source={require('@/src/assets/figma-assets/1-28055_background-shape.png')}
        style={[styles.backgroundShape, { left: sv(-44), top: 0, width: sv(481), height: sv(405) }]}
        contentFit="fill"
      />

      {/* 2. Deterministic Layout from Figma extraction 1-28055 */}
      <View style={[styles.outerContainer, { paddingBottom }]}>
        <View style={[styles.mainContent, { height: sv(613) }]}>
          <View style={styles.topSection}>
            <Logo size={sv(40)} />
            <View style={styles.textContainer}>
              <Text style={styles.heading}>
                Make{'\n'}your rent{'\n'}
                <Text inherit style={styles.headingAccent}>work for you→</Text>
              </Text>
              <Text style={styles.subheading}>
                Secured is India's first rent payment app built to reward reliable tenants.
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
  // Deterministic absolute positions mapped dynamically via sv() inline
  image149: {
    position: 'absolute',
    opacity: 0.08,
    transform: [{ rotate: '90deg' }], 
  },
  vector1: {
    position: 'absolute',
    opacity: 0.01,
  },
  backgroundShape: {
    position: 'absolute',
    opacity: 1, 
  },
  
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mainContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingBottom: 64, // pad: [0,0,64,0] from Figma
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
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: colors.neutral[500],
  },
  headingAccent: {
    color: colors.brand[500],
  },
  subheading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.black[200],
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