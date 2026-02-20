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

import { callEdgeFunction, supabase } from '../supabase';
import * as FileSystem from 'expo-file-system';

// ==============================================
// TYPES -- RN App UI Contract (camelCase)
// ==============================================

/** Status of the document extraction pipeline */
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Status of the contract review */
export type ContractStatus = 'uploading' | 'user_review' | 'manual_review' | 'confirmed';

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
  contractStatus: ContractStatus;
  isCitySupported: boolean;
  needsManualReview: boolean;
  reviewReason?: string;
  /** Backend-driven list of field keys that the user can edit (overrides static defaults) */
  editableFields?: string[];
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

/** Request to update extraction with user modifications */
export interface UpdateExtractionRequest {
  extractionId: string;
  modifications: Record<string, string | number | boolean>;
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
  const { data, error } = await callEdgeFunction<RawUploadDocumentResponse>(
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
    return { data: null, error: mapAgreementError(error) };
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
 * Uses expo-file-system to upload directly to the Supabase Storage signed URL.
 * This is separate from the edge function call.
 *
 * @param signedUrl - The signed upload URL from step 1
 * @param fileUri - Local file URI (from document picker)
 * @param mimeType - MIME type of the file
 * @param onProgress - Optional progress callback (0-100)
 */
/** Upload timeout: 60 seconds for file transfer to signed URL */
const UPLOAD_TIMEOUT_MS = 60_000;

export async function uploadFileToSignedUrl(
  signedUrl: string,
  fileUri: string,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error: AgreementError | null }> {
  try {
    // Race the upload against a timeout — FileSystem.uploadAsync has no built-in timeout
    const uploadPromise = FileSystem.uploadAsync(signedUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': mimeType,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT_MS);
    });

    const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

    onProgress?.(100);

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { success: true, error: null };
    }

    // Signed URL expired — S3/Supabase returns 403
    if (uploadResult.status === 403) {
      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Upload URL expired. Please try again.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'UPLOAD_FAILED',
        message: `Upload failed with status ${uploadResult.status}`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File upload failed';

    if (message === 'UPLOAD_TIMEOUT') {
      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Upload timed out. Please try with a smaller file or better connection.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message,
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

  const { data, error } = await callEdgeFunction<RawProcessDocumentResponse>(
    'process-document',
    body,
    true, // requireAuth
    'POST',
    120_000 // 2 minute timeout (OCR + AI can be slow)
  );

  if (error) {
    return { data: null, error: mapAgreementError(error) };
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
export async function getExtractedAgreementData(
  extractionId: string
): Promise<{ data: ExtractedAgreementData | null; error: AgreementError | null }> {
  const { data, error } = await supabase
    .from('extracted_rental_info')
    .select(`
      id,
      property_name,
      property_address,
      property_city,
      property_state,
      property_pincode,
      micromarket,
      monthly_rent_paise,
      security_deposit_paise,
      maintenance_paise,
      lease_start_date,
      lease_end_date,
      rent_duration_months,
      rent_due_day,
      rent_escalation_percent,
      tenant_names,
      landlord_names,
      confidence_score,
      certificate_no,
      extraction_status,
      is_city_supported,
      editable_fields
    `)
    .eq('id', extractionId)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: {
        code: 'EXTRACTION_NOT_FOUND',
        message: error?.message ?? 'Extraction record not found',
      },
    };
  }

  // Map snake_case DB columns to camelCase UI types
  const mapped: ExtractedAgreementData = {
    extractionId: data.id,
    propertyName: data.property_name ?? undefined,
    propertyAddress: data.property_address ?? undefined,
    propertyCity: data.property_city ?? undefined,
    propertyState: data.property_state ?? undefined,
    propertyPincode: data.property_pincode ?? undefined,
    micromarket: data.micromarket ?? undefined,
    monthlyRentPaise: data.monthly_rent_paise ?? undefined,
    securityDepositPaise: data.security_deposit_paise ?? undefined,
    maintenancePaise: data.maintenance_paise ?? undefined,
    leaseStartDate: data.lease_start_date ?? undefined,
    leaseEndDate: data.lease_end_date ?? undefined,
    rentDurationMonths: data.rent_duration_months ?? undefined,
    rentDueDay: data.rent_due_day ?? undefined,
    rentEscalationPercent: data.rent_escalation_percent ?? undefined,
    tenantNames: data.tenant_names ?? [],
    landlordNames: data.landlord_names ?? [],
    confidenceScore: data.confidence_score ?? 0,
    certificateNo: data.certificate_no ?? undefined,
    // Derive contract status from extraction_status
    contractStatus: data.extraction_status === 'completed' ? 'user_review' : 'uploading',
    isCitySupported: data.is_city_supported ?? false,
    needsManualReview: false,
    reviewReason: undefined,
    editableFields: data.editable_fields ?? undefined,
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
  if (request.tenantName) body.tenant_name = request.tenantName;
  if (request.landlordName) body.landlord_name = request.landlordName;
  if (request.propertyAddress) body.property_address = request.propertyAddress;
  if (request.propertyCity) body.property_city = request.propertyCity;
  if (request.propertyState) body.property_state = request.propertyState;
  if (request.propertyPincode) body.property_pincode = request.propertyPincode;
  if (request.monthlyRentPaise) body.monthly_rent_paise = request.monthlyRentPaise;
  if (request.securityDepositPaise) body.security_deposit_paise = request.securityDepositPaise;
  if (request.rentDueDay) body.rent_due_day = request.rentDueDay;
  if (request.leaseStartDate) body.lease_start_date = request.leaseStartDate;
  if (request.leaseEndDate) body.lease_end_date = request.leaseEndDate;
  if (request.landlordPhone) body.landlord_phone = request.landlordPhone;
  if (request.landlordEmail) body.landlord_email = request.landlordEmail;

  const { data, error } = await callEdgeFunction<RawConfirmExtractionResponse>(
    'confirm-extraction',
    body,
    true, // requireAuth
    'POST'
  );

  if (error) {
    return { data: null, error: mapAgreementError(error) };
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

  const { data, error } = await callEdgeFunction<RawUpdateExtractionResponse>(
    'update-extraction',
    body,
    true, // requireAuth
    'POST'
  );

  if (error) {
    return { data: null, error: mapAgreementError(error) };
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
// ERROR MAPPING
// ==============================================

function mapAgreementError(errorMessage: string): AgreementError {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('not authenticated') || lower.includes('unauthorized') || lower.includes('missing authorization')) {
    return { code: 'NOT_AUTHENTICATED', message: 'Please sign in to continue' };
  }
  if (lower.includes('invalid file type') || lower.includes('file type')) {
    return { code: 'INVALID_FILE_TYPE', message: 'Please upload a PDF file' };
  }
  if (lower.includes('file too large') || lower.includes('maximum size')) {
    return { code: 'FILE_TOO_LARGE', message: 'File is too large. Maximum size is 50MB.' };
  }
  if (lower.includes('processing in progress') || lower.includes('current extraction')) {
    return { code: 'PROCESSING_IN_PROGRESS', message: 'A document is already being processed. Please wait.' };
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
    return { code: 'OCR_FAILED', message: 'Failed to read the document. Please try again.' };
  }

  return mapAgreementError(message);
}

// ==============================================
// MOCK DATA FOR DEVELOPMENT
// ==============================================

export function getMockExtractedAgreementData(): ExtractedAgreementData {
  return {
    extractionId: 'mock-extraction-id',
    propertyName: '2BHK, Koramangala',
    propertyAddress: 'Block A, Flat 306, Whitefield Main Road',
    propertyCity: 'Bangalore',
    propertyState: 'Karnataka',
    propertyPincode: '560066',
    micromarket: 'Koramangala',
    monthlyRentPaise: 3217500, // Rs 32,175
    securityDepositPaise: 9652500, // Rs 96,525
    maintenancePaise: 500000,
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-11-30',
    rentDurationMonths: 11,
    rentDueDay: 5,
    rentEscalationPercent: 5,
    tenantNames: ['John Doe'],
    landlordNames: ['Jane Smith'],
    confidenceScore: 92,
    certificateNo: 'KIA 123456789',
    contractStatus: 'user_review',
    isCitySupported: true,
    needsManualReview: false,
    editableFields: ['property_address', 'tenant_name', 'landlord_name'],
  };
}

export function getMockProcessResult(): ProcessDocumentResult {
  return {
    success: true,
    extractionId: 'mock-extraction-id',
    confidenceScore: 92,
    needsManualReview: false,
    contractStatus: 'user_review',
    isCitySupported: true,
    extractionStatus: 'completed',
    fieldsExtracted: 20,
    totalFields: 24,
  };
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
