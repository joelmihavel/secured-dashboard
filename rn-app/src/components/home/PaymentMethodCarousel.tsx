/**
 * PaymentMethodCarousel Component
 * Horizontal scrollable UPI/Card carousel with "Paying with:" label - Figma pixel-perfect
 * Figma Reference: 243-5870, 243-5877 (Frame 2095586448)
 *
 * Figma Pixel-Perfect Values (from 243:5877):
 * - Label "Paying with:": fontSize 14, lineHeight 20, fontWeight 400, color #A6A6A6 (black[200])
 *   - Container: paddingHorizontal 64 (aligned with headline)
 * - Card width: 270px (from PaymentMethodCard)
 * - Card gap: 16px (itemSpacing)
 * - ScrollView contentContainerStyle: paddingLeft 64, paddingRight 32
 * - Pagination dots (ellipse_21885/86/87): width 8, height 8
 *   - Active: backgroundColor #FF9A6D (brand[500])
 *   - Inactive: backgroundColor #202020 (black[500])
 */

import React, { memo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

import { Text } from '@/src/components/ui';
import { PaymentMethodCard, PaymentMethod } from './PaymentMethodCard';
import { PaymentSetupCard } from './PaymentSetupCard';
import { s, sf, isSmallDevice, isLargeDevice } from '@/src/theme/scale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Breakpoint-driven card width for different device sizes
const CARD_WIDTH = isSmallDevice ? 240 : isLargeDevice ? 290 : 270; // Figma: 270px (243:5878)
const CARD_GAP = s(16); // Figma: itemSpacing 16 (243:5877)
const CONTENT_PADDING_LEFT = s(64); // Figma: paddingLeft 64 (243:5877 Frame 2095586448)
const CONTENT_PADDING_RIGHT = s(32); // Figma: paddingRight 32 (243:5877)

export interface PaymentMethodCarouselProps {
  methods: PaymentMethod[];
  showLabel?: boolean;
  showSetupCard?: boolean;
  onMethodPress?: (method: PaymentMethod) => void;
  onMethodEdit?: (method: PaymentMethod) => void;
  onAddPayment?: () => void;
}

function PaymentMethodCarouselComponent({
  methods,
  showLabel = true,
  showSetupCard = true,
  onMethodPress,
  onMethodEdit,
  onAddPayment,
}: PaymentMethodCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Total cards = methods + setup card (if shown)
  const totalCards = methods.length + (showSetupCard ? 1 : 0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    if (index !== activeIndex && index >= 0 && index < totalCards) {
      setActiveIndex(index);
    }
  };

  if (methods.length === 0 && !showSetupCard) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>Paying with:</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {methods.map((method, index) => (
          <View
            key={`${method.type}-${index}`}
            style={styles.cardWrapper}
          >
            <PaymentMethodCard
              method={method}
              onPress={() => onMethodPress?.(method)}
              onEdit={() => onMethodEdit?.(method)}
            />
          </View>
        ))}

        {/* Setup/Add More Card - Figma 243:2762 shows this as last card in carousel */}
        {showSetupCard && (
          <View style={styles.cardWrapper}>
            <PaymentSetupCard onAddPayment={onAddPayment} />
          </View>
        )}
      </ScrollView>

      {/* Pagination dots */}
      {totalCards > 1 && (
        <View style={styles.pagination}>
          {Array.from({ length: totalCards }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: s(12), // Figma: gap between label and cards
  },
  labelContainer: {
    paddingHorizontal: s(64), // Figma: paddingHorizontal 64 (aligned with 243:5872)
  },
  label: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400
    fontSize: sf(14), // Figma: fontSize 14
    lineHeight: sf(20), // Figma: lineHeight 20
    color: '#A6A6A6', // Figma: #A6A6A6 (black[200])
  },
  scrollContent: {
    paddingLeft: CONTENT_PADDING_LEFT, // Figma: 64px (243:5877)
    paddingRight: CONTENT_PADDING_RIGHT, // Figma: 32px (243:5877)
    gap: CARD_GAP, // Figma: 16px itemSpacing (243:5877)
  },
  cardWrapper: {
    // Gap handled by contentContainerStyle gap property for consistent spacing
  },
  cardWrapperLast: {
    // No extra margin needed - paddingRight handles end spacing
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(8), // Figma: gap between dots
    marginTop: s(12), // Figma: spacing
  },
  dot: {
    width: s(8), // Figma: width 8
    height: s(8), // Figma: height 8
    borderRadius: 4, // Figma: fully rounded
  },
  dotActive: {
    backgroundColor: '#FF9A6D', // Figma: #FF9A6D (brand[500])
  },
  dotInactive: {
    backgroundColor: '#202020', // Figma: #202020 (black[500])
  },
});

export const PaymentMethodCarousel = memo(PaymentMethodCarouselComponent);
