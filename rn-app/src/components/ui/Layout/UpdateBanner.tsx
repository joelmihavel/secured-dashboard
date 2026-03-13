/**
 * Update Banner Component
 *
 * Ultra-slim OTA update bar at the very bottom of the screen.
 * States:
 *  - downloading: shimmer animation, "Updating..."
 *  - ready: tappable, "Update ready — tap to restart"
 *  - critical: non-dismissable, "Applying critical update..."
 *  - restarting: non-dismissable, "Restarting..."
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { colors } from '@/src/theme';
import { useOTAUpdates } from '@/src/hooks/useOTAUpdates';

export function UpdateBanner() {
  const { bannerState, applyUpdate, dismiss } = useOTAUpdates();
  const [slideAnim] = useState(new Animated.Value(20));
  const shimmer = useRef(new Animated.Value(0)).current;

  const shouldShow =
    bannerState === 'downloading' ||
    bannerState === 'ready' ||
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
    if (bannerState === 'downloading') {
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

  const isCritical = bannerState === 'critical' || bannerState === 'restarting';
  const isReady = bannerState === 'ready';
  const isTappable = isReady;

  const shimmerWidth = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0%', '60%', '100%'],
  });

  const message = (() => {
    switch (bannerState) {
      case 'downloading': return 'Updating...';
      case 'ready': return 'Update ready \u2014 tap to restart';
      case 'critical': return 'Applying critical update...';
      case 'restarting': return 'Restarting...';
      default: return '';
    }
  })();

  const content = (
    <Animated.View
      style={[
        styles.container,
        isReady && styles.readyContainer,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents={isTappable ? 'auto' : 'none'}
    >
      {bannerState === 'downloading' && (
        <Animated.View style={[styles.progressFill, { width: shimmerWidth }]} />
      )}
      <Text style={[styles.message, isCritical && styles.criticalMessage, isReady && styles.readyMessage]}>
        {message}
      </Text>
    </Animated.View>
  );

  if (isTappable) {
    return (
      <Pressable onPress={applyUpdate} onLongPress={dismiss}>
        {content}
      </Pressable>
    );
  }

  return content;
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
  readyContainer: {
    height: 28,
    backgroundColor: 'rgba(32,32,32,0.98)',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,154,109,0.3)',
  },
  message: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans-Regular',
    color: colors.neutral[500],
  },
  criticalMessage: {
    color: '#DC3545',
  },
  readyMessage: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans-Medium',
    color: colors.brand[500],
  },
});
