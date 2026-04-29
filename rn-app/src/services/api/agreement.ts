/**
 * Agreement API Service
 *
 * Handles the full agreement upload, processing, and confirmation flow
 * via Supabase edge functions.
 *
 * Edge function contracts:
 * - upload-document: POST, returns signed upload URL + extraction record ID
 * - process-document: POST, triggers OCR/AI extraction of uploaded document
 * - confirm-extraction: POST, user confirms extracted data and locks role
 *
 * NOTE: The upload flow is a TWO-STEP process:
 * 1. Call upload-document edge function to get a signed upload URL + extraction ID
 * 2. Upload the actual file bytes to the signed URL
 * 3. Call process-document to trigger extraction
 * 4. Call confirm-extraction after user reviews extracted data
 */

import {
  uploadAsync,
  FileSystemUploadType,
  FileSystemSessionType,
} from 'expo-file-system/legacy';
import { callEdgeFunction, supabase } from '../supabase';

// ==============================================
// UTILITIES
// ==============================================

const QUERY_TIMEOUT_MS = 10_000;

/** Race a promise against a timeout — used for direct Supabase client queries */
const withTimeout = <T>(promise: Promise<T>, ms: number = QUERY_TIMEOUT_MS): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), ms)
    ),
  ]);

// ==============================================
// TYPES -- RN App UI Contract (camelCase)
// ==============================================

/** Status of the document extraction pipeline */
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Status of the contract review */
export type ContractStatus = 'uploading' | 'user_review' | 'manual_review' | 'expired' | 'invalid_document' | 'confirmed';

/** Upload step 1 result: signed URL + extraction record */
export interface UploadDocumentResult {
  success: boolean;
  uploadUrl: string;
  extractionId: string;
  downloadUrl?: string;
  documentPath: string;
}

/** Processing result after OCR/AI extraction */
export interface ProcessDocumentResult {
  success: boolean;
  extractionId: string;
  confidenceScore: number;
  needsManualReview: boolean;
  reviewReason?: string;
  contractStatus: ContractStatus;
  isCitySupported: boolean;
  extractionStatus: ExtractionStatus;
  fieldsExtracted: number;
  totalFields: number;
}

/** Extracted agreement data for the review screen */
export interface ExtractedAgreementData {
  extractionId: string;
  propertyName?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyPincode?: string;
  micromarket?: string;
  monthlyRentPaise?: number;
  securityDepositPaise?: number;
  maintenancePaise?: number;
  leaseStartDate?: string;
  leaseEndDate?: string;
  rentDurationMonths?: number;
  rentDueDay?: number;
  rentEscalationPercent?: number;
  tenantNames: string[];
  landlordNames: string[];
  confidenceScore: number;
  certificateNo?: string;
  registrationNumber?: string;
  contractStatus: ContractStatus;
  isCitySupported: boolean;
  needsManualReview: boolean;
  reviewReason?: string;
}

/** Confirmation result after user approves extracted data */
export interface ConfirmExtractionResult {
  success: boolean;
  extractionId: string;
  confirmedRole: string;
  contractStatus: string;
  tenancyId?: string;
  userStatus?: string;
}

/** User corrections sent during confirmation */
export interface ConfirmExtractionRequest {
  extractionId: string;
  confirmedRole?: 'tenant' | 'landlord';
  tenantName?: string;
  landlordName?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyPincode?: string;
  monthlyRentPaise?: number;
  securityDepositPaise?: number;
  rentDueDay?: number;
  leaseStartDate?: string;
  leaseEndDate?: string;
  landlordPhone?: string;
  landlordEmail?: string;
}

/** Request to update extraction with user modifications.
 *  String[] values are used for the plural array columns (tenant_names,
 *  landlord_names) so user edits to those fields actually round-trip. */
export interface UpdateExtractionRequest {
  extractionId: string;
  modifications: Record<string, string | number | boolean | string[]>;
}

/** Result after updating extraction */
export interface UpdateExtractionResult {
  success: boolean;
  extractionId: string;
  modifiedFields: string[];
}

export type AgreementErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PROCESSING_IN_PROGRESS'
  | 'EXTRACTION_NOT_FOUND'
  | 'EXTRACTION_NOT_COMPLETE'
  | 'ALREADY_CONFIRMED'
  | 'OCR_FAILED'
  | 'CITY_NOT_SUPPORTED'
  | 'NETWORK_ERROR'
  | 'UPLOAD_FAILED'
  | 'UNKNOWN_ERROR';

