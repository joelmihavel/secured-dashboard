/**
 * UI Test Mock Data
 * Centralized mock data for visual parity testing
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type PaymentMethodType = 'upi' | 'card' | 'netbanking';
export type TenancyStatus = 'active' | 'pending' | 'expired';
export type PaymentStatusType = 'success' | 'pending' | 'failed';
export type WaitlistStateType = 'pending' | 'pending_long' | 'accepted' | 'rejected';
export type AgreementStateType = 'idle' | 'uploading' | 'success' | 'expired' | 'too_large' | 'manual_review';
export type OTPStateType = 'empty' | 'filled' | 'error1' | 'error2';
export type SignUpStateType = 'empty' | 'filled' | 'error';

export interface MockUser {
  name: string;
  phone: string;
  avatar: string | null;
}

export interface BasePaymentMethod {
  id: string;
  isDefault: boolean;
}

export interface UPIPaymentMethod extends BasePaymentMethod {
  type: 'upi';
  vpa: string;
  bankName: string;
}

export interface CardPaymentMethod extends BasePaymentMethod {
  type: 'card';
  lastFour: string;
  brand: string;
  expiry: string;
}

export interface NetbankingPaymentMethod extends BasePaymentMethod {
  type: 'netbanking';
  bankName: string;
  bankCode: string;
}

export type PaymentMethod = UPIPaymentMethod | CardPaymentMethod | NetbankingPaymentMethod;

export interface MockTenancy {
  id: string;
  monthlyRent: number;
  landlordName: string;
  address: string;
  dueDate: number;
  status: TenancyStatus;
}

export interface MockCashback {
  available: number;
  allTimeTotal: number;
  rate: number;
}

export interface MockPayment {
  id: string;
  month: string;
  amount: number;
  status: PaymentStatusType;
  date: string;
}

export interface WaitlistPendingState {
  position: number;
  estimatedDays: number;
  hoursWaiting?: number;
}

export interface WaitlistAcceptedState {
  approvedAt: string;
}

export interface WaitlistRejectedState {
  reason: string;
  rejectedAt: string;
}

export interface AgreementUploadingState {
  progress: number;
  fileName: string;
}

export interface AgreementSuccessState {
  fileName: string;
  fileSize: string;
}

export interface AgreementErrorState {
  error: string;
}

export interface AgreementManualReviewState {
  message: string;
}

export interface OTPState {
  digits: string[];
  error?: string;
}

export interface SignUpState {
  phone: string;
  error?: string;
}

export interface PostApprovalStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface MockAgreementDetails {
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate: string;
  rentDueDay: number;
}

// ============================================================================
// User Data
// ============================================================================

export const MOCK_USER: MockUser = {
  name: 'Rishabh',
  phone: '+91 98765 43210',
  avatar: null,
};

// ============================================================================
// Payment Methods
// ============================================================================

export const MOCK_PAYMENT_METHODS: {
  upi: UPIPaymentMethod;
  card: CardPaymentMethod;
  netbanking: NetbankingPaymentMethod;
} = {
  upi: {
    id: 'upi_1',
    type: 'upi' as const,
    vpa: 'rishabh@okicici',
    bankName: 'ICICI Bank',
    isDefault: true,
  },
  card: {
    id: 'card_1',
    type: 'card' as const,
    lastFour: '2341',
    brand: 'Visa',
    expiry: '06/26',
    isDefault: false,
  },
  netbanking: {
    id: 'nb_1',
    type: 'netbanking' as const,
    bankName: 'HDFC Bank',
    bankCode: 'HDFC',
    isDefault: false,
  },
};

// All payment methods as array
export const MOCK_PAYMENT_METHODS_LIST: PaymentMethod[] = [
  MOCK_PAYMENT_METHODS.upi,
  MOCK_PAYMENT_METHODS.card,
  MOCK_PAYMENT_METHODS.netbanking,
];

// ============================================================================
// Tenancy Data
// ============================================================================

export const MOCK_TENANCY: MockTenancy = {
  id: 'tenancy_1',
  monthlyRent: 32500,
  landlordName: 'Lorem Ipsum Dolor Et',
  address: '123 Main Street, Bangalore',
  dueDate: 10, // Day of month
  status: 'active' as const,
};

// ============================================================================
// Cashback Data
// ============================================================================

export const MOCK_CASHBACK: MockCashback = {
  available: 325,
  allTimeTotal: 1250,
  rate: 0.008, // 0.8%
};

// ============================================================================
// Recent Payments
// ============================================================================

export const MOCK_RECENT_PAYMENTS: MockPayment[] = [
  { id: '1', month: 'Dec 2025', amount: 32500, status: 'success', date: '2025-12-05' },
  { id: '2', month: 'Nov 2025', amount: 32500, status: 'success', date: '2025-11-05' },
  { id: '3', month: 'Oct 2025', amount: 32500, status: 'success', date: '2025-10-05' },
];

// Extended payment history for transaction views
export const MOCK_PAYMENT_HISTORY: MockPayment[] = [
  ...MOCK_RECENT_PAYMENTS,
  { id: '4', month: 'Sep 2025', amount: 32500, status: 'success', date: '2025-09-05' },
  { id: '5', month: 'Aug 2025', amount: 32500, status: 'success', date: '2025-08-05' },
  { id: '6', month: 'Jul 2025', amount: 32500, status: 'success', date: '2025-07-05' },
];

// ============================================================================
// Waitlist States
// ============================================================================

export const MOCK_WAITLIST_STATES: {
  pending: WaitlistPendingState;
  pending_long: WaitlistPendingState;
  accepted: WaitlistAcceptedState;
  rejected: WaitlistRejectedState;
} = {
  pending: { position: 847, estimatedDays: 3 },
  pending_long: { position: 847, estimatedDays: 5, hoursWaiting: 48 },
  accepted: { approvedAt: new Date().toISOString() },
  rejected: { reason: 'Document verification failed', rejectedAt: new Date().toISOString() },
};

// ============================================================================
// Agreement States
// ============================================================================

export const MOCK_AGREEMENT_STATES: {
  idle: Record<string, never>;
  uploading: AgreementUploadingState;
  success: AgreementSuccessState;
  expired: AgreementErrorState;
  too_large: AgreementErrorState;
  manual_review: AgreementManualReviewState;
} = {
  idle: {},
  uploading: { progress: 45, fileName: 'Agreement_Dec2025.pdf' },
  success: { fileName: 'Joel_Ramesh-Agreement_Dec 2025.pdf', fileSize: '2.4 MB' },
  expired: { error: 'The agreement is invalid or expired. Please upload a valid one.' },
  too_large: { error: 'File size exceeds 10MB limit.' },
  manual_review: { message: 'Your agreement is being reviewed manually. This may take 24-48 hours.' },
};

// ============================================================================
// Agreement Details for Review
// ============================================================================

export const MOCK_AGREEMENT_DETAILS: MockAgreementDetails = {
  tenantName: 'Joel Ramesh',
  landlordName: 'Lorem Ipsum',
  propertyAddress: '123 Main Street, Indiranagar, Bangalore 560038',
  monthlyRent: 32500,
  securityDeposit: 97500,
  startDate: '2025-01-01',
  endDate: '2026-12-31',
  rentDueDay: 5,
};

// ============================================================================
// OTP States
// ============================================================================

export const MOCK_OTP_STATES: {
  empty: OTPState;
  filled: OTPState;
  error1: OTPState;
  error2: OTPState;
} = {
  empty: { digits: ['', '', '', '', '', ''] },
  filled: { digits: ['1', '2', '3', '4', '5', '6'] },
  error1: { digits: ['1', '2', '3', '4', '5', '6'], error: 'Invalid OTP. Please try again.' },
  error2: { digits: ['1', '2', '3', '4', '5', '6'], error: 'OTP expired. Request a new one.' },
};

// ============================================================================
// Sign Up States
// ============================================================================

export const MOCK_SIGNUP_STATES: {
  empty: SignUpState;
  filled: SignUpState;
  error: SignUpState;
} = {
  empty: { phone: '' },
  filled: { phone: '9876543210' },
  error: { phone: '9876543210', error: 'This number is already registered.' },
};

// ============================================================================
// Post-Approval Steps
// ============================================================================

export const MOCK_POST_APPROVAL_STEPS: PostApprovalStep[] = [
  { id: 1, title: 'Add your bank account', description: 'For rent payments', completed: false },
  { id: 2, title: 'Add utility account', description: 'BESCOM number', completed: false },
  { id: 3, title: 'Invite your landlord', description: 'To receive payments', completed: false },
];

// Steps with partial completion
export const MOCK_POST_APPROVAL_STEPS_PARTIAL: PostApprovalStep[] = [
  { id: 1, title: 'Add your bank account', description: 'For rent payments', completed: true },
  { id: 2, title: 'Add utility account', description: 'BESCOM number', completed: false },
  { id: 3, title: 'Invite your landlord', description: 'To receive payments', completed: false },
];

// Steps with all completed
export const MOCK_POST_APPROVAL_STEPS_COMPLETE: PostApprovalStep[] = [
  { id: 1, title: 'Add your bank account', description: 'For rent payments', completed: true },
  { id: 2, title: 'Add utility account', description: 'BESCOM number', completed: true },
  { id: 3, title: 'Invite your landlord', description: 'To receive payments', completed: true },
];

// ============================================================================
// Error & API Response Types
// ============================================================================

export type HttpStatusCode = 400 | 401 | 403 | 404 | 408 | 429 | 500 | 502 | 503;

export interface MockApiError {
  status: HttpStatusCode;
  code: string;
  message: string;
  retryable: boolean;
}

export interface MockNetworkError {
  type: 'timeout' | 'network_offline' | 'dns_failure' | 'connection_reset';
  message: string;
}

export interface MockLoadingState {
  screen: string;
  isLoading: boolean;
  hasData: boolean;
  skeletonCount: number;
}

// ============================================================================
// API Error Responses
// ============================================================================

export const MOCK_API_ERRORS: Record<string, MockApiError> = {
  bad_request: {
    status: 400,
    code: 'BAD_REQUEST',
    message: 'Invalid request parameters',
    retryable: false,
  },
  unauthorized: {
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'Session expired. Please sign in again.',
    retryable: false,
  },
  forbidden: {
    status: 403,
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    retryable: false,
  },
  not_found: {
    status: 404,
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    retryable: false,
  },
  request_timeout: {
    status: 408,
    code: 'REQUEST_TIMEOUT',
    message: 'The request timed out. Please try again.',
    retryable: true,
  },
  rate_limited: {
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a moment and try again.',
    retryable: true,
  },
  server_error: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong on our end. Please try again later.',
    retryable: true,
  },
  bad_gateway: {
    status: 502,
    code: 'BAD_GATEWAY',
    message: 'Service temporarily unavailable. Please try again.',
    retryable: true,
  },
  service_unavailable: {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service is under maintenance. Please try again later.',
    retryable: true,
  },
};

// ============================================================================
// Network Error States
// ============================================================================

export const MOCK_NETWORK_ERRORS: Record<string, MockNetworkError> = {
  timeout: {
    type: 'timeout',
    message: 'Request timed out. Please check your connection and try again.',
  },
  offline: {
    type: 'network_offline',
    message: 'No internet connection. Please check your network settings.',
  },
  dns_failure: {
    type: 'dns_failure',
    message: 'Unable to reach the server. Please try again later.',
  },
  connection_reset: {
    type: 'connection_reset',
    message: 'Connection was reset. Please try again.',
  },
};

// ============================================================================
// Empty States
// ============================================================================

export const MOCK_EMPTY_PAYMENTS: MockPayment[] = [];

export const MOCK_EMPTY_PAYMENT_METHODS: PaymentMethod[] = [];

export const MOCK_EMPTY_CASHBACK: MockCashback = {
  available: 0,
  allTimeTotal: 0,
  rate: 0,
};

export const MOCK_EMPTY_AGREEMENT_DETAILS: MockAgreementDetails = {
  tenantName: '',
  landlordName: '',
  propertyAddress: '',
  monthlyRent: 0,
  securityDeposit: 0,
  startDate: '',
  endDate: '',
  rentDueDay: 0,
};

export const MOCK_EMPTY_POST_APPROVAL_STEPS: PostApprovalStep[] = [];

export interface MockNotification {
  id: string;
  title: string;
  body: string;
  route: string;
  read: boolean;
  createdAt: string;
}

export const MOCK_EMPTY_NOTIFICATIONS: MockNotification[] = [];

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'notif_1',
    title: 'Rent payment successful',
    body: 'Your rent of Rs 32,500 for Dec 2025 has been paid.',
    route: '/(payment)/status',
    read: false,
    createdAt: '2025-12-05T10:30:00Z',
  },
  {
    id: 'notif_2',
    title: 'Cashback earned!',
    body: 'You earned Rs 260 cashback on your rent payment.',
    route: '/(main)',
    read: true,
    createdAt: '2025-12-05T10:31:00Z',
  },
  {
    id: 'notif_3',
    title: 'Rent due reminder',
    body: 'Your rent of Rs 32,500 is due in 3 days.',
    route: '/(payment)/confirm',
    read: false,
    createdAt: '2025-12-07T09:00:00Z',
  },
];

// ============================================================================
// Edge Case: Users
// ============================================================================

/** User with an extremely long name (tests truncation/layout) */
export const MOCK_USER_LONG_NAME: MockUser = {
  name: 'Venkatanarasimharajuvaripeta Subrahmanyam Raghavendra Krishnamurthy',
  phone: '+91 98765 43210',
  avatar: null,
};

