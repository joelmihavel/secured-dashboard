/**
 * Add Net Banking / Bank Account Screen
 * Figma Reference: 41-9224 (Pay Rent / Add Bank Account)
 *
 * PIXEL-PERFECT implementation from Figma blueprint:
 *
 * Screen Layout:
 * - Background: #131313 (black.700)
 * - Content paddingHorizontal: 48px
 * - Content y offset: 117px (from top of screen to content frame)
 * - Content gap: 40px between major sections
 * - Inner content gap: 48px between title/form/button groups
 *
 * Title: "Add your  Bank Account"
 * - "Add your " (chars 0-9): #A9A9A9 (gray), NOT white
 * - "Bank Account" (chars 10-22): #FF9A6D (accent)
 * - Font: PlusJakartaSans-Regular, 48px/64px, letterSpacing -2
 *
 * Form Fields:
 * - "Bank name" label: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 *   placeholder: "Select your bank", 20px/32px, #444444
 * - "Account holder name" label: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 *   placeholder: "e.g. John Smith", 20px/32px, #444444
 * - "Account number" label: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 *   placeholder: "e.g. 1234567890", 20px/32px, #444444
 * - "IFSC code" label: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 *   placeholder: "e.g. HDFC0001234", 20px/32px, #444444
 * - Hint "edit": PlusJakartaSans-Regular, 14px/20px, #878787, textAlign RIGHT
 *
 * Button "Save bank account": PlusJakartaSans-Medium, 16px/24px, #444444 (disabled)
 * Footer: PlusJakartaSans-Regular, 12px/20px, #A9A9A9, textAlign LEFT
 */

import React, { useState, useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, TextInput, ScreenTitle } from '@/src/components';
import { useAddPaymentMethod } from '@/src/hooks';
import { colors } from '@/src/theme';

// Figma-exact color constants from blueprint 41-9224
const FIGMA_COLORS = {
  background: colors.black[700],
  titleGray: colors.neutral[500],
  titleAccent: colors.brand[500],
  labelText: colors.neutral[500],
  editLinkText: colors.neutral[600],
  inputPlaceholder: colors.neutral[800],
  inputValue: colors.neutral[200],
  footerText: colors.neutral[500],
  errorText: colors.error.default,
  white: colors.white,
} as const;

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function AddNetbankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addMethod = useAddPaymentMethod();

  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [error, setError] = useState('');

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const validateForm = useCallback((): boolean => {
    if (!bankName.trim()) {
      setError('Please select your bank');
      return false;
    }
    if (!accountHolderName.trim()) {
      setError('Please enter account holder name');
      return false;
    }
    if (!accountNumber.trim() || accountNumber.length < 8) {
      setError('Please enter a valid account number');
      return false;
    }
    if (!ifscCode.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
      setError('Please enter a valid IFSC code');
      return false;
    }
    return true;
  }, [bankName, accountHolderName, accountNumber, ifscCode]);

  const handleSaveBankAccount = useCallback(() => {
    setError('');
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    addMethod.mutate(
      {
        type: 'netbanking',
        details: accountNumber.slice(-4),
        metadata: {
          bankName: bankName.trim(),
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
        },
        isDefault: false,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to add bank account');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [validateForm, addMethod, bankName, accountHolderName, accountNumber, ifscCode, router]);

  const isFormFilled =
    bankName.trim().length > 0 &&
    accountHolderName.trim().length > 0 &&
    accountNumber.trim().length >= 8 &&
    ifscCode.trim().length > 0;

  return (
    <Screen testID="add-netbanking-screen" padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 117,
              paddingBottom: insets.bottom + 24,
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

          {/* Title Section - Figma: "Add your " is #A9A9A9 (gray), NOT white */}
          <ScreenTitle gray="Add your " accent="Bank Account" />

          {/* Form Section - Figma: 16px gap between fields */}
          <View style={styles.formSection}>
            {/* Bank Name */}
            <TextInput
              label="Bank name"
              value={bankName}
              onChangeText={(text) => {
                setBankName(text);
                setError('');
              }}
              placeholder="Select your bank"
              hintText="edit"
              autoCapitalize="words"
              testID="bank-name-input"
            />

            {/* Account Holder Name */}
            <TextInput
              label="Account holder name"
              value={accountHolderName}
              onChangeText={(text) => {
                setAccountHolderName(text);
                setError('');
              }}
              placeholder="e.g. John Smith"
              hintText="edit"
              autoCapitalize="words"
              testID="account-holder-input"
            />

            {/* Account Number */}
            <TextInput
              label="Account number"
              value={accountNumber}
              onChangeText={(text) => {
                setAccountNumber(text.replace(/\D/g, ''));
                setError('');
              }}
              placeholder="e.g. 1234567890"
              hintText="edit"
              keyboardType="number-pad"
              testID="account-number-input"
            />

            {/* IFSC Code */}
            <TextInput
              label="IFSC code"
              value={ifscCode}
              onChangeText={(text) => {
                setIfscCode(text.toUpperCase());
                setError('');
              }}
              placeholder="e.g. HDFC0001234"
              hintText="edit"
              autoCapitalize="characters"
              testID="ifsc-code-input"
            />

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          {/* Spacer pushes button to bottom */}
          <View style={styles.spacer} />

          {/* Save Button - Figma: "Save bank account" 16px/24px, Medium, #444444 disabled */}
          <PrimaryButton
            title="Save bank account"
            onPress={handleSaveBankAccount}
            disabled={!isFormFilled}
            loading={addMethod.isPending}
            testID="save-bank-button"
          />

          {/* Footer Text - Figma: 12px/20px, Regular, #A9A9A9, textAlign LEFT */}
          <Text style={styles.footerText}>
            You may receive a verification message to confirm your bank account and unlock benefits.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA_COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  // Figma: paddingHorizontal 48px, gap 40px between major sections
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 48,
    gap: 40,
  },

  // Back button
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Form section: Figma gap 16px between fields
  formSection: {
    gap: 16,
  },

  // Error text: 12px/20px, Regular, #FF8080
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.errorText,
    textAlign: 'left',
  },

  // Spacer pushes button to bottom
  spacer: {
    flex: 1,
    minHeight: 40,
  },

  // Footer text: Figma 12px/20px, Regular, #A9A9A9, textAlign LEFT
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    marginTop: 16,
    textAlign: 'left',
  },
});
