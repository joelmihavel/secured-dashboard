/**
 * MethodSelectorContent — Payment method selection view
 *
 * Figma 769:309407
 *
 * Design:
 *   Radio-based selection (16x16 filled circles, no payment type icons)
 *   Solid hairline dividers #4D4D4D
 *   Heading: "Choose a\nPayment Method" with accent on second line
 *   CTA: outlined button with thin #FF9A6D border
 */

import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Linking,
  Text as RNText,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
  FadeInRight,
} from 'react-native-reanimated';

import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { useDashboard, useFeeRates } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { getGatewayFeeRates, computeFee, formatFeeLabel } from '@/src/services/payment';
import { colors } from '@/src/theme';

import type { PaymentMethodType, MethodSelectorContentProps } from './types';

// ==============================================
// FIGMA COLOR TOKENS (from REST API extraction)
// ==============================================

const FIGMA = {
  radioUnselected: '#A6A6A6',
  radioSelected: '#FF9A6D',
  selectedLabel: '#D2D2D2',
  unselectedLabel: '#878787',
  feeText: '#CBCBCB',
  divider: '#4D4D4D',
  disclaimerText: '#A9A9A9',
  headingAccent: colors.brand[500],
};

// ==============================================
// INTERNAL TYPES
// ==============================================

interface PaymentMethod {
  id: string;
  type: 'card' | 'debit_card' | 'upi' | 'netbanking';
  title: string;
  fee: string;
  feeAmount?: number;
  isDisabled?: boolean;
  disabledReason?: string;
}

// ==============================================
// RADIO CIRCLE — Figma: 16x16 frame, 13.33px circle
// Unselected: #A6A6A6 outline, Selected: #FF9A6D filled
// ==============================================

const RadioCircle = memo(({ isSelected }: { isSelected: boolean }) => {
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 150 });
  }, [isSelected, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      backgroundColor: interpolateColor(
        t,
        [0, 1],
        ['rgba(0,0,0,0)', FIGMA.radioSelected],
      ),
      borderColor: interpolateColor(
        t,
        [0, 1],
        [FIGMA.radioUnselected, FIGMA.radioSelected],
      ),
      borderWidth: Math.max(1.5 * (1 - t), 0.5),
    };
  });

  return (
    <View style={styles.radioFrame}>
      <Animated.View
        style={[
          styles.radioCircle,
          animatedStyle,
        ]}
      />
    </View>
  );
});

// ==============================================
// SOLID DIVIDER — Figma: 0.25px #4D4D4D (not dashed)
// ==============================================

const SolidDivider = memo(() => <View style={styles.solidDivider} />);

// ==============================================
// PAYMENT METHOD ROW
// Figma: Radio(16x16) + gap4 + Label → SPACE_BETWEEN → Fee/pill
// ==============================================

const PaymentMethodRow = memo(({
  method,
  isSelected,
  onSelect,
  isInitiating,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: (id: string) => void;
  isInitiating: boolean;
}) => {
  const isDisabled = method.isDisabled ?? false;

  const labelProgress = useSharedValue(isSelected && !isDisabled ? 1 : 0);

  useEffect(() => {
    labelProgress.value = withTiming(
      isSelected && !isDisabled ? 1 : 0,
      { duration: 200 }
    );
  }, [isSelected, isDisabled, labelProgress]);

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        labelProgress.value,
        [0, 1],
        [FIGMA.unselectedLabel, FIGMA.selectedLabel],
      ),
    };
  });

  return (
    <View>
      <Pressable
        onPress={() => {
          if (isDisabled || isInitiating) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect(method.id);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, disabled: isDisabled || isInitiating }}
        accessibilityLabel={`${method.title}, ${isDisabled ? method.disabledReason : method.fee}`}
        style={({ pressed }) => [
          styles.methodRow,
          pressed && !isDisabled && !isInitiating && { opacity: 0.6, transform: [{ scale: 0.98 }] },
        ]}
      >
        {/* Left: Radio + Label */}
        <View style={styles.methodRowLeft}>
          <View style={styles.radioLabelGroup}>
            <RadioCircle isSelected={isSelected && !isDisabled} />
            <Animated.Text style={[styles.methodLabel, animatedLabelStyle]}>
              {method.title}
            </Animated.Text>
          </View>
        </View>

        {/* Right: Fee text or disabled pill */}
        <View style={styles.methodRowRight}>
          {isDisabled ? (
            <RNText style={styles.disabledPillText}>Unavailable now</RNText>
          ) : (
            <RNText style={[styles.feeText, { color: FIGMA.feeText }]}>
              {method.fee}
            </RNText>
          )}
        </View>
      </Pressable>

      {/* Setup prompt pill below disabled credit card */}
      {isDisabled && method.disabledReason && (
        <View style={styles.disabledPillContainer}>
          <RNText style={styles.disabledPillLabel}>{method.disabledReason}</RNText>
        </View>
      )}

    </View>
  );
});

