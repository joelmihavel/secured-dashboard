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

// Mock DottedPattern (heavy SVG component -- not relevant to sign-up logic)
jest.mock('@/src/components/patterns', () => ({
  DottedGridPattern: () => null,
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
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
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

function toggleConsent(getByTestId: any, value = true) {
  fireEvent(getByTestId('consent-toggle-switch'), 'valueChange', value);
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

  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders correctly and matches snapshot', () => {
      const { toJSON } = render(<SignUpScreen />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders the Screen wrapper with testID "sign-up-screen"', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId('sign-up-screen')).toBeTruthy();
    });

    it('renders heading text with gray and accent parts', () => {
      const { getAllByText } = render(<SignUpScreen />);
      expect(getAllByText(/Let's get to/).length).toBeGreaterThanOrEqual(1);
      expect(getAllByText(/know you/).length).toBeGreaterThanOrEqual(1);
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
  });

  // ── Empty State (Button Disabled) ──────────────────────────────────────────

  describe('empty state', () => {
    it('Get Started button is disabled by default (empty form)', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });
  });

  // ── Form Validation ────────────────────────────────────────────────────────

  describe('form validation', () => {
    it('button is disabled when phone is less than 10 digits', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '98765');
      fillName(getByTestId);
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('button is disabled when name is less than 2 characters', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId, 'A');
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('button is disabled when name is empty', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId, '');
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('button is disabled when consent is OFF (valid phone + name)', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId);
      // consent defaults to true, toggle it OFF
      toggleConsent(getByTestId, false);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('button enables only when ALL 3 conditions met (valid phone + name + consent ON)', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId);
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
    });

    it('accepts exactly 10-digit phone number', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '1234567890');
      fillName(getByTestId);
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
    });

    it('accepts name with exactly 2 characters', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId, 'Jo');
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
    });

    it('trims name whitespace for validation (name " A " is invalid)', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId, ' A ');
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true })
      );
    });

    it('strips non-digit characters from phone for validation', () => {
      const { getByTestId } = render(<SignUpScreen />);
      // PhoneInput formats as "98765 43210" (with space), sign-up strips non-digits
      fillPhone(getByTestId, '98765 43210');
      fillName(getByTestId);
      toggleConsent(getByTestId, true);
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
    });
  });

  // ── Error States ───────────────────────────────────────────────────────────

  describe('error states', () => {
    it('displays "Enter valid number" for INVALID_PHONE error', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Enter valid number')).toBeTruthy();
    });

    it('displays fallback error for PHONE_EXISTS (no dedicated message)', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'PHONE_EXISTS', message: 'This number already exists' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Something went wrong. Try again.')).toBeTruthy();
    });

    it('displays "Too many attempts. Please wait." for RATE_LIMITED error', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'RATE_LIMITED', message: 'Too many attempts' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Too many attempts. Please wait.')).toBeTruthy();
    });

    it('displays "Check your internet connection" for NETWORK_ERROR', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'NETWORK_ERROR', message: 'Network error' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Check your internet connection')).toBeTruthy();
    });

    it('displays "Request timed out. Try again." for TIMEOUT error', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'TIMEOUT', message: 'Timeout' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Request timed out. Try again.')).toBeTruthy();
    });

    it('does not display error for OTP-related error codes (e.g. INVALID_OTP)', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'INVALID_OTP', message: 'Invalid OTP' },
      };
      const { queryByText } = render(<SignUpScreen />);
      expect(queryByText('Invalid OTP')).toBeNull();
    });

    it('clears auth error when phone input changes', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
      };
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '1234567890');
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  // ── Error via hook state ────────────────────────────────────────────────────

  describe('error via hook state', () => {
    it('shows "Enter valid number" when hook has INVALID_PHONE error', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
      };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Enter valid number')).toBeTruthy();
    });

    it('clears error when phone input changes', () => {
      mockAuthState = {
        ...mockAuthState,
        error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
      };
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '1234567890');
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  // ── Submission Flow ────────────────────────────────────────────────────────

  describe('submission flow', () => {
    it('calls sendCode with +91-prefixed phone on button press', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '9876543210');
      fillName(getByTestId);
      toggleConsent(getByTestId, true);

      fireEvent.press(getByTestId('get-started-button'));

      expect(mockSendCode).toHaveBeenCalledTimes(1);
      expect(mockSendCode).toHaveBeenCalledWith('+919876543210', 'whatsapp', 'John Appleseed');
    });

    it('formats phone by stripping non-digits before sending', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '98765 43210'); // formatted with space
      fillName(getByTestId);
      toggleConsent(getByTestId, true);

      fireEvent.press(getByTestId('get-started-button'));

      expect(mockSendCode).toHaveBeenCalledWith('+919876543210', 'whatsapp', 'John Appleseed');
    });

    it('stores trimmed name in auth store on submit', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId, '  Jane Doe  ');
      toggleConsent(getByTestId, true);

      fireEvent.press(getByTestId('get-started-button'));

      expect(mockSetUserName).toHaveBeenCalledWith('Jane Doe');
    });

    it('stores consent value in auth store on submit', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId);
      toggleConsent(getByTestId, true);

      fireEvent.press(getByTestId('get-started-button'));

      expect(mockSetConsentForMobile360).toHaveBeenCalledWith(true);
    });

    it('does not call sendCode when form is invalid', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fireEvent.press(getByTestId('get-started-button'));
      expect(mockSendCode).not.toHaveBeenCalled();
    });
  });

  // ── Double-Submit Prevention ───────────────────────────────────────────────

  describe('double-submit prevention', () => {
    it('does not call sendCode when isSendingOtp is true', () => {
      mockAuthState = { ...mockAuthState, isSendingOtp: true };
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId);
      toggleConsent(getByTestId, true);
      fireEvent.press(getByTestId('get-started-button'));
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('prevents second submit via isSendingRef guard', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId);
      fillName(getByTestId);
      toggleConsent(getByTestId, true);

      // First press succeeds
      fireEvent.press(getByTestId('get-started-button'));
      expect(mockSendCode).toHaveBeenCalledTimes(1);

      // Second rapid press is blocked by isSendingRef (ref is set to true
      // immediately on first press and only resets when isSendingOtp turns false)
      fireEvent.press(getByTestId('get-started-button'));
      expect(mockSendCode).toHaveBeenCalledTimes(1);
    });
  });

  // ── Navigation on OTP Sent ─────────────────────────────────────────────────

  describe('navigation', () => {
    it('navigates to /(auth)/otp when isSendingOtp transitions false → status otp_sent', () => {
      // Phase 1: render with isSendingOtp: true (sets wasSendingOtpRef = true)
      mockAuthState = { ...mockAuthState, isSendingOtp: true };
      const { rerender } = render(<SignUpScreen />);

      // Phase 2: re-render with isSendingOtp: false + status: otp_sent
      mockAuthState = { ...mockAuthState, isSendingOtp: false, status: 'otp_sent' };
      rerender(<SignUpScreen />);

      expect(mockPush).toHaveBeenCalledWith('/(auth)/otp');
    });

    it('does not navigate when status is "idle"', () => {
      render(<SignUpScreen />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('does not navigate when status is "error"', () => {
      mockAuthState = {
        ...mockAuthState,
        status: 'error',
        error: { code: 'INVALID_PHONE', message: 'bad' },
      };
      render(<SignUpScreen />);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── Pre-filled Form State ───────────────────────────────────────────────────

  describe('pre-filled form state', () => {
    it('enables button when all fields are filled and consent is on', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '9876543210');
      fillName(getByTestId, 'John Appleseed');
      // consent defaults to true
      const button = getByTestId('get-started-button');
      expect(button.props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: false })
      );
    });

    it('submits filled form data correctly', () => {
      const { getByTestId } = render(<SignUpScreen />);
      fillPhone(getByTestId, '9876543210');
      fillName(getByTestId, 'John Appleseed');
      fireEvent.press(getByTestId('get-started-button'));
      expect(mockSendCode).toHaveBeenCalledWith('+919876543210', 'whatsapp', 'John Appleseed');
      expect(mockSetUserName).toHaveBeenCalledWith('John Appleseed');
      expect(mockSetConsentForMobile360).toHaveBeenCalledWith(true);
    });
  });
});
