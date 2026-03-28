/**
 * Payment Status Screen — Pending / Failed / Refunded
 *
 * Handles non-success payment states with ticket card UI (card icons + info text).
 * On successful payment resolution, navigates to success.tsx for receipt display.
 *
 * Figma References:
 * - 4109-67843 (Processing)
 * - 4109-67894 (Failed)
 * - 4109-67946 (Refunded)
 *
 * State machine: useReducer drives StatusState transitions.
 * Polling: 5s interval, 300s/360s timeout, network-aware.
 * Back guard: Intercepts hardware back when pending; navigates home otherwise.
 * Cache: Invalidates paymentHistory and dashboard queries on resolution.
 */

import React, { useEffect, useCallback, useRef, useReducer, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  AppState,
  AppStateStatus,
  Image,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen, Text, PrimaryButton, BackButton } from '@/src/components';
import { PaymentReceiptCard } from '@/src/components/payment/PaymentReceiptCard';
import { OfflineBanner } from '@/src/components/ui/Layout/OfflineBanner';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { useRealtimeQuery } from '@/src/hooks/useRealtimeQuery';
import { checkPaymentStatus } from '@/src/services/api/payments';
import { usePaymentStore } from '@/src/stores';
import { PAYMENT_COLORS } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// ============================================
// TYPES
// ============================================

interface StatusParams {
  paymentId?: string;
  amount?: string;
  method?: 'upi' | 'card' | 'netbanking';
  cashback?: string;
  transactionId?: string;
  initialStatus?: 'pending' | 'success' | 'failed' | 'refunded';
  error?: string;
  source?: 'post_payment' | 'receipt_view';
  landlordName?: string;
  agreementId?: string;
}

type StatusState = 'pending' | 'failed' | 'refunded' | 'timed_out';
type PendingSubState = 'verifying' | 'processing' | 'timed_out';

type StatusAction =
  | { type: 'SET_STATUS'; status: StatusState }
  | { type: 'SET_PENDING_SUB'; sub: PendingSubState }
  | { type: 'RESOLVE'; status: 'failed' | 'refunded' };

interface ReducerState {
  status: StatusState;
  pendingSub: PendingSubState;
}

function statusReducer(state: ReducerState, action: StatusAction): ReducerState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_PENDING_SUB':
      return { ...state, pendingSub: action.sub };
    case 'RESOLVE':
      return { ...state, status: action.status };
    default:
      return state;
  }
}

// ============================================
// CONSTANTS
// ============================================

const VERIFICATION_INTERVAL_MS = 5000; // Relaxed from 3s — realtime handles the fast path
const VERIFICATION_TIMEOUT_MS_DEFAULT = 300000; // 5 min for card/netbanking
const VERIFICATION_TIMEOUT_MS_UPI = 360000;     // 6 min for UPI S2S collect (NPCI mandates 5 min approval window)
const VALID_INITIAL_STATUSES = new Set(['pending', 'failed', 'refunded']);

// ============================================
// FIGMA TOKENS — aliased from shared PAYMENT_COLORS
// ============================================

const FIGMA_COLORS = {
  background: PAYMENT_COLORS.background,
  titleAccent: PAYMENT_COLORS.accent,
  failedStamp: PAYMENT_COLORS.failedStamp,
  refundedStamp: PAYMENT_COLORS.refundedStamp,
  pendingStamp: PAYMENT_COLORS.pendingStamp,
  infoText: PAYMENT_COLORS.mutedText,
  iconColor: PAYMENT_COLORS.labelText,
  tryAgainText: PAYMENT_COLORS.mutedText,
} as const;

// ============================================
// INFO ROW DATA — Figma 768:303835 / 768:303928 / 768:304020
// ============================================
// All three states use the SAME card icon (rectangle-55 with bracket vectors).
// Only text content and row count/alignment differ per state.
// Row alignment from Figma: items-center for short text, items-start for long wrapping text.

interface InfoRowData {
  text: string;
  /** Figma: items-center (true) or items-start (false) */
  alignCenter: boolean;
}

