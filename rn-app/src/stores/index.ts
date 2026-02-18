/**
 * Zustand stores barrel export
 */

export {
  useAuthStore,
  selectAuthStatus,
  selectPhoneNumber,
  selectIsAuthenticated,
  selectAuthError,
} from './auth';
export type { AuthStatus } from './auth';

export {
  useWaitlistStore,
  selectViewState,
  selectUserName,
  selectReferralCode,
  selectReferralCodeString,
  selectIsReferralComplete,
  selectIsApplyingReferral,
  selectReferralError,
  selectShowConfetti,
  selectError,
  selectCountdownText,
} from './waitlist';
export type { WaitlistViewState } from './waitlist';

export {
  usePaymentStore,
  selectPaymentStatus,
  selectSelectedMethod,
  selectPaymentAmount,
  selectPaymentError,
  selectIsProcessing,
  selectTransactionId,
} from './payment';
export type { PaymentMethodType, PaymentStatus, SelectedPaymentMethod } from './payment';

export {
  useSetupStore,
  selectCurrentStep,
  selectFlowStatus,
  selectBankForm,
  selectUtilityForm,
  selectLandlordForm,
  selectSetupError,
  selectIsSetupComplete,
} from './setup';
export type { SetupStepId, SetupFlowStatus } from './setup';

export {
  useProfileStore,
  selectActiveTab,
  selectIsEditing,
  selectProfileForm,
  selectNotificationPrefs,
  selectIsSaving,
  selectProfileError,
  selectIsFormDirty,
} from './profile';
export type { ProfileTab } from './profile';
