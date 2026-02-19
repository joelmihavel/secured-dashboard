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
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';

import { Screen, Text, PrimaryButton, Logo, DottedPattern } from '@/src/components';
import { useVerificationStatus } from '@/src/hooks';
import { colors } from '@/src/theme';

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
const SETUP_STEPS: SetupStep[] = [
  {
    id: 'bank',
    // Figma 160:3121: "Add your landlord's bank details to enable payouts"
    // spans: [{start:0, end:24, color:#FF9A6D}, {start:25, end:32, color:#FF9A6D}]
    // Combined orange range covers "Add your landlord's bank details " (chars 0-32)
    description: "Add your landlord's bank details to enable payouts",
    orangeEnd: 32,
  },
  {
    id: 'address',
    // Figma 160:3149: "Upload  address proof  to verify your tenancy"
    // spans: [{start:0, end:23, color:#FF9A6D}]
    description: 'Upload  address proof  to verify your tenancy',
    orangeEnd: 23,
  },
  {
    id: 'landlord',
    // Figma 160:3177: "Invite your landlord  to finish setup"
    // spans: [{start:0, end:20, color:#FF9A6D}]
    description: 'Invite your landlord  to finish setup',
    orangeEnd: 20,
  },
];

// Figma exact dimensions from blueprints 41-10712, 41-10859, 41-11006
const FIGMA = {
  // Screen
  screenWidth: 393,

  // Header frame (41:10824 / Frame 2095586400)
  // Position: x=48, y=124 from screen top
  // Layout: column, gap=34, sizingV=HUG
  headerX: 48, // Figma: relativeTransform x
  headerY: 124, // Figma: relativeTransform y
  headerWidth: 310, // Figma: geometry.width
  headerGap: 34, // Figma: layout.gap

  // Logo in header (41:10825 / Frame 1686557264)
  // 32x38.4 frame containing white vector logo
  headerLogoWidth: 32.04,
  headerLogoHeight: 38.4,

  // Title text (160:3095)
  // Position: y=72.4 within header frame (gap 34 from 38.4 logo)
  titleWidth: 310,
  titleFontSize: 32,
  titleLineHeight: 48,
  titleLetterSpacing: -1,
  // Span colors from typography.spans
  titleGrayColor: '#A9A9A9', // neutral.500 - chars 0-9 "Let's get"
  titleAccentColor: '#FF9A6D', // brand.500 - chars 10-20 "you set up"

  // Card frame (160:3101 / Frame 2095586361)
  // Position: x=61, y=322
  cardX: 61,
  cardY: 322,
  cardWidth: 270,
  cardHeight: 321,
  cardBgColor: '#202020', // black.500

  // Card top perforations (Ellipse 21892-21905)
  // 14 circles, 14px diameter, at y=-4 (half-clipped by card overflow:hidden)
  // X positions: 4, 24, 44, 64, 84, 104, 124, 144, 164, 184, 204, 224, 244, 264
  perforationCount: 14,
  perforationSize: 14,
  perforationY: -4,
  perforationStartX: 4,
  perforationSpacing: 20, // 20px between each circle center-to-center

  // Card content frame (160:3118 / Frame 2095586360)
  // Position within card: x=34, y=118
  // Size: 204x144 (HUG height), column, gap=16
  contentX: 34,
  contentY: 118,
  contentWidth: 204,
  contentGap: 16,

  // Card logo (160:3119 / Frame 1686557264 inside card)
  // 26.7x32 white vector
  cardLogoWidth: 26.7,
  cardLogoHeight: 32,

  // Card description text (160:3121 etc.)
  // Position: y=48 within content frame (gap 16 from 32h logo = 48)
  descFontSize: 20,
  descLineHeight: 32,
  descBaseColor: '#CBCBCB', // neutral.300
  descAccentColor: '#FF9A6D', // brand.500

  // Decorative crosshatch group (Group 59: 160:3122)
  // Position within card: x=218, y=36
  // Two diagonal lines (Vector 57, Vector 58), 20.5x20.5 each
  // Stroked #4D4D4D, weight ~0.3
  crosshatch1X: 218,
  crosshatch1Y: 36,
  crosshatchSize: 20.5,
  crosshatchGap: 14.5, // Second line starts at y=14.5

  // Decorative crosshatch group (Group 60: 160:3125)
  // Position within card: x=44, y=28
  crosshatch2X: 44,
  crosshatch2Y: 28,

  // Decorative dashed line (Vector 1: 160:3117)
  // Position: x=8, y=-5.31, rotated ~2.86 degrees
  // Stroke: #4D4D4D
  dashedLineX: 8,
  dashedLineY: -5.31,

  // Pagination dots (41:10855 / Frame 2095586316)
  // Position: x=181, y=673
  // Row, gap=4, 3 dots 8x8
  paginationY: 673,
  dotSize: 8,
  dotGap: 4,
  dotActiveColor: '#FF9A6D', // brand.500
  dotInactiveColor: '#202020', // black.500

  // Button (41:10823 disabled / 41:11076 active)
  // Position: x=40, y=739
  buttonX: 40,
  buttonY: 739,
  buttonWidth: 313,

  // Disabled button: 56h, radius 12, bg #202020, border #202020 1px
  buttonDisabledHeight: 56,
  buttonDisabledRadius: 12,
  buttonDisabledBg: '#202020', // black.500
  buttonDisabledBorder: '#202020',
  buttonDisabledTextColor: '#444444', // neutral.800
  buttonDisabledTextSize: 16,
  buttonDisabledLineHeight: 24,

  // Active button uses PrimaryButton component (step 3)
  // 313x62 (HUG), includes divider 24x2 #4D4D4D + inner 313x52 gradient button
  buttonActiveText: 'Start Flenting \u2192',
  buttonActiveTextSize: 14,
  buttonActiveLineHeight: 20,
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
  const orangePart = step.description.substring(0, step.orangeEnd);
  const grayPart = step.description.substring(step.orangeEnd);

  return (
    <View style={styles.cardFrame}>
      {/* Background rectangle - Figma 160:3102: 270x321 #202020 with shadows */}
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
        {/* Orange part from start to orangeEnd, gray for remainder */}
        <Text style={styles.cardDescText}>
          <Text inherit style={styles.cardDescAccent}>
            {orangePart}
          </Text>
          <Text inherit style={styles.cardDescBase}>
            {grayPart}
          </Text>
        </Text>
      </View>
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
  const { allVerified } = useVerificationStatus();

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
    if (allVerified) {
      router.replace('/(main)');
    } else {
      router.push('/(setup)/pending-steps');
    }
  }, [router, allVerified]);

  const renderItem = useCallback(
    ({ item }: { item: SetupStep }) => (
      <View style={styles.slideContainer}>
        <SetupCard step={item} />
      </View>
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

  return (
    <Screen testID="setup-index-screen" padded={false} safeAreaBottom={false}>
      {/* Background - Figma: #131313 with dotted pattern */}
      <DottedPattern />

      <View style={[styles.container, { paddingTop: Math.max(0, headerPaddingTop) }]}>
        {/* Header frame - Figma 41:10824: x=48, column, gap=34 */}
        <View style={styles.headerFrame}>
          {/* Logo - Figma 41:10825: 32x38.4 white */}
          <Logo size={FIGMA.headerLogoHeight} color={colors.white} />

          {/* Title - Figma 160:3095: 310px wide, fontSize 32, lineHeight 48 */}
          {/* Spans: "Let's get " (0-9) #A9A9A9, " " (9-10) white, "you set up" (10-20) #FF9A6D */}
          <Text style={styles.titleText}>
            <Text inherit style={styles.titleGray}>
              {"Let's get "}
            </Text>
            <Text inherit style={styles.titleAccent}>
              you set up
            </Text>
          </Text>
        </View>

        {/* Card carousel area */}
        <View style={[styles.carouselContainer, { marginTop: titleToCardGap }]}>
          <FlatList
            ref={flatListRef}
            data={SETUP_STEPS}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            snapToAlignment="center"
            decelerationRate="fast"
            bounces={false}
          />
        </View>

        {/* Page indicator - Figma 41:10855: y=673, centered */}
        <View style={{ marginTop: cardToPaginationGap }}>
          <PageIndicator count={SETUP_STEPS.length} activeIndex={activeIndex} />
        </View>

        {/* Spacer pushes button toward bottom */}
        <View style={{ flex: 1, minHeight: paginationToButtonGap }} />

        {/* Button - Figma: x=40, y=739 */}
        {/* Steps 1-2: disabled style (41:10823) */}
        {/* Step 3: active PrimaryButton (41:11076) */}
        <View
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
              title="Start Flenting \u2192"
              onPress={handleStartFlenting}
              disabled
              testID="start-flenting-button"
            />
          )}
        </View>
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
  // fontSize 32, lineHeight 48, letterSpacing -1
  titleText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.titleFontSize, // 32
    lineHeight: FIGMA.titleLineHeight, // 48
    letterSpacing: FIGMA.titleLetterSpacing, // -1
    textAlign: 'left',
  },
  titleGray: {
    color: FIGMA.titleGrayColor, // #A9A9A9
  },
  titleAccent: {
    color: FIGMA.titleAccentColor, // #FF9A6D
  },

  // Carousel container - holds FlatList with card height
  carouselContainer: {
    height: FIGMA.cardHeight, // 321
  },

  // Each slide takes full screen width, card positioned at Figma x=61
  slideContainer: {
    width: SCREEN_WIDTH,
    paddingLeft: FIGMA.cardX, // 61 from left edge
  },

  // Card outer frame - Figma 160:3101
  // 270x321, overflow hidden to clip perforations
  cardFrame: {
    width: FIGMA.cardWidth, // 270
    height: FIGMA.cardHeight, // 321
    overflow: 'hidden',
  },

  // Card background rectangle - Figma 160:3102
  // Full card size, #202020, with drop shadows
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FIGMA.cardBgColor, // #202020
    // Figma shadow 1: rgba(0,0,0,0.1) offset(0,9) blur 19
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 10,
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
  cardDescAccent: {
    color: FIGMA.descAccentColor, // #FF9A6D
  },
  cardDescBase: {
    color: FIGMA.descBaseColor, // #CBCBCB
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
