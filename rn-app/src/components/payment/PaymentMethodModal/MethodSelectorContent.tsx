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
import { useDashboard, useSavedPaymentMethods } from '@/src/hooks';
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
  type: 'card' | 'upi' | 'netbanking';
  title: string;
  maskedDetail: string | null;
  fee: string;
  feeAmount?: number;
  isSetUp: boolean;
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

const getIconForType = (type: 'card' | 'upi' | 'netbanking', isSelected: boolean) => {
  const iconColor = isSelected ? FIGMA.iconStrokeSelected : FIGMA.iconStroke;
  switch (type) {
    case 'card':
      return <CreditCardIcon color={iconColor} />;
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
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const isDisabled = method.isDisabled ?? false;
  const labelColor = isDisabled
    ? FIGMA.unselectedLabel
    : isSelected
      ? FIGMA.selectedLabel
      : FIGMA.unselectedLabel;

  return (
    <Pressable
      onPress={() => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      accessibilityLabel={`${method.title}, ${isDisabled ? method.disabledReason : method.fee}`}
      style={[styles.methodRow, isDisabled && { opacity: 0.5 }]}
    >
      {/* Left side: Icon + Label (+ masked detail if set up) */}
      <View style={styles.methodRowLeft}>
        {getIconForType(method.type, isSelected && !isDisabled)}
        <View style={styles.methodLabelGroup}>
          <RNText style={[styles.methodLabel, { color: labelColor }]}>
            {method.title}
          </RNText>
          {method.isSetUp && method.maskedDetail ? (
            <RNText style={styles.maskedDetail}>
              {method.maskedDetail}
            </RNText>
          ) : null}
          {isDisabled && method.disabledReason ? (
            <RNText style={styles.disabledReason}>
              {method.disabledReason}
            </RNText>
          ) : null}
        </View>
      </View>

      {/* Right side: "Set it up" pill OR fee text */}
      {!isDisabled && (
        <View style={styles.methodRowRight}>
          {method.isSetUp ? (
            <RNText style={styles.feeText}>{method.fee}</RNText>
          ) : (
            <SetItUpPill />
          )}
        </View>
      )}
    </Pressable>
  );
});

// ==============================================
// METHOD SELECTOR CONTENT
// ==============================================

export function MethodSelectorContent({
  onProceed,
  isInitiating,
}: MethodSelectorContentProps) {
  const { tenancy } = useDashboard();
  const storedAmount = usePaymentStore((state) => state.amount);
  const { data: savedMethods, isLoading: isLoadingMethods } = useSavedPaymentMethods();

  // Determine initial selection based on card eligibility
  const landlordApprovedInit = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerifiedInit = tenancy?.verification_status?.utility_verified ?? false;
  const [selectedMethod, setSelectedMethod] = useState<string>(
    (!landlordApprovedInit || !utilityVerifiedInit) ? 'upi-1' : 'card-1',
  );

  // Rent amount from dashboard or store
  const rentAmount = storedAmount || tenancy?.monthly_rent || 32500;

  // Saved method lookups
  const hasSavedCard = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'card') ?? false,
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
  const getMaskedDetail = (type: 'upi' | 'card' | 'netbanking'): string | null => {
    if (!savedMethods?.length) return null;
    const methods = savedMethods.filter((m: SavedMethod) => m.type === type);
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

  // Card disabled logic
  const landlordApproved = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerified = tenancy?.verification_status?.utility_verified ?? false;
  const cardDisabled = !landlordApproved || !utilityVerified;
  const cardDisabledReason = !landlordApproved
    ? 'Available after landlord accepts tenancy'
    : !utilityVerified
      ? 'Available after utility bill verification'
      : undefined;

  // Payment methods with fee calculation
  const paymentMethods: PaymentMethod[] = useMemo(() => {
    const rates = getGatewayFeeRates();
    const cardFee = Math.round(rentAmount * rates.card);
    const upiFee = Math.round(rentAmount * rates.upi);
    const netbankingFee = Math.round(rentAmount * rates.netbanking);

    return [
      {
        id: 'card-1',
        type: 'card' as const,
        title: 'Credit Card',
        maskedDetail: hasSavedCard ? (getMaskedDetail('card') ?? '\u2022\u2022\u2022\u2022 2345') : null,
        fee: `${cardFee.toLocaleString('en-IN')} fee`,
        feeAmount: cardFee,
        isSetUp: hasSavedCard,
        isDisabled: cardDisabled,
        disabledReason: cardDisabledReason,
      },
      {
        id: 'upi-1',
        type: 'upi' as const,
        title: 'UPI',
        maskedDetail: hasSavedUpi ? (getMaskedDetail('upi') ?? '\u2022\u2022\u2022\u2022el@oksbi') : null,
        fee: rates.upi === 0 ? 'Free' : `${upiFee.toLocaleString('en-IN')} fee`,
        feeAmount: upiFee,
        isSetUp: hasSavedUpi,
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
      },
    ];
  }, [rentAmount, savedMethods, hasSavedCard, hasSavedUpi, hasSavedNetbanking, cardDisabled, cardDisabledReason]);

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

        {/* Disclaimer -- only visible in all-setup state */}
        {allSetUp && (
          <RNText style={styles.disclaimerText}>
            You'll see the final amount before payment
          </RNText>
        )}
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
    gap: 30,
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

  // Method Label -- Figma: 14px Regular
  methodLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },

  // Masked detail -- Figma: #ddd, 12px
  maskedDetail: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
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
