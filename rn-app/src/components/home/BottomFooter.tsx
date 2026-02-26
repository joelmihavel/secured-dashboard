/**
 * BottomFooter Component
 * Fixed bottom bar with due date, amount and "Review & pay" button - Figma pixel-perfect
 * Figma Reference: 243-7382 (node data from REST API 2026-02-13)
 *
 * Figma Pixel-Perfect Values (from REST API node 243:7382):
 * - Container (Frame 1686557229): width 393, height 118, fill #202020
 *   - HORIZONTAL layout, SPACE_BETWEEN + CENTER
 *   - padding: top=16, bottom=40, left=32, right=32, gap=24
 * - Left content (243:7383): VERTICAL, gap=4
 *   - Due label (243:7384): fontSize 12, base Regular but override[2] ALL chars = Bold 700, lineHeight 20, color #A9A9A9
 *   - Amount (243:7385): base fontSize 12 weight 600 ls -0.48 color #EEEEEE; override[6] "32,500" fontSize 16
 * - Button wrapper (243:7386): VERTICAL, CENTER, gap=8, radius=12
 *   - Handle bar (I243:7386;137:37): 24x2, fill #4D4D4D, radius=200
 *   - Button (I243:7386;100:1564): 164.5x52, stroke #FF9A6D w=0.1, radius=8
 *     - Text "Review & pay": fontSize 14, weight 500, lineHeight 20, color #FFFFFF
 *
 * Uses s() / sf() scaling utilities for responsive sizing across all screen widths.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, PrimaryButton } from '@/src/components/ui';
import { s, sf } from '@/src/theme/scale';

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

  // Minimal bottom padding — safe area only
  const bottomPadding = Math.max(s(40), insets.bottom); // Figma: bottom 40 padding

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      {/* Left side - Due info */}
      <View style={styles.leftContent}>
        <Text style={styles.dueLabel} numberOfLines={1} ellipsizeMode="tail">
          {dueInDays < 0 ? `${Math.abs(dueInDays)} Days Overdue` : `Due in ${dueInDays} Days`}
        </Text>
        <Text style={styles.amountText} numberOfLines={1} ellipsizeMode="tail">
          <Text inherit style={styles.rupeeSymbol}>{'₹ '}</Text>
          <Text inherit style={styles.amountValue}>{formatAmount(amount)}</Text>
        </Text>
      </View>

      {/* Right side - PrimaryButton with handle bar divider */}
      <View style={styles.buttonColumn}>
        <PrimaryButton
          title={buttonLabel}
          onPress={onPress}
          disabled={disabled}
          showDivider
          fullWidth={false}
          style={styles.footerButton}
          testID="review-pay-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Figma 243-2967 node 243:3155 (Frame 1686557229):
  // HORIZONTAL, SPACE_BETWEEN, CENTER
  // padding: top 16, left 32, right 32, bottom 40 (handled dynamically)
  // fill #202020, top border 1px
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#202020',
    paddingTop: s(16),
    paddingHorizontal: s(32),
    gap: s(24),
    borderTopWidth: 1, // Figma: individualStrokeWeights top=1
    borderTopColor: '#202020', // Figma: subtle top border
  },
  // Figma 243:7383: VERTICAL, gap=4
  leftContent: {
    gap: s(4),
    flex: 1,
  },
  // Figma 243:7384: Bold 700, fontSize 12, lineHeight 20, color #A9A9A9
  dueLabel: {
    fontFamily: 'PlusJakartaSans-Bold', // Figma: fontWeight 700
    fontSize: sf(12),
    lineHeight: sf(20),
    color: '#A9A9A9',
  },
  // Figma 243:7385: base fontSize 12, weight 600, ls -0.48, color #EEEEEE
  amountText: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    letterSpacing: -0.48,
    color: '#EEEEEE',
  },
  // Figma override[7]: stays at base 12
  rupeeSymbol: {
    fontSize: sf(12),
  },
  // Figma override[6]: fontSize 16 for numeric portion
  amountValue: {
    fontSize: sf(16),
  },
  // Button column — houses PrimaryButton
  buttonColumn: {
    alignItems: 'center',
  },
  // PrimaryButton width constraint for footer context
  footerButton: {
    width: s(164.5),
  },
});

export const BottomFooter = memo(BottomFooterComponent);
