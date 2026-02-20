import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text as RNText, StyleSheet, Dimensions, FlatList, ViewToken, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Screen, Logo, Text } from '@/src/components';
import { CarouselDots } from '@/src/components';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ratioX = SCREEN_WIDTH / 393;
const sv = (val: number) => val * ratioX;

const FIGMA_COLORS = {
  background: colors.black[700],       // #131313
  headingGray: colors.neutral[500],              // #A9A9A9
  headingWhite: colors.white,          // #FFFFFF
  headingAccent: colors.brand[500],    // #FF9A6D
  bodyText: colors.black[200],         // #A6A6A6
  bodyTextAlt: colors.neutral[500],              // #A9A9A9
  skipText: colors.white,              // #FFFFFF
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
  backgroundShape: any;
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
    backgroundShape: require('@/src/assets/figma-assets/1-28985_background-shape.png'),
    
  },
  {
    id: '2',
    headingSegments: [
      { text: 'More than\n', color: FIGMA_COLORS.headingGray },
      { text: 'just cashback', color: FIGMA_COLORS.headingAccent },
    ],
    description: 'Keep paying via Secured to unlock exclusive renting benefits over time',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,
    backgroundShape: require('@/src/assets/figma-assets/1-29025_background-shape.png'),
    
  },
  {
    id: '3',
    headingSegments: [
      { text: 'Your', color: FIGMA_COLORS.headingGray },
      { text: ' ', color: FIGMA_COLORS.headingGray },
      { text: 'landlord', color: FIGMA_COLORS.headingGray },
      { text: ' ', color: FIGMA_COLORS.headingWhite },
      { text: 'benefits too', color: FIGMA_COLORS.headingAccent },
    ],
    description: '3 months of rent payments unlock a free vacancy cover for your landlord',
    descriptionColor: FIGMA_COLORS.bodyTextAlt,
    backgroundShape: require('@/src/assets/figma-assets/1-29065_background-shape.png'),
    
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

  const renderSlide = useCallback(({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      {/* Background shape for this specific slide */}
      <Image
        source={item.backgroundShape}
        style={[styles.backgroundShape, { left: sv(-44), top: 0, width: sv(481), height: sv(405) }]}
        contentFit="fill"
      />
      {/* Outer Container (160:2668) */}
      <View style={styles.outerContainer}>
        {/* Inner Container (160:2669) */}
        <View style={styles.innerContainer}>
          
          <Logo size={sv(32)} />

          <View style={styles.textContainer}>
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

          <CarouselDots count={slides.length} activeIndex={activeIndex} />
        </View>
      </View>
    </View>
  ), [activeIndex, handleSkip]);

  return (
    <Screen padded={false} testID="carousel-screen" safeAreaTop={false} safeAreaBottom={false} style={styles.screen}>
      {/* Static Dotted Pattern Background */}
      <Image
        source={require('@/src/assets/figma-assets/1-28055_image-149.png')}
        style={[styles.image149, { left: sv(-463), top: sv(-747), width: sv(1319), height: sv(2346) }]}
        contentFit="fill"
      />

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
  screen: {
    backgroundColor: colors.black[700],
    flex: 1,
  },
  image149: {
    position: 'absolute',
    opacity: 0.08,
    transform: [{ rotate: '90deg' }], 
  },
  backgroundShape: {
    position: 'absolute',
    opacity: 1,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  outerContainer: {
    flex: 1,
    justifyContent: 'center', 
    paddingTop: sv(80),      
    paddingBottom: sv(64),  
  },
  innerContainer: {
    flex: 1,
    gap: sv(40),                      
    paddingHorizontal: sv(48), 
  },
  
  
  
  textContainer: {
    gap: sv(16),              
  },
  heading: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(48),
    lineHeight: sv(64),
    letterSpacing: -sv(2),
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(14),
    lineHeight: sv(20),
  },
  skipText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sv(14),
    lineHeight: sv(20),
    color: FIGMA_COLORS.skipText,
  },
  skipUnderline: {
    textDecorationLine: 'underline',
  },
});