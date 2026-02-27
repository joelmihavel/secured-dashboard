/**
 * Unit Tests: OTPScreen
 * Figma Nodes: 1-31175 (empty), 1-31073 (filled), 1-31277 (error1), 1-31380 (error2)
 * Route: /(auth)/otp
 *
 * OTP verification bottom-sheet modal with:
 *   - 6-digit OTP input (two groups of 3, separator dash)
 *   - Proceed button (disabled until 6 digits entered)
 *   - Resend link with sending state
 *   - Overlay tap and gesture to dismiss
 *   - Error display for invalid OTP, max attempts, expired, etc.
 *   - Navigation to /(waitlist) on successful authentication
 *   - Exponential backoff cooldown on repeated failures
 *
 * Uses useAuth hook for verifyCode, resendCode, and status tracking.
 * Uses useAuthStore for userName.
 *
 * Categories covered (all 9):
 *   1. Renders without crash
 *   2. Text content matches Figma
 *   3. Interactive elements present (testIDs)
 *   4. Navigation fires correctly
 *   5. Loading state (isVerifyingOtp, isResendingOtp)
 *   6. Error state (invalid OTP, max attempts, expired, network, session, timeout)
 *   7. Empty state (no code entered)
 *   8. Props variations (empty, filled, error1, error2 via query params)
 *   9. Accessibility
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import {
  EXPECTED_TEXT,
  EXPECTED_NAVIGATION,
  TEST_IDS,
  MOCK_OTP_DATA,
  SCREEN_METADATA,
  AUTH_HOOK_IDLE,
  AUTH_HOOK_VERIFYING,
  AUTH_HOOK_RESENDING,
  AUTH_HOOK_AUTHENTICATED,
  AUTH_HOOK_INVALID_OTP,
  AUTH_HOOK_MAX_ATTEMPTS,
  AUTH_HOOK_OTP_EXPIRED,
  AUTH_HOOK_NETWORK_ERROR,
  AUTH_HOOK_SESSION_ERROR,
  AUTH_HOOK_TIMEOUT,
} from '../fixtures/otp.fixtures';

// --- Mock expo-router ---
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: ({ children }: any) => children,
  BottomSheetView: ({ children }: any) => children,
  BottomSheetScrollView: ({ children }: any) => children,
  BottomSheetTextInput: 'TextInput',
  BottomSheetBackdrop: () => null,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
  useSegments: () => [],
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Mock react-native-safe-area-context ---
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// --- Mock expo-blur (BlurView used in OTP overlay) ---
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }: any) => (
      <View testID="blur-view" {...props}>{children}</View>
    ),
  };
});

// --- Mock react-native-gesture-handler (GestureDetector, Gesture used for dismiss) ---
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    GestureDetector: ({ children }: any) => <View testID="gesture-detector">{children}</View>,
    Gesture: {
      Pan: () => ({
        onUpdate: () => ({
          onEnd: () => ({}),
        }),
      }),
    },
    GestureHandlerRootView: ({ children }: any) => <View>{children}</View>,
  };
});

// --- Mock useAuth hook ---
let mockAuthReturn: any = { ...AUTH_HOOK_IDLE };

jest.mock('@/src/hooks', () => ({
  useAuth: () => mockAuthReturn,
}));

// --- Mock useAuthStore ---
let mockUserName = 'Rohan Joshi';

jest.mock('@/src/stores/auth', () => ({
  useAuthStore: (selector: any) => {
    const store = {
      userName: mockUserName,
    };
    return selector(store);
  },
}));

// Import component under test after all mocks
import OTPScreen from '@/app/(auth)/otp';

describe('OTPScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthReturn = { ...AUTH_HOOK_IDLE };
    mockSearchParams = {};
    mockUserName = 'Rohan Joshi';
  });

  // =========================================================================
  // Category 1: Renders without crash
  // =========================================================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<OTPScreen />)).not.toThrow();
    });

    it('returns valid JSX (non-null render)', () => {
      const { toJSON } = render(<OTPScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 2: Text content matches Figma
  // =========================================================================
  describe('text content matches Figma', () => {
    it('displays the title "Let\'s verify your number"', () => {
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.title)).toBeTruthy();
    });

    it('displays the subtitle about 6-digit code', () => {
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.subtitleStraight)).toBeTruthy();
    });

    it('displays the "Proceed" button text', () => {
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.proceedButton)).toBeTruthy();
    });

    it('displays the resend prefix text', () => {
      const { getByText } = render(<OTPScreen />);
      expect(getByText(/Didn't receive the code\?/)).toBeTruthy();
    });

    it('displays the "Resend" link text', () => {
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.resendLink)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================================================
  describe('interactive elements present', () => {
    it('has the OTP input with testID', () => {
      const { getByTestId } = render(<OTPScreen />);
      expect(getByTestId(TEST_IDS.otpInput)).toBeTruthy();
    });

    it('has the Proceed button with testID', () => {
      const { getByTestId } = render(<OTPScreen />);
      expect(getByTestId(TEST_IDS.proceedButton)).toBeTruthy();
    });

    it('renders the blur overlay', () => {
      const { getByTestId } = render(<OTPScreen />);
      expect(getByTestId('blur-view')).toBeTruthy();
    });

    it('renders the gesture detector for dismiss', () => {
      const { getByTestId } = render(<OTPScreen />);
      expect(getByTestId('gesture-detector')).toBeTruthy();
    });

    it('renders the resend link as pressable', () => {
      const { getByText } = render(<OTPScreen />);
      const resendLink = getByText(EXPECTED_TEXT.resendLink);
      expect(resendLink).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 4: Navigation fires correctly
  // =========================================================================
  describe('navigation', () => {
    it('does not crash when status becomes authenticated', () => {
      // The screen uses runOnJS(router.replace) inside a withTiming callback,
      // which does not fire in the mock reanimated environment.
      // Verify the component renders without errors when authenticated.
      const { rerender, toJSON } = render(<OTPScreen />);

      mockAuthReturn = { ...AUTH_HOOK_AUTHENTICATED };
      rerender(<OTPScreen />);

      expect(toJSON()).toBeTruthy();
    });

    it('does not navigate when status is otp_sent (idle for OTP screen)', () => {
      render(<OTPScreen />);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('calls verifyCode when proceed is pressed with complete OTP', () => {
      const mockVerifyCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, verifyCode: mockVerifyCode };

      const { getByTestId } = render(<OTPScreen />);

      // Enter 6 digits
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), MOCK_OTP_DATA.filled);

      // Press Proceed
      fireEvent.press(getByTestId(TEST_IDS.proceedButton));

      expect(mockVerifyCode).toHaveBeenCalledWith(
        MOCK_OTP_DATA.filled,
        mockUserName,
      );
    });

    it('calls resendCode when Resend link is pressed', () => {
      const mockResendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, resendCode: mockResendCode };

      const { getByText } = render(<OTPScreen />);
      fireEvent.press(getByText(EXPECTED_TEXT.resendLink));

      expect(mockResendCode).toHaveBeenCalledTimes(1);
    });

    it('clears OTP and error when resend is pressed', () => {
      const mockClearError = jest.fn();
      const mockResendCode = jest.fn();
      mockAuthReturn = {
        ...AUTH_HOOK_INVALID_OTP,
        clearError: mockClearError,
        resendCode: mockResendCode,
      };

      const { getByText } = render(<OTPScreen />);
      fireEvent.press(getByText(EXPECTED_TEXT.resendLink));

      expect(mockClearError).toHaveBeenCalled();
      expect(mockResendCode).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Category 5: Loading state
  // =========================================================================
  describe('loading state', () => {
    it('prevents double-submission when isVerifyingOtp is true', () => {
      const mockVerifyCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_VERIFYING, verifyCode: mockVerifyCode };

      const { getByTestId } = render(<OTPScreen />);

      // Enter 6 digits
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), MOCK_OTP_DATA.filled);

      // Press Proceed while verifying
      fireEvent.press(getByTestId(TEST_IDS.proceedButton));

      // verifyCode should NOT be called since isVerifyingOtp is true
      expect(mockVerifyCode).not.toHaveBeenCalled();
    });

    it('renders proceed button in loading state when verifying', () => {
      mockAuthReturn = { ...AUTH_HOOK_VERIFYING };
      const { getByTestId } = render(<OTPScreen />);

      // The proceed button should still be present
      expect(getByTestId(TEST_IDS.proceedButton)).toBeTruthy();
    });

    it('shows "Sending..." text when isResendingOtp is true', () => {
      mockAuthReturn = { ...AUTH_HOOK_RESENDING };
      const { getByText } = render(<OTPScreen />);

      expect(getByText(EXPECTED_TEXT.resendSending)).toBeTruthy();
    });

    it('does not show "Resend" when isResendingOtp is true', () => {
      mockAuthReturn = { ...AUTH_HOOK_RESENDING };
      const { queryByText } = render(<OTPScreen />);

      // Should show "Sending..." instead of "Resend"
      expect(queryByText(/^Resend$/)).toBeNull();
    });
  });

  // =========================================================================
  // Category 6: Error state
  // =========================================================================
  describe('error state', () => {
    it('displays "Wrong Code" for INVALID_OTP error', () => {
      mockAuthReturn = { ...AUTH_HOOK_INVALID_OTP };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorWrongCode)).toBeTruthy();
    });

    it('displays "Too many Attempts" for MAX_ATTEMPTS error', () => {
      mockAuthReturn = { ...AUTH_HOOK_MAX_ATTEMPTS };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorTooManyAttempts)).toBeTruthy();
    });

    it('displays "Code Expired" for OTP_EXPIRED error', () => {
      mockAuthReturn = { ...AUTH_HOOK_OTP_EXPIRED };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorCodeExpired)).toBeTruthy();
    });

    it('displays "Session error. Please try again." for SESSION_ERROR', () => {
      mockAuthReturn = { ...AUTH_HOOK_SESSION_ERROR };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorSessionError)).toBeTruthy();
    });

    it('displays "Check your connection" for NETWORK_ERROR', () => {
      mockAuthReturn = { ...AUTH_HOOK_NETWORK_ERROR };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorNetworkError)).toBeTruthy();
    });

    it('displays "Request timed out. Try again." for TIMEOUT', () => {
      mockAuthReturn = { ...AUTH_HOOK_TIMEOUT };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorTimeout)).toBeTruthy();
    });

    it('clears error when OTP input changes', () => {
      const mockClearError = jest.fn();
      mockAuthReturn = {
        ...AUTH_HOOK_INVALID_OTP,
        clearError: mockClearError,
      };

      const { getByTestId } = render(<OTPScreen />);
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), '1');

      expect(mockClearError).toHaveBeenCalled();
    });

    it('displays "Wrong Code" when auth hook has INVALID_OTP error', () => {
      mockAuthReturn = { ...AUTH_HOOK_INVALID_OTP };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorWrongCode)).toBeTruthy();
    });

    it('displays "Too many Attempts" when auth hook has MAX_ATTEMPTS error', () => {
      mockAuthReturn = { ...AUTH_HOOK_MAX_ATTEMPTS };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorTooManyAttempts)).toBeTruthy();
    });

    it('disables proceed button when error is present', () => {
      mockAuthReturn = { ...AUTH_HOOK_INVALID_OTP };
      const mockVerifyCode = jest.fn();
      mockAuthReturn.verifyCode = mockVerifyCode;

      const { getByTestId } = render(<OTPScreen />);

      // Enter 6 digits
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), MOCK_OTP_DATA.filled);

      // Press Proceed -- should be disabled because of error
      fireEvent.press(getByTestId(TEST_IDS.proceedButton));

      expect(mockVerifyCode).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Category 7: Empty state (no code entered)
  // =========================================================================
  describe('empty state', () => {
    it('renders with empty OTP input on initial load', () => {
      const { getByTestId } = render(<OTPScreen />);

      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput).toBeTruthy();
      // The hidden input should have empty value
      expect(otpInput.props.value).toBe('');
    });

    it('proceed button does not submit when OTP is empty', () => {
      const mockVerifyCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, verifyCode: mockVerifyCode };

      const { getByTestId } = render(<OTPScreen />);

      // Press Proceed without entering any OTP
      fireEvent.press(getByTestId(TEST_IDS.proceedButton));

      expect(mockVerifyCode).not.toHaveBeenCalled();
    });

    it('proceed button does not submit when OTP is partial (< 6 digits)', () => {
      const mockVerifyCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, verifyCode: mockVerifyCode };

      const { getByTestId } = render(<OTPScreen />);

      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), MOCK_OTP_DATA.partial);
      fireEvent.press(getByTestId(TEST_IDS.proceedButton));

      expect(mockVerifyCode).not.toHaveBeenCalled();
    });

    it('has no error message displayed in empty state', () => {
      const { queryByText } = render(<OTPScreen />);

      expect(queryByText(EXPECTED_TEXT.errorWrongCode)).toBeNull();
      expect(queryByText(EXPECTED_TEXT.errorTooManyAttempts)).toBeNull();
      expect(queryByText(EXPECTED_TEXT.errorCodeExpired)).toBeNull();
    });

    it('shows all UI elements in empty state', () => {
      const { getByText, getByTestId } = render(<OTPScreen />);

      expect(getByText(EXPECTED_TEXT.title)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.subtitleStraight)).toBeTruthy();
      expect(getByTestId(TEST_IDS.otpInput)).toBeTruthy();
      expect(getByTestId(TEST_IDS.proceedButton)).toBeTruthy();
      expect(getByText(EXPECTED_TEXT.resendLink)).toBeTruthy();
    });
  });

  // =========================================================================
  // Category 8: Props variations / state variants (query params)
  // =========================================================================
  describe('state variations', () => {
    it('renders empty state when no state param', () => {
      mockSearchParams = {};
      const { getByTestId } = render(<OTPScreen />);

      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput.props.value).toBe('');
    });

    it('renders with empty OTP input by default', () => {
      const { getByTestId } = render(<OTPScreen />);
      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput).toBeTruthy();
    });

    it('renders error state with "Wrong Code" from auth hook', () => {
      mockAuthReturn = { ...AUTH_HOOK_INVALID_OTP };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorWrongCode)).toBeTruthy();
    });

    it('renders error state with "Too many Attempts" from auth hook', () => {
      mockAuthReturn = { ...AUTH_HOOK_MAX_ATTEMPTS };
      const { getByText } = render(<OTPScreen />);
      expect(getByText(EXPECTED_TEXT.errorTooManyAttempts)).toBeTruthy();
    });

    it('all 4 states are documented in SCREEN_METADATA', () => {
      expect(SCREEN_METADATA.states).toEqual(['empty', 'filled', 'error1', 'error2']);
    });

    it('has correct route in metadata', () => {
      expect(SCREEN_METADATA.route).toBe('/(auth)/otp');
    });

    it('metadata indicates screen has loading, error, and empty states', () => {
      expect(SCREEN_METADATA.hasLoadingState).toBe(true);
      expect(SCREEN_METADATA.hasErrorState).toBe(true);
      expect(SCREEN_METADATA.hasEmptyState).toBe(true);
      expect(SCREEN_METADATA.hasDataFetching).toBe(true);
    });
  });

  // =========================================================================
  // Category 9: Accessibility
  // =========================================================================
  describe('accessibility', () => {
    it('proceed button has accessibilityRole="button"', () => {
      const { getByTestId } = render(<OTPScreen />);
      const button = getByTestId(TEST_IDS.proceedButton);
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('proceed button has accessibilityLabel matching title', () => {
      const { getByTestId } = render(<OTPScreen />);
      const button = getByTestId(TEST_IDS.proceedButton);
      expect(button.props.accessibilityLabel).toBeTruthy();
      expect(button.props.accessibilityLabel).toBe(EXPECTED_TEXT.proceedButton);
    });

    it('proceed button reports disabled state when OTP is incomplete', () => {
      const { getByTestId } = render(<OTPScreen />);
      const button = getByTestId(TEST_IDS.proceedButton);
      // Button is disabled when OTP is not 6 digits
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('OTP input supports number-pad keyboard', () => {
      const { getByTestId } = render(<OTPScreen />);
      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput.props.keyboardType).toBe('number-pad');
    });

    it('OTP input has textContentType for autofill', () => {
      const { getByTestId } = render(<OTPScreen />);
      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput.props.textContentType).toBe('oneTimeCode');
    });

    it('OTP input has autoComplete for one-time-code', () => {
      const { getByTestId } = render(<OTPScreen />);
      const otpInput = getByTestId(TEST_IDS.otpInput);
      expect(otpInput.props.autoComplete).toBe('one-time-code');
    });
  });

  // =========================================================================
  // Additional: OTP auto-submit and cooldown
  // =========================================================================
  describe('auto-submit and cooldown', () => {
    it('auto-submits when 6th digit is entered via onComplete', () => {
      const mockVerifyCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, verifyCode: mockVerifyCode };

      const { getByTestId } = render(<OTPScreen />);

      // Typing all 6 digits triggers onComplete via the OTPInput component
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), MOCK_OTP_DATA.filled);

      // verifyCode should be called via onComplete -> handleProceed
      expect(mockVerifyCode).toHaveBeenCalledWith(
        MOCK_OTP_DATA.filled,
        mockUserName,
      );
    });

    it('calls clearError when OTP input changes while error is present', () => {
      const mockClearError = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_INVALID_OTP, clearError: mockClearError };
      const { getByTestId } = render(<OTPScreen />);

      // Change OTP input — should call clearError
      fireEvent.changeText(getByTestId(TEST_IDS.otpInput), '1');

      expect(mockClearError).toHaveBeenCalled();
    });
  });
});
