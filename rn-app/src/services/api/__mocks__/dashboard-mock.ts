/**
 * Mock Dashboard Data — DEV ONLY
 *
 * Realistic mock data for visualizing the Home Dashboard in dev mode.
 * Simulates an active tenant with upcoming payment, recent history, and cashback.
 *
 * Toggle DEV_USE_MOCK_DASHBOARD in dashboard.ts to enable/disable.
 */

import type { DashboardData } from '../dashboard';

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const twoMonthsAgoStr = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

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
    cashback_balance_paise: 34500,
  },

  tenancy: {
    id: 'mock-tenancy-001',
    status: 'active',
    property_address: 'Flat 402, Tower B, Prestige Lakeside Habitat, Whitefield',
    property_city: 'Bangalore',
    monthly_rent: 35000,
    rent_due_day: 5,
    lease_start_date: '2025-06-01',
    lease_end_date: '2027-05-31',
    agreement_cert_id: 'KA-2025-STM-00456789',
    landlord_name: 'Suresh Kumar Sharma',
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: true,
      landlord_response: 'approved',
    },
  },

  upcoming_payment: {
    due_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`,
    amount: 35000,
    amount_paise: 3500000,
    days_until_due: Math.max(0, 5 - now.getDate()),
    is_overdue: now.getDate() > 5,
    cashback_eligible: true,
    rent_month: thisMonth,
  },

  cashback: {
    discount_rate: 0.01,
    max_discount_paise: 50000,
    max_discount: 500,
    verification_complete: true,
    total_savings_paise: 105000,
    total_savings: 1050,
    legacy_wallet_balance: 0,
    available_balance: 345,
    pending_balance: 0,
    total_earned: 1050,
    total_used: 705,
  },

  recent_payments: [
    {
      id: 'pay-mock-001',
      amount: 35000,
      status: 'success',
      rent_month: lastMonthStr,
      paid_at: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 3, 10, 30).toISOString(),
      cashback_earned: 350,
    },
    {
      id: 'pay-mock-002',
      amount: 35000,
      status: 'success',
      rent_month: twoMonthsAgoStr,
      paid_at: new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 4, 14, 15).toISOString(),
      cashback_earned: 350,
    },
    {
      id: 'pay-mock-003',
      amount: 35000,
      status: 'success',
      rent_month: threeMonthsAgoStr,
      paid_at: new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 5, 9, 0).toISOString(),
      cashback_earned: 350,
    },
  ],

  notifications: [
    {
      id: 'notif-mock-001',
      type: 'payment_reminder',
      title: 'Rent Due Soon',
      message: 'Your rent of Rs.35,000 is due on the 5th. Pay on time to earn cashback!',
      action_type: 'navigate',
      action_data: { route: '/(payment)/confirm' },
      created_at: new Date(now.getFullYear(), now.getMonth(), 1, 9, 0).toISOString(),
      read: false,
    },
    {
      id: 'notif-mock-002',
      type: 'cashback_credited',
      title: 'Cashback Credited!',
      message: 'Rs.350 cashback credited for last month\'s on-time rent payment.',
      action_type: null,
      action_data: null,
      created_at: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 6, 12, 0).toISOString(),
      read: true,
    },
  ],

  unread_notification_count: 1,

  payment_stamps: {
    summary: {
      on_time: 3,
      late: 0,
      missed: 0,
      pending: 1,
      total_months: 4,
    },
    current_month_status: 'pending',
  },
};
