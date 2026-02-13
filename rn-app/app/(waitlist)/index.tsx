/**
 * Waitlist Screen - Multi-State Implementation
 *
 * Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
 * Extracted: 2026-02-01 via extract-figma-ai-enhanced.ts v3.0
 *
 * Figma Node References:
 * - 41:11206: Onboarding / Waitlist Screen (root) — pending state
 * - 41:11410: Onboarding / Waitlist Screen -- Rejected
 * - 41:11506: Onboarding / Waitlist Screen -- more than 24hrs (pending_long)
 *
 * Handles states: loading, pending, pending_long, approved (redirect), rejected, error
 *
 * Design Specs:
 * - Screen: 393x852 (iPhone 14/15 base)
 * - Content width: 313px (40px padding each side)
 * - All values are exact Figma pixels with design tokens
 */

import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import {
  Text,
  Logo,
  PrimaryButton,
  ApplicationTimeline,
  ReferralCodeInput,
  ProgressArc,
  BenefitsCard,
} from '@/src/components';
import { useWaitlist } from '@/src/hooks';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, radius } from '@/src/theme';
import type { TimelineItemData } from '@/src/components/waitlist/ApplicationTimeline';

// ============================================
// FIGMA EXTRACTED CONSTANTS
// Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
// All values mapped to design tokens from extraction
// ============================================

