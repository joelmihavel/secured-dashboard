/**
 * Pending Steps / Personalized Cashback Plan Screen
 * Figma Reference: 1-34236
 *
 * Screen: "onboarding / summary"
 * Blueprint: /buildbot/data/blueprints/1-34236-blueprint.json
 *
 * Figma structure:
 * - Background: #131313 + DottedPattern + Background Shape
 * - Vector 45 (decorative grid lines at y:462)
 * - Title (160:3185): "Here is your personalized cashback plan"
 *   - x:62, y:128, width:269, height:168
 *   - fontSize 40, lineHeight 56, letterSpacing -1, PlusJakartaSans-Medium
 *   - Spans: "Here is your " (0-12) = #A9A9A9, newline (12-13) = #FFFFFF,
 *     "personalized cashback plan" (13-39) = #FF9A6D
 * - Card (1:34308): x:61, y:371, width:270, height:321
 *   - Rectangle 136 bg: #202020, shadow rgba(0,0,0) y:9 blur:19
 *   - Perforations, avatar circle, user name, welcome text
 *   - Cashback rate section, monthly amount
 *   - Flent logo vector (32x38.4, #A9A9A9)
 * - Bottom sheet area (1:34242): white bg, borderRadius 22.79, y:899
 *   - Handle bar (28x4, #D9D9D9, borderRadius 200)
 *   - "Pay Rent" heading, landlord info, credit card, payment button
 * - Start Earning button (I1:34342): 313x52, border #FF9A6D, radius 8
 *   - Text: "Start Earning" -- 14/20, #FFFFFF, PlusJakartaSans-Medium
 *
 * The "Start Earning" button is a floating CTA at bottom.
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Screen, Text, Logo } from '@/src/components';
import { DottedPattern } from '@/src/components/patterns/DottedPattern';
import { useDashboard, useVerificationStatus, deriveSetupProgress } from '@/src/hooks';
import { colors } from '@/src/theme';

// Figma exact values from 1-34236 blueprint
const FIGMA = {
  // Background
  backgroundColor: '#131313',

  // Title (node 160:3185)
  title: {
    x: 62,       // Figma absolute minus screen x
    y: 128,
    width: 269,
    fontSize: 40,
    lineHeight: 56,
    letterSpacing: -1,
    fontFamily: 'PlusJakartaSans-Medium' as const,
    colorWhite: '#FFFFFF',
    colorGray: '#A9A9A9',
    colorAccent: '#FF9A6D',
  },

  // Card (node 1:34308)
  card: {
    width: 270,
    height: 321,
    backgroundColor: '#202020',
    shadowColor: '#000000',
    shadowOffsetY: 9,
    shadowRadius: 19,
  },

  // Perforations
  perforationSize: 14,

  // Avatar (node 1:34329 Ellipse 8)
  avatar: {
    size: 32,
  },

  // User name (1:34331)
  userName: {
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: '#CBCBCB',
    fontFamily: 'PlusJakartaSans-Medium' as const,
  },

  // Welcome subtitle (1:34332)
  subtitle: {
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: '#878787',
    fontFamily: 'PlusJakartaSans-Regular' as const,
  },

  // Cashback rate label (1:34337)
  cashbackLabel: {
    fontSize: 12,
    lineHeight: 16.92,
    letterSpacing: -0.24,
    color: '#878787',
    fontFamily: 'PlusJakartaSans-Regular' as const,
  },

  // Credit card text (1:34338) -- visible:false in Figma
  creditCard: {
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: '#878787',
    fontFamily: 'PlusJakartaSans-Regular' as const,
  },

  // Cashback rate text (1:34340)
  cashbackRate: {
    fontSize: 14,
    lineHeight: 19.74,
    letterSpacing: -0.56,
    color: '#CBCBCB',
    fontFamily: 'PlusJakartaSans-Medium' as const,
    badgeTextColor: '#000000', // "1% back" span color
  },

  // Monthly amount (1:34341)
  amount: {
    fontSize: 16,
    lineHeight: 22.56,
    letterSpacing: -0.64,
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans-SemiBold' as const,
  },

  // Grid lines (Vector 45)
  gridLineColor: '#4D4D4D',
  gridStrokeWidth: 0.3,

  // Logo vector (1:34334) -- #A9A9A9
  logoColor: '#A9A9A9',

  // Button (I1:34342;100:1564)
  button: {
    width: 313,
    height: 52,
    borderColor: '#FF9A6D',
    borderRadius: 8,
    shadowColor: '#995C41',
    shadowOffsetY: 6,
    shadowRadius: 12,
    textFontSize: 14,
    textLineHeight: 20,
    textColor: '#FFFFFF',
    textFontFamily: 'PlusJakartaSans-Medium' as const,
  },
} as const;

// Decorative grid lines from Figma Vector 45 at y:462
function GridBackground() {
  return (
    <View style={gridStyles.container} pointerEvents="none">
      <Svg width="100%" height="235" style={StyleSheet.absoluteFill}>
        <G stroke={FIGMA.gridLineColor} strokeWidth={FIGMA.gridStrokeWidth} opacity={0.5}>
          {/* Vertical line at x ~37 (from vector path) */}
          <Line x1="37" y1="0" x2="37" y2="235" />
          {/* Vertical line at x ~339 */}
          <Line x1="339" y1="0" x2="339" y2="235" />
          {/* Horizontal line at y ~198 */}
          <Line x1="0" y1="198" x2="369" y2="198" />
        </G>
      </Svg>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 462,
    left: 12,
    right: 12,
    height: 235,
  },
});

