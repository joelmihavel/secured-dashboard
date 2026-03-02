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
 * - Content width: s(313)px (40px padding each side)
 * - All values are exact Figma pixels with design tokens
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Text as RNText, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, FadeOut, withRepeat, withTiming, useSharedValue, useAnimatedStyle, Easing, runOnJS } from 'react-native-reanimated';


import {
  Text,
  Logo,
  PrimaryButton,
  ApplicationTimeline,
  ReferralCodeInput,
  ProgressArc,
  BenefitsCard,
  DottedGridPattern,
  SkeletonLoader,
} from '@/src/components';
import { useWaitlist } from '@/src/hooks';
import { colors } from '@/src/theme/colors';
import { s } from '@/src/theme/scale';
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

    // Card heading: fontSize 28, lineHeight 40, letterSpacing -1
    // From Figma node 160:3054 "Why was I Rejected?" text
    // fontWeight 400 -> PlusJakartaSans-Regular
    cardHeading: {
      fontSize: 28,
      lineHeight: 40,
      letterSpacing: -1,
      fontFamily: 'PlusJakartaSans-Regular',
    },
  },

  // Layout from extraction computedStyles._designTokens
  layout: {
    // Main container padding: paddingLeft/Right 40 → spacing.xxl
    // From node 41:11212
    containerPadding: s(40), // 40

    // Content wrapper width: s(313)
    // From node 41:11213
    contentWidth: s(313),

    // Section gap: 48 → spacing.xxxl
    // From node 41:11212 itemSpacing
    sectionGap: s(48), // 48

    // Content gap: 40 → spacing.xxl
    // From node 41:11213 itemSpacing
    contentGap: s(40), // 40

    // Header section gap: 48 → spacing.xxxl
    // From node 41:11214 itemSpacing
    headerGap: s(48), // 48

    // Text block gap: 16 → spacing.md
    // From node 41:11217 itemSpacing
    textGap: s(16), // 16
  },

  // Card styles from extraction (node 41:11220)
  card: {
    // borderRadius: s(12) → radius.lg
    borderRadius: s(12), // 12

    // paddingTop/Bottom: 24 → spacing.lg
    paddingVertical: s(24), // 24

    // paddingLeft/Right: 16 → spacing.md
    paddingHorizontal: s(16), // 16

    // itemSpacing: 24 → spacing.lg
    gap: s(24), // 24
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
    referralApplied,
    referralError,
    countdownText,
    isLoading,
    isRefetching,
    error,
    joinWaitlist,
    isJoiningWaitlist,
    setReferralCharacter,
    clearReferralCode,
    refresh,
    inviteCodeClaimed,
    claimInviteCode,
    isClaimingInviteCode,
  } = useWaitlist();

  const [isNavigating, setIsNavigating] = useState(false);
  const transitionOpacity = useSharedValue(0);

  // Stable navigation callbacks for runOnJS (Reanimated v4 requires standalone functions, not method refs)
  const navigateToApproved = React.useCallback(() => {
    router.replace('/(waitlist)/approved');
  }, [router]);

  const navigateToAgreement = React.useCallback(() => {
    router.replace('/(agreement)/upload' as never);
  }, [router]);

  // Redirect to approved screen when approved
  useEffect(() => {
    if (viewState === 'approved' && !isNavigating) {
      setIsNavigating(true);
      transitionOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(navigateToApproved)();
        }
      });
    }
  }, [viewState, navigateToApproved, isNavigating, transitionOpacity]);

  // Auto-join waitlist on first visit if no entry exists
  useEffect(() => {
    if (!isLoading && viewState === 'pending' && !status?.position && !isJoiningWaitlist) {
      joinWaitlist();
    }
  }, [isLoading, viewState, status?.position]);

  // Handle AGREEMENT_NOT_CONFIRMED gate error — redirect to agreement upload
  useEffect(() => {
    if (error?.code === 'AGREEMENT_NOT_CONFIRMED' && !isNavigating) {
      setIsNavigating(true);
      transitionOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(navigateToAgreement)();
        }
      });
    }
  }, [error?.code, navigateToAgreement, isNavigating, transitionOpacity]);


  const displayName = (userName ? userName.split(' ')[0] : '') || 'there';
  const submissionDate = status?.submissionDate ?? '';
  const reviewTime = status?.estimatedReviewTime ?? '';
  const membersOnboarded = status?.currentOnboarded ?? 0;
  const totalSlots = status?.totalMemberSlots ?? 150;

  // Scroll state to show/hide the "scroll down" indicator
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    setIsScrolledToBottom(isBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Bouncing animation for scroll indicator
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withRepeat(
      withTiming(10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const transitionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
  }));

  // ============================================
  // LOADING STATE
  // ============================================
  if (viewState === 'loading' || isLoading) {
    return <SkeletonLoader backgroundShape="waitlist" />;
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (viewState === 'error') {
    return (
      <View style={styles.screen}>
        <DottedGridPattern fadeMask={false} />
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
                <RNText style={styles.titleGray}>Oops,</RNText>
                {'\n'}
                <RNText style={{ color: FIGMA.colors.errorRed }}>something{'\n'}went wrong.</RNText>
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
    // Figma 41:11410 statically shows 3 reasons
    const rejectionReasons = [
      "You're renting outside Bangalore",
      "You did not use an invite code.",
      "You rent agreement didn't qualify.",
    ];
    const canReapply = countdownText === '';

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
        <DottedGridPattern fadeMask={false} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.huge,
            paddingBottom: insets.bottom + s(32), // Using 32px to match Figma typical bottom spacing
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refresh} tintColor="#FF9A6D" />
        }
      >
          {/* All content - single wrapper with gap 40 matching Figma */}
          <View style={styles.contentWrapper}>
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
                {/* Figma: #FFFFFF base, "right now" in orange #FF9A6D */}
                <Text style={styles.titleBase}>
                  <RNText style={{ color: FIGMA.colors.textPrimary }}>We can't approve you </RNText>
                  <RNText style={styles.titleAccent}>right now</RNText>
                </Text>

                {/* Subtitle: "We're opening access in batches. Stay tuned." */}
                {/* Figma: #A6A6A6, fontSize 14, lineHeight 20 */}
                <Text style={styles.subtitle}>
                  We're opening access in batches. Stay tuned.
                </Text>
              </View>
            </Animated.View>

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
            >
              <BenefitsCard variant="rejected" />
            </Animated.View>

            {/* Contact Support + Countdown */}
            {/* Figma node 41:11468: gap 16 */}
            <Animated.View
              entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
              style={styles.rejectionActionsContainer}
            >
              <PrimaryButton
                title="Contact support"
                onPress={() => Linking.openURL('mailto:secured@flent.in')}
              />

              {/* Countdown text */}
              {/* Figma node 41:11470 */}
              {!canReapply && (
                <Text style={styles.countdownText}>
                  You can try again in next batch, applications open in {countdownText}
                </Text>
              )}
            </Animated.View>

          </View>
        </ScrollView>

        {/* Scroll Down Indicator */}
        {!isScrolledToBottom && !isNavigating && (
          <TouchableOpacity
            onPress={scrollToBottom}
            activeOpacity={0.7}
            style={styles.scrollIndicatorContainer}
          >
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
              style={animatedStyle}
            >
              <Ionicons name="chevron-down" size={32} color="#FF9A6D" />
            </Animated.View>
          </TouchableOpacity>
        )}

      {/* Transition Overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#131313', pointerEvents: 'none', zIndex: 999 },
          transitionAnimatedStyle
        ]}
      />
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
      {/* Background Pattern + Shape (nodes 237:2761, 41:11207) */}
      {/* DottedPattern renders: dotted image (8% opacity) + background shape (40%) + gradient */}
      <DottedGridPattern fadeMask={false} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + s(64), // 64px gap below status bar per Figma 41:11210
            paddingBottom: insets.bottom + s(32), // Using 32px to match Figma typical bottom spacing
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refresh} tintColor="#FF9A6D" />
        }
      >
        {/* All content - Frame 1686557318 (node 41:11213) */}
        {/* Single wrapper with gap 40 matching Figma structure */}
        <View style={styles.contentWrapper}>
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
              {isPendingLong ? (
                <Text style={styles.titleBase}>
                  <RNText style={styles.titleGray}>We're still</RNText>
                  {'\n'}
                  <RNText style={styles.titleAccent}>setting{'\n'}things up</RNText>
                </Text>
              ) : (
                <Text style={styles.titleBase}>
                  <RNText style={styles.titleGray}>Welcome,</RNText>
                  {'\n'}
                  <RNText style={styles.titleAccent}>{displayName}</RNText>
                </Text>
              )}

              {/* Subtitle - node 41:11219 */}
              {/* computedStyles: fontSize 14, lineHeight 20, color #A6A6A6 */}
              <Text style={styles.subtitle}>
                {isPendingLong
                  ? 'Taking a bit longer than usual. Hang tight!'
                  : 'Your application is in review'}
              </Text>
            </View>
          </Animated.View>

          {/* Timeline Card - Frame 2095586388 (node 41:11220) */}
          {/* computedStyles: borderRadius 12, padding 24/16, gap 24 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
            style={styles.timelineCard}
          >
            <ApplicationTimeline items={timelineItems} />
          </Animated.View>

          {/* Progress & Invite Card - Frame 2095586389 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
            style={styles.inviteCard}
          >
            {/* Progress Arc */}
            <ProgressArc
              current={membersOnboarded}
              total={totalSlots}
            />

            {referralApplied || inviteCodeClaimed ? (
              // Success State - Frame 2095586525 (node 3099:27830)
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>
                  Kudos! You've been bumped up 🤌
                </Text>
              </View>
            ) : (
              <>
                {/* Text Block - Frame 1686557332 */}
                <View style={styles.inviteTextBlock}>
                  <Text style={styles.inviteLabel}>
                    Have an Invite Code?
                  </Text>
                  <Text style={styles.inviteDescription}>
                    Get priority access to the platform if you use a referral code
                  </Text>
                </View>

                {/* Referral Code Input */}
                <ReferralCodeInput
                  code={referralCode}
                  onCharacterChange={setReferralCharacter}
                  error={referralError ?? undefined}
                  disabled={referralApplied}
                />

                {referralError ? (
                  <Text style={styles.referralErrorText}>{referralError}</Text>
                ) : null}

                <View style={styles.buttonGroup}>
                  {referralError ? (
                    // Error State - button instance (node 3099:27758)
                    <PrimaryButton
                      title="Clear Code"
                      onPress={clearReferralCode}
                      showDivider={true}
                    />
                  ) : (
                    // Default State
                    <PrimaryButton
                      title="Enter Invite Code"
                      onPress={claimInviteCode}
                      disabled={false}
                      loading={isClaimingInviteCode}
                      showDivider={true}
                    />
                  )}
                </View>
              </>
            )}
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

      {/* Scroll Down Indicator */}
      {!isScrolledToBottom && !isNavigating && (
        <TouchableOpacity
          onPress={scrollToBottom}
          activeOpacity={0.7}
          style={styles.scrollIndicatorContainer}
        >
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={animatedStyle}
          >
            <Ionicons name="chevron-down" size={32} color="#FF9A6D" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Transition Overlay */}
      <Animated.View 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: '#131313', pointerEvents: 'none', zIndex: 999 },
          transitionAnimatedStyle
        ]} 
      />
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values with design tokens
// ============================================

