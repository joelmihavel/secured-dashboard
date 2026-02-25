/**
 * Mock Payment Methods — DEV ONLY
 *
 * Realistic saved payment methods for visualizing the Home Dashboard carousel.
 */

import type { SavedPaymentMethod } from '../payments';

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
