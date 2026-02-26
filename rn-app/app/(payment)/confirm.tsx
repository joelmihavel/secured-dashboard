/**
 * Confirm Payment Screen
 *
 * Shown AFTER payment method selection, BEFORE PayU SDK launch.
 * Replaces initiate.tsx with improved cashback logic based on verification state.
 *
 * Two visual states:
 *   - Verified: cashback deducted from payable amount
 *   - Unverified: cashback shown but locked (not deducted)
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Line } from 'react-native-svg';

import { Screen, PrimaryButton, ScrollDownIndicator } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { PAYMENT_COLORS } from '@/src/theme';

// ==============================================
// FIGMA COLOR TOKENS — aliased from shared PAYMENT_COLORS
// ==============================================

const C = {
  bg: PAYMENT_COLORS.background,
  card: PAYMENT_COLORS.cardBackground,
  cardDivider: PAYMENT_COLORS.cardDivider,
  label: PAYMENT_COLORS.labelText,
  value: PAYMENT_COLORS.valueText,
  valueTotal: PAYMENT_COLORS.highlightText,
  cashback: PAYMENT_COLORS.cashbackDeduct,
  accent: PAYMENT_COLORS.accent,
  muted: PAYMENT_COLORS.mutedText,
  timerHighlight: PAYMENT_COLORS.brightText,
  divider: PAYMENT_COLORS.divider,
  white: PAYMENT_COLORS.white,
} as const;

// ==============================================
// ICONS
// ==============================================

const BackArrow = () => (
  <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path d="M14.67 8L6.67 16L14.67 24" stroke={C.white} strokeWidth={2.67} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M6.67 16H25.33" stroke={C.white} strokeWidth={2.67} strokeLinecap="round" />
  </Svg>
);

const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path d="M6 2L4 14M12 2L10 14M2 6H14M2 10H14" stroke={C.label} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Crosshatch = ({ x, y }: { x: number; y: number }) => (
  <View style={[styles.crosshatch, { left: x, top: y }]}>
    <Svg width={20.5} height={35} viewBox="0 0 20.5 35">
      <Line x1={20.5} y1={0} x2={0} y2={20.5} stroke={C.divider} strokeWidth={0.3} />
      <Line x1={20.5} y1={14.5} x2={0} y2={35} stroke={C.divider} strokeWidth={0.3} />
    </Svg>
  </View>
);

/** Grid lines behind breakdown card — Figma 684:13133 (369x234.5) */
const GridLines = () => (
  <View style={styles.gridContainer} pointerEvents="none">
    <Svg width={369} height={235} viewBox="0 0 369 235" fill="none">
      <Line x1={36.8} y1={0} x2={36.8} y2={235} stroke={C.divider} strokeWidth={0.3} />
      <Line x1={0} y1={36.8} x2={369} y2={36.8} stroke={C.divider} strokeWidth={0.3} />
      <Line x1={339.5} y1={0} x2={339.5} y2={235} stroke={C.divider} strokeWidth={0.3} />
      <Line x1={0} y1={197.8} x2={369} y2={197.8} stroke={C.divider} strokeWidth={0.3} />
    </Svg>
  </View>
);

// ==============================================
// BREAKDOWN ROW
// ==============================================

const BreakdownRow = ({
  label,
  value,
  isTotal = false,
  isCashback = false,
}: {
  label: string;
  value: string;
  isTotal?: boolean;
  isCashback?: boolean;
}) => (
  <View style={styles.breakdownRow}>
    <View style={styles.breakdownLabelGroup}>
      <HashIcon />
      <RNText style={styles.breakdownLabel}>{label}</RNText>
    </View>
    <RNText
      style={[
        styles.breakdownValue,
        isTotal && styles.breakdownValueTotal,
        isCashback && styles.breakdownValueCashback,
      ]}
    >
      {value}
    </RNText>
  </View>
);

// ==============================================
// FORMATTING HELPER
// ==============================================

