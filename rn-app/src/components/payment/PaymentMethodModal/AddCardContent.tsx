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
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Text, PrimaryButton, BackButton } from '@/src/components';
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

export function AddCardContent({ paymentId, onBack, cardType = 'credit' }: AddMethodContentProps) {
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const amount = sessionParams?.amount ?? '0';

  const cardInputRef = useRef<SecureCardInputRef>(null);
  const [isCardValid, setIsCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const handlePay = useCallback(async () => {
    if (!cardInputRef.current || isSubmitting) return;

    const { valid, errors } = cardInputRef.current.validate();
    if (!valid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (errors.length > 0) {
        Alert.alert('Card Error', errors[0]);
      }
      return;
    }

    if (!sessionParams) {
      Alert.alert('Session Expired', 'Please go back and try again.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

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
      paymentId,
      () => cardInputRef.current?.clearCardData(),
    );

    if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
      setIsSubmitting(false);
    }
    // Other outcomes (navigating, failure) handle their own navigation
  }, [sessionParams, paymentId, isSubmitting, executePayment]);

  const formattedAmount = parseFloat(amount).toLocaleString('en-IN');

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Back Button */}
      <BackButton
        onPress={onBack}
        style={styles.backButton}
        color={FIGMA_COLORS.white}
      />

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
    paddingTop: 16,
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
    marginBottom: 32,
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
