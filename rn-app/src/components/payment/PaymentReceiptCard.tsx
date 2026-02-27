/**
 * PaymentReceiptCard — Shared receipt card component
 *
 * Extracted from success.tsx / processing.tsx / failed.tsx to eliminate ~200 lines
 * of duplicated receipt card visuals across payment status screens.
 *
 * Figma References:
 * - Card frame: 270x481, bg #202020
 * - Perforated top: 14 ellipses, 14x14px each
 * - Side notches: 14x14px at y:256
 * - Paperclip: absolute positioned top-left
 * - Grid lines: 369x235 behind card
 * - Stamp: rotated -15deg, dashed outer/inner circles, stars, label
 * - Title: "Payment\n{State}" with accent color on second line
 */

import React, { memo, ReactNode } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BgLine } from '@/src/components/ui/BgLine';

import { Text } from '../ui/Typography';
import { PAYMENT_COLORS } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// ============================================
// TYPES
// ============================================

export interface PaymentReceiptCardProps {
  stampText: string | null;
  stampColor: string | null;
  stampImage?: any;
  titleLine1: string;
  titleLine2: string;
  titleLine2Color?: string;
  children: ReactNode;
  showGridLines?: boolean;
  showPaperclip?: boolean;
  /** Override default top margin (default: 183 - safeAreaTop). Use smaller values to move card up. */
  topMargin?: number;
  /** Override title left margin (default: s(-5) = 19px from card edge) */
  titleMarginLeft?: number;
  /** Override content area top padding (default: sv(80)) */
  contentPaddingTop?: number;
}

// ============================================
// FIGMA TOKENS — aliased from shared PAYMENT_COLORS
// ============================================

const CARD_COLORS = {
  background: PAYMENT_COLORS.background,
  cardBackground: PAYMENT_COLORS.cardBackground,
  paperclipColor: PAYMENT_COLORS.paperclip,
  dividerColor: PAYMENT_COLORS.divider,
  titleWhite: PAYMENT_COLORS.white,
  titleAccent: PAYMENT_COLORS.accent,
} as const;

// ============================================
// SUB-COMPONENTS
// ============================================

const Paperclip = memo(() => (
  <Svg width={24} height={48} viewBox="0 0 24 48" fill="none">
    <Path
      d="M12 4V44M12 4C12 4 20 4 20 12V36C20 44 12 44 12 44M12 4C12 4 4 4 4 12V28"
      stroke={CARD_COLORS.paperclipColor}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));
Paperclip.displayName = 'Paperclip';

const PerforatedEdge = memo(() => {
  const holes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View style={styles.perforatedEdge}>
      {holes.map((i) => (
        <View key={i} style={styles.punchHole} />
      ))}
    </View>
  );
});
PerforatedEdge.displayName = 'PerforatedEdge';

const Star = memo(({ color }: { color: string }) => (
  <View style={styles.starIcon}>
    <Svg width={8} height={8} viewBox="0 0 8 8" fill="none">
      <Path
        d="M4 0L5.236 2.404L7.804 2.764L5.902 4.636L6.382 7.236L4 6.13L1.618 7.236L2.098 4.636L0.196 2.764L2.764 2.404L4 0Z"
        fill={color}
      />
    </Svg>
  </View>
));
Star.displayName = 'Star';

/** Decorative bg_line — Figma 768:303932 (Vector 45) */

