/**
 * HeadlineSection Component
 * "Your rent is due in X days" + "Paying with:" label - Figma pixel-perfect
 * Figma Reference: 243-2762, 243-5870, 243-5872 (Frame 2095586453)
 *
 * Figma Pixel-Perfect Values (from 243:2764 Frame 2095586453):
 * - Container: width 393, height 110, paddingHorizontal 64px
 * - flexDirection: column, justifyContent: center, alignItems: center
 * - gap: 10 between headline and "Paying with:" label
 * - Headline: fontSize 28, lineHeight 40, letterSpacing -1, fontWeight 400
 * - Gray text: #BABABA (neutral[400])
 * - Accent text (days number): #FF9A6D (brand[500])
 * - "Paying with:": fontSize 14, lineHeight 20, color #A6A6A6 (black[200])
 */

import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';

import { colors, typography } from '@/src/theme';

export type HeadlineVariant = 'due' | 'overdue' | 'missed' | 'multiple_overdue';

export interface HeadlineSectionProps {
  variant: HeadlineVariant;
  daysUntilDue?: number;
  daysOverdue?: number;
  missedMonth?: string;
  showPayingWith?: boolean; // Show "Paying with:" label
}

function HeadlineSectionComponent({
  variant,
  daysUntilDue = 10,
  daysOverdue = 0,
  missedMonth = '',
  showPayingWith = true,
}: HeadlineSectionProps) {
  const renderHeadline = () => {
    switch (variant) {
      case 'due':
        return (
          <RNText style={styles.headline}>
            <RNText style={styles.grayText}>Your rent is due{'\n'}in </RNText>
            <RNText style={styles.accentText}>{daysUntilDue} days</RNText>
          </RNText>
        );
      case 'overdue':
        return (
          <RNText style={styles.headline}>
            <RNText style={styles.grayText}>Your rent is overdue by </RNText>
            <RNText style={styles.accentText}>{daysOverdue} days</RNText>
          </RNText>
        );
      case 'missed':
        // Figma 243-3378 node 243:3384: "Your missed your December Rent" (typo in Figma)
        // Text uses mixed colors: gray for "You missed your" + accent for "{month} Rent"
        return (
          <RNText style={styles.headline}>
            <RNText style={styles.grayText}>You missed your{'\n'}</RNText>
            <RNText style={styles.accentText}>{missedMonth} Rent</RNText>
          </RNText>
        );
      case 'multiple_overdue':
        return (
          <RNText style={styles.headline}>
            <RNText style={styles.grayText}>Multiple payments </RNText>
            <RNText style={styles.accentText}>are overdue</RNText>
          </RNText>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderHeadline()}
      {showPayingWith && (
        <RNText style={styles.payingWithLabel}>Paying with:</RNText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Figma 243-3378 node 243:3383 (Frame 2095586453)
    // Exact values: width 393, height auto, gap 10, padding 64/64
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start', // Figma: content flows top-down
    alignItems: 'flex-start', // Figma: LEFT-aligned text content
    gap: 10, // Figma: itemSpacing 10 between headline and "Paying with:"
    paddingLeft: 64, // Figma: paddingLeft 64
    paddingRight: 64, // Figma: paddingRight 64
  },
  headline: {
    // Figma 243-3378 node 243:3384: width 265, height 80
    width: 265, // Figma: width 265px
    fontSize: 28, // Figma: fontSize 28
    lineHeight: 40, // Figma: lineHeight 40
    letterSpacing: -1, // Figma: letterSpacing -1
    fontWeight: '400', // Figma: fontWeight 400
    fontFamily: typography.h4.fontFamily,
    textAlign: 'left', // Figma: textAlignHorizontal LEFT
  },
  grayText: {
    color: '#BABABA', // Figma 243:3384: #BABABA (neutral[400])
  },
  accentText: {
    color: '#FF9A6D', // Figma 243:3384: #FF9A6D (brand[500])
  },
  payingWithLabel: {
    // Figma 243-3378 node 243:3385 "Paying with:"
    width: 265, // Figma: width 265
    height: 20, // Figma: height 20
    fontSize: 14, // Figma: fontSize 14
    lineHeight: 20, // Figma: lineHeight 20
    fontWeight: '400', // Figma: fontWeight 400
    fontFamily: typography.bodyMd2.fontFamily,
    color: '#A6A6A6', // Figma: #A6A6A6 (black[200])
    textAlign: 'left', // Figma: textAlignHorizontal LEFT
  },
});

export const HeadlineSection = memo(HeadlineSectionComponent);
