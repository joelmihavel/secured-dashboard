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
  created_at?: string;
}

export type LandlordStatusValue = 'none' | 'invite_pending' | 'invited' | 'otp_confirmed' | 'verified' | 'declined' | 'approved';

export interface TenancyVerificationStatus {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
  landlord_response?: 'approved' | 'disputed' | 'pending' | null;
  landlord_status?: LandlordStatusValue;
  credit_card_enabled?: boolean;
  credit_card_disabled_reason?: string | null;
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
  created_at?: string; // Tenancy creation date (when user joined platform)
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
  upi_vpa: string | null;
  verification_method: 'bank' | 'upi' | null;
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
    date: formatPaidAtDate(p.paid_at) || parseRentMonthLabel(p.rent_month),
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

// WARN 29: Standard 3-letter abbreviation — "Sep" not "Sept"
const EARNINGS_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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

/** IST offset in milliseconds (UTC+05:30) — used for date normalization */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Convert any Date to IST by adding UTC offset + IST offset */
function toIST(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + IST_OFFSET_MS);
}

/**
 * Determine if a payment earned cashback based on cutoff day.
 * Rent paid on or before cutoff_day of the month = earned.
 * Rent paid after cutoff_day = missed (paid late).
 *
 * WARN 5: paid_at is normalized to IST before extracting the day-of-month,
 * so this works correctly regardless of device timezone.
 *
 * NOTE: Currently unused — computeChartBars no longer calls this (derives from stamps).
 * Kept as a utility for potential future use by mapEarningsEntries or other callers.
 */
function didEarnCashback(payment: RawRecentPayment, cutoffDay: number): boolean {
  // Explicit cashback recorded by backend takes priority
  if (payment.cashback_earned > 0 || payment.cashback_applied > 0) return true;
  // If payment succeeded but no cashback → check if paid after cutoff
  if (payment.status !== 'success') return false;
  if (!payment.paid_at) return false;
  // Normalize to IST before extracting day-of-month (WARN 5 fix)
  const paidDateIST = toIST(new Date(payment.paid_at));
  return paidDateIST.getDate() <= cutoffDay;
}

/**
 * Derive chart bar statuses from the payment stamps array.
 *
 * BUG 1 FIX: Previously this function used raw `recent_payments` (limited to 5)
 * to iterate 12 months, causing months beyond the 5 most recent to show as
 * 'missed' (red) even if the user paid on time. Now it derives bars directly
 * from the backend stamps data, which has per-month status for ALL months.
 *
 * BUG 3 FIX (timezone): All date comparisons happen on the backend in IST.
 * The frontend only maps stamp statuses to bar colors — no date math needed.
 *
 * BUG 4 FIX (refunded): Refunded payments are already classified correctly
 * by the backend stamps logic (pending until due date, then missed).
 *
 * Mapping from stamp status to bar color:
 * - 'on_time'  → 'earned'  (orange — cashback earned)
 * - 'late'     → 'missed'  (red — cashback lost, includes late payments)
 *   // WARN 18: Chart 'missed' = cashback lost (includes late payments and no-payment months)
 * - 'missed'   → 'missed'  (red — no payment by cutoff)
 * - 'pending'  → 'future'  (gray — payment in-flight or month not yet due)
 *   // WARN 13: 'future' = backend equivalent of 'pending' (payment in-flight or month not yet due)
 *
 * Each bar represents one month from the stamps array.
 * // WARN 15: Chart bars match stamp months 1:1 — no join-month skip possible
 * since stamps already handle first-trackable-month logic on the backend.
 *
 * @param stamps - Per-month stamp entries from get-payment-stamps endpoint
 * @returns Array of BarStatus, one per stamp month (NOT fixed at 12)
 */
