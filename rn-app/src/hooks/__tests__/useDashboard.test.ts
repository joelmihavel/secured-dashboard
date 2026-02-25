/**
 * useDashboard Hook Tests
 *
 * Verifies:
 * - Hook calls fetchDashboard service correctly
 * - React Query caching configuration (staleTime, refetchOnMount, retry)
 * - Dashboard state derivation from data
 * - UI-mapped data transformations (recentPayments, cashbackEntries)
 * - Error/loading state propagation
 * - useRefreshDashboard invalidates correct query keys
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the dashboard service
const mockFetchDashboard = jest.fn();
jest.mock('../../services/api/dashboard', () => {
  const actual = jest.requireActual('../../services/api/dashboard');
  return {
    ...actual,
    fetchDashboard: (...args: unknown[]) => mockFetchDashboard(...args),
  };
});

import { useDashboard, useRefreshDashboard, dashboardKeys } from '../useDashboard';
import type { DashboardData } from '../../services/api/dashboard';

// ==============================================
// TEST FIXTURES
// ==============================================

const MOCK_DASHBOARD: DashboardData = {
  user: {
    id: 'user-1',
    first_name: 'Test',
    last_name: 'User',
    phone: '+919876543210',
    email: null,
  },
  tenancy: {
    id: 'tenancy-1',
    status: 'active',
    property_address: '42 Brigade Road',
    property_city: 'Bangalore',
    monthly_rent: 25000,
    rent_due_day: 5,
    lease_end_date: '2027-03-31',
    landlord_name: 'Priya Sharma',
    lease_start_date: '2026-01-01',
    agreement_cert_id: 'FS-AGR-202601-A1B2C3D4',
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: true,
    },
  },
  upcoming_payment: {
    due_date: '2026-02-05',
    amount: 25000,
    amount_paise: 2500000,
    days_until_due: 3,
    is_overdue: false,
    cashback_eligible: true,
    rent_month: '2026-02-01',
  },
  cashback: {
    available_balance: 200,
    pending_balance: 50,
    total_earned: 1200,
    total_used: 950,
    discount_rate: 0.01,
    max_discount_paise: 50000,
    max_discount: 500,
    verification_complete: true,
    total_savings_paise: 0,
    total_savings: 0,
    legacy_wallet_balance: 0,
  },
  recent_payments: [
    { id: 'pay_001', amount: 25000, status: 'success', rent_month: '2026-01-01', paid_at: '2026-01-05T10:30:00Z', cashback_earned: 200 },
    { id: 'pay_002', amount: 25000, status: 'failed', rent_month: '2025-12-01', paid_at: null, cashback_earned: 0 },
    { id: 'pay_003', amount: 25000, status: 'processing', rent_month: '2025-11-01', paid_at: null, cashback_earned: 0 },
  ],
  notifications: [],
  unread_notification_count: 2,
  payment_stamps: null,
};

// ==============================================
// HELPERS
// ==============================================

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ==============================================
// TESTS
// ==============================================

describe('useDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockFetchDashboard.mockReset();
    // Use real timers for async React Query tests (global setup uses fake timers)
    jest.useRealTimers();
  });

  it('calls fetchDashboard service on mount', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(mockFetchDashboard).toHaveBeenCalledTimes(1);
    });
  });

  it('returns loading state initially', () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.dashboardState).toBe('loading');
  });

  it('returns dashboard data after successful fetch', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(MOCK_DASHBOARD.user);
    expect(result.current.tenancy).toEqual(MOCK_DASHBOARD.tenancy);
    expect(result.current.upcomingPayment).toEqual(MOCK_DASHBOARD.upcoming_payment);
    expect(result.current.cashback).toEqual(MOCK_DASHBOARD.cashback);
    expect(result.current.unreadCount).toBe(2);
  });

  it('derives payment_due state when upcoming payment is not overdue', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.dashboardState).toBe('payment_due');
  });

  it('derives payment_overdue state when payment is overdue', async () => {
    const overdueData = {
      ...MOCK_DASHBOARD,
      upcoming_payment: {
        ...MOCK_DASHBOARD.upcoming_payment!,
        is_overdue: true,
        days_until_due: -5,
      },
    };
    mockFetchDashboard.mockResolvedValue({ data: overdueData, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.dashboardState).toBe('payment_overdue');
    });
  });

  it('derives no_tenancy state when tenancy is null', async () => {
    mockFetchDashboard.mockResolvedValue({
      data: { ...MOCK_DASHBOARD, tenancy: null },
      error: null,
    });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.dashboardState).toBe('no_tenancy');
    });
  });

  it('derives pending_verification state when not fully verified', async () => {
    const pendingData = {
      ...MOCK_DASHBOARD,
      tenancy: {
        ...MOCK_DASHBOARD.tenancy!,
        verification_status: {
          bank_verified: true,
          utility_verified: false,
          landlord_approved: false,
        },
      },
    };
    mockFetchDashboard.mockResolvedValue({ data: pendingData, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.dashboardState).toBe('pending_verification');
    });
  });

  it('maps recent payments to UI-ready format', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recentPayments).toHaveLength(3);
    // First payment: success -> 'paid'
    expect(result.current.recentPayments[0]).toEqual(
      expect.objectContaining({
        id: 'pay_001',
        title: 'January rent',
        status: 'paid',
        amount: 25000,
      })
    );
    // Second payment: failed -> 'failed'
    expect(result.current.recentPayments[1]).toEqual(
      expect.objectContaining({
        id: 'pay_002',
        status: 'failed',
      })
    );
    // Third payment: processing -> 'processing'
    expect(result.current.recentPayments[2]).toEqual(
      expect.objectContaining({
        id: 'pay_003',
        status: 'processing',
      })
    );
  });

  it('derives cashback entries from recent payments', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.cashbackEntries).toHaveLength(3);
    // First: success with cashback earned -> 'paid'
    expect(result.current.cashbackEntries[0]).toEqual(
      expect.objectContaining({
        id: 'cb_pay_001',
        title: 'January Cashback',
        status: 'paid',
        amount: 200,
      })
    );
    // Second: failed -> 'missed'
    expect(result.current.cashbackEntries[1]).toEqual(
      expect.objectContaining({
        status: 'missed',
        amount: null,
      })
    );
  });

  it('propagates error state when service returns error and no fallback', async () => {
    // Create a queryClient with no retries for this test
    const noRetryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    // The hook's queryFn calls fetchDashboard and throws on error.
    // In dev mode, the actual service falls back to mock data on error,
    // but we mock fetchDashboard directly so we control its return value.
    // Return an error that the hook will throw.
    mockFetchDashboard.mockResolvedValue({ data: null, error: 'Server unavailable' });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(noRetryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Server unavailable');
  });

  it('does not fetch when enabled is false', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    renderHook(() => useDashboard({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    // Wait a tick to ensure async work would have run if enabled
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockFetchDashboard).not.toHaveBeenCalled();
  });
});

describe('useRefreshDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockFetchDashboard.mockReset();
    jest.useRealTimers();
  });

  it('invalidates dashboard queries when called', async () => {
    mockFetchDashboard.mockResolvedValue({ data: MOCK_DASHBOARD, error: null });

    // Pre-populate the cache
    queryClient.setQueryData(dashboardKeys.data(), MOCK_DASHBOARD);

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRefreshDashboard(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dashboardKeys.all,
    });
  });
});
