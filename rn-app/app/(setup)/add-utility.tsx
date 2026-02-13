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
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Screen, Text } from '@/src/components';
import { useVerifyUtility, useUtilityOperators, useDashboard, validateConsumerNumber } from '@/src/hooks';
import type { UtilityOperator, SetupError } from '@/src/types/setup';
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
  const { data: operators, isLoading: operatorsLoading } = useUtilityOperators();

  const [selectedOperator, setSelectedOperator] = useState<UtilityOperator | null>(null);
  const [consumerNumber, setConsumerNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleConsumerNumberChange = useCallback((text: string) => {
    setConsumerNumber(text.replace(/\D/g, ''));
    setErrors((prev) => { const { consumerNumber: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleSelectOperator = useCallback((operator: UtilityOperator) => {
    setSelectedOperator(operator);
    setShowOperatorPicker(false);
    setErrors((prev) => { const { operator: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedOperator) newErrors.operator = 'Please select an operator';
    if (!consumerNumber.trim()) newErrors.consumerNumber = 'Required';
    else if (!validateConsumerNumber(consumerNumber)) newErrors.consumerNumber = '5-30 characters required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedOperator, consumerNumber]);

  const handleSubmit = useCallback(() => {
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!tenancy?.id) {
      setApiError('No active tenancy found. Please complete onboarding first.');
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    verifyUtility.mutate(
      {
        tenancyId: tenancy.id,
        operatorCode: selectedOperator!.operatorCode,
        consumerNumber: consumerNumber.trim(),
      },
      {
        onSuccess: (data) => {
          if (data.verified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => router.back(), 1200);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setApiError(
              data.message || 'Address verification failed. Please check your consumer number and try again.'
            );
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Utility verification failed. Please try again.');
        },
      }
    );
  }, [validateForm, verifyUtility, selectedOperator, consumerNumber, tenancy?.id, router]);

  const isFormValid = !!selectedOperator && validateConsumerNumber(consumerNumber);
  const operatorDisplayName = selectedOperator?.operatorName ?? 'Select Operator';

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

              {/* API Error Banner */}
              {apiError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{apiError}</Text>
                </View>
              )}

              {/* Form - Figma: Frame 90:2928 with gap: 16 */}
              <View style={styles.formContainer}>
                {/* Operator Selector */}
                <View>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Electricity Operator</Text>
                    {errors.operator && (
                      <Text style={styles.errorHint}>{errors.operator}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.inputContainer, errors.operator && styles.inputError]}
                    onPress={() => setShowOperatorPicker(true)}
                    disabled={verifyUtility.isPending}
                  >
                    <Text
                      style={[
                        styles.input,
                        { lineHeight: scaled(FIGMA.dimensions.inputHeight) - scaledSpacing(32) },
                        !selectedOperator && { color: FIGMA.colors.placeholder },
                      ]}
                      numberOfLines={1}
                    >
                      {operatorDisplayName}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={scaled(20)}
                      color={FIGMA.colors.editLink}
                    />
                  </TouchableOpacity>
                </View>

                {/* Consumer Number Input */}
                <View>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>
                      Enter {selectedOperator?.operatorName ?? 'Account'} Number
                    </Text>
                    {errors.consumerNumber ? (
                      <Text style={styles.errorHint}>{errors.consumerNumber}</Text>
                    ) : (
                      <TouchableOpacity>
                        <Text style={styles.editLink}>edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.inputContainer, errors.consumerNumber && styles.inputError]}>
                    <RNTextInput
                      style={[styles.input, { flex: 1 }]}
                      value={consumerNumber}
                      onChangeText={handleConsumerNumberChange}
                      placeholder="e.g. 1234567890"
                      placeholderTextColor={FIGMA.colors.placeholder}
                      keyboardType="number-pad"
                      editable={!verifyUtility.isPending}
                    />
                  </View>
                </View>
              </View>

              {/* Button Section - Figma: gap: 16 */}
              <View style={styles.buttonSection}>
                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.button, isFormValid && !verifyUtility.isPending && styles.buttonActive]}
                  onPress={handleSubmit}
                  disabled={!isFormValid || verifyUtility.isPending}
                >
                  {verifyUtility.isPending ? (
                    <ActivityIndicator size="small" color={FIGMA.colors.buttonTextActive} />
                  ) : (
                    <Text style={[styles.buttonText, isFormValid && styles.buttonTextActive]}>
                      Proceed
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Skip Button */}
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={verifyUtility.isPending}>
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              </View>

              {/* Operator Picker Modal */}
              <Modal
                visible={showOperatorPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowOperatorPicker(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setShowOperatorPicker(false)}
                >
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Select Operator</Text>
                      <TouchableOpacity onPress={() => setShowOperatorPicker(false)}>
                        <Ionicons name="close" size={scaled(24)} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    {operatorsLoading ? (
                      <View style={styles.modalLoading}>
                        <ActivityIndicator size="large" color={FIGMA.colors.accent} />
                      </View>
                    ) : (
                      <FlatList
                        data={operators ?? []}
                        keyExtractor={(item) => item.operatorCode}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.operatorItem,
                              selectedOperator?.operatorCode === item.operatorCode && styles.operatorItemSelected,
                            ]}
                            onPress={() => handleSelectOperator(item)}
                          >
                            <Text style={styles.operatorName}>{item.operatorName}</Text>
                            {item.state && <Text style={styles.operatorState}>{item.state}</Text>}
                          </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </Modal>
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
  // Label - Figma: 12px, line-height 20px, #A9A9A9, fontWeight 500
  label: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(20),
    color: FIGMA.colors.label, // #A9A9A9
    textAlign: 'left',
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
  // Error hint text for inline label errors
  errorHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(14),
    lineHeight: scaledFont(20),
    color: '#E5484D',
    textAlign: 'right' as const,
  },
  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.3)',
    borderRadius: scaled(8),
    padding: scaled(12),
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(13),
    lineHeight: scaledFont(18),
    color: '#E5484D',
    textAlign: 'left' as const,
  },
  // Operator picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: scaled(16),
    borderTopRightRadius: scaled(16),
    maxHeight: '60%',
    paddingBottom: scaledSpacing(32),
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: scaledSpacing(24),
    paddingVertical: scaledSpacing(16),
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: scaledFont(18),
    lineHeight: scaledFont(24),
    color: '#FFFFFF',
  },
  modalLoading: {
    paddingVertical: scaledSpacing(40),
    alignItems: 'center' as const,
  },
  operatorItem: {
    paddingHorizontal: scaledSpacing(24),
    paddingVertical: scaledSpacing(14),
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  operatorItemSelected: {
    backgroundColor: 'rgba(255, 154, 109, 0.08)',
  },
  operatorName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: scaledFont(16),
    lineHeight: scaledFont(22),
    color: '#DDDDDD',
  },
  operatorState: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(12),
    lineHeight: scaledFont(16),
    color: '#878787',
    marginTop: scaledSpacing(2),
  },
});
