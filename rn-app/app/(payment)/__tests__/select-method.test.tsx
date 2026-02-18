import React from 'react';
import { render } from '@testing-library/react-native';

import SelectPaymentMethodScreen from '../select-method';

// ── Mocks ────────────────────────────────────────────────────────────────────

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
  DottedPattern: () => null,
}));

jest.mock('@/src/services/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null }),
          order: jest.fn(() => ({ limit: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null }) })) })),
        })),
        in: jest.fn(() => ({ order: jest.fn(() => ({ limit: jest.fn(() => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null }) })) })) })),
      })),
    })),
  },
}));

jest.mock('@/src/hooks/useDashboard', () => ({
  useDashboard: () => ({
    dashboardState: 'all_verified',
    tenancy: { monthly_rent: 40000 },
    upcomingPayment: { amount: 40000, days_until_due: 5 },
    isLoading: false,
  }),
}));

jest.mock('@/src/hooks/usePayments', () => ({
  useSavedPaymentMethods: () => ({ data: [] }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SelectPaymentMethodScreen', () => {
  it('renders with testID "select-method-screen"', () => {
    const { getByTestId } = render(<SelectPaymentMethodScreen />);
    expect(getByTestId('select-method-screen')).toBeTruthy();
  });

  it('renders payment method heading', () => {
    const { getByText } = render(<SelectPaymentMethodScreen />);
    expect(getByText(/Select Payment Method/i)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<SelectPaymentMethodScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<SelectPaymentMethodScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
