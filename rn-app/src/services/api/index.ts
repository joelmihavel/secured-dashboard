/**
 * API services barrel export
 */

// Agreement
export * from './agreement';

// Auth
export * from './auth';

// Dashboard
export * from './dashboard';

// Identity
export * from './identity';

// Payments
export * from './payments';

// Profile (selective re-export to avoid name collision with payments module)
export {
  updateProfile,
  requestAvatarUpload,
  uploadAvatarFile,
  type UpdateProfileRequest,
  type ProfileData,
  type AvatarUploadData,
  type ProfileError,
  type ProfileErrorCode,
  type PaymentMethodsData,
  type GroupedPaymentMethods,
} from './profile';
// Profile's SavedPaymentMethod and getSavedPaymentMethods are accessed
// directly via '@/src/services/api/profile' to avoid collision with
// the payments module's SavedPaymentMethod type.

// Setup
export * from './setup';

// Waitlist
export * from './waitlist';
