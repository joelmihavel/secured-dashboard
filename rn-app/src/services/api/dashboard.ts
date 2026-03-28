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
  landlord_phone: string | null;
  tenant_names: string[];
  security_deposit: number; // In rupees, from extracted_rental_info
  verification_status: TenancyVerificationStatus;
}

export interface UpcomingPayment {
  due_date: string;
  amount: number; // In rupees
  amount_paise: number;
  days_until_due: number;
  is_overdue: boolean;
  already_paid: boolean;
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
  // Available cashback balance (from RPC get_available_cashback — canonical source)
  available_balance_paise?: number;
  available_balance?: number;
  // Legacy (transition period)
  legacy_wallet_balance: number;
  pending_balance?: number;
  total_earned?: number;
  total_used?: number;
}

/** Raw recent payment shape from edge function */
export interface RawRecentPayment {
  id: string;
  amount: number; // In rupees
  status: 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'initiated';
  rent_month: string; // ISO date string "YYYY-MM-DD" from edge function
  paid_at: string | null;
  cashback_earned: number;
  cashback_applied: number;
  payment_method: string | null;
  settlement_status?: 'pending' | 'ready' | 'held' | 'processing' | 'retrying' | 'settled' | 'failed' | null;
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

/** Transaction card status for the new rich transaction cards (Figma 4109-67659) */
export type TransactionCardStatus = 'settled' | 'in_progress' | 'initiated' | 'retrying' | 'refunded' | 'failed' | 'settlement_failed';

/** UI-ready transaction for TransactionCard component */
export interface MappedTransaction {
  id: string;
  title: string; // e.g., "September rent"
  cardStatus: TransactionCardStatus;
  date: string; // e.g., "15 Sep, 9:40am"
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
// TYPES — Cashback Module (new card UI)
// ==============================================

// Cashback module types — defined here to avoid circular imports with components.
// Components re-import these types via their own props.
export type CashbackModuleState = 'setup_pending' | 'landlord_rejected' | 'active';
export type BarStatus = 'earned' | 'missed' | 'future';
export type InviteState = 'sent' | 'rejected';
export type LandlordInviteState = 'pre_invite' | 'invited' | 'not_approved';
export type CashbackCardStatus = 'received' | 'accrued' | 'missed' | 'reversed';

export type SetupStepStatus = 'not_started' | 'active' | 'in_progress' | 'completed';

export interface SetupStep {
  id: string;
  label: string;
  completed: boolean; // backward compat: derived from status === 'completed'
  status: SetupStepStatus;
}

export interface CashbackEarningsEntry {
  id: string;
  date: string;
  status: CashbackCardStatus;
  amount: number | null;
}

/** Fully computed props for the CashbacksList component */
export interface MappedCashbackModule {
  moduleState: CashbackModuleState;
  earned: number;
  potential: number;
  remainingCashback: number | undefined;
  chartBars: BarStatus[];
  announcementText: string;
  infoText: string;
  setupSteps: SetupStep[];
  inviteState: InviteState | undefined;
  landlordInviteState: LandlordInviteState;
  entries: CashbackEarningsEntry[];
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
 * Edge function: 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'initiated'
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
    case 'initiated':
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
    title: `${parseRentMonthLabel(p.rent_month)}  rent`,
    status: mapPaymentStatusToUI(p.status),
    date: formatPaidAtDate(p.paid_at),
    amount: p.amount,
  }));
}

/**
 * Map raw payments to TransactionCard-ready shape.
 *
 * Uses status + settlement_status to derive the card state:
 *   success + settled    → settled   (3/3 progress)
 *   success + processing → in_progress (2/3)
 *   success + pending/null → initiated (1/3)
 *   processing           → retrying  (1/3)
 *   failed               → failed    (1 + red)
 *   refunded             → refunded  (0/3)
 */
export function mapTransactions(
  rawPayments: RawRecentPayment[]
): MappedTransaction[] {
  return rawPayments.map((p) => ({
    id: p.id,
    title: `${parseRentMonthLabel(p.rent_month)} rent`,
    cardStatus: deriveCardStatus(p.status, p.settlement_status),
    date: formatPaidAtDate(p.paid_at),
    amount: p.amount,
  }));
}

function deriveCardStatus(
  status: RawRecentPayment['status'],
  settlementStatus?: RawRecentPayment['settlement_status'],
): TransactionCardStatus {
  switch (status) {
    case 'success':
      switch (settlementStatus) {
        case 'settled': return 'settled';
        case 'processing': return 'in_progress';
        case 'retrying': return 'retrying';
        case 'failed': return 'settlement_failed';
        case 'pending':
        case 'ready':
        case 'held':
        default: return 'initiated';
      }
    case 'processing': return 'retrying';
    case 'failed': return 'failed';
    case 'refunded': return 'refunded';
    case 'initiated':
    case 'pending':
    default: return 'initiated';
  }
}