function fmt(n: number): string {
  return n.toLocaleString('en-IN');
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ==============================================
// SCREEN
// ==============================================

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tenancy, upcomingPayment, cashback } = useDashboard();

  const storedAmount = usePaymentStore((state) => state.amount);
  const verificationSkipped = usePaymentStore((state) => state.verificationSkipped);

  // Concurrent payment guard
  const isPaymentInFlight = useRef(false);

  // Scroll indicator state
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  // --- Verification state ---
  const isSetupComplete =
    (tenancy?.verification_status?.bank_verified &&
      tenancy?.verification_status?.utility_verified &&
      tenancy?.verification_status?.landlord_approved) ?? false;

  const daysUntilDue = upcomingPayment?.days_until_due ?? 10;
  const isLatePayment = daysUntilDue < 0;
  const isPastCutoff = upcomingPayment?.past_cutoff ?? false;
  const cutoffDay = upcomingPayment?.cutoff_day ?? 7;

  // The user is "verified" if setup is complete, verification was NOT skipped,
  // payment is not late, AND payment is before the cashback cutoff date
  const isVerified = isSetupComplete && !verificationSkipped && !isLatePayment && !isPastCutoff;

  // --- Breakdown values ---
  const baseRent = tenancy?.monthly_rent || 30000;
  const maintenance = 2500;
  const totalRent = baseRent + maintenance;

  const cashbackPct = cashback?.discount_rate ?? 0.01;
  const cashbackAmount = Math.round(totalRent * cashbackPct);

  // Convenience fee per Figma 684:13115
  const hasConvenienceFee = true;
  const feeAmount = 100;

  // Cashback deduction only if verified
  const appliedCashback = isVerified ? cashbackAmount : 0;
  const payableAmount = totalRent + feeAmount - appliedCashback;

  // Annual savings for verified banner
  const annualSavings = cashbackAmount * 12;

  // --- Countdown timer (for unverified state) ---
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Timer for both verified and unverified (shown in footer); skip for late payments
    if (isLatePayment) return;

    const updateCountdown = () => {
      const hoursLeft = daysUntilDue * 24;
      const now = new Date();
      const h = Math.max(0, hoursLeft - now.getHours());
      const m = 59 - now.getMinutes();
      const s = 59 - now.getSeconds();
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [daysUntilDue, isVerified, isLatePayment]);

  // --- Dynamic texts based on verification state ---
  let topTitle = `Rent due in ${daysUntilDue} days`;
  let topSubtitle = '';
  let topPill = '';
  let footerText: React.ReactNode = null;

  if (isLatePayment) {
    topTitle = `Rent overdue by ${Math.abs(daysUntilDue)} days`;
    topSubtitle = 'No cashback on this payment';
    topPill = 'Pay on time next month to earn 1% cashback';
    footerText = 'Pay before the due date next month to earn 1% cashback';
  } else if (isPastCutoff && isSetupComplete && !verificationSkipped) {
    topTitle = `Rent due in ${daysUntilDue} days`;
    topSubtitle = 'Cashback cutoff date has passed';
    topPill = `Pay by the ${cutoffDay}${ordinalSuffix(cutoffDay)} next month to earn 1% cashback`;
    footerText = `Cashback is available only for payments made by the ${cutoffDay}${ordinalSuffix(cutoffDay)} of the month`;
  } else if (isVerified) {
    // Verified state: cashback applied and deducted
    topSubtitle = 'You\u2019ll earn 1% cashback on this rent payment';
    topPill = `Get \u20B9${fmt(cashbackAmount)} cashback after payment`;
    footerText = (
      <RNText style={styles.footerText}>
        {'Pay in '}
        <RNText style={styles.footerCountdown}>{countdown}</RNText>
        {` to be eligible for \u20B9${fmt(cashbackAmount)} cashback on this payment`}
      </RNText>
    );
  } else {
    // Unverified state: cashback shown but locked
    topSubtitle = 'You will earn 1% cashback on this rent payment';
    topPill = `\u20B9${fmt(cashbackAmount)} available to unlock`;
    footerText = (
      <RNText style={styles.footerText}>
        {'Finish verification in '}
        <RNText style={styles.footerCountdown}>{countdown}</RNText>
        {' to claim cashback on this payment'}
      </RNText>
    );
  }

  // --- Handlers ---
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handlePayNow = useCallback(() => {
    if (isPaymentInFlight.current) return;
    isPaymentInFlight.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push('/(payment)/status');

    // Reset guard after navigation completes (allow re-entry if user comes back)
    setTimeout(() => {
      isPaymentInFlight.current = false;
    }, 1000);
  }, [router]);

  return (
    <Screen testID="confirm-screen" style={styles.screen} padded={false}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ===== Back Button ===== */}
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="confirm-back-button"
        >
          <BackArrow />
        </TouchableOpacity>

        {/* ===== Card Container ===== */}
        <View style={styles.cardContainer}>

          {/* --- Top Card --- */}
          <View style={styles.topCard}>
            <View style={styles.topCardContent}>
              <RNText style={styles.topCardTitle}>{topTitle}</RNText>
              <RNText style={styles.topCardSubtitle}>{topSubtitle}</RNText>

              {/* Cashback note for unverified users */}
              {!isVerified && !isLatePayment && (
                <RNText style={styles.cashbackNote}>
                  Cashback can be claimed post verification in next rent payment
                </RNText>
              )}

              {/* Cashback pill */}
              <View style={styles.cashbackPill}>
                <RNText style={styles.cashbackPillText}>{topPill}</RNText>
              </View>
            </View>

            {/* Divider bar */}
            <View style={styles.topCardDivider} />

            {/* Decorative crosshatches */}
            <Crosshatch x={16.25} y={17} />
            <Crosshatch x={277.25} y={87} />
          </View>

          {/* --- Bottom Card / Receipt with Grid Lines behind --- */}
          <View style={styles.breakdownWrapper}>
            <View style={styles.bottomCard}>
            <GridLines />
            {/* Section 1: Base rent + Maintenance */}
            <View style={styles.breakdownSection}>
              <BreakdownRow label="Base rent" value={`\u20B9 ${fmt(baseRent)}`} />
              <View style={styles.divider} />
              <BreakdownRow label="Maintenance" value={`\u20B9${fmt(maintenance)}`} />
            </View>

            {/* Section 2: Total + Cashback + Payable */}
            <View style={styles.breakdownSection}>
              <View style={styles.divider} />
              <BreakdownRow label="Total Rent" value={`\u20B9  ${fmt(totalRent)}`} />

              {hasConvenienceFee && (
                <BreakdownRow label="Convenience Fee" value={`\u20B9${fmt(feeAmount)}`} />
              )}

              {isVerified ? (
                <BreakdownRow
                  label="Cashback"
                  value={`- \u20B9  ${fmt(cashbackAmount)}`}
                  isCashback
                />
              ) : (
                <BreakdownRow
                  label="Cashback \uD83D\uDD12"
                  value={`\u20B9${fmt(cashbackAmount)}`}
                />
              )}

              <View style={styles.divider} />
              <BreakdownRow
                label="Payable Amount"
                value={`\u20B9  ${fmt(payableAmount)}`}
                isTotal
              />
            </View>

            {/* Perforations at y:256 */}
            <View style={styles.leftPerforation} />
            <View style={styles.rightPerforation} />
          </View>
          </View>
        </View>

        {/* ===== Spacer ===== */}
        <View style={styles.spacer} />

        {/* ===== CTA Section ===== */}
        <View style={styles.ctaWrapper}>
          <PrimaryButton
            title={`Pay \u20B9${fmt(payableAmount)} now`}
            onPress={handlePayNow}
            showDivider
            testID="pay-now-button"
          />

          {/* Footer text */}
          {typeof footerText === 'string' ? (
            <RNText style={styles.footerText}>{footerText}</RNText>
          ) : (
            footerText
          )}
        </View>
      </ScrollView>

      <ScrollDownIndicator visible={!isAtBottom} onPress={scrollToBottom} />
    </Screen>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  screen: {
    backgroundColor: C.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Back button — compact like Profile screen
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 40,
  },

  // Card container
  cardContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 24,
  },

  // Top Card
  topCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 32,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  topCardContent: {
    alignItems: 'center',
    gap: 16,
  },
  topCardTitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: C.label,
  },
  topCardSubtitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: C.value,
    textAlign: 'center',
  },
  cashbackNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  cashbackPill: {
    backgroundColor: C.cardDivider,
    borderRadius: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.accent,
    textAlign: 'center',
  },
  topCardDivider: {
    height: 5,
    width: 268,
    backgroundColor: C.cardDivider,
  },
  crosshatch: {
    position: 'absolute',
  },

  // Grid + breakdown wrapper
  breakdownWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: (270 - 369) / 2,
    width: 369,
    height: 235,
    zIndex: 0,
  },

  // Bottom Card / Receipt — Figma 684:13148 (270x423)
  bottomCard: {
    backgroundColor: C.card,
    width: 270,
    paddingTop: 56,
    paddingBottom: 24,
    gap: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.1,
    shadowRadius: 19,
    elevation: 10,
    position: 'relative',
    alignItems: 'center',
  },

  breakdownSection: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.label,
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: C.value,
  },
  breakdownValueTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: C.valueTotal,
  },
  breakdownValueCashback: {
    color: C.cashback,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    width: '100%',
  },

  leftPerforation: {
    position: 'absolute',
    left: -6,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.bg,
  },
  rightPerforation: {
    position: 'absolute',
    right: -7,
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.bg,
  },

  spacer: {
    flex: 1,
    minHeight: 40,
  },

  ctaWrapper: {
    paddingHorizontal: 40,
    gap: 16,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
  },
  footerCountdown: {
    fontFamily: 'PlusJakartaSans-Medium',
    color: C.timerHighlight,
    textDecorationLine: 'underline',
  },
  footerHighlight: {
    fontFamily: 'PlusJakartaSans-Regular',
    color: C.white,
  },
});
