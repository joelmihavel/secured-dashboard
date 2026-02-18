import React from 'react';
import { render } from '@testing-library/react-native';

import ProcessingScreen from '../processing';

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

jest.mock('lottie-react-native', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => <View testID="lottie" {...props} />,
  };
});

jest.mock('@/src/services/payment', () => ({
  verifyPaymentStatus: jest.fn().mockResolvedValue({ status: 'pending' }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProcessingScreen', () => {
  it('renders with testID "processing-screen"', () => {
    const { getByTestId } = render(<ProcessingScreen />);
    expect(getByTestId('processing-screen')).toBeTruthy();
  });

  it('renders processing text', () => {
    const { getByText } = render(<ProcessingScreen />);
    expect(getByText(/Processing/)).toBeTruthy();
  });

  it('renders "Payment" title text', () => {
    const { getByText } = render(<ProcessingScreen />);
    expect(getByText('Payment')).toBeTruthy();
  });

  it('renders contact support button', () => {
    const { getByTestId } = render(<ProcessingScreen />);
    expect(getByTestId('contact-support-button')).toBeTruthy();
  });

  it('renders info text about payment processing', () => {
    const { getByText } = render(<ProcessingScreen />);
    expect(getByText(/received your payment request/)).toBeTruthy();
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<ProcessingScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ProcessingScreen />);
    expect(toJSON()).toBeTruthy();
  });
});
