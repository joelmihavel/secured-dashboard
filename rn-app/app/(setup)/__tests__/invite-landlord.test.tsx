import React from 'react';
import { render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import InviteLandlordScreen from '../invite-landlord';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
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

// Mock DottedPattern
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

// Mock hooks
const mockMutate = jest.fn();
jest.mock('@/src/hooks', () => ({
  useSendLandlordInvite: () => ({ mutate: mockMutate, isPending: false }),
  useDashboard: () => ({ tenancy: { id: 'tenancy-1' } }),
  validateEmail: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
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

  it('renders title "Invite your / Landlord"', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText(/Invite your/)).toBeTruthy();
    expect(getByText('Landlord')).toBeTruthy();
  });

  it('renders form labels', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders "Get Started" button', () => {
    const { getByText } = render(<InviteLandlordScreen />);
    expect(getByText('Get Started')).toBeTruthy();
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
