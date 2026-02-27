/**
 * RentStatusCarousel Component
 * Horizontal scrollable carousel displaying PaymentFlipCards and Setup/Status cards
 * Figma Reference: 684-8639, 684-9249
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

import { PaymentFlipCard, PaymentMonthData } from './PaymentFlipCard';
import { SetupProgressCard, SetupProgressCardProps } from './SetupProgressCard';
import { LandlordStatusCard, LandlordStatusCardProps } from './LandlordStatusCard';

import { BgLine } from '@/src/components/ui/BgLine';
import { s, sv, isSmallDevice, isLargeDevice } from '@/src/theme/scale';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Breakpoint-driven card width for different device sizes
const CARD_WIDTH = isSmallDevice ? 270 : isLargeDevice ? 320 : 300;
const CARD_GAP = s(16);
const CONTENT_PADDING_LEFT = s(64);
const CONTENT_PADDING_RIGHT = s(32);

export type CarouselCardItem = 
  | { type: 'payment', id: string, data: PaymentMonthData }
  | { type: 'setup_progress', id: string, data: SetupProgressCardProps }
  | { type: 'landlord_status', id: string, data: LandlordStatusCardProps }
;

export interface RentStatusCarouselProps {
  items: CarouselCardItem[];
}

function RentStatusCarouselComponent({
  items,
}: RentStatusCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const totalCards = items.length;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    if (index !== activeIndex && index >= 0 && index < totalCards) {
      setActiveIndex(index);
    }
  };

  if (items.length === 0) {
    return null;
  }

  // Figma 684:9453 / 684:9458 - single card should be perfectly centered
  // (SCREEN_WIDTH - CARD_WIDTH) / 2
  const isSingleCard = items.length === 1;
  const singleCardPadding = Math.max(0, (SCREEN_WIDTH - CARD_WIDTH) / 2);

  const renderCard = (item: CarouselCardItem) => {
    switch (item.type) {
      case 'payment':
        return <PaymentFlipCard data={item.data} />;
      case 'setup_progress':
        return (
          <View style={styles.fixedCardWidth}>
            <SetupProgressCard {...item.data} />
          </View>
        );
      case 'landlord_status':
        return (
          <View style={styles.fixedCardWidth}>
            <LandlordStatusCard {...item.data} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* bg_line — Figma 768:303932 behind flip card */}
      <BgLine style={styles.bgLine} />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment={isSingleCard ? 'center' : 'start'}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          isSingleCard && { paddingLeft: singleCardPadding, paddingRight: singleCardPadding }
        ]}
      >
        {items.map((item, index) => (
          <View
            key={item.id}
            style={styles.cardWrapper}
          >
            {renderCard(item)}
          </View>
        ))}
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
    // Container handles its own margins. The parent gives a 24px gap.
  },
  bgLine: {
    position: 'absolute',
    top: sv(200),
    left: s(12),
    zIndex: -1,
  },
  scrollContent: {
    paddingLeft: CONTENT_PADDING_LEFT,
    paddingRight: CONTENT_PADDING_RIGHT,
    gap: CARD_GAP,
  },
  cardWrapper: {
    justifyContent: 'center',
  },
  fixedCardWidth: {
    width: CARD_WIDTH,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(12),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#FF9A6D',
  },
  dotInactive: {
    backgroundColor: '#202020',
  },
});

export const RentStatusCarousel = memo(RentStatusCarouselComponent);