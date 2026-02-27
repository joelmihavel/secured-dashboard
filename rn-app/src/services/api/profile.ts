/**
 * Profile API Service
 *
 * Handles profile operations: update profile, avatar upload, and payment methods.
 * Maps edge function response shapes to the RN app UI contract.
 *
 * Edge function contracts:
 * - update-profile: POST { full_name?, first_name?, last_name?, email?, avatar_url? }
 *   Returns: { success, data: { user_id, full_name, first_name, last_name, email, avatar_url, updated_at } }
 *
 * - upload-avatar: POST { content_type }
 *   Returns: { success, data: { upload_url, avatar_url, file_path, expires_at, max_file_size } }
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
  avatarUrl?: string;
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

export interface AvatarUploadData {
  uploadUrl: string;
  avatarUrl: string;
  filePath: string;
  expiresAt: string;
  maxFileSize: number;
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
  | 'UPLOAD_FAILED'
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

/** Raw response from upload-avatar edge function */
interface RawUploadAvatarResponse {
  success: boolean;
  data: {
    upload_url: string;
    avatar_url: string;
    file_path: string;
    expires_at: string;
    max_file_size: number;
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
  if (request.avatarUrl !== undefined) body.avatar_url = request.avatarUrl;

  const { data, error } = await callEdgeFunction<RawUpdateProfileResponse>(
    'update-profile',
    body,
    true // requireAuth
  );

  if (error) {
    return { data: null, error: mapProfileError(error) };
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
 * Request a presigned URL for avatar upload.
 *
 * Flow:
 * 1. Call this function to get a presigned upload URL
 * 2. PUT the image file to the upload_url
 * 3. Call updateProfile({ avatarUrl }) with the returned avatar_url
 */
export async function requestAvatarUpload(
  contentType: string
): Promise<{ data: AvatarUploadData | null; error: ProfileError | null }> {
  const { data, error } = await callEdgeFunction<RawUploadAvatarResponse>(
    'upload-avatar',
    { content_type: contentType },
    true // requireAuth
  );

  if (error) {
    return { data: null, error: mapProfileError(error) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: { code: 'UPLOAD_FAILED', message: 'Failed to generate upload URL' },
    };
  }

  return {
    data: {
      uploadUrl: data.data.upload_url,
      avatarUrl: data.data.avatar_url,
      filePath: data.data.file_path,
      expiresAt: data.data.expires_at,
      maxFileSize: data.data.max_file_size,
    },
    error: null,
  };
}

/**
 * Upload an avatar image file to the presigned URL.
 *
 * @param uploadUrl - The presigned URL from requestAvatarUpload
 * @param fileUri - The local file URI from ImagePicker
 * @param contentType - MIME type (image/jpeg, image/png, etc.)
 * @returns The public avatar URL to pass to updateProfile
 */
export async function uploadAvatarFile(
  uploadUrl: string,
  fileUri: string,
  contentType: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Fetch the local file as a blob
    const response = await fetch(fileUri);
    const blob = await response.blob();

    // Upload to presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      return {
        success: false,
        error: `Upload failed with status ${uploadResponse.status}`,
      };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload avatar',
    };
  }
}

/**
 * Pixelate a user photo into orange-tinted pixel art.
 *
 * Sends the image to the pixelate-avatar edge function which:
 * 1. Validates the image
 * 2. Downscales to 32×32
 * 3. Applies orange tint (#FF9A6D at 40% blend)
 * 4. Upscales to 64×64 + 256×256 with nearest-neighbor
 * 5. Updates avatar_url in the user profile
 *
 * @param fileUri - Local file URI from ImagePicker
 * @param contentType - MIME type (image/jpeg, image/png)
 * @returns Avatar URLs (256px main + 64px thumbnail)
 */
export async function pixelateAvatar(
  fileUri: string,
  contentType: string
): Promise<{
  data: { avatarUrl: string; thumbnailUrl: string } | null;
  error: ProfileError | null;
}> {
  try {
    // Build FormData
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append('image', blob, `avatar.${contentType === 'image/png' ? 'png' : 'jpg'}`);

    // Call edge function directly with FormData
    const { data: session } = await (await import('../supabase')).supabase.auth.getSession();
    const token = session?.session?.access_token;

    if (!token) {
      return { data: null, error: { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' } };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const uploadResponse = await fetch(
      `${supabaseUrl}/functions/v1/pixelate-avatar`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey ?? '',
        },
        body: formData,
      }
    );

    const result = await uploadResponse.json();

    if (!uploadResponse.ok || !result.success) {
      return {
        data: null,
        error: mapProfileError(result.message || 'Pixelation failed'),
      };
    }

    return {
      data: {
        avatarUrl: result.data.avatarUrl,
        thumbnailUrl: result.data.thumbnailUrl,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'UPLOAD_FAILED',
        message: err instanceof Error ? err.message : 'Failed to pixelate avatar',
      },
    };
  }
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
  const { data, error } = await callEdgeFunction<RawGetPaymentMethodsResponse>(
    'get-saved-payment-methods',
    {},
    true, // requireAuth
    'GET'
  );

  if (error) {
    return { data: null, error: mapProfileError(error) };
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
  const { data, error } = await callEdgeFunction<RawDeleteAccountResponse>(
    'delete-account',
    reason ? { reason } : {},
    true
  );

  if (error) {
    return { data: null, error: mapProfileError(error) };
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

function mapProfileError(errorMessage: string): ProfileError {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('missing authorization') || lower.includes('invalid jwt') || lower.includes('jwt expired')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }

  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('at least one field')) {
    return { code: 'VALIDATION_ERROR', message: errorMessage };
  }

  if (lower.includes('upload') || lower.includes('storage')) {
    return { code: 'UPLOAD_FAILED', message: 'Failed to upload file' };
  }

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

