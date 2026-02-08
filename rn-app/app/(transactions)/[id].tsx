/**
 * Transaction Detail / Receipt Screen - Pixel Perfect Figma Parity
 * Figma Reference: 41-9563 (Payment Successful)
 *
 * Features:
 * - Receipt-style card with paperclip decoration
 * - PAID stamp badge
 * - Payment breakdown with # symbol labels
 * - Download receipt button
 * - Contact support link
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text } from '@/src/components';
import { usePaymentHistory, useGenerateReceipt } from '@/src/hooks';
import { colors, spacing, radius, gradients, semanticColors } from '@/src/theme';
import type { PaymentHistoryItem } from '@/src/services/api/payments';

// Design System Colors - from 243-6731 Figma analysis
const RECEIPT_COLORS = {
  background: '#131313',                 // black.700
  cardBackground: '#1A1A1A',             // black.600 - Frame 2095586454
  headerBg: '#202020',                   // black.500 - Frame 1686557229
  cardDark: '#202020',                   // black.500
  accentOrange: '#FF9A6D',               // brand.500 - SELECTED
  textPrimary: '#FFFFFF',                // white
  textSecondary: '#CBCBCB',              // neutral.300 - Hi, Rishabh
  textMuted: '#DDDDDD',                  // neutral.200 - Figma cashback note text
  labelText: '#878787',                  // neutral.600 - Figma receipt labels (Amount paid, Date, etc.)
  amountText: '#CBCBCB',                 // neutral.300 - Figma receipt values (₹ 32,500, dates, etc.)
  hintText: '#BABABA',                   // neutral.400 - due notice
  payingWith: '#A6A6A6',                 // black.200 - Paying with
  success: '#70BF73',                    // success.default
  successDark: '#27803B',                // success.dark - path140
  divider: '#4D4D4D',                    // black.400
  paperclip: '#4D4D4D',                  // black.400
  stampBorder: '#27803B',                // success.dark
  stampText: '#70BF73',                  // success.default
  hashTag: '#FF9A6D',                    // brand.500
  avatarBg: '#FFCC8A',                   // brand.300 - Ellipse 8
  brandOrange: '#F06321',                // brand.700 - path160
  brandOrangeDark: '#E9661C',            // brand.800 - path144
  errorDark: '#AE282E',                  // error.dark - path162
} as const;

// Paperclip SVG component
const PaperclipIcon = () => (
  <Svg width={32} height={64} viewBox="0 0 32 64" fill="none">
    <Path
      d="M16 0C9.373 0 4 5.373 4 12V44C4 50.627 9.373 56 16 56C22.627 56 28 50.627 28 44V20"
      stroke={RECEIPT_COLORS.paperclip}
      strokeWidth={2}
      fill="none"
    />
    <Path
      d="M16 8C13.791 8 12 9.791 12 12V44C12 46.209 13.791 48 16 48C18.209 48 20 46.209 20 44V16"
      stroke={RECEIPT_COLORS.paperclip}
      strokeWidth={2}
      fill="none"
    />
  </Svg>
);

// PAID Stamp SVG component
const PaidStamp = () => (
  <Svg width={72} height={72} viewBox="0 0 72 72" fill="none">
    {/* Outer circle with dashed border */}
    <Circle
      cx="36"
      cy="36"
      r="34"
      stroke={RECEIPT_COLORS.stampBorder}
      strokeWidth="2"
      strokeDasharray="4 4"
      fill="none"
    />
    {/* Inner circle */}
    <Circle
      cx="36"
      cy="36"
      r="28"
      stroke={RECEIPT_COLORS.stampBorder}
      strokeWidth="1"
      fill="none"
    />
    {/* Stars */}
    <G fill={RECEIPT_COLORS.stampText}>
      <Circle cx="24" cy="24" r="2" />
      <Circle cx="36" cy="20" r="2" />
      <Circle cx="48" cy="24" r="2" />
    </G>
    {/* PAID text */}
    <SvgText
      x="36"
      y="42"
      fill={RECEIPT_COLORS.stampText}
      fontSize="14"
      fontWeight="bold"
      textAnchor="middle"
    >
      PAID
    </SvgText>
  </Svg>
);

