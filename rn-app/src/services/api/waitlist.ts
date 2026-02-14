/**
 * Waitlist API Service
 *
 * Handles waitlist status and referral code operations via Supabase edge functions.
 * Maps edge function responses to the shapes expected by the RN app UI layer.
 *
 * Edge function contracts:
 * - get-waitlist-status: GET, returns V1-compat shape with has_entry, waitlist_entry, etc.
 * - join-waitlist: POST, returns { success, data: { entry_id, position, is_new } }
 * - get-my-referral-code: GET, returns { success, data: { code, usage_count, max_uses } }
 * - apply-referral-code: POST, returns { success, data: { code, reward_type, rewards, message } }
 * - validate-referral-code: POST, returns { success, data: { is_valid, code, message, ... } }
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES — RN App UI Contract
// ==============================================

export type WaitlistState =
  | 'pending'
  | 'pending_long'
  | 'approved'
  | 'rejected';

export interface WaitlistStatusData {
  state: WaitlistState;
  position: number | null;
  estimatedWaitDays: number | null;
  submissionDate: string | null;
  currentOnboarded: number;
  totalMemberSlots: number;
  estimatedReviewTime: string;
  rejectionReasons: string[];
  nextApplicationCountdown: number;
}

export interface ApplyReferralRequest {
  code: string;
}

export interface ApplyReferralResponse {
  success: boolean;
  data: {
    valid: boolean;
    message: string;
    code: string;
    rewardType: string | null;
    rewards: {
      cashbackPaise: number;
      cashbackRupees: string;
      priorityBoost: number;
    };
    newPosition?: number;
    priorityAccess?: boolean;
  };
}

export interface ValidateReferralResponse {
  success: boolean;
  data: {
    valid: boolean;
    message: string;
    code?: string;
    referredBy?: string | null;
    rewardType?: string | null;
    rewardDetails?: {
      cashbackPaise: number;
      cashbackRupees: string;
      priorityBoost: number;
    };
    alreadyApplied?: boolean;
  };
}

export type WaitlistErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_REFERRAL'
  | 'REFERRAL_EXPIRED'
  | 'REFERRAL_ALREADY_USED'
  | 'ALREADY_APPLIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface WaitlistError {
  code: WaitlistErrorCode;
  message: string;
}

// ==============================================
// TYPES — Edge Function Raw Responses
// ==============================================

/** Raw response from get-waitlist-status edge function (V1 compat shape) */
interface RawWaitlistStatusResponse {
  success: boolean;
  has_entry: boolean;
  contract_status?: string;
  extraction_status?: string;
  requires_manual_review?: boolean;
  manual_review_reason?: string | null;
  fields_extracted?: number;
  total_fields?: number;
  confidence_score?: number;
  waitlist_position?: number;
  admin_review?: string;
  onboarded_count?: number;
  total_member_slots?: number;
  waitlist_entry?: {
    id: string;
    status: string;
    extraction_status: string;
    contract_status: string;
    requires_manual_review: boolean;
    manual_review_reason: string | null;
    waitlist_position: number | null;
    document_uploaded: boolean;
    admin_review: string;
    rejection_reasons: string[];
    next_application_at: string | null;
    created_at: string;
  };
  extracted_info?: {
    property_name: string;
    monthly_rent: string;
    security_deposit: string;
    rent_duration: string;
    lease_end_date: string;
    tenants: string[];
    landlords: string[];
    confidence_score: number;
    certificate_no: string | null;
  };
  rewards?: {
    pending_total: number;
    credited_total: number;
  };
}

/** Raw response from join-waitlist edge function */
interface RawJoinWaitlistResponse {
  success: boolean;
  data?: {
    entry_id: string;
    position: number;
    is_new: boolean;
  };
  error?: boolean;
  message?: string;
}

/** Raw response from get-my-referral-code edge function */
interface RawGetMyReferralCodeResponse {
  success: boolean;
  data?: {
    code: string;
    usage_count: number;
    max_uses: number;
    reward_amount_paise: number;
  };
  error?: boolean;
  message?: string;
}

