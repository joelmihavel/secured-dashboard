/**
 * AddCardContent — Card Payment Form
 *
 * Extracted from add-card.tsx for use inside the PaymentMethodModal.
 * Renders inside the modal panel (no Screen wrapper, no safe area).
 *
 * Uses SecureCardInput for native card fields + usePaymentFlow for SDK launch.
 * Card data stored in refs (never state), zeroed immediately after SDK call.
 *
 * CRITICAL: This component is conditionally rendered (not display:none) so that
 * SecureCardInput refs are properly destroyed when switching modal views.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { Text as RNText } from 'react-native';
import { SecureCardInput, type SecureCardInputRef } from '@/src/components/payment/SecureCardInput';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { launchCorePayment } from '@/src/services/payment/payuCoreService';
import { addCardToken } from '@/src/services/api/payments';
import { usePaymentStore } from '@/src/stores';
import { colors } from '@/src/theme';

import type { AddMethodContentProps } from './types';

// ==============================================
// FIGMA COLORS
// ==============================================

const FIGMA_COLORS = {
  white: colors.white,
  footerText: colors.neutral[500],
};

// ==============================================
// ADD CARD CONTENT
// ==============================================

export function AddCardContent({ paymentId, onBack, cardType = 'credit', onInitiatePayment, context = 'payment', onSaveComplete, onReadyForConfirm }: AddMethodContentProps) {
  const isProfile = context === 'profile';
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const storedAmount = usePaymentStore((s) => s.amount);
  const { clearPayuSessionParams } = usePaymentStore();
  const amount = isProfile ? '1' : (sessionParams?.amount ?? (storedAmount > 0 ? String(storedAmount) : '0'));

  const cardInputRef = useRef<SecureCardInputRef>(null);
  const isSubmittingRef = useRef(false);
  const [isCardValid, setIsCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const handlePay = useCallback(async () => {
    if (!cardInputRef.current || isSubmittingRef.current) return;

    const { valid } = cardInputRef.current.validate();
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Payment context with confirm step: extract card data, skip initiation.
      // handleConfirmPay in the orchestrator handles initiation after user confirms.
      if (onReadyForConfirm) {
        if (!cardInputRef.current) {
          Alert.alert('Error', 'Card form was reset. Please try again.');
          return;
        }
        const cardData = cardInputRef.current.getCardData();
        const bankcode = cardType === 'credit' ? 'CC' : 'DC';
        const methodTypeForConfirm = cardType === 'credit' ? 'card' as const : 'debit_card' as const;
        const label = cardType === 'credit' ? 'Credit Card' : 'Debit Card';
        onReadyForConfirm(
          methodTypeForConfirm,
          bankcode,
          {
            bankcode,
            card_number: cardData.cardNumber,
            cvv: cardData.cvv,
            expiry_year: cardData.expiryYear,
            expiry_month: cardData.expiryMonth,
            name_on_card: cardData.nameOnCard,
            store_card: '1',
          },
          label,
          () => cardInputRef.current?.clearCardData(),
        );
        return;
      }

      let currentPaymentId = paymentId;

      // Setup flow: initiate payment first if no paymentId yet
      if (!currentPaymentId && onInitiatePayment) {
        const methodType = cardType === 'credit' ? 'card' as const : 'debit_card' as const;
        const result = await onInitiatePayment(methodType);
        if (!result) {
          return;
        }
        currentPaymentId = result.paymentId;
      }

      // Re-read sessionParams after potential initiatePayment/verifyCard call
      const currentSessionParams = usePaymentStore.getState().payuSessionParams;
      if (!currentSessionParams) {
        Alert.alert('Session Error', 'Please go back and try again.');
        return;
      }

      if (!cardInputRef.current) {
        Alert.alert('Error', 'Card form was reset. Please try again.');
        return;
      }
      const cardData = cardInputRef.current.getCardData();
      const bankcode = cardType === 'credit' ? 'CC' : 'DC';
      const instrumentParams = {
        bankcode,
        card_number: cardData.cardNumber,
        cvv: cardData.cvv,
        expiry_year: cardData.expiryYear,
        expiry_month: cardData.expiryMonth,
        name_on_card: cardData.nameOnCard,
        store_card: '1',
      };

      // Profile context: Rs.1 verification — use launchCorePayment directly
      // (executePayment navigates to status screen which we don't want)
      if (isProfile && onSaveComplete) {
        const sdkOutcome = await launchCorePayment(bankcode, currentSessionParams, instrumentParams);
        cardInputRef.current?.clearCardData();
        clearPayuSessionParams();

        if (sdkOutcome.status === 'success') {
          // Save card token client-side (webhook also saves as backup)
          const payuResponse = sdkOutcome.payuResponse ?? {};
          if (payuResponse.store_card_token) {
            addCardToken({
              card_token: String(payuResponse.store_card_token),
              card_last4: String(payuResponse.card_no ?? '').slice(-4),
              card_network: (String(payuResponse.bankcode ?? '').toLowerCase()) as 'visa' | 'mastercard' | 'rupay' | 'amex' | 'maestro',
              card_type: cardType === 'credit' ? 'credit' : 'debit',
              ...(Number(payuResponse.card_expiry_month) ? { card_expiry_month: Number(payuResponse.card_expiry_month) } : {}),
              ...(Number(payuResponse.card_expiry_year) ? { card_expiry_year: Number(payuResponse.card_expiry_year) } : {}),
            }).catch(() => {});
          }
          onSaveComplete();
        } else if (sdkOutcome.status === 'failure') {
          Alert.alert('Verification Failed', sdkOutcome.error || 'Card verification failed. Please try again.');
        }
        // cancelled/other: stay on form for retry
        return;
      }

      // Fallback: direct payment via executePayment (navigates to status)
      const outcome = await executePayment(
        bankcode,
        instrumentParams,
        currentPaymentId,
        () => cardInputRef.current?.clearCardData(),
      );

      if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
        // Reset so user can retry
      } else if (outcome.status === 'failure') {
        Alert.alert('Payment Error', outcome.error || 'Unable to process payment. Please try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [paymentId, executePayment, onInitiatePayment, cardType, isProfile, onSaveComplete, clearPayuSessionParams, onReadyForConfirm]);

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
          <RNText style={styles.titleAccent}>{cardType === 'credit' ? 'Credit Card' : 'Debit Card'}</RNText>
        </RNText>

        {/* Card Input */}
        <View style={styles.formSection}>
          <SecureCardInput
            ref={cardInputRef}
            onValidityChange={setIsCardValid}
          />
        </View>

        {/* Pay Button + Footer */}
        <View style={styles.buttonFooterSection}>
          <PrimaryButton
            title={isProfile ? 'Verify Card (\u20B91)' : (parseFloat(amount) > 0 ? `Save & Pay \u20B9${formattedAmount}` : 'Save Card Details')}
            onPress={handlePay}
            disabled={!isCardValid || isSubmitting}
            loading={isSubmitting}
            testID="modal-pay-card-button"
          />

          <Text style={styles.footerText}>
            You may receive a verification message to confirm your bank account and unlock benefits.
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
    marginBottom: 30,
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
    marginBottom: 16,
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
