/**
 * Mock Payment Methods — DEV ONLY
 *
 * Realistic saved payment methods for visualizing the Home Dashboard carousel.
 */

import type { SavedPaymentMethod, PaymentStampsResponse } from '../payments';

export const MOCK_SAVED_PAYMENT_METHODS: SavedPaymentMethod[] = [
  {
    id: 'pm-mock-upi-001',
    type: 'upi',
    display_name: 'UPI - ICICI',
    is_default: true,
    is_verified: true,
    nickname: null,
    created_at: '2025-08-15T10:00:00Z',
    vpa: 'rishabh@icici',
    upi_provider: 'ICICI',
  },
  {
    id: 'pm-mock-card-001',
    type: 'card',
    display_name: 'Visa ****4291',
    is_default: false,
    is_verified: true,
    nickname: null,
    created_at: '2025-09-20T14:30:00Z',
    last_four: '4291',
    card_network: 'visa',
    card_type: 'credit',
    card_issuer: 'HDFC Bank',
    card_expiry_month: 8,
    card_expiry_year: 2028,
    is_expired: false,
  },
];

export const MOCK_PAYMENT_STAMPS: PaymentStampsResponse = {
  stamps: [
    { month: '2025-06', month_display: 'June 2025', status: 'on_time', payment_id: 'pay-m1', paid_at: '2025-06-03T10:00:00Z', due_date: '2025-06-05', days_late: null, amount_paise: 4400000, cashback_applied_paise: 44000, cashback_earned: 440 },
    { month: '2025-07', month_display: 'July 2025', status: 'on_time', payment_id: 'pay-m2', paid_at: '2025-07-04T10:00:00Z', due_date: '2025-07-05', days_late: null, amount_paise: 4400000, cashback_applied_paise: 44000, cashback_earned: 440 },
    { month: '2025-08', month_display: 'August 2025', status: 'late', payment_id: 'pay-m3', paid_at: '2025-08-10T10:00:00Z', due_date: '2025-08-05', days_late: 5, amount_paise: 4400000, cashback_applied_paise: 0, cashback_earned: 0 },
    { month: '2025-09', month_display: 'September 2025', status: 'on_time', payment_id: 'pay-m4', paid_at: '2025-09-03T10:00:00Z', due_date: '2025-09-05', days_late: null, amount_paise: 4400000, cashback_applied_paise: 44000, cashback_earned: 440 },
    { month: '2025-10', month_display: 'October 2025', status: 'missed', payment_id: null, paid_at: null, due_date: '2025-10-05', days_late: null, amount_paise: null, cashback_applied_paise: null, cashback_earned: 0 },
    { month: '2025-11', month_display: 'November 2025', status: 'on_time', payment_id: 'pay-m5', paid_at: '2025-11-04T10:00:00Z', due_date: '2025-11-05', days_late: null, amount_paise: 4400000, cashback_applied_paise: 44000, cashback_earned: 440 },
    { month: '2025-12', month_display: 'December 2025', status: 'late', payment_id: 'pay-m6', paid_at: '2025-12-09T10:00:00Z', due_date: '2025-12-05', days_late: 4, amount_paise: 4400000, cashback_applied_paise: 0, cashback_earned: 0 },
    { month: '2026-01', month_display: 'January 2026', status: 'on_time', payment_id: 'pay-m7', paid_at: '2026-01-03T10:00:00Z', due_date: '2026-01-05', days_late: null, amount_paise: 4400000, cashback_applied_paise: 44000, cashback_earned: 440 },
    { month: '2026-02', month_display: 'February 2026', status: 'missed', payment_id: null, paid_at: null, due_date: '2026-02-05', days_late: null, amount_paise: null, cashback_applied_paise: null, cashback_earned: 0 },
  ],
  summary: {
    total_months: 9,
    on_time: 5,
    late: 2,
    missed: 2,
    pending: 0,
  },
};
