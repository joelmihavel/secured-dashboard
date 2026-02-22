import React from 'react';
import { render } from '@testing-library/react-native';

import InitiatePaymentScreen from '../initiate';

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
  DottedPattern: () => null,
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

jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, appOwnership: 'expo' },
  };
});

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    dashboardState: 'all_verified',
    tenancy: { id: 'ten-1', monthly_rent: 32500 },
    upcomingPayment: { amount: 32500, days_until_due: 10, rent_month: '2025-06' },
    cashback: { available_balance: 325 },
    isLoading: false,
  }),
}));

jest.mock('@/src/services/payment', () => ({
  initiatePayUPayment: jest.fn().mockResolvedValue({ data: null, error: null }),
  launchPayUCheckout: jest.fn().mockResolvedValue({ status: 'success' }),
  mockPayUCheckout: jest.fn().mockResolvedValue({ status: 'success' }),
}));

jest.mock('@/src/components/payment', () => {
  const { View, Text } = require('react-native');
  return {
    SummaryRow: ({ label, value }: any) => (
      <View>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </View>
    ),
    DashedDivider: () => <View />,
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InitiatePaymentScreen', () => {
  it('renders with testID "initiate-payment-screen"', () => {
    const { getByTestId } = render(<InitiatePaymentScreen />);
    expect(getByTestId('initiate-payment-screen')).toBeTruthy();
  });

  it('renders pay now button with testID', () => {
    const { getByTestId } = render(<InitiatePaymentScreen />);
    expect(getByTestId('pay-now-button')).toBeTruthy();
  });

  it('renders "Rent due in" status text', () => {
    const { getByText } = render(<InitiatePaymentScreen />);
    expect(getByText(/Rent due in/)).toBeTruthy();
  });

  it('renders "Payable Rent" label', () => {
    const { getByText } = render(<InitiatePaymentScreen />);
    expect(getByText('Payable Rent')).toBeTruthy();
  });

  it('renders "Secured by PayU" notice', () => {
    const { getByText } = render(<InitiatePaymentScreen />);
    expect(getByText('Secured by PayU')).toBeTruthy();
  });

  it('renders "Total rent" in breakdown via SummaryRow', () => {
    const { getByText } = render(<InitiatePaymentScreen />);
    expect(getByText('Total rent')).toBeTruthy();
  });

  it('renders cashback incentive text', () => {
    const { getByText } = render(<InitiatePaymentScreen />);
    expect(getByText(/Pay by the 7th to earn 1% cashback/)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<InitiatePaymentScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<InitiatePaymentScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
