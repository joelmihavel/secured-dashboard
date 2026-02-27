/**
 * WarningBanner Component
 * Warning/error banner for overdue/missed states - Figma pixel-perfect
 * Figma Reference: 243-3378 (missed payment state)
 *
 * Figma Pixel-Perfect Values (from 243-3378):
 * - Wrapper (Frame 2095586467 - 243:3380): width 393, height 36
 *   - paddingRight 32, paddingLeft 64 (from screen edge)
 *   - gap 10
 * - Container (Frame 2095586455 - 243:3381): width 297, height 36
 *   - backgroundColor #1A1A1A, borderRadius 12
 *   - paddingVertical 8, paddingHorizontal 12, gap 10
 * - Text (243:3382): width 227, height 20
 *   - fontSize 12, fontWeight 400, lineHeight 20
 *   - color #FF9A6D, textAlign center
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Pill } from '@/src/components/ui/Pill';

export type WarningType = 'late' | 'missed' | 'multiple';

export interface WarningBannerProps {
  type: WarningType;
  customMessage?: string;
}

const warningConfig = {
  late: {
    // Figma 243-3170: overdue warning
    text: '\u26A0\uFE0F Cashback may be impacted if delayed further',
    textColor: '#FF9A6D', // Figma: #FF9A6D (colors.brand[500])
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (colors.black[600])
  },
  missed: {
    // Figma 243-3378 node 243:3382: exact text from Figma
    text: '\u26A0\uFE0F Your payment streak has been broken',
    textColor: '#FF9A6D', // Figma 243:3382: #FF9A6D (colors.brand[500])
    backgroundColor: '#1A1A1A', // Figma 243:3381: #1A1A1A (colors.black[600])
  },
  multiple: {
    text: '\u26A0\uFE0F Account benefits may be restricted',
    textColor: '#FF9A6D', // Figma: #FF9A6D (colors.brand[500])
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A (colors.black[600])
  },
};

function WarningBannerComponent({ type, customMessage }: WarningBannerProps) {
  const config = warningConfig[type];
  const displayText = customMessage || config.text;

  return (
    <View style={styles.wrapper}>
      <Pill
        text={displayText}
        variant="muted"
        textColor={config.textColor}
        backgroundColor={config.backgroundColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
});

export const WarningBanner = memo(WarningBannerComponent);
export type { WarningType as WarningBannerType };
