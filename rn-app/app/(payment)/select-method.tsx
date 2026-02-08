/**
 * Select Payment Method Screen
 * Figma Reference: 41-8901 (Payment Method Selection)
 *
 * Screen shows:
 * - Header with rent breakdown card showing amount due
 * - Payment method selection cards (UPI, Credit Card, Net Banking)
 * - Proper card styling with selection states
 * - Bottom action button
 *
 * Design tokens from Figma 41-8901 analysis:
 * - Background: #131313 (black.700)
 * - Card surface: #1A1A1A (black.600)
 * - Text primary: #FFFFFF
 * - Text secondary/subtext: #A6A6A6 (black.200)
 * - Text tertiary/subtextSecondary: #4D4D4D (black.400)
 * - Label text: #878787 (neutral.600)
 * - Value text: #CBCBCB (neutral.200)
 * - Accent: #FF9A6D (brand.500)
 * - Divider: #4D4D4D (black.400)
 */

import React, { useCallback, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { colors, spacing, radius, gradients } from '@/src/theme';

// Exact Figma colors from 41-8901 analysis
const FIGMA_COLORS = {
  // Background colors
  background: '#131313',        // black.700 - Primary dark background
  cardSurface: '#1A1A1A',       // black.600 - Card background
  cardSurfaceElevated: '#202020', // black.500 - Elevated surfaces

  // Text colors - CORRECTED per user requirements
  textPrimary: '#FFFFFF',       // White - Primary text
  textSecondary: '#A6A6A6',     // black.200 - Subtext (key requirement)
  textTertiary: '#4D4D4D',      // black.400 - SubtextSecondary (key requirement)
  labelText: '#878787',         // neutral.600 - Labels
  valueText: '#CBCBCB',         // neutral.200 - Values (Figma 41-9004: #CBCBCB)
  mutedText: '#797979',         // black.300 - Muted/disabled text

  // Accent colors
  accent: '#FF9A6D',            // brand.500 - Selected state, accent
  accentDark: '#CC7B57',        // brand.600 - Pressed state
  successGreen: '#70BF73',      // success.default - Free fee text

  // Border/Divider colors
  divider: '#4D4D4D',           // black.400 - Dividers
  borderDefault: '#4D4D4D',     // black.400 - Default borders
  borderSelected: '#FF9A6D',    // brand.500 - Selected borders

  // Card-specific
  selectedBg: 'rgba(255, 154, 109, 0.08)', // Subtle orange tint for selected
};

// Payment method data type
interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking';
  title: string;
  subtitle: string;
  fee: string;
  feeAmount?: number;
  iconType: 'card' | 'upi' | 'bank';
}

// SVG Icons for payment methods
const CardIcon = memo(({ color = FIGMA_COLORS.textPrimary }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth={1.5} />
    <Path d="M2 10H22" stroke={color} strokeWidth={1.5} />
    <Path d="M6 15H10" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
));

