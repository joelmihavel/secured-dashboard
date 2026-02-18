import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ── Module mocks (must be declared before component imports) ─────────────────
// The component barrel (src/components) transitively pulls in Sentry and
// @expo/vector-icons. These must be mocked before the SignUpScreen import.

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

import SignUpScreen from '../sign-up';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock expo-router
const mockPush = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockSearchParams,
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

// Mock DottedPattern (heavy image component -- not relevant to sign-up logic)
jest.mock('@/src/components/patterns', () => ({
  DottedPattern: () => null,
}));

// Mock ConsentToggle with a controllable Switch so tests can toggle consent
jest.mock('@/src/components/composed/auth/ConsentToggle', () => {
  const { View, Switch } = require('react-native');
  return {
    ConsentToggle: ({ value, onValueChange, testID }: any) => (
      <View testID={testID}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          testID={`${testID}-switch`}
        />
      </View>
    ),
  };
});

// Mock useAuth hook -- default to idle state
const mockSendCode = jest.fn();
const mockClearError = jest.fn();
let mockAuthState = {
  sendCode: mockSendCode,
  status: 'idle' as string,
  error: null as { code: string; message: string } | null,
  isSendingOtp: false,
  clearError: mockClearError,
};
jest.mock('@/src/hooks', () => ({
  useAuth: () => mockAuthState,
}));

// Mock useAuthStore -- selector-based Zustand pattern
const mockSetUserName = jest.fn();
const mockSetConsentForMobile360 = jest.fn();
jest.mock('@/src/stores/auth', () => ({
  useAuthStore: (selector: any) => {
    const store = {
      setUserName: mockSetUserName,
      setConsentForMobile360: mockSetConsentForMobile360,
    };
    return selector(store);
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function fillPhone(getByTestId: any, value = '9876543210') {
  fireEvent.changeText(getByTestId('phone-input'), value);
}

function fillName(getByTestId: any, value = 'John Appleseed') {
  fireEvent.changeText(getByTestId('name-input'), value);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SignUpScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSendCode.mockClear();
    mockClearError.mockClear();
    mockSetUserName.mockClear();
    mockSetConsentForMobile360.mockClear();
    mockSearchParams = {};
    mockAuthState = {
      sendCode: mockSendCode,
      status: 'idle',
      error: null,
      isSendingOtp: false,
      clearError: mockClearError,
    };
  });

  // ── Snapshot ─────────────────────────────────────────────────────────────

  it('renders correctly and matches snapshot', () => {
    const { toJSON } = render(<SignUpScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  // ── Structure ────────────────────────────────────────────────────────────

  it('renders the Screen wrapper with testID "sign-up-screen"', () => {
    const { getByTestId } = render(<SignUpScreen />);
    expect(getByTestId('sign-up-screen')).toBeTruthy();
  });

  it('renders heading text', () => {
    const { getAllByText } = render(<SignUpScreen />);
    const grayHeading = getAllByText(/Let's get to/);
    expect(grayHeading.length).toBeGreaterThanOrEqual(1);
    const accentHeading = getAllByText(/know you/);
    expect(accentHeading.length).toBeGreaterThanOrEqual(1);
  });

  it('renders phone input with testID', () => {
    const { getByTestId } = render(<SignUpScreen />);
    expect(getByTestId('phone-input')).toBeTruthy();
  });

  it('renders name input with testID', () => {
    const { getByTestId } = render(<SignUpScreen />);
    expect(getByTestId('name-input')).toBeTruthy();
  });

  it('renders "Get Started" button with testID', () => {
    const { getByTestId } = render(<SignUpScreen />);
    expect(getByTestId('get-started-button')).toBeTruthy();
  });

  it('renders consent toggle with testID', () => {
    const { getByTestId } = render(<SignUpScreen />);
    expect(getByTestId('consent-toggle')).toBeTruthy();
  });

  // ── Button Disabled State ────────────────────────────────────────────────

  it('Get Started button is disabled by default (empty form)', () => {
    const { getByTestId } = render(<SignUpScreen />);
    const button = getByTestId('get-started-button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('Get Started button is disabled when phone is less than 10 digits', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId, '98765');
    fillName(getByTestId);
    const button = getByTestId('get-started-button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });

  it('Get Started button is enabled when form is complete', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId);
    fillName(getByTestId);
    const button = getByTestId('get-started-button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false })
    );
  });

  // ── Form Submission ──────────────────────────────────────────────────────

  it('calls sendCode with formatted phone number on button press', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId, '9876543210');
    fillName(getByTestId);

    fireEvent.press(getByTestId('get-started-button'));

    expect(mockSendCode).toHaveBeenCalledTimes(1);
    expect(mockSendCode).toHaveBeenCalledWith('+919876543210', 'whatsapp');
  });

  it('stores name and consent in auth store on submit', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId);
    fillName(getByTestId, 'Jane Doe');

    fireEvent.press(getByTestId('get-started-button'));

    expect(mockSetUserName).toHaveBeenCalledWith('Jane Doe');
    expect(mockSetConsentForMobile360).toHaveBeenCalledWith(true);
  });

  it('does not call sendCode when form is invalid', () => {
    const { getByTestId } = render(<SignUpScreen />);
    fireEvent.press(getByTestId('get-started-button'));
    expect(mockSendCode).not.toHaveBeenCalled();
  });

  it('does not call sendCode when already sending OTP', () => {
    mockAuthState = { ...mockAuthState, isSendingOtp: true };
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId);
    fillName(getByTestId);
    fireEvent.press(getByTestId('get-started-button'));
    expect(mockSendCode).not.toHaveBeenCalled();
  });

  // ── Navigation on OTP Sent ───────────────────────────────────────────────

  it('navigates to /(auth)/otp when status becomes "otp_sent"', () => {
    mockAuthState = { ...mockAuthState, status: 'otp_sent' };
    render(<SignUpScreen />);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/otp');
  });

  it('does not navigate when status is "idle"', () => {
    render(<SignUpScreen />);
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ── Pre-filled State ─────────────────────────────────────────────────────

  it('pre-fills form when ?state=filled query param is set', () => {
    mockSearchParams = { state: 'filled' };
    const { getByTestId } = render(<SignUpScreen />);
    const button = getByTestId('get-started-button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false })
    );
  });

  // ── Error Handling ───────────────────────────────────────────────────────

  it('clears error when phone input changes and error exists', () => {
    mockAuthState = {
      ...mockAuthState,
      error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
    };
    const { getByTestId } = render(<SignUpScreen />);
    fillPhone(getByTestId, '1234567890');
    expect(mockClearError).toHaveBeenCalled();
  });
});
