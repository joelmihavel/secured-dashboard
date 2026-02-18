/**
 * Document Upload Card Component
 * Figma: Shows uploaded document with filename, progress, and status
 *
 * EXACT Figma Values:
 * - Container background: #202020
 * - Border radius: 12px
 * - Padding: 16px
 * - Filename: Plus Jakarta Sans Medium, 12px, #A9A9A9
 * - Progress bar: height 2px, #FF9A6D
 * - Status icons: 24x24
 */

import React, { memo, useEffect } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '../Typography';
import { colors, spacing } from '@/src/theme';

// Exact Figma color values
const CARD_COLORS = {
  background: '#202020',
  backgroundHover: '#2A2A2A',
  iconBackground: '#131313',
  progressTrack: '#4D4D4D',
  progressFill: '#FF9A6D',
  filenameText: '#A9A9A9',
  statusSuccess: '#06C270',
  statusError: '#E5484D',
  statusPending: '#FF9A6D',
} as const;

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

export interface DocumentUploadCardProps {
  filename: string;
  status: UploadStatus;
  progress?: number; // 0-100
  errorMessage?: string;
  onRemove?: () => void;
  onRetry?: () => void;
  style?: ViewStyle;
  testID?: string;
}

function DocumentUploadCardComponent({
  filename,
  status,
  progress = 0,
  errorMessage,
  onRemove,
  onRetry,
  style,
  testID,
}: DocumentUploadCardProps) {
  const progressWidth = useSharedValue(0);
  const pulseOpacity = useSharedValue(1);

  // Animate progress bar
  useEffect(() => {
    if (status === 'uploading' || status === 'processing') {
      progressWidth.value = withTiming(progress, { duration: 300 });
    } else if (status === 'success') {
      progressWidth.value = withTiming(100, { duration: 200 });
    }
  }, [progress, status]);

  // Pulse animation for processing state
  useEffect(() => {
    if (status === 'processing') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [status]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return CARD_COLORS.statusSuccess;
      case 'error':
        return CARD_COLORS.statusError;
      default:
        return CARD_COLORS.statusPending;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return `Uploading... ${Math.round(progress)}%`;
      case 'processing':
        return 'Processing document...';
      case 'success':
        return 'Upload complete';
      case 'error':
        return errorMessage || 'Upload failed';
      default:
        return '';
    }
  };

  const truncateFilename = (name: string, maxLength: number = 35) => {
    if (name.length <= maxLength) return name;
    const ext = name.split('.').pop() || '';
    const nameWithoutExt = name.slice(0, name.length - ext.length - 1);
    const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 4);
    return `${truncated}...${ext}`;
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Document Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.documentIcon}>
          <View style={styles.documentPage} />
          <View style={styles.documentLines}>
            <View style={styles.line} />
            <View style={styles.line} />
            <View style={[styles.line, { width: '60%' }]} />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.filename} numberOfLines={1}>
          {truncateFilename(filename)}
        </Text>

        {/* Progress Bar */}
        {(status === 'uploading' || status === 'processing') && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
          </View>
        )}

        {/* Status Text */}
        {status !== 'idle' && (
          <Animated.View style={pulseStyle}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {status === 'error' && onRetry && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRetry();
            }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`Retry uploading ${filename}`}
          >
            <Text style={styles.actionText}>Retry</Text>
          </Pressable>
        )}
        {(status === 'success' || status === 'idle') && onRemove && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRemove();
            }}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${filename}`}
          >
            <View style={styles.removeIcon}>
              <View style={styles.removeIconLine} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLORS.background,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: CARD_COLORS.iconBackground,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentIcon: {
    width: 24,
    height: 28,
    position: 'relative',
  },
  documentPage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#4D4D4D',
    borderRadius: 2,
  },
  documentLines: {
    position: 'absolute',
    top: 8,
    left: 4,
    right: 4,
    gap: 3,
  },
  line: {
    height: 2,
    width: '100%',
    backgroundColor: '#202020',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  filename: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.filenameText,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressTrack: {
    height: 2,
    backgroundColor: CARD_COLORS.progressTrack,
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: CARD_COLORS.progressFill,
    borderRadius: 100,
  },
  statusText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  actionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 16,
    color: CARD_COLORS.statusPending,
  },
  removeIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIconLine: {
    width: 12,
    height: 2,
    backgroundColor: '#4D4D4D',
    borderRadius: 1,
  },
});

export const DocumentUploadCard = memo(DocumentUploadCardComponent);
