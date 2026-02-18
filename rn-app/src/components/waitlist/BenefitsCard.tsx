/**
 * Benefits Card Component - Pixel Perfect Figma Implementation
 *
 * Source: figma-parity/data/ai-enhanced/41-11206/enhanced-extraction.json
 *
 * Figma Node References:
 * - 41:11255: Frame 2095586390 (card container) - 313x342, #202020, borderRadius 12
 * - 41:11256: Frame 2095586391 (inner content) - 265x278, gap 30
 * - 41:11257: Frame 1686557311 (title container) - 265x80, gap 10, centered
 * - 41:11258: "What do you get with Flent Secured?" - fontSize 28, mixed colors
 * - 41:11259: Frame 2095586329 (benefits list) - 265x168, gap 24
 * - 41:11260/66/72: Benefit rows - 265x40, gap 16
 * - 41:11261: Icon frame - 52.5x40, filmstrip style with brackets
 * - 41:11265/71/77: Benefit text - fontSize 12, color #A9A9A9
 */

import React, { memo } from 'react';
import { View, StyleSheet, Text as RNText, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Benefit card icon exported from Figma
const BENEFIT_ICON = require('@/assets/images/icons/benefit_card_icon.png');

// ============================================
// FIGMA EXTRACTED CONSTANTS
// All values from enhanced-extraction.json
// ============================================

const FIGMA = {
  // Card container (node 41:11255)
  // computedStyles: width 313, height 342, borderRadius 12
  // padding: 32/24/32/24, gap 24
  card: {
    width: 313,
    height: 342,
    borderRadius: 12, // radius.lg
    paddingTop: 32, // spacing[8]
    paddingBottom: 32,
    paddingHorizontal: 24, // spacing[6]
    gap: 24, // spacing[6]
  },

  // Inner content frame (node 41:11256)
  // From Figma extraction line 5551: itemSpacing: 30
  content: {
    width: 265,
    height: 278,
    gap: 30, // Gap between title and benefits list - VERIFIED from Figma
  },

  // Title container (node 41:11257)
  titleContainer: {
    width: 265,
    height: 80,
    gap: 10,
  },

  // Title text (node 41:11258)
  // style: fontSize 28, lineHeight 40, letterSpacing -1
  titleText: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '400' as const,
    fontFamily: 'PlusJakartaSans-Regular',
    letterSpacing: -1,
  },

  // Benefits list container (node 41:11259)
  benefitsList: {
    width: 265,
    height: 168,
    gap: 24, // spacing[6]
  },

  // Benefit row (nodes 41:11260, 41:11266, 41:11272)
  // computedStyles: width 265, height 40, gap 16
  benefitRow: {
    width: 265,
    height: 40,
    gap: 16, // spacing.lg
  },

  // Icon frame (nodes 41:11261, 41:11267, 41:11273)
  // computedStyles: width 52.52, height 40
  iconFrame: {
    width: 52.5,
    height: 40,
  },

  // Bracket vectors (nodes 41:11262, 41:11264)
  bracket: {
    width: 6.72,
    height: 40,
    strokeWidth: 1,
  },

  // Inner image (nodes 41:11263, 41:11269, 41:11275)
  iconImage: {
    width: 39,
    height: 39,
  },

  // Benefit text (nodes 41:11265, 41:11271, 41:11277)
  // computedStyles: fontSize 12, lineHeight 20, letterSpacing 0
  benefitText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '400' as const,
    fontFamily: 'PlusJakartaSans-Regular',
    letterSpacing: 0,
  },

  // Colors from Figma with design token mappings
  colors: {
    // Card background: #202020 → colors.black[500]
    // VariableID:e3cb66c05a62a8680357c6bba79620d8a57e6f10
    cardBackground: '#202020',

    // Title gray part: #A9A9A9 → colors.neutral[500]
    // VariableID:a30255c279da5be0e3281358b6555fa3fed99370
    // styleOverrideTable "41"
    titleGray: '#A9A9A9',

    // Title orange part: #FF9A6D → colors.brand[500]
    // VariableID:0fd77850f1e95a3b4b9c0b7b04fa3f11a2f4a424
    // styleOverrideTable "39"
    titleOrange: '#FF9A6D',

    // Benefit text: #A9A9A9 → colors.neutral[500]
    // Same as titleGray
    benefitText: '#A9A9A9',

    // Bracket stroke: #444444 (r: 0.2666666)
    // VariableID:5288c05dc1d19fb198ed847e73b73491e3ad705b
    bracketStroke: '#444444',
  },
} as const;

// ============================================
// TYPES
// ============================================

export type BenefitsCardVariant = 'benefits' | 'rejected';

export interface BenefitsCardProps {
  variant?: BenefitsCardVariant;
  items?: string[];
  testID?: string;
}

// Default benefit texts from extraction
const DEFAULT_BENEFITS = [
  'Earn 1% back for paying rent on time',
  'Build a stronger rent history',
  'Unlock exclusive renting benefits over time',
];

const DEFAULT_REJECTION_REASONS = [
  "You're renting outside Bangalore",
  'You did not use an invite code.',
  "Your rent agreement didn't qualify.",
];

// ============================================
// FILMSTRIP BRACKET COMPONENT
// Renders the [ ] brackets around the icon
// ============================================

interface FilmstripBracketProps {
  side: 'left' | 'right';
}