export interface AgreementError {
  code: AgreementErrorCode;
  message: string;
}

// ==============================================
// TYPES -- Edge Function Raw Responses (snake_case)
// ==============================================

/** Raw response from upload-document edge function */
interface RawUploadDocumentResponse {
  success: boolean;
  upload_url?: string;
  waitlist_entry_id?: string;
  extracted_rental_info_id?: string;
  download_url?: string;
  document_path?: string;
  error?: string;
}

/** Raw response from process-document edge function */
interface RawProcessDocumentResponse {
  success: boolean;
  extracted_rental_info_id?: string;
  confidence_score: number;
  needs_manual_review: boolean;
  review_reason?: string;
  contract_status: string;
  is_city_supported: boolean;
  extraction_status?: string;
  requires_manual_review?: boolean;
  manual_review_reason?: string;
  fields_extracted?: number;
  total_fields?: number;
  error?: string;
  error_code?: string;
}

/** Raw response from confirm-extraction edge function */
interface RawConfirmExtractionResponse {
  success: boolean;
  waitlist_entry_id?: string;
  extraction_id?: string;
  user_id?: string;
  confirmed_role?: string;
  contract_status?: string;
  tenancy_id?: string;
  data?: {
    tenancy_id: string;
    user_status: string;
  };
  error?: string;
}

/** Raw response from update-extraction edge function */
interface RawUpdateExtractionResponse {
  success: boolean;
  extraction_id?: string;
  modified_fields?: string[];
  error?: string;
}

// ==============================================
// MAPPING FUNCTIONS
// ==============================================

function mapRawUploadResponse(raw: RawUploadDocumentResponse): UploadDocumentResult {
  return {
    success: raw.success,
    uploadUrl: raw.upload_url ?? '',
    // V2 field preferred, fall back to V1 field
    extractionId: raw.extracted_rental_info_id ?? raw.waitlist_entry_id ?? '',
    downloadUrl: raw.download_url,
    documentPath: raw.document_path ?? '',
  };
}

function mapRawProcessResponse(raw: RawProcessDocumentResponse): ProcessDocumentResult {
  return {
    success: raw.success,
    extractionId: raw.extracted_rental_info_id ?? '',
    confidenceScore: raw.confidence_score,
    // Edge function returns both fields for iOS compat -- prefer needs_manual_review
    needsManualReview: raw.needs_manual_review ?? raw.requires_manual_review ?? false,
    reviewReason: raw.review_reason ?? raw.manual_review_reason,
    contractStatus: raw.contract_status as ContractStatus,
    isCitySupported: raw.is_city_supported,
    extractionStatus: (raw.extraction_status as ExtractionStatus) ?? 'completed',
    fieldsExtracted: raw.fields_extracted ?? 0,
    totalFields: raw.total_fields ?? 24,
  };
}

function mapRawConfirmResponse(raw: RawConfirmExtractionResponse): ConfirmExtractionResult {
  return {
    success: raw.success,
    extractionId: raw.extraction_id ?? raw.waitlist_entry_id ?? '',
    confirmedRole: raw.confirmed_role ?? 'tenant',
    contractStatus: raw.contract_status ?? 'confirmed',
    tenancyId: raw.tenancy_id ?? raw.data?.tenancy_id,
    userStatus: raw.data?.user_status,
  };
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Step 1: Request a signed upload URL from the backend.
 *
 * The edge function:
 * - Validates auth, file type, file size
 * - Creates an extracted_rental_info record with status "pending"
 * - Returns a signed upload URL for Supabase Storage
 *
 * @param fileName - Original file name (e.g., "agreement.pdf")
 * @param fileType - MIME type (e.g., "application/pdf")
 * @param fileSize - File size in bytes
 */
export async function requestUploadUrl(
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ data: UploadDocumentResult | null; error: AgreementError | null }> {
  const { data, error, errorBody } = await callEdgeFunction<RawUploadDocumentResponse>(
    'upload-document',
    {
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
    },
    true, // requireAuth
    'POST',
    30_000 // 30s timeout
  );

  if (error) {
    return { data: null, error: mapAgreementError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: mapAgreementErrorFromMessage(data?.error ?? 'Failed to create upload URL'),
    };
  }

  return { data: mapRawUploadResponse(data), error: null };
}

/**
 * Step 2: Upload the actual file bytes to the signed URL.
 *
 * Uses expo-file-system's uploadAsync with BACKGROUND session type.
 * iOS continues the transfer via NSURLSession even when the app is
 * suspended — the promise resolves when the user returns to the app.
 *
 * @param signedUrl - The signed upload URL from step 1
 * @param fileUri - Local file URI (from document picker)
 * @param mimeType - MIME type of the file
 * @param onProgress - Optional progress callback (0-100)
 */
export async function uploadFileToSignedUrl(
  signedUrl: string,
  fileUri: string,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error: AgreementError | null }> {
  try {
    const result = await uploadAsync(signedUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mimeType },
      // iOS Simulator's NSURLSession background mode is broken (fails with
      // NSURLErrorDomain -1). Use FOREGROUND in dev so simulator testing
      // works; production keeps BACKGROUND so uploads continue if the user
      // navigates away mid-transfer.
      sessionType: __DEV__ ? FileSystemSessionType.FOREGROUND : FileSystemSessionType.BACKGROUND,
    });

    onProgress?.(100);

    if (result.status >= 200 && result.status < 300) {
      return { success: true, error: null };
    }

    if (result.status === 403) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Upload URL expired. Please try again',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: `Upload failed with status ${result.status}`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File upload failed';

    if (message.includes('cancelled') || message.includes('aborted')) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Upload was interrupted. Please try again',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: message.toLowerCase().includes('network')
          ? 'Network error. Please check your connection and try again'
          : message,
      },
    };
  }
}

