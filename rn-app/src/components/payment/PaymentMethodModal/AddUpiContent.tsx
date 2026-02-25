/**
 * AddUpiContent — UPI Payment Form
 *
 * Extracted from add-upi.tsx for use inside the PaymentMethodModal.
 * Renders inside the modal panel (no Screen wrapper, no safe area).
 *
 * In modal context, we always go directly to payment (no "save for later").
 * Flow: enter UPI ID -> verify -> pay.
 *
 * Figma Reference: 41-8369 (Add UPI Payment)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Text, PrimaryButton, TextInput, ScreenTitle } from '@/src/components';
import { useVerifyUpi } from '@/src/hooks';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { usePaymentStore } from '@/src/stores';
import { colors } from '@/src/theme';

import type { AddMethodContentProps } from './types';

// ==============================================
// FIGMA COLORS
// ==============================================

const FIGMA_COLORS = {
  white: colors.white,
  footerText: colors.neutral[500],
  errorText: colors.error.default,
};

// ==============================================
// BACK ARROW (24x24 chevron, white stroke 2px)
// ==============================================

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

// ==============================================
// ADD UPI CONTENT
// ==============================================

export function AddUpiContent({ paymentId, onBack }: AddMethodContentProps) {
  const verifyUpi = useVerifyUpi();
  const { executePayment } = usePaymentFlow();
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);

  const [accountName, setAccountName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isPayingUpi, setIsPayingUpi] = useState(false);

  const validateUpiId = (id: string): boolean => {
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    return upiRegex.test(id);
  };

  // --- Verify UPI ID ---
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
      },
    );
  }, [verifyUpi, upiId, accountName]);

  // --- Pay via UPI ---
  const handlePayUpi = useCallback(async () => {
    if (isPayingUpi) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPayingUpi(true);

    const outcome = await executePayment(
      'upi',
      { vpa: upiId.trim() },
      paymentId,
      () => {
        setUpiId('');
        setAccountName('');
      },
    );

    if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
      setIsPayingUpi(false);
    }
  }, [isPayingUpi, upiId, paymentId, executePayment]);

  const isFormValid = accountName.length > 0 && upiId.includes('@');
  const isLoading = verifyUpi.isPending || isPayingUpi;
  const formattedAmount = parseFloat(sessionParams?.amount ?? '0').toLocaleString('en-IN');

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onBack();
        }}
        style={styles.backButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Go back to method selection"
      >
        <BackArrow />
      </TouchableOpacity>

      {/* Title */}
      <ScreenTitle gray="Add your " accent="UPI Method" />

      {/* Form Section */}
      <View style={styles.formSection}>
        <TextInput
          label="Account holder name"
          value={accountName}
          onChangeText={setAccountName}
          placeholder="e.g. John Smith"
          hintText="edit"
          autoCapitalize="words"
          testID="modal-account-name-input"
        />

        <TextInput
          label="UPI ID"
          value={upiId}
          onChangeText={(text) => {
            setUpiId(text.toLowerCase());
            setError('');
            setIsVerified(false);
          }}
          placeholder="e.g. john@oksbi"
          hintText="edit"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          testID="modal-upi-id-input"
        />

        {/* Error Message */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>

      {/* Button + Footer Section */}
      <View style={styles.buttonFooterSection}>
        {!isVerified && isFormValid ? (
          <PrimaryButton
            title={verifyUpi.isPending ? 'Verifying...' : 'Proceed'}
            onPress={handleVerify}
            disabled={!isFormValid || verifyUpi.isPending}
            loading={verifyUpi.isPending}
            testID="modal-verify-upi-button"
          />
        ) : isVerified ? (
          <PrimaryButton
            title={`Pay \u20B9${formattedAmount}`}
            onPress={handlePayUpi}
            disabled={!isFormValid || isPayingUpi}
            loading={isPayingUpi}
            testID="modal-pay-upi-button"
          />
        ) : (
          <PrimaryButton
            title="Proceed"
            onPress={handleVerify}
            disabled={!isFormValid}
            testID="modal-verify-upi-disabled-button"
          />
        )}

        {/* Footer Text */}
        <Text style={styles.footerText}>
          This will be used to make rent payments and earn cashback.
        </Text>
      </View>
    </ScrollView>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 48,
    gap: 40,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  formSection: {
    gap: 16,
  },
  buttonFooterSection: {
    gap: 16,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.errorText,
    textAlign: 'left',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    textAlign: 'left',
  },
});
