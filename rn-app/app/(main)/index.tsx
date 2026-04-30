/**
 * Main Home Screen - Active State Implementation
 * Displays dashboard with multiple active state variants based on Figma designs
 *
 * Figma Pixel-Perfect References:
 * Active States:
 * - 243-2762: Active, Bank/UPI only (with recent payments list)
 * - 243-2967: Active, complete setup, all methods (VISA card)
 * - 243-3170: Active, late payment warning (overdue)
 * - 243-3378: Active, missed payment
 * - 243-7185: Active with Cashbacks tab showing
 *
 * Empty States:
 * - 243-4062: Base empty state (Setup payment + Setup progress)
 * - 243-2681: Setup Payment - UPI modal
 * - 243-6490: Setup Payment modal selection
 * - 243-5689: Empty with UPI, Recent Payments tab
 * - 243-5277: With UPI payments
 * - 243-5483: Paid rent state
 * - 243-5870: With cashbacks
 * - 243-6296: No cashbacks
 *
 * Figma Key Values (684:8846 / 243-3170):
 * - Screen background: #131313 (black[700])
 * - Main content gap: 24px (Figma 684:8847 itemSpacing)
 * - Main content paddingBottom: 48px (Figma 684:8847)
 * - Header paddingVertical: 24px, paddingHorizontal: 32px (Figma 684:9047)
 * - Header logo-to-greeting gap: 16px (Figma 684:9049)
 * - Headline/Carousel paddingLeft: 64px, paddingRight: 32px
 * - Tab section gap: 48px (Figma 684:9002)
 * - Bottom footer height: 118px
 *
 * Pixel-Perfect Parity Fixes Applied (Figma 684:8846):
 * - Root background: #131313 (colors.black[700]) via Screen component
 * - Spacing: gap 12 (tightened from Figma 24 for visual density), paddingBottom 48, tabSection gap 48
 * - HomeHeader padding restored: paddingV 24, gap 16 (Figma 684:9047/9049)
 * - Removed double-padding on headlineContainer (HeadlineSection handles its own 64px padding)
 * - Removed double-padding on carouselSection (PaymentMethodCarousel handles its own 64/32px padding)
 * - Removed double-padding on tabContent (sub-components handle their own 32px padding)
 * - BottomFooter positioned absolutely at bottom with height 118px, bg #202020
 * - ScrollView paddingBottom accounts for footer (118px) when footer visible
 * - Disabled SafeAreaView top inset on Screen to prevent double safe-area padding
 * - Tab container centered with textAlign: 'center' on tab labels (Figma 243:2776+)
 * - All text alignment matches Figma CENTER specification
 */

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Linking, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Logo, PrimaryButton, DottedGridPattern } from '@/src/components';
import {
  HomeHeader,
  HeadlineSection,
  StatusNotificationBanner,
  RentStatusCarousel,
  CarouselCardItem,
  PaymentStatusType,
  TabSwitcher,
  RecentPaymentsList,
  CashbacksList,
  BottomFooter,
  VerificationCheckSheet,
    EmptyPaymentsState,
  // Import types from home components
  PaymentMethod,
  NotificationType,
  CashbackModuleState,
  VerificationStatusSheet,
} from '@/src/components/home';
import { Marquee, TOP_MARQUEE_ITEMS, BOTTOM_MARQUEE_ITEMS } from '@/src/components/auth/landing-decor';

import type { CashbackEarningsEntry } from '@/src/components/home/CashbackEarningsCard';
import type { SetupStep } from '@/src/components/home/CashbackSetupSteps';

// Import hooks from useDashboard
import { useDashboard, useRefreshDashboard } from '@/src/hooks/useDashboard';

// Import DashboardState type and mapped types from dashboard service
import type { DashboardState, MappedRecentPayment, MappedCashbackEntry, MappedTransaction, RawRecentPayment } from '@/src/services/api/dashboard';

// Import payment stamps
import { usePaymentStamps } from '@/src/hooks/usePayments';
import { usePaymentStore } from '@/src/stores/payment';
import type { PaymentStampEntry } from '@/src/services/api/payments';

import * as SecureStore from 'expo-secure-store';
// Import colors from theme
import { colors, spacing, radius } from '@/src/theme';