/** User with special characters in name */
export const MOCK_USER_SPECIAL_CHARS: MockUser = {
  name: "O'Brien-Smith (Jr.)",
  phone: '+91 98765 43210',
  avatar: null,
};

/** User with no phone number (partial signup) */
export const MOCK_USER_NO_PHONE: MockUser = {
  name: 'Rishabh',
  phone: '',
  avatar: null,
};

/** User with single character name */
export const MOCK_USER_SINGLE_CHAR: MockUser = {
  name: 'R',
  phone: '+91 98765 43210',
  avatar: null,
};

/** User with Unicode/emoji in name */
export const MOCK_USER_UNICODE: MockUser = {
  name: 'Rishabh \u00C9',
  phone: '+91 98765 43210',
  avatar: null,
};

// ============================================================================
// Edge Case: Tenancy
// ============================================================================

/** Tenancy with zero rent (boundary condition) */
export const MOCK_TENANCY_ZERO_RENT: MockTenancy = {
  id: 'tenancy_zero',
  monthlyRent: 0,
  landlordName: 'Lorem Ipsum Dolor Et',
  address: '123 Main Street, Bangalore',
  dueDate: 10,
  status: 'active' as const,
};

/** Tenancy with very high rent (tests formatting) */
export const MOCK_TENANCY_HIGH_RENT: MockTenancy = {
  id: 'tenancy_high',
  monthlyRent: 9999999,
  landlordName: 'Lorem Ipsum Dolor Et',
  address: '123 Main Street, Bangalore',
  dueDate: 10,
  status: 'active' as const,
};