/**
 * Step 3: Trigger document processing (OCR + AI extraction).
 *
 * The edge function:
 * - Downloads the uploaded PDF from storage
 * - Runs GCP Document AI for OCR
 * - Runs Gemini for entity extraction
 * - Stores extracted data in extracted_rental_info table
 * - Returns extraction results and quality metrics
 *
 * @param extractionId - The extraction record ID from step 1
 * @param documentPath - Optional document path (usually auto-resolved from extraction record)
 */
export async function processDocument(
  extractionId: string,
  documentPath?: string
): Promise<{ data: ProcessDocumentResult | null; error: AgreementError | null }> {
  const body: Record<string, string> = {
    extraction_id: extractionId,
  };

  if (documentPath) {
    body.document_path = documentPath;
  }

  const { data, error, errorBody } = await callEdgeFunction<RawProcessDocumentResponse>(
    'process-document',
    body,
    true, // requireAuth
    'POST',
    600_000 // 10 min — Document AI (300s) + Gemini (300s) each have independent timeouts on backend
  );

  if (error) {
    return { data: null, error: mapAgreementError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: mapAgreementErrorFromMessage(data?.error ?? 'Document processing failed'),
    };
  }

  return { data: mapRawProcessResponse(data), error: null };
}

/**
 * Fetch the extracted agreement data for the review screen.
 *
 * Queries the extracted_rental_info table directly via Supabase client.
 * This avoids needing a dedicated edge function for read-only data.
 */
/** Columns fetched for the review screen — must match extracted_rental_info schema */
const EXTRACTION_SELECT_COLUMNS = [
  'id',
  'property_name',
  'property_address',
  'property_city',
  'property_state',
  'property_pincode',
  'micromarket',
  'monthly_rent_paise',
  'security_deposit_paise',
  'maintenance_paise',
  'lease_start_date',
  'lease_end_date',
  'rent_duration_months',
  'rent_due_day',
  'rent_escalation_percent',
  'tenant_names',
  'tenant_name',
  'landlord_names',
  'landlord_name',
  'confidence_score',
  'certificate_no',
  'registration_number',
  'extraction_status',
  'is_city_supported',
  'needs_manual_review',
  'contract_status',
].join(',');

