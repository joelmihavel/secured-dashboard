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
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { Text as RNText } from 'react-native';
import { SecureCardInput, type SecureCardInputRef } from '@/src/components/payment/SecureCardInput';
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
};

// ==============================================
// ADD CARD CONTENT
// ==============================================

export function AddCardContent({ paymentId, onBack, cardType = 'credit', onInitiatePayment }: AddMethodContentProps) {
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const storedAmount = usePaymentStore((s) => s.amount);
  const amount = sessionParams?.amount ?? (storedAmount > 0 ? String(storedAmount) : '0');

  const cardInputRef = useRef<SecureCardInputRef>(null);
  const [isCardValid, setIsCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const handlePay = useCallback(async () => {
    if (!cardInputRef.current || isSubmitting) return;

    const { valid } = cardInputRef.current.validate();
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return; // SecureCardInput already displays field-level errors inline
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

    let currentPaymentId = paymentId;

    // Setup flow: initiate payment first if no paymentId yet
    if (!currentPaymentId && onInitiatePayment) {
      const methodType = cardType === 'credit' ? 'card' as const : 'debit_card' as const;
      const result = await onInitiatePayment(methodType);
      if (!result) {
        setIsSubmitting(false);
        return;
      }
      currentPaymentId = result.paymentId;
    }

    // Re-read sessionParams after potential initiatePayment call
    const currentSessionParams = usePaymentStore.getState().payuSessionParams;
    if (!currentSessionParams) {
      Alert.alert('Session Error', 'Please go back and try again.');
      setIsSubmitting(false);
      return;
    }

    const cardData = cardInputRef.current.getCardData();
    const bankcode = cardType === 'credit' ? 'CC' : 'DC';

    const outcome = await executePayment(
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
      currentPaymentId,
      () => cardInputRef.current?.clearCardData(),
    );

    if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
      setIsSubmitting(false);
    }
    // Other outcomes (navigating, failure) handle their own navigation
  }, [sessionParams, paymentId, isSubmitting, executePayment, onInitiatePayment, cardType]);

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

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Title */}
        <RNText style={styles.title}>
          {'Add your \n'}
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
            title={parseFloat(amount) > 0 ? `Pay \u20B9${formattedAmount}` : 'Save Card Details'}
            onPress={handlePay}
            disabled={!isCardValid || isSubmitting}
            loading={isSubmitting}
            testID="modal-pay-card-button"
          />

          <Text style={styles.footerText}>
            You may receive a verification message to confirm your bank account and unlock benefits.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  outerContainer: {
    paddingTop: 16,
  },
  stickyHeader: {
    paddingHorizontal: 24,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
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
