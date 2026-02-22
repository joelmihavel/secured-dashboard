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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';
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
const VERIFICATION_TIMEOUT_MS = 120000; // 120 seconds
const MAX_VERIFICATION_ATTEMPTS = Math.ceil(VERIFICATION_TIMEOUT_MS / VERIFICATION_INTERVAL_MS);

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

      if (attemptsRef.current < MAX_VERIFICATION_ATTEMPTS) {
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
      if (attemptsRef.current < MAX_VERIFICATION_ATTEMPTS) {
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
      const DEMO_DELAY_MS = 5000;
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

  // Info rows based on screen state
  const getInfoRows = () => {
    switch (screenState) {
      case 'verifying':
        return [
          "Confirming your payment with the bank...",
          "This usually takes a few seconds.",
          "Please don't close the app.",
        ];
      case 'processing':
        return [
          "We've received your payment request.",
          "This can take a few minutes depending on your bank.",
          "You'll see confirmation here once it's complete.",
        ];
      case 'timed_out':
        return [
          "Your payment is still being processed by your bank.",
          "This is taking longer than expected. Please check back later.",
          "You'll receive a notification once the payment is confirmed.",
        ];
    }
  };

  return (
    <Screen testID="processing-screen" padded={false} style={styles.screen}>
      <OfflineBanner message="No internet connection. Polling paused." />
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

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>{titleText.top}</Text>
              <Text style={styles.titleAccent}>{titleText.bottom}</Text>
            </View>

            {/* Info Rows */}
            <View style={styles.infoSection}>
              {getInfoRows().map((text, i) => (
                <InfoRow key={i} text={text} />
              ))}
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
