import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

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
  DottedGridPattern: () => null,
}));

// Mock Linking.openURL
jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

// Mock ScrollDownIndicator from ui barrel
jest.mock('@/src/components/ui/ScrollDownIndicator', () => {
  const { View } = require('react-native');
  return {
    ScrollDownIndicator: (props: any) =>
      props.visible ? <View testID="scroll-down-indicator" /> : null,
  };
});

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
    StatusNotificationBanner: (props: any) => props.type ? <View testID="status-notification-banner"><Text>{props.customMessage || props.type}</Text></View> : null,
    CashbackSetupModal: (props: any) => null,
    VerificationCheckSheet: (props: any) => null,
    RentAmountModal: (props: any) => null,
    EmptyPaymentsState: (props: any) => <View testID="empty-payments" />,
    CashbackEmptyState: (props: any) => <View testID="cashback-empty" />,
    PaymentMethodSelectionSheet: (props: any) => null,
    RentStatusCarousel: (props: any) => <View testID="rent-status-carousel" />,
    SetupProgressCard: (props: any) => <View testID="setup-progress-card" />,
  };
});

// Mock dashboard hooks
const mockRefresh = jest.fn();

// Default raw data shape matching DashboardData for getDashboardState()
const defaultMockData = {
  user: { id: 'u-1', first_name: 'Rishabh', last_name: null, phone: null },
  tenancy: {
    id: 'ten-1',
    status: 'active',
    property_address: '123 Main',
    property_city: 'Bangalore',
    monthly_rent: 40000,
    rent_due_day: 5,
    lease_start_date: null,
    lease_end_date: null,
    agreement_cert_id: null,
    landlord_name: 'Test',
    verification_status: {
      bank_verified: true,
      utility_verified: true,
      landlord_approved: true,
    },
  },
  upcoming_payment: { due_date: '2026-03-05', amount: 40000, amount_paise: 4000000, days_until_due: 5, is_overdue: false, cashback_eligible: true, rent_month: '2026-03-01' },
  cashback: { discount_rate: 0.01, max_discount_paise: 400, max_discount: 4, verification_complete: true, total_savings_paise: 0, total_savings: 0, legacy_wallet_balance: 0, available_balance: 320, pending_balance: 40, total_earned: 800, total_used: 440 },
  recent_payments: [],
  notifications: [],
  unread_notification_count: 0,
  payment_stamps: null,
};

let mockDashboardState: Record<string, any> = {
  data: defaultMockData,
  user: { first_name: 'Rishabh' },
  tenancy: defaultMockData.tenancy,
  upcomingPayment: defaultMockData.upcoming_payment,
  cashback: defaultMockData.cashback,
  recentPayments: [],
  cashbackEntries: [],
  unreadCount: 0,
  isLoading: false,
  isRefetching: false,
  error: null as Error | null,
  statusNotification: null as { type: string; message?: string } | null,
};
jest.mock('@/src/hooks/useDashboard', () => ({
  useDashboard: () => mockDashboardState,
  useRefreshDashboard: () => mockRefresh,
}));

jest.mock('@/src/hooks/usePayments', () => ({
  useSavedPaymentMethods: () => ({ data: [] }),
}));

