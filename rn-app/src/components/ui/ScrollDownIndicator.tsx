/**
 * ScrollDownIndicator Component
 * Bouncing chevron-down arrow to indicate scrollable content
 * Extracted from app/(waitlist)/index.tsx for reuse
 */

import React, { memo, useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export interface ScrollDownIndicatorProps {
  visible: boolean;
  onPress?: () => void;
  bottom?: number;
}

function ScrollDownIndicatorComponent({
  visible,
  onPress,
  bottom = 24,
}: ScrollDownIndicatorProps) {
  const bounceValue = useSharedValue(0);

  useEffect(() => {
    bounceValue.value = withRepeat(
      withTiming(10, { duration: 1000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      -1,
      true
    );
    return () => cancelAnimation(bounceValue);
  }, [bounceValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceValue.value }],
  }));

  if (!visible) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { bottom }]}
      testID="scroll-down-indicator"
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={animatedStyle}
      >
        <Ionicons name="chevron-down" size={32} color="#FF9A6D" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
});

export const ScrollDownIndicator = memo(ScrollDownIndicatorComponent);