/**
 * Derive cashback entries from recent payments.
 *
 * Each successful payment with cashback > 0 becomes a "paid" entry.
 * Failed/missed payments become "missed" entries.
 * Pending/processing payments become "pending" entries.
 */
export function deriveCashbackEntries(
  rawPayments: RawRecentPayment[],
  _monthlyRent?: number,
  _discountRate: number = 0.01,
): MappedCashbackEntry[] {
  return rawPayments.map((p) => {
    const monthLabel = parseRentMonthLabel(p.rent_month);
    let status: MappedCashbackEntry['status'];
    let statusLabel: string;
    let amount: number | null;

    // cashback_applied = instant discount deducted at checkout (verified users)
    // cashback_earned = 1% earned into balance (unverified users)
    const cashbackAmount = p.cashback_applied > 0 ? p.cashback_applied : p.cashback_earned;

    switch (p.status) {
      case 'success':
        status = 'paid';
        statusLabel = cashbackAmount > 0 ? 'Paid - On Time' : 'Paid';
        // Only show actual cashback recorded on this payment — never fabricate
        amount = cashbackAmount > 0 ? cashbackAmount : null;
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
      title: `${monthLabel}  Cashback`,
      status,
      statusLabel,
      amount,
      paymentId: p.id,
    };
  });
}

// ==============================================
// CASHBACK MODULE MAPPING
// ==============================================

// Figma uses "Sept" not "Sep" for earnings card dates
const EARNINGS_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a date as "24 Sept 2025" for earnings card display.
 */
function formatEarningsDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${EARNINGS_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Determine if a payment earned cashback based on cutoff day.
 * Rent paid on or before cutoff_day of the month = earned.
 * Rent paid after cutoff_day = missed (paid late).
 */
function didEarnCashback(payment: RawRecentPayment, cutoffDay: number): boolean {
  // Explicit cashback recorded by backend takes priority
  if (payment.cashback_earned > 0 || payment.cashback_applied > 0) return true;
  // If payment succeeded but no cashback → check if paid after cutoff
  if (payment.status !== 'success') return false;
  if (!payment.paid_at) return false;
  const paidDate = new Date(payment.paid_at);
  return paidDate.getDate() <= cutoffDay;
}

/**
 * Generate 12-month bar chart data from lease start and payment history.
 *
 * Each bar represents one month. Heights are fixed (ascending visual).
 * Colors: earned (orange) | missed (red) | future (gray).
 */
function computeChartBars(
  leaseStart: string | null,
  payments: RawRecentPayment[],
  cutoffDay: number,
): BarStatus[] {
  const bars: BarStatus[] = Array(12).fill('future');
  if (!leaseStart) return bars;

  const start = new Date(leaseStart);
  if (isNaN(start.getTime())) return bars;

  const now = new Date();

  // Build a lookup of rent_month → payment
  const paymentMap = new Map<string, RawRecentPayment>();
  for (const p of payments) {
    // Normalize rent_month to "YYYY-MM" for lookup
    const key = p.rent_month.substring(0, 7);
    // Keep the most recent / highest-priority payment per month
    if (!paymentMap.has(key) || p.status === 'success') {
      paymentMap.set(key, p);
    }
  }

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

    // Future month — hasn't happened yet
    if (monthDate > now) {
      bars[i] = 'future';
      continue;
    }

    const payment = paymentMap.get(monthKey);
    if (!payment) {
      // Past month with no payment — check if we're past cutoff for this month
      const cutoffDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), cutoffDay);
      bars[i] = now > cutoffDate ? 'missed' : 'future';
      continue;
    }

    if (payment.status === 'failed') {
      bars[i] = 'missed';
    } else if (payment.status === 'success') {
      bars[i] = didEarnCashback(payment, cutoffDay) ? 'earned' : 'missed';
    } else {
      // processing/pending/initiated — still in flight
      bars[i] = 'future';
    }
  }

  return bars;
}

/**
 * Map payments to CashbackEarningsEntry[] for the earnings card list.
 *
 * ONLY successful payments appear here. Cashback and payments are separate concerns:
 * - success + cashback applied (verified) → received
 * - success + cashback earned but not applied (unverified) → accrued (locked)
 * - success + no cashback (paid late / after cutoff) → missed
 *
 * Excluded from cashback earnings (these are payment issues, not cashback events):
 * - failed payments — payment didn't go through, no cashback event
 * - refunded payments — money returned, no cashback event
 * - settlement_failed — will be refunded, cashback shouldn't count
 */