/** Tenancy with expired status */
export const MOCK_TENANCY_EXPIRED: MockTenancy = {
  id: 'tenancy_expired',
  monthlyRent: 32500,
  landlordName: 'Lorem Ipsum Dolor Et',
  address: '123 Main Street, Bangalore',
  dueDate: 10,
  status: 'expired' as const,
};

/** Tenancy with pending status */
export const MOCK_TENANCY_PENDING: MockTenancy = {
  id: 'tenancy_pending',
  monthlyRent: 32500,
  landlordName: 'Lorem Ipsum Dolor Et',
  address: '123 Main Street, Bangalore',
  dueDate: 10,
  status: 'pending' as const,
};

/** Tenancy with very long address */
export const MOCK_TENANCY_LONG_ADDRESS: MockTenancy = {
  id: 'tenancy_long',
  monthlyRent: 32500,
  landlordName: 'Venkatanarasimharajuvaripeta Subrahmanyam',
  address: 'Flat 1206, Tower B, Prestige Lakeside Habitat, Varthur Main Road, Gunjur Village, Varthur Hobli, Bangalore East Taluk, Bangalore Urban District, Karnataka 560087, India',
  dueDate: 10,
  status: 'active' as const,
};

// ============================================================================
// Edge Case: Cashback
// ============================================================================

