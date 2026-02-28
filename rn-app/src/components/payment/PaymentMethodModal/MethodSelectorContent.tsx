/**
 * MethodSelectorContent — Payment method selection view
 *
 * Figma 769:309407 (first visit / not-all-setup)
 * Figma 684:6128 (all instruments set up)
 *
 * Design:
 *   Radio-based selection (16x16 filled circles, no payment type icons)
 *   Edit pencil 16x16 #656565 stroke
 *   Solid hairline dividers #4D4D4D
 *   Heading: "Choose a\nPayment Method" with accent on second line
 *   CTA: outlined button with thin #FF9A6D border
 */

import React, { useState, useMemo, memo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Text as RNText,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';

import { PrimaryButton } from '@/src/components/ui/Button';
import { Pill } from '@/src/components/ui/Pill';
import { useDashboard, useSavedPaymentMethods, useFeeRates } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { getGatewayFeeRates } from '@/src/services/payment';
import type { SavedPaymentMethod as SavedMethod } from '@/src/services/api/payments';
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
  editPencil: '#656565',
  feeTextNotSetup: '#A9A9A9',
  feeTextAllSetup: '#CBCBCB',
  maskedText: '#DDDDDD',
  pillBg: '#202020',
  pillText: '#DDDDDD',
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
  maskedDetail: string | null;
  fee: string;
  feeAmount?: number;
  isSetUp: boolean;
  savedMethodId?: string;
  isDisabled?: boolean;
  disabledReason?: string;
}

// ==============================================
// RADIO CIRCLE — Figma: 16x16 frame, 13.33px circle
// Unselected: #A6A6A6 outline, Selected: #FF9A6D filled
// ==============================================

