/**
 * Onboarding Carousel
 * Figma Nodes: 1-28985 (slide 1), 1-29025 (slide 2), 1-29065 (slide 3)
 *
 * PIXEL-PERFECT Figma Values (from blueprint JSONs 2026-02-19):
 * - Background: #131313 (black.700)
 * - Outer Container (160:2668): column, justifyContent=center, gap=48, paddingTop=80, paddingBottom=64
 * - Inner Container (160:2669): column, gap=40, paddingHorizontal=48, sizingH=FILL, sizingV=FILL
 *   Children: Logo Container, Text Container, Login Text (Skip), Dots Frame
 * - Logo Container: 26.7x32, FIXED sizing
 * - Text Container: column, gap=16, sizingH=FILL, sizingV=HUG
 *   - Heading: single text node, 48/64/Regular/-2, with color spans (see per-slide)
 *   - Body: 14/20/Regular, color varies
 * - Skip: "Skip →", 14/20/Regular, #FFFFFF, "Skip" underlined (span 0-4)
 * - Dots: 3x 8x8 ellipses, gap=4, active=#FF9A6D, inactive=#202020
 *
 * Heading color spans per slide (from blueprint typography.spans):
 * - Slide 1: base=#A9A9A9, span[0,13)="Earn 1% back "=#FF9A6D
 * - Slide 2: base=#A9A9A9, span[11,24)="just cashback"=#FF9A6D (note: double space in content)
 * - Slide 3: base=#FFFFFF, span[0,4)=#A9A9A9, span[5,13)=#A9A9A9, span[14,26)=#FF9A6D
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text as RNText, StyleSheet, Dimensions, FlatList, ViewToken, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text } from '@/src/components';
import { DottedPattern, CarouselDots } from '@/src/components';
import type { BackgroundShapeKey } from '@/src/components/patterns';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Exact Figma color values mapped to theme tokens
const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  headingGray: colors.neutral[500],    // #A9A9A9
  headingWhite: colors.white,          // #FFFFFF
  headingAccent: colors.brand[500],    // #FF9A6D (for accent highlights)
  bodyText: colors.black[200],         // #A6A6A6
  bodyTextAlt: colors.neutral[500],    // #A9A9A9
  skipText: colors.white,              // #FFFFFF
} as const;

// Exact Figma layout values from blueprint extraction
const FIGMA_LAYOUT = {
  // Outer Container (160:2668): paddingTop=80, paddingBottom=64
  outerPaddingTop: 80,
  outerPaddingBottom: 64,
  // Inner Container (160:2669): gap=40, paddingHorizontal=48
  innerGap: 40,
  innerPaddingHorizontal: 48,
  // Text Container (160:2675): gap=16
  textContainerGap: 16,
} as const;

/** A styled segment of heading text with its own color */
interface HeadingSegment {
  text: string;
  color: string;
}

interface Slide {
  id: string;
  /** Full heading content as a single string (Figma: single TEXT node) */
  headingContent: string;
  /** Colored segments derived from Figma typography.spans */
  headingSegments: HeadingSegment[];
  description: string;
  descriptionColor: string;
  backgroundShape: BackgroundShapeKey;
}

// Slide data derived from Figma blueprint typography.spans
// Each heading is ONE text node in Figma with character-level color spans.
// Text wraps naturally at 297px width (393 - 2*48 padding).
const slides: Slide[] = [
  {
    // Figma 1-28985: "Earn 1% back on your rent"
    // base color: #A9A9A9, span[0,13) = #FF9A6D
    id: '1',
    headingContent: 'Earn 1% back on your rent',
    headingSegments: [
      { text: 'Earn 1% back ', color: FIGMA_COLORS.headingAccent },  // #FF9A6D (chars 0-12)
      { text: 'on your rent', color: FIGMA_COLORS.headingGray },     // #A9A9A9 (chars 13-25)
    ],
    description: 'For every timely payment made via UPI, netbanking or credit cards.',
    descriptionColor: FIGMA_COLORS.bodyText,      // #A6A6A6
    backgroundShape: 'carousel1',
  },
  {
    // Figma 1-29025: "More than  just cashback" (double space between "than" and "just")
    // base color: #A9A9A9, span[11,24) = #FF9A6D
    id: '2',
    headingContent: 'More than  just cashback',
    headingSegments: [
      { text: 'More than ', color: FIGMA_COLORS.headingGray },       // #A9A9A9 (chars 0-10)
      { text: ' just cashback', color: FIGMA_COLORS.headingAccent }, // #FF9A6D (chars 11-24, includes leading space)
    ],
    description: 'Keep paying via Secured to unlock exclusive renting benefits over time',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,   // #A9A9A9
    backgroundShape: 'carousel2',
  },
  {
    // Figma 1-29065: "Your landlord benefits too"
    // base color: #FFFFFF, span[0,4)=#A9A9A9, span[5,13)=#A9A9A9, span[14,26)=#FF9A6D
    id: '3',
    headingContent: 'Your landlord benefits too',
    headingSegments: [
      { text: 'Your', color: FIGMA_COLORS.headingGray },             // #A9A9A9 (chars 0-3)
      { text: ' ', color: FIGMA_COLORS.headingGray },                // space between spans
      { text: 'landlord', color: FIGMA_COLORS.headingGray },         // #A9A9A9 (chars 5-12)
      { text: ' ', color: FIGMA_COLORS.headingWhite },               // space (char 13, base color)
      { text: 'benefits too', color: FIGMA_COLORS.headingAccent },   // #FF9A6D (chars 14-25)
    ],
    description: '3 months of rent payments unlock a free vacancy cover for your landlord',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,   // #A9A9A9
    backgroundShape: 'carousel3',
  },
];

