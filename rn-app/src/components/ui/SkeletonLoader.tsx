/**
 * SkeletonLoader — Shared loading/transition screen
 *
 * A generic skeleton loader with the Flent brand pattern:
 * dark background, logo, shimmer placeholder lines, and an optional card.
 * Used as the common loading state across all screen transitions
 * (journey router, auth → waitlist, OTP → next screen, etc.).
 *
 * Design reference: Waitlist loading state (node 41:11206)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Logo } from './Layout';
import { DottedGridPattern } from '../patterns';
import { colors, spacing, radius } from '@/src/theme';

const ANIMATION_DURATION = 300;
const ANIMATION_STAGGER = 150;

interface SkeletonLoaderProps {
  /** DottedPattern backgroundShape — defaults to 'default' */
  backgroundShape?: 'agreement' | 'waitlist' | 'default';
  /** Whether to show the skeleton card below the header lines */
  showCard?: boolean;
}

export function SkeletonLoader({ backgroundShape = 'default', showCard = true }: SkeletonLoaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <DottedGridPattern fadeMask={false} />
      <View style={styles.container}>
        {/* Skeleton header */}
        <Animated.View
          entering={FadeIn.duration(ANIMATION_DURATION)}
          style={[styles.headerSection, { paddingTop: insets.top + spacing.huge }]}
        >
          <View style={styles.logoContainer}>
            <Logo size={38} color={colors.white} />
          </View>
          <View style={styles.textBlock}>
            <View style={styles.titleLine} />
            <View style={styles.titleLine2} />
            <View style={styles.subtitleLine} />
          </View>
        </Animated.View>

        {/* Skeleton card */}
        {showCard && (
          <Animated.View
            entering={FadeIn.delay(ANIMATION_STAGGER).duration(ANIMATION_DURATION)}
            style={styles.card}
          >
            <View style={styles.cardLine} />
            <View style={styles.cardLine} />
            <View style={styles.cardLineShort} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black[700],
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  headerSection: {
    gap: spacing.lg,
  },
  logoContainer: {
    marginBottom: spacing.sm,
  },
  textBlock: {
    gap: 4,
  },
  titleLine: {
    width: 200,
    height: 48,
    backgroundColor: colors.black[500],
    borderRadius: radius.sm,
  },
  titleLine2: {
    width: 260,
    height: 48,
    backgroundColor: colors.black[500],
    borderRadius: radius.sm,
    marginTop: 4,
  },
  subtitleLine: {
    width: 220,
    height: 20,
    backgroundColor: colors.black[500],
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.black[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  cardLine: {
    width: '80%',
    height: 16,
    backgroundColor: colors.black[400],
    borderRadius: radius.sm,
    opacity: 0.3,
  },
  cardLineShort: {
    width: '50%',
    height: 16,
    backgroundColor: colors.black[400],
    borderRadius: radius.sm,
    opacity: 0.3,
  },
});
