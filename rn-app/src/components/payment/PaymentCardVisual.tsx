/**
 * Payment Card Visual
 *
 * Vertical portrait credit card per Figma 773:12110
 */

import React, { memo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { colors } from '@/src/theme';
import { NetworkLogo } from './NetworkLogos';
import Svg, { Path } from 'react-native-svg';

const CREDIT_CARD_BG = require('@/assets/images/payment/credit_card_bg.png');
const CREDIT_CARD_CHIP = require('@/assets/images/payment/credit_card_chip.png');

interface PaymentCardVisualProps {
  methodType: 'card' | 'upi' | 'netbanking';
  network?: string;
  lastFour?: string;
  isDefault?: boolean;
  cardType?: string; // credit or debit
}

function PaymentCardVisualComponent({
  methodType,
  network,
  lastFour = '----',
  isDefault = false,
  cardType = 'credit',
}: PaymentCardVisualProps) {
  if (methodType !== 'card') {
    return null;
  }

  return (
    <View style={styles.cardContainer}>
      {/* The main credit card frame */}
      <View style={styles.cardInner}>
        {/* The background texture from Figma */}
        <Image
          source={CREDIT_CARD_BG}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Rectangle 141 (Left strip) */}
        <View style={styles.leftStrip} />

        {/* Rectangle 142 (Right strip) */}
        <View style={styles.rightStrip} />

        {/* Rectangles 143 & 144 (Vertical lines) */}
        <View style={styles.gradientLine1} />
        <View style={styles.gradientLine2} />

        {/* Network Logo */}
        <View style={styles.logoContainer}>
          <NetworkLogo methodType={methodType} network={network} />
        </View>

        {/* "current" badge */}
        {isDefault && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentText}>current</Text>
          </View>
        )}

        {/* Horizontal Line 1 */}
        <View style={styles.horizontalLine} />

        {/* Chip area - Rectangle 140 */}
        <View style={styles.chipContainer}>
          <Image
            source={CREDIT_CARD_CHIP}
            style={styles.chipImage}
            resizeMode="contain"
          />
        </View>

        {/* Corner Decors */}
        <View style={[styles.cornerDecor, styles.decorBottomLeft]}>
          <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <Path d="M6 3V10M3 6H10" stroke="#4D4D4D" strokeWidth="1" />
          </Svg>
        </View>
        <View style={[styles.cornerDecor, styles.decorBottomRight]}>
          <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <Path d="M6 3V10M3 6H10" stroke="#4D4D4D" strokeWidth="1" />
          </Svg>
        </View>
        <View style={[styles.cornerDecor, styles.decorMidLeft]}>
          <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <Path d="M6 3V10M3 6H10" stroke="#4D4D4D" strokeWidth="1" />
          </Svg>
        </View>

        {/* Text Details */}
        <View style={styles.textContainer}>
          <Text style={styles.cardTypeLabel}>
            {network ? (network.charAt(0).toUpperCase() + network.slice(1)) : 'Unknown'} · {cardType.charAt(0).toUpperCase() + cardType.slice(1)}
          </Text>
          <Text style={styles.cardNumberLabel}>•••• {lastFour}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: 270,
    height: 400,
    alignSelf: 'center',
    marginVertical: 16,
  },
  cardInner: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderColor: '#663E2C',
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  leftStrip: {
    position: 'absolute',
    left: 0,
    top: -20,
    width: 94,
    height: 440,
    backgroundColor: '#202020',
  },
  rightStrip: {
    position: 'absolute',
    left: 94,
    top: -20,
    width: 186,
    height: 440,
    backgroundColor: '#131313',
  },
  gradientLine1: {
    position: 'absolute',
    left: 220,
    top: 17,
    width: 2,
    height: 140,
    backgroundColor: '#995C41', // Simulating gradient logic
  },
  gradientLine2: {
    position: 'absolute',
    left: 225,
    top: 17,
    width: 2,
    height: 140,
    backgroundColor: '#995C41',
  },
  logoContainer: {
    position: 'absolute',
    left: 16,
    top: 46,
  },
  currentBadge: {
    position: 'absolute',
    left: 188,
    top: 36,
    width: 66,
    height: 36,
    backgroundColor: '#202020',
    borderRadius: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
    lineHeight: 20,
    color: '#FF9A6D',
  },
  horizontalLine: {
    position: 'absolute',
    left: -65,
    top: 108,
    width: 400,
    height: 1,
    backgroundColor: '#131313',
  },
  chipContainer: {
    position: 'absolute',
    left: 10,
    top: 269,
    width: 250,
    height: 118,
  },
  chipImage: {
    width: '100%',
    height: '100%',
  },
  cornerDecor: {
    position: 'absolute',
    width: 12,
    height: 12,
  },
  decorMidLeft: {
    left: 4,
    top: 263,
  },
  decorBottomLeft: {
    left: 4,
    top: 381,
  },
  decorBottomRight: {
    left: 254,
    top: 381,
  },
  textContainer: {
    position: 'absolute',
    left: 32,
    top: 302,
    width: 222,
    gap: 8,
  },
  cardTypeLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#D2D2D2',
  },
  cardNumberLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: '#D2D2D2',
  },
});

export const PaymentCardVisual = memo(PaymentCardVisualComponent);
