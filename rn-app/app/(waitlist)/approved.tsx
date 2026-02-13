/**
 * Waitlist Approved Screen - Pixel Perfect Figma Implementation
 *
 * Figma Reference: 41-11313 (Waitlist Screen -- Accepted)
 *
 * Celebration screen when user gets off waitlist.
 * Shows success state with timeline completion and "Step Inside" CTA.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

import {
  Text,
  Logo,
  PrimaryButton,
  ApplicationTimeline,
  BenefitsCard,
} from '@/src/components';
import { useWaitlist } from '@/src/hooks';
import { spacing, fontFamily } from '@/src/theme';
import type { TimelineItemData } from '@/src/components/waitlist/ApplicationTimeline';

// ============================================
// CONSTANTS - EXACT FIGMA VALUES (41-11313)
// ============================================

const FIGMA = {
  // Colors from analysis
  colors: {
    screenBackground: '#131313',    // black.700
    cardBackground: '#202020',      // black.500
    cardBackgroundSecondary: '#1A1A1A', // black.600
    textPrimary: '#FFFFFF',         // white
    textSecondary: '#A6A6A6',       // black.200
    textMuted: '#878787',           // neutral.600
    textValue: '#CBCBCB',           // neutral.300
    textAccent: '#FF9A6D',          // brand.500
    divider: '#4D4D4D',             // black.400
    benefitIcon: '#A9A9A9',         // neutral.500
    buttonBorder: '#FF9A6D',        // brand.500
    buttonShadow: '#995C41',        // brand shadow
    timelineComplete: '#70BF73',    // success.default
    timelineConnector: '#FFAE8A',   // brand.400
  },
  // Typography from analysis
  typography: {
    headline: {
      fontSize: 48,
      lineHeight: 64,
      letterSpacing: -2,
      fontWeight: '400' as const,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    timelineLabel: {
      fontSize: 12,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    timelineValue: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    benefitTitle: {
      fontSize: 28,
      lineHeight: 40,
      letterSpacing: -1,
      fontWeight: '400' as const,
    },
    benefitItem: {
      fontSize: 12,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    buttonText: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500' as const,
    },
  },
  // Layout dimensions
  layout: {
    screenPadding: 40,
    cardRadius: 12,
    buttonRadius: 8,
    timelineCardPadding: { top: 24, right: 16, bottom: 24, left: 16 },
    timelineCardGap: 24,
    benefitsCardPadding: { top: 32, right: 24, bottom: 32, left: 24 },
    buttonHeight: 56,
    buttonPadding: 16,
    dividerWidth: 24,
    dividerHeight: 2,
    timelineConnectorHeight: 47,
    timelineDotSize: 12,
    backgroundShapeHeight: 405,
  },
  // Shadows
  shadows: {
    button: {
      shadowColor: '#995C41',
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 12,
      shadowOpacity: 1,
    },
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
    status,
  } = useWaitlist({ useMock: true, mockState: 'approved' });

  const displayName = userName || 'Rishabh Agnihotri';
  const submissionDate = status?.submissionDate || '27 Jan 2026';
  const reviewTime = status?.estimatedReviewTime || 'Approximately 24 hrs';

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
    // Play haptic celebration
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Animate header
    headerScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    headerOpacity.value = withTiming(1, { duration: 400 });

    // Animate timeline with delay
    timelineTranslate.value = withDelay(200, withSpring(0, { damping: 15 }));
    timelineOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));

    // Play confetti animation
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

  // Handle "Step Inside" button
  const handleStepInside = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(agreement)/upload' as never);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: FIGMA.colors.screenBackground }]}>
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
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Background gradient placeholder */}
        <View style={styles.backgroundGradient} />

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo size={40} color={FIGMA.colors.textPrimary} />
        </View>

        {/* Header Text */}
        <Animated.View style={[styles.headerSection, headerAnimatedStyle]}>
          <Text style={styles.headlineText}>
            <Text style={styles.headlineWhite}>{displayName},{'\n'}</Text>
            <Text style={styles.headlineAccent}>you're all set.</Text>
          </Text>
          <Text style={styles.subtitleText}>
            Welcome to the right side of renting.
          </Text>
        </Animated.View>

        {/* Status Timeline Card - All Complete with green dots */}
        <Animated.View style={[styles.timelineSection, timelineAnimatedStyle]}>
          <ApplicationTimeline
            items={timelineItems}
            testID="approved-timeline"
          />
        </Animated.View>

        {/* Benefits Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.benefitsSection}>
          <BenefitsCard
            variant="benefits"
            testID="approved-benefits"
          />
        </Animated.View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* CTA Button */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.ctaContainer}>
          <PrimaryButton
            title="Step Inside"
            onPress={handleStepInside}
            testID="step-inside-button"
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ============================================
// STYLES - PIXEL PERFECT FIGMA VALUES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: FIGMA.layout.screenPadding, // 40px
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FIGMA.layout.backgroundShapeHeight, // 405px
    opacity: 0.5,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  // Header - Figma: 48/64/-2
  headerSection: {
    marginBottom: 24,
  },
  headlineText: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.headline.fontSize, // 48
    lineHeight: FIGMA.typography.headline.lineHeight, // 64
    letterSpacing: FIGMA.typography.headline.letterSpacing, // -2
  },
  headlineWhite: {
    color: FIGMA.colors.textPrimary, // #FFFFFF
  },
  headlineAccent: {
    color: FIGMA.colors.textAccent, // #FF9A6D
  },
  subtitleText: {
    fontFamily: fontFamily.primary.regular,
    fontSize: FIGMA.typography.subtitle.fontSize, // 14
    lineHeight: FIGMA.typography.subtitle.lineHeight, // 20
    color: FIGMA.colors.textSecondary, // #A6A6A6
    marginTop: 16,
  },

  // Timeline
  timelineSection: {
    marginBottom: 24,
  },

  // Benefits Section
  benefitsSection: {
    marginBottom: 24,
  },

  // Divider
  divider: {
    width: FIGMA.layout.dividerWidth, // 24
    height: FIGMA.layout.dividerHeight, // 2
    backgroundColor: FIGMA.colors.divider, // #4D4D4D
    borderRadius: 200,
    alignSelf: 'center',
    marginBottom: 24,
  },

  // CTA
  ctaContainer: {
    marginTop: 'auto',
  },
});
