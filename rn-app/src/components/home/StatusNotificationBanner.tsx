/**
 * StatusNotificationBanner - Contextual notification pill
 *
 * Displays state-driven notification messages between RentStatusCarousel and TabSwitcher.
 * Different from WarningBanner (which has asymmetric padding for headline context).
 *
 * Figma reference: 684:8436 pill pattern
 * Container: bg #1A1A1A, borderRadius 12, paddingVertical 8, paddingHorizontal 12
 * Text: PlusJakartaSans-Regular, fontSize 12, lineHeight 20, textAlign center
 */

import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

// ==============================================
// TYPES
// ==============================================

export type NotificationType = 'verification_pending' | 'landlord_rejected' | 'rent_due';

export interface StatusNotificationBannerProps {
  type: NotificationType;
  customMessage?: string;
  onPress?: () => void;
}

// ==============================================
// NOTIFICATION CONFIG
// ==============================================

const notificationConfig: Record<NotificationType, { text: string; textColor: string }> = {
  verification_pending: {
    text: 'Cashbacks will be accumulated till verifications are complete.',
    textColor: '#FF9A6D',
  },
  landlord_rejected: {
    text: 'Your landlord has rejected your tenancy request.',
    textColor: '#E5484D',
  },
  rent_due: {
    text: 'Your rent is due',
    textColor: '#FF9A6D',
  },
};

// ==============================================
// COMPONENT
// ==============================================

export const StatusNotificationBanner = memo(function StatusNotificationBanner({
  type,
  customMessage,
  onPress,
}: StatusNotificationBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const config = notificationConfig[type];
  const displayText = customMessage ?? config.text;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const content = (
    <Animated.View style={[styles.container, { opacity }]} testID="status-notification-banner">
      <Text style={[styles.text, { color: config.textColor }]}>
        {displayText}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
});

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
});
