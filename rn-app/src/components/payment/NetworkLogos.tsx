/**
 * Shared Network Logo Components
 *
 * Used by both PaymentCardVisual (enter-amount flow) and PaymentCard (profile variant).
 * SVG-based logos for Visa, Mastercard, UPI, and Net Banking.
 */

import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type MethodType = 'card' | 'upi' | 'netbanking';

export function VisaLogo() {
  return <RNText style={styles.visaText}>VISA</RNText>;
}

export function MastercardLogo() {
  return (
    <Svg width={36} height={22} viewBox="0 0 36 22">
      <Circle cx={13} cy={11} r={10} fill="#EB001B" opacity={0.9} />
      <Circle cx={23} cy={11} r={10} fill="#F79E1B" opacity={0.9} />
      <Path
        d="M18 2.6A10.97 10.97 0 0 1 23 11a10.97 10.97 0 0 1-5 8.4A10.97 10.97 0 0 1 13 11a10.97 10.97 0 0 1 5-8.4z"
        fill="#FF5F00"
        opacity={0.9}
      />
    </Svg>
  );
}

export function UpiLogo() {
  return (
    <View style={styles.upiBadge}>
      <RNText style={styles.upiText}>UPI</RNText>
    </View>
  );
}

export function NetBankingLogo() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L2 7v2h20V7L12 2z" fill="rgba(255,255,255,0.6)" />
      <Path d="M4 11v7h3v-7H4zm5 0v7h3v-7H9zm5 0v7h3v-7h-3z" fill="rgba(255,255,255,0.6)" />
      <Path d="M2 20h20v2H2v-2z" fill="rgba(255,255,255,0.6)" />
    </Svg>
  );
}

export function NetworkLogo({ methodType, network }: { methodType: MethodType; network?: string }) {
  if (methodType === 'upi') return <UpiLogo />;
  if (methodType === 'netbanking') return <NetBankingLogo />;

  const n = network?.toLowerCase();
  if (n === 'mastercard' || n === 'master') return <MastercardLogo />;
  return <VisaLogo />;
}

const styles = StyleSheet.create({
  visaText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
  },
  upiBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  upiText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
  },
});