export default function PendingStepsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, tenancy } = useDashboard();
  const { bankVerified, utilityVerified, landlordApproved, allVerified, pendingSteps } =
    useVerificationStatus();

  // Derive setup progress from real verification status
  const setupProgress = useMemo(
    () =>
      deriveSetupProgress(
        tenancy
          ? tenancy.verification_status
          : null
      ),
    [tenancy]
  );

  // User data for display
  const userName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`
    : 'Rohan Joshi';
  const cashbackRate = 1;
  const monthlyRent = tenancy?.monthly_rent ?? 32500;
  const monthlyCashback = Math.floor(monthlyRent * cashbackRate / 100);

  const handleStartEarning = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allVerified) {
      router.replace('/(main)');
    } else if (pendingSteps.length > 0) {
      const nextStep = pendingSteps[0];
      if (nextStep === 'bank') {
        router.push('/(setup)/add-bank');
      } else if (nextStep === 'utility') {
        router.push('/(setup)/add-utility');
      } else if (nextStep === 'landlord') {
        router.push('/(setup)/invite-landlord');
      } else {
        router.replace('/(main)');
      }
    } else {
      router.replace('/(main)');
    }
  }, [router, allVerified, pendingSteps]);

  return (
    <View style={styles.container} testID="pending-steps-screen">
      {/* Background pattern */}
      <DottedPattern backgroundShape="default" />

      {/* Grid decorative lines */}
      <GridBackground />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title -- Figma 160:3185: x:62, y:128, width:269
            "Here is your " = #A9A9A9 (chars 0-12)
            "personalized cashback plan" = #FF9A6D (chars 13-39)
            fontSize 40, lineHeight 56, letterSpacing -1, PlusJakartaSans-Medium */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            <Text inherit style={styles.titleGray}>Here is your{'\n'}</Text>
            <Text inherit style={styles.titleAccent}>personalized cashback plan</Text>
          </Text>
        </View>

        {/* Cashback Card -- Figma 1:34308: 270x321, bg #202020, shadow */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Top perforations */}
            <View style={styles.cardPerforations}>
              {[...Array(8)].map((_, i) => (
                <View key={i} style={styles.perforation} />
              ))}
            </View>

            {/* Card header with Flent logo */}
            <View style={styles.cardHeader}>
              <Logo size={24} color={colors.white} />
              {/* Flent logo vector on right -- Figma 1:34334: 32x38.4, #A9A9A9 */}
              <View style={styles.logoRight}>
                <Logo size={38} color={FIGMA.logoColor} />
              </View>
            </View>

            {/* Welcome section -- avatar + name + subtitle */}
            <View style={styles.welcomeSection}>
              {/* Avatar -- Figma: Ellipse 8, 32x32 circle with image */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>

              {/* Name and subtitle -- Figma 1:34330: column, gap 8, items center */}
              <View style={styles.nameContainer}>
                {/* User name -- Figma 1:34331: 14/19.74, -0.56, #CBCBCB, Medium */}
                <Text style={styles.welcomeName}>{userName}</Text>
                {/* Subtitle -- Figma 1:34332: 12/16.92, -0.24, #878787, Regular */}
                <Text style={styles.welcomeSubtext}>Welcome to Flent Secured</Text>
              </View>
            </View>

            {/* Cashback section -- Figma 1:34335: column, gap 4, at y:216 */}
            <View style={styles.cashbackSection}>
              {/* Header row -- Figma 1:34336: row, space-between */}
              <View style={styles.cashbackHeaderRow}>
                {/* Label -- Figma 1:34337: 12/16.92, -0.24, #878787 */}
                <Text style={styles.cashbackLabel}>Your Cashback Rate</Text>
                {/* Credit card -- Figma 1:34338: INVISIBLE (visible:false) */}
              </View>

              {/* Rate + amount -- Figma 1:34339: column, gap 12 */}
              <View style={styles.cashbackRateSection}>
                {/* "1% back   on every on-time rent" -- mixed colors */}
                <Text style={styles.cashbackRateText}>
                  <Text inherit style={styles.cashbackBadgeText}>{cashbackRate}% back</Text>
                  {'   '}
                  <Text inherit>on every on-time rent</Text>
                </Text>

                {/* Monthly amount -- Figma 1:34341: 16/22.56, -0.64, #FFFFFF, SemiBold */}
                <Text style={styles.monthlyAmount}>
                  <Text inherit style={styles.amountSymbol}>{'\u20B9'}  </Text>
                  <Text inherit>{monthlyCashback}</Text>
                  <Text inherit style={styles.amountSuffix}> /month</Text>
                </Text>
              </View>
            </View>

            {/* Side perforations at bottom */}
            <View style={styles.cardSidePerforations}>
              <View style={[styles.perforationLarge, styles.perforationLeft]} />
              <View style={[styles.perforationLarge, styles.perforationRight]} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom button -- Figma I1:34342: 313x52, border #FF9A6D, radius 8, shadow */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleStartEarning}
          testID="start-earning-button"
        >
          <Text style={styles.buttonText}>
            {allVerified ? 'Start Earning' : `Continue Setup (${setupProgress.completedCount}/${setupProgress.totalCount})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FIGMA.backgroundColor,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 62, // Figma: title at x:62
  },

  // Title -- Figma 160:3185: width 269, fontSize 40/56, letterSpacing -1
  titleContainer: {
    width: FIGMA.title.width,
    marginBottom: 32,
  },
  titleText: {
    fontFamily: FIGMA.title.fontFamily,
    fontSize: FIGMA.title.fontSize,
    lineHeight: FIGMA.title.lineHeight,
    letterSpacing: FIGMA.title.letterSpacing,
    color: FIGMA.title.colorWhite,
  },
  titleGray: {
    color: FIGMA.title.colorGray,
  },
  titleAccent: {
    color: FIGMA.title.colorAccent,
  },

  // Card container -- centered, Figma card at x:61 (centered in 393px screen)
  cardContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  // Card -- Figma 1:34308: 270x321, bg #202020, shadow
  card: {
    width: FIGMA.card.width,
    height: FIGMA.card.height,
    backgroundColor: FIGMA.card.backgroundColor,
    overflow: 'hidden',
    shadowColor: FIGMA.card.shadowColor,
    shadowOffset: { width: 0, height: FIGMA.card.shadowOffsetY },
    shadowOpacity: 1,
    shadowRadius: FIGMA.card.shadowRadius,
    elevation: 10,
  },

  // Top perforations
  cardPerforations: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
    marginTop: -7,
  },
  perforation: {
    width: FIGMA.perforationSize,
    height: FIGMA.perforationSize,
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: FIGMA.backgroundColor,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 26,
    paddingTop: 16,
    marginBottom: 0,
  },
  logoRight: {
    // Figma 1:34333: x:218, y:36 relative to card
  },

  // Welcome section -- Figma: avatar at left, name block beside it
  welcomeSection: {
    paddingHorizontal: 26,
    paddingTop: 12,
    marginBottom: 24,
  },
  avatar: {
    width: FIGMA.avatar.size,
    height: FIGMA.avatar.size,
    borderRadius: FIGMA.avatar.size / 2,
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: colors.white,
  },
  nameContainer: {
    gap: 8,
    alignItems: 'center',
  },
  // User name -- Figma 1:34331: 14/19.74, -0.56, #CBCBCB, Medium
  welcomeName: {
    fontFamily: FIGMA.userName.fontFamily,
    fontSize: FIGMA.userName.fontSize,
    lineHeight: FIGMA.userName.lineHeight,
    letterSpacing: FIGMA.userName.letterSpacing,
    color: FIGMA.userName.color,
  },
  // Subtitle -- Figma 1:34332: 12/16.92, -0.24, #878787, Regular
  welcomeSubtext: {
    fontFamily: FIGMA.subtitle.fontFamily,
    fontSize: FIGMA.subtitle.fontSize,
    lineHeight: FIGMA.subtitle.lineHeight,
    letterSpacing: FIGMA.subtitle.letterSpacing,
    color: FIGMA.subtitle.color,
  },

  // Cashback section -- Figma 1:34335: x:26, y:216, w:233, column, gap 4
  cashbackSection: {
    paddingHorizontal: 26,
    gap: 4,
  },
  cashbackHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  // Label -- Figma 1:34337: 12/16.92, -0.24, #878787, Regular
  cashbackLabel: {
    fontFamily: FIGMA.cashbackLabel.fontFamily,
    fontSize: FIGMA.cashbackLabel.fontSize,
    lineHeight: FIGMA.cashbackLabel.lineHeight,
    letterSpacing: FIGMA.cashbackLabel.letterSpacing,
    color: FIGMA.cashbackLabel.color,
  },

  // Rate section -- Figma 1:34339: column, gap 12
  cashbackRateSection: {
    gap: 12,
  },
  // Rate text -- Figma 1:34340: 14/19.74, -0.56, #CBCBCB, Medium
  cashbackRateText: {
    fontFamily: FIGMA.cashbackRate.fontFamily,
    fontSize: FIGMA.cashbackRate.fontSize,
    lineHeight: FIGMA.cashbackRate.lineHeight,
    letterSpacing: FIGMA.cashbackRate.letterSpacing,
    color: FIGMA.cashbackRate.color,
  },
  // "1% back" span -- Figma: color #000000
  cashbackBadgeText: {
    color: FIGMA.cashbackRate.badgeTextColor,
  },

  // Monthly amount -- Figma 1:34341: 16/22.56, -0.64, #FFFFFF, SemiBold
  monthlyAmount: {
    fontFamily: FIGMA.amount.fontFamily,
    fontSize: FIGMA.amount.fontSize,
    lineHeight: FIGMA.amount.lineHeight,
    letterSpacing: FIGMA.amount.letterSpacing,
    color: FIGMA.amount.color,
  },
  // Rupee symbol -- Figma span: fontSize 12
  amountSymbol: {
    fontSize: 12,
  },
  // "/month" suffix -- Figma span: fontSize 14
  amountSuffix: {
    fontSize: 14,
  },

  // Side perforations
  cardSidePerforations: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perforationLarge: {
    width: FIGMA.perforationSize,
    height: FIGMA.perforationSize,
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: FIGMA.backgroundColor,
  },
  perforationLeft: {
    marginLeft: -FIGMA.perforationSize / 2,
  },
  perforationRight: {
    marginRight: -FIGMA.perforationSize / 2,
  },

  // Button container -- fixed at bottom
  buttonContainer: {
    paddingHorizontal: 40,
    paddingTop: 16,
    alignItems: 'center',
  },
  // Button -- Figma I1:34342: 313x52, border #FF9A6D 0.1px, radius 8, shadow
  button: {
    width: FIGMA.button.width,
    height: FIGMA.button.height,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FIGMA.button.borderColor,
    borderRadius: FIGMA.button.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow -- Figma: rgba(153,92,65) offset(0,6) blur 12
    shadowColor: FIGMA.button.shadowColor,
    shadowOffset: { width: 0, height: FIGMA.button.shadowOffsetY },
    shadowOpacity: 0.24,
    shadowRadius: FIGMA.button.shadowRadius,
    elevation: 8,
  },
  // Button text -- Figma: 14/20, #FFFFFF, PlusJakartaSans-Medium
  buttonText: {
    fontFamily: FIGMA.button.textFontFamily,
    fontSize: FIGMA.button.textFontSize,
    lineHeight: FIGMA.button.textLineHeight,
    color: FIGMA.button.textColor,
  },
});
