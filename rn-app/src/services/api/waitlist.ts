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
  /** Master journey state from users.user_status */
  userStatus: string;
  position: number | null;
  estimatedWaitDays: number | null;
  submissionDate: string | null;
  currentOnboarded: number;
  totalMemberSlots: number;
  estimatedReviewTime: string;
  rejectionReasons: string[];
  nextApplicationCountdown: number;
  /** Whether user has claimed an invite code */
  hasInviteCode: boolean;
  /** Batch number the user is in */
  batchNumber: number | null;
  /** Current active batch from backend config */
  currentBatch: number;
  /** Days before rejected users can re-apply */
  rejectionCooldownDays: number;
  /** Whether the extraction requires manual admin review */
  requiresManualReview: boolean;
  /** Extraction pipeline status (pending/processing/completed/failed) */
  extractionStatus: string | null;
}

export interface ClaimInviteCodeResponse {
  success: boolean;
  data: {
    code: string;
    message: string;
  } | null;
  error: WaitlistError | null;
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
  | 'AGREEMENT_NOT_CONFIRMED'
  | 'INVALID_REFERRAL'
  | 'REFERRAL_EXPIRED'
  | 'REFERRAL_ALREADY_USED'
  | 'ALREADY_APPLIED'
  | 'INVALID_INVITE_CODE'
  | 'INVITE_CODE_USED'
  | 'INVITE_CODE_ALREADY_CLAIMED'
  | 'RATE_LIMITED'
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
  user_status?: string;
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
  review_timeline?: {
    hours: number;
    display_text: string;
  };
  batch_config?: {
    current_batch: number;
    batch_size: number;
    batch_launch_date: string | null;
    rejection_cooldown_days: number;
  };
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
    has_invite_code: boolean;
    batch_number: number | null;
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

/** Raw response from claim-invite-code edge function */
interface RawClaimInviteCodeResponse {
  success: boolean;
  data?: {
    code: string;
    message: string;
  };
  error?: boolean;
  message?: string;
  code?: string;
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
  const batchConfig = raw.batch_config;
  const reviewTimeline = raw.review_timeline;
  const defaultReviewText = reviewTimeline?.display_text ?? 'Approximately 24 hrs';
  const rejectionCooldownDays = batchConfig?.rejection_cooldown_days ?? 30;

