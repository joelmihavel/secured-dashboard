/**
 * Onboarding Carousel Screen
 * Figma Node: 756:206841 (Splash / get-started --carousel 40)
 *
 * UX: Background, logo, skip button, and dots stay FIXED.
 * Only the heading + body text swipes horizontally.
 *
 * Figma Values (from get_design_context 756:210868, 2026-02-26):
 * - Background: #131313 (colors.black[700])
 * - Dotted pattern: DottedGridPattern
 * - Logo: 33.375x40px (size=40 for Logo component)
 * - Outer Container: pt-80, pb-64
 * - Inner Container: flex-1, justify-end, px-48, gap-40
 * - Text Container: gap-40 (logo + text wrapper)
 * - Text Wrapper: gap-16 (heading + body)
 * - Heading: PlusJakartaSans-Regular, 48/64, letterSpacing -2
 *   - Accent spans: #FF9A6D, Gray spans: #A9A9A9
 * - Body: PlusJakartaSans-Regular, 14/20, #A6A6A6
 * - Skip: 14/20, white, underlined (no arrow)
 * - Carousel dots: 8x8, gap-4, active=#FF9A6D, inactive=#202020
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text as RNText, Image, StyleSheet, Dimensions, ViewToken, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedScrollHandler, useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Illustration1, Illustration2, Illustration3 } from '@/src/components/onboarding';

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

/** Height of the swipeable text area (heading 128 + gap 16 + body 40) */
const TEXT_AREA_HEIGHT = 184;

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
    const flatListRef = useRef<Animated.FlatList<any>>(null);
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const style1 = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [0, 1, 0], Extrapolation.CLAMP),
  }));
  const style2 = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, SCREEN_WIDTH, 2 * SCREEN_WIDTH], [0, 1, 0], Extrapolation.CLAMP),
  }));
  const style3 = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [SCREEN_WIDTH, 2 * SCREEN_WIDTH, 3 * SCREEN_WIDTH], [0, 1, 0], Extrapolation.CLAMP),
  }));


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
    <View style={styles.slideItem}>
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
  ), []);

  return (
    <Screen padded={false} testID="carousel-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <DottedGridPattern fadeMask={false} />

      
      {/* Illustrations */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.illus1Container, style1]}>
          <Illustration1 width={104} height={70} />
        </Animated.View>
        <Animated.View style={[styles.illus2Container, style2]}>
          <Illustration2 width={106} height={78} />
        </Animated.View>
        <Animated.View style={[styles.illus3Container, style3]}>
          <Illustration3 width={76} height={92} />
        </Animated.View>
      </View>

      <View style={styles.outerContainer} pointerEvents="box-none">
        <View style={styles.innerContainer} pointerEvents="box-none">
          {/* Text Container: logo + swipeable text grouped together */}
          <View style={styles.textContainer} pointerEvents="box-none">
            <View pointerEvents="none">
              <Logo size={40} />
            </View>

            {/* Swipeable text area — extends full-width via negative margin */}
            <View style={styles.textSwiperWrapper}>
              <Animated.FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlideText}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                bounces={false}
                decelerationRate="fast"
                snapToInterval={SCREEN_WIDTH}
                snapToAlignment="start"

              />
            </View>
          </View>

          {/* Skip */}
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>{activeIndex === slides.length - 1 ? 'Continue' : 'Skip'}</Text>
          </TouchableOpacity>

          {/* Carousel dots */}
          <View pointerEvents="none">
            <CarouselDots count={slides.length} activeIndex={activeIndex} />
          </View>
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
  // Figma 759:302123 — card illustration: absolute (45, 245), 104x70, opacity 0.48
    illus1Container: {
    position: 'absolute',
    left: 45,
    top: 245,
  },
  illus2Container: {
    position: 'absolute',
    left: 45,
    top: 243,
  },
  illus3Container: {
    position: 'absolute',
    left: 41,
    top: 239,
  },
  oldCardIllustration: {
    position: 'absolute',
    left: 45,
    top: 245,
    width: 104,
    height: 70,
    opacity: 0.48,
  },
  // Figma 756:210868 — outer container: pt-80, pb-64
  outerContainer: {
    flex: 1,
    paddingTop: 80,
    paddingBottom: 64,
  },
  // Figma 756:210869 — inner container: flex-1, justify-end, px-48, gap-40
  innerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 48,
    gap: 40,
  },
  // Figma 756:210877 — text container: groups logo + text, gap-40
  textContainer: {
    gap: 40,
  },
  // Wrapper for the FlatList text area — fixed height, extends full-width
  textSwiperWrapper: {
    height: TEXT_AREA_HEIGHT,
    marginHorizontal: -48,
  },
  // Each slide item: full screen width with horizontal padding
  slideItem: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 48,
    gap: 16,
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
  // Skip: Figma 14/20, white, underlined
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
    textDecorationLine: 'underline',
  },
});