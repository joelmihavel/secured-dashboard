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

import { Text, PrimaryButton, ScreenTitle } from '@/src/components';
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
// ADD CARD CONTENT
// ==============================================

export function AddCardContent({ paymentId, onBack }: AddMethodContentProps) {
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
    const bankcode = cardData.network === 'amex' ? 'AMEX' : 'CC';

    const outcome = await executePayment(
      'CC',
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
      <ScreenTitle gray="Add your " accent="Card Details" />

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
          title="Save Card"
          onPress={handlePay}
          disabled={!isCardValid || isSubmitting}
          loading={isSubmitting}
          testID="modal-pay-card-button"
        />

        <Text style={styles.footerText}>
          You may get a verification message to verify your Card and unlock benefits.
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
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText,
    textAlign: 'left',
  },
});
