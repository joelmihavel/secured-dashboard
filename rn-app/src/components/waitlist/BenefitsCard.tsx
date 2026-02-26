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
import { s, sv } from '@/src/theme/scale';

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
    width: s(313),
    height: sv(342),
    borderRadius: sv(12), // radius.lg
    paddingTop: sv(32), // spacing[8]
    paddingBottom: sv(32),
    paddingHorizontal: sv(24), // spacing[6]
    gap: sv(24), // spacing[6]
  },

  // Inner content frame (node 41:11256)
  // From Figma extraction line 5551: itemSpacing: 30
  content: {
    width: sv(265),
    height: sv(278),
    gap: sv(30), // Gap between title and benefits list - VERIFIED from Figma
  },

  // Title container (node 41:11257)
  titleContainer: {
    width: sv(265),
    height: sv(80),
    gap: sv(10),
  },

  // Title text (node 41:11258)
  // style: fontSize 28, lineHeight 40, letterSpacing -1
  titleText: {
    fontSize: sv(28),
    lineHeight: sv(40),
    fontFamily: 'PlusJakartaSans-Regular',
    letterSpacing: -1,
  },

  // Benefits list container (node 41:11259)
  benefitsList: {
    width: sv(265),
    height: sv(168),
    gap: sv(24), // spacing[6]
  },

  // Benefit row (nodes 41: sv(11260), 41: sv(11266), 41:11272)
  // computedStyles: width 265, height 40, gap 16
  benefitRow: {
    width: sv(265),
    height: sv(40),
    gap: sv(16), // spacing.lg
  },

  // Icon frame (nodes 41: sv(11261), 41: sv(11267), 41:11273)
  // computedStyles: width 52.52, height 40
  iconFrame: {
    width: sv(52.5),
    height: sv(40),
  },

  // Bracket vectors (nodes 41: sv(11262), 41:11264)
  bracket: {
    width: sv(6.72),
    height: sv(40),
    strokeWidth: sv(1),
  },

  // Inner image (nodes 41: sv(11263), 41: sv(11269), 41:11275)
  iconImage: {
    width: sv(39),
    height: sv(39),
  },

  // Benefit text (nodes 41: sv(11265), 41: sv(11271), 41:11277)
  // computedStyles: fontSize 12, lineHeight 20, letterSpacing 0
  benefitText: {
    fontSize: sv(12),
    lineHeight: sv(20),
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

export type BenefitsCardVariant = 'benefits' | 'rejected' | 'coming-soon';

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

const DEFAULT_COMING_SOON = [
  'Earn 1% cashback on on-time rent',
  'Build a stronger rent history',
  'Unlock smarter benefits over time',
];

const DEFAULT_REJECTION_REASONS = [
  "You're renting outside Bangalore",
  "You did not use an invite code.",
  "You rent agreement didn't qualify.",
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
  let displayItems = items;
  if (!displayItems) {
    if (variant === 'benefits') displayItems = DEFAULT_BENEFITS;
    else if (variant === 'rejected') displayItems = DEFAULT_REJECTION_REASONS;
    else if (variant === 'coming-soon') displayItems = DEFAULT_COMING_SOON;
    else displayItems = [];
  }

  // Title text based on variant
  // For "benefits": "What do you get " (gray) + "with Flent Secured?" (orange)
  // For "rejected": "Why was I " (gray) + "Rejected?" (orange)
  // For "coming-soon": "What's " (gray) + "\nComing your way?" (orange)
  let titleParts = { gray: '', orange: '' };
  if (variant === 'benefits') {
    titleParts = { gray: 'What do you get', orange: '\nwith Flent Secured?' };
  } else if (variant === 'rejected') {
    titleParts = { gray: 'Why was I', orange: '\nRejected?' };
  } else if (variant === 'coming-soon') {
    titleParts = { gray: 'What\'s', orange: '\nComing your way?' };
  }

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

  // Title container - 265x80
  // Node 41:11257
  titleContainer: {
    width: FIGMA.titleContainer.width,
    minHeight: FIGMA.titleContainer.height,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  // Title text base styles
  titleText: {
    fontFamily: FIGMA.titleText.fontFamily,
    fontSize: FIGMA.titleText.fontSize,
    lineHeight: FIGMA.titleText.lineHeight,
    letterSpacing: FIGMA.titleText.letterSpacing,
    textAlign: 'left',
  },

  // Title gray part - "What do you get" or "Why was I" or "What's"
  // styleOverrideTable "41": color #A9A9A9
  titleGray: {
    color: FIGMA.colors.titleGray,
  },

  // Title orange part - "with Flent Secured?" or "Rejected?" or "\nComing your way?"
  // styleOverrideTable "39": color #FF9A6D
  titleOrange: {
    color: FIGMA.colors.titleOrange,
  },

  // Benefits list container - 265x168, gap 24
  // Node 41:11259 / 41:11389
  benefitsList: {
    width: FIGMA.benefitsList.width,
    gap: FIGMA.benefitsList.gap,
  },

  // Benefit row - 265x40, gap 16, alignItems center
  // Nodes 41: sv(11260), 41: sv(11266), 41:11272
  benefitRow: {
    width: FIGMA.benefitRow.width,
    flexDirection: 'row',
    alignItems: 'center', // Center vertically with icon
    gap: FIGMA.benefitRow.gap,
  },

  // Icon frame - 52.5x40, horizontal layout
  // Nodes 41: sv(11261), 41: sv(11267), 41:11273
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
  // Nodes 41: sv(11263), 41: sv(11269), 41:11275
  iconImage: {
    width: FIGMA.iconImage.width,
    height: FIGMA.iconImage.height,
  },

  // Benefit text - fontSize 12, lineHeight 20, color #A9A9A9
  // Nodes 41: sv(11265), 41: sv(11271), 41:11277
  benefitText: {
    flex: 1,
    fontFamily: FIGMA.benefitText.fontFamily,
    fontSize: FIGMA.benefitText.fontSize,
    lineHeight: FIGMA.benefitText.lineHeight,
    letterSpacing: FIGMA.benefitText.letterSpacing,
    color: FIGMA.colors.benefitText,
    textAlign: 'left',
  },
});

export const BenefitsCard = memo(BenefitsCardComponent);
