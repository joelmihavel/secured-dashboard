/**
 * Test fixtures for SignUpScreen
 * Source: PM brief 1-29108-pm-brief.json
 * Source: Backend brief 1-29108-backend-brief.json
 * Source: Screen code app/(auth)/sign-up.tsx
 */

// --- Default populated state (filled form matching Figma) ---
export const MOCK_FORM_DATA = {
  phone: '9876543210',
  name: 'Rohan Joshi',
  consent: true,
};

// --- Empty state (initial screen load, no user input) ---
export const EMPTY_FORM_DATA = {
  phone: '',
  name: '',
  consent: true, // consent defaults to true in sign-up.tsx
};

// --- Error state (phone validation error) ---
export const ERROR_STATE = {
  phone: '12345',
  name: '',
  consent: true,
  errorMessage: 'Enter valid number',
};

// --- Text content from PM brief dataFields ---
export const EXPECTED_TEXT = {
  headingGray: "Let's get to",
  headingAccent: 'know you',
  phoneLabel: 'Phone',
  phoneCountryCode: '+91',
  phonePlaceholder: 'Enter Number',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. John Appleseed',
  buttonText: 'Get Started',
  consentText: 'I consent to a one-time verification',
  cashfreeLink: 'Cashfree',
};

// --- Navigation targets ---
export const EXPECTED_NAVIGATION = {
  onSubmit: '/(auth)/otp',
};

// --- testIDs found in screen code ---
export const TEST_IDS = {
  screen: 'sign-up-screen',
  phoneInput: 'phone-input',
  nameInput: 'name-input',
  getStartedButton: 'get-started-button',
  consentToggle: 'consent-toggle',
};

// --- useAuth mock return shapes ---
export const AUTH_HOOK_IDLE = {
  status: 'idle' as const,
  phoneNumber: '',
  userName: '',
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

export const AUTH_HOOK_SENDING = {
  ...AUTH_HOOK_IDLE,
  isSendingOtp: true,
};

export const AUTH_HOOK_OTP_SENT = {
  ...AUTH_HOOK_IDLE,
  status: 'otp_sent' as const,
};

export const AUTH_HOOK_PHONE_ERROR = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'INVALID_PHONE', message: 'Enter valid number' },
};

export const AUTH_HOOK_NETWORK_ERROR = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'NETWORK_ERROR', message: 'Check your internet connection' },
};

export const AUTH_HOOK_RATE_LIMITED = {
  ...AUTH_HOOK_IDLE,
  error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait.' },
};
