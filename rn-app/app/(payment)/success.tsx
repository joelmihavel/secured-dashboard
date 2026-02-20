/**
 * Payment Success Screen
 * Figma Reference: 41-9388 (with cashback), 41-9563 (no cashback)
 *
 * Pixel-perfect implementation per Figma blueprint extraction:
 * - Screen: 393x852, bg #131313
 * - Receipt card frame (Frame 2095586361): x:61, y:183, 270x481
 * - Card bg: #202020 (Rectangle 136)
 * - Perforated top: 14 ellipses, 14x14px each
 * - Side notches: 14x14px at vertical center
 * - PAID stamp: rotated -15deg, color #06C270, Inter ExtraBold 13.51px
 * - Title: single text node "Payment\nSuccesful" - "Payment" #FFFFFF, "Succesful" #FF9A6D
 *   fontSize 20, lineHeight 32, fontFamily PlusJakartaSans-Regular, textAlign left
 * - Receipt rows: 222px wide, gap 16px, icon 16x16 (#A6A6A6), labels #878787, values #CBCBCB
 * - Payable Rent value: fontSize 14, fontWeight 600 (SemiBold), color #DDDDDD
 * - Cashback pill (41-9388): bg #1A1A1A, borderRadius 40, text #DDDDDD "R350 cashback applied"
 * - No-cashback pill (41-9563): same bg, text "Pay by the 7th to earn cashback."
 * - Button container (Frame 2095586363): x:40, y:704, width 313, gap 16, column, center
 * - PrimaryButton: "Download Receipt" fontSize 14, fontWeight 500
 * - Contact Support: fontSize 12, lineHeight 20, color #A9A9A9, textAlign center
 */

