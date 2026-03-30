/**
 * Profile API Service
 *
 * Handles profile operations: update profile and payment methods.
 * Maps edge function response shapes to the RN app UI contract.
 *
 * Edge function contracts:
 * - update-profile: POST { full_name?, first_name?, last_name?, email? }
 *   Returns: { success, data: { user_id, full_name, first_name, last_name, email, avatar_url, updated_at } }
 *
 * - get-saved-payment-methods: GET
 *   Returns: { success, data: { payment_methods[], primary_method_id, grouped_methods, total_count } }
 */

import { callEdgeFunction } from '../supabase';

// ==============================================
// TYPES -- RN App UI Contract
// ==============================================

export interface UpdateProfileRequest {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ProfileData {
  userId: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

export interface SavedPaymentMethod {
  id: string;
  type: 'upi' | 'card' | 'netbanking';
  displayName: string;
  isPrimary: boolean;
  isVerified: boolean;
  nickname: string | null;
  createdAt: string;

  // UPI fields
  upiVpa?: string;
  upiProvider?: string;

  // Card fields (masked)
  cardLast4?: string;
  cardNetwork?: string;
  cardType?: string;
  cardIssuer?: string;
  cardExpiryMonth?: number;
  cardExpiryYear?: number;
  isExpired?: boolean;

  // Netbanking fields
  bankCode?: string;
  bankName?: string;
}

export interface GroupedPaymentMethods {
  upi: SavedPaymentMethod[];
  cards: SavedPaymentMethod[];
  netbanking: SavedPaymentMethod[];
}

export interface PaymentMethodsData {
  methods: SavedPaymentMethod[];
  primaryMethodId: string | null;
  groupedMethods: GroupedPaymentMethods;
  totalCount: number;
}

export type ProfileErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'UPDATE_FAILED'
  | 'DELETE_FAILED'
  | 'ARCHIVE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface ProfileError {
  code: ProfileErrorCode;
  message: string;
}

// ==============================================
// TYPES -- Edge Function Raw Responses
// ==============================================

/** Raw response from delete-account edge function */
interface RawDeleteAccountResponse {
  success: boolean;
  message: string;
  archived_at?: string;
  error?: string;
}

/** Raw response from update-profile edge function */
interface RawUpdateProfileResponse {
  success: boolean;
  data: {
    user_id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    updated_at: string;
  };
}

/** Raw payment method from get-saved-payment-methods edge function */
interface RawPaymentMethod {
  id: string;
  type: 'upi' | 'card' | 'netbanking';
  display_name: string;
  is_primary: boolean;
  is_verified: boolean;
  nickname: string | null;
  created_at: string;

  // UPI fields
  upi_vpa?: string;
  upi_provider?: string;

  // Card fields
  card_last4?: string;
  card_network?: string;
  card_type?: string;
  card_issuer?: string;
  card_expiry_month?: number;
  card_expiry_year?: number;
  is_expired?: boolean;

