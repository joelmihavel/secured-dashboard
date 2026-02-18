import React from 'react';
import { render } from '@testing-library/react-native';

import SuccessScreen from '../success';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ transactionId: 'txn-123', amount: '40000' }),
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

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: (props: any) => <View {...props} />,
  };
});

jest.mock('@/src/hooks', () => ({
  useGenerateReceipt: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('@/src/components/payment', () => {
  const { View } = require('react-native');
  return {
    DashedDivider: (props: any) => <View testID="dashed-divider" {...props} />,
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SuccessScreen', () => {
  it('renders with testID "success-screen"', () => {
    const { getByTestId } = render(<SuccessScreen />);
    expect(getByTestId('success-screen')).toBeTruthy();
  });

  it('renders success text', () => {
    const { getByText } = render(<SuccessScreen />);
    expect(getByText(/Succesful|Success/i)).toBeTruthy();
  });

  it('renders "Payment" title text', () => {
    const { getByText } = render(<SuccessScreen />);
    expect(getByText('Payment')).toBeTruthy();
  });

  it('renders download receipt button', () => {
    const { getByTestId } = render(<SuccessScreen />);
    expect(getByTestId('download-receipt-button')).toBeTruthy();
  });

  it('renders "Contact Support" link', () => {
    const { getByText } = render(<SuccessScreen />);
    expect(getByText('Contact Support')).toBeTruthy();
  });

  it('renders receipt row labels', () => {
    const { getByText } = render(<SuccessScreen />);
    expect(getByText('Amount paid')).toBeTruthy();
    expect(getByText('Method')).toBeTruthy();
    expect(getByText('Transaction ID')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<SuccessScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<SuccessScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
