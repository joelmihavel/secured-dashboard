import React from 'react';
import { render } from '@testing-library/react-native';

import AddCardScreen from '../add-card';

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

jest.mock('@/src/hooks', () => ({
  useAddPaymentMethod: () => ({ mutate: jest.fn(), isPending: false }),
  useAddCardToken: () => ({ mutate: jest.fn(), isPending: false }),
  useDashboard: () => ({
    tenancy: { id: 'ten-1', monthly_rent: 40000 },
    upcomingPayment: { amount: 40000 },
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AddCardScreen', () => {
  it('renders with testID "add-card-screen"', () => {
    const { getByTestId } = render(<AddCardScreen />);
    expect(getByTestId('add-card-screen')).toBeTruthy();
  });

  it('renders credit card title text', () => {
    const { getByText } = render(<AddCardScreen />);
    expect(getByText(/Credit Card/)).toBeTruthy();
  });

  it('renders card number input', () => {
    const { getByTestId } = render(<AddCardScreen />);
    expect(getByTestId('card-number-input')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<AddCardScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AddCardScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
