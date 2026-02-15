/**
 * Payment Processing Screen
 * Figma Reference: 41-9460 (Processing state)
 *
 * Pixel-perfect implementation:
 * - Receipt-style card with notch cutouts and top perforations (14 holes, 14x14px)
 * - Card width: fixed 270px
 * - PENDING stamp badge (rotated -15deg), color #A9A9A9
 * - Title "Payment" - fontSize 20, lineHeight 32, color #FFFFFF
 * - "Processing" - fontSize 20, lineHeight 32, color #FFFFFF (titleAccent)
 * - Info rows with credit card icons
 * - "Contact Support" button: fixed 313px container, centered
 * - Horizontal padding: 40px
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';
import LottieView from 'lottie-react-native';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { verifyPaymentStatus } from '@/src/services/payment';
import { colors, spacing } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_SCREEN_WIDTH = 393;
const FIGMA_CARD_WIDTH = 270;
const FIGMA_BUTTON_WIDTH = 313;
const SCALE = SCREEN_WIDTH / FIGMA_SCREEN_WIDTH;
const CARD_WIDTH = Math.round(FIGMA_CARD_WIDTH * SCALE);
const BUTTON_WIDTH = Math.round(FIGMA_BUTTON_WIDTH * SCALE);

// Exact Figma colors - from 41-9460 analysis
const FIGMA_COLORS = {
  background: '#131313',           // black.700
  cardBackground: '#202020',       // black.500 - Rectangle 136
  titleWhite: '#FFFFFF',           // white - Payment Processing
  titleAccent: '#FF9A6D',           // Figma 41-9460 node 41:9485: #ff9a6d (brand.500 orange)
  stampColor: '#A9A9A9',           // Figma: pending stamp color (matches PaymentStamp component)
  infoText: '#A9A9A9',             // neutral.500 - We've received your payment
  iconColor: '#4D4D4D',            // black.400 - Vector icons
  paperclipColor: '#4D4D4D',       // black.400 - Vector
  shimmerColor: '#C7C9D9',         // Shimmer animation color
};

const MAX_VERIFICATION_ATTEMPTS = 10;
const VERIFICATION_INTERVAL_MS = 2000;

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.titleWhite}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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
const PERFORATION_COUNT = 14;
const PERFORATION_SIZE = 14; // 14x14px circles
const PERFORATION_RADIUS = 7; // radius 7

const PerforationEdge = () => {
  const holes = Array.from({ length: PERFORATION_COUNT }, (_, i) => i);
  return (
    <View style={styles.perforationContainer}>
      {holes.map((i) => (
        <View key={i} style={styles.perforationHole} />
      ))}
    </View>
  );
};

// PENDING Stamp Component
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

const InfoRow = ({ text }: InfoRowProps) => (
  <View style={styles.infoRow}>
    <CreditCardIcon />
    <Text style={styles.infoText}>{text}</Text>
  </View>
);

export default function ProcessingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    paymentId?: string;
    amount?: string;
    method?: string;
  }>();
  const { paymentId, amount, method } = params;
  const lottieRef = useRef<LottieView>(null);

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentId) {
      // Demo mode - simulate processing for 5 seconds then go to success
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
          // Max attempts reached - treat as timeout
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

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  return (
    <Screen testID="processing-screen" padded={false} style={styles.screen}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrow />
        </TouchableOpacity>

        {/* Receipt Card */}
        <View style={styles.receiptContainer}>
          {/* Paperclip decoration */}
          <View style={styles.paperclipContainer}>
            <Paperclip />
          </View>

          {/* Card with notches and perforations */}
          <View style={styles.receiptCard}>
            {/* Top perforations - 14 circular holes */}
            <PerforationEdge />

            {/* Left notch */}
            <View style={[styles.notch, styles.notchLeft]} />
            {/* Right notch */}
            <View style={[styles.notch, styles.notchRight]} />

            {/* Stamp */}
            <View style={styles.stampPosition}>
              <PendingStamp />
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>Payment</Text>
              <Text style={styles.titleAccent}>Processing</Text>
            </View>

            {/* Info Rows */}
            <View style={styles.infoSection}>
              <InfoRow text="We've received your payment request." />
              <InfoRow text="This can take a few minutes depending on your bank." />
              <InfoRow text="You'll see confirmation here once it's complete." />
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Contact Support Button - fixed 313px width, centered */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.buttonInner}>
            <PrimaryButton
              title="Contact Support"
              onPress={handleContactSupport}
              testID="contact-support-button"
            />
          </View>
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
    paddingHorizontal: 40, // Figma 41-9460: 40px horizontal padding
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  paperclipContainer: {
    position: 'absolute',
    top: -20,
    left: 24,
    zIndex: 10,
  },
  receiptCard: {
    width: CARD_WIDTH,
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    paddingTop: 80,
    position: 'relative',
    overflow: 'visible',
  },
  perforationContainer: {
    position: 'absolute',
    top: -PERFORATION_RADIUS, // Half above, half below the card edge
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    zIndex: 5,
  },
  perforationHole: {
    width: PERFORATION_SIZE,
    height: PERFORATION_SIZE,
    borderRadius: PERFORATION_RADIUS,
    backgroundColor: FIGMA_COLORS.background, // Punched through to background
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
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 8,
    color: FIGMA_COLORS.stampColor,
  },
  stampText: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 10,
    color: FIGMA_COLORS.stampColor,
    letterSpacing: 0.5,
    marginVertical: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  titleSection: {
    marginBottom: 32,
  },
  titleWhite: {
    fontFamily: 'PlusJakartaSans-Regular',  // bodyLg per Figma - weight 400
    fontSize: 20,
    lineHeight: 32,    // bodyLg lineHeight
    color: FIGMA_COLORS.titleWhite,
  },
  titleAccent: {
    fontFamily: 'PlusJakartaSans-Regular',  // bodyLg per Figma - weight 400
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.titleAccent,
  },
  infoSection: {
    gap: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma analysis
    lineHeight: 20,
    color: FIGMA_COLORS.infoText,  // neutral.500 #A9A9A9
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    paddingTop: 24,
    alignItems: 'center',
  },
  buttonInner: {
    width: BUTTON_WIDTH, // Figma 41-9460: scaled from 313px
  },
});