function mapEarningsEntries(
  payments: RawRecentPayment[],
  isVerified: boolean,
  cutoffDay: number,
): CashbackEarningsEntry[] {
  const entries: CashbackEarningsEntry[] = [];

  for (const p of payments) {
    // Skip failed payments — payment infrastructure issue, not a cashback event
    if (p.status === 'failed') continue;
    // Skip pending/processing/initiated — still in flight
    if (p.status !== 'success' && p.status !== 'refunded') continue;

    let status: CashbackCardStatus;
    let amount: number | null = null;

    // Refunded or settlement failed → cashback reversed
    if (p.status === 'refunded' || p.settlement_status === 'failed') {
      const hadCashback = (p.cashback_applied > 0 || p.cashback_earned > 0);
      if (!hadCashback) continue; // No cashback was involved, skip
      status = 'reversed';
      amount = p.cashback_applied || p.cashback_earned;
    } else if (p.cashback_applied > 0) {
      status = 'received';
      amount = p.cashback_applied;
    } else if (p.cashback_earned > 0) {
      if (isVerified) {
        status = 'received';
        amount = p.cashback_earned;
      } else {
        status = 'accrued';
        amount = p.cashback_earned;
      }
    } else {
      // Success but no cashback → paid late / after cutoff
      status = 'missed';
    }

    // For missed cashback, show cutoff_day + 1 (the day cashback was forfeited)
    let displayDate: string;
    if (status === 'missed') {
      const rentMonth = new Date(p.rent_month);
      const missedDate = new Date(rentMonth.getFullYear(), rentMonth.getMonth(), cutoffDay + 1);
      displayDate = formatEarningsDate(missedDate.toISOString());
    } else {
      displayDate = formatEarningsDate(p.paid_at || p.rent_month);
    }

    entries.push({
      id: `cbe_${p.id}`,
      date: displayDate,
      status,
      amount,
    });
  }

  return entries;
}

/**
 * Compute the complete cashback module state from dashboard data.
 *
 * Takes raw tenancy, cashback, and payment data and produces
 * all props needed by the CashbacksList component.
 */