/** Raw response from apply-referral-code edge function */
interface RawApplyReferralResponse {
  success: boolean;
  data?: {
    code: string;
    reward_type: string | null;
    rewards: {
      cashback_paise: number;
      cashback_rupees: string;
      priority_boost: number;
    };
    message: string;
  };
  // Error shape (when success: false)
  error?: boolean;
  message?: string;
  code?: string;
}

/** Raw response from validate-referral-code edge function */
interface RawValidateReferralResponse {
  success: boolean;
  data?: {
    is_valid: boolean;
    code?: string;
    referred_by?: string | null;
    reward_type?: string | null;
    reward_details?: {
      cashback_paise: number;
      cashback_rupees: string;
      priority_boost: number;
    };
    message?: string;
    error_message?: string;
    already_applied?: boolean;
  };
}

// ==============================================
// MAPPING FUNCTIONS
// ==============================================

/**
 * Maps the raw V1-compat edge function response to the RN app's WaitlistStatusData shape.
 *
 * Derivation logic:
 * - state: derived from admin_review + extraction_status
 * - position: from waitlist_position
 * - estimatedWaitDays: heuristic based on position
 * - submissionDate: from waitlist_entry.created_at
 */
function mapRawToWaitlistStatusData(raw: RawWaitlistStatusResponse): WaitlistStatusData {
  // No entry means user hasn't joined waitlist yet — treat as pending
  if (!raw.has_entry) {
    return {
      state: 'pending',
      position: null,
      estimatedWaitDays: null,
      submissionDate: null,
      currentOnboarded: 0,
      totalMemberSlots: 150,
      estimatedReviewTime: 'Approximately 24 hrs',
      rejectionReasons: [],
      nextApplicationCountdown: 0,
    };
  }

  // Derive state from admin_review field
  let state: WaitlistState = 'pending';
  const adminReview = raw.admin_review ?? raw.waitlist_entry?.admin_review;
  const extractionStatus = raw.extraction_status ?? raw.waitlist_entry?.extraction_status;

  if (adminReview === 'approved') {
    state = 'approved';
  } else if (adminReview === 'rejected') {
    state = 'rejected';
  } else if (adminReview === 'in_progress' || extractionStatus === 'manual_review') {
    state = 'pending_long';
  } else {
    state = 'pending';
  }

  // Derive position
  const position = raw.waitlist_position ?? raw.waitlist_entry?.waitlist_position ?? null;

  // Derive estimated wait days from position (heuristic: ~1 day per 50 positions)
  const estimatedWaitDays = position ? Math.max(1, Math.ceil(position / 50)) : null;

  // Format submission date
  const createdAt = raw.waitlist_entry?.created_at;
  let submissionDate: string | null = null;
  if (createdAt) {
    const d = new Date(createdAt);
    submissionDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Build rejection reasons if rejected
  const rejectionReasons: string[] = raw.waitlist_entry?.rejection_reasons ?? [];
  if (rejectionReasons.length === 0 && state === 'rejected') {
    if (raw.requires_manual_review && raw.manual_review_reason) {
      rejectionReasons.push(raw.manual_review_reason);
    }
    if (extractionStatus === 'failed') {
      rejectionReasons.push('Document processing failed. Please re-upload.');
    }
  }

  // Estimated review time
  let estimatedReviewTime = 'Approximately 24 hrs';
  if (state === 'pending_long') {
    estimatedReviewTime = 'Approximately 24-48 hrs';
  }

  // Calculate countdown from next_application_at if present
  let nextApplicationCountdown = 0;
  if (state === 'rejected' && raw.waitlist_entry?.next_application_at) {
    const nextAt = new Date(raw.waitlist_entry.next_application_at).getTime();
    const now = Date.now();
    nextApplicationCountdown = Math.max(0, Math.floor((nextAt - now) / 1000));
  } else if (state === 'rejected') {
    nextApplicationCountdown = 86400; // default 24 hrs
  }

  return {
    state,
    position,
    estimatedWaitDays,
    submissionDate,
    currentOnboarded: raw.onboarded_count ?? 0,
    totalMemberSlots: raw.total_member_slots ?? 150,
    estimatedReviewTime,
    rejectionReasons,
    nextApplicationCountdown,
  };
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Get current waitlist status for the authenticated user
 *
 * Calls the get-waitlist-status edge function (GET) and maps the V1-compat
 * response to the WaitlistStatusData shape expected by the RN UI.
 */
export async function getWaitlistStatus(): Promise<{
  data: WaitlistStatusData | null;
  error: WaitlistError | null;
}> {
  const { data, error } = await callEdgeFunction<RawWaitlistStatusResponse>(
    'get-waitlist-status',
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Failed to get waitlist status' },
    };
  }

  // Map the raw V1 response to the RN app's expected shape
  const mapped = mapRawToWaitlistStatusData(data);
  return { data: mapped, error: null };
}

/**
 * Apply a referral code to get priority access
 *
 * @param code - Alphanumeric referral code (4-10 characters)
 * @returns Promise with referral result or error
 */
export async function applyReferralCode(
  code: string
): Promise<{ data: ApplyReferralResponse['data'] | null; error: WaitlistError | null }> {
  // Validate code format (alphanumeric, 4-10 characters)
  const trimmed = code.trim().toUpperCase();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 10) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be 4-10 characters' },
    };
  }

  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be alphanumeric' },
    };
  }

  const { data, error } = await callEdgeFunction<RawApplyReferralResponse>(
    'apply-referral-code',
    { code: trimmed },
    true // requireAuth
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  // Handle backend error response (success: false with message)
  if (!data?.success) {
    const errorMessage = data?.message ?? 'Failed to apply referral code';
    const errorCode = data?.code;
    return {
      data: null,
      error: mapWaitlistErrorFromCode(errorCode, errorMessage),
    };
  }

  // Map successful response
  const rawData = data.data;
  if (!rawData) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Invalid response from server' },
    };
  }

  return {
    data: {
      valid: true,
      message: rawData.message,
      code: rawData.code,
      rewardType: rawData.reward_type,
      rewards: {
        cashbackPaise: rawData.rewards.cashback_paise,
        cashbackRupees: rawData.rewards.cashback_rupees,
        priorityBoost: rawData.rewards.priority_boost,
      },
      priorityAccess: (rawData.rewards.priority_boost ?? 0) > 0,
    },
    error: null,
  };
}