export async function getExtractedAgreementData(
  extractionId: string
): Promise<{ data: ExtractedAgreementData | null; error: AgreementError | null }> {
  const { data: raw, error } = await withTimeout(
    supabase
      .from('extracted_rental_info')
      .select(EXTRACTION_SELECT_COLUMNS)
      .eq('id', extractionId)
      .single()
  );

  if (error || !raw) {
    return {
      data: null,
      error: {
        code: 'EXTRACTION_NOT_FOUND',
        message: error?.message ?? 'Extraction record not found',
      },
    };
  }

  // Cast to Record — Supabase client has no generated types for this project
  const data = raw as unknown as Record<string, unknown>;

  // Safely handle both array and string (singular/plural) variations
  const extractNames = (plural?: unknown, singular?: unknown): string[] => {
    if (Array.isArray(plural)) return plural;
    if (typeof plural === 'string') return [plural];
    if (typeof singular === 'string') return [singular];
    return [];
  };

  // Map snake_case DB columns to camelCase UI types
  const mapped: ExtractedAgreementData = {
    extractionId: data.id as string,
    propertyName: (data.property_name as string) ?? undefined,
    propertyAddress: (data.property_address as string) ?? undefined,
    propertyCity: (data.property_city as string) ?? undefined,
    propertyState: (data.property_state as string) ?? undefined,
    propertyPincode: (data.property_pincode as string) ?? undefined,
    micromarket: (data.micromarket as string) ?? undefined,
    monthlyRentPaise: (data.monthly_rent_paise as number) ?? undefined,
    securityDepositPaise: (data.security_deposit_paise as number) ?? undefined,
    maintenancePaise: (data.maintenance_paise as number) ?? undefined,
    leaseStartDate: (data.lease_start_date as string) ?? undefined,
    leaseEndDate: (data.lease_end_date as string) ?? undefined,
    rentDurationMonths: (data.rent_duration_months as number) ?? undefined,
    rentDueDay: (data.rent_due_day as number) ?? undefined,
    rentEscalationPercent: (data.rent_escalation_percent as number) ?? undefined,
    tenantNames: extractNames(data.tenant_names, data.tenant_name),
    landlordNames: extractNames(data.landlord_names, data.landlord_name),
    confidenceScore: (data.confidence_score as number) ?? 0,
    certificateNo: (data.certificate_no as string) ?? undefined,
    registrationNumber: (data.registration_number as string) ?? undefined,
    contractStatus: (data.contract_status as string as ContractStatus) ?? (data.extraction_status === 'completed' ? 'user_review' : 'uploading'),
    isCitySupported: (data.is_city_supported as boolean) ?? false,
    needsManualReview: (data.needs_manual_review as boolean) ?? false,
    reviewReason: undefined,
  };

  return { data: mapped, error: null };
}

/**
 * Step 4: Confirm extracted data after user review.
 *
 * The edge function:
 * - Marks extraction as user_verified
 * - Applies user corrections to the extraction record
 * - Locks user role (tenant/landlord)
 * - Creates tenancy record
 * - Returns tenancy ID for next steps
 *
 * @param request - Extraction ID + optional user corrections
 */
export async function confirmExtraction(
  request: ConfirmExtractionRequest
): Promise<{ data: ConfirmExtractionResult | null; error: AgreementError | null }> {
  // Map camelCase request to snake_case edge function body
  const body: Record<string, unknown> = {
    extraction_id: request.extractionId,
    confirmed_role: request.confirmedRole ?? 'tenant',
  };

  // Only include corrections that were provided
  // Use !== undefined (not truthiness) to allow zero/empty-string values
  if (request.tenantName !== undefined) body.tenant_name = request.tenantName;
  if (request.landlordName !== undefined) body.landlord_name = request.landlordName;
  if (request.propertyAddress !== undefined) body.property_address = request.propertyAddress;
  if (request.propertyCity !== undefined) body.property_city = request.propertyCity;
  if (request.propertyState !== undefined) body.property_state = request.propertyState;
  if (request.propertyPincode !== undefined) body.property_pincode = request.propertyPincode;
  if (request.monthlyRentPaise !== undefined) body.monthly_rent_paise = request.monthlyRentPaise;
  if (request.securityDepositPaise !== undefined) body.security_deposit_paise = request.securityDepositPaise;
  if (request.rentDueDay !== undefined) body.rent_due_day = request.rentDueDay;
  if (request.leaseStartDate !== undefined) body.lease_start_date = request.leaseStartDate;
  if (request.leaseEndDate !== undefined) body.lease_end_date = request.leaseEndDate;
  if (request.landlordPhone !== undefined) body.landlord_phone = request.landlordPhone;
  if (request.landlordEmail !== undefined) body.landlord_email = request.landlordEmail;

  const { data, error, errorBody } = await callEdgeFunction<RawConfirmExtractionResponse>(
    'confirm-extraction',
    body,
    true, // requireAuth
    'POST'
  );

  if (error) {
    return { data: null, error: mapAgreementError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: mapAgreementErrorFromMessage(data?.error ?? 'Failed to confirm extraction'),
    };
  }

  return { data: mapRawConfirmResponse(data), error: null };
}

/**
 * Update extracted data with user modifications (pre-confirmation).
 *
 * Calls the update-extraction edge function which:
 * - Validates extraction belongs to user
 * - Validates field whitelist (MODIFIABLE_FIELDS)
 * - Stores modifications in user_modified_data JSONB
 * - Returns list of modified fields
 */
