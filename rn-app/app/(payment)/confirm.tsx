/**
 * Confirm Payment Screen
 * Figma Reference: 799:3380
 *
 * Shows rent breakdown with cashback info before payment initiation.
 *
 * Figma Pixel-Perfect Values:
 * - Screen: bg #131313
 * - Top section: px 40, gap 24
 * - Info card (799:3384): 313x174, bg #202020, r=12, p=24/16, gap=32
 *   - "Rent due in X days": 12px Regular #878787, letterSpacing -0.24
 *   - "You'll earn X% cashback...": 14px Medium #CBCBCB, letterSpacing -0.56
 *   - Pill (799:3389): bg #1A1A1A, r=200, p=8/12
 *     - "Get ₹X cashback after payment": 12/20 Regular #FF9A6D
 *   - Divider bar: 268x5, #1A1A1A
 * - Receipt (799:3399): 270 wide, bg #202020
 *   - Section 1 (799:3401): px=24, gap=16
 *     - Labels: 12/20 Regular #878787 | Values: 14/20 Regular #CBCBCB
 *   - Section 2 (799:3415): px=24, gap=24
 *     - Cashback value: #EF9194
 *     - Payable Amount: 14/20 SemiBold #DDDDDD
 *   - Side notches: 14x14 ellipse #131313 at y=256
 * - Button (799:3447): PrimaryButton with showDivider
 * - Footer (799:3448): 12/20 Regular #A9A9A9
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Text as RNText,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Line } from 'react-native-svg';
import { BgLine } from '@/src/components/ui/BgLine';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PrimaryButton, BackButton, Pill } from '@/src/components';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';
import { useDashboard, useFeeRates, useSavedPaymentMethods } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import { getGatewayFeeRates, initiatePayment, computeFee } from '@/src/services/payment';
import type { FeeRateConfig, GatewayFeeRates } from '@/src/services/payment';
import { sanitizeErrorForUI } from '@/src/services/api/payments';
import type { ModalView } from '@/src/components/payment/PaymentMethodModal/types';
import type { PaymentMethodType, PayUSessionParams } from '@/src/stores/payment';
import type { SavedPaymentMethod } from '@/src/services/api/payments';

const fmt = (n: number) => n.toLocaleString('en-IN');

const ZERO_FEE: FeeRateConfig = { rate: 0, fee_type: 'percentage' };

/** Map store method type → GatewayFeeRates key, returning the full FeeRateConfig */
function getFeeConfig(
  rates: GatewayFeeRates,
  methodType: PaymentMethodType | undefined,
): FeeRateConfig {
  if (!methodType) return ZERO_FEE;
  const map: Record<PaymentMethodType, FeeRateConfig> = {
    upi: rates.upi,
    card: rates.credit_card,
    debit_card: rates.debit_card,
    netbanking: rates.netbanking,
  };
  return map[methodType] ?? ZERO_FEE;
}

// ── Icons ────────────────────────────────────────────────────────────────────

const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M6 2L4 14M12 2L10 14M2 6H14M2 10H14"
      stroke="#878787"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Two parallel top-right→bottom-left diagonals — Figma 799:3393/3394 & 799:3396/3397 */
const Crosshatch = ({ x, y }: { x: number; y: number }) => (
  <Svg
    width={20.5}
    height={35}
    viewBox="0 0 20.5 35"
    fill="none"
    style={{ position: 'absolute', left: x, top: y }}
  >
    <Line x1={20.5} y1={0} x2={0} y2={20.5} stroke="#4D4D4D" strokeWidth={0.5} />
    <Line x1={20.5} y1={14.5} x2={0} y2={35} stroke="#4D4D4D" strokeWidth={0.5} />
  </Svg>
);

/** Decorative bg_line behind receipt — Figma 768:303932 (Vector 45) */

// ── Breakdown Row ────────────────────────────────────────────────────────────