import { mapRecentPayments, mapTransactions, mapCashbackModule, deriveCashbackEntries, getDashboardState } from '@/src/services/api/dashboard';
import type { MappedCashbackModule } from '@/src/services/api/dashboard';

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function HomeScreen() {
  const router = useRouter();
  // CRITICAL: Expo Router's `router` object is NOT referentially stable — it
  // changes on every navigation state update. Using it directly in useCallback/
  // useMemo deps causes cascading recalculations that can trigger React's
  // "Maximum update depth exceeded" error. Keep a ref and read from it inside
  // callbacks instead. (Same pattern as AuthProvider.)
  const routerRef = useRef(router);
  routerRef.current = router;
  const insets = useSafeAreaInsets();

  const dashboardResult = useDashboard();
  const {
    isLoading,
    isRefetching,
    error,
    statusNotification,
  } = dashboardResult;
  const refresh = useRefreshDashboard();

  const resolvedData = dashboardResult.data ?? null;
  const dashboardState: DashboardState = getDashboardState(resolvedData);

  // If user has no tenancy, they shouldn't be on the main dashboard.
  // Redirect back to the journey router so it can determine the correct
  // screen based on actual user_status (could be setup, waitlist, etc.).
  // Previously this hardcoded /(agreement)/upload, which was wrong for
  // users who had already completed upload (e.g. approved/active without
  // tenancy yet — they'd get stuck on upload with a buffering button).
  // Skip in __DEV__ so the dev screen picker can access the dashboard freely.
  useEffect(() => {
    if (__DEV__) return;
    if (!isLoading && dashboardState === 'no_tenancy') {
      SecureStore.deleteItemAsync('flent_last_journey_target').catch(() => {});
      routerRef.current.replace('/' as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, dashboardState]);
  const user = resolvedData?.user ?? null;
  const tenancy = resolvedData?.tenancy ?? null;
  const upcomingPayment = resolvedData?.upcoming_payment ?? null;
  const cashback = resolvedData?.cashback ?? null;
  const unreadCount = resolvedData?.unread_notification_count ?? 0;
  const paymentStamps = resolvedData?.payment_stamps ?? null;

  // Mark all notifications as read once when dashboard first loads with unread count.
  // Uses a ref to fire only once per mount — avoids infinite loop where marking read
  // triggers realtime refetch which changes unreadCount and re-fires the effect.
  const markedReadRef = useRef(false);
  useEffect(() => {
    if (unreadCount > 0 && !markedReadRef.current) {
      markedReadRef.current = true;
      import('@/src/services/api/notifications').then(({ markAllNotificationsRead }) => {
        markAllNotificationsRead();
      });
    }
  }, [unreadCount]);

  const recentPayments = useMemo(
    () => mapRecentPayments(resolvedData?.recent_payments ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedData?.recent_payments]
  );
  const transactions = useMemo(
    () => mapTransactions(resolvedData?.recent_payments ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedData?.recent_payments]
  );
  const cashbackEntries = useMemo(
    () => deriveCashbackEntries(resolvedData?.recent_payments ?? [], tenancy?.monthly_rent, cashback?.discount_rate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedData?.recent_payments, tenancy?.monthly_rent, cashback?.discount_rate]
  );

  // Cashback module — single computed object with all CashbacksList props
  // BUG 1 FIX: Pass stamps data so chart bars are derived from backend stamps
  // (all months) instead of recent_payments (limited to 5).
  const cashbackModule = useMemo(
    () => mapCashbackModule(tenancy ?? null, cashback ?? null, resolvedData?.recent_payments ?? [], stampsData?.stamps, paymentStamps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenancy, cashback, resolvedData?.recent_payments, stampsData?.stamps, paymentStamps]
  );

  // Tab state for Recent Payments / Cashbacks
  const [activeTab, setActiveTab] = useState<string>('cashbacks');
  const { showSheet } = useLocalSearchParams<{ showSheet?: string }>();
  const [showVerificationSheet, setShowVerificationSheet] = useState(showSheet === 'cashback-setup');
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  // Clear the URL param after consumption to prevent re-triggering on re-render
  const clearedShowSheetRef = useRef(false);
  useEffect(() => {
    if (showSheet && !clearedShowSheetRef.current) {
      clearedShowSheetRef.current = true;
      routerRef.current.setParams({ showSheet: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSheet]);


  // Scroll tracking for scroll-down indicator
  const scrollViewRef = useRef<ScrollView>(null);
  // Scroll handler removed — ScrollDownIndicator removed from home screen.

  // Get payment stamps (per-month historical payment data)
  const { data: stampsData } = usePaymentStamps(tenancy?.id);

  // ==============================================
  // DERIVED VALUES
  // ==============================================

  // Saved payment methods removed — PayU handles method selection natively
  const paymentMethods: PaymentMethod[] = [];

  // Payment methods for the bottom sheet
  // User's first name for greeting
  const userName = user?.first_name ?? 'there';

  // Payment due calculations
  const alreadyPaid = upcomingPayment?.already_paid ?? false;
  // When already paid, compute days until next month's due date for "Next rent payment in X days"
  const daysUntilNextDue = useMemo(() => {
    if (!alreadyPaid || !upcomingPayment?.due_date || !tenancy?.rent_due_day) return null;
    // Derive from server's due_date (IST-aware) — don't use client's local clock for month
    const serverDue = new Date(upcomingPayment.due_date + 'T00:00:00');
    const nextMonthIdx = serverDue.getMonth() + 1;
    const nextYear = nextMonthIdx > 11 ? serverDue.getFullYear() + 1 : serverDue.getFullYear();
    const nextMonth = nextMonthIdx > 11 ? 0 : nextMonthIdx;
    // Clamp rent_due_day to next month's actual days (e.g., 31 in Feb → 28)
    const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const clampedDay = Math.min(tenancy.rent_due_day, daysInNextMonth);
    const nextDue = new Date(nextYear, nextMonth, clampedDay);
    return Math.ceil((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [alreadyPaid, upcomingPayment?.due_date, tenancy?.rent_due_day]);
  const daysUntilDue = alreadyPaid ? null : (upcomingPayment?.days_until_due ?? 0);
  const isOverdue = alreadyPaid ? false : (upcomingPayment?.is_overdue ?? false);
  const isMissed = isOverdue && (daysUntilDue ?? 0) <= -30 && (daysUntilDue ?? 0) > -60; // Missed if overdue by more than 30 days
  const isMultipleOverdue = isOverdue && (daysUntilDue ?? 0) <= -60;
  const rentAmount = upcomingPayment?.amount ?? tenancy?.monthly_rent ?? 0;

  // Derive the missed month name from rent_month (ISO date "YYYY-MM-DD")
  const missedMonthName = useMemo(() => {
    if (!upcomingPayment?.rent_month) return '';
    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const match = upcomingPayment.rent_month.match(/^(\d{4})-(\d{2})/);
    if (match) {
      const monthIndex = parseInt(match[2], 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) return MONTH_NAMES[monthIndex];
    }
    return '';
  }, [upcomingPayment?.rent_month]);

  // Cashback values
  const cashbackBalance = cashback?.available_balance ?? cashback?.legacy_wallet_balance ?? 0;
  const allTimeCashback = cashback?.total_savings ?? cashbackBalance;
  const cashbackRate = (cashback?.discount_rate ?? 0.01) * 100; // Backend sends 0.01 (1%), UI displays as percentage

  // Show bottom footer whenever there's a tenancy with unpaid rent.
  // alreadyPaid hides the CTA — without this the "Review & pay" pill stays
  // visible after the user has paid for the current month, sending them
  // into the rent modal which then blocks with "Rent for this month is
  // already paid". The modal's block is a defense-in-depth; the home page
  // shouldn't be offering the CTA at all in this state. The hero card
  // already shows the "paid" stamp + "Next rent payment in X days" so the
  // user has the relevant context without a misleading footer.
  const showBottomFooter = upcomingPayment !== null && rentAmount > 0 && !alreadyPaid;

  // Helper: format month from ISO date to display format
  const formatMonth = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'long', year: '2-digit' }).replace(' ', " '");
    } catch {
      return dateStr;
    }
  }, []);

  // Helper: map stamp status to card status
  const mapStampStatus = useCallback((status: PaymentStampEntry['status']): 'paid' | 'late' | 'missed' | 'upcoming' => {
    switch (status) {
      case 'on_time': return 'paid';
      case 'late': return 'late';
      case 'missed': return 'missed';
      case 'pending': return 'upcoming';
      case 'refunded': return 'upcoming'; // Refund reverts month to pending — overdue/missed logic applies naturally
      default: return 'upcoming';
    }
  }, []);

  // Build yearlyStamps array from stamps data for back-of-card grid
  const yearlyStamps = useMemo(() => {
    if (!stampsData?.stamps) return [];
    return stampsData.stamps.map(s => mapStampStatus(s.status));
  }, [stampsData, mapStampStatus]);

  // Setup completion check for payment gating.
  // Payment is allowed when bank + utility are verified AND landlord invite
  // has been sent (user doesn't need to wait for landlord to respond).
  // verification_complete (all 3 done) is used for the "verified member" badge,
  // but payment gating is more lenient.
  const verificationStatus = tenancy?.verification_status;
  const landlordInvitedOrApproved = verificationStatus?.landlord_approved ||
    (verificationStatus?.landlord_status && verificationStatus.landlord_status !== 'none');
  const isSetupComplete = !!(
    verificationStatus?.bank_verified &&
    verificationStatus?.utility_verified &&
    landlordInvitedOrApproved
  );

  const handleAddPayment = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isSetupComplete) {
      setShowVerificationSheet(true);
    } else {
      routerRef.current.push('/(payment)/enter-rent' as never);
    }
  }, [isSetupComplete]);

  // Generate carousel items based on state
  const carouselItems = useMemo((): CarouselCardItem[] => {
    // If no tenancy, we don't render dashboard
    if (!tenancy) return [];

    const items: CarouselCardItem[] = [];
    let cardCounter = 0;
    const summaryLate = stampsData?.summary?.late ?? paymentStamps?.summary?.late ?? 0;
    const summaryMissed = stampsData?.summary?.missed ?? paymentStamps?.summary?.missed ?? 0;
    const upcomingMonth = upcomingPayment?.rent_month ?? null;

    // 1. Upcoming payment (always first if exists)
    if (upcomingPayment && rentAmount > 0) {
      // When already paid, show paid/late stamp with receipt link
      if (alreadyPaid) {
        // Find the successful rent payment for this month.
        // upcomingPayment.rent_month is "YYYY-MM", recent_payments[].rent_month is "YYYY-MM-DD".
        // Match by prefix to handle both formats. Also filter for real rent (not ₹10 test payments).
        const rentMonthPrefix = upcomingPayment.rent_month; // "2026-03"
        const paidPayment = resolvedData?.recent_payments?.find(
          (p: RawRecentPayment) => p.status === 'success'
            && p.rent_month.startsWith(rentMonthPrefix)
            && p.amount >= rentAmount
        );
        const actualCashback = paidPayment
          ? (paidPayment.cashback_applied > 0 ? paidPayment.cashback_applied : paidPayment.cashback_earned)
          : 0;
        const potentialCashback = Math.round(rentAmount * (cashbackRate / 100));

        // Determine if payment was late (paid after cashback cutoff day)
        const cutoffDay = tenancy?.cashback_cutoff_day ?? 7;
        const paidStatus: 'paid' | 'late' = (() => {
          if (!paidPayment?.paid_at) return 'paid';
          const paidDate = new Date(paidPayment.paid_at);
          const monthParts = paidPayment.rent_month.match(/^(\d{4})-(\d{2})/);
          if (!monthParts) return 'paid';
          // Cutoff is cashback_cutoff_day of the payment month (end of day, generous)
          const cutoffDate = new Date(
            parseInt(monthParts[1]),
            parseInt(monthParts[2]) - 1,
            cutoffDay,
            23, 59, 59
          );
          return paidDate > cutoffDate ? 'late' : 'paid';
        })();

        // Paid on time → show actual cashback earned (0 if none recorded, never projected)
        // Late → show cashback lost (= potential amount that was forfeited)
        // WARN 23 FIX: When actualCashback is 0 and payment is on_time, show 0 (not projected).
        // Projected amounts should only appear on unpaid/upcoming cards.
        const cashbackAmount = paidStatus === 'paid'
          ? actualCashback
          : potentialCashback;

        items.push({
          type: 'payment',
          id: 'upcoming',
          data: {
            monthName: formatMonth(upcomingPayment.rent_month),
            cashbackEarned: cashbackAmount,
            status: paidStatus,
            onViewReceipt: paidPayment ? () => {
              routerRef.current.push({
                pathname: '/(payment)/status',
                params: {
                  paymentId: paidPayment.id,
                  amount: String(paidPayment.amount),
                  method: paidPayment.payment_method ?? '',
                  cashback: String((paidPayment.cashback_applied ?? 0) + (paidPayment.cashback_earned ?? 0)),
                  initialStatus: 'success',
                  source: 'receipt_view',
                  landlordName: tenancy?.landlord_name ?? '',
                  agreementId: tenancy?.agreement_cert_id ?? '',
                },
              } as never);
            } : undefined,
            yearlyStamps,
            lateCount: summaryLate,
            missedCount: summaryMissed,
            cardIndex: cardCounter++,
          }
        });
      } else {
        // Not paid: past cutoff → missed, otherwise → upcoming
        //
        // Grace period logic for new users:
        // - If user signed up in the same month as the upcoming payment AND has
        //   no payment history → treat as 'upcoming' (they just joined, can't
        //   have "missed" a month they weren't on the platform for)
        // - From the NEXT month onwards, normal missed logic applies even with
        //   zero payments — the user had a full month to pay and didn't
        const pastCutoff = upcomingPayment.past_cutoff ?? false;
        const hasAnyPayments = (resolvedData?.recent_payments?.length ?? 0) > 0;

        let isGracePeriod = false;
        if (!hasAnyPayments && pastCutoff) {
          // Check if tenancy was created in the same month as this payment
          const tenancyCreated = (tenancy as Record<string, unknown>)?.created_at as string | undefined;
          if (tenancyCreated) {
            const createdMonth = tenancyCreated.substring(0, 7); // "YYYY-MM"
            const paymentMonth = upcomingPayment.rent_month.substring(0, 7);
            isGracePeriod = createdMonth === paymentMonth;
          }
        }

        const unpaidStatus: PaymentStatusType = (pastCutoff && !isGracePeriod)
          ? ((isMissed || isMultipleOverdue) ? 'missed' : 'late')
          : 'upcoming';

        // Cashback potential = 1% on rent + flat ₹1000 promo if eligible.
        // Eligibility is server-derived (upcoming_payment.flat_bonus_eligible),
        // so this stays correct as soon as FLAT_BONUS_PROMO_MONTH is set on
        // the deployed dashboard-data edge function.
        const onePctPotential = Math.round(rentAmount * (cashbackRate / 100));
        const flatBonusRupees = (!pastCutoff && (upcomingPayment.flat_bonus_eligible ?? false))
          ? (upcomingPayment.flat_bonus_paise != null
              ? Math.floor(upcomingPayment.flat_bonus_paise / 100)
              : Math.min(1000, Math.max(0, rentAmount - onePctPotential)))
          : 0;
        const upcomingCashbackPotential = onePctPotential + flatBonusRupees;

        items.push({
          type: 'payment',
          id: 'upcoming',
          data: {
            monthName: formatMonth(upcomingPayment.rent_month),
            cashbackEarned: upcomingCashbackPotential,
            status: unpaidStatus,
            yearlyStamps,
            lateCount: summaryLate,
            missedCount: summaryMissed,
            rentDueDay: tenancy.rent_due_day,
            cardIndex: cardCounter++,
          }
        });
      }
    }

    // 2. Historical stamps (most recent first, deduplicated against upcoming)
    if (stampsData?.stamps && stampsData.stamps.length > 0) {
      const historicalStamps = stampsData.stamps
        .filter(stamp => stamp.month !== upcomingMonth) // Deduplicate against upcoming
        .slice(0, 6); // Limit to 6 historical cards

      historicalStamps.forEach((stamp) => {
        const cardStatus = mapStampStatus(stamp.status);
        const hasPayment = stamp.payment_id && (stamp.status === 'on_time' || stamp.status === 'late');
        const potentialCb = Math.round(rentAmount * (cashbackRate / 100));

        // Paid on time → actual cashback earned (0 if none recorded, never projected)
        // Late/missed → potential cashback (= lost amount forfeited)
        // WARN 23 FIX: Paid cards show actual cashback only, never projected amounts.
        let historicalCashback: number;
        if (cardStatus === 'paid') {
          // Show total cashback: applied (instant discount) + earned (into balance)
          historicalCashback = ((stamp.cashback_applied_paise ?? 0) + (stamp.cashback_earned_paise ?? 0)) / 100;
        } else if (cardStatus === 'late' || cardStatus === 'missed') {
          historicalCashback = potentialCb;
        } else {
          historicalCashback = potentialCb;
        }

        items.push({
          type: 'payment',
          id: `stamp-${stamp.month}`,
          data: {
            monthName: formatMonth(stamp.month),
            cashbackEarned: historicalCashback,
            status: cardStatus,
            onViewReceipt: hasPayment ? () => {
              routerRef.current.push({
                pathname: '/(payment)/status',
                params: {
                  paymentId: stamp.payment_id!,
                  amount: String((stamp.amount_paise ?? 0) / 100),
                  method: stamp.payment_method ?? '',
                  cashback: String((stamp.cashback_applied_paise ?? 0) / 100),
                  initialStatus: 'success',
                  source: 'receipt_view',
                  landlordName: tenancy?.landlord_name ?? '',
                  agreementId: tenancy?.agreement_cert_id ?? '',
                },
              } as never);
            } : undefined,
            yearlyStamps,
            lateCount: summaryLate,
            missedCount: summaryMissed,
            cardIndex: cardCounter++,
          }
        });
      });
    }

    // Zero state: No stamps, no upcoming, no saved methods
    if (items.length === 0 && paymentMethods.length === 0) {
      items.push({
        type: 'payment',
        id: 'zero-state',
        data: {
          monthName: formatMonth(new Date().toISOString()),
          cashbackEarned: Math.round(rentAmount * (cashbackRate / 100)),
          status: 'upcoming',
          yearlyStamps: [],
          lateCount: 0,
          missedCount: 0,
          onAddPaymentMethod: handleAddPayment,
          cardIndex: 0,
        }
      });
    }

    return items;
  }, [
    tenancy,
    paymentMethods,
    upcomingPayment,
    rentAmount,
    alreadyPaid,
    resolvedData,
    isMissed,
    isMultipleOverdue,
    isOverdue,
    recentPayments,
    cashbackRate,
    handleAddPayment,
    paymentStamps,
    stampsData,
    yearlyStamps,
    formatMonth,
    mapStampStatus,
    // router deliberately excluded — uses routerRef to avoid infinite re-renders
  ]);

  // ==============================================
  // HANDLERS
  // ==============================================

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refresh();
  }, [refresh]);


                const setPaymentAmount = usePaymentStore(state => state.setAmount);
        const setVerificationSkippedStore = usePaymentStore(state => state.setVerificationSkipped);

        const handleVerificationFinishSetup = useCallback(() => {
          setShowVerificationSheet(false);
          if (!verificationStatus?.utility_verified) {
            routerRef.current.push('/(setup)/add-utility' as never);
          } else if (!verificationStatus?.landlord_approved) {
            routerRef.current.push('/(setup)/invite-landlord' as never);
          } else {
            routerRef.current.replace('/(main)' as never);
          }
        }, [verificationStatus]);

        const handleVerificationSkip = useCallback(() => {
          setShowVerificationSheet(false);
          routerRef.current.push('/(payment)/enter-rent' as never);
        }, []);

        const handleFinishSetup = useCallback(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (!verificationStatus?.bank_verified) {
            routerRef.current.push('/(setup)/add-bank' as never);
          } else if (!verificationStatus?.utility_verified) {
            routerRef.current.push('/(setup)/add-utility' as never);
          } else if (!verificationStatus?.landlord_approved) {
            routerRef.current.push('/(setup)/invite-landlord' as never);
          } else {
            routerRef.current.replace('/(main)' as never);
          }
        }, [verificationStatus]);

        const handleHowItWorks = useCallback(async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await Linking.openURL('https://flent.in/secured/how-it-works');
          } catch (e) {
            console.warn('Failed to open URL:', e);
          }
        }, []);

        const handlePayNow = useCallback(() => {
          console.log('[PAY] handlePayNow fired, isSetupComplete:', isSetupComplete);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setVerificationSkippedStore(false);
          if (!isSetupComplete) {
            console.log('[PAY] Setup incomplete — showing verification sheet');
            setShowVerificationSheet(true);
          } else {
            console.log('[PAY] Navigating to /(payment)/enter-rent');
            try {
              routerRef.current.push('/(payment)/enter-rent' as never);
              console.log('[PAY] router.push succeeded');
            } catch (e) {
              console.error('[PAY] router.push FAILED:', e);
            }
          }
        }, [isSetupComplete, setVerificationSkippedStore]);

  const handleAddAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    routerRef.current.push('/(agreement)/upload' as never);
  }, []);

  const handleSendReminder = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('Send reminder to landlord');
  }, []);

  const handleContactSupport = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:secured@flent.in?subject=Help%20Request');
  }, []);

  const handlePaymentMethodPress = useCallback((method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push({
      pathname: '/(payment)/enter-rent' as never,
      params: { methodType: method.type, methodAccount: method.accountMasked },
    });
  }, []);

  const handlePaymentMethodEdit = useCallback((method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push({
      pathname: '/(profile)' as never,
      params: { editMethod: method.type, editMethodAccount: method.accountMasked },
    });
  }, []);

  const handlePaymentPress = useCallback((payment: MappedRecentPayment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const statusMap: Record<string, string> = {
      paid: 'success',
      pending: 'pending',
      failed: 'failed',
      processing: 'pending',
    };
    const rawPayment = resolvedData?.recent_payments?.find((p: RawRecentPayment) => p.id === payment.id);
    routerRef.current.push({
      pathname: '/(payment)/status' as never,
      params: {
        paymentId: payment.id,
        initialStatus: statusMap[payment.status] ?? 'pending',
        amount: String(payment.amount),
        method: rawPayment?.payment_method ?? '',
        cashback: String(rawPayment?.cashback_applied ?? rawPayment?.cashback_earned ?? 0),
        transactionId: payment.id,
        source: 'receipt_view',
        landlordName: tenancy?.landlord_name ?? '',
        agreementId: tenancy?.agreement_cert_id ?? '',
      },
    });
  }, [resolvedData?.recent_payments, tenancy]);

  // Transaction card action handlers (new card UI — Figma 4109-67659)
  const handleViewReceipt = useCallback((tx: MappedTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const rawPayment = resolvedData?.recent_payments?.find((p: RawRecentPayment) => p.id === tx.id);
    routerRef.current.push({
      pathname: '/(payment)/status' as never,
      params: {
        paymentId: tx.id,
        initialStatus: 'success',
        amount: String(tx.amount),
        method: rawPayment?.payment_method ?? '',
        cashback: String(rawPayment?.cashback_applied ?? rawPayment?.cashback_earned ?? 0),
        transactionId: tx.id,
        source: 'receipt_view',
        landlordName: tenancy?.landlord_name ?? '',
        agreementId: tenancy?.agreement_cert_id ?? '',
      },
    });
  }, [resolvedData?.recent_payments, tenancy]);

  const handleNeedHelp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:secured@flent.in').catch(() => {
      Alert.alert('Contact Support', 'Email us at secured@flent.in');
    });
  }, []);

  const handleTryAgain = useCallback((tx: MappedTransaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    routerRef.current.push({
      pathname: '/(payment)/enter-rent' as never,
      params: {
        prefillAmount: String(tx.amount),
      },
    });
  }, []);

  const handleCashbackEntryPress = useCallback((entry: CashbackEarningsEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // entry.id is "cbe_{paymentId}" — strip prefix to find raw payment
    const rawId = entry.id.replace(/^cbe_/, '');
    const rawPayment = resolvedData?.recent_payments?.find((p: RawRecentPayment) => p.id === rawId);
    if (!rawPayment) return;

    routerRef.current.push({
      pathname: '/(payment)/status',
      params: {
        paymentId: rawId,
        amount: String(rawPayment.amount ?? 0),
        method: rawPayment.payment_method ?? '',
        initialStatus: 'success',
        cashback: String(rawPayment.cashback_applied ?? rawPayment.cashback_earned ?? 0),
        source: 'receipt_view',
        landlordName: tenancy?.landlord_name ?? '',
        agreementId: tenancy?.agreement_cert_id ?? '',
      },
    } as never);
  }, [resolvedData?.recent_payments, tenancy]);

  const handleCopyInviteLink = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tenancyId = tenancy?.id;
    if (!tenancyId) return;
    const link = `flentsecured:///setup/invite-landlord?tenancyId=${tenancyId}`;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(link);
      Alert.alert('Copied!', 'Invite link copied to clipboard');
    } catch {
      Alert.alert('Invite Link', link);
    }
  }, [tenancy?.id]);

  const handleSetupStepPress = useCallback((step: SetupStep) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const routeMap: Record<string, string> = {
      bank: '/(setup)/add-bank',
      utility: '/(setup)/add-utility',
      landlord: '/(setup)/invite-landlord',
    };
    const route = routeMap[step.id];
    if (route) routerRef.current.push(route as never);
  }, []);

  const handleLearnMore = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Linking.openURL('https://flent.in/secured/how-it-works');
    } catch (e) {
      console.warn('Failed to open URL:', e);
    }
  }, []);

  const handleStatusPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowStatusSheet(true);
  }, []);


  // ==============================================
  // LOADING STATE
  // ==============================================

  if (isLoading) {
    return (
      <Screen testID="home-screen-loading" padded={false} safeAreaTop={false} safeAreaBottom={false}
        style={{ backgroundColor: colors.black[700] }}
      >
        <DottedGridPattern fadeMask={false} />
        <View style={styles.betaSplashContainer}>
          <View style={styles.betaSplashLogoWrap}>
            <Logo size={40} />
          </View>
          <View style={styles.betaSplashBadge}>
            <Text variant="bodySmMedium" style={styles.betaSplashBadgeText}>
              BETA LAUNCH
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  // ==============================================
  // ERROR STATE
  // ==============================================

  if (error) {
    return (
      <Screen testID="home-screen-error" padded={false}>
        <View style={styles.errorContainer}>
          <Logo size={64} />
          <Text variant="h5" color="primary" style={styles.errorTitle}>
            Something went wrong
          </Text>
          <Text variant="bodyMd2" color="muted" align="center" style={styles.errorMessage}>
            {error instanceof Error ? error.message : 'Unable to load your dashboard. Please try again'}
          </Text>
          <PrimaryButton
            title="Retry"
            onPress={handleRefresh}
            style={styles.retryButton}
          />
        </View>
      </Screen>
    );
  }

  // ==============================================
  // RENDER
  // ==============================================

  return (
    // Figma: safeAreaTop=false because we handle paddingTop via insets.top manually
    // This prevents double safe-area padding (Screen + manual insets)
    <Screen testID="home-screen" padded={false} safeAreaTop={false} safeAreaBottom={false}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top },
          showBottomFooter && styles.scrollContentWithFooter,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.brand[500]}
          />
        }
      >
        {/* Header: Logo + "Hi, [Name]" + Avatar */}
        {/* Figma: HomeHeader handles its own paddingHorizontal: 32 */}
        <Animated.View entering={FadeInDown.duration(350)}>
          <HomeHeader userName={userName} userId={user?.id} unreadCount={unreadCount} />
        </Animated.View>

        {/* Marquee bands — Figma 4651:142960. Always visible on home. */}
        <View style={styles.homeMarquees} pointerEvents="none">
          <View style={[styles.marqueeRotated, { transform: [{ rotate: '0.22deg' }] }]}>
            <Marquee items={TOP_MARQUEE_ITEMS} backgroundColor={colors.black[600]} />
          </View>
          <View style={[styles.marqueeRotated, { transform: [{ rotate: '-0.48deg' }] }]}>
            <Marquee items={BOTTOM_MARQUEE_ITEMS} backgroundColor={colors.brand[600]} textColor={colors.black[700]} reverse />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.mainContent}>
          {/* Dashboard Content */}
          {renderDashboardContent(dashboardState, {
            tenancy,
            upcomingPayment,
            cashback,
            paymentMethods,
            recentPayments,
            transactions,
            cashbackEntries,
            cashbackModule,

            carouselItems,
            daysUntilDue,
            daysUntilNextDue,
            alreadyPaid,
            isOverdue,
            isMissed,
            isMultipleOverdue,
            missedMonthName,
            activeTab,
            cashbackBalance,
            allTimeCashback,
            cashbackRate,
            statusNotification,
            onTabChange: setActiveTab,
            onAddPayment: handleAddPayment,
            onFinishSetup: handleFinishSetup,
            onPayNow: handlePayNow,
            onAddAgreement: handleAddAgreement,
            onSendReminder: handleSendReminder,
            onContactSupport: handleContactSupport,
            onPaymentMethodPress: handlePaymentMethodPress,
            onPaymentMethodEdit: handlePaymentMethodEdit,
            onPaymentPress: handlePaymentPress,
            onViewReceipt: handleViewReceipt,
            onNeedHelp: handleNeedHelp,
            onTryAgain: handleTryAgain,
            onCashbackEntryPress: handleCashbackEntryPress,
            onCopyInviteLink: handleCopyInviteLink,
            onSetupStepPress: handleSetupStepPress,
            onLearnMore: handleLearnMore,
            onHowItWorks: handleHowItWorks,
            onMemberStatusPress: handleStatusPress,
          })}
        </Animated.View>
      </ScrollView>

      {/* Fixed Bottom Footer - Figma: absolutely positioned, height 118, bg #202020 */}
      {/* Figma nodes: frame_1686557229 across 243-2762, 243-2967, 243-3170, 243-3378 */}
      {showBottomFooter ? (
        <View style={styles.bottomFooterContainer}>
          <BottomFooter
            // showBottomFooter excludes alreadyPaid, so daysUntilDue is the
            // current month's countdown (always meaningful here).
            dueInDays={daysUntilDue}
            amount={rentAmount}
            buttonLabel="Review & pay"
            disabled={false} // All states can trigger payment — verification sheet gates if needed
            onPress={handlePayNow}
          />
        </View>
      ) : null}

            {/* Verification Check Sheet — shown before payment when setup incomplete */}
      <VerificationCheckSheet
        visible={showVerificationSheet}
        onClose={() => setShowVerificationSheet(false)}
        onFinishSetup={handleVerificationFinishSetup}
        onSkipToPayment={handleVerificationSkip}
        utilityVerified={verificationStatus?.utility_verified ?? false}
        landlordApproved={verificationStatus?.landlord_approved ?? false}
      />

      {/* Verification Status Sheet — shown when user taps pending/verified status */}
      <VerificationStatusSheet
        visible={showStatusSheet}
        onClose={() => setShowStatusSheet(false)}
      />
    </Screen>
  );
}

