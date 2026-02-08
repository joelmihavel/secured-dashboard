/**
 * Text Button Component
 * Underlined text link style button
 */

import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '../Typography';
import { duration, animationValues } from '@/src/theme';

export interface TextButtonProps {
  title: string;
  onPress: () => void;
  underline?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

function TextButtonComponent({
  title,
  onPress,
  underline = true,
  disabled = false,
  style,
  testID,
}: TextButtonProps) {
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    opacity.value = withTiming(animationValues.opacity.pressed, { duration: duration.instant });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    opacity.value = withTiming(animationValues.opacity.default, { duration: duration.instant });
  }, []);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={style}
    >
      <Animated.View style={animatedStyle}>
        <Text
          variant="bodyMd2"
          color={disabled ? 'disabled' : 'secondary'}
          style={underline && styles.underline}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  underline: {
    textDecorationLine: 'underline',
  },
});

export const TextButton = memo(TextButtonComponent);
