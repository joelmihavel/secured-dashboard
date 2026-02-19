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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';

// Exact Figma colors - from 41-9511 / 41-9635 blueprint extraction
const FIGMA_COLORS = {
  background: '#131313',           // black.700
  cardBackground: '#202020',       // black.500 - Rectangle 136
  titleWhite: '#FFFFFF',           // white - "Payment"
  titleAccent: '#FF9A6D',          // brand.500 - "Failed"/"Refunded" (span start:8)
  failedStampColor: '#FF8080',     // Figma 41-9511: FAILED stamp color
  refundedStampColor: '#C7C9D9',   // Figma 41-9635: REFUNDED stamp color
  infoText: '#A9A9A9',             // neutral.500 - info row text
  iconColor: '#4D4D4D',            // black.400 - credit card icon
  paperclipColor: '#4D4D4D',       // black.400 - paperclip
  tryAgainText: '#A9A9A9',         // neutral.500 - "Try Again" text
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

// Credit card icon for info rows
const CreditCardIcon = () => (
  <Svg width={32} height={24} viewBox="0 0 32 24" fill="none">
    <Rect x="1" y="1" width="30" height="22" rx="4" stroke={FIGMA_COLORS.iconColor} strokeWidth="1.5" fill="none" />
    <Path d="M1 8H31" stroke={FIGMA_COLORS.iconColor} strokeWidth="1.5" />
    <Rect x="4" y="14" width="8" height="4" rx="1" fill={FIGMA_COLORS.iconColor} />
  </Svg>
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
          <Text style={[styles.star, { color }]}>*</Text>
          <Text style={[styles.star, { color }]}>*</Text>
          <Text style={[styles.star, { color }]}>*</Text>
        </View>
        <Text style={[styles.stampText, { color }]}>{text}</Text>
        <View style={styles.starsRow}>
          <Text style={[styles.star, { color }]}>*</Text>
          <Text style={[styles.star, { color }]}>*</Text>
          <Text style={[styles.star, { color }]}>*</Text>
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
    <CreditCardIcon />
    <Text style={styles.infoText}>{text}</Text>
  </View>
);

// Failed state info rows per Figma 41-9511
const FAILED_INFO_ROWS = [
  "Something didn't go through this time.",
  "Your money is safe and hasn't been deducted.",
  "If money was debited, it will automatically be refunded within 3-5 business days",
];

// Refunded state info rows per Figma 41-9635
const REFUNDED_INFO_ROWS = [
  "Your payment was not completed and the amount has been returned to your account.",
  "Refunds usually reflect within 3\u20135 business days.",
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
  const stampText = isRefunded ? 'REFUNDED' : 'FAILED';
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

  return (
    <Screen testID="failed-screen" padded={false} style={styles.screen}>
      <View style={styles.container}>
        {/* Receipt Card */}
        <View style={styles.receiptContainer}>
          {/* Paperclip decoration */}
          <View style={styles.paperclipContainer}>
            <Paperclip />
          </View>

          {/* Card with notches and perforations */}
          <View style={styles.receiptCard}>
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
              <Text style={styles.titleWhite}>Payment</Text>
              <Text style={styles.titleAccent}>{titleAccentText}</Text>
            </View>

            {/* Info Rows - Figma: gap 24, paddingHorizontal 32 */}
            <View style={styles.infoSection}>
              {infoRows.map((text, index) => (
                <InfoRow key={index} text={text} />
              ))}
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
    marginTop: 12,
  },
  paperclipContainer: {
    position: 'absolute',
    top: -20,
    left: -16,
    zIndex: 10,
  },
  receiptCard: {
    width: 270,                        // Figma: Frame 2095586361 width: 270
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderRadius: 16,
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
    top: '50%',
    marginTop: -7,
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
  star: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 8,
    textAlign: 'center',
  },
  stampText: {
    fontFamily: 'Inter-ExtraBold',     // Figma: fontPostScriptName Inter-ExtraBold
    fontSize: 13.51,                   // Figma: fontSize 13.51
    lineHeight: 16.35,                 // Figma: lineHeightPx 16.35
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: 2,
  },
  // Title - Figma: textAlign left
  titleSection: {
    marginBottom: 32,
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
