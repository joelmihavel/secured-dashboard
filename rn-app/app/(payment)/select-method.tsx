/**
 * Select Payment Method Screen
 * Figma Reference: 41-8901 (no-setup), 41-9004 (all-setup before-7th), 41-9114 (after-7th)
 *
 * Screen structure from Figma:
 * - Top section: back arrow + rent summary card with breakdown
 * - Bottom sheet overlay: drag handle + rounded panel
 *   - "Choose a Payment Method" heading (28px, white + orange span)
 *   - Three payment method rows with radio buttons
 *     - no-setup: radio + label + "Set it up" pill
 *     - all-setup: radio + label + subtitle + fee text
 *   - Thin dividers (#4D4D4D, 0.25px) between rows
 *   - CTA button + subtext
 *
 * Figma color tokens:
 * - Background: #131313 (black.700)
 * - Bottom sheet panel: #1A1A1A (black.600)
 * - Card surface: #202020 (black.500)
 * - Selected radio fill: #FF9A6D (brand.500)
 * - Unselected radio ring: #A6A6A6 (black.200)
 * - Selected method label: #D2D2D2
 * - Unselected method label: #878787 (neutral.600)
 * - "Set it up" pill bg: #202020, text: #DDDDDD
 * - Fee text: #CBCBCB
 * - Divider: #4D4D4D (black.400)
 * - Accent heading span: #FF9A6D (brand.500)
 * - Drag handle: #4D4D4D (black.400)
 */

import React, { useCallback, useState, useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { Screen, PrimaryButton } from '@/src/components';
import { useDashboard, useSavedPaymentMethods } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores/payment';
import { getCurrentRentMonth } from '@/src/services/api/payments';
import type { SavedPaymentMethod as SavedMethod } from '@/src/services/api/payments';
import { colors } from '@/src/theme';

// Exact Figma colors from 41-8901 / 41-9004 analysis
const FIGMA_COLORS = {
  // Backgrounds
  background: colors.black[700],           // black.700
  bottomSheetPanel: colors.black[600],     // black.600
  cardSurface: colors.black[500],          // black.500 (rent card, pill bg)

  // Text colors
  textPrimary: colors.white,          // White
  headingAccent: colors.brand[500],        // brand.500 - "Payment Method" span
  selectedLabel: '#D2D2D2',        // Selected method label
  unselectedLabel: colors.neutral[600],      // neutral.600 - unselected method label
  feeText: colors.neutral[300],             // neutral.300 - fee text
  subtitleText: colors.neutral[300],         // neutral.300 - account detail subtitle
  pillText: colors.neutral[200],            // "Set it up" pill text
  labelText: colors.neutral[600],            // neutral.600 - rent label
  rentMonth: colors.neutral[300],            // neutral.300 - month text
  footerText: colors.neutral[500],           // neutral.500
  cashbackText: colors.brand[500],         // brand.500

  // Radio
  radioSelected: colors.brand[500],        // brand.500
  radioUnselected: colors.black[200],      // black.200

  // Borders/Dividers
  divider: colors.black[400],              // black.400
  dragHandle: colors.black[400],           // black.400

  // Success
  successGreen: colors.success.default,         // (not used in Figma for this screen, kept for compat)
};

// Payment method data type
interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking';
  title: string;
  subtitle: string | null; // account detail when set up, null when not
  fee: string;
  feeAmount?: number;
  isSetUp: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
}

// Back Arrow Icon - Figma: 32x32 arrow-right instance rotated 180deg, stroke #FFFFFF 2.67px
const BackArrowIcon = memo(() => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 8L12 16L20 24"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.67}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M8.89 16L25.33 16"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.67}
      strokeLinecap="round"
    />
  </Svg>
));