// ==============================================
// METHOD SELECTOR CONTENT
// ==============================================

export function MethodSelectorContent({
  onBack,
  onProceed,
  isInitiating,
}: MethodSelectorContentProps) {
  const { tenancy, cashback, user } = useDashboard();
  const storedAmount = usePaymentStore((state) => state.amount);
  const { data: dynamicRates } = useFeeRates();

  // Credit card disabled logic — unlocked for all users
  const creditCardDisabled = false;
  const creditCardDisabledReason = undefined;

  const [selectedMethod, setSelectedMethod] = useState<string>('upi-1');
  const rentAmount = storedAmount || tenancy?.monthly_rent || 0;

  // Fee computed on post-cashback amount (matches backend + confirm screen)
  const agreementRent = tenancy?.monthly_rent ?? rentAmount;
  const cashbackAmount = Math.round(Math.min(rentAmount, agreementRent) * (cashback?.discount_rate ?? 0.01));
  const accumulatedBalanceRupees = Math.floor((user?.cashback_balance_paise ?? 0) / 100);
  const appliedCashback = Math.min(cashbackAmount + accumulatedBalanceRupees, rentAmount);
  const feeBaseAmount = rentAmount - appliedCashback;

  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const rates = dynamicRates ?? getGatewayFeeRates();

    return [
      {
        id: 'upi-1',
        type: 'upi' as const,
        title: 'UPI',
        fee: formatFeeLabel(rates.upi, feeBaseAmount),
        feeAmount: computeFee(rates.upi, feeBaseAmount),
      },
      {
        id: 'netbanking-1',
        type: 'netbanking' as const,
        title: 'Net Banking',
        fee: formatFeeLabel(rates.netbanking, feeBaseAmount),
        feeAmount: computeFee(rates.netbanking, feeBaseAmount),
      },
      {
        id: 'debit-card-1',
        type: 'debit_card' as const,
        title: 'Debit Card',
        fee: formatFeeLabel(rates.debit_card, feeBaseAmount),
        feeAmount: computeFee(rates.debit_card, feeBaseAmount),
      },
      {
        id: 'card-1',
        type: 'card' as const,
        title: 'Credit Card',
        fee: formatFeeLabel(rates.credit_card, feeBaseAmount),
        feeAmount: computeFee(rates.credit_card, feeBaseAmount),
        isDisabled: creditCardDisabled,
        disabledReason: creditCardDisabledReason,
      },
    ];
  }, [feeBaseAmount, dynamicRates, creditCardDisabled, creditCardDisabledReason]);

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const isSelectedDisabled = selectedPaymentMethod?.isDisabled ?? false;

  const handleSelectMethod = useCallback((methodId: string) => {
    setSelectedMethod(methodId);
  }, []);

  const handleProceed = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const method = paymentMethods.find((m) => m.id === selectedMethod);
    const methodType: PaymentMethodType = method?.type ?? 'upi';
    onProceed(methodType);
  }, [paymentMethods, selectedMethod, onProceed]);

  return (
    <View style={styles.sheetContent}>
      {/* Back button */}
      <View style={styles.backButtonContainer}>
        <BackButton
          onPress={onBack}
          style={styles.backButton}
          color={colors.white}
        />
      </View>

      {/* Heading: "Choose a\nPayment Method" — Figma: 28px Regular, accent on line 2 */}
      <View style={styles.headingContainer}>
        <RNText style={styles.headingText}>
          {'Choose a\n'}
          <RNText style={styles.headingAccent}>Payment Method</RNText>
        </RNText>
      </View>

      {/* Payment Method Rows — cascading reveal */}
      <View style={styles.methodsContainer}>
        {paymentMethods.map((method, index) => (
          <React.Fragment key={method.id}>
            <Animated.View entering={FadeInRight.delay(index * 60).duration(300)}>
              <PaymentMethodRow
                method={method}
                isSelected={selectedMethod === method.id}
                onSelect={handleSelectMethod}
                isInitiating={isInitiating ?? false}
              />
            </Animated.View>
            {index < paymentMethods.length - 1 && <SolidDivider />}
          </React.Fragment>
        ))}
      </View>

      {/* Cashback pill — below payment methods, center aligned */}
      <View style={styles.cashbackPillContainer}>
        <View style={styles.cashbackPill}>
          <RNText style={styles.cashbackPillText}>You'll pay 1% less</RNText>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaDivider} />
        <PrimaryButton
          title="Proceed"
          onPress={handleProceed}
          loading={isInitiating}
          disabled={isInitiating || isSelectedDisabled}
          testID="modal-method-proceed-button"
        />
        <RNText style={styles.disclaimerText}>
          {'By proceeding, you agree to the '}
          <RNText
            style={{ textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://www.flent.in/secured-tnc')}
          >
            payment terms
          </RNText>
        </RNText>
      </View>
    </View>
  );
}

// ==============================================
// STYLES — Figma-accurate values
// ==============================================

const styles = StyleSheet.create({
  sheetContent: {
    paddingTop: 16,
    gap: 24,
    paddingBottom: 24,
  },

  // Back button
  backButtonContainer: {
    paddingHorizontal: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Heading — Figma: 28px Regular, 40 line-height, -1 letter-spacing, px 48
  headingContainer: {
    paddingHorizontal: 48,
  },
  headingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.white,
  },
  headingAccent: {
    color: FIGMA.headingAccent,
  },

  // Cashback pill — below methods, center aligned, orange transparent bg
  cashbackPillContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  cashbackPill: {
    backgroundColor: '#FF9A6D',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#000000',
  },

  // Methods container — Figma: px 48, gap 16
  methodsContainer: {
    paddingHorizontal: 48,
    gap: 16,
  },

  // Solid divider — Figma: 0.25px #4D4D4D (NOT dashed)
  solidDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA.divider,
  },

  // Method row — Figma: HORIZONTAL, SPACE_BETWEEN, CENTER, h=20
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 20,
  },
  methodRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  // Radio + Label group — Figma: gap 4
  radioLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  methodRowRight: {
    marginLeft: 4,
  },

  // Radio circle — Figma: 16x16 frame, 13.33px inner circle
  radioFrame: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircle: {
    width: 13.33,
    height: 13.33,
    borderRadius: 6.67,
  },

  // Method label — Figma: 12px Regular
  methodLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
  },

  // Fee text — Figma: 14px Regular
  feeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },

  // Disabled pill text
  disabledPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#878787',
  },
  // Setup prompt pill — Figma 4109:65992
  disabledPillContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
    backgroundColor: '#202020',
    borderRadius: 200, // Pill — matches dashboard announcement pill
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 20,
  },
  disabledPillLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
    flex: 1,
  },
  disabledPillLink: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
    textDecorationLine: 'underline' as const,
  },

  // CTA decorative divider — Figma: 2px tall, 24px wide, #4D4D4D, centered
  ctaDivider: {
    width: 24,
    height: 2,
    borderRadius: 200,
    backgroundColor: FIGMA.divider,
    alignSelf: 'center',
  },

  // CTA Section — Figma: px 48, gap 16
  ctaSection: {
    paddingHorizontal: 48,
    gap: 16,
    paddingBottom: 24,
    alignItems: 'stretch',
  },

  // Disclaimer — Figma: 12px Regular #A9A9A9, center
  disclaimerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.disclaimerText,
    textAlign: 'center',
  },
});
