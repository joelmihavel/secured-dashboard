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
