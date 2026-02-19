/**
 * Test fixtures for OTPScreen
 * Source: Blueprint 1-31175 (empty), 1-31073 (filled), 1-31277 (error1), 1-31380 (error2)
 * Source: Screen code app/(auth)/otp.tsx
 * Route: /(auth)/otp
 *
 * The OTP screen is a bottom-sheet modal with:
 *   - 6-digit OTP input (two groups of 3 with separator)
 *   - Proceed button
 *   - Resend link
 *   - Dismiss gesture and overlay tap
 *
 * 4 Figma states:
 *   - empty: initial (no digits entered)
 *   - filled: all 6 digits entered (123456)
 *   - error1: wrong code (000000 with "Wrong Code" error)
 *   - error2: too many attempts (000000 with "Too many Attempts" error)
 */

// --- Text content from Figma blueprint 1-31175 ---
export const EXPECTED_TEXT = {
  title: "Let's verify your number",
  subtitle:
    "We\u2019ve sent a 6-digit code to your phone. It\u2019ll auto-verify once entered",
  // The component uses straight quotes, so also match that:
  subtitleStraight:
    "We've sent a 6-digit code to your phone. It'll auto-verify once entered",
  proceedButton: 'Proceed',
  resendPrefix: "Didn't receive the code?",
  resendLink: 'Resend',
  resendSending: 'Sending...',
  // Error messages
  errorWrongCode: 'Wrong Code',
  errorTooManyAttempts: 'Too many Attempts',
  errorCodeExpired: 'Code Expired',
  errorSessionError: 'Session error. Please try again.',
  errorNetworkError: 'Check your connection',
  errorTimeout: 'Request timed out. Try again.',
} as const;

// --- Navigation targets ---
export const EXPECTED_NAVIGATION = {
  onAuthenticated: '/(waitlist)',
  onDismiss: 'back', // router.back()
} as const;

// --- testIDs found in screen code ---
export const TEST_IDS = {
  otpInput: 'otp-input',
  proceedButton: 'proceed-button',
} as const;

// --- Mock OTP data for various states ---
export const MOCK_OTP_DATA = {
  empty: '',
  partial: '123',
  filled: '123456',
  errorCode: '000000',
} as const;

// --- Screen metadata ---
export const SCREEN_METADATA = {
  screenId: '1-31175',
  route: '/(auth)/otp',
  hasDataFetching: true,
  hasLoadingState: true,
  hasErrorState: true,
  hasEmptyState: true,
  states: ['empty', 'filled', 'error1', 'error2'],
  interactiveElements: ['otp-input', 'proceed-button', 'resend-link', 'overlay-dismiss'],
  exitPoints: ['/(waitlist)', 'back'],
} as const;

// --- useAuth mock return shapes for OTP screen ---
export const AUTH_HOOK_IDLE = {
  status: 'otp_sent' as const,
  phoneNumber: '+919876543210',
  userName: 'Rohan Joshi',
  userId: null,
  isNewUser: false,
  error: null,
  sendCode: jest.fn(),
  verifyCode: jest.fn(),
  resendCode: jest.fn(),
  isSendingOtp: false,
  isVerifyingOtp: false,
  isResendingOtp: false,
  clearError: jest.fn(),
  reset: jest.fn(),
  signOut: jest.fn(),
};

export const AUTH_HOOK_VERIFYING = {
  ...AUTH_HOOK_IDLE,
  isVerifyingOtp: true,
};

export const AUTH_HOOK_RESENDING = {
  ...AUTH_HOOK_IDLE,
  isResendingOtp: true,
};

export const AUTH_HOOK_AUTHENTICATED = {
  ...AUTH_HOOK_IDLE,
  status: 'authenticated' as const,
  userId: 'user-123',
  isNewUser: true,
};

export const AUTH_HOOK_INVALID_OTP = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'INVALID_OTP', message: 'Invalid OTP code' },
};

export const AUTH_HOOK_MAX_ATTEMPTS = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'MAX_ATTEMPTS', message: 'Too many attempts' },
};

export const AUTH_HOOK_OTP_EXPIRED = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'OTP_EXPIRED', message: 'OTP has expired' },
};

export const AUTH_HOOK_NETWORK_ERROR = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'NETWORK_ERROR', message: 'Network error' },
};

export const AUTH_HOOK_SESSION_ERROR = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'SESSION_ERROR', message: 'Session invalid' },
};

export const AUTH_HOOK_TIMEOUT = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'TIMEOUT', message: 'Request timed out' },
};
