/**
 * First Rent Payment Screen (Post Approval)
 *
 * Figma References:
 * - 1-31175 (Bottom sheet overlay for "Pay Rent")
 *
 * This screen displays the initial rent payment breakdown with savings,
 * landlord details, and payment options including 3rd-party apps.
 * Implemented with 100% pixel-perfect Figma parity using StyleSheets.
 */

import React, { useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, Logo, DottedPattern } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// CONSTANTS - EXACT FIGMA VALUES
// ============================================

const FIGMA_COLORS = {
  screenBackground: colors.black[700],    // black.700
  cardBackground: colors.white,      // white
  handle: '#D9D9D9',              // neutral.200
  primaryText: colors.black[900],         // black
  secondaryText: colors.neutral[500],       // neutral.500
  divider: colors.neutral[100],             // neutral.100 (for dotted/solid lines)
  successText: colors.success.default,         // success.default
  buttonBackground: colors.black[900],    // black
  buttonBorder: colors.neutral[600],        // neutral.600
  buttonText: colors.white,          // white
  appLabel: colors.neutral[600],            // neutral.600
  iconBg: colors.neutral[100],              // neutral.100
  transparent: 'transparent',
} as const;

// ============================================
// SVGs
// ============================================

const VerticalDashedLine = () => (
  <Svg width={1} height={33} viewBox="0 0 1 33" fill="none">
    <Path
      d="M0.253846 0V33"
      stroke="#1A1A1A"
      strokeWidth={0.5}
      strokeDasharray="8 8"
    />
  </Svg>
);

const HorizontalLine = () => (
  <Svg width="100%" height={1} viewBox="0 0 393 1" fill="none">
    <Path d="M0 0.25H393" stroke="#EEEEEE" strokeWidth={0.5} />
  </Svg>
);

const WalletIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M4.77419 4.77419V12C4.77419 12.5475 4.9917 13.0727 5.37888 13.4598C5.76605 13.847 6.29117 14.0645 6.83871 14.0645H17.1613C17.7088 14.0645 18.234 13.847 18.6211 13.4598C19.0083 13.0727 19.2258 12.5475 19.2258 12V4.77419" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <Path d="M8.78947 8.21053V1.89474C8.78947 1.33639 9.01128 0.8009 9.40609 0.40609C9.8009 0.01128 10.3364 -0.210526 10.8947 -0.210526H13C13.5583 -0.210526 14.0938 0.01128 14.4886 0.40609C14.8835 0.8009 15.1053 1.33639 15.1053 1.89474V8.21053" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)"/>
  </Svg>
);

const DiscountIcon = () => (
  <Svg width={16} height={20} viewBox="0 0 17 20" fill="none">
    <Path d="M6.23758 20.0001H1.86316V10.6031H0V8.0109H1.86316C0.82626 3.99289 3.75334 1.58428 5.3465 0.882227C10.0125 -1.58041 14.8514 1.69229 16.6876 3.63647V20.0001H12.3132V5.82368C9.78572 1.67608 6.61562 2.63738 5.3465 3.63647C3.72634 6.42314 6.02156 7.71387 7.37169 8.0109H9.63991V10.6031H6.23758V20.0001Z" fill="black"/>
  </Svg>
);

