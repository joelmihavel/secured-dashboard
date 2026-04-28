/**
 * Sign Up Screen
 * Figma Node: 1-29108
 *
 * PIXEL-PERFECT Figma Values:
 * - Background: #131313 (black.700)
 * - Swatch opacity: 8% (image 149 from Figma)
 * - Container width: 297px (content width)
 * - Container padding: 48px horizontal
 * - Logo: 32x38.4px (Figma: vector_1)
 * - Heading: Plus Jakarta Sans Regular, 48px, line-height 64px, tracking -2px
 * - Heading text: "Let's get to" (#A9A9A9 gray), "know you" (#FF9A6D orange accent)
 * - Label: Plus Jakarta Sans Regular, 12px, line-height 20px, #A9A9A9 (neutral.500)
 * - Hint text (edit): Plus Jakarta Sans Regular, 14px, line-height 20px, #878787 (neutral.600)
 * - Input: 193px width (phone), 297px full width, 64px height
 * - Input border: #4D4D4D (black.400), 1px, radius 12px
 * - Input padding: 16px vertical, gap 16px
 * - Dropdown text (+91): Plus Jakarta Sans Regular, 20px, line-height 32px, #444444 (neutral.800)
 * - Input placeholder: Plus Jakarta Sans Medium, 16px, line-height 24px, #222222 (per parity analysis)
 * - Button disabled: background #202020 (black.500), border #202020, radius 12px
 * - Button text disabled: Plus Jakarta Sans Medium, 16px, line-height 24px, #444444 (neutral.800)
 * - Consent text: Plus Jakarta Sans Regular, 12px, line-height 20px, #A9A9A9 (neutral.500)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput as RNTextInput, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Text, PrimaryButton, PhoneInput, TextInput, SkeletonLoader, BackButton } from '@/src/components';
import { ConsentToggle } from '@/src/components';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { colors, typography } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

const SIGNUP_BG = require('../../assets/images/patterns/signup-bg.png');

// Exact Figma color values mapped to theme tokens
const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  headingGray: '#A9A9A9',              // Figma 1:29183: "Let's get to" text in gray
  headingAccent: colors.brand[500],    // #FF9A6D - "know you" text (orange accent per Figma screenshot)
  label: colors.neutral[500],          // #A9A9A9
  hintText: colors.neutral[600],       // #878787
  inputBorder: colors.black[400],      // #4D4D4D
  dropdownText: colors.neutral[800],   // #444444
  inputPlaceholder: colors.neutral[900], // #222222 (per parity analysis; components use own internal constants)
  buttonDisabledBg: colors.black[500], // #202020
  buttonDisabledText: colors.neutral[800], // #444444
  consentText: colors.neutral[500],    // #A9A9A9
} as const;

// Exact Figma dimensions — scaled for all screen sizes
const FIGMA_DIMENSIONS = {
  contentWidth: s(297),                // Figma: main content width
  containerPadding: s(48),             // (393 - 297) / 2 = 48
  logoWidth: s(32),                    // Figma: vector_1 width
  logoHeight: sv(38.4),               // Figma: vector_1 height
  headingWidth: s(297),                // Figma: letsGetToKnowYou width
  headingHeight: sv(128),             // Figma: letsGetToKnowYou height
  labelWidth: s(193),                  // Figma: label width
  inputWidth: s(193),                  // Figma: input width (phone with prefix)
  inputFullWidth: s(297),              // Figma: input full width (name)
  inputHeight: sv(64),                // Figma: input height
  inputBorderRadius: 12,               // Figma: input borderRadius (keep unscaled)
  inputPadding: sv(16),               // Figma: input paddingTop/Bottom
  inputGap: sv(16),                   // Figma: input gap
  buttonWidth: s(297),                 // Figma: button width
  buttonHeight: sv(56),               // Figma: button height
  buttonRadius: 12,                    // Figma: button borderRadius (keep unscaled)
  consentWidth: s(234.5),              // Figma: consent text width
};

// Figma 4651:150110 — outer container has gap 40 between two child groups.
// Group A (4651:150111): back-arrow / heading / inputs, gap 48.
// Group B (4651:150118): button / consent row, gap 16.
const FIGMA_GAPS = {
  topGroupGap: 48,                     // Group A itemSpacing
  groupsGap: 40,                       // Between Group A and Group B
  formInputsGap: 16,                   // Between phone + name inputs
  bottomGroupGap: 16,                  // Group B itemSpacing
} as const;

export default function SignUpScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const nameInputRef = useRef<RNTextInput>(null);
  const { sendCode, error, isSendingOtp, clearError } = useAuth();
  const setUserName = useAuthStore((s) => s.setUserName);
  const setConsentForMobile360 = useAuthStore((s) => s.setConsentForMobile360);

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [maxDigits, setMaxDigits] = useState(10);
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(true);
  const [phoneBlurError, setPhoneBlurError] = useState<string | undefined>();

  // Check if form is valid
  const isPhoneValid = (() => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== maxDigits) return false;
    // India-specific: first digit must be 6-9
    if (countryCode === '+91') return /^[6-9]/.test(clean);
    return true;
  })();
  const isNameValid = name.trim().length >= 2;
  const isFormValid = isPhoneValid && isNameValid && consent;

  // Error message mapping - only show phone-related errors, not OTP errors
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

  const handleNameChange = useCallback((text: string) => {
    setName(text);
  }, []);

  const handleConsentChange = useCallback((value: boolean) => {
    setConsent(value);
  }, []);

  const handleCountryChange = useCallback((country: { code: string; maxDigits: number }) => {
    setCountryCode(country.code);
    setMaxDigits(country.maxDigits);
    // Clear phone when country changes (different format/length)
    setPhone('');
    if (phoneBlurError) setPhoneBlurError(undefined);
    if (error) clearError();
  }, [error, clearError, phoneBlurError]);

  // Ref-based guard to prevent double-submission before isSendingOtp updates
  const isSendingRef = useRef(false);

  // Reset the ref when the mutation settles
  useEffect(() => {
    if (!isSendingOtp) {
      isSendingRef.current = false;
    }
  }, [isSendingOtp]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (routerRef.current.canGoBack()) {
      routerRef.current.back();
    } else {
      routerRef.current.replace('/(auth)/welcome');
    }
  }, []);

  const handleGetStarted = useCallback(() => {
    if (!isFormValid || isSendingRef.current || isSendingOtp) return;

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode}${cleanPhone}`;

    isSendingRef.current = true;

    setUserName(name.trim());
    setConsentForMobile360(consent);
    sendCode(formattedPhone, name.trim(), () => {
      routerRef.current.push('/(auth)/otp');
    });
  }, [isFormValid, phone, name, consent, countryCode, sendCode, setUserName, setConsentForMobile360, isSendingOtp]);

  const authStatus = useAuthStore((s) => s.status);
  const isAuthSuccess = authStatus === 'authenticated';

  if (isAuthSuccess) {
    return <SkeletonLoader />;
  }

  return (
    <Screen padded={false} testID="sign-up-screen" safeAreaTop={false}>
      {/* Background — orbital halftone with floating coins, Figma image 150 */}
      <Image
        source={SIGNUP_BG}
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
        {/* Main Container — Figma 4651:150110 (centered vertically, gap 40 between groups) */}
        <View style={styles.container}>
          {/* Group A — Figma 4651:150111: back arrow / heading / inputs (gap 48) */}
          <View style={styles.topGroup}>
            <BackButton
              onPress={handleBack}
              style={styles.backButton}
              testID="back-button"
            />

            <Text style={styles.headingGray}>
              Let's get to{'\n'}
              <Text inherit style={styles.headingAccent}>know  you</Text>
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
              <TextInput
                ref={nameInputRef}
                label="Name"
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. John Appleseed"
                keyboardType="default"
                autoCapitalize="words"
                testID="name-input"
              />
            </View>
          </View>

          {/* Group B — Figma 4651:150118: button / consent row (gap 16) */}
          <View style={styles.bottomGroup}>
            <PrimaryButton
              title="Get started"
              onPress={handleGetStarted}
              disabled={!isFormValid}
              loading={isSendingOtp}
              showDivider={true}
              testID="get-started-button"
            />
            <ConsentToggle
              value={consent}
              onValueChange={handleConsentChange}
              testID="consent-toggle"
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  bgImage: {
    position: 'absolute',
    top: sv(44),
    left: s(-48),
    width: s(469),
    height: sv(664),
    opacity: 0.24,
  },
  // Figma 4651:150611 — 32×32, left-aligned within the 297-wide content stack.
  backButton: {
    alignSelf: 'flex-start',
  },
  container: {
    // Figma 4651:150110 — centered vertically (top:50% −translate-y-1/2),
    // 48px horizontal padding, 40px gap between top and bottom groups.
    flex: 1,
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,
    alignItems: 'center',
    justifyContent: 'center',
    gap: FIGMA_GAPS.groupsGap,
  },
  topGroup: {
    // Figma 4651:150111 — back arrow / heading / inputs, gap 48.
    flexDirection: 'column',
    gap: FIGMA_GAPS.topGroupGap,
    width: FIGMA_DIMENSIONS.contentWidth,
  },
  bottomGroup: {
    // Figma 4651:150118 — button / consent row, gap 16.
    flexDirection: 'column',
    gap: FIGMA_GAPS.bottomGroupGap,
    width: FIGMA_DIMENSIONS.contentWidth,
  },
  headingGray: {
    ...typography.h1,
    color: FIGMA_COLORS.headingGray,
    width: FIGMA_DIMENSIONS.headingWidth,
  },
  headingAccent: {
    // Only color override needed - fontSize/lineHeight/fontFamily/letterSpacing
    // inherited from parent Text via `inherit` prop
    color: FIGMA_COLORS.headingAccent,    // #FF9A6D - "know you" orange accent
  },
  formContainer: {
    // Figma 4651:150115 — phone + name inputs, gap 16.
    gap: FIGMA_GAPS.formInputsGap,
  },
});
