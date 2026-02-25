/**
 * Dashboard Hooks
 *
 * React Query hooks for dashboard data fetching and caching.
 * Provides raw data accessors and UI-mapped data (payments, cashback entries).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase/client';
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

// ==============================================
// QUERY KEYS
// ==============================================

export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
  notifications: () => [...dashboardKeys.all, 'notifications'] as const,
};

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
    refetchInterval,
    staleTime: 1000 * 60 * 2, // 2 minutes
    // Re-fetch when app comes back to foreground (e.g., after PayU checkout or bank app)
    refetchOnWindowFocus: true,
    // Always re-fetch on mount so dashboard is fresh after navigating back from payment flow
    refetchOnMount: 'always',
    // Retry transient network failures (useful when switching from bank app back to the app)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

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

  // Realtime subscription for tenancy status changes
  const tenancyId = query.data?.tenancy?.id;
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!tenancyId) return;

    const channel = supabase.channel(`tenancy-${tenancyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tenancies',
        filter: `id=eq.${tenancyId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenancyId, queryClient]);

  return {
    ...query,
    dashboardState,

    // Raw data accessors (edge function shape)
    user: query.data?.user ?? null,
    tenancy: query.data?.tenancy ?? null,
    upcomingPayment: query.data?.upcoming_payment ?? null,
    cashback: query.data?.cashback ?? null,
    rawRecentPayments: query.data?.recent_payments ?? [],
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unread_notification_count ?? 0,

    // Payment stamps
    paymentStamps: query.data?.payment_stamps ?? null,

    // UI-mapped data for home screen components
    recentPayments: mappedRecentPayments,
    cashbackEntries: mappedCashbackEntries,
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
  const { tenancy, isLoading, error } = useDashboard();

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

  const { bank_verified, utility_verified, landlord_approved } =
    tenancy.verification_status;

  const pendingSteps: string[] = [];
  if (!bank_verified) pendingSteps.push('bank');
  if (!utility_verified) pendingSteps.push('utility');
  if (!landlord_approved) pendingSteps.push('landlord');

  return {
    isLoading,
    error,
    bankVerified: bank_verified,
    utilityVerified: utility_verified,
    landlordApproved: landlord_approved,
    allVerified: bank_verified && utility_verified && landlord_approved,
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