const RadioCircle = memo(({ isSelected }: { isSelected: boolean }) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(isSelected ? FIGMA.radioSelected : 'transparent', { duration: 150 }),
      borderColor: withTiming(isSelected ? FIGMA.radioSelected : FIGMA.radioUnselected, { duration: 150 }),
      borderWidth: withTiming(isSelected ? 0 : 1.5, { duration: 150 }),
      transform: [{ scale: withSpring(isSelected ? 1.05 : 1, { damping: 15, stiffness: 300 }) }]
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
// EDIT PENCIL — Figma: 16x16, stroke #656565
// ==============================================

const EditPencil = memo(({ onPress }: { onPress: () => void }) => (
  <Pressable
    onPress={(e) => {
      e.stopPropagation();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    accessibilityRole="button"
    accessibilityLabel="Edit payment method"
  >
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1739 1.49653 12.4191 1.44775 12.6667 1.44775C12.9143 1.44775 13.1594 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4088 2.6118C14.5035 2.84059 14.5523 3.08575 14.5523 3.33337C14.5523 3.58099 14.5035 3.82615 14.4088 4.05495C14.314 4.28374 14.1751 4.49161 14 4.66671L4.33333 14.3334L1.33333 15L2 12L11.3333 2.00004Z"
        stroke={FIGMA.editPencil}
        strokeWidth={0.667}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </Pressable>
));

// ==============================================
// PILLS — using shared Pill component
// ==============================================

const SetItUpPill = memo(() => (
  <Pill text="Set it up" variant="tag" />
));

const UnavailablePill = memo(() => (
  <Pill text="Unavailable now" variant="tagDisabled" />
));

const CashbackPillInline = memo(() => (
  <Pill text="Cashback applies to your next on-time payment" variant="tag" />
));

// ==============================================
// SOLID DIVIDER — Figma: 0.25px #4D4D4D (not dashed)
// ==============================================

const SolidDivider = memo(() => <View style={styles.solidDivider} />);

// ==============================================
// PAYMENT METHOD ROW
// Figma: Radio(16x16) + gap4 + Label + gap8 + Edit → SPACE_BETWEEN → Fee/pill
// ==============================================

const PaymentMethodRow = memo(({
  method,
  isSelected,
  allSetUp,
  onSelect,
  onEdit,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  allSetUp: boolean;
  onSelect: (id: string) => void;
  onEdit: (type: PaymentMethodType, savedMethodId?: string) => void;
}) => {
  const isDisabled = method.isDisabled ?? false;
  
  // Smoothly animate the label color instead of snapping
  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      color: withTiming(
        isDisabled ? FIGMA.unselectedLabel : isSelected ? FIGMA.selectedLabel : FIGMA.unselectedLabel,
        { duration: 200 }
      ),
    };
  });

  const feeColor = allSetUp ? FIGMA.feeTextAllSetup : FIGMA.feeTextNotSetup;

  return (
    <View>
      <Pressable
        onPress={() => {
          if (isDisabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect(method.id);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
        accessibilityLabel={`${method.title}, ${isDisabled ? method.disabledReason : method.fee}`}
        style={({ pressed }) => [
          styles.methodRow,
          pressed && !isDisabled && { opacity: 0.6, transform: [{ scale: 0.98 }] } // Fast touch feedback
        ]}
      >
        {/* Left: Radio + Label group + Edit pencil */}
        <View style={styles.methodRowLeft}>
          <View style={styles.radioLabelGroup}>
            <RadioCircle isSelected={isSelected && !isDisabled} />
            <Animated.Text style={[styles.methodLabel, animatedLabelStyle]}>
              {method.title}
            </Animated.Text>
          </View>
          {method.isSetUp && !isDisabled && (
            <EditPencil onPress={() => { if (method.savedMethodId) onEdit(method.type as PaymentMethodType, method.savedMethodId); }} />
          )}
        </View>

        {/* Right: Fee text or "Unavailable now" pill */}
        <View style={styles.methodRowRight}>
          {isDisabled ? (
            <UnavailablePill />
          ) : (
            <RNText style={[styles.feeText, { color: feeColor }]}>
              {method.fee}
            </RNText>
          )}
        </View>
      </Pressable>

      {/* Masked detail below (only when set up) */}
      {method.isSetUp && method.maskedDetail && (
        <RNText style={styles.maskedDetail}>{method.maskedDetail}</RNText>
      )}

      {/* Disabled banner below row */}
      {isDisabled && method.disabledReason && (
        <View style={styles.disabledBanner}>
          <RNText style={styles.disabledBannerText}>
            {method.disabledReason}
          </RNText>
          <Pressable onPress={() => Linking.openURL('https://flent.in/secured/how-it-works-for-landlords')}>
            <RNText style={styles.learnMoreText}>Learn More</RNText>
          </Pressable>
        </View>
      )}
    </View>
  );
});

// ==============================================
// METHOD SELECTOR CONTENT
// ==============================================

export function MethodSelectorContent({
  onProceed,
  onSetup,
  onEdit,
  isInitiating,
}: MethodSelectorContentProps) {
  const { tenancy } = useDashboard();
  const storedAmount = usePaymentStore((state) => state.amount);
  const { data: savedMethods, isLoading: isLoadingMethods } = useSavedPaymentMethods();
  const { data: dynamicRates } = useFeeRates();

  // Credit card disabled logic
  const landlordApproved = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerified = tenancy?.verification_status?.utility_verified ?? false;
  const creditCardDisabled = !landlordApproved || !utilityVerified;
  const creditCardDisabledReason = !landlordApproved
    ? 'Available after landlord accepts tenancy'
    : !utilityVerified
      ? 'Available after utility bill verification'
      : undefined;

  const [selectedMethod, setSelectedMethod] = useState<string>('upi-1');
  const rentAmount = storedAmount || tenancy?.monthly_rent || 32500;

  // Saved method lookups
  const hasSavedCreditCard = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'card' && m.card_type === 'credit') ?? false,
    [savedMethods],
  );
  const hasSavedDebitCard = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'card' && m.card_type === 'debit') ?? false,
    [savedMethods],
  );
  const hasSavedUpi = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'upi') ?? false,
    [savedMethods],
  );
  const hasSavedNetbanking = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'netbanking') ?? false,
    [savedMethods],
  );

  const getMaskedDetail = (type: 'upi' | 'card' | 'netbanking', cardTypeFilter?: 'credit' | 'debit'): string | null => {
    if (!savedMethods?.length) return null;
    let methods = savedMethods.filter((m: SavedMethod) => m.type === type);
    if (type === 'card' && cardTypeFilter) {
      methods = methods.filter((m: SavedMethod) => m.card_type === cardTypeFilter);
    }
    if (methods.length === 0) return null;
    if (type === 'upi') return methods.map((m: SavedMethod) => m.vpa ?? m.display_name).join(', ');
    if (type === 'card') return methods.map((m: SavedMethod) => `\u2022\u2022\u2022\u2022 ${m.last_four ?? ''}`).join(', ');
    if (type === 'netbanking') return methods.map((m: SavedMethod) => `\u2022\u2022\u2022\u2022 ${m.last_four ?? m.display_name ?? ''}`).join(', ');
    return null;
  };

  const getMethodId = (type: 'upi' | 'card' | 'netbanking', cardTypeFilter?: 'credit' | 'debit'): string | undefined => {
    if (!savedMethods?.length) return undefined;
    let methods = savedMethods.filter((m: SavedMethod) => m.type === type);
    if (type === 'card' && cardTypeFilter) {
      methods = methods.filter((m: SavedMethod) => m.card_type === cardTypeFilter);
    }
    return methods[0]?.id;
  };

  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const rates = dynamicRates ?? getGatewayFeeRates();
    const creditCardFee = Math.round(rentAmount * rates.credit_card);
    const debitCardFee = Math.round(rentAmount * rates.debit_card);
    const upiFee = Math.round(rentAmount * rates.upi);
    const netbankingFee = Math.round(rentAmount * rates.netbanking);

    return [
      {
        id: 'upi-1',
        type: 'upi' as const,
        title: 'UPI',
        maskedDetail: hasSavedUpi ? (getMaskedDetail('upi') ?? '\u2022\u2022\u2022\u2022el@oksbi') : null,
        fee: rates.upi === 0 ? 'Free' : `\u20B9${upiFee.toLocaleString('en-IN')} fee`,
        feeAmount: upiFee,
        isSetUp: hasSavedUpi,
        savedMethodId: hasSavedUpi ? getMethodId('upi') : undefined,
      },
      {
        id: 'netbanking-1',
        type: 'netbanking' as const,
        title: 'Net Banking',
        maskedDetail: hasSavedNetbanking ? (getMaskedDetail('netbanking') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `\u20B9${netbankingFee.toLocaleString('en-IN')} fee`,
        feeAmount: netbankingFee,
        isSetUp: hasSavedNetbanking,
        savedMethodId: hasSavedNetbanking ? getMethodId('netbanking') : undefined,
      },
      {
        id: 'debit-card-1',
        type: 'debit_card' as const,
        title: 'Debit Card',
        maskedDetail: hasSavedDebitCard ? (getMaskedDetail('card', 'debit') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `\u20B9${debitCardFee.toLocaleString('en-IN')} fee`,
        feeAmount: debitCardFee,
        isSetUp: hasSavedDebitCard,
        savedMethodId: hasSavedDebitCard ? getMethodId('card', 'debit') : undefined,
      },
      {
        id: 'card-1',
        type: 'card' as const,
        title: 'Credit Card',
        maskedDetail: hasSavedCreditCard ? (getMaskedDetail('card', 'credit') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `\u20B9${creditCardFee.toLocaleString('en-IN')} fee`,
        feeAmount: creditCardFee,
        isSetUp: hasSavedCreditCard,
        isDisabled: creditCardDisabled,
        disabledReason: creditCardDisabledReason,
        savedMethodId: hasSavedCreditCard ? getMethodId('card', 'credit') : undefined,
      },
    ];
  }, [rentAmount, savedMethods, dynamicRates, hasSavedCreditCard, hasSavedDebitCard, hasSavedUpi, hasSavedNetbanking, creditCardDisabled, creditCardDisabledReason]);

  const allSetUp = paymentMethods.every((m) => m.isSetUp);

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const isSelectedDisabled = selectedPaymentMethod?.isDisabled ?? false;
  const ctaText = selectedPaymentMethod?.isSetUp
    ? 'Proceed'
    : `Setup ${selectedPaymentMethod?.title ?? 'Payment Method'}`;

  const handleSelectMethod = useCallback((methodId: string) => {
    setSelectedMethod(methodId);
  }, []);

  const handleProceed = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const method = paymentMethods.find((m) => m.id === selectedMethod);
    const methodType: PaymentMethodType = method?.type ?? 'upi';
    if (method?.isSetUp) {
      onProceed(methodType);
    } else {
      onSetup(methodType);
    }
  }, [paymentMethods, selectedMethod, onProceed, onSetup]);

  return (
    <View style={styles.sheetContent}>
      {/* Heading: "Choose a\nPayment Method" — Figma: 28px Regular, accent on line 2 */}
      <View style={styles.headingContainer}>
        <RNText style={styles.headingText}>
          {'Choose a\n'}
          <RNText style={styles.headingAccent}>Payment Method</RNText>
        </RNText>
      </View>

      {/* Cashback pill — only visible in all-setup state */}
      {allSetUp && (
        <View style={styles.cashbackPillContainer}>
          <CashbackPillInline />
        </View>
      )}

      {/* Payment Method Rows */}
      <View style={styles.methodsContainer}>
        {isLoadingMethods && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={FIGMA.headingAccent} />
          </View>
        )}
        {paymentMethods.map((method, index) => (
          <React.Fragment key={method.id}>
            <PaymentMethodRow
              method={method}
              isSelected={selectedMethod === method.id}
              allSetUp={allSetUp}
              onSelect={handleSelectMethod}
              onEdit={(type, id) => onEdit(type, id as string)}
            />
            {index < paymentMethods.length - 1 && <SolidDivider />}
          </React.Fragment>
        ))}
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <PrimaryButton
          title={ctaText}
          onPress={handleProceed}
          loading={isInitiating}
          disabled={isInitiating || isSelectedDisabled}
          testID="modal-method-proceed-button"
        />
        <RNText style={styles.disclaimerText}>
          {allSetUp
            ? "You'll see the final amount before payment"
            : <>
                {'By proceeding, you agree to the '}
                <RNText
                  style={{ textDecorationLine: 'underline' }}
                  onPress={() => Linking.openURL('https://www.flent.in/secured-tnc')}
                >
                  payment terms
                </RNText>
              </>}
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

  // Cashback pill container
  cashbackPillContainer: {
    paddingHorizontal: 48,
  },

  // Methods container — Figma: px 48, gap 16
  methodsContainer: {
    paddingHorizontal: 48,
    gap: 16,
  },

  loadingRow: {
    alignItems: 'center',
    paddingVertical: 8,
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
  radioCircleUnselected: {
    borderWidth: 1.5,
    borderColor: FIGMA.radioUnselected,
    backgroundColor: 'transparent',
  },
  radioCircleSelected: {
    backgroundColor: FIGMA.radioSelected,
  },

  // Method label — Figma: 12px Regular
  methodLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
  },

  // Masked detail — Figma: 12px Regular #DDDDDD, below the row
  maskedDetail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.maskedText,
    marginLeft: 20, // 16 (radio frame) + 4 (gap) = align under label
    marginTop: 2,
  },

  // Fee text — Figma: 14px Regular, color depends on allSetUp
  feeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },


  // Disabled banner
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  disabledBannerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
    flex: 1,
  },
  learnMoreText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
    textDecorationLine: 'underline' as const,
  },

  // CTA Section — Figma: px 48, gap 16
  ctaSection: {
    paddingHorizontal: 48,
    gap: 16,
    paddingBottom: 24,
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