function getPendingInfoRows(isUpi: boolean, sub: PendingSubState): InfoRowData[] {
  if (isUpi) {
    switch (sub) {
      case 'verifying':
        return [
          { text: 'Open your UPI app to approve the payment', alignCenter: true },
          { text: 'You have 6 minutes to complete the approval', alignCenter: true },
          { text: "Please don't close the app", alignCenter: true },
        ];
      case 'processing':
        return [
          { text: 'Waiting for approval on your UPI app', alignCenter: true },
          { text: 'This can take a few minutes. Please check your UPI app', alignCenter: false },
          { text: "You'll see confirmation here once approved", alignCenter: true },
        ];
      case 'timed_out':
        return [
          { text: 'UPI payment request has expired', alignCenter: true },
          { text: 'The approval window has closed. Please try again', alignCenter: true },
          { text: 'You can retry with the same or a different payment method', alignCenter: false },
        ];
    }
  }

  // Non-UPI (card / netbanking) — Figma 768:303835 processing state
  switch (sub) {
    case 'verifying':
      return [
        { text: 'Confirming your payment with the bank...', alignCenter: true },
        { text: 'This usually takes a few seconds', alignCenter: true },
        { text: "Please don't close the app", alignCenter: true },
      ];
    case 'processing':
      return [
        { text: "We've received your payment request", alignCenter: true },
        { text: 'This can take a few minutes depending on your bank', alignCenter: true },
        { text: "You'll see confirmation here once it's complete", alignCenter: true },
      ];
    case 'timed_out':
      return [
        { text: 'Your payment is still being processed by your bank', alignCenter: false },
        { text: 'This is taking longer than expected. Please check back later', alignCenter: false },
        { text: "You'll receive a notification once the payment is confirmed", alignCenter: false },
      ];
  }
}

// Figma 768:303928 — Failed state (3 rows)
const FAILED_INFO_ROWS: InfoRowData[] = [
  { text: "Something didn't go through this time", alignCenter: true },
  { text: "Your money is safe and hasn't been deducted", alignCenter: true },
  { text: "If money was debited, it will automatically be refunded within 3-5 business days", alignCenter: false },
];

// Figma 768:304020 — Refunded state (2 rows)
const REFUNDED_INFO_ROWS: InfoRowData[] = [
  { text: 'Your payment was not completed and the amount has been returned to your account', alignCenter: false },
  { text: 'Refunds usually reflect within 3\u20135 business days', alignCenter: false },
];

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Card Icon — Figma "Frame 2095586326"
 * Left bracket (Vector 54) + card image (Rectangle 55) + right bracket (Vector 55 mirrored)
 * Total: 52.52w × 40h — identical in every info row across all states.
 */
const CARD_ICON_IMAGE = require('@/assets/images/status/card_icon.png');

/** Left bracket "[" — Figma Vector 54: 6.72×40, stroke #444444, weight 0.61 */
const LeftBracket = memo(() => (
  <Svg width={s(6.72)} height={sv(40)} viewBox="0 0 6.72 40" fill="none">
    <Path
      d="M6.72 0 L0 0 L0 40 L6.72 40"
      stroke="#444444"
      strokeWidth={0.61}
      strokeLinecap="square"
    />
  </Svg>
));
LeftBracket.displayName = 'LeftBracket';

/** Right bracket "]" — Figma Vector 55: 6.72×40 mirrored, stroke #444444, weight 0.61 */
const RightBracket = memo(() => (
  <Svg width={s(6.72)} height={sv(40)} viewBox="0 0 6.72 40" fill="none">
    <Path
      d="M0 0 L6.72 0 L6.72 40 L0 40"
      stroke="#444444"
      strokeWidth={0.61}
      strokeLinecap="square"
    />
  </Svg>
));
RightBracket.displayName = 'RightBracket';

const CardIcon = memo(() => (
  <View style={styles.cardIconGroup}>
    <LeftBracket />
    <Image source={CARD_ICON_IMAGE} style={styles.cardIconImage} resizeMode="cover" />
    <RightBracket />
  </View>
));
CardIcon.displayName = 'CardIcon';

interface InfoRowProps {
  text: string;
  alignCenter?: boolean;
}

const InfoRow = memo(({ text, alignCenter }: InfoRowProps) => (
  <View style={[styles.infoRow, { alignItems: alignCenter ? 'center' : 'flex-start' }]}>
    <CardIcon />
    <Text style={styles.infoText}>{text}</Text>
  </View>
));
InfoRow.displayName = 'InfoRow';

