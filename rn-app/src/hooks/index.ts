/**
 * Hooks barrel export
 */

// Auth
export { useAuth, useSendOtp, useVerifyOtp, useResendOtp, authKeys } from './useAuth';

// Dashboard
export {
  useDashboard,
  useRefreshDashboard,
  useVerificationStatus,
  useCashback,
  dashboardKeys,
} from './useDashboard';

// Payments
export {
  usePaymentHistory,
  useSavedPaymentMethods,
  usePaymentMethods,
  useInitiatePayment,
  useAddUpiVpa,
  useAddPaymentMethod,
  useVerifyUpi,
  useDeletePaymentMethod,
  useGenerateReceipt,
  usePayments,
  paymentKeys,
} from './usePayments';

// Profile
export { useUpdateProfile } from './useProfile';

// Setup
export {
  useVerifyBank,
  useVerifyUtility,
  useUtilityOperators,
  useSendLandlordInvite,
  useResendLandlordInvite,
  useSetupProgress,
  setupQueryKeys,
  validateAccountNumber,
  validateIfscCode,
  validatePhoneNumber,
  validateEmail,
  formatAccountNumber,
  formatPhoneNumber,
} from './useSetup';

// Waitlist
export {
  useWaitlist,
  useWaitlistStatus,
  useApplyReferral,
  useValidateReferral,
  waitlistKeys,
} from './useWaitlist';
