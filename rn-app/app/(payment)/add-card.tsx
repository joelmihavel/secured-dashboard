/**
 * Add Card Screen
 * Figma Reference: 41-8529 (Pay Rent / Add Credit Payment)
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
 * Title: "Add your  Credit Card"
 * - "Add your " (chars 0-9): #A9A9A9 (gray), NOT white
 * - "Credit Card" (chars 10-21): #FF9A6D (accent)
 * - Font: PlusJakartaSans-Regular, 48px/64px, letterSpacing -2
 *
 * Labels: PlusJakartaSans-Medium, 12px/20px, #A9A9A9
 * Hint "edit": PlusJakartaSans-Regular, 14px/20px, #878787, textAlign RIGHT
 * Input placeholder: PlusJakartaSans-Regular, 20px/32px, #444444
 * Input value: PlusJakartaSans-Regular, 20px/32px, #DDDDDD
 * Button "Save Card": PlusJakartaSans-Medium, 16px/24px, #444444 (disabled), textAlign CENTER
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

// Figma-exact color constants from blueprint 41-8529
const FIGMA_COLORS = {
  background: '#131313',
  titleGray: '#A9A9A9',
  titleAccent: '#FF9A6D',
  labelText: '#A9A9A9',
  editLinkText: '#878787',
  inputPlaceholder: '#444444',
  inputValue: '#DDDDDD',
  footerText: '#A9A9A9',
  errorText: '#FF8080',
  white: '#FFFFFF',
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

export default function AddCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addMethod = useAddPaymentMethod();

  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ').slice(0, 19) : cleaned;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const getCardType = (number: string): string | null => {
    const cleaned = number.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return null;
  };

  const validateForm = useCallback((): boolean => {
    const cleanedCardNumber = cardNumber.replace(/\s/g, '');

    if (cleanedCardNumber.length < 15) {
      setError('Enter a valid card number');
      return false;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
      setError('Enter valid expiry (MM/YY)');
      return false;
    }

    const [month, year] = expiryDate.split('/').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      setError('Card has expired');
      return false;
    }

    if (cvv.length < 3) {
      setError('Enter valid CVV');
      return false;
    }

    if (!cardholderName.trim()) {
      setError('Enter cardholder name');
      return false;
    }

    return true;
  }, [cardNumber, expiryDate, cvv, cardholderName]);

  const handleSaveCard = useCallback(() => {
    setError('');
    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const cardNetwork = getCardType(cardNumber);

    addMethod.mutate(
      {
        type: 'card',
        details: last4,
        metadata: {
          cardType: cardNetwork ?? 'unknown',
          cardNetwork: cardNetwork ?? 'visa',
          expiryDate,
          cardholderName: cardholderName.trim(),
        },
        isDefault: false,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to add card');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      }
    );
  }, [validateForm, addMethod, cardNumber, cardholderName, expiryDate, router]);

  const isFormFilled =
    cardNumber.replace(/\s/g, '').length >= 15 &&
    expiryDate.length === 5 &&
    cvv.length >= 3 &&
    cardholderName.trim().length > 0;

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
          <ScreenTitle gray="Add your " accent="Credit Card" />

          {/* Form Section - Figma: 16px gap between fields */}
          <View style={styles.formSection}>
            {/* Cardholder Name */}
            <TextInput
              label="Cardholder name"
              value={cardholderName}
              onChangeText={setCardholderName}
              placeholder="e.g. John Smith"
              hintText="edit"
              autoCapitalize="words"
              testID="cardholder-input"
            />

            {/* Card Number */}
            <TextInput
              label="Card number"
              value={cardNumber}
              onChangeText={(text) => {
                setCardNumber(formatCardNumber(text));
                setError('');
              }}
              placeholder="e.g. 1234 5678 9012 3456"
              hintText="edit"
              keyboardType="number-pad"
              maxLength={19}
              testID="card-number-input"
            />

            {/* Expiry Date */}
            <TextInput
              label="Expiry date"
              value={expiryDate}
              onChangeText={(text) => {
                setExpiryDate(formatExpiryDate(text));
                setError('');
              }}
              placeholder="e.g. MM / YY"
              hintText="edit"
              keyboardType="number-pad"
              maxLength={5}
              testID="expiry-input"
            />

            {/* CVV */}
            <TextInput
              label="CVV"
              value={cvv}
              onChangeText={(text) => {
                setCvv(text.replace(/\D/g, ''));
                setError('');
              }}
              placeholder="e.g. ***"
              hintText="edit"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              testID="cvv-input"
            />

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
          </View>

          {/* Spacer pushes button to bottom */}
          <View style={styles.spacer} />

          {/* Save Card Button - Figma: "Save Card" 16px/24px, Medium, #444444 disabled */}
          <PrimaryButton
            title="Save Card"
            onPress={handleSaveCard}
            disabled={!isFormFilled}
            loading={addMethod.isPending}
            testID="save-card-button"
          />

          {/* Footer Text - Figma: 12px/20px, Regular, #A9A9A9, textAlign LEFT */}
          <Text style={styles.footerText}>
            You may get a verification message to verify your Card and unlock benefits.
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
