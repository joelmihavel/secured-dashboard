/**
 * Payment Success Screen
 * Figma: 4685:152246 (Pay Rent / Payment Summary Page — Payment Successful)
 *
 * Flat scrollable layout (no card chrome). Header has back arrow on the left
 * and a gradient "Download receipt" pill on the right. Body shows the green
 * "PAID" stamp, the title, then two sections — Transaction Details and More
 * info — plus a settlement-info pill.
 */

import React, { useEffect, useCallback, useRef, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  BackHandler,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, BackButton } from '@/src/components';
import { GradientPill } from '@/src/components/agreement/GradientPill';
import { generateReceipt } from '@/src/services/api/payments';
import type { ReceiptData } from '@/src/services/api/payments';
import { useReceipt } from '@/src/hooks/usePayments';
import { buildReceiptHtml, buildFallbackReceiptData } from '@/src/utils/receiptHtml';
import { PAYMENT_COLORS, colors } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

interface SuccessParams {
  paymentId?: string;
  amount?: string;
  method?: string;
  cashback?: string;
  transactionId?: string;
  landlordName?: string;
  agreementId?: string;
  source?: 'post_payment' | 'receipt_view';
}

const STAMP_PAID = require('@/assets/images/status/stamps/stamp_paid.png');

const C = {
  bg: PAYMENT_COLORS.background,
  white: PAYMENT_COLORS.white,
  accent: PAYMENT_COLORS.accent,                   // #FF9A6D
  label: colors.neutral[600],                       // #878787
  value: colors.neutral[300],                       // #CBCBCB
  highlight: colors.neutral[200],                   // #DDDDDD
  divider: colors.black[400],                       // #4D4D4D
  errorLight: '#EF9194',                            // cashback deduct
  pillBg: colors.black[600],                        // #1A1A1A
} as const;

