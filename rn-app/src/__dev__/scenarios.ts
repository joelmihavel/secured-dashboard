/**
 * Typed Scenario Definitions
 *
 * Each scenario maps to a set of React Query cache entries that get seeded
 * when the scenario is activated via DevNavigator.
 *
 * Uses `as const satisfies` for full type safety on scenario keys.
 */

import {
  createMockDashboardData,
  createMockWaitlistStatus,
  createMockPaymentHistoryList,
  createMockPaymentStamps,
  createMockPaymentStampEntry,
} from '@/src/__mocks__/testDataFactory';

export const SCENARIOS = {
  'waitlist:pending': {
    waitlist: createMockWaitlistStatus('pending'),
  },
  'waitlist:approved': {
    waitlist: createMockWaitlistStatus('approved'),
  },
  'waitlist:rejected': {
    waitlist: createMockWaitlistStatus('rejected'),
  },
  'home:payment_due': {
    dashboard: createMockDashboardData(),
  },
  'home:payment_overdue': {
    dashboard: createMockDashboardData({
      upcoming_payment: {
        due_date: '2026-02-10',
        amount: 35000,
        amount_paise: 3500000,
        days_until_due: -5,
        is_overdue: true,
        already_paid: false,
        cashback_eligible: false,
        past_cutoff: true,
        cutoff_day: 7,
        rent_month: '2026-02-01',
      },
    }),
  },
  'home:late_payment': {
    dashboard: createMockDashboardData({
      upcoming_payment: {
        due_date: '2026-03-05',
        amount: 25000,
        amount_paise: 2500000,
        days_until_due: -3,
        is_overdue: true,
        already_paid: false,
        cashback_eligible: false,
        past_cutoff: true,
        cutoff_day: 7,
        rent_month: '2026-03-01',
      },
      payment_stamps: {
        summary: { on_time: 5, late: 3, missed: 0, pending: 0, total_months: 8 },
        current_month_status: 'late',
      },
    }),
    paymentStamps: createMockPaymentStamps({
      stamps: [
        createMockPaymentStampEntry({ month: '2025-08', month_display: 'August 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-09', month_display: 'September 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-10', month_display: 'October 2025', status: 'late', days_late: 5 }),
        createMockPaymentStampEntry({ month: '2025-11', month_display: 'November 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-12', month_display: 'December 2025', status: 'late', days_late: 3 }),
        createMockPaymentStampEntry({ month: '2026-01', month_display: 'January 2026', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2026-02', month_display: 'February 2026', status: 'late', days_late: 2 }),
        createMockPaymentStampEntry({ month: '2026-03', month_display: 'March 2026', status: 'on_time' }),
      ],
      summary: { on_time: 5, late: 3, missed: 0, pending: 0, total_months: 8 },
    }),
  },
  'home:missed_payment': {
    dashboard: createMockDashboardData({
      upcoming_payment: {
        due_date: '2026-02-05',
        amount: 25000,
        amount_paise: 2500000,
        days_until_due: -25,
        is_overdue: true,
        already_paid: false,
        cashback_eligible: false,
        past_cutoff: true,
        cutoff_day: 7,
        rent_month: '2026-02-01',
      },
      payment_stamps: {
        summary: { on_time: 4, late: 1, missed: 2, pending: 0, total_months: 7 },
        current_month_status: 'missed',
      },
    }),
    paymentStamps: createMockPaymentStamps({
      stamps: [
        createMockPaymentStampEntry({ month: '2025-08', month_display: 'August 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-09', month_display: 'September 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-10', month_display: 'October 2025', status: 'missed', payment_id: null, paid_at: null }),
        createMockPaymentStampEntry({ month: '2025-11', month_display: 'November 2025', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2025-12', month_display: 'December 2025', status: 'late', days_late: 4 }),
        createMockPaymentStampEntry({ month: '2026-01', month_display: 'January 2026', status: 'on_time' }),
        createMockPaymentStampEntry({ month: '2026-02', month_display: 'February 2026', status: 'missed', payment_id: null, paid_at: null }),
      ],
      summary: { on_time: 4, late: 1, missed: 2, pending: 0, total_months: 7 },
    }),
  },
  'home:no_tenancy': {
    dashboard: createMockDashboardData({ tenancy: null, upcoming_payment: null }),
  },
  'home:pending_verification': {
    dashboard: createMockDashboardData({
      tenancy: {
        id: 'ten-001',
        status: 'pending_verification',
        property_address: 'Prestige Lakeside Habitat, Bangalore',
        property_city: 'Bangalore',
        monthly_rent: 35000,
        maintenance: 0,
        rent_due_day: 1,
        cashback_cutoff_day: 1,
        lease_end_date: null,
        lease_start_date: '2026-01-01',
        agreement_cert_id: null,
        landlord_name: 'Ramesh Kumar',
        landlord_phone: null,
        tenant_names: ['Test Tenant'],
        security_deposit: 0,
        verification_status: {
          bank_verified: true,
          utility_verified: false,
          landlord_approved: false,
        },
      },
    }),
  },
  'payment:history': {
    paymentHistory: createMockPaymentHistoryList(6),
  },
} as const satisfies Record<string, Record<string, unknown>>;

export type ScenarioKey = keyof typeof SCENARIOS;
