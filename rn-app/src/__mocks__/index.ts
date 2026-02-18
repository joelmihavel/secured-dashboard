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
  // Error & Edge-Case Types (MD-129)
  type HttpStatusCode,
  type MockApiError,
  type MockNetworkError,
  type MockLoadingState,
  type MockNotification,
  type MockPaymentFlowError,
  type MockSetupError,
  type MockProfileError,
  type MockAuthError,
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
  // === MD-129: Error & Edge-Case States ===
  // API Error Responses
  MOCK_API_ERRORS,
  // Network Errors
  MOCK_NETWORK_ERRORS,
  // Empty States
  MOCK_EMPTY_PAYMENTS,
  MOCK_EMPTY_PAYMENT_METHODS,
  MOCK_EMPTY_CASHBACK,
  MOCK_EMPTY_AGREEMENT_DETAILS,
  MOCK_EMPTY_POST_APPROVAL_STEPS,
  MOCK_EMPTY_NOTIFICATIONS,
  MOCK_NOTIFICATIONS,
  // Edge Case: Users
  MOCK_USER_LONG_NAME,
  MOCK_USER_SPECIAL_CHARS,
  MOCK_USER_NO_PHONE,
  MOCK_USER_SINGLE_CHAR,
  MOCK_USER_UNICODE,
  // Edge Case: Tenancy
  MOCK_TENANCY_ZERO_RENT,
  MOCK_TENANCY_HIGH_RENT,
  MOCK_TENANCY_EXPIRED,
  MOCK_TENANCY_PENDING,
  MOCK_TENANCY_LONG_ADDRESS,
  // Edge Case: Cashback
  MOCK_CASHBACK_NEGATIVE,
  MOCK_CASHBACK_HIGH,
  MOCK_CASHBACK_ZERO_RATE,
  // Edge Case: Payments
  MOCK_PAYMENT_FAILED,
  MOCK_PAYMENT_PENDING,
  MOCK_PAYMENT_ZERO,
  MOCK_PAYMENT_HISTORY_MIXED,
  MOCK_PAYMENT_REFUNDED,
  // Edge Case: Payment Methods
  MOCK_PAYMENT_METHOD_EXPIRED_CARD,
  MOCK_PAYMENT_METHOD_LONG_BANK,
  MOCK_PAYMENT_METHOD_SPECIAL_UPI,
  // Edge Case: Agreement Details
  MOCK_AGREEMENT_DETAILS_EXPIRED,
  MOCK_AGREEMENT_DETAILS_PARTIAL,
  MOCK_AGREEMENT_DETAILS_HIGH_RENT,
  MOCK_AGREEMENT_DETAILS_SPECIAL_CHARS,
  // OTP Edge Cases
  MOCK_OTP_STATES_EXTENDED,
  // Sign Up Edge Cases
  MOCK_SIGNUP_STATES_EXTENDED,
  // Waitlist Edge Cases
  MOCK_WAITLIST_STATES_EXTENDED,
  // Agreement Upload Edge Cases
  MOCK_AGREEMENT_STATES_EXTENDED,
  // Loading / Skeleton States
  MOCK_LOADING_STATES,
  // Boundary Condition: Dates
  MOCK_PASSED_DEADLINE,
  MOCK_FUTURE_DEADLINE,
  MOCK_TODAY_DEADLINE,
  // Payment Flow Error States
  MOCK_PAYMENT_FLOW_ERRORS,
  // Setup Flow Error States
  MOCK_SETUP_ERRORS,
  // Profile Error States
  MOCK_PROFILE_ERRORS,
  // Auth Error States
  MOCK_AUTH_ERRORS,
  // Partial Data States
  MOCK_PARTIAL_USER,
  MOCK_TENANCY_NO_LANDLORD,
  MOCK_POST_APPROVAL_STEPS_INCOMPLETE,
  // Maximum Boundary Values
  MOCK_BOUNDARY_VALUES,
  // Helper Functions
  getMockStateData,
  formatMockCurrency,
  generateMockPayment,
  getDefaultPaymentMethod,
  generateMockApiError,
  createMockStoreError,
} from './uiTestData';
