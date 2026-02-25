/**
 * Setup Flow Index - Post Approval Carousel
 * Figma References: 41-10712, 41-10859, 41-11006
 *
 * Shows a 3-step carousel introducing the setup process:
 * 1. Add landlord's bank details
 * 2. Upload address proof
 * 3. Invite landlord
 *
 * Pixel-perfect implementation from Figma blueprints:
 * - Screen: 393x852, backgroundColor: #131313 (black.700)
 * - Header frame (41:10824): x=48, y=124, column, gap=34
 *   - Logo: 32x38.4 white
 *   - Title: 310x96, fontSize 32, lineHeight 48, letterSpacing -1
 *     - Spans: "Let's get " #A9A9A9, "you set up" #FF9A6D
 * - Card frame (160:3101): x=61, y=322, 270x321
 *   - Background rect: #202020 with drop shadows
 *   - 14 top perforations: 14px circles at y=-4, x: 4,24,...264 (20px spacing)
 *   - Content frame: x=34, y=118, 204px wide, column, gap=16
 *     - Card logo: 26.7x32 white
 *     - Description: fontSize 20, lineHeight 32, mixed colors
 *   - Decorative crosshatch groups at (44,28) and (218,36)
 * - Pagination (41:10855): x=181, y=673, 3 dots 8x8, gap=4
 * - Button: x=40, y=739, 313px wide
 *   - Disabled: 56h, radius 12, bg/border #202020, text #444444 16px
 *   - Active (step 3): PrimaryButton with divider, gradient, orange border
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
  Animated as RNAnimated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';

import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
  type SharedValue,
} from 'react-native-reanimated';
import { Screen, Text, PrimaryButton, Logo } from '@/src/components';
import { DottedGridPattern } from '@/src/components/patterns';
import { colors } from '@/src/theme';
import { s, sf } from '@/src/theme/scale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SetupStep {
  id: string;
  /** Full description text from Figma */
  description: string;
  /** Character index where orange span ends (from Figma spans[].end) */
  orangeEnd: number;
}

// Figma content from screens 41-10712, 41-10859, 41-11006
// Text content and span boundaries extracted directly from blueprint typography.spans
// Added newlines to match visual layout in Figma
const SETUP_STEPS: SetupStep[] = [
  {
    id: 'bank',
    // Figma 160:3121: "Add your landlord’s bank details to enable payouts"
    description: 'Add your landlord’s\nbank details\nto enable payouts',
    orangeEnd: 32, // "Add your landlord’s\nbank details"
  },
  {
    id: 'address',
    // Figma 160:3149: "Upload address proof to verify your tenancy"
    description: 'Upload\naddress proof\nto verify your tenancy',
    orangeEnd: 20, // "Upload\naddress proof"
  },
  {
    id: 'landlord',
    // Figma 160:3177: "Invite your landlord to finish setup"
    description: 'Invite your landlord\nto finish setup',
    orangeEnd: 20, // "Invite your landlord"
  },
];

// Figma exact dimensions from blueprints 41-10712, 41-10859, 41-11006
const FIGMA = {
  // Screen
  screenWidth: 393,

  // Carousel updated to standard Flickity style (no coverflow scaling)
  itemWidth: s(270),
  itemGap: s(16),
  snapInterval: s(286), // 270 + 16

  // Header frame (41:10824 / Frame 2095586400)
  // Position: x=48, y=124 from screen top
  headerX: s(48),
  headerY: s(124),
  headerWidth: s(310),
  headerGap: s(34),

  // Logo in header (41:10825 / Frame 1686557264)
  headerLogoHeight: s(38.4),

  // Title text (160:3095)
  titleFontSize: sf(32),
  titleLineHeight: sf(48),
  titleLetterSpacing: -1,
  // Span colors from typography.spans
  titleGrayColor: colors.neutral[500], // neutral.500 - chars 0-9 "Let's get"
  titleAccentColor: colors.brand[500], // brand.500 - chars 10-20 "you set up"

  // Card frame (160:3101 / Frame 2095586361)
  // Position: x=61, y=322
  cardX: s(61),
  cardY: s(322),
  cardWidth: s(270),
  cardHeight: s(321),
  cardBgColor: colors.black[500], // black.500

  // Card top perforations (Ellipse 21892-21905)
  perforationCount: 14,
  perforationSize: s(14),
  perforationY: s(-4),
  perforationStartX: s(4),
  perforationSpacing: s(20),

  // Card content frame (160:3118 / Frame 2095586360)
  // Position within card: x=34, y=118
  contentX: s(34),
  contentY: s(118),
  contentWidth: s(204),
  contentGap: s(16),

  // Card logo (160:3119 / Frame 1686557264 inside card)
  cardLogoHeight: s(32),

  // Card description text (160:3121 etc.)
  descFontSize: sf(20),
  descLineHeight: sf(32),
  descBaseColor: colors.neutral[300], // neutral.300
  descAccentColor: colors.brand[500], // brand.500

  // Decorative crosshatch group (Group 59: 160:3122)
  crosshatch1X: s(218),
  crosshatch1Y: s(36),
  crosshatch2X: s(44),
  crosshatch2Y: s(28),
  crosshatchSize: s(20.5),
  crosshatchGap: s(14.5),

  // Pagination dots (41:10855 / Frame 2095586316)
  paginationY: s(673),
  dotSize: s(8),
  dotGap: s(4),
  dotActiveColor: colors.brand[500], // brand.500
  dotInactiveColor: colors.black[500], // black.500

  // Button (41:10823 disabled / 41:11076 active)
  buttonX: s(40),
  buttonY: s(739),
  buttonWidth: s(313),

  // Active button uses PrimaryButton component (step 3)
  buttonActiveText: 'Start Flenting \u2192',
  buttonActiveTextSize: sf(16),
  buttonActiveLineHeight: sf(24),
} as const;

