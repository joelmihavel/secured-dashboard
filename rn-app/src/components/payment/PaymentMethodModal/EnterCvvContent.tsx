/**
 * EnterCvvContent — CVV-Only Entry for Stored Card Payments
 *
 * Renders a minimal CVV input for saved cards that have a PayU token.
 * Card data (full number) is never collected — only the CVV which goes
 * directly to the PayU SDK, never our server.
 *
 * CVV stored in useRef (never state), cleared in finally block.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput as RNTextInput,
  Alert,
  ScrollView,
  Text as RNText,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { usePaymentStore } from '@/src/stores';
import { colors } from '@/src/theme';

import type { EnterCvvContentProps } from './types';

// ==============================================
// FIGMA COLORS
// ==============================================

const FIGMA_COLORS = {
  white: colors.white,
  footerText: colors.neutral[500],
  accent: colors.brand[500],
  cardPreviewBg: colors.black[500],
  cardPreviewBorder: colors.black[400],
  inputBg: colors.black[500],
  inputBorder: colors.black[400],
  inputText: colors.white,
  placeholder: colors.neutral[500],
  maskedText: '#DDDDDD',
};

// ==============================================
// NETWORK ICON LABEL
// ==============================================

function getNetworkLabel(network: string): string {
  const upper = network.toUpperCase();
  if (upper.includes('VISA')) return 'Visa';
  if (upper.includes('MASTER')) return 'Mastercard';
  if (upper.includes('RUPAY')) return 'RuPay';
  if (upper.includes('AMEX')) return 'Amex';
  if (upper.includes('MAESTRO')) return 'Maestro';
  return network;
}

function getCvvLength(network: string): number {
  return network.toUpperCase().includes('AMEX') ? 4 : 3;
}

// ==============================================
// ENTER CVV CONTENT
// ==============================================

export function EnterCvvContent({
  paymentId,
  onBack,
  cardToken,
  cardType,
  lastFour,
  cardNetwork,
}: EnterCvvContentProps) {
  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const storedAmount = usePaymentStore((s) => s.amount);
  const amount = sessionParams?.amount ?? (storedAmount > 0 ? String(storedAmount) : '0');

  const cvvRef = useRef('');
  const cvvInputRef = useRef<RNTextInput>(null);
  const isSubmittingRef = useRef(false);
  const [cvvDisplay, setCvvDisplay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const maxCvvLength = getCvvLength(cardNetwork);

  const handlePay = useCallback(async () => {
    if (isSubmittingRef.current) return;

    const cvv = cvvRef.current.trim();
    if (cvv.length < maxCvvLength) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid CVV', `Please enter your ${maxCvvLength}-digit CVV.`);
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const currentSessionParams = usePaymentStore.getState().payuSessionParams;
      if (!currentSessionParams) {
        Alert.alert('Session Error', 'Please go back and try again.');
        return;
      }

      const outcome = await executePayment(
        cardType,
        {
          bankcode: cardType,
          store_card_token: cardToken,
          storecard_token_type: '0' as const,
          cvv,
        },
        paymentId,
        () => { cvvRef.current = ''; },
      );

      if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
        // Reset so user can retry
      } else if (outcome.status === 'failure') {
        Alert.alert('Payment Error', outcome.error || 'Unable to process payment. Please try again.');
      }
    } finally {
      cvvRef.current = '';
      setCvvDisplay('');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [paymentId, executePayment, cardToken, cardType, maxCvvLength]);

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
          {'Enter your\n'}
          <RNText style={styles.titleAccent}>CVV</RNText>
        </RNText>

        {/* Card Preview */}
        <View style={styles.cardPreview}>
          <RNText style={styles.cardMasked}>
            {'\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  '}
            {lastFour}
          </RNText>
          <RNText style={styles.cardNetwork}>
            {getNetworkLabel(cardNetwork)}
          </RNText>
        </View>

        {/* CVV Input */}
        <View style={styles.formSection}>
          <RNTextInput
            ref={cvvInputRef}
            style={styles.cvvInput}
            placeholder={`${maxCvvLength}-digit CVV`}
            placeholderTextColor={FIGMA_COLORS.placeholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={maxCvvLength}
            contextMenuHidden
            autoComplete="off"
            textContentType="none"
            value={cvvDisplay}
            onChangeText={(text) => {
              const cleaned = text.replace(/\D/g, '');
              cvvRef.current = cleaned;
              setCvvDisplay(cleaned);
            }}
            autoFocus
            testID="cvv-input"
          />
        </View>

        {/* Pay Button + Footer */}
        <View style={styles.buttonFooterSection}>
          <PrimaryButton
            title={parseFloat(amount) > 0 ? `Pay \u20B9${formattedAmount}` : 'Pay'}
            onPress={handlePay}
            disabled={cvvDisplay.length < maxCvvLength || isSubmitting}
            loading={isSubmitting}
            testID="modal-pay-cvv-button"
          />

          <Text style={styles.footerText}>
            Your CVV is sent directly to the payment gateway and is never stored.
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
  },
  stickyHeader: {
    paddingHorizontal: 48,
  },
  scrollView: {
    flexGrow: 1,
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
  cardPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
  },
  cardMasked: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#DDDDDD',
    letterSpacing: 1,
  },
  cardNetwork: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  formSection: {
    marginBottom: 24,
  },
  cvvInput: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: 8,
  },
  buttonFooterSection: {
    gap: 16,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],
    textAlign: 'left',
  },
});