function BreakdownRow({
  label,
  value,
  isTotal = false,
  isCashback = false,
  isAccrued = false,
}: {
  label: string;
  value: string;
  isTotal?: boolean;
  isCashback?: boolean;
  isAccrued?: boolean;
}) {
  return (
    <View style={s.breakdownRow}>
      <View style={s.breakdownLabelGroup}>
        <HashIcon />
        <RNText style={s.breakdownLabel}>{label}</RNText>
      </View>
      <RNText
        style={[
          s.breakdownValue,
          isTotal && s.breakdownValueTotal,
          isCashback && s.breakdownValueCashback,
          isAccrued && s.breakdownValueAccrued,
        ]}
      >
        {value}
      </RNText>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const { modalView: modalViewParam } = useLocalSearchParams<{ modalView?: string }>();
  const insets = useSafeAreaInsets();
  const { tenancy, upcomingPayment, cashback } = useDashboard();
  const { data: feeRates } = useFeeRates();
  const selectedInstrument = usePaymentStore((s) => s.selectedInstrument);
  const { executePayment } = usePaymentFlow();
  const { data: savedMethods } = useSavedPaymentMethods();

  const validModalViews: ModalView[] = ['enter-amount', 'selector', 'add-upi', 'add-card', 'add-debit-card', 'add-netbanking', 'edit-method'];
  const parsedModalView = validModalViews.includes(modalViewParam as ModalView) ? (modalViewParam as ModalView) : undefined;

  const [methodModalVisible, setMethodModalVisible] = useState(!!parsedModalView);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIdLocal, setPaymentIdLocal] = useState('');
  const [modalInitialView, setModalInitialView] = useState<ModalView>(parsedModalView ?? 'selector');
  const [countdown, setCountdown] = useState('');

  // Countdown to cashback cutoff date (midnight IST on the cutoff day)
  const cutoffDay = upcomingPayment?.cutoff_day ?? tenancy?.cashback_cutoff_day ?? 7;
  useEffect(() => {
    const getCutoffDate = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      // Cutoff is midnight on cutoff_day of the current month
      const cutoff = new Date(year, month, cutoffDay, 23, 59, 59);
      // If cutoff has passed this month, show 00:00:00
      if (now > cutoff) return null;
      return cutoff;
    };

    const tick = () => {
      const cutoff = getCutoffDate();
      if (!cutoff) {
        setCountdown('00:00:00');
        return;
      }
      const diff = cutoff.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('00:00:00');
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const sec = totalSec % 60;
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cutoffDay]);

  // ── Payment Data ───────────────────────────────────────────────────────────

  const isVerified = cashback?.verification_complete ?? false;

  const baseRent = tenancy?.monthly_rent || 30000;
  const maintenance = tenancy?.maintenance ?? 0;
  const totalRent = baseRent + maintenance;

  const rates = feeRates ?? getGatewayFeeRates();
  const feeConfig = getFeeConfig(rates, selectedInstrument?.type);
  const convenienceFee = computeFee(feeConfig, totalRent);

  const cashbackPct = cashback?.discount_rate ?? 0.01;
  const cashbackAmount = Math.round(totalRent * cashbackPct);

  const appliedCashback = isVerified ? cashbackAmount : 0;
  const payableAmount = totalRent + convenienceFee - appliedCashback;

  // Days until due
  const daysUntilDue = upcomingPayment?.due_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(upcomingPayment.due_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 28;

  const enteredAmount = usePaymentStore.getState().enteredAmount;
  const paymentAmountForAccrual = enteredAmount || baseRent;
  const cashbackAccrualAmount = Math.round(paymentAmountForAccrual * 0.01);
  const annualSavings = Math.round((tenancy?.monthly_rent || 30000) * 0.01 * 12);

  // ── Modal data ──────────────────────────────────────────────────────────────

  const tenancyId = tenancy?.id ?? '';
  const rentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  // ── Pre-fetch PayU session on mount for instant Pay tap ────────────────────

  const prefetchedSessionRef = useRef<{
    paymentId: string;
    payuParams?: PayUSessionParams;
    methodType: string;
    demoMode?: boolean;
  } | null>(null);
  const prefetchInFlightRef = useRef(false);

  /** Build PayUSessionParams from raw edge function response */
  const buildSessionParams = useCallback((p: Record<string, string>): PayUSessionParams => ({
    key: p.key,
    txnid: p.txnid,
    amount: p.amount,
    productinfo: p.productinfo,
    firstname: p.firstname,
    email: p.email,
    phone: p.phone,
    surl: p.surl,
    furl: p.furl,
    hash: p.hash,
    vas_hash: p.vas_for_mobile_sdk_hash,
    prd_hash: p.payment_related_details_for_mobile_sdk_hash,
    user_credential: p.user_credential ?? `${p.key}:${p.email}`,
    udf1: p.udf1,
    udf2: p.udf2,
    udf3: p.udf3,
    udf4: p.udf4,
    udf5: p.udf5,
    enforce_paymethod: p.enforce_paymethod,
    environment: (p.environment as '0' | '1') ?? undefined,
  }), []);

  // Pre-fetch when confirm screen mounts (if instrument is already selected)
  useEffect(() => {
    const instrument = usePaymentStore.getState().selectedInstrument;
    if (!instrument || !tenancyId || prefetchInFlightRef.current) return;

    prefetchInFlightRef.current = true;
    const methodType = instrument.type;
    const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';

    initiatePayment({
      tenancyId,
      paymentMethod: methodType,
      cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
      rentMonth,
    }).then(({ data, error }) => {
      if (!error && (data?.payuParams || data?.demoMode)) {
        prefetchedSessionRef.current = {
          paymentId: data.paymentId,
          payuParams: data.payuParams ? buildSessionParams(data.payuParams as Record<string, string>) : undefined,
          methodType,
          demoMode: data.demoMode,
        };
      }
    }).catch(() => {
      // Pre-fetch failed silently — will retry on button tap
    }).finally(() => {
      prefetchInFlightRef.current = false;
    });
  }, [tenancyId, rentMonth, buildSessionParams]);

  // ── Pay Now Handler ──────────────────────────────────────────────────────────

  const handlePayNow = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (!tenancyId) {
      Alert.alert('Error', 'Payment details are still loading. Please wait a moment.');
      setIsProcessing(false);
      return;
    }

    const instrument = usePaymentStore.getState().selectedInstrument;
    if (!instrument) {
      setModalInitialView('selector');
      setMethodModalVisible(true);
      setIsProcessing(false);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const methodType = instrument.type;
    const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';

    try {
      let paymentId: string;
      let payuParams: PayUSessionParams;

      // Use pre-fetched session if available and method hasn't changed
      const prefetched = prefetchedSessionRef.current;
      if (prefetched && prefetched.methodType === methodType) {
        if (prefetched.demoMode) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: '/(payment)/status',
            params: {
              paymentId: prefetched.paymentId,
              amount: String(payableAmount),
              method: methodType === 'debit_card' ? 'card' : methodType,
              initialStatus: 'success',
            },
          } as never);
          return;
        }
        paymentId = prefetched.paymentId;
        payuParams = prefetched.payuParams!;
        prefetchedSessionRef.current = null; // consume it
      } else {
        // Fallback: fetch now (if pre-fetch failed or method changed)
        const { data, error } = await initiatePayment({
          tenancyId,
          paymentMethod: methodType,
          cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
          rentMonth,
        });

        if (error || !data) {
          throw new Error(error ?? 'Failed to initiate payment');
        }

        // Demo mode: skip PayU SDK entirely
        if (data.demoMode) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace({
            pathname: '/(payment)/status',
            params: {
              paymentId: data.paymentId,
              amount: String(payableAmount),
              method: methodType === 'debit_card' ? 'card' : methodType,
              initialStatus: 'success',
            },
          } as never);
          return;
        }

        paymentId = data.paymentId;
        payuParams = buildSessionParams(data.payuParams as Record<string, string>);
      }

      // Batch all store updates into a single sync block — avoids 5 separate re-renders
      const store = usePaymentStore.getState();
      store.setConfirming();
      store.setPayuSessionParams(payuParams);
      store.setProcessing(paymentId);
      store.setLastPayment(paymentId);

      // Check for saved method details — execute directly for UPI/Netbanking
      const saved = savedMethods?.find((m: SavedPaymentMethod) => {
        if (methodType === 'upi') return m.type === 'upi';
        if (methodType === 'netbanking') return m.type === 'netbanking';
        return false; // Cards always need CVV → go through modal
      });

      // Saved UPI → execute directly with saved VPA
      if (saved?.vpa && methodType === 'upi') {
        const outcome = await executePayment('upi', { vpa: saved.vpa }, paymentId, () => {});
        if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
          setIsProcessing(false);
        }
        return;
      }

      // Saved Netbanking → execute directly with saved bank code
      if (saved?.bank_code && methodType === 'netbanking') {
        const outcome = await executePayment('NB', { bankcode: saved.bank_code }, paymentId, () => {});
        if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
          setIsProcessing(false);
        }
        return;
      }

      // Card or no saved details → open modal at add-method view
      setPaymentIdLocal(paymentId);
      const viewMap: Record<string, ModalView> = {
        upi: 'add-upi',
        card: 'add-card',
        debit_card: 'add-debit-card',
        netbanking: 'add-netbanking',
      };
      setModalInitialView(viewMap[methodType] ?? 'selector');
      setMethodModalVisible(true);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'An error occurred';
      Alert.alert('Payment Error', sanitizeErrorForUI(rawMsg));
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, tenancyId, rentMonth, buildSessionParams, router, payableAmount, savedMethods, executePayment]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      testID="confirm-payment-screen"
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Top Section: Back + Info Card ─────────────────────────────── */}
        <View style={s.topSection}>
          <BackButton
            style={s.backButton}
            onPress={() => router.back()}
          />

          {/* Info Card — Figma 799:3384 */}
          <View style={s.infoCard}>
            <View style={s.infoTextArea}>
              <RNText style={s.rentDueText}>
                Rent due in {daysUntilDue} days
              </RNText>
              <RNText style={s.cashbackInfoText}>
                You'll earn 1% cashback on this rent payment
              </RNText>
              <Pill
                text={`Get ₹${fmt(cashbackAmount)} cashback after payment`}
                variant="default"
                backgroundColor="#1A1A1A"
                style={s.cashbackPill}
              />
            </View>

            {/* Divider bar — Figma 799:3391 */}
            <View style={s.dividerBar} />

            {/* Decorative crosshatches */}
            <Crosshatch x={16.25} y={17} />
            <Crosshatch x={277.25} y={87} />
          </View>
        </View>

        {/* ── Receipt Area with decorative grid lines ──────────────────── */}
        <View style={s.receiptContainer}>
          {/* bg_line — decorative grid behind receipt (768:303932) */}
          <BgLine style={s.gridLines} />

          <View style={s.receiptCard}>
            {/* Section 1: Base rent + Maintenance — Figma 799:3401 */}
            <View style={s.section1}>
              <BreakdownRow label="Base rent" value={`₹ ${fmt(baseRent)}`} />
              {maintenance > 0 && (
                <>
                  <View style={s.dividerLine} />
                  <BreakdownRow
                    label="Maintenance"
                    value={`₹ ${fmt(maintenance)}`}
                  />
                </>
              )}
            </View>

            {/* Section 2: Totals — Figma 799:3415 */}
            <View style={s.section2}>
              <View style={s.dividerLine} />
              <BreakdownRow
                label="Total Rent"
                value={`₹ ${fmt(totalRent)}`}
              />
              <BreakdownRow
                label="Convenience Fee"
                value={convenienceFee === 0 ? 'Free' : `₹ ${fmt(convenienceFee)}`}
              />
              {isVerified ? (
                <BreakdownRow
                  label="Cashback"
                  value={`- ₹ ${fmt(cashbackAmount)}`}
                  isCashback={true}
                />
              ) : cashbackAmount > 0 ? (
                <BreakdownRow
                  label="Cashback"
                  value={`Verify to unlock ₹${fmt(cashbackAmount)}`}
                  isAccrued={true}
                />
              ) : null}
              <View style={s.dividerLine} />
              <BreakdownRow
                label="Payable Amount"
                value={`₹ ${fmt(payableAmount)}`}
                isTotal
              />

              {/* Credit card fee disclosure pill — inside Section 2 now */}
              {usePaymentStore.getState().selectedInstrument?.type === 'card' && (
                <View style={s.feePill}>
                  <RNText style={s.feePillText}>Additional bank fees upto 1% might apply</RNText>
                </View>
              )}
            </View>

            {/* Side notches — Figma 799:3444, 799:3445 */}
            <View style={[s.sideNotch, s.sideNotchLeft]} />
            <View style={[s.sideNotch, s.sideNotchRight]} />
          </View>
        </View>

        

        {/* Flex spacer — pushes button to bottom on tall screens */}
        <View style={s.spacer} />

        {/* ── Button Section — Figma 799:3446 ───────────────────────────── */}
        <View style={s.buttonSection}>
          <PrimaryButton
            title={`Pay ₹ ${fmt(payableAmount)} now`}
            onPress={handlePayNow}
            loading={isProcessing}
            disabled={isProcessing}
            showDivider
          />
          
        </View>
      </ScrollView>

      {/* Payment Method Modal — instrument entry for selected method */}
      <PaymentMethodModal
        visible={methodModalVisible}
        onClose={() => {
          usePaymentStore.getState().clearPayuSessionParams();
          setMethodModalVisible(false);
        }}
        tenancyId={tenancyId}
        rentMonth={rentMonth}
        initialView={modalInitialView}
        initialPaymentId={paymentIdLocal}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#131313',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },

  // ── Top Section — Figma 799:3382: px=40, gap=24 ──────────────────────────
  topSection: {
    paddingHorizontal: 40,
    paddingTop: 24, // Figma 799:3451 status bar paddingBottom
    gap: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },

  // ── Info Card — Figma 799:3384 ────────────────────────────────────────────
  infoCard: {
    width: 313,
    backgroundColor: '#202020',
    borderRadius: 12,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 32,
    overflow: 'hidden',
    alignItems: 'center',
  },
  infoTextArea: {
    gap: 8,
    alignItems: 'center',
  },
  // Figma 799:3387: 12px Regular #878787, letterSpacing -0.24, center
  rentDueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: '#878787',
    textAlign: 'center',
  },
  // Figma 799:3388: 14px Medium #CBCBCB, letterSpacing -0.56, center
  cashbackInfoText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: '#CBCBCB',
    textAlign: 'center',
  },
  // Figma 799:3389: pill positioned within info card
  cashbackPill: {
    alignSelf: 'center',
  },
  // Figma 799:3391: 268x5, #1A1A1A
  dividerBar: {
    width: 268,
    height: 5,
    backgroundColor: '#1A1A1A',
    alignSelf: 'center',
  },

  // ── Receipt Area — receipt card + Vector 45 grid lines ────────────────────
  receiptContainer: {
    alignItems: 'center',
    marginTop: -24, // Overlap under info card (Figma: 24px overlap)
  },
  // Figma 799:3398 — decorative grid lines behind receipt
  gridLines: {
    position: 'absolute' as const,
    top: 64, // Vector 45 starts 64px below receipt top
    left: 12, // 12px from screen left edge
  },
  receiptCard: {
    width: 270,
    backgroundColor: '#202020',
    overflow: 'hidden',
    paddingTop: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 5,
  },

  // Section 1 — Figma 799:3401: px=24, gap=16
  section1: {
    paddingHorizontal: 24,
    gap: 16,
  },

  // Section 2 — Figma 799:3415: px=24, gap=24
  section2: {
    paddingHorizontal: 24,
    gap: 24,
    marginTop: 18, // Figma gap between section 1 and section 2
    paddingBottom: 24,
  },

  // ── Breakdown Row ─────────────────────────────────────────────────────────
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 20,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Figma: 12/20 Regular #878787
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#878787',
  },
  // Figma: 14/20 Regular #CBCBCB
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#CBCBCB',
  },
  // Figma 799:3441: 14/20 SemiBold #DDDDDD
  breakdownValueTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#DDDDDD',
  },
  // Figma 799:3434: #EF9194
  breakdownValueCashback: {
    color: '#EF9194',
  },
  // Brand orange for unverified cashback accrual
  breakdownValueAccrued: {
    color: '#FF9A6D',
  },

  // Divider line — Figma vectors 799:3408, 799:3416, 799:3435
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#4D4D4D',
  },

  // Side notches — Figma 799:3444, 799:3445: 14x14, #131313
  sideNotch: {
    position: 'absolute',
    top: 256, // Figma: notches at y=256 from receipt top
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#131313',
  },
  sideNotchLeft: {
    left: -7,
  },
  sideNotchRight: {
    right: -7,
  },

  // Credit card fee disclosure pill — Figma 799:3389 style
  feePill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  feePillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#DDDDDD',
  },

  // Flex spacer — fills remaining space to push button to bottom
  spacer: {
    flex: 1,
    minHeight: 32,
  },

  // ── Button Section — Figma 799:3446: gap=24 ──────────────────────────────
  buttonSection: {
    paddingHorizontal: 40,
    gap: 24,
    alignItems: 'center',
  },
  // Figma 799:3448: 12/20 Regular #A9A9A9
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9',
    textAlign: 'center',
  },
});
