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

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

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

jest.mock('@/src/components/payment', () => {
  const { View } = require('react-native');
  return {
    CreditCardSelect: (props: any) => <View testID={props.testID} />,
    UPICardSelect: (props: any) => <View testID={props.testID} />,
    NetbankingCardSelect: (props: any) => <View testID={props.testID} />,
    AddMoreCard: (props: any) => <View testID={props.testID} />,
  };
});

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: { id: 'ten-1', monthly_rent: 40000 },
    upcomingPayment: { amount: 40000, days_until_due: 5 },
    cashback: { available_balance: 325, pending_balance: 0, total_earned: 3256, total_used: 0 },
    isLoading: false,
  }),
}));

describe('PayRentTransactionScreen', () => {
  it('renders pay now button', () => {
    const { getByTestId } = render(<PayRentTransactionScreen />);
    expect(getByTestId('pay-now-button')).toBeTruthy();
  });

  it('renders rent due text', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/rent is due/i)).toBeTruthy();
  });

  it('renders cashback section', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText(/Apply Cashback/i)).toBeTruthy();
  });

  it('renders notifications and help buttons', () => {
    const { getByTestId } = render(<PayRentTransactionScreen />);
    expect(getByTestId('notifications-button')).toBeTruthy();
    expect(getByTestId('help-button')).toBeTruthy();
  });

  it('renders payment card carousel with mock cards', () => {
    const { getByTestId } = render(<PayRentTransactionScreen />);
    expect(getByTestId('payment-card-card-1')).toBeTruthy();
    expect(getByTestId('payment-card-upi-1')).toBeTruthy();
    expect(getByTestId('payment-card-netbanking-1')).toBeTruthy();
    expect(getByTestId('payment-card-add-new')).toBeTruthy();
  });

  it('renders "Paying with:" label', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText('Paying with:')).toBeTruthy();
  });

  it('renders "Pay Now" button label', () => {
    const { getByText } = render(<PayRentTransactionScreen />);
    expect(getByText('Pay Now')).toBeTruthy();
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
