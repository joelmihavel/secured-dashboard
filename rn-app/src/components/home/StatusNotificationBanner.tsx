/**
 * StatusNotificationBanner - Contextual notification pill
 *
 * Displays state-driven notification messages between RentStatusCarousel and TabSwitcher.
 * Different from WarningBanner (which has asymmetric padding for headline context).
 *
 * Figma reference: 684:8436 pill pattern
 * Pill: bg #1A1A1A, borderRadius 12, paddingVertical 5, paddingHorizontal 12
 * Text: PlusJakartaSans-Regular, fontSize 12, lineHeight 20, textAlign center
 *
 * Spacing: Component centers itself; parent layout applies margins as needed.
 */

import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

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
  const opacity = useSharedValue(0);
  const config = notificationConfig[type];
  const displayText = customMessage ?? config.text;

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedPillStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const pill = (
    <Animated.View style={[styles.pill, animatedPillStyle]} testID="status-notification-banner">
      <Text style={[styles.text, { color: config.textColor }]}>
        {displayText}
      </Text>
    </Animated.View>
  );

  return (
    <View style={styles.wrapper}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button">
          {pill}
        </Pressable>
      ) : (
        pill
      )}
    </View>
  );
});

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  // Outer wrapper: centers the pill horizontally.
  // Vertical spacing is handled by the parent layout context.
  wrapper: {
    alignItems: 'center',
  },
  pill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 5,  // Compact pill (30px total: 5 + 20 lineHeight + 5)
    paddingHorizontal: 12,
  },
  text: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
});
