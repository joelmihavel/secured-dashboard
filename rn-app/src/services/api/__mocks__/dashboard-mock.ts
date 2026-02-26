/**
 * Mock Dashboard Data — DEV ONLY
 *
 * Current: PARTIAL VERIFICATION — bank verified, utility/landlord not.
 * This means: Credit Card is DISABLED (needs landlord + utility), Debit Card is ENABLED.
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
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

export const MOCK_DASHBOARD_DATA: DashboardData = {
  user: {
    id: 'mock-user-001',
    first_name: 'Rishabh',
    last_name: 'Agnihotri',
    phone: '+919876543210',
    email: 'rishabh@flent.in',
    role: 'tenant',
    user_status: 'active',
    kyc_status: 'verified',
    cashback_balance_paise: 0,
  },

  tenancy: {
    id: 'mock-tenancy-001',
    status: 'active',
    property_address: 'Flat 402, Tower B, Prestige Lakeside Habitat, Whitefield',
    property_city: 'Bangalore',
    monthly_rent: 35000,
    rent_due_day: 5,
    cashback_cutoff_day: 7,
    lease_start_date: '2025-06-01',
    lease_end_date: '2027-05-31',
    agreement_cert_id: 'KA-2025-STM-00456789',
    landlord_name: 'Suresh Kumar Sharma',
    verification_status: {
      bank_verified: true,
      utility_verified: false,
      landlord_approved: false,
      landlord_response: null,
    },
  },

  upcoming_payment: {
    due_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`,
    amount: 35000,
    amount_paise: 3500000,
    days_until_due: Math.max(0, 5 - now.getDate()),
    is_overdue: now.getDate() > 5,
    cashback_eligible: false,
    past_cutoff: now.getDate() > 7,
    cutoff_day: 7,
    rent_month: thisMonth,
  },

  cashback: {
    discount_rate: 0.01,
    max_discount_paise: 50000,
    max_discount: 500,
    verification_complete: false,
    total_savings_paise: 0,
    total_savings: 0,
    legacy_wallet_balance: 0,
    available_balance: 0,
    pending_balance: 0,
    total_earned: 0,
    total_used: 0,
  },

  recent_payments: [
    {
      id: 'mock-payment-001',
      amount: 35000,
      status: 'success' as const,
      rent_month: thisMonth,
      paid_at: now.toISOString(),
      cashback_earned: 0,
    },
  ],

  notifications: [],

  unread_notification_count: 0,

  payment_stamps: {
    summary: {
      on_time: 0,
      late: 0,
      missed: 0,
      pending: 0,
      total_months: 0,
    },
    current_month_status: 'pending',
  },
};