/** Negative cashback (reversal scenario) */
export const MOCK_CASHBACK_NEGATIVE: MockCashback = {
  available: -50,
  allTimeTotal: 1200,
  rate: 0.008,
};

/** Very high cashback (tests formatting) */
export const MOCK_CASHBACK_HIGH: MockCashback = {
  available: 99999,
  allTimeTotal: 250000,
  rate: 0.02,
};

/** Cashback at zero rate */
export const MOCK_CASHBACK_ZERO_RATE: MockCashback = {
  available: 500,
  allTimeTotal: 500,
  rate: 0,
};

// ============================================================================
// Edge Case: Payments
// ============================================================================

/** Payment with failed status */
export const MOCK_PAYMENT_FAILED: MockPayment = {
  id: 'pay_failed_1',
  month: 'Jan 2026',
  amount: 32500,
  status: 'failed' as const,
  date: '2026-01-05',
};

/** Payment with pending status */
export const MOCK_PAYMENT_PENDING: MockPayment = {
  id: 'pay_pending_1',
  month: 'Jan 2026',
  amount: 32500,
  status: 'pending' as const,
  date: '2026-01-05',
};

/** Payment with zero amount (boundary) */
export const MOCK_PAYMENT_ZERO: MockPayment = {
  id: 'pay_zero_1',
  month: 'Jan 2026',
  amount: 0,
  status: 'success' as const,
  date: '2026-01-05',
};

/** Payment history with mixed statuses */
export const MOCK_PAYMENT_HISTORY_MIXED: MockPayment[] = [
  { id: 'mix_1', month: 'Jan 2026', amount: 32500, status: 'failed', date: '2026-01-05' },
  { id: 'mix_2', month: 'Dec 2025', amount: 32500, status: 'success', date: '2025-12-05' },
  { id: 'mix_3', month: 'Nov 2025', amount: 32500, status: 'pending', date: '2025-11-05' },
  { id: 'mix_4', month: 'Oct 2025', amount: 32500, status: 'success', date: '2025-10-05' },
  { id: 'mix_5', month: 'Sep 2025', amount: 32500, status: 'failed', date: '2025-09-05' },
];

/** Refunded payment */
export const MOCK_PAYMENT_REFUNDED: MockPayment & { refundedAt: string; refundReason: string } = {
  id: 'pay_refund_1',
  month: 'Dec 2025',
  amount: 32500,
  status: 'success' as const,
  date: '2025-12-05',
  refundedAt: '2025-12-08T14:30:00Z',
  refundReason: 'Duplicate payment processed',
};

