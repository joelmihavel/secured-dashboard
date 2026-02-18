/**
 * Offline Banner Component (ST-105)
 *
 * Displays a dismissible banner when the device is offline.
 * Shows at the top of the screen with a warning icon and message.
 * Automatically hides when connectivity is restored.
 *
 * Usage:
 *   <OfflineBanner />
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { colors } from '@/src/theme';
import { useNetworkStatus, getQueueLength } from '@/src/hooks/useNetworkStatus';

interface OfflineBannerProps {
  /** Custom message to display (default: 'No internet connection') */
  message?: string;
  /** Whether the banner can be dismissed (default: true) */
  dismissible?: boolean;
}

export function OfflineBanner({
  message = 'No internet connection',
  dismissible = true,
}: OfflineBannerProps) {
  const { isConnected } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-60));

  const shouldShow = !isConnected && !dismissed;
  const queueLength = getQueueLength();

  // Animate in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -60,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [shouldShow, slideAnim]);

  // Reset dismissed state when connectivity changes
  useEffect(() => {
    if (isConnected) {
      setDismissed(false);
    }
  }, [isConnected]);

  // Don't render anything if connected and animation is done
  if (isConnected && !shouldShow) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message}>{message}</Text>
          {queueLength > 0 && (
            <Text style={styles.queueInfo}>
              {queueLength} pending {queueLength === 1 ? 'action' : 'actions'} will retry
            </Text>
          )}
        </View>
        {dismissible && (
          <Pressable
            onPress={() => setDismissed(true)}
            hitSlop={8}
            accessibilityLabel="Dismiss offline banner"
            accessibilityRole="button"
          >
            <Text style={styles.dismiss}>x</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.warning.amber,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.black[700],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning.amber,
    lineHeight: 14,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.black[700],
  },
  queueInfo: {
    fontSize: 11,
    color: colors.black[600],
    marginTop: 1,
  },
  dismiss: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black[700],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
