/**
 * Dashboard API Service
 *
 * Fetches aggregated dashboard data including user info,
 * tenancy, upcoming payment, cashback, and notifications.
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES
// ==============================================

export interface DashboardUser {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
  role?: string;
  user_status?: string;
  kyc_status?: string | null;
  cashback_balance_paise?: number;
}

export interface TenancyVerificationStatus {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
}

export interface DashboardTenancy {
  id: string;
  status: 'pending_verification' | 'active' | 'expired' | 'terminated';
  property_address: string;
  property_city: string | null;
  monthly_rent: number; // In rupees
  rent_due_day: number;
  lease_end_date: string | null;
  landlord_name: string;
  verification_status: TenancyVerificationStatus;
}

export interface UpcomingPayment {
  due_date: string;
  amount: number; // In rupees
  amount_paise: number;
  days_until_due: number;
  is_overdue: boolean;
  cashback_eligible: boolean;
  rent_month: string;
}

export interface CashbackBalance {
  available_balance: number; // In rupees
  pending_balance: number;
  total_earned: number;
  total_used: number;
}

export interface RecentPayment {
  id: string;
  amount: number; // In rupees
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
  rent_month: string;
  paid_at: string | null;
  cashback_earned: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  action_type: string | null;
  action_data: unknown | null;
  created_at: string;
  read: boolean;
}

export interface DashboardData {
  user: DashboardUser;
  tenancy: DashboardTenancy | null;
  upcoming_payment: UpcomingPayment | null;
  cashback: CashbackBalance;
  recent_payments: RecentPayment[];
  notifications: Notification[];
  unread_notification_count: number;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Mock dashboard data for dev mode (no auth required)
 */
const MOCK_DASHBOARD_DATA: DashboardData = {
  user: {
    id: 'dev-user-001',
    first_name: 'Rishabh',
    last_name: 'A',
    phone: '+919876543210',
    email: null,
    role: 'tenant',
    user_status: 'active',
    kyc_status: 'verified',
    cashback_balance_paise: 20000,
  },
  tenancy: {
    id: 'tenancy-001',
    status: 'active',
    property_address: '42 Brigade Road, Koramangala',
    property_city: 'Bangalore',
    monthly_rent: 25000,
    rent_due_day: 5,
    lease_end_date: '2027-03-31',
    landlord_name: 'Priya Sharma',
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
    rent_month: 'February 2026',
  },
  cashback: {
    available_balance: 200,
    pending_balance: 50,
    total_earned: 1200,
    total_used: 950,
  },
  recent_payments: [
    { id: 'pay_001', amount: 25000, status: 'success', rent_month: 'January 2026', paid_at: '2026-01-05T10:30:00Z', cashback_earned: 200 },
    { id: 'pay_002', amount: 25000, status: 'success', rent_month: 'December 2025', paid_at: '2025-12-03T14:15:00Z', cashback_earned: 200 },
    { id: 'pay_003', amount: 25000, status: 'success', rent_month: 'November 2025', paid_at: '2025-11-02T09:45:00Z', cashback_earned: 150 },
  ],
  notifications: [],
  unread_notification_count: 0,
};

/**
 * Fetch dashboard data for the authenticated user
 */
export async function fetchDashboard(): Promise<{
  data: DashboardData | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<DashboardResponse>(
    'dashboard-data',
    {},
    true // Requires authentication
  );

  if (error) {
    // In dev mode, return mock data instead of failing
    if (__DEV__) {
      return { data: MOCK_DASHBOARD_DATA, error: null };
    }
    return { data: null, error };
  }

  if (!data?.success) {
    if (__DEV__) {
      return { data: MOCK_DASHBOARD_DATA, error: null };
    }
    return { data: null, error: 'Failed to fetch dashboard data' };
  }

  return { data: data.data, error: null };
}

/**
 * Determine dashboard state based on data
 */
export type DashboardState =
  | 'loading'
  | 'no_tenancy'
  | 'pending_verification'
  | 'all_verified'
  | 'payment_due'
  | 'payment_overdue'
  | 'payment_success'
  | 'error';

export function getDashboardState(data: DashboardData | null): DashboardState {
  if (!data) return 'loading';

  // No tenancy yet
  if (!data.tenancy) return 'no_tenancy';

  // Check verification status
  const { bank_verified, utility_verified, landlord_approved } =
    data.tenancy.verification_status;

  if (!bank_verified || !utility_verified || !landlord_approved) {
    return 'pending_verification';
  }

  // All verified - check payment status
  if (!data.upcoming_payment) {
    // Check if there's a recent successful payment
    const hasRecentSuccess = data.recent_payments.some(
      (p) => p.status === 'success'
    );
    return hasRecentSuccess ? 'payment_success' : 'all_verified';
  }

  // Payment due
  if (data.upcoming_payment.is_overdue) {
    return 'payment_overdue';
  }

  return 'payment_due';
}
