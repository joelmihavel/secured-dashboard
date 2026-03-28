/**
 * Payment Success Screen
 *
 * Displays receipt card with transaction details after successful payment.
 * Separate from status.tsx which handles pending/failed/refunded states.
 *
 * Figma References:
 * - 41-9388 / 41-9563 (Success with/without cashback)
 * - 4134-6008 (Settlement info banner)
 *
 * Features:
 * - Receipt data fetching from server
 * - PDF generation via expo-print + expo-sharing
 * - Cache invalidation on mount
 * - Back guard navigates home (clears payment stack)
 */

import React, { useEffect, useCallback, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton, BackButton } from '@/src/components';
import { PaymentReceiptCard } from '@/src/components/payment/PaymentReceiptCard';
import { DashedDivider } from '@/src/components/payment';
import { generateReceipt } from '@/src/services/api/payments';
import type { ReceiptData } from '@/src/services/api/payments';
import { buildReceiptHtml, buildFallbackReceiptData } from '@/src/utils/receiptHtml';
import { PAYMENT_COLORS } from '@/src/theme';
import { s, sf, sv } from '@/src/theme/scale';

// ============================================
// TYPES
// ============================================

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

// ============================================
// FIGMA TOKENS
// ============================================

const FIGMA_CARD_INNER_WIDTH = s(222);