// Receipt row with # label
interface ReceiptRowProps {
  label: string;
  value: string;
  valueColor?: string;
  isBold?: boolean;
}

function ReceiptRow({ label, value, valueColor = RECEIPT_COLORS.textPrimary, isBold = false }: ReceiptRowProps) {
  return (
    <View style={styles.receiptRow}>
      <View style={styles.receiptLabelContainer}>
        <Text style={styles.hashSymbol}>#</Text>
        <Text style={styles.receiptLabel}>{label}</Text>
      </View>
      <Text style={[styles.receiptValue, isBold && styles.receiptValueBold, { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

// Dashed divider component
function DashedDivider() {
  return (
    <View style={styles.dashedDivider}>
      {Array.from({ length: 30 }).map((_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: transactions, isLoading } = usePaymentHistory();
  const generateReceipt = useGenerateReceipt();

  const transaction = useMemo(() => {
    if (!transactions || !id) return null;
    return transactions.find((t) => t.id === id) ?? null;
  }, [transactions, id]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDownloadReceipt = useCallback(async () => {
    if (!transaction) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (transaction.receipt_url) {
      await Linking.openURL(transaction.receipt_url);
    } else {
      generateReceipt.mutate(transaction.id, {
        onSuccess: (data) => {
          if (data.receipt_url) {
            Linking.openURL(data.receipt_url);
          }
        },
      });
    }
  }, [transaction, generateReceipt]);

  const handleShareReceipt = useCallback(async () => {
    if (!transaction) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const amount = formatAmount(transaction.amount_paise);
    const date = formatDate(transaction.created_at);
    const month = formatRentMonth(transaction.rent_month);

    const message = `Payment Receipt\n\n${month}\nAmount: ${amount}\nDate: ${date}\nStatus: ${transaction.status.toUpperCase()}\n\nPaid via Flent Secured`;

    try {
      await Share.share({
        message,
        title: 'Payment Receipt',
      });
    } catch {
      // User cancelled share
    }
  }, [transaction]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(profile)/help' as never);
  }, [router]);

  // Loading state
  if (isLoading || !transaction) {
    return (
      <Screen testID="transaction-detail-loading">
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <Header onBack={handleBack} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RECEIPT_COLORS.accentOrange} />
          </View>
        </View>
      </Screen>
    );
  }

  const isPaid = transaction.status === 'success';
  const formattedAmount = formatAmount(transaction.amount_paise);
  const formattedDate = formatDate(transaction.created_at);
  const paymentMethod = formatPaymentMethod(transaction.payment_method);
  const transactionId = `SEC${transaction.id.slice(0, 8).toUpperCase()}`;
  const totalPayable = formatAmount(
    transaction.amount_paise + transaction.pg_fee_paise - transaction.cashback_applied_paise
  );

  return (
    <Screen testID="transaction-detail-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Header onBack={handleBack} />

        {/* Receipt Card */}
        <View style={styles.receiptContainer}>
          {/* Paperclip decoration */}
          <View style={styles.paperclipContainer}>
            <PaperclipIcon />
          </View>

          {/* Receipt card */}
          <View style={styles.receiptCard}>
            {/* Success header with stamp */}
            <View style={styles.successHeader}>
              <View style={styles.successTextContainer}>
                <Text style={styles.paymentLabel}>Payment</Text>
                <Text style={styles.successText}>Succesful</Text>
              </View>
              {isPaid && (
                <View style={styles.stampContainer}>
                  <PaidStamp />
                </View>
              )}
            </View>

            {/* Receipt rows */}
            <View style={styles.receiptContent}>
              <ReceiptRow label="Amount paid" value={formattedAmount} />
              <ReceiptRow label="Date" value={formattedDate} />
              <ReceiptRow label="Method" value={paymentMethod} />
              <ReceiptRow label="Transaction ID" value={transactionId} />
            </View>

            {/* Cashback note */}
            <View style={styles.cashbackNote}>
              <Text style={styles.cashbackNoteText}>
                Pay by the 7th to earn cashback.
              </Text>
            </View>

            <DashedDivider />

            {/* Total payable */}
            <View style={styles.totalSection}>
              <ReceiptRow label="Payable Rent" value={totalPayable} isBold />
            </View>
          </View>
        </View>

        {/* Download Receipt Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadReceipt}
            disabled={generateReceipt.isPending}
            accessibilityRole="button"
            accessibilityLabel="Download receipt"
          >
            <LinearGradient
              colors={gradients.button.colors as unknown as readonly [string, string, ...string[]]}
              locations={gradients.button.locations as unknown as readonly [number, number, ...number[]]}
              style={styles.downloadButtonGradient}
            >
              <Text style={styles.downloadButtonText}>
                {generateReceipt.isPending ? 'Generating...' : 'Download Receipt'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Contact Support Link */}
        <TouchableOpacity
          style={styles.supportLink}
          onPress={handleContactSupport}
          accessibilityRole="button"
          accessibilityLabel="Contact support"
        >
          <Text style={styles.supportLinkText}>Contact Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

// Header Component
interface HeaderProps {
  onBack: () => void;
}

function Header({ onBack }: HeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={RECEIPT_COLORS.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// Helper functions
function formatAmount(paise: number): string {
  const rupees = paise / 100;
  return `₹ ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRentMonth(rentMonth: string): string {
  if (!rentMonth) return 'Rent Payment';
  const [year, month] = rentMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return `${date.toLocaleDateString('en-IN', { month: 'long' })} ${year}`;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RECEIPT_COLORS.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: RECEIPT_COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptContainer: {
    position: 'relative',
    marginTop: spacing.xl,
  },
  paperclipContainer: {
    position: 'absolute',
    top: -24,
    left: 24,
    zIndex: 1,
  },
  receiptCard: {
    backgroundColor: RECEIPT_COLORS.cardBackground,
    borderRadius: 12,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  successHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  successTextContainer: {
    flex: 1,
  },
  paymentLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,     // Figma: "Payment Succesful" = 20px (was 28)
    lineHeight: 32,   // Figma: lineHeightPx = 32 (was 40)
    color: RECEIPT_COLORS.textPrimary,
    letterSpacing: 0,  // Figma: letterSpacing = 0 (was -1)
  },
  successText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,     // Figma: 20px (was 28)
    lineHeight: 32,   // Figma: 32 (was 40)
    color: RECEIPT_COLORS.textPrimary,  // Figma: base fill #FFFFFF, no override applied (was green)
    letterSpacing: 0,  // Figma: 0 (was -1)
  },
  stampContainer: {
    marginTop: -8,
  },
  receiptContent: {
    gap: spacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hashSymbol: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,     // bodySm
    lineHeight: 20,
    color: RECEIPT_COLORS.hashTag,  // brand.500 #FF9A6D
  },
  receiptLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma
    lineHeight: 20,
    color: RECEIPT_COLORS.labelText,  // neutral.500 #A9A9A9
  },
  receiptValue: {
    fontFamily: 'PlusJakartaSans-Regular',  // Figma: fontWeight 400 (Regular)
    fontSize: 12,
    lineHeight: 20,
    color: RECEIPT_COLORS.amountText,  // neutral.300 #CBCBCB per Figma
  },
  receiptValueBold: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,     // Figma: Payable Rent value = 14px (was 16)
    lineHeight: 20,   // Figma: lineHeight 20
    color: '#DDDDDD', // Figma: Payable Rent value = #DDDDDD
  },
  cashbackNote: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cashbackNoteText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: RECEIPT_COLORS.textMuted,
  },
  dashedDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  dash: {
    width: 8,
    height: 1,
    backgroundColor: RECEIPT_COLORS.divider,
  },
  totalSection: {
    paddingTop: spacing.sm,
  },
  buttonContainer: {
    marginTop: spacing.xxl,
  },
  downloadButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RECEIPT_COLORS.accentOrange,
  },
  downloadButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontFamily: 'PlusJakartaSans-Medium',  // Figma: fontWeight 500 (was SemiBold/600)
    fontSize: 14,     // Figma: 14 (was 16)
    lineHeight: 20,   // Figma: 20 (was 24)
    color: RECEIPT_COLORS.textPrimary,
  },
  supportLink: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  supportLinkText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // Figma: Contact Support = 12px (was 14)
    lineHeight: 20,
    color: '#A9A9A9',  // Figma: Contact Support = #A9A9A9 (was #CBCBCB)
  },
});
