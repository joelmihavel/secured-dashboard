/**
 * Onboarding Carousel
 * Figma Nodes: 1-28985, 1-29025, 1-29065
 *
 * PIXEL-PERFECT Figma Values:
 * - Background: #131313 (black.700)
 * - Swatch opacity: 16%
 * - Container width: 297px (content width)
 * - Container padding: 48px horizontal
 * - Logo: 26.7px x 32px (Figma: vector_1 scaled)
 * - Progress bar: full width 393px, height 12px
 * - Progress bar background: #4D4D4D (black.400)
 * - Progress bar fill: #CC7B57 (brand.600), width varies per slide
 * - Heading: Plus Jakarta Sans Regular, 48px, line-height 64px, tracking -2px
 * - Slide 1: Gray heading (#A9A9A9), accent "1%" in heading
 * - Slide 2: Gray heading (#A9A9A9), accent line 2
 * - Slide 3: White heading (#FFFFFF), accent line 2
 * - Body: 14px, line-height 20px, color varies (#A6A6A6 or #A9A9A9)
 * - Skip text: 14px, line-height 20px, white, "Skip ->"
 * - Dots: 8x8px each, 4px gap, active #FF9A6D, inactive #4D4D4D
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, FlatList, ViewToken, TouchableOpacity } from 'react-native';
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
  progressBg: colors.black[400],       // #4D4D4D
  progressFill: colors.brand[600],      // #CC7B57 (Figma fill)
  headingGray: colors.neutral[500],    // #A9A9A9
  headingWhite: colors.white,          // #FFFFFF
  headingAccent: colors.brand[500],    // #FF9A6D (for "1%" highlight)
  bodyText: colors.black[200],         // #A6A6A6
  bodyTextAlt: colors.neutral[500],    // #A9A9A9
  skipText: colors.white,              // #FFFFFF
  dotActive: colors.brand[500],        // #FF9A6D
  dotInactive: colors.black[400],      // #4D4D4D (Figma inactive dot)
} as const;

// Exact Figma dimensions
const FIGMA_DIMENSIONS = {
  contentWidth: 297,                   // Figma: main content width
  containerPadding: 48,                // (393 - 297) / 2 = 48
  logoWidth: 26.7,                     // Figma: vector_1 width (scaled)
  logoHeight: 32,                      // Figma: vector_1 height (scaled)
  progressBarHeight: 12,               // Figma: rectangle_4/5 height
  progressBarWidth: 393,               // Figma: full screen width
  progressFillWidth: 262,              // Figma: rectangle_5 width (progress)
  headingWidth: 297,                   // Figma: heading width
  headingHeight: 128,                  // Figma: heading height (2 lines)
  bodyWidth: 297,                      // Figma: body text width
  bodyHeight: 40,                      // Figma: body text height
  skipWidth: 297,                      // Figma: login_Text width
  dotSize: 8,                          // Figma: ellipse width/height
  dotGap: 4,                           // Figma: Frame 2095586316 layout.gap = 4
} as const;

// Exact Figma spacing gaps - CORRECTED from fresh Figma MCP (2026-02-01)
const FIGMA_GAPS = {
  progressToLogo: 40,                  // Progress bar to logo gap
  logoToHeading: 40,                   // Logo to heading gap
  headingToBody: 16,                   // Heading to body gap
  bodyToSkip: 24,                      // Body to skip gap
  skipToDots: 24,                      // Skip to dots gap - increased from 16 per Gemini analysis
  bottomPadding: 64,                   // Bottom padding
} as const;

interface Slide {
  id: string;
  titleLine1: string;
  titleLine2: string;
  titleLine1Color: string;
  titleLine2Color: string;
  description: string;
  descriptionColor: string;
  backgroundShape: BackgroundShapeKey;
}

// Exact content from Figma screenshots with correct colors
// Each slide has a unique background shape (silhouette image) from Figma
// CORRECTED FROM FIGMA EXTRACTED DATA (2026-02-05):
// Figma node 160:2676 (1-28985): Single text node with fill #A9A9A9
// Figma node 160:2691 (1-29025): Single text node with fill #A9A9A9
// Figma node 160:2706 (1-29065): Single text node with fill #FFFFFF
const slides: Slide[] = [
  {
    id: '1',
    titleLine1: 'Earn 1% back ',   // Note trailing space per Figma
    titleLine2: 'on your rent',
    titleLine1Color: FIGMA_COLORS.headingGray,   // #A9A9A9 - BOTH lines gray per Figma
    titleLine2Color: FIGMA_COLORS.headingGray,   // #A9A9A9 - Figma shows single color block
    description: 'For every timely payment made via UPI, netbanking or credit cards.',
    descriptionColor: FIGMA_COLORS.bodyText,     // #A6A6A6
    backgroundShape: 'carousel1',                // Figma node 1-28985
  },
  {
    id: '2',
    titleLine1: 'More than ',      // Note trailing space per Figma
    titleLine2: 'just cashback',
    titleLine1Color: FIGMA_COLORS.headingGray,   // #A9A9A9 - BOTH lines gray per Figma
    titleLine2Color: FIGMA_COLORS.headingGray,   // #A9A9A9 - Figma shows single color block
    description: 'Keep paying via Secured to unlock exclusive renting benefits over time',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,  // #A9A9A9
    backgroundShape: 'carousel2',                // Figma node 1-29025
  },
  {
    id: '3',
    titleLine1: 'Your landlord',
    titleLine2: 'benefits too',
    titleLine1Color: FIGMA_COLORS.headingWhite,  // #FFFFFF - BOTH lines white per Figma
    titleLine2Color: FIGMA_COLORS.headingWhite,  // #FFFFFF - Figma node 160:2706 fill: #FFFFFF
    description: '3 months of rent payments unlock a free vacancy cover for your landlord',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,  // #A9A9A9
    backgroundShape: 'carousel3',                // Figma node 1-29065
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

  // Calculate progress bar fill width based on active slide (1/3, 2/3, 3/3)
  const progressFillWidth = ((activeIndex + 1) / slides.length) * FIGMA_DIMENSIONS.progressBarWidth;

  const renderSlide = useCallback(({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      {/* Content Container - progress bar is rendered OUTSIDE FlatList for fixed positioning */}
      <View style={styles.contentContainer}>
        {/* Logo - Figma: 26.7x32 */}
        <View style={styles.logoContainer}>
          <Logo size={32} />
        </View>

        {/* Text Container */}
        <View style={styles.textContainer}>
          {/* Heading - Figma exact layout */}
          <View style={styles.headingContainer}>
            <Text style={[styles.heading, { color: item.titleLine1Color }]}>
              {item.titleLine1}
            </Text>
            <Text style={[styles.heading, { color: item.titleLine2Color }]}>
              {item.titleLine2}
            </Text>
          </View>

          {/* Body Text */}
          <Text style={[styles.bodyText, { color: item.descriptionColor }]}>
            {item.description}
          </Text>
        </View>

        {/* Skip Button - Figma: "Skip →" with "Skip" underlined, " →" not */}
        {/* Fresh from Figma MCP (2026-02-01): decoration-solid underline on "Skip" only */}
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipContainer}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>
            <Text style={styles.skipUnderline}>Skip</Text>
            {' →'}
          </Text>
        </TouchableOpacity>

        {/* Dots - fixed position for all slides */}
        <View style={styles.dotsContainer}>
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

      {/* Progress Bar - FIXED at top, outside FlatList per Figma layout */}
      {/* Figma: Rectangle 4 (bg) + Rectangle 5 (fill), positioned at y=483 (after status bar) */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: progressFillWidth }]} />
        </View>
      </View>

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
  slide: {
    width: SCREEN_WIDTH,
    flexGrow: 1,
  },
  progressBarContainer: {
    width: FIGMA_DIMENSIONS.progressBarWidth,
    zIndex: 10, // Ensure progress bar stays on top
  },
  progressBarBackground: {
    width: '100%',
    height: FIGMA_DIMENSIONS.progressBarHeight,
    backgroundColor: FIGMA_COLORS.progressBg, // #4D4D4D
    // No borderRadius per Figma - Rectangle 4/5 have no cornerRadius
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: FIGMA_COLORS.progressFill, // #CC7B57
    // No borderRadius per Figma - Rectangle 4/5 have no cornerRadius
  },
  flatList: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: FIGMA_DIMENSIONS.containerPadding, // 48px
    paddingTop: FIGMA_GAPS.progressToLogo, // 40px gap from progress bar to logo
    paddingBottom: FIGMA_GAPS.bottomPadding,
    // Figma Container 160:2669: layout.mode VERTICAL, gap 40
  },
  logoContainer: {
    marginBottom: FIGMA_GAPS.logoToHeading,
  },
  textContainer: {
    gap: FIGMA_GAPS.headingToBody,
  },
  headingContainer: {
    // Lines flow together - no gap (Figma exact)
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
    width: FIGMA_DIMENSIONS.headingWidth,
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    width: FIGMA_DIMENSIONS.bodyWidth,
  },
  skipContainer: {
    marginTop: FIGMA_GAPS.bodyToSkip,
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.skipText,
    width: FIGMA_DIMENSIONS.skipWidth,
  },
  skipUnderline: {
    // Figma: "Skip" is underlined, " →" is not
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.skipText,
    textDecorationLine: 'underline',
  },
  dotsContainer: {
    marginTop: FIGMA_GAPS.skipToDots,
  },
});