// ============================================================================
// Edge Case: Payment Methods
// ============================================================================

/** Expired card */
export const MOCK_PAYMENT_METHOD_EXPIRED_CARD: CardPaymentMethod = {
  id: 'card_expired',
  type: 'card' as const,
  lastFour: '9876',
  brand: 'Mastercard',
  expiry: '01/24',
  isDefault: false,
};

/** Card with very long bank name */
export const MOCK_PAYMENT_METHOD_LONG_BANK: NetbankingPaymentMethod = {
  id: 'nb_long',
  type: 'netbanking' as const,
  bankName: 'State Bank of Hyderabad (Merged with State Bank of India)',
  bankCode: 'SBH',
  isDefault: false,
};

/** UPI with special characters in VPA */
export const MOCK_PAYMENT_METHOD_SPECIAL_UPI: UPIPaymentMethod = {
  id: 'upi_special',
  type: 'upi' as const,
  vpa: 'rishabh.kumar-2@okaxis',
  bankName: 'Axis Bank',
  isDefault: false,
};

// ============================================================================
// Edge Case: Agreement Details
// ============================================================================

/** Agreement with expired dates */
export const MOCK_AGREEMENT_DETAILS_EXPIRED: MockAgreementDetails = {
  tenantName: 'Joel Ramesh',
  landlordName: 'Lorem Ipsum',
  propertyAddress: '123 Main Street, Indiranagar, Bangalore 560038',
  monthlyRent: 32500,
  securityDeposit: 97500,
  startDate: '2023-01-01',
  endDate: '2024-01-01',
  rentDueDay: 5,
};

/** Agreement with missing fields (partial data) */
export const MOCK_AGREEMENT_DETAILS_PARTIAL: Partial<MockAgreementDetails> = {
  tenantName: 'Joel Ramesh',
  landlordName: '',
  propertyAddress: '',
  monthlyRent: 32500,
  // securityDeposit, startDate, endDate, rentDueDay intentionally omitted
};

/** Agreement with very high rent */
export const MOCK_AGREEMENT_DETAILS_HIGH_RENT: MockAgreementDetails = {
  tenantName: 'Joel Ramesh',
  landlordName: 'Lorem Ipsum',
  propertyAddress: '123 Main Street, Indiranagar, Bangalore 560038',
  monthlyRent: 5000000,
  securityDeposit: 15000000,
  startDate: '2025-01-01',
  endDate: '2026-12-31',
  rentDueDay: 1,
};

/** Agreement with special characters in names */
export const MOCK_AGREEMENT_DETAILS_SPECIAL_CHARS: MockAgreementDetails = {
  tenantName: "M. O'Brien-Smith (Jr.)",
  landlordName: 'S\u00e9bastien M\u00fcller',
  propertyAddress: 'Flat #12/A, 3rd Cross, 4th Block, Jayanagar, Bangalore - 560011',
  monthlyRent: 32500,
  securityDeposit: 97500,
  startDate: '2025-01-01',
  endDate: '2026-12-31',
  rentDueDay: 5,
};

// ============================================================================
// OTP Edge Cases
// ============================================================================

export const MOCK_OTP_STATES_EXTENDED: {
  expired: OTPState;
  max_attempts: OTPState;
  partial: OTPState;
  rate_limited: OTPState;
} = {
  expired: {
    digits: ['1', '2', '3', '4', '5', '6'],
    error: 'OTP has expired. Please request a new one.',
  },
  max_attempts: {
    digits: ['1', '2', '3', '4', '5', '6'],
    error: 'Maximum verification attempts reached. Please request a new OTP.',
  },
  partial: {
    digits: ['1', '2', '3', '', '', ''],
  },
  rate_limited: {
    digits: ['', '', '', '', '', ''],
    error: 'Too many OTP requests. Please wait 60 seconds before trying again.',
  },
};

// ============================================================================
// Sign Up Edge Cases
// ============================================================================

export const MOCK_SIGNUP_STATES_EXTENDED: {
  invalid_format: SignUpState;
  too_short: SignUpState;
  rate_limited: SignUpState;
  network_error: SignUpState;
  special_chars: SignUpState;
} = {
  invalid_format: {
    phone: 'abcdefghij',
    error: 'Please enter a valid 10-digit mobile number.',
  },
  too_short: {
    phone: '98765',
    error: 'Phone number must be 10 digits.',
  },
  rate_limited: {
    phone: '9876543210',
    error: 'Too many sign-up attempts. Please try again later.',
  },
  network_error: {
    phone: '9876543210',
    error: 'Unable to reach the server. Please check your connection.',
  },
  special_chars: {
    phone: '+91-9876 543210',
    error: 'Please enter only digits without spaces or special characters.',
  },
};

// ============================================================================
// Waitlist Edge Cases
// ============================================================================

