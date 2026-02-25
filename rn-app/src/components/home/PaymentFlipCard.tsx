import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Text } from '@/src/components';
import { colors } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Exact dimensions from Figma (Node 3203-17686 & 3143-15921)
const CARD_WIDTH = 300;
const CARD_HEIGHT = 440;

export type PaymentStampStatus = 'paid' | 'pending' | 'missed' | 'late' | 'future';

export interface PaymentMonthData {
  monthName: string;
  cashbackEarned: number;
  isInsider?: boolean;
  onViewReceipt?: () => void;
  yearlyStamps: PaymentStampStatus[]; // Array of 12 statuses for the back of the card
}

interface PaymentFlipCardProps {
  data: PaymentMonthData;
}

export function PaymentFlipCard({ data }: PaymentFlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useSharedValue(0);

  const handlePress = () => {
    setFlipped(!flipped);
    flipAnim.value = withSpring(flipped ? 0 : 1, {
      damping: 15,
      stiffness: 120,
    });
  };

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

  const renderFront = () => (
    <Animated.View style={[styles.cardContainer, frontAnimatedStyle]}>
      {/* Background Split - Left #1A1A1A, Right #202020 */}
      <View style={styles.backgroundSplit}>
        <View style={styles.bgLeft} />
        <View style={styles.bgRight} />
      </View>

      {/* Decorative Texture Overlay (Rectangle 145/140) */}
      <View style={styles.textureOverlay} />
      <View style={styles.innerBorder} />

      <View style={styles.contentPadding}>
        {/* Top: Insider Sticker */}
        <View style={styles.topSection}>
          <Text style={styles.insiderText}>flent_insider</Text>
          <View style={styles.stickerCircle}>
            <Text style={styles.stickerText}>you did it</Text>
          </View>
        </View>

        {/* Middle: Month & View Receipt */}
        <View style={styles.middleSection}>
          <Text style={styles.monthText}>{data.monthName}</Text>
          <Pressable onPress={data.onViewReceipt}>
            <Text style={styles.viewReceiptText}>View Rent Receipt</Text>
          </Pressable>
        </View>

        {/* Bottom: Cashback */}
        <View style={styles.bottomSection}>
          <Text style={styles.cashbackLabel}>Cashback{'\n'}Earned</Text>
          <Text style={styles.cashbackAmount}>
            ₹  {data.cashbackEarned.toFixed(2)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderBack = () => (
    <Animated.View style={[styles.cardContainer, backAnimatedStyle]}>
      <View style={styles.backgroundSplit}>
        <View style={styles.bgLeft} />
        <View style={styles.bgRight} />
      </View>
      <View style={styles.textureOverlay} />
      <View style={styles.innerBorder} />

      <View style={[styles.contentPadding, styles.backContent]}>
        {/* Top: Header */}
        <View style={styles.backHeader}>
          <Text style={styles.backTitle}>Flent Insider</Text>
          <Text style={styles.backSubtitle}>since {data.monthName}</Text>
        </View>

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
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16, // Assuming standard radius
    overflow: 'hidden',
    backgroundColor: '#000',
    backfaceVisibility: 'hidden',
  },
  backgroundSplit: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  bgLeft: {
    width: 206, // Figma explicit size
    height: '100%',
    backgroundColor: colors.black[600], // #1A1A1A
  },
  bgRight: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.black[500], // #202020
  },
  textureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)', // Approximation of noise overlay
  },
  innerBorder: {
    position: 'absolute',
    top: 15,
    left: 10.5,
    right: 11.5,
    bottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  contentPadding: {
    flex: 1,
    paddingLeft: 28,
    paddingRight: 28,
    paddingTop: 32,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insiderText: {
    color: '#BABABA',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  stickerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF9A6D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerText: {
    fontSize: 8,
    color: '#000',
    textAlign: 'center',
  },
  middleSection: {
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  monthText: {
    color: '#BABABA',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    marginBottom: 4,
  },
  viewReceiptText: {
    color: '#FF9A6D',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
    textDecorationLine: 'underline',
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cashbackLabel: {
    color: '#BABABA',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  cashbackAmount: {
    color: '#FF9A6D',
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  
  // BACK CARD
  backContent: {
    justifyContent: 'flex-start',
  },
  backHeader: {
    marginBottom: 40,
  },
  backTitle: {
    color: '#BABABA',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  backSubtitle: {
    color: '#FF9A6D',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  stampSlot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)', // empty state
    borderWidth: 1,
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
});
