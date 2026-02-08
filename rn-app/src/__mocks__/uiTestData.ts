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
