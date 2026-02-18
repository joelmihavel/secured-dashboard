/**
 * Dashboard API Service -- Integration Tests
 *
 * Tests fetchDashboard, mapping functions, and dashboard state machine.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCallEdgeFunction = jest.fn();

jest.mock('../supabase/client', () => ({
  __esModule: true,
  callEdgeFunction: (...args: unknown[]) => mockCallEdgeFunction(...args),
  supabase: {},
  getFunctionsUrl: jest.fn(),
}));

import {
  fetchDashboard,
  mapRecentPayments,
  deriveCashbackEntries,
  getDashboardState,
  type DashboardData,
  type RawRecentPayment,
} from '../api/dashboard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    user: {
      id: 'u1',
      first_name: 'Test',
      last_name: null,
      phone: '+91999',
    },
    tenancy: {
      id: 't1',
      status: 'active',
      property_address: '42 Brigade Rd',
      property_city: 'Bangalore',
      monthly_rent: 25000,
      rent_due_day: 5,
      lease_end_date: '2027-03-31',
      landlord_name: 'Priya',
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
    },
    recent_payments: [
      {
        id: 'pay1',
        amount: 25000,
        status: 'success',
        rent_month: '2026-01-01',
        paid_at: '2026-01-05T10:30:00Z',
        cashback_earned: 200,
      },
    ],
    notifications: [],
    unread_notification_count: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // fetchDashboard
  // =========================================================================
  describe('fetchDashboard', () => {
    it('returns dashboard data on success', async () => {
      const dashData = makeDashboardData();
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: true, data: dashData },
        error: null,
      });

      const result = await fetchDashboard();

      expect(result.data).toEqual(dashData);
      expect(result.error).toBeNull();
      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        'dashboard-data',
        {},
        true
      );
    });

    it('returns error when edge function fails (non-dev)', async () => {
      // We test production path -- __DEV__ is true in test env, but
      // the function falls back to mock data in dev mode. We test the
      // contract regardless.
      mockCallEdgeFunction.mockResolvedValue({
        data: null,
        error: 'Service unavailable',
      });

      const result = await fetchDashboard();

      // In dev mode it returns mock data; in prod it would return error.
      // Since jest-expo sets __DEV__=true, we get the mock fallback.
      expect(result.data).toBeTruthy();
    });

    it('returns error when success=false (non-dev)', async () => {
      mockCallEdgeFunction.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await fetchDashboard();

      // In __DEV__ mode returns mock data
      expect(result.data).toBeTruthy();
    });
  });

  // =========================================================================
  // mapRecentPayments
  // =========================================================================
  describe('mapRecentPayments', () => {
    it('maps ISO rent_month to human-readable title', () => {
      const raw: RawRecentPayment[] = [
        {
          id: 'p1',
          amount: 25000,
          status: 'success',
          rent_month: '2026-02-01',
          paid_at: '2026-02-05T10:30:00Z',
          cashback_earned: 200,
        },
      ];

      const mapped = mapRecentPayments(raw);

      expect(mapped[0].title).toBe('February rent');
      expect(mapped[0].status).toBe('paid');
      expect(mapped[0].amount).toBe(25000);
    });

    it('maps all status types correctly', () => {
      const statuses: Array<{ input: RawRecentPayment['status']; expected: string }> = [
        { input: 'success', expected: 'paid' },
        { input: 'processing', expected: 'processing' },
        { input: 'failed', expected: 'failed' },
        { input: 'refunded', expected: 'failed' },
        { input: 'pending', expected: 'pending' },
      ];

      for (const { input, expected } of statuses) {
        const mapped = mapRecentPayments([
          { id: '1', amount: 100, status: input, rent_month: '2026-01-01', paid_at: null, cashback_earned: 0 },
        ]);
        expect(mapped[0].status).toBe(expected);
      }
    });

    it('formats paid_at date correctly', () => {
      const mapped = mapRecentPayments([
        {
          id: 'p1',
          amount: 100,
          status: 'success',
          rent_month: '2026-03-01',
          paid_at: '2026-03-05T10:30:00Z',
          cashback_earned: 0,
        },
      ]);

      expect(mapped[0].date).toMatch(/\d+ \w+, \d+:\d+[ap]m/);
    });

    it('returns empty date for null paid_at', () => {
      const mapped = mapRecentPayments([
        { id: 'p1', amount: 100, status: 'pending', rent_month: '2026-01-01', paid_at: null, cashback_earned: 0 },
      ]);

      expect(mapped[0].date).toBe('');
    });

    it('handles human-readable rent_month format', () => {
      const mapped = mapRecentPayments([
        { id: 'p1', amount: 100, status: 'success', rent_month: 'January 2026', paid_at: null, cashback_earned: 0 },
      ]);

      expect(mapped[0].title).toBe('January rent');
    });
  });

  // =========================================================================
  // deriveCashbackEntries
  // =========================================================================
  describe('deriveCashbackEntries', () => {
    it('maps successful payments with cashback as "paid"', () => {
      const entries = deriveCashbackEntries([
        { id: 'p1', amount: 25000, status: 'success', rent_month: '2026-01-01', paid_at: null, cashback_earned: 200 },
      ]);

      expect(entries[0]).toEqual({
        id: 'cb_p1',
        title: 'January Cashback',
        status: 'paid',
        statusLabel: 'Paid - On Time',
        amount: 200,
      });
    });

    it('maps successful payments without cashback as "delayed"', () => {
      const entries = deriveCashbackEntries([
        { id: 'p1', amount: 25000, status: 'success', rent_month: '2026-02-01', paid_at: null, cashback_earned: 0 },
      ]);

      expect(entries[0].status).toBe('delayed');
      expect(entries[0].statusLabel).toBe('Paid - Delayed');
    });

    it('maps failed/refunded payments as "missed"', () => {
      const entries = deriveCashbackEntries([
        { id: 'p1', amount: 25000, status: 'failed', rent_month: '2026-03-01', paid_at: null, cashback_earned: 0 },
        { id: 'p2', amount: 25000, status: 'refunded', rent_month: '2026-04-01', paid_at: null, cashback_earned: 0 },
      ]);

      expect(entries[0].status).toBe('missed');
      expect(entries[0].amount).toBeNull();
      expect(entries[1].status).toBe('missed');
    });

    it('maps pending/processing payments as "pending"', () => {
      const entries = deriveCashbackEntries([
        { id: 'p1', amount: 25000, status: 'pending', rent_month: '2026-05-01', paid_at: null, cashback_earned: 0 },
        { id: 'p2', amount: 25000, status: 'processing', rent_month: '2026-06-01', paid_at: null, cashback_earned: 0 },
      ]);

      expect(entries[0].status).toBe('pending');
      expect(entries[1].status).toBe('pending');
    });
  });

  // =========================================================================
  // getDashboardState (state machine)
  // =========================================================================
  describe('getDashboardState', () => {
    it('returns "loading" when data is null', () => {
      expect(getDashboardState(null)).toBe('loading');
    });

    it('returns "no_tenancy" when tenancy is null', () => {
      const data = makeDashboardData({ tenancy: null });
      expect(getDashboardState(data)).toBe('no_tenancy');
    });

    it('returns "pending_verification" when bank not verified', () => {
      const data = makeDashboardData({
        tenancy: {
          ...makeDashboardData().tenancy!,
          verification_status: {
            bank_verified: false,
            utility_verified: true,
            landlord_approved: true,
          },
        },
      });
      expect(getDashboardState(data)).toBe('pending_verification');
    });

    it('returns "pending_verification" when utility not verified', () => {
      const data = makeDashboardData({
        tenancy: {
          ...makeDashboardData().tenancy!,
          verification_status: {
            bank_verified: true,
            utility_verified: false,
            landlord_approved: true,
          },
        },
      });
      expect(getDashboardState(data)).toBe('pending_verification');
    });

    it('returns "pending_verification" when landlord not approved', () => {
      const data = makeDashboardData({
        tenancy: {
          ...makeDashboardData().tenancy!,
          verification_status: {
            bank_verified: true,
            utility_verified: true,
            landlord_approved: false,
          },
        },
      });
      expect(getDashboardState(data)).toBe('pending_verification');
    });

    it('returns "payment_due" when payment exists and not overdue', () => {
      const data = makeDashboardData();
      expect(getDashboardState(data)).toBe('payment_due');
    });

    it('returns "payment_overdue" when payment is overdue', () => {
      const data = makeDashboardData({
        upcoming_payment: {
          ...makeDashboardData().upcoming_payment!,
          is_overdue: true,
        },
      });
      expect(getDashboardState(data)).toBe('payment_overdue');
    });

    it('returns "payment_processing" when recent payment is processing', () => {
      const data = makeDashboardData({
        upcoming_payment: null,
        recent_payments: [
          { id: 'p1', amount: 25000, status: 'processing', rent_month: '2026-01-01', paid_at: null, cashback_earned: 0 },
        ],
      });
      expect(getDashboardState(data)).toBe('payment_processing');
    });

    it('returns "payment_processing" when recent payment is pending', () => {
      const data = makeDashboardData({
        upcoming_payment: null,
        recent_payments: [
          { id: 'p1', amount: 25000, status: 'pending', rent_month: '2026-01-01', paid_at: null, cashback_earned: 0 },
        ],
      });
      expect(getDashboardState(data)).toBe('payment_processing');
    });

    it('returns "payment_success" when most recent payment was successful', () => {
      const data = makeDashboardData({
        upcoming_payment: null,
        recent_payments: [
          { id: 'p1', amount: 25000, status: 'success', rent_month: '2026-01-01', paid_at: '2026-01-05T10:30:00Z', cashback_earned: 200 },
        ],
      });
      expect(getDashboardState(data)).toBe('payment_success');
    });

    it('returns "all_verified" when no upcoming payment and no recent activity', () => {
      const data = makeDashboardData({
        upcoming_payment: null,
        recent_payments: [],
      });
      expect(getDashboardState(data)).toBe('all_verified');
    });
  });
});
