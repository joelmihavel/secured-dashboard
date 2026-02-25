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

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
  };
});

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: { id: 'ten-1', monthly_rent: 40000, landlord_name: 'Test Landlord' },
    cashback: { available_balance: 325 },
    upcomingPayment: { amount: 40000 },
    isLoading: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FirstRentPaymentScreen', () => {
  it('renders with testID "first-rent-payment-screen"', () => {
    const { getByTestId } = render(<FirstRentPaymentScreen />);
    expect(getByTestId('first-rent-payment-screen')).toBeTruthy();
  });

  it('renders "Pay Rent" heading', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('Pay Rent')).toBeTruthy();
  });

  it('renders "Total payable rent" label', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('Total payable rent')).toBeTruthy();
  });

  it('renders "Pay Now" button text', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('Pay Now')).toBeTruthy();
  });

  it('renders landlord payment info', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('Paying to')).toBeTruthy();
    expect(getByText('Test Landlord')).toBeTruthy();
  });

  it('renders secure payment notice', () => {
    const { getByText } = render(<FirstRentPaymentScreen />);
    expect(getByText('All payments are 100% secure')).toBeTruthy();
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