/** Stamp with SVG stars — fallback for text-only, or direct image */
const ReceiptStamp = memo(({ text, color, image }: { text: string; color: string; image?: any }) => {
  if (image) {
    return (
      <View style={styles.stampContainer}>
        <Image source={image} style={styles.stampPng} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={styles.stampContainer}>
      <View style={[styles.stampOuter, { borderColor: color }]}>
        <View style={[styles.stampInner, { borderColor: `${color}80` }]}>
          <View style={styles.starsRow}>
            <Star color={color} />
            <Star color={color} />
            <Star color={color} />
          </View>
          <Text style={[styles.stampText, { color }]}>{text}</Text>
          <View style={styles.starsRow}>
            <Star color={color} />
            <Star color={color} />
            <Star color={color} />
          </View>
        </View>
      </View>
    </View>
  );
});
ReceiptStamp.displayName = 'ReceiptStamp';

// ============================================
// MAIN COMPONENT
// ============================================

function PaymentReceiptCardComponent({
  stampText,
  stampColor,
  stampImage,
  titleLine1,
  titleLine2,
  titleLine2Color = CARD_COLORS.titleAccent,
  children,
  showGridLines = true,
  showPaperclip = true,
  topMargin,
  titleMarginLeft,
  contentPaddingTop,
}: PaymentReceiptCardProps) {
  const insets = useSafeAreaInsets();
  const cardMarginTop = topMargin ?? Math.max(0, 183 - insets.top);

  return (
    <View style={[styles.receiptContainer, { marginTop: cardMarginTop }]}>
      {showGridLines && <BgLine style={styles.gridContainer} />}

      <View style={styles.cardShadowWrapper}>
        <View style={styles.cardBackground} />

        {showPaperclip && (
          <View style={styles.paperclipContainer}>
            <Paperclip />
          </View>
        )}

        <View style={[styles.receiptCardContent, contentPaddingTop != null && { paddingTop: contentPaddingTop }]}>
          <PerforatedEdge />

          {/* Side notches */}
          <View style={[styles.notch, styles.notchLeft]} />
          <View style={[styles.notch, styles.notchRight]} />

          {/* Stamp */}
          {((stampText && stampColor) || stampImage) && (
            <View style={styles.stampPosition}>
              <ReceiptStamp text={stampText || ''} color={stampColor || ''} image={stampImage} />
            </View>
          )}

          {/* Title */}
          <View style={[styles.titleSection, titleMarginLeft != null && { marginLeft: titleMarginLeft }]}>
            <Text style={styles.titleWhite}>
              {titleLine1}
              {'\n'}
              <Text style={[styles.titleAccent, { color: titleLine2Color }]}>
                {titleLine2}
              </Text>
            </Text>
          </View>

          {/* Custom content (receipt rows, info rows, etc.) */}
          {children}
        </View>
      </View>
    </View>
  );
}

export const PaymentReceiptCard = memo(PaymentReceiptCardComponent);

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: s(369),
    height: sv(235),
    zIndex: -1,
  },
  paperclipContainer: {
    position: 'absolute',
    top: sv(-5),
    left: s(8),
    zIndex: 10,
  },
  cardShadowWrapper: {
    width: s(270),
    minHeight: sv(481),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: sv(24) },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CARD_COLORS.cardBackground,
    borderRadius: 0,
  },
  receiptCardContent: {
    flex: 1,
    padding: s(24),
    paddingTop: sv(80),
    position: 'relative',
    overflow: 'visible',
  },
  perforatedEdge: {
    position: 'absolute',
    top: sv(-7),
    left: s(4),
    right: s(4),
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  punchHole: {
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: CARD_COLORS.background,
  },
  notch: {
    position: 'absolute',
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: CARD_COLORS.background,
    top: sv(256),
  },
  notchLeft: {
    left: s(-7),
  },
  notchRight: {
    right: s(-7),
  },
  stampPosition: {
    position: 'absolute',
    top: sv(25),
    right: s(12),
  },
  stampContainer: {
    transform: [{ rotate: '-15deg' }],
  },
  stampPng: {
    width: s(85),
    height: sv(80),
  },
  stampOuter: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampInner: {
    width: s(70),
    height: s(70),
    borderRadius: s(35),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: s(2),
  },
  starIcon: {
    width: s(8),
    height: s(8),
  },
  stampText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: sf(13.51),
    lineHeight: sf(16.35),
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: sv(2),
  },
  titleSection: {
    marginBottom: sv(24),
    marginLeft: s(-5),
  },
  titleWhite: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(20),
    lineHeight: sf(32),
    color: CARD_COLORS.titleWhite,
    textAlign: 'left',
  },
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(20),
    lineHeight: sf(32),
    textAlign: 'left',
  },
});
