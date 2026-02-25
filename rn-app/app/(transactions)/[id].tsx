/**
 * Transaction Detail / Receipt Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-9563 (Payment Successful --no cashback)
 *
 * Layout Structure (from Figma node tree):
 *   Root Frame (852x393, #131313)
 *     - Status bar (Frame 2095586357, fixed, y:0, h:77, bg:#131313)
 *     - Body (Frame 2095586343, y:111, column, gap:40, paddingBottom:48)
 *       - Top section (Frame 2095586345, paddingHorizontal:40)
 *         - Back arrow (32x32)
 *     - Receipt card (Frame 2095586361, x:61, y:183, width:270, height:481)
 *       - Receipt body (Frame 1686557240, bg:#202020, radius:12, padding:24/16, gap:32)
 *         - Header area (Frame 2095586360, gap:16, items:center)
 *           - Paperclip decoration (Group 58, absolute)
 *           - "Payment\nSuccesful" (20px Regular, #FFFFFF / #FF9A6D span)
 *           - PAID stamp (Group 58, absolute)
 *         - Divider bar (268x5, bg:#1A1A1A)
 *         - Arrow icon
 *       - Table rows (each: hash icon 16x16 + label 12px #878787 | value 12px #CBCBCB)
 *         - Amount paid / Rs 32,500
 *         - Date / 4 Nov 2026
 *         - Method / UPI (joel@oksbi)
 *         - Transaction ID / SEC12345678
 *       - Cashback note "Pay by the 7th..." (12px #DDDDDD, center)
 *       - Divider (Vector, stroke #4D4D4D)
 *       - Circle cutouts (Ellipse, 14x14)
 *       - Payable Rent row (label 12px #878787 | value 14px SemiBold #DDDDDD)
 *     - Footer (Frame 2095586363, x:40, y:688, column, gap:16)
 *       - PrimaryButton "Download Receipt" (14px Medium #FFFFFF)
 *       - "Contact Support" (12px Regular #A9A9A9, center)
 *
 * Key Figma Typography Specs:
 * - "Payment Succesful": 20px/32 Regular, "Payment"=#FFFFFF, "Succesful"=#FF9A6D
 * - Receipt labels: 12px/20 Regular #878787
 * - Receipt values: 12px/20 Regular #CBCBCB
 * - Hash symbol (#): 12px/20 Regular #FF9A6D (same component as pay rent screen)
 * - Cashback note: 12px/20 Regular #DDDDDD
 * - Payable Rent value: 14px/20 SemiBold #DDDDDD
 * - Download Receipt: 14px/20 Medium #FFFFFF
 * - Contact Support: 12px/20 Regular #A9A9A9
 * - PAID stamp text: ~13.5px ExtraBold #06C270, uppercase
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { usePaymentHistory } from '@/src/hooks/usePayments';
import { generateReceipt, ReceiptData } from '@/src/services/api/payments';
import { buildReceiptHtml } from '@/src/utils/receiptHtml';
import { colors } from '@/src/theme';

// ===========================================
// FIGMA EXTRACTED DESIGN TOKENS (41-9563)
// ===========================================
const FIGMA_COLORS = {
  background: colors.black[700],          // black.700
  cardBody: colors.black[500],            // black.500 - receipt card body
  dividerBar: colors.black[600],          // black.600 - horizontal bar
  textPrimary: colors.white,         // white
  successfulText: colors.brand[500],      // brand.500 - "Succesful" span
  hashSymbol: colors.brand[500],          // brand.500 - # icon
  labelText: colors.neutral[600],           // neutral.600 - receipt row labels
  valueText: colors.neutral[300],           // neutral.300 - receipt row values
  cashbackNote: colors.neutral[200],        // neutral.200 - cashback note text
  payableValue: colors.neutral[200],        // neutral.200 - payable rent value
  tableDivider: colors.black[400],        // black.400 - table line separators
  circleCutout: colors.black[700],        // same as background
  paperclip: colors.black[400],           // black.400 - paperclip strokes
  stampBorder: colors.success.dark,          // success.dark - PAID stamp circles
  stampText: colors.success.approved,            // success.approved - PAID stamp text & stars
  footerText: colors.neutral[500],          // neutral.500 - "Contact Support"
} as const;

const FIGMA_SPACING = {
  topPaddingH: 40,                // top section paddingHorizontal
  bodyGap: 40,                    // main body column gap
  cardPaddingV: 24,               // card vertical padding
  cardPaddingH: 16,               // card horizontal padding
  cardInnerGap: 32,               // gap between card sections
  tableRowPaddingH: 24,           // table row horizontal inset
  footerPaddingH: 40,             // footer paddingHorizontal
  footerGap: 16,                  // footer column gap
  breakdownCardWidth: 270,        // receipt card width
} as const;

// ===========================================
// SVG ICON COMPONENTS
// ===========================================

const BackArrowIcon = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M25.3333 16H6.66667"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.66667 16L14.6667 24"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.66667 16L14.6667 8"
      stroke={FIGMA_COLORS.textPrimary}
      strokeWidth={2.667}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Hash icon matching Figma (16x16, brand.500 fill) */
