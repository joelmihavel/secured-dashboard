/**
 * Mock Data for Screenshot Capture Mode
 *
 * Provides canned DashboardData objects for each home screen variant
 * and mock payment data for transaction screens.
 *
 * Used by screens when SCREENSHOT_PARAMS includes a `state` key
 * that maps to one of these presets.
 */

import type {
  DashboardData,
  DashboardUser,
  DashboardTenancy,
  UpcomingPayment,
  CashbackBalance,
  RawRecentPayment,
} from '@/src/services/api/dashboard';
import type { PaymentHistoryItem } from '@/src/services/api/payments';

// ─── Base User ───
const BASE_USER: DashboardUser = {
  id: 'mock-user-1',
  first_name: 'Rishabh',
  last_name: 'Thomas',
  phone: '+919876543210',
};

// ─── Base Tenancy (all verified) ───
const VERIFIED_TENANCY: DashboardTenancy = {
  id: 'mock-tenancy-1',
  status: 'active',
  property_address: '42 MG Road, Indiranagar',
  property_city: 'Bangalore',
  monthly_rent: 32500,
  rent_due_day: 1,
  lease_end_date: '2027-01-31',
  landlord_name: 'Mr. Rajan Sharma',
  verification_status: {
    bank_verified: true,
    utility_verified: true,
    landlord_approved: true,
  },
};

// ─── Pending Tenancy (not fully verified) ───
const PENDING_TENANCY: DashboardTenancy = {
  ...VERIFIED_TENANCY,
  status: 'pending_verification',
  verification_status: {
    bank_verified: true,
    utility_verified: false,
    landlord_approved: false,
  },
};

// ─── Upcoming Payment (due in 10 days) ───
const PAYMENT_DUE: UpcomingPayment = {
  due_date: '2026-03-01',
  amount: 32500,
  amount_paise: 3250000,
  days_until_due: 10,
  is_overdue: false,
  cashback_eligible: true,
  rent_month: '2026-03-01',
};

// ─── Overdue Payment ───
const PAYMENT_OVERDUE: UpcomingPayment = {
  ...PAYMENT_DUE,
  days_until_due: -5,
  is_overdue: true,
  cashback_eligible: false,
};

// ─── Missed Payment (>30 days overdue) ───
const PAYMENT_MISSED: UpcomingPayment = {
  ...PAYMENT_DUE,
  days_until_due: -35,
  is_overdue: true,
  cashback_eligible: false,
};

// ─── Cashback Balance ───
const CASHBACK_ACTIVE: CashbackBalance = {
  available_balance: 325,
  pending_balance: 260,
  total_earned: 3256,
  total_used: 2931,
};

const CASHBACK_EMPTY: CashbackBalance = {
  available_balance: 0,
  pending_balance: 0,
  total_earned: 0,
  total_used: 0,
};

// ─── Recent Payments (mock list) ───
const MOCK_PAYMENTS: RawRecentPayment[] = [
  { id: 'p1', amount: 32500, status: 'success', rent_month: '2026-02-01', paid_at: '2026-02-05T10:30:00Z', cashback_earned: 260 },
  { id: 'p2', amount: 32500, status: 'success', rent_month: '2026-01-01', paid_at: '2026-01-03T09:15:00Z', cashback_earned: 260 },
  { id: 'p3', amount: 32500, status: 'success', rent_month: '2025-12-01', paid_at: '2025-12-07T14:20:00Z', cashback_earned: 0 },
  { id: 'p4', amount: 32500, status: 'failed', rent_month: '2025-11-01', paid_at: null, cashback_earned: 0 },
];

const EMPTY_PAYMENTS: RawRecentPayment[] = [];

// ═══════════════════════════════════════════════
// HOME SCREEN MOCK DATA PRESETS
// ═══════════════════════════════════════════════

export type HomeScreenState =
  | 'bank-upi'        // 243-2762: Active, Bank/UPI only
  | 'all-methods'     // 243-2967: Active, all methods
  | 'late-payment'    // 243-3170: Active, late payment
  | 'missed-payment'  // 243-3378: Active, missed payment
  | 'complete'        // 243-7185: Active, complete with cashbacks
  | 'upi-no-cashbacks'  // 243-6296: Empty, UPI, no cashbacks
  | 'setup-payment'   // 243-6490: Empty, setup payment
  | 'setup-upi'       // 243-6731: Empty, setup payment/UPI
  | 'no-cashback';    // 243-5689: Empty, no cashback

export function getMockDashboardData(state: HomeScreenState): DashboardData {
  switch (state) {
    // ─── Active States ───
    case 'bank-upi':
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };

    case 'all-methods':
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 2,
      };

    case 'late-payment':
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_OVERDUE,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 1,
      };

    case 'missed-payment':
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_MISSED,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 3,
      };

    case 'complete':
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };

    // ─── Empty/Setup States ───
    case 'upi-no-cashbacks':
      return {
        user: BASE_USER,
        tenancy: {
          ...PENDING_TENANCY,
          verification_status: { bank_verified: true, utility_verified: true, landlord_approved: false },
        },
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_EMPTY,
        recent_payments: EMPTY_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };

    case 'setup-payment':
      return {
        user: BASE_USER,
        tenancy: PENDING_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_EMPTY,
        recent_payments: EMPTY_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };

    case 'setup-upi':
      return {
        user: BASE_USER,
        tenancy: {
          ...PENDING_TENANCY,
          verification_status: { bank_verified: true, utility_verified: false, landlord_approved: false },
        },
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_EMPTY,
        recent_payments: EMPTY_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };

    case 'no-cashback':
      return {
        user: BASE_USER,
        tenancy: {
          ...PENDING_TENANCY,
          verification_status: { bank_verified: true, utility_verified: true, landlord_approved: false },
        },
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_EMPTY,
        recent_payments: [
          { id: 'p1', amount: 32500, status: 'success', rent_month: '2026-02-01', paid_at: '2026-02-05T10:30:00Z', cashback_earned: 0 },
        ],
        notifications: [],
        unread_notification_count: 0,
      };

    default:
      return {
        user: BASE_USER,
        tenancy: VERIFIED_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };
  }
}

