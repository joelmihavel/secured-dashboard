/**
 * Setup Flow Index - Post Approval Carousel
 * Figma References: 41-10712, 41-10859, 41-11006
 *
 * Shows a 3-step carousel introducing the setup process:
 * 1. Add landlord's bank details
 * 2. Upload address proof
 * 3. Invite landlord
 *
 * Pixel-perfect implementation from Figma analysis:
 * - Container: 393x852, backgroundColor: #131313 (black.700)
 * - Title: fontSize 32, lineHeight 48, letterSpacing -1
 * - Description: fontSize 20, lineHeight 32, color #CBCBCB (neutral.300)
 * - Button: 313x56, borderRadius 12, backgroundColor #202020 (black.500)
 * - Indicator dots: 8x8, active: #FF9A6D (brand.500), inactive: #202020 (black.500)
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { Screen, Text, PrimaryButton, Logo, DottedPattern } from '@/src/components';
import { colors, spacing, radius, typography } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SetupStep {
  id: string;
  title: string;
  description: string;
}

// Figma content from screens 41-10712, 41-10859, 41-11006
// Multi-color description text uses "||" as delimiter per Figma characterStyleOverrides:
// - Text before "||" = orange (brand.500) - Figma style 1
// - Text after "||" = gray (neutral.300) - Figma base fill
const SETUP_STEPS: SetupStep[] = [
  {
    id: 'bank',
    title: "Let's get you set up",
    description: "Add your landlord's bank details ||to enable payouts",
  },
  {
    id: 'address',
    title: "Let's get you set up",
    description: 'Upload address proof ||to verify your tenancy',
  },
  {
    id: 'landlord',
    title: "Let's get you set up",
    description: 'Invite your landlord ||to finish setup',
  },
];

// Figma exact dimensions from 41-10712
// Using design tokens from theme for colors to ensure parity
const FIGMA = {
  // Card dimensions
  cardWidth: 270,
  cardHeight: 321,
  cardBorderRadius: 0, // No radius per Figma
  cardBackgroundColor: colors.black[500], // #202020 - Figma: colors.black[500]
  cardShadowColor: colors.black[900], // #000000
  cardShadowOffsetY: 9,
  cardShadowRadius: 19,

  // Perforations
  perforationSize: 11.2,
  perforationLargeSize: 14,

  // Title text - Figma shows multi-color text with style overrides
  titleWidth: 310,
  titleHeight: 96,
  titleFontSize: 32,
  titleLineHeight: 48,
  titleLetterSpacing: -1,
  titleColorGray: colors.neutral[500], // #A9A9A9 - Figma style override 44
  titleColorAccent: colors.brand[500], // #FF9A6D - Figma style override 42

  // Description text
  descWidth: 204,
  descHeight: 96,
  descFontSize: 20,
  descLineHeight: 32,
  descColor: colors.neutral[300], // #CBCBCB - Figma: colors.neutral[300]

  // Indicator dots - Figma 41:10855: 8x8 dots with 4px gap (itemSpacing)
  dotSize: 8,
  dotActiveColor: colors.brand[500], // #FF9A6D - Figma: colors.brand[500]
  dotInactiveColor: colors.black[500], // #202020 - Figma: colors.black[500]
  dotGap: 4, // Figma: itemSpacing 4

  // Button
  buttonWidth: 313,
  buttonHeight: 56,
  buttonBorderRadius: 12,
  buttonBackgroundColor: colors.black[500], // #202020 - Figma: colors.black[500]
  buttonTextColor: colors.neutral[800], // #444444 - Figma: colors.neutral[800]
  buttonTextFontSize: 16,
  buttonTextLineHeight: 24,

  // Active button (step 3) - has orange border glow
  buttonActiveBorderColor: colors.brand[500], // #FF9A6D - Figma: colors.brand[500]
  buttonActiveBorderWidth: 1, // Figma stroke width
  buttonActiveBorderRadius: 8,
  buttonActiveHeight: 52,
  buttonActiveShadowColor: '#995C41', // Figma shadow color (no token)
  buttonActiveShadowOffsetY: 6,
  buttonActiveShadowRadius: 12,
  buttonActiveShadowOpacity: 0.24, // Figma: alpha 0.24
  buttonActiveTextColor: colors.white, // #FFFFFF - Figma: colors.white
  buttonActiveTextFontSize: 14,
  // Figma gradient background: #202020 to #0D0D0D (linear top to bottom)
  buttonActiveGradientStart: colors.black[500], // #202020
  buttonActiveGradientEnd: '#0D0D0D', // Figma end color

  // Progress bar
  progressBarWidth: 46.4,
  progressBarHeight: 17.6,
  progressBarColor: colors.brand[500], // #FF9A6D - Figma: colors.brand[500]
  progressBarBorderRadius: 3.2,

  // Layout spacing - Figma exact from 41-10712 geometry
  headerLeftMargin: 48, // Figma: header x=61 on 393 screen (48px from content edge)
  headerGapToTitle: 34, // Figma: Frame 2095586400 itemSpacing
  paginationMarginTop: 30, // Gap between card and pagination
  buttonMarginTop: 58, // Figma: 4838-4772-8=58 (pagination y+h to button y)
  buttonMarginBottom: 57, // Figma: screen bottom - button bottom
} as const;

// Setup card component matching Figma design
function SetupCard({ step, stepIndex }: { step: SetupStep; stepIndex: number }) {
  return (
    <View style={styles.card}>
      {/* Top perforations (8 circles) */}
      <View style={styles.cardPerforations}>
        {[...Array(8)].map((_, i) => (
          <View key={i} style={styles.perforation} />
        ))}
      </View>

      {/* Card progress indicator */}
      <View style={styles.cardProgressRow}>
        <View style={styles.cardProgressBar} />
      </View>

      {/* Card content with logo */}
      <View style={styles.cardContent}>
        <Logo size={32} color={colors.white} />

        {/* Step description in card - Figma multi-color text pattern:
            First part (before ||) = orange (brand.500) per Figma characterStyleOverrides style 1
            Second part (after ||) = gray (neutral.300) per Figma base fill */}
        <View style={styles.cardTextContainer}>
          <Text style={styles.cardDescText}>
            {step.description.split('||').map((part, idx) => (
              <Text
                key={idx}
                style={
                  idx === 0
                    ? [styles.cardDescText, styles.cardDescAccent]
                    : styles.cardDescText
                }
              >
                {part}
              </Text>
            ))}
          </Text>
        </View>
      </View>

      {/* Side perforations (larger circles on left/right edge) */}
      <View style={styles.cardSidePerforations}>
        <View style={[styles.perforationLarge, styles.perforationLeft]} />
        {[...Array(7)].map((_, i) => (
          <View key={i} style={styles.perforationLarge} />
        ))}
        <View style={[styles.perforationLarge, styles.perforationRight]} />
      </View>
    </View>
  );
}