export async function updateExtraction(
  request: UpdateExtractionRequest
): Promise<{ data: UpdateExtractionResult | null; error: AgreementError | null }> {
  const body = {
    extraction_id: request.extractionId,
    modifications: request.modifications,
  };

  const { data, error, errorBody } = await callEdgeFunction<RawUpdateExtractionResponse>(
    'update-extraction',
    body,
    true, // requireAuth
    'POST'
  );

  if (error) {
    return { data: null, error: mapAgreementError(error, errorBody) };
  }

  if (!data?.success) {
    return {
      data: null,
      error: mapAgreementErrorFromMessage(data?.error ?? 'Failed to update extraction'),
    };
  }

  return {
    data: {
      success: data.success,
      extractionId: data.extraction_id ?? request.extractionId,
      modifiedFields: data.modified_fields ?? [],
    },
    error: null,
  };
}

// ==============================================
// EXTRACTION STATUS QUERY (lightweight status-only)
// ==============================================

/** Lightweight status data for polling — does NOT fetch full extraction fields */
export interface ExtractionStatusData {
  extractionId: string;
  extractionStatus: ExtractionStatus;
  contractStatus: string | null;
  isCitySupported: boolean;
  extractionError: string | null;
  needsManualReview: boolean;
  updatedAt: string;
  userVerified: boolean;
}

/** Columns fetched for status polling — minimal set for fast queries */
const STATUS_SELECT_COLUMNS = [
  'id',
  'extraction_status',
  'contract_status',
  'is_city_supported',
  'extraction_error',
  'needs_manual_review',
  'updated_at',
  'user_verified',
].join(',');

/**
 * Fetch extraction status only (lightweight).
 *
 * Used by useExtractionStatus for polling — returns only status fields,
 * NOT the full extracted agreement data. This keeps polling fast and
 * avoids polluting the useExtractedData React Query cache.
 */
export async function fetchExtractionStatus(
  extractionId: string
): Promise<ExtractionStatusData | null> {
  const { data, error } = await withTimeout(
    supabase
      .from('extracted_rental_info')
      .select(STATUS_SELECT_COLUMNS)
      .eq('id', extractionId)
      .single()
  );

  if (error) {
    // PGRST116 = "JSON object requested, single row not found" → record genuinely missing
    if (error.code === 'PGRST116') {
      console.debug('[fetchExtractionStatus] Record not found:', extractionId);
      return null;
    }
    // Any other error is a network/server issue — throw so callers can distinguish
    console.warn('[fetchExtractionStatus] Query failed:', error.message, error.code);
    throw new Error(`fetchExtractionStatus failed: ${error.message}`);
  }

  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  return {
    extractionId: row.id as string,
    extractionStatus: row.extraction_status as ExtractionStatus,
    contractStatus: (row.contract_status as string) ?? null,
    isCitySupported: (row.is_city_supported as boolean) ?? false,
    extractionError: (row.extraction_error as string) ?? null,
    needsManualReview: (row.needs_manual_review as boolean) ?? false,
    updatedAt: row.updated_at as string,
    userVerified: (row.user_verified as boolean) ?? false,
  };
}

// ==============================================
// ERROR MAPPING
// ==============================================

