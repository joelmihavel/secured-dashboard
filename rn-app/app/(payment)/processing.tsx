/**
 * Payment Processing Screen
 * Figma Reference: 41-9460 (Processing state)
 *
 * Pixel-perfect implementation per Figma blueprint extraction:
 * - Screen: 393x852, bg #131313
 * - Receipt card frame (Frame 2095586361): x:61, y:183, 270x481
 * - Card bg: #202020 (Rectangle 136)
 * - Perforated top: 14 ellipses, 14x14px each
 * - Side notches: 14x14px at vertical center
 * - PENDING stamp: rotated -15deg, color #C7C9D9, Inter ExtraBold 13.51px
 * - Title: single text node "Payment\nProcessing" - "Payment" #FFFFFF, "Processing" #FF9A6D (span start:8)
 *   fontSize 20, lineHeight 32, fontFamily PlusJakartaSans-Regular, textAlign left
 * - Info rows: container 269px wide, paddingHorizontal 32, gap 24
 *   Row: direction row, gap 16, alignItems center
 *   Icon container: 52.5x40 HUG
 *   Text: fontSize 12, lineHeight 20, color #A9A9A9, FILL width
 * - Button container (Frame 2095586363): x:40, y:704, width 313, gap 16
 * - PrimaryButton: "Contact Support" fontSize 14, fontWeight 500
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';
import LottieView from 'lottie-react-native';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { verifyPaymentStatus } from '@/src/services/payment';

// Exact Figma colors - from 41-9460 blueprint extraction
const FIGMA_COLORS = {
  background: '#131313',           // black.700
  cardBackground: '#202020',       // black.500 - Rectangle 136
  titleWhite: '#FFFFFF',           // white - "Payment"
  titleAccent: '#FF9A6D',          // brand.500 - "Processing" (span start:8, color #FF9A6D)
  stampColor: '#C7C9D9',           // Figma: PENDING stamp text color
  infoText: '#A9A9A9',             // neutral.500 - info row text
  iconColor: '#4D4D4D',            // black.400 - credit card icon
  paperclipColor: '#4D4D4D',       // black.400 - paperclip
};

const MAX_VERIFICATION_ATTEMPTS = 10;
const VERIFICATION_INTERVAL_MS = 2000;

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

// PENDING Stamp Component - Figma: Inter ExtraBold, color #C7C9D9
const PendingStamp = () => (
  <View style={styles.stampContainer}>
    <View style={styles.stampOuter}>
      <View style={styles.stampInner}>
        <View style={styles.starsRow}>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
        </View>
        <Text style={styles.stampText}>PENDING</Text>
        <View style={styles.starsRow}>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
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

export default function ProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string;
    amount?: string;
    method?: string;
  }>();
  const { paymentId, amount, method } = params;
  const lottieRef = useRef<LottieView>(null);

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId) {
      const DEMO_DELAY_MS = 5000;
      setTimeout(() => {
        router.replace({
          pathname: '/(payment)/success',
          params: {
            amount: amount ?? '32,175',
            method: method ?? 'UPI',
            transactionId: `SEC${Date.now().toString().slice(-8)}`,
            cashback: '350',
          },
        } as never);
      }, DEMO_DELAY_MS);
      return;
    }

    let attempts = 0;

    const pollStatus = async () => {
      attempts++;

      try {
        const { status, error } = await verifyPaymentStatus(paymentId);

        if (status === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: '/(payment)/success',
            params: {
              paymentId,
              amount: amount ?? '',
              method: method ?? '',
              transactionId: paymentId,
              cashback: '0',
            },
          } as never);
          return;
        } else if (status === 'failure') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          router.replace({
            pathname: '/(payment)/failed',
            params: {
              paymentId,
              amount: amount ?? '',
              method: method ?? '',
              error: error ?? 'Payment failed',
            },
          } as never);
          return;
        } else if (status === 'pending' && attempts < MAX_VERIFICATION_ATTEMPTS) {
          setTimeout(pollStatus, VERIFICATION_INTERVAL_MS);
        } else {
          router.replace({
            pathname: '/(payment)/failed',
            params: {
              paymentId,
              amount: amount ?? '',
              method: method ?? '',
              error: 'Payment verification timed out. Please check your transaction history.',
            },
          } as never);
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        if (attempts < MAX_VERIFICATION_ATTEMPTS) {
          setTimeout(pollStatus, VERIFICATION_INTERVAL_MS);
        } else {
          router.replace({
            pathname: '/(payment)/failed',
            params: {
              paymentId,
              amount: amount ?? '',
              method: method ?? '',
              error: 'Could not verify payment status. Please check your transaction history.',
            },
          } as never);
        }
      }
    };

    pollStatus();
  }, [paymentId, amount, method, router]);

  useEffect(() => {
    checkPaymentStatus();
  }, [checkPaymentStatus]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  return (
    <Screen testID="processing-screen" padded={false} style={styles.screen}>
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

            {/* Stamp */}
            <View style={styles.stampPosition}>
              <PendingStamp />
            </View>

            {/* Title - Figma 41:9485: "Payment\nProcessing", textAlign left */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>Payment</Text>
              <Text style={styles.titleAccent}>Processing</Text>
            </View>

            {/* Info Rows - Figma 41:9486: gap 24, paddingHorizontal 32 */}
            <View style={styles.infoSection}>
              <InfoRow text="We've received your payment request." />
              <InfoRow text="This can take a few minutes depending on your bank." />
              <InfoRow text="You'll see confirmation here once it's complete." />
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
    borderColor: FIGMA_COLORS.stampColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: `${FIGMA_COLORS.stampColor}80`,
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
    color: FIGMA_COLORS.stampColor,
    textAlign: 'center',
  },
  stampText: {
    fontFamily: 'Inter-ExtraBold',     // Figma: fontPostScriptName Inter-ExtraBold
    fontSize: 13.51,                   // Figma: fontSize 13.51
    lineHeight: 16.35,                 // Figma: lineHeightPx 16.35
    color: FIGMA_COLORS.stampColor,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: 2,
  },
  // Title - Figma 41:9485: textAlign left, x:34 inside card
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
  // Info section - Figma 41:9486: column, gap 24, width 269
  infoSection: {
    gap: 24,
  },
  // Info row - Figma 41:9487: row, gap 16, paddingHorizontal 32, alignItems center
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 8,              // Figma: 32px padding inside 269px, card has 24px padding already
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
});
