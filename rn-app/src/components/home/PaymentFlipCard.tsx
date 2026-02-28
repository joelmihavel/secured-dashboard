import React, { memo, useRef } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Text as RNText } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Text as SvgText, TextPath, Defs, Path } from 'react-native-svg';
import { Text } from '@/src/components/ui/Typography';
import { colors } from '@/src/theme';
import { s, sf, sv, isSmallDevice, isLargeDevice } from '@/src/theme/scale';
import { PaymentBadge } from './PaymentBadge';
import type { BadgeVariant } from './PaymentBadge';

// Pre-load static assets for the card back animations
const PATTERN_IMG = require('../../../assets/images/card-back/pattern.png');
const FRONT_PATTERN = require('../../../assets/images/card-front/front-pattern.png');
const INNER_PLATE = require('../../../assets/images/card-front/inner-plate.svg');
const INNER_PLATE_BACK = require('../../../assets/images/card-back/inner-plate-back.svg');
const FLENT_LOGO = require('../../../assets/images/card-back/flent-logo.svg');
const CHAIR_GREEN = require('../../../assets/images/card-back/chair-green.png');
const CHAIR_RED = require('../../../assets/images/card-back/chair-red.png');
const SOFA_YELLOW = require('../../../assets/images/card-back/sofa-yellow.png');
const STICKER_PAID = require('../../../assets/images/card-back/sticker-paid.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Exact dimensions from Figma (Node 3203-17686 & 3143-15921) — breakpoint-scaled
const CARD_WIDTH = isSmallDevice ? 270 : isLargeDevice ? 320 : 300;
const CARD_HEIGHT = sv(440);

export type PaymentStampStatus = 'paid' | 'pending' | 'missed' | 'late' | 'future';
export type PaymentStatusType = 'paid' | 'late' | 'missed' | 'upcoming';

export interface PaymentMonthData {
  monthName: string;
  cashbackEarned: number;
  isInsider?: boolean;
  status: PaymentStatusType;
  onViewReceipt?: () => void;
  yearlyStamps: PaymentStampStatus[]; // Array of 12 statuses for the back of the card
  /** Cumulative late payment count (for red badge number) */
  lateCount?: number;
  /** Cumulative missed payment count (for yellow badge number) */
  missedCount?: number;
  /** Action for zero state when there are no payment methods setup */
  onAddPaymentMethod?: () => void;
  /** Rent due day of month (e.g. 4 for 4th) — shown in upcoming stamp */
  rentDueDay?: number;
  /** Unique index to cycle between 3D furniture assets */
  cardIndex?: number;
}

interface PaymentFlipCardProps {
  data: PaymentMonthData;
}

export const PaymentFlipCard = memo(function PaymentFlipCard({ data }: PaymentFlipCardProps) {
  const flippedRef = useRef(false);
  const flipAnim = useSharedValue(0);

  // Cycle through furniture sequentially: Sofa Yellow -> Chair Green -> Chair Red -> repeat
  const furnitureType = React.useMemo(() => {
    const cycle = (data.cardIndex ?? 0) % 3;
    if (cycle === 0) return 'sofa-yellow';
    if (cycle === 1) return 'chair-green';
    return 'chair-red';
  }, [data.cardIndex]);

  // Single shared value for the chosen furniture piece
  const furnitureAnim = useSharedValue(0);

  const handlePress = () => {
    const toFlipped = !flippedRef.current;
    flippedRef.current = toFlipped;

    // Smooth card flip (600ms ease-in-out)
    flipAnim.value = withTiming(toFlipped ? 1 : 0, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });

    if (toFlipped) {
      furnitureAnim.value = 0;
      furnitureAnim.value = withDelay(
        300,
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.out(Easing.cubic) }),
          withTiming(0.97, { duration: 200, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        ),
      );
    } else {
      furnitureAnim.value = withTiming(0, { duration: 250 });
    }
  };

  // Pre-compute scaled drop distance outside worklet (sv uses JS-thread APIs)
  const FURNITURE_DROP = sv(50);

  const furnitureStyle = useAnimatedStyle(() => {
    const p = furnitureAnim.value;
    const clampedP = Math.min(p, 1);
    // Drop from slightly above center to the center
    const translateY = interpolate(clampedP, [0, 1], [-FURNITURE_DROP, 0], Extrapolation.CLAMP);
    const scale = interpolate(clampedP, [0, 0.5, 1], [0.5, 1.05, 1], Extrapolation.CLAMP);
    const opacity = interpolate(clampedP, [0, 0.3], [0, 1], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { perspective: 500 },
        { translateY: translateY + (p > 1 ? interpolate(p, [1, 1.08], [0, -6], Extrapolation.CLAMP) : 0) },
        { scale },
      ],
    };
  });

  // Front card rotates from 0 to 180 (hidden at 90)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${spinVal}deg` },
      ],
      zIndex: flipAnim.value < 0.5 ? 2 : 1,
      opacity: flipAnim.value < 0.5 ? 1 : 0,
    };
  });

  // Back card rotates from -180 to 0
  const backAnimatedStyle = useAnimatedStyle(() => {
    const spinVal = interpolate(flipAnim.value, [0, 1], [-180, 0]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${spinVal}deg` },
      ],
      zIndex: flipAnim.value >= 0.5 ? 2 : 1,
      opacity: flipAnim.value >= 0.5 ? 1 : 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });

  const backBgAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(flipAnim.value, [0.5, 1], ['#1A1A1A', '#131313']),
    };
  });

  const getStatusConfig = () => {
    switch (data.status) {
      case 'late':
        return { badgeVariant: 'late' as BadgeVariant, badgeCount: data.lateCount ?? 1, label: 'Cashback\nEarned', showReceipt: true };
      case 'missed':
        return { badgeVariant: 'missed' as BadgeVariant, badgeCount: data.missedCount ?? 1, label: 'Cashback\nEarned', showReceipt: true };
      case 'upcoming':
        return { badgeVariant: 'upcoming' as BadgeVariant, badgeCount: 0, label: 'Cashback\nPotential', showReceipt: false };
      case 'paid':
      default:
        return { badgeVariant: 'paid' as BadgeVariant, badgeCount: 0, label: 'Cashback\nEarned', showReceipt: true };
    }
  };

  const config = getStatusConfig();

  const renderFront = () => (
    <Animated.View style={[styles.cardContainer, frontAnimatedStyle]}>
      {/* Background Split - Left #202020, Right #1A1A1A */}
      <View style={styles.backgroundSplit}>
        <View style={styles.bgLeft} />
        <View style={styles.bgRight} />
      </View>

      {/* Decorative Texture Overlay — Figma 687:7852 Rectangle 145 at 48% opacity */}
      <Image source={FRONT_PATTERN} style={[StyleSheet.absoluteFillObject, { opacity: 0.48 }]} contentFit="cover" />

      {/* 4 Corner Cross Marks (Outline Icon Library + Vectors) */}
      <View style={[styles.cornerCross, { left: s(4), top: sv(9) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(282), top: sv(9) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(4), top: sv(424) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(282), top: sv(424) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>

      {/* Frame 2095586545 - Vectorized Outline (Rectangle 140) */}
      <View style={styles.outlineBox} pointerEvents="none">
        <Image source={INNER_PLATE} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      </View>

      <View style={styles.contentPadding}>
        {/* Top: Insider Sticker */}
        <View style={styles.topSection}>
          {data.isInsider && (
            <Text style={styles.insiderText}>
              flent<Text style={styles.insiderAccent} inherit>_insider</Text>
            </Text>
          )}
          <PaymentBadge
              variant={config.badgeVariant}
              count={config.badgeCount}
              size={94}
            />
        </View>

        {/* Middle: Month & View Receipt */}
        <View style={styles.middleSection}>
          <Text style={styles.monthText}>{data.monthName}</Text>
          {config.showReceipt ? (
            <Pressable onPress={data.onViewReceipt}>
              <Text style={styles.viewReceiptText}>View Rent Receipt</Text>
            </Pressable>
          ) : (
            <Text style={styles.upcomingPaymentText}>Upcoming Payment</Text>
          )}
        </View>

        {/* Bottom: Cashback Box (Frame 2095586539) or Add Payment Method */}
        {data.onAddPaymentMethod ? (
          <LinearGradient
            colors={['rgba(77, 77, 77, 0.08)', 'rgba(179, 179, 179, 0.08)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cashbackBox}
          >
            <Pressable 
              onPress={data.onAddPaymentMethod} 
              style={styles.addPaymentContainer}
            >
              <Text style={styles.addPaymentText}>+ add new payment method</Text>
            </Pressable>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['rgba(77, 77, 77, 0.08)', 'rgba(179, 179, 179, 0.08)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cashbackBox}
          >
            <View style={styles.cashbackRow}>
              <Text style={styles.cashbackLabel}>{config.label}</Text>
              <View style={styles.cashbackAmountContainer}>
                <RNText style={styles.cashbackCurrency}>₹</RNText>
                <RNText style={styles.cashbackAmountValue}>
                  {Math.round(data.cashbackEarned)}
                </RNText>
                <RNText style={styles.cashbackDecimal}>.00</RNText>
              </View>
            </View>
          </LinearGradient>
        )}
      </View>
    </Animated.View>
  );

  const renderBack = () => (
    <Animated.View style={[styles.cardContainer, backAnimatedStyle]}>
      {/* Solid background matching figma node 696:8140 */}
      <Animated.View style={[styles.backSolidBackground, backBgAnimatedStyle]} />
      <View style={styles.textureOverlay} />

      {/* 4 Corner Cross Marks */}
      <View style={[styles.cornerCross, { left: s(4), top: sv(9) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(282), top: sv(9) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(4), top: sv(424) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>
      <View style={[styles.cornerCross, { left: s(282), top: sv(424) }]}>
        <View style={styles.crossV} />
        <View style={styles.crossH} />
      </View>

      {/* Adding pattern background matching figma node 696:8157 Rectangle 145 */}
      <Image source={PATTERN_IMG} style={styles.patternBackground} contentFit="cover" />

      {/* Frame 2095586545 - Vectorized Outline (Rectangle 140) and Vector 1 (Flent Logo) */}
      <View style={styles.outlineBox} pointerEvents="none">
        <Image source={INNER_PLATE_BACK} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <Image source={FLENT_LOGO} style={styles.flentLogo} contentFit="contain" />
      </View>

      {/* Animated Furniture from 696-8140 */}
      <View style={styles.furnitureContainer} pointerEvents="none">
        <Animated.View style={[styles.furnitureCenteredWrapper, furnitureStyle]}>
          <Image
            source={
              furnitureType === 'sofa-yellow' ? SOFA_YELLOW :
              furnitureType === 'chair-green' ? CHAIR_GREEN :
              CHAIR_RED
            }
            style={
              furnitureType === 'sofa-yellow' ? styles.sofaYellow :
              furnitureType === 'chair-green' ? styles.chairGreen :
              styles.chairRed
            }
            contentFit="contain"
          />
        </Animated.View>
      </View>

      <View style={[styles.contentPadding, styles.backContent]}>
        {/* Grid of 12 Stamps */}
        <View style={styles.stampsGrid}>
          {data.yearlyStamps.slice(0, 12).map((status, idx) => (
            <View key={idx} style={[styles.stampSlot, styles[`stamp_${status}`]]}>
              {/* If we had specific images, we'd render them here. 
                  For now, we render deterministic colored indicators matching Figma */}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );

  return (
    <Pressable onPress={handlePress} style={styles.wrapper}>
      {renderFront()}
      {renderBack()}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    backfaceVisibility: 'hidden',
  },
  backgroundSplit: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  bgLeft: {
    width: s(94), // Figma 694:6562 — left strip #202020
    height: '100%',
    backgroundColor: colors.black[500], // #202020
  },
  bgRight: {
    flex: 1, // Figma 694:6561 — rest is #1A1A1A (same as card base)
    height: '100%',
    backgroundColor: colors.black[600], // #1A1A1A
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)', // Approximation of noise overlay
  },
  outlineBox: {
    position: 'absolute',
    top: sv(15),
    left: s(11),
    width: s(278),
    height: sv(415),
    borderRadius: 12,
    overflow: 'hidden',
  },
  cornerCross: {
    position: 'absolute',
    width: s(12),
    height: sv(12),
  },
  crossV: {
    position: 'absolute',
    left: s(5.5),
    top: sv(2.5),
    width: 1, // keep 1px hairline
    height: sv(7),
    backgroundColor: '#FF9A6D',
    borderRadius: 1,
  },
  crossH: {
    position: 'absolute',
    left: s(2.5),
    top: sv(5.5),
    width: s(7),
    height: 1, // keep 1px hairline
    backgroundColor: '#FF9A6D',
    borderRadius: 1,
  },
  contentPadding: {
    flex: 1,
    paddingLeft: s(28),
    paddingRight: s(28),
    paddingTop: sv(32),
    paddingBottom: sv(32),
  },
  topSection: {
    position: 'absolute',
    left: s(28),
    top: sv(32),
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: sv(16),
  },
  insiderText: {
    color: '#BABABA',
    fontSize: sf(12), // Figma: Font Size/Body/sm = 12px
    lineHeight: sf(20), // Figma: Line Height/Body/sm = 20px
    fontFamily: 'PlusJakartaSans-Medium',
    zIndex: 10, // Ensure it sits above anything else on the back card
  },
  insiderAccent: {
    color: '#FF9A6D',
  },
  badgeContainer: {
    width: s(94),
    height: s(94),
  },
  middleSection: {
    position: 'absolute',
    left: s(28),
    top: sv(250),
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: sv(4),
  },
  monthText: {
    color: '#BABABA',
    fontSize: sf(16),
    lineHeight: sf(24),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  viewReceiptText: {
    color: '#FF9A6D',
    fontSize: sf(16),
    lineHeight: sf(24),
    fontFamily: 'PlusJakartaSans-Regular',
    textDecorationLine: 'underline', // Figma 694:6573
  },
  upcomingPaymentText: {
    color: '#BABABA',
    fontSize: sf(16),
    lineHeight: sf(24),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cashbackBox: {
    position: 'absolute',
    left: s(28),
    top: sv(325),
    width: s(245),
    borderTopWidth: 0.5, // keep hairline
    borderBottomWidth: 0.5, // keep hairline
    borderColor: '#4D4D4D',
    padding: s(16), // Figma 694:6582: p-16 all sides
  },
  cashbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: s(213),
  },
  cashbackLabel: {
    color: '#BABABA',
    fontSize: sf(12),
    lineHeight: sf(20),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cashbackAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cashbackCurrency: {
    color: '#878787',
    fontSize: sf(14),
    lineHeight: sf(28),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cashbackAmountValue: {
    color: '#FF9A6D',
    fontSize: sf(32),
    lineHeight: sf(40),
    fontFamily: 'PlusJakartaSans-Regular',
    letterSpacing: -1,
  },
  cashbackDecimal: {
    color: '#878787',
    fontSize: sf(14),
    lineHeight: sf(28),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  addPaymentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPaymentText: {
    color: '#FF9A6D',
    fontSize: sf(12),
    lineHeight: sf(20),
    fontFamily: 'PlusJakartaSans-Regular',
    textAlign: 'center',
    textDecorationLine: 'underline', // Figma 705:6521
  },

  // BACK CARD
  backSolidBackground: {
    ...StyleSheet.absoluteFillObject,
    // Base color overridden by animated style
  },
  flentLogo: {
    position: 'absolute',
    left: s(127),
    top: sv(40),
    width: s(27),
    height: sv(32),
  },
  backContent: {
    justifyContent: 'flex-start',
  },
  backHeader: {
    marginBottom: sv(40),
  },
  backTitle: {
    color: '#BABABA',
    fontSize: sf(16),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  backSubtitle: {
    color: '#FF9A6D',
    fontSize: sf(16),
    fontFamily: 'PlusJakartaSans-Regular',
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(16),
    justifyContent: 'center',
    marginTop: sv(88), // Push down to avoid overlapping the absolute topSection
  },
  stampSlot: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    backgroundColor: 'rgba(255,255,255,0.05)', // empty state
    borderWidth: 1, // keep 1px hairline
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stamp_paid: {
    backgroundColor: 'rgba(6, 194, 112, 0.2)',
    borderColor: '#06C270',
  },
  stamp_late: {
    backgroundColor: 'rgba(255, 154, 109, 0.2)',
    borderColor: '#FF9A6D',
  },
  stamp_missed: {
    backgroundColor: 'rgba(229, 72, 77, 0.2)',
    borderColor: '#E5484D',
  },
  stamp_pending: {
    backgroundColor: 'rgba(199, 201, 217, 0.2)',
    borderColor: '#C7C9D9',
  },
  stamp_future: {
    // defaults to empty slot style
  },

  // FURNITURE & PATTERN
  patternBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.48, // matching figma: opacity 0.48
  },
  furnitureContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 5,
  },
  furnitureCenteredWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: sv(32), // positioned towards bottom with padding
    alignItems: 'center',
    justifyContent: 'center',
  },
  sofaYellow: {
    width: s(225.4),
    height: sv(104.12),
  },
  chairGreen: {
    width: s(180.68),
    height: sv(148.83),
  },
  chairRed: {
    width: s(182.82),
    height: sv(160.0),
  }
});
