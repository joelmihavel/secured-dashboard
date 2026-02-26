import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// ── Module mocks (must be declared before component imports) ─────────────────
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), wrap: jest.fn((c: unknown) => c), captureException: jest.fn(),
  captureMessage: jest.fn(), withScope: jest.fn(), setUser: jest.fn(),
  addBreadcrumb: jest.fn(), Severity: { Info: 'info', Warning: 'warning', Error: 'error' },
}));
jest.mock('@/src/config/sentry', () => ({
  initSentry: jest.fn(), captureError: jest.fn(), setUserContext: jest.fn(),
  clearUserContext: jest.fn(), addBreadcrumb: jest.fn(),
  Sentry: { init: jest.fn(), wrap: jest.fn((c: unknown) => c), captureException: jest.fn(), withScope: jest.fn(), setUser: jest.fn(), addBreadcrumb: jest.fn() },
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = (props: any) => <Text>{props.name}</Text>;
  return { Ionicons: MockIcon, MaterialIcons: MockIcon, MaterialCommunityIcons: MockIcon, FontAwesome: MockIcon, Feather: MockIcon, AntDesign: MockIcon };
});
import SplashScreen from '../splash';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

// Mock react-native-safe-area-context (Screen depends on SafeAreaView)
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>
        {children}
      </View>
    ),
    SafeAreaProvider: ({ children }: any) => children,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
  };
});

// Mock DottedGridPattern (heavy SVG component — not relevant to splash logic)
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SplashScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  // ── Snapshot ─────────────────────────────────────────────────────────────

  it('renders correctly and matches snapshot', () => {
    const { toJSON } = render(<SplashScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Structure ────────────────────────────────────────────────────────────

  it('renders the Screen wrapper with testID', () => {
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('splash-screen')).toBeTruthy();
  });

  it('renders heading text with gray and accent sections', () => {
    const { getByText } = render(<SplashScreen />);
    expect(getByText(/work for you/)).toBeTruthy();
  });

  it('renders the body text', () => {
    const { getByText } = render(<SplashScreen />);
    expect(
      getByText(/Secured is India.*first rent payment app/)
    ).toBeTruthy();
  });

  it('renders the Get Started button with testID', () => {
    const { getByTestId } = render(<SplashScreen />);
    expect(getByTestId('get-started-button')).toBeTruthy();
  });

  it('renders the login link text', () => {
    const { getByText } = render(<SplashScreen />);
    expect(getByText(/Already a user/)).toBeTruthy();
    expect(getByText('Log in')).toBeTruthy();
  });

  // ── Interactions ─────────────────────────────────────────────────────────

  it('navigates to carousel when Get Started is pressed', () => {
    const { getByTestId } = render(<SplashScreen />);
    fireEvent.press(getByTestId('get-started-button'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/carousel');
  });

  it('navigates to sign-up when Log in is pressed', () => {
    const { getByText } = render(<SplashScreen />);
    fireEvent.press(getByText('Log in'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('triggers haptic feedback when Log in is pressed', () => {
    const { getByText } = render(<SplashScreen />);
    fireEvent.press(getByText('Log in'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('does not navigate to carousel when Log in is pressed', () => {
    const { getByText } = render(<SplashScreen />);
    fireEvent.press(getByText('Log in'));
    expect(mockPush).not.toHaveBeenCalledWith('/(auth)/carousel');
  });

  it('does not navigate to sign-up when Get Started is pressed', () => {
    const { getByTestId } = render(<SplashScreen />);
    fireEvent.press(getByTestId('get-started-button'));
    expect(mockPush).not.toHaveBeenCalledWith('/(auth)/sign-up');
  });
});
