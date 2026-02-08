/**
 * Add Utility / Verify Address Screen
 * Figma Reference: 1-31590 (Onboarding / Add BESCOM number)
 *
 * PIXEL-PERFECT Figma Values from enhanced-extraction.json:
 * - Background: #131313 (colors.black[700])
 * - Container padding: 48px horizontal (Figma: paddingLeft=48, paddingRight=48)
 * - Main content gap: 48px (Figma: Frame 1686557318 itemSpacing: 48)
 * - Form inputs gap: 16px (Figma: Frame 90:2928 itemSpacing: 16)
 * - Title: "Verify your" (#A9A9A9 neutral.500) + "address" (#FF9A6D brand.500)
 * - Label: 12px, line-height 20px, #A9A9A9
 * - Input: 297px width, 64px height, border #4D4D4D, radius 12px
 * - Button disabled: #202020, text #444444
 * - Button active: #FF9A6D, text #000000
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useVerifyUtility, useDashboard } from '@/src/hooks';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

// Figma exact values from 1-31590 enhanced-extraction.json
const FIGMA = {
  colors: {
    // Background: colors.black[700] from _designTokens
    background: '#131313',
    // Title gray: colors.neutral[500] - matches sign-up heading pattern from Figma
    titleGray: '#A9A9A9',
    // Accent: brand.500 (r=1, g=0.6039, b=0.4274)
    accent: '#FF9A6D',
    // Description: colors.neutral[500]
    description: '#A9A9A9',
    // Progress track: colors.black[400]
    progressTrack: '#4D4D4D',
    // Progress fill: brand accent (slightly darker for progress)
    progressFill: '#CC7B57',
    // Label: colors.neutral[500]
    label: '#A9A9A9',
    // Edit link: colors.neutral[600]
    editLink: '#878787',
    // Input border default: colors.black[400]
    inputBorder: '#4D4D4D',
    // Input border error: Radix error red
    inputBorderError: '#E5484D',
    // Input text: colors.neutral[200]
    inputText: '#DDDDDD',
    // Placeholder: colors.neutral[800]
    placeholder: '#444444',
    // Button background disabled: colors.black[500]
    buttonBg: '#202020',
    // Button text disabled: colors.neutral[800]
    buttonText: '#444444',
    // Skip text: colors.white
    skipText: '#FFFFFF',
    // Active button background: brand.500
    buttonBgActive: '#FF9A6D',
    // Active button text: colors.black
    buttonTextActive: '#000000',
  },
  // Figma layout dimensions from enhanced-extraction
  dimensions: {
    contentWidth: 297,       // Figma: main content width
    containerPadding: 48,    // Figma: (393 - 297) / 2 = 48
    inputHeight: 64,         // Figma: input field height
    inputRadius: 12,         // Figma: input border radius
    buttonHeight: 56,        // Figma: button height
    buttonRadius: 12,        // Figma: button border radius
    progressHeight: 12,      // Figma: progress bar height
  },
  // Figma spacing/gaps from enhanced-extraction itemSpacing values
  gaps: {
    mainStack: 48,           // Figma: Frame 1686557318 itemSpacing: 48
    formInputs: 16,          // Figma: Frame 90:2928 itemSpacing: 16
    labelToInput: 6,         // Figma: label to input gap
    buttonSection: 16,       // Figma: button to skip gap
  },
  // Figma layout offset
  layout: {
    contentTopOffset: 48,    // Figma: 101px total - 53px safe area = 48px
  },
} as const;

export default function AddUtilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyUtility = useVerifyUtility();
  const { tenancy } = useDashboard();

  const [bescomNumber, setBescomNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!bescomNumber.trim()) newErrors.bescomNumber = 'Required';
    else if (bescomNumber.length < 8) newErrors.bescomNumber = 'Invalid';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [bescomNumber]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    verifyUtility.mutate(
      {
        tenancyId: tenancy?.id ?? '',
        operatorCode: 'bescom',
        consumerNumber: bescomNumber.trim(),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      }
    );
  }, [validateForm, verifyUtility, bescomNumber, tenancy?.id, router]);

  const isFormValid = bescomNumber.length >= 8;

  return (
    <View style={[styles.container, { backgroundColor: FIGMA.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + scaledSpacing(FIGMA.layout.contentTopOffset),
              paddingBottom: insets.bottom + scaledSpacing(32),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main Content Container - Figma: paddingHorizontal=48, alignItems=center */}
          <View style={styles.contentContainer}>
            {/* Inner Stack - Figma: Frame 1686557318 with gap: 48 */}
            <View style={styles.innerStack}>
              {/* Back button */}
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={scaled(24)} color="white" />
              </TouchableOpacity>

              {/* Title - Figma: "Verify your" (#A9A9A9) + "address" (#FF9A6D) */}
              {/* Using nested Text for multi-style single-line text per analysis report */}
              <Text style={styles.titleGray}>
                Verify your{'\n'}
                <Text style={styles.titleAccent}>address</Text>
              </Text>

              {/* Description */}
              <Text style={styles.description}>
                Your electricity bill helps us verify your residence.
              </Text>

              {/* Progress Bar - Figma: 297px track width, ~88% fill (262/297) */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={styles.progressFill} />
                </View>
              </View>

              {/* Form - Figma: Frame 90:2928 with gap: 16 */}
              <View style={styles.formContainer}>
                {/* Account Number Input */}
                <View>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Enter BESCOM Account Number</Text>
                    <TouchableOpacity>
                      <Text style={styles.editLink}>edit</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputContainer, errors.bescomNumber && styles.inputError]}>
                    <RNTextInput
                      style={styles.input}
                      value={bescomNumber}
                      onChangeText={(text) => setBescomNumber(text.replace(/\D/g, ''))}
                      placeholder="e.g. 1234567890"
                      placeholderTextColor={FIGMA.colors.placeholder}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Button Section - Figma: gap: 16 */}
              <View style={styles.buttonSection}>
                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.button, isFormValid && styles.buttonActive]}
                  onPress={handleSubmit}
                  disabled={!isFormValid || verifyUtility.isPending}
                >
                  <Text style={[styles.buttonText, isFormValid && styles.buttonTextActive]}>
                    Proceed
                  </Text>
                </TouchableOpacity>

                {/* Skip Button */}
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Main content container - Figma: paddingHorizontal=48, counterAxisAlignItems=CENTER
  contentContainer: {
    flex: 1,
    paddingHorizontal: scaledSpacing(FIGMA.dimensions.containerPadding), // 48px
    alignItems: 'center',
  },
  // Inner stack - Figma: Frame 1686557318 with itemSpacing: 48
  innerStack: {
    width: scaled(FIGMA.dimensions.contentWidth), // 297px
    gap: scaledSpacing(FIGMA.gaps.mainStack), // 48px - main sections gap
  },
  // Back button
  backButton: {
    alignSelf: 'flex-start',
  },
  // Title gray text - Figma: #A9A9A9 (colors.neutral[500])
  titleGray: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(48),
    lineHeight: scaledFont(64),
    letterSpacing: -2,
    color: FIGMA.colors.titleGray, // #A9A9A9 per Figma heading pattern
    width: scaled(FIGMA.dimensions.contentWidth), // 297px
  },
  // Title accent text - Figma: #FF9A6D (brand.500)
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(48),
    lineHeight: scaledFont(64),
    letterSpacing: -2,
    color: FIGMA.colors.accent, // #FF9A6D
  },
  // Description - Figma: 12px, line-height 20px, #A9A9A9
  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(20),
    color: FIGMA.colors.description, // #A9A9A9
  },
  // Progress container - Figma: 297px width
  progressContainer: {
    width: scaled(FIGMA.dimensions.contentWidth), // 297px
  },
  // Progress track - Figma: height 12, backgroundColor #4D4D4D
  progressTrack: {
    height: scaled(FIGMA.dimensions.progressHeight), // 12px
    backgroundColor: FIGMA.colors.progressTrack, // #4D4D4D
    width: '100%',
  },
  // Progress fill - Figma: ~88% fill (262/297)
  progressFill: {
    width: '88%', // 262/297 = ~88%
    height: '100%',
    backgroundColor: FIGMA.colors.progressFill, // #CC7B57
  },
  // Form container - Figma: Frame 90:2928 with gap: 16
  formContainer: {
    gap: scaledSpacing(FIGMA.gaps.formInputs), // 16px
  },
  // Label row
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scaledSpacing(FIGMA.gaps.labelToInput), // 6px
  },
  // Label - Figma: 12px, line-height 20px, #A9A9A9
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(20),
    color: FIGMA.colors.label, // #A9A9A9
  },
  // Edit link - Figma: 14px, line-height 20px, #878787
  editLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(14),
    lineHeight: scaledFont(20),
    color: FIGMA.colors.editLink, // #878787
  },
  // Input container - Figma: 297px width, 64px height, border #4D4D4D, radius 12
  inputContainer: {
    width: scaled(FIGMA.dimensions.contentWidth), // 297px
    height: scaled(FIGMA.dimensions.inputHeight), // 64px
    borderWidth: 1,
    borderColor: FIGMA.colors.inputBorder, // #4D4D4D
    borderRadius: scaled(FIGMA.dimensions.inputRadius), // 12px
    paddingVertical: scaledSpacing(16),
    paddingHorizontal: scaledSpacing(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Input error state
  inputError: {
    borderColor: FIGMA.colors.inputBorderError, // #E5484D
  },
  // Input text - Figma: 20px, line-height 32px
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(20),
    lineHeight: scaledFont(32),
    color: FIGMA.colors.inputText, // #DDDDDD
  },
  // Button section - Figma: gap: 16
  buttonSection: {
    gap: scaledSpacing(FIGMA.gaps.buttonSection), // 16px
    alignItems: 'center',
  },
  // Button disabled - Figma: 297px width, 56px height, #202020 bg, radius 12
  button: {
    width: scaled(FIGMA.dimensions.contentWidth), // 297px
    height: scaled(FIGMA.dimensions.buttonHeight), // 56px
    backgroundColor: FIGMA.colors.buttonBg, // #202020
    borderRadius: scaled(FIGMA.dimensions.buttonRadius), // 12px
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Button active state
  buttonActive: {
    backgroundColor: FIGMA.colors.buttonBgActive, // #FF9A6D
  },
  // Button text disabled - Figma: 16px, line-height 24px, #444444
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(16),
    lineHeight: scaledFont(24),
    color: FIGMA.colors.buttonText, // #444444
  },
  // Button text active
  buttonTextActive: {
    color: FIGMA.colors.buttonTextActive, // #000000
  },
  // Skip button
  skipButton: {
    padding: scaledSpacing(12),
  },
  // Skip text - Figma: 14px, line-height 20px, #FFFFFF
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(14),
    lineHeight: scaledFont(20),
    color: FIGMA.colors.skipText, // #FFFFFF
  },
});
