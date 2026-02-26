import React from 'react';
import { render } from '@testing-library/react-native';

import StatusScreen from '../status';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUseLocalSearchParams = jest.fn().mockReturnValue({
  paymentId: 'pay-123',
  amount: '32500',
  method: 'upi',
  initialStatus: 'pending',
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('@/src/components/payment/PaymentReceiptCard', () => {
  const { View } = require('react-native');
  return {
    PaymentReceiptCard: ({ children, ...props }: any) => (
      <View testID="payment-receipt-card" {...props}>{children}</View>
    ),
  };
});

jest.mock('@/src/components/payment', () => {
  const { View } = require('react-native');
  return {
    DashedDivider: (props: any) => <View testID="dashed-divider" {...props} />,
  };
});

jest.mock('@/src/components/ui/Layout/OfflineBanner', () => {
  const { View } = require('react-native');
  return {
    OfflineBanner: () => <View testID="offline-banner" />,
  };
});

jest.mock('@/src/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true }),
}));

jest.mock('@/src/hooks', () => ({
  useGenerateReceipt: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/src/services/api/payments', () => ({
  checkPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
}));

jest.mock('@/src/utils/receiptHtml', () => ({
  buildReceiptHtml: jest.fn().mockReturnValue('<html></html>'),
}));

jest.mock('@/src/services/payment', () => ({}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StatusScreen', () => {
  it('renders with testID "status-screen"', () => {
    const { getByTestId } = render(<StatusScreen />);
    expect(getByTestId('status-screen')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<StatusScreen />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('StatusScreen — failed state', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({
      paymentId: 'pay-456',
      amount: '32500',
      method: 'card',
      initialStatus: 'failed',
      error: 'Payment declined',
    });
  });

  afterEach(() => {
    mockUseLocalSearchParams.mockReturnValue({
      paymentId: 'pay-123',
      amount: '32500',
      method: 'upi',
      initialStatus: 'pending',
    });
  });

  it('renders with testID "status-screen"', () => {
    const { getByTestId } = render(<StatusScreen />);
    expect(getByTestId('status-screen')).toBeTruthy();
  });
});

describe('StatusScreen — success state', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({
      paymentId: 'pay-789',
      amount: '32500',
      method: 'upi',
      transactionId: 'txn-789',
      initialStatus: 'success',
    });
  });

  afterEach(() => {
    mockUseLocalSearchParams.mockReturnValue({
      paymentId: 'pay-123',
      amount: '32500',
      method: 'upi',
      initialStatus: 'pending',
    });
  });

  it('renders with testID "status-screen"', () => {
    const { getByTestId } = render(<StatusScreen />);
    expect(getByTestId('status-screen')).toBeTruthy();
  });
});
