/**
 * Pay Rent / Transaction Screen - Pixel Perfect Figma Parity
 * Figma Reference:
 *   41-8695: Transaction page --with cashback
 *   41-9681: Transaction page --without cashback (locked)
 *   41-9746: Transaction page --late payment
 *
 * Layout Structure (from Figma node tree):
 *   Root Frame (852x393, #131313)
 *     - Status bar zone (Frame 2095586357, fixed, y:0, h:77, bg:#131313, paddingBottom:24)
 *     - Body content (Frame 2095586343, y:101, column, gap:40, paddingBottom:48)
 *       - Top section (Frame 2095586345, column, gap:24, paddingHorizontal:40)
 *         - Back arrow icon (32x32, rotated arrow-right = arrow-left)
 *         - Info card (Frame 1686557240, 313xHUG, bg:#202020, radius:12,
 *                      padding: top:24, h:16, bottom:24, gap:32, items:center)
 *           - Inner content (gap:16, items:center)
 *             - "Rent due in X days" (12px Regular #878787, letterSpacing:-0.24)
 *             - "Complete setup..." (14px Medium #CBCBCB, letterSpacing:-0.56)
 *             - Cashback pill (bg:#1A1A1A, radius:200, padding:8/12)
 *           - Divider bar (268x5, bg:#1A1A1A)
 *           - Paperclip decoration (absolute, Group 58)
 *           - Arrow icon (absolute, Outline Icon Library)
 *       - Rent breakdown card (Frame 2095586361, 270xFIXED)
 *         - Each line item row: hash icon(16x16) + label(12px #878787) | value(14px #CBCBCB)
 *         - Divider lines between sections (Vector, stroke:#4D4D4D, 0.25 weight)
 *         - Cashback value: 14px #EF9194
 *         - Payable Rent value: 14px SemiBold #DDDDDD
 *         - Circle cutouts (Ellipse, 14x14, bg:#131313) at card edges
 *     - Footer (Frame 2095586363, x:40, y:688, width:313, column, gap:16)
 *       - PrimaryButton "Pay RsXX,XXX now" (14px Medium #FFFFFF, gradient bg)
 *       - Footer message (12px Regular #A9A9A9, center)
 *
 * Key Figma Specifications:
 * - Background: #131313 (black.700)
 * - Top section paddingHorizontal: 40px
 * - Info card body: bg #202020, radius 12, padding 24/16/24/16
 * - Hash symbol: #FF9A6D (brand.500)
 * - Table labels: #878787 (neutral.600)
 * - Table values: #CBCBCB (neutral.300)
 * - Cashback deduction: #EF9194
 * - Payable Rent value: #DDDDDD (neutral.200), SemiBold
 * - Footer text: #A9A9A9 (neutral.500)
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Text, PrimaryButton } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { colors } from '@/src/theme';

// ===========================================
// FIGMA EXTRACTED DESIGN TOKENS
// ===========================================
const FIGMA_COLORS = {
  // Backgrounds
  background: colors.black[700],       // black.700 - Root frame
  cardBody: colors.black[500],         // black.500 - Info card body
  pillBg: colors.black[600],           // black.600 - Cashback pill
  dividerBar: colors.black[600],       // black.600 - Rectangle 135

  // Text colors
  textPrimary: colors.white,      // white
  dueLabel: colors.neutral[600],         // neutral.600 - "Rent due in X days"
  setupLabel: colors.neutral[300],       // neutral.300 - "Complete setup..."
  pillText: colors.brand[500],         // brand.500 - pill text
  tableLabel: colors.neutral[600],       // neutral.600 - row labels
  tableValue: colors.neutral[300],       // neutral.300 - row values
  cashbackDeduction: '#EF9194', // cashback value (negative)
  payableValue: colors.neutral[200],    // neutral.200 - payable rent value
  hashSymbol: colors.brand[500],      // brand.500 - # icons
  footerText: colors.neutral[500],      // neutral.500 - footer message

  // Dividers / lines
  tableDivider: colors.black[400],    // black.400 - table separator lines
  circleCutout: colors.black[700],     // same as background (creates notch effect)

  // Late payment
  lateLabel: colors.neutral[600],        // neutral.600 - "Rent overdue..."
  noPayoutLabel: colors.neutral[300],   // neutral.300 - "No cashback..."
} as const;

// Figma spacing values (extracted from blueprint geometry/layout)
const FIGMA_SPACING = {
  topSectionPaddingH: 40,      // Frame 2095586345 paddingLeft/Right
  bodyGap: 40,                 // Frame 2095586343 gap
  bodyPaddingBottom: 48,       // Frame 2095586343 paddingBottom
  topSectionGap: 24,           // Frame 2095586345 gap
  cardPaddingV: 24,            // Info card paddingTop/Bottom
  cardPaddingH: 16,            // Info card paddingLeft/Right
  cardInnerGap: 32,            // Info card inner gap
  innerContentGap: 16,         // pill/label gap inside card
  pillPaddingH: 12,            // pill horizontal padding
  pillPaddingV: 8,             // pill vertical padding
  tableRowPaddingH: 24,        // row left/right inset
  tableGap: 16,                // gap between table rows in a section
  footerGap: 16,               // footer column gap
  footerX: 40,                 // footer paddingHorizontal
  breakdownCardWidth: 270,     // rent breakdown card width
  breakdownCardX: 61,          // breakdown card offset from left
} as const;

// ===========================================
// TRANSACTION STATE TYPES
// ===========================================
type TransactionState = 'with_cashback' | 'without_cashback' | 'late_payment';

// ===========================================
// SVG ICON COMPONENTS
// ===========================================

const BackArrowIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M25.3333 16H6.66667"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.66667 16L14.6667 24"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.66667 16L14.6667 8"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Hash/Number sign icon matching Figma (16x16, path extracted from blueprint) */
const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M5.52285 9.33333L5.80313 6.66667L3 6.66667V5.33333L5.94327 5.33333L6.29362 2H7.63427L7.28393 5.33333L9.94327 5.33333L10.2936 2H11.6343L11.2839 5.33333L13.6667 5.33333V6.66667L11.1438 6.66667L10.8635 9.33333H13.6667V10.6667L10.7234 10.6667L10.3731 14H9.0324L9.38273 10.6667L6.72339 10.6667L6.37305 14H5.03237L5.38271 10.6667H3V9.33333H5.52285ZM6.86353 9.33333L9.52287 9.33333L9.80313 6.66667L7.1438 6.66667L6.86353 9.33333Z"
      fill={FIGMA_COLORS.hashSymbol}
    />
  </Svg>
);

