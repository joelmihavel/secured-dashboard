/**
 * Setup Flow Types
 * Type definitions for bank verification, utility verification, and landlord invite
 */

// Bank Verification Types
export interface BankVerificationRequest {
  tenancyId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface BankVerificationResponse {
  success: boolean;
  verifiedName?: string;
  bankName?: string;
  branch?: string;
  accountType?: string;
  error?: string;
}

// Utility Verification Types
export type UtilityType = 'electricity' | 'gas' | 'water';

export interface UtilityOperator {
  operatorCode: string;
  operatorName: string;
  state: string;
  utilityType: UtilityType;
}

export interface UtilityVerificationRequest {
  tenancyId: string;
  operatorCode: string;
  consumerNumber: string;
}

export interface UtilityVerificationResponse {
  success: boolean;
  consumerName?: string;
  nameVerified: boolean;
  addressVerified: boolean;
  nameMatchScore?: number;
  billAmount?: number;
  dueDate?: string;
  error?: string;
}

// Landlord Invite Types
export type InviteChannel = 'sms' | 'whatsapp';

export interface LandlordInviteRequest {
  tenancyId: string;
  landlordName: string;
  landlordPhone: string;
  landlordEmail?: string;
  channel: InviteChannel;
}

export interface LandlordInviteResponse {
  success: boolean;
  inviteId?: string;
  inviteLink?: string;
  sentVia: string;
  expiresAt?: string;
  error?: string;
}

// Setup Progress Types
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

// Form Validation Types
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
  landlordPhone: string;
  landlordEmail: string;
  selectedChannel: InviteChannel;
}
