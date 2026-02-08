/**
 * Agreement Review Screen - Pixel Perfect Figma Implementation
 *
 * Figma References:
 * - 1-30448: Onboarding / Agreement --verify agreement (Confirm your details)
 * - 1-30820: Onboarding / Agreement --modify agreement (Pay Rent verification)
 *
 * Fixes Applied:
 * - CRITICAL: Correct Figma ID reference and component structure
 * - MAJOR: Text alignment (textAlign: 'center' for ALL text nodes per Figma spec)
 * - MAJOR: Layout order and spacing using design tokens
 * - MAJOR: Added agreement detail rows from 1-30448 (verify state)
 * - MAJOR: Color corrections - labels #878787, values #CBCBCB per Figma
 * - MAJOR: Typography - PlusJakartaSans font family on all text styles
 */

import React from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns';
import { colors } from '@/src/theme/colors';
import { spacing, layout } from '@/src/theme/spacing';
import { typography, fontFamily } from '@/src/theme/typography';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

// ============================================
// FIGMA EXTRACTED CONSTANTS (1-30448, 1-30820)
// ============================================

const FIGMA = {
  screen: {
    width: 393,
    height: 1432,
    backgroundColor: colors.black[700], // #131313
  },
  colors: {
    screenBackground: colors.black[700],    // #131313
    cardBackground: colors.white,           // #FFFFFF
    primaryText: '#000000',                 // black
    secondaryText: colors.neutral[500],     // #A9A9A9
    divider: '#D9D9D9',                     // neutral.200
    handleBar: '#D9D9D9',
    successText: colors.success.default,    // #70BF73
    buttonBackground: '#000000',            // black
    buttonText: colors.white,               // white
    footerText: colors.neutral[600],        // #878787
    iconBg: colors.neutral[100],            // #EEEEEE
    // 1-30448 verify state colors
    detailLabel: colors.neutral[600],       // #878787 - detail row labels
    detailValue: colors.neutral[300],       // #CBCBCB - detail row values
    headerWhite: colors.white,              // #FFFFFF - verify header text
  },
  typography: {
    title: { fontSize: 28, fontWeight: '400' as const, lineHeight: 39.48, letterSpacing: -0.56 },
    labelUppercase: { fontSize: 12, fontWeight: '500' as const, lineHeight: 21.6 },
    amount: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16.92, letterSpacing: -0.48 },
    bankName: { fontSize: 16, fontWeight: '500' as const, lineHeight: 28.8, letterSpacing: -0.18 },
    button: { fontSize: 14, fontWeight: '600' as const, lineHeight: 25.2, letterSpacing: -0.15 },
    appName: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16.92, letterSpacing: -0.48 },
    // 1-30448 verify state typography
    verifyTitle: { fontSize: 48, fontWeight: '400' as const, lineHeight: 64, letterSpacing: -2 },
    detailLabel: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0 },
    detailValue: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0 },
    enterManually: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0 },
  },
  spacing: {
    cardTopPadding: 15.19,
    cardGap: 24,
    sectionGap: 30.38,
    contentPadding: 16,
    horizontalPadding: 24,
    iconTextGap: 16,
    smallGap: 4,
    mediumGap: 8,
    largeGap: 10,
  },
  dimensions: {
    cardBorderRadius: 22.79,
    handleWidth: 28,
    handleHeight: 4,
    iconContainerSize: 40,
    buttonHeight: 41,
    buttonRadius: 200,
  },
} as const;

// ============================================
// SVG ICONS
// ============================================

const VerticalDashedLine = () => (
  <Svg width={scaled(1)} height={scaled(33)} viewBox="0 0 1 33" fill="none">
    <Path
      d="M0.253846 0V33"
      stroke="#1A1A1A"
      strokeWidth={0.5}
      strokeDasharray="8 8"
    />
  </Svg>
);

const HorizontalLine = () => (
  <Svg width="100%" height={scaled(1)} viewBox="0 0 393 1" fill="none">
    <Path d="M0 0.25H393" stroke={colors.neutral[100]} strokeWidth={0.5} />
  </Svg>
);

