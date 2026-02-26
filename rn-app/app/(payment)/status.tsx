/**
 * Consolidated Payment Status Screen
 *
 * Replaces success.tsx, processing.tsx, and failed.tsx with a single
 * status-driven screen that renders PENDING, SUCCESS, FAILED, or REFUNDED
 * states using the shared PaymentReceiptCard component.
 *
 * Figma References:
 * - 41-9388 / 41-9563 (Success with/without cashback)
 * - 41-9460 (Processing)
 * - 41-9511 (Failed)
 * - 41-9635 (Refunded)
 *
 * State machine: useReducer drives StatusState transitions.
 * Polling: 3s interval, 120s timeout (360s for UPI), network-aware.
 * Back guard: Intercepts hardware back when pending; navigates home otherwise.
 * Deep link: Validates initialStatus; server status overrides when paymentId present.
 * Receipt: expo-print + expo-sharing for PDF generation on success.
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
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { PaymentReceiptCard } from '@/src/components/payment/PaymentReceiptCard';
import { DashedDivider } from '@/src/components/payment';
import { OfflineBanner } from '@/src/components/ui/Layout/OfflineBanner';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { checkPaymentStatus, generateReceipt } from '@/src/services/api/payments';
import type { ReceiptData } from '@/src/services/api/payments';
import { buildReceiptHtml } from '@/src/utils/receiptHtml';
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

type StatusState = 'pending' | 'success' | 'failed' | 'refunded' | 'timed_out';
type PendingSubState = 'verifying' | 'processing' | 'timed_out';

type StatusAction =
  | { type: 'SET_STATUS'; status: StatusState }
  | { type: 'SET_PENDING_SUB'; sub: PendingSubState }
  | { type: 'RESOLVE'; status: 'success' | 'failed' | 'refunded' };

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

const VERIFICATION_INTERVAL_MS = 3000;
const VERIFICATION_TIMEOUT_MS_DEFAULT = 120000; // 120s
const VERIFICATION_TIMEOUT_MS_UPI = 360000;     // 360s (6 min) for UPI collect
const VALID_INITIAL_STATUSES = new Set(['pending', 'success', 'failed', 'refunded']);
const FIGMA_CARD_INNER_WIDTH = s(222);

// ============================================
// FIGMA TOKENS — aliased from shared PAYMENT_COLORS
// ============================================

const FIGMA_COLORS = {
  background: PAYMENT_COLORS.background,
  cardBackground: PAYMENT_COLORS.cardBackground,
  titleWhite: PAYMENT_COLORS.white,
  titleAccent: PAYMENT_COLORS.accent,
  successStamp: PAYMENT_COLORS.successStamp,
  failedStamp: PAYMENT_COLORS.failedStamp,
  refundedStamp: PAYMENT_COLORS.refundedStamp,
  pendingStamp: PAYMENT_COLORS.pendingStamp,
  infoText: PAYMENT_COLORS.mutedText,
  labelText: PAYMENT_COLORS.labelText,
  valueText: PAYMENT_COLORS.valueText,
  payableValue: PAYMENT_COLORS.highlightText,
  iconColor: PAYMENT_COLORS.labelText,
  dividerColor: PAYMENT_COLORS.divider,
  tryAgainText: PAYMENT_COLORS.mutedText,
} as const;

// ============================================
// HELPERS
// ============================================

function formatDisplayDate(isoString: string): string {
  const date = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ============================================
// INFO ROW MESSAGES
// ============================================

function getPendingInfoRows(isUpi: boolean, sub: PendingSubState): string[] {
  if (isUpi) {
    switch (sub) {
      case 'verifying':
        return [
          'Open your UPI app to approve the payment.',
          'You have 6 minutes to complete the approval.',
          "Please don't close the app.",
        ];
      case 'processing':
        return [
          'Waiting for approval on your UPI app.',
          'This can take a few minutes. Please check your UPI app.',
          "You'll see confirmation here once approved.",
        ];
      case 'timed_out':
        return [
          'UPI payment request has expired.',
          'The approval window has closed. Please try again.',
          'You can retry with the same or a different payment method.',
        ];
    }
  }

  switch (sub) {
    case 'verifying':
      return [
        'Confirming your payment with the bank...',
        'This usually takes a few seconds.',
        "Please don't close the app.",
      ];
    case 'processing':
      return [
        "We've received your payment request.",
        'This can take a few minutes depending on your bank.',
        "You'll see confirmation here once it's complete.",
      ];
    case 'timed_out':
      return [
        'Your payment is still being processed by your bank.',
        'This is taking longer than expected. Please check back later.',
        "You'll receive a notification once the payment is confirmed.",
      ];
  }
}

const FAILED_INFO_ROWS = [
  "Something didn't go through this time.",
  "Your money is safe and hasn't been deducted.",
  "If money was debited, it will automatically be refunded within 3-5 business days."
];

const REFUNDED_INFO_ROWS = [
  'Your payment was not completed and the amount has been returned to your account.',
  'Refunds usually reflect within 3\u20135 business days.',
];

// ============================================
// SUB-COMPONENTS
// ============================================

/** Timeline icon used for info rows in pending/failed/refunded states */
const TimelineIcon = () => (
  <View style={{ width: 52.5, height: 40, position: 'relative' }}>
    <Image
      source={require('@/assets/images/processing-icon.png')}
      style={{ position: 'absolute', left: 6.72, top: 0.46, width: 39, height: 39 }}
    />
  </View>
);

