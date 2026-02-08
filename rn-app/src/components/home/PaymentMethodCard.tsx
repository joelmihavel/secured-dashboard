/**
 * PaymentMethodCard Component
 * Individual UPI/Card payment method card - Figma pixel-perfect
 * Figma Reference: 243-2762, 243-2967, 243-6490
 *
 * Figma Pixel-Perfect Values:
 * - Card container: width 270, borderRadius 12
 * - Card body: width 270, backgroundColor #202020
 *   - Padding: top 24, bottom 24, left 32, right 16
 * - Card footer: height 64, backgroundColor #1A1A1A, padding 16
 * - Selected Pill: bg #1A1A1A, text #FF9A6D, font 12
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text, Logo } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { scaled, scaledFont, scaledSpacing } from '@/src/theme/scale';

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

  /**
   * Render details with proper nested Text structure for multi-styled text
   * Figma: Single <Text> with nested <Text> spans for different colors
   * This ensures text stays on single line with mixed styling
   */
  const renderDetails = () => {
    if (method.type === 'card') {
      return (
        <View style={styles.cardDetailsContainer}>
          {/* Card number: "•••• 2341" - single Text with nested spans */}
          <Text style={styles.cardNumber}>
            <Text style={styles.cardNumberDots}>{'\u2022\u2022\u2022\u2022'} </Text>
            <Text style={isSelected ? styles.cardNumberAccent : styles.cardNumberValue}>
              {method.cardLastFour}
            </Text>
          </Text>
          <View style={styles.cardInfoWrapper}>
            {/* EXPIRY: "EXPIRY 06/26" - single Text with nested spans */}
            <Text style={styles.cardInfoText}>
              <Text style={styles.cardLabel}>EXPIRY </Text>
              <Text style={styles.cardValue}>{method.cardExpiry}</Text>
            </Text>
            {/* CVV: "CVV •••" - single Text with nested spans */}
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
        {/* Bank account: "ICICI a/c - xxx23" - single Text with nested spans */}
        <Text style={styles.accountText}>
          <Text style={styles.accountBankName}>
            {method.bankName} {method.type === 'netbanking' ? 'Bank' : 'a/c'} -{' '}
          </Text>
          <Text style={isSelected ? styles.accentText : styles.accountMasked}>
            {method.accountMasked}
          </Text>
        </Text>
        {/* UPI ID: "rishabh@•••" - single Text with nested spans */}
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
          <Ionicons name="pencil" size={scaled(10)} color={colors.white} />
        </TouchableOpacity>
        <Logo size={scaled(24)} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: scaled(270),
    borderRadius: scaled(12),
    overflow: 'hidden',
  },
  cardBody: {
    backgroundColor: '#202020',
    paddingTop: scaledSpacing(24),
    paddingBottom: scaledSpacing(24),
    paddingLeft: scaledSpacing(32),
    paddingRight: scaledSpacing(16),
    justifyContent: 'space-between',
  },
  cardBodyLarge: {
    height: scaled(336), // Full height for Credit Card (243-6490)
  },
  cardBodySmall: {
    height: scaled(200), // Compact for others
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  // Logos
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
    fontSize: scaledFont(12),
    fontWeight: '700',
    color: '#27803B',
  },
  upiLogoIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#F06321',
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
    fontSize: scaledFont(20),
    fontWeight: '700',
    color: colors.white,
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  bankText: {
    fontSize: scaledFont(16),
    fontWeight: '500',
    color: colors.white,
  },
  // Selected Badge
  selectedBadge: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: scaledSpacing(12),
    paddingVertical: scaledSpacing(8),
    borderRadius: 200,
  },
  selectedText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(12),
    color: '#FF9A6D', // Figma: brand[500]
    // Figma nodes: 243:2776, 243:2861, 243:2883, 243:6310, 243:6395, 243:6417 "SELECTED"
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  // Details - Figma: proper nested Text structure for multi-styled text
  detailsContainer: {
    gap: scaledSpacing(4),
  },
  // Base text style for account info
  accountText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(16),
  },
  // Bank name part: gray color - Figma 243:6610 "ICICI a/c -"
  accountBankName: {
    color: '#CBCBCB', // Figma: neutral[300] - visible on dark bg
  },
  // Masked account part: gray by default - Figma 243:6610 "xxx23"
  accountMasked: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  // Accent text when selected
  accentText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(20),
    color: '#FF9A6D', // Figma: brand[500]
  },
  // UPI ID with nested spans: "rishabh@•••"
  upiIdText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(16),
  },
  upiIdVisible: {
    color: '#878787', // Figma: neutral[600] - UPI ID visible part
  },
  upiIdMasked: {
    color: '#878787', // Figma: neutral[600] - masked portion
  },
  // Card Details - Figma: nested Text for "•••• 2341"
  cardDetailsContainer: {
    gap: scaledSpacing(28),
  },
  // Card number base style
  cardNumber: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(20),
  },
  // Dots part "••••"
  cardNumberDots: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  // Value part "2341"
  cardNumberValue: {
    color: '#CBCBCB', // Figma: neutral[300]
  },
  // Accent color when selected
  cardNumberAccent: {
    color: '#FF9A6D', // Figma: brand[500]
  },
  cardInfoWrapper: {
    gap: scaledSpacing(8),
  },
  // Single text line for "EXPIRY 06/26" and "CVV •••"
  cardInfoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(16),
  },
  cardLabel: {
    color: '#878787', // Figma: neutral[600] - "EXPIRY", "CVV" labels
  },
  cardValue: {
    color: '#CBCBCB', // Figma: neutral[300] - values like "06/26"
  },
  // Footer
  cardFooter: {
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaledSpacing(32),
    height: scaled(64),
  },
  typeEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scaledSpacing(4),
  },
  typeLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: scaledFont(14),
    color: '#CBCBCB',
    textTransform: 'uppercase',
  },
});

export const PaymentMethodCard = memo(PaymentMethodCardComponent);