// ===========================================
// SUB-COMPONENTS
// ===========================================

/** Info card top section - varies by state */
function InfoCardContent({ state, daysUntilDue, cashbackAmount }: {
  state: TransactionState;
  daysUntilDue: number;
  cashbackAmount: number;
}) {
  const formattedCashback = cashbackAmount.toLocaleString('en-IN');

  switch (state) {
    case 'with_cashback':
      return (
        <>
          <Text style={styles.dueLabel}>
            Rent due in {daysUntilDue} days
          </Text>
          <Text style={styles.setupLabel}>
            Complete setup to unlock 1% cashback
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {'\u20B9'}{formattedCashback} cashback applied
            </Text>
          </View>
        </>
      );
    case 'without_cashback':
      return (
        <>
          <Text style={styles.dueLabel}>
            Rent due in {daysUntilDue} days
          </Text>
          <Text style={styles.setupLabel}>
            Complete setup to unlock 1% cashback
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              {'\u20B9'}{formattedCashback} available to unlock
            </Text>
          </View>
        </>
      );
    case 'late_payment':
      return (
        <>
          <Text style={styles.dueLabel}>
            Rent overdue by {daysUntilDue} days
          </Text>
          <Text style={styles.setupLabel}>
            No cashback on this payment
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Pay on time next month to earn 1% cashback
            </Text>
          </View>
        </>
      );
  }
}

/** Single row in the rent breakdown table */
function BreakdownRow({ label, value, valueColor = FIGMA_COLORS.tableValue, bold = false }: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabelContainer}>
        <HashIcon />
        <Text style={styles.breakdownLabel}>{label}</Text>
      </View>
      <Text style={[
        styles.breakdownValue,
        { color: valueColor },
        bold && styles.breakdownValueBold,
      ]}>
        {value}
      </Text>
    </View>
  );
}

