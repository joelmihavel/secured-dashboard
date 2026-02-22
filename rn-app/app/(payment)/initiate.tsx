/**
 * Initiate Payment Screen
 * Figma Reference: 41-8695 (Payment Breakdown - Cashback Applied) & 243-7398 (First Visit)
 *
 * Pixel-perfect implementation:
 * - Background: #131313
 * - Top card: #202020, 12px border radius
 * - Bottom card: #202020, 12px border radius, top dropshadow
 * - Status banner with coral accent
 * - Payment breakdown with cashback deduction
 * - Pay button with amount
 */

import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Svg, { Path, Line } from 'react-native-svg';
import { z } from 'zod';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { CashbackPill } from '@/src/components/payment/CashbackPill';
import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import {
  initiatePayUPayment,
  launchPayUCheckout,
  mockPayUCheckout,
} from '@/src/services/payment';
import { sanitizeErrorForUI } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

// Check if running in Expo Go (no native modules)
const isExpoGo = Constants.appOwnership === 'expo';

// ==============================================
// INPUT VALIDATION SCHEMA
// ==============================================

const PaymentMethodSchema = z.enum(['upi', 'card', 'netbanking'], {
  errorMap: () => ({ message: 'Invalid payment method. Must be upi, card, or netbanking.' }),
});

const PaymentParamsSchema = z.object({
  method: PaymentMethodSchema.optional().default('upi'),
});

type ValidatedPaymentParams = z.infer<typeof PaymentParamsSchema>;

// Exact Figma colors
const FIGMA_COLORS = {
  background: colors.black[700],           // black.700
  cardSurface: colors.black[500],          // black.500
  cardDivider: colors.black[600],          // black.600
  titleWhite: colors.white,           // white
  titleAccent: colors.brand[500],          // brand.500 - cashback applied
  labelText: colors.neutral[600],            // neutral.600 - Rent due text
  valueText: colors.neutral[300],            // neutral.300 - Amount display
  successText: colors.success.default,          // success.default
  mutedText: colors.neutral[300],            // neutral.300 - Complete setup text
  secondaryText: colors.neutral[500],        // neutral.500 - Pay by 7 Dec text
  dividerColor: colors.black[400],         // black.400
  discountText: '#EF9194',         // Figma error.default-2 for locked cashback
};

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 8L12 16L20 24"
      stroke={FIGMA_COLORS.titleWhite}
      strokeWidth={2.67}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.89 16L25.33 16"
      stroke={FIGMA_COLORS.titleWhite}
      strokeWidth={2.67}
      strokeLinecap="round"
    />
  </Svg>
);