const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M5.52285 9.33333L5.80313 6.66667L3 6.66667V5.33333L5.94327 5.33333L6.29362 2H7.63427L7.28393 5.33333L9.94327 5.33333L10.2936 2H11.6343L11.2839 5.33333L13.6667 5.33333V6.66667L11.1438 6.66667L10.8635 9.33333H13.6667V10.6667L10.7234 10.6667L10.3731 14H9.0324L9.38273 10.6667L6.72339 10.6667L6.37305 14H5.03237L5.38271 10.6667H3V9.33333H5.52285ZM6.86353 9.33333L9.52287 9.33333L9.80313 6.66667L7.1438 6.66667L6.86353 9.33333Z"
      fill={FIGMA_COLORS.hashSymbol}
    />
  </Svg>
);

/** Paperclip SVG matching Figma Group 58 */
const PaperclipIcon = () => (
  <Svg width={21} height={35} viewBox="0 0 21 35" fill="none">
    <Path
      d="M10.25 0C4.5 0 0 4.5 0 10.25V26.75C0 32.5 4.5 35 10.25 35"
      stroke={FIGMA_COLORS.paperclip}
      strokeWidth={1.5}
      fill="none"
    />
    <Path
      d="M10.25 5C7.5 5 5 7.5 5 10.25V26.75C5 29.5 7.5 32 10.25 32"
      stroke={FIGMA_COLORS.paperclip}
      strokeWidth={1.5}
      fill="none"
    />
  </Svg>
);

/** PAID stamp matching Figma: dashed outer circle, inner circle, stars, PAID text */
const PaidStamp = () => (
  <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
    <Circle
      cx="36"
      cy="36"
      r="34"
      stroke={FIGMA_COLORS.stampBorder}
      strokeWidth="2"
      strokeDasharray="4 4"
      fill="none"
    />
    <Circle
      cx="36"
      cy="36"
      r="28"
      stroke={FIGMA_COLORS.stampBorder}
      strokeWidth="1"
      fill="none"
    />
    <G fill={FIGMA_COLORS.stampText}>
      <Circle cx="24" cy="28" r="2" />
      <Circle cx="36" cy="24" r="2" />
      <Circle cx="48" cy="28" r="2" />
    </G>
    <SvgText
      x="36"
      y="46"
      fill={FIGMA_COLORS.stampText}
      fontSize="13.5"
      fontWeight="800"
      textAnchor="middle"
    >
      PAID
    </SvgText>
  </Svg>
);

// ===========================================
// SUB-COMPONENTS
// ===========================================

/** Receipt row with hash icon label */
function ReceiptRow({ label, value, valueColor, bold = false }: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.receiptRow}>
      <View style={styles.receiptLabelContainer}>
        <HashIcon />
        <Text style={styles.receiptLabel}>{label}</Text>
      </View>
      <Text style={[
        styles.receiptValue,
        valueColor ? { color: valueColor } : undefined,
        bold && styles.receiptValueBold,
      ]}>
        {value}
      </Text>
    </View>
  );
}

/** Thin horizontal divider line */
function TableDivider() {
  return <View style={styles.tableDivider} />;
}