// ============================================
// STATUS-SPECIFIC CONTENT RENDERERS
// ============================================

interface PendingContentProps {
  isUpi: boolean;
  pendingSub: PendingSubState;
}

const PendingContent = memo(({ isUpi, pendingSub }: PendingContentProps) => {
  const rows = getPendingInfoRows(isUpi, pendingSub);
  return (
    <View style={styles.infoSection}>
      {rows.map((row, i) => (
        <InfoRow key={i} text={row.text} alignCenter={row.alignCenter} />
      ))}
    </View>
  );
});
PendingContent.displayName = 'PendingContent';

const FailedContent = memo(() => (
  <View style={styles.infoSection}>
    {FAILED_INFO_ROWS.map((row, i) => (
      <InfoRow key={i} text={row.text} alignCenter={row.alignCenter} />
    ))}
  </View>
));
FailedContent.displayName = 'FailedContent';

const RefundedContent = memo(() => (
  <View style={styles.infoSection}>
    {REFUNDED_INFO_ROWS.map((row, i) => (
      <InfoRow key={i} text={row.text} alignCenter={row.alignCenter} />
    ))}
  </View>
));
RefundedContent.displayName = 'RefundedContent';

// ============================================
// ERROR FALLBACK
// ============================================

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorFallback}>
      <Text style={styles.errorFallbackTitle}>Something went wrong</Text>
      <Text style={styles.errorFallbackMessage}>
        We could not display your payment status. Please try again.
      </Text>
      <PrimaryButton title="Go home" onPress={onRetry} testID="error-go-home-button" />
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { clearLastPayment } = usePaymentStore();

  // -- Route params
  const params = useLocalSearchParams() as unknown as StatusParams;
  const paymentId = params.paymentId ?? '';
  const storeAmount = usePaymentStore((s) => s.amount);
  const amount = params.amount
    ?? (storeAmount ? String(storeAmount) : '0');
  const method = (params.method ?? '') as string;
  const cashback = params.cashback ?? '0';
  const transactionId = params.transactionId ?? `SEC${Date.now().toString().slice(-8)}`;
  const isUpi = method === 'upi';

  // -- Deep link sanitization: validate initialStatus
  // If initialStatus is 'success', redirect to success screen
  const rawInitialStatus = params.initialStatus ?? '';
  const sanitizedInitialStatus = VALID_INITIAL_STATUSES.has(rawInitialStatus)
    ? (rawInitialStatus as StatusState)
    : 'pending';

  // -- State machine
  const [state, dispatch] = useReducer(statusReducer, {
    status: sanitizedInitialStatus,
    pendingSub: 'verifying' as PendingSubState,
  });

  // -- Error boundary state
  const [renderError, setRenderError] = useState(false);

  // -- Network awareness
  const { isConnected } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  // -- Ref for pendingSub to avoid stale closures in recursive setTimeout
  const pendingSubRef = useRef(state.pendingSub);
  pendingSubRef.current = state.pendingSub;

  // -- Realtime acceleration: immediately trigger pollStatus on DB event
  const pollStatusRef = useRef<(() => void) | null>(null);
  useRealtimeQuery({
    table: 'payments',
    event: 'UPDATE',
    filter: paymentId ? `id=eq.${paymentId}` : undefined,
    queryKeys: [['dashboard'], ['paymentHistory']],
    enabled: !!paymentId && state.status === 'pending',
    onEvent: () => {
      // Bypass the 5s polling interval — immediately check status
      if (pollStatusRef.current) {
        pollStatusRef.current();
      }
    },
  });

  // -- Polling refs
  const attemptsRef = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // -- Timeout calculation
  const verificationTimeoutMs = isUpi ? VERIFICATION_TIMEOUT_MS_UPI : VERIFICATION_TIMEOUT_MS_DEFAULT;
  const maxVerificationAttempts = Math.ceil(verificationTimeoutMs / VERIFICATION_INTERVAL_MS);

  // ============================================
  // CACHE INVALIDATION
  // ============================================

  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paymentHistory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  // ============================================
  // RESOLVE STATUS (terminal states)
  // ============================================

  const resolveStatus = useCallback(
    (newStatus: 'success' | 'failed' | 'refunded') => {
      clearLastPayment();
      invalidateCaches();

      if (newStatus === 'success') {
        // Navigate to dedicated success screen with receipt UI
        router.replace({
          pathname: '/(payment)/success',
          params: {
            paymentId,
            amount,
            method,
            cashback,
            transactionId,
            landlordName: params.landlordName,
            agreementId: params.agreementId,
          },
        } as never);
      } else {
        dispatch({ type: 'RESOLVE', status: newStatus });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [clearLastPayment, invalidateCaches, router, paymentId, amount, method, cashback, transactionId, params.landlordName, params.agreementId],
  );

  // ============================================
  // POLLING LOGIC
  // ============================================

  const pollStatus = useCallback(async () => {
    // FIX: BUG-1 — check abort signal before polling to actually stop on unmount
    if (abortControllerRef.current?.signal.aborted) return;

    if (!paymentId || isPollingRef.current) return;

    // Pause polling when offline
    if (!isConnectedRef.current) {
      pollTimeoutRef.current = setTimeout(pollStatus, VERIFICATION_INTERVAL_MS);
      return;
    }

    isPollingRef.current = true;
    attemptsRef.current++;

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const { data, error } = await checkPaymentStatus(paymentId, abortControllerRef.current?.signal);

      if (data) {
        // Transition from verifying to processing after first successful poll
        if (pendingSubRef.current === 'verifying') {
          dispatch({ type: 'SET_PENDING_SUB', sub: 'processing' });
        }

        if (data.status === 'success') {
          resolveStatus('success');
          return;
        } else if (data.status === 'failed') {
          resolveStatus('failed');
          return;
        } else if (data.status === 'refunded') {
          resolveStatus('refunded');
          return;
        }
      }

      if (error && pendingSubRef.current === 'verifying') {
        dispatch({ type: 'SET_PENDING_SUB', sub: 'processing' });
      }

      if (attemptsRef.current < maxVerificationAttempts) {
        pollTimeoutRef.current = setTimeout(() => {
          pollStatus();
        }, VERIFICATION_INTERVAL_MS);
      } else {
        dispatch({ type: 'SET_PENDING_SUB', sub: 'timed_out' });
        dispatch({ type: 'SET_STATUS', status: 'timed_out' });
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Payment verification error:', err);
      }
      if (pendingSubRef.current === 'verifying') {
        dispatch({ type: 'SET_PENDING_SUB', sub: 'processing' });
      }
      if (attemptsRef.current < maxVerificationAttempts) {
        pollTimeoutRef.current = setTimeout(() => {
          pollStatus();
        }, VERIFICATION_INTERVAL_MS);
      } else {
        dispatch({ type: 'SET_PENDING_SUB', sub: 'timed_out' });
        dispatch({ type: 'SET_STATUS', status: 'timed_out' });
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [paymentId, maxVerificationAttempts, resolveStatus]);

  // Wire ref so realtime onEvent can trigger immediate poll
  pollStatusRef.current = pollStatus;

  // ============================================
  // DEEP LINK: Server status override
  // ============================================

  useEffect(() => {
    if (!paymentId) return;

    // If paymentId is provided, fetch the server status and override initialStatus
    let cancelled = false;

    (async () => {
      try {
        const { data } = await checkPaymentStatus(paymentId);
        if (cancelled || !data) return;

        if (data.status === 'success') {
          resolveStatus('success');
        } else if (data.status === 'failed') {
          resolveStatus('failed');
        } else if (data.status === 'refunded') {
          resolveStatus('refunded');
        }
        // If still pending/processing/initiated, the polling will handle it
      } catch {
        // Ignore -- polling will take over
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // START POLLING (pending only)
  // ============================================

  useEffect(() => {
    if (state.status !== 'pending') return;

    if (!paymentId) {
      // FIX: BUG-3 — gate demo auto-success behind __DEV__ to prevent fake success in production
      if (__DEV__) {
        const DEMO_DELAY_MS = 50000;
        const timer = setTimeout(() => {
          resolveStatus('success');
        }, DEMO_DELAY_MS);
        return () => clearTimeout(timer);
      }
      return;
    }

    pollStatus();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      // Cancel in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [state.status, paymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // APP STATE: Re-poll on foreground
  // ============================================

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (
        nextState === 'active' &&
        paymentId &&
        state.status === 'pending' &&
        state.pendingSub !== 'timed_out'
      ) {
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
        }
        isPollingRef.current = false;
        pollStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [paymentId, state.status, state.pendingSub, pollStatus]);

  // ============================================
  // NETWORK: Resume polling on reconnect
  // ============================================

  useEffect(() => {
    if (
      isConnected &&
      paymentId &&
      state.status === 'pending' &&
      state.pendingSub !== 'timed_out' &&
      !isPollingRef.current
    ) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      pollStatus();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // REDIRECT: initialStatus=success goes to success screen
  // ============================================

  useEffect(() => {
    if (rawInitialStatus === 'success') {
      router.replace({
        pathname: '/(payment)/success',
        params: {
          paymentId,
          amount,
          method,
          cashback,
          transactionId,
          landlordName: params.landlordName,
          agreementId: params.agreementId,
          source: params.source,
        },
      } as never);
      return;
    }
    if (sanitizedInitialStatus === 'failed' || sanitizedInitialStatus === 'refunded') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // BACK NAVIGATION GUARD
  // ============================================

  useEffect(() => {
    const onBackPress = () => {
      if (state.status === 'pending') {
        Alert.alert(
          'Payment in progress',
          'Your payment is still being processed. Are you sure you want to leave?',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => {
                router.replace('/(main)' as never);
              },
            },
          ],
        );
        return true; // Prevent default back
      }

      // For terminal states, go home (clear payment stack)
      router.replace('/(main)' as never);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [state.status, router]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  const handleTryAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(payment)/enter-rent' as never);
  }, [router]);

  const handleGoHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  const handleBack = useCallback(() => {
    if (state.status === 'pending') {
      Alert.alert(
        'Payment in progress',
        'Your payment is still being processed. Are you sure you want to leave?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              router.replace('/(main)' as never);
            },
          },
        ],
      );
      return;
    }
    handleGoHome();
  }, [state.status, router, handleGoHome]);

  // ============================================
  // DERIVED UI VALUES
  // ============================================

  const getStampConfig = (): { text: string; color: string; image?: any } => {
    switch (state.status) {
      case 'pending':
        return {
          text: 'pending',
          color: FIGMA_COLORS.pendingStamp,
          image: require('@/assets/images/status/stamps/stamp_pending.png'),
        };
      case 'failed':
        return {
          text: 'failed',
          color: FIGMA_COLORS.failedStamp,
          image: require('@/assets/images/status/stamps/stamp_failed.png'),
        };
      case 'refunded':
        return {
          text: 'refunded',
          color: FIGMA_COLORS.pendingStamp,
          image: require('@/assets/images/status/stamps/stamp_refunded.png'),
        };
      case 'timed_out':
        return {
          text: 'pending',
          color: FIGMA_COLORS.pendingStamp,
          image: require('@/assets/images/status/stamps/stamp_pending.png'),
        };
    }
  };

  const getTitleConfig = (): { line1: string; line2: string } => {
    switch (state.status) {
      case 'pending':
        return state.pendingSub === 'verifying'
          ? { line1: 'Verifying', line2: 'Payment...' }
          : { line1: 'Payment', line2: 'Processing' };
      case 'failed':
        return { line1: 'Payment', line2: 'Failed' };
      case 'refunded':
        return { line1: 'Payment', line2: 'Refunded' };
      case 'timed_out':
        return { line1: 'Payment', line2: 'Processing' };
    }
  };

  const stampConfig = getStampConfig();
  const titleConfig = getTitleConfig();

  // ============================================
  // RENDER CARD CONTENT
  // ============================================

  const renderCardContent = () => {
    switch (state.status) {
      case 'pending':
        return <PendingContent isUpi={isUpi} pendingSub={state.pendingSub} />;
      case 'failed':
        return <FailedContent />;
      case 'refunded':
        return <RefundedContent />;
      case 'timed_out':
        return <PendingContent isUpi={isUpi} pendingSub="timed_out" />;
    }
  };

  // ============================================
  // RENDER BUTTONS
  // ============================================

  const renderButtons = () => {
    switch (state.status) {
      case 'pending':
        return (
          <PrimaryButton
            title="Contact support"
            onPress={handleContactSupport}
            showDivider={true}
            testID="contact-support-button"
          />
        );

      case 'timed_out':
        return (
          <>
            <PrimaryButton
              title="Check back later"
              onPress={handleGoHome}
              showDivider={true}
              testID="check-back-later-button"
            />
            <PrimaryButton
              title="Contact support"
              onPress={handleContactSupport}
              showDivider={true}
              testID="contact-support-button"
            />
          </>
        );

      case 'failed':
      case 'refunded':
        return (
          <>
            <PrimaryButton
              title="Try again"
              onPress={handleTryAgain}
              showDivider={true}
              testID="try-again-button"
            />
            <TouchableOpacity
              onPress={handleContactSupport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.contactSupportText}>Contact Support</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  // ============================================
  // ERROR BOUNDARY RENDER
  // ============================================

  if (renderError) {
    return (
      <Screen testID="status-screen-error" padded={false} style={styles.screen}>
        <ErrorFallback onRetry={handleGoHome} />
      </Screen>
    );
  }

  // ============================================
  // MAIN RENDER (wrapped in try-catch)
  // ============================================

  const backButton = (
    <BackButton
      style={StyleSheet.flatten([styles.backButton, { top: sv(16) }])}
      onPress={handleBack}
      testID="back-button"
    />
  );

  const card = (
    <PaymentReceiptCard
      stampText={stampConfig.text}
      stampColor={stampConfig.color}
      stampImage={stampConfig.image}
      titleLine1={titleConfig.line1}
      titleLine2={titleConfig.line2}
      titleLine2Color={FIGMA_COLORS.titleAccent}
      contentPaddingTop={sv(130)}
      titleMarginLeft={s(10)}
      titleMarginBottom={sv(25)}
    >
      {renderCardContent()}
    </PaymentReceiptCard>
  );

  const buttons = (
    <View style={styles.buttonContainer}>
      {renderButtons()}
    </View>
  );

  let content: React.ReactNode;
  try {
    content = (
      <View style={styles.container}>
        {backButton}
        {card}
        <View style={styles.spacer} />
        {buttons}
      </View>
    );
  } catch (err) {
    if (__DEV__) {
      console.error('PaymentStatusScreen render error:', err);
    }
    if (!renderError) {
      setRenderError(true);
    }
    content = null;
  }

  const showOfflineBanner = state.status === 'pending' || state.status === 'timed_out';

  return (
    <Screen testID="status-screen" padded={false} style={styles.screen}>
      {showOfflineBanner && (
        <OfflineBanner message="No internet connection. Polling paused." />
      )}
      {content}
    </Screen>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  screen: {
    backgroundColor: FIGMA_COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: s(24),
    paddingBottom: sv(24),
  },

  // -- Info section (pending/failed/refunded)
  // Figma: container at x=1, y=219, w=269 inside 270px card.
  // Card content has padding s(24). Offset: left -(24-1)=-23, right -24 to span full width.
  infoSection: {
    gap: sv(24),
    marginLeft: -s(23),
    marginRight: -s(24),
  },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: s(32),
    gap: s(16),
  },
  cardIconGroup: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: s(52.52),
    height: sv(40),
  },
  cardIconImage: {
    width: s(39.08),
    height: s(39.08),
    borderRadius: 4,
  },
  infoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.infoText,
    textAlign: 'left',
  },

  spacer: {
    flex: 1,
    minHeight: sv(40),
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: s(16),
    gap: sv(16),
    alignItems: 'center',
  },
  contactSupportText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.tryAgainText, // #A9A9A9
    textAlign: 'center' as const,
  },
  backButton: {
    position: 'absolute' as const,
    left: s(72),
    zIndex: 10,
    width: s(32),
    height: sv(32),
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  // -- Error fallback
  errorFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(40),
    gap: sv(16),
  },
  errorFallbackTitle: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(20),
    lineHeight: sf(28),
    color: PAYMENT_COLORS.white,
    textAlign: 'center',
  },
  errorFallbackMessage: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: FIGMA_COLORS.infoText,
    textAlign: 'center',
    marginBottom: sv(24),
  },
});