function FilmstripBracket({ side }: FilmstripBracketProps) {
  // Vector path for bracket - curved line
  const path = side === 'left'
    ? 'M6.72 0 C3 0 0 3 0 6.72 L0 33.28 C0 37 3 40 6.72 40'
    : 'M0 0 C3.72 0 6.72 3 6.72 6.72 L6.72 33.28 C6.72 37 3.72 40 0 40';

  return (
    <Svg
      width={FIGMA.bracket.width}
      height={FIGMA.bracket.height}
      viewBox={`0 0 ${FIGMA.bracket.width} ${FIGMA.bracket.height}`}
      style={{ overflow: 'visible' }}
    >
      <Path
        d={path}
        stroke={FIGMA.colors.bracketStroke}
        strokeWidth={FIGMA.bracket.strokeWidth}
        fill="none"
      />
    </Svg>
  );
}

// ============================================
// BENEFIT ITEM COMPONENT
// ============================================

interface BenefitItemProps {
  text: string;
  index: number;
}

function BenefitItem({ text, index }: BenefitItemProps) {
  return (
    <View style={styles.benefitRow}>
      {/* Icon frame with filmstrip brackets */}
      <View style={styles.iconFrame}>
        {/* Left bracket */}
        <FilmstripBracket side="left" />

        {/* Center image (39x39) - Figma asset exported */}
        <View style={styles.iconImageContainer}>
          <Image
            source={BENEFIT_ICON}
            style={styles.iconImage}
            resizeMode="contain"
          />
        </View>

        {/* Right bracket */}
        <FilmstripBracket side="right" />
      </View>

      {/* Benefit text - fontSize 12, color #A9A9A9 */}
      <RNText style={styles.benefitText}>{text}</RNText>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

function BenefitsCardComponent({
  variant = 'benefits',
  items,
  testID,
}: BenefitsCardProps) {
  const displayItems = items || (variant === 'benefits' ? DEFAULT_BENEFITS : DEFAULT_REJECTION_REASONS);

  // Title text based on variant
  // For "benefits": "What do you get " (gray) + "with Flent Secured?" (orange)
  // For "rejected": "Why was I " (gray) + "Rejected?" (orange)
  const titleParts = variant === 'benefits'
    ? { gray: 'What do you get', orange: '\nwith Flent Secured?' }
    : { gray: 'Why was I', orange: '\nRejected?' };

  return (
    <View style={styles.card} testID={testID}>
      {/* Title section - centered, mixed colors */}
      <View style={styles.titleContainer}>
        <RNText style={styles.titleText}>
          <RNText style={styles.titleGray}>{titleParts.gray}</RNText>
          <RNText style={styles.titleOrange}>{titleParts.orange}</RNText>
        </RNText>
      </View>

      {/* Benefits list */}
      <View style={styles.benefitsList}>
        {displayItems.map((item, index) => (
          <BenefitItem key={index} text={item} index={index} />
        ))}
      </View>
    </View>
  );
}

// ============================================
// STYLES - Exact Figma values
// ============================================

const styles = StyleSheet.create({
  // Card container - 313x342, borderRadius 12, padding 32/24
  // Node 41:11255
  card: {
    width: FIGMA.card.width,
    backgroundColor: FIGMA.colors.cardBackground,
    borderRadius: FIGMA.card.borderRadius,
    paddingTop: FIGMA.card.paddingTop,
    paddingBottom: FIGMA.card.paddingBottom,
    paddingHorizontal: FIGMA.card.paddingHorizontal,
    // Inner content gap is 30 (between title and benefits list)
    // Card padding gap is 24 from node 41:11255
    gap: FIGMA.content.gap, // 30px - gap between title and benefits list
  },

  // Title container - 265x80, centered
  // Node 41:11257
  titleContainer: {
    width: FIGMA.titleContainer.width,
    minHeight: FIGMA.titleContainer.height,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Title text base styles
  titleText: {
    fontFamily: FIGMA.titleText.fontFamily,
    fontSize: FIGMA.titleText.fontSize,
    lineHeight: FIGMA.titleText.lineHeight,
    fontWeight: FIGMA.titleText.fontWeight,
    letterSpacing: FIGMA.titleText.letterSpacing,
    textAlign: 'center',
  },

  // Title gray part - "What do you get" or "Why was I"
  // styleOverrideTable "41": color #A9A9A9
  titleGray: {
    color: FIGMA.colors.titleGray,
  },

  // Title orange part - "with Flent Secured?" or "Rejected?"
  // styleOverrideTable "39": color #FF9A6D
  titleOrange: {
    color: FIGMA.colors.titleOrange,
  },

  // Benefits list container - 265x168, gap 24
  // Node 41:11259
  benefitsList: {
    width: FIGMA.benefitsList.width,
    gap: FIGMA.benefitsList.gap,
  },

  // Benefit row - 265x40, gap 16, alignItems center
  // Nodes 41:11260, 41:11266, 41:11272
  benefitRow: {
    width: FIGMA.benefitRow.width,
    height: FIGMA.benefitRow.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: FIGMA.benefitRow.gap,
  },

  // Icon frame - 52.5x40, horizontal layout
  // Nodes 41:11261, 41:11267, 41:11273
  iconFrame: {
    width: FIGMA.iconFrame.width,
    height: FIGMA.iconFrame.height,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Icon image container (between brackets)
  iconImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Icon image - 39x39 (Figma asset)
  // Nodes 41:11263, 41:11269, 41:11275
  iconImage: {
    width: FIGMA.iconImage.width,
    height: FIGMA.iconImage.height,
  },

  // Benefit text - fontSize 12, lineHeight 20, color #A9A9A9
  // Nodes 41:11265, 41:11271, 41:11277
  benefitText: {
    flex: 1,
    fontFamily: FIGMA.benefitText.fontFamily,
    fontSize: FIGMA.benefitText.fontSize,
    lineHeight: FIGMA.benefitText.lineHeight,
    fontWeight: FIGMA.benefitText.fontWeight,
    letterSpacing: FIGMA.benefitText.letterSpacing,
    color: FIGMA.colors.benefitText,
  },
});

export const BenefitsCard = memo(BenefitsCardComponent);