// Decorative crosshatch SVG component - matches Figma Groups 59/60
// Two overlapping diagonal lines stroked #4D4D4D
function Crosshatch({ x, y }: { x: number; y: number }) {
  return (
    <View style={[styles.crosshatch, { left: x, top: y }]}>
      <Svg width={FIGMA.crosshatchSize} height={35} viewBox="0 0 20.5 35">
        <Line
          x1={FIGMA.crosshatchSize}
          y1={0}
          x2={0}
          y2={FIGMA.crosshatchSize}
          stroke={colors.black[400]}
          strokeWidth={0.3}
        />
        <Line
          x1={FIGMA.crosshatchSize}
          y1={FIGMA.crosshatchGap}
          x2={0}
          y2={FIGMA.crosshatchGap + FIGMA.crosshatchSize}
          stroke={colors.black[400]}
          strokeWidth={0.3}
        />
      </Svg>
    </View>
  );
}

// Setup card component - exact Figma structure from blueprint
function SetupCard({ step }: { step: SetupStep }) {
  // Split description based on orangeEnd
  const isOrange = step.orangeEnd > 0;
  const orangePart = isOrange ? step.description.substring(0, step.orangeEnd) : '';
  const grayPart = isOrange ? step.description.substring(step.orangeEnd) : step.description;

  return (
    <View style={styles.cardShadowWrapper}>
      <View style={styles.cardFrame}>
        {/* Background rectangle - Figma 160:3102: 270x321 #202020 */}
        <View style={styles.cardBackground} />

        {/* Top perforations - 14 circles at y=-4, clipped by card overflow */}
        {/* Figma: Ellipse 21892-21905, 14px circles, x: 4,24,44,...264 */}
        {[...Array(FIGMA.perforationCount)].map((_, i) => (
          <View
            key={`perf-${i}`}
            style={[
              styles.perforation,
              {
                left: FIGMA.perforationStartX + i * FIGMA.perforationSpacing,
                top: FIGMA.perforationY,
              },
            ]}
          />
        ))}

        {/* Decorative crosshatch at top-left area */}
        <Crosshatch x={FIGMA.crosshatch2X} y={FIGMA.crosshatch2Y} />

        {/* Decorative crosshatch at top-right area */}
        <Crosshatch x={FIGMA.crosshatch1X} y={FIGMA.crosshatch1Y} />

        {/* Content frame - Figma 160:3118: x=34, y=118, 204px wide, column, gap=16 */}
        <View style={styles.cardContent}>
          {/* Card logo - Figma 160:3119: 26.7x32 white vector */}
          <Logo size={FIGMA.cardLogoHeight} color={colors.white} />

          {/* Description text - Figma multi-color spans */}
          <Text style={styles.cardDescText}>
            {isOrange ? <RNText style={{ color: FIGMA.descAccentColor }}>{orangePart}</RNText> : null}
            <RNText style={{ color: FIGMA.descBaseColor }}>{grayPart}</RNText>
          </Text>
        </View>
      </View>
    </View>
  );
}

// Carousel item component
function CarouselSlide({ item }: { item: SetupStep }) {
  return (
    <View style={styles.slideContainer}>
      <SetupCard step={item} />
    </View>
  );
}

// Page indicator dots - Figma 41:10855
function PageIndicator({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.indicatorContainer}>
      {[...Array(count)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.indicatorDot,
            i === activeIndex && styles.indicatorDotActive,
          ]}
        />
      ))}
    </View>
  );
}

