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
import { LinearGradient } from 'expo-linear-gradient';
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
  backgroundDark: '#131313',
  footer: '#1A1A1A',
  border: '#4D4D4D',
  borderProfile: '#663E2C',
  borderSelected: '#FF9A6D',
  textPrimary: '#CBCBCB',
  textSecondary: '#4D4D4D',
  textAccent: '#FF9A6D',
  textDetails: '#D2D2D2',
  selectedBadge: '#1A1A1A',
  profileBadge: '#202020',
} as const;

export type PaymentCardType = 'credit' | 'debit' | 'upi' | 'netbanking';
export type PaymentCardVariant = 'default' | 'profile';

export interface PaymentCardProps {
  type: PaymentCardType;
  variant?: PaymentCardVariant;
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
  variant = 'default',
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

  const renderProfileContent = () => {
    return (
      <View style={styles.profileContainer}>
        {/* Background Split */}
        <View style={styles.profileBgLeft} />
        <View style={styles.profileBgRight} />

        {/* Decorative Vertical Lines */}
        <LinearGradient
          colors={['#131313', '#995C41', '#131313']}
          locations={[0.1, 0.52, 0.75]}
          style={[styles.profileLine, { left: 220 }]}
        />
        <LinearGradient
          colors={['#131313', '#995C41', '#131313']}
          locations={[0.1, 0.52, 0.75]}
          style={[styles.profileLine, { left: 225 }]}
        />

        {/* Current/Selected Badge */}
        {selected && (
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>current</Text>
          </View>
        )}

        {/* Logo/Network (placeholder for now or use prop) */}
        <View style={styles.profileNetworkContainer}>
          {logo ? (
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.networkPlaceholder} />
          )}
        </View>

        {/* Divider Line */}
        <View style={styles.profileDivider} />

        {/* Card Details at bottom */}
        <View style={styles.profileDetails}>
          <Text style={styles.profileDetailsTitle}>
            {type === 'upi' ? 'UPI' : `${bankName || 'Visa'} · ${type === 'debit' ? 'Debit' : 'Credit'}`}
          </Text>
          <Text style={styles.profileDetailsValue}>
            {type === 'upi' ? upiId : `•••• ${lastFourDigits || '****'}`}
          </Text>
        </View>
      </View>
    );
  };

  const renderCardContent = () => {
    if (variant === 'profile') return renderProfileContent();

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
      accessibilityLabel={`${getTypeLabel()}${lastFourDigits ? ` ending in ${lastFourDigits}` : ''}${upiId ? ` ${upiId}` : ''}${bankName ? ` ${bankName}` : ''}${selected ? ', selected' : ''}`}
    >
      <Animated.View
        style={[
          styles.container,
          variant === 'profile' && styles.containerProfile,
          selected && styles.containerSelected,
          animatedStyle,
          style,
        ]}
      >
        {/* Card Body */}
        <View style={[styles.cardBody, variant === 'profile' && styles.cardBodyProfile]}>
          {renderCardContent()}
        </View>

        {/* Card Footer - Only for default variant */}
        {variant === 'default' && (
          <View style={styles.cardFooter}>
            <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
            <View style={styles.footerDots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>
        )}
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
  containerProfile: {
    borderWidth: 2,
    borderColor: CARD_COLORS.borderProfile,
  },
  cardBodyProfile: {
    padding: 0,
    backgroundColor: 'transparent', // Split handled in profileContainer
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  profileBgLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 94,
    backgroundColor: '#202020',
  },
  profileBgRight: {
    position: 'absolute',
    left: 94,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#131313',
  },
  profileLine: {
    position: 'absolute',
    width: 2,
    height: 140,
    top: 17,
  },
  profileBadge: {
    position: 'absolute',
    top: 36,
    right: 16,
    backgroundColor: '#202020',
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileBadgeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#FF9A6D',
  },
  profileNetworkContainer: {
    position: 'absolute',
    left: 0,
    top: 46,
    width: 94,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkPlaceholder: {
    width: 32,
    height: 12,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  profileDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 108,
    height: 1,
    backgroundColor: '#131313',
  },
  profileDetails: {
    position: 'absolute',
    left: 32,
    bottom: 48,
    gap: 8,
  },
  profileDetailsTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    color: CARD_COLORS.textDetails,
    lineHeight: 20,
  },
  profileDetailsValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    color: CARD_COLORS.textDetails,
    lineHeight: 24,
  },
});

export const PaymentCard = memo(PaymentCardComponent);