// Frame icon (hash)
const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M6 2L4 14M12 2L10 14M2 6H14M2 10H14" stroke="#878787" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Lock Icon
const LockIcon = () => (
  <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
    <Path
      d="M4 7V5C4 2.79 5.79 1 8 1C10.21 1 12 2.79 12 5V7M3 7H13C13.55 7 14 7.45 14 8V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V8C2 7.45 2.45 7 3 7Z"
      stroke="#878787"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Crosshatch SVG for top card corners
const Crosshatch = ({ x, y }: { x: number; y: number }) => (
  <View style={[styles.crosshatch, { left: x, top: y }]}>
    <Svg width={20.5} height={35} viewBox="0 0 20.5 35">
      <Line x1={20.5} y1={0} x2={0} y2={20.5} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
      <Line x1={20.5} y1={14.5} x2={0} y2={35} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
    </Svg>
  </View>
);

// Summary Row Component matching the dark receipt design
const BreakdownRow = ({ label, value, isTotal = false, isCashback = false, isLocked = false }: { label: string, value: string, isTotal?: boolean, isCashback?: boolean, isLocked?: boolean }) => (
  <View style={styles.breakdownRow}>
    <View style={styles.breakdownLabelGroup}>
      <HashIcon />
      <Text style={styles.breakdownLabel}>
        {label}
        {isLocked && (
          <Text inherit style={styles.breakdownLabel}> <LockIcon /> </Text>
        )}
      </Text>
    </View>
    <Text style={[
      styles.breakdownValue,
      isTotal && styles.breakdownValueTotal,
      isCashback && isLocked && styles.breakdownValueLocked,
      isCashback && !isLocked && styles.breakdownValueSuccess,
    ]}>
      {value}
    </Text>
  </View>
);

export default function InitiatePaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawParams = useLocalSearchParams<{ method: string }>();
  const { tenancy, upcomingPayment, cashback } = useDashboard();

  const [useCashback, setUseCashback] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync payment flow state to Zustand store for cross-screen coordination
  const { setConfirming, setProcessing, setFailed, setTenancyId, setLastPayment, reset: resetPaymentStore } = usePaymentStore();
  const storedAmount = usePaymentStore(state => state.amount);

  // Validate payment method from URL params
  const validatedParams = useMemo((): ValidatedPaymentParams => {
    const result = PaymentParamsSchema.safeParse({ method: rawParams.method });
    if (!result.success) {
      console.warn('Invalid payment method param, defaulting to upi:', result.error.message);
      return { method: 'upi' };
    }
    return result.data;
  }, [rawParams.method]);

  const method = validatedParams.method;

  const rentAmount = storedAmount || tenancy?.monthly_rent || 30000;
  const maintenanceAmount = 2500;
  const totalRent = rentAmount + maintenanceAmount; // 32500

  const cashbackAvailable = cashback?.available_balance ?? 350;
  const agreementRent = tenancy?.monthly_rent ?? rentAmount;
  const isSetupComplete = tenancy?.verification_status?.bank_verified && tenancy?.verification_status?.utility_verified && tenancy?.verification_status?.landlord_approved;

  // New cashback formula: MIN(1% of rent, monthly_cap_remaining)
  // monthly_cap = 1% of agreement rent
  const monthlyCashbackCap = Math.round(agreementRent * 0.01);
  const onePercentOfRent = Math.round(totalRent * 0.01);
  const maxCashback = Math.min(onePercentOfRent, monthlyCashbackCap);

  // If setup isn't complete, cashback is locked. If complete, they can apply it.
  const isCashbackLocked = !isSetupComplete;
  const cashbackToApply = (useCashback && !isCashbackLocked) ? Math.min(maxCashback, cashbackAvailable) : 0;

  const totalAmount = totalRent - cashbackToApply;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 28;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(async () => {
    if (!isSetupComplete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/(setup)/index' as never);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);
    setConfirming();
    setTenancyId(tenancy?.id ?? '');

    try {
      const { data, error } = await initiatePayUPayment({
        tenancyId: tenancy?.id ?? '',
        paymentMethod: method,
        applyCashback: useCashback,
        rentMonth: upcomingPayment?.rent_month ?? new Date().toISOString().slice(0, 7),
      });

      if (error || !data) {
        throw new Error(error ?? 'Failed to initiate payment');
      }

      setProcessing(data.paymentId);
      setLastPayment(data.paymentId);

      const checkoutResult = isExpoGo
        ? await mockPayUCheckout(data.payuParams)
        : await launchPayUCheckout(data.paymentId, data.payuParams);

      if (checkoutResult.status === 'cancelled') {
        if (checkoutResult.isTxnInitiated) {
          // Bank may be processing - go to processing screen
          router.replace({
            pathname: '/(payment)/processing',
            params: { paymentId: data.paymentId, amount: String(totalAmount), method },
          } as never);
        } else {
          resetPaymentStore();
          setIsProcessing(false);
        }
        return;
      }

      router.replace({
        pathname: '/(payment)/processing',
        params: {
          paymentId: data.paymentId,
          amount: String(totalAmount),
          method,
        },
      } as never);
    } catch (err) {
      console.error('Payment error:', err);
      const rawMessage = err instanceof Error ? err.message : 'An error occurred';
      const errorMessage = sanitizeErrorForUI(rawMessage);
      setFailed('PAYMENT_ERROR', errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Payment Error', errorMessage);
      setIsProcessing(false);
    }
  }, [isSetupComplete, tenancy?.id, totalAmount, method, useCashback, upcomingPayment?.rent_month, router, setConfirming, setProcessing, setFailed, setTenancyId, setLastPayment, resetPaymentStore, isExpoGo]);

  const ctaText = isSetupComplete 
    ? `Pay \u20B9${totalAmount.toLocaleString('en-IN')} now` 
    : 'Add Payment Method to Pay';

  return (
    <Screen testID="initiate-payment-screen" style={styles.screen} padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
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

        {/* Outer container matching Figma 270px card logic */}
        <View style={styles.cardContainer}>
          
          {/* Top Card Section */}
          <View style={styles.topCard}>
            <View style={styles.topCardContent}>
              <Text style={styles.topCardTitle}>Rent due in {daysUntilDue} days</Text>
              <Text style={styles.topCardSubtitle}>
                {isSetupComplete ? 'Cashback applied successfully' : 'Complete setup to unlock 1% cashback'}
              </Text>

              {isCashbackLocked ? (
                <CashbackPill
                  amount={maxCashback}
                  label="Cashback"
                  variant="accumulating"
                  message="Complete bank verification, utility verification, and landlord onboarding to unlock cashback"
                />
              ) : (
                <CashbackPill
                  amount={cashbackToApply}
                  label="Cashback applied"
                  variant="applied"
                />
              )}
            </View>
            
            {/* Dark divider matching card curve */}
            <View style={styles.topCardDivider} />
            
            {/* Decorative crosshatches */}
            <Crosshatch x={16.25} y={17} />
            <Crosshatch x={277.25} y={87} />
          </View>

          {/* Dotted cutting line mimicking receipt */}
          <View style={styles.cuttingLineWrapper}>
            <Svg width="100%" height={1} viewBox="0 0 369 1" fill="none">
              <Path d="M0 0.5H369" stroke="#4D4D4D" strokeDasharray="4 4" />
            </Svg>
          </View>

          {/* Bottom Card Section (Breakdown) */}
          <View style={styles.bottomCard}>
            <View style={styles.breakdownInner}>
              <BreakdownRow
                label="Rent"
                value={`\u20B9 ${totalRent.toLocaleString('en-IN')}`}
              />
              <View style={styles.divider} />

              {/* Cashback row */}
              <BreakdownRow
                label="Cashback"
                value={`- \u20B9 ${isCashbackLocked ? maxCashback.toLocaleString('en-IN') : cashbackToApply.toLocaleString('en-IN')}`}
                isCashback
                isLocked={isCashbackLocked}
              />

              <View style={styles.gapSpacer} />
              <View style={styles.divider} />

              <BreakdownRow
                label="You Pay"
                value={`\u20B9 ${totalAmount.toLocaleString('en-IN')}`}
                isTotal
              />
            </View>

            {/* Perforations matching the Figma receipt edges */}
            <View style={styles.leftPerforation} />
            <View style={styles.rightPerforation} />
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* CTA Section */}
        <View style={styles.ctaWrapper}>
          <PrimaryButton
            title={ctaText}
            onPress={handlePayNow}
            loading={isProcessing}
            showDivider
            testID="pay-now-button"
          />

          {/* Subtext below button */}
          {!isSetupComplete && (
            <Text style={styles.ctaSubtext}>
              <Text inherit style={styles.ctaSubtextBase}>
                {'Complete bank verification, utility verification,\nand landlord onboarding to unlock cashback'}
              </Text>
            </Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginLeft: 40, // Matches Figma 40px padding
  },
  cardContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  // Top Card - Figma 243:7402
  topCard: {
    backgroundColor: FIGMA_COLORS.cardSurface,
    borderRadius: 12,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  topCardContent: {
    alignItems: 'center',
    gap: 8,
  },
  topCardTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: colors.neutral[600],
  },
  topCardSubtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    color: colors.neutral[300],
  },
  cashbackPillWrapper: {
    marginTop: 8,
    alignSelf: 'center',
  },
  topCardDivider: {
    position: 'absolute',
    bottom: 0,
    height: 5,
    width: 268,
    backgroundColor: colors.black[600],
  },
  crosshatch: {
    position: 'absolute',
  },
  // Dotted cutting line area
  cuttingLineWrapper: {
    width: 369, // Wider than card per Figma
    height: 1,
    marginVertical: 10,
    zIndex: 1,
  },
  // Bottom Card - Breakdown
  bottomCard: {
    backgroundColor: FIGMA_COLORS.cardSurface,
    width: 270, // Matches Figma width
    height: 347,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    // Figma Drop shadow
    shadowColor: colors.black[900],
    shadowOffset: { width: 0, height: 35 },
    shadowOpacity: 0.09,
    shadowRadius: 35,
    elevation: 10,
    position: 'relative',
    alignItems: 'center',
  },
  breakdownInner: {
    width: '100%',
    paddingTop: 56,
    paddingHorizontal: 24,
    gap: 16,
  },
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
    color: colors.neutral[600],
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[300],
  },
  breakdownValueTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: colors.neutral[200],
  },
  breakdownValueLocked: {
    color: FIGMA_COLORS.discountText, // #EF9194
  },
  breakdownValueSuccess: {
    color: FIGMA_COLORS.successText, // #70BF73
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.dividerColor,
    width: '100%',
  },
  gapSpacer: {
    height: 16, // Extra gap before total
  },
  // Perforations on bottom card sides
  leftPerforation: {
    position: 'absolute',
    left: -7,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background, // Punches a hole
  },
  rightPerforation: {
    position: 'absolute',
    right: -7,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background,
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
  ctaSubtext: {
    textAlign: 'center',
  },
  ctaSubtextBase: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[500],
  },
  ctaSubtextUnderline: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: colors.neutral[100],
    textDecorationLine: 'underline',
  },
});

