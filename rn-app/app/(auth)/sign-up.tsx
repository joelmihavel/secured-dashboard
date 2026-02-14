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
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput as RNTextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { Screen, Logo, Text, PrimaryButton, PhoneInput, TextInput } from '@/src/components';
import { DottedPattern, ConsentToggle } from '@/src/components';
import { useAuth } from '@/src/hooks';
import { useAuthStore } from '@/src/stores/auth';
import { colors } from '@/src/theme';

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

// Exact Figma dimensions
const FIGMA_DIMENSIONS = {
  contentWidth: 297,                   // Figma: main content width
  containerPadding: 48,                // (393 - 297) / 2 = 48
  logoWidth: 32,                       // Figma: vector_1 width
  logoHeight: 38.4,                    // Figma: vector_1 height
  headingWidth: 297,                   // Figma: letsGetToKnowYou width
  headingHeight: 128,                  // Figma: letsGetToKnowYou height
  labelWidth: 193,                     // Figma: label width
  inputWidth: 193,                     // Figma: input width (phone with prefix)
  inputFullWidth: 297,                 // Figma: input full width (name)
  inputHeight: 64,                     // Figma: input height
  inputBorderRadius: 12,               // Figma: input borderRadius
  inputPadding: 16,                    // Figma: input paddingTop/Bottom
  inputGap: 16,                        // Figma: input gap
  buttonWidth: 297,                    // Figma: button width
  buttonHeight: 56,                    // Figma: button height
  buttonRadius: 12,                    // Figma: button borderRadius
  consentWidth: 234.5,                 // Figma: consent text width
} as const;

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
  // Since SafeAreaView already handles status bar area (~53px),
  // we add the remaining offset to position content correctly
  contentTopOffset: 48,                // Figma: 101px total - 53px safe area = 48px
} as const;

export default function SignUpScreen() {
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: 'empty' | 'filled' | 'error' }>();
  const nameInputRef = useRef<RNTextInput>(null);
  const { sendCode, status, error, isSendingOtp, clearError } = useAuth();
  const setUserName = useAuthStore((s) => s.setUserName);
  const setConsentForMobile360 = useAuthStore((s) => s.setConsentForMobile360);

  // Mock data for testing states
  const mockData = {
    phone: '9876543210',
    name: 'John Appleseed',
  };

  // Initialize state based on query parameter for automated testing
  const getInitialPhone = () => (state === 'filled' ? mockData.phone : '');
  const getInitialName = () => (state === 'filled' ? mockData.name : '');
  const getInitialConsent = () => true; // Consent enabled by default

  const [phone, setPhone] = useState(getInitialPhone);
  const [name, setName] = useState(getInitialName);
  const [consent, setConsent] = useState(getInitialConsent);
  const [mockError, setMockError] = useState<string | undefined>(
    state === 'error' ? 'Enter valid number' : undefined
  );

  // Check if form is valid
  const isPhoneValid = phone.replace(/\D/g, '').length === 10;
  const isNameValid = name.trim().length >= 2;
  const isFormValid = isPhoneValid && isNameValid && consent;

  // Navigate to OTP screen when OTP is sent
  useEffect(() => {
    if (status === 'otp_sent') {
      router.push('/(auth)/otp');
    }
  }, [status, router]);

  // Error message mapping - only show phone-related errors, not OTP errors
  const getPhoneErrorMessage = (): string | undefined => {
    // Return mock error for testing if set
    if (mockError) return mockError;
    if (!error) return undefined;

    // Only display errors relevant to the phone input step.
    // OTP-related errors (INVALID_OTP, OTP_EXPIRED, MAX_ATTEMPTS, SESSION_ERROR)
    // are handled by the OTP screen and should not leak into the sign-up form.
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
        return undefined;
    }
  };

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(text);
    if (mockError) setMockError(undefined);
    if (error) clearError();
  }, [error, clearError, mockError]);

  const handleNameChange = useCallback((text: string) => {
    setName(text);
  }, []);

  const handleConsentChange = useCallback((value: boolean) => {
    setConsent(value);
  }, []);

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

    // Format phone number: remove non-digits and add +91 country code (E.164 format)
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = `+91${cleanPhone}`;

    isSendingRef.current = true;

    // Store name and consent in auth store (used during OTP verification)
    setUserName(name.trim());
    setConsentForMobile360(consent);
    sendCode(formattedPhone, 'whatsapp');
  }, [isFormValid, phone, name, consent, sendCode, setUserName, setConsentForMobile360, isSendingOtp]);

  return (
    <Screen padded={false} testID="sign-up-screen">
      {/* Background Pattern - uses actual Figma images with correct opacity (8%) */}
      <DottedPattern />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Container - Figma Frame 1686557268 */}
          <View style={styles.container}>
            {/* Inner Stack - Figma Frame 1686557318 with gap: 48 */}
            <View style={styles.innerStack}>
              {/* Logo - Figma: 32x38.4 (Frame 1686557264) */}
              <Logo size={38} />

              {/* Title - Figma 1:29183: "Let's get to " in #A9A9A9, "know you" in #FF9A6D */}
              <Text style={styles.headingGray}>
                Let's get to{'\n'}
                <Text style={styles.headingAccent}>know you</Text>
              </Text>

              {/* Form - Figma Frame 90:2928 with gap: 16 */}
              <View style={styles.formContainer}>
                {/* Phone Input - Figma placeholder: "Enter Number" */}
                <PhoneInput
                  label="Phone"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  error={getPhoneErrorMessage()}
                  placeholder="Enter Number"
                  hintText="edit"
                  testID="phone-input"
                />

                {/* Name Input - Figma placeholder: "e.g. John Appleseed" */}
                <TextInput
                  ref={nameInputRef}
                  label="Name"
                  value={name}
                  onChangeText={handleNameChange}
                  placeholder="e.g. John Appleseed"
                  keyboardType="default"
                  autoCapitalize="words"
                  hintText="edit"
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
                  showDivider={false}
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
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    color: FIGMA_COLORS.headingGray,      // #A9A9A9 - "Let's get to" text (Figma 1:29183)
    width: FIGMA_DIMENSIONS.headingWidth, // 297px per Figma
  },
  headingAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
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