// Page indicator dots - Figma exact
function PageIndicator({ count, activeIndex }: { count: number; activeIndex: number }) {
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
      const targetIndex = Math.max(0, Math.min(parseInt(step, 10) - 1, SETUP_STEPS.length - 1));
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
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
    router.push('/(setup)/pending-steps');
  }, [router]);

  const renderItem = useCallback(
    ({ item, index }: { item: SetupStep; index: number }) => (
      <View style={styles.slideContainer}>
        <SetupCard step={item} stepIndex={index} />
      </View>
    ),
    []
  );

  return (
    <Screen testID="setup-index-screen" padded={false} safeAreaBottom={false}>
      {/* Background - Figma: #131313 with warm-toned illustration overlay */}
      <DottedPattern />

      <View style={[styles.container, { paddingTop: insets.top + 65 }]}>
        {/* Logo - top left */}
        <View style={styles.logoContainer}>
          <Logo size={40} color={colors.white} />
        </View>

        {/* Title - Figma: 310x96, fontSize 32, lineHeight 48, letterSpacing -1 */}
        {/* Multi-color text: "Let's get " (#A9A9A9) + "you set up" (#FF9A6D) */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>
            <Text style={styles.titleTextGray}>{'Let\'s get\n'}</Text>
            <Text style={styles.titleTextAccent}>you set up</Text>
          </Text>
        </View>

        {/* Carousel with cards */}
        <View style={styles.carouselContainer}>
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

        {/* Page indicator - Figma: 8x8 dots */}
        <PageIndicator count={SETUP_STEPS.length} activeIndex={activeIndex} />

        {/* Spacer to push button to bottom */}
        <View style={{ flex: 1 }} />

        {/* Bottom button - changes style on last step per Figma 41-11006 */}
        {/* Figma I41:10823;100:1575: "Start Flenting ->" with arrow */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + FIGMA.buttonMarginBottom }]}>
          {isLastStep ? (
            <TouchableOpacity
              onPress={handleStartFlenting}
              style={styles.buttonActiveWrapper}
              testID="start-flenting-button"
            >
              <LinearGradient
                colors={[FIGMA.buttonActiveGradientStart, FIGMA.buttonActiveGradientEnd]}
                locations={[0, 0.9]}
                style={styles.buttonActiveGradient}
              >
                <Text style={styles.buttonActiveText}>Start Flenting →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleStartFlenting}
              style={styles.buttonInactive}
              testID="start-flenting-button"
            >
              <Text style={styles.buttonInactiveText}>Start Flenting →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Screen>
  );
}

