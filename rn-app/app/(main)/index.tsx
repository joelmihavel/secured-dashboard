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
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Logo, PrimaryButton } from '@/src/components';
import {
  HomeHeader,
  HeadlineSection,
  WarningBanner,
  StatusNotificationBanner,
  RentStatusCarousel,
  CarouselCardItem,
  TabSwitcher,
  RecentPaymentsList,
  CashbacksList,
  BottomFooter,
  HomeEmptyState,
  VerificationCheckSheet,
  RentAmountModal,
  EmptyPaymentsState,
  CashbackEmptyState,
  PaymentMethodSelectionSheet,
  SetupProgressCard,
  // Import types from home components
  TabId,
  PaymentMethod,
  EmptyStateVariant,
  NotificationType,
} from '@/src/components/home';

// RecentPayment type from home components for the list props
import type { RecentPayment } from '@/src/components/home/RecentPaymentsList';

// Import hooks from useDashboard
import { useDashboard, useRefreshDashboard } from '@/src/hooks/useDashboard';

// Import DashboardState type and mapped types from dashboard service
import type { DashboardState, MappedRecentPayment, MappedCashbackEntry } from '@/src/services/api/dashboard';

// Import saved payment methods hook
import { useSavedPaymentMethods } from '@/src/hooks/usePayments';
import { usePaymentStore } from '@/src/stores/payment';

// Import colors from theme
import { colors } from '@/src/theme';

import { mapRecentPayments, deriveCashbackEntries, getDashboardState } from '@/src/services/api/dashboard';

// ==============================================
// MAIN COMPONENT
// ==============================================

