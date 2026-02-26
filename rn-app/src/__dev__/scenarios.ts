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
        cashback_eligible: false,
        past_cutoff: true,
        cutoff_day: 7,
        rent_month: '2026-02-01',
      },
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
        rent_due_day: 1,
        cashback_cutoff_day: 7,
        lease_end_date: null,
        lease_start_date: '2026-01-01',
        agreement_cert_id: null,
        landlord_name: 'Ramesh Kumar',
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
