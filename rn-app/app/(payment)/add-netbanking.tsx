/**
 * Add Net Banking / Credit Card Payment Screen
 * Figma Reference: 41-8529 (Pay Rent / Add Credit Payment)
 *
 * Pixel-perfect implementation:
 * - Dark background (#131313) with white bottom sheet
 * - Payment summary with total rent and cashback
 * - Card details input section with right-aligned hints
 * - Pay Now button (disabled: #202020/#444444, active: #FF9A6D/#131313)
 * - Alternative payment options (Google Pay, PayTM, PhonePe)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect, Line, G, Defs, ClipPath } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { useAddPaymentMethod } from '@/src/hooks';
import { colors, spacing, radius, typography, fontFamily } from '@/src/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==============================================
// FIGMA EXTRACTED CONSTANTS (41-8529)
// ==============================================
const FIGMA = {
  screen: {
    width: 393,
    height: 1008,
    backgroundColor: colors.black[700], // #131313
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderRadius: 22.79,
    height: 662.73,
  },
  colors: {
    background: colors.black[700], // #131313
    sheetBg: colors.white, // #FFFFFF
    textBlack: colors.neutral[800], // #444444 — Figma dark text on light sheet
    textGray: colors.neutral[500], // #A9A9A9
    textMuted: colors.neutral[600], // #878787
    successGreen: colors.success.default, // #70BF73
    cardSurface: colors.black[500], // #202020
    handleBar: '#D9D9D9',
    iconBg: colors.neutral[100], // #EEEEEE
    divider: colors.black[600], // #1A1A1A
    inputBg: colors.neutral[100], // #EEEEEE
    inputBorder: colors.black[400], // #4D4D4D
    hintText: colors.neutral[600], // #878787
    buttonDisabledBg: colors.black[500], // #202020
    buttonDisabledText: colors.neutral[800], // #444444
    buttonActiveBg: colors.brand[500], // #FF9A6D
    buttonActiveText: colors.black[700], // #131313
  },
  typography: {
    // "Add your Credit Card" header — 48px per Figma
    heroTitle: {
      fontSize: 48,
      fontWeight: '400' as const,
      lineHeight: 57.6,
      letterSpacing: -2,
    },
    title: {
      fontSize: 28,
      fontWeight: '400' as const,
      lineHeight: 39.48,
      letterSpacing: -0.56,
    },
    labelMd: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 21.6,
    },
    amountSm: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16.92,
      letterSpacing: -0.48,
    },
    bodyMd: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 28.8,
      letterSpacing: -0.18,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 25.2,
      letterSpacing: -0.15,
    },
    appLabel: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 20,
      letterSpacing: 0.5,
    },
    hintText: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    inputText: {
      fontSize: 20,
      fontWeight: '400' as const,
      lineHeight: 28,
    },
  },
  spacing: {
    sheetPaddingH: 24,
    sheetPaddingTop: 15.19,
    sectionGap: 30.38,
    contentGap: 16,
    iconGap: 16,
  },
};

// ==============================================
// SVG ICONS
// ==============================================

// Back Arrow Icon (white on dark header)
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={colors.white}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Close Icon
const CloseIcon = () => (
  <Svg width={12.21} height={12.21} viewBox="0 0 12 12" fill="none">
    <Path
      d="M1 1L11 11M1 11L11 1"
      stroke={FIGMA.colors.textBlack}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

// Rent/Home Icon
const RentIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3L3 10V21H9V14H15V21H21V10L12 3Z"
      stroke={FIGMA.colors.textBlack}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

// Cashback/Gift Icon
const CashbackIcon = () => (
  <Svg width={16.02} height={19.2} viewBox="0 0 16 19" fill="none">
    <Path
      d="M8 0L16 6V19H0V6L8 0Z"
      fill={FIGMA.colors.textBlack}
    />
  </Svg>
);

// Google Pay Icon (simplified)
const GooglePayIcon = () => (
  <View style={styles.upiAppIcon}>
    <Text style={styles.upiIconText}>G</Text>
  </View>
);

// PayTM Icon (simplified)
const PayTMIcon = () => (
  <View style={styles.upiAppIcon}>
    <Text style={styles.upiIconText}>P</Text>
  </View>
);

// PhonePe Icon (simplified)
const PhonePeIcon = () => (
  <View style={[styles.upiAppIcon, { backgroundColor: '#5F259F' }]}>
    <Text style={[styles.upiIconText, { color: colors.white }]}>Pe</Text>
  </View>
);

// UPI Logo
const UPILogo = () => (
  <View style={styles.upiLogo}>
    <Text style={styles.upiLogoText}>UPI</Text>
  </View>
);

// ==============================================
// MOCK DATA
// ==============================================
interface PaymentData {
  totalRent: number;
  cashbackSaved: number;
  landlordName: string;
  bankName: string;
  cardLast4: string;
}

const MOCK_PAYMENT: PaymentData = {
  totalRent: 32175,
  cashbackSaved: 325,
  landlordName: '[Landlord Name]',
  bankName: 'ICICI',
  cardLast4: '2003',
};

// ==============================================
// MAIN COMPONENT
// ==============================================
export default function AddNetbankingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addMethod = useAddPaymentMethod();
  const params = useLocalSearchParams();

  const [isProcessing, setIsProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');

  // Determine if form is filled enough to enable button
  const isFormValid = useMemo(() => {
    return cardNumber.length >= 16 && expiryDate.length >= 4 && cvv.length >= 3;
  }, [cardNumber, expiryDate, cvv]);

  // Payment data (in real app, this would come from params or state)
  const paymentData = useMemo(() => ({
    ...MOCK_PAYMENT,
    totalRent: params.amount ? Number(params.amount) : MOCK_PAYMENT.totalRent,
  }), [params.amount]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/(payment)/success');
    }, 2000);
  }, [router]);

  const handleUPIApp = useCallback((app: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Handle UPI app selection
    console.log(`Selected UPI app: ${app}`);
  }, []);

  const formatCurrency = (amount: number) => {
    return `\u20B9 ${amount.toLocaleString('en-IN')}`;
  };

  return (
    <Screen testID="add-netbanking-screen" style={styles.screen}>
      <View style={styles.container}>
        {/* Dark Background Area with title */}
        <View style={styles.darkHeader}>
          <View style={[styles.darkHeaderContent, { paddingTop: insets.top + 16 }]}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <BackArrow />
            </TouchableOpacity>
            {/* Hero Title — Figma: 48px, white, letterSpacing: -2 */}
            <Text style={styles.heroTitle}>
              {'Add your \nCredit Card'}
            </Text>
          </View>
        </View>

        {/* Bottom Sheet */}
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
          {/* Handle Bar */}
          <View style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Sheet Content */}
          <ScrollView
            style={styles.sheetScrollView}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header Row - Payment Method Indicators + Close Button */}
            <View style={styles.headerRow}>
              <View style={styles.paymentMethodIndicators}>
                <View style={styles.cardIndicator} />
                <View style={styles.cardIndicator} />
                <View style={styles.cardIndicator} />
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <CloseIcon />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.screenTitle}>Pay Rent</Text>
            </View>

            {/* Payment Summary Card */}
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                {/* Rent Icon */}
                <View style={styles.summaryIconContainer}>
                  <RentIcon />
                </View>

                {/* Total Payable */}
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.summaryLabel}>Total payable rent</Text>
                  <Text style={styles.summaryAmount}>{formatCurrency(paymentData.totalRent)}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.summaryDivider} />

              {/* Cashback Row */}
              <View style={styles.summaryRow}>
                {/* Cashback Icon */}
                <View style={styles.summaryIconContainer}>
                  <View style={styles.cashbackIconBg}>
                    <CashbackIcon />
                  </View>
                </View>

                {/* Cashback Info */}
                <View style={styles.summaryTextContainer}>
                  <Text style={styles.cashbackAmount}>
                    saved {formatCurrency(paymentData.cashbackSaved)} {'\u2192'}
                  </Text>
                  <Text style={styles.cashbackLabel}>using flent cashback</Text>
                </View>
              </View>
            </View>

            {/* Card Input Fields — Figma: borders #4D4D4D, borderRadius 12 */}
            <View style={styles.cardInputSection}>
              {/* Card Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Card number</Text>
                <View style={styles.inputContainer}>
                  <RNTextInput
                    style={styles.inputField}
                    placeholder="XXXX XXXX XXXX XXXX"
                    placeholderTextColor={FIGMA.colors.hintText}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                  <Text style={styles.inputHint}>Hint text</Text>
                </View>
              </View>

              {/* Expiry + CVV Row */}
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Expiry date</Text>
                  <View style={styles.inputContainer}>
                    <RNTextInput
                      style={styles.inputField}
                      placeholder="MM/YY"
                      placeholderTextColor={FIGMA.colors.hintText}
                      value={expiryDate}
                      onChangeText={setExpiryDate}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                    <Text style={styles.inputHint}>Hint text</Text>
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <View style={styles.inputContainer}>
                    <RNTextInput
                      style={styles.inputField}
                      placeholder="***"
                      placeholderTextColor={FIGMA.colors.hintText}
                      value={cvv}
                      onChangeText={setCvv}
                      keyboardType="number-pad"
                      maxLength={4}
                      secureTextEntry
                    />
                    <Text style={styles.inputHint}>Hint text</Text>
                  </View>
                </View>
              </View>

              {/* Card Holder Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Card holder name</Text>
                <View style={styles.inputContainer}>
                  <RNTextInput
                    style={styles.inputField}
                    placeholder="Name on card"
                    placeholderTextColor={FIGMA.colors.hintText}
                    value={cardHolderName}
                    onChangeText={setCardHolderName}
                    autoCapitalize="words"
                  />
                  <Text style={styles.inputHint}>Hint text</Text>
                </View>
              </View>
            </View>

            {/* Payment Details Section */}
            <View style={styles.paymentDetailsSection}>
              {/* Paying To Row */}
              <View style={styles.payingToRow}>
                <Text style={styles.payingToLabel}>Paying to</Text>
                <Text style={styles.payingToValue}>{paymentData.landlordName}</Text>
              </View>

              {/* Card Details Row */}
              <View style={styles.cardDetailsRow}>
                <View style={styles.cardThumbnail}>
                  <View style={styles.cardThumbnailInner} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.bankName}>{paymentData.bankName}</Text>
                  <Text style={styles.cardNumber}>
                    XXXX XXXX XXXX {paymentData.cardLast4}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pay Now Button — Figma: disabled #202020/#444444, active #FF9A6D/#131313 */}
            <TouchableOpacity
              style={[
                styles.payNowButton,
                isFormValid && styles.payNowButtonActive,
                isProcessing && styles.payNowButtonDisabled,
              ]}
              onPress={handlePayNow}
              disabled={isProcessing || !isFormValid}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.payNowButtonText,
                  isFormValid && styles.payNowButtonTextActive,
                ]}
              >
                {isProcessing ? 'Processing...' : 'Pay Now'}
              </Text>
            </TouchableOpacity>

            {/* Security Note */}
            <Text style={styles.securityNote}>
              All payments are 100% secure
            </Text>

            {/* Divider Line */}
            <View style={styles.sectionDivider} />

            {/* Alternative Payment Section */}
            <View style={styles.altPaymentSection}>
              <View style={styles.altPaymentHeader}>
                <UPILogo />
                <Text style={styles.altPaymentLabel}>PAY BY ANY APP INSTEAD</Text>
              </View>

              {/* UPI Apps Row */}
              <View style={styles.upiAppsRow}>
                {/* Google Pay */}
                <TouchableOpacity
                  style={styles.upiAppContainer}
                  onPress={() => handleUPIApp('gpay')}
                >
                  <View style={styles.upiAppIconWrapper}>
                    <GooglePayIcon />
                  </View>
                  <Text style={styles.upiAppName}>Google Pay</Text>
                </TouchableOpacity>

                {/* PayTM */}
                <TouchableOpacity
                  style={styles.upiAppContainer}
                  onPress={() => handleUPIApp('paytm')}
                >
                  <View style={styles.upiAppIconWrapper}>
                    <PayTMIcon />
                  </View>
                  <Text style={styles.upiAppName}>PayTM</Text>
                </TouchableOpacity>

                {/* PhonePe */}
                <TouchableOpacity
                  style={styles.upiAppContainer}
                  onPress={() => handleUPIApp('phonepe')}
                >
                  <View style={styles.upiAppIconWrapper}>
                    <PhonePeIcon />
                  </View>
                  <Text style={styles.upiAppName}>PhonePe</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

