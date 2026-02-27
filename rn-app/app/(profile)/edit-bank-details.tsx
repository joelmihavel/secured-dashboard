/**
 * Edit Bank Details Screen
 *
 * Allows users to update their landlord's bank details after onboarding.
 * Reuses the same Cashfree penny drop + name matching verification pipeline.
 * PAN is frozen (read-only) — carried over on the backend.
 *
 * Flow:
 * 1. Pre-fills from dashboard landlordBank data
 * 2. User edits account holder name, account number (+ confirm), IFSC
 * 3. "Verify & Save" fires verify-bank with existing_bank_account_id
 * 4. Backend: safety reset → penny drop → insert new row → copy PAN → set bank_verified
 * 5. On success: fields lock, haptic, 1200ms delay, router.back()
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, TextInput, PrimaryButton, ScreenTitle, AlertBanner, BackButton } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { useDashboard, useVerifyBank, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import type { BankVerificationResponse, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme';

// Colors consistent with profile group screens
const FIGMA_COLORS = {
  background: colors.black[700],
  white: colors.white,
  footer: colors.neutral[500],
} as const;

export default function EditBankDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenancy, landlordBank } = useDashboard();
  const verifyBank = useVerifyBank();

  // Form state — pre-filled from existing bank data
  const [accountHolderName, setAccountHolderName] = useState(
    landlordBank?.account_holder_name ?? ''
  );
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState(landlordBank?.ifsc_code ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Verification result
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);
  const bankVerified = verificationResult?.verified === true;

  // Loading
  const isLoading = verifyBank.isPending;

  // Clear field errors on change
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

  const handleConfirmAccountNumberChange = useCallback((text: string) => {
    setConfirmAccountNumber(text);
    setErrors((prev) => { const { confirmAccountNumber: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  const handleIfscCodeChange = useCallback((text: string) => {
    setIfscCode(text);
    setErrors((prev) => { const { ifscCode: _, ...rest } = prev; return rest; });
    setApiError(null);
  }, []);

  // Validation
  const validateAllFields = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountHolderName.trim()) newErrors.accountHolderName = 'Required';
    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Required';
    } else if (!validateAccountNumber(accountNumber)) {
      newErrors.accountNumber = '9-18 digits required';
    }
    if (!confirmAccountNumber.trim()) {
      newErrors.confirmAccountNumber = 'Required';
    } else if (accountNumber !== confirmAccountNumber) {
      newErrors.confirmAccountNumber = 'Account numbers do not match';
    }
    if (!ifscCode.trim()) {
      newErrors.ifscCode = 'Required';
    } else if (!validateIfscCode(ifscCode)) {
      newErrors.ifscCode = 'Invalid IFSC format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [accountHolderName, accountNumber, confirmAccountNumber, ifscCode]);

  // Can save: all fields filled and not already verified
  const canSave =
    accountHolderName.length > 0 &&
    accountNumber.length > 0 &&
    confirmAccountNumber.length > 0 &&
    ifscCode.length > 0 &&
    !bankVerified;

  // Submit handler
  const handleSave = useCallback(() => {
    if (!validateAllFields()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!tenancy?.id) {
      setApiError('No active tenancy found.');
      return;
    }

    if (!landlordBank?.id) {
      setApiError('No existing bank account found.');
      return;
    }

    setApiError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    verifyBank.mutate(
      {
        tenancyId: tenancy.id,
        accountNumber: accountNumber.replace(/\s/g, ''),
        ifscCode: ifscCode.toUpperCase(),
        accountHolderName: accountHolderName.trim(),
        existingBankAccountId: landlordBank.id,
      },
      {
        onSuccess: (data) => {
          setVerificationResult(data);
          if (data.verified) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => router.back(), 1200);
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
  }, [validateAllFields, tenancy?.id, landlordBank?.id, verifyBank, accountNumber, ifscCode, accountHolderName, router]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  // Masked account number for hint
  const maskedHint = landlordBank?.account_number_masked
    ? `Current: ${landlordBank.account_number_masked}`
    : undefined;

  // Field disabled states
  const fieldsDisabled = isLoading || bankVerified;

  // Per-field success indicator
  const bankFieldSuccess = bankVerified ? 'Verified' : undefined;

  return (
    <Screen testID="edit-bank-details-screen" padded={false}>
      <DottedGridPattern animated={true} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
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
          {/* Back arrow */}
          <BackButton
            onPress={handleBack}
            style={styles.backButton}
            color={FIGMA_COLORS.white}
          />

          <View style={styles.titleContainer}>
            <ScreenTitle gray="Edit your Landlord's " accent="Bank Details" />
          </View>

          {/* API Error Banner */}
          {apiError && <AlertBanner type="error" message={apiError} />}

          {/* Form */}
          <View style={styles.formContainer}>
            <TextInput
              label="Account Holder Name"
              value={accountHolderName}
              onChangeText={handleAccountHolderNameChange}
              placeholder="e.g. John Smith"
              error={errors.accountHolderName}
              success={bankFieldSuccess}
              disabled={fieldsDisabled}
              autoCapitalize="words"
            />

            <TextInput
              label="Account Number"
              value={accountNumber}
              onChangeText={handleAccountNumberChange}
              placeholder="Enter new account number"
              hintText={maskedHint}
              error={errors.accountNumber}
              success={bankFieldSuccess}
              disabled={fieldsDisabled}
              keyboardType="number-pad"
            />

            <TextInput
              label="Confirm Account Number"
              value={confirmAccountNumber}
              onChangeText={handleConfirmAccountNumberChange}
              placeholder="Re-enter account number"
              error={errors.confirmAccountNumber}
              success={bankFieldSuccess}
              disabled={fieldsDisabled}
              keyboardType="number-pad"
            />

            <TextInput
              label="IFSC Code"
              value={ifscCode}
              onChangeText={handleIfscCodeChange}
              placeholder="e.g. SBIN0002125"
              error={errors.ifscCode}
              success={bankFieldSuccess}
              disabled={fieldsDisabled}
              autoCapitalize="characters"
            />

            <TextInput
              label="PAN Card"
              value={landlordBank?.pan_number_masked ?? ''}
              onChangeText={() => {}}
              disabled
              success={landlordBank?.pan_verified ? 'Verified' : undefined}
            />
          </View>

          {/* Button + Footer */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Verify & Save"
              onPress={handleSave}
              showDivider
              loading={isLoading}
              disabled={!canSave || isLoading}
              testID="save-changes-button"
            />

            <Text style={styles.footerText}>
              You may get a verification message from Cashfree to verify your profile and unlock benefits.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 48,
  },
  titleContainer: {
    marginBottom: 48,
  },
  formContainer: {
    gap: 16,
  },
  buttonSection: {
    gap: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footer,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
});
