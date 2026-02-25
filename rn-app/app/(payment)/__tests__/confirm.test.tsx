import React from 'react';
import { render } from '@testing-library/react-native';

import ConfirmScreen from '../confirm';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Line: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
  };
});

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: {
      id: 'ten-1',
      monthly_rent: 32500,
      verification_status: {
        bank_verified: true,
        utility_verified: true,
        landlord_approved: true,
      },
    },
    upcomingPayment: { amount: 32500, days_until_due: 10, rent_month: '2025-06' },
    cashback: { available_balance: 325 },
    isLoading: false,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConfirmScreen', () => {
  it('renders with testID "confirm-screen"', () => {
    const { getByTestId } = render(<ConfirmScreen />);
    expect(getByTestId('confirm-screen')).toBeTruthy();
  });

  it('renders pay now button with testID', () => {
    const { getByTestId } = render(<ConfirmScreen />);
    expect(getByTestId('pay-now-button')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ConfirmScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