// App Icons (Placeholders simulating the actual external app icons)
const GPayIcon = () => (
  <Image source={require('@/assets/images/adaptive-icon.png')} style={styles.appIconImage} />
);
const PaytmIcon = () => (
  <Image source={require('@/assets/images/adaptive-icon.png')} style={styles.appIconImage} />
);
const PhonePeIcon = () => (
  <Image source={require('@/assets/images/adaptive-icon.png')} style={styles.appIconImage} />
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function FirstRentPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenancy, cashback } = useDashboard();

  // Real data from dashboard
  const rentAmount = tenancy?.monthly_rent ?? 32175;
  const cashbackSaved = cashback?.available_balance ?? 325;
  const landlordName = tenancy?.landlord_name ?? '[Landlord Name]';

  const handlePay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Navigate to the payment method selection flow
    router.push('/(payment)/select-method' as never);
  }, [router]);

  return (
    <Screen testID="first-rent-payment-screen" padded={false} style={{ backgroundColor: FIGMA_COLORS.screenBackground }}>
      {/* Background Pattern - Absolute positioned to avoid scroll stretching */}
      <View style={styles.patternContainer}>
        <DottedPattern />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 34,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Logo size={40} />
        </View>

        {/* White Bottom Sheet Card */}
        <View style={styles.card}>
          {/* Drag Handle */}
          <View style={styles.handle} />

          <View style={styles.cardInner}>
            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Pay Rent</Text>
            </View>

            {/* Rent Summary Block */}
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                {/* Total Payable Rent */}
                <View style={styles.summaryItem}>
                  <View style={styles.iconCircle}>
                    <WalletIcon />
                  </View>
                  <View style={styles.summaryTextGroup}>
                    <Text style={styles.summaryLabel}>TOTAL PAYABLE RENT</Text>
                    <Text style={styles.summaryAmount}>
                      <Text inherit style={styles.currencySymbol}>₹  </Text>
                      {rentAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Dashed Line */}
                <View style={styles.verticalDivider}>
                  <VerticalDashedLine />
                </View>

                {/* Savings */}
                <View style={styles.summaryItem}>
                  <View style={styles.iconCircle}>
                    <DiscountIcon />
                  </View>
                  <View style={styles.summaryTextGroup}>
                    <Text style={styles.successText}>
                      saved ₹ {cashbackSaved} →
                    </Text>
                    <Text style={styles.summarySubLabel}>
                      using flent cashback
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Payment Details */}
            <View style={styles.paymentDetails}>
              {/* Paying To */}
              <View style={styles.payingToRow}>
                <Text style={styles.detailLabel}>Paying to</Text>
                <Text style={styles.detailLabel}>{landlordName}</Text>
              </View>

              {/* Bank Info */}
              <View style={styles.bankInfoRow}>
                <View style={styles.bankLogoPlaceholder} />
                <View style={styles.bankTextGroup}>
                  <Text style={styles.bankName}>ICICI</Text>
                  <Text style={styles.bankNumber}>XXXX XXXX XXXX 2003</Text>
                </View>
              </View>

              {/* Pay Now Button */}
              <TouchableOpacity
                onPress={handlePay}
                style={styles.payNowButton}
                accessibilityRole="button"
              >
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>

              <Text style={styles.secureText}>All payments are 100% secure</Text>
            </View>

            {/* Divider */}
            <View style={styles.horizontalDivider}>
              <HorizontalLine />
            </View>

            {/* Other Apps Section */}
            <View style={styles.otherAppsSection}>
              <View style={styles.otherAppsHeader}>
                <View style={styles.appsIconPlaceholder} />
                <Text style={styles.otherAppsTitle}>PAY BY ANY APP INSTEAD</Text>
              </View>

              <View style={styles.appsRow}>
                <View style={styles.appItem}>
                  <GPayIcon />
                  <Text style={styles.appName}>Google Pay</Text>
                </View>
                <View style={styles.appItem}>
                  <PaytmIcon />
                  <Text style={styles.appName}>PayTM</Text>
                </View>
                <View style={styles.appItem}>
                  <PhonePeIcon />
                  <Text style={styles.appName}>PhonePe</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  patternContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 405, // Matches the height defined in Figma
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 48, // Figma layout padding
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  card: {
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderTopLeftRadius: 22.79,
    borderTopRightRadius: 22.79,
    paddingTop: 15.19,
    alignItems: 'center',
    width: '100%',
    flex: 1, // Let card fill the remaining space
  },
  handle: {
    backgroundColor: FIGMA_COLORS.handle,
    width: 28,
    height: 4,
    borderRadius: 200,
    marginBottom: 16,
  },
  cardInner: {
    width: '100%',
    paddingBottom: 24,
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 39.48,
    letterSpacing: -0.56,
    color: FIGMA_COLORS.primaryText,
    textAlign: 'center',
  },
  summaryBlock: {
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FIGMA_COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryTextGroup: {
    gap: 4,
  },
  summaryLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    color: FIGMA_COLORS.secondaryText,
  },
  summaryAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.primaryText,
  },
  currencySymbol: {
    fontSize: 12,
  },
  verticalDivider: {
    width: 1,
    height: 33,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.successText,
  },
  summarySubLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    color: FIGMA_COLORS.secondaryText,
  },
  paymentDetails: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 16,
  },
  payingToRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.primaryText,
  },
  bankInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  bankLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: FIGMA_COLORS.iconBg,
  },
  bankTextGroup: {
    gap: 2,
  },
  bankName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 28.8,
    letterSpacing: -0.176,
    color: FIGMA_COLORS.primaryText,
  },
  bankNumber: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.primaryText,
  },
  payNowButton: {
    backgroundColor: FIGMA_COLORS.buttonBackground,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: FIGMA_COLORS.buttonBorder,
    borderRadius: 200,
    paddingVertical: 8,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  payNowText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 25.2,
    letterSpacing: -0.154,
    color: FIGMA_COLORS.buttonText,
  },
  secureText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 21.6,
    letterSpacing: -0.132,
    color: FIGMA_COLORS.primaryText,
    textAlign: 'center',
  },
  horizontalDivider: {
    width: '100%',
    height: 1,
    marginBottom: 16,
  },
  otherAppsSection: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: 'center',
  },
  otherAppsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appsIconPlaceholder: {
    width: 42.67,
    height: 32,
    backgroundColor: FIGMA_COLORS.iconBg,
    borderRadius: 4,
  },
  otherAppsTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 12,
    lineHeight: 16.92,
    color: FIGMA_COLORS.appLabel,
    textTransform: 'uppercase',
  },
  appsRow: {
    flexDirection: 'row',
    gap: 32, // gap between app items
  },
  appItem: {
    alignItems: 'center',
    gap: 8,
    width: 72,
  },
  appIconImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FIGMA_COLORS.iconBg,
  },
  appName: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.48,
    color: FIGMA_COLORS.primaryText,
    textAlign: 'center',
  },
});