/** Hash icon for receipt rows in success state */
const ReceiptIcon = memo(() => (
  <View style={styles.hashIcon}>
    <Svg width={11} height={12} viewBox="0 0 11 12" fill="none">
      <Path
        d="M2.52285 7.33333L2.80313 4.66667L0 4.66667L0 3.33333L2.94327 3.33333L3.29362 0L4.63427 0L4.28393 3.33333L6.94327 3.33333L7.2936 0L8.63427 0L8.28393 3.33333L10.6667 3.33333L10.6667 4.66667L8.1438 4.66667L7.86353 7.33333L10.6667 7.33333L10.6667 8.66667L7.7234 8.66667L7.37307 12L6.0324 12L6.38273 8.66667L3.72339 8.66667L3.37305 12L2.03237 12L2.38271 8.66667L0 8.66667L0 7.33333L2.52285 7.33333ZM3.86353 7.33333L6.52287 7.33333L6.80313 4.66667L4.1438 4.66667L3.86353 7.33333Z"
        fill={FIGMA_COLORS.iconColor}
        fillRule="nonzero"
      />
    </Svg>
  </View>
));
ReceiptIcon.displayName = 'ReceiptIcon';

/** Info row with timeline icon + text (pending/failed/refunded) */
const InfoRow = memo(({ text }: { text: string }) => (
  <View style={styles.infoRow}>
    <TimelineIcon />
    <Text style={styles.infoText}>{text}</Text>
  </View>
));
InfoRow.displayName = 'InfoRow';

/** Receipt row with hash icon (success state) */
interface ReceiptRowProps {
  label: string;
  value: string;
  isPayableRent?: boolean;
  isCashback?: boolean;
}

const ReceiptRow = memo(({ label, value, isPayableRent, isCashback }: ReceiptRowProps) => (
  <View style={styles.receiptRow}>
    <View style={styles.labelContainer}>
      <ReceiptIcon />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <Text style={
      isPayableRent ? styles.payableRentValueText :
      isCashback ? styles.cashbackValueText :
      styles.valueText
    }>
      {value}
    </Text>
  </View>
));
ReceiptRow.displayName = 'ReceiptRow';

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
      {rows.map((text, i) => (
        <InfoRow key={i} text={text} />
      ))}
    </View>
  );
});
PendingContent.displayName = 'PendingContent';

interface SuccessContentProps {
  amount: string;
  cashbackApplied: number;
  date: string;
  method: string;
  landlordName: string;
  panCard: string;
  agreementId: string;
  transactionId: string;
  payableRent: string;
}