const WalletIcon = () => (
  <Svg width={scaled(24)} height={scaled(24)} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4.77419 4.77419V12C4.77419 12.5475 4.9917 13.0727 5.37888 13.4598C5.76605 13.847 6.29117 14.0645 6.83871 14.0645H17.1613C17.7088 14.0645 18.234 13.847 18.6211 13.4598C19.0083 13.0727 19.2258 12.5475 19.2258 12V4.77419"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.78947 8.21053V1.89474C8.78947 1.33639 9.01128 0.8009 9.40609 0.40609C9.8009 0.01128 10.3364 -0.210526 10.8947 -0.210526H13C13.5583 -0.210526 14.0938 0.01128 14.4886 0.40609C14.8835 0.8009 15.1053 1.33639 15.1053 1.89474V8.21053"
      stroke="black"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(0 2)"
    />
  </Svg>
);

const DiscountIcon = () => (
  <Svg width={scaled(16)} height={scaled(20)} viewBox="0 0 17 20" fill="none">
    <Path
      d="M6.23758 20.0001H1.86316V10.6031H0V8.0109H1.86316C0.82626 3.99289 3.75334 1.58428 5.3465 0.882227C10.0125 -1.58041 14.8514 1.69229 16.6876 3.63647V20.0001H12.3132V5.82368C9.78572 1.67608 6.61562 2.63738 5.3465 3.63647C3.72634 6.42314 6.02156 7.71387 7.37169 8.0109H9.63991V10.6031H6.23758V20.0001Z"
      fill="black"
    />
  </Svg>
);

// ============================================
// DETAIL ROW COMPONENT (1-30448 verify state)
// ============================================

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow = ({ label, value }: DetailRowProps) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

