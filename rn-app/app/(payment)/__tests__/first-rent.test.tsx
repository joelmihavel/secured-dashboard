import React from 'react';
import { render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import FirstRentPaymentScreen from '../first-rent';
import { useDashboard } from '@/src/hooks';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/src/hooks', () => ({
  useDashboard: jest.fn(),
}));

jest.mock('@/src/stores', () => ({
  usePaymentStore: jest.fn(() => ({
    amount: null,
    setAmount: jest.fn(),
  })),
}));

// Mock PaymentMethodModal 
jest.mock('@/src/components/payment/PaymentMethodModal', () => ({
  PaymentMethodModal: (props: any) => <></>
}));

describe('FirstRentPaymentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
    });
    
    (useDashboard as jest.Mock).mockReturnValue({
      tenancy: { id: 'test-tenancy', monthly_rent: 30000 },
      upcomingPayment: { rent_month: 'January 2026', amount: 32500 },
      cashback: null,
    });
  });

  it('renders modal wrapper correctly', () => {
    const { toJSON } = render(<FirstRentPaymentScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
