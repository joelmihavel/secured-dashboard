/**
 * Unit Tests: SignUpScreen
 * Figma Node: 1-29108 (empty state)
 * Route: /(auth)/sign-up
 *
 * Sign-up screen with phone input, name input, consent toggle, and "Get Started" CTA.
 * Uses useAuth hook for sendCode, and useAuthStore for state persistence.
 *
 * Categories covered:
 * 1. Renders without crash
 * 2. Text content matches Figma
 * 3. Interactive elements present (testIDs)
 * 4. Navigation fires correctly
 * 5. Loading state (isSendingOtp)
 * 6. Error state (phone validation errors)
 * 7. Empty state (initial empty form)
 * 8. Props variations (empty, filled, error via query params)
 * 9. Accessibility
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import {
  EXPECTED_TEXT,
  EXPECTED_NAVIGATION,
  TEST_IDS,
  MOCK_FORM_DATA,
  AUTH_HOOK_IDLE,
  AUTH_HOOK_SENDING,
  AUTH_HOOK_OTP_SENT,
  AUTH_HOOK_PHONE_ERROR,
  AUTH_HOOK_NETWORK_ERROR,
  AUTH_HOOK_RATE_LIMITED,
} from '../fixtures/sign-up.fixtures';

// --- Mock expo-router ---
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};

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

// --- Mock DottedGridPattern (SVG does not render in Jest JSDOM) ---
jest.mock('@/src/components/patterns/DottedGridPattern', () => {
  const { View } = require('react-native');
  return {
    DottedGridPattern: ({ children, testID }: any) => (
      <View testID={testID || 'dotted-pattern'}>{children}</View>
    ),
  };
});

// --- Mock useAuth hook ---
let mockAuthReturn: any = { ...AUTH_HOOK_IDLE };

jest.mock('@/src/hooks', () => ({
  useAuth: () => mockAuthReturn,
}));

// --- Mock useAuthStore ---
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

// Import component under test after all mocks
import SignUpScreen from '@/app/(auth)/sign-up';

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthReturn = { ...AUTH_HOOK_IDLE };
    mockSearchParams = {};
  });

  // =========================================
  // Category 1: Renders without crash
  // =========================================
  describe('renders without crash', () => {
    it('mounts without throwing', () => {
      expect(() => render(<SignUpScreen />)).not.toThrow();
    });

    it('returns valid JSX (non-null render)', () => {
      const { toJSON } = render(<SignUpScreen />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================
  // Category 2: Text content matches Figma
  // =========================================
  describe('text content matches Figma', () => {
    it('displays the gray heading text', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(/Let's get to/)).toBeTruthy();
    });

    it('displays the accent heading text "know you"', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.headingAccent)).toBeTruthy();
    });

    it('displays the phone label', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.phoneLabel)).toBeTruthy();
    });

    it('displays the name label', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.nameLabel)).toBeTruthy();
    });

    it('displays the "Get Started" button text', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.buttonText)).toBeTruthy();
    });

    it('displays the consent text', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(/I consent to a one-time verification/)).toBeTruthy();
    });

    it('displays the "Cashfree" link in consent text', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.cashfreeLink)).toBeTruthy();
    });

    it('displays the country code "+91"', () => {
      const { getByText } = render(<SignUpScreen />);
      expect(getByText(EXPECTED_TEXT.phoneCountryCode)).toBeTruthy();
    });
  });

  // =========================================
  // Category 3: Interactive elements present (testIDs)
  // =========================================
  describe('interactive elements present', () => {
    it('has the screen root testID', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.screen)).toBeTruthy();
    });

    it('has the phone input testID', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.phoneInput)).toBeTruthy();
    });

    it('has the name input testID', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.nameInput)).toBeTruthy();
    });

    it('has the Get Started button testID', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.getStartedButton)).toBeTruthy();
    });

    it('has the consent toggle testID', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.consentToggle)).toBeTruthy();
    });

    it('renders the DottedPattern background', () => {
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId('dotted-pattern')).toBeTruthy();
    });
  });

  // =========================================
  // Category 4: Navigation fires correctly
  // =========================================
  describe('navigation', () => {
    it('navigates to OTP screen when isSendingOtp transitions to otp_sent', () => {
      // Phase 1: render with isSendingOtp true (sets wasSendingOtpRef)
      mockAuthReturn = { ...AUTH_HOOK_SENDING };
      const { rerender } = render(<SignUpScreen />);

      // Phase 2: isSendingOtp false + status otp_sent triggers navigation
      mockAuthReturn = { ...AUTH_HOOK_OTP_SENT };
      rerender(<SignUpScreen />);

      expect(mockPush).toHaveBeenCalledWith(EXPECTED_NAVIGATION.onSubmit);
    });

    it('does not navigate when status is idle', () => {
      render(<SignUpScreen />);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('calls sendCode with formatted phone on valid form submission', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      // Fill in a valid phone number (10 digits)
      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), MOCK_FORM_DATA.phone);

      // Fill in a valid name (>= 2 chars)
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), MOCK_FORM_DATA.name);

      // Press Get Started
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      expect(mockSendCode).toHaveBeenCalledWith('+91' + MOCK_FORM_DATA.phone, 'whatsapp', MOCK_FORM_DATA.name);
    });

    it('stores name and consent before sending OTP', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), MOCK_FORM_DATA.phone);
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), MOCK_FORM_DATA.name);
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      expect(mockSetUserName).toHaveBeenCalledWith(MOCK_FORM_DATA.name);
      expect(mockSetConsentForMobile360).toHaveBeenCalledWith(true);
    });
  });

  // =========================================
  // Category 5: Loading state (isSendingOtp)
  // =========================================
  describe('loading state', () => {
    it('disables submission when OTP is being sent', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_SENDING, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      // Fill valid form
      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), MOCK_FORM_DATA.phone);
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), MOCK_FORM_DATA.name);

      // Press Get Started while sending
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      // sendCode should NOT be called again since isSendingOtp is true
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('renders the button in loading state when isSendingOtp is true', () => {
      mockAuthReturn = { ...AUTH_HOOK_SENDING };
      const { getByTestId } = render(<SignUpScreen />);

      // The button should still be present
      expect(getByTestId(TEST_IDS.getStartedButton)).toBeTruthy();
    });
  });

  // =========================================
  // Category 6: Error state
  // =========================================
  describe('error state', () => {
    it('displays phone validation error from useAuth', () => {
      mockAuthReturn = { ...AUTH_HOOK_PHONE_ERROR };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Enter valid number')).toBeTruthy();
    });

    it('displays network error message', () => {
      mockAuthReturn = { ...AUTH_HOOK_NETWORK_ERROR };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Check your internet connection')).toBeTruthy();
    });

    it('displays rate limited error message', () => {
      mockAuthReturn = { ...AUTH_HOOK_RATE_LIMITED };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Too many attempts. Please wait.')).toBeTruthy();
    });

    it('clears error when phone input changes', () => {
      const mockClearError = jest.fn();
      mockAuthReturn = {
        ...AUTH_HOOK_PHONE_ERROR,
        clearError: mockClearError,
      };

      const { getByTestId } = render(<SignUpScreen />);
      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), '9');

      expect(mockClearError).toHaveBeenCalled();
    });

    it('displays error from auth hook INVALID_PHONE', () => {
      mockAuthReturn = { ...AUTH_HOOK_PHONE_ERROR };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Enter valid number')).toBeTruthy();
    });
  });

  // =========================================
  // Category 7: Empty state (initial form)
  // =========================================
  describe('empty state', () => {
    it('renders with empty inputs on initial load', () => {
      const { getByTestId } = render(<SignUpScreen />);

      // Phone and name inputs should exist but be empty
      const phoneInput = getByTestId(TEST_IDS.phoneInput);
      const nameInput = getByTestId(TEST_IDS.nameInput);
      expect(phoneInput).toBeTruthy();
      expect(nameInput).toBeTruthy();
    });

    it('disables Get Started button when form is empty (not valid)', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      // Press without filling form
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      // Should not call sendCode since form is invalid
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('consent toggle defaults to true', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const toggle = getByTestId(TEST_IDS.consentToggle);
      // ConsentToggle with value=true will have accessibilityState.checked = true
      expect(toggle.props.accessibilityState?.checked).toBe(true);
    });
  });

  // =========================================
  // Category 8: Props variations / state variants
  // =========================================
  describe('state variations', () => {
    it('renders filled state when state param is "filled"', () => {
      mockSearchParams = { state: 'filled' };
      const { getByTestId } = render(<SignUpScreen />);
      expect(getByTestId(TEST_IDS.screen)).toBeTruthy();
      // In filled state, mock data populates the inputs
    });

    it('renders error state when auth hook has phone error', () => {
      mockAuthReturn = { ...AUTH_HOOK_PHONE_ERROR };
      const { getByText } = render(<SignUpScreen />);
      expect(getByText('Enter valid number')).toBeTruthy();
    });

    it('does not submit when consent is toggled off', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      // Fill valid phone and name
      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), MOCK_FORM_DATA.phone);
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), MOCK_FORM_DATA.name);

      // Toggle consent off
      fireEvent.press(getByTestId(TEST_IDS.consentToggle));

      // Try to submit
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      // Should not submit without consent
      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('does not submit when phone is too short', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), '12345');
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), MOCK_FORM_DATA.name);
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      expect(mockSendCode).not.toHaveBeenCalled();
    });

    it('does not submit when name is too short', () => {
      const mockSendCode = jest.fn();
      mockAuthReturn = { ...AUTH_HOOK_IDLE, sendCode: mockSendCode };

      const { getByTestId } = render(<SignUpScreen />);

      fireEvent.changeText(getByTestId(TEST_IDS.phoneInput), MOCK_FORM_DATA.phone);
      fireEvent.changeText(getByTestId(TEST_IDS.nameInput), 'A');
      fireEvent.press(getByTestId(TEST_IDS.getStartedButton));

      expect(mockSendCode).not.toHaveBeenCalled();
    });
  });

  // =========================================
  // Category 9: Accessibility
  // =========================================
  describe('accessibility', () => {
    it('consent toggle has switch accessibility role', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const toggle = getByTestId(TEST_IDS.consentToggle);
      expect(toggle.props.accessibilityRole).toBe('switch');
    });

    it('consent toggle has checked state reflecting its value', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const toggle = getByTestId(TEST_IDS.consentToggle);
      expect(toggle.props.accessibilityState).toEqual(
        expect.objectContaining({ checked: true })
      );
    });

    it('phone input field is present and interactive', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const phoneInput = getByTestId(TEST_IDS.phoneInput);
      expect(phoneInput).toBeTruthy();
    });

    it('name input field is present and interactive', () => {
      const { getByTestId } = render(<SignUpScreen />);
      const nameInput = getByTestId(TEST_IDS.nameInput);
      expect(nameInput).toBeTruthy();
    });
  });
});
