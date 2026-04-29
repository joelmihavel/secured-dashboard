/**
 * BenefitsCarousel — "Your benefits with secured"
 * Figma Reference: 4109:24285
 *
 * Horizontal scrolling carousel of 4 ticket-shaped benefit cards.
 * Each card shows a Flent logo, description text, and "Live Now"/"Coming Soon" badge.
 */

import React, { memo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text as RNText,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Logo } from '@/src/components';
import { colors } from '@/src/theme/colors';
import { s, sv } from '@/src/theme/scale';

// ============================================
// CARD DATA
// ============================================

interface BenefitCardData {
  id: string;
  text: string;
  status: 'live' | 'coming_soon';
}

const BENEFITS: BenefitCardData[] = [
  { id: '1', text: '1% cashback on timely rental payment', status: 'live' },
  { id: '2', text: 'Zero Security Deposits', status: 'coming_soon' },
  { id: '3', text: 'Guaranteed tenant replacement on your exit', status: 'live' },
  { id: '4', text: 'Rental home design at zero service fee', status: 'coming_soon' },
];

// ============================================
// FIGMA CONSTANTS
// ============================================

const CARD_WIDTH = s(244);
const CARD_HEIGHT = sv(321);
const CARD_GAP = s(16);
const PERF_COUNT = 13;
const PERF_SIZE = s(14);
const PERF_SPACING = s(20);
const PERF_START_X = s(4);

// ============================================
// DECORATIVE PAPERCLIP SVG
// ============================================

function PaperclipSvg() {
  return (
    <Svg width={s(23)} height={sv(41)} viewBox="0 0 40 77" fill="none">
      <Path
        d="M9.31406 43.5656C6.31081 33.3271 2.93346 23.1227 0.285513 12.7861C-1.78135 4.71751 7.79641 -3.42527 15.3453 1.49182C17.5802 2.94776 18.5578 5.21169 19.3025 7.63414C20.6419 11.9912 21.8696 16.3857 23.1526 20.7596C26.1163 30.8633 29.4203 40.9296 32.0592 51.1234C34.6064 60.963 20.0241 64.5599 16.576 55.3506C12.9734 45.7289 18.4379 62.0525 15.5448 52.1895C15.1031 50.6838 17.4422 49.995 17.8845 51.5031C20.2408 59.5361 14.8808 40.9086 17.237 48.9413C17.8825 51.1418 18.2536 53.9553 19.5012 55.9455C22.7183 61.0772 31.1521 57.6639 29.7195 51.8099C27.7818 43.892 25.1069 36.085 22.8129 28.2646C20.78 21.3339 19.1796 14.0605 16.6596 7.28701C14.3132 0.980362 4.88219 1.41027 2.64005 7.80349C1.92735 9.836 2.31652 11.0471 2.86679 12.923C5.38623 21.5121 7.90574 30.1015 10.4252 38.6908C12.9447 47.2799 15.4643 55.8695 17.9837 64.4586C19.0499 68.0934 20.2951 72.0847 24.0086 73.814C28.2291 75.7798 34.0983 73.668 36.3873 69.7526C39.6346 64.1975 34.903 54.4459 33.3132 49.0261C30.7428 40.2632 28.1724 31.5005 25.6021 22.7378C25.1604 21.2321 27.4995 20.5435 27.9419 22.0514C30.7573 31.6495 33.5726 41.2475 36.3881 50.8458C38.1118 56.722 41.8552 64.5717 38.7363 70.558C36.7426 74.3842 32.1956 76.8618 27.9219 76.9942C22.4104 77.165 18.5051 73.3633 16.6564 68.4303C13.6442 60.3937 11.7275 51.7934 9.31406 43.5656Z"
        fill={colors.black[400]}
      />
    </Svg>
  );
}

// ============================================
// HALFTONE PIN MARKER — Figma 4837:78083
// Orange dotted "cross" with decreasing dot sizes radiating from the
// centre, matching the stippled sparkle on the benefit cards. Drawn in
// a 28×28 viewBox so the rendered size is controlled by the wrapper.
// ============================================

function HalftonePin({ size = 28 }: { size?: number }) {
  const c = colors.brand[500];
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Centre cluster */}
      <Circle cx={14} cy={14} r={2.4} fill={c} />
      {/* North arm */}
      <Circle cx={14} cy={11} r={2} fill={c} />
      <Circle cx={14} cy={8} r={1.5} fill={c} />
      <Circle cx={14} cy={5} r={1} fill={c} />
      <Circle cx={14} cy={2.5} r={0.6} fill={c} />
      {/* South arm */}
      <Circle cx={14} cy={17} r={2} fill={c} />
      <Circle cx={14} cy={20} r={1.5} fill={c} />
      <Circle cx={14} cy={23} r={1} fill={c} />
      <Circle cx={14} cy={25.5} r={0.6} fill={c} />
      {/* East arm */}
      <Circle cx={17} cy={14} r={2} fill={c} />
      <Circle cx={20} cy={14} r={1.5} fill={c} />
      <Circle cx={23} cy={14} r={1} fill={c} />
      <Circle cx={25.5} cy={14} r={0.6} fill={c} />
      {/* West arm */}
      <Circle cx={11} cy={14} r={2} fill={c} />
      <Circle cx={8} cy={14} r={1.5} fill={c} />
      <Circle cx={5} cy={14} r={1} fill={c} />
      <Circle cx={2.5} cy={14} r={0.6} fill={c} />
      {/* Diagonal satellites */}
      <Circle cx={11} cy={11} r={0.9} fill={c} />
      <Circle cx={17} cy={11} r={0.9} fill={c} />
      <Circle cx={11} cy={17} r={0.9} fill={c} />
      <Circle cx={17} cy={17} r={0.9} fill={c} />
    </Svg>
  );
}

