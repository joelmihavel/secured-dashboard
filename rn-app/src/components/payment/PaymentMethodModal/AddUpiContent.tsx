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

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/Input';
import { Text as RNText } from 'react-native';
import { useVerifyUpi } from '@/src/hooks';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { addUpiVpa } from '@/src/services/api/payments';
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
// ADD UPI CONTENT
// ==============================================

export function AddUpiContent({ paymentId, onBack, onInitiatePayment, context = 'payment', onSaveComplete, onReadyForConfirm }: AddMethodContentProps) {
  const isProfile = context === 'profile';
  const verifyUpi = useVerifyUpi();
  const { executePayment } = usePaymentFlow();
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const storedAmount = usePaymentStore((s) => s.amount);

  const [accountName, setAccountName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isPayingUpi, setIsPayingUpi] = useState(false);
  const isPayingRef = useRef(false);

  const validateUpiId = (id: string): string | null => {
    const trimmed = id.trim();
    if (trimmed.length === 0) return 'Enter your UPI ID';
    if (trimmed.includes(' ')) return 'UPI ID cannot contain spaces';
    if (!trimmed.includes('@')) return 'UPI ID must contain @ (e.g., name@upi)';
    if (trimmed.startsWith('@')) return 'Enter your name before the @';
    if (trimmed.endsWith('@')) return 'Enter the UPI handle after @';
    if (trimmed.length < 5) return 'UPI ID is too short';
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(trimmed)) return 'Only letters, numbers, dots and hyphens are allowed';
    return null; // valid
  };

  // --- Verify UPI ID ---
  const handleVerify = useCallback(async () => {
    const validationError = validateUpiId(upiId);
    if (validationError) {
      setError(validationError);
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
            setError('This UPI ID does not exist. Please check and try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : '';
          console.warn('[AddUpiContent] verifyUpi error:', message);

          // In dev, treat verification errors as "skip" so testing isn't blocked
          // PayU sandbox keys can't validate VPAs — skip to unblock testing
          if (__DEV__) {
            console.log('[AddUpiContent] Non-production — skipping VPA verification after error:', message);
            setIsVerified(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return;
          }

          if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
            setError('Could not verify UPI ID. Check your connection.');
          } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('invalid vpa')) {
            setError('This UPI ID does not exist. Please check and try again.');
          } else {
            setError('Could not verify this UPI ID.');
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  }, [verifyUpi, upiId, accountName]);

  // --- Profile context: verify VPA + save in one click ---
  const handleVerifyAndSave = useCallback(async () => {
    if (isPayingRef.current) return;

    const validationError = validateUpiId(upiId);
    if (validationError) {
      setError(validationError);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');
    isPayingRef.current = true;
    setIsPayingUpi(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    verifyUpi.mutate(
      { upiId: upiId.trim() },
      {
        onSuccess: async (data) => {
          if (data.verified) {
            const { error: saveError } = await addUpiVpa(upiId.trim());
            if (saveError) {
              Alert.alert('Save Failed', saveError || 'Could not save UPI ID.');
            } else {
              onSaveComplete?.();
            }
          } else {
            setError('This UPI ID does not exist. Please check and try again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          isPayingRef.current = false;
          setIsPayingUpi(false);
        },
        onError: (err) => {
          if (__DEV__) {
            addUpiVpa(upiId.trim()).then(({ error: saveError }: { error: string | null }) => {
              if (saveError) {
                Alert.alert('Save Failed', saveError || 'Could not save UPI ID.');
              } else {
                onSaveComplete?.();
              }
            }).finally(() => {
              isPayingRef.current = false;
              setIsPayingUpi(false);
            });
            return; // Don't fall through to immediate loading reset
          }
          const message = err instanceof Error ? err.message : '';
          if (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout')) {
            setError('Could not verify UPI ID. Check your connection.');
          } else {
            setError('Could not verify this UPI ID.');
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          isPayingRef.current = false;
          setIsPayingUpi(false);
        },
      },
    );
  }, [verifyUpi, upiId, onSaveComplete]);

  // --- Pay via UPI ---
  const handlePayUpi = useCallback(async () => {
    if (isPayingRef.current) return;
    isPayingRef.current = true;
    setIsPayingUpi(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Profile context: save VPA directly without payment
      if (isProfile && onSaveComplete) {
        const { error: saveError } = await addUpiVpa(upiId.trim());
        if (saveError) {
          Alert.alert('Save Failed', saveError || 'Could not save UPI ID. Please try again.');
          return;
        }
        onSaveComplete();
        return;
      }

      // Payment context with confirm step: save VPA then hand off to confirm
      if (onReadyForConfirm) {
        addUpiVpa(upiId.trim()).catch(() => {});
        onReadyForConfirm('upi', 'upi', { vpa: upiId.trim() }, `UPI \u2022 ${upiId.trim()}`);
        return;
      }

      // UPI must always use S2S — SDK path is not supported.
      // This code path should never be reached since onReadyForConfirm is always provided.
      console.error('[AddUpiContent] UPI SDK path should never be reached — onReadyForConfirm missing');
      setError('UPI payment configuration error. Please try again.');
    } finally {
      isPayingRef.current = false;
      setIsPayingUpi(false);
    }
  }, [upiId, paymentId, executePayment, onInitiatePayment, isProfile, onSaveComplete]);

  const isFormValid = accountName.length > 0 && upiId.includes('@');
  const isLoading = verifyUpi.isPending || isPayingUpi;
  const amount = sessionParams?.amount ?? (storedAmount > 0 ? String(storedAmount) : '0');
  const formattedAmount = parseFloat(amount).toLocaleString('en-IN');

  return (
    <View style={styles.outerContainer}>
      <View style={styles.stickyHeader}>
        <BackButton
          onPress={onBack}
          style={styles.backButton}
          color={FIGMA_COLORS.white}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <RNText style={styles.title}>
          {'Add your\n'}
          <RNText style={styles.titleAccent}>UPI Method</RNText>
        </RNText>

        {/* Form Section */}
        <View style={styles.formSection}>
          <TextInput
            label="Account holder name"
            value={accountName}
            onChangeText={setAccountName}
            placeholder="e.g. John Smith"
            autoCapitalize="words"
            testID="modal-account-name-input"
          />

          <TextInput
            label="UPI ID"
            value={upiId}
            onChangeText={(text) => {
              setUpiId(text.toLowerCase().trim());
              setError('');
              setIsVerified(false);
            }}
            placeholder="e.g. john@oksbi"
            error={error || undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            testID="modal-upi-id-input"
          />
        </View>

        {/* Button + Footer Section */}
        <View style={styles.buttonFooterSection}>
          {isProfile ? (
            <PrimaryButton
              title="Save UPI"
              onPress={handleVerifyAndSave}
              disabled={!isFormValid || isPayingUpi}
              loading={isLoading}
              testID="modal-save-upi-button"
            />
          ) : !isVerified && isFormValid ? (
            <PrimaryButton
              title={verifyUpi.isPending ? 'Verifying...' : 'Proceed'}
              onPress={handleVerify}
              disabled={!isFormValid || verifyUpi.isPending}
              loading={verifyUpi.isPending}
              testID="modal-verify-upi-button"
            />
          ) : isVerified ? (
            <PrimaryButton
              title={parseFloat(amount) > 0 ? `Save & Pay \u20B9${formattedAmount}` : 'Proceed'}
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
    </View>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  outerContainer: {
    paddingTop: 16,
    flexShrink: 1,
  },
  stickyHeader: {
    paddingHorizontal: 48,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 48,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.white,
    textAlign: 'left',
    marginBottom: 24,
  },
  titleAccent: {
    color: colors.brand[500],
  },
  formSection: {
    gap: 16,
    marginBottom: 24,
  },
  buttonFooterSection: {
    gap: 16,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    textAlign: 'left',
  },
});