const CARD_WIDTH = FIGMA.cardWidth;
const CARD_HEIGHT = FIGMA.cardHeight;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoContainer: {
    marginLeft: FIGMA.headerLeftMargin, // 48 - Figma left alignment
    marginBottom: FIGMA.headerGapToTitle, // 34 - Figma itemSpacing to title
  },
  titleContainer: {
    marginLeft: FIGMA.headerLeftMargin, // 48 - Figma left alignment (not centered)
    marginBottom: 28, // Figma: card Y=322 - title frame bottom ~294 = 28px gap
  },
  // Title: Figma exact - fontSize 32, lineHeight 48, letterSpacing -1
  // Multi-color text: "Let's get " (#A9A9A9) + "you set up" (#FF9A6D)
  titleText: {
    width: FIGMA.titleWidth, // 310
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.titleFontSize, // 32
    lineHeight: FIGMA.titleLineHeight, // 48
    letterSpacing: FIGMA.titleLetterSpacing, // -1
    textAlign: 'left', // Figma: left-aligned title with marginLeft offset
  },
  titleTextGray: {
    color: FIGMA.titleColorGray, // Figma style override 44 - colors.neutral[500] (#A9A9A9)
  },
  titleTextAccent: {
    color: FIGMA.titleColorAccent, // Figma style override 42 - colors.brand[500] (#FF9A6D)
  },
  carouselContainer: {
    // Fixed height matching card - Figma card at Y=322 from screen top
    height: CARD_HEIGHT,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card: Figma exact - 270x321, backgroundColor #202020, shadow
  card: {
    width: CARD_WIDTH, // 270
    height: CARD_HEIGHT, // 321
    backgroundColor: FIGMA.cardBackgroundColor, // #202020
    borderRadius: FIGMA.cardBorderRadius, // 0
    overflow: 'hidden',
    // Shadow from Figma
    shadowColor: FIGMA.cardShadowColor,
    shadowOffset: { width: 0, height: FIGMA.cardShadowOffsetY },
    shadowOpacity: 1,
    shadowRadius: FIGMA.cardShadowRadius,
    elevation: 10,
  },
  // Top perforations row
  cardPerforations: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: spacing.xs,
    marginTop: -FIGMA.perforationSize / 2,
  },
  perforation: {
    width: FIGMA.perforationSize, // 11.2
    height: FIGMA.perforationSize, // 11.2
    borderRadius: FIGMA.perforationSize / 2,
    backgroundColor: colors.black[700], // #131313 - matches background
  },
  // Progress bar in card
  cardProgressRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cardProgressBar: {
    width: FIGMA.progressBarWidth, // 46.4
    height: FIGMA.progressBarHeight, // 17.6
    backgroundColor: FIGMA.progressBarColor, // #FF9A6D
    borderRadius: FIGMA.progressBarBorderRadius, // 3.2
  },
  // Side perforations
  cardSidePerforations: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  perforationLarge: {
    width: FIGMA.perforationLargeSize, // 14
    height: FIGMA.perforationLargeSize, // 14
    borderRadius: FIGMA.perforationLargeSize / 2,
    backgroundColor: colors.black[700], // #131313
  },
  perforationLeft: {
    marginLeft: -FIGMA.perforationLargeSize / 2,
  },
  perforationRight: {
    marginRight: -FIGMA.perforationLargeSize / 2,
  },
  cardContent: {
    flex: 1,
    padding: spacing.lg, // 24
    paddingTop: spacing.md, // 16
  },
  cardTextContainer: {
    marginTop: spacing.xxl, // 40
    width: FIGMA.descWidth, // 204
  },
  // Description: Figma exact - fontSize 20, lineHeight 32, color #CBCBCB
  cardDescText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: FIGMA.descFontSize, // 20
    lineHeight: FIGMA.descLineHeight, // 32
    color: FIGMA.descColor, // #CBCBCB
    textAlign: 'left', // Figma: card description left-aligned within 204px container
  },
  cardDescAccent: {
    color: colors.brand[500], // #FF9A6D for highlighted words
  },
  // Indicator: Figma exact - 8x8 dots with 4px gap (41:10855)
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: FIGMA.dotGap, // 4 - Figma itemSpacing
    marginTop: FIGMA.paginationMarginTop, // 30 - Figma gap from card to dots
  },
  indicatorDot: {
    width: FIGMA.dotSize, // 8
    height: FIGMA.dotSize, // 8
    borderRadius: FIGMA.dotSize / 2,
    backgroundColor: FIGMA.dotInactiveColor, // #202020
  },
  indicatorDotActive: {
    backgroundColor: FIGMA.dotActiveColor, // #FF9A6D
  },
  buttonContainer: {
    paddingHorizontal: 40, // Figma: button x=53 on 393 screen = 40px margin each side
    alignItems: 'center',
  },
  // Inactive button: Figma 41-10712 - 313x56, borderRadius 12, bg #202020
  // Figma node 41:10823: padding 16 all sides, gap 10, borderRadius 12, overflow visible
  buttonInactive: {
    width: FIGMA.buttonWidth, // 313
    height: FIGMA.buttonHeight, // 56
    backgroundColor: FIGMA.buttonBackgroundColor, // #202020
    borderRadius: FIGMA.buttonBorderRadius, // 12
    paddingHorizontal: spacing.md, // Figma: paddingLeft/Right = 16
    paddingVertical: spacing.md, // Figma: paddingTop/Bottom = 16
    gap: 10, // Figma: itemSpacing = 10
    overflow: 'visible', // Figma: clipsContent = false
    flexDirection: 'row', // Figma: layoutMode = HORIZONTAL
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInactiveText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.buttonTextFontSize, // 16
    lineHeight: FIGMA.buttonTextLineHeight, // 24
    color: FIGMA.buttonTextColor, // #444444
    textAlign: 'center', // Figma: textAlignHorizontal CENTER (I41:10823;100:1575)
  },
  // Active button: Figma 41-11006 - 313x52, orange border, gradient bg, shadow
  // Wrapper provides shadow (shadow doesn't render on gradient in RN)
  buttonActiveWrapper: {
    width: FIGMA.buttonWidth, // 313
    height: FIGMA.buttonActiveHeight, // 52
    borderRadius: FIGMA.buttonActiveBorderRadius, // 8
    // Orange glow shadow - Figma: #995C41 with alpha 0.24
    shadowColor: FIGMA.buttonActiveShadowColor, // #995C41
    shadowOffset: { width: 0, height: FIGMA.buttonActiveShadowOffsetY }, // 6
    shadowOpacity: FIGMA.buttonActiveShadowOpacity, // 0.24 per Figma
    shadowRadius: FIGMA.buttonActiveShadowRadius, // 12
    elevation: 8,
  },
  // Gradient inner with border - Figma: linear gradient #202020 to #0D0D0D
  buttonActiveGradient: {
    width: '100%',
    height: '100%',
    borderWidth: FIGMA.buttonActiveBorderWidth, // 1
    borderColor: FIGMA.buttonActiveBorderColor, // #FF9A6D
    borderRadius: FIGMA.buttonActiveBorderRadius, // 8
    flexDirection: 'row', // Figma: layoutMode = HORIZONTAL
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10, // Figma: itemSpacing = 10
    overflow: 'hidden',
  },
  buttonActiveText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: FIGMA.buttonActiveTextFontSize, // 14
    lineHeight: 20,
    color: FIGMA.buttonActiveTextColor, // #FFFFFF
    textAlign: 'center', // Figma: textAlignHorizontal CENTER (button text)
  },
});
