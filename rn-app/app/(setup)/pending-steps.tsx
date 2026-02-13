/**
 * Pending Steps / Personalized Cashback Plan Screen
 * Figma Reference: 1-34236
 *
 * Shows personalized cashback plan after setup:
 * - Welcome message with user name
 * - Cashback rate display
 * - Monthly cashback amount
 * - "Start Earning" CTA
 *
 * Pixel-perfect implementation from Figma analysis:
 * - Title: fontSize 40, lineHeight 56, letterSpacing -1, color #FFFFFF
 * - Card: width 270, height 321, bg #202020, shadow, borderRadius 0
 * - User name: fontSize 14, lineHeight 20, letterSpacing -0.56, color #CBCBCB
 * - Cashback badge: width 58, height 22, bg #FF9A6D, borderRadius 4
 * - Amount: fontSize 16, lineHeight 22.56, letterSpacing -0.64, color #FFFFFF
 * - Button: width 313, height 52, borderColor #FF9A6D, borderRadius 8, shadow
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line, G, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { Screen, Text, Logo } from '@/src/components';
import { useDashboard, useVerificationStatus, deriveSetupProgress } from '@/src/hooks';
import { colors, spacing, radius } from '@/src/theme';

// Figma exact values from 1-34236
const FIGMA = {
  // Background
  backgroundColor: '#131313', // black.700

  // Title
  titleWidth: 269,
  titleHeight: 168,
  titleFontSize: 40,
  titleLineHeight: 56,
  titleLetterSpacing: -1,
  titleColor: '#FFFFFF',

  // Card
  cardWidth: 270,
  cardHeight: 321,
  cardBackgroundColor: '#202020', // black.500
  cardShadowColor: '#000000',
  cardShadowOffsetY: 9,
  cardShadowRadius: 19,

  // Card perforations
  perforationSize: 14,

  // Progress indicator
  progressBarWidth: 58,
  progressBarHeight: 22,
  progressBarColor: '#FF9A6D', // brand.500
  progressBarBorderRadius: 4,

  // Avatar
  avatarSize: 32,

  // User name
  userNameWidth: 145,
  userNameFontSize: 14,
  userNameLineHeight: 19.74,
  userNameLetterSpacing: -0.56,
  userNameColor: '#CBCBCB', // neutral.300

  // Subtitle
  subtitleFontSize: 12,
  subtitleLineHeight: 16.92,
  subtitleLetterSpacing: -0.24,
  subtitleColor: '#878787', // neutral.600

  // Cashback rate
  cashbackBadgeWidth: 58,
  cashbackBadgeHeight: 22,
  cashbackBadgeColor: '#FF9A6D', // brand.500
  cashbackBadgeBorderRadius: 4,
  cashbackBadgeTextColor: '#131313', // black.700

  cashbackRateFontSize: 14,
  cashbackRateLineHeight: 19.74,
  cashbackRateLetterSpacing: -0.56,
  cashbackRateColor: '#CBCBCB', // neutral.300

  // Monthly amount
  amountFontSize: 16,
  amountLineHeight: 22.56,
  amountLetterSpacing: -0.64,
  amountColor: '#FFFFFF',

  // Grid
  gridLineColor: '#4D4D4D', // black.400

  // Swipe indicator
  swipeIndicatorWidth: 24,
  swipeIndicatorHeight: 2,
  swipeIndicatorColor: '#4D4D4D', // black.400
  swipeIndicatorBorderRadius: 200,

  // Button
  buttonWidth: 313,
  buttonHeight: 52,
  buttonBorderColor: '#FF9A6D', // brand.500
  buttonBorderRadius: 8,
  buttonShadowColor: '#995C41',
  buttonShadowOffsetY: 6,
  buttonShadowRadius: 12,
  buttonTextFontSize: 14,
  buttonTextLineHeight: 20,
  buttonTextColor: '#FFFFFF',
} as const;

// Grid background component matching Figma exactly
function GridBackground() {
  return (
    <View style={styles.gridContainer} pointerEvents="none">
      <Svg width="100%" height="300" style={StyleSheet.absoluteFill}>
        <G stroke={FIGMA.gridLineColor} strokeWidth={0.5} opacity={0.3}>
          {/* Horizontal lines */}
          {[...Array(15)].map((_, i) => (
            <Line
              key={`h-${i}`}
              x1="0"
              y1={i * 20}
              x2="100%"
              y2={i * 20}
            />
          ))}
          {/* Vertical lines */}
          {[...Array(20)].map((_, i) => (
            <Line
              key={`v-${i}`}
              x1={i * 20}
              y1="0"
              x2={i * 20}
              y2="300"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

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
  const cashbackRate = 1; // Default 1% cashback rate
  const monthlyRent = tenancy?.monthly_rent ?? 32500;
  const monthlyCashback = Math.floor(monthlyRent * cashbackRate / 100);

  const handleStartEarning = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allVerified) {
      // All steps complete - go to main dashboard
      router.replace('/(main)');
    } else if (pendingSteps.length > 0) {
      // Navigate to the first incomplete step
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
      {/* Background with gradient */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={['transparent', FIGMA.backgroundColor]}
          locations={[0.3, 0.6]}
          style={styles.backgroundGradient}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title - Figma: fontSize 40, lineHeight 56, letterSpacing -1 */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            {allVerified
              ? 'Here is your personalized cashback plan'
              : `${setupProgress.completedCount} of ${setupProgress.totalCount} steps done`}
          </Text>
        </View>

        {/* Grid background behind card */}
        <GridBackground />

        {/* Cashback Card - Figma exact: 270x321, bg #202020, shadow */}
        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Top perforations */}
            <View style={styles.cardPerforations}>
              {[...Array(8)].map((_, i) => (
                <View key={i} style={styles.perforation} />
              ))}
            </View>

            {/* Card header with progress badge */}
            <View style={styles.cardHeader}>
              <View style={styles.progressBadge}>
                <Logo size={16} color={colors.white} />
              </View>
              <Logo size={24} color={colors.white} />
            </View>

            {/* Welcome section - Figma: avatar + name */}
            <View style={styles.welcomeSection}>
              {/* Avatar placeholder */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </View>

              {/* User name - Figma: fontSize 14, lineHeight 19.74, letterSpacing -0.56, color #CBCBCB */}
              <Text style={styles.welcomeName}>{userName}</Text>
              {/* Subtitle - Figma: fontSize 12, lineHeight 16.92, color #878787 */}
              <Text style={styles.welcomeSubtext}>Welcome to Flent Secured</Text>
            </View>

            {/* Cashback section */}
            <View style={styles.cashbackSection}>
              {/* Label */}
              <Text style={styles.cashbackLabel}>Your Cashback Rate</Text>

              {/* Credit Card info */}
              <Text style={styles.creditCardText}>Credit Card XX25</Text>

              {/* Cashback rate row - badge + text */}
              <View style={styles.cashbackRateRow}>
                <View style={styles.cashbackBadge}>
                  <Text style={styles.cashbackBadgeText}>{cashbackRate}% back</Text>
                </View>
                <Text style={styles.cashbackRateText}>on every on-time rent</Text>
              </View>

              {/* Monthly amount - Figma: fontSize 16, lineHeight 22.56, letterSpacing -0.64, color #FFFFFF */}
              <Text style={styles.monthlyAmount}>
                &#x20B9; {monthlyCashback} /month
              </Text>
            </View>

            {/* Side perforations */}
            <View style={styles.cardSidePerforations}>
              <View style={[styles.perforationLarge, styles.perforationLeft]} />
              {[...Array(7)].map((_, i) => (
                <View key={i} style={styles.perforationLarge} />
              ))}
              <View style={[styles.perforationLarge, styles.perforationRight]} />
            </View>
          </View>
        </View>

        {/* Swipe indicator - Figma: 24x2, bg #4D4D4D, borderRadius 200 */}
        <View style={styles.swipeIndicator} />
      </ScrollView>

      {/* Bottom button - Figma: 313x52, borderColor #FF9A6D, shadow */}
      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
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
    backgroundColor: FIGMA.backgroundColor, // #131313
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl, // 40
  },
  // Title: Figma exact - fontSize 40, lineHeight 56, letterSpacing -1
  titleContainer: {
    width: FIGMA.titleWidth, // 269
    marginBottom: spacing.xl, // 32
  },
  titleText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.titleFontSize, // 40
    lineHeight: FIGMA.titleLineHeight, // 56
    letterSpacing: FIGMA.titleLetterSpacing, // -1
    color: FIGMA.titleColor, // #FFFFFF
  },
  // Grid container
  gridContainer: {
    position: 'absolute',
    top: 200,
    left: 0,
    right: 0,
    height: 300,
  },
  // Card container
  cardContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl, // 32
  },
  // Card: Figma exact - 270x321, bg #202020, shadow
  card: {
    width: FIGMA.cardWidth, // 270
    height: FIGMA.cardHeight, // 321
    backgroundColor: FIGMA.cardBackgroundColor, // #202020
    // No border radius per Figma
    overflow: 'hidden',
    // Shadow
    shadowColor: FIGMA.cardShadowColor,
    shadowOffset: { width: 0, height: FIGMA.cardShadowOffsetY },
    shadowOpacity: 1,
    shadowRadius: FIGMA.cardShadowRadius,
    elevation: 10,
  },
  // Top perforations
  cardPerforations: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: spacing.xs,
    marginTop: -FIGMA.perforationSize / 2,
  },
  perforation: {
    width: FIGMA.perforationSize, // 14
    height: FIGMA.perforationSize, // 14
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700], // #131313 - matches background
  },
  // Side perforations
  cardSidePerforations: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perforationLarge: {
    width: FIGMA.perforationSize, // 14
    height: FIGMA.perforationSize, // 14
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700], // #131313
  },
  perforationLeft: {
    marginLeft: -FIGMA.perforationSize / 2,
  },
  perforationRight: {
    marginRight: -FIGMA.perforationSize / 2,
  },
  // Card header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg, // 24
    paddingTop: spacing.md, // 16
    marginBottom: spacing.lg, // 24
  },
  progressBadge: {
    width: FIGMA.progressBarWidth, // 58
    height: FIGMA.progressBarHeight, // 22
    backgroundColor: FIGMA.progressBarColor, // #FF9A6D
    borderRadius: FIGMA.progressBarBorderRadius, // 4
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Welcome section
  welcomeSection: {
    paddingHorizontal: spacing.lg, // 24
    marginBottom: spacing.lg, // 24
  },
  // Avatar: Figma exact - 32x32
  avatar: {
    width: FIGMA.avatarSize, // 32
    height: FIGMA.avatarSize, // 32
    borderRadius: FIGMA.avatarSize / 2,
    backgroundColor: '#E91E63', // Pink avatar background from Figma
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs, // 8
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: colors.white,
  },
  // User name: Figma exact - fontSize 14, lineHeight 19.74, letterSpacing -0.56, color #CBCBCB
  welcomeName: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.userNameFontSize, // 14
    lineHeight: FIGMA.userNameLineHeight, // 19.74
    letterSpacing: FIGMA.userNameLetterSpacing, // -0.56
    color: FIGMA.userNameColor, // #CBCBCB
    marginBottom: spacing.xxs, // 4
  },
  // Subtitle: Figma exact - fontSize 12, lineHeight 16.92, color #878787
  welcomeSubtext: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.subtitleFontSize, // 12
    lineHeight: FIGMA.subtitleLineHeight, // 16.92
    letterSpacing: FIGMA.subtitleLetterSpacing, // -0.24
    color: FIGMA.subtitleColor, // #878787
  },
  // Cashback section
  cashbackSection: {
    paddingHorizontal: spacing.lg, // 24
  },
  cashbackLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.subtitleFontSize, // 12
    lineHeight: FIGMA.subtitleLineHeight, // 16.92
    letterSpacing: FIGMA.subtitleLetterSpacing, // -0.24
    color: FIGMA.subtitleColor, // #878787
    marginBottom: spacing.xxs, // 4
  },
  creditCardText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.cashbackRateFontSize, // 14
    lineHeight: FIGMA.cashbackRateLineHeight, // 19.74
    letterSpacing: FIGMA.cashbackRateLetterSpacing, // -0.56
    color: colors.white,
    marginBottom: spacing.sm, // 12
  },
  // Cashback rate row
  cashbackRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs, // 8
    marginBottom: spacing.sm, // 12
  },
  // Cashback badge: Figma exact - 58x22, bg #FF9A6D, borderRadius 4
  cashbackBadge: {
    width: FIGMA.cashbackBadgeWidth, // 58
    height: FIGMA.cashbackBadgeHeight, // 22
    backgroundColor: FIGMA.cashbackBadgeColor, // #FF9A6D
    borderRadius: FIGMA.cashbackBadgeBorderRadius, // 4
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashbackBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 10,
    color: FIGMA.cashbackBadgeTextColor, // #131313
  },
  // Cashback rate text: Figma exact - fontSize 14, color #CBCBCB
  cashbackRateText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.cashbackRateFontSize, // 14
    lineHeight: FIGMA.cashbackRateLineHeight, // 19.74
    letterSpacing: FIGMA.cashbackRateLetterSpacing, // -0.56
    color: FIGMA.cashbackRateColor, // #CBCBCB
  },
  // Monthly amount: Figma exact - fontSize 16, lineHeight 22.56, letterSpacing -0.64, color #FFFFFF
  monthlyAmount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: FIGMA.amountFontSize, // 16
    lineHeight: FIGMA.amountLineHeight, // 22.56
    letterSpacing: FIGMA.amountLetterSpacing, // -0.64
    color: FIGMA.amountColor, // #FFFFFF
  },
  // Swipe indicator: Figma exact - 24x2, bg #4D4D4D, borderRadius 200
  swipeIndicator: {
    width: FIGMA.swipeIndicatorWidth, // 24
    height: FIGMA.swipeIndicatorHeight, // 2
    backgroundColor: FIGMA.swipeIndicatorColor, // #4D4D4D
    borderRadius: FIGMA.swipeIndicatorBorderRadius, // 200
    alignSelf: 'center',
    marginBottom: spacing.xl, // 32
  },
  // Button container
  buttonContainer: {
    paddingHorizontal: spacing.xxl, // 40
    paddingTop: spacing.md, // 16
    alignItems: 'center',
  },
  // Button: Figma exact - 313x52, borderColor #FF9A6D, borderRadius 8, shadow
  button: {
    width: FIGMA.buttonWidth, // 313
    height: FIGMA.buttonHeight, // 52
    borderWidth: 1,
    borderColor: FIGMA.buttonBorderColor, // #FF9A6D
    borderRadius: FIGMA.buttonBorderRadius, // 8
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: FIGMA.buttonShadowColor, // #995C41
    shadowOffset: { width: 0, height: FIGMA.buttonShadowOffsetY },
    shadowOpacity: 1,
    shadowRadius: FIGMA.buttonShadowRadius,
    elevation: 8,
  },
  // Button text: Figma exact - fontSize 14, lineHeight 20, color #FFFFFF
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.buttonTextFontSize, // 14
    lineHeight: FIGMA.buttonTextLineHeight, // 20
    color: FIGMA.buttonTextColor, // #FFFFFF
  },
});
