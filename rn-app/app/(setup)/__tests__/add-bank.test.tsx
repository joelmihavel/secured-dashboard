import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import AddBankScreen from '../add-bank';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
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

// Mock DottedPattern (imported via Screen)
jest.mock('@/src/components/patterns', () => ({
  DottedPattern: () => null,
}));

// Mock hooks
const mockMutate = jest.fn();
jest.mock('@/src/hooks', () => ({
  useVerifyBank: () => ({ mutate: mockMutate, isPending: false }),
  useDashboard: () => ({ tenancy: { id: 'tenancy-1' } }),
  validateAccountNumber: (v: string) => /^\d{9,18}$/.test(v),
  validateIfscCode: (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
}));

jest.mock('@/src/types/setup', () => ({}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AddBankScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockMutate.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('renders title "Add your Landlord\'s / Bank Details"', () => {
    const { getByText } = render(<AddBankScreen />);
    expect(getByText(/Add your Landlord/)).toBeTruthy();
    expect(getByText('Bank Details')).toBeTruthy();
  });

  it('renders form labels', () => {
    const { getByText } = render(<AddBankScreen />);
    expect(getByText('Account Holder Name')).toBeTruthy();
  });

  it('renders submit button with "Proceed" text', () => {
    const { getAllByText } = render(<AddBankScreen />);
    expect(getAllByText('Proceed').length).toBeGreaterThanOrEqual(1);
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<AddBankScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AddBankScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
