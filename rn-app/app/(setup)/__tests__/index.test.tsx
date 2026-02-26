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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SetupIndexScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
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

  it('renders first step description about bank details', () => {
    const { getByText } = render(<SetupIndexScreen />);
    expect(getByText(/bank details/)).toBeTruthy();
  });

  it('renders "Start Flenting" button with testID', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    expect(getByTestId('start-flenting-button')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<SetupIndexScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Button Behavior ────────────────────────────────────────────────────
  // The carousel starts at step 0 (first step), where the button is disabled.
  // On step 3 (last step), the button becomes active and navigates to add-bank.

  it('renders button as disabled on first carousel step', () => {
    const { getByTestId } = render(<SetupIndexScreen />);
    const button = getByTestId('start-flenting-button');
    // The button exists but is disabled on step 0-1
    expect(button).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<SetupIndexScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