// ==============================================
// STYLES - Exact Figma Values (41-8529)
// ==============================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.background, // #131313
  },
  container: {
    flex: 1,
  },

  // Dark Header Area — Figma: #131313 background with 48px title
  darkHeader: {
    backgroundColor: FIGMA.colors.background, // #131313
    paddingHorizontal: FIGMA.spacing.sheetPaddingH,
    paddingBottom: spacing.xl,
  },
  darkHeaderContent: {
    gap: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Figma: 48px, white, PlusJakartaSans, letterSpacing: -2
  heroTitle: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.heroTitle.fontSize, // 48
    fontWeight: FIGMA.typography.heroTitle.fontWeight, // 400
    lineHeight: FIGMA.typography.heroTitle.lineHeight, // 57.6
    letterSpacing: FIGMA.typography.heroTitle.letterSpacing, // -2
    color: colors.white,
    textAlign: 'left',
  },

  // Bottom Sheet
  bottomSheet: {
    flex: 1,
    backgroundColor: FIGMA.colors.sheetBg, // #FFFFFF
    borderTopLeftRadius: 22.79,
    borderTopRightRadius: 22.79,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingTop: 15.19,
    paddingBottom: spacing.lg,
  },
  handleBar: {
    width: 28,
    height: 4,
    backgroundColor: FIGMA.colors.handleBar, // #D9D9D9
    borderRadius: 200,
  },

  // Sheet Content
  sheetScrollView: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: FIGMA.spacing.sheetPaddingH, // 24
    paddingBottom: spacing.lg,
    gap: FIGMA.spacing.sectionGap, // 30.38
  },

  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.8,
  },
  cardIndicator: {
    width: 61.22,
    height: 38.97,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
    borderRadius: radius.sm,
  },
  closeButton: {
    width: 28.48,
    height: 28.48,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
    borderRadius: 101.73,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Title Section
  titleSection: {
    paddingVertical: spacing.xs,
  },
  screenTitle: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.title.fontSize, // 28
    fontWeight: FIGMA.typography.title.fontWeight, // 400
    lineHeight: FIGMA.typography.title.lineHeight, // 39.48
    letterSpacing: FIGMA.typography.title.letterSpacing, // -0.56
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'left',
  },

  // Summary Section
  summarySection: {
    gap: FIGMA.spacing.contentGap, // 16
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FIGMA.spacing.iconGap, // 16
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
    borderRadius: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTextContainer: {
    flex: 1,
    gap: 4,
  },
  // Figma 41:8557 "Total payable rent" — textAlignHorizontal: CENTER
  summaryLabel: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: FIGMA.typography.labelMd.fontWeight, // 500
    lineHeight: FIGMA.typography.labelMd.lineHeight, // 21.6
    color: FIGMA.colors.textGray, // #A9A9A9
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontFamily: fontFamily.primary.semibold,
    fontSize: FIGMA.typography.amountSm.fontSize, // 12
    fontWeight: FIGMA.typography.amountSm.fontWeight, // 600
    lineHeight: FIGMA.typography.amountSm.lineHeight, // 16.92
    letterSpacing: FIGMA.typography.amountSm.letterSpacing, // -0.48
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'left',
  },
  summaryDivider: {
    width: 0.5,
    height: 32.5,
    backgroundColor: FIGMA.colors.divider, // #1A1A1A
    borderRadius: radius.sm,
    marginLeft: 44 + FIGMA.spacing.iconGap / 2, // Centered under icons
  },
  cashbackIconBg: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashbackAmount: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.amountSm.fontSize, // 12
    fontWeight: FIGMA.typography.amountSm.fontWeight, // 600
    lineHeight: FIGMA.typography.amountSm.lineHeight, // 16.92
    letterSpacing: FIGMA.typography.amountSm.letterSpacing, // -0.48
    color: FIGMA.colors.successGreen, // #70BF73
    textAlign: 'left',
  },
  // Figma 41:8568 "using flent cashback" — textAlignHorizontal: CENTER
  cashbackLabel: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: FIGMA.typography.labelMd.fontWeight, // 500
    lineHeight: FIGMA.typography.labelMd.lineHeight, // 21.6
    color: FIGMA.colors.textGray, // #A9A9A9
    textAlign: 'center',
  },

  // Card Input Section — Figma: borders #4D4D4D, borderRadius: 12
  cardInputSection: {
    gap: spacing.md, // 16
  },
  inputGroup: {
    gap: spacing.xs, // 8
  },
  inputLabel: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: FIGMA.typography.labelMd.fontWeight, // 500
    lineHeight: FIGMA.typography.labelMd.lineHeight, // 21.6
    color: FIGMA.colors.textGray, // #A9A9A9
    textAlign: 'left',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: FIGMA.colors.inputBorder, // #4D4D4D
    borderRadius: radius.md, // 12
    paddingHorizontal: spacing.md, // 16
    paddingVertical: spacing.sm, // 12
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
  },
  inputField: {
    flex: 1,
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.inputText.fontSize, // 20
    fontWeight: FIGMA.typography.inputText.fontWeight, // 400
    lineHeight: FIGMA.typography.inputText.lineHeight, // 28
    color: colors.black[700], // #131313
    textAlign: 'left',
    padding: 0,
  },
  // Figma I41:8605;99:1459, I41:8606;99:1459 etc — textAlignHorizontal: RIGHT
  inputHint: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.hintText.fontSize, // 14
    fontWeight: FIGMA.typography.hintText.fontWeight, // 400
    lineHeight: FIGMA.typography.hintText.lineHeight, // 20
    color: FIGMA.colors.hintText, // #878787
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md, // 16
  },

  // Payment Details Section
  paymentDetailsSection: {
    gap: spacing.xs, // 8
  },
  payingToRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xs,
  },
  payingToLabel: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: FIGMA.typography.labelMd.fontWeight, // 500
    lineHeight: FIGMA.typography.labelMd.lineHeight, // 21.6
    letterSpacing: -0.13,
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'left',
  },
  payingToValue: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: FIGMA.typography.labelMd.fontWeight, // 500
    lineHeight: FIGMA.typography.labelMd.lineHeight, // 21.6
    letterSpacing: -0.13,
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'right',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: FIGMA.spacing.iconGap, // 16
  },
  cardThumbnail: {
    width: 51,
    height: 51,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardThumbnailInner: {
    width: 40,
    height: 30,
    backgroundColor: '#1A1A1A',
    borderRadius: radius.xs,
  },
  cardInfo: {
    flex: 1,
    gap: 0,
  },
  bankName: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.bodyMd.fontSize, // 16
    fontWeight: FIGMA.typography.bodyMd.fontWeight, // 500
    lineHeight: FIGMA.typography.bodyMd.lineHeight, // 28.8
    letterSpacing: FIGMA.typography.bodyMd.letterSpacing, // -0.18
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'left',
  },
  cardNumber: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.labelMd.fontSize, // 12
    fontWeight: '400',
    lineHeight: 20,
    color: FIGMA.colors.textGray, // #A9A9A9
    textAlign: 'left',
  },

  // Pay Now Button — Figma: disabled bg #202020 text #444444, active bg #FF9A6D text #131313
  payNowButton: {
    width: '100%',
    height: 52,
    backgroundColor: FIGMA.colors.buttonDisabledBg, // #202020
    borderRadius: radius.md, // 12
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Active state when form is valid
  payNowButtonActive: {
    backgroundColor: FIGMA.colors.buttonActiveBg, // #FF9A6D
  },
  payNowButtonDisabled: {
    opacity: 0.6,
  },
  // Figma 41:8580 "Pay Now" — textAlignHorizontal: CENTER
  payNowButtonText: {
    fontFamily: fontFamily.primary.semibold,
    fontSize: FIGMA.typography.buttonText.fontSize, // 14
    fontWeight: FIGMA.typography.buttonText.fontWeight, // 600
    lineHeight: FIGMA.typography.buttonText.lineHeight, // 25.2
    letterSpacing: FIGMA.typography.buttonText.letterSpacing, // -0.15
    color: FIGMA.colors.buttonDisabledText, // #444444
    textAlign: 'center',
  },
  // Active text color when form is valid
  payNowButtonTextActive: {
    color: FIGMA.colors.buttonActiveText, // #131313
  },

  // Figma 41:8581 "All payments are 100% secure" — textAlignHorizontal: CENTER
  securityNote: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.appLabel.fontSize, // 12
    fontWeight: FIGMA.typography.appLabel.fontWeight, // 400
    lineHeight: FIGMA.typography.appLabel.lineHeight, // 20
    color: FIGMA.colors.textMuted, // #878787
    textAlign: 'center',
  },

  // Section Divider
  sectionDivider: {
    width: '100%',
    height: 1,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
  },

  // Alternative Payment Section
  altPaymentSection: {
    gap: spacing.md, // 16
  },
  altPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm, // 12
  },
  // Figma: "PAY BY ANY APP INSTEAD" — textAlign left (in row with icon)
  altPaymentLabel: {
    fontFamily: fontFamily.primary.medium,
    fontSize: FIGMA.typography.sectionLabel.fontSize, // 12
    fontWeight: FIGMA.typography.sectionLabel.fontWeight, // 500
    lineHeight: FIGMA.typography.sectionLabel.lineHeight, // 20
    letterSpacing: FIGMA.typography.sectionLabel.letterSpacing, // 0.5
    color: FIGMA.colors.textMuted, // #878787
    textAlign: 'left',
    textTransform: 'uppercase',
  },

  // UPI Apps
  upiAppsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 72,
  },
  upiAppContainer: {
    alignItems: 'center',
    gap: spacing.xs, // 8
  },
  upiAppIconWrapper: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FIGMA.colors.iconBg, // #EEEEEE
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiIconText: {
    fontFamily: fontFamily.primary.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'center',
  },
  // Figma 41:8590 "Google Pay", 41:8593 "PayTM", 41:8596 "PhonePe" — textAlignHorizontal: CENTER
  upiAppName: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.appLabel.fontSize, // 12
    fontWeight: FIGMA.typography.appLabel.fontWeight, // 400
    lineHeight: FIGMA.typography.appLabel.lineHeight, // 20
    color: FIGMA.colors.textBlack, // #444444
    textAlign: 'center',
  },

  // UPI Logo
  upiLogo: {
    width: 40,
    height: 24,
    backgroundColor: '#0D7E2D',
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiLogoText: {
    fontFamily: fontFamily.primary.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
