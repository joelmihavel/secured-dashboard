/**
 * Waitlist Rejected Screen - Dedicated Route
 *
 * Figma Reference: 41-11410 (Onboarding / Waitlist Screen -- Rejected)
 *
 * Structure (from blueprint):
 * - 41:11410 root (393x1333, #131313)
 *   - dotted pattern (8% opacity)
 *   - background shape (gradient overlay)
 *   - content container (gap 40, paddingH 40)
 *     - header section (gap 48): logo + text block
 *     - timeline card (#202020, r12, p24/16)
 *     - rejection reasons card (BenefitsCard variant="rejected")
 *     - actions: contact support + countdown
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Text as RNText, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
  withRepeat,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

import {
  Text,
  Logo,
  PrimaryButton,
  ApplicationTimeline,
  BenefitsCard,
  DottedGridPattern,
} from '@/src/components';
import { useWaitlist } from '@/src/hooks';
import { colors } from '@/src/theme/colors';
import { s } from '@/src/theme/scale';
import { typography } from '@/src/theme/typography';
import { spacing, radius } from '@/src/theme';
import type { TimelineItemData } from '@/src/components/waitlist/ApplicationTimeline';

// ============================================
// FIGMA EXTRACTED CONSTANTS (41-11410)
// ============================================

const FIGMA = {
  colors: {
    screenBackground: colors.black[700],
    cardBackground: colors.black[500],
    textPrimary: colors.white,
    textSecondary: colors.black[200],
    textGray: colors.neutral[500],
    textAccent: colors.brand[500],
    textHint: colors.black[300],
    errorRed: colors.error.radix,
  },

  typography: {
    title: typography.h1,
    subtitle: typography.bodyMd2,
    value: typography.bodyMd2,
  },

  layout: {
    containerPadding: s(40),
    contentWidth: s(313),
    contentGap: s(40),
    headerGap: s(48),
    textGap: s(16),
  },

  card: {
    borderRadius: s(12),
    paddingVertical: s(24),
    paddingHorizontal: s(16),
  },

  animation: {
    duration: 400,
    stagger: 100,
  },
} as const;

// ============================================
// MAIN COMPONENT
// ============================================

export default function WaitlistRejectedScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();

  const {
    status,
    viewState,
    countdownText,
    isRefetching,
    refresh,
  } = useWaitlist();

  // Guard: if admin reverts rejection, redirect back to waitlist
  useEffect(() => {
    if (viewState && viewState !== 'rejected' && viewState !== 'loading') {
      routerRef.current.replace('/(waitlist)' as never);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState]);

  const submissionDate = status?.submissionDate ?? '';
  const reviewTime = status?.estimatedReviewTime ?? '';
  const canReapply = countdownText === '';

  // Timeline for rejected state (Figma nodes 41:11430-41:11444)
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

  // Scroll state
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

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(10, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
            paddingBottom: insets.bottom + s(32),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refresh} tintColor="#FF9A6D" />
        }
      >
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
              <Text style={styles.titleBase}>
                <RNText style={{ color: FIGMA.colors.textPrimary }}>We can't approve you </RNText>
                <RNText style={styles.titleAccent}>right now</RNText>
              </Text>

              <Text style={styles.subtitle}>
                We're opening access in batches. Stay tuned.
              </Text>
            </View>
          </Animated.View>

          {/* Timeline Card - Figma node 41:11424 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 2).duration(FIGMA.animation.duration)}
            style={styles.timelineCard}
          >
            <ApplicationTimeline items={rejectedTimelineItems} />
          </Animated.View>

          {/* Rejection Reasons Card - Figma node 160:3051 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 3).duration(FIGMA.animation.duration)}
          >
            <BenefitsCard variant="rejected" />
          </Animated.View>

          {/* Contact Support + Countdown - Figma node 41:11468 */}
          <Animated.View
            entering={FadeInDown.delay(FIGMA.animation.stagger * 4).duration(FIGMA.animation.duration)}
            style={styles.rejectionActionsContainer}
          >
            <PrimaryButton
              title="Contact support"
              onPress={() => Linking.openURL('mailto:secured@flent.in')}
            />

            {!canReapply && (
              <Text style={styles.countdownText}>
                You can try again in next batch, applications open in {countdownText}
              </Text>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Scroll Down Indicator */}
      {!isScrolledToBottom && (
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
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FIGMA.colors.screenBackground,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.containerPadding,
  },

  contentWrapper: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    gap: FIGMA.layout.contentGap,
  },

  headerSection: {
    width: FIGMA.layout.contentWidth,
    alignSelf: 'center',
    gap: FIGMA.layout.headerGap,
  },

  logoContainer: {
    width: s(32),
    height: s(38),
  },

  textBlock: {
    width: FIGMA.layout.contentWidth,
    gap: FIGMA.layout.textGap,
  },

  titleBase: {
    fontFamily: FIGMA.typography.title.fontFamily,
    fontSize: FIGMA.typography.title.fontSize,
    lineHeight: FIGMA.typography.title.lineHeight,
    letterSpacing: FIGMA.typography.title.letterSpacing,
  },

  titleAccent: {
    color: FIGMA.colors.textAccent,
  },

  subtitle: {
    fontFamily: FIGMA.typography.subtitle.fontFamily,
    fontSize: FIGMA.typography.subtitle.fontSize,
    lineHeight: FIGMA.typography.subtitle.lineHeight,
    color: FIGMA.colors.textSecondary,
  },

  timelineCard: {
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingVertical: FIGMA.card.paddingVertical,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
  },

  rejectionActionsContainer: {
    gap: spacing.md,
  },

  countdownText: {
    fontFamily: FIGMA.typography.value.fontFamily,
    fontSize: FIGMA.typography.value.fontSize,
    lineHeight: FIGMA.typography.value.lineHeight,
    color: FIGMA.colors.textHint,
    textAlign: 'center',
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
});
