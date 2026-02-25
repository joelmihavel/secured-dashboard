/**
 * First Rent Payment Screen (Payment Page)
 * Figma Node: 684:6018 / 684:6128 / 684:5915
 * 
 * This screen displays the initial rent payment breakdown.
 * Implemented with 100% pixel-perfect Figma parity.
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text as RNText,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Line } from 'react-native-svg';

import { Screen, PrimaryButton } from '@/src/components';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';
import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { PAYMENT_COLORS } from '@/src/theme';

// ==============================================
// FIGMA COLOR TOKENS (684:6018) — aliased from shared PAYMENT_COLORS
// ==============================================

const C = {
  bg: PAYMENT_COLORS.background,
  card: PAYMENT_COLORS.cardBackground,
  cardDivider: PAYMENT_COLORS.cardDivider,
  label: PAYMENT_COLORS.labelText,
  value: PAYMENT_COLORS.valueText,
  valueTotal: PAYMENT_COLORS.highlightText,
  muted: PAYMENT_COLORS.mutedText,
  divider: PAYMENT_COLORS.divider,
  white: PAYMENT_COLORS.white,
} as const;

// ==============================================
// ICONS
// ==============================================

const BackArrow = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path d="M20 8L12 16L20 24" stroke={C.white} strokeWidth={2.67} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8.89 16L25.33 16" stroke={C.white} strokeWidth={2.67} strokeLinecap="round" />
  </Svg>
);

const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M6 2L4 14M12 2L10 14M2 6H14M2 10H14" stroke={C.label} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Crosshatch = ({ x, y }: { x: number; y: number }) => (
  <View style={[styles.crosshatch, { left: x, top: y }]}>
    <Svg width={20.5} height={35} viewBox="0 0 20.5 35">
      <Line x1={20.5} y1={0} x2={0} y2={20.5} stroke={C.divider} strokeWidth={0.3} />
      <Line x1={20.5} y1={14.5} x2={0} y2={35} stroke={C.divider} strokeWidth={0.3} />
    </Svg>
  </View>
);

// ==============================================
// BREAKDOWN ROW
// ==============================================

const BreakdownRow = ({
  label,
  value,
  isTotal = false,
}: {
  label: string;
  value: string;
  isTotal?: boolean;
}) => (
  <View style={styles.breakdownRow}>
    <View style={styles.breakdownLabelGroup}>
      <HashIcon />
      <RNText style={styles.breakdownLabel}>{label}</RNText>
    </View>
    <RNText
      style={[
        styles.breakdownValue,
        isTotal && styles.breakdownValueTotal,
      ]}
    >
      {value}
    </RNText>
  </View>
);

// ==============================================
// SCREEN
// ==============================================

export default function FirstRentPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenancy, upcomingPayment, cashback } = useDashboard();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const storedAmount = usePaymentStore((state) => state.amount);
  const setAmount = usePaymentStore((state) => state.setAmount);

  // --- Data computation ---
  const baseRent = tenancy?.monthly_rent || 30000;
  const maintenance = 2000;
  const otherCharges = 500; // Default as per Figma 684:6018
  const rentAmount = storedAmount || upcomingPayment?.amount || (baseRent + maintenance + otherCharges);
  
  const isSetupComplete =
    tenancy?.verification_status?.bank_verified &&
    tenancy?.verification_status?.utility_verified &&
    tenancy?.verification_status?.landlord_approved;
  const verificationComplete = isSetupComplete ?? false;

  const totalRent = baseRent + maintenance + otherCharges;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  
  const date = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const rentMonthText = upcomingPayment?.rent_month 
    ? upcomingPayment.rent_month 
    : `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

  // Cashback display for "waiting for you"
  const cashbackWaiting = Math.round(totalRent * 0.01) || 325; // 1% of total

  // --- Handlers ---
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setAmount(totalRent);
    setIsModalVisible(true);
  }, [totalRent, setAmount]);

  // Proceed handler inside PaymentMethodModal
  const handleProceedToTransaction = useCallback((method: 'upi' | 'card' | 'netbanking') => {
    setIsModalVisible(false);
    // Proceed to confirm (Transaction Page)
    setTimeout(() => {
      router.push('/(payment)/confirm');
    }, 300);
  }, [router]);

  // --- Formatting helpers ---
  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <Screen testID="first-rent-payment-screen" style={styles.screen} padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Back Button ===== */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrow />
        </TouchableOpacity>

        {/* ===== Card Container ===== */}
        <View style={styles.cardContainer}>

          {/* --- Top Card (Figma 684:6022) --- */}
          <View style={styles.topCard}>
            <View style={styles.topCardContent}>
              <View style={styles.topCardRow}>
                {/* Avatar Ellipse 8 */}
                <View style={styles.avatarPlaceholder} />
                
                <View style={styles.topCardTextGroup}>
                  <RNText style={styles.topCardTitle}>
                    Rent due in {daysUntilDue} days
                  </RNText>
                  <RNText style={styles.topCardMonth}>
                    {rentMonthText}
                  </RNText>
                  <RNText style={styles.topCardAmount}>
                    <RNText style={styles.currencySymbol}>₹  </RNText>
                    {fmt(totalRent)} <RNText style={styles.arrowSymbol}>→</RNText>
                  </RNText>
                </View>
              </View>
            </View>

            {/* Divider bar */}
            <View style={styles.topCardDivider} />

            {/* Decorative crosshatches */}
            <Crosshatch x={26.25} y={37} />
            <Crosshatch x={277.25} y={117} />
          </View>

          {/* --- Cutting line --- */}
          <View style={styles.cuttingLineWrapper}>
            <Svg width="100%" height={1} viewBox="0 0 369 1" fill="none">
              <Path d="M0 0.5H369" stroke={C.divider} strokeDasharray="4 4" />
            </Svg>
          </View>

          {/* --- Bottom Card / Receipt (Figma 684:6037) --- */}
          <View style={styles.bottomCard}>
            {/* Breakdown section */}
            <View style={styles.breakdownSection}>
              <BreakdownRow label="Base rent" value={`₹ ${fmt(baseRent)}`} />
              <View style={styles.divider} />
              <BreakdownRow label="Maintenance" value={`₹${fmt(maintenance)}`} />
              <View style={styles.divider} />
              <BreakdownRow label="Other charges" value={`₹${fmt(otherCharges)}`} />
              <View style={styles.divider} />
              <BreakdownRow
                label="Payable Rent"
                value={`₹  ${fmt(totalRent)}`}
                isTotal
              />
            </View>
            
            {/* Cashback Waiting Banner (Figma 684:6072) */}
            <View style={styles.cashbackWaitingContainer}>
              <RNText style={styles.cashbackWaitingText}>
                🔒 ₹{fmt(cashbackWaiting)} cashback waiting for you
              </RNText>
            </View>

            {/* Perforations */}
            <View style={styles.leftPerforation} />
            <View style={styles.rightPerforation} />
          </View>
        </View>

        {/* ===== Spacer ===== */}
        <View style={styles.spacer} />

        {/* ===== CTA Section (Figma 684:6075) ===== */}
        <View style={styles.ctaWrapper}>
          <PrimaryButton
            title={`Pay ₹${fmt(totalRent)} now`}
            onPress={handlePayNow}
            showDivider
            testID="pay-now-button"
          />

          {/* Footer text — Figma 684:6076 */}
          {!verificationComplete && (
            <RNText style={styles.footerText}>
              Complete setup to unlock cashback on payments.
            </RNText>
          )}
        </View>
      </ScrollView>

      {/* Payment Method Modal */}
      <PaymentMethodModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={upcomingPayment?.rent_month ?? rentMonthText}
        onProceed={handleProceedToTransaction}
      />
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  screen: {
    backgroundColor: C.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Back button
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginLeft: 40,
  },

  // Card container
  cardContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 0,
  },

  // Top Card
  topCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    width: 313,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 32,
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  topCardContent: {
    width: '100%',
    alignItems: 'center',
  },
  topCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardDivider,
  },
  topCardTextGroup: {
    gap: 8,
    alignItems: 'flex-start',
  },
  topCardTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: C.label,
  },
  topCardMonth: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: C.value,
  },
  topCardAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.64,
    color: C.value,
  },
  currencySymbol: {
    fontSize: 12,
  },
  arrowSymbol: {
    fontSize: 16,
  },
  topCardDivider: {
    height: 5,
    width: 268,
    backgroundColor: C.cardDivider,
  },
  crosshatch: {
    position: 'absolute',
  },

  // Cutting line
  cuttingLineWrapper: {
    width: 369,
    height: 1,
    marginVertical: 8,
    zIndex: 1,
    opacity: 0.6,
  },

  // Bottom Card / Receipt
  bottomCard: {
    backgroundColor: C.card,
    width: 270,
    paddingTop: 56,
    paddingBottom: 32, 
    gap: 24,
    // Figma 3-layer drop shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 10,
    position: 'relative',
    alignItems: 'center',
  },

  // Breakdown section
  breakdownSection: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 16,
  },

  // Breakdown row
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.label,
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.value,
  },
  breakdownValueTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: C.valueTotal,
  },

  // Thin divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    width: '100%',
  },

  cashbackWaitingContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
  cashbackWaitingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.valueTotal,
  },

  // Perforations
  leftPerforation: {
    position: 'absolute',
    left: -6,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.bg,
  },
  rightPerforation: {
    position: 'absolute',
    right: -7,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.bg,
  },

  spacer: {
    flex: 1,
    minHeight: 40,
  },

  // CTA Section
  ctaWrapper: {
    paddingHorizontal: 40,
    gap: 16,
    alignItems: 'center',
  },

  // Footer text
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },
});