// ═══════════════════════════════════════════════
// TRANSACTION DETAIL MOCK DATA
// ═══════════════════════════════════════════════

export type TransactionDetailState = 'with-cashback' | 'no-cashback' | 'late-payment';

export function getMockTransaction(state: TransactionDetailState): PaymentHistoryItem {
  const base: PaymentHistoryItem = {
    id: 'mock-txn-1',
    amount: 32500,
    pg_fee: 0,
    cashback_applied: 325,
    cashback_earned: 260,
    net_amount: 32175,
    amount_paise: 3250000,
    pg_fee_paise: 0,
    cashback_applied_paise: 32500,
    status: 'success',
    payment_method: 'upi',
    rent_month: '2025-12-01',
    created_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    can_download_receipt: true,
    tenancy: { id: 'mock-t', property_address: '42 MG Road, Bangalore', landlord_name: 'Mr. Sharma' },
  };

  switch (state) {
    case 'no-cashback':
      return { ...base, cashback_applied: 0, cashback_earned: 0, cashback_applied_paise: 0, net_amount: 32500 };
    case 'late-payment':
      return { ...base, status: 'failed', cashback_applied: 0, cashback_earned: 0, cashback_applied_paise: 0, net_amount: 32500 };
    default:
      return base;
  }
}

// ═══════════════════════════════════════════════
// PAYMENT SELECT MOCK DATA
// ═══════════════════════════════════════════════

export type PaymentSelectState = 'before-7th' | 'after-7th' | 'no-setup';

export function getMockDashboardForPaymentSelect(state: PaymentSelectState): DashboardData {
  switch (state) {
    case 'before-7th':
      return {
        user: BASE_USER,
        tenancy: { ...VERIFIED_TENANCY, rent_due_day: 1 },
        upcoming_payment: { ...PAYMENT_DUE, days_until_due: 10 },
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };
    case 'after-7th':
      return {
        user: BASE_USER,
        tenancy: { ...VERIFIED_TENANCY, rent_due_day: 15 },
        upcoming_payment: { ...PAYMENT_DUE, days_until_due: 5 },
        cashback: CASHBACK_ACTIVE,
        recent_payments: MOCK_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };
    case 'no-setup':
      return {
        user: BASE_USER,
        tenancy: PENDING_TENANCY,
        upcoming_payment: PAYMENT_DUE,
        cashback: CASHBACK_EMPTY,
        recent_payments: EMPTY_PAYMENTS,
        notifications: [],
        unread_notification_count: 0,
      };
    default:
      return getMockDashboardData('bank-upi');
  }
}

// ═══════════════════════════════════════════════
// SAVED PAYMENT METHODS MOCK DATA
// ═══════════════════════════════════════════════

import type { SavedPaymentMethod } from '@/src/services/api/payments';

const MOCK_UPI_METHOD: SavedPaymentMethod = {
  id: 'mock-upi-1',
  type: 'upi',
  display_name: 'UPI - ICICI',
  is_default: true,
  is_verified: true,
  nickname: null,
  created_at: '2025-10-01T00:00:00Z',
  vpa: 'rishabh@icici',
  upi_provider: 'ICICI',
};

const MOCK_CARD_METHOD: SavedPaymentMethod = {
  id: 'mock-card-1',
  type: 'card',
  display_name: 'Visa ****2341',
  is_default: false,
  is_verified: true,
  nickname: null,
  created_at: '2025-10-01T00:00:00Z',
  last_four: '2341',
  card_network: 'visa',
  card_type: 'credit',
  card_issuer: 'ICICI',
  card_expiry_month: 6,
  card_expiry_year: 2026,
  is_expired: false,
};

const MOCK_NETBANKING_METHOD: SavedPaymentMethod = {
  id: 'mock-nb-1',
  type: 'netbanking',
  display_name: 'ICICI Bank',
  is_default: false,
  is_verified: true,
  nickname: null,
  created_at: '2025-10-01T00:00:00Z',
  bank_code: 'ICIC',
  bank_name: 'ICICI Bank',
};

export type PaymentMethodsState = 'bank-upi' | 'all-methods' | 'upi-only' | 'none';

export function getMockSavedPaymentMethods(state: PaymentMethodsState): SavedPaymentMethod[] {
  switch (state) {
    case 'bank-upi':
      return [MOCK_UPI_METHOD];
    case 'all-methods':
      return [MOCK_UPI_METHOD, MOCK_CARD_METHOD, MOCK_NETBANKING_METHOD];
    case 'upi-only':
      return [MOCK_UPI_METHOD];
    case 'none':
      return [];
    default:
      return [MOCK_UPI_METHOD];
  }
}
