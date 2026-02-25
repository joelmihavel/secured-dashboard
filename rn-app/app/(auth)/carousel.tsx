/**
 * Onboarding Carousel Screen
 * Figma Nodes: 684:3107 (Slide 1), 684:3128 (Slide 2), 684:3149 (Slide 3)
 *
 * UX: Background, logo, skip button, and dots stay FIXED.
 * Only the title + subtitle text swipes horizontally for a true carousel feel.
 *
 * Figma Values (from get_design_context 2026-02-25):
 * - Background: #131313 (colors.black[700])
 * - Dotted pattern: 8% opacity dots (DottedGridPattern)
 * - Background Shape: 481x405px, opacity 48%, centered, top -100px (fixed)
 * - Logo: 26.7x32px (size=32 for Logo component)
 * - Container: centered vertically, pt-80, pb-64, px-48, gap-40
 * - Heading: PlusJakartaSans-Regular, 48/64, letterSpacing -2
 * - Body: PlusJakartaSans-Regular, 14/20
 * - Skip link: 14/20, white, "Skip" underlined + " →"
 * - Carousel dots: 3 dots, active = #FFFFFF, inactive = #555555
 *
 * Slide 1 (684:3107): "Earn 1% back " (#FF9A6D) + "on your rent" (#A9A9A9)
 *   Body: #A6A6A6 "For every timely payment made via UPI, netbanking or credit cards."
 * Slide 2 (684:3128): "More than\n" (#A9A9A9) + "just cashback" (#FF9A6D)
 *   Body: #A9A9A9 "Keep paying via Secured to unlock exclusive renting benefits over time"
 * Slide 3 (684:3149): "Your landlord " (#A9A9A9) + "benefits too" (#FF9A6D)
 *   Body: #A9A9A9 "3 months of rent payments unlock a free vacancy cover for your landlord"
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text as RNText, StyleSheet, Dimensions, FlatList, ViewToken, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text, DottedGridPattern } from '@/src/components';
import { CarouselDots } from '@/src/components';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FIGMA_COLORS = {
  headingGray: colors.neutral[500],    // #A9A9A9
  headingAccent: colors.brand[500],    // #FF9A6D
  bodyText: colors.black[200],         // #A6A6A6
  bodyTextAlt: colors.neutral[500],    // #A9A9A9
} as const;

interface HeadingSegment {
  text: string;
  color: string;
}

interface Slide {
  id: string;
  headingSegments: HeadingSegment[];
  description: string;
  descriptionColor: string;
}

const slides: Slide[] = [
  {
    id: '1',
    headingSegments: [
      { text: 'Earn 1% back ', color: FIGMA_COLORS.headingAccent },
      { text: 'on your rent', color: FIGMA_COLORS.headingGray },
    ],
    description: 'For every timely payment made via UPI, netbanking or credit cards.',
    descriptionColor: FIGMA_COLORS.bodyText,
  },
  {
    id: '2',
    headingSegments: [
      { text: 'More than\n', color: FIGMA_COLORS.headingGray },
      { text: 'just cashback', color: FIGMA_COLORS.headingAccent },
    ],
    description: 'Keep paying via Secured to unlock exclusive renting benefits over time',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,
  },
  {
    id: '3',
    headingSegments: [
      { text: 'Your landlord ', color: FIGMA_COLORS.headingGray },
      { text: 'benefits too', color: FIGMA_COLORS.headingAccent },
    ],
    description: '3 months of rent payments unlock a free vacancy cover for your landlord',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,
  },
];

export default function CarouselScreen() {
  const router = useRouter();
  const { page } = useLocalSearchParams<{ page?: string }>();

  const initialPage = page ? Math.max(0, Math.min(parseInt(page, 10) - 1, slides.length - 1)) : 0;
  const [activeIndex, setActiveIndex] = useState(initialPage);
  const flatListRef = useRef<FlatList>(null);

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

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderSlideText = useCallback(({ item }: { item: Slide }) => (
    <View style={styles.slideContainer}>
      <View style={styles.textSlide}>
        <RNText style={styles.heading}>
          {item.headingSegments.map((segment, index) => (
            <RNText key={index} style={{ color: segment.color }}>
              {segment.text}
            </RNText>
          ))}
        </RNText>
        <Text style={[styles.bodyText, { color: item.descriptionColor }]}>
          {item.description}
        </Text>
      </View>
    </View>
  ), []);

  return (
    <Screen padded={false} testID="carousel-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* Fixed dotted grid background and background shape */}
      <DottedGridPattern fadeMask={false} />

      {/* Main Swiper that covers the screen */}
      <View style={StyleSheet.absoluteFill}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlideText}
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
        />
      </View>

      {/* Fixed layout overlays */}
      <View style={styles.container} pointerEvents="box-none">
        
        <View style={styles.contentContainer} pointerEvents="box-none">
          <View style={styles.logoWrapper} pointerEvents="none">
            <Logo size={32} />
          </View>
          
          {/* Spacer to replace text swiper area in the flex layout */}
          <View style={{ height: 184 }} pointerEvents="none" />
          
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.skipWrapper}
          >
            <Text style={styles.skipText}>
              <Text inherit style={styles.skipUnderline}>Skip</Text>
              {' \u2192'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dotsContainer} pointerEvents="none">
          <CarouselDots count={slides.length} activeIndex={activeIndex} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  // Container: [x:864, y:403, w:393, h:765] pad:[80,0,64,0] gap:48
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 64,
  },
  // Inner Container: [w:393, h:621] pad:[0,48,0,48] gap:40, flex-end
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 48,
    gap: 40,
    marginBottom: 48,
  },
  logoWrapper: {
    // Wrap to prevent flex layout changes
  },
  skipWrapper: {
    // Wrap to prevent flex layout changes
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'flex-end',
    // Match the position of the textSwiperWrapper
    paddingBottom: 64 + 48 + 20 + 40, 
  },
  // Each text slide: full screen width with own padding
  textSlide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 48,
    gap: 16,
    height: 184,
  },
  // Heading: Figma 48/64, letterSpacing -2
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 48,
    lineHeight: 64,
    letterSpacing: -2,
  },
  // Body: Figma 14/20
  bodyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  // Skip: Figma 14/20, white
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  skipUnderline: {
    textDecorationLine: 'underline',
  },
  dotsContainer: {
    paddingHorizontal: 48,
  }
});