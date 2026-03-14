/**
 * Dashboard Hooks
 *
 * React Query hooks for dashboard data fetching and caching.
 * Provides raw data accessors and UI-mapped data (payments, cashback entries).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
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
import { paymentKeys } from './usePayments';
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
    // Re-fetch on mount only when data is stale (older than staleTime of 2 min)
    refetchOnMount: true,
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
  }, [query.data?.tenancy, query.data?.upcoming_payment]);

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

  // When the query is in error state, return null values instead of stale cached data
  // to prevent the UI from showing outdated information after a failed refresh.
  const hasError = query.isError;

  return {
    ...query,
    dashboardState: hasError ? ('error' as DashboardState) : dashboardState,

    // Raw data accessors (edge function shape) — nulled on error to avoid stale display
    user: hasError ? null : (query.data?.user ?? null),
    tenancy: hasError ? null : (query.data?.tenancy ?? null),
    upcomingPayment: hasError ? null : (query.data?.upcoming_payment ?? null),
    cashback: hasError ? null : (query.data?.cashback ?? null),
    rawRecentPayments: hasError ? [] : (query.data?.recent_payments ?? []),
    notifications: hasError ? [] : (query.data?.notifications ?? []),
    unreadCount: hasError ? 0 : (query.data?.unread_notification_count ?? 0),

    // Landlord bank account (for edit bank details)
    landlordBank: hasError ? null : (query.data?.landlord_bank ?? null),

    // Payment stamps
    paymentStamps: hasError ? null : (query.data?.payment_stamps ?? null),

    // Status notification (derived from tenancy + payment state)
    statusNotification: hasError ? null : statusNotification,

    // UI-mapped data for home screen components
    recentPayments: hasError ? [] : mappedRecentPayments,
    cashbackEntries: hasError ? [] : mappedCashbackEntries,
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
    allVerified: cashback?.verification_complete ?? (bank_verified && utility_verified && landlord_approved),
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