export default function HomeScreen() {
  const router = useRouter();
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
  // Redirect to agreement upload — the most likely next step for a user
  // without tenancy data. Using a specific route (not '/') avoids a
  // potential redirect loop if the journey router's API call fails.
  // Skip in __DEV__ so the dev screen picker can access the dashboard freely.
  useEffect(() => {
    if (__DEV__) return;
    if (!isLoading && dashboardState === 'no_tenancy') {
      router.replace('/(agreement)/upload' as never);
    }
  }, [isLoading, dashboardState, router]);
  const user = resolvedData?.user ?? null;
  const tenancy = resolvedData?.tenancy ?? null;
  const upcomingPayment = resolvedData?.upcoming_payment ?? null;
  const cashback = resolvedData?.cashback ?? null;
  const unreadCount = resolvedData?.unread_notification_count ?? 0;
  const paymentStamps = resolvedData?.payment_stamps ?? null;

  const recentPayments = useMemo(
    () => mapRecentPayments(resolvedData?.recent_payments ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedData?.recent_payments]
  );
  const cashbackEntries = useMemo(
    () => deriveCashbackEntries(resolvedData?.recent_payments ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedData?.recent_payments]
  );

  // Tab state for Recent Payments / Cashbacks
  const [activeTab, setActiveTab] = useState<TabId>('recent_payments');
  const [showVerificationSheet, setShowVerificationSheet] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  // Scroll tracking for scroll-down indicator
  const scrollViewRef = useRef<ScrollView>(null);
  // Scroll handler removed — ScrollDownIndicator removed from home screen.

  // Get saved payment methods
  const { data: savedMethods } = useSavedPaymentMethods();

  // ==============================================
  // DERIVED VALUES
  // ==============================================

  const handleAddPayment = useCallback(() => {
    setShowPaymentSheet(true);
  }, []);

  // Convert saved methods to PaymentMethod type for carousel
  const paymentMethods: PaymentMethod[] = useMemo(() => {
    if (!savedMethods) return [];
    return savedMethods.map((method) => {
      // Derive a human-readable bank name from display_name
      // UPI: "UPI - ICICI" -> "ICICI"; Card: "Visa ****2341" -> "Visa"
      const bankName =
        method.type === 'upi'
          ? (method.display_name?.replace(/^UPI\s*-\s*/i, '') || method.upi_provider || 'Bank')
          : method.type === 'card'
            ? (method.card_network?.toUpperCase() || method.display_name?.split(' ')[0] || 'Card')
            : (method.display_name || 'Bank');

      // Format card expiry from month/year fields (e.g., 6/2026 -> "06/26")
      const cardExpiry =
        method.type === 'card' && method.card_expiry_month && method.card_expiry_year
          ? `${String(method.card_expiry_month).padStart(2, '0')}/${String(method.card_expiry_year).slice(-2)}`
          : undefined;

      return {
        id: method.id,
        type: method.type, // Preserve original type: 'upi' | 'card' | 'netbanking'
        bankName,
        accountMasked: method.vpa || `****${method.last_four || ''}`,
        upiId: method.vpa,
        cardBrand: method.card_network,
        cardLastFour: method.last_four,
        cardExpiry,
        isSelected: method.is_default,
      };
    });
  }, [savedMethods]);

  // Payment methods for the bottom sheet
  const sheetPaymentMethods = useMemo(() => {
    const hasCard = paymentMethods.some(m => m.type === 'card');
    const hasUpi = paymentMethods.some(m => m.type === 'upi');
    const hasNetbanking = paymentMethods.some(m => m.type === 'netbanking');

    return [
      {
        id: 'card-1',
        type: 'card' as const,
        label: 'Credit Card',
        isSetUp: hasCard,
        cardLastFour: paymentMethods.find(m => m.type === 'card')?.cardLastFour,
        cardExpiry: paymentMethods.find(m => m.type === 'card')?.cardExpiry,
      },
      {
        id: 'upi-1',
        type: 'upi' as const,
        label: 'UPI',
        isSetUp: hasUpi,
        bankName: paymentMethods.find(m => m.type === 'upi')?.bankName,
        accountMasked: paymentMethods.find(m => m.type === 'upi')?.accountMasked,
        upiId: paymentMethods.find(m => m.type === 'upi')?.upiId,
      },
      {
        id: 'netbanking-1',
        type: 'netbanking' as const,
        label: 'Net Banking',
        isSetUp: hasNetbanking,
      },
    ];
  }, [paymentMethods]);

  const [selectedSheetMethod, setSelectedSheetMethod] = useState<string>('card-1');

  // User's first name for greeting
  const userName = user?.first_name ?? 'there';

  // Payment due calculations
  const daysUntilDue = upcomingPayment?.days_until_due ?? 0;
  const isOverdue = upcomingPayment?.is_overdue ?? false;
  const isMissed = isOverdue && daysUntilDue <= -30 && daysUntilDue > -60; // Missed if overdue by more than 30 days
  const isMultipleOverdue = isOverdue && daysUntilDue <= -60;
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
  const cashbackBalance = cashback?.available_balance ?? 0;
  const allTimeCashback = cashback?.total_earned ?? 0;
  const cashbackRate = 0.8; // 0.8% cashback rate

  // Show bottom footer for active payment states when there's an upcoming payment
  // (not during processing or when no payment is due)
  const showBottomFooter = useMemo(() => {
    const hasUpcomingPayment = upcomingPayment !== null && rentAmount > 0;
    return (
      hasUpcomingPayment &&
      (dashboardState === 'all_verified' ||
        dashboardState === 'payment_due' ||
        dashboardState === 'payment_overdue' ||
        dashboardState === 'pending_verification')
    );
  }, [dashboardState, upcomingPayment, rentAmount]);

  // Generate carousel items based on state
  const carouselItems = useMemo((): CarouselCardItem[] => {
    // If no tenancy, we don't render dashboard
    if (!tenancy) return [];

    const items: CarouselCardItem[] = [];
    let cardCounter = 0;

    // 1. Upcoming payment (if any)
    if (upcomingPayment && rentAmount > 0) {
      const formatMonth = (dateStr: string) => {
        try {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr;
          return d.toLocaleDateString('en-US', { month: 'long', year: '2-digit' }).replace(' ', " '");
        } catch {
          return dateStr;
        }
      };

      let earlyStatus: 'upcoming' | 'late' | 'missed' = 'upcoming';
      if (isMissed || isMultipleOverdue) earlyStatus = 'missed';
      else if (isOverdue) earlyStatus = 'late';

      items.push({
        type: 'payment',
        id: 'upcoming',
        data: {
          monthName: formatMonth(upcomingPayment.rent_month),
          cashbackEarned: 0,
          status: earlyStatus,
          yearlyStamps: [],
          lateCount: paymentStamps?.summary?.late ?? 0,
          missedCount: paymentStamps?.summary?.missed ?? 0,
          onAddPaymentMethod: paymentMethods.length === 0 ? handleAddPayment : undefined,
          rentDueDay: tenancy.rent_due_day,
          cardIndex: cardCounter++,
        }
      });
    }

    // If verification is completely pending and no payment methods, add setup card after flip card
    // Figma 243-4062/243-5870: Only show setup card when no UPI/Cards are added AND landlord is approved
    if (paymentMethods.length === 0 && tenancy.verification_status?.landlord_approved && (!tenancy.verification_status?.bank_verified || !tenancy.verification_status?.utility_verified)) {
      items.push({
        type: 'payment_setup',
        id: 'setup-payment',
        data: {
          variant: 'standalone',
          onAddPayment: handleAddPayment,
        }
      });
      return items;
    }

    // Upcoming payment already added above — add recent payments for active states

    // 2. Recent payments (paid ones)
    // Up to 3 past payments
    recentPayments.slice(0, 3).forEach((payment, index) => {
      items.push({
        type: 'payment',
        id: `payment-${payment.id}`,
        data: {
          monthName: payment.title.split(' ')[0] + " '26", // Mock format for UI
          cashbackEarned: payment.amount * (cashbackRate / 100), // Approximate for UI
          status: payment.status === 'failed' ? 'missed' : payment.status === 'pending' || payment.status === 'processing' ? 'upcoming' : 'paid',
          onViewReceipt: () => {
            router.push({
              pathname: '/(payment)/status',
              params: {
                paymentId: payment.id,
                amount: String(payment.amount),
                method: 'upi',
                initialStatus: 'success',
                source: 'receipt_view',
                landlordName: tenancy?.landlord_name ?? '',
                agreementId: tenancy?.agreement_cert_id ?? '',
              },
            } as never);
          },
          yearlyStamps: [],
          lateCount: paymentStamps?.summary?.late ?? 0,
          missedCount: paymentStamps?.summary?.missed ?? 0,
          cardIndex: cardCounter++,
        }
      });
    });

    return items;
  }, [
    tenancy,
    paymentMethods,
    upcomingPayment,
    rentAmount,
    isMissed,
    isMultipleOverdue,
    isOverdue,
    recentPayments,
    cashbackRate,
    handleAddPayment,
    paymentStamps,
  ]);

  // Determine empty state variant based on dashboard state
  const emptyStateVariant: EmptyStateVariant = useMemo(() => {
    const verificationStatus = tenancy?.verification_status;

    // No payment methods at all — base empty state
    if (paymentMethods.length === 0) {
      // If setup is in progress (tenancy exists but no payment methods)
      if (tenancy && !verificationStatus?.bank_verified) {
        return 'setup_payment';
      }
      return 'empty_base';
    }

    // Map backend status to specific UI states based on invite timestamp and status
    if (tenancy?.verification_status) {
      const landlordStatus = tenancy.verification_status.landlord_approved;
      // In a real app we'd check landlord_invite_status and sent_at timestamp
      // For now we map to invitation_sent as default if not approved
      if (!landlordStatus) {
        return 'invitation_sent'; 
        // Can be extended to: 'invitation_resent_recent', 'invitation_resent_old', 
        // 'invitation_failed', 'invitation_declined'
      }
    }

    // Landlord approved, check remaining verification steps
    if (!verificationStatus?.bank_verified || !verificationStatus?.utility_verified) {
      // Cashback setup available when payment methods exist but verification incomplete
      if (cashback && cashback.pending_balance === 0 && cashback.total_earned === 0) {
        return 'setup_cashback';
      }
      return 'empty_with_upi';
    }

    return 'empty_with_upi_payments';
  }, [paymentMethods.length, tenancy, cashback]);

  // Setup completion check
  const verificationStatus = tenancy?.verification_status;
  const isSetupComplete =
    verificationStatus?.bank_verified &&
    verificationStatus?.utility_verified &&
    verificationStatus?.landlord_approved;

  // ==============================================
  // HANDLERS
  // ==============================================

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refresh();
  }, [refresh]);

  const handleSheetSelectMethod = useCallback((method: any) => {
    setSelectedSheetMethod(method.id);
  }, []);

  const handleSheetAddNewMethod = useCallback(() => {
    setShowPaymentSheet(false);
    router.push('/(payment)/confirm' as never);
  }, [router]);

        const [showRentAmountModal, setShowRentAmountModal] = useState(false);
        const setPaymentAmount = usePaymentStore(state => state.setAmount);
        const setVerificationSkippedStore = usePaymentStore(state => state.setVerificationSkipped);
        const setPendingPaymentReturn = usePaymentStore(state => state.setPendingPaymentReturn);

        // Check for pending payment return (user completed setup and should resume payment flow)
        useEffect(() => {
          const { pendingPaymentReturn, setPendingPaymentReturn: clearReturn } = usePaymentStore.getState();
          if (pendingPaymentReturn) {
            clearReturn(false);
            // Auto-open rent amount modal after returning from setup
            setTimeout(() => setShowRentAmountModal(true), 500);
          }
        }, []);

        const handleVerificationFinishSetup = useCallback(() => {
          setShowVerificationSheet(false);
          setPendingPaymentReturn(true);
          router.push('/(setup)/pending-steps' as never);
        }, [router, setPendingPaymentReturn]);

        const handleVerificationSkip = useCallback(() => {
          setShowVerificationSheet(false);
          setVerificationSkippedStore(true);
          // Show rent amount modal after skipping verification
          setTimeout(() => setShowRentAmountModal(true), 300);
        }, [setVerificationSkippedStore]);

        const handleFinishSetup = useCallback(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/(setup)/pending-steps' as never);
        }, [router]);

        const handleHowItWorks = useCallback(async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await Linking.openURL('https://flent.in/secured/how-it-works-for-landlords');
          } catch (e) {
            console.warn('Failed to open URL:', e);
          }
        }, []);

        const handlePayNow = useCallback(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (!isSetupComplete) {
            setShowVerificationSheet(true);
          } else {
            setShowRentAmountModal(true);
          }
        }, [isSetupComplete]);

        const handleRentAmountConfirm = useCallback((amount: string) => {
          setShowRentAmountModal(false);
          setPaymentAmount(parseFloat(amount));
          // Navigate to first-rent (Payment Page) where payment method selection happens in the modal overlay.
          router.push('/(payment)/first-rent' as never);
        }, [router, setPaymentAmount]);

  const handleAddAgreement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(agreement)/upload' as never);
  }, [router]);

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
    router.push({
      pathname: '/(payment)/confirm' as never,
      params: { methodType: method.type, methodAccount: method.accountMasked },
    });
  }, [router]);

  const handlePaymentMethodEdit = useCallback((method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(profile)/payment-methods' as never,
      params: { methodType: method.type, methodAccount: method.accountMasked },
    });
  }, [router]);

  const handlePaymentPress = useCallback((payment: RecentPayment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const statusMap: Record<string, string> = {
      paid: 'success',
      pending: 'pending',
      failed: 'failed',
      processing: 'pending',
    };
    // Look up raw payment data for additional fields
    const rawPayment = resolvedData?.recent_payments?.find(p => p.id === payment.id);
    router.push({
      pathname: '/(payment)/status' as never,
      params: {
        paymentId: payment.id,
        initialStatus: statusMap[payment.status] ?? 'pending',
        amount: String(payment.amount),
        cashback: String(rawPayment?.cashback_earned ?? 0),
        transactionId: payment.id,
      },
    });
  }, [router, resolvedData?.recent_payments]);

  // ==============================================
  // LOADING STATE
  // ==============================================

  if (isLoading) {
    return (
      <Screen testID="home-screen-loading" padded={false}>
        <View style={styles.loadingContainer}>
          <Logo size={64} />
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text variant="bodyMd2" color="muted" style={styles.loadingText}>
            Loading your dashboard...
          </Text>
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
            {error instanceof Error ? error.message : 'Unable to load your dashboard. Please try again.'}
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
        <HomeHeader userName={userName} unreadCount={unreadCount} />

        <View style={styles.mainContent}>
          {/* Dashboard Content */}
          {renderDashboardContent(dashboardState, {
            tenancy,
            upcomingPayment,
            cashback,
            paymentMethods,
            recentPayments,
            cashbackEntries,
            emptyStateVariant,
            carouselItems,
            daysUntilDue,
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
            onHowItWorks: handleHowItWorks,
          })}
        </View>
      </ScrollView>

      {/* Fixed Bottom Footer - Figma: absolutely positioned, height 118, bg #202020 */}
      {/* Figma nodes: frame_1686557229 across 243-2762, 243-2967, 243-3170, 243-3378 */}
      {showBottomFooter ? (
        <View style={styles.bottomFooterContainer}>
          <BottomFooter
            dueInDays={daysUntilDue}
            amount={rentAmount}
            buttonLabel="Review & pay"
            disabled={false} // All states can trigger payment — verification sheet gates if needed
            onPress={handlePayNow}
          />
        </View>
      ) : null}

      {/* Payment Method Selection Sheet Overlay */}
      <PaymentMethodSelectionSheet
        visible={showPaymentSheet}
        methods={sheetPaymentMethods}
        selectedMethodId={selectedSheetMethod}
        onClose={() => setShowPaymentSheet(false)}
        onSelectMethod={handleSheetSelectMethod}
        onAddNewMethod={handleSheetAddNewMethod}
      />

      {/* Rent Amount Modal */}
      <RentAmountModal
        visible={showRentAmountModal}
        initialAmount={tenancy?.monthly_rent ?? 0}
        onClose={() => setShowRentAmountModal(false)}
        onPay={handleRentAmountConfirm}
      />

      {/* Verification Check Sheet — shown before payment when setup incomplete */}
      <VerificationCheckSheet
        visible={showVerificationSheet}
        onClose={() => setShowVerificationSheet(false)}
        onFinishSetup={handleVerificationFinishSetup}
        onSkipToPayment={handleVerificationSkip}
        utilityVerified={verificationStatus?.utility_verified ?? false}
        landlordApproved={verificationStatus?.landlord_approved ?? false}
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
  cashbackEntries: MappedCashbackEntry[];
  emptyStateVariant: EmptyStateVariant;
  carouselItems: CarouselCardItem[];
  daysUntilDue: number;
  isOverdue: boolean;
  isMissed: boolean;
  isMultipleOverdue: boolean;
  missedMonthName: string;
  activeTab: TabId;
  cashbackBalance: number;
  allTimeCashback: number;
  cashbackRate: number;
  statusNotification: { type: NotificationType; message?: string } | null;
  onTabChange: (tab: TabId) => void;
  onAddPayment: () => void;
  onFinishSetup: () => void;
  onPayNow: () => void;
  onAddAgreement: () => void;
  onSendReminder: () => void;
  onContactSupport: () => void;
  onPaymentMethodPress: (method: PaymentMethod) => void;
  onPaymentMethodEdit: (method: PaymentMethod) => void;
  onPaymentPress: (payment: RecentPayment) => void;
  onHowItWorks?: () => void;
}

function renderDashboardContent(state: DashboardState, props: ContentProps) {
  const {
    tenancy,
    upcomingPayment,
    cashback,
    paymentMethods,
    recentPayments,
    cashbackEntries,
    emptyStateVariant,
    carouselItems,
    daysUntilDue,
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
    onHowItWorks,
  } = props;

  switch (state) {
    case 'no_tenancy':
      // Users without a tenancy should never reach the main dashboard —
      // the journey router (index.tsx) gates on user_status and redirects
      // to agreement/waitlist/setup as appropriate. Return null; the
      // component-level useEffect below will redirect back to the router.
      return null;

    case 'pending_verification': {
      const verificationStatus = tenancy?.verification_status;

      // Sub-case A: Zero transactions — render HomeEmptyState with flip card + divider + CTA
      if (recentPayments.length === 0) {
        return (
          <View style={styles.contentContainer}>
            <HomeEmptyState
              variant={emptyStateVariant}
              daysUntilDue={daysUntilDue}
              carouselItems={carouselItems}
              bankDetailsComplete={verificationStatus?.bank_verified ?? false}
              addressProofComplete={verificationStatus?.utility_verified ?? false}
              landlordInvited={verificationStatus?.landlord_approved ?? false}
              paymentMethods={paymentMethods}
              cashbackAccrued={cashback?.pending_balance ?? 0}
              cashbackAllTime={cashback?.total_earned ?? 0}
              cashbackRate={0.8}
              onAddPayment={onAddPayment}
              onFinishSetup={onFinishSetup}
              onCtaPress={onHowItWorks}
              onSendReminder={onSendReminder}
              onContactSupport={onContactSupport}
              onPaymentMethodPress={onPaymentMethodPress}
              onPaymentMethodEdit={onPaymentMethodEdit}
            />
            {statusNotification ? (
                <StatusNotificationBanner
                  type={statusNotification.type}
                  customMessage={statusNotification.message}
                  onPress={onFinishSetup}
                />
            ) : null}
          </View>
        );
      }

      // Sub-case B: Has transactions — render active-style layout inline
      const pvHeadlineVariant = isOverdue ? 'overdue' : 'due';
      const pvDaysValue = isOverdue ? Math.abs(daysUntilDue) : daysUntilDue;

      return (
        <View style={styles.contentContainer}>
          <HeadlineSection
            variant={pvHeadlineVariant}
            daysUntilDue={pvHeadlineVariant === 'due' ? pvDaysValue : undefined}
            daysOverdue={pvHeadlineVariant === 'overdue' ? pvDaysValue : undefined}
          />
          <RentStatusCarousel items={carouselItems} />
          {statusNotification ? (
              <StatusNotificationBanner
                type={statusNotification.type}
                customMessage={statusNotification.message}
                onPress={onFinishSetup}
              />
          ) : null}
          <View style={styles.tabSection}>
            <TabSwitcher activeTab={activeTab} onTabChange={onTabChange} />
            {activeTab === 'recent_payments' ? (
              <RecentPaymentsList
                payments={recentPayments}
                onPaymentPress={onPaymentPress}
              />
            ) : (
              <CashbackEmptyState
                accruedAmount={cashbackBalance}
                allTimeTotal={allTimeCashback}
                cashbackRate={cashbackRate}
                showPlaceholder={true}
              />
            )}
          </View>
          {/* Divider — Figma 684:9207 */}
          <View style={styles.sectionDivider} />
          <SetupProgressCard
            bankDetailsComplete={verificationStatus?.bank_verified ?? false}
            addressProofComplete={verificationStatus?.utility_verified ?? false}
            landlordInvited={verificationStatus?.landlord_approved ?? false}
            onCtaPress={onHowItWorks}
          />
        </View>
      );
    }

    case 'all_verified':
    case 'payment_due':
    case 'payment_overdue':
      // Active states with payment methods, tabs, and payment list
      const headlineVariant = isMultipleOverdue ? 'multiple_overdue' : isMissed ? 'missed' : isOverdue ? 'overdue' : 'due';
      const daysValue = isOverdue ? Math.abs(daysUntilDue) : daysUntilDue;

      return (
        <View style={styles.contentContainer}>
          {/* Headline: "Your rent is due in X days"
              Figma 243:2764 / 243:5872 (Frame 2095586453): HeadlineSection handles its own
              paddingLeft: 64, paddingRight: 64 -- DO NOT add parent padding */}
          <HeadlineSection
            variant={headlineVariant}
            daysUntilDue={headlineVariant === 'due' ? daysValue : undefined}
            daysOverdue={headlineVariant === 'overdue' ? daysValue : undefined}
            missedMonth={headlineVariant === 'missed' ? (missedMonthName || 'This Month') : undefined}
          />

          {/* Rent Status Carousel - cards + Setup card
              Figma 243:5877 (Frame 2095586448): RentStatusCarousel handles its own
              paddingLeft: 64, paddingRight: 32, gap: 16 -- DO NOT add parent padding */}
          <RentStatusCarousel items={carouselItems} />

          {statusNotification ? (
              <StatusNotificationBanner
                type={statusNotification.type}
                customMessage={statusNotification.message}
              />
          ) : null}

          {/* Tab Section (Frame 1686557297): wraps Toggle + payment list content */}
          <View style={styles.tabSection}>
        <TabSwitcher activeTab={activeTab} onTabChange={onTabChange} />

        {/* Tab Content - gap 48 separates toggle from content */}
        {activeTab === 'recent_payments' ? (
          recentPayments.length > 0 ? (
            <RecentPaymentsList
              payments={recentPayments}
              onPaymentPress={onPaymentPress}
            />
          ) : (
            <EmptyPaymentsState />
          )
        ) : (
          cashbackEntries.length > 0 ? (
            <CashbacksList
              balance={cashbackBalance}
              allTimeTotal={allTimeCashback}
              cashbackRate={cashbackRate}
              entries={cashbackEntries}
            />
          ) : (
            <CashbackEmptyState
              accruedAmount={cashbackBalance}
              allTimeTotal={allTimeCashback}
              cashbackRate={cashbackRate}
              showPlaceholder={true}
            />
          )
        )}
      </View>

          {/* Warning Banner — below tabs, only for overdue/missed active states */}
          {(() => {
            if (isMultipleOverdue) return <WarningBanner type="multiple" />;
            if (isMissed) return <WarningBanner type="missed" />;
            if (isOverdue) return <WarningBanner type="late" />;
            return null;
          })()}
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

          {cashback && (cashback.available_balance ?? 0) > 0 ? (
            <View style={styles.cashbackCard}>
              <Text variant="bodySm" color="muted">
                Available Cashback
              </Text>
              <Text variant="h4" color="accent">
                Rs.{(cashback.available_balance ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}
        </View>
      );

    default:
      return (
        <View style={styles.contentContainer}>
          <View style={styles.emptyStateContainer}>
            <Logo size={64} />
            <Text variant="bodyMd2" color="muted" align="center" style={styles.emptyStateText}>
              Loading your dashboard...
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.black[700], // Figma: #131313 (colors.black[700])
  },
  loadingText: {
    marginTop: 12,
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
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
    overflow: 'hidden', // Figma: clipsContent true
    // NOTE: paddingHorizontal 32 is handled by child components (RecentPaymentsList, CashbacksList, etc.)
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40, // Figma: larger padding for empty state centering
    gap: 16,
  },
  emptyStateText: {
    marginTop: 8,
    textAlign: 'center', // Figma: textAlignHorizontal CENTER
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