// ==============================================
// CONTENT RENDERER
// ==============================================

interface ContentProps {
  tenancy: ReturnType<typeof useDashboard>['tenancy'];
  upcomingPayment: ReturnType<typeof useDashboard>['upcomingPayment'];
  cashback: ReturnType<typeof useDashboard>['cashback'];
  paymentMethods: PaymentMethod[];
  recentPayments: MappedRecentPayment[];
  transactions: MappedTransaction[];
  cashbackEntries: MappedCashbackEntry[];
  cashbackModule: MappedCashbackModule;
  carouselItems: CarouselCardItem[];
  daysUntilDue: number | null;
  daysUntilNextDue: number | null;
  alreadyPaid: boolean;
  isOverdue: boolean;
  isMissed: boolean;
  isMultipleOverdue: boolean;
  missedMonthName: string;
  activeTab: string;
  cashbackBalance: number;
  allTimeCashback: number;
  cashbackRate: number;
  statusNotification: { type: NotificationType; message?: string } | null;
  onTabChange: (tabId: string) => void;
  onAddPayment: () => void;
  onFinishSetup: () => void;
  onPayNow: () => void;
  onAddAgreement: () => void;
  onSendReminder: () => void;
  onContactSupport: () => void;
  onPaymentMethodPress: (method: PaymentMethod) => void;
  onPaymentMethodEdit: (method: PaymentMethod) => void;
  onPaymentPress: (payment: MappedRecentPayment) => void;
  onViewReceipt: (transaction: MappedTransaction) => void;
  onNeedHelp: () => void;
  onTryAgain: (transaction: MappedTransaction) => void;
  onCashbackEntryPress?: (entry: CashbackEarningsEntry) => void;
  onCopyInviteLink?: () => void;
  onSetupStepPress?: (step: SetupStep) => void;
  onLearnMore?: () => void;
  onHowItWorks?: () => void;
  onMemberStatusPress?: () => void;
}