/**
 * Validate a referral code without applying it
 *
 * @param code - Alphanumeric referral code (4-10 characters)
 * @returns Promise with validation result or error
 */
export async function validateReferralCode(
  code: string
): Promise<{ data: ValidateReferralResponse['data'] | null; error: WaitlistError | null }> {
  // Validate code format
  const trimmed = code.trim().toUpperCase();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 10) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be 4-10 characters' },
    };
  }

  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return {
      data: null,
      error: { code: 'INVALID_REFERRAL', message: 'Referral code must be alphanumeric' },
    };
  }

  const { data, error } = await callEdgeFunction<RawValidateReferralResponse>(
    'validate-referral-code',
    { code: trimmed },
    true // requireAuth — edge function requires it
  );

  if (error) {
    return {
      data: null,
      error: mapWaitlistError(error),
    };
  }

  if (!data?.success || !data.data) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Failed to validate referral code' },
    };
  }

  const rawData = data.data;

  // Map is_valid -> valid, error_message -> message
  return {
    data: {
      valid: rawData.is_valid,
      message: rawData.is_valid
        ? (rawData.message ?? 'Valid referral code')
        : (rawData.error_message ?? 'Invalid referral code'),
      code: rawData.code,
      referredBy: rawData.referred_by,
      rewardType: rawData.reward_type,
      rewardDetails: rawData.reward_details
        ? {
            cashbackPaise: rawData.reward_details.cashback_paise,
            cashbackRupees: rawData.reward_details.cashback_rupees,
            priorityBoost: rawData.reward_details.priority_boost,
          }
        : undefined,
      alreadyApplied: rawData.already_applied,
    },
    error: null,
  };
}

// ==============================================
// JOIN WAITLIST
// ==============================================

export interface JoinWaitlistData {
  entryId: string;
  position: number;
  isNew: boolean;
}

/**
 * Join the waitlist (idempotent — returns existing entry if already joined)
 */