export default function SetupIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { step } = useLocalSearchParams<{ step?: string }>();
  // Support ?step=1|2|3 for automated testing - parse to 0-indexed
  const initialStep = step
    ? Math.max(0, Math.min(parseInt(step, 10) - 1, SETUP_STEPS.length - 1))
    : 0;

  const [activeIndex, setActiveIndex] = useState(initialStep);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to initial step on mount if specified via query param
  useEffect(() => {
    if (step && flatListRef.current) {
      const targetIndex = Math.max(
        0,
        Math.min(parseInt(step, 10) - 1, SETUP_STEPS.length - 1)
      );
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: false,
        });
      }, 100);
    }
  }, [step]);

  const isLastStep = activeIndex === SETUP_STEPS.length - 1;

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

  const handleStartFlenting = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(setup)/add-bank');
  }, [router]);

  const scrollX = useRef(new RNAnimated.Value(initialStep * FIGMA.snapInterval)).current;

  const renderItem = useCallback(
    ({ item }: { item: SetupStep }) => (
      <CarouselSlide item={item} />
    ),
    []
  );

  // Figma layout uses absolute positions from screen top.
  // Status bar is ~53px. Header starts at y=124.
  // We use paddingTop = headerY - safeAreaTop to position from safe area edge.
  // On standard iPhone: safeAreaTop ~59px, so padding = 124-59 = 65.
  // But Figma y=124 is from absolute screen top (including status bar area).
  const headerPaddingTop = FIGMA.headerY - insets.top;
  // Card area starts at y=322. Title bottom = headerY + logoH + gap + titleH = 124+38.4+34+96 = 292.4.
  // Gap from title bottom to card top = 322 - 292.4 = 29.6 ~ 30
  const titleToCardGap = FIGMA.cardY - (FIGMA.headerY + FIGMA.headerLogoHeight + FIGMA.headerGap + 96);
  // Card bottom to pagination = 673 - (322+321) = 30
  const cardToPaginationGap = FIGMA.paginationY - (FIGMA.cardY + FIGMA.cardHeight);
  // Pagination bottom to button = 739 - (673+8) = 58
  const paginationToButtonGap = FIGMA.buttonY - (FIGMA.paginationY + FIGMA.dotSize);

  // Crossfading background shapes based on scroll position
  const bgShapeOpacity1 = scrollX.interpolate({
    inputRange: [0, FIGMA.snapInterval],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const bgShapeOpacity2 = scrollX.interpolate({
    inputRange: [0, FIGMA.snapInterval, FIGMA.snapInterval * 2],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const bgShapeOpacity3 = scrollX.interpolate({
    inputRange: [FIGMA.snapInterval, FIGMA.snapInterval * 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
      <Screen testID="setup-index-screen" padded={false} safeAreaTop={false} style={{ backgroundColor: 'transparent' }}>
        {/* Background Pattern - DottedPattern component with crossfading shapes */}
        <DottedGridPattern fadeMask={false} />

        <View style={[styles.container, { paddingTop: Math.max(0, headerPaddingTop) }]}>
          {/* Header frame - Figma 41:10824: x=48, column, gap=34 */}
          <Animated.View 
            entering={FadeInDown.delay(100).duration(400)}
            style={styles.headerFrame}
          >
            {/* Logo - Figma 41:10825: 32x38.4 white */}
            <Logo size={FIGMA.headerLogoHeight} color={colors.white} />

            {/* Title - Figma 160:3095: 310px wide, fontSize 32, lineHeight 48 */}
            <Text style={styles.titleText}>
              <RNText style={{ color: FIGMA.titleGrayColor }}>Let's get{"\n"}</RNText>
              <RNText style={{ color: FIGMA.titleAccentColor }}>you set up</RNText>
            </Text>
          </Animated.View>

          {/* Card carousel area */}
          <Animated.View 
            entering={FadeInDown.delay(200).duration(400)}
            style={[styles.carouselContainer, { marginTop: titleToCardGap }]}
          >
            <RNAnimated.FlatList
              ref={flatListRef as any}
              data={SETUP_STEPS}
              renderItem={renderItem}
              keyExtractor={(item: SetupStep) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={RNAnimated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
              snapToInterval={FIGMA.snapInterval}
              decelerationRate="fast"
              bounces={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              contentContainerStyle={{
                paddingLeft: FIGMA.cardX,
                paddingRight: SCREEN_WIDTH - FIGMA.cardX - FIGMA.itemWidth,
              }}
            />
          </Animated.View>
          
          {/* Page indicator - Figma 41:10855: y=673, centered */}
          <Animated.View 
            entering={FadeIn.delay(300).duration(400)}
            style={{ marginTop: cardToPaginationGap }}
          >
            <PageIndicator count={SETUP_STEPS.length} activeIndex={activeIndex} />
          </Animated.View>

          {/* Spacer pushes button toward bottom */}
          <View style={{ flex: 1, minHeight: paginationToButtonGap }} />

          {/* Button - Figma: x=40, y=739 */}
          {/* Steps 1-2: disabled style (41:10823) */}
          {/* Step 3: active PrimaryButton (41:11076) */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400)}
            style={[
              styles.buttonContainer,
              { paddingBottom: insets.bottom > 0 ? insets.bottom : 34 },
            ]}
          >
            {isLastStep ? (
              <PrimaryButton
                title={FIGMA.buttonActiveText}
                onPress={handleStartFlenting}
                showDivider
                testID="start-flenting-button"
              />
            ) : (
              <PrimaryButton
                title={'Start Flenting \u2192'}
                onPress={handleStartFlenting}
                disabled
                testID="start-flenting-button"
              />
            )}
          </Animated.View>
        </View>
      </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header frame - Figma 41:10824
  // x=48, column direction, gap=34
  headerFrame: {
    marginLeft: FIGMA.headerX, // 48
    width: FIGMA.headerWidth, // 310
    gap: FIGMA.headerGap, // 34
  },

  // Title text - Figma 160:3095
  // fontSize 32, lineHeight 48, letterSpacing -1, color #FFFFFF
  titleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.titleFontSize, // 32
    lineHeight: FIGMA.titleLineHeight, // 48
    letterSpacing: FIGMA.titleLetterSpacing, // -1
    color: colors.white, // All white
    textAlign: 'left',
  },

  // Carousel container - holds FlatList with card height
  carouselContainer: {
    height: FIGMA.cardHeight, // 321
  },

  // Flickity-style items: width is cardWidth, and gap is handled via positive margin
  slideContainer: {
    width: FIGMA.itemWidth, // 270
    marginRight: FIGMA.itemGap, // 16
  },

  // Card outer frame - Figma 160:3101
  // 270x321, no overflow hidden so shadow can render
  cardShadowWrapper: {
    width: FIGMA.cardWidth,
    height: FIGMA.cardHeight,
  },

  // Card outer frame - Figma 160:3101
  // 270x321, no overflow hidden so shadow can render
  cardFrame: {
    width: FIGMA.cardWidth, // 270
    height: FIGMA.cardHeight, // 321
  },

  // Card background rectangle - Figma 160:3102
  // Full card size, #202020, with drop shadows
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FIGMA.cardBgColor, // #202020
    // Combined Figma shadow for React Native (approximating the 3 layers)
    // 1: rgba(0,0,0,0.1) offset(0,9) blur 19
    // 2: rgba(0,0,0,0.09) offset(0,35) blur 35
    // 3: rgba(0,0,0,0.05) offset(0,78) blur 47
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: s(24) },
    shadowOpacity: 0.15,
    shadowRadius: s(30),
    elevation: 10,
    borderRadius: 0, // Sharp corners as per Figma
  },

  // Top perforations - Figma Ellipse 21892-21905
  // 14px circles at y=-4, background color to "punch through"
  perforation: {
    position: 'absolute',
    width: FIGMA.perforationSize, // 14
    height: FIGMA.perforationSize, // 14
    borderRadius: FIGMA.perforationSize / 2, // 7
    backgroundColor: colors.black[700], // #131313 matches screen bg
  },

  // Crosshatch decorative element - absolute positioned within card
  crosshatch: {
    position: 'absolute',
  },

  // Card content frame - Figma 160:3118
  // x=34, y=118, 204px wide, column, gap=16
  cardContent: {
    position: 'absolute',
    left: FIGMA.contentX, // 34
    top: FIGMA.contentY, // 118
    width: FIGMA.contentWidth, // 204
    gap: FIGMA.contentGap, // 16
  },

  // Card description text - Figma: fontSize 20, lineHeight 32
  cardDescText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.descFontSize, // 20
    lineHeight: FIGMA.descLineHeight, // 32
    color: FIGMA.descBaseColor, // #CBCBCB
    textAlign: 'left',
  },

  // Pagination - Figma 41:10855
  // Row, gap=4, centered
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: FIGMA.dotGap, // 4
  },
  indicatorDot: {
    width: FIGMA.dotSize, // 8
    height: FIGMA.dotSize, // 8
    borderRadius: FIGMA.dotSize / 2, // 4
    backgroundColor: FIGMA.dotInactiveColor, // #202020
  },
  indicatorDotActive: {
    backgroundColor: FIGMA.dotActiveColor, // #FF9A6D
  },

  // Button container - Figma: x=40, width=313, centered
  buttonContainer: {
    paddingHorizontal: FIGMA.buttonX, // 40
  },
});
