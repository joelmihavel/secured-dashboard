import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text as RNText } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { Screen, PrimaryButton } from '@/src/components';
import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { paymentsApi } from '@/src/services/api/payments';
import { colors } from '@/src/theme';
const fmt = (n: number) => n.toLocaleString('en-IN');

// ── Icons ────────────────────────────────────────────────────────────────────

const BackArrow = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19 12H5M5 12L12 19M5 12L12 5"
      stroke="#EEEEEE"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const HashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M6 2L4 14M12 2L10 14M2 6H14M2 10H14"
      stroke="#A9A9A9"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const Crosshatch = ({ x, y }: { x: number; y: number }) => (
  <Svg width={22} height={22} viewBox="0 0 22 22" fill="none" style={{ position: 'absolute', left: x, top: y }}>
    <Path
      d="M11 1L11 21M1 11H21"
      stroke="#4D4D4D"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const GridLines = () => (
  <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: 0.1 }]} pointerEvents="none">
    {[...Array(20)].map((_, i) => (
      <View key={`h-${i}`} style={{ position: 'absolute', top: i * 20, left: 0, right: 0, height: 1, backgroundColor: '#FFFFFF' }} />
    ))}
    {[...Array(15)].map((_, i) => (
      <View key={`v-${i}`} style={{ position: 'absolute', left: i * 20, top: 0, bottom: 0, width: 1, backgroundColor: '#FFFFFF' }} />
    ))}
  </View>
);

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const { tenancy, upcomingPayment, cashback, refreshDashboard } = useDashboard();
  const { amount, selectedMethod } = usePaymentStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState('');

  // --- Countdown Logic ---
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const h = 23 - now.getHours();
      const m = 59 - now.getMinutes();
      const s = 59 - now.getSeconds();
      setCountdown(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Payment Data ---
  const isVerified = tenancy?.verification_status?.status === 'approved';
  // Figma 684:12294 shows 10.9% late fee if past cut-off. We simulate standard here.
  const isLatePayment = false;

  const baseRent = tenancy?.monthly_rent || 30000;
  const maintenance = 2500;
  const totalRent = baseRent + maintenance;

  const cashbackPct = cashback?.discount_rate ?? 0.01;
  const cashbackAmount = Math.round(totalRent * cashbackPct);

  const hasConvenienceFee = true;
  const feeAmount = selectedMethod?.type === 'upi' ? 0 : 100;

  const appliedCashback = isVerified ? cashbackAmount : 0;
  const payableAmount = totalRent + feeAmount - appliedCashback;

  const isCreditCard = selectedMethod?.type === 'card' && selectedMethod?.cardType === 'credit';

  const date = new Date();
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const rentMonthText = upcomingPayment?.rent_month 
    ? upcomingPayment.rent_month.toUpperCase() 
    : `${monthNames[date.getMonth()]} ${date.getFullYear()} RENT`;

  // --- Dynamic Strings ---
  const topTitle = rentMonthText;
  let topSubtitle = `Due ${upcomingPayment?.due_date ? new Date(upcomingPayment.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '5th of month'}`;
  let topPill = `Earn ₹ ${fmt(cashbackAmount)} Cashback`;

  if (isLatePayment) {
    topSubtitle = 'Late Payment';
    topPill = '0% Cashback Earned';
  } else if (!isVerified) {
    topSubtitle = `Ends in ${countdown}`;
    topPill = `Potential ₹ ${fmt(cashbackAmount)} Cashback`;
  } else {
    topSubtitle = `Ends in ${countdown}`;
  }

  // --- Handlers ---
  const handlePayNow = async () => {
    if (!selectedMethod || !tenancy) return;
    setIsProcessing(true);

    try {
      const response = await paymentsApi.initiatePayment({
        amount: payableAmount,
        methodId: selectedMethod.id,
        tenancyId: tenancy.id,
      });

      if (response.data) {
        usePaymentStore.getState().setTransactionId(response.data.transaction_id);
        
        const isUpiApp = selectedMethod.type === 'upi' && selectedMethod.upiType === 'app';
        if (isUpiApp && response.data.upi_intent_url) {
          // In a real app, open Intent URL.
          // Linking.openURL(response.data.upi_intent_url);
        }
        
        router.replace('/(payment)/status');
      } else {
        throw new Error(response.error || 'Failed to initiate payment');
      }
    } catch (err: any) {
      usePaymentStore.getState().setError({
        code: 'INIT_FAILED',
        message: err.message,
      });
      router.replace('/(payment)/status');
    } finally {
      setIsProcessing(false);
    }
  };

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
          isTotal && { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, color: '#FFFFFF' },
          isCashback && { color: '#70BF73' },
        ]}
      >
        {value}
      </RNText>
    </View>
  );

  return (
    <Screen testID="confirm-payment-screen" style={styles.screen} padded={false}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
              <BreakdownRow label="Base rent" value={`₹ ${fmt(baseRent)}`} />
              <View style={styles.divider} />
              <BreakdownRow label="Maintenance" value={`₹${fmt(maintenance)}`} />
            </View>

            {/* Section 2: Total + Cashback + Payable */}
            <View style={styles.breakdownSection}>
              <View style={styles.divider} />
              <BreakdownRow label="Total Rent" value={`₹  ${fmt(totalRent)}`} />

              {hasConvenienceFee && (
                <BreakdownRow label="Convenience Fee" value={`₹${fmt(feeAmount)}`} />
              )}

              {isVerified ? (
                <BreakdownRow
                  label="Cashback"
                  value={`- ₹  ${fmt(cashbackAmount)}`}
                  isCashback
                />
              ) : (
                <BreakdownRow
                  label="Cashback"
                  value={`₹${fmt(cashbackAmount)}`}
                />
              )}

              <View style={styles.divider} />
              <BreakdownRow
                label="Payable Amount"
                value={`₹  ${fmt(payableAmount)}`}
                isTotal
              />

              {isCreditCard && (
                <View style={styles.bankFeesBanner}>
                  <RNText style={styles.bankFeesText}>
                    Additional bank fees upto 1% might apply
                  </RNText>
                </View>
              )}
            </View>

            {/* Perforations at y:256 */}
            <View style={styles.perforations}>
              {[...Array(14)].map((_, i) => (
                <View key={i} style={styles.perforationHole} />
              ))}
            </View>

            {/* Side notches at y:256 */}
            <View style={[styles.sideNotch, styles.sideNotchLeft]} />
            <View style={[styles.sideNotch, styles.sideNotchRight]} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ===== Floating Bottom Bar ===== */}
      <View style={styles.bottomBar}>
        <PrimaryButton
          title="Pay now →"
          onPress={handlePayNow}
          loading={isProcessing}
        />
      </View>
    </Screen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 100, // Make room for bottom bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    color: '#EEEEEE',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  cardContainer: {
    alignItems: 'center',
  },
  // -- Top Card --
  topCard: {
    width: 312,
    height: 120,
    backgroundColor: '#303030',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  topCardContent: {
    padding: 16,
    flex: 1,
  },
  topCardTitle: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 20,
    color: '#DDDDDD',
    marginBottom: 4,
  },
  topCardSubtitle: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#A9A9A9',
  },
  cashbackNote: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 10,
    color: '#A9A9A9',
    marginTop: 8,
  },
  cashbackPill: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#70BF73',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cashbackPillText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    color: '#1A1A1A',
  },
  topCardDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: '#202020', // Matches bottom card
  },
  // -- Bottom Card (Receipt) --
  breakdownWrapper: {
    width: 270, // Matched to Figma 799-3380 
    alignItems: 'center',
    position: 'relative',
    marginTop: -8, // Pull up under the top card
    zIndex: 2,
  },
  bottomCard: {
    width: 270,
    backgroundColor: '#202020',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
    position: 'relative',
  },
  breakdownSection: {
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#4D4D4D',
    marginVertical: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#DDDDDD',
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#EEEEEE',
  },
  bankFeesBanner: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: 'center',
  },
  bankFeesText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    color: '#DDDDDD',
    textAlign: 'center',
    lineHeight: 20,
  },
  // -- Details (Perforations) --
  perforations: {
    position: 'absolute',
    top: 256,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
    zIndex: 3,
  },
  perforationHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#131313', // Match screen background
  },
  sideNotch: {
    position: 'absolute',
    top: 256,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#131313', // Match screen background
    zIndex: 3,
  },
  sideNotchLeft: {
    left: -7,
  },
  sideNotchRight: {
    right: -7,
  },
  // -- Bottom Bar --
  bottomBar: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
