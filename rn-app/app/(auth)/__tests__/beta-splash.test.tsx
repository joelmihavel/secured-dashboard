import React from 'react';
import { render } from '@testing-library/react-native';

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
import BetaSplashScreen from '../beta-splash';

// Mock expo-router
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

// Mock react-native-safe-area-context
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

// Mock DottedPattern
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
}));

describe('BetaSplashScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { toJSON } = render(<BetaSplashScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders Screen wrapper with correct testID', () => {
    const { getByTestId } = render(<BetaSplashScreen />);
    expect(getByTestId('beta-splash-screen')).toBeTruthy();
  });

  it('renders "BETA LAUNCH" text', () => {
    const { getByText } = render(<BetaSplashScreen />);
    expect(getByText('BETA LAUNCH')).toBeTruthy();
  });

  it('auto-navigates to splash after 2500ms', () => {
    render(<BetaSplashScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2500);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/splash');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('does not navigate before 2500ms', () => {
    render(<BetaSplashScreen />);
    jest.advanceTimersByTime(2000);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('cleans up timeout on unmount', () => {
    const { unmount } = render(<BetaSplashScreen />);
    unmount();
    jest.advanceTimersByTime(2500);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
