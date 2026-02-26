import React from 'react';
import { render } from '@testing-library/react-native';

import WaitlistScreen from '../index';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
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

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

// Mock waitlist hook - matches current useWaitlist return shape
const mockJoinWaitlist = jest.fn();
const mockSetReferralCharacter = jest.fn();
const mockClearReferralCode = jest.fn();
const mockRefresh = jest.fn();
const mockClaimInviteCode = jest.fn();
let mockWaitlistState: Record<string, any> = {};

const defaultWaitlistState = () => ({
  status: {
    position: 42,
    submissionDate: 'Jan 15, 2026',
    estimatedReviewTime: 'Within 24 hrs',
    currentOnboarded: 75,
    totalMemberSlots: 150,
    rejectionReasons: [] as string[],
  },
  viewState: 'pending' as string,
  userName: 'Rishabh',
  referralCode: ['', '', '', '', '', ''],
  isReferralComplete: false,
  referralApplied: false,
  referralError: null as string | null,
  countdownText: '28:24:24',
  isLoading: false,
  isRefetching: false,
  error: null as { code: string; message: string } | null,
  joinWaitlist: mockJoinWaitlist,
  isJoiningWaitlist: false,
  setReferralCharacter: mockSetReferralCharacter,
  clearReferralCode: mockClearReferralCode,
  refresh: mockRefresh,
  inviteCodeClaimed: false,
  claimInviteCode: mockClaimInviteCode,
  isClaimingInviteCode: false,
});

jest.mock('@/src/hooks', () => ({
  useWaitlist: () => mockWaitlistState,
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}));

// Mock waitlist components that are heavy
jest.mock('@/src/components/waitlist/ApplicationTimeline', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ items }: any) => (
      <View testID="application-timeline">
        {items.map((item: any, i: number) => (
          <Text key={i}>{item.label}: {item.value}</Text>
        ))}
      </View>
    ),
    ApplicationTimeline: ({ items }: any) => (
      <View testID="application-timeline">
        {items.map((item: any, i: number) => (
          <Text key={i}>{item.label}: {item.value}</Text>
        ))}
      </View>
    ),
  };
});

jest.mock('@/src/components/waitlist/ProgressArc', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ current, total }: any) => (
      <View testID="progress-arc">
        <Text>{current}/{total}</Text>
      </View>
    ),
    ProgressArc: ({ current, total }: any) => (
      <View testID="progress-arc">
        <Text>{current}/{total}</Text>
      </View>
    ),
  };
});

jest.mock('@/src/components/waitlist/ReferralCodeInput', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="referral-code-input" />,
    ReferralCodeInput: (props: any) => <View testID="referral-code-input" />,
  };
});

jest.mock('@/src/components/waitlist/BenefitsCard', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => (
      <View testID="benefits-card">
        <Text>{props.variant}</Text>
      </View>
    ),
    BenefitsCard: (props: any) => (
      <View testID="benefits-card">
        <Text>{props.variant}</Text>
      </View>
    ),
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WaitlistScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockJoinWaitlist.mockClear();
    mockRefresh.mockClear();
    mockWaitlistState = defaultWaitlistState();
  });

  // ── Pending State ────────────────────────────────────────────────────────

  it('renders pending state with welcome text', () => {
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText(/Welcome,/)).toBeTruthy();
    expect(getByText('Rishabh')).toBeTruthy();
  });

  it('renders subtitle "Your application is in review"', () => {
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText('Your application is in review')).toBeTruthy();
  });

  it('renders "Have an Invite Code?" text', () => {
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText('Have an Invite Code?')).toBeTruthy();
  });

  it('renders without crashing (pending)', () => {
    const { toJSON } = render(<WaitlistScreen />);
    expect(toJSON()).toBeTruthy();
  });

  // ── Loading State ────────────────────────────────────────────────────────

  it('renders loading state with skeleton', () => {
    mockWaitlistState = { ...defaultWaitlistState(), viewState: 'loading', isLoading: true };
    const { toJSON } = render(<WaitlistScreen />);
    expect(toJSON()).toBeTruthy();
  });

  // ── Rejected State ───────────────────────────────────────────────────────

  it('renders rejected state with rejection title', () => {
    mockWaitlistState = {
      ...defaultWaitlistState(),
      viewState: 'rejected',
    };
    const { getByText } = render(<WaitlistScreen />);
    // The screen renders "We can't approve you" with "right now" in orange
    expect(getByText(/approve you/)).toBeTruthy();
    expect(getByText(/right now/)).toBeTruthy();
  });

  it('renders rejected state with BenefitsCard variant', () => {
    mockWaitlistState = {
      ...defaultWaitlistState(),
      viewState: 'rejected',
    };
    const { getByTestId } = render(<WaitlistScreen />);
    expect(getByTestId('benefits-card')).toBeTruthy();
  });

  // ── Approved Redirect ────────────────────────────────────────────────────

  it('redirects to approved page when viewState is "approved"', () => {
    mockWaitlistState = { ...defaultWaitlistState(), viewState: 'approved' };
    render(<WaitlistScreen />);
    // The redirect happens via reanimated withTiming callback with runOnJS,
    // which fires synchronously in the mock environment
    expect(mockReplace).toHaveBeenCalledWith('/(waitlist)/approved');
  });

  it('does not redirect when viewState is "pending"', () => {
    render(<WaitlistScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Error State ──────────────────────────────────────────────────────────

  it('renders error state with error message', () => {
    mockWaitlistState = {
      ...defaultWaitlistState(),
      viewState: 'error',
      error: { code: 'NETWORK_ERROR', message: 'Failed to connect' },
    };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText(/something/)).toBeTruthy();
    expect(getByText(/went wrong/)).toBeTruthy();
  });

  // ── Pending Long State ───────────────────────────────────────────────────

  it('renders pending_long state with extended wait messaging', () => {
    mockWaitlistState = { ...defaultWaitlistState(), viewState: 'pending_long' };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText(/Taking a bit longer than usual/)).toBeTruthy();
  });
});
