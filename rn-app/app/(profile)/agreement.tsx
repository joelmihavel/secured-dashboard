/**
 * Profile Agreement Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-8695 (My Profile / Agreement)
 *
 * Features:
 * - "View your agreement" headline with accent color styling
 * - Agreement details card with rent breakdown
 * - Property and tenant information
 * - Payment breakdown with cashback display
 * - CTA button for payment action
 *
 * Figma-verified values (from extracted-values.json):
 * - Background: #131313 (colors.black[700])
 * - Card surface: #202020 (colors.black[500])
 * - Card background: #1A1A1A (colors.black[600])
 * - Text muted: #878787 (colors.neutral[600])
 * - Text tertiary: #CBCBCB (colors.neutral[300])
 * - Accent: #FF9A6D (colors.brand[500])
 * - Cashback negative: #EF9194
 * - Payable amount: #DDDDDD (colors.neutral[200])
 * - Divider: #4D4D4D (colors.black[400])
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { colors, spacing, radius, gradients } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design System Colors - mapped from theme (verified against Figma 41-8695)
const AGREEMENT_COLORS = {
  background: colors.black[700],         // #131313 - Figma verified
  cardSurface: colors.black[500],        // #202020 - Figma: card bg
  cardBackground: colors.black[600],     // #1A1A1A - Figma: pill/badge bg
  textMuted: colors.neutral[600],        // #878787 - Figma: label text
  textTertiary: colors.neutral[300],     // #CBCBCB - Figma: value text
  accent: colors.brand[500],             // #FF9A6D - Figma: accent/highlight
  textSubtle: colors.black[200],         // #A6A6A6 - Figma: icons
  cashbackNegative: '#EF9194',           // Figma: cashback deduction text
  payableAmount: colors.neutral[200],    // #DDDDDD - Figma: final amount
  divider: colors.black[400],            // #4D4D4D - Figma: dividers
  white: colors.white,                   // #FFFFFF - Figma: button text
  black: colors.black[900],              // #000000 - Figma: shadows
  titleGray: colors.neutral[500],        // #A9A9A9 - Figma: caption text
} as const;

// Figma Typography - exact values
const TYPOGRAPHY = {
  labelSmall: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
  },
  labelMuted: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
  },
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  valueSemibold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  headline: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  setupText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
  },
} as const;

// Figma Spacing Constants
const FIGMA = {
  screenWidth: 393,
  horizontalPadding: 40,
  cardWidth: 313,
  contentWidth: 270,
  innerWidth: 221,
  cardPadding: 24,
  cardPaddingHorizontal: 16,
  sectionGap: 40,
  itemGap: 16,
  smallGap: 8,
  cardRadius: 12,
  pillRadius: 200,
  buttonRadius: 8,
} as const;

interface RentLineItemProps {
  label: string;
  value: string;
  valueColor?: string;
  iconColor?: string;
}

function RentLineItem({ label, value, valueColor = AGREEMENT_COLORS.textTertiary, iconColor = AGREEMENT_COLORS.textSubtle }: RentLineItemProps) {
  return (
    <View style={styles.lineItemRow}>
      <View style={styles.lineItemLabel}>
        <View style={styles.lineItemIcon}>
          <View style={[styles.iconPlaceholder, { backgroundColor: iconColor }]} />
        </View>
        <Text style={[styles.labelText, { color: AGREEMENT_COLORS.textMuted }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.valueText, { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function ProfileAgreementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, tenancy } = useDashboard();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(payment)/initiate' as never);
  }, [router]);

  // Derive rent data from dashboard tenancy and cashback, with sensible defaults
  const rentData = useMemo(() => {
    const monthlyRent = tenancy?.monthly_rent ?? 30000;
    // Maintenance is not in the dashboard API; default to 0
    const maintenance = 0;
    const totalRent = monthlyRent + maintenance;
    const cashbackBalance = 0; // Cashback applied comes from payment initiation, not profile
    const cashback = cashbackBalance;
    const payableRent = totalRent - cashback;

    // Calculate days until due
    const now = new Date();
    const dueDay = tenancy?.rent_due_day ?? 5;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (dueDate < now) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    const daysUntilDue = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Format pay-by date
    const payByDate = `${dueDay} ${dueDate.toLocaleDateString('en-IN', { month: 'short' })}`;

    return {
      dueIn: daysUntilDue,
      setupMessage: 'Complete setup to unlock 1% cashback',
      cashbackApplied: cashback,
      baseRent: monthlyRent,
      maintenance,
      totalRent,
      cashback,
      payableRent,
      payByDate,
    };
  }, [tenancy]);

  return (
    <Screen testID="profile-agreement-screen" padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section - Figma: Frame 2095586345 */}
        <View style={styles.headerSection}>
          {/* Back Button - Figma: Outline Icon Library 32x32 */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={AGREEMENT_COLORS.white} />
          </TouchableOpacity>

          {/* Rent Due Card - Figma: Frame 1686557240 */}
          <View style={styles.rentDueCard}>
            <View style={styles.rentDueContent}>
              <View style={styles.rentDueTextContainer}>
                <Text style={styles.rentDueLabel}>
                  Rent due in {rentData.dueIn} days
                </Text>
                <Text style={styles.setupMessage}>
                  {rentData.setupMessage}
                </Text>
              </View>

              {/* Cashback Applied Pill - Figma: Frame 2095586454 */}
              <View style={styles.cashbackPill}>
                <Text style={styles.cashbackPillText}>
                  {'\u20B9'}{rentData.cashbackApplied} cashback applied
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Main Content Area with decorative elements */}
        <View style={styles.mainContent}>
          {/* Progress Bar - Figma: Rectangle 135 */}
          <View style={styles.progressBar} />

          {/* Rent Breakdown Card - Figma: Frame 2095586361 */}
          <View style={styles.rentBreakdownCard}>
            {/* Base Rent Section */}
            <View style={styles.rentSection}>
              <RentLineItem
                label="Base rent"
                value={`\u20B9 ${rentData.baseRent.toLocaleString('en-IN')}`}
              />
              <Divider />
              <RentLineItem
                label="Maintenance"
                value={`\u20B9${rentData.maintenance.toLocaleString('en-IN')}`}
              />
            </View>

            {/* Total Section */}
            <View style={styles.rentSection}>
              <Divider />
              <RentLineItem
                label="Total Rent"
                value={`\u20B9  ${rentData.totalRent.toLocaleString('en-IN')}`}
              />
              <RentLineItem
                label="Cashback "
                value={`- \u20B9  ${rentData.cashback}`}
                valueColor={AGREEMENT_COLORS.cashbackNegative}
              />
              <Divider />
              <RentLineItem
                label="Payable Rent"
                value={`\u20B9  ${rentData.payableRent.toLocaleString('en-IN')}`}
                valueColor={AGREEMENT_COLORS.payableAmount}
              />
            </View>

            {/* Decorative notch circles - Figma: Ellipse 21890, 21891 */}
            <View style={[styles.notchCircle, styles.notchLeft]} />
            <View style={[styles.notchCircle, styles.notchRight]} />
          </View>

          {/* CTA Section - Figma: Frame 2095586363 */}
          <View style={styles.ctaSection}>
            {/* Pay Button - Figma: button instance */}
            <TouchableOpacity
              onPress={handlePayNow}
              style={styles.payButton}
              accessibilityRole="button"
              accessibilityLabel={`Pay ${rentData.payableRent} now`}
            >
              {/* Button top indicator - Figma: Rectangle 140 */}
              <View style={styles.buttonIndicator} />

              {/* Button gradient background - Figma: Frame 2095586312 */}
              <LinearGradient
                colors={gradients.button.colors}
                locations={[...gradients.button.locations] as [number, number]}
                start={gradients.button.start}
                end={gradients.button.end}
                style={styles.payButtonGradient}
              >
                <Text style={styles.payButtonText}>
                  Pay {'\u20B9'}{rentData.payableRent.toLocaleString('en-IN')} now
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Cashback info text - Figma: 41:8755 */}
            <Text style={styles.cashbackInfoText}>
              Pay by {rentData.payByDate} to earn {'\u20B9'} {rentData.cashbackApplied} cashback on this payment
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: AGREEMENT_COLORS.background,
  },
  scrollContent: {
    paddingTop: 0,
  },

  // Header Section - Figma: Frame 2095586345
  headerSection: {
    width: FIGMA.screenWidth,
    paddingHorizontal: FIGMA.horizontalPadding,
    gap: FIGMA.cardPadding,
  },

  // Back Button - Figma: 32x32 icon container
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Rent Due Card - Figma: Frame 1686557240 (313x174)
  rentDueCard: {
    width: FIGMA.cardWidth,
    height: 174,
    backgroundColor: AGREEMENT_COLORS.cardSurface,
    borderRadius: FIGMA.cardRadius,
    paddingVertical: FIGMA.cardPadding,
    paddingHorizontal: FIGMA.cardPaddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rentDueContent: {
    width: 244,
    alignItems: 'center',
    gap: FIGMA.itemGap,
  },

  rentDueTextContainer: {
    alignItems: 'center',
    gap: FIGMA.smallGap,
  },

  // Figma: 41:8702 - "Rent due in 10 days"
  rentDueLabel: {
    ...TYPOGRAPHY.labelMuted,
    color: AGREEMENT_COLORS.textMuted,
    textAlign: 'center',
  },

  // Figma: 41:8703 - "Complete setup to unlock 1% cashback"
  setupMessage: {
    ...TYPOGRAPHY.setupText,
    color: AGREEMENT_COLORS.textTertiary,
    textAlign: 'center',
  },

  // Figma: Frame 2095586454 (160x36)
  cashbackPill: {
    width: 160,
    height: 36,
    backgroundColor: AGREEMENT_COLORS.cardBackground,
    borderRadius: FIGMA.pillRadius,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  // Figma: 41:8705 - "350 cashback applied"
  cashbackPillText: {
    ...TYPOGRAPHY.labelSmall,
    color: AGREEMENT_COLORS.accent,
    textAlign: 'center',
  },

  // Main Content Area
  mainContent: {
    alignItems: 'center',
    gap: FIGMA.sectionGap,
    paddingBottom: 48,
  },

  // Progress Bar - Figma: Rectangle 135 (268x5)
  progressBar: {
    width: 268,
    height: 5,
    backgroundColor: AGREEMENT_COLORS.cardBackground,
    marginTop: -5, // Overlap with card
  },

  // Rent Breakdown Card - Figma: Frame 2095586361 (270x347)
  rentBreakdownCard: {
    width: FIGMA.contentWidth,
    backgroundColor: AGREEMENT_COLORS.cardSurface,
    shadowColor: AGREEMENT_COLORS.black,
    shadowOffset: { width: 0, height: 9 },
    shadowRadius: 19,
    shadowOpacity: 1,
    elevation: 10,
    paddingVertical: FIGMA.cardPadding,
    position: 'relative',
  },

  rentSection: {
    paddingHorizontal: FIGMA.cardPadding,
    gap: FIGMA.itemGap,
  },

  // Line Item Row - Figma: Frame 1686557326 (221x20)
  lineItemRow: {
    width: FIGMA.innerWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },

  lineItemLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Icon container - Figma: Frame (16x16)
  lineItemIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Icon placeholder - Figma: Vector (10.67x12)
  iconPlaceholder: {
    width: 10.67,
    height: 12,
    borderRadius: 2,
  },

  // Label text - Figma: 12px/400
  labelText: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
  },

  // Value text - Figma: 14px/400
  valueText: {
    ...TYPOGRAPHY.valueText,
    textAlign: 'left',
  },

  // Divider - Figma: Vector 47/48/49 (221x0, border 0.25)
  divider: {
    width: FIGMA.innerWidth,
    height: 1,
    backgroundColor: AGREEMENT_COLORS.divider,
    opacity: 0.25,
  },

  // Notch circles - Figma: Ellipse 21890, 21891 (14x14)
  notchCircle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: AGREEMENT_COLORS.background,
    top: '60%',
  },
  notchLeft: {
    left: -7,
  },
  notchRight: {
    right: -7,
  },

  // CTA Section - Figma: Frame 2095586363 (313x108)
  ctaSection: {
    width: FIGMA.cardWidth,
    alignItems: 'center',
    gap: FIGMA.itemGap,
  },

  // Pay Button Container - Figma: button (313x52)
  payButton: {
    width: FIGMA.cardWidth,
    alignItems: 'center',
    gap: 8,
  },

  // Button indicator - Figma: Rectangle 140 (24x2)
  buttonIndicator: {
    width: 24,
    height: 2,
    backgroundColor: AGREEMENT_COLORS.divider,
    borderRadius: FIGMA.pillRadius,
  },

  // Button gradient - Figma: Frame 2095586312 (313x52)
  payButtonGradient: {
    width: FIGMA.cardWidth,
    height: 52,
    borderRadius: FIGMA.buttonRadius,
    borderWidth: 0.1,
    borderColor: AGREEMENT_COLORS.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },

  // Button text - Figma: Text (110x20)
  payButtonText: {
    ...TYPOGRAPHY.ctaText,
    color: AGREEMENT_COLORS.white,
    textAlign: 'center',
  },

  // Cashback info - Figma: 41:8755 (261x40)
  cashbackInfoText: {
    width: 261,
    ...TYPOGRAPHY.labelSmall,
    color: AGREEMENT_COLORS.titleGray,
    textAlign: 'center',
  },
});
