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
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/src/theme/colors';
import { s, sv } from '@/src/theme/scale';

// ============================================
// CARD DATA
// ============================================

interface BenefitCardData {
  id: string;
  text: string;
  status: 'live' | 'coming_soon';
  icon: React.ReactNode;
}

// Icon→position mapping follows the order you specified: 1→Cashback,
// 2→Exit, 3→HouseSparkle, 4→Building, 5→Bank.
const BENEFITS: BenefitCardData[] = [
  { id: '1', text: '1% cashback on timely rental payment', status: 'live', icon: <CashbackIcon /> },
  { id: '2', text: 'Get ₹15,000 cash when you move out', status: 'live', icon: <ExitIcon /> },
  { id: '3', text: 'Zero Security Deposits', status: 'coming_soon', icon: <HouseSparkleIcon /> },
  { id: '4', text: 'Guaranteed tenant replacement on your exit', status: 'live', icon: <BuildingIcon /> },
  { id: '5', text: 'Rental home design at zero service fee', status: 'coming_soon', icon: <BankIcon /> },
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
// PER-CARD ICONS (32×32, brand-orange stroke 2px, round caps & joins).
// One distinct icon per benefit card — replaces the previous shared
// halftone-cross sparkle so each card's intent reads at a glance.
// ============================================

const ICON_STROKE = colors.brand[500];
const ICON_PROPS = {
  stroke: ICON_STROKE,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
};

/** Card 1 — coin / piggy-bank silhouette. Pairs with "1% cashback". */
function CashbackIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M20 14.6667V14.6801" {...ICON_PROPS} />
      <Path d="M6.89841 11.1705C6.31361 10.7211 5.86446 10.1187 5.60062 9.4299C5.33678 8.74114 5.26851 7.99283 5.40336 7.2677C5.53821 6.54256 5.87093 5.86883 6.36474 5.32096C6.85856 4.7731 7.49424 4.37244 8.20152 4.16326C8.90881 3.95408 9.66016 3.94453 10.3725 4.13567C11.0849 4.32681 11.7306 4.71119 12.2381 5.24633C12.7457 5.78147 13.0954 6.44654 13.2487 7.16801C13.4019 7.88949 13.3527 8.63928 13.1064 9.33453" {...ICON_PROPS} />
      <Path d="M21.334 5.33325V10.4039C22.9842 11.3587 24.2405 12.8698 24.878 14.6666H26.666C27.0196 14.6666 27.3588 14.8071 27.6088 15.0571C27.8589 15.3072 27.9993 15.6463 27.9993 15.9999V18.6666C27.9993 19.0202 27.8589 19.3593 27.6088 19.6094C27.3588 19.8594 27.0196 19.9999 26.666 19.9999H24.8767C24.4287 21.2666 23.6673 22.3999 22.666 23.2973V25.9999C22.666 26.5304 22.4553 27.0391 22.0802 27.4141C21.7051 27.7892 21.1964 27.9999 20.666 27.9999C20.1356 27.9999 19.6269 27.7892 19.2518 27.4141C18.8767 27.0391 18.666 26.5304 18.666 25.9999V25.2226C18.2254 25.2964 17.7794 25.3334 17.3327 25.3333H11.9993C11.5526 25.3334 11.1066 25.2964 10.666 25.2226V25.9999C10.666 26.5304 10.4553 27.0391 10.0802 27.4141C9.70514 27.7892 9.19644 27.9999 8.666 27.9999C8.13557 27.9999 7.62686 27.7892 7.25179 27.4141C6.87672 27.0391 6.666 26.5304 6.666 25.9999V23.3333V23.2973C5.45795 22.2172 4.60637 20.7958 4.22398 19.2211C3.84159 17.6464 3.94642 15.9927 4.52459 14.4789C5.10276 12.9651 6.12702 11.6625 7.46178 10.7437C8.79655 9.82484 10.3789 9.33299 11.9993 9.33325H15.3327L21.3327 5.33325" {...ICON_PROPS} />
    </Svg>
  );
}

/** Card 2 — exit/door with arrow. */
function ExitIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M17.334 16V16.0133" {...ICON_PROPS} />
      <Path d="M4 28H28" {...ICON_PROPS} />
      <Path d="M6.66602 28V6.66667C6.66602 5.95942 6.94697 5.28115 7.44706 4.78105C7.94716 4.28095 8.62544 4 9.33268 4H19.3327M22.666 18V28" {...ICON_PROPS} />
      <Path d="M18.666 9.33325H27.9993M27.9993 9.33325L23.9993 5.33325M27.9993 9.33325L23.9993 13.3333" {...ICON_PROPS} />
    </Svg>
  );
}

