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
  ScrollView,
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { Screen, Text, PrimaryButton, BackButton } from '@/src/components';
import { PaymentReceiptCard } from '@/src/components/payment/PaymentReceiptCard';
import { DashedDivider } from '@/src/components/payment';
import { OfflineBanner } from '@/src/components/ui/Layout/OfflineBanner';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { useRealtimeQuery } from '@/src/hooks/useRealtimeQuery';
import { checkPaymentStatus, generateReceipt } from '@/src/services/api/payments';
import type { ReceiptData } from '@/src/services/api/payments';
import { buildReceiptHtml, buildFallbackReceiptData } from '@/src/utils/receiptHtml';
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

const VERIFICATION_INTERVAL_MS = 5000; // Relaxed from 3s — realtime handles the fast path
const VERIFICATION_TIMEOUT_MS_DEFAULT = 300000; // 5 min for card/netbanking
const VERIFICATION_TIMEOUT_MS_UPI = 360000;     // 6 min for UPI S2S collect (NPCI mandates 5 min approval window)
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
          { text: 'Open your UPI app to approve the payment.', alignCenter: true },
          { text: 'You have 6 minutes to complete the approval.', alignCenter: true },
          { text: "Please don't close the app.", alignCenter: true },
        ];
      case 'processing':
        return [
          { text: 'Waiting for approval on your UPI app.', alignCenter: true },
          { text: 'This can take a few minutes. Please check your UPI app.', alignCenter: false },
          { text: "You'll see confirmation here once approved.", alignCenter: true },
        ];
      case 'timed_out':
        return [
          { text: 'UPI payment request has expired.', alignCenter: true },
          { text: 'The approval window has closed. Please try again.', alignCenter: true },
          { text: 'You can retry with the same or a different payment method.', alignCenter: false },
        ];
    }
  }

  // Non-UPI (card / netbanking) — Figma 768:303835 processing state
  switch (sub) {
    case 'verifying':
      return [
        { text: 'Confirming your payment with the bank...', alignCenter: true },
        { text: 'This usually takes a few seconds.', alignCenter: true },
        { text: "Please don't close the app.", alignCenter: true },
      ];
    case 'processing':
      return [
        { text: "We've received your payment request.", alignCenter: true },
        { text: 'This can take a few minutes depending on your bank.', alignCenter: true },
        { text: "You'll see confirmation here once it's complete.", alignCenter: true },
      ];
    case 'timed_out':
      return [
        { text: 'Your payment is still being processed by your bank.', alignCenter: false },
        { text: 'This is taking longer than expected. Please check back later.', alignCenter: false },
        { text: "You'll receive a notification once the payment is confirmed.", alignCenter: false },
      ];
  }
}

// Figma 768:303928 — Failed state (3 rows)
const FAILED_INFO_ROWS: InfoRowData[] = [
  { text: "Something didn't go through this time.", alignCenter: true },
  { text: "Your money is safe and hasn't been deducted.", alignCenter: true },
  { text: "If money was debited, it will automatically be refunded within 3-5 business days", alignCenter: false },
];

// Figma 768:304020 — Refunded state (2 rows)
const REFUNDED_INFO_ROWS: InfoRowData[] = [
  { text: 'Your payment was not completed and the amount has been returned to your account.', alignCenter: false },
  { text: 'Refunds usually reflect within 3\u20135 business days.', alignCenter: false },
];

// ============================================
// SUB-COMPONENTS
// ============================================

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

/** Receipt row with hash icon (success state) */
interface ReceiptRowProps {
  label: string;
  value: string;
  isPayableRent?: boolean;
  isCashback?: boolean;
  isPositive?: boolean;
}

const ReceiptRow = memo(({ label, value, isPayableRent, isCashback, isPositive }: ReceiptRowProps) => (
  <View style={styles.receiptRow}>
    <View style={styles.labelContainer}>
      <ReceiptIcon />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <Text
      style={[
        isPayableRent ? styles.payableRentValueText :
        isCashback ? styles.cashbackValueText :
        isPositive ? styles.positiveValueText :
        styles.valueText,
        styles.valueMaxWidth,
      ]}
    >
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
      {rows.map((row, i) => (
        <InfoRow key={i} text={row.text} alignCenter={row.alignCenter} />
      ))}
    </View>
  );
});
PendingContent.displayName = 'PendingContent';

