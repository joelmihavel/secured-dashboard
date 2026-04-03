/**
 * Dashboard Hooks
 *
 * React Query hooks for dashboard data fetching and caching.
 * Provides raw data accessors and UI-mapped data (payments, cashback entries).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchFeeConfig } from '../services/payment';
import { paymentKeys } from './usePayments';
import {
  fetchDashboard,
  DashboardData,
  DashboardState,
  getDashboardState,
  mapRecentPayments,
  deriveCashbackEntries,
  MappedRecentPayment,
  MappedCashbackEntry,
  DashboardPaymentStamps,
} from '../services/api/dashboard';
import { useRealtimeQuery } from './useRealtimeQuery';
import { useAuthStore } from '../stores/auth';
import { subscribe } from '../services/supabase/realtimeManager';
import { supabase } from '../services/supabase/client';

// ==============================================
// QUERY KEYS
// ==============================================

export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
  notifications: () => [...dashboardKeys.all, 'notifications'] as const,
};

// Tracks when in-flight payment polling started (module-level, reset on resolution)
let _pollingStartedAt: number | null = null;

// ==============================================
// DASHBOARD QUERY
// ==============================================

export interface UseDashboardOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useDashboard(options: UseDashboardOptions = {}) {
  const { enabled = true, refetchInterval } = options;

  const query = useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: async () => {
      const { data, error } = await fetchDashboard();
      if (error) {
        throw new Error(error);
      }
      return data;
    },
    enabled,
    // Poll every 5s when a payment is processing/initiated in the data.
    // Stops automatically when the payment resolves to success/failed,
    // or after 10 minutes to prevent indefinite polling on stuck payments.
    // Caller-provided refetchInterval takes priority if set.
    refetchInterval: refetchInterval ?? ((data) => {
      const hasInFlight = data?.recent_payments?.some(
        (p) => p.status === 'processing' || p.status === 'initiated'
      );
      if (!hasInFlight) {
        _pollingStartedAt = null;
        return false;
      }
      if (!_pollingStartedAt) _pollingStartedAt = Date.now();
      const elapsed = Date.now() - _pollingStartedAt;
      if (elapsed > 2 * 60 * 1000) return false; // 2 min cutoff
      return 5000;
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    // Re-fetch when app comes back to foreground (e.g., after PayU checkout or bank app)
    refetchOnWindowFocus: true,
    // Re-fetch on mount only when data is stale (older than staleTime of 2 min)
    refetchOnMount: true,
    // Retry transient network failures (useful when switching from bank app back to the app)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Prefetch fee rates in background once dashboard loads — eliminates fee flash in payment flow
  const queryClient = useQueryClient();
  const feeRatesPrefetched = useRef(false);
  useEffect(() => {
    if (query.data && !feeRatesPrefetched.current) {
      feeRatesPrefetched.current = true;
      queryClient.prefetchQuery({
        queryKey: paymentKeys.feeRates(),
        queryFn: fetchFeeConfig,
        staleTime: 1000 * 60 * 60, // 1 hour
      });
    }
  }, [query.data, queryClient]);

  // Derive dashboard state from data
  const dashboardState: DashboardState = getDashboardState(query.data ?? null);

  // Map raw recent_payments to UI-ready shape for RecentPaymentsList
  const mappedRecentPayments: MappedRecentPayment[] = useMemo(
    () => mapRecentPayments(query.data?.recent_payments ?? []),
    [query.data?.recent_payments]
  );

  // Derive cashback entries from raw recent_payments for CashbacksList
  const mappedCashbackEntries: MappedCashbackEntry[] = useMemo(
    () => deriveCashbackEntries(query.data?.recent_payments ?? []),
    [query.data?.recent_payments]
  );

  // Derive status notification from tenancy + payment state
  const statusNotification = useMemo(() => {
    const tenancy = query.data?.tenancy ?? null;
    const upcomingPayment = query.data?.upcoming_payment ?? null;
    if (!tenancy) return null;
    const vs = tenancy.verification_status;

    // Priority 1: Landlord disputed/rejected
    if (vs?.landlord_response === 'disputed') {
      return { type: 'landlord_rejected' as const, message: undefined };
    }

    // Priority 2: Verifications pending (any incomplete) — prefer backend flag
    const allVerified = query.data?.cashback?.verification_complete ?? false;
    if (!allVerified) {
      return { type: 'verification_pending' as const, message: undefined };
    }

    // Priority 3: Rent due reminder (1st to 7th of month)
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth >= 1 && dayOfMonth <= 7 && upcomingPayment?.due_date) {
      const dueDate = new Date(upcomingPayment.due_date);
      const formatted = !isNaN(dueDate.getTime())
        ? `${dueDate.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dueDate.getMonth()]}`
        : upcomingPayment.due_date;
      return { type: 'rent_due' as const, message: `Your rent is due on ${formatted}` };
    }

    return null;
  }, [query.data?.tenancy, query.data?.upcoming_payment, query.data?.cashback?.verification_complete]);

  // Realtime subscriptions via centralized RealtimeManager
  const tenancyId = query.data?.tenancy?.id;
  const userId = useAuthStore((s) => s.userId);

  // 1. Tenancy status changes (existing, migrated from manual channel)
  useRealtimeQuery({
    table: 'tenancies',
    event: 'UPDATE',
    filter: tenancyId ? `id=eq.${tenancyId}` : undefined,
    queryKeys: [dashboardKeys.all],
    enabled: !!tenancyId,
  });

  // 2. Payment status changes → refresh dashboard + payment history
  useRealtimeQuery({
    table: 'payments',
    event: 'UPDATE',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKeys: [dashboardKeys.all, paymentKeys.history()],
    enabled: !!userId,
  });

  // 3. New notifications → refresh dashboard (updates unread count)
  useRealtimeQuery({
    table: 'notifications',
    event: 'INSERT',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKeys: [dashboardKeys.all],
    enabled: !!userId,
  });

  // 4. User profile changes → refresh dashboard
  useRealtimeQuery({
    table: 'users',
    event: 'UPDATE',
    filter: userId ? `id=eq.${userId}` : undefined,
    queryKeys: [dashboardKeys.all],
    enabled: !!userId,
  });

  // 5. User deletion → instant force logout
  // When a user is deleted from public.users (admin or backend),
  // sign out locally immediately without waiting for JWT expiry.
  // Replica identity is FULL on users table, so old_record contains all columns.
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribe(
      'users',
      'DELETE',
      async (payload: any) => {
        const deletedId = payload.old?.id ?? payload.old_record?.id;
        if (deletedId === userId) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      },
      `id=eq.${userId}`,
    );

    return unsubscribe;
  }, [userId]);

  // Error handling: only null out data when there is NO cached data at all.
  // A background refetch failure (e.g., network blip, ISP block) should NOT
  // wipe previously loaded dashboard data — the cached data is still valid.
  // This prevents setup screens from showing "No active tenancy found" when
  // a transient refetch fails while the user is mid-form.
  const hasData = query.data != null;
  const isFatalError = query.isError && !hasData;

  return {
    ...query,
    dashboardState: isFatalError ? ('error' as DashboardState) : dashboardState,

    // Raw data accessors — only nulled when no cached data exists
    user: isFatalError ? null : (query.data?.user ?? null),
    tenancy: isFatalError ? null : (query.data?.tenancy ?? null),
    upcomingPayment: isFatalError ? null : (query.data?.upcoming_payment ?? null),
    cashback: isFatalError ? null : (query.data?.cashback ?? null),
    rawRecentPayments: isFatalError ? [] : (query.data?.recent_payments ?? []),
    notifications: isFatalError ? [] : (query.data?.notifications ?? []),
    unreadCount: isFatalError ? 0 : (query.data?.unread_notification_count ?? 0),

    // Landlord bank account (for edit bank details)
    landlordBank: isFatalError ? null : (query.data?.landlord_bank ?? null),

    // Payment stamps
    paymentStamps: isFatalError ? null : (query.data?.payment_stamps ?? null),

    // Status notification (derived from tenancy + payment state)
    statusNotification: isFatalError ? null : statusNotification,

    // UI-mapped data for home screen components
    recentPayments: isFatalError ? [] : mappedRecentPayments,
    cashbackEntries: isFatalError ? [] : mappedCashbackEntries,
  };
}

// ==============================================
// REFRESH HOOK
// ==============================================

/**
 * Returns a function that invalidates all dashboard-related queries.
 * Use this for pull-to-refresh to ensure stale data is re-fetched.
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  }, [queryClient]);

  return refresh;
}

// ==============================================
// SELECTOR HOOKS
// ==============================================

/**
 * Hook to get just the verification status
 */
