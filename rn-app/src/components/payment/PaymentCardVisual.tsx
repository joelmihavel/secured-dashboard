/**
 * Payment Card Visual
 *
 * Renders a premium textured card with:
 * - Figma 773:12114: Dotted grid texture at 6% opacity
 * - Figma 773:12124: Crosshatch texture at 16% opacity + rgba(0,0,0,0.64) overlay
 * - Orange/brand 1px border
 * - 3D depth effect (shadows + inner gradient highlights)
 * - Network logo top-right (Visa, Mastercard, UPI, Net Banking)
 */

import React, { memo } from 'react';
import { View, Image, StyleSheet, Text as RNText } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/src/theme';

const CARD_TEXTURE_DOTS = require('@/assets/images/payment/card_texture_dots.png');
const CARD_TEXTURE_CROSS = require('@/assets/images/payment/card_texture_cross.png');

type MethodType = 'card' | 'upi' | 'netbanking';

interface PaymentCardVisualProps {
  methodType: MethodType;
  network?: string;
  children: React.ReactNode;
}

// ── Network Logo Components ──────────────────────────────────────────

function VisaLogo() {
  return (
    <RNText style={styles.visaText}>VISA</RNText>
  );
}

function MastercardLogo() {
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

function UpiLogo() {
  return (
    <View style={styles.upiBadge}>
      <RNText style={styles.upiText}>UPI</RNText>
    </View>
  );
}

function NetBankingLogo() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {/* Simple bank/building icon */}
      <Path d="M12 2L2 7v2h20V7L12 2z" fill="rgba(255,255,255,0.6)" />
      <Path d="M4 11v7h3v-7H4zm5 0v7h3v-7H9zm5 0v7h3v-7h-3z" fill="rgba(255,255,255,0.6)" />
      <Path d="M2 20h20v2H2v-2z" fill="rgba(255,255,255,0.6)" />
    </Svg>
  );
}

function NetworkLogo({ methodType, network }: { methodType: MethodType; network?: string }) {
  if (methodType === 'upi') return <UpiLogo />;
  if (methodType === 'netbanking') return <NetBankingLogo />;

  const n = network?.toLowerCase();
  if (n === 'mastercard' || n === 'master') return <MastercardLogo />;
  // Default to Visa for cards
  return <VisaLogo />;
}

// ── Main Component ───────────────────────────────────────────────────

function PaymentCardVisualComponent({ methodType, network, children }: PaymentCardVisualProps) {
  return (
    <View style={styles.cardOuter}>
      <View style={styles.cardInner}>
        {/* Layer 1: Dotted grid texture (Figma 773:12114) — 6% opacity */}
        <Image
          source={CARD_TEXTURE_DOTS}
          style={styles.textureDots}
          resizeMode="cover"
        />

        {/* Layer 2: Crosshatch texture (Figma 773:12124) — 16% opacity + dark overlay */}
        <View style={styles.textureCrossWrap} pointerEvents="none">
          <Image
            source={CARD_TEXTURE_CROSS}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View style={styles.darkOverlay} />
        </View>

        {/* 3D depth: top-edge highlight */}
        <View style={styles.topHighlight} pointerEvents="none" />

        {/* 3D depth: bottom-edge shadow */}
        <View style={styles.bottomShadow} pointerEvents="none" />

        {/* 3D depth: inner edge glow (top) */}
        <View style={styles.innerEdgeTop} pointerEvents="none" />

        {/* Network logo — top right */}
        <View style={styles.logoContainer}>
          <NetworkLogo methodType={methodType} network={network} />
        </View>

        {/* Card content (info rows) */}
        <View style={styles.content}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 3D outer shadow — orange-tinted glow beneath card
  cardOuter: {
    shadowColor: '#FF9A6D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  // Card body — clipped container for textures
  cardInner: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 154, 109, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  // Figma 773:12114 — dotted grid at 6% opacity
  textureDots: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
  },
  // Figma 773:12124 — crosshatch at 16% opacity
  textureCrossWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.16,
  },
  // Dark tint over crosshatch — rgba(0,0,0,0.64)
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  // 3D depth: subtle highlight along top edge
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // 3D depth: gradient shadow along bottom
  bottomShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  // 3D depth: inner top glow band
  innerEdgeTop: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  // Network logo position
  logoContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
  },
  // Card info rows sit above all layers
  content: {
    padding: 16,
    paddingTop: 12,
    gap: 0,
    zIndex: 1,
  },

  // ── Logo styles ────────────────────────
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

export const PaymentCardVisual = memo(PaymentCardVisualComponent);
