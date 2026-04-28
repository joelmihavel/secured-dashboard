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
import { View, ScrollView, StyleSheet, RefreshControl, Text as RNText, TouchableOpacity } from 'react-native';
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
  BenefitsCarousel,
  DottedGridPattern,
  SkeletonLoader,
  BottomSheet,
} from '@/src/components';
// WaitlistRelease replaced by ProgressArc — the latter is the codebase's
// Figma-aligned gauge component (see ProgressArc.tsx for node references).
import { useWaitlist, waitlistKeys } from '@/src/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '@/src/theme/colors';
import { s } from '@/src/theme/scale';
import { typography } from '@/src/theme/typography';
import { spacing, radius } from '@/src/theme';
import type { TimelineItemData } from '@/src/components/waitlist/ApplicationTimeline';
import { useUploadStore } from '@/src/stores/upload';

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
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const {
    status,
    viewState,
    userName,
    referralCode,
    isReferralComplete,
    referralApplied,
    referralError,
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
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const transitionOpacity = useSharedValue(0);

  // Spots-bumped count for the "Referral applied" / drawer header subtitle.
  // 4 chars filled ≈ +10 spots, anything else ≈ +5. Source of truth lives
  // server-side, this is a UI hint until the backend exposes the value.
  const referralSpots = referralCode && referralCode.length >= 4 ? 10 : 5;

  // Stable navigation callbacks for runOnJS (Reanimated v4 requires standalone functions, not method refs)
  const navigateToApproved = React.useCallback(() => {
    routerRef.current.replace('/(waitlist)/approved');
  }, []);

  const navigateToAgreement = React.useCallback(() => {
    routerRef.current.replace('/(agreement)/upload' as never);
  }, []);

  const navigateToRejected = React.useCallback(() => {
    routerRef.current.replace('/(waitlist)/rejected');
  }, []);

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

  // Redirect to rejected screen when rejected
  useEffect(() => {
    if (viewState === 'rejected' && !isNavigating) {
      setIsNavigating(true);
      transitionOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(navigateToRejected)();
        }
      });
    }
  }, [viewState, navigateToRejected, isNavigating, transitionOpacity]);

  useEffect(() => {
    if (!status?.requiresReupload || isNavigating) {
      return;
    }

    setIsNavigating(true);
    useUploadStore.getState().prepareForReupload({
      extractionId: status.extractionId,
      fileName: status.fileName,
      errorMessage:
        status.reuploadMessage ??
        'Please upload a valid rental agreement to continue.',
    });

    transitionOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(navigateToAgreement)();
      }
    });
  }, [
    status?.requiresReupload,
    status?.reuploadMessage,
    status?.extractionId,
    status?.fileName,
    navigateToAgreement,
    isNavigating,
    transitionOpacity,
  ]);

  // Journey demo mode no longer routes here — waitlist stage was removed
  // from the journey state machine (mock user has no DB row, so the real
  // API fails and the screen gets stuck). See journeyMode.ts.

  // Auto-join waitlist on first visit if no entry exists.
  // Guard: only fire when status is resolved (not null) and explicitly doesn't require reupload.
  // Without the `status !== undefined` check, stale cached data (where requiresReupload is
  // not yet computed) could trigger join before the reupload redirect effect runs.
  useEffect(() => {
    if (
      !isLoading &&
      status !== undefined &&
      viewState === 'pending' &&
      !status?.position &&
      status?.requiresReupload === false &&
      !isJoiningWaitlist
    ) {
      joinWaitlist();
    }
  }, [isLoading, viewState, status, isJoiningWaitlist, joinWaitlist]);

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

  // Handle NOT_AUTHENTICATED — session expired, redirect to root for re-auth.
  // This can happen when the token expires during the bank verification flow
  // and the SDK's auto-refresh hasn't completed by the time this screen loads.
  useEffect(() => {
    if (error?.code === 'NOT_AUTHENTICATED' && !isNavigating) {
      setIsNavigating(true);
      routerRef.current.replace('/' as never);
    }
  }, [error?.code, isNavigating]);

  // Fall back to null (not literal "there") when we have no name — render
  // collapses the second line in that case rather than showing a placeholder.
  const displayName = userName?.trim() || null;
  const submissionDate = status?.submissionDate ?? '';
  const reviewTime = status?.estimatedReviewTime ?? '';
  const membersOnboarded = status?.currentOnboarded ?? 0;
  const totalSlots = status?.totalMemberSlots ?? 500;

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
              title="Try again"
              onPress={refresh}
            />
          </Animated.View>
        </View>
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
        ? (status?.estimatedReviewTime || 'Approximately 72 hrs')
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

            {/* Text Block — Figma 4651:78274
                "Welcome," in muted grey, name in WHITE (not orange). Subtitle is
                only shown for the long-pending fallback variant — the default
                (welcomed) state has no subtitle per Figma. */}
            <View style={styles.textBlock}>
              {isPendingLong ? (
                <>
                  <Text style={styles.titleBase}>
                    <RNText style={styles.titleGray}>We're still</RNText>
                    {'\n'}
                    <RNText style={styles.titleAccent}>setting{'\n'}things up</RNText>
                  </Text>
                  <Text style={styles.subtitle}>
                    Taking a bit longer than usual. Hang tight!
                  </Text>
                </>
              ) : displayName ? (
                <Text style={styles.titleBase}>
                  <RNText style={styles.titleGray}>Welcome,</RNText>
                  {'\n'}
                  <RNText style={styles.titleWhite}>{displayName}</RNText>
                </Text>
              ) : (
                <Text style={styles.titleBase}>
                  <RNText style={styles.titleGray}>Welcome</RNText>
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Section order per Figma 4651:78274:
              1. Header (above)
              2. Half-circle gauge (WaitlistRelease)
              3. CTA pill / referral applied cards
              4. Timeline status card
              5. "Once you're in" steps
              6. Benefits carousel */}

          {/* Release Progress — Figma 4651:88340 / 4651:78274 (Ellipse 21888).
              Uses the existing ProgressArc component which already encodes the
              exact Figma geometry (278×139 container, 0.8 innerRadius ring,
              strokeLinecap rounded "drop" at the start, etc). */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
          >
            <ProgressArc
              current={membersOnboarded}
              total={totalSlots}
            />
          </Animated.View>

          {/* CTA pill / referral applied cards */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
            style={styles.ctaSection}
          >
            {referralApplied || inviteCodeClaimed ? (
              <>
                <View style={styles.successPill}>
                  <Text style={styles.successPillText}>Referral applied ✅</Text>
                </View>
                <View style={styles.successPill}>
                  <Text style={styles.successPillText}>🎉 You moved up {referralSpots} spots</Text>
                </View>
              </>
            ) : (
              <PrimaryButton
                title="Get early access faster"
                onPress={() => setIsInviteDrawerOpen(true)}
                showDivider={true}
                testID="get-early-access-faster"
              />
            )}
          </Animated.View>

          {/* Timeline Card — moved AFTER the CTA per Figma 4651:78274 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
            style={styles.timelineCard}
          >
            <ApplicationTimeline items={timelineItems} />
          </Animated.View>

          {/* "Once you're in / get started in 3 steps" — Figma 4651:78274.
              When referral applied, heading + step labels shift slightly per Figma 4651:88588. */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 5).duration(FIGMA.animation.duration)}
            style={styles.stepsSection}
          >
            <Text style={styles.stepsHeading}>
              <Text inherit style={styles.stepsHeadingWhite}>Once you&apos;re in</Text>
              {'\n'}
              <Text inherit style={styles.stepsHeadingAccent}>
                {referralApplied || inviteCodeClaimed
                  ? 'keep these things handy'
                  : 'get started in 3 steps'}
              </Text>
            </Text>

            <View style={styles.stepsRow}>
              <StepDot index={1} label="Landlord's bank details and PAN" />
              <View style={styles.stepConnector} />
              <StepDot index={2} label="Home electricity bill" />
              <View style={styles.stepConnector} />
              <StepDot
                index={3}
                label={
                  referralApplied || inviteCodeClaimed
                    ? "Landlord's contact details"
                    : 'Landlord invitation'
                }
              />
            </View>
          </Animated.View>

          {/* Benefits Carousel — Figma 4109:24285 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 5).duration(FIGMA.animation.duration)}
            style={{ marginHorizontal: -FIGMA.layout.containerPadding }}
          >
            <View style={{ paddingLeft: FIGMA.layout.containerPadding }}>
              <BenefitsCarousel />
            </View>
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

      {/* Invite Code Drawer — Figma 4651:98884 / 109194 / 119504 / 129815 */}
      <BottomSheet
        visible={isInviteDrawerOpen}
        onClose={() => setIsInviteDrawerOpen(false)}
        paddingHorizontal={0}
      >
        <View style={styles.drawerContent}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>
              <Text inherit style={styles.drawerTitleWhite}>Use a</Text>
              {'\n'}
              <Text inherit style={styles.drawerTitleAccent}>Referral Code</Text>
            </Text>
            <Text style={styles.drawerSubtitle}>(+{referralSpots} spots)</Text>
          </View>

          <View style={styles.drawerDivider} />

          <View style={styles.drawerBody}>
            <Text style={styles.drawerLabel}>Have an Invite Code?</Text>
            <Text style={styles.drawerDescription}>
              Get priority access to the platform if you use a referral code
            </Text>

            {referralApplied || inviteCodeClaimed ? (
              // Valid code applied — Figma 4651:119504
              <View style={styles.drawerSuccessBanner}>
                <Text style={styles.drawerSuccessText}>
                  🤌 Kudos. You&apos;re among Secured&apos;s first members
                </Text>
              </View>
            ) : (
              <ReferralCodeInput
                code={referralCode}
                onCharacterChange={setReferralCharacter}
                error={referralError ?? undefined}
                disabled={referralApplied}
              />
            )}
          </View>

          <View style={styles.drawerCtaWrap}>
            {referralApplied || inviteCodeClaimed ? (
              // Valid: only "Go Back" — Figma 4651:119504
              <PrimaryButton
                title="Go Back"
                onPress={() => setIsInviteDrawerOpen(false)}
                showDivider
                testID="invite-drawer-goback"
              />
            ) : referralError ? (
              // Invalid code — Figma 4651:129815
              <PrimaryButton
                title="Clear Code"
                onPress={clearReferralCode}
                showDivider
                testID="invite-drawer-clear"
              />
            ) : (
              <PrimaryButton
                title="Enter Invite Code"
                onPress={claimInviteCode}
                disabled={!isReferralComplete}
                loading={isClaimingInviteCode}
                showDivider
                testID="invite-drawer-submit"
              />
            )}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

/** "Once you're in" step dot — orange filled when index === 1, hollow otherwise. */
function StepDot({ index, label }: { index: number; label: string }) {
  const isFirst = index === 1;
  return (
    <View style={styles.stepDotWrap}>
      <View style={[styles.stepDot, isFirst ? styles.stepDotActive : styles.stepDotInactive]} />
      <Text style={styles.stepLabel}>{label}</Text>
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
  // Title — Figma 4651:78274 uses h4 (28/36 -1) for the welcomed state, not the
  // big h1. Long-pending state still uses larger style via the FIGMA token below.
  titleBase: {
    fontFamily: FIGMA.typography.title.fontFamily,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.6,
  },

  // Title gray part - "Welcome,"
  // styleOverrideTable "37": color #A9A9A9 (neutral[500])
  titleGray: {
    color: FIGMA.colors.textGray,
  },

  // Title accent part — orange. Used by the "We're still setting things up"
  // long-pending heading. The default "Welcome, {name}" uses titleWhite per Figma.
  titleAccent: {
    color: FIGMA.colors.textAccent,
  },

  // Title white — name on second line of the welcomed heading. Figma 4651:78274
  // shows the user's name in pure white, not orange.
  titleWhite: {
    color: colors.white,
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
    alignItems: 'center',
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
    textAlign: 'center',
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

  // CTA section — Figma 4651:78274 / 88588
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  successPill: {
    width: '100%',
    backgroundColor: FIGMA.colors.cardBackgroundSecondary, // #1A1A1A
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  successPillText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA.colors.textSecondary,
    textAlign: 'center',
  },

  // "Once you're in" steps section — Figma 4651:78274
  stepsSection: {
    width: '100%',
    gap: 24,
    paddingTop: 8,
  },
  stepsHeading: {
    fontFamily: FIGMA.typography.subtitle.fontFamily,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.6,
  },
  stepsHeadingWhite: { color: colors.white },
  stepsHeadingAccent: { color: colors.brand[500] },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  stepDotWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  // Active step — solid orange fill with matching border
  stepDotActive: {
    backgroundColor: colors.brand[500],
    borderColor: colors.brand[500],
  },
  // Inactive — hollow circle with orange ring per Figma 4651:78274
  // (was grey ring; the brand-orange ring is what makes the connector dots
  //  feel like part of the accent journey).
  stepDotInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.brand[500],
  },
  stepLabel: {
    fontFamily: FIGMA.typography.label.fontFamily,
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  stepConnector: {
    flex: 0.6,
    height: 1,
    backgroundColor: colors.black[400],
    marginTop: 5,
  },

  // Invite Code Drawer — Figma 4651:98884 / 109194 / 119504 / 129815
  drawerContent: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 30,
  },
  drawerHeader: {
    paddingHorizontal: 24,
    gap: 4,
  },
  drawerTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -1,
  },
  drawerTitleWhite: { color: colors.white },
  drawerTitleAccent: { color: colors.brand[500] },
  drawerSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.neutral[500],
    marginTop: 4,
  },
  drawerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.black[400],
    marginHorizontal: 24,
  },
  drawerBody: {
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  drawerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[600],
    alignSelf: 'flex-start',
  },
  drawerDescription: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
    alignSelf: 'flex-start',
  },
  drawerSuccessBanner: {
    width: '100%',
    backgroundColor: colors.black[600],
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  drawerSuccessText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  drawerCtaWrap: {
    paddingHorizontal: 24,
    alignItems: 'center',
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

  // "Once you're in / keep these things handy" — Figma 4109:24272
  stepsTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: s(28),
    lineHeight: s(40),
    letterSpacing: -1,
  },
  stepsTitleGray: {
    color: '#A9A9A9',
  },
  stepsTitleAccent: {
    color: '#FF9A6D',
  },

  // 3-step indicator — matches TransactionProgressBar dot-line-dot pattern
  stepsWrapper: {
    alignSelf: 'stretch',
    gap: 8,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  stepsTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepsDot: {
    width: 11,
    height: 11,
    borderRadius: 4,
    backgroundColor: '#202020', // Figma: fill #202020
    borderWidth: 1,
    borderColor: '#FF9A6D', // Figma: stroke #FF9A6D, INSIDE
  },
  stepsConnector: {
    flex: 1,
    height: 1,
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D connector
  },
});
