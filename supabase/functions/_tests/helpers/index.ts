/**
 * Flent Secured v2 - Test Helpers Index
 *
 * Central export for all test utilities and mocks.
 * Import from this file in your tests for convenience.
 */

// =============================================================================
// Supabase Test Client
// =============================================================================
export {
  createServiceClient,
  createAnonClient,
  createAuthenticatedClient,
  callEdgeFunction,
  callEdgeFunctionForm,
  TEST_USERS,
  TEST_TENANCIES,
  TEST_PAYMENTS,
} from "./test-client.ts";

// =============================================================================
// PayU Mocks
// =============================================================================
export {
  PAYU_SANDBOX,
  PAYU_TEST_CARDS,
  PAYU_TEST_UPI,
  createMockPayUWebhook,
  createMockPayUInitResponse,
  calculatePayURequestHash,
  calculatePayUResponseHash,
  calculatePayUVerifyHash,
  verifyPayUWebhookHash,
  PayUTestScenarios,
  sha512Async,
} from "./mock-payu.ts";

// =============================================================================
// Cashfree Mocks
// =============================================================================
export {
  CASHFREE_SANDBOX,
  CASHFREE_TEST_ACCOUNTS,
  CASHFREE_TEST_PHONES,
  createMockPennyDropSuccess,
  createMockPennyDropFailure,
  createMockPennyDropIndeterminate,
  createMockMobile360OtpSent,
  createMockMobile360OtpFailed,
  createMockMobile360Success,
  createMockMobile360Failure,
  getCashfreeHeaders,
  CashfreeTestScenarios,
  calculateNameMatch,
} from "./mock-cashfree.ts";

// =============================================================================
// Twilio Mocks
// =============================================================================
export {
  TWILIO_CONFIG,
  TWILIO_TEST_PHONES,
  createMockVerificationStart,
  createMockVerificationCheck,
  TwilioErrors,
  createMockWhatsAppMessage,
  getTwilioAuthHeader,
  TwilioTestScenarios,
  isValidOtpFormat,
  isTestOtp,
} from "./mock-twilio.ts";

// =============================================================================
// API Club Mocks (Electricity Bill Verification)
// =============================================================================
export {
  API_CLUB_SANDBOX,
  API_CLUB_TEST_DATA,
  createMockOperatorListSuccess,
  createMockOperatorListSuccessArray,
  createMockBillFetchSuccess,
  createMockBillFetchWithDetails,
  createMockBillFetchFailure,
  createMockBillFetchInvalidConsumer,
  createMockBillFetchInvalidOperator,
  createMockBillFetchServiceUnavailable,
  ApiClubTestScenarios,
  getApiClubHeaders,
  TEST_VERIFICATION_DATA,
} from "./mock-apiclub.ts";

// =============================================================================
// Test Utilities
// =============================================================================
export {
  cleanupTestData,
  assertStatus,
  assertResponseContains,
  waitFor,
} from "./test-client.ts";
