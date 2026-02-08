/**
 * Dashboard Hooks
 *
 * React Query hooks for dashboard data fetching and caching.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchDashboard,
  DashboardData,
  DashboardState,
  getDashboardState,
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
  });

  // Derive dashboard state from data
  const dashboardState: DashboardState = getDashboardState(query.data ?? null);

  return {
    ...query,
    dashboardState,

    // Convenience accessors
    user: query.data?.user ?? null,
    tenancy: query.data?.tenancy ?? null,
    upcomingPayment: query.data?.upcoming_payment ?? null,
    cashback: query.data?.cashback ?? null,
    recentPayments: query.data?.recent_payments ?? [],
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unread_notification_count ?? 0,
  };
}

// ==============================================
// REFRESH HOOK
// ==============================================

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
 * Hook to get cashback info
 */
export function useCashback() {
  const { cashback, isLoading, error } = useDashboard();

  return {
    isLoading,
    error,
    availableBalance: cashback?.available_balance ?? 0,
    pendingBalance: cashback?.pending_balance ?? 0,
    totalEarned: cashback?.total_earned ?? 0,
    totalUsed: cashback?.total_used ?? 0,
    hasBalance: (cashback?.available_balance ?? 0) > 0,
  };
}
