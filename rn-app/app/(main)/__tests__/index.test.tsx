import React from 'react';
import { render } from '@testing-library/react-native';

import HomeScreen from '../index';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

jest.mock('@/src/components/patterns', () => ({
  DottedPattern: () => null,
}));

// Mock all home sub-components
jest.mock('@/src/components/home', () => {
  const { View, Text } = require('react-native');
  return {
    HomeHeader: (props: any) => <View testID="home-header" />,
    HeadlineSection: (props: any) => <View testID="headline-section"><Text>{props.userName}</Text></View>,
    WarningBanner: (props: any) => <View testID="warning-banner" />,
    PaymentMethodCarousel: (props: any) => <View testID="payment-carousel" />,
    TabSwitcher: (props: any) => <View testID="tab-switcher" />,
    RecentPaymentsList: (props: any) => <View testID="recent-payments" />,
    CashbacksList: (props: any) => <View testID="cashbacks-list" />,
    BottomFooter: (props: any) => <View testID="bottom-footer" />,
    HomeEmptyState: (props: any) => <View testID="home-empty-state" />,
    CashbackSetupModal: (props: any) => null,
    EmptyPaymentsState: (props: any) => <View testID="empty-payments" />,
    CashbackEmptyState: (props: any) => <View testID="cashback-empty" />,
  };
});

// Mock dashboard hooks
const mockRefresh = jest.fn();
let mockDashboardState = {
  dashboardState: 'all_verified' as string,
  user: { first_name: 'Rishabh' },
  tenancy: {
    id: 'ten-1',
    monthly_rent: 40000,
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: true,
    },
  },
  upcomingPayment: { amount: 40000, days_until_due: 5, is_overdue: false, rent_month: '2026-03-01' },
  cashback: { available_balance: 320, pending_balance: 40, total_earned: 800, total_used: 440 },
  recentPayments: [],
  cashbackEntries: [],
  unreadCount: 0,
  isLoading: false,
  isRefetching: false,
  error: null as Error | null,
};
jest.mock('@/src/hooks/useDashboard', () => ({
  useDashboard: () => mockDashboardState,
  useRefreshDashboard: () => mockRefresh,
}));

jest.mock('@/src/hooks/usePayments', () => ({
  useSavedPaymentMethods: () => ({ data: [] }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockDashboardState = {
      dashboardState: 'all_verified',
      user: { first_name: 'Rishabh' },
      tenancy: {
        id: 'ten-1',
        monthly_rent: 40000,
        verification_status: {
          bank_verified: true,
          utility_verified: true,
          landlord_approved: true,
        },
      },
      upcomingPayment: { amount: 40000, days_until_due: 5, is_overdue: false, rent_month: '2026-03-01' },
      cashback: { available_balance: 320, pending_balance: 40, total_earned: 800, total_used: 440 },
      recentPayments: [],
      cashbackEntries: [],
      unreadCount: 0,
      isLoading: false,
      isRefetching: false,
      error: null,
    };
  });

  // ── Active State ────────────────────────────────────────────────────────

  it('renders home screen with testID', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-screen')).toBeTruthy();
  });

  it('renders headline section', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('headline-section')).toBeTruthy();
  });

  it('matches snapshot (active state)', () => {
    const { toJSON } = render(<HomeScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Loading State ───────────────────────────────────────────────────────

  it('renders loading state', () => {
    mockDashboardState = { ...mockDashboardState, isLoading: true };
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('home-screen-loading')).toBeTruthy();
    expect(getByText('Loading your dashboard...')).toBeTruthy();
  });

  // ── Error State ─────────────────────────────────────────────────────────

  it('renders error state', () => {
    mockDashboardState = {
      ...mockDashboardState,
      error: new Error('Network failed'),
    };
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('home-screen-error')).toBeTruthy();
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Network failed')).toBeTruthy();
  });

  it('renders retry button in error state', () => {
    mockDashboardState = {
      ...mockDashboardState,
      error: new Error('fail'),
    };
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Retry')).toBeTruthy();
  });

  // ── Fallback User ────────────────────────────────────────────────────

  it('renders without crashing when user is null', () => {
    mockDashboardState = { ...mockDashboardState, user: null as any };
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-screen')).toBeTruthy();
  });
});