export function mapCashbackModule(
  tenancy: DashboardTenancy | null,
  cashback: CashbackBalance | null,
  rawPayments: RawRecentPayment[],
): MappedCashbackModule {
  // ── Module state ──────────────────────────────────────────────
  const vs = tenancy?.verification_status;
  const landlordApproved = vs?.landlord_approved;
  const isVerified = landlordApproved === true;

  let moduleState: CashbackModuleState;
  if (landlordApproved === true) {
    moduleState = 'active';
  } else if (landlordApproved === false) {
    moduleState = 'landlord_rejected';
  } else {
    moduleState = 'setup_pending';
  }

  // ── Stats ─────────────────────────────────────────────────────
  const monthlyRent = tenancy?.monthly_rent ?? 0;
  const discountRate = cashback?.discount_rate ?? 0.01;
  const earned = cashback?.total_savings ?? 0;
  const potential = Math.round(monthlyRent * discountRate * 12);

  // ── Remaining cashback (locked, unverified only) ──────────────
  const remainingCashback = !isVerified
    ? (cashback?.available_balance ?? cashback?.legacy_wallet_balance ?? 0) || undefined
    : undefined;

  // ── Chart bars ────────────────────────────────────────────────
  const cutoffDay = tenancy?.cashback_cutoff_day ?? 7;
  const chartBars = computeChartBars(
    tenancy?.lease_start_date ?? null,
    rawPayments,
    cutoffDay,
  );

  // ── Announcement pill (above chart) — always shown per Figma ──
  const monthlyDiscount = Math.round(monthlyRent * discountRate);
  let announcementText: string;
  if (isVerified) {
    // Figma State 3: "💰 Earn ₹400 by paying your rent on time"
    announcementText = `💰  Earn ₹${monthlyDiscount.toLocaleString('en-IN')} by paying your rent on time`;
  } else if (earned > 0) {
    announcementText = `🔒  Complete setup to use ₹${earned.toLocaleString('en-IN')}`;
  } else {
    // Empty state pill
    announcementText = `💸  Reduce your monthly rent by ₹${monthlyDiscount.toLocaleString('en-IN')}`;
  }

  // ── Info text (below chart) — always shown per Figma ─────────
  let infoText: string;
  if (isVerified) {
    // Figma State 3: "ℹ️  Missed payments reduce your payout"
    infoText = 'ℹ️  Missed payments reduce your payout';
  } else if (earned > 0) {
    // Figma State 2: "🔒 ₹ 1,200 can be redeemed after setup is complete"
    infoText = `🔒  ₹${earned.toLocaleString('en-IN')} can be redeemed after setup is complete`;
  } else {
    infoText = '🔒  Cashback is accumulated until setup is complete';
  }

  // ── Setup steps (4-state: not_started → active → in_progress → completed) ──
  const bankDone = vs?.bank_verified ?? false;
  const utilityDone = vs?.utility_verified ?? false;
  const landlordDone = vs?.landlord_approved ?? false;
  const landlordPending = vs?.landlord_response === 'pending' || vs?.landlord_response === null;

  function stepStatus(done: boolean, index: number): SetupStepStatus {
    if (done) return 'completed';
    // Landlord step is "in_progress" when invite sent + awaiting response
    if (index === 2 && bankDone && utilityDone && landlordPending) return 'in_progress';
    // First incomplete step is "active" (the one user should act on)
    const firstIncompleteIndex = [bankDone, utilityDone, landlordDone].findIndex(v => !v);
    if (index === firstIncompleteIndex) return 'active';
    return 'not_started';
  }

  const setupSteps: SetupStep[] = [
    {
      id: 'bank',
      label: "Add your landlord's bank details",
      completed: bankDone,
      status: stepStatus(bankDone, 0),
    },
    {
      id: 'utility',
      label: 'Verify your address',
      completed: utilityDone,
      status: stepStatus(utilityDone, 1),
    },
    {
      id: 'landlord',
      // "Invite your landlord" until invite sent, then "Awaiting landlord's approval"
      label: (bankDone && utilityDone && landlordPending)
        ? "Awaiting landlord's approval"
        : 'Invite your landlord',
      completed: landlordDone,
      status: stepStatus(landlordDone, 2),
    },
  ];

  // ── Invite state (legacy) ─────────────────────────────────────
  let inviteState: InviteState | undefined;
  if (!isVerified) {
    const response = vs?.landlord_response;
    if (response === 'disputed') {
      inviteState = 'rejected';
    } else if (response === 'pending' || response === null || response === undefined) {
      if (vs?.bank_verified && vs?.utility_verified) {
        inviteState = 'sent';
      }
    }
  }

  // ── Landlord invite state (unified 3-state row) ─────────────
  let landlordInviteState: LandlordInviteState;
  if (!isVerified) {
    const response = vs?.landlord_response;
    if (response === 'disputed') {
      // Landlord rejected/disputed
      landlordInviteState = 'not_approved';
    } else if (bankDone && utilityDone && landlordPending) {
      // Invite sent, awaiting response
      landlordInviteState = 'invited';
    } else {
      // Haven't invited yet (or bank/utility not done)
      landlordInviteState = 'pre_invite';
    }
  } else {
    landlordInviteState = 'pre_invite'; // won't render anyway (setup hidden when verified)
  }

  // ── Earnings entries ──────────────────────────────────────────
  const entries = mapEarningsEntries(rawPayments, isVerified, cutoffDay);

  return {
    moduleState,
    earned,
    potential,
    remainingCashback,
    chartBars,
    announcementText,
    infoText,
    setupSteps,
    inviteState,
    landlordInviteState,
    entries,
  };
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
  const { data, error, errorBody } = await callEdgeFunction<DashboardResponse>(
    'dashboard-data',
    {},
    true // Requires authentication
  );

  if (error) {
    return { data: null, error: mapDashboardError(error, errorBody) };
  }

  if (!data?.success) {
    return { data: null, error: 'Failed to fetch dashboard data' };
  }

  return { data: data.data, error: null };
}

/**
 * Map dashboard errors to user-friendly messages.
 * Checks structured errorBody.code first, then falls back to string matching.
 */
function mapDashboardError(errorMessage: string, errorBody?: Record<string, unknown>): string {
  const structuredCode = errorBody?.code as string | undefined;
  if (structuredCode) {
    switch (structuredCode) {
      case 'AUTH_ERROR':
        return 'Please sign in to continue';
      case 'NOT_FOUND':
        return 'Dashboard data not found';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment.';
    }
  }

  const lower = errorMessage.toLowerCase();
  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('invalid jwt') || lower.includes('jwt expired')) {
    return 'Please sign in to continue';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return 'Please check your internet connection';
  }

  // Sanitize DB internals that shouldn't leak to UI
  if (/column\s+"?\w+"?\s+(?:does not exist|of relation)/i.test(errorMessage) ||
      /relation\s+"?\w+"?\s+does not exist/i.test(errorMessage) ||
      /\bSELECT\b.*\bFROM\b/i.test(errorMessage) ||
      /violates\s+(?:unique|check|foreign key)\s+constraint/i.test(errorMessage)) {
    return 'Something went wrong. Please try again.';
  }

  return errorMessage;
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

  // Payment due — already_paid is handled by rendering layer (headlineVariant + footer visibility)
  if (data.upcoming_payment.is_overdue && !data.upcoming_payment.already_paid) {
    return 'payment_overdue';
  }

  return 'payment_due';
}
