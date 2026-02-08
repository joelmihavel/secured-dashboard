/**
 * Profile Payment Screen - Pixel Perfect Implementation
 * Figma Reference: 41-9681 (Pay Rent / Transaction Page --without cashback)
 *
 * EXACT Figma values extracted:
 * - Screen background: #131313 (black.700)
 * - Main layout gap: 40px
 * - Horizontal padding: 40px
 * - Bottom padding: 48px
 * - Top info card: #202020, borderRadius 12, padding 24/16/24/16, gap 32
 * - Breakdown card: #202020, drop shadows
 * - All label texts: textAlign CENTER
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text } from '@/src/components';
import { colors, spacing, radius, gradients } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==============================================
// EXACT FIGMA COLORS FROM 41-9681
// ==============================================
const FIGMA = {
  colors: {
    background: '#131313',        // black.700 - Root background
    cardSurface: '#202020',       // black.500 - Frame 1686557240, Rectangle 136
    cardBackground: '#1A1A1A',    // black.600 - Frame 2095586454 (orange pill)
    textMuted: '#878787',         // neutral.600 - "Rent due in 28 days", labels
    textTertiary: '#CBCBCB',      // neutral.300 - "Complete setup...", values
    accent: '#FF9A6D',            // brand.500 - "350 available to unlock"
    textSubtle: '#A6A6A6',        // black.200 - Icons
    discountRed: '#EF9194',       // Cashback value "- Rs 325"
    textValue: '#DDDDDD',         // neutral.200 - "Rs 32,500" payable
    divider: '#4D4D4D',           // black.400 - Vector dividers
    white: '#FFFFFF',             // Button text
    footerText: '#A9A9A9',        // neutral.500 - Finish setup text
  },
  spacing: {
    gap: 40,
    horizontalPadding: 40,
    bottomPadding: 48,
    cardPaddingV: 24,
    cardPaddingH: 16,
    cardGap: 32,
    sectionGap: 16,
    rowGap: 16,
  },
  radius: {
    card: 12,
    pill: 200,
    button: 8,
  },
} as const;

// ==============================================
// ICONS
// ==============================================

const BackArrow = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M6.66666 16H18.6667"
      stroke={FIGMA.colors.white}
      strokeWidth={2.667}
      strokeLinecap="round"
    />
    <Path
      d="M6.66666 16L14.6667 8"
      stroke={FIGMA.colors.white}
      strokeWidth={2.667}
      strokeLinecap="round"
    />
    <Path
      d="M6.66666 16L14.6667 24"
      stroke={FIGMA.colors.white}
      strokeWidth={2.667}
      strokeLinecap="round"
    />
  </Svg>
);

const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M2.66666 5.33333H13.3333M2.66666 10.6667H13.3333M6.66666 2V14M10.6667 2V14"
      stroke={FIGMA.colors.textSubtle}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ==============================================
// BREAKDOWN ROW COMPONENT
// ==============================================

interface BreakdownRowProps {
  label: string;
  value: string;
  valueColor?: string;
  isBold?: boolean;
}

function BreakdownRow({ label, value, valueColor, isBold }: BreakdownRowProps) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownLabel}>
        <HashIcon />
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <Text
        style={[
          styles.valueText,
          valueColor && { color: valueColor },
          isBold && styles.valueBold,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ==============================================
// DIVIDER COMPONENT
// ==============================================

function Divider() {
  return <View style={styles.divider} />;
}

// ==============================================
// MAIN SCREEN COMPONENT
// ==============================================

export default function ProfilePaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);

  // Demo data matching Figma exactly
  const rentDueDays = 28;
  const cashbackAvailable = 350;
  const baseRent = 30000;
  const maintenance = 2500;
  const totalRent = 32500;
  const cashbackAmount = 325;
  const payableRent = 32500;
  const countdownTime = '28:12:12';

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);
    // Navigate to payment processing
    router.push('/(payment)/processing' as never);
  }, [router]);

  return (
    <Screen testID="profile-payment-screen" style={styles.screen}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + FIGMA.spacing.bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button - 32x32 from Figma */}
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BackArrow />
          </TouchableOpacity>

          {/* Top Info Card - Frame 1686557240 */}
          <View style={styles.infoCard}>
            <View style={styles.infoContent}>
              <View style={styles.infoTextStack}>
                {/* Rent due in 28 days */}
                <Text style={styles.rentDueText}>
                  Rent due in {rentDueDays} days
                </Text>

                {/* Complete setup to unlock 1% cashback */}
                <Text style={styles.setupText}>
                  Complete setup to unlock 1% cashback
                </Text>
              </View>

              {/* Orange Pill - Frame 2095586454 */}
              <View style={styles.cashbackPill}>
                <Text style={styles.cashbackPillText}>
                  {'\u20B9'}{cashbackAvailable} available to unlock
                </Text>
              </View>
            </View>

            {/* Progress Bar - Rectangle 135 */}
            <View style={styles.progressBar} />
          </View>

          {/* Breakdown Card - Rectangle 136 with shadows */}
          <View style={styles.breakdownCard}>
            {/* Top section - Base rent, Maintenance */}
            <View style={styles.breakdownSection}>
              <BreakdownRow
                label="Base rent"
                value={`\u20B9 ${baseRent.toLocaleString('en-IN')}`}
              />
              <Divider />
              <BreakdownRow
                label="Maintenance"
                value={`\u20B9${maintenance.toLocaleString('en-IN')}`}
              />
            </View>

            {/* Bottom section - Total Rent, Cashback, Payable Rent */}
            <View style={styles.breakdownSection}>
              <Divider />
              <BreakdownRow
                label="Total Rent"
                value={`\u20B9 ${totalRent.toLocaleString('en-IN')}`}
              />
              <BreakdownRow
                label="Cashback \uD83D\uDD12"
                value={`- \u20B9 ${cashbackAmount}`}
                valueColor={FIGMA.colors.discountRed}
              />
              <Divider />
              <BreakdownRow
                label="Payable Rent"
                value={`\u20B9 ${payableRent.toLocaleString('en-IN')}`}
                valueColor={FIGMA.colors.textValue}
                isBold
              />
            </View>
          </View>

          {/* Bottom CTA Section - Frame 2095586363 */}
          <View style={styles.ctaSection}>
            {/* Pay Button - button instance */}
            <TouchableOpacity
              style={styles.payButton}
              onPress={handlePayNow}
              disabled={isProcessing}
              accessibilityRole="button"
              accessibilityLabel={`Pay ${payableRent.toLocaleString('en-IN')} rupees now`}
            >
              {/* Button top pill indicator */}
              <View style={styles.buttonPill} />

              {/* Button gradient background */}
              <LinearGradient
                colors={['#202020', '#0d0d0d']}
                locations={[0, 0.9018]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  Pay {'\u20B9'}{payableRent.toLocaleString('en-IN')} now
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Footer Text - centered */}
            <Text style={styles.footerText}>
              Finish setup in{' '}
              <Text style={styles.footerHighlight}>{countdownTime}</Text>
              {' '}to be eligible for{' '}
              {'\u20B9'}{cashbackAvailable} cashback on this payment
            </Text>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