const FIGMA = {
  // Screen dimensions (node 41:11206)
  screen: {
    width: 393,
    height: 852,
  },

  // Colors - exact Figma values with design token mappings
  colors: {
    // Background: #131313 → colors.black[700]
    // VariableID:b68dbac75b766af96ea05be0f99c98d5ce07c915
    screenBackground: colors.black[700],

    // Card background: #202020 → colors.black[500]
    // VariableID:e3cb66c05a62a8680357c6bba79620d8a57e6f10
    cardBackground: colors.black[500],

    // Secondary card background: #1A1A1A → colors.black[600]
    // From rejected state bottom card (node 41:11473)
    cardBackgroundSecondary: colors.black[600],

    // Text primary (white): #FFFFFF → colors.white
    // VariableID:7b6c2ec8706e73ec1a8d406ce15c18dc86b52293
    textPrimary: colors.white,

    // Text accent (orange): #FF9A6D → colors.brand[500]
    // VariableID:0fd77850f1e95a3b4b9c0b7b04fa3f11a2f4a424
    textAccent: colors.brand[500],

    // Text gray (neutral): #A9A9A9 → colors.neutral[500]
    // VariableID:a30255c279da5be0e3281358b6555fa3fed99370
    textGray: colors.neutral[500],

    // Subtitle text: #A6A6A6 (from node 41:11219 computedStyles)
    // Maps to colors.black[200] per design tokens
    textSecondary: colors.black[200],

    // Timeline label text: #878787 (from node 41:11226)
    // VariableID:b87e5e2ea0f2a17d28ed2b2de04e8aed6deacda5
    // Maps to colors.neutral[600] per design tokens
    textLabel: colors.neutral[600],

    // Timeline value text: #CBCBCB (from node 41:11227)
    // VariableID:68f7024b23db647f7fc203b8e5d602ffb6eb0393
    // Maps to colors.neutral[300] per design tokens
    textValue: colors.neutral[300],

    // Timeline indicator: #FF9A6D → colors.brand[500]
    // VariableID:e24126eab8468adae09616b40efaa5e79c21d182
    indicatorActive: colors.brand[500],

    // Timeline stroke: #FFAE8A → colors.brand[400]
    // VariableID:03b88d49cb997581cabaa8587cb4944eb9fbe70e
    indicatorStroke: colors.brand[400],

    // Divider: #4D4D4D → colors.black[400]
    // VariableID:d0771a90f71f9f9162cc0656f42874451acc6ae7
    divider: colors.black[400],

    // Hint text: #797979 → colors.black[300]
    textHint: colors.black[300],

    // Error/rejection red: #E5484D → colors.error.radix
    // From Figma error state design system (Radix red)
    errorRed: colors.error.radix,
  },

  // Typography - mapped to design tokens from extraction _textStyles
  typography: {
    // Welcome title: fontSize 48, lineHeight 64, fontWeight 400, letterSpacing -2
    // _designToken: "typography.h1"
    title: typography.h1,

    // Subtitle: fontSize 14, lineHeight 20, fontWeight 400
    // _designToken: "typography.bodyMd2"
    subtitle: typography.bodyMd2,

    // Timeline labels: fontSize 12, lineHeight 20, fontWeight 400
    // _designToken: "typography.bodySm"
    label: typography.bodySm,

    // Timeline values: fontSize 14, lineHeight 20, fontWeight 400
    // _designToken: "typography.bodyMd2"
    value: typography.bodyMd2,

    // Card heading: fontSize 28, lineHeight 40, fontWeight 400, letterSpacing -1
    // From Figma node 160:3054 "Why was I Rejected?" text
    cardHeading: {
      fontSize: 28,
      lineHeight: 40,
      letterSpacing: -1,
      fontWeight: '400' as const,
    },
  },

  // Layout from extraction computedStyles._designTokens
  layout: {
    // Main container padding: paddingLeft/Right 40 → spacing.xxl
    // From node 41:11212
    containerPadding: spacing.xxl, // 40

    // Content wrapper width: 313
    // From node 41:11213
    contentWidth: 313,

    // Section gap: 48 → spacing.xxxl
    // From node 41:11212 itemSpacing
    sectionGap: spacing.xxxl, // 48

    // Content gap: 40 → spacing.xxl
    // From node 41:11213 itemSpacing
    contentGap: spacing.xxl, // 40

    // Header section gap: 48 → spacing.xxxl
    // From node 41:11214 itemSpacing
    headerGap: spacing.xxxl, // 48

    // Text block gap: 16 → spacing.md
    // From node 41:11217 itemSpacing
    textGap: spacing.md, // 16
  },

  // Card styles from extraction (node 41:11220)
  card: {
    // borderRadius: 12 → radius.lg
    borderRadius: radius.lg, // 12

    // paddingTop/Bottom: 24 → spacing.lg
    paddingVertical: spacing.lg, // 24

    // paddingLeft/Right: 16 → spacing.md
    paddingHorizontal: spacing.md, // 16

    // itemSpacing: 24 → spacing.lg
    gap: spacing.lg, // 24
  },

  // Rejection reasons card (node 160:3051)
  // From Figma: fill=#202020, radius=12, gap=24, padding 32/24
  rejectionCard: {
    borderRadius: radius.lg, // 12
    paddingVertical: 32,
    paddingHorizontal: spacing.lg, // 24
    gap: spacing.lg, // 24
    innerGap: 30, // gap between title section and reasons (node 160:3052)
    titleGap: 10, // gap in title section (node 160:3053)
    reasonsGap: spacing.lg, // 24 between reason items (node 160:3075)
    reasonItemGap: spacing.md, // 16 between icon and text in each reason (node 160:3076)
  },

  // Timeline item layout (from node 41:11221)
  timeline: {
    // Horizontal gap: 8 → spacing.sm
    rowGap: spacing.sm, // 8

    // Vertical gap between label/value: 4 → spacing.xs
    textGap: spacing.xs, // 4

    // Indicator size: 12x12
    indicatorSize: 12,

    // Connector height: 47
    connectorHeight: 47,
  },

  // Divider (from button node)
  divider: {
    width: 24,
    height: 2,
    borderRadius: 200,
  },

  // Animation
  animation: {
    duration: 400,
    stagger: 100,
  },

  // Background decorations from extraction
  // Node 237:2761: image 149 (dotted pattern) - opacity 0.08
  // Node 41:11207: Background Shape (gradient overlay) - opacity 0.4, height 405
  background: {
    patternOpacity: 0.08,
    gradientHeight: 405,
    gradientOpacity: 0.4,
    // Gradient from transparent at 50% to #131313 at 100%
    gradientColors: ['transparent', colors.black[700]] as const,
    gradientLocations: [0.5, 1] as const,
  },
} as const;

// ============================================
// MAIN COMPONENT
// ============================================

