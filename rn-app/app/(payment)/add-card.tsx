/**
 * Add Card Screen
 * Figma Reference: 41-8450 (Pay Rent / Add Credit Payment)
 *
 * Pixel-perfect implementation from Figma extracted values:
 *
 * TOP SECTION (dark background #131313):
 * - Title "Edit your" - fontSize 48, lineHeight 64, letterSpacing -2, color #FFFFFF (h1)
 * - "Credit Card" - fontSize 48, lineHeight 64, letterSpacing -2, color #FF9A6D (h1 accent)
 * - Labels - fontSize 12, lineHeight 20, fontWeight 500, color #A9A9A9 (bodyXsMedium)
 * - Edit hint - fontSize 14, lineHeight 20, fontWeight 400, color #878787, textAlign RIGHT (bodySm)
 * - Input value - fontSize 20, lineHeight 32, fontWeight 400, color #DDDDDD (bodyLg)
 * - Input placeholder - color #444444
 * - Input underline - #4D4D4D
 * - Button text - fontSize 16, lineHeight 24, fontWeight 500, color #FFFFFF, textAlign CENTER
 *
 * BOTTOM SHEET (white background, borderRadius ~23):
 * - Handle: 28x4, #D9D9D9, borderRadius 200
 * - "Pay Rent" - fontSize 28, fontWeight 400, color #000000 (h4)
 * - "Total payable rent" - fontSize 12, fontWeight 500, color #A9A9A9, textAlign CENTER, UPPERCASE
 * - Amount - fontSize 12, fontWeight 600, color #000000
 * - "saved Rs X" - fontSize 12, fontWeight 500, color #70BF73
 * - "using flent cashback" - fontSize 12, fontWeight 500, color #A9A9A9, textAlign CENTER
 * - "Paying to" / "[Landlord Name]" - fontSize 12, fontWeight 500, color #000000
 * - Card name - fontSize 16, fontWeight 500, color #000000
 * - Card number - fontSize 12, fontWeight 500, color #000000
 * - "Pay Now" - fontSize 14, fontWeight 600, color #FFFFFF, textAlign CENTER
 * - "All payments are 100% secure" - fontSize 12, fontWeight 500, color #000000, textAlign CENTER
 * - "PAY BY ANY APP INSTEAD" - fontSize 12, fontWeight 600, color #878787, UPPERCASE
 * - "Google Pay"/"PayTM"/"PhonePe" - fontSize 12, fontWeight 400, color #000000, textAlign CENTER
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
import Svg, { Path, Circle } from 'react-native-svg';

import { Screen, Text, PrimaryButton, TextInput, ScreenTitle } from '@/src/components';
import { useAddPaymentMethod, useAddCardToken, useDashboard } from '@/src/hooks';
import type { AddCardTokenRequest } from '@/src/services/api/payments';

// Exact Figma colors - from 41-8450 extracted values
const FIGMA_COLORS = {
  // Dark background section
  background: '#131313',           // black.700 - Primary dark bg
  titleWhite: '#FFFFFF',           // white - title text
  titleAccent: '#FF9A6D',          // brand.500 - accent title text
  labelText: '#A9A9A9',            // neutral.500 - field labels
  editLinkText: '#878787',         // neutral.600 - edit hint text, PAY BY ANY APP text
  inputPlaceholder: '#444444',     // neutral.800 - placeholder text
  inputValue: '#DDDDDD',           // neutral.200 - input value text (Figma "Text" node)
  inputBorder: '#4D4D4D',          // black.400 - input underline / borders
  errorText: '#FF8080',            // error.default
  buttonTextActive: '#FFFFFF',     // white - button text (Save Changes)

  // Bottom sheet section (white bg)
  sheetBg: '#FFFFFF',              // white - bottom sheet background
  sheetHandle: '#D9D9D9',          // Rectangle 53 handle bar
  sheetTextDark: '#000000',        // black - Pay Rent, amounts, card info
  sheetLabelText: '#A9A9A9',       // neutral.500 - "Total payable rent", "using flent cashback"
  successText: '#70BF73',          // success.default - "saved Rs 325"
  secureText: '#000000',           // black - "All payments are 100% secure"
  upiLabelText: '#878787',         // neutral.600 - "PAY BY ANY APP INSTEAD"
  upiAppText: '#000000',           // black - Google Pay, PayTM, PhonePe
  upiAppBg: '#EEEEEE',            // neutral.100 - UPI app circle bg

  // Common
  footerText: '#CBCBCB',           // neutral.300
  buttonBg: '#202020',             // black.500
  underlineColor: '#D9D9D9',       // Figma Rectangle 53
};

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.titleWhite}
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
  const { tenancy, cashback } = useDashboard();

  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');

  // Payment data from dashboard (for bottom sheet)
  const rentAmount = tenancy?.monthly_rent ?? 32175;
  const cashbackSaved = cashback?.available_balance ?? 325;
  const landlordName = tenancy?.landlord_name ?? '[Landlord Name]';

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
    const [expiryMonth, expiryYear] = expiryDate.split('/').map(Number);

    // In production, the card_token comes from PayU's tokenization SDK.
    // For development, we use addPaymentMethod which handles the mock fallback.
    // When a real token is available, useAddCardToken would be called directly.
    addMethod.mutate(
      {
        type: 'card',
        details: last4,
        metadata: {
          cardType: cardNetwork ?? 'unknown',
          cardNetwork: cardNetwork ?? 'visa',
          expiryDate,
          cardholderName: cardholderName.trim(),
          // card_token would be set here after PayU tokenization in production
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

  const formatCurrency = (amount: number) => {
    return `\u20B9 ${amount.toLocaleString('en-IN')}`;
  };

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
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
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

          {/* Title Section */}
          <ScreenTitle white="Add your" accent="Credit Card" />

          {/* Cardholder Name Field */}
          <TextInput
            label="Cardholder name"
            value={cardholderName}
            onChangeText={setCardholderName}
            placeholder="e.g. John Smith"
            hintText="edit"
            autoCapitalize="words"
            testID="cardholder-input"
          />

          {/* Card Number Field */}
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

          {/* Expiry Date Field */}
          <TextInput
            label="Expiry date"
            value={expiryDate}
            onChangeText={(text) => {
              setExpiryDate(formatExpiryDate(text));
              setError('');
            }}
            placeholder="e.g. MM/YY"
            hintText="edit"
            keyboardType="number-pad"
            maxLength={5}
            testID="expiry-input"
          />

          {/* CVV Field */}
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

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Save Card Button - Figma: "Save Changes" textAlign CENTER */}
          <PrimaryButton
            title="Save Card"
            onPress={handleSaveCard}
            disabled={!isFormFilled}
            loading={addMethod.isPending}
            testID="save-card-button"
          />

          {/* Footer Text */}
          <Text style={styles.footerText}>
            You may get a verification message to verify your Card and unlock benefits.
          </Text>
        </ScrollView>

        {/* ========================================= */}
        {/* Bottom Sheet - Payment Summary (Figma 41-8450) */}
        {/* White sheet with borderRadius ~23, handle bar, payment details */}
        {/* ========================================= */}
        {isFormFilled && (
          <View style={styles.bottomSheet}>
            {/* Handle bar - Figma: Rectangle 53, 28x4, #D9D9D9, borderRadius 200 */}
            <View style={styles.sheetHandle} />

            <View style={styles.sheetContent}>
              {/* Pay Rent header row with card logos */}
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>Pay Rent</Text>
              </View>

              {/* Payment Summary Card */}
              <View style={styles.paymentSummaryRow}>
                {/* Checkmark icon */}
                <View style={styles.checkmarkContainer}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" fill={FIGMA_COLORS.successText} />
                    <Path
                      d="M8 12L11 15L16 9"
                      stroke={FIGMA_COLORS.sheetBg}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>

                {/* Amount details */}
                <View style={styles.amountDetails}>
                  {/* Figma: "Total payable rent" - 12px, 500, #A9A9A9, textAlign CENTER, UPPER */}
                  <Text style={styles.totalPayableLabel}>TOTAL PAYABLE RENT</Text>
                  {/* Figma: Rs 32,175 - 12px, 600, #000000 */}
                  <Text style={styles.totalPayableAmount}>{formatCurrency(rentAmount)}</Text>
                </View>
              </View>

              {/* Cashback info */}
              <View style={styles.cashbackRow}>
                <View style={styles.cashbackIconContainer}>
                  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                    <Circle cx="10" cy="10" r="8" fill={FIGMA_COLORS.successText} opacity={0.15} />
                    <Path
                      d="M7 10L9 12L13 8"
                      stroke={FIGMA_COLORS.successText}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <View style={styles.cashbackTextContainer}>
                  {/* Figma: "saved Rs 325 ->" - 12px, 500, #70BF73 */}
                  <Text style={styles.cashbackSavedText}>
                    saved {formatCurrency(cashbackSaved)} {'\u2192'}
                  </Text>
                  {/* Figma: "using flent cashback" - 12px, 500, #A9A9A9, textAlign CENTER */}
                  <Text style={styles.cashbackDescText}>using flent cashback</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.sheetDivider} />

              {/* Paying to row */}
              <View style={styles.payingToRow}>
                <Text style={styles.payingToLabel}>Paying to</Text>
                <Text style={styles.payingToValue}>{landlordName}</Text>
              </View>

              {/* Card details row */}
              <View style={styles.cardDetailsRow}>
                {/* Card icon placeholder */}
                <View style={styles.cardIconContainer}>
                  <Svg width={40} height={28} viewBox="0 0 40 28" fill="none">
                    <Path
                      d="M4 0H36C38.2091 0 40 1.79086 40 4V24C40 26.2091 38.2091 28 36 28H4C1.79086 28 0 26.2091 0 24V4C0 1.79086 1.79086 0 4 0Z"
                      fill="#1A1A1A"
                    />
                    <Path d="M0 8H40V12H0V8Z" fill="#4D4D4D" />
                  </Svg>
                </View>
                <View style={styles.cardTextContainer}>
                  {/* Figma: "ICICI" - 16px, 500, #000000 */}
                  <Text style={styles.cardBankName}>ICICI</Text>
                  {/* Figma: "XXXX XXXX XXXX 2003" - 12px, 500, #000000 */}
                  <Text style={styles.cardNumber}>
                    XXXX XXXX XXXX {cardNumber.replace(/\s/g, '').slice(-4) || '****'}
                  </Text>
                </View>
              </View>

              {/* Pay Now Button - Figma: dark bg with "Pay Now" 14px, 600, #FFFFFF, textAlign CENTER */}
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={handleSaveCard}
                activeOpacity={0.8}
                testID="pay-now-button"
              >
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>

              {/* Secure text - Figma: 12px, 500, #000000, textAlign CENTER */}
              <Text style={styles.securePaymentText}>All payments are 100% secure</Text>

              {/* Divider line */}
              <View style={styles.sectionDivider} />

              {/* PAY BY ANY APP INSTEAD section */}
              <View style={styles.upiSection}>
                <View style={styles.upiHeaderRow}>
                  <View style={styles.upiIconSmall}>
                    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                      <Path
                        d="M8 1L1 5L8 9L15 5L8 1Z"
                        stroke={FIGMA_COLORS.upiLabelText}
                        strokeWidth={1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  {/* Figma: "PAY BY ANY APP INSTEAD" - 12px, 600, #878787, UPPERCASE */}
                  <Text style={styles.upiHeaderText}>PAY BY ANY APP INSTEAD</Text>
                </View>

                {/* UPI App Icons Row */}
                <View style={styles.upiAppsRow}>
                  {/* Google Pay */}
                  <View style={styles.upiAppItem}>
                    <View style={styles.upiAppCircle}>
                      <Text style={styles.upiAppIconText}>G</Text>
                    </View>
                    {/* Figma: "Google Pay" - 12px, 400, #000000, textAlign CENTER */}
                    <Text style={styles.upiAppLabel}>Google Pay</Text>
                  </View>

                  {/* PayTM */}
                  <View style={styles.upiAppItem}>
                    <View style={styles.upiAppCircle}>
                      <Text style={styles.upiAppIconText}>P</Text>
                    </View>
                    {/* Figma: "PayTM" - 12px, 400, #000000, textAlign CENTER */}
                    <Text style={styles.upiAppLabel}>PayTM</Text>
                  </View>

                  {/* PhonePe */}
                  <View style={styles.upiAppItem}>
                    <View style={styles.upiAppCircle}>
                      <Text style={styles.upiAppIconText}>Ph</Text>
                    </View>
                    {/* Figma: "PhonePe" - 12px, 400, #000000, textAlign CENTER */}
                    <Text style={styles.upiAppLabel}>PhonePe</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
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
    paddingHorizontal: 48, // Figma: 48px horizontal padding (same as add-upi)
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  // Title uses shared ScreenTitle component
  // Form fields use shared TextInput component — styles handled internally
  errorText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.errorText,
    marginBottom: 16,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: 12px footer text (consistent with add-upi)
    lineHeight: 20,
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral.500) - consistent with add-upi footer
    marginTop: 16,
    textAlign: 'center',
  },

  // =============================================
  // Bottom Sheet Styles - Figma 41-8450
  // White sheet with borderRadius ~23, payment summary
  // =============================================

  // Figma: Frame 1686557300 - white bg, borderRadius 22.8, vertical layout
  bottomSheet: {
    backgroundColor: FIGMA_COLORS.sheetBg,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingTop: 15,
    alignItems: 'center',
    gap: 24,
  },
  // Figma: Rectangle 53 - 28x4, #D9D9D9, borderRadius 200
  sheetHandle: {
    width: 28,
    height: 4,
    backgroundColor: FIGMA_COLORS.sheetHandle,
    borderRadius: 200,
  },
  sheetContent: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  // Figma: "Pay Rent" - h4, 28px, fontWeight 400, #000000, textAlign LEFT
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 39,
    letterSpacing: -0.56,
    color: FIGMA_COLORS.sheetTextDark,
  },

  // Payment summary row (checkmark + amount)
  paymentSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  checkmarkContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountDetails: {
    flex: 1,
    gap: 4,
  },
  // Figma: "Total payable rent" (41:8478) - 12px, 500, #A9A9A9, textTransform UPPER
  totalPayableLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    color: FIGMA_COLORS.sheetLabelText,
    textAlign: 'left', // Left-aligned label in summary row
    textTransform: 'uppercase',
  },
  // Figma: "Rs 32,175" (41:8479) - 12px, 600, #000000, letterSpacing -0.48
  totalPayableAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.sheetTextDark,
  },

  // Cashback row
  cashbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  cashbackIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashbackTextContainer: {
    flex: 1,
    gap: 2,
  },
  // Figma: "saved Rs 325 ->" (41:8488) - 12px, 500, #70BF73, letterSpacing -0.48
  cashbackSavedText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.successText,
  },
  // Figma: "using flent cashback" (41:8489) - 12px, 500, #A9A9A9
  cashbackDescText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    color: FIGMA_COLORS.sheetLabelText,
    textAlign: 'left', // Left-aligned in cashback text column
  },

  // Sheet divider
  sheetDivider: {
    height: 1,
    backgroundColor: FIGMA_COLORS.inputBorder,
    marginVertical: 4,
  },

  // Paying to row
  // Figma: "Paying to" (41:8493) - 12px, 500, #000000, letterSpacing -0.132
  payingToRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payingToLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.sheetTextDark,
  },
  // Figma: "[Landlord Name]" (41:8494) - 12px, 500, #000000, letterSpacing -0.132
  payingToValue: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.sheetTextDark,
  },

  // Card details row
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  cardIconContainer: {
    width: 48,
    height: 32,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContainer: {
    flex: 1,
    gap: 2,
  },
  // Figma: "ICICI" (41:8498) - bodyMdMedium, 16px, 500, #000000, letterSpacing -0.176
  cardBankName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 29,
    letterSpacing: -0.176,
    color: FIGMA_COLORS.sheetTextDark,
  },
  // Figma: "XXXX XXXX XXXX 2003" (41:8499) - 12px, 500, #000000, letterSpacing -0.132
  cardNumber: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.sheetTextDark,
  },

  // Figma: Pay Now button (41:8500) - dark bg, rounded
  payNowButton: {
    backgroundColor: FIGMA_COLORS.background,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  // Figma: "Pay Now" (41:8501) - bodySmSemibold, 14px, 600, #FFFFFF, textAlign CENTER
  payNowText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 25,
    letterSpacing: -0.154,
    color: FIGMA_COLORS.buttonTextActive,
    textAlign: 'center',
  },

  // Figma: "All payments are 100% secure" (41:8502) - 12px, 500, #000000, textAlign CENTER
  securePaymentText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 22,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.secureText,
    textAlign: 'center',
    width: '100%',
  },

  // Section divider (before UPI section)
  sectionDivider: {
    height: 1,
    backgroundColor: FIGMA_COLORS.inputBorder,
    marginVertical: 8,
  },

  // UPI Section
  upiSection: {
    gap: 16,
  },
  upiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upiIconSmall: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Figma: "PAY BY ANY APP INSTEAD" (41:8507) - 12px, 600, #878787, UPPERCASE
  upiHeaderText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 17,
    color: FIGMA_COLORS.upiLabelText,
    textTransform: 'uppercase',
  },
  upiAppsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  upiAppItem: {
    alignItems: 'center',
    gap: 8,
    width: 64,
  },
  // Figma: Ellipse 26 - circle with #EEEEEE bg
  upiAppCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: FIGMA_COLORS.upiAppBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAppIconText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    color: FIGMA_COLORS.sheetTextDark,
    textAlign: 'center',
  },
  // Figma: "Google Pay"/"PayTM"/"PhonePe" (41:8511/8514/8517) - bodyXs, 12px, 400, #000000, textAlign CENTER
  upiAppLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.upiAppText,
    textAlign: 'center',
  },
});
