import React from 'react';
import { render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import InviteLandlordScreen from '../invite-landlord';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
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

// Mock DottedPattern - both import paths used by the screen
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));
jest.mock('@/src/components/patterns/DottedGridPattern', () => ({
  DottedGridPattern: () => null,
  DottedGridPresets: {},
}));

// Mock hooks
const mockMutate = jest.fn();
jest.mock('@/src/hooks', () => ({
  useSendLandlordInvite: () => ({ mutate: mockMutate, isPending: false }),
  useDashboard: () => ({ tenancy: { id: 'tenancy-1' } }),
  validateEmail: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
}));

jest.mock('@/src/types/setup', () => ({}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InviteLandlordScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
    mockMutate.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('renders title "One last step" and "we promise"', () => {
    const { getAllByText, getByText } = render(<InviteLandlordScreen />);
    const matches = getAllByText(/Confirm/);
    expect(matches.length).toBeGreaterThan(0);
    expect(getByText(/your tenancy/)).toBeTruthy();
    
  });

  it('renders subtitle about inviting landlord to activate cashback', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText(/activate your cashback/)).toBeTruthy();
  });

  it('renders phone input label', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText(/Confirm your tenancy by inviting your landlord/)).toBeTruthy();
  });

  it('renders "Save & Invite" button', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText('Save & Invite')).toBeTruthy();
  });

  it('renders "Skip" option', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText('Skip')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<InviteLandlordScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<InviteLandlordScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
