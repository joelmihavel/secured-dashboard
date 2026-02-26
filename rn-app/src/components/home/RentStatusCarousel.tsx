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
import { PaymentSetupCard, PaymentSetupCardProps } from './PaymentSetupCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 300px comes from PaymentFlipCard width. 
// Other cards like SetupProgressCard can adapt to this width or have their own fixed width.
const CARD_WIDTH = 300; 
const CARD_GAP = 16;
const CONTENT_PADDING_LEFT = 64; 
const CONTENT_PADDING_RIGHT = 32;

export type CarouselCardItem = 
  | { type: 'payment', id: string, data: PaymentMonthData }
  | { type: 'setup_progress', id: string, data: SetupProgressCardProps }
  | { type: 'landlord_status', id: string, data: LandlordStatusCardProps }
  | { type: 'payment_setup', id: string, data: PaymentSetupCardProps };

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
      case 'payment_setup':
        return (
          <View style={styles.fixedCardWidth}>
            <PaymentSetupCard {...item.data} variant="standalone" />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
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
    gap: 8,
    marginTop: 12,
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