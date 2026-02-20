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
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AlertBanner,  Text, TextInput, PrimaryButton, ScreenTitle } from '@/src/components';
import { useVerifyBank, useDashboard, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import type { BankVerificationResponse, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme';

// Figma exact color values from 1-33737 blueprint
const FIGMA_COLORS = {
  background: colors.black[700],
  progressTrack: colors.black[400],
  progressFill: colors.brand[600],
  footer: colors.neutral[500],
  white: colors.white,
} as const;

export default function AddBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const verifyBank = useVerifyBank();
  const { tenancy } = useDashboard();

  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panCard, setPanCard] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<BankVerificationResponse | null>(null);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!accountHolderName.trim()) newErrors.accountHolderName = 'Required';
    if (!accountNumber.trim()) newErrors.accountNumber = 'Required';
    else if (!validateAccountNumber(accountNumber)) newErrors.accountNumber = '9-18 digits required';
    if (!ifscCode.trim()) newErrors.ifscCode = 'Required';
    else if (!validateIfscCode(ifscCode)) newErrors.ifscCode = 'Invalid IFSC format';
    if (!panCard.trim()) newErrors.panCard = 'Required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [accountHolderName, accountNumber, ifscCode, panCard]);

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
    setVerificationResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
            setTimeout(() => router.back(), 1200);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setApiError(
              data.message ||
                `Name mismatch: verified as "${data.verifiedName ?? 'unknown'}". Please check the account holder name.`
            );
          }
        },
        onError: (error: SetupError) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setApiError(error.message || 'Bank verification failed. Please try again.');
        },
      }
    );
  }, [validateForm, verifyBank, accountNumber, ifscCode, accountHolderName, tenancy?.id, router]);

  const isFormValid =
    accountHolderName.length > 0 &&
    accountNumber.length > 0 &&
    ifscCode.length > 0 &&
    panCard.length > 0;

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
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={FIGMA_COLORS.white} />
          </TouchableOpacity>

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

          {/* Verification Success Banner */}
          {verificationResult?.verified && (
            <AlertBanner 
              type="success" 
              message={`Bank verified${verificationResult.bankName ? ` - ${verificationResult.bankName}` : ''}${verificationResult.branch ? `, ${verificationResult.branch}` : ''}`} 
            />
          )}

          {/* Form - Figma: gap 16 between fields */}
          <View style={styles.formContainer}>
            <TextInput
              label="Account Holder Name"
              value={accountHolderName}
              onChangeText={handleAccountHolderNameChange}
              placeholder="e.g. John Smith"
              error={errors.accountHolderName}
              hintText="edit"
              disabled={verifyBank.isPending}
              autoCapitalize="words"
            />

            <TextInput
              label="Account holder number"
              value={accountNumber}
              onChangeText={handleAccountNumberChange}
              placeholder="e.g. 1234567890"
              error={errors.accountNumber}
              hintText="edit"
              disabled={verifyBank.isPending}
              keyboardType="number-pad"
            />

            <TextInput
              label="IFSC Code"
              value={ifscCode}
              onChangeText={handleIfscCodeChange}
              placeholder="e.g. SBIN0002125"
              error={errors.ifscCode}
              hintText="edit"
              disabled={verifyBank.isPending}
              autoCapitalize="characters"
            />

            <TextInput
              label="PAN CARD"
              value={panCard}
              onChangeText={handlePanCardChange}
              placeholder="e.g. CSNPM9874A"
              error={errors.panCard}
              hintText="edit"
              disabled={verifyBank.isPending}
              autoCapitalize="characters"
            />
          </View>

          {/* Button + Footer section - Figma: gap 16 */}
          <View style={styles.buttonSection}>
            <PrimaryButton
              title="Proceed"
              onPress={handleSubmit}
              disabled={!isFormValid}
              loading={verifyBank.isPending}
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
  // Back button - Figma: back arrow icon
  backButton: {
    marginBottom: 40,
  },
  // Title container - Figma: sectionGap 48 below title
  titleContainer: {
    marginBottom: 48,
  },
  // Progress bar - Figma: marginBottom 48 (sectionGap)
  progressContainer: {
    marginBottom: 48,
    width: '100%',
  },
  // Figma: height 12, #4D4D4D track
  progressTrack: {
    height: 12,
    backgroundColor: FIGMA_COLORS.progressTrack,
    width: '100%',
  },
  // Figma: fill width 131px (~44% of 297px content, step 2 of 3)
  progressFill: {
    width: 131,
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
  },
  // Figma: 12px/20px PlusJakartaSans-Regular #A9A9A9
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footer,
    textAlign: 'left',
  },
});
