import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import SetupIndexScreen from '../index';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

// DottedPattern (heavy SVG component)
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

// useVerificationStatus hook
let mockVerificationState = {
  isLoading: false,
  error: null as any,
  bankVerified: false,
  utilityVerified: false,
  landlordApproved: false,
  allVerified: false,
  pendingSteps: ['bank', 'utility', 'landlord'],
};
jest.mock('@/src/hooks', () => ({
  useVerificationStatus: () => mockVerificationState,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SetupIndexScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
    mockVerificationState = {
      isLoading: false,
      error: null,
      bankVerified: false,
      utilityVerified: false,
      landlordApproved: false,
      allVerified: false,
      pendingSteps: ['bank', 'utility', 'landlord'],
    };
  });

  // ── Structure ───────────────────────────────────────────────────────────

  it('renders with testID "setup-index-screen"', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    expect(getByTestId('setup-index-screen')).toBeTruthy();
  });

  it('renders title text', () => {
    const { getByText } = render(<SetupIndexScreen />);
    expect(getByText(/Let's get/)).toBeTruthy();
    expect(getByText('you set up')).toBeTruthy();
  });

  it('renders first step description', () => {
    const { getByText } = render(<SetupIndexScreen />);
    expect(getByText(/bank details/)).toBeTruthy();
  });

  it('renders "Start Flenting" button with testID', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    expect(getByTestId('start-flenting-button')).toBeTruthy();
  });

  it('renders button text "Start Flenting"', () => {
    const { getAllByText } = render(<SetupIndexScreen />);
    // Both inactive and active button states may render via FlatList
    expect(getAllByText('Start Flenting').length).toBeGreaterThanOrEqual(1);
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<SetupIndexScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Navigation ──────────────────────────────────────────────────────────

  it('navigates to pending-steps on button press (not all verified)', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    fireEvent.press(getByTestId('start-flenting-button'));
    expect(mockPush).toHaveBeenCalledWith('/(setup)/pending-steps');
  });

  it('triggers haptic feedback on button press', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    fireEvent.press(getByTestId('start-flenting-button'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium
    );
  });

  it('navigates to main when all verified', () => {
    mockVerificationState = {
      ...mockVerificationState,
      allVerified: true,
      pendingSteps: [],
    };
    const { getByTestId } = render(<SetupIndexScreen />);
    fireEvent.press(getByTestId('start-flenting-button'));
    expect(mockReplace).toHaveBeenCalledWith('/(main)');
  });
});
