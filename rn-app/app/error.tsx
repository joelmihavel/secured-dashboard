/**
 * Error Screen
 *
 * Navigable error screen for recoverable errors.
 * Auto-triggered by the error event bus for fatal errors (5xx, unhandled rejections).
 * Also reachable via manual navigateToError() calls.
 *
 * Search params:
 *   - title: Error title (default: "Something went wrong")
 *   - message: Error description
 *   - action: "back" | "home" | "retry" | route path
 *   - actionLabel: Button text (default: "Try Again")
 *   - errorId: Machine-generated error ID (e.g. ERR-M3K7P-A2XF)
 *   - timestamp: Error timestamp (ms)
 *   - source: Error source (unhandled_rejection, query_error, etc.)
 *   - technicalMessage: Technical error details
 *   - isLooping: "true" if 3+ errors in 30s (disables Try Again)
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { colors, typography } from '@/src/theme';
import { buildSupportEmailUri } from '@/src/services/errorReporting';

// Warning triangle icon
const WarningIcon = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      stroke={colors.brand[500]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default function ErrorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    message?: string;
    action?: string;
    actionLabel?: string;
    errorId?: string;
    timestamp?: string;
    source?: string;
    technicalMessage?: string;
    isLooping?: string;
  }>();

  const isLooping = params.isLooping === 'true';
  const title = isLooping
    ? 'The app is having trouble'
    : params.title || 'Something went wrong';
  const message = isLooping
    ? 'Please restart the app or contact support.'
    : params.message || 'An unexpected error occurred. Please try again.';
  const actionLabel = isLooping ? 'Contact Support' : params.actionLabel || 'Try Again';
  const action = params.action || 'back';

  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const handlePrimaryAction = useCallback(() => {
    if (isLooping) {
      handleContactSupport();
      return;
    }

    if (action === 'back' || action === 'retry') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } else if (action === 'home') {
      router.replace('/' as never);
    } else {
      router.replace(action as never);
    }
  }, [action, router, isLooping]);

  const handleContactSupport = useCallback(() => {
    const uri = buildSupportEmailUri({
      id: params.errorId,
      timestamp: params.timestamp ? Number(params.timestamp) : undefined,
      source: params.source as never,
      title: params.title,
      message: params.technicalMessage || params.message,
    });
    Linking.openURL(uri);
  }, [params]);

  return (
    <Screen testID="error-screen" padded={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <WarningIcon />

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          {/* Error ID Badge */}
          {params.errorId && (
            <View style={styles.errorIdBadge}>
              <Text style={styles.errorIdText}>{params.errorId}</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={actionLabel}
            onPress={handlePrimaryAction}
            testID="error-action-button"
          />

          {/* Contact Support link (only show separately when not looping — looping makes it the primary) */}
          {!isLooping && (
            <Pressable
              style={styles.supportLink}
              onPress={handleContactSupport}
              accessibilityRole="button"
              accessibilityLabel="Contact support"
            >
              <Text style={styles.supportLinkText}>Contact Support</Text>
            </Pressable>
          )}

          {/* Expandable Error Details */}
          {(params.technicalMessage || params.source || params.timestamp) && (
            <Pressable
              style={styles.detailsToggle}
              onPress={() => setDetailsExpanded(!detailsExpanded)}
              accessibilityRole="button"
              accessibilityLabel={detailsExpanded ? 'Hide error details' : 'Show error details'}
            >
              <Text style={styles.detailsToggleText}>
                {detailsExpanded ? 'Hide Details' : 'Error Details'}
              </Text>
            </Pressable>
          )}

          {detailsExpanded && (
            <View style={styles.detailsCard}>
              {params.errorId && (
                <Text style={styles.detailLine}>ID: {params.errorId}</Text>
              )}
              {params.timestamp && (
                <Text style={styles.detailLine}>
                  Time: {new Date(Number(params.timestamp)).toLocaleTimeString()}
                </Text>
              )}
              {params.source && (
                <Text style={styles.detailLine}>Source: {params.source}</Text>
              )}
              {params.technicalMessage && (
                <Text style={styles.detailLine}>
                  Detail: {params.technicalMessage}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 48,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    ...typography.bodyMd,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  errorIdBadge: {
    backgroundColor: colors.black[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  errorIdText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.neutral[500],
    letterSpacing: 0.5,
  },
  buttonContainer: {
    marginTop: 48,
    width: '100%',
    alignItems: 'center',
  },
  supportLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  supportLinkText: {
    ...typography.bodyMd,
    color: colors.neutral[500],
    textDecorationLine: 'underline',
  },
  detailsToggle: {
    marginTop: 24,
    paddingVertical: 8,
  },
  detailsToggleText: {
    ...typography.bodySm,
    color: colors.neutral[600],
  },
  detailsCard: {
    backgroundColor: colors.black[500],
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    width: '100%',
    gap: 6,
  },
  detailLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.neutral[500],
    lineHeight: 16,
  },
});
