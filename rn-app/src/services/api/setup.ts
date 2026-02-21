/**
 * Setup API Services
 *
 * Backend integration for bank verification, utility verification, and landlord invites.
 * Uses the shared callEdgeFunction from supabase/client.ts for authenticated edge function calls.
 *
 * Maps camelCase RN types <-> snake_case edge function contracts:
 *   - verify-bank (POST, auth required)
 *   - verify-utility (POST, auth required)
 *   - verify-utility?action=operators (GET, auth optional)
 *   - send-landlord-invite (POST, auth required)
 *
 * Pattern follows waitlist.ts: define raw response types, map to RN camelCase.
 */

import { callEdgeFunction } from '../supabase';
import type {
  BankVerificationRequest,
  BankVerificationResponse,
  UtilityVerificationRequest,
  UtilityVerificationResponse,
  UtilityOperator,
  LandlordInviteRequest,
  LandlordInviteResponse,
  SetupProgress,
  SetupStep,
  SetupError,
  SetupErrorCode,
} from '@/src/types/setup';

// ==============================================
// RAW EDGE FUNCTION RESPONSE TYPES (snake_case)
// ==============================================

/** Raw response from verify-bank edge function */
interface RawVerifyBankResponse {
  success: boolean;
  data: {
    bank_account_id: string;
    verified: boolean;
    account_number_masked: string;
    ifsc_code: string;
    verified_name: string | null;
    name_match_score: number;
    name_match_threshold: number;
    verification_status: 'SUCCESS' | 'FAILURE' | 'PENDING';
    bank_name: string | null;
    branch: string | null;
    message: string;
    agreement_name_matched: boolean | null;
    matched_landlord_name: string | null;
    agreement_match_score: number | null;
  };
}

/** Raw response from verify-utility edge function */
interface RawVerifyUtilityResponse {
  success: boolean;
  data: {
    verification_id: string;
    verified: boolean;
    name_verified: boolean;
    address_verified: boolean;
    bank_name_verified: boolean;
    consumer_name: string | null;
    landlord_name: string | null;
    name_match_score: number;
    address_match_score: number;
    bank_name_match_score: number;
    bank_account_holder_name: string | null;
    match_threshold: number;
    bill_amount: number | null;
    bill_due_date: string | null;
    message: string;
    matching_method: 'gemini_ai' | 'algorithmic';
    // Optional Gemini AI detail fields
    name_reasoning?: string;
    address_reasoning?: string;
    name_match_type?: string;
    address_match_type?: string;
  };
}

/** Raw operator from verify-utility?action=operators */
interface RawOperator {
  operator_code: string;
  operator_name: string;
  state?: string;
  params?: string[];
}

/** Raw response from verify-utility?action=operators */
interface RawOperatorsResponse {
  success: boolean;
  data: {
    operators: RawOperator[];
    count: number;
  };
}

/** Raw response from send-landlord-invite edge function */
interface RawSendInviteResponse {
  success: boolean;
  data: {
    already_approved?: boolean;
    invite_id?: string;
    status?: string;
    sent_via?: string;
    expires_at?: string;
    message: string;
    invite_link?: string;
    landlord_email_masked?: string;
  };
}

// ==============================================
// MAPPING FUNCTIONS (snake_case -> camelCase)
// ==============================================

function mapBankResponse(raw: RawVerifyBankResponse): BankVerificationResponse {
  const d = raw.data;
  return {
    success: raw.success,
    bankAccountId: d.bank_account_id,
    verified: d.verified,
    accountNumberMasked: d.account_number_masked,
    ifscCode: d.ifsc_code,
    verifiedName: d.verified_name,
    nameMatchScore: d.name_match_score,
    nameMatchThreshold: d.name_match_threshold,
    verificationStatus: d.verification_status,
    bankName: d.bank_name,
    branch: d.branch,
    message: d.message,
    agreementNameMatched: d.agreement_name_matched ?? null,
    matchedLandlordName: d.matched_landlord_name ?? null,
    agreementMatchScore: d.agreement_match_score ?? null,
  };
}

function mapUtilityResponse(raw: RawVerifyUtilityResponse): UtilityVerificationResponse {
  const d = raw.data;
  return {
    success: raw.success,
    verificationId: d.verification_id,
    verified: d.verified,
    nameVerified: d.name_verified,
    addressVerified: d.address_verified,
    bankNameVerified: d.bank_name_verified,
    consumerName: d.consumer_name,
    landlordName: d.landlord_name,
    nameMatchScore: d.name_match_score,
    addressMatchScore: d.address_match_score,
    bankNameMatchScore: d.bank_name_match_score,
    bankAccountHolderName: d.bank_account_holder_name,
    matchThreshold: d.match_threshold,
    billAmount: d.bill_amount,
    billDueDate: d.bill_due_date,
    message: d.message,
    matchingMethod: d.matching_method,
  };
}

