/**
 * Splash / Get Started Screen
 * Figma Node: 4651:75972 (Splash / get-started --1)
 *
 * Brand intro screen — "Welcome to Secured by flent" with rotated marquee bands
 * advertising rent cashback. Tap Get Started → welcome (Frame 2).
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Logo, Text, PrimaryButton } from '@/src/components';
import { BgLine, MarqueeStack, Plus, Wordmark } from '@/src/components/auth/landing-decor';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const LANDING_BG = require('../../assets/images/patterns/landing-bg.png');

export default function SplashScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const navigating = useRef(false);

  const handleGetStarted = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(auth)/welcome');
    setTimeout(() => { navigating.current = false; }, 1000);
  }, []);

  const paddingBottom = Math.max(insets.bottom, sv(34));

  return (
    <Screen padded={false} testID="splash-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <Image
        source={LANDING_BG}
        style={styles.bgImage}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <BgLine style={styles.bgLinePosition} />

      <MarqueeStack />

      {/* Decorative "+" markers — Figma 4651:76010 (26,740) and 4651:76012 (359,578) on the 393×852 splash frame */}
      <Plus style={{ left: s(26), top: sv(740) }} />
      <Plus style={{ left: s(359), top: sv(578) }} />

      <View style={[styles.logoSlot, { top: insets.top + sv(220) }]}>
        <Logo size={40} />
      </View>

      <View style={styles.welcomeBlock}>
        <Text style={styles.welcomeTo}>Welcome to</Text>
        <Text style={styles.brandName}>Secured</Text>
        <View style={styles.byFlentRow}>
          <Text style={styles.byText}>by</Text>
          <Wordmark width={s(39)} height={s(14)} color={colors.white} />
        </View>
      </View>

      <View style={[styles.ctaWrap, { bottom: paddingBottom + sv(36) }]}>
        <PrimaryButton
          title="Get Started →"
          onPress={handleGetStarted}
          showDivider
          testID="get-started-button"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: sv(-66),
    left: s(-18),
    width: s(469),
    height: sv(664),
    opacity: 0.32,
  },
  bgLinePosition: {
    left: '50%',
    top: '50%',
    marginLeft: -s(405) / 2,
    marginTop: sv(229.5) - sv(269) / 2,
  },
  logoSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  welcomeBlock: {
    position: 'absolute',
    top: sv(524),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  welcomeTo: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(22),
    lineHeight: sf(35),
    color: colors.white,
  },
  brandName: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(40),
    lineHeight: sf(56),
    letterSpacing: -1,
    color: colors.brand[500],
    marginTop: sv(24),
  },
  byFlentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: sv(20),
  },
  byText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(17),
    lineHeight: sf(20),
    letterSpacing: -0.6,
    color: colors.white,
  },
  ctaWrap: {
    position: 'absolute',
    left: s(48),
    right: s(48),
    alignItems: 'center',
  },
});
