/**
 * Add Bank Screen
 * Figma Reference: 1-33737 (onboarding / Add Bank Details)
 *
 * EXACT Figma Blueprint Values (1-33737-blueprint.json):
 *
 * Layout hierarchy:
 * - Frame 2095586335: gap 64 (statusbar to content)
 * - Frame 1686557268: padding 48 L/R, gap 40, alignItems center
 * - Frame 1686557318: width 297, gap 48 (main sections)
 *
 * Title: "Add your Landlord's  Bank Details"
 * - Spans [0,20] = #A9A9A9 gray ("Add your Landlord's ")
 * - Spans [21,33] = #FF9A6D accent ("Bank Details")
 * - fontSize 48, lineHeight 64, letterSpacing -2, PlusJakartaSans-Regular
 *
 * Form inputs: 4 fields (Account Holder Name, Account Number, IFSC, PAN CARD)
 * - Label: 12px/20px PlusJakartaSans-Medium #A9A9A9
 * - Hint: 14px/20px PlusJakartaSans-Regular #878787 textAlign right
 * - Input: 20px/32px PlusJakartaSans-Regular placeholder #444444
 * - Form gap: 16px (from Frame 1686557317 layout)
 *
 * Button: "Proceed" 16px/24px PlusJakartaSans-Medium
 * - Disabled: bg #202020, text #444444
 *
 * Footer: 12px/20px PlusJakartaSans-Regular #A9A9A9
 *
 * Flow: Single "Proceed" → bank verification → PAN verification (chained) → add-utility
 *
 * Input state management:
 * - Single submit fires both APIs (bank first, PAN chains on bank success)
 * - Each field shows inline "Verified" (green) or error (red) independently
 * - Bank fields lock after penny drop succeeds, PAN locks after PAN succeeds
 * - On retry: if bank already verified, only PAN re-fires
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AlertBanner, Text, TextInput, PrimaryButton, ScreenTitle, Logo } from '@/src/components';
import { useVerifyBank, useVerifyPan, useDashboard, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import type { BankVerificationResponse, PanVerificationResponse, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme';

// Figma exact color values from 1-33737 blueprint
const FIGMA_COLORS = {
  background: colors.black[700],
  progressTrack: colors.black[400],
  progressFill: colors.brand[600],
  footer: colors.neutral[500],
  white: colors.white,
} as const;

// PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(pan.toUpperCase());
}

export default function AddBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBank = useVerifyBank();
  const verifyPanMutation = useVerifyPan();
  const { tenancy } = useDashboard();

  // Bank form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Verification results
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const [panResult, setPanResult] = useState<PanVerificationResponse | null>(null);

  // Derived verification states
  const bankVerified = verificationResult?.verified === true;
  const panVerified = panResult?.panVerified === true;

  // Clear field-level errors when user types
  const handleAccountHolderNameChange = useCallback((text: string) => {
    setAccountHolderName(text);
    setErrors((prev) => { const { accountHolderName: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleAccountNumberChange = useCallback((text: string) => {
    setAccountNumber(text);
    setErrors((prev) => { const { accountNumber: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleIfscCodeChange = useCallback((text: string) => {
    setIfscCode(text);
    setErrors((prev) => { const { ifscCode: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handlePanCardChange = useCallback((text: string) => {
    setPanCard(text);
    setErrors((prev) => { const { panCard: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  // Validate all fields
  const validateAllFields = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountHolderName.trim()) newErrors.accountHolderName = 'Required';
    if (!accountNumber.trim()) newErrors.accountNumber = 'Required';
    else if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = '9-18 digits required';
    if (!ifscCode.trim()) newErrors.ifscCode = 'Required';
    else if (!validateIfscCode(ifscCode)) newErrors.ifscCode = 'Invalid IFSC format';
    if (!panCard.trim()) newErrors.panCard = 'Required';
    else if (!isValidPanFormat(panCard)) newErrors.panCard = 'Invalid PAN format';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [accountHolderName, accountNumber, ifscCode, panCard]);

  // Fire PAN verification (chained after bank success, or standalone retry)
  const firePanVerification = useCallback((bankAccountId: string) => {
    if (!tenancy?.id) return;

    verifyPanMutation.mutate(
      {
        tenancyId: tenancy.id,
        panNumber: panCard.toUpperCase(),
        bankAccountId,
      },
      {
        onSuccess: (data) => {
          setPanResult(data);
          if (data.panVerified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => router.replace('/(setup)/add-utility' as never), 1200);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setErrors((prev) => ({
              ...prev,
              panCard: data.message || 'PAN check failed',
            }));
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setErrors((prev) => ({
            ...prev,
            panCard: error.message || 'PAN verification failed',
          }));
        },
      }
    );
  }, [tenancy?.id, panCard, verifyPanMutation, router]);

  // Single submit: fires bank verification, then chains PAN on success
  // If bank already verified (retry scenario), skips straight to PAN
  const handleProceed = useCallback(() => {
    if (!validateAllFields()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!tenancy?.id) {
      setApiError('No active tenancy found. Please complete onboarding first.');
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If bank already verified, just retry PAN
    if (bankVerified && verificationResult?.bankAccountId) {
      setPanResult(null);
      setErrors((prev) => { const { panCard: _, ...rest } = prev; return rest; });
      firePanVerification(verificationResult.bankAccountId);
      return;
    }

    // Otherwise fire bank verification, chain PAN on success
    setVerificationResult(null);
    setPanResult(null);

    verifyBank.mutate(
      {
        tenancyId: tenancy.id,
        accountNumber: accountNumber.replace(/\s/g, ''),
        ifscCode: ifscCode.toUpperCase(),
        accountHolderName: accountHolderName.trim(),
      },
      {
        onSuccess: (data) => {
          setVerificationResult(data);
          if (data.verified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Bank passed — immediately fire PAN verification
            firePanVerification(data.bankAccountId);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const bankError = data.message ||
              (data.agreementNameMatched === false
                ? `Account holder "${data.verifiedName ?? 'unknown'}" doesn't match any landlord in your agreement.`
                : `Name mismatch: verified as "${data.verifiedName ?? 'unknown'}".`);
            setErrors((prev) => ({
              ...prev,
              accountHolderName: bankError,
            }));
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Bank verification failed. Please try again.');
          if (error.fields && typeof error.fields === 'object') {
            setErrors((prev) => ({ ...prev, ...error.fields }));
          }
        },
      }
    );
  }, [validateAllFields, tenancy?.id, bankVerified, verificationResult?.bankAccountId, firePanVerification, verifyBank, accountNumber, ifscCode, accountHolderName]);

  // Loading states
  const isLoading = verifyBank.isPending || verifyPanMutation.isPending;

  // Field disabled states
  const bankFieldsDisabled = isLoading || bankVerified;
  const panFieldDisabled = isLoading || panVerified;

  // Form validity
  const allFieldsFilled =
    accountHolderName.length > 0 &&
    accountNumber.length > 0 &&
    ifscCode.length > 0 &&
    panCard.length > 0;

  // Per-field success indicators
  const bankFieldSuccess = bankVerified ? 'Verified' : undefined;
  const panFieldSuccess = panVerified ? 'Verified' : undefined;

  return (
    <View style={styles.container}>
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
          <View style={styles.logoContainer}>
            <Logo size={32} />
          </View>

          {/* Title - Figma: gray="Add your Landlord's " accent="Bank Details" */}
          <View style={styles.titleContainer}>
            <ScreenTitle gray="Add your Landlord's " accent="Bank Details" />
          </View>

          {/* Progress Bar - Figma: height 12, track #4D4D4D, fill #CC7B57 width ~44% (step 2/3) */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={styles.progressFill} />
            </View>
          </View>

          {/* API Error Banner */}
          {apiError && <AlertBanner type="error" message={apiError} />}

          {/* Form - Figma: gap 16 between fields */}
          <View style={styles.formContainer}>
            <TextInput
              label="Account Holder Name"
              value={accountHolderName}
              onChangeText={handleAccountHolderNameChange}
              placeholder="e.g. John Smith"
              error={errors.accountHolderName}
              success={bankFieldSuccess}
              disabled={bankFieldsDisabled}
              autoCapitalize="words"
            />

            <TextInput
              label="Account holder number"
              value={accountNumber}
              onChangeText={handleAccountNumberChange}
              placeholder="e.g. 1234567890"
              error={errors.accountNumber}
              success={bankFieldSuccess}
              disabled={bankFieldsDisabled}
              keyboardType="number-pad"
            />

            <TextInput
              label="IFSC Code"
              value={ifscCode}
              onChangeText={handleIfscCodeChange}
              placeholder="e.g. SBIN0002125"
              error={errors.ifscCode}
              success={bankFieldSuccess}
              disabled={bankFieldsDisabled}
              autoCapitalize="characters"
            />

            <TextInput
              label="PAN CARD"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              success={panFieldSuccess}
              disabled={panFieldDisabled}
              autoCapitalize="characters"
            />
          </View>

          {/* Button + Footer section - Figma: gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Proceed"
              onPress={handleProceed}
              disabled={!allFieldsFilled || (bankVerified && panVerified)}
              loading={isLoading}
            />

            {/* Footer */}
            <Text style={styles.footerText}>
              You may get a verification message from Cashfree to verify your profile and unlock benefits.
            </Text>
          </View>
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
  // Logo container
  logoContainer: {
    alignSelf: 'flex-start',
    marginBottom: 40,
  },
  // Title container - Figma: sectionGap 48 below title
  titleContainer: {
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
  // Figma: fill width 1/3 of full screen (step 1 of 3)
  progressFill: {
    width: '33.33%',
    height: '100%',
    backgroundColor: FIGMA_COLORS.progressFill,
  },
  // Form container - Figma: gap 16
  formContainer: {
    gap: 16,
  },
  // Button + footer section - Figma: gap 16
  buttonSection: {
    gap: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  // Figma: 12px/20px PlusJakartaSans-Regular #A9A9A9
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footer,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
});