// ===========================================
// MAIN COMPONENT
// ===========================================
export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: historyData, isLoading } = usePaymentHistory();

  const transaction = useMemo(() => {
    const payments = historyData?.payments;
    if (!payments || !id) return null;
    return payments.find((t) => t.id === id) ?? null;
  }, [historyData, id]);

  // Eagerly fetch receipt data for additional fields (landlord, PAN, agreement, UTR)
  const receiptQuery = useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      const { data, error } = await generateReceipt(id!);
      if (error) throw new Error(error);
      return data!;
    },
    enabled: !!transaction && transaction.status === 'success',
    staleTime: 1000 * 60 * 30, // 30 min
  });

  // Derive display values (safe when transaction is null)
  const isPaid = transaction?.status === 'success';
  const formattedAmount = transaction ? formatRupees(transaction.amount) : '';
  const formattedDate = transaction ? formatDate(transaction.created_at) : '';
  const paymentMethod = transaction ? formatPaymentMethod(transaction.payment_method) : '';
  const transactionId = transaction ? `SEC${transaction.id.slice(0, 8).toUpperCase()}` : '';
  const totalPayable = transaction ? formatRupees(transaction.net_amount + transaction.pg_fee) : '';

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!transaction || !transaction.can_download_receipt) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Use cached receipt data if available, otherwise fetch
      let receipt: ReceiptData | undefined = receiptQuery.data ?? undefined;
      if (!receipt) {
        const { data, error } = await generateReceipt(transaction.id);
        if (error || !data) {
          // Fallback to text share
          Share.share({
            message: `Payment Receipt\nAmount: ${formattedAmount}\nDate: ${formattedDate}\nTransaction ID: ${transactionId}`,
            title: 'Payment Receipt',
          });
          return;
        }
        receipt = data;
      }

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
        dialogTitle: `Receipt ${receipt.receiptNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (_err) {
      // Fallback to basic text share
      Share.share({
        message: `Payment Receipt\nAmount: ${formattedAmount}\nDate: ${formattedDate}`,
        title: 'Payment Receipt',
      });
    }
  }, [transaction, receiptQuery.data, formattedAmount, formattedDate, transactionId]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/help' as never);
  }, [router]);

  // Loading state
  if (isLoading || !transaction) {
    return (
      <Screen testID="transaction-detail-loading">
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <BackArrowIcon />
            </TouchableOpacity>
          </View>
          <View style={styles.loadingInner}>
            <ActivityIndicator size="large" color={FIGMA_COLORS.successfulText} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="transaction-detail-screen" padded={false}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* === BACK BUTTON === */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="back-button"
          >
            <BackArrowIcon />
          </TouchableOpacity>
        </View>

        {/* === RECEIPT CARD === */}
        {/* Figma: Frame 2095586361 + Frame 1686557240 */}
        <View style={styles.receiptCardOuter}>
          {/* Paperclip decoration - absolute positioned */}
          <View style={styles.paperclipContainer}>
            <PaperclipIcon />
          </View>

          {/* Card body - bg:#202020, radius:12 */}
          <View style={styles.receiptCard}>
            {/* Header: Payment + Succesful + PAID stamp */}
            <View style={styles.receiptHeader}>
              <View style={styles.headerTextContainer}>
                {/* "Payment\nSuccesful" - 20px Regular */}
                {/* "Payment" = #FFFFFF, "Succesful" = #FF9A6D (span start:8 end:17) */}
                <Text style={styles.paymentText}>Payment</Text>
                <Text style={styles.successfulText}>Succesful</Text>
              </View>
              {isPaid && (
                <View style={styles.stampContainer}>
                  <PaidStamp />
                </View>
              )}
            </View>

            {/* Receipt rows */}
            <View style={styles.receiptRows}>
              <ReceiptRow label="Amount paid" value={formattedAmount} />
              <TableDivider />
              <ReceiptRow label="Date" value={formattedDate} />
              <TableDivider />
              <ReceiptRow label="Method" value={paymentMethod} />
              <TableDivider />
              <ReceiptRow label="Landlord" value={receiptQuery.data?.landlord?.name ?? transaction.tenancy?.landlord_name ?? 'N/A'} />
              <TableDivider />
              <ReceiptRow label="PAN Card" value={receiptQuery.data?.landlord?.panMasked ?? 'Not provided'} />
              <TableDivider />
              <ReceiptRow label="Agreement ID" value={receiptQuery.data?.agreement?.certId ?? 'N/A'} />
              <TableDivider />
              <ReceiptRow label="Transaction ID" value={receiptQuery.data?.payment?.utr ?? transactionId} />
            </View>

            {/* Cashback pill */}
            <View style={styles.cashbackNote}>
              <Text style={styles.cashbackNoteText}>
                {transaction.cashback_applied > 0
                  ? `\u20B9${transaction.cashback_applied} cashback applied`
                  : 'Pay by the 7th to earn cashback.'}
              </Text>
            </View>

            {/* Final divider with circle cutouts */}
            <TableDivider />
          </View>

          {/* Circle cutouts at divider level */}
          <View style={styles.circleCutoutLeft} />
          <View style={styles.circleCutoutRight} />

          {/* Payable Rent row - below the cutout divider */}
          <View style={styles.payableSection}>
            <ReceiptRow
              label="Payable Rent"
              value={totalPayable}
              valueColor={FIGMA_COLORS.payableValue}
              bold
            />
          </View>
        </View>

        {/* === SETTLEMENT STATUS (only for successful payments) === */}
        {isPaid && transaction.landlord_payout_status && (
          <View style={styles.settlementCard}>
            <View style={styles.settlementHeader}>
              <Text style={styles.settlementTitle}>Landlord Settlement</Text>
              <View
                style={[
                  styles.settlementBadge,
                  {
                    backgroundColor:
                      transaction.landlord_payout_status === 'settled'
                        ? 'rgba(76, 175, 80, 0.15)'
                        : transaction.landlord_payout_status === 'processing' || transaction.landlord_payout_status === 'ready'
                        ? 'rgba(33, 150, 243, 0.15)'
                        : transaction.landlord_payout_status === 'failed'
                        ? 'rgba(244, 67, 54, 0.15)'
                        : 'rgba(255, 193, 7, 0.15)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.settlementBadgeText,
                    {
                      color:
                        transaction.landlord_payout_status === 'settled'
                          ? '#4CAF50'
                          : transaction.landlord_payout_status === 'processing' || transaction.landlord_payout_status === 'ready'
                          ? '#2196F3'
                          : transaction.landlord_payout_status === 'failed'
                          ? '#F44336'
                          : '#FFC107',
                    },
                  ]}
                >
                  {transaction.landlord_payout_status.charAt(0).toUpperCase() +
                    transaction.landlord_payout_status.slice(1)}
                </Text>
              </View>
            </View>
            {transaction.landlord_payout_status === 'settled' && transaction.landlord_payout_date && (
              <Text style={styles.settlementInfo}>
                Settled on {formatDate(transaction.landlord_payout_date)}
              </Text>
            )}
            {(transaction.landlord_payout_status === 'processing' || transaction.landlord_payout_status === 'ready') && (
              <Text style={styles.settlementInfo}>
                Expected in 1-2 business days
              </Text>
            )}
            {transaction.landlord_payout_status === 'pending' && (
              <Text style={styles.settlementInfo}>
                Settlement will begin shortly
              </Text>
            )}
          </View>
        )}

        {/* === FOOTER: Download Receipt + Contact Support === */}
        <View style={styles.footer}>
          <PrimaryButton
            title={receiptQuery.isLoading ? 'Loading...' : 'Download Receipt'}
            onPress={handleDownloadReceipt}
            disabled={receiptQuery.isLoading}
            testID="download-receipt-button"
          />
          <TouchableOpacity
            style={styles.supportLink}
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel="Contact support"
            testID="contact-support-button"
          >
            <Text style={styles.supportLinkText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/** Format rupee amount with currency symbol */
function formatRupees(rupees: number): string {
  return `\u20B9  ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return 'UPI';
  switch (method) {
    case 'upi':
    case 'upi_intent':
    case 'upi_collect':
      return 'UPI (joel@oksbi)';
    case 'card':
      return 'Credit Card';
    case 'netbanking':
      return 'Net Banking';
    default:
      return method.toUpperCase();
  }
}

