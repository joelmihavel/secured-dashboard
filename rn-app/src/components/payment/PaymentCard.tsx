/**
 * Payment Card Component
 * Figma: Credit/Debit card display with selected state
 *
 * EXACT Figma Values (from figma-1on1parity extraction 2990-13009):
 * - Container: 270x400, radius 12px, stroke #663E2C 2px INSIDE
 * - Background: #1A1A1A, left panel #202020 (w=94), right panel #131313
 * - Gradient lines: x=220/225, y=17, h=140
 * - Divider: y=108, stroke #131313
 * - Plus icons: #FF9A6D at (4,201), (4,381), (254,381)
 * - Logo: y=46 in left panel, center aligned
 * - Badge: x=188, y=36, bg #202020, borderRadius 200
 * - Details: y=240, paddingLeft=32, paddingRight=16, gap=28
 */

import React, { memo, useState } from 'react';
import { View, Pressable, StyleSheet, ViewStyle, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '@/src/components/ui/Typography';
import { colors } from '@/src/theme';

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

/** Decorative plus icon used at card corners in profile variant */
const PlusIcon = ({ style: iconStyle }: { style: ViewStyle }) => (
  <View style={[profileStyles.plusIcon, iconStyle]}>
    <View style={profileStyles.plusH} />
    <View style={profileStyles.plusV} />
  </View>
);

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

  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    setPressed(false);
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
    const isCard = type === 'credit' || type === 'debit';

    return (
      <View style={styles.profileContainer}>
        {/* Background Split — Figma 2990:13010 (left #202020) + 2990:13012 (right #131313) */}
        <View style={styles.profileBgLeft} />
        <View style={styles.profileBgRight} />

        {/* Horizontal Divider — Figma 2990:13011, y=108 */}
        <View style={styles.profileDivider} />

        {/* Decorative Vertical Gradient Lines — Figma 2990:13013 (x=220) + 2990:13014 (x=225) */}
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

        {/* Decorative Plus Icons — Figma 2990:13016 (4,201) / 13017 (4,381) / 13018 (254,381) */}
        <PlusIcon style={{ left: 4, top: 201 }} />
        <PlusIcon style={{ left: 4, top: 381 }} />
        <PlusIcon style={{ left: 254, top: 381 }} />

        {/* Network Logo — Figma 2990:13019, x=0 y=46 w=94 h=28, center aligned */}
        {logo && (
          <View style={styles.profileNetworkContainer}>
            <Image source={logo} style={styles.profileLogo} resizeMode="contain" />
          </View>
        )}

        {/* Current/Selected Badge — Figma 2990:13021, x=188 y=36 */}
        {selected && (
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>current</Text>
          </View>
        )}

        {/* Card Details — Figma 2990:13023 (y=240, pl=32, pr=16) → 13024 (gap=28) */}
        <View style={styles.profileDetailsSection}>
          {isCard ? (
            <>
              {/* Figma 2990:13025 — info block, gap=8 */}
              <View style={styles.profileInfoBlock}>
                {/* Figma 2990:13026 — "Visa · Credit", 14/20, base #D2D2D2, span 7-13 #FF9A6D */}
                <Text style={styles.profileDetailLine}>
                  <Text style={styles.profileTextLight}>{bankName || 'Visa'} · </Text>
                  <Text style={styles.profileTextAccent}>
                    {type === 'debit' ? 'Debit' : 'Credit'}
                  </Text>
                </Text>
                {/* Figma 2990:13027 — "Expiry 06/26", 14/20, base #D2D2D2, span 7-12 #FF9A6D */}
                {expiryDate && (
                  <Text style={styles.profileDetailLine}>
                    <Text style={styles.profileTextLight}>Expiry </Text>
                    <Text style={styles.profileTextAccent}>{expiryDate}</Text>
                  </Text>
                )}
              </View>
              {/* Figma 2990:13028 — "•••• 2341", 16/24, base #FF9A6D, span 5-9 #D2D2D2 */}
              <Text style={styles.profileCardNumber}>
                <Text style={styles.profileTextAccent}>•••• </Text>
                <Text style={styles.profileTextLight}>
                  {lastFourDigits || '****'}
                </Text>
              </Text>
            </>
          ) : type === 'upi' ? (
            <>
              <View style={styles.profileInfoBlock}>
                <Text style={styles.profileDetailLine}>
                  <Text style={styles.profileTextAccent}>UPI</Text>
                </Text>
              </View>
              {/* Figma 2990:13044 — "rishabh@•••", 16/24, prefix #D2D2D2 + masked #FF9A6D */}
              <Text style={styles.profileCardNumber}>
                {upiId && upiId.includes('@') ? (
                  <>
                    <Text style={styles.profileTextLight}>{upiId.split('@')[0]}@</Text>
                    <Text style={styles.profileTextAccent}>•••</Text>
                  </>
                ) : (
                  <Text style={styles.profileTextLight}>{upiId || ''}</Text>
                )}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.profileInfoBlock}>
                <Text style={styles.profileDetailLine}>
                  <Text style={styles.profileTextAccent}>Netbanking</Text>
                </Text>
              </View>
              <Text style={styles.profileCardNumber}>
                <Text style={styles.profileTextLight}>{bankName || ''}</Text>
              </Text>
            </>
          )}
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
          selected && variant !== 'profile' && styles.containerSelected,
          {
            transitionProperty: 'transform',
            transitionDuration: '150ms',
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
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
  // Figma 2990:13009 — profile container: stroke #663E2C 2px INSIDE
  containerProfile: {
    borderWidth: 2,
    borderColor: '#663E2C',
  },
  cardBodyProfile: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  // Figma 2990:13009 — root bg #1A1A1A, overflow hidden
  profileContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  // Figma 2990:13010 — left panel, x=0, w=94, bg #202020
  profileBgLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 94,
    backgroundColor: '#202020',
  },
  // Figma 2990:13012 — right panel, x=94, bg #131313
  profileBgRight: {
    position: 'absolute',
    left: 94,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#131313',
  },
  // Figma 2990:13013/14 — vertical gradient lines, y=17, h=140
  profileLine: {
    position: 'absolute',
    width: 2,
    height: 140,
    top: 17,
  },
  // Figma 2990:13011 — horizontal divider, y=108
  profileDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 108,
    height: 1,
    backgroundColor: '#131313',
  },
  // Figma 2990:13019 — network logo in left panel, y=46, w=94, h=16
  profileNetworkContainer: {
    position: 'absolute',
    left: 0,
    top: 46,
    width: 94,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLogo: {
    width: 50,
    height: 16,
  },
  // Figma 2990:13021 — "current" badge, x=188 y=36, bg #202020, borderRadius 200, padding 8/12
  profileBadge: {
    position: 'absolute',
    top: 36,
    right: 16,
    backgroundColor: '#202020',
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // Figma 2990:13022 — "current" text, 12/20, #FF9A6D
  profileBadgeText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
  },
  // Figma 2990:13023 — details section, y=240, pl=32, pr=16
  profileDetailsSection: {
    position: 'absolute',
    top: 240,
    left: 0,
    right: 0,
    paddingLeft: 32,
    paddingRight: 16,
    gap: 28, // Figma 2990:13024 gap
  },
  // Figma 2990:13025 — info block (type + expiry), gap=8
  profileInfoBlock: {
    gap: 8,
  },
  // Figma 2990:13044 ref — all detail text 16/24 (md-2/Regular 400)
  profileDetailLine: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  // Figma 2990:13028 — card number row, 16px/24
  profileCardNumber: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  // Mixed-color text spans
  profileTextLight: {
    color: CARD_COLORS.textDetails, // #D2D2D2
  },
  profileTextAccent: {
    color: CARD_COLORS.textAccent, // #FF9A6D
  },
});

// Figma 2990:13016/17/18 — decorative plus icons, stroke #FF9A6D weight 1 ROUND
const profileStyles = StyleSheet.create({
  plusIcon: {
    position: 'absolute',
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusH: {
    position: 'absolute',
    width: 7,
    height: 1,
    backgroundColor: '#FF9A6D',
    borderRadius: 0.5,
  },
  plusV: {
    position: 'absolute',
    width: 1,
    height: 7,
    backgroundColor: '#FF9A6D',
    borderRadius: 0.5,
  },
});

export const PaymentCard = memo(PaymentCardComponent);
