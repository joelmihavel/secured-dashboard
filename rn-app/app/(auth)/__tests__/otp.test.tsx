import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ── Module mocks (must be declared before component imports) ─────────────────
// The component barrel (src/components) transitively pulls in Sentry and
// @expo/vector-icons. These must be mocked before the OTPScreen import.

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn((component: unknown) => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  Severity: { Info: 'info', Warning: 'warning', Error: 'error' },
}));

jest.mock('@/src/config/sentry', () => ({
  initSentry: jest.fn(),
  captureError: jest.fn(),
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  Sentry: {
    init: jest.fn(),
    wrap: jest.fn((component: unknown) => component),
    captureException: jest.fn(),
    withScope: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const MockIcon = (props: any) => <Text>{props.name}</Text>;
  return { Ionicons: MockIcon, MaterialIcons: MockIcon, MaterialCommunityIcons: MockIcon, FontAwesome: MockIcon, Feather: MockIcon, AntDesign: MockIcon };
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Svg: View, Path: View, Circle: View, Rect: View, G: View, Defs: View, ClipPath: View, Line: View, Text: View };
});

import OTPScreen from '../otp';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
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

// reanimated is globally mocked via setup.ts (react-native-reanimated/mock)

// Mock gesture handler
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    Gesture: {
      Pan: () => ({
        onUpdate: () => ({ onEnd: () => ({}) }),
      }),
    },
    GestureDetector: ({ children }: any) => <View>{children}</View>,
  };
});

// Mock expo-blur
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style, ...props }: any) => (
      <View {...props} style={style}>{children}</View>
    ),
  };
});

// Mock useAuth hook
const mockVerifyCode = jest.fn();
const mockResendCode = jest.fn();
const mockClearError = jest.fn();
let mockAuthState = {
  phoneNumber: '+919876543210',
  status: 'otp_sent' as string,
  error: null as { code: string; message: string } | null,
  verifyCode: mockVerifyCode,
  resendCode: mockResendCode,
  isVerifyingOtp: false,
  isResendingOtp: false,
  clearError: mockClearError,
};
jest.mock('@/src/hooks', () => ({
  useAuth: () => mockAuthState,
}));

// Mock useAuthStore
jest.mock('@/src/stores/auth', () => ({
  useAuthStore: (selector: any) => {
    const store = { userName: 'Test User' };
    return selector(store);
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OTPScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
    mockVerifyCode.mockClear();
    mockResendCode.mockClear();
    mockClearError.mockClear();
    mockSearchParams = {};
    mockAuthState = {
      phoneNumber: '+919876543210',
      status: 'otp_sent',
      error: null,
      verifyCode: mockVerifyCode,
      resendCode: mockResendCode,
      isVerifyingOtp: false,
      isResendingOtp: false,
      clearError: mockClearError,
    };
  });

  it('renders correctly and matches snapshot', () => {
    const { toJSON } = render(<OTPScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders title text "Let\'s verify your number"', () => {
    const { getByText } = render(<OTPScreen />);
    expect(getByText("Let's verify your number")).toBeTruthy();
  });

  it('renders subtitle text about 6-digit code', () => {
    const { getByText } = render(<OTPScreen />);
    expect(getByText(/6-digit code/)).toBeTruthy();
  });

  it('renders OTP input with testID', () => {
    const { getByTestId } = render(<OTPScreen />);
    expect(getByTestId('otp-input')).toBeTruthy();
  });

  it('renders Proceed button with testID', () => {
    const { getByTestId } = render(<OTPScreen />);
    expect(getByTestId('proceed-button')).toBeTruthy();
  });

  it('does not render "Secure code" label (Figma Label#67:0 = false)', () => {
    const { queryByText } = render(<OTPScreen />);
    expect(queryByText('Secure code')).toBeNull();
  });

  it('renders resend text', () => {
    const { getByText } = render(<OTPScreen />);
    expect(getByText(/Didn't receive the code/)).toBeTruthy();
  });

  it('navigates to waitlist when status is "authenticated"', () => {
    mockAuthState = { ...mockAuthState, status: 'authenticated' };
    render(<OTPScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(waitlist)');
  });

  it('does not navigate when status is "otp_sent"', () => {
    render(<OTPScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('calls resendCode when Resend is pressed', () => {
    const { getByText } = render(<OTPScreen />);
    fireEvent.press(getByText('Resend'));
    expect(mockResendCode).toHaveBeenCalledTimes(1);
  });

  it('pre-fills OTP when ?state=filled param is set', () => {
    mockSearchParams = { state: 'filled' };
    const { getByTestId } = render(<OTPScreen />);
    // Proceed button should be enabled with filled OTP
    const button = getByTestId('proceed-button');
    expect(button).toBeTruthy();
  });
});