// ==============================================
// STYLES - EXACT FIGMA VALUES
// ==============================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: FIGMA.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: FIGMA.spacing.horizontalPadding,
    gap: FIGMA.spacing.gap,
  },

  // Back Button
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Card - Frame 1686557240
  infoCard: {
    width: 313,
    alignSelf: 'center',
    backgroundColor: FIGMA.colors.cardSurface,
    borderRadius: FIGMA.radius.card,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 32,
  },
  infoContent: {
    alignItems: 'center',
    gap: 16,
  },
  infoTextStack: {
    alignItems: 'center',
    gap: 8,
  },
  rentDueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: FIGMA.colors.textMuted,
    textAlign: 'center',
  },
  setupText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: FIGMA.colors.textTertiary,
    textAlign: 'center',
  },

  // Cashback Pill - Frame 2095586454
  cashbackPill: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.colors.accent,
    textAlign: 'center',
  },

  // Progress Bar - Rectangle 135
  progressBar: {
    width: 268,
    height: 5,
    alignSelf: 'center',
    backgroundColor: FIGMA.colors.cardBackground,
  },

  // Breakdown Card - Rectangle 136
  breakdownCard: {
    width: 270,
    alignSelf: 'center',
    backgroundColor: FIGMA.colors.cardSurface,
    // Drop shadows from Figma
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowRadius: 19,
    shadowOpacity: 0.5,
    elevation: 10,
  },
  breakdownSection: {
    paddingHorizontal: 24,
    gap: FIGMA.spacing.rowGap,
    paddingVertical: FIGMA.spacing.rowGap,
  },

  // Breakdown Row
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.colors.textMuted,
    // Note: textAlign center is handled by parent flex row with justifyContent
  },
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA.colors.textTertiary,
    textAlign: 'right',
  },
  valueBold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600',
  },

  // Divider - Vector 47/48/49
  divider: {
    width: 221,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    backgroundColor: FIGMA.colors.divider,
  },

  // CTA Section - Frame 2095586363
  ctaSection: {
    width: 313,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
  },

  // Pay Button
  payButton: {
    width: 313,
    borderRadius: FIGMA.radius.card,
    overflow: 'hidden',
    alignItems: 'center',
  },
  buttonPill: {
    width: 24,
    height: 2,
    backgroundColor: FIGMA.colors.divider,
    borderRadius: 200,
    marginBottom: 8,
  },
  buttonGradient: {
    width: 313,
    height: 52,
    borderRadius: FIGMA.radius.button,
    borderWidth: 0.1,
    borderColor: FIGMA.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA.colors.white,
    textAlign: 'center',
  },

  // Footer Text
  footerText: {
    width: 261,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA.colors.footerText,
    textAlign: 'center',
  },
  footerHighlight: {
    color: FIGMA.colors.accent,
  },
});
