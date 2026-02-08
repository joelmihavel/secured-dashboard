/**
 * Pay Rent / Transaction Screen - Pixel Perfect Figma Parity
 * Figma Reference: 243-5870 (Pay Rent / Transaction Page --without cashback)
 *
 * Layout Structure:
 * - Fixed Header at top
 * - ScrollView for body content (with paddingBottom for footer)
 * - Fixed Footer at bottom (absolute positioned)
 *
 * Key Figma Specifications:
 * - Background: #131313 (black.700)
 * - Header section paddingLeft: 64px
 * - Payment card carousel: paddingLeft 64px, paddingRight 32px
 * - Footer section paddingHorizontal: 32px
 * - 24px gap between major sections
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { Text, PrimaryButton } from '@/src/components';
import { CreditCardSelect, UPICardSelect, NetbankingCardSelect, AddMoreCard } from '@/src/components/payment';
import { useDashboard } from '@/src/hooks';
import { colors, spacing, radius } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ===========================================
// FIGMA EXTRACTED DESIGN TOKENS (243-5870)
// ===========================================
const FIGMA_COLORS = {
  // Backgrounds
  background: '#131313',          // black.700 - Root frame
  cardBody: '#202020',            // black.500 - Frame 2095586440
  cardFooter: '#1A1A1A',          // black.600 - Frame 2095586454
  toggleBg: '#1A1A1A',            // black.600 - Toggle

  // Text colors
  textPrimary: '#FFFFFF',         // white
  textSecondary: '#BABABA',       // neutral.400 - "Your rent is due in"
  textMuted: '#A6A6A6',           // black.200 - "Paying with:"
  textDisabled: '#4D4D4D',        // black.400 - inactive card text
  textAccent: '#FF9A6D',          // brand.500 - "10 days", selected states
  labelText: '#CBCBCB',           // neutral.300 - footer labels

  // Status colors
  success: '#70BF73',             // success.default
  warning: '#FFD580',             // warning.default

  // Icons and dividers
  iconButton: '#4D4D4D',          // black.400 - Rectangle 140
  divider: '#4D4D4D',             // black.400

  // Cashback section
  cashbackLabel: '#A9A9A9',       // neutral.500
  cashbackValue: '#DDDDDD',       // neutral.200
  cashbackAccent: '#FF9A6D',      // brand.500

  // UPI colors
  upiGreen: '#27803B',            // success.dark
  upiOrange: '#E9661C',           // brand.800
} as const;

// Figma spacing values
const FIGMA_SPACING = {
  headerPaddingLeft: 64,          // Frame 2095586453 paddingLeft
  carouselPaddingLeft: 64,        // Frame 2095586448 paddingLeft
  carouselPaddingRight: 32,       // Frame 2095586448 paddingRight
  carouselGap: 16,                // Frame 2095586449 gap
  sectionGap: 24,                 // Frame 2095586343 gap
  footerHeight: 118,              // Approximate footer height
  footerPaddingHorizontal: 32,    // Footer paddingHorizontal
} as const;

// ===========================================
// ICON COMPONENTS
// ===========================================

const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Small circular icon button (Rectangle 140 in Figma)
const IconButton = ({
  name,
  onPress,
  testID,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  testID?: string;
}) => (
  <TouchableOpacity
    style={styles.iconButton}
    onPress={onPress}
    testID={testID}
    accessibilityRole="button"
  >
    <Ionicons name={name} size={16} color={FIGMA_COLORS.textPrimary} />
  </TouchableOpacity>
);

// Toggle component matching Figma design
const CashbackToggle = ({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) => (
  <View style={styles.toggleContainer}>
    <View style={[styles.toggleTrack, enabled && styles.toggleTrackActive]}>
      <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
    </View>
    <TouchableOpacity
      onPress={() => onToggle(!enabled)}
      style={StyleSheet.absoluteFill}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
    />
  </View>
);

// Page indicator dots
const PageIndicator = ({ active, index }: { active: boolean; index: number }) => (
  <View
    style={[styles.pageIndicator, active && styles.pageIndicatorActive]}
    accessibilityLabel={`Page ${index + 1}${active ? ', current' : ''}`}
  />
);

// ===========================================
// PAYMENT METHOD TYPE
// ===========================================
type PaymentMethod = 'credit_card' | 'upi' | 'netbanking' | 'add_new';

interface PaymentMethodData {
  id: string;
  type: PaymentMethod;
  cardNumber?: string;
  expiryDate?: string;
  upiId?: string;
  bankAccount?: string;
}

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PayRentTransactionScreen() {
  const router = useRouter();
  const { tenancy, upcomingPayment, cashback } = useDashboard();

  const [selectedMethod, setSelectedMethod] = useState<string>('card-1');
  const [useCashback, setUseCashback] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Mock payment methods data
  const paymentMethods: PaymentMethodData[] = useMemo(() => [
    { id: 'card-1', type: 'credit_card', cardNumber: '2341', expiryDate: '06/26' },
    { id: 'upi-1', type: 'upi', upiId: 'rishabh@icici', bankAccount: 'ICICI a/c -  xxx23' },
    { id: 'netbanking-1', type: 'netbanking', bankAccount: 'ICICI a/c -  xxx23', cardNumber: '2341', expiryDate: '06/26' },
    { id: 'add-new', type: 'add_new' },
  ], []);

  // Calculate amounts
  const rentAmount = tenancy?.monthly_rent ?? 32500;
  const cashbackAvailable = cashback?.available_balance ?? 325;
  const cashbackToApply = useCashback ? Math.min(cashbackAvailable, rentAmount) : 0;
  const totalAmount = rentAmount - cashbackToApply;
  const daysUntilDue = 10;
  const cashbackRate = '0.8%';
  const allTimeCashback = 3256;

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleSelectMethod = useCallback((methodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (methodId === 'add-new') {
      router.push('/(payment)/select-method' as never);
    } else {
      setSelectedMethod(methodId);
    }
  }, [router]);

  const handlePayNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const method = paymentMethods.find(m => m.id === selectedMethod);
    if (method) {
      router.push({
        pathname: '/(payment)/initiate',
        params: { method: method.type === 'credit_card' ? 'card' : method.type },
      } as never);
    }
  }, [router, selectedMethod, paymentMethods]);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = 270 + FIGMA_SPACING.carouselGap;
    const page = Math.round(offsetX / cardWidth);
    setCurrentPage(Math.max(0, Math.min(page, paymentMethods.length - 1)));
  }, [paymentMethods.length]);

  const renderPaymentCard = (method: PaymentMethodData) => {
    const isSelected = method.id === selectedMethod;

    switch (method.type) {
      case 'credit_card':
        return (
          <CreditCardSelect
            key={method.id}
            cardNumber={method.cardNumber ?? ''}
            expiryDate={method.expiryDate}
            selected={isSelected}
            onSelect={() => handleSelectMethod(method.id)}
            testID={`payment-card-${method.id}`}
          />
        );
      case 'upi':
        return (
          <UPICardSelect
            key={method.id}
            upiId={method.upiId ?? ''}
            bankAccount={method.bankAccount}
            selected={isSelected}
            onSelect={() => handleSelectMethod(method.id)}
            testID={`payment-card-${method.id}`}
          />
        );
      case 'netbanking':
        return (
          <NetbankingCardSelect
            key={method.id}
            bankName="ICICI Bank"
            bankAccount={method.bankAccount}
            selected={isSelected}
            onSelect={() => handleSelectMethod(method.id)}
            testID={`payment-card-${method.id}`}
          />
        );
      case 'add_new':
        return (
          <AddMoreCard
            key={method.id}
            onPress={() => handleSelectMethod(method.id)}
            testID="payment-card-add-new"
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <BackArrow />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <IconButton name="notifications-outline" testID="notifications-button" />
            <IconButton name="help-circle-outline" testID="help-button" />
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Rent Due Section - paddingLeft: 64px */}
          <View style={styles.rentDueSection}>
            {/* Multi-styled text: "Your rent is due in 10 days" */}
            <Text style={styles.rentDueTitle}>
              <Text style={styles.rentDueTextSecondary}>Your rent is due in </Text>
              <Text style={styles.rentDueTextAccent}>{daysUntilDue} days</Text>
            </Text>
            <Text style={styles.payingWithText}>Paying with:</Text>
          </View>

          {/* Payment Cards Carousel - Critical Fix: Horizontal ScrollView Padding */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={270 + FIGMA_SPACING.carouselGap}
            snapToAlignment="start"
          >
            {paymentMethods.map(renderPaymentCard)}
          </ScrollView>

          {/* Page Indicators */}
          <View style={styles.pageIndicators}>
            {paymentMethods.map((_, index) => (
              <PageIndicator
                key={index}
                active={index === currentPage}
                index={index}
              />
            ))}
          </View>

          {/* Divider Line */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
          </View>

          {/* Cashback Section - paddingHorizontal: 32px */}
          <View style={styles.cashbackSection}>
            {/* Cashback Toggle Row */}
            <View style={styles.cashbackToggleRow}>
              <View style={styles.cashbackLabelContainer}>
                <Text style={styles.cashbackLabelText}>Apply Cashback</Text>
              </View>
              <CashbackToggle enabled={useCashback} onToggle={setUseCashback} />
            </View>

            {/* All-time Total Row */}
            <View style={styles.cashbackStatRow}>
              <Text style={styles.cashbackStatLabel}>All-time Total</Text>
              {/* Multi-styled text: "Rs 3,256.00" */}
              <Text style={styles.cashbackStatValue}>
                <Text style={styles.currencySymbol}>Rs  </Text>
                <Text style={styles.cashbackValueMain}>{allTimeCashback.toLocaleString('en-IN')}</Text>
                <Text style={styles.currencySymbol}>.00</Text>
              </Text>
            </View>

            {/* Cashback Rate Row */}
            <View style={styles.cashbackStatRow}>
              <Text style={styles.cashbackStatLabel}>Avg Rate</Text>
              {/* Multi-styled text: "0.8% Avg" */}
              <Text style={styles.cashbackStatValue}>
                <Text style={styles.cashbackRateAccent}>{cashbackRate}</Text>
                <Text style={styles.cashbackRateSuffix}> Avg</Text>
              </Text>
            </View>

            {/* Available Cashback Row */}
            <View style={styles.cashbackStatRow}>
              <Text style={styles.cashbackStatLabel}>Available</Text>
              {/* Multi-styled text: "Rs 325.00" */}
              <Text style={styles.cashbackStatValue}>
                <Text style={styles.currencySymbol}>Rs  </Text>
                <Text style={styles.cashbackAvailableMain}>{cashbackAvailable.toLocaleString('en-IN')}</Text>
                <Text style={styles.currencySymbol}>.00</Text>
              </Text>
            </View>
          </View>

          {/* Setup Progress Message */}
          <View style={styles.setupMessageContainer}>
            {/* Multi-styled text: "Complete setup in 28:12:12 to unlock Cashbacks" */}
            <Text style={styles.setupMessageText}>
              <Text style={styles.setupTextNormal}>Complete setup in </Text>
              <Text style={styles.setupTextTimer}>28:12:12</Text>
              <Text style={styles.setupTextNormal}> to  unlock </Text>
              <Text style={styles.setupTextAccent}>Cashbacks</Text>
            </Text>
          </View>

        </ScrollView>

        {/* Fixed Footer - absolutely positioned */}
        <View style={styles.footer}>
          {/* Amount Display */}
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Due in {daysUntilDue} Days</Text>
            {/* Multi-styled text: "Rs 32,500" */}
            <Text style={styles.amountValue}>
              <Text style={styles.amountCurrency}>Rs  </Text>
              <Text style={styles.amountMain}>{totalAmount.toLocaleString('en-IN')}</Text>
            </Text>
          </View>

          {/* Pay Now Button */}
          <PrimaryButton
            title="Pay Now"
            onPress={handlePayNow}
            testID="pay-now-button"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ===========================================
// STYLES - Exact Figma Values
// ===========================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },

  // Header - Fixed
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Icon button - Figma: Rectangle 140, fill #4D4D4D (black.400)
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: FIGMA_COLORS.iconButton, // Critical fix: #4D4D4D
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl, // 48px - listContent paddingBottom per Figma spec
    gap: FIGMA_SPACING.sectionGap, // 24px between sections
  },

  // Rent Due Section - Figma: paddingLeft 64px
  rentDueSection: {
    paddingLeft: FIGMA_SPACING.headerPaddingLeft, // Critical fix: 64px
    paddingRight: FIGMA_SPACING.footerPaddingHorizontal,
    gap: spacing.xs,
  },
  // Multi-styled text fix: Single Text with nested spans
  rentDueTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    textAlign: 'left',
  },
  rentDueTextSecondary: {
    color: FIGMA_COLORS.textSecondary, // #BABABA neutral.400
  },
  rentDueTextAccent: {
    color: FIGMA_COLORS.textAccent, // #FF9A6D brand.500
  },
  payingWithText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.textMuted, // #A6A6A6 black.200
    textAlign: 'left',
  },

  // Payment Cards Carousel - Critical fix: Horizontal ScrollView Padding
  carouselContent: {
    paddingLeft: FIGMA_SPACING.carouselPaddingLeft, // 64px
    paddingRight: FIGMA_SPACING.carouselPaddingRight, // 32px
    gap: FIGMA_SPACING.carouselGap, // 16px
  },

  // Page Indicators
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.black[500], // #202020
  },
  pageIndicatorActive: {
    backgroundColor: FIGMA_COLORS.textAccent, // #FF9A6D
  },

  // Divider
  dividerContainer: {
    paddingHorizontal: FIGMA_SPACING.footerPaddingHorizontal,
  },
  divider: {
    height: 1,
    backgroundColor: FIGMA_COLORS.divider,
  },

  // Cashback Section - Figma: marginHorizontal 64px (spacing.huge)
  cashbackSection: {
    marginHorizontal: spacing.huge, // 64px per Figma cashbackSummary spec
    gap: spacing.md,
  },
  cashbackToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashbackLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cashbackLabelText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackLabel, // #A9A9A9 neutral.500
    textAlign: 'left',
  },

  // Toggle
  toggleContainer: {
    width: 44,
    height: 24,
    justifyContent: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: FIGMA_COLORS.toggleBg, // #1A1A1A
    borderWidth: 1,
    borderColor: colors.black[500], // #202020
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: FIGMA_COLORS.textAccent + '40',
    borderColor: FIGMA_COLORS.textAccent,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.black[400],
  },
  toggleThumbActive: {
    backgroundColor: FIGMA_COLORS.textAccent,
    alignSelf: 'flex-end',
  },

  // Cashback Stats
  cashbackStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // marginBottom removed - parent cashbackSection already has gap: spacing.md
  },
  cashbackStatLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackLabel, // #A9A9A9
    textAlign: 'left',
  },
  cashbackStatValue: {
    textAlign: 'right',
  },
  // Multi-styled text for currency values
  currencySymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: FIGMA_COLORS.cashbackLabel, // #A9A9A9
  },
  cashbackValueMain: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.cashbackValue, // #DDDDDD neutral.200
  },
  cashbackAvailableMain: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.cashbackAccent, // #FF9A6D brand.500
  },
  cashbackRateAccent: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: FIGMA_COLORS.cashbackAccent, // #FF9A6D
  },
  cashbackRateSuffix: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: FIGMA_COLORS.cashbackLabel, // #A9A9A9
  },

  // Setup Message
  setupMessageContainer: {
    paddingHorizontal: FIGMA_SPACING.footerPaddingHorizontal,
    alignItems: 'center',
  },
  // Multi-styled text: "Complete setup in 28:12:12 to unlock Cashbacks"
  setupMessageText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  setupTextNormal: {
    color: FIGMA_COLORS.labelText, // #CBCBCB neutral.300
    textAlign: 'center',
  },
  setupTextTimer: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: FIGMA_COLORS.textAccent, // #FF9A6D brand.500
    textAlign: 'center',
  },
  setupTextAccent: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: FIGMA_COLORS.textAccent, // #FF9A6D brand.500
    textAlign: 'center',
  },

  // Footer - Fixed at bottom
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: FIGMA_COLORS.background,
    paddingHorizontal: FIGMA_SPACING.footerPaddingHorizontal, // 32px
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    // Add subtle top border
    borderTopWidth: 1,
    borderTopColor: colors.black[600],
  },
  amountContainer: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  amountLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackLabel, // #A9A9A9 neutral.500
    textAlign: 'center',
  },
  // Multi-styled text: "Rs 32,500"
  amountValue: {
    textAlign: 'center',
  },
  amountCurrency: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: colors.neutral[100], // #EEEEEE
    textAlign: 'center',
  },
  amountMain: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: colors.neutral[100], // #EEEEEE
    textAlign: 'center',
  },
});