// ===========================================
// STYLES - Exact Figma Values
// ===========================================
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: FIGMA_COLORS.background,
  },
  loadingInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // === HEADER ===
  // Figma: Frame 2095586345, paddingHorizontal:40
  headerRow: {
    paddingHorizontal: FIGMA_SPACING.topPaddingH,  // 40
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // === RECEIPT CARD ===
  // Figma: Frame 2095586361, x:61, width:270
  receiptCardOuter: {
    alignSelf: 'center',
    width: FIGMA_SPACING.breakdownCardWidth, // 270
    marginTop: 32,
    position: 'relative',
  },

  // Paperclip - Figma: Group 58, absolute position
  paperclipContainer: {
    position: 'absolute',
    top: -8,
    left: 16,
    zIndex: 1,
  },

  // Card body - Figma: Frame 1686557240
  // bg: #202020, radius: 12, padding: 24/16, gap: 32
  receiptCard: {
    backgroundColor: FIGMA_COLORS.cardBody,
    borderRadius: 12,
    paddingTop: FIGMA_SPACING.cardPaddingV,        // 24
    paddingBottom: FIGMA_SPACING.cardPaddingV,      // 24
    paddingHorizontal: FIGMA_SPACING.cardPaddingH,  // 16
  },

  // Receipt header - "Payment\nSuccesful" + PAID stamp
  // Figma: row, space-between, align flex-start
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  // "Payment" - Figma: 20px/32 Regular #FFFFFF, letterSpacing:0
  paymentText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    color: FIGMA_COLORS.textPrimary,
  },
  // "Succesful" - Figma: 20px/32 Regular #FF9A6D (span override)
  successfulText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0,
    color: FIGMA_COLORS.successfulText,
  },
  // PAID stamp
  stampContainer: {
    marginTop: -4,
  },

  // Receipt rows container
  receiptRows: {
    gap: 0,
  },

  // Single receipt row - Figma: row, space-between, align center
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: FIGMA_SPACING.tableRowPaddingH, // 24
  },
  receiptLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Label - Figma: 12px/20 Regular #878787
  receiptLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.labelText,
  },
  // Value - Figma: 12px/20 Regular #CBCBCB
  receiptValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.valueText,
  },
  // Bold value (Payable Rent) - Figma: 14px/20 SemiBold #DDDDDD
  receiptValueBold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    color: FIGMA_COLORS.payableValue,
  },

  // Cashback note - Figma: 12px/20 Regular #DDDDDD, center
  cashbackNote: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cashbackNoteText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.cashbackNote,
    textAlign: 'center',
  },

  // Table divider - Figma: Vector, stroke #4D4D4D, weight 0.25
  tableDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.tableDivider,
    marginHorizontal: FIGMA_SPACING.tableRowPaddingH, // 24 inset
  },

  // Circle cutouts - Figma: Ellipse 14x14, bg:#131313
  circleCutoutLeft: {
    position: 'absolute',
    left: -7,
    bottom: 68,     // positioned near the final divider
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.circleCutout,
  },
  circleCutoutRight: {
    position: 'absolute',
    right: -7,
    bottom: 68,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.circleCutout,
  },

  // Payable Rent section - below the circle cutout divider
  payableSection: {
    backgroundColor: FIGMA_COLORS.cardBody,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingBottom: 8,
  },

  // === FOOTER ===
  // Figma: Frame 2095586363, paddingHorizontal:40, column, gap:16
  footer: {
    paddingHorizontal: FIGMA_SPACING.footerPaddingH,  // 40
    marginTop: 40,
    gap: FIGMA_SPACING.footerGap,                       // 16
    alignItems: 'center',
  },

  // Contact Support link - Figma: 12px/20 Regular #A9A9A9, center
  supportLink: {
    paddingVertical: 8,
  },
  supportLinkText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0,
    color: FIGMA_COLORS.footerText,
    textAlign: 'center',
  },

  // === SETTLEMENT STATUS ===
  settlementCard: {
    marginHorizontal: FIGMA_SPACING.footerPaddingH,
    marginTop: 24,
    backgroundColor: FIGMA_COLORS.cardBody,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 13,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,
  },
  settlementBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  settlementBadgeText: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 11,
    lineHeight: 16,
  },
  settlementInfo: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: FIGMA_COLORS.valueText,
  },
});