/** Thin horizontal divider line matching Figma Vector (stroke #4D4D4D, 0.25 weight) */
function TableDivider() {
  return <View style={styles.tableDivider} />;
}

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function PayRentTransactionScreen() {
  const router = useRouter();
  const { tenancy, upcomingPayment, cashback } = useDashboard();

  // Derive transaction state
  const transactionState: TransactionState = useMemo(() => {
    if (upcomingPayment?.is_overdue) return 'late_payment';
    const hasActiveCashback = upcomingPayment?.cashback_eligible === true;
    return hasActiveCashback ? 'with_cashback' : 'without_cashback';
  }, [upcomingPayment]);

  // Compute amounts
  const baseRent = tenancy?.monthly_rent ?? 30000;
  const maintenance = 2500; // Maintenance amount (not in API yet, hardcoded per Figma)
  const totalRent = baseRent + maintenance;
  const cashbackAmount = cashback?.available_balance ?? 325;
  const cashbackApplied = transactionState === 'with_cashback' ? cashbackAmount : 0;
  const payableRent = totalRent; // Payable Rent row always shows total
  const payNowAmount = totalRent - cashbackApplied;
  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;

  // Format helpers
  const formatINR = (amount: number) => amount.toLocaleString('en-IN');

  // Button text varies by state
  const buttonText = `Pay \u20B9${formatINR(payNowAmount)} now`;

  // Footer message varies by state
  const footerMessage = useMemo(() => {
    switch (transactionState) {
      case 'with_cashback':
        return `Pay by 7 Dec to earn \u20B9 ${formatINR(cashbackAmount)} cashback on this payment`;
      case 'without_cashback':
        return `Finish setup in 28:12:12 to be eligible for   \u20B9${formatINR(cashbackAmount)} cashback on this payment`;
      case 'late_payment':
        return 'Pay before the due date next month to  earn 1% cashback';
    }
  }, [transactionState, cashbackAmount]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push({
      pathname: '/(payment)/initiate',
      params: { method: 'card' },
    } as never);
  }, [router]);

  // Whether cashback is locked (show lock icon)
  const cashbackLocked = transactionState !== 'with_cashback';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* === TOP SECTION: Back arrow + Info Card === */}
          <View style={styles.topSection}>
            {/* Back Arrow - Figma: 32x32 rotated arrow-right icon */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="back-button"
            >
              <BackArrowIcon />
            </TouchableOpacity>

            {/* Info Card - Figma: Frame 1686557240, bg:#202020, radius:12 */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardInner}>
                <InfoCardContent
                  state={transactionState}
                  daysUntilDue={daysUntilDue}
                  cashbackAmount={cashbackAmount}
                />
              </View>
              {/* Divider bar at bottom of card - Figma: Rectangle 135, 268x5, bg:#1A1A1A */}
              <View style={styles.cardDividerBar} />
            </View>
          </View>

          {/* === RENT BREAKDOWN TABLE === */}
          {/* Figma: Frame 2095586361, centered, width:270 */}
          <View style={styles.breakdownContainer}>
            {/* Base Rent */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label="Base rent"
                value={`\u20B9 ${formatINR(baseRent)}`}
              />
            </View>

            <TableDivider />

            {/* Maintenance */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label="Maintenance"
                value={`\u20B9${formatINR(maintenance)}`}
              />
            </View>

            <TableDivider />

            {/* Total Rent */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label="Total Rent"
                value={`\u20B9  ${formatINR(totalRent)}`}
              />
            </View>

            {/* Cashback row */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label={cashbackLocked ? 'Cashback \uD83D\uDD12 ' : 'Cashback '}
                value={`- \u20B9  ${formatINR(cashbackAmount)}`}
                valueColor={FIGMA_COLORS.cashbackDeduction}
              />
            </View>

            <TableDivider />

            {/* Circle cutouts at divider level - Figma: Ellipse 21890 & 21891 */}
            <View style={styles.circleCutoutLeft} />
            <View style={styles.circleCutoutRight} />

            {/* Payable Rent */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label="Payable Rent"
                value={`\u20B9  ${formatINR(payableRent)}`}
                valueColor={FIGMA_COLORS.payableValue}
                bold
              />
            </View>
          </View>
        </ScrollView>

        {/* === FIXED FOOTER === */}
        {/* Figma: Frame 2095586363, x:40, y:688, width:313, column, gap:16 */}
        <View style={styles.footer}>
          <PrimaryButton
            title={buttonText}
            onPress={handlePayNow}
            testID="pay-now-button"
          />
          <Text style={styles.footerMessage}>
            {footerMessage}
          </Text>
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

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: FIGMA_SPACING.bodyGap,                // 40px between top section & breakdown
    paddingBottom: FIGMA_SPACING.bodyPaddingBottom + 140, // 48px + footer height clearance
  },

  // === TOP SECTION ===
  // Figma: Frame 2095586345, column, gap:24, paddingHorizontal:40
  topSection: {
    paddingHorizontal: FIGMA_SPACING.topSectionPaddingH, // 40px
    gap: FIGMA_SPACING.topSectionGap,                     // 24px
  },

  // Back button - Figma: 32x32
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Card - Figma: Frame 1686557240
  // bg: #202020, radius: 12, padding: 24/16, gap: 32, items: center
  infoCard: {
    backgroundColor: FIGMA_COLORS.cardBody,
    borderRadius: 12,
    paddingTop: FIGMA_SPACING.cardPaddingV,     // 24
    paddingBottom: FIGMA_SPACING.cardPaddingV,   // 24
    paddingHorizontal: FIGMA_SPACING.cardPaddingH, // 16
    gap: FIGMA_SPACING.cardInnerGap,              // 32
    alignItems: 'center',
  },

  // Inner content column - gap:16, items:center (from Figma tree)
  // Contains: due label, setup label, pill
  infoCardInner: {
    gap: 8,                  // Figma: Frame 2095586359 gap:8 for text lines
    alignItems: 'center',
  },

  // "Rent due in X days" - Figma: 12px Regular #878787, letterSpacing:-0.24
  dueLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: FIGMA_COLORS.dueLabel,
    textAlign: 'center',
  },

  // "Complete setup..." - Figma: 14px Medium #CBCBCB, letterSpacing:-0.56
  setupLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: FIGMA_COLORS.setupLabel,
    textAlign: 'center',
  },

  // Cashback pill - Figma: Frame 2095586454
  // bg: #1A1A1A, radius: 200, padding: 8/12, gap: 10
  pill: {
    backgroundColor: FIGMA_COLORS.pillBg,
    borderRadius: 200,
    paddingVertical: FIGMA_SPACING.pillPaddingV,  // 8
    paddingHorizontal: FIGMA_SPACING.pillPaddingH, // 12
    marginTop: 8,  // extra spacing between text and pill (from Figma tree gap adjustment)
  },

  // Pill text - Figma: 12px Regular #FF9A6D, lineHeight:20, letterSpacing:0
  pillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.pillText,
    textAlign: 'center',
  },

  // Divider bar at bottom of info card - Figma: Rectangle 135, 268x5, bg:#1A1A1A
  cardDividerBar: {
    width: 268,
    height: 5,
    backgroundColor: FIGMA_COLORS.dividerBar,
    alignSelf: 'center',
  },

  // === RENT BREAKDOWN TABLE ===
  // Figma: Frame 2095586361, x:61, width:270
  // Positioned centrally relative to 393px screen
  breakdownContainer: {
    alignSelf: 'center',
    width: FIGMA_SPACING.breakdownCardWidth, // 270
    position: 'relative',                     // for circle cutouts
  },

  // Each section (one row or group of rows)
  // Figma: each row frame has paddingVertical from the table structure
  breakdownSection: {
    paddingVertical: 16,     // vertical spacing around each row
    paddingHorizontal: FIGMA_SPACING.tableRowPaddingH, // 24
  },

  // Row layout - Figma: row, justifyContent: space-between, items: center
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Label side (hash icon + label text)
  breakdownLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,                  // Figma: gap between hash and label text
  },

  // Label text - Figma: 12px Regular #878787, lineHeight:20, letterSpacing:0
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.tableLabel,
  },

  // Value text - Figma: 14px Regular #CBCBCB, lineHeight:20, letterSpacing:0
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.tableValue,
  },

  // Bold value (Payable Rent) - Figma: 14px SemiBold #DDDDDD
  breakdownValueBold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
  },

  // Table divider line - Figma: Vector, stroke #4D4D4D, weight 0.25
  tableDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.tableDivider,
    marginHorizontal: FIGMA_SPACING.tableRowPaddingH, // 24 inset
  },

  // Circle cutouts at the card notch level
  // Figma: Ellipse 21890 (x:-6, y:256) and Ellipse 21891 (x:263, y:256)
  // 14x14 circles with bg:#131313 (same as screen bg) creating a notch effect
  circleCutoutLeft: {
    position: 'absolute',
    left: -7,
    top: '73%',             // approximate vertical position at the last divider
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.circleCutout,
  },
  circleCutoutRight: {
    position: 'absolute',
    right: -7,
    top: '73%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.circleCutout,
  },

  // === FOOTER ===
  // Figma: Frame 2095586363, x:40, y:688, width:313, column, gap:16
  footer: {
    paddingHorizontal: FIGMA_SPACING.footerX,  // 40
    paddingBottom: 32,
    gap: FIGMA_SPACING.footerGap,               // 16
    alignItems: 'center',
  },

  // Footer message - Figma: 12px Regular #A9A9A9, lineHeight:20, center
  footerMessage: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.footerText,
    textAlign: 'center',
  },
});
