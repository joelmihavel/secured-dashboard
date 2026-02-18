import React from 'react';
import { render } from '@testing-library/react-native';

import AddNetbankingScreen from '../add-netbanking';

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
  useAddPaymentMethod: () => ({ mutate: jest.fn(), isPending: false }),
  useDashboard: () => ({
    tenancy: { id: 'ten-1', monthly_rent: 40000 },
    upcomingPayment: { amount: 40000 },
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AddNetbankingScreen', () => {
  it('renders with testID "add-netbanking-screen"', () => {
    const { getByTestId } = render(<AddNetbankingScreen />);
    expect(getByTestId('add-netbanking-screen')).toBeTruthy();
  });

  it('renders pay rent title', () => {
    const { getByText } = render(<AddNetbankingScreen />);
    expect(getByText(/Pay Rent|Net Banking/i)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<AddNetbankingScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AddNetbankingScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