export default function WaitlistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    status,
    viewState,
    userName,
    referralCode,
    isReferralComplete,
    isApplyingReferral,
    referralError,
    countdownText,
    isLoading,
    error,
    applyReferral,
    setReferralCharacter,
    refresh,
  } = useWaitlist({ useMock: true, mockState: 'pending' });

  // Redirect to approved screen when approved
  useEffect(() => {
    if (viewState === 'approved') {
      router.replace('/(waitlist)/approved');
    }
  }, [viewState, router]);

  // Data from mock or API
  const displayName = userName || 'Rishabh Agnihotri';
  const submissionDate = status?.submissionDate || '27 Jan 2026';
  const reviewTime = status?.estimatedReviewTime || 'Approximately 24 hrs';
  const membersOnboarded = status?.currentOnboarded || 18;
  const totalSlots = status?.totalMemberSlots || 150;

  // ============================================
  // LOADING STATE
  // ============================================
  if (viewState === 'loading' || isLoading) {
    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={[...FIGMA.background.gradientColors]}
          locations={[...FIGMA.background.gradientLocations]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.794 }}
          style={styles.backgroundGradient}
        />
        <View style={styles.loadingContainer}>
          {/* Skeleton header */}
          <Animated.View
            entering={FadeIn.duration(FIGMA.animation.duration)}
            style={[styles.headerSection, { paddingTop: insets.top + spacing.huge }]}
          >
            <View style={styles.logoContainer}>
              <Logo size={38} color={FIGMA.colors.textPrimary} />
            </View>
            <View style={styles.textBlock}>
              {/* Shimmer placeholder for title */}
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonTitleLine2} />
              {/* Shimmer placeholder for subtitle */}
              <View style={styles.skeletonSubtitle} />
            </View>
          </Animated.View>

          {/* Skeleton card */}
          <Animated.View
            entering={FadeIn.delay(FIGMA.animation.stagger).duration(FIGMA.animation.duration)}
            style={styles.skeletonCard}
          >
            <View style={styles.skeletonCardLine} />
            <View style={styles.skeletonCardLine} />
            <View style={styles.skeletonCardLineShort} />
          </Animated.View>

          {/* Loading indicator */}
          <ActivityIndicator
            size="small"
            color={FIGMA.colors.textAccent}
            style={styles.loadingIndicator}
          />
        </View>
      </View>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (viewState === 'error') {
    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={[...FIGMA.background.gradientColors]}
          locations={[...FIGMA.background.gradientLocations]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.794 }}
          style={styles.backgroundGradient}
        />
        <View style={[styles.errorContainer, { paddingTop: insets.top + spacing.huge }]}>
          <Animated.View
            entering={FadeInDown.duration(FIGMA.animation.duration)}
            style={styles.headerSection}
          >
            <View style={styles.logoContainer}>
              <Logo size={38} color={FIGMA.colors.textPrimary} />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.titleBase}>
                <Text style={styles.titleGray}>Oops,</Text>
                {'\n'}
                <Text style={{ color: FIGMA.colors.errorRed }}>something{'\n'}went wrong.</Text>
              </Text>
              <Text style={styles.subtitle}>
                {error?.message || 'We could not load your waitlist status. Please try again.'}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
            style={styles.errorCardContainer}
          >
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>
                {error?.code || 'UNKNOWN_ERROR'}
              </Text>
              <Text style={styles.errorCardDescription}>
                {error?.message || 'An unexpected error occurred while checking your application status.'}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
            style={styles.retryButtonContainer}
          >
            <PrimaryButton
              title="Try Again"
              onPress={refresh}
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  // ============================================
  // REJECTED STATE
  // Figma: 41-11410 "Onboarding / Waitlist Screen -- Rejected"
  // ============================================
  if (viewState === 'rejected') {
    const rejectionReasons = status?.rejectionReasons || [];
    const canReapply = countdownText === '00:00:00';

    // Timeline for rejected state
    // From Figma nodes 41:11430-41:11444
    const rejectedTimelineItems: TimelineItemData[] = [
      {
        label: 'Application Sent',
        value: `Submitted on ${submissionDate}`,
        status: 'complete',
      },
      {
        label: 'In Review',
        value: reviewTime,
        status: 'complete',
      },
      {
        label: 'Account Status',
        value: 'Rejected',
        status: 'rejected',
      },
    ];

    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={[...FIGMA.background.gradientColors]}
          locations={[...FIGMA.background.gradientLocations]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.794 }}
          style={styles.backgroundGradient}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + spacing.huge,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger).duration(FIGMA.animation.duration)}
            style={styles.headerSection}
          >
            <View style={styles.logoContainer}>
              <Logo size={38} color={FIGMA.colors.textPrimary} />
            </View>

            {/* Text Block - Figma node 41:11421 */}
            <View style={styles.textBlock}>
              {/* Title: "We can't approve you right now" */}
              {/* Figma: #FFFFFF, fontSize 48, lineHeight 64, fontWeight 400 */}
              <Text style={[styles.titleBase, { color: FIGMA.colors.textPrimary }]}>
                We can't approve you right now
              </Text>

              {/* Subtitle: "We're opening access in batches. Stay tuned." */}
              {/* Figma: #A6A6A6, fontSize 14, lineHeight 20 */}
              <Text style={styles.subtitle}>
                We're opening access in batches. Stay tuned.
              </Text>
            </View>
          </Animated.View>

          <View style={styles.contentWrapper}>
            {/* Timeline Card - same structure as pending */}
            {/* Figma node 41:11424: fill=#202020, radius=12, padding 24/16, gap 24 */}
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
              style={styles.timelineCard}
            >
              <ApplicationTimeline items={rejectedTimelineItems} />
            </Animated.View>

            {/* Rejection Reasons Card */}
            {/* Figma node 160:3051: fill=#202020, radius=12, padding 32/24, gap 24 */}
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
              style={styles.rejectionCard}
            >
              <View style={styles.rejectionCardInner}>
                {/* Title section - node 160:3053 */}
                <View style={styles.rejectionTitleSection}>
                  {/* "Why was I Rejected?" */}
                  {/* Figma: #FFFFFF, fontSize 28, lineHeight 40, fontWeight 400 */}
                  <Text style={styles.rejectionTitle}>
                    Why was I Rejected?
                  </Text>
                </View>

                {/* Reasons list - node 160:3075, gap 24 between items */}
                <View style={styles.rejectionReasonsList}>
                  {rejectionReasons.map((reason, index) => (
                    <View key={index} style={styles.rejectionReasonItem}>
                      {/* Bullet indicator */}
                      <View style={styles.rejectionBullet} />
                      {/* Reason text - Figma: #A9A9A9, fontSize 12, lineHeight 20 */}
                      <Text style={styles.rejectionReasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Contact Support + Countdown */}
            {/* Figma node 41:11468: gap 16 */}
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
              style={styles.rejectionActionsContainer}
            >
              <PrimaryButton
                title="Contact support"
                onPress={() => {/* TODO: Open support */}}
              />

              {/* Countdown text */}
              {/* Figma node 41:11470: "Next applications open in 28:24:24" */}
              {/* Color: #797979, fontSize 14, lineHeight 20 */}
              {!canReapply && (
                <Text style={styles.countdownText}>
                  Next applications open in {countdownText}
                </Text>
              )}
            </Animated.View>

            {/* Benefits Card - same as pending state */}
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 5).duration(FIGMA.animation.duration)}
            >
              <BenefitsCard variant="benefits" />
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ============================================
  // PENDING & PENDING_LONG STATES
  // Figma: 41-11206 (pending), 41-11506 (pending_long)
  // pending_long has same layout with different review time text
  // ============================================

  const isPendingLong = viewState === 'pending_long';

  // Timeline Data - from extraction text content
  const timelineItems: TimelineItemData[] = [
    {
      label: 'Application Sent',
      value: `Submitted on ${submissionDate}`,
      status: 'complete',
    },
    {
      label: 'In Review',
      value: isPendingLong
        ? (status?.estimatedReviewTime || 'Approximately 24-48 hrs')
        : reviewTime,
      status: 'active',
    },
    {
      label: 'Account Status',
      value: 'Pending',
      status: 'pending',
    },
  ];

  return (
    <View style={styles.screen}>
      {/* Background Shape - gradient overlay (node 41:11207) */}
      {/* Figma: 481x405, gradient from transparent to #131313 */}
      <LinearGradient
        colors={[...FIGMA.background.gradientColors]}
        locations={[...FIGMA.background.gradientLocations]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.794 }}
        style={styles.backgroundGradient}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.huge, // 64px per Figma (node 41:11206)
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section - Frame 2095586325 (node 41:11214) */}
        <Animated.View
          entering={FadeInDown.delay(FIGMA.animation.stagger).duration(FIGMA.animation.duration)}
          style={styles.headerSection}
        >
          {/* Logo - Frame 1686557264 (node 41:11215) */}
          {/* Extraction: width 32.04, height 38.4 */}
          <View style={styles.logoContainer}>
            <Logo size={38} color={FIGMA.colors.textPrimary} />
          </View>

          {/* Text Block - Frame 2095586319 (node 41:11217) */}
          <View style={styles.textBlock}>
            {/* Welcome Title - node 41:11218 */}
            {/* Text: "Welcome,   Rishabh Agnihotri" - 313x192, single text with nested styles */}
            {/* characterStyleOverrides: 0-9 (37): gray #A9A9A9, 11+ (36): orange #FF9A6D */}
            {/* aiAnalysis: "Nested text styling required. 'Welcome,' is gray, 'Rishabh Agnihotri' is orange." */}
            <Text style={styles.titleBase}>
              <Text style={styles.titleGray}>Welcome,</Text>
              {'\n'}
              <Text style={styles.titleAccent}>{displayName}</Text>
            </Text>

            {/* Subtitle - node 41:11219 */}
            {/* computedStyles: fontSize 14, lineHeight 20, color #A6A6A6 */}
            <Text style={styles.subtitle}>
              {isPendingLong
                ? 'Taking a bit longer than usual. Hang tight!'
                : 'Your application is in review'}
            </Text>
          </View>
        </Animated.View>

        {/* Content Wrapper - gap from layout.contentGap (40) */}
        <View style={styles.contentWrapper}>
          {/* Timeline Card - Frame 2095586388 (node 41:11220) */}
          {/* computedStyles: borderRadius 12, padding 24/16, gap 24 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
            style={styles.timelineCard}
          >
            <ApplicationTimeline items={timelineItems} />
          </Animated.View>

          {/* Pending Long: Additional info card */}
          {isPendingLong && (
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 2.5).duration(FIGMA.animation.duration)}
              style={styles.pendingLongCard}
            >
              {/* Figma: same card styling as timeline card */}
              {/* Info text: #A6A6A6 (textSecondary), fontSize 14 */}
              <Text style={styles.pendingLongTitle}>
                We're experiencing high demand
              </Text>
              <Text style={styles.pendingLongDescription}>
                Your application is still being reviewed. We'll notify you as soon as there's an update. Estimated wait: {status?.estimatedReviewTime || 'Approximately 24-48 hrs'}.
              </Text>
            </Animated.View>
          )}

          {/* Progress & Invite Card - Frame 2095586389 (node 41:11236) */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
            style={styles.inviteCard}
          >
            {/* Progress Arc */}
            <ProgressArc
              current={membersOnboarded}
              total={totalSlots}
            />

            {/* Text Block - Frame 1686557332 (node 41:11250) */}
            {/* Contains label + description with gap: 4 (line 3553) */}
            <View style={styles.inviteTextBlock}>
              {/* Label - "Have an Invite Code?" */}
              {/* From extraction: fontSize 12, lineHeight 20, color #878787 */}
              <Text style={styles.inviteLabel}>
                Have an Invite Code?
              </Text>

              {/* Description */}
              {/* From extraction: fontSize 14, lineHeight 20, color #CBCBCB */}
              <Text style={styles.inviteDescription}>
                Get priority access to the platform if you use a referral code
              </Text>
            </View>

            {/* Referral Code Input - gap 24 from text block (from inviteCard gap) */}
            <ReferralCodeInput
              code={referralCode}
              onCharacterChange={setReferralCharacter}
              error={referralError ?? undefined}
            />

            {/* Hint text - only shown when there's an error */}
            {referralError ? <Text style={styles.hintText}>{referralError}</Text> : null}

            {/* Divider - from button node */}
            <View style={styles.divider} />

            {/* Button */}
            <View style={styles.buttonContainer}>
              <PrimaryButton
                title="Enter Invite Code"
                onPress={applyReferral}
                loading={isApplyingReferral}
              />
            </View>
          </Animated.View>

          {/* Benefits Card - Frame 2095586390 (node 41:11255) */}
          {/* computedStyles: width 313, height 342, borderRadius 12, backgroundColor #202020 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
          >
            <BenefitsCard variant="benefits" />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values with design tokens
// ============================================

const styles = StyleSheet.create({
  // Root screen - node 41:11206
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.screenBackground,
  },

  // Background Shape - node 41:11207
  // Figma: 481x405, centered horizontally, gradient overlay
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: -44, // (481 - 393) / 2 to center
    width: 481,
    height: FIGMA.background.gradientHeight,
    zIndex: 0,
  },

  scrollView: {
    flex: 1,
  },

  // Main container - Frame 1686557268 (node 41:11212)
  // computedStyles: paddingLeft/Right 40, gap 48, alignItems center
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
    gap: FIGMA.layout.sectionGap, // 48px (spacing.xxxl) per Figma
  },

  // Header section - Frame 2095586325 (node 41:11214)
  // computedStyles: width 313, gap 48
  headerSection: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    gap: FIGMA.layout.headerGap,
  },

  // Logo container - Frame 1686557264 (node 41:11215)
  logoContainer: {
    width: 32,
    height: 38,
  },

  // Text block - Frame 2095586319 (node 41:11217)
  // computedStyles: width 313, gap 16
  textBlock: {
    width: FIGMA.layout.contentWidth,
    gap: FIGMA.layout.textGap,
  },

  // Title base - node 41:11218
  // Container text for nested styling with line break
  // Figma: 313x192, fontSize 48, lineHeight 64
  titleBase: {
    ...FIGMA.typography.title,
  },

  // Title gray part - "Welcome,"
  // styleOverrideTable "37": color #A9A9A9 (neutral[500])
  titleGray: {
    color: FIGMA.colors.textGray,
  },

  // Title accent part - name on second line
  // styleOverrideTable "36": color #FF9A6D (brand[500])
  titleAccent: {
    color: FIGMA.colors.textAccent,
  },

  // Subtitle - node 41:11219
  // computedStyles._textStyles: fontSize 14, lineHeight 20, color #A6A6A6
  subtitle: {
    ...FIGMA.typography.subtitle,
    color: FIGMA.colors.textSecondary,
  },

  // Content wrapper - Frame 1686557318 (node 41:11213)
  // computedStyles: width 313, gap 40
  contentWrapper: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    gap: FIGMA.layout.contentGap,
  },

  // Timeline Card - Frame 2095586388 (node 41:11220)
  // computedStyles: borderRadius 12, backgroundColor #202020
  // padding 24/16/24/16, gap 24
  timelineCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingVertical: FIGMA.card.paddingVertical,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
  },

  // Invite Card - Frame 2095586389 (node 41:11236)
  // From Figma extraction line 2901-2921:
  // paddingTop: 48, paddingBottom: 24, paddingHorizontal: 16, gap: 24
  inviteCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingTop: spacing.xxxl, // 48px per Figma (line 2901, 2917)
    paddingBottom: FIGMA.card.paddingVertical, // 24px
    paddingHorizontal: FIGMA.card.paddingHorizontal, // 16px
    alignItems: 'center',
    gap: FIGMA.card.gap, // 24px between children
  },

  // Invite text block - Frame 1686557332 (node 41:11250)
  // From Figma extraction line 3553: itemSpacing: 4
  // This contains label + description with gap: 4
  inviteTextBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xxs, // 4px between label and description (line 3564)
  },

  // Invite label - "Have an Invite Code?"
  // From extraction: fontSize 12, color #878787
  inviteLabel: {
    ...FIGMA.typography.label,
    color: FIGMA.colors.textLabel,
    textAlign: 'center',
  },

  // Invite description
  // From extraction: fontSize 14, color #CBCBCB
  // Node 41:11252: width 281, textAlignHorizontal: LEFT
  inviteDescription: {
    ...FIGMA.typography.value,
    color: FIGMA.colors.textValue,
    textAlign: 'left',
    width: '100%',
  },

  // Hint text
  hintText: {
    ...FIGMA.typography.value,
    color: FIGMA.colors.textHint,
    width: '100%',
    marginTop: spacing.sm,
  },

  // Divider - from extraction
  divider: {
    width: FIGMA.divider.width,
    height: FIGMA.divider.height,
    backgroundColor: FIGMA.colors.divider,
    borderRadius: FIGMA.divider.borderRadius,
    marginTop: spacing.lg, // 24px
    marginBottom: spacing.xs, // 8px (asymmetric per Figma)
  },

  // Button container
  buttonContainer: {
    width: '100%',
  },

  // ============================================
  // LOADING STATE STYLES
  // ============================================

  loadingContainer: {
    flex: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
    gap: FIGMA.layout.contentGap,
  },

  skeletonTitle: {
    width: 200,
    height: 48,
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: radius.sm,
  },

  skeletonTitleLine2: {
    width: 260,
    height: 48,
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: radius.sm,
    marginTop: 4,
  },

  skeletonSubtitle: {
    width: 220,
    height: 20,
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: radius.sm,
    marginTop: FIGMA.layout.textGap,
  },

  skeletonCard: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingVertical: FIGMA.card.paddingVertical,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
    gap: spacing.md,
  },

  skeletonCardLine: {
    width: '80%',
    height: 16,
    backgroundColor: colors.black[400],
    borderRadius: radius.sm,
    opacity: 0.3,
  },

  skeletonCardLineShort: {
    width: '50%',
    height: 16,
    backgroundColor: colors.black[400],
    borderRadius: radius.sm,
    opacity: 0.3,
  },

  loadingIndicator: {
    marginTop: spacing.lg,
  },

  // ============================================
  // ERROR STATE STYLES
  // ============================================

  errorContainer: {
    flex: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
    gap: FIGMA.layout.contentGap,
  },

  errorCardContainer: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
  },

  errorCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingVertical: FIGMA.card.paddingVertical,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
    gap: spacing.sm,
    // Red left border to indicate error
    borderLeftWidth: 3,
    borderLeftColor: FIGMA.colors.errorRed,
  },

  errorCardTitle: {
    ...FIGMA.typography.label,
    color: FIGMA.colors.errorRed,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  errorCardDescription: {
    ...FIGMA.typography.value,
    color: FIGMA.colors.textSecondary,
  },

  retryButtonContainer: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
  },

  // ============================================
  // REJECTED STATE STYLES
  // All values from Figma node 41-11410
  // ============================================

  // Rejection Reasons Card - node 160:3051
  // fill=#202020, radius=12, padding 32/24, gap 24
  rejectionCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.rejectionCard.borderRadius,
    paddingVertical: FIGMA.rejectionCard.paddingVertical, // 32
    paddingHorizontal: FIGMA.rejectionCard.paddingHorizontal, // 24
  },

  // Inner container - node 160:3052, gap 30
  rejectionCardInner: {
    gap: FIGMA.rejectionCard.innerGap, // 30
  },

  // Title section - node 160:3053, gap 10
  rejectionTitleSection: {
    gap: FIGMA.rejectionCard.titleGap, // 10
  },

  // "Why was I Rejected?" - node 160:3054
  // Figma: #FFFFFF, fontSize 28, lineHeight 40, fontWeight 400, letterSpacing -1
  rejectionTitle: {
    ...FIGMA.typography.cardHeading,
    color: FIGMA.colors.textPrimary,
  },

  // Reasons list container - node 160:3075, gap 24
  rejectionReasonsList: {
    gap: FIGMA.rejectionCard.reasonsGap, // 24
  },

  // Each reason item - node 160:3076, gap 16
  rejectionReasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: FIGMA.rejectionCard.reasonItemGap, // 16
  },

  // Bullet indicator - matches timeline indicator style
  rejectionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FIGMA.colors.errorRed, // #E5484D for rejected
    marginTop: 7, // Center with 20px line height text
  },

  // Reason text - node 160:3081, etc.
  // Figma: #A9A9A9, fontSize 12, lineHeight 20, fontWeight 400
  rejectionReasonText: {
    ...FIGMA.typography.label,
    color: FIGMA.colors.textGray, // #A9A9A9
    flex: 1,
  },

  // Actions container - node 41:11468, gap 16
  rejectionActionsContainer: {
    gap: spacing.md, // 16
  },

  // Countdown text - node 41:11470
  // Figma: "Next applications open in 28:24:24"
  // Color: #797979, fontSize 14, lineHeight 20
  countdownText: {
    ...FIGMA.typography.value,
    color: FIGMA.colors.textHint, // #797979
    textAlign: 'center',
  },

  // ============================================
  // PENDING_LONG STATE STYLES
  // Additional card for extended wait messaging
  // ============================================

  // Info card for pending_long - uses same card tokens as timeline card
  pendingLongCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius, // 12
    paddingVertical: FIGMA.card.paddingVertical, // 24
    paddingHorizontal: FIGMA.card.paddingHorizontal, // 16
    gap: spacing.sm, // 12
    // Orange left border to indicate attention
    borderLeftWidth: 3,
    borderLeftColor: FIGMA.colors.textAccent, // #FF9A6D
  },

  // Pending long title
  // Uses same label style as timeline, but with accent color
  pendingLongTitle: {
    ...FIGMA.typography.value, // fontSize 14, lineHeight 20
    color: FIGMA.colors.textAccent, // #FF9A6D
    fontWeight: '500',
  },

  // Pending long description
  // Uses textSecondary for subdued messaging
  pendingLongDescription: {
    ...FIGMA.typography.value, // fontSize 14, lineHeight 20
    color: FIGMA.colors.textSecondary, // #A6A6A6
  },
});
