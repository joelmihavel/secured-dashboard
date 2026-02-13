/**
 * Setup Flow Types
 *
 * Type definitions for bank verification, utility verification, and landlord invite.
 * All types are aligned with the actual Supabase edge function contracts.
 *
 * Edge functions:
 *   - verify-bank (POST, auth required) - Cashfree Penny Drop bank verification
 *   - verify-utility (POST, auth required) - API Club electricity bill verification
 *   - verify-utility?action=operators (GET, auth optional) - Electricity operator list
 *   - send-landlord-invite (POST, auth required) - Email invitation to landlord
 */

// ==============================================
// BANK VERIFICATION
// ==============================================

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface BankVerificationRequest {
  tenancyId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  partyType?: 'landlord' | 'tenant';
}

/** Mapped RN response from verify-bank edge function */
export interface BankVerificationResponse {
  success: boolean;
  bankAccountId: string;
  verified: boolean;
  accountNumberMasked: string;
  ifscCode: string;
  verifiedName: string | null;
  nameMatchScore: number;
  nameMatchThreshold: number;
  verificationStatus: 'SUCCESS' | 'FAILURE' | 'PENDING';
  bankName: string | null;
  branch: string | null;
  message: string;
}

// ==============================================
// UTILITY VERIFICATION
// ==============================================

export type UtilityType = 'electricity' | 'gas' | 'water';

/** Operator info returned by verify-utility?action=operators */
export interface UtilityOperator {
  operatorCode: string;
  operatorName: string;
  state?: string;
  params?: string[];
}

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface UtilityVerificationRequest {
  tenancyId: string;
  operatorCode: string;
  consumerNumber: string;
}

/** Mapped RN response from verify-utility edge function */
export interface UtilityVerificationResponse {
  success: boolean;
  verificationId: string;
  verified: boolean;
  nameVerified: boolean;
  addressVerified: boolean;
  consumerName: string | null;
  landlordName: string | null;
  nameMatchScore: number;
  addressMatchScore: number;
  matchThreshold: number;
  billAmount: number | null;
  billDueDate: string | null;
  message: string;
  matchingMethod: 'gemini_ai' | 'algorithmic';
}

// ==============================================
// LANDLORD INVITE
// ==============================================

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface LandlordInviteRequest {
  tenancyId: string;
  landlordName?: string;
  landlordEmail?: string;
  resend?: boolean;
}

/** Mapped RN response from send-landlord-invite edge function */
export interface LandlordInviteResponse {
  success: boolean;
  alreadyApproved?: boolean;
  inviteId?: string;
  status?: string;
  sentVia?: string;
  expiresAt?: string;
  message: string;
  inviteLink?: string;
  landlordEmailMasked?: string;
}

// ==============================================
// SETUP PROGRESS (derived from dashboard data)
// ==============================================

export type SetupStepType = 'bank' | 'utility' | 'landlord';

export interface SetupStep {
  id: string;
  type: SetupStepType;
  title: string;
  subtitle: string;
  icon: string;
  isCompleted: boolean;
  route: string;
}

export type LandlordStatus =
  | { type: 'none' }
  | { type: 'pending'; canResend: boolean; daysSinceSent: number }
  | { type: 'declined' }
  | { type: 'approved' };

export interface SetupProgress {
  steps: SetupStep[];
  currentStepIndex: number;
  landlordStatus: LandlordStatus;
  completedCount: number;
  totalCount: number;
}

// ==============================================
// FORM VALIDATION
// ==============================================

export interface BankFormData {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
}

export interface UtilityFormData {
  selectedOperator: UtilityOperator | null;
  consumerNumber: string;
}

export interface LandlordFormData {
  landlordName: string;
  landlordEmail: string;
}

// ==============================================
// SETUP ERROR
// ==============================================

export type SetupErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'VERIFICATION_FAILED'
  | 'NAME_MISMATCH'
  | 'ADDRESS_MISMATCH'
  | 'EMAIL_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface SetupError {
  code: SetupErrorCode;
  message: string;
}