// Radio Button - Figma: 16x16 container, inner vector 13.33x13.33
// Selected: outer ring + inner fill circle, all #FF9A6D
// Unselected: outer ring only (no inner fill), #A6A6A6
// The SVG path draws: outer circle ring (13.33 outer, 12 middle cutout) + inner fill circle (10 outer, no cutout when selected)
const RadioCircle = memo(({ isSelected }: { isSelected: boolean }) => {
  const color = isSelected ? FIGMA_COLORS.radioSelected : FIGMA_COLORS.radioUnselected;

  // Selected: ring + inner dot (3-circle path)
  // Unselected: ring only (2-circle path, no inner fill)
  const selectedPath =
    'M6.66667 13.3333C2.98477 13.3333 0 10.3485 0 6.66667C0 2.98477 2.98477 0 6.66667 0C10.3485 0 13.3333 2.98477 13.3333 6.66667C13.3333 10.3485 10.3485 13.3333 6.66667 13.3333ZM6.66667 12C9.6122 12 12 9.6122 12 6.66667C12 3.72115 9.6122 1.33333 6.66667 1.33333C3.72115 1.33333 1.33333 3.72115 1.33333 6.66667C1.33333 9.6122 3.72115 12 6.66667 12ZM6.66667 10C4.82572 10 3.33333 8.5076 3.33333 6.66667C3.33333 4.82572 4.82572 3.33333 6.66667 3.33333C8.5076 3.33333 10 4.82572 10 6.66667C10 8.5076 8.5076 10 6.66667 10Z';

  const unselectedPath =
    'M6.66667 13.3333C2.98477 13.3333 0 10.3485 0 6.66667C0 2.98477 2.98477 0 6.66667 0C10.3485 0 13.3333 2.98477 13.3333 6.66667C13.3333 10.3485 10.3485 13.3333 6.66667 13.3333ZM6.66667 12C9.6122 12 12 9.6122 12 6.66667C12 3.72115 9.6122 1.33333 6.66667 1.33333C3.72115 1.33333 1.33333 3.72115 1.33333 6.66667C1.33333 9.6122 3.72115 12 6.66667 12Z';

  return (
    <View style={styles.radioContainer}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path
          d={isSelected ? selectedPath : unselectedPath}
          fill={color}
          transform="translate(1.334, 1.334)"
        />
      </Svg>
    </View>
  );
});

// Payment Method Row Component
// Figma structure per row: [Radio 16x16] [4px gap] [Title text] ... [SetItUp pill OR Fee text]
// Row is flexDirection row, justifyContent space-between, alignItems center
// Row height: HUG (28px for no-setup with single-line title, 44px for all-setup with title+subtitle)
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
  const titleColor = isDisabled
    ? FIGMA_COLORS.unselectedLabel    // #878787 for disabled
    : isSelected
      ? FIGMA_COLORS.selectedLabel    // #D2D2D2
      : FIGMA_COLORS.unselectedLabel; // #878787

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
      {/* Left side: Radio + Text */}
      <View style={styles.methodRowLeft}>
        <RadioCircle isSelected={isDisabled ? false : isSelected} />
        <View style={(method.subtitle || method.disabledReason) ? styles.methodTextContainerStacked : undefined}>
          <RNText style={[styles.methodTitle, { color: titleColor }]}>
            {method.title}
          </RNText>
          {isDisabled && method.disabledReason ? (
            <RNText style={styles.methodSubtitle}>
              {method.disabledReason}
            </RNText>
          ) : method.subtitle ? (
            <RNText style={styles.methodSubtitle}>
              {method.subtitle}
            </RNText>
          ) : null}
        </View>
      </View>

      {/* Right side: fee text */}
      {!isDisabled && (
        <RNText style={styles.feeText}>
          {method.fee}
        </RNText>
      )}
    </Pressable>
  );
});

// Thin Divider between payment method rows
// Figma: Vector 47/48, stroke #4D4D4D weight 0.25, full width of parent (297px at 48px padding)
const ThinDivider = memo(() => (
  <View style={styles.thinDivider} />
));