  // Netbanking fields
  bank_code?: string;
  bank_name?: string;
}

/** Raw response from get-saved-payment-methods edge function */
interface RawGetPaymentMethodsResponse {
  success: boolean;
  data: {
    payment_methods: RawPaymentMethod[];
    primary_method_id: string | null;
    grouped_methods: {
      upi: RawPaymentMethod[];
      cards: RawPaymentMethod[];
      netbanking: RawPaymentMethod[];
    };
    total_count: number;
  };
}

// ==============================================
// MAPPING FUNCTIONS
// ==============================================

function mapRawProfile(raw: RawUpdateProfileResponse['data']): ProfileData {
  return {
    userId: raw.user_id,
    fullName: raw.full_name,
    firstName: raw.first_name,
    lastName: raw.last_name,
    email: raw.email,
    avatarUrl: raw.avatar_url,
    updatedAt: raw.updated_at,
  };
}

function mapRawPaymentMethod(raw: RawPaymentMethod): SavedPaymentMethod {
  const base: SavedPaymentMethod = {
    id: raw.id,
    type: raw.type,
    displayName: raw.display_name,
    isPrimary: raw.is_primary,
    isVerified: raw.is_verified,
    nickname: raw.nickname,
    createdAt: raw.created_at,
  };

  if (raw.type === 'upi') {
    base.upiVpa = raw.upi_vpa;
    base.upiProvider = raw.upi_provider;
  } else if (raw.type === 'card') {
    base.cardLast4 = raw.card_last4;
    base.cardNetwork = raw.card_network;
    base.cardType = raw.card_type;
    base.cardIssuer = raw.card_issuer;
    base.cardExpiryMonth = raw.card_expiry_month;
    base.cardExpiryYear = raw.card_expiry_year;
    base.isExpired = raw.is_expired;
  } else if (raw.type === 'netbanking') {
    base.bankCode = raw.bank_code;
    base.bankName = raw.bank_name;
  }

  return base;
}

function mapRawPaymentMethods(raw: RawGetPaymentMethodsResponse['data']): PaymentMethodsData {
  return {
    methods: raw.payment_methods.map(mapRawPaymentMethod),
    primaryMethodId: raw.primary_method_id,
    groupedMethods: {
      upi: raw.grouped_methods.upi.map(mapRawPaymentMethod),
      cards: raw.grouped_methods.cards.map(mapRawPaymentMethod),
      netbanking: raw.grouped_methods.netbanking.map(mapRawPaymentMethod),
    },
    totalCount: raw.total_count,
  };
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Update user profile.
 *
 * Maps RN camelCase fields to edge function snake_case fields.
 * The edge function also auto-splits full_name into first_name/last_name if only full_name is provided.
 */
export async function updateProfile(
  request: UpdateProfileRequest
): Promise<{ data: ProfileData | null; error: ProfileError | null }> {
  // Map camelCase request to snake_case for edge function
  const body: Record<string, string | undefined> = {};
  if (request.fullName !== undefined) body.full_name = request.fullName;
  if (request.firstName !== undefined) body.first_name = request.firstName;
  if (request.lastName !== undefined) body.last_name = request.lastName;
  if (request.email !== undefined) body.email = request.email;

  const { data, error, errorBody } = await callEdgeFunction<RawUpdateProfileResponse>(
    'update-profile',
    body,
    true // requireAuth
  );

  if (error) {
    return { data: null, error: mapProfileError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update profile' },
    };
  }

  return { data: mapRawProfile(data.data), error: null };
}

/**
 * Get saved payment methods for the authenticated user.
 *
 * Maps edge function response (snake_case, is_primary/is_default) to RN app
 * types (camelCase, isPrimary). Returns flat list, grouped by type, and
 * the primary method ID.
 */
export async function getSavedPaymentMethods(): Promise<{
  data: PaymentMethodsData | null;
  error: ProfileError | null;
}> {
  const { data, error, errorBody } = await callEdgeFunction<RawGetPaymentMethodsResponse>(
    'get-saved-payment-methods',
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    return { data: null, error: mapProfileError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UNKNOWN_ERROR', message: 'Failed to fetch payment methods' },
    };
  }

  return { data: mapRawPaymentMethods(data.data), error: null };
}

/**
 * Request account deletion.
 *
 * Calls POST /functions/v1/delete-account
 * Edge function archives all user data, then deletes from all tables + auth.
 */
export async function requestAccountDeletion(
  reason?: string
): Promise<{ data: { archivedAt: string } | null; error: ProfileError | null }> {
  const { data, error, errorBody } = await callEdgeFunction<RawDeleteAccountResponse>(
    'delete-account',
    reason ? { reason } : {},
    true
  );

  if (error) {
    return { data: null, error: mapProfileError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'DELETE_FAILED', message: data?.message ?? 'Failed to delete account' },
    };
  }

  return { data: { archivedAt: data.archived_at ?? new Date().toISOString() }, error: null };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapProfileError(errorMessage: string, errorBody?: Record<string, unknown>): ProfileError {
  // Prefer structured error code from errorBody when available
  const structuredCode = errorBody?.code as string | undefined;
  if (structuredCode) {
    switch (structuredCode) {
      case 'VALIDATION_ERROR':
        return { code: 'VALIDATION_ERROR', message: (errorBody?.message as string) ?? errorMessage };
      case 'AUTH_ERROR':
        return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
      case 'DELETE_FAILED':
        return { code: 'DELETE_FAILED', message: (errorBody?.message as string) ?? 'Failed to delete account' };
      case 'ARCHIVE_ERROR':
        return { code: 'ARCHIVE_ERROR', message: (errorBody?.message as string) ?? 'Failed to archive account data' };
      case 'RATE_LIMITED':
        return { code: 'UNKNOWN_ERROR', message: 'Too many requests. Please wait a moment' };
      // Fall through for unknown structured codes — use string matching below
    }
  }

  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('missing authorization') || lower.includes('invalid jwt') || lower.includes('jwt expired')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }

  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('at least one field')) {
    return { code: 'VALIDATION_ERROR', message: errorMessage };
  }

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

