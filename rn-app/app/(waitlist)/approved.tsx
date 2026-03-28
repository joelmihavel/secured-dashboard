/**
 * Waitlist Approved Screen - Pixel Perfect Figma Implementation
 *
 * Figma Reference: 41-11313 (Waitlist Screen -- Accepted)
 *
 * Structure (from blueprint):
 * - 41:11313 root (393x1333, #131313)
 *   - 237:2758 dotted pattern (image 149, 8% opacity)
 *   - 41:11314 background shape (481x405, gradient overlay)
 *   - 41:11317 main frame (gap 64)
 *     - 41:11318 status bar (53px)
 *     - 41:11319 content container (gap 48, paddingH 40, alignItems center)
 *       - 41:11320 inner content (313w, gap 40)
 *         - 41:11321 header section (gap 48): logo + text block
 *         - 41:11327 timeline card (#202020, r12, p24/16)
 *         - 160:3027 benefits card
 *         - 41:11372 button wrapper (gap 16)
 *   - 41:11375 bottom sheet section (separate)
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  FadeInDown,
  FadeIn,
  FadeOut,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

import {
  Text,
  Logo,
  PrimaryButton,
  ApplicationTimeline,
  BenefitsCard,
  DottedGridPattern,
} from '@/src/components';
import { useWaitlist } from '@/src/hooks';
import { isJourneyMode, advanceJourneyStage } from '@/src/review/journeyMode';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing, radius } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';
import type { TimelineItemData } from '@/src/components/waitlist/ApplicationTimeline';

// ============================================
// FIGMA EXTRACTED CONSTANTS (41-11313)
// All values from blueprint, no fontWeight - use fontFamily per builder rules
// ============================================

const FIGMA = {
  colors: {
    screenBackground: colors.black[700],      // #131313
    cardBackground: colors.black[500],         // #202020
    textPrimary: colors.white,                 // #FFFFFF
    textSecondary: colors.black[200],          // #A6A6A6
    textGray: colors.neutral[500],             // #A9A9A9
    textAccent: colors.brand[500],             // #FF9A6D
    divider: colors.black[400],                // #4D4D4D
  },

  typography: {
    // Title: fontSize 48, lineHeight 64, letterSpacing -2
    // fontWeight 400 -> PlusJakartaSans-Regular
    title: typography.h1,

    // Subtitle: fontSize 14, lineHeight 20
    // fontWeight 400 -> PlusJakartaSans-Regular
    subtitle: typography.bodyMd2,
  },

  layout: {
    // Content padding (node 41:11319) — scaled
    containerPadding: s(40),

    // Content width (node 41:11320) — scaled
    contentWidth: s(313),

    // Gap between all sections in 41:11320 — scaled
    contentGap: sv(40),

    // Header gap (node 41:11321) — scaled
    headerGap: sv(48),

    // Text block gap (node 41:11324) — scaled
    textGap: sv(16),
  },

  card: {
    borderRadius: radius.md, // 12
    paddingVertical: sv(24),
    paddingHorizontal: s(16),
  },

  divider: {
    width: s(24),
    height: 2,
    borderRadius: 200,
  },

  animation: {
    duration: 400,
    stagger: 100,
  },
} as const;

// ============================================
// MAIN COMPONENT
// ============================================

export default function WaitlistApprovedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    userName,
    showConfetti,
    viewState,
    status,
  } = useWaitlist();

  // Guard: if admin reverts approval, redirect back to waitlist
  useEffect(() => {
    if (viewState && viewState !== 'approved' && viewState !== 'loading') {
      router.replace('/(waitlist)' as never);
    }
  }, [viewState, router]);

  const displayName = userName || 'there';
  const submissionDate = status?.submissionDate ?? '';
  const reviewTime = status?.estimatedReviewTime ?? '';

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
  const scrollIndicatorTranslateY = useSharedValue(0);

  useEffect(() => {
    scrollIndicatorTranslateY.value = withRepeat(
      withTiming(10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [scrollIndicatorTranslateY]);

  const scrollIndicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollIndicatorTranslateY.value }],
  }));

  // Animation values
  const confettiRef = useRef<LottieView>(null);
  const headerScale = useSharedValue(0.8);
  const headerOpacity = useSharedValue(0);
  const timelineTranslate = useSharedValue(30);
  const timelineOpacity = useSharedValue(0);

  // Build timeline items for accepted state - all complete with green dots
  const timelineItems: TimelineItemData[] = [
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
      value: 'Accepted',
      status: 'accepted',
    },
  ];

  // Trigger celebration on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    headerScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    headerOpacity.value = withTiming(1, { duration: FIGMA.animation.duration });

    timelineTranslate.value = withDelay(200, withSpring(0, { damping: 15 }));
    timelineOpacity.value = withDelay(200, withTiming(1, { duration: FIGMA.animation.duration }));

    setTimeout(() => {
      confettiRef.current?.play();
    }, 300);
  }, []);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
    opacity: headerOpacity.value,
  }));

  const timelineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: timelineTranslate.value }],
    opacity: timelineOpacity.value,
  }));

  const [isNavigating, setIsNavigating] = useState(false);
  const transitionOpacity = useSharedValue(0);

  const transitionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: transitionOpacity.value,
  }));

  // Stable navigation callback for runOnJS (Reanimated v4 requires standalone functions, not method refs)
  const navigateToSetup = useCallback(() => {
    router.replace('/(setup)/add-bank' as never);
  }, [router]);

  // Handle "Step Inside" button
  const handleStepInside = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (isJourneyMode()) advanceJourneyStage(); // setup → active (next stage)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    transitionOpacity.value = withTiming(1, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(navigateToSetup)();
      }
    });
  }, [navigateToSetup, isNavigating, transitionOpacity]);

  return (
    <View style={styles.screen}>
      {/* Background Pattern + Shape (nodes 237:2758, 41:11314) */}
      <DottedGridPattern fadeMask={false} />

      {/* Confetti Animation Overlay */}
      {showConfetti && (
        <LottieView
          ref={confettiRef}
          source={require('@/assets/animations/confetti.json')}
          style={styles.confetti}
          autoPlay={false}
          loop={false}
        />
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.huge, // matches Figma status bar + gap
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* All content - Frame 1686557318 (node 41:11320) */}
        {/* Single wrapper with gap 40 matching Figma structure */}
        <View style={styles.contentWrapper}>
          {/* Header Section - Frame 2095586325 (node 41:11321) */}
          {/* gap 48 between logo and text block */}
          <Animated.View style={[styles.headerSection, headerAnimatedStyle]}>
            {/* Logo - Frame 1686557264 (node 41:11322) */}
            <View style={styles.logoContainer}>
              <Logo size={38} color={FIGMA.colors.textPrimary} />
            </View>

            {/* Text Block - node 41:11324, gap 16 */}
            <View style={styles.textBlock}>
              {/* Title: "{name}," in gray, "you're all set." in orange */}
              {/* Node 41:11325: fontSize 48, lineHeight 64, letterSpacing -2 */}
              {/* Spans: 0-17 #A9A9A9, 19+ #FF9A6D */}
              <Text style={styles.titleBase}>
                <RNText style={styles.titleGray}>{displayName},</RNText>
                {'\n'}
                <RNText style={styles.titleAccent}>you're all set.</RNText>
              </Text>

              {/* Subtitle - node 41:11326 */}
              {/* fontSize 14, lineHeight 20, color #A6A6A6 */}
              <Text style={styles.subtitle}>
                Welcome to the right side of renting.
              </Text>
            </View>
          </Animated.View>

          {/* Timeline Card - Frame 2095586388 (node 41:11327) */}
          {/* #202020, borderRadius 12, padding 24/16, gap 24 */}
          <Animated.View style={[styles.timelineCard, timelineAnimatedStyle]}>
            <ApplicationTimeline
              items={timelineItems}
              testID="approved-timeline"
            />
          </Animated.View>

          {/* Benefits Card - node 160:3027 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
          >
            <BenefitsCard
              variant="benefits"
              testID="approved-benefits"
            />
          </Animated.View>

          {/* Button Section - Frame 2095586333 (node 41:11372) */}
          {/* gap 16 between children, contains button instance */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
            style={styles.buttonWrapper}
          >
            <View style={styles.buttonDivider} />
            <PrimaryButton
              title="Step inside"
              onPress={handleStepInside}
              loading={isNavigating}
              testID="step-inside-button"
            />
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
            style={scrollIndicatorAnimatedStyle}
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
// STYLES - Exact Figma values, no fontWeight
// ============================================

const styles = StyleSheet.create({
  // Root screen - node 41:11313
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.screenBackground,
  },

  scrollIndicatorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  confetti: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    pointerEvents: 'none',
  },

  scrollView: {
    flex: 1,
  },

  // Container - Frame 1686557268 (node 41:11319)
  // Figma: paddingH 40, alignItems center
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
  },

  // Content wrapper - Frame 1686557318 (node 41:11320)
  // Figma: 313w, column, gap 40
  contentWrapper: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    gap: FIGMA.layout.contentGap,
  },

  // Header section - Frame 2095586325 (node 41:11321)
  // Figma: 313w, column, gap 48
  headerSection: {
    width: FIGMA.layout.contentWidth,
    gap: FIGMA.layout.headerGap,
  },

  // Logo container - Frame 1686557264 (node 41:11322)
  logoContainer: {
    width: s(32),
    height: sv(38),
  },

  // Text block - node 41:11324, gap 16
  textBlock: {
    width: FIGMA.layout.contentWidth,
    gap: FIGMA.layout.textGap,
  },

  // Title base - node 41:11325
  // fontSize 48, lineHeight 64, letterSpacing -2
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  titleBase: {
    fontFamily: FIGMA.typography.title.fontFamily,
    fontSize: FIGMA.typography.title.fontSize,
    lineHeight: FIGMA.typography.title.lineHeight,
    letterSpacing: FIGMA.typography.title.letterSpacing,
  },

  // Title gray part - "{name},"
  // Spans 0-17: color #A9A9A9
  titleGray: {
    color: FIGMA.colors.textGray,
  },

  // Title accent part - "you're all set."
  // Spans 19+: color #FF9A6D
  titleAccent: {
    color: FIGMA.colors.textAccent,
  },

  // Subtitle - node 41:11326
  // fontSize 14, lineHeight 20, color #A6A6A6
  // fontWeight 400 -> PlusJakartaSans-Regular (no RN fontWeight)
  subtitle: {
    fontFamily: FIGMA.typography.subtitle.fontFamily,
    fontSize: FIGMA.typography.subtitle.fontSize,
    lineHeight: FIGMA.typography.subtitle.lineHeight,
    color: FIGMA.colors.textSecondary,
  },

  // Timeline card - Frame 2095586388 (node 41:11327)
  // #202020, borderRadius 12, padding 24/16
  timelineCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingVertical: FIGMA.card.paddingVertical,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
  },

  // Button wrapper - Frame 2095586333 (node 41:11372)
  // Figma: column, gap 16, alignItems flex-start, FILL width
  // Contains divider (inside button component) + button
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs, // 8px gap between divider and button per button component
  },

  // Divider inside button group
  // Node I41:11373;137:37: 24x2, #4D4D4D, borderRadius 200
  buttonDivider: {
    width: FIGMA.divider.width,
    height: FIGMA.divider.height,
    backgroundColor: FIGMA.colors.divider,
    borderRadius: FIGMA.divider.borderRadius,
  },
});
