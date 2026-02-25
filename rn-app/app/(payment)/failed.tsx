/**
 * Payment Failed Screen
 * Figma Reference: 41-9511 (Payment Failed), 41-9635 (Payment Refunded)
 *
 * Pixel-perfect implementation per Figma blueprint extraction:
 * - Screen: 393x852, bg #131313
 * - Receipt card frame (Frame 2095586361): x:61, y:183, 270x481
 * - Card bg: #202020 (Rectangle 136)
 * - Perforated top: 14 ellipses, 14x14px each
 * - Side notches: 14x14px at vertical center
 *
 * FAILED state (41-9511):
 * - FAILED stamp: rotated -15deg, color #FF8080, Inter ExtraBold 13.51px
 * - Title: "Payment\nFailed" - "Payment" #FFFFFF, "Failed" #FF9A6D (span start:8)
 * - Info rows (3):
 *   1. "Something didn't go through this time."
 *   2. "Your money is safe and hasn't been deducted."
 *   3. "If money was debited, it will automatically be refunded within 3-5 business days"
 * - Button: "Contact Support" + "Try Again" link
 *
 * REFUNDED state (41-9635):
 * - REFUNDED stamp: rotated -15deg, color #C7C9D9, Inter ExtraBold 13.51px
 * - Title: "Payment\nRefunded" - "Payment" #FFFFFF, "Refunded" #FF9A6D (span start:8)
 * - Info rows (2):
 *   1. "Your payment was not completed and the amount has been returned to your account."
 *   2. "Refunds usually reflect within 3-5 business days."
 * - Button: "Contact Support" + "Try Again" link
 *
 * Common:
 * - Info rows: container gap 24, paddingHorizontal 32 inside card
 * - Info text: fontSize 12, lineHeight 20, color #A9A9A9
 * - Button container (Frame 2095586363): x:40, y:704, width 313, gap 16
 * - "Try Again": fontSize 12, lineHeight 20, color #A9A9A9, textAlign center
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect, Line } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { colors } from '@/src/theme';

// Exact Figma colors - from 41-9511 / 41-9635 blueprint extraction
const FIGMA_COLORS = {
  background: colors.black[700],           // black.700
  cardBackground: colors.black[500],       // black.500 - Rectangle 136
  titleWhite: colors.white,           // white - "Payment"
  titleAccent: colors.brand[500],          // brand.500 - "Failed"/"Refunded" (span start:8)
  failedStampColor: colors.error.default,     // Figma 41-9511: FAILED stamp color
  refundedStampColor: '#C7C9D9',   // Figma 41-9635: REFUNDED stamp color
  infoText: colors.neutral[500],             // neutral.500 - info row text
  iconColor: colors.black[400],            // black.400 - credit card icon
  paperclipColor: colors.black[400],       // black.400 - paperclip
  tryAgainText: colors.neutral[500],         // neutral.500 - "Try Again" text
};

// Paperclip decoration
const Paperclip = () => (
  <Svg width={24} height={48} viewBox="0 0 24 48" fill="none">
    <Path
      d="M12 4V44M12 4C12 4 20 4 20 12V36C20 44 12 44 12 44M12 4C12 4 4 4 4 12V28"
      stroke={FIGMA_COLORS.paperclipColor}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

// Timeline Icon from Figma
const TimelineIcon = () => (
  <View style={{ width: 52.5, height: 40, position: 'relative' }}>
    <Image 
      source={require('@/assets/images/processing-icon.png')} 
      style={{ position: 'absolute', left: 6.72, top: 0.46, width: 39, height: 39 }} 
    />
    <Svg width="6.72" height="40" viewBox="0 0 6.72 40" style={{ position: 'absolute', right: 0, transform: [{ rotate: '180deg' }] }}>
      <Path
        d="M0 0L0 -0.305344L-0.305344 -0.305344L-0.305344 0L0 0ZM0 40L-0.305344 40L-0.305344 40.3053L0 40.3053L0 40ZM6.71756 0L6.71756 -0.305344L0 -0.305344L0 0L0 0.305344L6.71756 0.305344L6.71756 0ZM0 0L-0.305344 0L-0.305344 40L0 40L0.305344 40L0.305344 0L0 0ZM0 40L0 40.3053L6.71756 40.3053L6.71756 40L6.71756 39.6947L0 39.6947L0 40Z"
        fill={colors.neutral[800]}
        fillRule="nonzero"
      />
    </Svg>
  </View>
);

// Perforation Edge - 14 circular holes at top of receipt card
const PerforationEdge = () => {
  const holes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View style={styles.perforationContainer}>
      {holes.map((i) => (
        <View key={i} style={styles.perforationHole} />
      ))}
    </View>
  );
};

// Star decoration for stamps
const Star = ({ color }: { color: string }) => (
  <View style={styles.starIcon}>
    <Svg width={8} height={8} viewBox="0 0 8 8" fill="none">
      <Path
        d="M4 0L5.236 2.404L7.804 2.764L5.902 4.636L6.382 7.236L4 6.13L1.618 7.236L2.098 4.636L0.196 2.764L2.764 2.404L4 0Z"
        fill={color}
      />
    </Svg>
  </View>
);

// Grid lines behind the card (Figma Vector 45)
const GridLines = () => (
  <View style={styles.gridContainer} pointerEvents="none">
    <Svg width={369} height={235} viewBox="0 0 369 235" fill="none">
      <Line x1={36.8} y1={0} x2={36.8} y2={235} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
      <Line x1={0} y1={36.8} x2={369} y2={36.8} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
      <Line x1={339.5} y1={0} x2={339.5} y2={235} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
      <Line x1={0} y1={197.8} x2={369} y2={197.8} stroke={FIGMA_COLORS.dividerColor} strokeWidth={0.3} />
    </Svg>
  </View>
);

// Stamp Component - reusable for FAILED and REFUNDED
interface StampProps {
  text: string;
  color: string;
}

const PaymentStamp = ({ text, color }: StampProps) => (
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

interface InfoRowProps {
  text: string;
}

// Info row - Figma: row direction, gap 16, paddingHorizontal 32
const InfoRow = ({ text }: InfoRowProps) => (
  <View style={styles.infoRow}>
    <TimelineIcon />
    <Text style={styles.infoText}>{text}</Text>
  </View>
);

// Failed state info rows per Figma 41-9511
const FAILED_INFO_ROWS = [
  "Something didn’t go through this time.",
  "Your money is safe and hasn’t been deducted.",
  "If money was debited, it will automatically be refunded within 3-5 business days",
];

// Refunded state info rows per Figma 41-9635
const REFUNDED_INFO_ROWS = [
  "Your payment was not completed and the amount has been returned to your account.",
  "Refunds usually reflect within 3–5 business days.",
];

export default function FailedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string;
    amount?: string;
    method?: string;
    error?: string;
    state?: string;
  }>();

  // Determine if this is a refunded state
  const isRefunded = params.state === 'refunded';
  const stampText = isRefunded ? 'refunded' : 'failed';
  const stampColor = isRefunded ? FIGMA_COLORS.refundedStampColor : FIGMA_COLORS.failedStampColor;
  const titleAccentText = isRefunded ? 'Refunded' : 'Failed';
  const infoRows = isRefunded ? REFUNDED_INFO_ROWS : FAILED_INFO_ROWS;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  const handleTryAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(payment)/select-method' as never);
  }, [router]);

  const insets = useSafeAreaInsets();
  const cardMarginTop = Math.max(0, 183 - insets.top);

  return (
    <Screen testID="failed-screen" padded={false} style={styles.screen}>
      <View style={styles.container}>
        {/* Receipt Card */}
        <View style={[styles.receiptContainer, { marginTop: cardMarginTop }]}>
          {/* Background grid lines */}
          <GridLines />

          {/* Card with notches and perforations */}
          <View style={styles.cardShadowWrapper}>
            <View style={styles.cardBackground} />
            
            {/* Paperclip decoration */}
            <View style={styles.paperclipContainer}>
              <Paperclip />
            </View>

            <View style={styles.receiptCardContent}>
              <PerforationEdge />

            {/* Left notch */}
            <View style={[styles.notch, styles.notchLeft]} />
            {/* Right notch */}
            <View style={[styles.notch, styles.notchRight]} />

            {/* Stamp - FAILED or REFUNDED */}
            <View style={styles.stampPosition}>
              <PaymentStamp text={stampText} color={stampColor} />
            </View>

            {/* Title - Figma: "Payment\n{Failed|Refunded}", textAlign left */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>
                Payment
                {'\n'}
                <Text style={styles.titleAccent}>{titleAccentText}</Text>
              </Text>
            </View>

            {/* Info Rows - Figma: gap 24, paddingHorizontal 32 */}
            <View style={styles.infoSection}>
              {infoRows.map((text, index) => (
                <InfoRow key={index} text={text} />
              ))}
            </View>
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button Container - Figma Frame 2095586363: x:40, y:704, width:313, gap:16 */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Contact Support"
            onPress={handleContactSupport}
            testID="contact-support-button"
          />

          <TouchableOpacity
            onPress={handleTryAgain}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA_COLORS.background,
  },
  container: {
    flex: 1,
    // Figma: button container at x:40, card at x:61
    paddingHorizontal: 40,
  },
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
    // margin top is handled via inline style from useSafeAreaInsets
  },
  // Background grid
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: -49, // 49px to the left of the 270px card
    width: 369,
    height: 235,
    zIndex: -1,
  },
  paperclipContainer: {
    position: 'absolute',
    top: -5,
    left: 8,
    zIndex: 10,
  },
  cardShadowWrapper: {
    width: 270,
    minHeight: 481,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderRadius: 0,
  },
  receiptCardContent: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
    position: 'relative',
    overflow: 'visible',
  },
  perforationContainer: {
    position: 'absolute',
    top: -7,                           // Half above card edge
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  perforationHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background,
  },
  notch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background,
    top: 256,
  },
  notchLeft: {
    left: -7,
  },
  notchRight: {
    right: -7,
  },
  stampPosition: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  stampContainer: {
    transform: [{ rotate: '-15deg' }],
  },
  stampOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  starIcon: {
    width: 8,
    height: 8,
  },
  stampText: {
    fontFamily: 'PlusJakartaSans-Bold',     // Figma: fontPostScriptName PlusJakartaSans-Bold
    fontSize: 13.51,                   // Figma: fontSize 13.51
    lineHeight: 16.35,                 // Figma: lineHeightPx 16.35
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: 2,
  },
  // Title - Figma: textAlign left
  titleSection: {
    marginBottom: 32,
    marginLeft: 10,
  },
  titleWhite: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.titleWhite,
    textAlign: 'left',
  },
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.titleAccent,
    textAlign: 'left',
  },
  // Info section - Figma: column, gap 24
  infoSection: {
    gap: 24,
  },
  // Info row - Figma: row, gap 16, paddingHorizontal 32, alignItems center
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,              // Card has 24px padding, Figma row has 32px = 8px additional
  },
  infoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.infoText,      // #A9A9A9
    textAlign: 'left',
  },
  spacer: {
    flex: 1,
  },
  // Button container - Figma Frame 2095586363: x:40, y:704, width:313, gap:16
  buttonContainer: {
    width: 313,
    alignSelf: 'center',
    gap: 16,
    alignItems: 'center',
    paddingBottom: 24,
    marginTop: 40,
  },
  // Try Again - Figma 41:9558/41:9676: fontSize 12, lineHeight 20, color #A9A9A9, textAlign center
  tryAgainText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.tryAgainText,  // #A9A9A9
    textAlign: 'center',
  },
});