  // No entry means user hasn't joined waitlist yet — treat as pending
  if (!raw.has_entry) {
    return {
      state: 'pending',
      userStatus: raw.user_status ?? 'signed_up',
      position: null,
      estimatedWaitDays: null,
      submissionDate: null,
      currentOnboarded: 0,
      totalMemberSlots: batchConfig?.batch_size ?? 200,
      estimatedReviewTime: defaultReviewText,
      rejectionReasons: [],
      nextApplicationCountdown: 0,
      hasInviteCode: false,
      batchNumber: null,
      currentBatch: batchConfig?.current_batch ?? 1,
      rejectionCooldownDays,
      requiresManualReview: raw.requires_manual_review ?? false,
      extractionStatus: raw.extraction_status ?? null,
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

  // Estimated review time — use backend value (dynamic)
  let estimatedReviewTime = defaultReviewText;
  if (state === 'pending_long') {
    // For pending_long, show a higher range if the backend provides hours
    const hours = reviewTimeline?.hours ?? 24;
    estimatedReviewTime = `Approximately ${hours}-${hours * 2} hrs`;
  }

  // Calculate countdown for rejected users
  // Uses batch_launch_date + rejection_cooldown_days if available,
  // otherwise falls back to next_application_at
  let nextApplicationCountdown = 0;
  if (state === 'rejected') {
    if (raw.waitlist_entry?.next_application_at) {
      const nextAt = new Date(raw.waitlist_entry.next_application_at).getTime();
      const now = Date.now();
      nextApplicationCountdown = Math.max(0, Math.floor((nextAt - now) / 1000));
    } else if (batchConfig?.batch_launch_date) {
      // Calculate from batch launch date + cooldown days
      const launchDate = new Date(batchConfig.batch_launch_date).getTime();
      const cooldownMs = rejectionCooldownDays * 24 * 60 * 60 * 1000;
      const reopenAt = launchDate + cooldownMs;
      const now = Date.now();
      nextApplicationCountdown = Math.max(0, Math.floor((reopenAt - now) / 1000));
    } else {
      nextApplicationCountdown = rejectionCooldownDays * 24 * 60 * 60; // fallback
    }
  }

  return {
    state,
    userStatus: raw.user_status ?? 'signed_up',
    position,
    estimatedWaitDays,
    submissionDate,
    currentOnboarded: raw.onboarded_count ?? 0,
    totalMemberSlots: raw.total_member_slots ?? batchConfig?.batch_size ?? 200,
    estimatedReviewTime,
    rejectionReasons,
    nextApplicationCountdown,
    hasInviteCode: raw.waitlist_entry?.has_invite_code ?? false,
    batchNumber: raw.waitlist_entry?.batch_number ?? null,
    currentBatch: batchConfig?.current_batch ?? 1,
    rejectionCooldownDays,
    requiresManualReview: raw.requires_manual_review ?? raw.waitlist_entry?.requires_manual_review ?? false,
    extractionStatus: extractionStatus ?? null,
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
async function getWaitlistStatusReal(): Promise<{
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

async function getWaitlistStatusMock(): Promise<{
  data: WaitlistStatusData | null;
  error: WaitlistError | null;
}> {
  const { createMockWaitlistStatus } = await import('@/src/__mocks__/testDataFactory');
  return { data: createMockWaitlistStatus('pending'), error: null };
}

// withMock() enforces same return type + __DEV__ compile-time gate
const _getWaitlistStatus = __DEV__
  ? (() => {
      const { withMock } = require('@/src/__dev__/withMock');
      return withMock('waitlist', getWaitlistStatusReal, getWaitlistStatusMock, { delayMs: 200 });
    })()
  : getWaitlistStatusReal;

export const getWaitlistStatus = _getWaitlistStatus;

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
    // Check for AGREEMENT_NOT_CONFIRMED gate error
    const rawData = data as any;
    if (rawData?.code === 'AGREEMENT_NOT_CONFIRMED') {
      return {
        data: null,
        error: { code: 'AGREEMENT_NOT_CONFIRMED', message: rawData.message || 'Agreement not confirmed' },
      };
    }
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
// CLAIM INVITE CODE
// ==============================================

/**
 * Validate and claim an admin-generated invite code.
 * Code format: 2 letters + 2 digits (4 characters, any order).
 *
 * @param code - 4-character invite code
 * @returns Promise with success/error
 */
export async function claimInviteCode(
  code: string
): Promise<ClaimInviteCodeResponse> {
  const trimmed = code.trim().toUpperCase();

  // Client-side format validation
  if (!trimmed || trimmed.length !== 4) {
    return {
      success: false,
      data: null,
      error: { code: 'INVALID_INVITE_CODE', message: 'Invite code must be 4 characters' },
    };
  }

  if (!/^[A-Z0-9]{4}$/.test(trimmed)) {
    return {
      success: false,
      data: null,
      error: { code: 'INVALID_INVITE_CODE', message: 'Invite code must contain only letters and numbers' },
    };
  }

  // Check for exactly 2 letters and 2 digits
  const letters = trimmed.replace(/[^A-Z]/g, '').length;
  const digits = trimmed.replace(/[^0-9]/g, '').length;
  if (letters !== 2 || digits !== 2) {
    return {
      success: false,
      data: null,
      error: { code: 'INVALID_INVITE_CODE', message: 'Invite code must have 2 letters and 2 digits' },
    };
  }

  const { data, error, errorBody } = await callEdgeFunction<RawClaimInviteCodeResponse>(
    'claim-invite-code',
    { code: trimmed },
    true // requireAuth
  );

  if (error) {
    // Backend returns structured error codes in the response body even on
    // non-2xx responses. Prefer the structured code (e.g. "INVALID_CODE")
    // over raw message string-matching so the UI shows the right state.
    const structuredCode = errorBody?.code as string | undefined;
    if (structuredCode) {
      return {
        success: false,
        data: null,
        error: mapInviteCodeErrorFromCode(structuredCode, (errorBody?.message as string) ?? error),
      };
    }
    return {
      success: false,
      data: null,
      error: mapInviteCodeError(error),
    };
  }

  if (!data?.success) {
    const errorCode = data?.code;
    const errorMessage = data?.message ?? 'Failed to validate invite code';
    return {
      success: false,
      data: null,
      error: mapInviteCodeErrorFromCode(errorCode, errorMessage),
    };
  }

  return {
    success: true,
    data: data.data ?? { code: trimmed, message: 'Invite code accepted!' },
    error: null,
  };
}

function mapInviteCodeError(errorMessage: string): WaitlistError {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('rate') || lower.includes('too many')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment.' };
  }
  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('invalid jwt') || lower.includes('jwt expired')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }
  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

function mapInviteCodeErrorFromCode(code: string | undefined, message: string): WaitlistError {
  switch (code) {
    case 'INVALID_CODE':
    case 'VALIDATION_ERROR':
      return { code: 'INVALID_INVITE_CODE', message };
    case 'ALREADY_USED':
      return { code: 'INVITE_CODE_USED', message };
    case 'ALREADY_CLAIMED':
      return { code: 'INVITE_CODE_ALREADY_CLAIMED', message };
    case 'CODE_REVOKED':
      return { code: 'INVALID_INVITE_CODE', message };
    case 'RATE_LIMITED':
      return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment.' };
    case 'AUTH_ERROR':
      return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
    default:
      return { code: 'UNKNOWN_ERROR', message };
  }
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapWaitlistError(errorMessage: string): WaitlistError {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('not authenticated') || lowerMessage.includes('unauthorized') || lowerMessage.includes('missing authorization') || lowerMessage.includes('invalid jwt') || lowerMessage.includes('jwt expired')) {
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
// (Mock data removed — all data comes from real API)
