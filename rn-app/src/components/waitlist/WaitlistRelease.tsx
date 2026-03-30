/**
 * Waitlist Release Component
 *
 * Shows release progress: spots filled, total capacity, and user's waitlist status.
 * Replaces/supplements the ProgressArc with a linear progress bar design.
 *
 * Design:
 * - "Limited spots in this release" heading
 * - "We're onboarding users in small batches to maintain quality." description
 * - Linear progress bar with "X / Y spots filled"
 * - "You're on the waitlist" status badge
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/src/components/ui';
import { colors } from '@/src/theme';

interface WaitlistReleaseProps {
  currentOnboarded: number;
  totalMemberSlots: number;
}

function WaitlistReleaseComponent({ currentOnboarded, totalMemberSlots }: WaitlistReleaseProps) {
  const progress = totalMemberSlots > 0
    ? Math.min(currentOnboarded / totalMemberSlots, 1)
    : 0;

  return (
    <View style={styles.container}>
      {/* Heading */}
      <Text style={styles.heading}>Limited spots in this release</Text>

      {/* Description */}
      <Text style={styles.description}>
        We're onboarding users in small batches to maintain quality.
      </Text>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          <Text inherit style={styles.progressCount}>{currentOnboarded}</Text>
          <Text inherit style={styles.progressSeparator}> / {totalMemberSlots}</Text>
          <Text inherit style={styles.progressText}> spots filled</Text>
        </Text>
      </View>

      {/* Status pill */}
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>You're on the waitlist</Text>
      </View>
    </View>
  );
}

export const WaitlistRelease = memo(WaitlistReleaseComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black[500],
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },

  heading: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },

  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.neutral[500],
  },

  progressSection: {
    gap: 8,
    marginTop: 4,
  },

  progressTrack: {
    height: 8,
    backgroundColor: colors.black[400],
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: colors.brand[500],
    borderRadius: 4,
  },

  progressLabel: {
    textAlign: 'center',
  },

  progressCount: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },

  progressSeparator: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[600],
  },

  progressText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.neutral[500],
  },

  statusPill: {
    alignSelf: 'center',
    backgroundColor: colors.black[600],
    borderRadius: 200,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 4,
  },

  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: colors.success.material,
  },
});
