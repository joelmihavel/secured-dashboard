import '@testing-library/react-native/extend-expect';

// Mock @sentry/react-native (ESM module that Jest cannot transform)
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((callback: (scope: unknown) => void) =>
    callback({ setExtra: jest.fn() })
  ),
  Scope: jest.fn(),
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  const React = require('react');
  const RN = require('react-native');
  Reanimated.default.call = () => {};
  Reanimated.Easing = {
    bezier: () => (t: number) => t,
    linear: (t: number) => t,
    ease: (t: number) => t,
    in: (t: number) => t,
    out: (t: number) => t,
    inOut: (t: number) => t,
  };
  // Scroll handler: returns a no-op for tests
  Reanimated.useAnimatedScrollHandler = () => jest.fn();
  // runOnJS: just returns the function as-is (no worklet bridge in tests)
  Reanimated.runOnJS = (fn: (...args: unknown[]) => unknown) => fn;
  // interpolate: linear interpolation between input/output ranges
  Reanimated.interpolate = (
    value: number,
    inputRange: number[],
    outputRange: number[],
  ) => {
    if (value <= inputRange[0]) return outputRange[0];
    if (value >= inputRange[inputRange.length - 1])
      return outputRange[outputRange.length - 1];
    for (let i = 0; i < inputRange.length - 1; i++) {
      if (value >= inputRange[i] && value <= inputRange[i + 1]) {
        const t = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
        return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
      }
    }
    return outputRange[outputRange.length - 1];
  };
  Reanimated.Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
  // Animated.FlatList for tests
  Reanimated.default.FlatList = RN.FlatList;
  return Reanimated;
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock react-native-svg — provides named components with displayName set
// to prevent crashes in react-native-css-interop's wrap-jsx.
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const make = (n: string) => {
    const C = (props: Record<string, unknown>) =>
      mockReact.createElement(n, props, props.children);
    C.displayName = n;
    return C;
  };
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Circle: make('Circle'),
    Rect: make('Rect'),
    Path: make('Path'),
    G: make('G'),
    Defs: make('Defs'),
    Pattern: make('Pattern'),
    LinearGradient: make('LinearGradient'),
    RadialGradient: make('RadialGradient'),
    Stop: make('Stop'),
    Mask: make('Mask'),
    Line: make('Line'),
    Text: make('SvgText'),
    TSpan: make('TSpan'),
    ClipPath: make('ClipPath'),
    Use: make('Use'),
    Image: make('SvgImage'),
    Ellipse: make('Ellipse'),
    Polygon: make('Polygon'),
    Polyline: make('Polyline'),
  };
});

// Mock useIdentityVerification — useAuth imports useRecordConsent and
// useIdentityFetch from this module. Without the mock, any test that
// touches the auth layer fails with "useRecordConsent is not a function".
jest.mock('@/src/hooks/useIdentityVerification', () => ({
  useRecordConsent: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
  useIdentityFetch: () => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

// Mock react-native-safe-area-context — NativeWind's css-interop calls
// maybeHijackSafeAreaProvider on every JSX element and crashes with
// "Cannot read properties of undefined (reading 'displayName')" when
// safe-area-context components are not properly defined in the test env.
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    SafeAreaInsetsContext: { Consumer: View },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// Mock @react-native-community/netinfo — useNetworkStatus reads
// isInternetReachable from the native module which is unavailable in Jest.
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
    details: { isConnectionExpensive: false },
  }),
  useNetInfo: jest.fn().mockReturnValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
}));

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Animated:') || message.includes('useNativeDriver'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

// Mock timers for animation tests
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