interface SuccessContentProps {
  amount: string;
  cashbackApplied: string;
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
  return (
    <View style={styles.receiptDetails}>
      <ReceiptRow label="Amount paid" value={`\u20B9  ${amount}`} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Cashback Applied" value={`- \u20B9  ${cashbackApplied}`} isCashback />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Date" value={date} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Method" value={method} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Landlord" value={landlordName} />
      <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
      <ReceiptRow label="Transaction ID" value={transactionId} />
      <View style={styles.secondSection}>
        <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
        <ReceiptRow label="Rent Paid" value={`\u20B9  ${payableRent}`} isPayableRent />
      </View>
      {/* Figma 2095586455: Settlement info box — bg:#1a1a1a r:8 p:8/12 */}
      <View style={styles.settlementInfoBox}>
        <Text style={styles.settlementInfoText}>
          {'\u2139\uFE0F'} Settlement would be processed within 24 hrs
        </Text>
      </View>
    </View>
  );
});
SuccessContent.displayName = 'SuccessContent';

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
      <PrimaryButton title="Go Home" onPress={onRetry} testID="error-go-home-button" />
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
    router.replace('/(payment)/enter-rent' as never);
  }, [router]);

  const handleGoHome = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  const handleBack = useCallback(() => {
    if (isReceiptView) {
      router.back();
      return;
    }
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
  }, [isReceiptView, state.status, router, handleGoHome]);

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

    // Build HTML data from server receipt or fallback to route params
    let htmlData;
    if (receipt) {
      htmlData = {
        receiptNumber: receipt.receiptNumber,
        payment: {
          amount: receipt.payment.amount,
          pgFee: receipt.payment.pgFee,
          paymentMethod: receipt.payment.paymentMethod,
          paidAt: receipt.payment.paidAt,
          rentMonthDisplay: receipt.payment.rentMonthDisplay,
          utr: receipt.payment.utr ?? null,
          timeliness: receipt.payment.timeliness ?? null,
          transactionId: receipt.payment.transactionId,
        },
        tenant: {
          name: receipt.tenant.name,
          phone: receipt.tenant.phone,
          email: receipt.tenant.email,
          panMasked: receipt.tenant.panMasked ?? null,
        },
        property: receipt.property,
        landlord: {
          name: receipt.landlord.name,
          panMasked: receipt.landlord.panMasked ?? null,
        },
        agreement: {
          certId: receipt.agreement?.certId ?? null,
        },
      };
    } else {
      htmlData = buildFallbackReceiptData({
        amount,
        method,
        transactionId: transactionId,
        landlordName: params.landlordName,
        agreementId: params.agreementId,
        paymentId,
      });
    }

    try {
      const html = buildReceiptHtml(htmlData);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Rent Receipt',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (__DEV__) {
        console.warn('PDF generation failed:', err);
      }
      Alert.alert(
        'Receipt Unavailable',
        'Unable to generate the receipt PDF. Please try again later.',
      );
    }
  }, [receiptData, paymentId, amount, method, transactionId, params.landlordName, params.agreementId]);

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
      case 'success':
        return {
          text: 'paid',
          color: FIGMA_COLORS.successStamp,
          image: require('@/assets/images/status/stamps/stamp_paid.png'),
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
      case 'success':
        return { line1: 'Payment', line2: 'Successful' };
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
  // DISPLAY DATA (computed from receipt data or route params)
  // ============================================

  const displayData = React.useMemo(() => {
    if (receiptData) {
      const { payment: rp, landlord } = receiptData;
      const cbAmount = Number(cashback) || 0;
      return {
        amount: rp.amount.toLocaleString('en-IN'),
        cashbackApplied: cbAmount.toLocaleString('en-IN'),
        date: formatDisplayDate(rp.paidAt),
        method: rp.paymentMethod ?? method.toUpperCase(),
        landlordName: landlord.name,
        utr: rp.utr || 'Pending',
        payableRent: rp.amount.toLocaleString('en-IN'),
      };
    }

    const formatted = Number(amount) ? Number(amount).toLocaleString('en-IN') : amount;
    const cbAmount = Number(cashback) || 0;
    return {
      amount: formatted,
      cashbackApplied: cbAmount.toLocaleString('en-IN'),
      date: formatDisplayDate(new Date().toISOString()),
      method: method ? method.toUpperCase() : '\u2014',
      landlordName: params.landlordName || 'N/A',
      panCard: 'Pending',
      agreementId: 'Pending',
      transactionId: 'Pending',
      payableRent: formatted,
    };
  }, [receiptData, amount, cashback, method, params.landlordName]);

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
            showDivider={true}
            testID="contact-support-button"
          />
        );

      case 'timed_out':
        return (
          <>
            <PrimaryButton
              title="Check Back Later"
              onPress={handleGoHome}
              showDivider={true}
              testID="check-back-later-button"
            />
            <PrimaryButton
              title="Contact Support"
              onPress={handleContactSupport}
              showDivider={true}
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
              showDivider={true}
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
              showDivider={true}
              testID="contact-support-button"
            />
            <TouchableOpacity
              onPress={handleTryAgain}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.contactSupportText}>Try Again</Text>
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

  const isSuccessState = state.status === 'success';

  const backButton = (
    <BackButton
      style={StyleSheet.flatten([styles.backButton, { top: Math.max(sv(8), 111 - insets.top) }])}
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
      titleLine2Color={isSuccessState ? undefined : FIGMA_COLORS.titleWhite}
      contentPaddingTop={!isSuccessState ? sv(130) : undefined}
      titleMarginLeft={!isSuccessState ? s(10) : undefined}
    >
      {renderCardContent()}
    </PaymentReceiptCard>
  );

  const buttons = (
    <View style={[styles.buttonContainer, (state.status === 'failed' || state.status === 'refunded') && { gap: sv(24) }]}>
      {renderButtons()}
    </View>
  );

  let content: React.ReactNode;
  try {
    content = (
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          !isSuccessState && styles.nonSuccessScrollContent,
          // Extra bottom padding so scroll content doesn't hide behind the fixed button
          isSuccessState && { paddingBottom: sv(120) },
        ]}
        bounces={isSuccessState}
        showsVerticalScrollIndicator={false}
      >
        {backButton}
        {card}
      </ScrollView>
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
      {/* Figma: Button fixed at bottom of viewport (y=921), NOT inside ScrollView */}
      {buttons}
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
  scrollContainer: {
    flex: 1,
    paddingHorizontal: s(24),
  },
  nonSuccessScrollContent: {
    flexGrow: 1,
  },

  // -- Info section (pending/failed/refunded)
  // Figma: info container at x=1 within 270px card, but PaymentReceiptCard content has padding s(24).
  // Offset: -(24 - 1) = -23px each side so the info section spans the full card width.
  infoSection: {
    gap: sv(24),
    marginHorizontal: -s(23),
    alignItems: 'center' as const,
  },
  infoRow: {
    flexDirection: 'row',
    alignSelf: 'stretch' as const,
    gap: s(16),
    paddingHorizontal: s(32),
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

  // -- Receipt section (success)
  receiptDetails: {
    gap: sv(16),
    alignItems: 'center',
  },
  receiptRow: {
    width: FIGMA_CARD_INNER_WIDTH,
    minHeight: sv(20),
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
  positiveValueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: '#4CAF50', // green — cashback earned/accumulated
    textAlign: 'right' as const,
  },
  valueMaxWidth: {
    maxWidth: '55%',
    flexShrink: 1,
  },
  secondSection: {
    marginTop: sv(8),
    gap: sv(16),
  },
  // Figma 2095586455: Settlement info box — bg:#1a1a1a r:8 p:8/12
  settlementInfoBox: {
    marginTop: sv(16),
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
  },
  settlementInfoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: '#FF9A6D', // brand.500
    textAlign: 'center', // Figma: textAlign CENTER
  },

  // -- Button container — Figma: fixed at bottom of viewport (y=921 out of 1083)
  buttonContainer: {
    width: '100%',
    paddingHorizontal: s(24),
    gap: sv(16),
    alignItems: 'center',
    paddingBottom: sv(24),
    paddingTop: sv(16),
    backgroundColor: FIGMA_COLORS.background, // Solid bg so it covers receipt overflow
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
    left: s(40),
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
