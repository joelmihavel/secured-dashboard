import React from 'react';
import { render } from '@testing-library/react-native';

import EditProfileScreen from '../edit';

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
  DottedPattern: () => null,
}));

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { Ionicons: (props: any) => <View {...props} /> };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    user: {
      id: 'u1',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+91 98765 43210',
      city: 'Bangalore',
      avatar_url: null,
    },
    isLoading: false,
  }),
  useUpdateProfile: () => ({ mutate: jest.fn(), isPending: false }),
  useUploadAvatar: () => ({ mutate: jest.fn(), isPending: false }),
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

describe('EditProfileScreen', () => {
  it('renders with testID "edit-profile-screen"', () => {
    const { getByTestId } = render(<EditProfileScreen />);
    expect(getByTestId('edit-profile-screen')).toBeTruthy();
  });

  it('renders profile title with "My " text', () => {
    const { getByText } = render(<EditProfileScreen />);
    expect(getByText('My ')).toBeTruthy();
  });

  it('renders profile title with "Profile" accent text', () => {
    const { getByText } = render(<EditProfileScreen />);
    expect(getByText('Profile')).toBeTruthy();
  });

  it('renders Edit Picture button', () => {
    const { getByText } = render(<EditProfileScreen />);
    expect(getByText('Edit Picture')).toBeTruthy();
  });

  it('renders Save Changes button', () => {
    const { getByText } = render(<EditProfileScreen />);
    expect(getByText('Save Changes')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<EditProfileScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<EditProfileScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
