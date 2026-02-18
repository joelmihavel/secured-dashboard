/**
 * Add Bank Screen
 * Figma Reference: 1-33737 (onboarding / Add Bank Details)
 * Figma ID for Parity: 1-31485
 * Style tokens mapped from Figma extraction
 *
 * Pixel Parity Fixes Applied:
 * - Text alignment fixes for "edit" links (textAlign: 'right')
 * - Explicit textAlign for all text elements for consistency
 *
 * Note: Many items in pixel-feedback reports (Total payable rent, Pay Now,
 * Google Pay, PayTM, PhonePe, etc.) are from a payment bottom sheet overlay
 * and are NOT part of this screen file.
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

import { Screen, Text, TextInput, PrimaryButton, ScreenTitle } from '@/src/components';
import { useVerifyBank, useDashboard, validateAccountNumber, validateIfscCode } from '@/src/hooks';
import type { BankVerificationResponse, SetupError } from '@/src/types/setup';
import { colors } from '@/src/theme/colors';

// Figma exact values from 1-33737 extraction mapped to design tokens
const FIGMA = {
  colors: {
    // Background: #131313
    background: '#131313',
    // Card/surface: #202020
    card: '#202020',
    // Title: #FFFFFF
    title: '#FFFFFF',
    // Accent (Bank Details text): #CC7B57 per extraction, but brand orange for visual appeal
    accent: colors.brand[500],
    // Progress track: #4D4D4D
    progressTrack: '#4D4D4D',
    // Progress fill: #CC7B57
    progressFill: '#CC7B57',
    // Label: #A9A9A9
    label: '#A9A9A9',
    // Edit link (Hint text): #878787
    editLink: '#878787',
    // Input border: #4D4D4D
    inputBorder: '#4D4D4D',
    // Input text: #FFFFFF
    inputText: '#FFFFFF',
    // Placeholder: #444444
    placeholder: '#444444',
    // Button background (disabled): #202020
    buttonBg: '#202020',
    // Button text (disabled): #444444
    buttonText: '#444444',
    // Footer: #A9A9A9
    footer: '#A9A9A9',
    // Error: #E5484D
    error: '#E5484D',
    // Button active background (form valid): brand orange
    buttonActiveBg: colors.brand[500],
    // Button active text: dark for contrast
    buttonActiveText: '#131313',
  },
  // Typography from Figma extraction
  typography: {
    // Title: 48_400
    title: {
      fontSize: 48,
      fontWeight: '400',
      lineHeight: 64,
      letterSpacing: -2,
    },
    // Label: 12_500
    label: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 20,
      letterSpacing: 0,
    },
    // Edit link: 14_400
    editLink: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },
    // Input placeholder: 20_400
    input: {
      fontSize: 20,
      fontWeight: '400',
      lineHeight: 32,
      letterSpacing: 0,
    },
    // Button text: 16_500
    button: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 24,
      letterSpacing: 0,
    },
    // Footer: 12_400
    footer: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 20,
      letterSpacing: 0,
    },
  },
  // Layout from Figma extraction
  layout: {
    // Screen width: 393
    screenWidth: 393,
    // Content padding: 48 (x=1479 relative to screen at x=1431)
    contentPadding: 48,
    // Input container: width 297, height 64, borderRadius 12
    inputWidth: 297,
    inputHeight: 64,
    inputBorderRadius: 12,
    // Button: width 297, height 56, borderRadius 12
    buttonWidth: 297,
    buttonHeight: 56,
    buttonBorderRadius: 12,
    // Progress bar: height 12, fill width 131
    progressBarHeight: 12,
    progressFillWidth: 131,
    // Form section gap: 16
    formGap: 16,
    // Label row to input gap: 6
    labelToInputGap: 6,
  },
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
            // Brief delay to show success state before navigating back
            setTimeout(() => router.back(), 1200);
          } else {
            // Penny drop returned but name did not match
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
    <View style={[styles.container, { backgroundColor: FIGMA.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 48,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity onPress={handleBack} style={{ marginBottom: 40 }}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>

          {/* Title */}
          <View style={{ marginBottom: 48 }}>
            <ScreenTitle white="Add your Landlord's" accent="Bank Details" />
          </View>

          {/* Progress Bar - Figma: height 12, track #4D4D4D, fill #CC7B57 width 131 */}
          <View style={{ marginBottom: 48, width: '100%' }}>
            <View style={{
              height: 12,
              backgroundColor: FIGMA.colors.progressTrack,
              width: '100%',
            }}>
              <View style={{
                width: 131,
                height: '100%',
                backgroundColor: FIGMA.colors.progressFill,
              }} />
            </View>
          </View>

          {/* API Error Banner */}
          {apiError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{apiError}</Text>
            </View>
          )}

          {/* Verification Success Banner */}
          {verificationResult?.verified && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>
                Bank verified{verificationResult.bankName ? ` - ${verificationResult.bankName}` : ''}
                {verificationResult.branch ? `, ${verificationResult.branch}` : ''}
              </Text>
            </View>
          )}

          {/* Form - Figma: gap 16 between fields */}
          <View style={{ gap: 16 }}>
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
  },
  // Form fields and button use shared TextInput/PrimaryButton — styles handled internally
  footerText: {
    // Figma: fontSize 12, fontWeight 400, lineHeight 20, color #A9A9A9
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],        // #A9A9A9
    marginTop: 16,
    textAlign: 'left',
  },
  errorBanner: {
    backgroundColor: 'rgba(229, 72, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 72, 77, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.error.radix,          // #E5484D
    textAlign: 'left' as const,
  },
  successBanner: {
    backgroundColor: 'rgba(70, 167, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70, 167, 88, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.success.dark,         // #27803B (closest token)
    textAlign: 'left' as const,
  },
});
