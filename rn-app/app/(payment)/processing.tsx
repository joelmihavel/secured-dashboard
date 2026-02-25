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
 *
 * Network resilience:
 * - AppState listener: re-polls on foreground return
 * - Network awareness: pauses polling when offline, resumes on reconnect
 * - Verifying state: shows between PayU return and first successful poll
 * - Calls check-payment-status edge function for PayU verification
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  AppState,
  AppStateStatus,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import LottieView from 'lottie-react-native';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { OfflineBanner } from '@/src/components/ui/Layout/OfflineBanner';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { checkPaymentStatus } from '@/src/services/api/payments';
import { usePaymentStore } from '@/src/stores';
import { colors } from '@/src/theme';

// Exact Figma colors - from 41-9460 blueprint extraction
const FIGMA_COLORS = {
  background: colors.black[700],           // black.700
  cardBackground: colors.black[500],       // black.500 - Rectangle 136
  titleWhite: colors.white,           // white - "Payment"
  titleAccent: colors.brand[500],          // brand.500 - "Processing" (span start:8, color #FF9A6D)
  stampColor: '#C7C9D9',           // Figma: PENDING stamp text color
  infoText: colors.neutral[500],             // neutral.500 - info row text
  iconColor: colors.black[400],            // black.400 - credit card icon
  paperclipColor: colors.black[400],       // black.400 - paperclip
  verifyingText: colors.neutral[300],        // neutral.300 - "Verifying Payment..."
};

const VERIFICATION_INTERVAL_MS = 3000;
const VERIFICATION_TIMEOUT_MS_DEFAULT = 120000; // 120 seconds
const VERIFICATION_TIMEOUT_MS_UPI = 360000;     // 360 seconds (6 min) for UPI collect

type ScreenState = 'verifying' | 'processing' | 'timed_out';

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

// Timeline Icon from Figma Frame 2095586326
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

