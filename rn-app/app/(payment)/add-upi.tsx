/**
 * Add UPI Screen
 * Figma Reference: 41-8369 (Pay Rent / Add UPI Payment)
 *
 * PIXEL-PERFECT implementation based on Figma extraction (verified from extracted-values.json):
 *
 * Screen Layout:
 * - Background: #131313 (black.700)
 * - Content paddingHorizontal: 48px (xxxl) - content x: 12018, screen x: 11970, diff: 48
 * - Content paddingTop: 117px (from safe area to back arrow)
 * - Form section gap: 16px between input fields (from layout.gap in Frame 2095586311)
 *
 * Typography (EXACT from Figma extraction):
 * - Title "Add your / UPI Method": 48px/64px, weight 400, letterSpacing -2, textAlign LEFT
 * - Labels: 12px/20px, weight 500, color #A9A9A9, textAlign LEFT
 * - Input text: 20px/32px, weight 400 (bodyLg), color #DDDDDD (filled), #444444 (placeholder)
 * - Edit link: 12px/20px, weight 400 (bodySm), color #878787, textAlign RIGHT
 * - Button text: 16px/24px, weight 500 (Medium), textAlign CENTER
 * - Button disabled: bg #202020, text #444444
 * - Button active: bg #FF9A6D, text #131313
 * - Footer text: 12px/20px, weight 400, color #A9A9A9, textAlign CENTER
 *
 * Colors (EXACT from Figma):
 * - Background: #131313 (colors.black[700])
 * - Title white: #FFFFFF (colors.white)
 * - Title accent: #FF9A6D (colors.brand[500]) - verified from screenshot
 * - Labels: #A9A9A9 (colors.neutral[500])
 * - Edit link: #878787 (colors.neutral[600])
 * - Input placeholder: #444444 (colors.neutral[800])
 * - Input value: #DDDDDD (colors.neutral[200]) - CORRECTED from #FFFFFF
 * - Footer text: #A9A9A9 (colors.neutral[500]) - NOT #CBCBCB
 * - Error text: #FF8080 (colors.error.default)
 * - Button disabled bg: #202020 (colors.black[500])
 * - Button disabled text: #444444 (colors.neutral[800])
 * - Button active bg: #FF9A6D (colors.brand[500])
 * - Button active text: #131313 (colors.black[700])
 *
 * NOTE: No visible underlines in Figma design - inputs have clean appearance
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { useAddUpiVpa, useVerifyUpi } from '@/src/hooks';
import { colors, spacing, typography } from '@/src/theme';

// Design tokens from Figma 41-8369 (VERIFIED from extracted-values.json)
const FIGMA = {
  // Screen dimensions
  screen: {
    width: 393,
    height: 852,
  },
  // Colors mapped to design tokens (EXACT hex values from Figma)
  colors: {
    background: colors.black[700],         // #131313
    titleWhite: colors.white,              // #FFFFFF
    titleAccent: colors.brand[500],        // #FF9A6D
    labelText: colors.neutral[500],        // #A9A9A9
    editLinkText: colors.neutral[600],     // #878787 (from "Hint text" node)
    inputPlaceholder: colors.neutral[800], // #444444 (from "Text" nodes)
    inputValue: colors.neutral[200],        // #DDDDDD (Figma verified)
    footerText: colors.neutral[500],       // #A9A9A9 (CORRECTED - from footer text node)
    errorText: colors.error.default,       // #FF8080
  },
  // Layout values from Figma extraction (VERIFIED)
  layout: {
    paddingHorizontal: spacing.xxxl,       // 48px (content at x:12018, screen at x:11970)
    paddingTop: 117,                       // From Figma position analysis
    contentGap: spacing.xxl,               // 40px between major sections
    fieldGap: spacing.md,                  // 16px between form fields (from Frame 2095586311)
    labelInputGap: spacing.xs,             // 8px between label and input
  },
  // Typography from Figma (EXACT values)
  typography: {
    inputPlaceholder: {
      fontSize: 20,                        // From "Text" nodes: e.g. John Smith
      lineHeight: 32,
      fontWeight: '400' as const,
    },
  },
  // Button states (for disabled/active overrides on PrimaryButton)
  button: {
    disabledBg: colors.black[500],         // #202020
    disabledText: colors.neutral[800],     // #444444
    activeBg: colors.brand[500],           // #FF9A6D
    activeText: colors.black[700],         // #131313
  },
} as const;

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA.colors.titleWhite}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function AddUpiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addUpi = useAddUpiVpa();
  const verifyUpi = useVerifyUpi();

  const [accountName, setAccountName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const validateUpiId = (id: string): boolean => {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    return upiRegex.test(id);
  };

  // Verify UPI VPA before adding
  const handleVerify = useCallback(async () => {
    if (!validateUpiId(upiId)) {
      setError('Please enter a valid UPI ID (e.g., name@upi)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');
    verifyUpi.mutate(
      { upiId: upiId.trim() },
      {
        onSuccess: (data) => {
          if (data.verified) {
            setIsVerified(true);
            // Auto-fill account name from verification if empty
            if (!accountName && data.name) {
              setAccountName(data.name);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            setError('UPI ID could not be verified');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Verification failed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [verifyUpi, upiId, accountName]);

  const handleProceed = useCallback(async () => {
    if (!upiId || !accountName) {
      setError('Please fill in all fields');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!validateUpiId(upiId)) {
      setError('Please enter a valid UPI ID (e.g., name@upi)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    addUpi.mutate(
      {
        vpa: upiId.trim(),
        nickname: accountName.trim(),
        setPrimary: false,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to add UPI');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [addUpi, upiId, accountName, router]);

  const isFormValid = accountName.length > 0 && upiId.includes('@');
  const isLoading = addUpi.isPending || verifyUpi.isPending;

  return (
    <Screen testID="add-upi-screen" padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + FIGMA.layout.paddingTop,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BackArrow />
          </TouchableOpacity>

          {/* Title Section - h1 typography (48px/64px) */}
          <View style={styles.titleSection}>
            <Text style={styles.titleWhite}>Add your</Text>
            <Text style={styles.titleAccent}>UPI Method</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Account Holder Name Field */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Account holder name</Text>
                <Pressable onPress={() => setIsEditingName(true)}>
                  <Text style={styles.editLink}>edit</Text>
                </Pressable>
              </View>
              <RNTextInput
                style={[
                  styles.input,
                  accountName ? styles.inputFilled : styles.inputPlaceholder,
                ]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="e.g. John Smith"
                placeholderTextColor={FIGMA.colors.inputPlaceholder}
                autoCapitalize="words"
                testID="account-name-input"
              />
            </View>

            {/* UPI ID Field */}
            <View style={styles.fieldContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>UPI ID</Text>
                <Pressable onPress={() => setIsEditingUpi(true)}>
                  <Text style={styles.editLink}>edit</Text>
                </Pressable>
              </View>
              <RNTextInput
                style={[
                  styles.input,
                  upiId ? styles.inputFilled : styles.inputPlaceholder,
                ]}
                value={upiId}
                onChangeText={(text) => {
                  setUpiId(text.toLowerCase());
                  setError('');
                }}
                placeholder="e.g. john@oksbi"
                placeholderTextColor={FIGMA.colors.inputPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                testID="upi-id-input"
              />
            </View>

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Verify + Proceed Buttons */}
          {!isVerified && isFormValid ? (
            <PrimaryButton
              title={verifyUpi.isPending ? 'Verifying...' : 'Verify UPI'}
              onPress={handleVerify}
              disabled={!isFormValid || verifyUpi.isPending}
              loading={verifyUpi.isPending}
              testID="verify-upi-button"
            />
          ) : (
            <PrimaryButton
              title="Proceed"
              onPress={handleProceed}
              disabled={!isFormValid}
              loading={addUpi.isPending}
              testID="proceed-button"
            />
          )}

          {/* Footer Text - centered per Figma */}
          <Text style={styles.footerText}>
            This will be used to make rent payments and earn cashback.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Screen container with dark background
  screen: {
    backgroundColor: FIGMA.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Content padding from Figma: px-48, gap-40
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.paddingHorizontal, // 48px
    gap: FIGMA.layout.contentGap, // 40px
  },

  // Back button
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Title section - h1 typography from design tokens
  titleSection: {
    gap: 0, // No gap between title lines
  },
  // Title white part: h1 typography (48px/64px, letterSpacing -2)
  titleWhite: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,         // 48px
    lineHeight: typography.h1.lineHeight,     // 64px
    letterSpacing: typography.h1.letterSpacing, // -2
    fontWeight: typography.h1.fontWeight,     // 400
    color: FIGMA.colors.titleWhite,          // #FFFFFF
    textAlign: 'left' as const,              // Figma: LEFT alignment
  },
  // Title accent part: same h1 typography with accent color
  titleAccent: {
    fontFamily: typography.h1.fontFamily,
    fontSize: typography.h1.fontSize,         // 48px
    lineHeight: typography.h1.lineHeight,     // 64px
    letterSpacing: typography.h1.letterSpacing, // -2
    fontWeight: typography.h1.fontWeight,     // 400
    color: FIGMA.colors.titleAccent,         // #FF9A6D
    textAlign: 'left' as const,              // Figma: LEFT alignment
  },

  // Form section with field gaps (Figma: 16px gap from Frame 2095586311)
  formSection: {
    gap: FIGMA.layout.fieldGap, // 16px between fields
  },

  // Field container
  fieldContainer: {
    gap: FIGMA.layout.labelInputGap, // 8px between label row and input
  },

  // Label row with edit link - justified
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Label text: bodySmMedium (12px/20px, weight 500) - Figma: #A9A9A9
  label: {
    fontFamily: typography.bodySmMedium.fontFamily,
    fontSize: typography.bodySmMedium.fontSize,    // 12px
    lineHeight: typography.bodySmMedium.lineHeight, // 20px
    letterSpacing: typography.bodySmMedium.letterSpacing,
    fontWeight: typography.bodySmMedium.fontWeight, // 500
    color: FIGMA.colors.labelText,                 // #A9A9A9
    textAlign: 'left' as const,                    // Figma: LEFT alignment
  },

  // Edit link: bodySm (12px/20px)
  editLink: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,
    lineHeight: typography.bodySm.lineHeight,
    letterSpacing: typography.bodySm.letterSpacing,
    fontWeight: typography.bodySm.fontWeight,
    color: FIGMA.colors.editLinkText,
    textAlign: 'right', // Figma: RIGHT alignment for hint text
  },

  // Input field: bodyLg (20px/32px) - Figma: 20px input text
  input: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,           // 20px (was 14px - FIXED)
    lineHeight: typography.bodyLg.lineHeight,       // 32px
    letterSpacing: typography.bodyLg.letterSpacing,
    fontWeight: typography.bodyLg.fontWeight,       // 400
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    textAlign: 'left' as const,                    // Figma: LEFT alignment
  },
  inputPlaceholder: {
    color: FIGMA.colors.inputPlaceholder,          // #444444
  },
  inputFilled: {
    color: colors.neutral[200],                    // #DDDDDD (was #FFFFFF - FIXED per Figma)
  },

  // Input underline (NOTE: no visible underlines in Figma design)
  inputUnderline: {
    height: 1,
    backgroundColor: colors.neutral[300],          // #CBCBCB fallback
  },

  // Error text: bodySm (12px/20px)
  errorText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,           // 12px
    lineHeight: typography.bodySm.lineHeight,       // 20px
    letterSpacing: typography.bodySm.letterSpacing,
    fontWeight: typography.bodySm.fontWeight,
    color: FIGMA.colors.errorText,                 // #FF8080
    textAlign: 'left' as const,                    // Figma: LEFT alignment
  },

  // Spacer pushes button to bottom
  spacer: {
    flex: 1,
    minHeight: spacing.xxl, // Minimum 40px
  },

  // Footer text: bodySm (12px/20px), left-aligned - Figma: #A9A9A9
  footerText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,           // 12px (Figma: 12px/20px footer text)
    lineHeight: typography.bodySm.lineHeight,       // 20px
    letterSpacing: typography.bodySm.letterSpacing,
    fontWeight: typography.bodySm.fontWeight,       // 400
    color: FIGMA.colors.footerText,                // #A9A9A9
    marginTop: spacing.md,
    textAlign: 'left' as const,                    // Figma: LEFT alignment (fresh JSON extraction)
  },
});