export function useVerificationStatus() {
  const { tenancy, cashback, isLoading, error } = useDashboard();

  if (!tenancy) {
    return {
      isLoading,
      error,
      bankVerified: false,
      utilityVerified: false,
      landlordApproved: false,
      allVerified: false,
      pendingSteps: [] as string[],
    };
  }

  const { bank_verified, utility_verified, landlord_approved, landlord_status } =
    tenancy.verification_status;

  // Landlord step is done for setup purposes once invite is sent
  const landlordStepDone = landlord_approved
    || landlord_status === 'invited'
    || landlord_status === 'otp_confirmed'
    || landlord_status === 'verified';

  const pendingSteps: string[] = [];
  if (!bank_verified) pendingSteps.push('bank');
  if (!utility_verified) pendingSteps.push('utility');
  if (!landlordStepDone) pendingSteps.push('landlord');

  return {
    isLoading,
    error,
    bankVerified: bank_verified,
    utilityVerified: utility_verified,
    landlordApproved: landlordStepDone,
    allVerified: cashback?.verification_complete ?? (bank_verified && utility_verified && landlordStepDone),
    pendingSteps,
  };
}

/**
 * Hook to get savings/cashback info (instant discount model)
 */
export function useCashback() {
  const { cashback, isLoading, error } = useDashboard();

  return {
    isLoading,
    error,
    discountRate: cashback?.discount_rate ?? 0.01,
    maxDiscountPaise: cashback?.max_discount_paise ?? 0,
    maxDiscount: cashback?.max_discount ?? 0,
    verificationComplete: cashback?.verification_complete ?? false,
    totalSavingsPaise: cashback?.total_savings_paise ?? 0,
    totalSavings: cashback?.total_savings ?? 0,
    legacyWalletBalance: cashback?.legacy_wallet_balance ?? 0,
  };
}