const SuccessContent = memo(({
  amount,
  cashbackApplied,
  date,
  method,
  landlordName,
  panCard,
  agreementId,
  transactionId,
  payableRent,
}: SuccessContentProps) => {
  const cashbackDisplay = cashbackApplied > 0 ? `- \u20B9  ${cashbackApplied.toLocaleString('en-IN')}` : `- \u20B9 0`;

  return (
    <View style={styles.receiptDetails}>
      <ReceiptRow label="Amount paid" value={`\u20B9  ${amount}`} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Cashback Applied" value={cashbackDisplay} isCashback />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Date" value={date} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Method" value={method} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Landlord" value={landlordName} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="PAN Card" value={panCard} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Agreement ID" value={agreementId} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Transaction ID" value={transactionId} />
      <View style={styles.secondSection}>
        <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
        <ReceiptRow label="Payable Rent" value={`\u20B9  ${payableRent}`} isPayableRent />
      </View>
    </View>
  );
});
SuccessContent.displayName = 'SuccessContent';

const FailedContent = memo(() => (
  <View style={styles.infoSection}>
    {FAILED_INFO_ROWS.map((text, i) => (
      <InfoRow key={i} text={text} />
    ))}
  </View>
));
FailedContent.displayName = 'FailedContent';

const RefundedContent = memo(() => (
  <View style={styles.infoSection}>
    {REFUNDED_INFO_ROWS.map((text, i) => (
      <InfoRow key={i} text={text} />
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
      <PrimaryButton title="Go Home" onPress={onRetry} testID="error-go-home-button" />
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentStatusScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearLastPayment } = usePaymentStore();

  // -- Route params
  const params = useLocalSearchParams() as unknown as StatusParams;
  const paymentId = params.paymentId ?? '';
  const amount = params.amount ?? '32,175';
  const method = (params.method ?? 'upi') as 'upi' | 'card' | 'netbanking';
  const cashback = params.cashback ?? '0';
  const transactionId = params.transactionId ?? `SEC${Date.now().toString().slice(-8)}`;
  const errorMessage = params.error ?? '';
  const isUpi = method === 'upi';

  // -- Deep link sanitization: validate initialStatus
  const sanitizedInitialStatus = VALID_INITIAL_STATUSES.has(params.initialStatus ?? '')
    ? (params.initialStatus as StatusState)
    : 'pending';

  // -- State machine
  const [state, dispatch] = useReducer(statusReducer, {
    status: sanitizedInitialStatus,
    pendingSub: 'verifying' as PendingSubState,
  });

  // -- Error boundary state
  const [renderError, setRenderError] = useState(false);

  // -- Receipt data (fetched on success for full receipt display)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const isReceiptView = params.source === 'receipt_view';

  // -- Network awareness
  const { isConnected } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

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
      dispatch({ type: 'RESOLVE', status: newStatus });
      invalidateCaches();

      if (newStatus === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [clearLastPayment, invalidateCaches],
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
      const { data, error } = await checkPaymentStatus(paymentId);

      if (data) {
        // Transition from verifying to processing after first successful poll
        if (state.pendingSub === 'verifying') {
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

      if (error && state.pendingSub === 'verifying') {
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
      if (state.pendingSub === 'verifying') {
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
  }, [paymentId, state.pendingSub, maxVerificationAttempts, resolveStatus]);

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
  // HAPTICS: Fire on initial terminal status
  // ============================================

  useEffect(() => {
    if (sanitizedInitialStatus === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (sanitizedInitialStatus === 'failed' || sanitizedInitialStatus === 'refunded') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // FETCH RECEIPT DATA (success state)
  // ============================================

  useEffect(() => {
    if (state.status !== 'success' || !paymentId || receiptData) return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await generateReceipt(paymentId);
        if (!cancelled && data) {
          setReceiptData(data);
        }
      } catch {
        // Fall back to route params
      }
    })();

    return () => { cancelled = true; };
  }, [state.status, paymentId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    router.replace('/(payment)/confirm' as never);
  }, [router]);

  const handleGoHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  const handleDownloadReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Use cached receipt data or fetch fresh
    let receipt = receiptData;
    if (!receipt && paymentId) {
      try {
        const { data } = await generateReceipt(paymentId);
        receipt = data;
      } catch (err) {
        if (__DEV__) {
          console.warn('Receipt fetch failed:', err);
        }
      }
    }

    if (receipt) {
      try {
        const html = buildReceiptHtml({
          receiptNumber: receipt.receiptNumber,
          payment: {
            amount: receipt.payment.amount,
            netAmountPaid: receipt.payment.netAmountPaid,
            pgFee: receipt.payment.pgFee,
            cashbackApplied: receipt.payment.cashbackApplied,
            cashbackEarned: receipt.payment.cashbackEarned,
            paymentMethod: receipt.payment.paymentMethod,
            paidAt: receipt.payment.paidAt,
            rentMonthDisplay: receipt.payment.rentMonthDisplay,
            utr: receipt.payment.utr ?? null,
            timeliness: receipt.payment.timeliness ?? null,
            transactionId: receipt.payment.transactionId,
          },
          tenant: receipt.tenant,
          property: receipt.property,
          landlord: {
            name: receipt.landlord.name,
            panMasked: receipt.landlord.panMasked ?? null,
          },
          agreement: {
            certId: receipt.agreement?.certId ?? null,
          },
          company: receipt.company,
        });

        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Rent Receipt',
          UTI: 'com.adobe.pdf',
        });
        return;
      } catch (err) {
        if (__DEV__) {
          console.warn('PDF generation failed, falling back to text share:', err);
        }
      }
    }

    // Fallback to basic text share
    try {
      await Share.share({
        message: `Rent Receipt\n\nAmount: \u20B9${amount}\nDate: ${new Date().toLocaleDateString()}\nTransaction ID: ${transactionId}\nMethod: ${method}`,
        title: 'Rent Receipt',
      });
    } catch (err) {
      if (__DEV__) {
        console.log('Share error:', err);
      }
    }
  }, [receiptData, paymentId, amount, transactionId, method]);

  // ============================================
  // DERIVED UI VALUES
  // ============================================

  const getStampConfig = (): { text: string; color: string } => {
    switch (state.status) {
      case 'pending':
        return { text: 'pending', color: FIGMA_COLORS.pendingStamp };
      case 'success':
        return { text: 'paid', color: FIGMA_COLORS.successStamp };
      case 'failed':
        return { text: 'failed', color: FIGMA_COLORS.failedStamp };
      case 'refunded':
        return { text: 'refunded', color: FIGMA_COLORS.refundedStamp };
      case 'timed_out':
        return { text: 'pending', color: FIGMA_COLORS.pendingStamp };
    }
  };

  const getTitleConfig = (): { line1: string; line2: string } => {
    switch (state.status) {
      case 'pending':
        return state.pendingSub === 'verifying'
          ? { line1: 'Verifying', line2: 'Payment...' }
          : { line1: 'Payment', line2: 'Processing' };
      case 'success':
        return { line1: 'Payment', line2: 'Successful', line2Color: '#70BF73' };
      case 'failed':
        return { line1: 'Payment', line2: 'Failed', line2Color: '#EF9194' };
      case 'refunded':
        return { line1: 'Payment', line2: 'Refunded', line2Color: '#70BF73' };
      case 'timed_out':
        return { line1: 'Payment', line2: 'Processing' };
    }
  };

  const stampConfig = getStampConfig();
  const titleConfig = getTitleConfig();

  // ============================================
  // DISPLAY DATA (computed from receipt data or route params)
  // ============================================

  const displayData = React.useMemo(() => {
    if (receiptData) {
      const { payment: rp, landlord, agreement } = receiptData;
      return {
        amount: rp.amount.toLocaleString('en-IN'),
        cashbackApplied: rp.cashbackApplied,
        date: formatDisplayDate(rp.paidAt),
        method: rp.paymentMethod ?? method.toUpperCase(),
        landlordName: landlord.name,
        panCard: landlord.panMasked ?? 'N/A',
        agreementId: agreement.certId ? `#${agreement.certId}` : 'N/A',
        transactionId: rp.utr ?? rp.transactionId ?? transactionId,
        payableRent: rp.netAmountPaid.toLocaleString('en-IN'),
      };
    }

    const formatted = Number(amount) ? Number(amount).toLocaleString('en-IN') : amount;
    return {
      amount: formatted,
      cashbackApplied: Number(cashback) || 0,
      date: formatDisplayDate(new Date().toISOString()),
      method: method.toUpperCase(),
      landlordName: params.landlordName || 'N/A',
      panCard: 'N/A',
      agreementId: params.agreementId ? `#${params.agreementId}` : 'N/A',
      transactionId: transactionId,
      payableRent: formatted,
    };
  }, [receiptData, amount, cashback, method, transactionId, params.landlordName, params.agreementId]);

  // ============================================
  // RENDER CARD CONTENT
  // ============================================

  const renderCardContent = () => {
    switch (state.status) {
      case 'pending':
        return <PendingContent isUpi={isUpi} pendingSub={state.pendingSub} />;
      case 'success':
        return (
          <SuccessContent
            amount={displayData.amount}
            cashbackApplied={displayData.cashbackApplied}
            date={displayData.date}
            method={displayData.method}
            landlordName={displayData.landlordName}
            panCard={displayData.panCard}
            agreementId={displayData.agreementId}
            transactionId={displayData.transactionId}
            payableRent={displayData.payableRent}
          />
        );
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
            title="Contact Support"
            onPress={handleContactSupport}
            testID="contact-support-button"
          />
        );

      case 'timed_out':
        return (
          <>
            <PrimaryButton
              title="Check Back Later"
              onPress={handleGoHome}
              testID="check-back-later-button"
            />
            <PrimaryButton
              title="Contact Support"
              onPress={handleContactSupport}
              testID="contact-support-button"
            />
          </>
        );

      case 'success':
        return (
          <>
            <PrimaryButton
              title="Download Receipt"
              onPress={handleDownloadReceipt}
              testID="download-receipt-button"
            />
            <TouchableOpacity
              onPress={handleContactSupport}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.contactSupportText}>Contact Support</Text>
            </TouchableOpacity>
          </>
        );

      case 'failed':
      case 'refunded':
        return (
          <>
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

  let content: React.ReactNode;
  try {
    content = (
      <View style={styles.container}>
        {/* Back button for receipt view */}
        {isReceiptView && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="back-button"
          >
            <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
              <Path
                d="M20 8L12 16L20 24"
                stroke={FIGMA_COLORS.titleWhite}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        )}

        <PaymentReceiptCard
          stampText={stampConfig.text}
          stampColor={stampConfig.color}
          titleLine1={titleConfig.line1}
          titleLine2={titleConfig.line2}
          titleLine2Color={titleConfig.line2Color || FIGMA_COLORS.titleAccent}
          topMargin={80}
        >
          {renderCardContent()}
        </PaymentReceiptCard>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button Container */}
        <View style={styles.buttonContainer}>{renderButtons()}</View>
      </View>
    );
  } catch (err) {
    if (__DEV__) {
      console.error('PaymentStatusScreen render error:', err);
    }
    // Trigger error fallback on next render
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
    paddingHorizontal: s(40),
  },

  // -- Info section (pending/failed/refunded)
  infoSection: {
    gap: sv(24),
    marginLeft: s(10),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
    paddingHorizontal: s(8),
  },
  infoText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.infoText,
    textAlign: 'left',
  },

  // -- Receipt section (success)
  receiptDetails: {
    gap: sv(16),
    alignItems: 'center',
  },
  receiptRow: {
    width: FIGMA_CARD_INNER_WIDTH,
    height: sv(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: s(4),
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  hashIcon: {
    width: s(16),
    height: s(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.labelText,
    textAlign: 'left',
  },
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.valueText,
    textAlign: 'right',
  },
  payableRentValueText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: FIGMA_COLORS.payableValue,
    textAlign: 'right',
  },
  divider: {
    width: FIGMA_CARD_INNER_WIDTH,
    marginVertical: 0,
  },
  cashbackValueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: PAYMENT_COLORS.cashbackDeduct, // #EF9194
    textAlign: 'right' as const,
  },
  secondSection: {
    marginTop: sv(8),
    gap: sv(16),
  },

  // -- Button container
  buttonContainer: {
    width: s(313),
    alignSelf: 'center',
    gap: sv(16),
    alignItems: 'center',
    paddingBottom: sv(24),
    marginTop: sv(40),
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
    top: 0,
    left: 0,
    zIndex: 10,
    width: s(32),
    height: sv(32),
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  tryAgainText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: FIGMA_COLORS.tryAgainText,
    textAlign: 'center',
  },

  // -- Spacer
  spacer: {
    flex: 1,
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