export const MOCK_WAITLIST_STATES_EXTENDED: {
  position_zero: WaitlistPendingState;
  position_very_high: WaitlistPendingState;
  rejected_fraud: WaitlistRejectedState;
  rejected_document: WaitlistRejectedState;
} = {
  position_zero: {
    position: 0,
    estimatedDays: 0,
  },
  position_very_high: {
    position: 99999,
    estimatedDays: 365,
    hoursWaiting: 720,
  },
  rejected_fraud: {
    reason: 'Account flagged for suspicious activity. Please contact support.',
    rejectedAt: new Date().toISOString(),
  },
  rejected_document: {
    reason: 'Uploaded document could not be verified. Please upload a valid rental agreement.',
    rejectedAt: new Date().toISOString(),
  },
};

// ============================================================================
// Agreement Upload Edge Cases
// ============================================================================

export const MOCK_AGREEMENT_STATES_EXTENDED: {
  uploading_slow: AgreementUploadingState;
  uploading_almost_done: AgreementUploadingState;
  network_error: AgreementErrorState;
  invalid_file_type: AgreementErrorState;
  ocr_failed: AgreementErrorState;
  processing_timeout: AgreementErrorState;
  server_error: AgreementErrorState;
} = {
  uploading_slow: {
    progress: 12,
    fileName: 'large_agreement_scan.pdf',
  },
  uploading_almost_done: {
    progress: 98,
    fileName: 'Agreement_Dec2025.pdf',
  },
  network_error: {
    error: 'Upload failed. Please check your internet connection and try again.',
  },
  invalid_file_type: {
    error: 'Only PDF files are supported. Please upload a valid PDF document.',
  },
  ocr_failed: {
    error: 'Failed to read the document. The file may be corrupted or password-protected.',
  },
  processing_timeout: {
    error: 'Document processing timed out. Please try uploading again.',
  },
  server_error: {
    error: 'An unexpected error occurred while processing your document. Please try again later.',
  },
};

// ============================================================================
// Loading / Skeleton States
// ============================================================================

export const MOCK_LOADING_STATES: Record<string, MockLoadingState> = {
  dashboard: {
    screen: 'dashboard',
    isLoading: true,
    hasData: false,
    skeletonCount: 4,
  },
  payment_history: {
    screen: 'payment_history',
    isLoading: true,
    hasData: false,
    skeletonCount: 6,
  },
  profile: {
    screen: 'profile',
    isLoading: true,
    hasData: false,
    skeletonCount: 3,
  },
  agreement_review: {
    screen: 'agreement_review',
    isLoading: true,
    hasData: false,
    skeletonCount: 8,
  },
  payment_methods: {
    screen: 'payment_methods',
    isLoading: true,
    hasData: false,
    skeletonCount: 3,
  },
  setup_steps: {
    screen: 'setup_steps',
    isLoading: true,
    hasData: false,
    skeletonCount: 3,
  },
  transactions: {
    screen: 'transactions',
    isLoading: true,
    hasData: false,
    skeletonCount: 10,
  },
  notifications: {
    screen: 'notifications',
    isLoading: true,
    hasData: false,
    skeletonCount: 5,
  },
};

// ============================================================================
// Boundary Condition: Dates
// ============================================================================

/** Due date that has already passed */
export const MOCK_PASSED_DEADLINE = {
  dueDate: '2025-01-01',
  gracePeriodDays: 5,
  lateFee: 500,
  isOverdue: true,
  daysOverdue: 30,
};

/** Due date far in the future */
export const MOCK_FUTURE_DEADLINE = {
  dueDate: '2099-12-31',
  gracePeriodDays: 5,
  lateFee: 0,
  isOverdue: false,
  daysOverdue: 0,
};

/** Due date is today */
export const MOCK_TODAY_DEADLINE = {
  dueDate: new Date().toISOString().split('T')[0],
  gracePeriodDays: 5,
  lateFee: 0,
  isOverdue: false,
  daysOverdue: 0,
};

// ============================================================================
// Payment Flow Error States (store-aligned)
// ============================================================================

export interface MockPaymentFlowError {
  code: string;
  message: string;
  status: 'idle' | 'selecting_method' | 'confirming' | 'processing' | 'success' | 'failed' | 'refunded';
}

