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
  DottedPattern: () => null,
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

const mockMutate = jest.fn();

jest.mock('@/src/hooks', () => ({
  useProfilePaymentMethods: () => ({
    data: null,
    isLoading: false,
  }),
  useAddPaymentMethod: () => ({ mutate: mockMutate, isPending: false }),
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

  it('renders "Edit your" title prefix', () => {
    const { getByText } = render(<PaymentMethodsScreen />);
    expect(getByText(/Edit your/)).toBeTruthy();
  });

  it('renders UPI Method type name for upi tab', () => {
    const { getByText } = render(<PaymentMethodsScreen />);
    expect(getByText('UPI Method')).toBeTruthy();
  });

  it('renders Save Changes button', () => {
    const { getByText } = render(<PaymentMethodsScreen />);
    expect(getByText('Save Changes')).toBeTruthy();
  });

  it('renders UPI ID input field', () => {
    const { getByTestId } = render(<PaymentMethodsScreen />);
    expect(getByTestId('input-upiId')).toBeTruthy();
  });

  it('renders account holder name input field', () => {
    const { getByTestId } = render(<PaymentMethodsScreen />);
    expect(getByTestId('input-holderName')).toBeTruthy();
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
