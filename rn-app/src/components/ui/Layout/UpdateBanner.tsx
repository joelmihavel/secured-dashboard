/**
 * Update Banner Component
 *
 * Displays an OTA update banner at the top of the screen.
 * Follows the OfflineBanner architectural pattern:
 * - Absolute positioned, spring-animated slide-in/out
 * - Downloading: Brand accent bg with progress indicator
 * - Ready: "Update ready" with Restart button + dismiss
 * - Critical: Red bg, auto-restarting, no dismiss
 * - Restarting: Transitional state before reload
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { colors } from '@/src/theme';
import { useOTAUpdates } from '@/src/hooks/useOTAUpdates';
import type { BannerState } from '@/src/hooks/useOTAUpdates';

export function UpdateBanner() {
  const { bannerState, downloadProgress, dismiss, applyUpdate } = useOTAUpdates();
  const [slideAnim] = useState(new Animated.Value(-60));

  const shouldShow = bannerState !== 'hidden';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: shouldShow ? 0 : -60,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [shouldShow, slideAnim]);

  if (!shouldShow) return null;

  const { backgroundColor, message, showRestart, showDismiss } = getBannerConfig(bannerState, downloadProgress);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>
            {bannerState === 'critical' || bannerState === 'restarting' ? '!' : '\u2191'}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.message}>{message}</Text>
          {bannerState === 'downloading' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
            </View>
          )}
        </View>
        {showRestart && (
          <Pressable
            onPress={applyUpdate}
            style={styles.restartButton}
            hitSlop={8}
            accessibilityLabel="Restart to apply update"
            accessibilityRole="button"
          >
            <Text style={styles.restartText}>Restart</Text>
          </Pressable>
        )}
        {showDismiss && (
          <Pressable
            onPress={dismiss}
            hitSlop={8}
            accessibilityLabel="Dismiss update banner"
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>x</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function getBannerConfig(state: BannerState, progress: number) {
  switch (state) {
    case 'downloading':
      return {
        backgroundColor: colors.brand[500],
        message: `Downloading update... ${Math.round(progress * 100)}%`,
        showRestart: false,
        showDismiss: false,
      };
    case 'ready':
      return {
        backgroundColor: colors.brand[500],
        message: 'Update ready. Restart to apply.',
        showRestart: true,
        showDismiss: true,
      };
    case 'critical':
      return {
        backgroundColor: '#DC3545',
        message: 'Critical update. Restarting...',
        showRestart: false,
        showDismiss: false,
      };
    case 'restarting':
      return {
        backgroundColor: '#DC3545',
        message: 'Restarting...',
        showRestart: false,
        showDismiss: false,
      };
    default:
      return {
        backgroundColor: colors.brand[500],
        message: '',
        showRestart: false,
        showDismiss: false,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
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
    color: '#FFFFFF',
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
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 1.5,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.black[700],
    borderRadius: 1.5,
  },
  restartButton: {
    backgroundColor: colors.black[700],
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 8,
  },
  restartText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.black[700],
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
