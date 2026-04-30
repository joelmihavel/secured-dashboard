/**
 * ConfirmPaymentContent — Confirm Payment View (Bottom Sheet)
 *
 * Full receipt design adapted from confirm.tsx for rendering inside
 * the PaymentMethodModal bottom sheet. Shows rent breakdown with
 * cashback info before the user commits to the PayU SDK launch.
 *
 * Only used in payment context — never in profile/edit-method flows.
 *
 * Figma Reference: 799:3380
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text as RNText,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';

import { PrimaryButton, BackButton } from '@/src/components/ui/Button';
import { Pill } from '@/src/components/ui/Pill';
import { BgLine } from '@/src/components/ui/BgLine';
import { useDashboard, useFeeRates } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores';
import { getGatewayFeeRates, getPaymentGateway, computeFee } from '@/src/services/payment';
import type { FeeRateConfig, GatewayFeeRates } from '@/src/services/payment';
import type { ConfirmPaymentContentProps, PaymentMethodType } from './types';
import { colors } from '@/src/theme';

const fmt = (n: number) => n.toLocaleString('en-IN');

const ZERO_FEE: FeeRateConfig = { rate: 0, fee_type: 'percentage' };

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

// ── Main Component ──────────────────────────────────────────────────────────

export function ConfirmPaymentContent({
  onBack,
  onPay,
  isPaying,
  methodType,
  methodLabel,
}: ConfirmPaymentContentProps) {
  const { tenancy, upcomingPayment, cashback, user } = useDashboard();
  const { data: feeRates } = useFeeRates();
  const enteredAmount = usePaymentStore((s) => s.enteredAmount);

  // ── Payment Data ───────────────────────────────────────────────────────────

  const rentAmount = enteredAmount || tenancy?.monthly_rent || 0;
  const pastCutoff = upcomingPayment?.past_cutoff ?? false;

  const cashbackPct = cashback?.discount_rate ?? 0.01;
  const agreementRent = tenancy?.monthly_rent ?? rentAmount;
  const cashbackAmount = pastCutoff ? 0 : Math.round(Math.min(rentAmount, agreementRent) * cashbackPct);
  const annualSavings = pastCutoff ? 0 : Math.round(agreementRent * cashbackPct) * 12;

  // Accumulated balance from previous unverified payments (stored in paise)
  const accumulatedBalanceRupees = pastCutoff ? 0 : Math.floor((user?.cashback_balance_paise ?? 0) / 100);

  // Flat ₹1000 promo bonus — gated by upcoming_payment.flat_bonus_eligible
  // (server is source of truth). Cap at remaining rent room with a ₹1 floor
  // so the gateway always has > 0 to charge — matches initiate-payment.
  const flatBonusEligible = !pastCutoff && (upcomingPayment?.flat_bonus_eligible ?? false);
  const flatBonusBaseRupees = upcomingPayment?.flat_bonus_paise != null
    ? Math.floor(upcomingPayment.flat_bonus_paise / 100)
    : 1000;
  const onePctApplied = Math.min(cashbackAmount, rentAmount);
  const accumulatedAfterOnePct = Math.max(
    0,
    Math.min(accumulatedBalanceRupees, rentAmount - onePctApplied),
  );
  const headroom = Math.max(0, rentAmount - onePctApplied - accumulatedAfterOnePct - 1);
  const flatBonusApplied = flatBonusEligible
    ? Math.min(flatBonusBaseRupees, headroom)
    : 0;

  // Always apply cashback as instant discount (1% + any accumulated + flat)
  const appliedCashback = onePctApplied + accumulatedAfterOnePct + flatBonusApplied;
  const earnedCashback = 0;

  // Fee computed on net rent (AFTER cashback) — matches backend formula
  const netRent = rentAmount - appliedCashback;
  const rates = feeRates ?? getGatewayFeeRates();
  const feeConfig = getFeeConfig(rates, methodType);
  const convenienceFee = computeFee(feeConfig, netRent);

  // Bank fees pill adds ~72px (pill 48 + gap 24) — shift notches & grid line down
  const isCard = methodType === 'card';
  const pillOffset = isCard ? 72 : 0;

  // Convenience fee always shown in payable amount for both gateways
  const gateway = getPaymentGateway();
  const payableAmount = netRent + convenienceFee;

  const alreadyPaid = upcomingPayment?.already_paid ?? false;
  const rawDaysUntilDue = upcomingPayment?.due_date
    ? Math.ceil(
        (new Date(upcomingPayment.due_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const dueLabel = alreadyPaid
    ? 'Rent paid'
    : rawDaysUntilDue === null
      ? 'Pay your rent'
      : rawDaysUntilDue < 0
        ? `Rent overdue by ${Math.abs(rawDaysUntilDue)} days`
        : rawDaysUntilDue === 0
          ? 'Rent due today'
          : `Rent due in ${rawDaysUntilDue} days`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.outerContainer}>
      <View style={s.stickyHeader}>
        <BackButton
          onPress={onBack}
          style={s.backButton}
          color={colors.white}
        />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Info Card — Figma 799:3384 ──────────────────────────────── */}
        <View style={s.infoCard}>
          <View style={s.infoTextArea}>
            <RNText style={s.rentDueText}>
              {dueLabel}
            </RNText>
            {pastCutoff ? (
              <Pill
                text="Cashbacks aren't applied on late payments"
                variant="default"
                backgroundColor="#1A1A1A"
                textColor="#878787"
                style={s.cashbackPill}
              />
            ) : (
              <>
                <RNText style={s.cashbackInfoText}>
                  You'll earn {Math.round(cashbackPct * 100)}% cashback on this rent payment
                </RNText>
                <Pill
                  text={`You're saving \u20B9${fmt(annualSavings)} annually`}
                  variant="default"
                  backgroundColor="#1A1A1A"
                  style={s.cashbackPill}
                />
              </>
            )}
          </View>

          {/* Divider bar — Figma 799:3391 */}
          <View style={s.dividerBar} />

          {/* Decorative crosshatches */}
          <Crosshatch x={16.25} y={17} />
          <Crosshatch x={277.25} y={87} />
        </View>

        {/* ── Receipt Area with decorative grid lines ──────────────────── */}
        <View style={s.receiptContainer}>
          <BgLine style={[s.gridLines, { top: 66 + pillOffset }]} />

          <View style={s.receiptCard}>
            {/* Section 1: Rent amount */}
            <View style={s.section1}>
              <BreakdownRow label="Rent" value={`\u20B9 ${fmt(rentAmount)}`} />
            </View>

            {/* Section 2: Totals — Figma 799:3415 */}
            <View style={s.section2}>
              <View style={s.dividerLine} />
              <BreakdownRow
                label="Convenience fees"
                value={convenienceFee === 0 ? 'Free' : `\u20B9 ${fmt(convenienceFee)}`}
              />
              {!pastCutoff && flatBonusApplied > 0 && (
                <BreakdownRow
                  label="Bonus Cashback"
                  value={`-₹ ${fmt(flatBonusApplied)}`}
                  isCashback
                />
              )}
              {!pastCutoff && onePctApplied > 0 && (
                <BreakdownRow
                  label="Cashback (1%)"
                  value={`-\u20B9 ${fmt(onePctApplied)}`}
                  isCashback
                />
              )}
              {!pastCutoff && accumulatedAfterOnePct > 0 && (
                <BreakdownRow
                  label="Cashback balance"
                  value={`-\u20B9 ${fmt(accumulatedAfterOnePct)}`}
                  isCashback
                />
              )}
              <View style={s.dividerLine} />
              <BreakdownRow
                label="Payable amount"
                value={`\u20B9 ${fmt(payableAmount)}`}
                isTotal
              />

              {/* Bank fees pill — credit card only, PayU only (Cashfree bills fee ourselves) */}
              {methodType === 'card' && gateway !== 'cashfree' && (
                <View style={s.bankFeePill}>
                  <RNText style={s.bankFeePillText}>Additional bank fees upto 1% might apply</RNText>
                </View>
              )}
            </View>


            {/* Side notches — shift down when bank fees pill is visible */}
            <View style={[s.sideNotch, s.sideNotchLeft, { top: 256 + pillOffset }]} />
            <View style={[s.sideNotch, s.sideNotchRight, { top: 256 + pillOffset }]} />
          </View>
        </View>

        {/* ── Button Section ───────────────────────────────────────────── */}
        <View style={s.buttonSection}>
          <PrimaryButton
            title={`Pay \u20B9 ${fmt(payableAmount)} now`}
            onPress={onPay}
            loading={isPaying}
            disabled={isPaying || alreadyPaid}
            showDivider
          />
          <RNText style={s.footerText}>
            Settlement will be processed in less than 24 hours
          </RNText>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  outerContainer: {
    flexShrink: 1,
    paddingTop: 16,
  },
  stickyHeader: {
    paddingHorizontal: 40,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: 24,
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
  rentDueText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.24,
    color: '#878787',
    textAlign: 'center',
  },
  cashbackInfoText: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.56,
    color: '#CBCBCB',
    textAlign: 'center',
  },
  cashbackPill: {
    alignSelf: 'center',
  },
  dividerBar: {
    width: 268,
    height: 5,
    backgroundColor: '#1A1A1A',
    alignSelf: 'center',
  },

  // ── Receipt Area ──────────────────────────────────────────────────────────
  receiptContainer: {
    alignItems: 'center',
    marginTop: -24,
  },
  gridLines: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    width: 369,
    height: 235,
    zIndex: -1,
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

  section1: {
    paddingHorizontal: 24,
    gap: 16,
  },
  section2: {
    paddingHorizontal: 24,
    gap: 24,
    marginTop: 18,
    paddingBottom: 24,
  },

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
  breakdownLabel: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#878787',
  },
  breakdownValue: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#CBCBCB',
  },
  breakdownValueTotal: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#DDDDDD',
  },
  breakdownValueCashback: {
    color: '#EF9194',
  },
  breakdownValueAccrued: {
    color: '#FF9A6D',
  },

  dividerLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#4D4D4D',
  },

  sideNotch: {
    position: 'absolute',
    top: 256,
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

  // ── Bank fee pill (credit card only) ─────────────────────────────────────
  bankFeePill: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bankFeePillText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#DDDDDD',
    textAlign: 'center',
  },


  // ── Button Section ──────────────────────────────────────────────────────
  buttonSection: {
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 24,
    gap: 16,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 12,
    lineHeight: 20,
    color: '#A9A9A9',
    textAlign: 'center',
  },
});