export const MOCK_PAYMENT_FLOW_ERRORS: Record<string, MockPaymentFlowError> = {
  already_paid: {
    code: 'ALREADY_PAID',
    message: 'Payment already completed for this month.',
    status: 'failed',
  },
  payment_in_progress: {
    code: 'PAYMENT_IN_PROGRESS',
    message: 'A payment is already being processed. Please wait.',
    status: 'processing',
  },
  bank_not_verified: {
    code: 'BANK_NOT_VERIFIED',
    message: 'Landlord bank account has not been verified yet.',
    status: 'failed',
  },
  invalid_tenancy: {
    code: 'INVALID_TENANCY',
    message: 'Tenancy not found or is no longer active.',
    status: 'failed',
  },
  auth_error: {
    code: 'AUTH_ERROR',
    message: 'Your session has expired. Please sign in again.',
    status: 'failed',
  },
  network_error: {
    code: 'NETWORK_ERROR',
    message: 'Please check your internet connection and try again.',
    status: 'failed',
  },
  gateway_timeout: {
    code: 'GATEWAY_TIMEOUT',
    message: 'Payment gateway timed out. Your payment may still be processing.',
    status: 'processing',
  },
  refund_initiated: {
    code: 'REFUND_INITIATED',
    message: 'Your payment has been refunded. It may take 5-7 business days.',
    status: 'refunded',
  },
  insufficient_balance: {
    code: 'INSUFFICIENT_BALANCE',
    message: 'Insufficient balance in your selected payment method.',
    status: 'failed',
  },
  upi_declined: {
    code: 'UPI_DECLINED',
    message: 'UPI payment was declined by your bank. Please try another method.',
    status: 'failed',
  },
  card_declined: {
    code: 'CARD_DECLINED',
    message: 'Card payment was declined. Please check your card details or try another card.',
    status: 'failed',
  },
};

// ============================================================================
// Setup Flow Error States
// ============================================================================

export interface MockSetupError {
  code: string;
  message: string;
  step: 'bank' | 'utility' | 'landlord';
}

export const MOCK_SETUP_ERRORS: Record<string, MockSetupError> = {
  bank_verification_failed: {
    code: 'VERIFICATION_FAILED',
    message: 'Bank account verification failed. Please check your details.',
    step: 'bank',
  },
  bank_name_mismatch: {
    code: 'NAME_MISMATCH',
    message: 'Account holder name does not match the name on your agreement.',
    step: 'bank',
  },
  ifsc_invalid: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid IFSC code. Please check and try again.',
    step: 'bank',
  },
  utility_not_found: {
    code: 'NOT_FOUND',
    message: 'Consumer number not found for the selected operator.',
    step: 'utility',
  },
  utility_address_mismatch: {
    code: 'ADDRESS_MISMATCH',
    message: 'Utility address does not match the property address on your agreement.',
    step: 'utility',
  },
  landlord_email_failed: {
    code: 'EMAIL_FAILED',
    message: 'Failed to send invitation email. Please verify the email address.',
    step: 'landlord',
  },
  landlord_already_invited: {
    code: 'VALIDATION_ERROR',
    message: 'An invitation has already been sent. Please wait for the landlord to respond.',
    step: 'landlord',
  },
};

// ============================================================================
// Profile Error States
// ============================================================================

export interface MockProfileError {
  code: string;
  message: string;
}

export const MOCK_PROFILE_ERRORS: Record<string, MockProfileError> = {
  save_failed: {
    code: 'SAVE_FAILED',
    message: 'Failed to save profile changes. Please try again.',
  },
  email_invalid: {
    code: 'VALIDATION_ERROR',
    message: 'Please enter a valid email address.',
  },
  name_too_short: {
    code: 'VALIDATION_ERROR',
    message: 'Name must be at least 2 characters.',
  },
  concurrent_edit: {
    code: 'CONFLICT',
    message: 'Your profile was updated elsewhere. Please refresh and try again.',
  },
};

// ============================================================================
// Auth Error States
// ============================================================================

export interface MockAuthError {
  code: string;
  message: string;
}

export const MOCK_AUTH_ERRORS: Record<string, MockAuthError> = {
  invalid_otp: {
    code: 'INVALID_OTP',
    message: 'The OTP you entered is incorrect. Please try again.',
  },
  otp_expired: {
    code: 'OTP_EXPIRED',
    message: 'This OTP has expired. Please request a new one.',
  },
  max_otp_attempts: {
    code: 'MAX_ATTEMPTS',
    message: 'Too many incorrect attempts. Please request a new OTP.',
  },
  phone_blocked: {
    code: 'PHONE_BLOCKED',
    message: 'This phone number has been temporarily blocked. Try again in 24 hours.',
  },
  session_expired: {
    code: 'SESSION_EXPIRED',
    message: 'Your session has expired. Please sign in again.',
  },
  account_disabled: {
    code: 'ACCOUNT_DISABLED',
    message: 'Your account has been disabled. Please contact support.',
  },
};

// ============================================================================
// Partial Data States (Incomplete Profiles / Responses)
// ============================================================================

/** User who started signup but never completed */
export const MOCK_PARTIAL_USER: MockUser & { isIncomplete: boolean } = {
  name: '',
  phone: '+91 98765 43210',
  avatar: null,
  isIncomplete: true,
};

