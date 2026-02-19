import React from 'react';
import { render } from '@testing-library/react-native';

import PayRentTransactionScreen from '../index';

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
  DottedPattern: () => null,
}));

jest.mock('react-native-svg', () => {
  const { View, Text: RNText } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
    Text: (props: any) => <RNText {...props} />,
  };
});

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: { id: 'ten-1', monthly_rent: 30000 },
    upcomingPayment: {
      amount: 32500,
      days_until_due: 10,
      is_overdue: false,
      cashback_eligible: true,
      due_date: '2026-03-07',
    },
    cashback: { available_balance: 325, pending_balance: 0, total_earned: 3256, total_used: 0 },
    isLoading: false,
  }),
}));

describe('PayRentTransactionScreen', () => {
  it('renders pay now button', () => {
    const { getByTestId } = render(<PayRentTransactionScreen />);
    expect(getByTestId('pay-now-button')).toBeTruthy();
  });

  it('renders rent due label', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/Rent due in 10 days/)).toBeTruthy();
  });

  it('renders setup label', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/Complete setup to unlock 1% cashback/)).toBeTruthy();
  });

  it('renders cashback pill for with_cashback state', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/325 cashback applied/)).toBeTruthy();
  });

  it('renders rent breakdown rows', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText('Base rent')).toBeTruthy();
    expect(getByText('Maintenance')).toBeTruthy();
    expect(getByText('Total Rent')).toBeTruthy();
    expect(getByText('Payable Rent')).toBeTruthy();
  });

  it('renders back button', () => {
    const { getByTestId } = render(<PayRentTransactionScreen />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('renders footer message', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/Pay by 7 Dec/)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<PayRentTransactionScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<PayRentTransactionScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