function mapOperator(raw: RawOperator): UtilityOperator {
  return {
    operatorCode: raw.operator_code,
    operatorName: raw.operator_name,
    state: raw.state,
    params: raw.params,
  };
}

function mapInviteResponse(raw: RawSendInviteResponse): LandlordInviteResponse {
  const d = raw.data;
  return {
    success: raw.success,
    alreadyApproved: d.already_approved,
    inviteId: d.invite_id,
    status: d.status,
    sentVia: d.sent_via,
    expiresAt: d.expires_at,
    message: d.message,
    inviteLink: d.invite_link,
    landlordEmailMasked: d.landlord_email_masked,
  };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapSetupError(errorMessage: string): SetupError {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('auth')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }
  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('required')) {
    return { code: 'VALIDATION_ERROR', message: errorMessage };
  }
  if (lower.includes('bank') && (lower.includes('name') || lower.includes('mismatch'))) {
    return { code: 'BANK_NAME_MISMATCH', message: errorMessage };
  }
  if (lower.includes('name mismatch') || lower.includes('name_mismatch')) {
    return { code: 'NAME_MISMATCH', message: errorMessage };
  }
  if (lower.includes('address mismatch') || lower.includes('address_mismatch')) {
    return { code: 'ADDRESS_MISMATCH', message: errorMessage };
  }
  if (lower.includes('email') && lower.includes('fail')) {
    return { code: 'EMAIL_FAILED', message: errorMessage };
  }
  if (lower.includes('not found')) {
    return { code: 'NOT_FOUND', message: errorMessage };
  }
  if (lower.includes('permission') || lower.includes('forbidden')) {
    return { code: 'FORBIDDEN', message: errorMessage };
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Verify bank account via Cashfree Penny Drop.
 *
 * Edge function: POST /functions/v1/verify-bank
 * Auth: Required (JWT)
 * Request mapping: camelCase -> snake_case
 * Response mapping: snake_case -> camelCase
 * Timeout: 30s (penny drop can take time)
 */
export async function verifyBank(
  request: BankVerificationRequest
): Promise<{ data: BankVerificationResponse | null; error: SetupError | null }> {
  // Map camelCase request to snake_case for edge function
  const body = {
    tenancy_id: request.tenancyId,
    account_holder_name: request.accountHolderName,
    account_number: request.accountNumber,
    ifsc_code: request.ifscCode,
    party_type: request.partyType ?? 'landlord',
  };

  const { data, error } = await callEdgeFunction<RawVerifyBankResponse>(
    'verify-bank',
    body,
    true,   // requireAuth
    'POST',
    30_000  // 30s timeout for penny drop
  );

  if (error) {
    return { data: null, error: mapSetupError(error) };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: { code: 'VERIFICATION_FAILED', message: 'Bank verification failed' } };
  }

  return { data: mapBankResponse(data), error: null };
}

/**
 * Fetch available electricity operators.
 *
 * Edge function: GET /functions/v1/verify-utility?action=operators
 * Auth: Not required (public endpoint)
 * Response mapping: snake_case -> camelCase
 */
export async function getUtilityOperators(): Promise<{
  data: UtilityOperator[] | null;
  error: SetupError | null;
}> {
  const { data, error } = await callEdgeFunction<RawOperatorsResponse>(
    'verify-utility?action=operators',
    {},
    false, // no auth required for operator list
    'GET'
  );

  if (error) {
    return { data: null, error: mapSetupError(error) };
  }

  if (!data?.success || !data.data?.operators) {
    return { data: null, error: { code: 'UNKNOWN_ERROR', message: 'Failed to fetch operators' } };
  }

  const operators = data.data.operators.map(mapOperator);
  return { data: operators, error: null };
}

/**
 * Verify utility bill (electricity).
 *
 * Edge function: POST /functions/v1/verify-utility
 * Auth: Required (JWT)
 * Request mapping: camelCase -> snake_case
 * Response mapping: snake_case -> camelCase
 * Timeout: 30s (external API call + Gemini matching)
 */
