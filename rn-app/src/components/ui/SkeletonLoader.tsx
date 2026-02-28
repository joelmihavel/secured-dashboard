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
import { Skeleton } from 'moti/skeleton';

import { Logo } from './Layout';
import { colors, spacing, radius } from '@/src/theme';

const ANIMATION_DURATION = 300;
const ANIMATION_STAGGER = 150;

/** Shimmer colors for header blocks — sweeps across dark background */
const SHIMMER_COLORS = [
  colors.black[500],  // #202020 (base)
  colors.black[400],  // #4D4D4D (peak)
  colors.black[500],  // #202020 (base)
] as const;

/** Shimmer colors for card lines — subtler, on card surface */
const CARD_SHIMMER_COLORS = [
  colors.black[400],  // #4D4D4D (base)
  colors.black[350],  // #656565 (peak)
  colors.black[400],  // #4D4D4D (base)
] as const;

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
      <View style={styles.container}>
        <Skeleton.Group show={true}>
          {/* Skeleton header */}
          <Animated.View
            entering={FadeIn.duration(ANIMATION_DURATION)}
            style={[styles.headerSection, { paddingTop: insets.top + spacing.huge }]}
          >
            <View style={styles.logoContainer}>
              <Logo size={38} color={colors.white} />
            </View>
            <View style={styles.textBlock}>
              <Skeleton width={200} height={48} radius={radius.sm} colors={SHIMMER_COLORS} />
              <Skeleton width={260} height={48} radius={radius.sm} colors={SHIMMER_COLORS} />
              <Skeleton width={220} height={20} radius={radius.sm} colors={SHIMMER_COLORS} />
            </View>
          </Animated.View>

          {/* Skeleton card */}
          {showCard && (
            <Animated.View
              entering={FadeIn.delay(ANIMATION_STAGGER).duration(ANIMATION_DURATION)}
              style={styles.card}
            >
              <Skeleton width="80%" height={16} radius={radius.sm} colors={CARD_SHIMMER_COLORS} />
              <Skeleton width="80%" height={16} radius={radius.sm} colors={CARD_SHIMMER_COLORS} />
              <Skeleton width="50%" height={16} radius={radius.sm} colors={CARD_SHIMMER_COLORS} />
            </Animated.View>
          )}
        </Skeleton.Group>
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
  card: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.black[500],
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
