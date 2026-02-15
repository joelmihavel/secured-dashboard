/**
 * Initiate Payment Screen
 * Figma Reference: 41-8695 (Payment Breakdown - Cashback Applied)
 *
 * Pixel-perfect implementation:
 * - Background: #131313
 * - Card background: #1A1A1A
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
  Switch,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { z } from 'zod';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { SummaryRow, DashedDivider } from '@/src/components/payment';
import { useDashboard } from '@/src/hooks';
import {
  initiatePayUPayment,
  launchPayUCheckout,
  mockPayUCheckout,
  updatePaymentStatus,
} from '@/src/services/payment';
import { colors, spacing, radius } from '@/src/theme';

// Check if running in Expo Go (no native modules)
const isExpoGo = Constants.appOwnership === 'expo';

// Payment fee constants
const CARD_FEE_PERCENTAGE = 0.01; // 1% fee for card payments
const NETBANKING_FEE_RUPEES = 10; // Fixed fee for netbanking

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

// Exact Figma colors - from 41-8695 analysis
const FIGMA_COLORS = {
  background: '#131313',           // black.700
  cardBackground: '#1A1A1A',       // black.600 - Frame 2095586454
  headerBg: '#202020',             // black.500 - Frame 1686557240
  titleWhite: '#FFFFFF',           // white
  titleAccent: '#FF9A6D',          // brand.500 - cashback applied
  labelText: '#878787',            // neutral.600 - Rent due text
  valueText: '#DDDDDD',            // neutral.200 - Amount display
  successText: '#70BF73',          // success.default
  mutedText: '#CBCBCB',            // neutral.300 - Complete setup text
  secondaryText: '#A9A9A9',        // neutral.500 - Pay by 7 Dec text
  dividerColor: '#4D4D4D',         // black.400 - Rectangle 140
  borderColor: '#4D4D4D',          // black.400
  discountText: '#EF9194',         // Figma discount display
  iconColor: '#A6A6A6',            // black.200 - Vector icons
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

// Lock Icon
const LockIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M4 7V5C4 2.79 5.79 1 8 1C10.21 1 12 2.79 12 5V7M3 7H13C13.55 7 14 7.45 14 8V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V8C2 7.45 2.45 7 3 7Z"
      stroke={FIGMA_COLORS.mutedText}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function InitiatePaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rawParams = useLocalSearchParams<{ method: string }>();
  const { tenancy, upcomingPayment, cashback } = useDashboard();

  const [useCashback, setUseCashback] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const rentAmount = tenancy?.monthly_rent ?? 32500;
  const maintenanceAmount = 0;
  const cashbackAvailable = cashback?.available_balance ?? 325;
  const cashbackToApply = useCashback ? Math.min(cashbackAvailable, rentAmount) : 0;

  // Calculate fees based on method
  const getFee = () => {
    switch (method) {
      case 'card':
        return Math.round(rentAmount * CARD_FEE_PERCENTAGE);
      case 'netbanking':
        return NETBANKING_FEE_RUPEES;
      case 'upi':
        return 0;
      default:
        // Log unexpected method in development
        if (__DEV__) {
          console.warn(`Unexpected payment method: ${method}, defaulting to 0 fee`);
        }
        return 0;
    }
  };

  const fee = getFee();
  const totalRent = rentAmount + maintenanceAmount;
  const totalAmount = totalRent + fee - cashbackToApply;
  const daysUntilDue = 10; // Demo value

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);

    try {
      const { data, error } = await initiatePayUPayment({
        tenancyId: tenancy?.id ?? '',
        amountPaise: totalAmount * 100,
        paymentMethod: method, // Already validated by Zod schema
        applyCashback: useCashback,
        rentMonth: upcomingPayment?.rent_month ?? new Date().toISOString().slice(0, 7),
      });

      if (error || !data) {
        throw new Error(error ?? 'Failed to initiate payment');
      }

      const checkoutResult = isExpoGo
        ? await mockPayUCheckout(data.payuParams)
        : await launchPayUCheckout(data.payuParams);

      // Store client-side SDK response as metadata
      if (checkoutResult.payuResponse) {
        await updatePaymentStatus(data.paymentId, checkoutResult.payuResponse);
      }

      if (checkoutResult.status === 'cancelled') {
        setIsProcessing(false);
        return;
      }

      // Navigate to processing screen with paymentId; let it poll for final status
      router.replace({
        pathname: '/(payment)/processing',
        params: {
          paymentId: data.paymentId,
          amount: String(totalAmount),
          method,
        },
      } as never);
    } catch (error) {
      console.error('Payment error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Payment Error',
        error instanceof Error ? error.message : 'An error occurred while processing payment'
      );
      setIsProcessing(false);
    }
  }, [tenancy?.id, totalAmount, method, useCashback, upcomingPayment?.rent_month, router]);

  return (
    <Screen testID="initiate-payment-screen" style={styles.screen}>
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

        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>
            Rent due in <Text inherit style={styles.statusAccent}>{daysUntilDue} days</Text>
          </Text>
        </View>

        {/* Cashback Message */}
        <Text style={styles.cashbackMessage}>
          {cashbackAvailable > 0
            ? `Unlock Rs ${cashbackAvailable} cashback by paying before the 7th`
            : 'Pay on time to earn cashback on your next payment'}
        </Text>

        {/* Cashback Badge */}
        <View style={styles.cashbackBadge}>
          <Text style={styles.cashbackBadgeText}>
            {cashbackAvailable > 0 ? 'Cashback applied' : 'Cashback available'}
          </Text>
        </View>

        {/* Payment Breakdown Card */}
        <View style={styles.breakdownCard}>
          <SummaryRow
            label="Base rent"
            value={`Rs ${rentAmount.toLocaleString('en-IN')}`}
          />

          {maintenanceAmount > 0 && (
            <SummaryRow
              label="Maintenance"
              value={`Rs ${maintenanceAmount.toLocaleString('en-IN')}`}
            />
          )}

          <DashedDivider color={FIGMA_COLORS.dividerColor} />

          <SummaryRow
            label="Total rent"
            value={`Rs ${totalRent.toLocaleString('en-IN')}`}
          />

          {cashbackAvailable > 0 && useCashback && (
            <View style={styles.cashbackRowContainer}>
              <View style={styles.cashbackRow}>
                <Text style={styles.cashbackLabel}>Cashback</Text>
                <Switch
                  value={useCashback}
                  onValueChange={setUseCashback}
                  trackColor={{ false: colors.black[400], true: colors.success.default + '80' }}
                  thumbColor={useCashback ? colors.success.default : colors.neutral[500]}
                  style={styles.switch}
                />
              </View>
              <Text style={styles.cashbackValue}>
                -Rs {cashbackToApply.toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          <DashedDivider color={FIGMA_COLORS.dividerColor} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Payable Rent</Text>
            <Text style={styles.totalValue}>
              Rs {totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Pay Button */}
        <PrimaryButton
          title={`Pay Rs.${totalAmount.toLocaleString('en-IN')} now`}
          onPress={handlePayNow}
          loading={isProcessing}
          testID="pay-now-button"
        />

        {/* Cashback Incentive */}
        <Text style={styles.incentiveText}>
          Pay by the 7th to earn 1% cashback
        </Text>

        {/* Secure Payment Notice */}
        <View style={styles.secureRow}>
          <LockIcon />
          <Text style={styles.secureText}>Secured by PayU</Text>
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
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  statusBanner: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma analysis
    lineHeight: 20,
    color: FIGMA_COLORS.labelText, // neutral.600 #878787
  },
  statusAccent: {
    color: FIGMA_COLORS.titleAccent,
  },
  cashbackMessage: {
    fontFamily: 'PlusJakartaSans-Medium',  // bodySmMedium per Figma
    fontSize: 14,                          // bodySmMedium
    lineHeight: 20,
    color: FIGMA_COLORS.mutedText,         // neutral.300 #CBCBCB
    textAlign: 'center',
    marginBottom: 16,
  },
  cashbackBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: FIGMA_COLORS.titleAccent,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  cashbackBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: FIGMA_COLORS.titleAccent,
  },
  breakdownCard: {
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  cashbackRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashbackLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,
    textAlign: 'left',
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  cashbackValue: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.successText,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  totalLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.titleWhite,
    textAlign: 'left',
  },
  totalValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    lineHeight: 28,
    color: FIGMA_COLORS.titleWhite,
    textAlign: 'right',
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  incentiveText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.secondaryText,  // neutral.500 #A9A9A9 per Figma
    textAlign: 'center',
    marginTop: 16,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  secureText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.mutedText,
  },
});
