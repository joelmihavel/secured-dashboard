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

jest.mock('@/src/hooks/usePayments', () => ({
  usePaymentHistory: () => ({
    data: {
      payments: [{
        id: 'txn-123',
        amount: 32500,
        pg_fee: 200,
        cashback_applied: 0,
        cashback_earned: 200,
        net_amount: 32500,
        amount_paise: 3250000,
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

  it('renders back button', () => {
    const { getByTestId } = render(<TransactionDetailScreen />);
    expect(getByTestId('back-button')).toBeTruthy();
  });

  it('renders Payable Rent row', () => {
    const { getByText } = render(<TransactionDetailScreen />);
    expect(getByText('Payable Rent')).toBeTruthy();
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
