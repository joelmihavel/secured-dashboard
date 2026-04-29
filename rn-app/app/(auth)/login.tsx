/**
 * Login Screen
 * Figma Nodes: 4651:149012 (default), 4651:149200 (Enter valid number error)
 *
 * Phone-only entry for returning users — no name field, no consent toggle.
 * Reuses the same OTP flow as sign-up: sendCode → /(auth)/otp.
 *
 * Routing after OTP verification is handled by otp.tsx:resolvePostOtpTarget().
 * Existing 'active' users land on /(main); 'waitlisted' on /(waitlist), etc.
 * New users (someone landing here without an account) follow normal sign-up routing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';

import { Screen, Logo, Text, PrimaryButton, PhoneInput, SkeletonLoader } from '@/src/components';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { colors, typography } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const LOGIN_BG = require('../../assets/images/patterns/signup-bg.png');

const FIGMA_DIMENSIONS = {
  contentWidth: s(297),
  containerPadding: s(48),
} as const;

export default function LoginScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { sendCode, error, isSendingOtp, clearError } = useAuth();
  const authStatus = useAuthStore((s) => s.status);

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxDigits, setMaxDigits] = useState(10);
  const [phoneBlurError, setPhoneBlurError] = useState<string | undefined>();

  const isPhoneValid = (() => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== maxDigits) return false;
    if (countryCode === '+91') return /^[6-9]/.test(clean);
    return true;
  })();

  // Phone-related error (blur or backend); ignore OTP-specific errors that won't apply here
  const getPhoneErrorMessage = (): string | undefined => {
    if (phoneBlurError) return phoneBlurError;
    if (!error) return undefined;
    switch (error.code) {
      case 'INVALID_PHONE':
        return 'Enter valid number';
      case 'RATE_LIMITED':
        return 'Too many attempts. Please wait.';
      case 'NETWORK_ERROR':
        return 'Check your internet connection';
      case 'TIMEOUT':
        return 'Request timed out. Try again.';
      default:
        return 'Something went wrong. Try again.';
    }
  };

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text);
    if (phoneBlurError) setPhoneBlurError(undefined);
    if (error) clearError();
  }, [error, clearError, phoneBlurError]);

  const handlePhoneBlur = useCallback(() => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length > 0 && clean.length < maxDigits) {
      setPhoneBlurError('Enter valid number');
    } else if (countryCode === '+91' && clean.length === 10 && !/^[6-9]/.test(clean)) {
      setPhoneBlurError('Must start with 6-9');
    }
  }, [phone, maxDigits, countryCode]);

  const handleCountryChange = useCallback((country: { code: string; maxDigits: number }) => {
    setCountryCode(country.code);
    setMaxDigits(country.maxDigits);
    setPhone('');
    if (phoneBlurError) setPhoneBlurError(undefined);
    if (error) clearError();
  }, [error, clearError, phoneBlurError]);

  // Ref-based guard prevents double-fire before isSendingOtp updates
  const isSendingRef = useRef(false);
  useEffect(() => {
    if (!isSendingOtp) isSendingRef.current = false;
  }, [isSendingOtp]);

  const handleGetStarted = useCallback(() => {
    if (!isPhoneValid || isSendingRef.current || isSendingOtp) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode}${cleanPhone}`;
    isSendingRef.current = true;
    // No name passed — login is phone-only. The route_otp edge function will
    // detect an existing user and send OTP via Supabase Auth.
    sendCode(formattedPhone, undefined, () => {
      routerRef.current.push('/(auth)/otp');
    });
  }, [isPhoneValid, phone, countryCode, sendCode, isSendingOtp]);

  // If somehow we land here while already authenticated, defer to journey router
  if (authStatus === 'authenticated') {
    return <SkeletonLoader />;
  }

  return (
    <Screen padded={false} testID="login-screen" safeAreaTop={false}>
      <Image
        source={LOGIN_BG}
        style={styles.bgImage}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <KeyboardAwareScrollView
        bottomOffset={20}
        style={styles.keyboardView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Inline marquee — scrolls with content */}
        <View style={styles.marqueeStack} pointerEvents="none">
          <View style={[styles.marqueeRow, { transform: [{ rotate: '0.22deg' }] }]}>
            <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
          </View>
          <View style={[styles.marqueeRow, { transform: [{ rotate: '-0.48deg' }] }]}>
            <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} textColor={colors.black[700]} reverse />
          </View>
        </View>

        <View style={styles.container}>
          <View style={styles.innerStack}>
            <Logo size={38.4} />

            <Text style={styles.headingGray}>
              Welcome{'\n'}
              <Text inherit style={styles.headingAccent}>back</Text>
            </Text>

            <View style={styles.formContainer}>
              <PhoneInput
                label="Phone"
                value={phone}
                onChangeText={handlePhoneChange}
                onBlur={handlePhoneBlur}
                countryCode={countryCode}
                onCountryChange={handleCountryChange}
                error={getPhoneErrorMessage()}
                placeholder="Enter Number"
                testID="phone-input"
              />
            </View>

            <PrimaryButton
              title="Get Started"
              onPress={handleGetStarted}
              disabled={!isPhoneValid}
              loading={isSendingOtp}
              showDivider
              testID="login-button"
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    position: 'absolute',
    top: sv(44),
    left: s(-48),
    width: s(469),
    height: sv(664),
    opacity: 0.24,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: sv(78),
  },
  marqueeStack: {
    marginHorizontal: -s(227),
  },
  marqueeRow: {
    width: s(847),
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,
    alignItems: 'center',
    paddingTop: sv(80),
  },
  innerStack: {
    width: FIGMA_DIMENSIONS.contentWidth,
    gap: sv(48),
  },
  headingGray: {
    ...typography.h1,
    color: colors.neutral[500],
  },
  headingAccent: {
    color: colors.brand[500],
  },
  formContainer: {
    gap: sv(16),
  },
});
