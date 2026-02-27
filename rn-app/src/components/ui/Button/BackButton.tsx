import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { colors } from '@/src/theme';
import { s } from '@/src/theme/scale';

export interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Shared Back Button component based on Figma Outline Icon Library
 * References: Node 771:7971
 */
function BackButtonComponent({
  onPress,
  color = colors.white,
  style,
  testID = 'back-button',
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, style]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Svg width={s(32)} height={s(32)} viewBox="0 0 64 64" fill="none">
        <Path
          d="M50.667 32H13.3337"
          stroke={color}
          strokeWidth={2.66667}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M29.333 48L13.333 32"
          stroke={color}
          strokeWidth={2.66667}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M29.333 16L13.333 32"
          stroke={color}
          strokeWidth={2.66667}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: s(32),
    height: s(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const BackButton = memo(BackButtonComponent);