export async function verifyUtility(
  request: UtilityVerificationRequest
): Promise<{ data: UtilityVerificationResponse | null; error: SetupError | null }> {
  // Map camelCase request to snake_case for edge function
  const body: Record<string, unknown> = {
    tenancy_id: request.tenancyId,
    consumer_number: request.consumerNumber,
    operator_code: request.operatorCode,
  };
  if (request.params && Object.keys(request.params).length > 0) {
    body.params = request.params;
  }

  const { data, error } = await callEdgeFunction<RawVerifyUtilityResponse>(
    'verify-utility',
    body,
    true,   // requireAuth
    'POST',
    30_000  // 30s timeout for external API + Gemini
  );

  if (error) {
    return { data: null, error: mapSetupError(error) };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: { code: 'VERIFICATION_FAILED', message: 'Utility verification failed' } };
  }

  return { data: mapUtilityResponse(data), error: null };
}

/**
 * Send (or resend) landlord invitation email.
 *
 * Edge function: POST /functions/v1/send-landlord-invite
 * Auth: Required (JWT)
 * Request mapping: camelCase -> snake_case
 * Response mapping: snake_case -> camelCase
 *
 * Note: The edge function sends email (not SMS/WhatsApp).
 * To resend, pass { resend: true } in the request.
 */
export async function sendLandlordInvite(
  request: LandlordInviteRequest
): Promise<{ data: LandlordInviteResponse | null; error: SetupError | null }> {
  // Map camelCase request to snake_case for edge function
  const body: Record<string, unknown> = {
    tenancy_id: request.tenancyId,
  };
  if (request.landlordName) body.landlord_name = request.landlordName;
  if (request.landlordEmail) body.landlord_email = request.landlordEmail;
  if (request.resend) body.resend = true;

  const { data, error } = await callEdgeFunction<RawSendInviteResponse>(
    'send-landlord-invite',
    body,
    true // requireAuth
  );

  if (error) {
    return { data: null, error: mapSetupError(error) };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: { code: 'UNKNOWN_ERROR', message: 'Failed to send landlord invite' } };
  }

  return { data: mapInviteResponse(data), error: null };
}

/**
 * Resend landlord invitation. Uses the same edge function with resend=true.
 *
 * @param tenancyId - The tenancy to resend the invite for
 */
export async function resendLandlordInvite(
  tenancyId: string
): Promise<{ data: LandlordInviteResponse | null; error: SetupError | null }> {
  return sendLandlordInvite({ tenancyId, resend: true });
}

/**
 * Get setup progress from dashboard data.
 *
 * There is no separate edge function for setup progress. It is derived from
 * the dashboard-data edge function (tenancy.verification_status). This function
 * is retained for compatibility but defers to the dashboard query.
 */
export function deriveSetupProgress(verificationStatus: {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
} | null): SetupProgress {
  const bankDone = verificationStatus?.bank_verified ?? false;
  const utilityDone = verificationStatus?.utility_verified ?? false;
  const landlordDone = verificationStatus?.landlord_approved ?? false;

  const steps = buildSetupSteps(bankDone, utilityDone, landlordDone);
  const completedCount = [bankDone, utilityDone, landlordDone].filter(Boolean).length;
  const currentStepIndex = steps.findIndex((s) => !s.isCompleted);

  let landlordStatus: SetupProgress['landlordStatus'] = { type: 'none' };
  if (landlordDone) {
    landlordStatus = { type: 'approved' };
  }

  return {
    steps,
    currentStepIndex: currentStepIndex === -1 ? steps.length - 1 : currentStepIndex,
    landlordStatus,
    completedCount,
    totalCount: 3,
  };
}

// ==============================================
// SETUP STEPS BUILDER
// ==============================================

export function buildSetupSteps(
  bankDone: boolean,
  utilityDone: boolean,
  landlordDone: boolean
): SetupStep[] {
  return [
    {
      id: 'bank',
      type: 'bank',
      title: 'Add bank details',
      subtitle: 'For rent payouts',
      icon: 'building-columns',
      isCompleted: bankDone,
      route: '/(setup)/add-bank',
    },
    {
      id: 'utility',
      type: 'utility',
      title: 'Verify address',
      subtitle: 'Via electricity bill',
      icon: 'bolt',
      isCompleted: utilityDone,
      route: '/(setup)/add-utility',
    },
    {
      id: 'landlord',
      type: 'landlord',
      title: 'Invite landlord',
      subtitle: 'To approve tenancy',
      icon: 'user-plus',
      isCompleted: landlordDone,
      route: '/(setup)/invite-landlord',
    },
  ];
}