function formatDisplayDate(isoString: string): string {
  const date = new Date(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

const HashIcon = memo(() => (
  <Svg width={s(16)} height={s(16)} viewBox="0 0 11 12" fill="none">
    <Path
      d="M2.52285 7.33333L2.80313 4.66667L0 4.66667L0 3.33333L2.94327 3.33333L3.29362 0L4.63427 0L4.28393 3.33333L6.94327 3.33333L7.2936 0L8.63427 0L8.28393 3.33333L10.6667 3.33333L10.6667 4.66667L8.1438 4.66667L7.86353 7.33333L10.6667 7.33333L10.6667 8.66667L7.7234 8.66667L7.37307 12L6.0324 12L6.38273 8.66667L3.72339 8.66667L3.37305 12L2.03237 12L2.38271 8.66667L0 8.66667L0 7.33333L2.52285 7.33333ZM3.86353 7.33333L6.52287 7.33333L6.80313 4.66667L4.1438 4.66667L3.86353 7.33333Z"
      fill={C.label}
      fillRule="nonzero"
    />
  </Svg>
));
HashIcon.displayName = 'HashIcon';

interface ReceiptRowProps {
  label: string;
  value: string;
  variant?: 'default' | 'cashback' | 'highlight';
}

const ReceiptRow = memo(({ label, value, variant = 'default' }: ReceiptRowProps) => (
  <View style={styles.row}>
    <View style={styles.rowLabelGroup}>
      <HashIcon />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <Text
      style={[
        styles.rowValue,
        variant === 'cashback' && styles.rowValueCashback,
        variant === 'highlight' && styles.rowValueHighlight,
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
));
ReceiptRow.displayName = 'ReceiptRow';

/** UTR row — shows the settlement UTR once Cashfree has paid out, or a
 *  "Settlement Pending" badge while we're still waiting. */
const UtrRow = memo(({ utr }: { utr: string | null }) => {
  const isSettled = !!utr;
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelGroup}>
        <HashIcon />
        <Text style={styles.rowLabel}>UTR</Text>
      </View>
      <View style={[styles.utrBadge, isSettled ? styles.utrBadgeSettled : styles.utrBadgePending]}>
        <Text
          style={styles.utrBadgeText}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {isSettled ? utr : 'Settlement Pending'}
        </Text>
      </View>
    </View>
  );
});
UtrRow.displayName = 'UtrRow';

const Divider = () => <View style={styles.divider} />;

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams() as unknown as SuccessParams;
  const paymentId = params.paymentId ?? '';
  const amount = params.amount ?? '0';
  const method = params.method ?? '';
  const cashback = params.cashback ?? '0';
  const transactionId = params.transactionId ?? '';
  const isReceiptView = params.source === 'receipt_view';

  // Receipt is pre-warmed by the home dashboard (useReceipt prefetch in
  // app/(main)/index.tsx) so this read is typically a synchronous cache hit
  // — no fetch flash on screen mount. Falls back to route params when the
  // cache hasn't been warmed (e.g., deep link, cold start) — the route
  // params already carry amount/method/cashback for instant first paint
  // while the receipt fetch resolves in the background.
  const { data: receiptData = null } = useReceipt(paymentId);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (isReceiptView) {
        routerRef.current.back();
      } else {
        routerRef.current.replace('/(main)' as never);
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReceiptView]);

  const handleBack = useCallback(() => {
    if (isReceiptView) {
      routerRef.current.back();
    } else {
      routerRef.current.replace('/(main)' as never);
    }
  }, [isReceiptView]);

  const handleDownloadReceipt = useCallback(async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let receipt = receiptData;
      if (!receipt && paymentId) {
        try {
          const { data } = await generateReceipt(paymentId);
          receipt = data;
        } catch (err) {
          if (__DEV__) console.warn('Receipt fetch failed:', err);
        }
      }

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
          transactionId,
          landlordName: params.landlordName,
          agreementId: params.agreementId,
          paymentId,
        });
      }

      const html = buildReceiptHtml(htmlData);
      const { uri } = await Print.printToFileAsync({
        html,
        width: 390,
        height: 520,
        base64: false,
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Rent Receipt',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (__DEV__) console.warn('PDF generation failed:', err);
      Alert.alert('Receipt Unavailable', 'Unable to generate the receipt PDF. Please try again later.');
    } finally {
      setGeneratingPdf(false);
    }
  }, [generatingPdf, receiptData, paymentId, amount, method, transactionId, params.landlordName, params.agreementId]);

  const displayData = React.useMemo(() => {
    const formatRupees = (n: number) =>
      `₹  ${n.toLocaleString('en-IN')}`;

    if (receiptData) {
      const { payment: rp, landlord, agreement } = receiptData;
      const paid = rp.amount;
      const cb = rp.cashback_applied ?? (Number(cashback) || 0);
      // Server returns the explicit split. Fallback for old receipts that
      // pre-date this column: assume the whole cashback was the 1% line.
      const flat = rp.flat_bonus ?? 0;
      const onePct = rp.one_pct_cashback ?? Math.max(0, cb - flat);
      const net = Math.max(paid - cb, 0);
      return {
        amount: formatRupees(paid),
        flatBonus: flat > 0 ? `- ${formatRupees(flat)}` : null,
        cashbackApplied: onePct > 0 ? `- ${formatRupees(onePct)}` : null,
        cashbackTotalRupees: cb,
        date: formatDisplayDate(rp.paidAt),
        method: rp.paymentMethod ?? (method ? method.toUpperCase() : '—'),
        utr: rp.utr || null,
        netRentPaid: formatRupees(net),
        landlordName: landlord.name,
        panCard: landlord.panMasked || '—',
        agreementId: agreement?.certId ? `#${agreement.certId}` : (params.agreementId ? `#${params.agreementId}` : '—'),
      };
    }
    const paidNum = Number(amount) || 0;
    const cbNum = Number(cashback) || 0;
    const net = Math.max(paidNum - cbNum, 0);
    return {
      amount: formatRupees(paidNum),
      flatBonus: null as string | null,
      cashbackApplied: cbNum > 0 ? `- ${formatRupees(cbNum)}` : null,
      cashbackTotalRupees: cbNum,
      date: formatDisplayDate(new Date().toISOString()),
      method: method ? method.toUpperCase() : '—',
      utr: null as string | null,
      netRentPaid: formatRupees(net),
      landlordName: params.landlordName || '—',
      panCard: '—',
      agreementId: params.agreementId ? `#${params.agreementId}` : '—',
    };
  }, [receiptData, amount, cashback, method, params.landlordName, params.agreementId]);

  const headerTopOffset = Math.max(insets.top, sv(12));

  return (
    <Screen testID="success-screen" padded={false} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerTopOffset, paddingBottom: insets.bottom + sv(48) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back arrow + Download receipt pill */}
        <View style={styles.header}>
          <BackButton
            style={styles.backButton}
            onPress={handleBack}
            testID="back-button"
          />
          <GradientPill
            label="Download receipt"
            onPress={handleDownloadReceipt}
            loading={generatingPdf}
            style={styles.downloadPill}
            testID="download-receipt-button"
          />
        </View>

        {/* Stamp + title block */}
        <View style={styles.heroBlock}>
          <Image source={STAMP_PAID} style={styles.stamp} resizeMode="contain" />
          <Text style={styles.title}>
            Payment{'\n'}
            <Text inherit style={styles.titleAccent}>Successful</Text>
          </Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Transaction Details */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Transaction Details</Text>
            <Divider />
            <ReceiptRow label="Amount paid" value={displayData.amount} />
            {displayData.flatBonus !== null && (
              <ReceiptRow label="Bonus Cashback" value={displayData.flatBonus} variant="cashback" />
            )}
            {displayData.cashbackApplied !== null && (
              <ReceiptRow
                label={displayData.flatBonus !== null ? 'Cashback (1%)' : 'Cashback Applied'}
                value={displayData.cashbackApplied}
                variant="cashback"
              />
            )}
            <ReceiptRow label="Date" value={displayData.date} />
            <ReceiptRow label="Method" value={displayData.method} />
            <UtrRow utr={displayData.utr} />
            <Divider />
            <ReceiptRow label="Net Rent Paid" value={displayData.netRentPaid} variant="highlight" />
            <Divider />
          </View>

          {/* More info */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>More info</Text>
            <Divider />
            <ReceiptRow label="Landlord" value={displayData.landlordName} />
            <ReceiptRow label="PAN Card" value={displayData.panCard} />
            <ReceiptRow label="Agreement ID" value={displayData.agreementId} />
          </View>

          {/* Settlement info pill */}
          <View style={styles.settlementPill}>
            <Text style={styles.settlementPillText}>
              {'ℹ️ Settlement will be processed within 24 hrs'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const ROW_GAP = sv(23);
const SECTION_GAP = sv(32);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: C.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(24),
    minHeight: sv(48),
  },
  backButton: {
    width: s(32),
    height: s(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadPill: {
    minWidth: s(140),
  },

  // Hero (stamp + title)
  heroBlock: {
    paddingHorizontal: s(48),
    marginTop: sv(32),
    gap: sv(24),
    alignItems: 'flex-start',
  },
  stamp: {
    width: s(85),
    height: s(80),
  },
  title: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(28),
    lineHeight: sf(40),
    letterSpacing: -1,
    color: C.white,
  },
  titleAccent: {
    color: C.accent,
  },

  // Body
  body: {
    paddingHorizontal: s(48),
    marginTop: SECTION_GAP,
    gap: SECTION_GAP,
  },
  section: {
    gap: ROW_GAP,
  },
  sectionHeader: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(16),
    lineHeight: sf(24),
    color: C.white,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  rowLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: C.label,
  },
  rowValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: C.value,
    textAlign: 'right',
    maxWidth: '55%',
    flexShrink: 1,
  },
  rowValueCashback: {
    color: C.errorLight,
    fontSize: sf(14),
    lineHeight: sf(20),
  },
  rowValueHighlight: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: C.highlight,
    fontSize: sf(14),
    lineHeight: sf(20),
  },

  // UTR badge — solid color rectangle, rounded corners. Red while settlement
  // is pending, green once the UTR lands. Caps width at 55% (same as
  // rowValue) so a long UTR truncates from the middle instead of pushing
  // the row off-screen.
  utrBadge: {
    paddingVertical: sv(4),
    paddingHorizontal: s(10),
    borderRadius: 6,
    maxWidth: '55%',
  },
  utrBadgePending: {
    backgroundColor: colors.error.radix, // #E5484D
  },
  utrBadgeSettled: {
    backgroundColor: colors.success.approved, // #06C270
  },
  utrBadgeText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: sf(11),
    lineHeight: sf(16),
    color: C.white,
  },

  // Divider — solid hairline matching Figma
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
  },

  // Settlement info
  settlementPill: {
    backgroundColor: C.pillBg,
    borderRadius: 8,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: C.accent,
    textAlign: 'center',
  },
});
