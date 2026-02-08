/**
 * AddMoreCard Component
 * Figma ID: 243-4052
 * "Add new payment method" card with plus icon
 *
 * EXACT Figma Values:
 * - Container: 270x408, flexDirection column
 * - Card body: 270x344, backgroundColor #202020
 * - Card body padding: top 24, right 32, bottom 24, left 32
 * - Card footer: 270x64, backgroundColor #1A1A1A
 * - Content area: centered, gap 24
 * - Plus sign: included in text
 * - Main text: fontSize 20, lineHeight 32, color #CBCBCB, textAlign center
 * - Footer label: fontSize 14, lineHeight 20, color #FF9A6D (accent)
 */

import React, { memo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { springConfig } from '@/src/theme';

// Exact Figma color values
const CARD_COLORS = {
  cardBody: '#202020',
  cardFooter: '#1A1A1A',
  mainText: '#CBCBCB',
  accentText: '#FF9A6D',
  white: '#FFFFFF',
} as const;

export interface AddMoreCardProps {
  /** Label text to display in the card body (default: "Setup your payment method to start") */
  label?: string;
  /** Footer label text (default: "+ NEW PAYMENT") */
  footerLabel?: string;
  /** Callback when the card is pressed */
  onPress?: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

function AddMoreCardComponent({
  label = 'Setup your payment method to start',
  footerLabel = '+ NEW PAYMENT',
  onPress,
  style,
  testID,
}: AddMoreCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig.snappy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig.snappy);
  };

  const handlePress = () => {
    onPress?.();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Add new payment method"
      accessibilityHint="Tap to add a new payment method"
    >
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Content Area - Centered */}
          <View style={styles.contentArea}>
            {/* Plus Symbol */}
            <Text style={styles.plusSymbol}>+</Text>

            {/* Main Text */}
            <View style={styles.textContainer}>
              <Text style={styles.mainText}>
                {label}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerContent}>
            <Text style={styles.footerLabel}>{footerLabel}</Text>
          </View>
          {/* Footer icon placeholder */}
          <View style={styles.flentLogoPlaceholder} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 270,
    height: 408,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: {
    width: 270,
    height: 344,
    backgroundColor: CARD_COLORS.cardBody,
    paddingTop: 24,
    paddingRight: 32,
    paddingBottom: 24,
    paddingLeft: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentArea: {
    width: 206,
    gap: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusSymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 32,
    lineHeight: 40,
    color: CARD_COLORS.mainText,
    textAlign: 'center',
  },
  textContainer: {
    gap: 8,
  },
  mainText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: CARD_COLORS.mainText,
    textAlign: 'center',
  },
  cardFooter: {
    width: 270,
    height: 64,
    backgroundColor: CARD_COLORS.cardFooter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingRight: 32,
    paddingBottom: 24,
    paddingLeft: 32,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.accentText,
  },
  flentLogoPlaceholder: {
    width: 20,
    height: 24,
  },
});

export const AddMoreCard = memo(AddMoreCardComponent);
