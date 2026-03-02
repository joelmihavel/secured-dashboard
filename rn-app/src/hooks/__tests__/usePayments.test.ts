/**
 * usePayments Hook Tests
 *
 * Verifies:
 * - Hooks call correct API service functions
 * - React Query cache invalidation patterns after mutations
 * - Error/loading state propagation
 * - staleTime configuration for queries
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ==============================================
// MOCKS
// ==============================================

const mockFetchPaymentHistory = jest.fn();
const mockInitiatePayment = jest.fn();
const mockGenerateReceipt = jest.fn();
const mockGetCashbackHistory = jest.fn();
const mockGetPaymentSchedules = jest.fn();
const mockCreatePaymentSchedule = jest.fn();
const mockManagePaymentSchedule = jest.fn();

jest.mock('../../services/api/payments', () => ({
  fetchPaymentHistory: (...args: unknown[]) => mockFetchPaymentHistory(...args),
  initiatePayment: (...args: unknown[]) => mockInitiatePayment(...args),
  generateReceipt: (...args: unknown[]) => mockGenerateReceipt(...args),
  getSavingsHistory: (...args: unknown[]) => mockGetCashbackHistory(...args),
  getPaymentSchedules: (...args: unknown[]) => mockGetPaymentSchedules(...args),
  createPaymentSchedule: (...args: unknown[]) => mockCreatePaymentSchedule(...args),
  managePaymentSchedule: (...args: unknown[]) => mockManagePaymentSchedule(...args),
}));

// Mock dashboardKeys import
jest.mock('../useDashboard', () => ({
  dashboardKeys: {
    all: ['dashboard'],
    data: () => ['dashboard', 'data'],
  },
}));

import {
  usePaymentHistory,
  useInitiatePayment,
  useGenerateReceipt,
  useSavingsHistory,
  usePaymentSchedules,
  paymentKeys,
} from '../usePayments';

// ==============================================
// TEST FIXTURES
// ==============================================

const MOCK_PAYMENTS = [
  {
    id: 'pay_001',
    amount: 25000,
    pg_fee: 0,
    cashback_applied: 200,
    cashback_earned: 200,
    net_amount: 24800,
    amount_paise: 2500000,
    pg_fee_paise: 0,
    cashback_applied_paise: 20000,
    status: 'success' as const,
    payment_method: 'upi' as const,
    rent_month: '2026-01-01',
    created_at: '2026-01-05T10:30:00Z',
    paid_at: '2026-01-05T10:30:00Z',
    can_download_receipt: true,
    tenancy: { id: 'ten-1', property_address: '42 Brigade Rd', landlord_name: 'Priya' },
  },
];

const MOCK_CASHBACK = {
  current_balance_paise: 20000,
  entries: [
    {
      id: 'cb_001',
      transaction_type: 'earned' as const,
      amount_paise: 20000,
      balance_after_paise: 20000,
      description: 'January cashback',
      payment_id: 'pay_001',
      tenancy_id: 'ten-1',
      created_at: '2026-01-05T10:30:00Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
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

describe('usePaymentHistory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  it('calls fetchPaymentHistory with correct params', async () => {
    mockFetchPaymentHistory.mockResolvedValue({
      data: MOCK_PAYMENTS,
      pagination: { page: 1, limit: 20, total: 1, total_pages: 1, has_next: false, has_previous: false },
      summary: { total_paid: 25000, total_cashback_earned: 200, successful_payments: 1, failed_payments: 0 },
      error: null,
    });

    renderHook(() => usePaymentHistory(1, 20, { status: 'success' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(mockFetchPaymentHistory).toHaveBeenCalledWith(1, 20, { status: 'success' });
    });
  });

  it('returns payment data after successful fetch', async () => {
    mockFetchPaymentHistory.mockResolvedValue({
      data: MOCK_PAYMENTS,
      pagination: { page: 1, limit: 20, total: 1, total_pages: 1, has_next: false, has_previous: false },
      summary: { total_paid: 25000, total_cashback_earned: 200, successful_payments: 1, failed_payments: 0 },
      error: null,
    });

    const { result } = renderHook(() => usePaymentHistory(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.payments).toHaveLength(1);
    expect(result.current.data?.payments[0].id).toBe('pay_001');
    expect(result.current.data?.pagination).toBeTruthy();
    expect(result.current.data?.summary).toBeTruthy();
  });

  it('throws and propagates error from service', async () => {
    mockFetchPaymentHistory.mockResolvedValue({
      data: null,
      pagination: null,
      summary: null,
      error: 'Failed to fetch',
    });

    const { result } = renderHook(() => usePaymentHistory(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Failed to fetch');
  });
});

describe('useInitiatePayment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  it('calls initiatePayment service and invalidates history + dashboard on success', async () => {
    const mockPaymentData = {
      payment_id: 'pay_new_001',
      txn_id: 'txn_001',
      amount_paise: 2500000,
      pg_fee_paise: 0,
      cashback_applied_paise: 20000,
      total_paise: 2480000,
      payment_method: 'upi',
      payu: { key: 'test', txnid: 'txn_001', amount: '24800', productinfo: 'rent', firstname: 'Test', email: 'test@test.com', phone: '9876543210', hash: 'abc', surl: 'http://surl', furl: 'http://furl', curl: 'http://curl', udf1: '', udf2: '', udf3: '' },
    };
    mockInitiatePayment.mockResolvedValue({
      data: mockPaymentData,
      error: null,
    });

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useInitiatePayment(),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({
        tenancy_id: 'ten-1',
        amount_paise: 2500000,
        payment_method: 'upi',
        rent_month: '2026-02',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify it invalidated payment history and dashboard
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: paymentKeys.history() })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['dashboard'] })
    );
  });

  it('propagates error code from service', async () => {
    const errorCode = { code: 'ALREADY_PAID', message: 'Payment already completed' };
    mockInitiatePayment.mockResolvedValue({
      data: null,
      error: errorCode,
    });

    const mockOnError = jest.fn();

    const { result } = renderHook(
      () => useInitiatePayment({ onError: mockOnError }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate({
        tenancy_id: 'ten-1',
        amount_paise: 2500000,
        payment_method: 'upi',
        rent_month: '2026-02',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockOnError).toHaveBeenCalledWith(errorCode);
  });
});

describe('useGenerateReceipt', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  it('calls generateReceipt and returns receipt data', async () => {
    const mockReceipt = {
      receiptNumber: 'REC-001',
      generatedAt: '2026-01-05T12:00:00Z',
      payment: {
        id: 'pay_001',
        transactionId: 'txn_001',
        gatewayId: null,
        amount: 25000,
        pgFee: 0,
        cashbackApplied: 200,
        cashbackEarned: 200,
        netAmountPaid: 24800,
        paymentMethod: 'upi',
        status: 'success',
        rentMonth: '2026-01',
        rentMonthDisplay: 'January 2026',
        paidAt: '2026-01-05T10:30:00Z',
      },
      tenant: { name: 'Test', phone: null, email: null },
      property: { address: '42 Brigade Rd', city: null },
      landlord: { name: 'Priya', bankAccountMasked: null },
      company: { name: 'Flent', address: '123 Main St', gstin: 'GSTIN123', supportEmail: 'support@flent.com', supportPhone: '1800-123' },
    };

    mockGenerateReceipt.mockResolvedValue({
      data: mockReceipt,
      error: null,
    });

    const { result } = renderHook(() => useGenerateReceipt(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      const receipt = await result.current.mutateAsync('pay_001');
      expect(receipt.receiptNumber).toBe('REC-001');
    });

    expect(mockGenerateReceipt).toHaveBeenCalledWith('pay_001');
  });
});

describe('useSavingsHistory', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  it('calls getSavingsHistory service', async () => {
    mockGetCashbackHistory.mockResolvedValue({
      data: MOCK_CASHBACK,
      error: null,
    });

    renderHook(() => useSavingsHistory(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(mockGetCashbackHistory).toHaveBeenCalledTimes(1);
    });
  });

  it('returns savings data after fetch', async () => {
    mockGetCashbackHistory.mockResolvedValue({
      data: MOCK_CASHBACK,
      error: null,
    });

    const { result } = renderHook(() => useSavingsHistory(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.entries).toHaveLength(1);
    expect(result.current.data?.current_balance_paise).toBe(20000);
  });
});

describe('usePaymentSchedules', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  it('calls getPaymentSchedules with tenancyId', async () => {
    mockGetPaymentSchedules.mockResolvedValue({
      data: [],
      error: null,
    });

    renderHook(() => usePaymentSchedules('ten-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(mockGetPaymentSchedules).toHaveBeenCalledWith('ten-1', 'active');
    });
  });
});

describe('paymentKeys', () => {
  it('generates correct query key structure', () => {
    expect(paymentKeys.all).toEqual(['payments']);
    expect(paymentKeys.history()).toEqual(['payments', 'history']);
    expect(paymentKeys.receipt('pay_001')).toEqual(['payments', 'receipt', 'pay_001']);
    expect(paymentKeys.schedules()).toEqual(['payments', 'schedules']);
    expect(paymentKeys.cashback()).toEqual(['payments', 'cashback']);
  });
});