jest.mock('@/src/stores/payment', () => ({
  usePaymentStore: Object.assign(
    (selector: any) => selector({ setAmount: jest.fn(), pendingPaymentReturn: false, setPendingPaymentReturn: jest.fn() }),
    { getState: () => ({ pendingPaymentReturn: false, setPendingPaymentReturn: jest.fn() }) },
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('HomeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockDashboardState = {
      data: defaultMockData,
      user: { first_name: 'Rishabh' },
      tenancy: defaultMockData.tenancy,
      upcomingPayment: defaultMockData.upcoming_payment,
      cashback: defaultMockData.cashback,
      recentPayments: [],
      cashbackEntries: [],
      unreadCount: 0,
      isLoading: false,
      isRefetching: false,
      error: null,
      statusNotification: null,
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

  it('renders active state structure correctly', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-screen')).toBeTruthy();
    expect(getByTestId('home-header')).toBeTruthy();
    expect(getByTestId('headline-section')).toBeTruthy();
    expect(getByTestId('tab-switcher')).toBeTruthy();
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

  // ── Status Notification Banner ──────────────────────────────────────────

  it('renders notification banner in pending_verification state', () => {
    const pendingTenancy = {
      ...defaultMockData.tenancy,
      status: 'pending_verification',
      verification_status: {
        bank_verified: true,
        utility_verified: false,
        landlord_approved: false,
      },
    };
    mockDashboardState = {
      ...mockDashboardState,
      data: { ...defaultMockData, tenancy: pendingTenancy },
      tenancy: pendingTenancy,
      statusNotification: { type: 'verification_pending' },
    };
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('status-notification-banner')).toBeTruthy();
  });

  it('renders notification banner in active state with rent due message', () => {
    mockDashboardState = {
      ...mockDashboardState,
      data: defaultMockData,
      statusNotification: { type: 'rent_due', message: 'Your rent is due on 5 Mar' },
    };
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('status-notification-banner')).toBeTruthy();
    expect(getByText('Your rent is due on 5 Mar')).toBeTruthy();
  });

  it('does not render notification banner when fully verified and no notification', () => {
    mockDashboardState = {
      ...mockDashboardState,
      statusNotification: null,
    };
    const { queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId('status-notification-banner')).toBeNull();
  });

  // ── Pending Verification — Zero Transactions ──────────────────────────

  it('renders HomeEmptyState for pending_verification with zero transactions', () => {
    const pendingTenancy = {
      ...defaultMockData.tenancy,
      status: 'pending_verification',
      verification_status: {
        bank_verified: false,
        utility_verified: false,
        landlord_approved: false,
      },
    };
    mockDashboardState = {
      ...mockDashboardState,
      data: { ...defaultMockData, tenancy: pendingTenancy, recent_payments: [] },
      tenancy: pendingTenancy,
      recentPayments: [],
      statusNotification: null,
    };
    const { getByTestId, queryByTestId } = render(<HomeScreen />);
    expect(getByTestId('home-empty-state')).toBeTruthy();
    // No tab switcher in zero state
    expect(queryByTestId('tab-switcher')).toBeNull();
  });

  // ── Pending Verification — Has Transactions ───────────────────────────

  it('renders TabSwitcher and SetupProgressCard for pending_verification with transactions', () => {
    const pendingTenancy = {
      ...defaultMockData.tenancy,
      status: 'pending_verification',
      verification_status: {
        bank_verified: true,
        utility_verified: false,
        landlord_approved: false,
      },
    };
    // Raw format matching edge function response (mapRecentPayments expects rent_month)
    const rawPayments = [
      { id: 'p-1', amount: 40000, status: 'success', rent_month: '2026-02-01', paid_at: '2026-02-05T10:30:00Z', cashback_earned: 320 },
    ];
    // Mapped format for recentPayments prop
    const mockPayments = [
      { id: 'p-1', title: 'February rent', amount: 40000, status: 'paid' as const, date: '5 Feb, 10:30am' },
    ];
    mockDashboardState = {
      ...mockDashboardState,
      data: { ...defaultMockData, tenancy: pendingTenancy, recent_payments: rawPayments },
      tenancy: pendingTenancy,
      recentPayments: mockPayments,
      statusNotification: null,
    };
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('tab-switcher')).toBeTruthy();
    expect(getByTestId('setup-progress-card')).toBeTruthy();
  });

  // ── Scroll Down Indicator ─────────────────────────────────────────────

  it('does not render scroll indicator in all_verified state', () => {
    mockDashboardState = {
      ...mockDashboardState,
      statusNotification: null,
    };
    const { queryByTestId } = render(<HomeScreen />);
    expect(queryByTestId('scroll-down-indicator')).toBeNull();
  });
});
