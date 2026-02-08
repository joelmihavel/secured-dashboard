/**
 * Payment Failed Screen
 * Figma Reference: 41-9563 (failed), 41-9635 (refunded)
 *
 * Pixel-perfect implementation based on Figma extraction:
 * - Screen: 393x852, bg #131313
 * - Receipt card: 270x481, bg #202020, shadow 0,9,19 #000000
 * - Perforated top: 14 ellipses, 14x14px each, positioned half outside card
 * - Side notches: 14x14px ellipses at vertical center of card
 * - Stamp: rotated -15deg, color varies by status (PAID #06C270, FAILED #FF8080, REFUND #A9A9A9)
 * - Title: "Payment" (white #FFFFFF) + status text (color varies), fontSize 20, lineHeight 32
 * - Receipt rows: 222px wide, gap 16px, icon 16x16, labels #878787, values #CBCBCB
 * - All labels have textAlign: center per Figma
 * - Payable Rent value: fontSize 14, fontWeight 600, color #DDDDDD
 * - Cashback pill: 222x28, bg #1A1A1A, borderRadius 40, text #DDDDDD
 * - Button container: width 313px, gap 16px, centered
 * - Button: 313x52, text "Download Receipt", fontSize 14, fontWeight 500
 * - Contact Support: width 313, fontSize 12, lineHeight 20, color #A9A9A9, textAlign center
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { Screen, Text, PrimaryButton } from '@/src/components';
import { PaymentStamp, DashedDivider } from '@/src/components/payment';

// Figma screen dimensions
const FIGMA_SCREEN_WIDTH = 393;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCALE = SCREEN_WIDTH / FIGMA_SCREEN_WIDTH;

// Figma dimensions - scaled for different screen sizes
const FIGMA_CARD_WIDTH = 270;
const FIGMA_CARD_INNER_WIDTH = 222;
const FIGMA_BUTTON_CONTAINER_WIDTH = 313;

// Apply scaling for responsive layout
const CARD_WIDTH = Math.round(FIGMA_CARD_WIDTH * SCALE);
const CARD_INNER_WIDTH = Math.round(FIGMA_CARD_INNER_WIDTH * SCALE);
const BUTTON_CONTAINER_WIDTH = Math.round(FIGMA_BUTTON_CONTAINER_WIDTH * SCALE);

// Design tokens mapped from Figma extraction (41-9563)
const FIGMA_COLORS = {
  background: '#131313',           // colors.black[700] - Main screen background
  cardBackground: '#202020',       // colors.black[500] - Receipt card (Rectangle 136)
  pillBackground: '#1A1A1A',       // colors.black[600] - Info pill (Frame 1686557297)
  labelText: '#878787',            // colors.neutral[600] - Row labels
  valueText: '#CBCBCB',            // colors.neutral[300] - Row values
  totalValueText: '#DDDDDD',       // colors.neutral[200] - Payable rent value
  pillText: '#DDDDDD',             // colors.neutral[200] - Pill text
  iconColor: '#A6A6A6',            // colors.black[200] - Row icons
  dividerColor: '#4D4D4D',         // colors.black[400] - Dividers (Vector 49)
  titleWhite: '#FFFFFF',           // colors.white - "Payment" text
  stampFailed: '#FF8080',          // colors.error.default - FAILED stamp
  stampRefunded: '#A9A9A9',        // colors.neutral[500] - REFUNDED stamp
  stampSuccess: '#06C270',         // colors.success.approved - PAID stamp
  contactSupport: '#A9A9A9',       // colors.neutral[500] - Contact Support link
};

// Back Arrow Icon - Figma: Outline Icon Library - 32x32, strokeWidth 2.67
const BackArrow = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 24L12 16L20 8"
      stroke={FIGMA_COLORS.titleWhite}
      strokeWidth={2.67}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Paperclip decoration - Figma: Vector 45 (decorative)
const Paperclip = () => (
  <Svg width={23} height={42} viewBox="0 0 23 42" fill="none">
    <Path
      d="M11.5 0C17.299 0 22 4.701 22 10.5V31.5C22 37.299 17.299 42 11.5 42C5.701 42 1 37.299 1 31.5V10.5C1 8.015 3.015 6 5.5 6C7.985 6 10 8.015 10 10.5V29.5"
      stroke={FIGMA_COLORS.dividerColor}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

// Row Icon - 16x16 frame with 10.67x12 inner vector (document/hash icon)
const RowIcon = () => (
  <View style={styles.iconContainer}>
    <Svg width={11} height={12} viewBox="0 0 11 12" fill="none">
      <Path
        d="M3 2H8L10 4V10H3V2Z"
        stroke={FIGMA_COLORS.iconColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 2V4H10"
        stroke={FIGMA_COLORS.iconColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

// Transaction Row Component - Figma: Frame 1686557329 (width 222, height 20)
interface TransactionRowProps {
  label: string;
  value: string;
  isTotal?: boolean;
}

const TransactionRow = ({ label, value, isTotal = false }: TransactionRowProps) => (
  <View style={styles.transactionRow}>
    <View style={styles.labelContainer}>
      <RowIcon />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <Text style={isTotal ? styles.totalValueText : styles.valueText}>{value}</Text>
  </View>
);

// Solid Divider Component - Figma: Vector 49 - width 222, borderWidth 0.25, color #4D4D4D
const SolidDivider = () => <View style={styles.solidDivider} />;

// Perforated Edge Component - Figma: 14 ellipses (Ellipse 21866-21879)
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

export default function FailedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useLocalSearchParams<{ status?: string }>();

  // Determine if this is a refund, failure, or success (for receipt display)
  const isRefunded = status === 'refunded';
  const isPaid = status === 'paid';
  const statusType = isPaid ? 'paid' : isRefunded ? 'refunded' : 'failed';

  useEffect(() => {
    if (!isPaid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [isPaid]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleDownloadReceipt = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement receipt download
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: Implement contact support
  }, []);

  // Title text based on status - Figma: node 41:9627
  const getTitleConfig = () => {
    switch (statusType) {
      case 'paid':
        return { secondLine: 'Succesful', color: FIGMA_COLORS.stampSuccess };
      case 'refunded':
        return { secondLine: 'Refunded', color: FIGMA_COLORS.stampRefunded };
      default:
        return { secondLine: 'Failed', color: FIGMA_COLORS.stampFailed };
    }
  };

  const titleConfig = getTitleConfig();

  return (
    <Screen testID="failed-screen" style={styles.screen}>
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        {/* Back Button - Figma: Frame 2095586345, paddingHorizontal 40 */}
        <View style={styles.headerContainer}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BackArrow />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Receipt Card Container - Figma: Frame 2095586361 */}
          <View style={styles.receiptContainer}>
            {/* Paperclip decoration */}
            <View style={styles.paperclipContainer}>
              <Paperclip />
            </View>

            {/* Card with notches */}
            <View style={styles.receiptCard}>
              {/* Top perforated edge - 14 ellipses positioned half outside card */}
              <PerforatedEdge />

              {/* Left notch - Figma: Ellipse 21890 (14x14 at vertical center) */}
              <View style={[styles.notch, styles.notchLeft]} />
              {/* Right notch - Figma: Ellipse 21891 (14x14 at vertical center) */}
              <View style={[styles.notch, styles.notchRight]} />

              {/* Stamp - Using shared PaymentStamp component, rotated -15deg */}
              <View style={styles.stampPosition}>
                <PaymentStamp status={statusType} size={76} />
              </View>

              {/* Title - Figma: node 41:9627, "Payment" + status text */}
              <View style={styles.titleSection}>
                <Text style={styles.titleWhite}>Payment</Text>
                <Text style={[styles.titleStatus, { color: titleConfig.color }]}>
                  {titleConfig.secondLine}
                </Text>
              </View>

              {/* Transaction Details - Figma: Frame 2095586369 (gap 23) -> Frame 2095586361 (gap 16) */}
              <View style={styles.transactionSection}>
                <View style={styles.transactionDetails}>
                  {/* Amount paid row */}
                  <TransactionRow label="Amount paid" value="₹  32,500" />
                  <SolidDivider />

                  {/* Date row */}
                  <TransactionRow label="Date" value="4 Nov 2026" />
                  <SolidDivider />

                  {/* Method row */}
                  <TransactionRow label="Method" value="UPI (joel@oksbi)" />
                  <SolidDivider />

                  {/* Transaction ID row */}
                  <TransactionRow label="Transaction ID" value="SEC12345678" />
                </View>

                {/* Info pill - Figma: Frame 1686557297 (width 222, height 28) */}
                <View style={styles.infoPill}>
                  <Text style={styles.pillText}>Pay by the 7th to earn cashback.</Text>
                </View>

                <SolidDivider />

                {/* Payable Rent row - emphasized (fontSize 14, fontWeight 600) */}
                <TransactionRow label="Payable Rent" value="₹  32,500" isTotal />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Buttons - Figma: Frame 2095586363 (width 313, gap 16, centered) */}
        <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 24 }]}>
          <PrimaryButton
            title="Download Receipt"
            onPress={handleDownloadReceipt}
            testID="download-receipt-button"
            style={styles.primaryButton}
          />

          <TouchableOpacity onPress={handleContactSupport} style={styles.linkButton}>
            <Text style={styles.contactSupportText}>Contact Support</Text>
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
  },
  headerContainer: {
    // Figma: Frame 2095586345 - paddingHorizontal 40, height 32
    paddingHorizontal: 40,
    marginBottom: 40, // Figma: gap 40 from Frame 2095586343
  },
  backButton: {
    // Figma: Outline Icon Library - 32x32
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 48, // Figma: Frame 2095586343 paddingBottom 48
  },
  receiptContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  paperclipContainer: {
    position: 'absolute',
    top: -8,
    left: 8,
    zIndex: 10,
  },
  receiptCard: {
    // Figma: Rectangle 136 - width 270, height auto, bg #202020
    width: CARD_WIDTH,
    backgroundColor: FIGMA_COLORS.cardBackground,
    paddingHorizontal: 24,
    paddingTop: 68, // Space for stamp and title
    paddingBottom: 24,
    position: 'relative',
    overflow: 'visible',
    // Figma shadow: DROP_SHADOW 0 9 19 #000000
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowRadius: 19,
    shadowOpacity: 1,
    elevation: 10,
  },
  perforatedEdge: {
    // Figma: Row of 14 ellipses at top of card, positioned half outside
    position: 'absolute',
    top: -7,                        // Half outside the card (14/2)
    left: 4,
    right: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  punchHole: {
    // Figma: Ellipse - width 14, height 14, bg #131313
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background,
  },
  notch: {
    position: 'absolute',
    // Figma: Ellipse 21890/21891 - width 14, height 14
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: FIGMA_COLORS.background,
    top: '50%',
    marginTop: -7, // Center vertically (half of 14)
  },
  notchLeft: {
    left: -7, // Half inside, half outside (14/2)
  },
  notchRight: {
    right: -7, // Half inside, half outside (14/2)
  },
  stampPosition: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  titleSection: {
    marginBottom: 24,
  },
  titleWhite: {
    // Figma 41:9627: fontSize 20, lineHeight 32, fontWeight 400, color #FFFFFF
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    color: FIGMA_COLORS.titleWhite,
    textAlign: 'left', // Figma: textAlignHorizontal LEFT for title
  },
  titleStatus: {
    // Figma: fontSize 20, lineHeight 32, fontWeight 400, color varies by status
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 20,
    lineHeight: 32,
    textAlign: 'left',
  },
  transactionSection: {
    // Figma: Frame 2095586369 - gap 23, counterAlign CENTER
    gap: 23,
    alignItems: 'center',
  },
  transactionDetails: {
    // Figma: Frame 2095586361 - width 222, gap 16
    width: CARD_INNER_WIDTH,
    gap: 16,
  },
  transactionRow: {
    // Figma: Frame 1686557329 - width 222, height 20, flexDirection row, justifyContent space-between
    width: CARD_INNER_WIDTH,
    height: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4, // Figma: itemSpacing 4
  },
  labelContainer: {
    // Figma: Frame 1686557121 - flexDirection row, alignItems center, gap 4
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    // Figma: Frame - width 16, height 16, contains vector 10.67x12
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    // Figma 41:9578: fontSize 12, lineHeight 20, fontWeight 400, color #878787, textAlign CENTER
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.labelText,
    textAlign: 'center', // CRITICAL: Figma specifies CENTER alignment
  },
  valueText: {
    // Figma 41:9579: fontSize 12, lineHeight 20, fontWeight 400, color #CBCBCB, textAlign CENTER
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.valueText,
    textAlign: 'center',
  },
  totalValueText: {
    // Figma: fontSize 14, lineHeight 20, fontWeight 600, color #DDDDDD, textAlign CENTER
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: FIGMA_COLORS.totalValueText,
    textAlign: 'center',
  },
  solidDivider: {
    // Figma: Vector 49 - width 222, height 0, borderColor #4D4D4D, borderWidth 0.25, opacity 0.25
    width: CARD_INNER_WIDTH,
    height: StyleSheet.hairlineWidth,
    backgroundColor: FIGMA_COLORS.dividerColor,
    opacity: 0.25, // Figma spec: 0.25 opacity divider
  },
  infoPill: {
    // Figma: Frame 1686557297 - width 222, height 28, bg #1A1A1A, borderRadius 40, padding 4/12
    width: CARD_INNER_WIDTH,
    height: 28,
    backgroundColor: FIGMA_COLORS.pillBackground,
    borderRadius: 40,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    // Figma 41:9602: fontSize 12, lineHeight 20, fontWeight 400, color #DDDDDD, textAlign CENTER
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.pillText,
    textAlign: 'center', // CRITICAL: Figma specifies CENTER alignment
  },
  buttonContainer: {
    // Figma: Frame 2095586363 - width 313, gap 16, counterAlign CENTER
    width: BUTTON_CONTAINER_WIDTH,
    alignSelf: 'center',
    gap: 16,
    alignItems: 'center',
  },
  primaryButton: {
    // Figma: button - width 313, height 52
    width: BUTTON_CONTAINER_WIDTH,
    height: 52,
  },
  linkButton: {
    // Figma 41:9630: width 313, height 20
    width: BUTTON_CONTAINER_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactSupportText: {
    // Figma 41:9630: fontSize 12, lineHeight 20, fontWeight 400, color #A9A9A9, textAlign CENTER
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: FIGMA_COLORS.contactSupport,
    textAlign: 'center', // CRITICAL: Figma specifies CENTER alignment
  },
});