export default function SelectPaymentMethodScreen() {
  const router = useRouter();
  const { tenancy, upcomingPayment, cashback } = useDashboard();
  const storedAmount = usePaymentStore(state => state.amount);
  const { data: savedMethods, isLoading: isLoadingMethods } = useSavedPaymentMethods();
  const landlordApprovedInit = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerifiedInit = tenancy?.verification_status?.utility_verified ?? false;
  const [selectedMethod, setSelectedMethod] = useState<string>(
    (!landlordApprovedInit || !utilityVerifiedInit) ? 'upi-1' : 'card-1'
  );

  // Rent data from dashboard
  const rentAmount = storedAmount || tenancy?.monthly_rent || 32500;
  const cashbackAvailable = cashback?.available_balance ?? 350;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  const isOverdue = upcomingPayment?.is_overdue ?? false;
  const rentMonth = upcomingPayment?.rent_month ?? 'December 2025';

  // Determine if all methods are set up (drives which layout variant to render)
  const hasSavedCard = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'card') ?? false,
    [savedMethods]
  );
  const hasSavedUpi = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'upi') ?? false,
    [savedMethods]
  );
  const hasSavedNetbanking = useMemo(
    () => savedMethods?.some((m: SavedMethod) => m.type === 'netbanking') ?? false,
    [savedMethods]
  );

  // Build subtitle from saved methods for each type
  const getSavedMethodSubtitle = (type: 'upi' | 'card' | 'netbanking'): string | null => {
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

  // Rent breakdown data (from Figma 41-8901)
  const baseRent = 30000;
  const maintenance = 2000;
  const otherCharges = 500;

  // Due label
  const getDueLabel = () => {
    if (isOverdue) {
      return `Rent ${Math.abs(daysUntilDue)} days overdue`;
    }
    return `Rent due in ${daysUntilDue} days`;
  };

  // Determine if credit card should be disabled based on tenancy status
  const landlordApproved = tenancy?.verification_status?.landlord_approved ?? false;
  const utilityVerified = tenancy?.verification_status?.utility_verified ?? false;
  const cardDisabled = !landlordApproved || !utilityVerified;
  const cardDisabledReason = !landlordApproved
    ? 'Available after landlord accepts tenancy'
    : !utilityVerified
      ? 'Available after utility bill verification'
      : undefined;

  // Payment methods with proper data
  const paymentMethods: PaymentMethod[] = useMemo(() => [
    {
      id: 'card-1',
      type: 'card' as const,
      title: 'Credit Card',
      subtitle: hasSavedCard ? (getSavedMethodSubtitle('card') ?? '\u2022\u2022\u2022\u2022 2345') : null,
      fee: `\u20B9325 fee`,
      feeAmount: Math.round(rentAmount * 0.01),
      isSetUp: hasSavedCard,
      isDisabled: cardDisabled,
      disabledReason: cardDisabledReason,
    },
    {
      id: 'upi-1',
      type: 'upi' as const,
      title: 'UPI',
      subtitle: hasSavedUpi ? (getSavedMethodSubtitle('upi') ?? '\u2022\u2022\u2022\u2022el@oksbi') : null,
      fee: 'Free',
      feeAmount: 0,
      isSetUp: hasSavedUpi,
    },
    {
      id: 'netbanking-1',
      type: 'netbanking' as const,
      title: 'Net Banking',
      subtitle: hasSavedNetbanking
        ? (getSavedMethodSubtitle('netbanking') ?? '\u2022\u2022\u2022\u2022 2345')
        : null,
      fee: `\u20B910 fee`,
      feeAmount: 10,
      isSetUp: hasSavedNetbanking,
    },
  ], [rentAmount, savedMethods, hasSavedCard, hasSavedUpi, hasSavedNetbanking, cardDisabled, cardDisabledReason]);

  const selectedPaymentMethod = paymentMethods.find(m => m.id === selectedMethod);

  const allSetUp = paymentMethods.every(m => m.isSetUp);
  const ctaText = `Pay \u20B9${rentAmount.toLocaleString('en-IN')}`;

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
    const methodType = method?.type ?? 'upi';

    router.push({
      pathname: '/(payment)/initiate',
      params: {
        method: methodType,
        tenancyId: tenancy?.id ?? '',
        rentMonth: getCurrentRentMonth(),
      },
    } as never);
  }, [router, selectedMethod, paymentMethods, tenancy?.id]);

  const formatCurrency = (amount: number) => {
    return `\u20B9 ${amount.toLocaleString('en-IN')}`;
  };

  return (
    <Screen testID="select-method-screen" padded={false}>
      <View style={styles.container}>
        {/* ===== TOP SECTION: Back Arrow + Rent Summary ===== */}
        {/* Figma: Frame 2095586343, y=111, column, gap 40, paddingBottom 48 */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Arrow - Figma: 32x32, x=40, y=0 in parent with 40px horizontal padding */}
          <View style={styles.topSection}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <BackArrowIcon />
            </TouchableOpacity>

            {/* Rent Summary Card - Figma: Frame 1686557240, bg #202020, radius 12, padding 24/16, gap 32 */}
            <View style={styles.rentCard}>
              {/* Top row: due label + month */}
              <View style={styles.rentCardTopRow}>
                <RNText style={[styles.rentDueLabel, isOverdue && { color: colors.error.default }]}>
                  {getDueLabel()}
                </RNText>
                <RNText style={styles.rentMonthText}>{rentMonth}</RNText>
              </View>

              {/* Breakdown rows */}
              <View style={styles.breakdownSection}>
                {/* Base rent */}
                <View style={styles.breakdownRow}>
                  <RNText style={styles.breakdownLabel}>Base rent</RNText>
                  <RNText style={styles.breakdownValue}>{formatCurrency(baseRent)}</RNText>
                </View>
                {/* Maintenance */}
                <View style={styles.breakdownRow}>
                  <RNText style={styles.breakdownLabel}>Maintenance</RNText>
                  <RNText style={styles.breakdownValue}>{`\u20B9${maintenance.toLocaleString('en-IN')}`}</RNText>
                </View>
                {/* Other charges */}
                <View style={styles.breakdownRow}>
                  <RNText style={styles.breakdownLabel}>Other charges</RNText>
                  <RNText style={styles.breakdownValue}>{`\u20B9${otherCharges.toLocaleString('en-IN')}`}</RNText>
                </View>

                {/* Divider before total */}
                <View style={styles.breakdownDivider} />

                {/* Payable Rent total */}
                <View style={styles.breakdownRow}>
                  <RNText style={styles.breakdownLabel}>Payable Rent</RNText>
                  <RNText style={styles.breakdownTotal}>
                    {`\u20B9  ${rentAmount.toLocaleString('en-IN')}`}
                  </RNText>
                </View>
              </View>
            </View>

            {/* Cashback pill below the card - 1% of rent, capped at 1% of agreement rent per month */}
            <View style={styles.cashbackRow}>
              <RNText style={styles.cashbackText}>
                {`\uD83D\uDD12 Earn 1% cashback (up to \u20B9${Math.round(rentAmount * 0.01).toLocaleString('en-IN')}/mo)`}
              </RNText>
            </View>
          </View>
        </ScrollView>

        {/* ===== BOTTOM SHEET OVERLAY SECTION ===== */}
        {/* Figma 41:8958: absolute backdrop-blur-[4px] bg-[rgba(0,0,0,0.6)] */}
        <BlurView intensity={8} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.overlayOverlay} />

        <View style={styles.bottomSheetContainer}>
          <View style={styles.bottomSheet}>
            {/* Drag Handle - Figma: Rectangle 53, 48x4, #4D4D4D, radius 200, centered */}
            <View style={styles.dragHandle} />

            {/* Rounded Panel - Figma: Frame 1686557301, bg #1A1A1A, borderRadius tl/tr ~23 */}
            <View style={styles.sheetPanel}>
              {/* Inner content - Figma: Frame 1686557230, column, gap ~30, paddingTop 16 */}
              <View style={styles.sheetContent}>

                {/* Heading: "Choose a Payment Method" */}
                {/* Figma: 28px Regular, #FFFFFF with span [11..25] in #FF9A6D */}
                {/* padding: 0 48 */}
                <View style={styles.headingContainer}>
                  <RNText style={styles.headingText}>
                    {'Choose a\n'}
                    <RNText style={styles.headingAccent}>Payment Method</RNText>
                  </RNText>
                </View>

                {/* Cashback earned text (all-setup variant) */}
                {/* 1% of rent, capped at 1% of agreement rent per month */}
                {allSetUp && (
                  <View style={styles.cashbackEarnedRow}>
                    <RNText style={styles.cashbackEarnedText}>
                      {`You'll earn up to \u20B9${Math.round(rentAmount * 0.01).toLocaleString('en-IN')} cashback (1% of rent)`}
                    </RNText>
                  </View>
                )}

                {/* Payment Method Rows */}
                {/* Figma: Frame 2095586364, column, gap 16, padding 0 48 */}
                <View style={styles.methodsContainer}>
                  {isLoadingMethods && (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={FIGMA_COLORS.headingAccent} />
                    </View>
                  )}
                  {paymentMethods.map((method, index) => (
                    <React.Fragment key={method.id}>
                      <PaymentMethodRow
                        method={method}
                        isSelected={selectedMethod === method.id}
                        onSelect={() => handleSelectMethod(method.id)}
                      />
                      {index < paymentMethods.length - 1 && <ThinDivider />}
                    </React.Fragment>
                  ))}
                </View>

                {/* CTA Button Section */}
                {/* Figma: Frame 2095586363-like, button instance + subtext */}
                <View style={styles.ctaSection}>
                  <PrimaryButton
                    title={ctaText}
                    onPress={handleProceed}
                    showDivider={true}
                    testID="pay-now-button"
                  />

                  {/* Subtext below button */}
                  {/* Figma 41-8901: "Complete setup to unlock cashback on payments." */}
                  {/* Figma 41-9004: "You'll see the final amount before payment" */}
                  <RNText style={styles.ctaSubtext}>
                    {allSetUp
                      ? "You'll see the final amount before payment"
                      : 'Complete setup to unlock cashback on payments.'}
                  </RNText>
                </View>
              </View>
            </View>
          </View>
        </View>
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
  },
  overlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)', // 60% black overlay per Figma
  },

  // ===== TOP SECTION =====
  // Figma: Frame 2095586343, column, gap 40, paddingH 40, paddingBottom 48
  topSection: {
    paddingHorizontal: 40,
    gap: 40,
    paddingBottom: 48,
  },

  // Back Arrow
  // Figma: Outline Icon Library, 32x32
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Rent Card
  // Figma: Frame 1686557240, bg #202020, radius 12, padding 24/16, gap 32
  rentCard: {
    backgroundColor: FIGMA_COLORS.cardSurface,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 32,
  },

  // Rent card top row: due label + month
  rentCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentDueLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: FIGMA_COLORS.labelText, // #878787
  },
  rentMonthText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: FIGMA_COLORS.rentMonth, // #CBCBCB
  },

  // Breakdown section - Figma: column, gap varies
  breakdownSection: {
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText, // #878787
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.feeText, // #CBCBCB
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.divider, // #4D4D4D
  },
  breakdownTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.feeText, // #CBCBCB
  },

  // Cashback row below card
  cashbackRow: {
    alignItems: 'center',
  },
  cashbackText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackText, // #FF9A6D
  },

  // ===== BOTTOM SHEET =====
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  // Figma: Frame 2095586317, column, gap 15, anchored BOTTOM
  bottomSheet: {
    alignItems: 'center',
    gap: 15,
  },

  // Drag Handle - Figma: Rectangle 53, 48x4, #4D4D4D, radius 200
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: FIGMA_COLORS.dragHandle,
    borderRadius: 200,
  },

  // Sheet Panel - Figma: Frame 1686557301, bg #1A1A1A, borderRadius tl/tr 23
  sheetPanel: {
    width: '100%',
    backgroundColor: FIGMA_COLORS.bottomSheetPanel,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingTop: 15,
  },

  // Sheet Content - Figma: Frame 1686557230, column, gap ~30, paddingTop 16
  sheetContent: {
    paddingTop: 16,
    gap: 30,
  },

  // Heading Container - Figma: padding 0 48
  headingContainer: {
    paddingHorizontal: 48,
  },
  // Heading Text - Figma: 28px Regular, lineHeight 40, letterSpacing -1, #FFFFFF, left aligned
  headingText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 40,
    letterSpacing: -1,
    color: FIGMA_COLORS.textPrimary,
  },
  // Orange span - Figma: "Payment Method" portion in #FF9A6D
  headingAccent: {
    color: FIGMA_COLORS.headingAccent,
  },

  // Cashback earned row (all-setup variant)
  cashbackEarnedRow: {
    paddingHorizontal: 48,
  },
  cashbackEarnedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackText, // #FF9A6D
  },

  // Methods Container - Figma: Frame 2095586364, column, gap 16, padding 0 48
  methodsContainer: {
    paddingHorizontal: 48,
    gap: 16,
  },

  // Loading row
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  // Payment Method Row - Figma: row, space-between, center, gap 4, height HUG (28 or 44)
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },

  // Radio Container - Figma: Frame 16x16
  radioContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Method text container (stacked title + subtitle)
  methodTextContainerStacked: {
    gap: 4,
  },

  // Method Title - Figma: 12px Regular, lineHeight 20
  // Color varies: #D2D2D2 selected, #878787 unselected
  methodTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
  },

  // Method Subtitle (account detail) - Figma: 12px Regular, lineHeight 20, #CBCBCB
  methodSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.subtitleText, // #CBCBCB
  },

  // Fee text - Figma: 14px Regular, lineHeight 20, #CBCBCB
  feeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.feeText, // #CBCBCB
  },

  // Thin divider between rows - Figma: Vector, stroke #4D4D4D weight 0.25
  thinDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.divider, // #4D4D4D
  },

  // CTA Section - Figma: padding 0 48, gap 16
  ctaSection: {
    paddingHorizontal: 48,
    gap: 16,
    paddingBottom: 24,
  },

  // CTA Subtext - Figma: 12px Regular, lineHeight 20, #A9A9A9, center
  ctaSubtext: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.footerText, // #A9A9A9
    textAlign: 'center',
  },
});
