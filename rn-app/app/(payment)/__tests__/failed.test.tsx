import React from 'react';
import { render } from '@testing-library/react-native';

import FailedScreen from '../failed';

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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View {...props} />,
    Svg: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Circle: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
    G: (props: any) => <View {...props} />,
  };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FailedScreen', () => {
  it('renders with testID "failed-screen"', () => {
    const { getByTestId } = render(<FailedScreen />);
    expect(getByTestId('failed-screen')).toBeTruthy();
  });

  it('renders failure text', () => {
    const { getByText } = render(<FailedScreen />);
    expect(getByText(/Failed/)).toBeTruthy();
  });

  it('renders "Payment" title text', () => {
    const { getByText } = render(<FailedScreen />);
    expect(getByText('Payment')).toBeTruthy();
  });

  it('renders error info text', () => {
    const { getByText } = render(<FailedScreen />);
    expect(getByText(/Something didn't go through/)).toBeTruthy();
  });

  it('renders contact support button', () => {
    const { getByTestId } = render(<FailedScreen />);
    expect(getByTestId('contact-support-button')).toBeTruthy();
  });

  it('renders "Try Again" link', () => {
    const { getByText } = render(<FailedScreen />);
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<FailedScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<FailedScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
