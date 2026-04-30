/**
 * Add Utility / Verify Address Screen
 * Figma Reference: 1-34343 (onboarding / Add BESCOM Number)
 *
 * EXACT Figma Blueprint Values (1-34343-blueprint.json):
 *
 * Layout hierarchy:
 * - Frame 2095586335: gap 64 (statusbar to content)
 * - Frame 1686557268: padding 48 L/R, gap 40, alignItems center
 * - Frame 1686557318: width 297, gap 48 (main sections)
 *
 * Title: "Verify your address"
 * - Spans [0,6] = #A9A9A9 gray ("Verify")
 * - Spans [7,19] = #FF9A6D accent ("your address")
 * - fontSize 48, lineHeight 64, letterSpacing -2, PlusJakartaSans-Regular
 *
 * Description: "Your electricity bill helps us verify your residence."
 * - 12px/20px PlusJakartaSans-Regular #A9A9A9
 *
 * Input: "Enter BESCOM Account Number"
 * - Label: 12px/20px PlusJakartaSans-Medium #A9A9A9
 * - Hint: 14px/20px PlusJakartaSans-Regular #878787
 * - Placeholder: 20px/32px PlusJakartaSans-Regular #444444
 *
 * Button: "Proceed" 16px/24px PlusJakartaSans-Medium disabled:#444444
 * Skip: 14px/20px PlusJakartaSans-Medium #FFFFFF
 *
 * Progress: height 12, track #4D4D4D, fill ~88% #CC7B57
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AlertBanner,  Text, TextInput, PrimaryButton, ScreenTitle, BackButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns/DottedGridPattern';
import { useVerifyUtility, useUtilityOperators, useDashboard, validateConsumerNumber } from '@/src/hooks';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { UtilityOperator, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme';

// Optimistic default shown before the operator API resolves. Replaced silently
// with the canonical record once useUtilityOperators() returns.
const BESCOM_STUB: UtilityOperator = {
  operatorCode: 'BESC',
  operatorName: 'Bangalore Electricity Supply Co. Ltd.',
  state: 'Karnataka',
};

// Figma exact color values from 1-34343 blueprint
const FIGMA_COLORS = {
  background: colors.black[700],
  description: colors.neutral[500],
  progressTrack: colors.black[400],
  progressFill: colors.brand[600],
  inputBorder: colors.black[400],
  inputBorderError: colors.error.radix,
  inputText: colors.neutral[200],
  placeholder: colors.neutral[800],
  editLink: colors.neutral[600],
  skipText: colors.white,
  accent: colors.brand[500],
  white: colors.white,
} as const;

export default function AddUtilityScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const verifyUtility = useVerifyUtility();
  const { tenancy } = useDashboard();
  const { data: operators, isLoading: operatorsLoading, isError: operatorsError, refetch: refetchOperators } = useUtilityOperators();

  // Pre-seed with a BESCOM stub so the selector shows the correct text on first
  // paint (no "Select Operator" placeholder flash). The effect below silently
  // swaps in the canonical API record once operators resolve, or clears the
  // stub if the API doesn't return BESCOM.
  const [selectedOperator, setSelectedOperator] = useState<UtilityOperator | null>(BESCOM_STUB);
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);
  const [consumerNumber, setConsumerNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);
  const [verified, setVerified] = useState(false);
  // Use ref for landlordApproved to avoid stale closure in handleSubmit
  const landlordApprovedRef = useRef(false);

  // Animated progress bar
  const progress = useSharedValue(33.33);
  React.useEffect(() => {
    progress.value = withTiming(66.67, { duration: 500 });
  }, []);
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value}%`,
      height: '100%',
      backgroundColor: FIGMA_COLORS.progressFill,
    };
  });

  // Replace the BESCOM stub with the canonical API record once operators load.
  // Skips if the user has already confirmed a selection. If the API doesn't
  // return BESCOM, clear the stub so the user is forced to pick.
  React.useEffect(() => {
    if (!operators || operatorConfirmed) return;
    const name = (n: string) => n.toUpperCase();
    const defaultOp = operators.find(op =>
      name(op.operatorName).includes('BESCOM') ||
      name(op.operatorName).includes('BESSCOM') ||
      name(op.operatorName).includes('BANGALORE ELECTRICITY') ||
      op.operatorCode === 'BESC'
    );
    setSelectedOperator(defaultOp ?? null);
    setOperatorConfirmed(true);
  }, [operators, operatorConfirmed]);

  const landlordApproved = tenancy?.verification_status?.landlord_approved ?? false;
  landlordApprovedRef.current = landlordApproved;

  const handleBack = useCallback(() => {
    routerRef.current.back();
  }, []);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (landlordApproved) {
      routerRef.current.replace('/(main)' as never);
    } else {
      routerRef.current.push('/(setup)/invite-landlord' as never);
    }
  }, [landlordApproved]);

  const handleConsumerNumberChange = useCallback((text: string) => {
    setConsumerNumber(text.replace(/\D/g, ''));
    setErrors((prev) => { const { consumerNumber: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleSelectOperator = useCallback((operator: UtilityOperator) => {
    setSelectedOperator(operator);
    setOperatorConfirmed(true);
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
            setVerified(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
              if (landlordApprovedRef.current) {
                routerRef.current.replace('/(main)' as never);
              } else {
                routerRef.current.push('/(setup)/invite-landlord' as never);
              }
            }, 1200);
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
          if (error.fields && typeof error.fields === 'object') {
            setErrors((prev) => ({ ...prev, ...error.fields }));
          }
        },
      }
    );
  }, [validateForm, verifyUtility, selectedOperator, consumerNumber, tenancy?.id]);

  // Block submit until we've matched the stub against the real operator list —
  // submitting with the stub's 'BESC' code would fail if API uses a different code.
  const isFormValid = !!selectedOperator && operatorConfirmed && validateConsumerNumber(consumerNumber);
  const operatorDisplayName = selectedOperator?.operatorName ?? 'Select Operator';

  return (
    <View style={styles.container}>
      <DottedGridPattern fadeMask={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <BackButton
            onPress={handleBack}
            style={styles.backButton}
            color={FIGMA_COLORS.white}
          />

          {/* Title - Figma: gray="Verify" accent="your address" */}
          <View style={styles.titleContainer}>
            <ScreenTitle gray="Verify your" accent="address" />
          </View>

          {/* Description - Figma: 12px/20px PlusJakartaSans-Regular #A9A9A9 */}
          <Text style={styles.description}>
            Your electricity bill helps us verify your residence.
          </Text>

          {/* Progress Bar - Figma: height 12, ~88% fill (step 3/3) */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={animatedProgressStyle} />
            </View>
          </View>

          {/* API Error Banner — constrained to content width */}
          {apiError && <View style={{ width: '100%' }}><AlertBanner type="error" message={apiError} /></View>}

          {/* Form - Figma: gap 16 */}
          <View style={styles.formContainer}>
            {/* Operator Selector */}
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Select Operator</Text>
                {errors.operator && (
                  <Text style={styles.errorHint}>{errors.operator}</Text>
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.operatorSelector,
                  showOperatorPicker && styles.operatorSelectorFocused,
                  errors.operator && styles.operatorSelectorError
                ]}
                onPress={() => setShowOperatorPicker(true)}
                disabled={verifyUtility.isPending}
              >
                <Text
                  style={[
                    styles.inputText,
                    !selectedOperator && styles.inputPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {operatorDisplayName}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={FIGMA_COLORS.editLink}
                />
              </TouchableOpacity>
            </View>

            {/* Consumer Number Input — Figma: "Enter BESCOM Account Number" */}
            <TextInput
              label="Enter Account Number"
              value={consumerNumber}
              onChangeText={handleConsumerNumberChange}
              placeholder="e.g. 1234567890"
              error={errors.consumerNumber}
              disabled={verifyUtility.isPending}
              keyboardType="number-pad"
            />
          </View>

          {/* Button Section - Figma: gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title={verified ? 'Verified ✓' : 'Proceed'}
              onPress={handleSubmit}
              disabled={!isFormValid || verified}
              loading={verifyUtility.isPending}
            />

            {/* Skip Button - Figma: 14px/20px PlusJakartaSans-Medium #FFFFFF */}
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
                    <Ionicons name="close" size={24} color={FIGMA_COLORS.white} />
                  </TouchableOpacity>
                </View>
                {operatorsLoading ? (
                  <View style={styles.modalLoading}>
                    <ActivityIndicator size="large" color={FIGMA_COLORS.accent} />
                  </View>
                ) : operatorsError || !operators?.length ? (
                  <View style={styles.modalLoading}>
                    <Text style={[styles.operatorName, { textAlign: 'center', marginBottom: 16 }]}>
                      Failed to load operators
                    </Text>
                    <TouchableOpacity
                      onPress={() => refetchOperators()}
                      style={{ paddingVertical: 12, paddingHorizontal: 24, backgroundColor: FIGMA_COLORS.accent, borderRadius: 12 }}
                    >
                      <Text style={{ fontFamily: 'PlusJakartaSans-Medium', fontSize: 14, color: colors.white }}>
                        Retry
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={operators}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },
  flex: {
    flex: 1,
  },
  // Back button
  backButton: {
    marginBottom: 40,
  },
  // Title container - gap 16 to description (matching invite-landlord titleSection gap: 16)
  titleContainer: {
    marginBottom: 16,
  },
  // Description - Figma: 12px/20px PlusJakartaSans-Regular #A9A9A9
  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.description,
    marginBottom: 48,
  },
  // Progress bar - Figma: Full width
  progressContainer: {
    marginBottom: 48,
    marginHorizontal: -48,
    width: Dimensions.get('window').width,
    height: 3,
    overflow: 'hidden',
  },
  // Figma: height 12, #4D4D4D track
  progressTrack: {
    height: 12,
    backgroundColor: FIGMA_COLORS.progressTrack,
    width: '100%',
  },
  // Figma: ~88% fill (step 3 of 3)
  progressFill: {
    width: '88%',
    height: '100%',
    backgroundColor: FIGMA_COLORS.progressFill,
  },
  // Form container - Figma: gap 16
  formContainer: {
    gap: 16,
  },
  // Label row - Figma: flexDirection row, justifyContent space-between
  labelRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  // Label - Figma: 12px/20px PlusJakartaSans-Regular #A9A9A9
  label: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],
    textAlign: 'left',
  },
  // Operator selector - full border style matching TextInput default
  operatorSelector: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Operator selector error state
  operatorSelectorError: {
    borderColor: FIGMA_COLORS.inputBorderError,
  },
  // Operator selector focused state
  operatorSelectorFocused: {
    borderColor: FIGMA_COLORS.accent,
  },
  // Input text - Figma: 20px/32px PlusJakartaSans-Regular #DDDDDD
  inputText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.inputText,
  },
  // Placeholder state
  inputPlaceholder: {
    color: FIGMA_COLORS.placeholder,
  },
  // Error hint
  errorHint: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.error.radix,
    textAlign: 'right' as const,
  },
  // Button section - Figma: gap 16
  buttonSection: {
    gap: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  // Skip button - Figma: padding 12
  skipButton: {
    padding: 12,
  },
  // Skip text - Figma: 14px/20px PlusJakartaSans-Medium #FFFFFF
  skipText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.skipText,
  },
  // Operator picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.black[600],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.white,
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: 'center' as const,
  },
  operatorItem: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  operatorItemSelected: {
    backgroundColor: 'rgba(255, 154, 109, 0.08)',
  },
  operatorName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: colors.neutral[200],
  },
  operatorState: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[600],
    marginTop: 2,
  },
});
