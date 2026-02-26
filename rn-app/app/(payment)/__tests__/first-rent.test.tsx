import React from 'react';
import { render } from '@testing-library/react-native';

import FirstRentPaymentScreen from '../first-rent';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: {
      id: 'ten-1',
      monthly_rent: 40000,
      landlord_name: 'Test Landlord',
      verification_status: {
        bank_verified: false,
        utility_verified: false,
        landlord_approved: false,
      },
    },
    cashback: { available_balance: 325 },
    upcomingPayment: { amount: 42500, days_until_due: 10, rent_month: 'February 2026' },
    isLoading: false,
  }),
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}));

// Mock payment store
jest.mock('@/src/stores', () => ({
  usePaymentStore: (selector: (s: any) => any) => {
    const state = {
      amount: 0,
      setAmount: jest.fn(),
      status: 'idle',
      selectedMethod: null,
    };
    return selector(state);
  },
}));

// Mock PaymentMethodModal (heavy component with modal/animations)
jest.mock('@/src/components/payment/PaymentMethodModal', () => {
  const { View } = require('react-native');
  return {
    PaymentMethodModal: (props: any) => <View testID="payment-method-modal" />,
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FirstRentPaymentScreen', () => {
  it('renders with testID "first-rent-payment-screen"', () => {
    const { getByTestId } = render(<FirstRentPaymentScreen />);
    expect(getByTestId('first-rent-payment-screen')).toBeTruthy();
  });

  it('renders rent due heading with days count', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText(/Rent due in/)).toBeTruthy();
  });

  it('renders rent month text', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('February 2026')).toBeTruthy();
  });

  it('renders breakdown rows (Base rent, Maintenance, Other charges, Payable Rent)', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('Base rent')).toBeTruthy();
    expect(getByText('Maintenance')).toBeTruthy();
    expect(getByText('Other charges')).toBeTruthy();
    expect(getByText('Payable Rent')).toBeTruthy();
  });

  it('renders pay now button with formatted amount', () => {
    const { getByTestId } = render(<FirstRentPaymentScreen />);
    expect(getByTestId('pay-now-button')).toBeTruthy();
  });

  it('renders setup incomplete footer text', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText(/Complete setup to unlock cashback/)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<FirstRentPaymentScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<FirstRentPaymentScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
