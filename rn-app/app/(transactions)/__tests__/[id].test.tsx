import React from 'react';
import { render } from '@testing-library/react-native';

import TransactionDetailScreen from '../[id]';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'txn-123' }),
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

jest.mock('@/src/hooks', () => ({
  usePaymentHistory: () => ({
    data: {
      payments: [{
        id: 'txn-123',
        amount: 40000,
        pg_fee: 200,
        cashback_applied: 0,
        cashback_earned: 200,
        net_amount: 40000,
        amount_paise: 4000000,
        pg_fee_paise: 20000,
        cashback_applied_paise: 0,
        status: 'success',
        payment_method: 'upi',
        rent_month: '2026-01',
        created_at: '2026-01-15T10:30:00Z',
        paid_at: '2026-01-15T10:30:00Z',
        can_download_receipt: true,
        tenancy: {
          id: 'ten-1',
          property_address: '123 Main St',
          landlord_name: 'John Doe',
        },
      }],
      pagination: null,
      summary: null,
    },
    isLoading: false,
  }),
  useGenerateReceipt: () => ({ mutate: jest.fn(), isPending: false }),
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

describe('TransactionDetailScreen', () => {
  it('renders with testID "transaction-detail-screen"', () => {
    const { getByTestId } = render(<TransactionDetailScreen />);
    expect(getByTestId('transaction-detail-screen')).toBeTruthy();
  });

  it('renders "Payment" label', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Payment')).toBeTruthy();
  });

  it('renders success text (with Figma typo "Succesful")', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Succesful')).toBeTruthy();
  });

  it('renders receipt rows with hash labels', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Amount paid')).toBeTruthy();
    expect(getByText('Date')).toBeTruthy();
    expect(getByText('Method')).toBeTruthy();
    expect(getByText('Transaction ID')).toBeTruthy();
  });

  it('renders Download Receipt button', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Download Receipt')).toBeTruthy();
  });

  it('renders Contact Support link', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Contact Support')).toBeTruthy();
  });

  it('renders cashback note text', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText(/Pay by the 7th to earn cashback/)).toBeTruthy();
  });

  it('shows loading state when data is not ready', () => {
    const usePaymentHistory = require('@/src/hooks').usePaymentHistory;
    jest.spyOn(require('@/src/hooks'), 'usePaymentHistory').mockReturnValueOnce({
      data: null,
      isLoading: true,
    });

    const { getByTestId } = render(<TransactionDetailScreen />);
    expect(getByTestId('transaction-detail-loading')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<TransactionDetailScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<TransactionDetailScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
