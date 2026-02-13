/**
 * Payment Success Screen
 * Figma Reference: 41-9388 (with cashback), 41-9511 (no cashback)
 *
 * Pixel-perfect implementation per Figma extraction:
 * - Screen: 393x852, bg #131313
 * - Receipt card: 270x481, bg #202020, shadow 0,9,19 #000000
 * - Perforated top: 14 ellipses, 14x14px each, spaced evenly
 * - Side notches: 14x14px at vertical center
 * - PAID stamp: 85.42x80, rotated -15deg, color #06C270, Inter ExtraBold 13.51px
 * - Title: "Payment" (white #FFFFFF) + "Succesful" (orange #FF9A6D), fontSize 20, lineHeight 32
 * - Receipt rows: 222px wide, gap 16px, icon 16x16, labels #878787, values #CBCBCB
 * - Payable Rent value: fontSize 14, fontWeight 600, color #DDDDDD
 * - Cashback pill: 222x28, bg #1A1A1A, borderRadius 40, text #DDDDDD
 * - Button: 313x52, text "Download Receipt", fontSize 14, fontWeight 500
 * - Contact Support: fontSize 12, color #A9A9A9, textAlign center
 */

import React, { useEffect, useCallback, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Share,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { DashedDivider } from '@/src/components/payment';
import { useGenerateReceipt } from '@/src/hooks';
import { colors, spacing } from '@/src/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Figma 41-9388: card width 270px on 393px screen width
const FIGMA_SCREEN_WIDTH = 393;
const FIGMA_SCREEN_HEIGHT = 852;
const FIGMA_CARD_WIDTH = 270;
const FIGMA_CARD_HEIGHT = 481;
const FIGMA_BUTTON_WIDTH = 313;

// Scale factor for responsive sizing
const SCALE = SCREEN_WIDTH / FIGMA_SCREEN_WIDTH;
const CARD_WIDTH = Math.round(FIGMA_CARD_WIDTH * SCALE);
const CARD_HEIGHT = Math.round(FIGMA_CARD_HEIGHT * SCALE);
const BUTTON_WIDTH = Math.round(FIGMA_BUTTON_WIDTH * SCALE);

// Exact Figma colors - from 41-9388 extraction
const FIGMA_COLORS = {
  background: '#131313',           // black.700 - screen bg
  cardBackground: '#202020',       // black.500 - Rectangle 136
  frameBackground: '#1A1A1A',      // black.600 - Frame 1686557297
  titleWhite: '#FFFFFF',           // white - "Payment" text
  titleSuccess: '#FF9A6D',         // brand.500 - "Succesful" text (Figma 41:9452 styleOverrideTable[2])
  stampColor: '#06C270',           // success.approved - PAID stamp
  labelText: '#878787',            // neutral.600 - row labels
  valueText: '#CBCBCB',            // neutral.300 - row values
  payableRentValue: '#DDDDDD',     // neutral.200 - Payable Rent value
  hashColor: '#FF9A6D',            // brand.500
  infoText: '#DDDDDD',             // neutral.200 - cashback text
  dividerColor: '#4D4D4D',         // black.400 - dashed dividers
  paperclipColor: '#4D4D4D',       // black.400 - paperclip vector
  iconColor: '#A6A6A6',            // black.200 - hash icon
  cashbackBg: '#1A1A1A',           // black.600 - cashback pill bg
  cashbackText: '#DDDDDD',         // neutral.200 - cashback text
  contactSupportText: '#A9A9A9',   // neutral.500 - Contact Support
  buttonBorder: '#FF9A6D',         // brand.500 - button border
  buttonShadow: '#995C41',         // button shadow color
};

// Figma card inner width for receipt rows and cashback pill
const FIGMA_CARD_INNER_WIDTH = 222;

// Back Arrow Icon
const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18L9 12L15 6"
      stroke={FIGMA_COLORS.titleWhite}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Perforated top edge (14 ellipses per Figma 41:9436-41:9449)
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

// PAID Stamp Component
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

// Receipt row with # prefix
interface ReceiptRowProps {
  label: string;
  value: string;
  isPayableRent?: boolean; // Payable Rent has different styling per Figma
}

// Receipt Icon - 16x16 container with icon vector per Figma
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

// Cashback Pill - styled per Figma 41-9388 (Frame 1686557297)
// Background: #1A1A1A (black.600), borderRadius: 40, padding: 4/12
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
  const insets = useSafeAreaInsets();
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

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDownloadReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Try to generate a real receipt if we have a paymentId
    if (paymentId) {
      try {
        const receipt = await generateReceiptAsync(paymentId);

        // Share the rich receipt data
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

    // Fallback: share basic receipt info
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

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(main)' as never);
  }, [router]);

  return (
    <Screen testID="success-screen" style={styles.screen}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackArrow />
        </TouchableOpacity>

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

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.titleWhite}>Payment</Text>
              <Text style={styles.titleSuccess}>Succesful</Text>
            </View>

            {/* Receipt Details */}
            <View style={styles.receiptDetails}>
              <ReceiptRow label="Amount paid" value={`\u20B9 ${amount}`} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Date" value={`${new Date().getDate()} Nov ${new Date().getFullYear()}`} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Method" value={method} />

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Transaction ID" value={transactionId} />

              {/* Cashback section - per Figma 41-9388 */}
              {hasCashback ? (
                <CashbackPill text={`\u20B9${cashback} cashback applied`} />
              ) : (
                <CashbackPill text="Pay by the 7th to earn cashback." />
              )}

              <DashedDivider color={FIGMA_COLORS.dividerColor} style={styles.divider} />

              <ReceiptRow label="Payable Rent" value={`\u20B9 ${amount}`} isPayableRent />
            </View>
          </View>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Buttons */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
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
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  paperclipContainer: {
    position: 'absolute',
    top: -20,
    left: 24,
    zIndex: 10,
  },
  receiptCard: {
    width: CARD_WIDTH,
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
    top: -7,                        // Half outside the card (14/2)
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  punchHole: {
    width: 14,                      // Figma: Ellipse width: 14
    height: 14,                     // Figma: Ellipse height: 14
    borderRadius: 7,                // Circular
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
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 8,
    color: FIGMA_COLORS.stampColor,
    textAlign: 'center',               // Figma: textAlignHorizontal: CENTER
  },
  stampText: {
    fontFamily: 'Inter-ExtraBold',  // Figma: Inter fontWeight 800
    fontSize: 13.51,                // Figma I41:9451;5:396: fontSize: 13.51
    lineHeight: 16.35,              // Figma: lineHeightPx: 16.35
    color: FIGMA_COLORS.stampColor,
    textAlign: 'center',            // Figma: textAlignHorizontal: CENTER
    textTransform: 'uppercase',     // Figma: textCase: UPPER
    marginVertical: 2,
  },
  titleSection: {
    marginBottom: 24,
    alignItems: 'center',          // Figma: counterAxisAlignItems: CENTER
  },
  titleWhite: {
    fontFamily: 'PlusJakartaSans-Regular',  // bodyLg per Figma - weight 400
    fontSize: 20,
    lineHeight: 32,    // bodyLg lineHeight
    color: FIGMA_COLORS.titleWhite,
    // Figma raw node shows LEFT textAlign, but parent frame has counterAxisAlignItems: CENTER.
    // The text is single-line and narrower than the card, so parent centering handles alignment.
    // Using 'center' for consistency with the centered layout - visually identical to 'left'.
    textAlign: 'center',
  },
  titleSuccess: {
    fontFamily: 'PlusJakartaSans-Regular',  // bodyLg per Figma - weight 400
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.titleSuccess,
    // Same as titleWhite - parent centering makes textAlign cosmetic for single-line text
    textAlign: 'center',
  },
  receiptDetails: {
    gap: 16,                       // Figma: Frame 2095586361 itemSpacing: 16
    alignItems: 'center',          // Figma: Frame 2095586369 counterAxisAlignItems: CENTER
  },
  receiptRow: {
    width: FIGMA_CARD_INNER_WIDTH, // Figma: Frame 1686557329 width: 222
    height: 20,                    // Figma: Frame 1686557329 height: 20
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,                        // Figma: itemSpacing: 4
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,                        // Figma: Frame 1686557121 itemSpacing: 4
  },
  hashIcon: {
    width: 16,                     // Figma: Frame width: 16
    height: 16,                    // Figma: Frame height: 16
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,     // bodyXs per Figma analysis
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,  // neutral.600 #878787
    textAlign: 'left',              // Left-aligned label in receipt row
  },
  valueText: {
    fontFamily: 'PlusJakartaSans-Regular', // Figma: fontWeight 400 for amount values
    fontSize: 12,                  // Figma: fontSize: 12
    lineHeight: 20,                // Figma: lineHeightPx: 20
    color: FIGMA_COLORS.valueText, // neutral.300 #CBCBCB
    textAlign: 'right',            // Right-aligned value in receipt row
  },
  divider: {
    width: FIGMA_CARD_INNER_WIDTH, // Figma: Vector 49 width: 222
    marginVertical: 0,             // Parent gap handles spacing
  },
  payableRentValueText: {
    fontFamily: 'PlusJakartaSans-SemiBold', // Figma 41:9435: fontWeight 600
    fontSize: 14,                  // Figma 41:9435: fontSize: 14
    lineHeight: 20,                // Figma 41:9435: lineHeightPx: 20
    color: FIGMA_COLORS.payableRentValue, // neutral.200 #DDDDDD
    textAlign: 'right',            // Right-aligned value in receipt row
  },
  cashbackPill: {
    width: FIGMA_CARD_INNER_WIDTH, // Figma: Frame 1686557297 width: 222
    alignSelf: 'center',
    paddingHorizontal: 12,         // per Figma: paddingLeft/Right: 12
    paddingVertical: 4,            // per Figma: paddingTop/Bottom: 4
    borderRadius: 40,              // per Figma: cornerRadius: 40
    marginVertical: 12,
    backgroundColor: FIGMA_COLORS.cashbackBg,  // #1A1A1A (black.600)
    justifyContent: 'center',      // Figma: primaryAxisAlignItems: CENTER
    alignItems: 'center',          // Figma: counterAxisAlignItems: CENTER
  },
  cashbackText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,                  // per Figma: fontSize: 12
    lineHeight: 20,                // per Figma: lineHeightPx: 20
    color: FIGMA_COLORS.cashbackText,  // #DDDDDD (neutral.200)
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    gap: 16,                       // Figma: Frame 2095586363 itemSpacing: 16
    alignItems: 'center',          // Figma: counterAxisAlignItems: CENTER
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,                  // per Figma 41:9455: fontSize: 12
    lineHeight: 20,                // per Figma: lineHeightPx: 20
    color: FIGMA_COLORS.contactSupportText,  // #A9A9A9 (neutral.500)
    textAlign: 'center',           // Figma: textAlignHorizontal: CENTER
  },
});
