import React from 'react';
import { render } from '@testing-library/react-native';

import WaitlistScreen from '../index';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

let mockDevMockState: string | null = null;
jest.mock('@/src/hooks/useDeepLink', () => ({
  consumeDeepLinkParams: () => null,
  useDevMockState: () => mockDevMockState,
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

// Mock waitlist hook
const mockApplyReferral = jest.fn();
const mockJoinWaitlist = jest.fn();
const mockSetReferralCharacter = jest.fn();
const mockRefresh = jest.fn();
let mockWaitlistState = {
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
  isApplyingReferral: false,
  referralError: null as string | null,
  countdownText: '28:24:24',
  isLoading: false,
  isRefetching: false,
  error: null as { code: string; message: string } | null,
  applyReferral: mockApplyReferral,
  joinWaitlist: mockJoinWaitlist,
  isJoiningWaitlist: false,
  setReferralCharacter: mockSetReferralCharacter,
  refresh: mockRefresh,
};
jest.mock('@/src/hooks', () => ({
  useWaitlist: () => mockWaitlistState,
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
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="benefits-card" />,
    BenefitsCard: (props: any) => <View testID="benefits-card" />,
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WaitlistScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockApplyReferral.mockClear();
    mockJoinWaitlist.mockClear();
    mockRefresh.mockClear();
    mockDevMockState = null;
    mockWaitlistState = {
      status: {
        position: 42,
        submissionDate: 'Jan 15, 2026',
        estimatedReviewTime: 'Within 24 hrs',
        currentOnboarded: 75,
        totalMemberSlots: 150,
        rejectionReasons: [],
      },
      viewState: 'pending',
      userName: 'Rishabh',
      referralCode: ['', '', '', '', '', ''],
      isReferralComplete: false,
      isApplyingReferral: false,
      referralError: null,
      countdownText: '28:24:24',
      isLoading: false,
      isRefetching: false,
      error: null,
      applyReferral: mockApplyReferral,
      joinWaitlist: mockJoinWaitlist,
      isJoiningWaitlist: false,
      setReferralCharacter: mockSetReferralCharacter,
      refresh: mockRefresh,
    };
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
    mockWaitlistState = { ...mockWaitlistState, viewState: 'loading', isLoading: true };
    const { toJSON } = render(<WaitlistScreen />);
    expect(toJSON()).toBeTruthy();
  });

  // ── Rejected State ───────────────────────────────────────────────────────

  it('renders rejected state with rejection title', () => {
    mockWaitlistState = {
      ...mockWaitlistState,
      viewState: 'rejected',
      status: {
        ...mockWaitlistState.status,
        rejectionReasons: ['Insufficient documentation', 'Account mismatch'],
      },
    };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText("We can't approve you right now")).toBeTruthy();
    expect(getByText('Why was I Rejected?')).toBeTruthy();
  });

  it('renders rejection reasons', () => {
    mockWaitlistState = {
      ...mockWaitlistState,
      viewState: 'rejected',
      status: {
        ...mockWaitlistState.status,
        rejectionReasons: ['Insufficient documentation'],
      },
    };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText('Insufficient documentation')).toBeTruthy();
  });

  // ── Approved Redirect ────────────────────────────────────────────────────

  it('redirects to approved page when viewState is "approved"', () => {
    mockDevMockState = 'approved';
    mockWaitlistState = { ...mockWaitlistState, viewState: 'approved' };
    render(<WaitlistScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(waitlist)/approved');
  });

  it('does not redirect when viewState is "pending"', () => {
    render(<WaitlistScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Error State ──────────────────────────────────────────────────────────

  it('renders error state with error message', () => {
    mockWaitlistState = {
      ...mockWaitlistState,
      viewState: 'error',
      error: { code: 'NETWORK_ERROR', message: 'Failed to connect' },
    };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText(/something/)).toBeTruthy();
    expect(getByText(/went wrong/)).toBeTruthy();
  });

  // ── Pending Long State ───────────────────────────────────────────────────

  it('renders pending_long state with extended wait messaging', () => {
    mockWaitlistState = { ...mockWaitlistState, viewState: 'pending_long' };
    const { getByText } = render(<WaitlistScreen />);
    expect(getByText(/Taking a bit longer than usual/)).toBeTruthy();
  });
});
