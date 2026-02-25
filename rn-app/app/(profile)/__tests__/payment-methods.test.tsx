import React from 'react';
import { render } from '@testing-library/react-native';

import PaymentMethodsScreen from '../payment-methods';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ tab: 'upi' }),
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

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

const mockMutate = jest.fn();

jest.mock('@/src/hooks', () => ({
  useSavedPaymentMethods: () => ({
    data: [],
    isLoading: false,
  }),
  useDeletePaymentMethod: () => ({ mutate: mockMutate, isPending: false }),
  useSetDefaultPaymentMethod: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/src/services/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  },
}));

describe('PaymentMethodsScreen', () => {
  it('renders with testID "payment-methods-screen"', () => {
    const { getByTestId } = render(<PaymentMethodsScreen />);
    expect(getByTestId('payment-methods-screen')).toBeTruthy();
  });

  it('renders Payment Methods header title', () => {
    const { getByText } = render(<PaymentMethodsScreen />);
    expect(getByText('Payment Methods')).toBeTruthy();
  });

  it('renders empty state when no methods', () => {
    const { getByText } = render(<PaymentMethodsScreen />);
    expect(getByText('No saved payment methods')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<PaymentMethodsScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<PaymentMethodsScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