const UPIIcon = memo(({ color = FIGMA_COLORS.textPrimary }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L2 7L12 12L22 7L12 2Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2 17L12 22L22 17"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2 12L12 17L22 12"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

const BankIcon = memo(({ color = FIGMA_COLORS.textPrimary }: { color?: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21H21" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Path d="M3 10H21" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    <Path
      d="M12 3L21 10H3L12 3Z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M5 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M9 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M15 10V21" stroke={color} strokeWidth={1.5} />
    <Path d="M19 10V21" stroke={color} strokeWidth={1.5} />
  </Svg>
));

const BackArrowIcon = memo(() => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

const CheckmarkIcon = memo(() => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Circle cx="10" cy="10" r="9" fill={FIGMA_COLORS.accent} />
    <Path
      d="M6 10L9 13L14 7"
      stroke={FIGMA_COLORS.background}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

// Radio button component for unselected state
const RadioButton = memo(({ isSelected }: { isSelected: boolean }) => (
  <View style={styles.radioOuter}>
    {isSelected ? (
      <CheckmarkIcon />
    ) : (
      <View style={styles.radioEmpty} />
    )}
  </View>
));

// Payment Method Card Component
const PaymentMethodCard = memo(({
  method,
  isSelected,
  onSelect,
}: {
  method: PaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const animatedBorderColor = useAnimatedStyle(() => ({
    borderColor: withTiming(
      isSelected ? FIGMA_COLORS.borderSelected : FIGMA_COLORS.borderDefault,
      { duration: 200 }
    ),
    borderWidth: withTiming(isSelected ? 1.5 : 1, { duration: 200 }),
    backgroundColor: withTiming(
      isSelected ? FIGMA_COLORS.selectedBg : FIGMA_COLORS.cardSurface,
      { duration: 200 }
    ),
  }));

  const IconComponent = method.iconType === 'card'
    ? CardIcon
    : method.iconType === 'upi'
    ? UPIIcon
    : BankIcon;

  const feeColor = method.fee === 'Free' || method.fee === 'No fee'
    ? FIGMA_COLORS.successGreen
    : FIGMA_COLORS.textSecondary;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${method.title}, ${method.fee}`}
    >
      <Animated.View style={[styles.methodCard, animatedBorderColor]}>
        {/* Left section: Radio + Icon + Text */}
        <View style={styles.methodCardLeft}>
          <RadioButton isSelected={isSelected} />

          <View style={styles.methodIconContainer}>
            <IconComponent color={isSelected ? FIGMA_COLORS.accent : FIGMA_COLORS.textPrimary} />
          </View>

          <View style={styles.methodTextContainer}>
            <Text style={[
              styles.methodTitle,
              isSelected && styles.methodTitleSelected
            ]}>
              {method.title}
            </Text>
            <Text style={styles.methodSubtitle}>{method.subtitle}</Text>
          </View>
        </View>

        {/* Right section: Fee */}
        <Text style={[styles.methodFee, { color: feeColor }]}>
          {method.fee}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

export default function SelectPaymentMethodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenancy, upcomingPayment, cashback } = useDashboard();
  const [selectedMethod, setSelectedMethod] = useState<string>('upi-1');

  // Rent data from dashboard
  const rentAmount = tenancy?.monthly_rent ?? 32500;
  const cashbackAvailable = cashback?.available_balance ?? 325;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  const isOverdue = upcomingPayment?.is_overdue ?? false;
  const rentMonth = upcomingPayment?.rent_month ?? 'December 2025';
  const rentDueDay = tenancy?.rent_due_day ?? 1;

  // Date variant: before-7th (early month) vs after-7th (late month)
  const isAfter7th = rentDueDay > 7;

  // Build the due label based on overdue status and date variant
  const getDueLabel = () => {
    if (isOverdue) {
      return `Rent ${Math.abs(daysUntilDue)} days overdue`;
    }
    if (isAfter7th) {
      return `Rent due on ${rentDueDay}th — ${daysUntilDue} days left`;
    }
    return `Rent due in ${daysUntilDue} days`;
  };

  // Payment methods with proper data
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'upi-1',
      type: 'upi',
      title: 'UPI',
      subtitle: 'Google Pay, PhonePe, Paytm',
      fee: 'Free',
      feeAmount: 0,
      iconType: 'upi',
    },
    {
      id: 'card-1',
      type: 'card',
      title: 'Credit Card',
      subtitle: 'Visa, Mastercard, RuPay',
      fee: `Rs ${Math.round(rentAmount * 0.01)} fee`,
      feeAmount: Math.round(rentAmount * 0.01),
      iconType: 'card',
    },
    {
      id: 'netbanking-1',
      type: 'netbanking',
      title: 'Net Banking',
      subtitle: 'All major banks supported',
      fee: 'Rs 10 fee',
      feeAmount: 10,
      iconType: 'bank',
    },
  ];

  const selectedPaymentMethod = paymentMethods.find(m => m.id === selectedMethod);
  const feeAmount = selectedPaymentMethod?.feeAmount ?? 0;
  const totalPayable = rentAmount + feeAmount;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleSelectMethod = useCallback((methodId: string) => {
    setSelectedMethod(methodId);
  }, []);

  const handleProceed = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const method = paymentMethods.find(m => m.id === selectedMethod);
    router.push({
      pathname: '/(payment)/initiate',
      params: { method: method?.type ?? 'upi' },
    } as never);
  }, [router, selectedMethod, paymentMethods]);

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString('en-IN')}`;
  };

  return (
    <Screen testID="select-method-screen" padded={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <BackArrowIcon />
            </TouchableOpacity>

            {/* Screen Title */}
            <Text style={styles.screenTitle}>Select Payment Method</Text>
          </View>

          {/* Rent Summary Card */}
          <View style={styles.rentSummaryCard}>
            <View style={styles.rentSummaryRow}>
              <Text style={[styles.rentLabel, isOverdue && { color: '#FF8080' }]}>{getDueLabel()}</Text>
              <Text style={styles.rentMonth}>{rentMonth}</Text>
            </View>

            <View style={styles.rentAmountRow}>
              <Text style={styles.rentAmountLabel}>Amount</Text>
              <Text style={styles.rentAmountValue}>{formatCurrency(rentAmount)}</Text>
            </View>

            {/* Cashback Info */}
            {cashbackAvailable > 0 && (
              <View style={styles.cashbackRow}>
                <View style={styles.cashbackPill}>
                  <Text style={styles.cashbackPillText}>
                    {formatCurrency(cashbackAvailable)} cashback available
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Payment Methods Section */}
          <View style={styles.methodsSection}>
            <Text style={styles.sectionTitle}>Choose payment method</Text>
            <Text style={styles.sectionSubtitle}>
              Select how you'd like to pay your rent
            </Text>

            {/* Payment Method Cards */}
            <View style={styles.methodsList}>
              {paymentMethods.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  isSelected={selectedMethod === method.id}
                  onSelect={() => handleSelectMethod(method.id)}
                />
              ))}
            </View>
          </View>

          {/* Fee Breakdown (if applicable) */}
          {feeAmount > 0 && (
            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Rent amount</Text>
                <Text style={styles.feeValue}>{formatCurrency(rentAmount)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>Payment fee</Text>
                <Text style={styles.feeValue}>{formatCurrency(feeAmount)}</Text>
              </View>
              <View style={styles.feeDivider} />
              <View style={styles.feeRow}>
                <Text style={styles.feeTotalLabel}>Total payable</Text>
                <Text style={styles.feeTotalValue}>{formatCurrency(totalPayable)}</Text>
              </View>
            </View>
          )}

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Pay Button */}
          <View style={styles.buttonContainer}>
            <PrimaryButton
              title={`Pay ${formatCurrency(totalPayable)} now`}
              onPress={handleProceed}
              testID="pay-now-button"
            />
          </View>

          {/* Footer Text */}
          <Text style={styles.footerText}>
            You'll see the final amount before payment
          </Text>

          {/* Secure Payment Badge */}
          <View style={styles.secureRow}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path
                d="M4 7V5C4 2.79 5.79 1 8 1C10.21 1 12 2.79 12 5V7M3 7H13C13.55 7 14 7.45 14 8V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V8C2 7.45 2.45 7 3 7Z"
                stroke={FIGMA_COLORS.textSecondary}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.secureText}>Secured by PayU</Text>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  // Header
  header: {
    paddingTop: 16,
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  screenTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: FIGMA_COLORS.textPrimary,
    textAlign: 'center' as const, // Figma: textAlignHorizontal CENTER
  },

  // Rent Summary Card
  rentSummaryCard: {
    backgroundColor: FIGMA_COLORS.cardSurface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  rentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,   // Figma: lineHeightPx 16.92
    letterSpacing: -0.24,  // Figma: letterSpacing -0.24
    color: FIGMA_COLORS.labelText, // #878787
    textAlign: 'left' as const, // Left-aligned in row layout
  },
  rentMonth: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,     // Figma: 14px (was 12)
    lineHeight: 20,   // Figma: ~19.74 ≈ 20
    letterSpacing: -0.56,  // Figma: letterSpacing -0.56
    color: '#CBCBCB', // Figma: #CBCBCB (was #A6A6A6)
    textAlign: 'right' as const, // Right side of row
  },
  rentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentAmountLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText, // #878787
    textAlign: 'left' as const, // Left side of row
  },
  rentAmountValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: FIGMA_COLORS.textPrimary,
    textAlign: 'right' as const, // Right side of row
  },
  cashbackRow: {
    alignItems: 'flex-start',
  },
  cashbackPill: {
    backgroundColor: 'rgba(255, 154, 109, 0.1)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: FIGMA_COLORS.accent,
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: FIGMA_COLORS.accent,
    textAlign: 'center' as const, // Centered in pill
  },

  // Section Divider
  sectionDivider: {
    height: 1,
    backgroundColor: FIGMA_COLORS.divider, // #4D4D4D
    marginVertical: 24,
  },

  // Methods Section
  methodsSection: {
    gap: 16,
  },
  sectionTitle: {
    // PRODUCT DECISION: Figma 41:8901 shows section title at 28px, but implementation uses
    // 16px as part of a richer layout with subtitle, radio cards, and fee breakdown.
    // The Figma design is simpler; the code intentionally diverges for better UX.
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.textPrimary,
    textAlign: 'center' as const, // Figma 41:9078 textAlignHorizontal CENTER
  },
  sectionSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.textSecondary, // #A6A6A6 - subtext per Figma
    textAlign: 'center' as const, // Figma 41:9060 textAlignHorizontal CENTER
    marginBottom: 8,
  },
  methodsList: {
    gap: 12,
  },

  // Payment Method Card
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: FIGMA_COLORS.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FIGMA_COLORS.borderDefault, // #4D4D4D
    padding: 16,
  },
  methodCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: FIGMA_COLORS.textTertiary, // #4D4D4D - subtextSecondary
  },
  methodIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodTextContainer: {
    flex: 1,
    gap: 2,
  },
  methodTitle: {
    fontFamily: 'PlusJakartaSans-Regular',  // Figma: fontWeight 400 (was Medium/500)
    fontSize: 12,     // Figma: 12px (was 14)
    lineHeight: 20,
    color: FIGMA_COLORS.valueText, // #CBCBCB
    textAlign: 'left' as const, // Left-aligned in card row
  },
  methodTitleSelected: {
    color: '#D2D2D2', // Figma: selected card title is #D2D2D2 (not pure white)
  },
  methodSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: FIGMA_COLORS.textSecondary, // #A6A6A6 - subtext per Figma
    textAlign: 'left' as const, // Left-aligned in card row
  },
  methodFee: {
    fontFamily: 'PlusJakartaSans-Regular',  // Figma: fontWeight 400 (was Medium/500)
    fontSize: 14,     // Figma: 14px (was 12)
    lineHeight: 20,
    color: '#CBCBCB', // Figma: #CBCBCB (was #A6A6A6)
    textAlign: 'right' as const, // Right-aligned fee label
  },

  // Fee Breakdown
  feeBreakdown: {
    backgroundColor: FIGMA_COLORS.cardSurface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText, // #878787
    textAlign: 'left' as const, // Left side of row
  },
  feeValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.valueText, // #CBCBCB
    textAlign: 'right' as const, // Right side of row
  },
  feeDivider: {
    height: 1,
    backgroundColor: FIGMA_COLORS.divider, // #4D4D4D
    marginVertical: 4,
  },
  feeTotalLabel: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.textPrimary,
    textAlign: 'left' as const, // Left side of row
  },
  feeTotalValue: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.textPrimary,
    textAlign: 'right' as const, // Right side of row
  },

  // Spacer
  spacer: {
    flex: 1,
    minHeight: 32,
  },

  // Button Container
  buttonContainer: {
    marginTop: 24,
  },

  // Footer
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral.500) per payment-select JSON
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
    color: FIGMA_COLORS.textSecondary, // #A6A6A6 - subtext per Figma
    textAlign: 'center' as const, // Centered with lock icon
  },
});