// PENDING Stamp Component - Figma: Inter ExtraBold, color #C7C9D9
const PendingStamp = () => (
  <View style={styles.stampContainer}>
    <View style={styles.stampOuter}>
      <View style={styles.stampInner}>
        <View style={styles.starsRow}>
          <Star color={FIGMA_COLORS.stampColor} />
          <Star color={FIGMA_COLORS.stampColor} />
          <Star color={FIGMA_COLORS.stampColor} />
        </View>
        <Text style={styles.stampText}>pending</Text>
        <View style={styles.starsRow}>
          <Star color={FIGMA_COLORS.stampColor} />
          <Star color={FIGMA_COLORS.stampColor} />
          <Star color={FIGMA_COLORS.stampColor} />
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

export default function ProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string;
    amount?: string;
    method?: string;
  }>();
  const { paymentId, amount, method } = params;
  const isUpi = method === 'upi';
  const verificationTimeoutMs = isUpi ? VERIFICATION_TIMEOUT_MS_UPI : VERIFICATION_TIMEOUT_MS_DEFAULT;
  const maxVerificationAttempts = Math.ceil(verificationTimeoutMs / VERIFICATION_INTERVAL_MS);
  const lottieRef = useRef<LottieView>(null);
  const [screenState, setScreenState] = useState<ScreenState>('verifying');
  const attemptsRef = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const { clearLastPayment } = usePaymentStore();

  // Network awareness
  const { isConnected } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  const navigateToSuccess = useCallback((pid: string) => {
    clearLastPayment();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: '/(payment)/success',
      params: {
        paymentId: pid,
        amount: amount ?? '',
        method: method ?? '',
        transactionId: pid,
        cashback: '0',
      },
    } as never);
  }, [amount, method, router, clearLastPayment]);

  const navigateToFailed = useCallback((pid: string, error?: string) => {
    clearLastPayment();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    router.replace({
      pathname: '/(payment)/failed',
      params: {
        paymentId: pid,
        amount: amount ?? '',
        method: method ?? '',
        error: error ?? 'Payment failed',
      },
    } as never);
  }, [amount, method, router, clearLastPayment]);

  const pollStatus = useCallback(async () => {
    if (!paymentId || isPollingRef.current) return;

    // Pause polling when offline
    if (!isConnectedRef.current) {
      pollTimeoutRef.current = setTimeout(pollStatus, VERIFICATION_INTERVAL_MS);
      return;
    }

    isPollingRef.current = true;
    attemptsRef.current++;

    try {
      // Use check-payment-status edge function which also verifies with PayU
      const { data, error } = await checkPaymentStatus(paymentId);

      if (data) {
        // Transition from verifying to processing after first successful poll
        if (screenState === 'verifying') {
          setScreenState('processing');
        }

        if (data.status === 'success') {
          navigateToSuccess(paymentId);
          isPollingRef.current = false;
          return;
        } else if (data.status === 'failed' || data.status === 'refunded') {
          navigateToFailed(paymentId, data.error_message ?? undefined);
          isPollingRef.current = false;
          return;
        }
      }

      if (error && screenState === 'verifying') {
        // Even on error, move to processing state so user isn't stuck on "Verifying"
        setScreenState('processing');
      }

      if (attemptsRef.current < maxVerificationAttempts) {
        pollTimeoutRef.current = setTimeout(() => {
          isPollingRef.current = false;
          pollStatus();
        }, VERIFICATION_INTERVAL_MS);
      } else {
        setScreenState('timed_out');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      if (screenState === 'verifying') {
        setScreenState('processing');
      }
      if (attemptsRef.current < maxVerificationAttempts) {
        pollTimeoutRef.current = setTimeout(() => {
          isPollingRef.current = false;
          pollStatus();
        }, VERIFICATION_INTERVAL_MS);
      } else {
        setScreenState('timed_out');
      }
    }

    isPollingRef.current = false;
  }, [paymentId, screenState, navigateToSuccess, navigateToFailed]);

  // Start polling on mount
  useEffect(() => {
    if (!paymentId) {
      // Demo mode — auto-navigate after delay
      const DEMO_DELAY_MS = 50000; // Increased for UI parity testing
      const timer = setTimeout(() => {
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
      return () => clearTimeout(timer);
    }

    pollStatus();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [paymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // AppState listener: re-poll when app returns to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && paymentId && screenState !== 'timed_out') {
        // Force an immediate re-poll when coming back to foreground
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
        isPollingRef.current = false;
        pollStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [paymentId, screenState, pollStatus]);

  // Resume polling when connectivity is restored
  useEffect(() => {
    if (isConnected && paymentId && screenState !== 'timed_out' && !isPollingRef.current) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      pollStatus();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  const handleGoToTransactions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  // Title text based on screen state
  const getTitleText = () => {
    switch (screenState) {
      case 'verifying':
        return { top: 'Verifying', bottom: 'Payment...' };
      case 'processing':
        return { top: 'Payment', bottom: 'Processing' };
      case 'timed_out':
        return { top: 'Payment', bottom: 'Processing' };
    }
  };

  const titleText = getTitleText();

  // Info rows based on screen state + payment method
  const getInfoRows = (): string[] => {
    if (isUpi && screenState === 'verifying') {
      return [
        'Open your UPI app to approve the payment.',
        'You have 6 minutes to complete the approval.',
        'Please don\'t close the app.',
      ];
    }
    if (isUpi && screenState === 'processing') {
      return [
        'Waiting for approval on your UPI app.',
        'This can take a few minutes. Please check your UPI app.',
        'You\'ll see confirmation here once approved.',
      ];
    }
    if (isUpi && screenState === 'timed_out') {
      return [
        'UPI payment request has expired.',
        'The approval window has closed. Please try again.',
        'You can retry with the same or a different payment method.',
      ];
    }
    if (screenState === 'verifying') {
      return [
        'Confirming your payment with the bank...',
        'This usually takes a few seconds.',
        'Please don\'t close the app.',
      ];
    }
    if (screenState === 'processing') {
      return [
        'We\'ve received your payment request.',
        'This can take a few minutes depending on your bank.',
        'You\'ll see confirmation here once it\'s complete.',
      ];
    }
    // timed_out
    return [
      'Your payment is still being processed by your bank.',
      'This is taking longer than expected. Please check back later.',
      'You\'ll receive a notification once the payment is confirmed.',
    ];
  };

  const insets = useSafeAreaInsets();
  const cardMarginTop = Math.max(0, 183 - insets.top);

  return (
    <Screen testID="processing-screen" padded={false} style={styles.screen}>
      <OfflineBanner message="No internet connection. Polling paused." />
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

            {/* Stamp */}
            <View style={styles.stampPosition}>
              <PendingStamp />
            </View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>
                {titleText.top}
                {'\n'}
                <Text style={styles.titleAccent}>{titleText.bottom}</Text>
              </Text>
            </View>

            {/* Info Rows */}
            <View style={styles.infoSection}>
              {getInfoRows().map((text, i) => (
                <InfoRow key={i} text={text} />
              ))}
            </View>
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button Container - Figma Frame 2095586363: x:40, y:704, width:313, gap:16 */}
        <View style={styles.buttonContainer}>
          {screenState === 'timed_out' ? (
            <>
              <PrimaryButton
                title="Check Back Later"
                onPress={handleGoToTransactions}
                testID="check-back-later-button"
              />
              <PrimaryButton
                title="Contact Support"
                onPress={handleContactSupport}
                testID="contact-support-button"
              />
            </>
          ) : (
            <PrimaryButton
              title="Contact Support"
              onPress={handleContactSupport}
              testID="contact-support-button"
            />
          )}
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
  starIcon: {
    width: 8,
    height: 8,
  },
  stampText: {
    fontFamily: 'PlusJakartaSans-Bold',     // Figma: fontPostScriptName PlusJakartaSans-Bold
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
    marginLeft: 10, // Matching offset
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
    marginLeft: 10,
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
    marginTop: 40,
  },
});
