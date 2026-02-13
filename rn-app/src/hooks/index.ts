/**
 * Hooks barrel export
 */

// Agreement
export {
  useAgreement,
  useUploadAgreement,
  useExtractedData,
  useConfirmExtraction,
  agreementKeys,
} from './useAgreement';

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
  useAddCardToken,
  useAddPaymentMethod,
  useVerifyUpi,
  useDeletePaymentMethod,
  useGenerateReceipt,
  usePayments,
  paymentKeys,
} from './usePayments';

// Profile
export {
  useUpdateProfile,
  useUploadAvatar,
  useProfilePaymentMethods,
  useProfile,
  profileKeys,
} from './useProfile';

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
  validateConsumerNumber,
  formatAccountNumber,
  formatPhoneNumber,
  deriveSetupProgress,
} from './useSetup';

// Auth Guard
export { useRequireAuth } from './useRequireAuth';

// Waitlist
export {
  useWaitlist,
  useWaitlistStatus,
  useApplyReferral,
  useValidateReferral,
  waitlistKeys,
} from './useWaitlist';
