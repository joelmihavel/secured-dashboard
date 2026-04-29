/**
 * Welcome / Sign-up Choice Screen
 * Figma Node: 4651:75929 (Splash / get-started --2)
 *
 * Second landing screen — "Make your rent / work for you" card with Sign Up + Log in choice.
 * Sign Up → carousel (earn 1% back flow). Log in → sign-up (OTP entry).
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Defs, ClipPath, Rect } from 'react-native-svg';

import { Screen, Logo, Text, PrimaryButton } from '@/src/components';
import { BgLine, MarqueeStack, Plus } from '@/src/components/auth/landing-decor';
import { colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const LANDING_BG = require('../../assets/images/patterns/landing-bg.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const navigating = useRef(false);

  const handleSignUp = useCallback(() => {
    if (navigating.current) return;
    navigating.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(auth)/carousel');
    setTimeout(() => { navigating.current = false; }, 1000);
  }, []);

  const handleLogin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push('/(auth)/login');
  }, []);

  const paddingBottom = Math.max(insets.bottom, sv(34));

  return (
    <Screen padded={false} testID="welcome-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <Image
        source={LANDING_BG}
        style={styles.bgImage}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <MarqueeStack />

      <View style={[styles.logoSlot, { top: insets.top + sv(220) }]}>
        <Logo size={40} />
      </View>

      {/* Sign-up choice card */}
      <View style={[styles.cardWrap, { bottom: paddingBottom + sv(20) }]}>
        <View style={styles.card}>
          {/* Decorative crosshair — Figma 4651:75956 (15, 84), 327×219 inside card */}
          <BgLine style={styles.bgLineInsideCard} />

          {/* Paperclip — Figma 4651:75967 (19.63, -5.31), 22.77×41.4. Source path
              is upright in a 12.12×39.59 viewBox; the rotated bbox proves a -16.5°
              tilt (cos·12.12 + sin·39.59 ≈ 22.77, sin·12.12 + cos·39.59 ≈ 41.4). */}
          <View style={styles.paperclipSlot} pointerEvents="none">
            <Paperclip />
          </View>

          {/* Folded-corner flap — top-right */}
          <View style={styles.cornerFlapSlot} pointerEvents="none">
            <CornerFlap />
          </View>

          {/* Orange + markers — Figma 4651:75968 (39.5, 286) bottom-left,
              4651:75970 (307.5, 99) top-right. Both relative to inner card content. */}
          <Plus style={{ left: s(39.5), top: sv(286) }} />
          <Plus style={{ left: s(307.5), top: sv(99) }} />

          <View style={styles.headingBlock}>
            <Text style={styles.heading}>Make your Rent</Text>
            <Text style={styles.headingAccent}>work for you</Text>
          </View>

          <Text style={styles.subtitle}>
            Secured is India&apos;s first rent payment app{'\n'}built to reward reliable tenants.
          </Text>

          <View style={styles.actionBlock}>
            <PrimaryButton
              title="Sign Up →"
              onPress={handleSignUp}
              showDivider
              testID="sign-up-button"
            />
            <Pressable
              onPress={handleLogin}
              style={styles.loginContainer}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="login-link"
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

