/**
 * Update Banner Component
 *
 * Bottom banner showing OTA update progress.
 * All updates auto-apply — no manual "tap to restart" interaction.
 * States:
 *  - downloading: shimmer + "Updating your app..."
 *  - restarting: "Restarting..." (native reload screen takes over)
 *  - critical: same as restarting (auto-applies)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '@/src/theme';
import { useOTAUpdates } from '@/src/hooks/useOTAUpdates';

export function UpdateBanner() {
  const { bannerState } = useOTAUpdates();
  const [slideAnim] = useState(new Animated.Value(20));
  const shimmer = useRef(new Animated.Value(0)).current;

  const shouldShow =
    bannerState === 'downloading' ||
    bannerState === 'critical' ||
    bannerState === 'restarting';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : 20,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [shouldShow, slideAnim]);

  // Indeterminate shimmer animation
  useEffect(() => {
    if (bannerState === 'downloading' || bannerState === 'restarting') {
      const loop = Animated.loop(
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [bannerState, shimmer]);

  if (!shouldShow) return null;

  const shimmerWidth = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0%', '60%', '100%'],
  });

  const message = bannerState === 'downloading'
    ? 'Updating your app...'
    : 'Restarting...';

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.progressFill, { width: shimmerWidth }]} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    height: 20,
    backgroundColor: 'rgba(32,32,32,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,154,109,0.2)',
  },
  message: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Regular',
    color: colors.neutral[500],
  },
});