const styles = StyleSheet.create({
  scrollIndicatorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Root screen - node 41:11206
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.screenBackground,
  },

  scrollView: {
    flex: 1,
  },

  // Main container - maps to Frame 1686557268 (node 41:11212)
  // Figma: paddingH 40, alignItems center
  // The single child 41:11213 uses gap 40 for all sections
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
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
    width: s(32),
    height: s(38),
  },

  // Text block - Frame 2095586319 (node 41:11217)
  // computedStyles: width 313, gap 16
  textBlock: {
    width: FIGMA.layout.contentWidth,
    gap: FIGMA.layout.textGap,
  },

  // Title base - node 41:11218
  // Container text for nested styling with line break
  // Figma: 313x192, fontSize 48, lineHeight 64, letterSpacing -2
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  titleBase: {
    fontFamily: FIGMA.typography.title.fontFamily,
    fontSize: FIGMA.typography.title.fontSize,
    lineHeight: FIGMA.typography.title.lineHeight,
    letterSpacing: FIGMA.typography.title.letterSpacing,
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
  // fontSize 14, lineHeight 20, color #A6A6A6
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  subtitle: {
    fontFamily: FIGMA.typography.subtitle.fontFamily,
    fontSize: FIGMA.typography.subtitle.fontSize,
    lineHeight: FIGMA.typography.subtitle.lineHeight,
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

  // Invite Card - Frame 2095586389 (node 41:11242)
  // Figma: paddingTop 48, paddingBottom 24, paddingH 16, gap 24, alignItems flex-start
  inviteCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingTop: spacing.xxxl, // 48px per Figma
    paddingBottom: FIGMA.card.paddingVertical, // 24px
    paddingHorizontal: FIGMA.card.paddingHorizontal, // 16px
    alignItems: 'flex-start',
    gap: FIGMA.card.gap, // 24px between children
  },

  // Invite text block - Frame 1686557332 (node 41:11250)
  // Figma: alignItems flex-start, justifyContent center, gap 4
  // Contains label (HUG width) + description (FILL width)
  inviteTextBlock: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xxs, // 4px between label and description
  },

  // Invite label - "Have an Invite Code?"
  // Node 41:11251: fontSize 12, lineHeight 20, color #878787
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  inviteLabel: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    color: FIGMA.colors.textLabel,
  },

  // Invite description
  // Node 41:11252: fontSize 14, lineHeight 20, color #CBCBCB, textAlign left, FILL width
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  inviteDescription: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textValue,
    textAlign: 'left',
    width: '100%',
  },

  referralErrorText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.errorRed,
    textAlign: 'center',
    marginTop: 8,
  },

  successBanner: {
    backgroundColor: FIGMA.colors.cardBackgroundSecondary, // #1A1A1A
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
  },
  successBannerText: {
    fontFamily: FIGMA.typography.subtitle.fontFamily, // 'PlusJakartaSans-Regular'
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA.colors.textSecondary, // #A6A6A6
    textAlign: 'center',
  },

  // Button group — Figma node 41:11554: gap 8px between divider and button
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },

  // Divider — 24x2, #4D4D4D, borderRadius 200
  divider: {
    width: FIGMA.divider.width,
    height: FIGMA.divider.height,
    backgroundColor: FIGMA.colors.divider,
    borderRadius: FIGMA.divider.borderRadius,
  },

  // ============================================
  // LOADING STATE STYLES
  // ============================================


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
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: FIGMA.typography.label.fontSize,
    lineHeight: FIGMA.typography.label.lineHeight,
    color: FIGMA.colors.errorRed,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  errorCardDescription: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
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

  // Actions container - node 41:11468, gap 16
  rejectionActionsContainer: {
    gap: spacing.md, // 16
  },

  // Countdown text - node 41:11470
  // Figma: "Next applications open in 28:24:24"
  // Color: #797979, fontSize 14, lineHeight 20
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  countdownText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textHint, // #797979
    textAlign: 'center',
  },

});
