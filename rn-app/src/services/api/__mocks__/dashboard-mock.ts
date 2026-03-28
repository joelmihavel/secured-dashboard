/**
 * Mock Dashboard Data — DEV ONLY
 *
 * Current: LANDLORD UNVERIFIED — matches seeded user 9999999999
 * Rs 44,000 rent, Rema Sky View Apartments, landlord approval pending.
 *
 * Toggle DEV_USE_MOCK_DASHBOARD in dashboard.ts to enable/disable.
 *
 * === TESTING DIFFERENT STATES ===
 *
 * 1. UNVERIFIED (Credit Card disabled, Debit Card enabled):
 *    verification_status: { bank_verified: true, utility_verified: false, landlord_approved: false }
 *
 * 2. FULLY VERIFIED (All methods enabled, cashback applied):
 *    verification_status: { bank_verified: true, utility_verified: true, landlord_approved: true }
 *    cashback.verification_complete: true
 *    upcoming_payment.cashback_eligible: true
 *
 * 3. NO TENANCY (empty state):
 *    tenancy: null, upcoming_payment: null
 *
 * 4. PAYMENT OVERDUE:
 *    upcoming_payment.is_overdue: true, upcoming_payment.days_until_due: -3
 */

import type { DashboardData } from '../dashboard';

const now = new Date();
// Next month's due date for upcoming payment
const nextDueMonth = now.getDate() > 5 ? now.getMonth() + 1 : now.getMonth();
const nextDueYear = nextDueMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
const nextDueMonthNorm = nextDueMonth > 11 ? 0 : nextDueMonth;
const dueDate = new Date(nextDueYear, nextDueMonthNorm, 5);
const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
const rentMonthStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-01`;

export const MOCK_DASHBOARD_DATA: DashboardData = {
  user: {
    id: 'f448f136-d05f-44d3-9245-e291b70af706',
    first_name: 'Beta',
    last_name: 'Test',
    phone: '+919999999999',
    email: null,
    role: 'tenant',
    user_status: 'active',
    kyc_status: null,
    cashback_balance_paise: 0,
  },

  tenancy: {
    id: '2eb931d2-d179-48ec-8ea2-84da78f6c593',
    status: 'active',
    property_address: 'Flat No.B-15, 1st Floor, Rema Sky View Apartments, Murugeshpalya',
    property_city: 'Bangalore',
    monthly_rent: 44000,
    maintenance: 0,
    rent_due_day: 5,
    cashback_cutoff_day: 7,
    lease_start_date: '2025-12-01',
    lease_end_date: '2026-11-01',
    agreement_cert_id: 'KA-2025-BLR-00789012',
    landlord_name: 'Ramesh Kumar',
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: false,
      landlord_response: 'pending',
    },
  },

  upcoming_payment: {
    due_date: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-05`,
    amount: 44000,
    amount_paise: 4400000,
    days_until_due: daysUntilDue,
    is_overdue: daysUntilDue < 0,
    cashback_eligible: false,
    past_cutoff: false,
    cutoff_day: 7,
    rent_month: rentMonthStr,
  },

  cashback: {
    discount_rate: 0.01,
    max_discount_paise: 44000,
    max_discount: 440,
    verification_complete: false,
    total_savings_paise: 88000,
    total_savings: 880,
    legacy_wallet_balance: 0,
    available_balance: 0,
    pending_balance: 0,
    total_earned: 880,
    total_used: 0,
  },

  recent_payments: [
    {
      id: '0dec5f6e-d246-4fee-8da4-1a3b75532b05',
      amount: 44000,
      status: 'success' as const,
      rent_month: '2026-01-01',
      paid_at: '2026-01-03T14:15:00Z',
      cashback_earned: 0,
      cashback_applied: 440,
    },
    {
      id: '39676df1-59ec-4fa8-b80d-7244dae0384e',
      amount: 44000,
      status: 'success' as const,
      rent_month: '2025-12-01',
      paid_at: '2025-12-04T10:30:00Z',
      cashback_earned: 0,
      cashback_applied: 440,
    },
  ],

  landlord_bank: null,

  notifications: [],

  unread_notification_count: 0,

  payment_stamps: {
    summary: {
      on_time: 5,
      late: 2,
      missed: 2,
      pending: 0,
      total_months: 9,
    },
    current_month_status: 'pending',
  },
};