// ============================================
// SCRATCH MARKS — same vector pair used on the landlord intro cards.
// Two parallel diagonal lines, drawn at the two Figma-specified offsets
// per card: (left:44, top:28) and (left:194, top:63).
// ============================================

function ScratchMarks() {
  return (
    <Svg width={s(20.5)} height={sv(35)} viewBox="0 0 20.7132 35.2132" fill="none">
      <Path d="M20.6066 0.106586L0.106586 20.6066" stroke={colors.black[400]} strokeWidth={0.3} />
      <Path d="M20.6066 14.6066L0.106586 35.1066" stroke={colors.black[400]} strokeWidth={0.3} />
    </Svg>
  );
}

// ============================================
// SINGLE BENEFIT CARD
// ============================================

function BenefitCard({ item }: { item: BenefitCardData }) {
  const isLive = item.status === 'live';

  return (
    <View style={cardStyles.container}>
      {/* Card background */}
      <View style={cardStyles.background} />

      {/* Top perforations */}
      {[...Array(PERF_COUNT)].map((_, i) => (
        <View
          key={`p-${i}`}
          style={[
            cardStyles.perforation,
            { left: PERF_START_X + i * PERF_SPACING, top: -PERF_SIZE / 2 },
          ]}
        />
      ))}

      {/* Paperclip decoration — top left */}
      <View style={cardStyles.paperclip}>
        <PaperclipSvg />
      </View>

      {/* Two scratch-mark decorations — Figma layout per card:
          (left:44, top:28) and (left:194, top:63). */}
      <View style={cardStyles.scratchA} pointerEvents="none">
        <ScratchMarks />
      </View>
      <View style={cardStyles.scratchB} pointerEvents="none">
        <ScratchMarks />
      </View>

      {/* Centered content — halftone pin marker + text + Live Now badge */}
      <View style={cardStyles.content}>
        <HalftonePin size={28} />
        <RNText style={cardStyles.description}>{item.text}</RNText>

        <View style={cardStyles.badge}>
          <RNText style={[cardStyles.badgeText, isLive ? cardStyles.badgeLive : cardStyles.badgeComingSoon]}>
            {isLive ? 'Live Now' : 'Coming Soon'}
          </RNText>
        </View>
      </View>
    </View>
  );
}

// ============================================
// CAROUSEL DOTS
// ============================================

function Dots({ activeIndex, count }: { activeIndex: number; count: number }) {
  return (
    <View style={dotStyles.container}>
      {[...Array(count)].map((_, i) => (
        <View
          key={i}
          style={[dotStyles.dot, i === activeIndex && dotStyles.dotActive]}
        />
      ))}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

function BenefitsCarouselComponent({ testID }: { testID?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BenefitCardData>) => <BenefitCard item={item} />,
    [],
  );

  return (
    <View style={styles.section} testID={testID}>
      {/* Title — Figma 4109:24286 */}
      <RNText style={styles.title}>
        <RNText style={styles.titleGray}>Your benefits{'\n'}</RNText>
        <RNText style={styles.titleAccent}>with Secured</RNText>
      </RNText>

      {/* Cards carousel */}
      <FlatList
        data={BENEFITS}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Dots */}
      <Dots activeIndex={activeIndex} count={BENEFITS.length} />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  section: {
    gap: sv(24), // Figma: 24px gap between title and cards
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: s(28), // Figma: Font Size/Heading/h4
    lineHeight: s(40), // Figma: Line Height/Heading/h4
    letterSpacing: -1,
  },
  titleGray: {
    color: '#A9A9A9', // colours/neutral/500
  },
  titleAccent: {
    color: '#FF9A6D', // colours/brand/500
  },
  carouselContent: {
    gap: CARD_GAP,
    paddingRight: 40,
  },
});

const cardStyles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'visible',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black[500], // #202020
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 8,
  },
  perforation: {
    position: 'absolute',
    width: PERF_SIZE,
    height: PERF_SIZE,
    borderRadius: PERF_SIZE / 2,
    backgroundColor: colors.black[700], // #131313
  },
  paperclip: {
    position: 'absolute',
    left: s(8),
    top: sv(-8), // Extends above card edge — pinned look
    transform: [{ rotate: '2.86deg' }], // Figma: rotation 2.856°
  },
  // Two scratch-mark groups — Figma offsets per card.
  scratchA: {
    position: 'absolute',
    left: s(44),
    top: sv(28),
    width: s(20.5),
    height: sv(35),
  },
  scratchB: {
    position: 'absolute',
    left: s(194),
    top: sv(63),
    width: s(20.5),
    height: sv(35),
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(22),
    gap: sv(16),
  },
  description: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: s(16),
    lineHeight: s(24),
    color: '#A9A9A9', // colours/neutral/500
    textAlign: 'center',
    letterSpacing: 0,
  },
  badge: {
    backgroundColor: colors.black[700], // #131313
    paddingHorizontal: s(16),
    paddingVertical: sv(4),
    borderRadius: 200,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: s(12),
    lineHeight: s(20),
  },
  badgeLive: {
    color: '#4CAF50', // colour/icons/success/default
  },
  badgeComingSoon: {
    color: '#FF9A6D', // colours/brand/500
  },
});

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(6),
  },
  dot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: colors.black[400], // #4D4D4D
  },
  dotActive: {
    backgroundColor: colors.brand[500], // #FF9A6D
    width: s(18),
  },
});

export const BenefitsCarousel = memo(BenefitsCarouselComponent);
