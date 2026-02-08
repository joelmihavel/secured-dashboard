/**
 * Payment Card Component
 * Figma: Credit/Debit card display with selected state
 *
 * EXACT Figma Values:
 * - Container: 270x400, radius 12px
 * - Card body: #202020
 * - Card footer: #1A1A1A, 64px height
 * - Selected state: orange accent border
 * - Text: Plus Jakarta Sans
 */

import React, { memo } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, Image, ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { colors, springConfig } from '@/src/theme';

// Exact Figma color values
const CARD_COLORS = {
  background: '#202020',
  footer: '#1A1A1A',
  border: '#4D4D4D',
  borderSelected: '#FF9A6D',
  textPrimary: '#CBCBCB',
  textSecondary: '#4D4D4D',
  textAccent: '#FF9A6D',
  selectedBadge: '#1A1A1A',
} as const;

export type PaymentCardType = 'credit' | 'debit' | 'upi' | 'netbanking';

export interface PaymentCardProps {
  type: PaymentCardType;
  lastFourDigits?: string;
  expiryDate?: string;
  cvv?: string;
  bankName?: string;
  upiId?: string;
  logo?: ImageSourcePropType;
  selected?: boolean;
  onPress?: () => void;
  onSelect?: () => void;
  style?: ViewStyle;
  testID?: string;
}

function PaymentCardComponent({
  type,
  lastFourDigits,
  expiryDate,
  cvv = '•••',
  bankName,
  upiId,
  logo,
  selected = false,
  onPress,
  onSelect,
  style,
  testID,
}: PaymentCardProps) {
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
    onPress?.();
    onSelect?.();
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'credit':
        return 'CREDIT CARD';
      case 'debit':
        return 'DEBIT CARD';
      case 'upi':
        return 'UPI';
      case 'netbanking':
        return 'NETBANKING';
      default:
        return '';
    }
  };

  const renderCardContent = () => {
    if (type === 'upi') {
      return (
        <View style={styles.cardContent}>
          {logo && <Image source={logo} style={styles.logo} resizeMode="contain" />}
          <View style={styles.upiContent}>
            {upiId && (
              <Text style={[styles.upiId, selected && styles.textSelected]}>{upiId}</Text>
            )}
            {bankName && <Text style={styles.bankName}>{bankName}</Text>}
          </View>
        </View>
      );
    }

    if (type === 'netbanking') {
      return (
        <View style={styles.cardContent}>
          {logo && <Image source={logo} style={styles.bankLogo} resizeMode="contain" />}
          <View style={styles.bankContent}>
            {bankName && (
              <Text style={[styles.bankNameLarge, selected && styles.textSelected]}>
                {bankName}
              </Text>
            )}
          </View>
        </View>
      );
    }

    // Credit/Debit card
    return (
      <View style={styles.cardContent}>
        {logo && <Image source={logo} style={styles.logo} resizeMode="contain" />}
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedText}>SELECTED</Text>
          </View>
        )}
        <View style={styles.cardDetails}>
          {lastFourDigits && (
            <Text style={[styles.cardNumber, selected && styles.textSelected]}>
              •••• {lastFourDigits}
            </Text>
          )}
          {expiryDate && <Text style={styles.expiry}>EXPIRY {expiryDate}</Text>}
          <Text style={styles.cvv}>CVV {cvv}</Text>
        </View>
        <View style={styles.chipContainer}>
          <View style={styles.chip} />
          <View style={styles.chipLines}>
            <View style={styles.chipLine} />
            <View style={styles.chipLine} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Animated.View
        style={[
          styles.container,
          selected && styles.containerSelected,
          animatedStyle,
          style,
        ]}
      >
        {/* Card Body */}
        <View style={styles.cardBody}>{renderCardContent()}</View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
          <View style={styles.footerDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerSelected: {
    borderColor: CARD_COLORS.borderSelected,
  },
  cardBody: {
    flex: 1,
    backgroundColor: CARD_COLORS.background,
    padding: 24,
    paddingLeft: 32,
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logo: {
    width: 50,
    height: 16,
  },
  bankLogo: {
    width: 60,
    height: 40,
  },
  selectedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: CARD_COLORS.selectedBadge,
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    opacity: 0,
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: CARD_COLORS.textAccent,
    textAlign: 'center',
  },
  cardDetails: {
    gap: 4,
  },
  cardNumber: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: CARD_COLORS.textSecondary,
  },
  textSelected: {
    color: CARD_COLORS.textAccent,
  },
  expiry: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.textSecondary,
  },
  cvv: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: CARD_COLORS.textSecondary,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    width: 40,
    height: 30,
    backgroundColor: CARD_COLORS.border,
    borderRadius: 4,
  },
  chipLines: {
    gap: 4,
  },
  chipLine: {
    width: 20,
    height: 2,
    backgroundColor: CARD_COLORS.border,
    borderRadius: 1,
  },
  upiContent: {
    gap: 4,
  },
  upiId: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 18,
    lineHeight: 28,
    color: CARD_COLORS.textSecondary,
  },
  bankName: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.textSecondary,
  },
  bankContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bankNameLarge: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 20,
    lineHeight: 28,
    color: CARD_COLORS.textSecondary,
  },
  cardFooter: {
    height: 64,
    backgroundColor: CARD_COLORS.footer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  typeLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: CARD_COLORS.textPrimary,
  },
  footerDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    borderWidth: 1,
    borderColor: CARD_COLORS.textPrimary,
  },
});

export const PaymentCard = memo(PaymentCardComponent);
