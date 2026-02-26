/**
 * MethodSelectorContent -- Payment method selection view
 *
 * Extracted from select-method.tsx bottom sheet content. Renders INSIDE
 * the PaymentMethodModal panel.
 *
 * Two Figma states:
 *   684:5915 -- No instruments set up (shows "Set it up" pills, dynamic CTA)
 *   684:6128 -- All instruments set up (shows masked numbers, fees, cashback pill)
 *
 * Design tokens:
 *   Sheet heading: "Choose a\nPayment Method" 28px Regular, -1 letter-spacing, 40 line-height
 *   Sheet padding: horizontal 48px
 *   Method rows: icon (24x24) + label + right info, separated by DashedDivider
 *   "Set it up" pill: #202020 bg, 40px borderRadius, 12px horiz / 4px vert padding, 12px Regular #ddd
 *   Cashback pill: #202020 bg, 40px borderRadius, 12px horiz / 4px vert padding, 12px Regular, orange amount
 *   Fee text: 14px Regular #cbcbcb
 *   Disclaimer: 12px Regular #a9a9a9 center
 */

import React, { useState, useMemo, memo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text as RNText,
} from 'react-native';
import Svg, { Path, Rect, Circle, G, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { PrimaryButton } from '@/src/components';
import { DashedDivider } from '@/src/components/payment';
import { useDashboard, useSavedPaymentMethods, useFeeRates } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { getGatewayFeeRates } from '@/src/services/payment';
import type { SavedPaymentMethod as SavedMethod } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

import type { PaymentMethodType, MethodSelectorContentProps } from './types';

// ==============================================
// FIGMA COLOR TOKENS
// ==============================================

const FIGMA = {
  textWhite: colors.white,
  headingAccent: colors.brand[500],        // #FF9A6D
  selectedLabel: '#D2D2D2',
  unselectedLabel: '#878787',              // colors.neutral[600]
  feeText: '#CBCBCB',                      // colors.neutral[300]
  maskedText: '#DDDDDD',                   // colors.neutral[200]
  pillBg: '#202020',                       // colors.black[500]
  pillText: '#DDDDDD',                     // colors.neutral[200]
  cashbackOrange: colors.brand[500],       // #FF9A6D
  cashbackPlainText: '#CBCBCB',            // colors.neutral[300]
  disclaimerText: '#A9A9A9',               // colors.neutral[500]
  iconStroke: '#878787',
  iconStrokeSelected: '#D2D2D2',
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
// PAYMENT METHOD ICONS (clean, minimal SVGs)
// ==============================================

const CreditCardIcon = memo(({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={color} strokeWidth={1.5} />
    <Line x1={2} y1={10} x2={22} y2={10} stroke={color} strokeWidth={1.5} />
    <Line x1={6} y1={14} x2={10} y2={14} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Line x1={6} y1={17} x2={8} y2={17} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

const DebitCardIcon = memo(({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x={2} y={4} width={20} height={16} rx={2} stroke={color} strokeWidth={1.5} />
    <Line x1={2} y1={10} x2={22} y2={10} stroke={color} strokeWidth={1.5} />
    <Line x1={6} y1={14} x2={12} y2={14} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Circle cx={18} cy={15.5} r={2.5} stroke={color} strokeWidth={1.2} />
  </Svg>
));

const UPIIcon = memo(({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M10 4L14 4L10 20"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14 4L18 4L14 20"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

const NetBankingIcon = memo(({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 21H21"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M3 10H21"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M12 3L3 10H21L12 3Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
    <Path d="M5 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M9 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M15 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M19 10V21" stroke={color} strokeWidth={1.5} />
  </Svg>
));

const EditPencilIcon = memo(({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1739 1.49653 12.4191 1.44775 12.6667 1.44775C12.9143 1.44775 13.1594 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4088 2.6118C14.5035 2.84059 14.5523 3.08575 14.5523 3.33337C14.5523 3.58099 14.5035 3.82615 14.4088 4.05495C14.314 4.28374 14.1751 4.49161 14 4.66671L4.33333 14.3334L1.33333 15L2 12L11.3333 2.00004Z"
      stroke={color}
      strokeWidth={1.33333}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

const getIconForType = (type: 'card' | 'debit_card' | 'upi' | 'netbanking', isSelected: boolean) => {
  const iconColor = isSelected ? FIGMA.iconStrokeSelected : FIGMA.iconStroke;
  switch (type) {
    case 'card':
      return <CreditCardIcon color={iconColor} />;
    case 'debit_card':
      return <DebitCardIcon color={iconColor} />;
    case 'upi':
      return <UPIIcon color={iconColor} />;
    case 'netbanking':
      return <NetBankingIcon color={iconColor} />;
  }
};

// ==============================================
// "SET IT UP" PILL (no-setup state)
// ==============================================

const SetItUpPill = memo(() => (
  <View style={styles.setItUpPill}>
    <RNText style={styles.setItUpText}>Set it up</RNText>
  </View>
));

// ==============================================
// CASHBACK PILL (all-setup state, above methods)
// ==============================================

const CashbackPillInline = memo(() => (
  <View style={styles.cashbackPill}>
    <RNText style={styles.cashbackPillText}>
      Cashback applies to your next on-time payment
    </RNText>
  </View>
));

// ==============================================
// PAYMENT METHOD ROW
// ==============================================

const PaymentMethodRow = memo(({
  method,
  isSelected,
  onSelect,
  onEdit,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) => {
  const isDisabled = method.isDisabled ?? false;
  const labelColor = isDisabled
    ? FIGMA.unselectedLabel
    : isSelected
      ? FIGMA.selectedLabel
      : FIGMA.unselectedLabel;

  return (
    <View style={{ width: '100%' }}>
      <Pressable
        onPress={() => {
          if (isDisabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
        accessibilityLabel={`${method.title}, ${isDisabled ? method.disabledReason : method.fee}`}
        style={[styles.methodRow, isDisabled && { opacity: 1 }]}
      >
        {/* Left side: Icon + Label (+ masked detail if set up) */}
        <View style={styles.methodRowLeft}>
          {getIconForType(method.type, isSelected && !isDisabled)}
          <View style={styles.methodLabelGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <RNText style={[styles.methodLabel, { color: labelColor }]}>
                {method.title}
              </RNText>
              {method.isSetUp && !isDisabled && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onEdit();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 4 }}
                >
                  <EditPencilIcon color={labelColor} />
                </Pressable>
              )}
            </View>
            {method.isSetUp && method.maskedDetail ? (
              <RNText style={styles.maskedDetail}>
                {method.maskedDetail}
              </RNText>
            ) : null}
          </View>
        </View>

        {/* Right side: "Unavailable now" pill OR "Set it up" pill OR fee text */}
        <View style={styles.methodRowRight}>
          {isDisabled ? (
            <View style={styles.unavailablePill}>
              <RNText style={styles.unavailableText}>Unavailable now</RNText>
            </View>
          ) : method.isSetUp ? (
            <RNText style={styles.feeText}>{method.fee}</RNText>
          ) : (
            <SetItUpPill />
          )}
        </View>
      </Pressable>

      {/* Disabled Banner message below row */}
      {isDisabled && method.disabledReason && (
        <View style={styles.disabledBanner}>
          <RNText style={styles.disabledBannerText}>
            {method.disabledReason}
          </RNText>
          <Pressable onPress={() => {}}>
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
  onEdit,
  isInitiating,
}: MethodSelectorContentProps) {
  const { tenancy } = useDashboard();
  const storedAmount = usePaymentStore((state) => state.amount);
  const { data: savedMethods, isLoading: isLoadingMethods } = useSavedPaymentMethods();
  const { data: dynamicRates } = useFeeRates();

  // Credit card disabled logic (debit card skips this gate)
  const landlordApproved = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerified = tenancy?.verification_status?.utility_verified ?? false;
  const creditCardDisabled = !landlordApproved || !utilityVerified;
  const creditCardDisabledReason = !landlordApproved
    ? 'Available after landlord accepts tenancy'
    : !utilityVerified
      ? 'Available after utility bill verification'
      : undefined;

  // Determine initial selection: upi by default
  const [selectedMethod, setSelectedMethod] = useState<string>('upi-1');

  // Rent amount from dashboard or store
  const rentAmount = storedAmount || tenancy?.monthly_rent || 32500;

  // Saved method lookups — split credit vs debit cards
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

  // Build masked detail from saved methods
  const getMaskedDetail = (type: 'upi' | 'card' | 'netbanking', cardTypeFilter?: 'credit' | 'debit'): string | null => {
    if (!savedMethods?.length) return null;
    let methods = savedMethods.filter((m: SavedMethod) => m.type === type);
    if (type === 'card' && cardTypeFilter) {
      methods = methods.filter((m: SavedMethod) => m.card_type === cardTypeFilter);
    }
    if (methods.length === 0) return null;
    if (type === 'upi') {
      return methods.map((m: SavedMethod) => m.vpa ?? m.display_name).join(', ');
    }
    if (type === 'card') {
      return methods
        .map((m: SavedMethod) => `\u2022\u2022\u2022\u2022 ${m.last_four ?? ''}`)
        .join(', ');
    }
    if (type === 'netbanking') {
      return methods
        .map((m: SavedMethod) => `\u2022\u2022\u2022\u2022 ${m.last_four ?? m.display_name ?? ''}`)
        .join(', ');
    }
    return null;
  };

  const getMethodId = (type: 'upi' | 'card' | 'netbanking', cardTypeFilter?: 'credit' | 'debit'): string | undefined => {
    if (!savedMethods?.length) return undefined;
    let methods = savedMethods.filter((m: SavedMethod) => m.type === type);
    if (type === 'card' && cardTypeFilter) {
      methods = methods.filter((m: SavedMethod) => m.card_type === cardTypeFilter);
    }
    if (methods.length === 0) return undefined;
    return methods[0].id;
  };

  // Payment methods with fee calculation
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
        fee: rates.upi === 0 ? 'Free' : `${upiFee.toLocaleString('en-IN')} fee`,
        feeAmount: upiFee,
        isSetUp: hasSavedUpi,
        savedMethodId: hasSavedUpi ? getMethodId('upi') : undefined,
      },
      {
        id: 'netbanking-1',
        type: 'netbanking' as const,
        title: 'Net Banking',
        maskedDetail: hasSavedNetbanking
          ? (getMaskedDetail('netbanking') ?? '\u2022\u2022\u2022\u2022 2345')
          : null,
        fee: `${netbankingFee.toLocaleString('en-IN')} fee`,
        feeAmount: netbankingFee,
        isSetUp: hasSavedNetbanking,
        savedMethodId: hasSavedNetbanking ? getMethodId('netbanking') : undefined,
      },
      {
        id: 'debit-card-1',
        type: 'debit_card' as const,
        title: 'Debit Card',
        maskedDetail: hasSavedDebitCard ? (getMaskedDetail('card', 'debit') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `${debitCardFee.toLocaleString('en-IN')} fee`,
        feeAmount: debitCardFee,
        isSetUp: hasSavedDebitCard,
        savedMethodId: hasSavedDebitCard ? getMethodId('card', 'debit') : undefined,
      },
      {
        id: 'card-1',
        type: 'card' as const,
        title: 'Credit Card',
        maskedDetail: hasSavedCreditCard ? (getMaskedDetail('card', 'credit') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `${creditCardFee.toLocaleString('en-IN')} fee`,
        feeAmount: creditCardFee,
        isSetUp: hasSavedCreditCard,
        isDisabled: creditCardDisabled,
        disabledReason: creditCardDisabledReason,
        savedMethodId: hasSavedCreditCard ? getMethodId('card', 'credit') : undefined,
      },
    ];
  }, [rentAmount, savedMethods, dynamicRates, hasSavedCreditCard, hasSavedDebitCard, hasSavedUpi, hasSavedNetbanking, creditCardDisabled, creditCardDisabledReason]);

  const allSetUp = paymentMethods.every((m) => m.isSetUp);

  // CTA text depends on state
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const ctaText = allSetUp
    ? `Pay \u20B9${rentAmount.toLocaleString('en-IN')}`
    : `Set up ${selectedPaymentMethod?.title ?? 'Credit Card'}`;

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
      {/* Heading: "Choose a\nPayment Method" */}
      <View style={styles.headingContainer}>
        <RNText style={styles.headingText}>
          {'Choose a  \nPayment Method'}
        </RNText>
      </View>

      {/* Cashback pill -- only visible in all-setup state */}
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
              onSelect={() => handleSelectMethod(method.id)}
              onEdit={() => {
                if (method.savedMethodId) {
                  onEdit(method.type, method.savedMethodId);
                }
              }}
            />
            {index < paymentMethods.length - 1 && (
              <DashedDivider />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* CTA Button Section */}
      <View style={styles.ctaSection}>
        <PrimaryButton
          title={ctaText}
          onPress={handleProceed}
          loading={isInitiating}
          disabled={isInitiating}
          showDivider
          testID="modal-pay-now-button"
        />

        {/* Disclaimer or Countdown */}
        {allSetUp ? (
          <RNText style={styles.disclaimerText}>
            You'll see the final amount before payment
          </RNText>
        ) : creditCardDisabled ? (
          <RNText style={styles.disclaimerText}>
            Finish setup in 28:12:12 to be eligible for  {'\n'}
            ₹350 cashback on this payment
          </RNText>
        ) : null}
      </View>
    </View>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  // Sheet Content -- Figma: column layout, ~30px gap between sections
  sheetContent: {
    paddingTop: 16,
    gap: 32,
  },

  // Heading -- Figma: 28px Regular, 40 line-height, -1 letter-spacing, paddingHorizontal 48
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

  // Cashback pill container -- Figma: paddingHorizontal 48
  cashbackPillContainer: {
    paddingHorizontal: 48,
  },

  // Cashback pill -- Figma 684:6128: #202020 bg, 40 borderRadius, 12 horiz / 4 vert padding
  cashbackPill: {
    backgroundColor: FIGMA.pillBg,
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#DDDDDD',
  },

  // Methods Container -- Figma: column, gap 16, paddingHorizontal 48
  methodsContainer: {
    paddingHorizontal: 48,
    gap: 16,
  },

  // Loading row
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  // Payment Method Row -- Figma: row, space-between, center aligned
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 32,
  },
  methodRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  methodLabelGroup: {
    gap: 2,
    flex: 1,
  },
  methodRowRight: {
    marginLeft: 8,
  },

  // Method Label -- Figma: 12px Regular
  methodLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
  },

  // Masked detail -- Figma: #ddd, 12px
  maskedDetail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.maskedText,
  },

  // Disabled reason
  disabledReason: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: FIGMA.unselectedLabel,
  },

  // Fee text -- Figma: 14px Regular #cbcbcb
  feeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA.feeText,
  },

  // "Set it up" pill -- Figma 684:5915: #202020 bg, 40 borderRadius, 12 horiz / 4 vert padding
  setItUpPill: {
    backgroundColor: FIGMA.pillBg,
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  setItUpText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.pillText,
  },

  // "Unavailable now" pill
  unavailablePill: {
    backgroundColor: '#4D4D4D',
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  unavailableText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#878787',
  },

  // Disabled Banner message below row
  disabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 16,
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
    textAlign: 'right',
  },

  // CTA Section -- Figma: paddingHorizontal 48, gap 16
  ctaSection: {
    paddingHorizontal: 48,
    gap: 16,
    paddingBottom: 24,
  },

  // Disclaimer -- Figma 684:6128: 12px Regular #a9a9a9, center aligned
  disclaimerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.disclaimerText,
    textAlign: 'center',
  },
});
