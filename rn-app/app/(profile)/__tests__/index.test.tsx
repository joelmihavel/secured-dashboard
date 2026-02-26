import React from 'react';
import { render } from '@testing-library/react-native';

import ProfileScreen from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  requestReview: jest.fn(),
}));

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    user: { id: 'u1', first_name: 'Test', last_name: 'User', email: 'test@example.com', avatar_url: null },
    tenancy: { id: 'ten-1', monthly_rent: 40000 },
    isLoading: false,
  }),
  useAuth: () => ({
    signOut: jest.fn(),
    isSigningOut: false,
  }),
  useDeleteAccount: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
  useSavedPaymentMethods: () => ({
    data: [
      { id: 'pm-1', type: 'upi', display_name: 'test@oksbi', is_default: true, is_verified: true, nickname: null, created_at: '2026-01-01', vpa: 'test@oksbi' },
      { id: 'pm-2', type: 'card', display_name: 'Visa *1234', is_default: false, is_verified: true, nickname: null, created_at: '2026-01-01', card_type: 'credit', card_network: 'visa', last_four: '1234' },
      { id: 'pm-3', type: 'netbanking', display_name: 'HDFC Bank', is_default: false, is_verified: true, nickname: null, created_at: '2026-01-01', bank_code: 'HDFC', bank_name: 'HDFC Bank' },
    ],
    isLoading: false,
  }),
}));

jest.mock('@/src/services/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  },
}));

describe('ProfileScreen', () => {
  it('renders with testID "profile-screen"', () => {
    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId('profile-screen')).toBeTruthy();
  });

  it('renders profile title text', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Profile')).toBeTruthy();
  });

  it('renders sign out button', () => {
    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId('sign-out-button')).toBeTruthy();
  });

  it('renders contact support button', () => {
    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId('contact-support-button')).toBeTruthy();
  });

  it('renders Secured Account section', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Secured Account')).toBeTruthy();
  });

  it('renders Payment Information section', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Payment Information')).toBeTruthy();
  });

  it('renders View Agreement menu item', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('View Agreement')).toBeTruthy();
  });

  it('renders Sign Out menu item', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Sign Out')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<ProfileScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ProfileScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