/** Card 3 — house with sparkle accent. */
function HouseSparkleIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M6.66667 16H4L16 4L26.1813 14.1813" {...ICON_PROPS} />
      <Path d="M6.66602 16V25.3333C6.66602 26.0406 6.94697 26.7189 7.44706 27.219C7.94716 27.719 8.62544 28 9.33268 28H15.9993" {...ICON_PROPS} />
      <Path d="M12 27.9999V19.9999C12 19.2927 12.281 18.6144 12.781 18.1143C13.2811 17.6142 13.9594 17.3333 14.6667 17.3333H16.6667" {...ICON_PROPS} />
      <Path d="M29.3333 21.3333C29.3333 26.6666 26 29.3333 24.6667 29.3333C23.3333 29.3333 20 26.6666 20 21.3333C21.3333 21.3333 23.3333 20.6666 24.6667 19.3333C26 20.6666 28 21.3333 29.3333 21.3333Z" {...ICON_PROPS} />
    </Svg>
  );
}

/** Card 4 — apartment building with windows. */
function BuildingIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M4 28H28" {...ICON_PROPS} />
      <Path d="M12 10.6667H13.3333" {...ICON_PROPS} />
      <Path d="M12 16H13.3333" {...ICON_PROPS} />
      <Path d="M12 21.3333H13.3333" {...ICON_PROPS} />
      <Path d="M18.666 10.6667H19.9993" {...ICON_PROPS} />
      <Path d="M18.666 16H19.9993" {...ICON_PROPS} />
      <Path d="M18.666 21.3333H19.9993" {...ICON_PROPS} />
      <Path d="M6.66602 28V6.66667C6.66602 5.95942 6.94697 5.28115 7.44706 4.78105C7.94716 4.28095 8.62544 4 9.33268 4H22.666C23.3733 4 24.0515 4.28095 24.5516 4.78105C25.0517 5.28115 25.3327 5.95942 25.3327 6.66667V28" {...ICON_PROPS} />
    </Svg>
  );
}

/** Card 5 — bank/government building with archway. */
function BankIcon({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M6.66602 13.3333V8C6.66602 6.93913 7.08744 5.92172 7.83759 5.17157C8.58773 4.42143 9.60515 4 10.666 4H21.3327C22.3935 4 23.411 4.42143 24.1611 5.17157C24.9113 5.92172 25.3327 6.93913 25.3327 8V13.3333" {...ICON_PROPS} />
      <Path d="M21.3327 19.9999V17.3333C21.3327 16.5421 21.5673 15.7688 22.0068 15.111C22.4463 14.4532 23.071 13.9405 23.802 13.6377C24.5329 13.335 25.3371 13.2558 26.113 13.4101C26.889 13.5645 27.6017 13.9454 28.1611 14.5048C28.7205 15.0642 29.1015 15.777 29.2558 16.5529C29.4102 17.3288 29.331 18.1331 29.0282 18.864C28.7255 19.5949 28.2128 20.2196 27.555 20.6591C26.8972 21.0987 26.1238 21.3333 25.3327 21.3333V25.3333H6.66602V21.3333C5.87489 21.3333 5.10153 21.0987 4.44374 20.6591C3.78594 20.2196 3.27325 19.5949 2.9705 18.864C2.66775 18.1331 2.58854 17.3288 2.74288 16.5529C2.89722 15.777 3.27818 15.0642 3.83759 14.5048C4.397 13.9454 5.10973 13.5645 5.88566 13.4101C6.66158 13.2558 7.46585 13.335 8.19675 13.6377C8.92766 13.9405 9.55237 14.4532 9.9919 15.111C10.4314 15.7688 10.666 16.5421 10.666 17.3333V19.9999" {...ICON_PROPS} />
      <Path d="M10.666 16H21.3327" {...ICON_PROPS} />
      <Path d="M9.33398 25.3333V27.9999" {...ICON_PROPS} />
      <Path d="M22.666 25.3333V27.9999" {...ICON_PROPS} />
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

      {/* Centered content — per-card icon + text + Live Now badge */}
      <View style={cardStyles.content}>
        {item.icon}
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
