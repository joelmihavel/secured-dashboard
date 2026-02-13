/**
 * Dashboard API Service
 *
 * Fetches aggregated dashboard data including user info,
 * tenancy, upcoming payment, cashback, and notifications.
 *
 * Maps edge function response shapes to UI-ready types.
 * Edge function: dashboard-data (GET/POST, auth required)
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES — Edge Function Response (raw from backend)
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
  rent_month: string; // ISO date string "YYYY-MM-DD" from edge function
}

export interface CashbackBalance {
  available_balance: number; // In rupees
  pending_balance: number;
  total_earned: number;
  total_used: number;
}

/** Raw recent payment shape from edge function */
export interface RawRecentPayment {
  id: string;
  amount: number; // In rupees
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded';
  rent_month: string; // ISO date string "YYYY-MM-DD" from edge function
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
  recent_payments: RawRecentPayment[];
  notifications: Notification[];
  unread_notification_count: number;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

// ==============================================
// TYPES — UI-Ready (mapped for home components)
// ==============================================

/** UI-ready recent payment for RecentPaymentsList component */
export interface MappedRecentPayment {
  id: string;
  title: string; // e.g., "January rent"
  status: 'paid' | 'pending' | 'failed' | 'processing';
  date: string; // e.g., "5 Jan, 10:30am"
  amount: number; // In rupees
}

/** UI-ready cashback entry for CashbacksList component */
export interface MappedCashbackEntry {
  id: string;
  title: string; // e.g., "January Cashback"
  status: 'paid' | 'delayed' | 'missed' | 'pending';
  statusLabel: string; // e.g., "Paid - On Time"
  amount: number | null; // In rupees, null for N/A
}

// ==============================================
// MAPPING FUNCTIONS
// ==============================================

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Parse a rent_month string into a human-readable month name.
 * Handles both ISO date "YYYY-MM-DD" from the edge function
 * and display format "Month YYYY" from mock data.
 */
function parseRentMonthLabel(rentMonth: string): string {
  // Try ISO date format: "2026-02-01" or "2026-02"
  const isoMatch = rentMonth.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return MONTH_NAMES[monthIndex];
    }
  }

  // Already human-readable: "February 2026" -> extract month name
  const nameMatch = rentMonth.match(/^([A-Za-z]+)/);
  if (nameMatch) {
    return nameMatch[1];
  }

  return rentMonth;
}

/**
 * Format a paid_at ISO timestamp to a short display string.
 * Returns e.g., "5 Jan, 10:30am"
 */
