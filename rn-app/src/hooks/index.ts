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
  useInitiatePayment,
  useGenerateReceipt,
  usePaymentStamps,
  usePaymentSchedules,
  useCreateSchedule,
  useManageSchedule,
  useSavingsHistory,
  useFeeRates,
  useBankList,
  paymentKeys,
} from './usePayments';

// Profile
export {
  useUpdateProfile,
  useDeleteAccount,
  useProfilePaymentMethods,
  useProfile,
  profileKeys,
} from './useProfile';

// Setup
export {
  useVerifyBank,
  useVerifyUpiVpa,
  validateUpiVpa,
  useVerifyPan,
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

// Identity
export { useIdentityFetch } from './useIdentityVerification';

// Auth Guard
export { useRequireAuth } from './useRequireAuth';

// Setup Guard
export { useSetupGuard } from './useSetupGuard';
export type { SetupGuardResult } from './useSetupGuard';

// Session Monitor
export { useSessionMonitor } from './useSessionMonitor';

// Network Status (ST-105)
export {
  useNetworkStatus,
  queueMutation,
  getQueueLength,
  clearMutationQueue,
  getNetworkStatus,
} from './useNetworkStatus';
export type { NetworkStatus, QueuedMutation } from './useNetworkStatus';

// Optimistic Updates (ST-106)
export {
  useOptimisticPaymentMethod,
  useOptimisticProfile,
  useOptimisticNotification,
} from './useOptimistic';

// Deep Links (ST-107)
export {
  useDeepLink,
  useDeepLinkParams,
  resolveDeepLink,
  handleDeepLinkUrl,
  consumeDeepLinkParams,
  peekDeepLinkParams,
} from './useDeepLink';

// Analytics (PR-112)
export { useAnalytics, useScreenAnalytics } from './useAnalytics';

// Notifications
export {
  useNotificationPreferences,
  notificationKeys,
} from './useNotifications';

// Error Navigation
export { useErrorNavigation } from './useErrorNavigation';

// Payment Recovery (Phase 4.8 - crash recovery)
export { usePaymentRecovery } from './usePaymentRecovery';

// Payment Flow (Core SDK orchestration)
export { usePaymentFlow } from './usePaymentFlow';
export type { PaymentFlowOutcome } from './usePaymentFlow';

// Extraction Status (background-aware agreement processing)
export { useExtractionStatus } from './useExtractionStatus';
export type { UseExtractionStatusReturn } from './useExtractionStatus';

// Realtime Query
export { useRealtimeQuery } from './useRealtimeQuery';

// OTA Updates
export { useOTAUpdates } from './useOTAUpdates';
export type { BannerState, UseOTAUpdatesReturn } from './useOTAUpdates';

// Force Update
export { useForceUpdate } from './useForceUpdate';
export type { ForceUpdateState } from './useForceUpdate';

// Waitlist
export {
  useWaitlist,
  useWaitlistStatus,
  useJoinWaitlist,
  useMyReferralCode,
  useApplyReferral,
  useValidateReferral,
  waitlistKeys,
} from './useWaitlist';
