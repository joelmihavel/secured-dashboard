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
import { View, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Screen, Logo, Text, PrimaryButton, PhoneInput, TextInput, SkeletonLoader } from '@/src/components';
import { DottedGridPattern, ConsentToggle } from '@/src/components';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { colors, typography } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

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

// Exact Figma spacing gaps from enhanced-extraction.json
const FIGMA_GAPS = {
  // Frame 1686557318 (inner stack: Logo, Title, Inputs, Actions) uses itemSpacing: 48
  innerStackGap: 48,                   // Figma Frame 1686557318 itemSpacing: 48
  formInputsGap: 16,                   // Between form inputs (Figma Frame 90:2928 itemSpacing: 16)
  inputLabelGap: 6,                    // Between label and input field (Figma itemSpacing: 6)
  buttonToConsent: 16,                 // Button to consent gap (Figma Frame 1:29185 itemSpacing: 16)
} as const;

// Exact Figma layout positioning
// Screen frame starts at Y=350, Logo (Vector 1) at Y=451
// Total offset from screen top = 451 - 350 = 101px
// SafeAreaView adds ~53px for status bar (Figma "Status Bar" instance height)
// Additional paddingTop needed = 101 - 53 = 48px
const FIGMA_LAYOUT = {
  // SafeAreaView top is disabled, so we use the full 101px offset
  contentTopOffset: sv(101),            // Figma: 101px total from top of screen
};

export default function SignUpScreen() {
  const router = useRouter();
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

  const handleGetStarted = useCallback(() => {
    if (!isFormValid || isSendingRef.current || isSendingOtp) return;

    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = `${countryCode}${cleanPhone}`;

    isSendingRef.current = true;

    setUserName(name.trim());
    setConsentForMobile360(consent);
    sendCode(formattedPhone, name.trim(), () => {
      router.push('/(auth)/otp');
    });
  }, [isFormValid, phone, name, consent, countryCode, sendCode, setUserName, setConsentForMobile360, isSendingOtp, router]);

  const authStatus = useAuthStore((s) => s.status);
  const isAuthSuccess = authStatus === 'authenticated';

  if (isAuthSuccess) {
    return <SkeletonLoader />;
  }

  return (
    <Screen padded={false} testID="sign-up-screen" safeAreaTop={false}>
      {/* Background Pattern - uses actual Figma images with correct opacity (8%) */}
      <DottedGridPattern fadeMask={false} />

      <KeyboardAwareScrollView
        bottomOffset={20}
        style={styles.keyboardView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Main Container - Figma Frame 1686557268 */}
        <View style={styles.container}>
          {/* Inner Stack - Figma Frame 1686557318 with gap: 48 */}
          <View style={styles.innerStack}>
            {/* Logo - Figma: 32.04x38.4 (Frame 1686557264) */}
            <Logo size={38.4} />

            {/* Title - Figma 1:29183: "Let's get to " in #A9A9A9, "know you" in #FF9A6D */}
            <Text style={styles.headingGray}>
              Let's get to{'\n'}
              <Text inherit style={styles.headingAccent}>know  you</Text>
            </Text>

            {/* Form - Figma Frame 90:2928 with gap: 16 */}
            <View style={styles.formContainer}>
              {/* Phone Input - Figma placeholder: "Enter Number" */}
              {/* Figma 1:29108: Hint Text#48:17 = false in empty state; show only when filled */}
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

              {/* Name Input - Figma placeholder: "e.g. John Appleseed" */}
              {/* Figma 1:29108: Hint Text = hidden in empty state; show only when filled */}
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

            {/* Button + Consent - Figma Frame 1:29185 with gap: 16 */}
            <View style={styles.bottomSection}>
              {/* Get Started Button - Figma shows NO divider above button */}
              <PrimaryButton
                title="Get Started"
                onPress={handleGetStarted}
                disabled={!isFormValid}
                loading={isSendingOtp}
                showDivider={true}
                testID="get-started-button"
              />

              {/* Consent Toggle */}
              <ConsentToggle
                value={consent}
                onValueChange={handleConsentChange}
                testID="consent-toggle"
              />
            </View>
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
  container: {
    flex: 1,
    // Figma Frame 1686557268: paddingRight=48, paddingLeft=48, counterAxisAlignItems=CENTER
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding,
    alignItems: 'center',               // Figma: counterAxisAlignItems: CENTER
    // Figma: Content starts at Y=451, screen at Y=350 (101px offset)
    // SafeAreaView handles ~53px status bar, so additional padding = 48px
    paddingTop: FIGMA_LAYOUT.contentTopOffset,
  },
  innerStack: {
    // Figma Frame 1686557318: VERTICAL layout with itemSpacing: 48
    // Contains: Logo, Title, Inputs container, Actions container
    flexDirection: 'column',
    gap: FIGMA_GAPS.innerStackGap,        // 48px per Figma
    width: FIGMA_DIMENSIONS.contentWidth, // 297px per Figma
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
    // Figma Frame 90:2928: VERTICAL layout with itemSpacing: 16
    gap: FIGMA_GAPS.formInputsGap,        // 16px per Figma
  },
  bottomSection: {
    // Figma Frame 1:29185: VERTICAL layout with itemSpacing: 16
    // Contains: Button, Consent toggle row
    gap: FIGMA_GAPS.buttonToConsent,      // 16px per Figma
  },
});