function formatPaidAtDate(paidAt: string | null): string {
  if (!paidAt) return '';

  const date = new Date(paidAt);
  if (isNaN(date.getTime())) return '';

  const day = date.getDate();
  const month = SHORT_MONTH_NAMES[date.getMonth()];
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${day} ${month}, ${displayHour}:${minutes}${ampm}`;
}

/**
 * Map edge function payment status to UI-ready status.
 * Edge function: 'pending' | 'processing' | 'success' | 'failed' | 'refunded'
 * UI component: 'paid' | 'pending' | 'failed' | 'processing'
 */
function mapPaymentStatusToUI(
  status: RawRecentPayment['status']
): MappedRecentPayment['status'] {
  switch (status) {
    case 'success':
      return 'paid';
    case 'processing':
      return 'processing';
    case 'failed':
    case 'refunded':
      return 'failed';
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * Map raw recent payments from edge function to UI-ready shape.
 *
 * Edge function returns:
 *   { id, amount, status, rent_month: "2026-02-01", paid_at, cashback_earned }
 *
 * UI component expects:
 *   { id, title: "February rent", status: "paid", date: "5 Feb, 10:30am", amount }
 */
export function mapRecentPayments(
  rawPayments: RawRecentPayment[]
): MappedRecentPayment[] {
  return rawPayments.map((p) => ({
    id: p.id,
    title: `${parseRentMonthLabel(p.rent_month)} rent`,
    status: mapPaymentStatusToUI(p.status),
    date: formatPaidAtDate(p.paid_at),
    amount: p.amount,
  }));
}

/**
 * Derive cashback entries from recent payments.
 *
 * Each successful payment with cashback > 0 becomes a "paid" entry.
 * Failed/missed payments become "missed" entries.
 * Pending/processing payments become "pending" entries.
 */
export function deriveCashbackEntries(
  rawPayments: RawRecentPayment[]
): MappedCashbackEntry[] {
  return rawPayments.map((p) => {
    const monthLabel = parseRentMonthLabel(p.rent_month);
    let status: MappedCashbackEntry['status'];
    let statusLabel: string;
    let amount: number | null;

    switch (p.status) {
      case 'success':
        if (p.cashback_earned > 0) {
          status = 'paid';
          statusLabel = 'Paid - On Time';
          amount = p.cashback_earned;
        } else {
          // Paid but no cashback (e.g., late payment)
          status = 'delayed';
          statusLabel = 'Paid - Delayed';
          amount = p.cashback_earned > 0 ? p.cashback_earned : null;
        }
        break;
      case 'failed':
      case 'refunded':
        status = 'missed';
        statusLabel = 'Missed - No Payment';
        amount = null;
        break;
      case 'pending':
      case 'processing':
      default:
        status = 'pending';
        statusLabel = 'Pending';
        amount = null;
        break;
    }

    return {
      id: `cb_${p.id}`,
      title: `${monthLabel} Cashback`,
      status,
      statusLabel,
      amount,
    };
  });
}

// ==============================================
// MOCK DATA
// ==============================================

/**
 * Mock dashboard data for dev mode (no auth required).
 * rent_month uses ISO format to match edge function output.
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
    rent_month: '2026-02-01',
  },
  cashback: {
    available_balance: 200,
    pending_balance: 50,
    total_earned: 1200,
    total_used: 950,
  },
  recent_payments: [
    { id: 'pay_001', amount: 25000, status: 'success', rent_month: '2026-01-01', paid_at: '2026-01-05T10:30:00Z', cashback_earned: 200 },
    { id: 'pay_002', amount: 25000, status: 'success', rent_month: '2025-12-01', paid_at: '2025-12-03T14:15:00Z', cashback_earned: 200 },
    { id: 'pay_003', amount: 25000, status: 'success', rent_month: '2025-11-01', paid_at: '2025-11-02T09:45:00Z', cashback_earned: 150 },
  ],
  notifications: [],
  unread_notification_count: 0,
};

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Fetch dashboard data for the authenticated user.
 *
 * Calls the dashboard-data edge function and returns the raw DashboardData shape.
 * Use mapRecentPayments() and deriveCashbackEntries() to convert to UI-ready types.
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

// ==============================================
// DASHBOARD STATE MACHINE
// ==============================================

/**
 * All possible dashboard states.
 *
 * Derivation:
 * - loading: data not yet available
 * - no_tenancy: user has no active tenancy
 * - pending_verification: tenancy exists but not fully verified
 * - all_verified: fully verified but no upcoming payment and no recent activity
 * - payment_due: upcoming payment exists, not overdue
 * - payment_overdue: upcoming payment is overdue
 * - payment_processing: a recent payment is currently being processed
 * - payment_success: no upcoming payment and most recent payment was successful
 * - error: an error occurred fetching data
 */
export type DashboardState =
  | 'loading'
  | 'no_tenancy'
  | 'pending_verification'
  | 'all_verified'
  | 'payment_due'
  | 'payment_overdue'
  | 'payment_processing'
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
    // Check if there's a payment currently being processed
    const hasProcessing = data.recent_payments.some(
      (p) => p.status === 'processing' || p.status === 'pending'
    );
    if (hasProcessing) return 'payment_processing';

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