const FIGMA_COLORS = {
  background: PAYMENT_COLORS.background,
  titleAccent: PAYMENT_COLORS.accent,
  successStamp: PAYMENT_COLORS.successStamp,
  labelText: PAYMENT_COLORS.labelText,
  valueText: PAYMENT_COLORS.valueText,
  payableValue: PAYMENT_COLORS.highlightText,
  dividerColor: PAYMENT_COLORS.divider,
  infoText: PAYMENT_COLORS.mutedText,
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
// SUB-COMPONENTS
// ============================================

const ReceiptIcon = memo(() => (
  <View style={styles.hashIcon}>
    <Svg width={11} height={12} viewBox="0 0 11 12" fill="none">
      <Path
        d="M2.52285 7.33333L2.80313 4.66667L0 4.66667L0 3.33333L2.94327 3.33333L3.29362 0L4.63427 0L4.28393 3.33333L6.94327 3.33333L7.2936 0L8.63427 0L8.28393 3.33333L10.6667 3.33333L10.6667 4.66667L8.1438 4.66667L7.86353 7.33333L10.6667 7.33333L10.6667 8.66667L7.7234 8.66667L7.37307 12L6.0324 12L6.38273 8.66667L3.72339 8.66667L3.37305 12L2.03237 12L2.38271 8.66667L0 8.66667L0 7.33333L2.52285 7.33333ZM3.86353 7.33333L6.52287 7.33333L6.80313 4.66667L4.1438 4.66667L3.86353 7.33333Z"
        fill={FIGMA_COLORS.labelText}
        fillRule="nonzero"
      />
    </Svg>
  </View>
));
ReceiptIcon.displayName = 'ReceiptIcon';

interface ReceiptRowProps {
  label: string;
  value: string;
  isCashback?: boolean;
}

const ReceiptRow = memo(({ label, value, isCashback }: ReceiptRowProps) => (
  <View style={styles.receiptRow}>
    <View style={styles.labelContainer}>
      <ReceiptIcon />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <Text
      style={[
        isCashback ? styles.cashbackValueText : styles.valueText,
        styles.valueMaxWidth,
      ]}
    >
      {value}
    </Text>
  </View>
));
ReceiptRow.displayName = 'ReceiptRow';

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams() as unknown as SuccessParams;
  const paymentId = params.paymentId ?? '';
  const amount = params.amount ?? '0';
  const method = params.method ?? '';
  const cashback = params.cashback ?? '0';
  const transactionId = params.transactionId ?? '';
  const isReceiptView = params.source === 'receipt_view';

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Haptic on mount
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Fetch receipt data
  useEffect(() => {
    if (!paymentId || receiptData) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await generateReceipt(paymentId);
        if (!cancelled && data) setReceiptData(data);
      } catch { /* fallback to route params */ }
    })();
    return () => { cancelled = true; };
  }, [paymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back guard
  useEffect(() => {
    const onBackPress = () => {
      if (isReceiptView) {
        router.back();
      } else {
        router.replace('/(main)' as never);
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isReceiptView, router]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleBack = useCallback(() => {
    if (isReceiptView) {
      router.back();
    } else {
      router.replace('/(main)' as never);
    }
  }, [isReceiptView, router]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  const handleDownloadReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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

    try {
      const html = buildReceiptHtml(htmlData);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Rent Receipt',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      if (__DEV__) console.warn('PDF generation failed:', err);
      Alert.alert('Receipt Unavailable', 'Unable to generate the receipt PDF. Please try again later.');
    }
  }, [receiptData, paymentId, amount, method, transactionId, params.landlordName, params.agreementId]);

  // ============================================
  // DISPLAY DATA
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
        transactionId: rp.transactionId || transactionId,
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
      transactionId: transactionId || 'Pending',
    };
  }, [receiptData, amount, cashback, method, transactionId, params.landlordName]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <Screen testID="success-screen" padded={false} style={styles.screen}>
      <View style={styles.container}>
        <BackButton
          style={StyleSheet.flatten([styles.backButton, { top: sv(16) }])}
          onPress={handleBack}
          testID="back-button"
        />
        <PaymentReceiptCard
          stampText="paid"
          stampColor={FIGMA_COLORS.successStamp}
          stampImage={require('@/assets/images/status/stamps/stamp_paid.png')}
          titleLine1="Payment"
          titleLine2="Successful"
          titleLine2Color={FIGMA_COLORS.titleAccent}
          titleMarginBottom={sv(32)}
        >
          <View style={styles.receiptDetails}>
            <ReceiptRow label="Rent paid" value={`\u20B9  ${displayData.amount}`} />
            <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
            <ReceiptRow label="Cashback Applied" value={`- \u20B9  ${displayData.cashbackApplied}`} isCashback />
            <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
            <ReceiptRow label="Date" value={displayData.date} />
            <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
            <ReceiptRow label="Method" value={displayData.method} />
            <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
            <ReceiptRow label="Landlord" value={displayData.landlordName} />
            <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />
            <ReceiptRow label="UTR" value={displayData.transactionId} />
            <View style={styles.settlementInfoBox}>
              <Text style={styles.settlementInfoText}>
                {'\u2139\uFE0F Settlement will be processed within 24 hrs'}
              </Text>
            </View>
          </View>
        </PaymentReceiptCard>

        <View style={styles.spacer} />

        <View style={styles.buttonContainer}>
          <PrimaryButton
            title="Download receipt"
            onPress={handleDownloadReceipt}
            showDivider={true}
            testID="download-receipt-button"
          />
          <TouchableOpacity
            onPress={handleContactSupport}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.contactSupportText}>Contact support</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  screen: {
    backgroundColor: PAYMENT_COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: s(24),
    paddingBottom: sv(24),
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
  cashbackValueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(14),
    lineHeight: sf(20),
    color: PAYMENT_COLORS.cashbackDeduct,
    textAlign: 'right' as const,
  },
  valueMaxWidth: {
    maxWidth: '55%',
    flexShrink: 1,
  },
  divider: {
    width: FIGMA_CARD_INNER_WIDTH,
    marginVertical: 0,
  },
  settlementInfoBox: {
    marginTop: sv(7), // Figma: 23px group gap = parent gap(16) + this(7)
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: sv(8),
    paddingHorizontal: s(12),
  },
  settlementInfoText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: sf(12),
    lineHeight: sf(20),
    color: '#FF9A6D',
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
    minHeight: sv(33),
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
    color: PAYMENT_COLORS.mutedText,
    textAlign: 'center' as const,
  },
});
