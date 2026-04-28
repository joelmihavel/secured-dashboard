/**
 * Onboarding Carousel Screen
 * Figma Nodes: 4685:152502, 4685:156878, 4685:161211 (slides 1, 2, 3)
 *
 * Background, logo, skip button, and dots stay FIXED.
 * Only the heading + body text swipes horizontally.
 * Background reuses the dotted halftone illustration from splash/welcome.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text as RNText, Image, StyleSheet, Dimensions, FlatList, ViewToken, TouchableOpacity, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text } from '@/src/components';
import { CarouselDots } from '@/src/components';
import { colors } from '@/src/theme';
import { s, sv } from '@/src/theme/scale';

const LANDING_BG = require('../../assets/images/patterns/landing-bg.png');


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FIGMA_COLORS = {
  headingGray: colors.neutral[500],    // #A9A9A9
  headingAccent: colors.brand[500],    // #FF9A6D
  bodyText: colors.black[200],         // #A6A6A6
  bodyTextAlt: colors.neutral[500],    // #A9A9A9
} as const;

/** Height of the swipeable text area (heading 128 + gap 16 + body 40) */
const TEXT_AREA_HEIGHT = sv(184);

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
  const routerRef = useRef(router);
  routerRef.current = router;
  const { page } = useLocalSearchParams<{ page?: string }>();

  const initialPage = page ? Math.max(0, Math.min(parseInt(page, 10) - 1, slides.length - 1)) : 0;
  const [activeIndex, setActiveIndex] = useState(initialPage);
  const flatListRef = useRef<FlatList<Slide>>(null);

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
    routerRef.current.push('/(auth)/sign-up');
  }, []);

  const handleAdvance = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveIndex((current) => {
      if (current >= slides.length - 1) {
        routerRef.current.push('/(auth)/sign-up');
        return current;
      }
      const next = current + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      return next;
    });
  }, []);

  const handleDotPress = useCallback((index: number) => {
    Haptics.selectionAsync();
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }, []);

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
    <Pressable style={styles.slideItem} onPress={handleAdvance} testID={`carousel-slide-${item.id}`}>
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
    </Pressable>
  ), [handleAdvance]);

  return (
    <Screen padded={false} testID="carousel-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      <Image
        source={LANDING_BG}
        style={styles.bgImage}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      {/* Tap anywhere on the bg to advance to the next slide */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleAdvance}
        testID="carousel-advance-overlay"
      />

      <View style={styles.outerContainer} pointerEvents="box-none">
        <View style={styles.innerContainer} pointerEvents="box-none">
          {/* Text Container: logo + swipeable text grouped together */}
          <View style={styles.textContainer} pointerEvents="box-none">
            <View pointerEvents="none">
              <Logo size={40} />
            </View>

            {/* Swipeable text area — extends full-width via negative margin */}
            <View style={styles.textSwiperWrapper}>
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
          </View>

          {/* Skip */}
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.skipText}>{activeIndex === slides.length - 1 ? 'Continue' : 'Skip'}</Text>
          </TouchableOpacity>

          {/* Carousel dots — tap a dot to jump to that slide */}
          <CarouselDots count={slides.length} activeIndex={activeIndex} onDotPress={handleDotPress} />
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
  bgImage: {
    position: 'absolute',
    top: sv(-66),
    left: s(-18),
    width: s(469),
    height: sv(664),
    opacity: 0.32,
  },
  // Figma 756:210868 — outer container: pt-80, pb-64
  outerContainer: {
    flex: 1,
    paddingTop: sv(80),
    paddingBottom: sv(64),
  },
  // Figma 756:210869 — inner container: flex-1, justify-end, px-48, gap-40
  innerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: s(48),
    gap: s(40),
  },
  // Figma 756:210877 — text container: groups logo + text, gap-40
  textContainer: {
    gap: s(40),
  },
  // Wrapper for the FlatList text area — fixed height, extends full-width
  textSwiperWrapper: {
    height: TEXT_AREA_HEIGHT,
    marginHorizontal: -s(48),
  },
  // Each slide item: full screen width with horizontal padding
  slideItem: {
    width: SCREEN_WIDTH,
    paddingHorizontal: s(48),
    gap: s(16),
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