/** Tenancy with no landlord info yet */
export const MOCK_TENANCY_NO_LANDLORD: MockTenancy = {
  id: 'tenancy_no_landlord',
  monthlyRent: 32500,
  landlordName: '',
  address: '123 Main Street, Bangalore',
  dueDate: 10,
  status: 'pending' as const,
};

/** Post-approval steps with some missing descriptions */
export const MOCK_POST_APPROVAL_STEPS_INCOMPLETE: PostApprovalStep[] = [
  { id: 1, title: 'Add your bank account', description: '', completed: true },
  { id: 2, title: '', description: 'BESCOM number', completed: false },
  { id: 3, title: 'Invite your landlord', description: 'To receive payments', completed: false },
];

// ============================================================================
// Maximum Boundary Values
// ============================================================================

export const MOCK_BOUNDARY_VALUES = {
  /** Maximum rent amount in INR (99,99,999) */
  maxRent: 9999999,
  /** Minimum rent amount */
  minRent: 1,
  /** Zero rent */
  zeroRent: 0,
  /** Maximum IFSC length */
  maxIfscLength: 'SBIN0001234',
  /** Maximum account number length (18 digits) */
  maxAccountNumber: '123456789012345678',
  /** Maximum OTP attempts */
  maxOtpAttempts: 5,
  /** Maximum file upload size in bytes (50MB) */
  maxFileSize: 50 * 1024 * 1024,
  /** Maximum VPA length */
  maxVpaLength: 'very.long.username.with.dots-and-dashes-1234567890@okicicibank',
  /** Maximum phone number length with country code */
  maxPhoneLength: '+91 99999 99999',
  /** Rent due day boundaries */
  rentDueDayMin: 1,
  rentDueDayMax: 28,
  /** Cashback rate boundaries */
  cashbackRateMin: 0,
  cashbackRateMax: 0.05,
  /** Security deposit multiplier (typically 2-10x monthly rent) */
  securityDepositMax: 9999999 * 10,
};

// ============================================================================
// Helper Functions
// ============================================================================

type StateMapType = {
  waitlist: typeof MOCK_WAITLIST_STATES;
  agreement: typeof MOCK_AGREEMENT_STATES;
  otp: typeof MOCK_OTP_STATES;
  signup: typeof MOCK_SIGNUP_STATES;
};

/**
 * Helper to get mock state data by screen and state
 */
export function getMockStateData<T extends keyof StateMapType>(
  screen: T,
  state: keyof StateMapType[T]
): StateMapType[T][keyof StateMapType[T]] | Record<string, never> {
  const stateMap: StateMapType = {
    waitlist: MOCK_WAITLIST_STATES,
    agreement: MOCK_AGREEMENT_STATES,
    otp: MOCK_OTP_STATES,
    signup: MOCK_SIGNUP_STATES,
  };

  const screenStates = stateMap[screen];
  if (screenStates && state in screenStates) {
    return screenStates[state as keyof typeof screenStates];
  }
  return {};
}

/**
 * Helper to format currency amounts
 */
export function formatMockCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Helper to generate a mock payment for a specific month
 */
export function generateMockPayment(
  id: string,
  month: string,
  amount: number = MOCK_TENANCY.monthlyRent,
  status: PaymentStatusType = 'success'
): MockPayment {
  return {
    id,
    month,
    amount,
    status,
    date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Helper to get default payment method
 */
export function getDefaultPaymentMethod(): PaymentMethod | undefined {
  return MOCK_PAYMENT_METHODS_LIST.find((method) => method.isDefault);
}

/**
 * Helper to generate a mock API error response
 */
export function generateMockApiError(
  status: HttpStatusCode,
  customMessage?: string
): MockApiError {
  const defaults: Record<HttpStatusCode, { code: string; message: string; retryable: boolean }> = {
    400: { code: 'BAD_REQUEST', message: 'Invalid request', retryable: false },
    401: { code: 'UNAUTHORIZED', message: 'Authentication required', retryable: false },
    403: { code: 'FORBIDDEN', message: 'Access denied', retryable: false },
    404: { code: 'NOT_FOUND', message: 'Resource not found', retryable: false },
    408: { code: 'REQUEST_TIMEOUT', message: 'Request timed out', retryable: true },
    429: { code: 'RATE_LIMITED', message: 'Too many requests', retryable: true },
    500: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error', retryable: true },
    502: { code: 'BAD_GATEWAY', message: 'Bad gateway', retryable: true },
    503: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable', retryable: true },
  };

  const base = defaults[status];
  return {
    status,
    code: base.code,
    message: customMessage ?? base.message,
    retryable: base.retryable,
  };
}

/**
 * Helper to create a mock error for any store's error shape { code, message }
 */
export function createMockStoreError(
  code: string,
  message: string
): { code: string; message: string } {
  return { code, message };
}