export async function joinWaitlist(): Promise<{
  data: JoinWaitlistData | null;
  error: WaitlistError | null;
}> {
  const { data, error } = await callEdgeFunction<RawJoinWaitlistResponse>(
    'join-waitlist',
    {},
    true
  );

  if (error) {
    return { data: null, error: mapWaitlistError(error) };
  }

  if (!data?.success || !data.data) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: data?.message || 'Failed to join waitlist' },
    };
  }

  return {
    data: {
      entryId: data.data.entry_id,
      position: data.data.position,
      isNew: data.data.is_new,
    },
    error: null,
  };
}

// ==============================================
// GET MY REFERRAL CODE
// ==============================================

export interface MyReferralCodeData {
  code: string;
  usageCount: number;
  maxUses: number;
  rewardAmountPaise: number;
}

/**
 * Get or generate the user's personal referral code for sharing
 */
export async function getMyReferralCode(): Promise<{
  data: MyReferralCodeData | null;
  error: WaitlistError | null;
}> {
  const { data, error } = await callEdgeFunction<RawGetMyReferralCodeResponse>(
    'get-my-referral-code',
    {},
    true,
    'GET'
  );

  if (error) {
    return { data: null, error: mapWaitlistError(error) };
  }

  if (!data?.success || !data.data) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: data?.message || 'Failed to get referral code' },
    };
  }

  return {
    data: {
      code: data.data.code,
      usageCount: data.data.usage_count,
      maxUses: data.data.max_uses,
      rewardAmountPaise: data.data.reward_amount_paise,
    },
    error: null,
  };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapWaitlistError(errorMessage: string): WaitlistError {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('not authenticated') || lowerMessage.includes('unauthorized') || lowerMessage.includes('auth')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }

  if (lowerMessage.includes('already applied') || lowerMessage.includes('already_applied')) {
    return { code: 'ALREADY_APPLIED', message: 'You have already applied a referral code' };
  }

  if (lowerMessage.includes('invalid') && lowerMessage.includes('referral')) {
    return { code: 'INVALID_REFERRAL', message: 'This referral code is not valid' };
  }

  if (lowerMessage.includes('expired')) {
    return { code: 'REFERRAL_EXPIRED', message: 'This referral code has expired' };
  }

  if (lowerMessage.includes('already used') || lowerMessage.includes('claimed')) {
    return { code: 'REFERRAL_ALREADY_USED', message: 'This referral code has already been used' };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

function mapWaitlistErrorFromCode(code: string | undefined, message: string): WaitlistError {
  switch (code) {
    case 'ALREADY_APPLIED':
      return { code: 'ALREADY_APPLIED', message };
    case 'INVALID_CODE':
      return { code: 'INVALID_REFERRAL', message };
    case 'AUTH_ERROR':
      return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
    default:
      return mapWaitlistError(message);
  }
}

// ==============================================
// MOCK DATA FOR DEVELOPMENT
// ==============================================

/**
 * Mock waitlist status for development/testing
 */
export function getMockWaitlistStatus(state: WaitlistState = 'pending'): WaitlistStatusData {
  const baseData = {
    position: 42,
    estimatedWaitDays: 1,
    submissionDate: '27 Jan 2026',
    currentOnboarded: 18,
    totalMemberSlots: 150,
    estimatedReviewTime: 'Approximately 24 hrs',
    rejectionReasons: [],
    nextApplicationCountdown: 0,
  };

  switch (state) {
    case 'pending':
      return { ...baseData, state: 'pending' };
    case 'pending_long':
      return {
        ...baseData,
        state: 'pending_long',
        estimatedWaitDays: 7,
        estimatedReviewTime: 'Approximately 24-48 hrs',
      };
    case 'approved':
      return { ...baseData, state: 'approved', position: null };
    case 'rejected':
      return {
        ...baseData,
        state: 'rejected',
        position: null,
        rejectionReasons: [
          "You're renting outside Bangalore",
          'You did not use an invite code.',
          "Your rent agreement didn't qualify.",
        ],
        nextApplicationCountdown: 102264, // ~28 hours in seconds
      };
    default:
      return { ...baseData, state: 'pending' };
  }
}