const DASHBOARD_TABS = [
  { id: 'cashbacks', label: 'Cashbacks' },
  { id: 'recent_payments', label: 'Recent Payments' },
];

function renderDashboardContent(state: DashboardState, props: ContentProps) {
  const {
    tenancy,
    upcomingPayment,
    cashback,
    paymentMethods,
    recentPayments,
    transactions,
    cashbackEntries,
    cashbackModule,
    carouselItems,
    daysUntilDue,
    daysUntilNextDue,
    alreadyPaid,
    isOverdue,
    isMissed,
    isMultipleOverdue,
    missedMonthName,
    activeTab,
    cashbackBalance,
    allTimeCashback,
    cashbackRate,
    statusNotification,
    onTabChange,
    onAddPayment,
    onFinishSetup,
    onPayNow,
    onAddAgreement,
    onSendReminder,
    onContactSupport,
    onPaymentMethodPress,
    onPaymentMethodEdit,
    onPaymentPress,
    onViewReceipt,
    onNeedHelp,
    onTryAgain,
    onCashbackEntryPress,
    onCopyInviteLink,
    onSetupStepPress,
    onLearnMore,
    onHowItWorks,
    onMemberStatusPress,
  } = props;

  switch (state) {
    case 'no_tenancy':
      // Users without a tenancy should never reach the main dashboard —
      // the journey router (index.tsx) gates on user_status and redirects
      // to agreement/waitlist/setup as appropriate. Return null; the
      // component-level useEffect below will redirect back to the router.
      return null;

    case 'pending_verification': {
      // Same layout for zero and non-zero transactions: Headline + Carousel + Tabs
      const pvHeadlineVariant = alreadyPaid ? 'paid' : isOverdue ? 'overdue' : 'due';
      const pvDaysValue = alreadyPaid ? (daysUntilNextDue ?? 0) : isOverdue ? Math.abs(daysUntilDue ?? 0) : (daysUntilDue ?? 0);

      return (
        <View style={styles.contentContainer}>
          <HeadlineSection
            variant={pvHeadlineVariant}
            daysUntilDue={pvHeadlineVariant === 'paid' ? pvDaysValue : pvHeadlineVariant === 'due' ? pvDaysValue : undefined}
            daysOverdue={pvHeadlineVariant === 'overdue' ? pvDaysValue : undefined}
          />
          <RentStatusCarousel items={carouselItems} />
          <View style={styles.tabSection}>
            <TabSwitcher tabs={DASHBOARD_TABS} activeTabId={activeTab} onTabChange={onTabChange} />
            {activeTab === 'recent_payments' ? (
              transactions.length > 0 ? (
                <RecentPaymentsList
                  transactions={transactions}
                  landlordName={tenancy?.landlord_name}
                  onViewReceipt={onViewReceipt}
                  onNeedHelp={onNeedHelp}
                  onTryAgain={onTryAgain}
                />
              ) : (
                <EmptyPaymentsState />
              )
            ) : (
              <CashbacksList
                {...cashbackModule}
                onEntryPress={onCashbackEntryPress}
                onStepPress={onSetupStepPress}
                onMemberStatusPress={onMemberStatusPress}
              />
            )}
          </View>
        </View>
      );
    }

    case 'all_verified':
    case 'payment_due':
    case 'payment_overdue':
      // Active states with payment methods, tabs, and payment list
      const headlineVariant = alreadyPaid ? 'paid' : isMultipleOverdue ? 'multiple_overdue' : isMissed ? 'missed' : isOverdue ? 'overdue' : 'due';
      const daysValue = alreadyPaid ? (daysUntilNextDue ?? 0) : isOverdue ? Math.abs(daysUntilDue ?? 0) : (daysUntilDue ?? 0);

      return (
        <View style={styles.contentContainer}>
          {/* Headline: "Your rent is due in X days"
              Figma 243:2764 / 243:5872 (Frame 2095586453): HeadlineSection handles its own
              paddingLeft: 64, paddingRight: 64 -- DO NOT add parent padding */}
          <HeadlineSection
            variant={headlineVariant}
            daysUntilDue={headlineVariant === 'paid' ? daysValue : headlineVariant === 'due' ? daysValue : undefined}
            daysOverdue={headlineVariant === 'overdue' ? daysValue : undefined}
            missedMonth={headlineVariant === 'missed' ? (missedMonthName || 'This Month') : undefined}
          />

          {/* Rent Status Carousel - cards + Setup card
              Figma 243:5877 (Frame 2095586448): RentStatusCarousel handles its own
              paddingLeft: 64, paddingRight: 32, gap: 16 -- DO NOT add parent padding */}
          <RentStatusCarousel items={carouselItems} />


          {/* Tab Section (Frame 1686557297): wraps Toggle + payment list content */}
          <View style={styles.tabSection}>
        <TabSwitcher tabs={DASHBOARD_TABS} activeTabId={activeTab} onTabChange={onTabChange} />

        {/* Tab Content - gap 48 separates toggle from content */}
        {activeTab === 'recent_payments' ? (
          transactions.length > 0 ? (
            <RecentPaymentsList
              transactions={transactions}
              onViewReceipt={onViewReceipt}
              onNeedHelp={onNeedHelp}
              onTryAgain={onTryAgain}
            />
          ) : (
            <EmptyPaymentsState />
          )
        ) : (
            <CashbacksList
              {...cashbackModule}
              onEntryPress={onCashbackEntryPress}
              onStepPress={onSetupStepPress}
              onMemberStatusPress={onMemberStatusPress}
            />
        )}
      </View>


        </View>
      );

    case 'payment_processing':
      return (
        <View style={styles.contentContainer}>
          <View style={styles.successContainer}>
            <ActivityIndicator size="large" color={colors.brand[500]} />
            <Text variant="h5" color="primary" align="center">
              Processing Payment
            </Text>
            <Text variant="bodyMd2" color="muted" align="center" style={styles.successText}>
              Your payment is being processed. This usually takes a few minutes.
            </Text>
          </View>
        </View>
      );

    case 'payment_success':
      return (
        <View style={styles.contentContainer}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#70BF73" />
            </View>
            <Text variant="h5" color="primary" align="center">
              Payment Complete!
            </Text>
            <Text variant="bodyMd2" color="muted" align="center" style={styles.successText}>
              Your rent payment was successful. Cashback will be credited within 24 hours.
            </Text>
          </View>

          {cashback && (cashback.total_savings ?? 0) > 0 ? (
            <View style={styles.cashbackCard}>
              <Text variant="bodySm" color="muted">
                Total Savings
              </Text>
              <Text variant="h4" color="accent">
                Rs.{(cashback.total_savings ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}
        </View>
      );

    default:
      return (
        <View style={styles.betaSplashContainer}>
          <View style={styles.betaSplashLogoWrap}>
            <Logo size={40} />
          </View>
          <View style={styles.betaSplashBadge}>
            <Text variant="bodySmMedium" style={styles.betaSplashBadgeText}>
              BETA LAUNCH
            </Text>
          </View>
        </View>
      );
  }
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.black[700], // Figma: #131313 (colors.black[700])
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48, // Figma 684:8847: paddingBottom 48
    // NOTE: gap 24 removed from here. The 24px gap is ONLY between elements
    // inside the main content area (WarningBanner, Headline, Carousel).
    // The gap between HomeHeader and the main content area is 0 in Figma.
  },
  mainContent: {
    // NO flex: 1 — inside ScrollView, children must hug content, not stretch.
    // flex: 1 caused invisible flex-fill space distributed between children.
    gap: 24, // Figma 769:308866: itemSpacing 24 between top-level sections
  },
  homeMarquees: {
    // Marquee bands sit just below the header. Negative side margins let the
    // rotated bands overflow horizontally without clipping.
    marginHorizontal: -220,
    marginTop: 8,
    marginBottom: 24,
  },
  marqueeRotated: {
    width: 847,
    alignSelf: 'center',
  },
  scrollContentWithFooter: {
    // Footer height (~118) + base padding = total bottom clearance
    paddingBottom: 148,
  },
  // Figma: BottomFooter absolutely positioned at bottom of screen
  // Figma nodes: frame_1686557229 across 243-2762, 243-2967, 243-3170, 243-3378
  bottomFooterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10, // Figma: footer sits above scroll content
  },
  betaSplashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  betaSplashLogoWrap: {
    marginBottom: 12, // Figma: logo-to-badge gap 12px (beta-splash 176:2750→176:2752)
  },
  betaSplashBadge: {
    backgroundColor: colors.brand[500],    // #FF9A6D
    borderRadius: radius.xs,               // 4px
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing.xs,         // 8px
    paddingVertical: spacing.xxs,          // 4px
  },
  betaSplashBadgeText: {
    letterSpacing: -0.2,
    color: colors.black[900],              // #000000
    textAlign: 'center' as const,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32, // Figma: paddingHorizontal 32 (spacing.xl)
    gap: 16,
    backgroundColor: colors.black[700], // Figma: #131313 (colors.black[700])
  },
  errorTitle: {
    marginTop: 24,
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  errorMessage: {
    marginTop: 8,
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  retryButton: {
    marginTop: 24,
    minWidth: 160,
  },
  contentContainer: {
    // NO flex: 1 — same reason as mainContent. Must hug content inside ScrollView.
    gap: 24, // Figma 769:308866: itemSpacing 24 between sections
  },
  sectionDivider: {
    height: 1, // Figma 684:9207: thin divider
    backgroundColor: '#2A2A2A',
    marginHorizontal: 32,
  },
  // NOTE: headlineContainer REMOVED - HeadlineSection (243:5872 Frame 2095586453)
  // handles its own paddingLeft: 64, paddingRight: 64. Adding parent padding caused double-padding.
  // NOTE: carouselSection REMOVED - PaymentMethodCarousel (243:5877 Frame 2095586448)
  // handles its own paddingLeft: 64, paddingRight: 32, gap: 16 via scrollContent.
  // Adding parent padding caused double-padding.
  // Figma 684:12989 (Frame 1686557297):
  // Wraps Toggle + payment/cashback list content together
  // direction: column, alignItems: center, gap: 32
  // paddingTop: 8, paddingLeft: 32, paddingRight: 32, clipsContent: true
  tabSection: {
    gap: 48, // Figma 684:9002: gap 48 between toggle and content
    alignItems: 'center', // Figma: counterAxisAlignItems CENTER
    // NOTE: overflow hidden removed — was clipping cashback accrued amount (32px font)
    // paddingHorizontal 32 is handled by child components (RecentPaymentsList, CashbacksList, etc.)
  },
  emptyStateButton: {
    marginTop: 24,
    minWidth: 200,
  },
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: 32, // Figma: paddingHorizontal 32 (spacing.xl)
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(112, 191, 115, 0.2)', // Figma: success with opacity
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  // successEmoji style removed — replaced with Ionicons checkmark-circle
  successText: {
    marginTop: 8,
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
  },
  cashbackCard: {
    marginTop: 32,
    marginHorizontal: 32, // Figma: 32px horizontal margins (spacing.xl)
    padding: 24, // Figma: padding 24 (spacing.lg)
    backgroundColor: colors.black[600], // Figma: #1A1A1A (colors.black[600])
    borderRadius: 12, // Figma: borderRadius 12
    alignItems: 'center',
    gap: 8,
  },
});
