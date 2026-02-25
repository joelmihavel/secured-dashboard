/**
 * Add Card Screen — Card payment via PayU Core SDK
 *
 * Uses SecureCardInput for native card fields + CBWrapper for 3DS/OTP.
 * Card data stored in refs (never state), zeroed immediately after SDK call.
 *
 * Flow:
 * 1. Reads payuSessionParams from Zustand (set by initiate.tsx)
 * 2. User fills card details via SecureCardInput
 * 3. Tap "Pay ₹X" → usePaymentFlow.executePayment('CC', cardParams, clearCardData)
 * 4. SDK Custom Browser opens for 3DS/OTP
 * 5. Outcome → processing / stay / failed
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, ScreenTitle } from '@/src/components';
import { SecureCardInput, type SecureCardInputRef } from '@/src/components/payment/SecureCardInput';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { usePaymentStore } from '@/src/stores';
import { colors } from '@/src/theme';

const FIGMA_COLORS = {
  background: colors.black[700],
  white: colors.white,
  footerText: colors.neutral[500],
} as const;

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

export default function AddCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ paymentId?: string }>();
  const paymentId = params.paymentId ?? '';

  const sessionParams = usePaymentStore((s) => s.payuSessionParams);
  const amount = sessionParams?.amount ?? '0';

  const cardInputRef = useRef<SecureCardInputRef>(null);
  const [isCardValid, setIsCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { executePayment } = usePaymentFlow();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

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
        store_card: '0',
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
    <Screen testID="add-card-screen" padded={false} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 64,
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
              title={`Pay \u20B9${formattedAmount}`}
              onPress={handlePay}
              disabled={!isCardValid || isSubmitting}
              loading={isSubmitting}
              testID="pay-card-button"
            />

            <Text style={styles.footerText}>
              Your card details are securely transmitted directly to PayU's PCI DSS Level 1 servers.
            </Text>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 48,
    gap: 40,
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
