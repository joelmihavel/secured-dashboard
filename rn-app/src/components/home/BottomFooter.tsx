/**
 * BottomFooter Component
 * Fixed bottom bar with due date, amount and "Review & pay" button - Figma pixel-perfect
 * Figma Reference: 243-2762, 243-2967, 243-3170, 243-3378, 243-4062
 *
 * Figma Pixel-Perfect Values:
 * - Container (frame_1686557229): width full, height 118, backgroundColor #202020
 *   - paddingTop 16, paddingRight 32, paddingBottom 40, paddingLeft 32
 *   - gap 24, flexDirection row, justifyContent space-between, alignItems center
 * - Due label: fontSize 12, lineHeight 20, fontWeight 700 (Bold), color #A9A9A9
 * - Amount: Rs symbol fontSize 12, numeric portion fontSize 16, fontWeight 600, letterSpacing -0.48, color #EEEEEE
 * - Progress bar (rectangle_140): width 24, height 2, backgroundColor #4D4D4D, borderRadius 200
 * - Button (frame_2095586312): width ~164.5, height 52
 *   - borderColor #FF9A6D, borderWidth 1, borderRadius 8
 *   - paddingVertical 16, paddingHorizontal 16
 *   - shadow: #995C41, offset 0/6, blur 12
 * - Button text: fontSize 14, fontWeight 500, lineHeight 20, color #FFFFFF, textAlign center
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/src/components/ui';

export interface BottomFooterProps {
  dueInDays: number;
  amount: number;
  buttonLabel?: string;
  onPress: () => void;
  disabled?: boolean;
}

function BottomFooterComponent({
  dueInDays,
  amount,
  buttonLabel = 'Review & pay',
  onPress,
  disabled = false,
}: BottomFooterProps) {
  const insets = useSafeAreaInsets();

  const formatAmount = (value: number) => {
    return value.toLocaleString('en-IN');
  };

  // Figma 243-6490: Frame 1686557229 has total height 118px
  // Layout breakdown: progressBar area (~14px) + content paddingTop (16px) + content (~52px) + paddingBottom (40px) = ~122px
  // On devices with safe area, we add extra padding to account for home indicator
  const bottomPadding = 40 + insets.bottom; // Figma base: 40px paddingBottom + safe area

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {/* Top progress bar (white line) */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar} />
      </View>

      <View style={styles.content}>
        {/* Left side - Due info */}
        <View style={styles.leftContent}>
          <Text style={styles.dueLabel}>
            {dueInDays < 0 ? `${Math.abs(dueInDays)} Days Overdue` : `Due in ${dueInDays} Days`}
          </Text>
          {/* Figma 243-6490 node 243:6506: "₹ 32,500" uses single Text with nested spans
              - Style override 5: Rs symbol (fontSize 12)
              - Style override 6: numeric value (fontSize 16)
              Both share: fontWeight 600, letterSpacing -0.48, color #EEEEEE */}
          <Text style={styles.amountBase}>
            <Text style={styles.rupeeSymbol}>{'₹ '}</Text>
            <Text style={styles.amountValue}>{formatAmount(amount)}</Text>
          </Text>
        </View>

        {/* Right side - Button */}
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled}
          style={styles.buttonWrapper}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={disabled ? ['#202020', '#202020'] : ['#202020', '#0d0d0d']}
            locations={[0, 0.9018]}
            style={[styles.button, disabled && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
              {buttonLabel}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#202020', // Figma: #202020 (black[500])
    // No top border in Figma
  },
  progressBarContainer: {
    // Progress indicator at top
    paddingHorizontal: 32, // Figma: paddingHorizontal 32
    paddingTop: 16, // Figma: paddingTop 16
    alignItems: 'center', // Figma: center align the handle
  },
  progressBar: {
    width: 24, // Figma: width 24
    height: 2, // Figma: height 2
    backgroundColor: '#4D4D4D', // Figma: #4D4D4D (black[400])
    borderRadius: 200, // Figma: borderRadius 200
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8, // Figma: 8px gap between handle and content (16 + 2 + 8 + 52 + 40 = 118)
    // paddingBottom handled by container for safe area
    paddingHorizontal: 32, // Figma: paddingHorizontal 32
    gap: 24, // Figma: gap 24
  },
  leftContent: {
    gap: 4,
  },
  dueLabel: {
    // Figma 243-3378: Due label text
    // Figma nodes: 243:2954, 243:6477 "Due in X Days"
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 12, // Figma: fontSize 12
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '700', // Figma: fontWeight 700 (Bold)
    color: '#A9A9A9', // Figma: #A9A9A9 (neutral[500])
    textAlign: 'left', // Figma: left-aligned label in left content block
  },
  // Amount text: "₹ 32,500" - Figma: single Text with nested spans for different sizes
  // Uses nested <Text> to keep on single line with mixed font sizes
  amountBase: {
    // Base styles inherited by children
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontWeight: '600', // Figma: fontWeight 600
    letterSpacing: -0.48, // Figma: letterSpacing -0.48
    color: '#EEEEEE', // Figma: #EEEEEE (neutral[100])
  },
  rupeeSymbol: {
    fontSize: 12, // Figma: fontSize 12 (style override 5)
    // Inherits fontWeight, letterSpacing, color from parent
  },
  amountValue: {
    fontSize: 16, // Figma: fontSize 16 (style override 6 for numeric portion - 243:6506)
    // Inherits fontWeight, letterSpacing, color from parent
  },
  buttonWrapper: {
    minWidth: 164.5, // Figma: width ~164.5
  },
  button: {
    height: 52, // Figma: height 52
    paddingVertical: 16, // Figma: paddingVertical 16
    paddingHorizontal: 16, // Figma: paddingHorizontal 16
    borderRadius: 8, // Figma: borderRadius 8
    borderWidth: 0.1, // Figma I243:3367;100:1564: borderWidth 0.1
    borderColor: '#FF9A6D', // Figma: #FF9A6D (brand[500])
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow - Figma: #995C41, offset 0/6, blur 12, spread -2
    shadowColor: '#995C41',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    borderColor: '#4D4D4D', // Figma: #4D4D4D
    shadowOpacity: 0,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14, // Figma: fontSize 14
    fontWeight: '500', // Figma: fontWeight 500
    lineHeight: 20, // Figma: lineHeight 20
    color: '#FFFFFF', // Figma: #FFFFFF
    textAlign: 'center',
  },
  buttonTextDisabled: {
    color: '#878787', // Figma: #878787
  },
});

export const BottomFooter = memo(BottomFooterComponent);
