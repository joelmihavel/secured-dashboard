/**
 * Setup Flow Types
 *
 * Type definitions for bank verification, utility verification, and landlord invite.
 * All types are aligned with the actual Supabase edge function contracts.
 *
 * Edge functions:
 *   - verify-bank (POST, auth required) - Cashfree Penny Drop bank verification
 *   - verify-upi-vpa (POST, auth required) - Cashfree UPI Penny Drop verification
 *   - verify-utility (POST, auth required) - API Club electricity bill verification
 *   - verify-utility?action=operators (GET, auth optional) - Electricity operator list
 *   - send-landlord-invite (POST, auth required) - Email invitation to landlord
 */

// ==============================================
// PAYMENT METHOD SELECTOR
// ==============================================

export type PaymentMethodType = 'bank' | 'upi';

// ==============================================
// BANK VERIFICATION
// ==============================================

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface BankVerificationRequest {
  tenancyId?: string; // Optional for pre-waitlist flow (no tenancy exists yet)
  accountHolderName?: string; // Optional — name comes from penny drop response
  accountNumber: string;
  ifscCode: string;
  partyType?: 'landlord' | 'tenant';
  existingBankAccountId?: string;
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
  agreementNameMatched: boolean | null;
  matchedLandlordName: string | null;
  agreementMatchScore: number | null;
}

// ==============================================
// UPI VPA VERIFICATION
// ==============================================

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface UpiVerificationRequest {
  tenancyId?: string; // Optional for pre-waitlist flow (no tenancy exists yet)
  upiVpa: string;
  partyType?: 'landlord' | 'tenant';
}

/** Mapped RN response from verify-upi-vpa edge function */
export interface UpiVerificationResponse {
  success: boolean;
  bankAccountId: string;
  verified: boolean;
  upiVpa: string;
  verifiedName: string | null;
  nameMatchScore: number;
  nameMatchThreshold: number;
  verificationStatus: 'SUCCESS' | 'FAILURE' | 'PENDING';
  bankName: string | null;
  ifsc: string | null;
  message: string;
  agreementNameMatched: boolean | null;
  matchedLandlordName: string | null;
  agreementMatchScore: number | null;
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
  params?: Record<string, string>; // Additional params required by some operators (e.g., "Billing Unit")
}

/** Mapped RN response from verify-utility edge function */
export interface UtilityVerificationResponse {
  success: boolean;
  verificationId: string;
  verified: boolean;
  nameVerified: boolean;
  addressVerified: boolean;
  bankNameVerified: boolean;
  consumerName: string | null;
  landlordName: string | null;
  nameMatchScore: number;
  addressMatchScore: number;
  bankNameMatchScore: number;
  bankAccountHolderName: string | null;
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
  landlordPhone?: string;
  countryCode?: string;
}

/** Mapped RN response from invite-landlord-whatsapp edge function */
export interface LandlordInviteResponse {
  success: boolean;
  message: string;
  landlordPhoneMasked?: string;
  inviteCount?: number;
}

// ==============================================
// PAN VERIFICATION
// ==============================================

/** RN client request shape (camelCase) - mapped to snake_case for edge function */
export interface PanVerificationRequest {
  tenancyId?: string; // Optional for pre-waitlist flow (no tenancy exists yet)
  panNumber: string;
  bankAccountId: string;
}

/** Mapped RN response from verify-pan edge function */
export interface PanVerificationResponse {
  success: boolean;
  panVerified: boolean;
  panValid: boolean;
  panType: string;
  registeredName: string;
  nameMatched: boolean;
  nameMatchScore: number;
  matchedLandlordName: string | null;
  message: string;
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

export type LandlordInviteStatus = 'none' | 'invite_pending' | 'invited' | 'verified' | 'declined';

export type LandlordStatus =
  | { type: 'none' }
  | { type: 'invite_pending' }
  | { type: 'pending'; canResend: boolean; daysSinceSent: number }
  | { type: 'invited' }
  | { type: 'declined' }
  | { type: 'verified' }
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
  | 'BANK_NAME_MISMATCH'
  | 'EMAIL_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UPI_VPA_INVALID'
  | 'SERVICE_UNAVAILABLE'
  | 'EMPTY_RESPONSE'
  | 'UNKNOWN_ERROR';

/** Field keys for add-bank form; backend may use snake_case (e.g. account_number). */
export type BankDetailsErrorFields = Partial<{
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  panCard: string;
  /** Snake_case keys from backend */
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  pan_card: string;
}>;

export interface SetupError {
  code: SetupErrorCode;
  message: string;
  /** Optional field-level errors from backend (camelCase keys after service-layer mapping). */
  fields?: Record<string, string>;
  /** Full-width detail for name mismatch errors (e.g. the actual name found by penny drop). */
  foundName?: string;
}
