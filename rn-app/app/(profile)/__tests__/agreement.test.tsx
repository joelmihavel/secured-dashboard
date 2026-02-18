import React from 'react';
import { render } from '@testing-library/react-native';

import ProfileAgreementScreen from '../agreement';

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

jest.mock('@/src/hooks', () => ({
  useDashboard: () => ({
    tenancy: {
      id: 'ten-1',
      agreement_id: 'KIA 123456789',
      property_address: 'Prestige Pinestripe, Bommanahalli, Bengaluru 560036',
      tenant_names: 'Rahul Joshi, Ashish Shakya',
      landlord_name: 'Tanmay Bhatt',
      monthly_rent: 40000,
      security_deposit: 130000,
      lease_duration_months: 11,
      lease_end_date: '2027-12-31',
    },
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

describe('ProfileAgreementScreen', () => {
  it('renders with testID "profile-agreement-screen"', () => {
    const { getByTestId } = render(<ProfileAgreementScreen />);
    expect(getByTestId('profile-agreement-screen')).toBeTruthy();
  });

  it('renders agreement title text', () => {
    const { getByText } = render(<ProfileAgreementScreen />);
    expect(getByText('agreement')).toBeTruthy();
  });

  it('renders "View your " prefix', () => {
    const { getByText } = render(<ProfileAgreementScreen />);
    expect(getByText('View your ')).toBeTruthy();
  });

  it('renders Agreement ID label', () => {
    const { getByText } = render(<ProfileAgreementScreen />);
    expect(getByText('Agreement ID')).toBeTruthy();
  });

  it('renders Property Name label', () => {
    const { getByText } = render(<ProfileAgreementScreen />);
    expect(getByText('Property Name')).toBeTruthy();
  });

  it('renders Monthly Rent label', () => {
    const { getByText } = render(<ProfileAgreementScreen />);
    expect(getByText('Monthly Rent')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<ProfileAgreementScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ProfileAgreementScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
