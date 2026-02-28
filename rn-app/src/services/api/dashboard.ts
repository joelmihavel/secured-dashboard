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
  avatar_url?: string | null;
}

export interface TenancyVerificationStatus {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
  landlord_response?: 'approved' | 'disputed' | 'pending' | null;
}

export interface DashboardTenancy {
  id: string;
  status: 'pending_verification' | 'active' | 'expired' | 'terminated';
  property_address: string;
  property_city: string | null;
  monthly_rent: number; // In rupees
  maintenance: number; // In rupees, 0 if none
  rent_due_day: number;
  cashback_cutoff_day: number; // Day of month by which rent must be paid for cashback (defaults to 7)
  lease_end_date: string | null;
  lease_start_date: string | null;
  agreement_cert_id: string | null;
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
  past_cutoff: boolean;
  cutoff_day: number; // Day of month (1-28), defaults to 7
  rent_month: string; // ISO date string "YYYY-MM-DD" from edge function
}

export interface CashbackBalance {
  // Instant discount model (new)
  discount_rate: number;
  max_discount_paise: number;
  max_discount: number;
  verification_complete: boolean;
  total_savings_paise: number;
  total_savings: number;
  // Legacy (transition period)
  legacy_wallet_balance: number;
  // DEPRECATED — kept for backward compat during transition
  available_balance?: number;
  pending_balance?: number;
  total_earned?: number;
  total_used?: number;
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

export interface LandlordBankAccount {
  id: string;
  account_holder_name: string;
  account_number_masked: string;
  ifsc_code: string;
  bank_name: string | null;
  verified: boolean;
  pan_number_masked: string | null;
  pan_verified: boolean;
}

export interface DashboardPaymentStamps {
  summary: {
    on_time: number;
    late: number;
    missed: number;
    pending: number;
    total_months: number;
  };
  current_month_status: 'on_time' | 'late' | 'missed' | 'pending';
}

export interface DashboardData {
  user: DashboardUser;
  tenancy: DashboardTenancy | null;
  upcoming_payment: UpcomingPayment | null;
  cashback: CashbackBalance;
  // TODO: Backend — dashboard-data edge function should filter out ₹1 card verification charges
  // from recent_payments with: .not("metadata->>purpose", "eq", "card_verification")
  recent_payments: RawRecentPayment[];
  landlord_bank: LandlordBankAccount | null;
  notifications: Notification[];
  unread_notification_count: number;
  payment_stamps: DashboardPaymentStamps | null;
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
  paymentId: string; // Source payment ID for direct lookup
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
      return 'failed';
    case 'refunded':
      return 'pending';
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
        status = 'missed';
        statusLabel = 'Missed - No Payment';
        amount = null;
        break;
      case 'refunded':
        status = 'pending';
        statusLabel = 'Refunded - Awaiting Payment';
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
      paymentId: p.id,
    };
  });
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Fetch dashboard data for the authenticated user.
 *
 * Calls the dashboard-data edge function and returns the raw DashboardData shape.
 * Use mapRecentPayments() and deriveCashbackEntries() to convert to UI-ready types.
 */
async function fetchDashboardReal(): Promise<{
  data: DashboardData | null;
  error: string | null;
}> {
  const { data, error } = await callEdgeFunction<DashboardResponse>(
    'dashboard-data',
    {},
    true // Requires authentication
  );

  if (error) {
    return { data: null, error };
  }

  if (!data?.success) {
    return { data: null, error: 'Failed to fetch dashboard data' };
  }

  return { data: data.data, error: null };
}

async function fetchDashboardMock(): Promise<{
  data: DashboardData | null;
  error: string | null;
}> {
  const { MOCK_DASHBOARD_DATA } = await import('./__mocks__/dashboard-mock');
  return { data: MOCK_DASHBOARD_DATA, error: null };
}

// withMock() enforces same return type + __DEV__ compile-time gate
const _fetchDashboard = __DEV__
  ? (() => {
      const { withMock } = require('@/src/__dev__/withMock');
      return withMock('dashboard', fetchDashboardReal, fetchDashboardMock, { delayMs: 300 });
    })()
  : fetchDashboardReal;

export const fetchDashboard = _fetchDashboard;

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

  // Check verification status — use backend-computed flag as single source of truth
  if (!data.cashback.verification_complete) {
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
