/**
 * PaymentMethodCard Component
 * Individual UPI/Card payment method card - Figma pixel-perfect
 * Figma Reference: 243-2762, 243-2967, 243-6490
 *
 * Figma Pixel-Perfect Values:
 * - Card container: width 270, borderRadius 12
 * - Card body: width 270, backgroundColor #202020
 *   - Padding: top 24, bottom 24, left 32, right 16
 * - Card footer: height 64, backgroundColor #1A1A1A, paddingHorizontal 32
 * - Selected Pill: bg #1A1A1A, text #FF9A6D, fontSize 12
 * - UPI Logo: white bg, green "UPI" text, orange "P" icon
 * - Account text: fontSize 16, bankName #CBCBCB, accent #FF9A6D
 * - UPI ID text: fontSize 16, color #878787
 * - Type label: fontSize 14, color #CBCBCB
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, Logo } from '@/src/components/ui';
import { colors } from '@/src/theme';

export type HomePaymentMethodType = 'upi' | 'card' | 'netbanking';

export interface PaymentMethod {
  type: HomePaymentMethodType;
  bankName: string;
  accountMasked: string;
  upiId?: string;
  cardBrand?: string;
  cardLastFour?: string;
  cardExpiry?: string;
  isSelected: boolean;
}

export interface PaymentMethodCardProps {
  method: PaymentMethod;
  onPress?: () => void;
  onEdit?: () => void;
}

function PaymentMethodCardComponent({ method, onPress, onEdit }: PaymentMethodCardProps) {
  const isCard = method.type === 'card';
  const isSelected = method.isSelected;

  const renderBrandLogo = () => {
    switch (method.type) {
      case 'upi':
        return (
          <View style={styles.upiLogoContainer}>
            <Text style={styles.upiLogoText}>UPI</Text>
            <View style={styles.upiLogoIcon}>
              <Text style={styles.upiIconText}>P</Text>
            </View>
          </View>
        );
      case 'card':
        return (
          <Text style={styles.visaText}>{method.cardBrand || 'VISA'}</Text>
        );
      case 'netbanking':
        return (
          <Text style={styles.bankText}>{method.bankName}</Text>
        );
    }
  };

  const renderDetails = () => {
    if (method.type === 'card') {
      return (
        <View style={styles.cardDetailsContainer}>
          <Text style={styles.cardNumber}>
            <Text style={styles.cardNumberDots}>{'\u2022\u2022\u2022\u2022'} </Text>
            <Text style={isSelected ? styles.cardNumberAccent : styles.cardNumberValue}>
              {method.cardLastFour}
            </Text>
          </Text>
          <View style={styles.cardInfoWrapper}>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardLabel}>EXPIRY </Text>
              <Text style={styles.cardValue}>{method.cardExpiry}</Text>
            </Text>
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardLabel}>CVV </Text>
              <Text style={styles.cardValue}>{'\u2022\u2022\u2022'}</Text>
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.accountText}>
          <Text style={styles.accountBankName}>
            {method.bankName} {method.type === 'netbanking' ? 'Bank' : 'a/c'} -{' '}
          </Text>
          <Text style={isSelected ? styles.accentText : styles.accountMasked}>
            {method.accountMasked}
          </Text>
        </Text>
        {method.upiId && (
          <Text style={styles.upiIdText}>
            <Text style={styles.upiIdVisible}>{method.upiId.split('@')[0]}@</Text>
            <Text style={styles.upiIdMasked}>{'\u2022\u2022\u2022'}</Text>
          </Text>
        )}
      </View>
    );
  };

  const getTypeLabel = () => {
    switch (method.type) {
      case 'upi': return 'UPI';
      case 'card': return 'CREDIT CARD';
      case 'netbanking': return 'NET BANKING';
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Card Body */}
      <View style={[styles.cardBody, isCard ? styles.cardBodyLarge : styles.cardBodySmall]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          {renderBrandLogo()}
          {isSelected && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedText}>SELECTED</Text>
            </View>
          )}
        </View>

        {/* Details */}
        {renderDetails()}
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.typeEditContainer} onPress={onEdit}>
          <Text style={styles.typeLabel}>{getTypeLabel()}</Text>
          <Ionicons name="pencil" size={10} color={colors.white} />
        </TouchableOpacity>
        <Logo size={24} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 270, // Figma: exact 270px
    borderRadius: 12, // Figma: borderRadius 12
    overflow: 'hidden',
  },
  cardBody: {
    backgroundColor: '#202020', // Figma: #202020
    paddingTop: 24, // Figma: paddingTop 24
    paddingBottom: 24, // Figma: paddingBottom 24
    paddingLeft: 32, // Figma: paddingLeft 32
    paddingRight: 16, // Figma: paddingRight 16
    justifyContent: 'space-between',
  },
  cardBodyLarge: {
    height: 336, // Figma: full height for Credit Card
  },
  cardBodySmall: {
    height: 336, // Figma: 400 total - 64 footer = 336 (same as all card types)
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // UPI Logo
  upiLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
  },
  upiLogoText: {
    fontSize: 12, // Figma: exact
    fontWeight: '700',
    color: '#27803B',
  },
  upiLogoIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#E9661C', // Figma 243-5870: #E9661C for UPI P icon
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiIconText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.white,
  },
  visaText: {
    fontSize: 20, // Figma: exact
    fontWeight: '700',
    color: colors.white,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  bankText: {
    fontSize: 16, // Figma: exact
    fontWeight: '500',
    color: colors.white,
  },
  // Selected Badge
  selectedBadge: {
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A
    paddingHorizontal: 12, // Figma: exact
    paddingVertical: 8, // Figma: exact
    borderRadius: 200, // Figma: pill shape
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12, // Figma: exact
    color: '#FF9A6D', // Figma: brand[500]
    textAlign: 'center',
  },
  // Details
  detailsContainer: {
    gap: 4, // Figma: gap 4
  },
  accountText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16, // Figma: exact
  },
  accountBankName: {
    color: '#4D4D4D', // Figma 243-5870: #4D4D4D for bank name text on card
  },
  accountMasked: {
    color: '#4D4D4D', // Figma 243-5870: #4D4D4D for masked account text
  },
  accentText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20, // Figma: accent is larger
    color: '#FF9A6D', // Figma: brand[500]
  },
  upiIdText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16, // Figma: exact
  },
  upiIdVisible: {
    color: '#4D4D4D', // Figma 243-5870: #4D4D4D for UPI ID visible text
  },
  upiIdMasked: {
    color: '#FF9A6D', // Figma 243:2866: brand[500] for masked dots
  },
  // Card Details
  cardDetailsContainer: {
    gap: 28, // Figma: gap 28
  },
  cardNumber: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20, // Figma: exact
  },
  cardNumberDots: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  cardNumberValue: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  cardNumberAccent: {
    color: '#FF9A6D', // Figma: brand[500]
  },
  cardInfoWrapper: {
    gap: 8, // Figma: gap 8
  },
  cardInfoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16, // Figma: exact
  },
  cardLabel: {
    color: '#4D4D4D', // Figma 243-5870: #4D4D4D for EXPIRY/CVV labels
  },
  cardValue: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  // Footer
  cardFooter: {
    backgroundColor: '#1A1A1A', // Figma: #1A1A1A
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32, // Figma: exact
    height: 64, // Figma: exact
  },
  typeEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Figma: gap 4
  },
  typeLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14, // Figma: exact
    color: '#CBCBCB', // Figma: neutral[300]
    textTransform: 'uppercase',
  },
});

export const PaymentMethodCard = memo(PaymentMethodCardComponent);