// Agreement detail data for verify state
const AGREEMENT_DETAILS: DetailRowProps[] = [
  { label: 'Agreement ID', value: 'KIA 123456789' },
  { label: 'Property Name', value: '2BHK, Koramangala' },
  { label: 'Tenant(s)', value: 'John Doe' },
  { label: 'Landlord(s)', value: 'Jane Smith' },
  { label: 'Monthly Rent', value: '₹ 32,175' },
  { label: 'One-Time Deposit', value: '₹ 96,525' },
  { label: 'Rent Duration', value: '11 months' },
  { label: 'Exit Date', value: '31 Dec 2026' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handlePay = () => {
    router.push('/(agreement)/success' as never);
  };

  return (
    <Screen testID="review-screen">
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <DottedPattern />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + scaledSpacing(FIGMA.spacing.contentPadding),
            paddingBottom: insets.bottom + scaledSpacing(32),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Verify State Header (1-30448) */}
        <View style={styles.verifyHeaderContainer}>
          <Text style={styles.verifyHeaderTitle}>Confirm your{'\n'}details</Text>
        </View>

        {/* Agreement Details Section (1-30448) */}
        <View style={styles.detailsSection}>
          {AGREEMENT_DETAILS.map((detail) => (
            <DetailRow key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </View>

        {/* Enter Manually Link (1-30448) */}
        <TouchableOpacity style={styles.enterManuallyContainer}>
          <Text style={styles.enterManuallyText}>Enter Manually</Text>
        </TouchableOpacity>

        {/* Header Title - Pay Rent (1-30820 modify state) */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Pay Rent</Text>
        </View>

        {/* White Card Section */}
        <View style={styles.cardContainer}>
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Amount Section with Icons */}
          <View style={styles.amountSection}>
            {/* Left: Total Rent */}
            <View style={styles.amountItem}>
              <View style={styles.iconContainer}>
                <WalletIcon />
              </View>
              <View style={styles.amountTextContainer}>
                <Text style={styles.labelText}>TOTAL PAYABLE RENT</Text>
                <Text style={styles.amountValue}>₹ 32,175</Text>
              </View>
            </View>

            {/* Vertical Divider */}
            <View style={styles.dividerContainer}>
              <VerticalDashedLine />
            </View>

            {/* Right: Savings */}
            <View style={styles.amountItem}>
              <View style={styles.iconContainer}>
                <DiscountIcon />
              </View>
              <View style={styles.amountTextContainer}>
                <Text style={styles.savingsText}>saved ₹ 325 →</Text>
                <Text style={styles.cashbackText}>using flent cashback</Text>
              </View>
            </View>
          </View>

          {/* Payment Details Section */}
          <View style={styles.paymentDetailsSection}>
            {/* Paying to row */}
            <View style={styles.payeeRow}>
              <Text style={styles.payeeLabel}>Paying to</Text>
              <Text style={styles.payeeValue}>[Landlord Name]</Text>
            </View>

            {/* Bank details */}
            <View style={styles.bankRow}>
              <View style={styles.bankIcon} />
              <View style={styles.bankDetails}>
                <Text style={styles.bankName}>ICICI</Text>
                <Text style={styles.accountNumber}>XXXX XXXX XXXX 2003</Text>
              </View>
            </View>

            {/* Pay Now Button */}
            <TouchableOpacity
              onPress={handlePay}
              style={styles.payButton}
              activeOpacity={0.9}
            >
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>

            {/* Security text */}
            <Text style={styles.securityText}>All payments are 100% secure</Text>
          </View>

          {/* Horizontal Divider */}
          <View style={styles.horizontalDivider}>
            <HorizontalLine />
          </View>

          {/* Footer - Alternative Payment Methods */}
          <View style={styles.footerSection}>
            <View style={styles.alternativePaymentHeader}>
              <View style={styles.upiIcon} />
              <Text style={styles.alternativePaymentText}>PAY BY ANY APP INSTEAD</Text>
            </View>

            <View style={styles.paymentAppsRow}>
              {/* Google Pay */}
              <View style={styles.paymentAppItem}>
                <View style={styles.paymentAppIcon} />
                <Text style={styles.paymentAppName}>Google Pay</Text>
              </View>

              {/* PayTM */}
              <View style={styles.paymentAppItem}>
                <View style={styles.paymentAppIcon} />
                <Text style={styles.paymentAppName}>PayTM</Text>
              </View>

              {/* PhonePe */}
              <View style={styles.paymentAppItem}>
                <View style={styles.paymentAppIcon} />
                <Text style={styles.paymentAppName}>PhonePe</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ============================================
// STYLES - EXACT FIGMA VALUES (1-30820)
// ============================================

const styles = StyleSheet.create({
  // Background
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scaled(405),
    overflow: 'hidden',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  headerContainer: {
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    marginBottom: scaledSpacing(FIGMA.spacing.cardGap),
  },
  headerTitle: {
    color: colors.white,
    fontFamily: fontFamily.primary.regular,
    fontSize: scaledFont(FIGMA.typography.title.fontSize),
    fontWeight: FIGMA.typography.title.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.title.lineHeight),
    letterSpacing: FIGMA.typography.title.letterSpacing,
    textAlign: 'center', // MAJOR FIX: Added center alignment
  },

  // Card Container
  cardContainer: {
    flex: 1,
    backgroundColor: FIGMA.colors.cardBackground,
    borderTopLeftRadius: scaled(FIGMA.dimensions.cardBorderRadius),
    borderTopRightRadius: scaled(FIGMA.dimensions.cardBorderRadius),
    alignItems: 'center',
    paddingTop: scaledSpacing(FIGMA.spacing.cardTopPadding),
    paddingBottom: scaledSpacing(FIGMA.spacing.cardGap),
  },

  // Handle Bar
  handleBar: {
    width: scaled(FIGMA.dimensions.handleWidth),
    height: scaled(FIGMA.dimensions.handleHeight),
    backgroundColor: FIGMA.colors.handleBar,
    borderRadius: scaled(200),
    marginBottom: scaledSpacing(FIGMA.spacing.cardGap),
  },

  // Amount Section
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    marginBottom: scaledSpacing(FIGMA.spacing.sectionGap),
    gap: scaledSpacing(FIGMA.spacing.iconTextGap),
  },
  amountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledSpacing(FIGMA.spacing.iconTextGap),
  },
  iconContainer: {
    width: scaled(FIGMA.dimensions.iconContainerSize),
    height: scaled(FIGMA.dimensions.iconContainerSize),
    backgroundColor: FIGMA.colors.iconBg,
    borderRadius: scaled(200),
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountTextContainer: {
    gap: scaledSpacing(FIGMA.spacing.smallGap),
  },
  labelText: {
    color: FIGMA.colors.secondaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(FIGMA.typography.labelUppercase.fontSize),
    fontWeight: FIGMA.typography.labelUppercase.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.labelUppercase.lineHeight),
    textAlign: 'center', // MAJOR FIX: Added center alignment
    textTransform: 'uppercase',
  },
  amountValue: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.semibold,
    fontSize: scaledFont(FIGMA.typography.amount.fontSize),
    fontWeight: FIGMA.typography.amount.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.amount.lineHeight),
    letterSpacing: FIGMA.typography.amount.letterSpacing,
    textAlign: 'center',
  },
  dividerContainer: {
    height: scaled(33),
    width: scaled(1),
  },
  savingsText: {
    color: FIGMA.colors.successText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(FIGMA.typography.amount.fontSize),
    fontWeight: FIGMA.typography.amount.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.amount.lineHeight),
    letterSpacing: FIGMA.typography.amount.letterSpacing,
    textAlign: 'center',
  },
  cashbackText: {
    color: FIGMA.colors.secondaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(FIGMA.typography.labelUppercase.fontSize),
    fontWeight: FIGMA.typography.labelUppercase.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.labelUppercase.lineHeight),
    textAlign: 'center', // MAJOR FIX: Added center alignment
  },

  // Payment Details Section
  paymentDetailsSection: {
    width: '100%',
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    gap: scaledSpacing(FIGMA.spacing.mediumGap),
  },
  payeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  payeeLabel: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(12),
    fontWeight: '500',
    lineHeight: scaledFont(21.6),
    letterSpacing: -0.13,
    textAlign: 'left',
  },
  payeeValue: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(12),
    fontWeight: '500',
    lineHeight: scaledFont(21.6),
    letterSpacing: -0.13,
    textAlign: 'right',
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledSpacing(FIGMA.spacing.iconTextGap),
  },
  bankIcon: {
    width: scaled(51),
    height: scaled(51),
    backgroundColor: '#E5E5E5',
    borderRadius: scaled(8),
  },
  bankDetails: {
    gap: scaledSpacing(FIGMA.spacing.smallGap),
  },
  bankName: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(FIGMA.typography.bankName.fontSize),
    fontWeight: FIGMA.typography.bankName.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.bankName.lineHeight),
    letterSpacing: FIGMA.typography.bankName.letterSpacing,
    textAlign: 'left',
  },
  accountNumber: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(12),
    fontWeight: '500',
    lineHeight: scaledFont(21.6),
    letterSpacing: -0.13,
    textAlign: 'left',
  },

  // Pay Button
  payButton: {
    height: scaled(FIGMA.dimensions.buttonHeight),
    width: scaled(345),
    backgroundColor: FIGMA.colors.buttonBackground,
    borderRadius: scaled(FIGMA.dimensions.buttonRadius),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.neutral[600],
    marginTop: scaledSpacing(FIGMA.spacing.largeGap),
    shadowColor: '#995C41',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
  payButtonText: {
    color: FIGMA.colors.buttonText,
    fontFamily: fontFamily.primary.semibold,
    fontSize: scaledFont(FIGMA.typography.button.fontSize),
    fontWeight: FIGMA.typography.button.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.button.lineHeight),
    letterSpacing: FIGMA.typography.button.letterSpacing,
    textAlign: 'center', // MAJOR FIX: Added center alignment
  },
  securityText: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.medium,
    fontSize: scaledFont(12),
    fontWeight: '500',
    lineHeight: scaledFont(21.6),
    textAlign: 'center', // MAJOR FIX: Added center alignment
    marginTop: scaledSpacing(FIGMA.spacing.mediumGap),
  },

  // Horizontal Divider
  horizontalDivider: {
    width: '100%',
    marginVertical: scaledSpacing(FIGMA.spacing.sectionGap),
  },

  // Footer Section
  footerSection: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    gap: scaledSpacing(FIGMA.spacing.iconTextGap),
  },
  alternativePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledSpacing(FIGMA.spacing.mediumGap),
  },
  upiIcon: {
    width: scaled(40),
    height: scaled(32),
    backgroundColor: '#E5E5E5',
    borderRadius: scaled(4),
  },
  alternativePaymentText: {
    color: FIGMA.colors.footerText,
    fontFamily: fontFamily.primary.semibold,
    fontSize: scaledFont(12),
    fontWeight: '600',
    lineHeight: scaledFont(16.92),
    letterSpacing: -0.48,
    textAlign: 'center', // MAJOR FIX: Added center alignment
    textTransform: 'uppercase',
  },
  paymentAppsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: scaled(72),
  },
  paymentAppItem: {
    alignItems: 'center',
    gap: scaledSpacing(FIGMA.spacing.mediumGap),
  },
  paymentAppIcon: {
    width: scaled(FIGMA.dimensions.iconContainerSize),
    height: scaled(FIGMA.dimensions.iconContainerSize),
    backgroundColor: '#E5E5E5',
    borderRadius: scaled(200),
  },
  paymentAppName: {
    color: FIGMA.colors.primaryText,
    fontFamily: fontFamily.primary.regular,
    fontSize: scaledFont(FIGMA.typography.appName.fontSize),
    fontWeight: FIGMA.typography.appName.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.appName.lineHeight),
    letterSpacing: FIGMA.typography.appName.letterSpacing,
    textAlign: 'center', // MAJOR FIX: Added center alignment
  },

  // ============================================
  // VERIFY STATE STYLES (1-30448)
  // ============================================

  // Verify Header
  verifyHeaderContainer: {
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    marginBottom: scaledSpacing(40),
  },
  verifyHeaderTitle: {
    color: FIGMA.colors.headerWhite,
    fontFamily: fontFamily.primary.regular,
    fontSize: scaledFont(FIGMA.typography.verifyTitle.fontSize),
    fontWeight: FIGMA.typography.verifyTitle.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.verifyTitle.lineHeight),
    letterSpacing: FIGMA.typography.verifyTitle.letterSpacing,
    textAlign: 'left',
  },

  // Agreement Details Section
  detailsSection: {
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    marginBottom: scaledSpacing(24),
    gap: scaledSpacing(16),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  detailLabel: {
    color: FIGMA.colors.detailLabel,           // #878787
    fontFamily: fontFamily.primary.regular,
    fontSize: scaledFont(FIGMA.typography.detailLabel.fontSize),
    fontWeight: FIGMA.typography.detailLabel.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.detailLabel.lineHeight),
    letterSpacing: FIGMA.typography.detailLabel.letterSpacing,
    textAlign: 'left',
  },
  detailValue: {
    color: FIGMA.colors.detailValue,           // #CBCBCB
    fontFamily: fontFamily.primary.regular,
    fontSize: scaledFont(FIGMA.typography.detailValue.fontSize),
    fontWeight: FIGMA.typography.detailValue.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.detailValue.lineHeight),
    letterSpacing: FIGMA.typography.detailValue.letterSpacing,
    textAlign: 'right',
  },

  // Enter Manually Link
  enterManuallyContainer: {
    alignItems: 'center',
    paddingHorizontal: scaledSpacing(FIGMA.spacing.horizontalPadding),
    marginBottom: scaledSpacing(32),
  },
  enterManuallyText: {
    color: FIGMA.colors.headerWhite,
    fontFamily: fontFamily.primary.semibold,
    fontSize: scaledFont(FIGMA.typography.enterManually.fontSize),
    fontWeight: FIGMA.typography.enterManually.fontWeight,
    lineHeight: scaledFont(FIGMA.typography.enterManually.lineHeight),
    letterSpacing: FIGMA.typography.enterManually.letterSpacing,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
