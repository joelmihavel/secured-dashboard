import React from 'react';
import { render } from '@testing-library/react-native';

import AddUpiScreen from '../add-upi';

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

jest.mock('@/src/hooks', () => ({
  useAddUpiVpa: () => ({ mutate: jest.fn(), isPending: false }),
  useVerifyUpi: () => ({ mutate: jest.fn(), isPending: false }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AddUpiScreen', () => {
  it('renders with testID "add-upi-screen"', () => {
    const { getByTestId } = render(<AddUpiScreen />);
    expect(getByTestId('add-upi-screen')).toBeTruthy();
  });

  it('renders UPI-related title text', () => {
    const { getAllByText } = render(<AddUpiScreen />);
    expect(getAllByText(/UPI/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders UPI ID input with testID', () => {
    const { getByTestId } = render(<AddUpiScreen />);
    expect(getByTestId('upi-id-input')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<AddUpiScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AddUpiScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