/** Silver paperclip — Figma "Vector" path, rendered slim & rotated to lean over the card edge. */
function Paperclip() {
  return (
    <Svg width={s(23)} height={s(41)} viewBox="0 0 12.1221 39.5877" fill="none">
      <Path
        d="M12.0001 20.8239C12.0001 15.5157 12.1835 10.1714 12.0001 4.86609C11.857 0.724895 6.1445 -1.82115 3.22934 1.58326C2.3663 2.59126 2.21666 3.8089 2.20034 5.06962C2.17106 7.33714 2.20034 9.60693 2.20034 11.8746C2.20034 17.1129 2.0327 22.3811 2.20034 27.6169C2.36222 32.6708 9.82718 32.346 10.1837 27.4668C10.5562 22.3691 10.2333 30.9269 10.2333 25.8133C10.2333 25.0327 9.02024 25.0314 9.02024 25.8133C9.02024 29.978 8.97062 20.3351 8.97062 24.4997C8.97062 25.6405 9.18746 27.0356 8.87054 28.1604C8.05334 31.0607 3.54926 30.6122 3.41342 27.617C3.2297 23.5658 3.41342 19.4643 3.41342 15.4098C3.41342 11.8165 3.1589 8.12025 3.41342 4.53381C3.65042 1.19457 8.21282 0.0791738 10.1784 2.81721C10.8033 3.68769 10.7871 4.32034 10.7871 5.29294C10.7871 9.74602 10.7871 14.1992 10.7871 18.6524C10.7871 23.1055 10.7871 27.5588 10.7871 32.0119C10.7871 33.8964 10.7515 35.9761 9.22094 37.3217C7.48142 38.8511 4.38386 38.6648 2.74286 37.1162C0.414742 34.919 1.30802 29.6012 1.30802 26.7913C1.30802 22.2481 1.30802 17.705 1.30802 13.1619C1.30802 12.3813 0.0949403 12.3801 0.0949403 13.1619C0.0949403 18.1381 0.0949403 23.1143 0.0949403 28.0905C0.0949403 31.1371 -0.592898 35.4086 1.73426 37.8296C3.22178 39.377 5.73938 39.923 7.7981 39.3878C10.4531 38.6976 11.7851 36.3359 11.9769 33.722C12.2895 29.4637 12.0001 25.0897 12.0001 20.8239Z"
        fill={colors.black[400]}
      />
    </Svg>
  );
}

/** Folded-corner / dog-ear at top-right of card — page bg shows through with a triangle of card-back. */
function CornerFlap() {
  const size = s(54);
  return (
    <Svg width={size} height={size} viewBox="0 0 54 54" fill="none">
      <Defs>
        <ClipPath id="flap-clip">
          <Rect width={54} height={54} fill="white" />
        </ClipPath>
      </Defs>
      {/* Rounded back showing page bg through the fold */}
      <Path
        d="M0 12C0 5.37258 5.37258 0 12 0H42C48.6274 0 54 5.37258 54 12V42C54 48.6274 48.6274 54 42 54H12C5.37258 54 0 48.6274 0 42V12Z"
        fill={colors.black[700]}
        clipPath="url(#flap-clip)"
      />
      {/* Triangle representing the underside of the fold */}
      <Path
        d="M65.6924 53.5H12C5.64873 53.5 0.5 48.3513 0.5 42V-4.88184L65.6924 53.5Z"
        fill={colors.black[600]}
        stroke={colors.black[500]}
        clipPath="url(#flap-clip)"
      />
    </Svg>
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
  logoSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Card
  cardWrap: {
    position: 'absolute',
    left: s(16),
    right: s(16),
  },
  card: {
    backgroundColor: colors.black[500],
    borderRadius: 8,
    paddingVertical: sv(40),
    alignItems: 'center',
    overflow: 'visible',
  },
  // Figma 4651:75956 — bg_line at (15, 84), 327×219 inside the card.
  // Width/height override the canonical 405×269 BgLine wrapper; the SVG is
  // stretched (preserveAspectRatio=none) and the lines stay rectilinear.
  bgLineInsideCard: {
    left: s(15),
    top: sv(84),
    width: s(327),
    height: sv(219),
  },

  // Decorations
  paperclipSlot: {
    // Figma 4651:75967 — bbox at (19.63, -5.31), 22.77×41.4 in inner card coords.
    position: 'absolute',
    left: s(19.63),
    top: sv(-5.31),
    width: s(22.77),
    height: sv(41.4),
    transform: [{ rotate: '-16.5deg' }],
    overflow: 'visible',
  },
  cornerFlapSlot: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // Heading
  headingBlock: {
    alignItems: 'center',
    gap: sv(4),
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
    color: colors.white,
    textAlign: 'center',
  },
  headingAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
    color: colors.brand[500],
    textAlign: 'center',
  },

  // Subtitle
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: sv(26),
    width: s(297),
  },

  // Actions
  actionBlock: {
    width: s(297),
    marginTop: sv(26),
    gap: sv(24),
    alignItems: 'center',
  },
  loginContainer: {
    width: '100%',
    alignItems: 'center',
  },
  loginText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: colors.white,
  },
  loginLink: {
    textDecorationLine: 'underline',
  },
});