function computeChartBars(
  stamps: Array<{ status: string }> | null | undefined,
): BarStatus[] {
  if (!stamps || stamps.length === 0) {
    return Array(12).fill('future');
  }

  return stamps.map((stamp): BarStatus => {
    switch (stamp.status) {
      case 'on_time':
        return 'earned';
      case 'late':
        // WARN 18: 'missed' on chart means cashback lost — includes late payments
        return 'missed';
      case 'missed':
        return 'missed';
      case 'pending':
      default:
        // WARN 13: 'future' = backend 'pending' (payment in-flight or month not yet due)
        return 'future';
    }
  });
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
 *
 * WARN 34: Entry order depends on the rawPayments array order, which comes from
 * the dashboard-data edge function query (ORDER BY created_at DESC). The caller
 * should not re-sort entries — they are already in reverse chronological order.
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
      // cashback_applied > 0 → always received (discount was applied)
      status = 'received';
      amount = p.cashback_applied;
    } else if (p.cashback_earned > 0 && p.cashback_applied === 0) {
      // Earned but not applied → historical accrued entry
      status = 'accrued';
      amount = p.cashback_earned;
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
 * Takes raw tenancy, cashback, payment data, and stamp statuses and produces
 * all props needed by the CashbacksList component.
 *
 * @param stamps - Per-month stamp entries from get-payment-stamps endpoint.
 *   Used to derive chart bars (Bug 1 fix). Falls back to empty if unavailable.
 */
export function mapCashbackModule(
  tenancy: DashboardTenancy | null,
  cashback: CashbackBalance | null,
  rawPayments: RawRecentPayment[],
  stamps?: Array<{ status: string }> | null,
  dashboardStamps?: { current_month_status: string; summary: { total_months: number } } | null,
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
  // "EARNED" = savings applied on payments + unspent balance still available
  // total_savings = cashback_applied across all payments (actual discount received)
  // available_balance = earned but not yet redeemed (will auto-apply on next payment)
  const earned = (cashback?.total_savings ?? 0) + (cashback?.available_balance ?? 0);
  const potential = Math.round(monthlyRent * discountRate * 12);

  // ── Remaining cashback ──────────────────────────────────────────
  const remainingCashback = undefined; // Balance auto-redeems on next payment

  // ── Chart bars ────────────────────────────────────────────────
  // BUG 1 FIX: Derive chart from stamps (already computed in IST on backend)
  // instead of from rawPayments (limited to 5 by dashboard-data query).
  // This also fixes Bug 3 (timezone), Bug 4 (refunded), and WARN 15/17/19.
  //
  // Fallback: when stamps haven't loaded yet, use dashboard-data's
  // current_month_status to show at least the current month correctly
  // (prevents all-gray chart while stamps query is in flight).
  const cutoffDay = tenancy?.cashback_cutoff_day ?? 7;
  let effectiveStamps = stamps;
  if ((!stamps || stamps.length === 0) && dashboardStamps?.current_month_status) {
    effectiveStamps = [{ status: dashboardStamps.current_month_status }];
  }
  const chartBars = computeChartBars(effectiveStamps);

  // ── Announcement pill (above chart) — always shown per Figma ──
  const monthlyDiscount = Math.round(monthlyRent * discountRate);
  const announcementText = `💰  Save ₹${monthlyDiscount.toLocaleString('en-IN')} by paying your rent on time`;

  // ── Info text (below chart) — always shown per Figma ─────────
  const infoText = 'ℹ️  1% cashback applied on every on-time payment';

  // ── Setup steps (4-state: not_started → active → in_progress → completed) ──
  const bankDone = vs?.bank_verified ?? false;
  const utilityDone = vs?.utility_verified ?? false;
  const landlordInviteSent = vs?.landlord_status === 'invited' || vs?.landlord_status === 'otp_confirmed';
  const landlordFullyVerified = vs?.landlord_status === 'verified' || (vs?.landlord_approved ?? false);
  // For setup guard: treat invite sent as step done (don't route back to invite screen)
  const landlordDone = landlordInviteSent || landlordFullyVerified;

  function stepStatus(done: boolean, index: number): SetupStepStatus {
    if (done) return 'completed';
    // First incomplete step is "active" (the one user should act on)
    const firstIncompleteIndex = [bankDone, utilityDone, landlordDone].findIndex(v => !v);
    if (index === firstIncompleteIndex) return 'active';
    return 'not_started';
  }

  // Landlord step has its own status logic: invite sent = in_progress, not completed
  function landlordStepStatus(): SetupStepStatus {
    if (landlordFullyVerified) return 'completed';
    if (landlordInviteSent) return 'in_progress';
    const firstIncompleteIndex = [bankDone, utilityDone, false].findIndex(v => !v);
    if (firstIncompleteIndex === 2) return 'active';
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
      label: landlordInviteSent
        ? "Awaiting landlord's approval"
        : landlordFullyVerified
          ? 'Landlord verified'
          : 'Invite your landlord',
      completed: landlordFullyVerified,
      status: landlordStepStatus(),
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

  // Unverified users now see payment-based states (payment_due, overdue, etc.)
  // instead of being stuck on pending_verification. The setup reminder cards
  // in CashbacksList handle verification reminders independently.

  // Check payment status
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
