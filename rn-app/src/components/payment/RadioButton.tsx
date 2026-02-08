/**
 * Radio Button Component
 * Figma: 24x24, 2px stroke, inner fill 14px when selected
 *
 * Colors from Figma analysis:
 * - Selected border: #FF9A6D (brand.500)
 * - Unselected border: #DDDDDD (neutral.200)
 * - Inner fill: #FF9A6D (brand.500)
 * - Locked: #4D4D4D (black.400)
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// Figma colors
const RADIO_COLORS = {
  selected: '#FF9A6D',      // brand.500
  unselected: '#DDDDDD',    // neutral.200
  locked: '#4D4D4D',        // black.400
  innerFill: '#FF9A6D',     // brand.500
};

export interface RadioButtonProps {
  isSelected: boolean;
  isLocked?: boolean;
}

function RadioButtonComponent({ isSelected, isLocked = false }: RadioButtonProps) {
  const borderColor = isLocked
    ? RADIO_COLORS.locked
    : isSelected
    ? RADIO_COLORS.selected
    : RADIO_COLORS.unselected;

  const innerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isSelected && !isLocked ? 1 : 0, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
      opacity: withSpring(isSelected && !isLocked ? 1 : 0),
    };
  });

  return (
    <View style={[styles.outer, { borderColor }]}>
      <Animated.View style={[styles.inner, innerAnimatedStyle]} />
      {isLocked && (
        <View style={styles.lockIconContainer}>
          {/* Lock icon placeholder - using simple shape */}
          <View style={styles.lockIcon} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: RADIO_COLORS.innerFill,  // brand.500 #FF9A6D
  },
  lockIconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    width: 8,
    height: 10,
    borderRadius: 2,
    backgroundColor: RADIO_COLORS.locked,  // black.400 #4D4D4D
  },
});

export const RadioButton = memo(RadioButtonComponent);