function mapAgreementError(errorMessage: string, errorBody?: Record<string, unknown>): AgreementError {
  // Prefer structured error code from errorBody when available
  const structuredCode = errorBody?.code as string | undefined;
  if (structuredCode) {
    switch (structuredCode) {
      case 'VALIDATION_ERROR':
        return { code: 'UNKNOWN_ERROR', message: (errorBody?.message as string) ?? errorMessage };
      case 'NOT_FOUND':
        return { code: 'EXTRACTION_NOT_FOUND', message: (errorBody?.message as string) ?? 'Extraction record not found' };
      case 'AUTH_ERROR':
        return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
      case 'OCR_FAILED':
        return { code: 'OCR_FAILED', message: (errorBody?.message as string) ?? 'Failed to read the document. Please try again' };
      case 'ALREADY_CONFIRMED':
        return { code: 'ALREADY_CONFIRMED', message: (errorBody?.message as string) ?? 'This extraction has already been confirmed' };
      case 'PROCESSING_IN_PROGRESS':
        return { code: 'PROCESSING_IN_PROGRESS', message: (errorBody?.message as string) ?? 'A document is already being processed. Please wait' };
      case 'PROCESSING_TIMEOUT':
        return { code: 'UNKNOWN_ERROR', message: 'Processing took too long. Please try uploading again' };
      case 'SAFETY_FILTER_BLOCKED':
        return { code: 'UNKNOWN_ERROR', message: "We couldn't process this document. Please try a different copy" };
      case 'RATE_LIMITED':
        return { code: 'UNKNOWN_ERROR', message: 'Too many requests. Please wait a moment and try again' };
      case 'INVALID_FILE_TYPE':
        return { code: 'INVALID_FILE_TYPE', message: 'Please upload a PDF file' };
      case 'FILE_TOO_LARGE':
        return { code: 'FILE_TOO_LARGE', message: 'File is too large. Maximum size is 50MB' };
      // Fall through for unknown structured codes — use string matching below
    }
  }

  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('missing authorization')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }
  if (lower.includes('invalid file type') || lower.includes('file type')) {
    return { code: 'INVALID_FILE_TYPE', message: 'Please upload a PDF file' };
  }
  if (lower.includes('file too large') || lower.includes('maximum size')) {
    return { code: 'FILE_TOO_LARGE', message: 'File is too large. Maximum size is 50MB' };
  }
  if (lower.includes('processing in progress') || lower.includes('current extraction')) {
    return { code: 'PROCESSING_IN_PROGRESS', message: 'A document is already being processed. Please wait' };
  }
  if (lower.includes('not found') || lower.includes('extraction record')) {
    return { code: 'EXTRACTION_NOT_FOUND', message: 'Extraction record not found' };
  }
  if (lower.includes('not complete') || lower.includes('extraction_status')) {
    return { code: 'EXTRACTION_NOT_COMPLETE', message: 'Document extraction is not yet complete' };
  }
  if (lower.includes('already confirmed') || lower.includes('already_confirmed')) {
    return { code: 'ALREADY_CONFIRMED', message: 'This extraction has already been confirmed' };
  }
  if (lower.includes('processing') && (lower.includes('timeout') || lower.includes('timed out'))) {
    return { code: 'UNKNOWN_ERROR', message: 'Processing took too long. Please try uploading again' };
  }
  if (lower.includes('rate limit') || lower.includes('rate_limited') || lower.includes('too many requests')) {
    return { code: 'UNKNOWN_ERROR', message: 'Too many requests. Please wait a moment and try again' };
  }
  if (lower.includes('safety') || lower.includes('safety_filter')) {
    return { code: 'UNKNOWN_ERROR', message: "We couldn't process this document. Please try a different copy" };
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timed out')) {
    return { code: 'NETWORK_ERROR', message: 'Please check your internet connection' };
  }

  return { code: 'UNKNOWN_ERROR', message: errorMessage };
}

function mapAgreementErrorFromMessage(message: string): AgreementError {
  // Check for specific error codes from edge functions
  if (message.includes('INVALID_FILE_TYPE')) {
    return { code: 'INVALID_FILE_TYPE', message: 'Only PDF documents are supported' };
  }
  if (message.includes('OCR_FAILED')) {
    return { code: 'OCR_FAILED', message: 'Failed to read the document. Please try again' };
  }

  return mapAgreementError(message);
}

/**
 * Abandon an extraction record (soft-delete).
 *
 * Sets user_verified=true so all queries that filter on user_verified=false
 * will skip this record. Used when the user clicks "Re-upload Agreement"
 * to prevent the old completed extraction from causing routing loops.
 *
 * RLS allows UPDATE for authenticated users on their own records.
 */
export async function abandonExtraction(extractionId: string): Promise<void> {
  try {
    const { error } = await withTimeout(
      supabase
        .from('extracted_rental_info')
        .update({
          user_verified: true,
          extraction_status: 'failed',
          extraction_error: 'Abandoned by user (re-upload)',
        })
        .eq('id', extractionId)
    );

    if (error) {
      console.warn('abandonExtraction: Supabase update failed:', error.message);
    }
  } catch (err) {
    console.warn('[abandonExtraction] Failed to abandon extraction', extractionId, err);
  }
}

/**
 * Helper: Format paise amount to rupee string with Indian number formatting.
 * @param paise - Amount in paise (1 rupee = 100 paise)
 * @returns Formatted string like "32,175"
 */
export function formatPaiseToRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return rupees.toLocaleString('en-IN');
}

/**
 * Helper: Format ISO date string to display format.
 * @param isoDate - Date string in YYYY-MM-DD format
 * @returns Formatted string like "31 Dec 2026"
 */
export function formatDateDisplay(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