import React, { useEffect, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { DashedDivider } from '@/src/components/payment';
import { useGenerateReceipt } from '@/src/hooks';
import { colors } from '@/src/theme';

// Exact Figma colors - from 41-9388 / 41-9563 blueprint extraction
const FIGMA_COLORS = {
  background: colors.black[700],           // black.700 - screen bg
  cardBackground: colors.black[500],       // black.500 - Rectangle 136
  frameBackground: colors.black[600],      // black.600 - Frame 1686557297
  titleWhite: colors.white,           // white - "Payment" text
  titleAccent: colors.brand[500],          // brand.500 - "Succesful" text (span start:8)
  stampColor: colors.success.approved,           // success.approved - PAID stamp
  labelText: colors.neutral[600],            // neutral.600 - row labels
  valueText: colors.neutral[300],            // neutral.300 - row values
  payableRentValue: colors.neutral[200],     // neutral.200 - Payable Rent value
  iconColor: colors.black[200],            // black.200 - hash icon
  dividerColor: colors.black[400],         // black.400 - dashed dividers
  paperclipColor: colors.black[400],       // black.400 - paperclip vector
  cashbackBg: colors.black[600],           // black.600 - cashback pill bg
  cashbackText: colors.neutral[200],         // neutral.200 - cashback text
  contactSupportText: colors.neutral[500],   // neutral.500 - Contact Support
};

// Figma card inner width for receipt rows and cashback pill
const FIGMA_CARD_INNER_WIDTH = 222;

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

// Perforated top edge (14 ellipses per Figma)
const PerforatedEdge = () => {
  const holes = Array.from({ length: 14 }, (_, i) => i);
  return (
    <View style={styles.perforatedEdge}>
      {holes.map((i) => (
        <View key={i} style={styles.punchHole} />
      ))}
    </View>
  );
};

// PAID Stamp Component - Inter ExtraBold per Figma
const PaidStamp = () => (
  <View style={styles.stampContainer}>
    <View style={styles.stampOuter}>
      <View style={styles.stampInner}>
        <View style={styles.starsRow}>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
        </View>
        <Text style={styles.stampText}>PAID</Text>
        <View style={styles.starsRow}>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
          <Text style={styles.star}>*</Text>
        </View>
      </View>
    </View>
  </View>
);

// Receipt Icon - 16x16 container with hash icon
const ReceiptIcon = () => (
  <View style={styles.hashIcon}>
    <Svg width={11} height={12} viewBox="0 0 11 12" fill="none">
      <Path
        d="M1.5 4H9.5M1.5 8H9.5M3 1L2 11M8 1L7 11"
        stroke={FIGMA_COLORS.iconColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

// Receipt row with hash icon prefix
interface ReceiptRowProps {
  label: string;
  value: string;
  isPayableRent?: boolean;
}

const ReceiptRow = memo(({ label, value, isPayableRent }: ReceiptRowProps) => (
  <View style={styles.receiptRow}>
    <View style={styles.labelContainer}>
      <ReceiptIcon />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <Text style={isPayableRent ? styles.payableRentValueText : styles.valueText}>{value}</Text>
  </View>
));
ReceiptRow.displayName = 'ReceiptRow';

// Cashback / info pill
interface CashbackPillProps {
  text: string;
}

const CashbackPill = memo(({ text }: CashbackPillProps) => (
  <View style={styles.cashbackPill}>
    <Text style={styles.cashbackText}>{text}</Text>
  </View>
));
CashbackPill.displayName = 'CashbackPill';

export default function SuccessScreen() {
  const router = useRouter();
  const { mutateAsync: generateReceiptAsync, isPending: isGeneratingReceipt } = useGenerateReceipt();
  const params = useLocalSearchParams<{
    paymentId?: string;
    amount?: string;
    cashback?: string;
    transactionId?: string;
    method?: string;
  }>();

  // Real values from params, with fallbacks for demo
  const paymentId = params.paymentId ?? '';
  const amount = params.amount ?? '32,175';
  const cashback = params.cashback ?? '350';
  const transactionId = params.transactionId ?? 'SEC12345678';
  const method = params.method ?? 'UPI (joel@oksbi)';
  const hasCashback = Number(cashback) > 0;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleDownloadReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (paymentId) {
      try {
        const receipt = await generateReceiptAsync(paymentId);
        const receiptText = [
          `Payment Receipt - ${receipt.receiptNumber}`,
          '',
          `Amount: \u20B9${receipt.payment.amount.toLocaleString('en-IN')}`,
          `Date: ${new Date(receipt.payment.paidAt).toLocaleDateString('en-IN')}`,
          `Transaction ID: ${receipt.payment.transactionId ?? transactionId}`,
          `Method: ${receipt.payment.paymentMethod ?? method}`,
          `Rent Month: ${receipt.payment.rentMonthDisplay}`,
          '',
          `Tenant: ${receipt.tenant.name}`,
          `Property: ${receipt.property.address}`,
          `Landlord: ${receipt.landlord.name}`,
          '',
          `Net Amount Paid: \u20B9${receipt.payment.netAmountPaid.toLocaleString('en-IN')}`,
          receipt.payment.cashbackApplied > 0
            ? `Cashback Applied: \u20B9${receipt.payment.cashbackApplied.toLocaleString('en-IN')}`
            : '',
          '',
          `Receipt #: ${receipt.receiptNumber}`,
          `${receipt.company.name}`,
          `GSTIN: ${receipt.company.gstin}`,
        ].filter(Boolean).join('\n');

        await Share.share({
          message: receiptText,
          title: `Receipt ${receipt.receiptNumber}`,
        });
        return;
      } catch (err) {
        if (__DEV__) {
          console.warn('Receipt generation failed, falling back to basic share:', err);
        }
      }
    }

    try {
      await Share.share({
        message: `Payment Receipt\n\nAmount: \u20B9${amount}\nDate: ${new Date().toLocaleDateString()}\nTransaction ID: ${transactionId}\nMethod: ${method}`,
        title: 'Payment Receipt',
      });
    } catch (err) {
      if (__DEV__) {
        console.log('Share error:', err);
      }
    }
  }, [paymentId, amount, transactionId, method, generateReceiptAsync]);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL('mailto:support@flentsecured.com');
  }, []);

  return (
    <Screen testID="success-screen" padded={false} style={styles.screen}>
      <View style={styles.container}>
        {/* Receipt Card */}
        <View style={styles.receiptContainer}>
          {/* Paperclip decoration */}
          <View style={styles.paperclipContainer}>
            <Paperclip />
          </View>

          {/* Card with notches */}
          <View style={styles.receiptCard}>
            {/* Perforated top edge */}
            <PerforatedEdge />

            {/* Left notch */}
            <View style={[styles.notch, styles.notchLeft]} />
            {/* Right notch */}
            <View style={[styles.notch, styles.notchRight]} />

            {/* Stamp */}
            <View style={styles.stampPosition}>
              <PaidStamp />
            </View>

            {/* Title - Figma: single text node with span, "Payment" white + "Succesful" orange */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>Payment</Text>
              <Text style={styles.titleAccent}>Succesful</Text>
            </View>

            {/* Receipt Details */}
            <View style={styles.receiptDetails}>
              <ReceiptRow label="Amount paid" value={`\u20B9  ${amount}`} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Date" value={`${new Date().getDate()} Nov ${new Date().getFullYear()}`} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Method" value={method} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Transaction ID" value={transactionId} />

              {/* Cashback section - 41-9388 vs 41-9563 */}
              {hasCashback ? (
                <CashbackPill text={`\u20B9${cashback} cashback applied`} />
              ) : (
                <CashbackPill text="Pay by the 7th to earn cashback." />
              )}

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Payable Rent" value={`\u20B9  ${amount}`} isPayableRent />
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button Container - Figma Frame 2095586363: x:40, y:704, width:313, gap:16 */}
        <View style={styles.buttonContainer}>
          <PrimaryButton
            title={isGeneratingReceipt ? 'Generating...' : 'Download Receipt'}
            onPress={handleDownloadReceipt}
            loading={isGeneratingReceipt}
            testID="download-receipt-button"
          />

          <TouchableOpacity onPress={handleContactSupport} style={styles.linkButton}>
            <Text style={styles.linkText}>Contact Support</Text>
          </TouchableOpacity>
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
    // Screen padded=false, so no double-pad
    paddingHorizontal: 40,
  },
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
    // Figma: card frame at y:183, top section at y:111
    // With safe area ~59px, card offset from top section ~72px
    marginTop: 12,
  },
  paperclipContainer: {
    position: 'absolute',
    top: -20,
    left: -16, // Offset from 40px padding to match card edge
    zIndex: 10,
  },
  receiptCard: {
    width: 270,                    // Figma: Frame 2095586361 width: 270
    backgroundColor: FIGMA_COLORS.cardBackground,
    borderRadius: 16,
    padding: 24,
    paddingTop: 80,
    position: 'relative',
    overflow: 'visible',
  },
  // Perforated edge - row of punch holes at top
  perforatedEdge: {
    position: 'absolute',
    top: -7,                       // Half outside the card (14/2)
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  punchHole: {
    width: 14,                     // Figma: Ellipse width: 14
    height: 14,                    // Figma: Ellipse height: 14
    borderRadius: 7,               // Circular
    backgroundColor: FIGMA_COLORS.background,
  },
  notch: {
    position: 'absolute',
    width: 14,                     // Figma: Ellipse 21890/21891 width: 14
    height: 14,                    // Figma: Ellipse 21890/21891 height: 14
    borderRadius: 7,               // Circular (half of 14)
    backgroundColor: FIGMA_COLORS.background,
    top: '50%',
    marginTop: -7,                 // Center vertically (half of 14)
  },
  notchLeft: {
    left: -7,                      // Half inside, half outside (7 = 14/2)
  },
  notchRight: {
    right: -7,                     // Half inside, half outside (7 = 14/2)
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
    fontFamily: 'Inter-ExtraBold',     // Figma: Inter fontWeight 800
    fontSize: 13.51,                   // Figma: fontSize: 13.51
    lineHeight: 16.35,                 // Figma: lineHeightPx: 16.35
    color: FIGMA_COLORS.stampColor,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginVertical: 2,
  },
  // Title - Figma 41:9452: "Payment\nSuccesful", textAlign left, x:19, y:68
  titleSection: {
    marginBottom: 24,
    // Figma: text node at x:19 inside 270px card with 24px padding = left-aligned
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
  receiptDetails: {
    gap: 16,                           // Figma: Frame 2095586361 itemSpacing: 16
    alignItems: 'center',
  },
  receiptRow: {
    width: FIGMA_CARD_INNER_WIDTH,     // Figma: Frame 1686557329 width: 222
    height: 20,                        // Figma: Frame 1686557329 height: 20
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,                            // Figma: itemSpacing: 4
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,                            // Figma: Frame 1686557121 itemSpacing: 4
  },
  hashIcon: {
    width: 16,                         // Figma: Frame width: 16
    height: 16,                        // Figma: Frame height: 16
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,     // neutral.600 #878787
    textAlign: 'left',
  },
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.valueText,     // neutral.300 #CBCBCB
    textAlign: 'right',
  },
  divider: {
    width: FIGMA_CARD_INNER_WIDTH,     // Figma: Vector 49 width: 222
    marginVertical: 0,
  },
  payableRentValueText: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma: fontWeight 600
    fontSize: 14,                      // Figma: fontSize: 14
    lineHeight: 20,                    // Figma: lineHeightPx: 20
    color: FIGMA_COLORS.payableRentValue,   // neutral.200 #DDDDDD
    textAlign: 'right',
  },
  cashbackPill: {
    width: FIGMA_CARD_INNER_WIDTH,     // Figma: Frame 1686557297 width: 222
    alignSelf: 'center',
    paddingHorizontal: 12,             // Figma: paddingLeft/Right: 12
    paddingVertical: 4,                // Figma: paddingTop/Bottom: 4
    borderRadius: 40,                  // Figma: cornerRadius: 40
    marginVertical: 12,
    backgroundColor: FIGMA_COLORS.cashbackBg, // #1A1A1A
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashbackText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.cashbackText,  // #DDDDDD
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  // Button container - Figma Frame 2095586363: x:40, y:704, width:313, gap:16
  buttonContainer: {
    width: 313,                        // Figma: fixed 313px
    alignSelf: 'center',
    gap: 16,                           // Figma: itemSpacing: 16
    alignItems: 'center',
    paddingBottom: 24,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,                      // Figma 41:9455: fontSize: 12
    lineHeight: 20,                    // Figma: lineHeightPx: 20
    color: FIGMA_COLORS.contactSupportText, // #A9A9A9
    textAlign: 'center',
  },
});
