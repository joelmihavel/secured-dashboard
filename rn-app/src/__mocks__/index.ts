/**
 * Mock Data Index
 * Centralized exports for all mock data used in UI testing
 */

// UI Test Data - Main mock data for visual parity testing
export {
  // Types
  type PaymentMethodType,
  type TenancyStatus,
  type PaymentStatusType,
  type WaitlistStateType,
  type AgreementStateType,
  type OTPStateType,
  type SignUpStateType,
  type MockUser,
  type BasePaymentMethod,
  type UPIPaymentMethod,
  type CardPaymentMethod,
  type NetbankingPaymentMethod,
  type PaymentMethod,
  type MockTenancy,
  type MockCashback,
  type MockPayment,
  type WaitlistPendingState,
  type WaitlistAcceptedState,
  type WaitlistRejectedState,
  type AgreementUploadingState,
  type AgreementSuccessState,
  type AgreementErrorState,
  type AgreementManualReviewState,
  type OTPState,
  type SignUpState,
  type PostApprovalStep,
  type MockAgreementDetails,
  // User Data
  MOCK_USER,
  // Payment Methods
  MOCK_PAYMENT_METHODS,
  MOCK_PAYMENT_METHODS_LIST,
  // Tenancy Data
  MOCK_TENANCY,
  // Cashback Data
  MOCK_CASHBACK,
  // Payments
  MOCK_RECENT_PAYMENTS,
  MOCK_PAYMENT_HISTORY,
  // Waitlist States
  MOCK_WAITLIST_STATES,
  // Agreement States
  MOCK_AGREEMENT_STATES,
  MOCK_AGREEMENT_DETAILS,
  // OTP States
  MOCK_OTP_STATES,
  // Sign Up States
  MOCK_SIGNUP_STATES,
  // Post-Approval Steps
  MOCK_POST_APPROVAL_STEPS,
  MOCK_POST_APPROVAL_STEPS_PARTIAL,
  MOCK_POST_APPROVAL_STEPS_COMPLETE,
  // Helper Functions
  getMockStateData,
  formatMockCurrency,
  generateMockPayment,
  getDefaultPaymentMethod,
} from './uiTestData';
