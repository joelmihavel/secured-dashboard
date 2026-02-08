/**
 * CreditCardSelect Component
 * Figma IDs: 243-3816 (default), 243-3794 (selected)
 * Credit card display with selection state for payment method selection
 *
 * EXACT Figma Values:
 * - Container: 270x400, borderRadius 12
 * - Card body: 270x336, backgroundColor #202020
 * - Card body padding: top 24, right 16, bottom 24, left 32
 * - Card footer: 270x64, backgroundColor #1A1A1A
 * - Selected badge: pill shape, backgroundColor #1A1A1A, borderRadius 200
 * - Card number: fontSize 20, lineHeight 32, color #FF9A6D (selected) / #4D4D4D (default)
 * - Expiry/CVV: fontSize 16, lineHeight 24, color #4D4D4D
 * - Footer label: fontSize 14, lineHeight 20, color #CBCBCB
 */

import React, { memo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  Image,
  ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';

import { Text } from '@/src/components/ui/Typography';
import { colors, spacing, radius, typography, springConfig } from '@/src/theme';

// Exact Figma color values
const CARD_COLORS = {
  cardBody: '#202020',
  cardFooter: '#1A1A1A',
  cardNumberDefault: '#4D4D4D',
  cardNumberSelected: '#FF9A6D',
  secondaryText: '#4D4D4D',
  footerText: '#CBCBCB',
  selectedBadgeBg: '#1A1A1A',
  selectedBadgeText: '#FF9A6D',
  logoWhite: '#FFFFFF',
  chipBorder: '#4D4D4D',
} as const;

// Visa logo SVG icon
const VisaLogo = ({ width = 50, height = 16 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 50 16" fill="none">
    <Path
      d="M18.5 1.5L15 14.5H11.5L15 1.5H18.5ZM33.5 9.5L35.5 3.5L36.5 9.5H33.5ZM37.5 14.5H41L38 1.5H35C34 1.5 33.5 2 33 3L27 14.5H31L31.5 12.5H36.5L37.5 14.5ZM28.5 10C28.5 6.5 23.5 6 23.5 4.5C23.5 4 24 3.5 25 3.5C26.5 3.5 28 4 28.5 4.5L29.5 2C28.5 1.5 27 1 25 1C21.5 1 19 3 19 5.5C19 9 24 9.5 24 11C24 11.5 23.5 12 22.5 12C21 12 19 11 18.5 10.5L17.5 13C18.5 13.5 20.5 14.5 22.5 14.5C26 14.5 28.5 12.5 28.5 10ZM14 1.5L9.5 14.5H6L2 3.5C2 3 1.5 2.5 1 2.5C0 2 0 2 0 2L0.5 1.5H6C7 1.5 7.5 2 7.5 3L8.5 10L12 1.5H14Z"
      fill={CARD_COLORS.logoWhite}
    />
  </Svg>
);

// Search/Link icon for footer
const LinkIcon = ({ color = CARD_COLORS.footerText }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" />
    <Path d="M11 11L14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

// Mastercard logo component
const MastercardLogo = ({ width = 50, height = 30 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 50 30" fill="none">
    <Circle cx="18" cy="15" r="12" fill="#EB001B" />
    <Circle cx="32" cy="15" r="12" fill="#F79E1B" />
    <Path
      d="M25 6C27.5 8 29 11.5 29 15C29 18.5 27.5 22 25 24C22.5 22 21 18.5 21 15C21 11.5 22.5 8 25 6Z"
      fill="#FF5F00"
    />
  </Svg>
);

export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'other';

export interface CreditCardSelectProps {
  /** Last 4 digits of the card number (displayed as **** XXXX) */
  cardNumber: string;
  /** Bank name or issuer */
  bankName?: string;
  /** Card expiry date (MM/YY format) */
  expiryDate?: string;
  /** Card network type for logo display */
  cardNetwork?: CardNetwork;
  /** Custom logo image source */
  logo?: ImageSourcePropType;
  /** Whether this card is currently selected */
  selected?: boolean;
  /** Callback when card is selected */
  onSelect?: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

function CreditCardSelectComponent({
  cardNumber,
  bankName,
  expiryDate = '06/26',
  cardNetwork = 'visa',
  logo,
  selected = false,
  onSelect,
  style,
  testID,
}: CreditCardSelectProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig.snappy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig.snappy);
  };

  const handlePress = () => {
    onSelect?.();
  };

  const renderLogo = () => {
    if (logo) {
      return <Image source={logo} style={styles.logo} resizeMode="contain" />;
    }

    switch (cardNetwork) {
      case 'visa':
        return <VisaLogo />;
      case 'mastercard':
        return <MastercardLogo />;
      default:
        return <VisaLogo />;
    }
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Credit card ending in ${cardNumber}${selected ? ', selected' : ''}`}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Header Row - Logo and Selected Badge */}
          <View style={styles.headerRow}>
            {renderLogo()}
            {selected && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>SELECTED</Text>
              </View>
            )}
          </View>

          {/* Card Details Section */}
          <View style={styles.detailsSection}>
            {/* Card Number */}
            <Text
              style={[
                styles.cardNumber,
                selected && styles.cardNumberSelected,
              ]}
            >
              {'\u2022\u2022\u2022\u2022'} {cardNumber}
            </Text>

            {/* Expiry and CVV */}
            <View style={styles.expirySection}>
              <Text style={styles.expiryText}>EXPIRY {expiryDate}</Text>
              <Text style={styles.cvvText}>CVV {'\u2022\u2022\u2022'}</Text>
            </View>
          </View>

          {/* Chip Decoration (decorative squares in corner) */}
          <View style={styles.chipDecoration}>
            <View style={styles.chipSquare} />
            <View style={styles.chipSquare} />
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerContent}>
            <Text style={styles.footerLabel}>CREDIT CARD</Text>
            <LinkIcon />
          </View>
          {/* Footer icon (Flent logo placeholder) */}
          <View style={styles.flentLogoPlaceholder} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 270,
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardBody: {
    width: 270,
    height: 336,
    backgroundColor: CARD_COLORS.cardBody,
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 24,
    paddingLeft: 32,
    // Figma 243:3795 uses gap: 120 between header and details sections
    // Using justifyContent to achieve similar visual spacing
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 16,
  },
  selectedBadge: {
    backgroundColor: CARD_COLORS.selectedBadgeBg,
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: CARD_COLORS.selectedBadgeText,
    textAlign: 'center',
  },
  detailsSection: {
    gap: 28,
  },
  cardNumber: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: CARD_COLORS.cardNumberDefault,
  },
  cardNumberSelected: {
    color: CARD_COLORS.cardNumberSelected,
  },
  expirySection: {
    gap: 8,
  },
  expiryText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.secondaryText,
  },
  cvvText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.secondaryText,
  },
  chipDecoration: {
    position: 'absolute',
    // Figma 243:3805/3808: chips at right edge of card body
    // Card body paddingRight: 16, chips inside that padding area
    right: 16,
    top: 125, // Figma: Group 58 starts at y=125 from card top
    gap: 14.5, // Figma: gap between chip squares
  },
  chipSquare: {
    width: 20.5,
    height: 20.5,
    borderWidth: 0.3,
    borderColor: CARD_COLORS.chipBorder,
  },
  cardFooter: {
    width: 270,
    height: 64,
    backgroundColor: CARD_COLORS.cardFooter,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingRight: 32,
    paddingBottom: 24,
    paddingLeft: 32,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.footerText,
  },
  flentLogoPlaceholder: {
    width: 20,
    height: 24,
  },
});

export const CreditCardSelect = memo(CreditCardSelectComponent);
