import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import { colors } from '@/src/theme';
import { sv, s } from '@/src/theme/scale';

export interface WaitlistPositionBadgeProps {
  position: number;
  total: number;
  ahead: number;
}

function WaitlistPositionBadgeComponent({ position, total, ahead }: WaitlistPositionBadgeProps) {
  // width based on progress (inverse since smaller position is better?) 
  // Wait, if position is 18 out of 150, progress is (150-18)/150? No, let's just make it a visual proportion or hardcode to 50% for now.
  const progressPercent = Math.max(0, Math.min(100, ((total - position) / total) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <RNText style={styles.positionText}>#{position}</RNText>
        <RNText style={styles.totalText}>of {total} on the waitlist</RNText>
      </View>

      <View style={styles.bottomSection}>
        {/* Progress bar container */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <RNText style={styles.aheadText}>Only {ahead} ahead of you</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: s(24),
  },
  topSection: {
    width: '100%',
    gap: s(8),
  },
  positionText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sv(48),
    lineHeight: sv(64),
    letterSpacing: -2,
    color: colors.brand[500], // #FF9A6D
  },
  totalText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(14),
    lineHeight: sv(20),
    color: colors.neutral[500], // #A9A9A9
  },
  bottomSection: {
    width: '100%',
    gap: s(16),
  },
  progressBarBg: {
    width: '100%',
    height: s(8),
    backgroundColor: colors.black[500], // #202020
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.brand[500], // #FF9A6D
    borderRadius: 4,
  },
  aheadText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(14),
    lineHeight: sv(20),
    color: colors.neutral[500], // #A9A9A9
  },
});

export const WaitlistPositionBadge = memo(WaitlistPositionBadgeComponent);