export default function CarouselScreen() {
  const router = useRouter();
  const { page } = useLocalSearchParams<{ page?: string }>();

  // Support ?page=1|2|3 for automated testing - parse to 0-indexed
  const initialPage = page ? Math.max(0, Math.min(parseInt(page, 10) - 1, slides.length - 1)) : 0;

  const [activeIndex, setActiveIndex] = useState(initialPage);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to initial page on mount if specified via query param
  useEffect(() => {
    if (page && flatListRef.current) {
      const targetIndex = Math.max(0, Math.min(parseInt(page, 10) - 1, slides.length - 1));
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      }, 100);
    }
  }, [page]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/sign-up');
  }, [router]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderSlide = useCallback(({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      {/* Outer Container (160:2668): column, justifyContent=center, paddingTop=80, paddingBottom=64 */}
      <View style={styles.outerContainer}>
        {/* Inner Container (160:2669): column, gap=40, paddingHorizontal=48, sizingV=FILL */}
        <View style={styles.innerContainer}>
          {/* Logo Container (160:2673): 26.7x32, FIXED sizing */}
          <Logo size={32} />

          {/* Text Container (160:2675): column, gap=16, sizingH=FILL, sizingV=HUG */}
          <View style={styles.textContainer}>
            {/* Heading - single text node with colored spans (Figma: natural word wrap at 297px) */}
            <RNText style={styles.heading}>
              {item.headingSegments.map((segment, index) => (
                <RNText key={index} style={{ color: segment.color }}>
                  {segment.text}
                </RNText>
              ))}
            </RNText>

            {/* Body Text */}
            <Text style={[styles.bodyText, { color: item.descriptionColor }]}>
              {item.description}
            </Text>
          </View>

          {/* Skip Button (169:3202): "Skip →", "Skip" underlined (span 0-4) */}
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>
              <Text inherit style={styles.skipUnderline}>Skip</Text>
              {' \u2192'}
            </Text>
          </TouchableOpacity>

          {/* Dots Frame (160:2678): row, gap=4, 3x 8x8 ellipses */}
          <CarouselDots count={slides.length} activeIndex={activeIndex} />
        </View>
      </View>
    </View>
  ), [activeIndex, handleSkip]);

  // Get current slide's background shape based on active index
  const currentBackgroundShape = slides[activeIndex]?.backgroundShape ?? 'default';

  return (
    <Screen padded={false} testID="carousel-screen">
      {/* Background Pattern - 8% opacity per Figma (opacity-8) */}
      {/* Each carousel slide has a unique Background Shape (silhouette) */}
      <DottedPattern backgroundShape={currentBackgroundShape} />

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        style={styles.flatList}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  // Outer Container (160:2668): column, justifyContent=center, paddingTop=80, paddingBottom=64, gap=48
  // width=393 (FIXED), height=765 (FIXED), y=53 from screen top
  outerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: FIGMA_LAYOUT.outerPaddingTop,      // 80
    paddingBottom: FIGMA_LAYOUT.outerPaddingBottom,  // 64
  },
  // Inner Container (160:2669): column, gap=40, paddingHorizontal=48, sizingH=FILL, sizingV=FILL
  innerContainer: {
    flex: 1,
    gap: FIGMA_LAYOUT.innerGap,                      // 40
    paddingHorizontal: FIGMA_LAYOUT.innerPaddingHorizontal, // 48
  },
  // Text Container (160:2675): column, gap=16, sizingH=FILL, sizingV=HUG
  textContainer: {
    gap: FIGMA_LAYOUT.textContainerGap,              // 16
  },
  // Heading: Figma single TEXT node, 48/64/Regular/-2, wraps naturally at container width
  // Using RNText directly to avoid Text component variant defaults interfering with spans
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  // Body: 14/20/Regular
  bodyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  // Skip: 14/20/Regular, #FFFFFF
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.skipText,
  },
  // Skip "Skip" underline span (chars 0-4, textDecoration=underline)
  skipUnderline: {
    textDecorationLine: 'underline' as const,
  },
});
