/**
 * Payment Method Row Component
 * Figma: Payment method selection with radio button
 *
 * From 41-9004, 41-9114 Figma analysis:
 * - Selected: brand.500 #FF9A6D border, light bg
 * - Title: D2D2D2 (neutral), 14px medium
 * - Fee Free: #70BF73, Fee amount: #A9A9A9
 * - Locked: #4D4D4D
 */

import React, { memo, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../ui/Typography';
import { RadioButton } from './RadioButton';
import { spacing, radius } from '@/src/theme';

// Figma colors from 41-9004 analysis
const FIGMA_COLORS = {
  selectedBg: 'rgba(255, 154, 109, 0.1)',
  selectedBorder: '#FF9A6D',    // brand.500
  defaultBorder: '#4D4D4D',     // black.400
  iconDefault: '#FFFFFF',       // white
  iconLocked: '#4D4D4D',        // black.400
  titleText: '#D2D2D2',         // Credit Card per Figma
  subtitleText: '#CBCBCB',      // neutral.300
  feeText: '#A9A9A9',           // neutral.500
  freeFee: '#70BF73',           // success.default
  lockedText: '#4D4D4D',        // black.400
};

export type PaymentMethodType = 'upi' | 'card' | 'netbanking';

export interface PaymentMethodRowProps {
  type: PaymentMethodType;
  title: string;
  subtitle?: string;
  fee: string;
  isSelected: boolean;
  isLocked?: boolean;
  lockMessage?: string;
  onPress: () => void;
  testID?: string;
}

// Payment method icon mapping
const PAYMENT_ICONS: Record<PaymentMethodType, keyof typeof Ionicons.glyphMap> = {
  upi: 'link-outline',
  card: 'card-outline',
  netbanking: 'business-outline',
};

function PaymentMethodRowComponent({
  type,
  title,
  subtitle,
  fee,
  isSelected,
  isLocked = false,
  lockMessage,
  onPress,
  testID,
}: PaymentMethodRowProps) {
  const handlePress = useCallback(() => {
    if (!isLocked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [isLocked, onPress]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(
      isSelected && !isLocked ? FIGMA_COLORS.selectedBg : 'transparent',
      { duration: 200 }
    ),
    borderColor: withTiming(
      isSelected && !isLocked ? FIGMA_COLORS.selectedBorder : FIGMA_COLORS.defaultBorder,
      { duration: 200 }
    ),
    borderWidth: withTiming(isSelected && !isLocked ? 1.5 : 1, { duration: 200 }),
  }));

  const iconColor = isLocked ? FIGMA_COLORS.iconLocked : FIGMA_COLORS.iconDefault;
  const textColor = isLocked ? FIGMA_COLORS.lockedText : FIGMA_COLORS.titleText;
  const feeColor = fee === 'Free' || fee === 'No fee'
    ? FIGMA_COLORS.freeFee
    : isLocked
    ? FIGMA_COLORS.lockedText
    : FIGMA_COLORS.feeText;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLocked}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isLocked }}
      accessibilityLabel={`${title}, ${fee}${isLocked ? ', locked' : ''}`}
    >
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        {/* Radio Button */}
        <RadioButton isSelected={isSelected} isLocked={isLocked} />

        {/* Icon */}
        <Ionicons
          name={PAYMENT_ICONS[type]}
          size={20}
          color={iconColor}
          style={styles.icon}
        />

        {/* Title & Subtitle */}
        <View style={styles.textContainer}>
          <Text
            variant="bodyMdMedium"
            style={[styles.title, { color: textColor }]}
          >
            {title}
          </Text>
          {subtitle && isLocked && (
            <Text
              variant="bodySm"
              style={styles.subtitle}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Fee */}
        <Text
          variant="bodyMd2"
          style={[styles.fee, { color: feeColor }]}
        >
          {fee}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FIGMA_COLORS.defaultBorder,  // black.400 #4D4D4D
  },
  icon: {
    marginLeft: spacing.md,
    width: 24,
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.subtitleText,  // neutral.300 #CBCBCB
    marginTop: 2,
  },
  fee: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});

export const PaymentMethodRow = memo(PaymentMethodRowComponent);
