// ============================================
// INTERFACES & TYPES — ported from process-document edge function
// ============================================

export interface ExtractedData {
  // Property details
  property_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_pincode?: string;
  micromarket?: string;
  area_name?: string;

  // Financial details (in paise)
  monthly_rent_paise?: number;
  security_deposit_paise?: number;
  maintenance_paise?: number;

  // Contract details
  lease_start_date?: string;
  lease_end_date?: string;
  contract_length_months?: number;
  rent_escalation_percent?: number;
  rent_due_day?: number;
  rent_grace_period_days?: number;

  // Parties
  tenant_names: string[];
  landlord_names: string[];
  tenants: Array<{ name: string; phone?: string; email?: string }>;
  landlords: Array<{ name: string; phone?: string; email?: string }>;

  // Metadata
  agreement_date?: string;
  registration_number?: string;

  // E-stamp / Stamp paper details
  certificate_no?: string;
  certificate_issued_date?: string;
  account_reference?: string;
  purchased_by?: string;
  description_of_document?: string;
  first_party?: string;
  second_party?: string;
  stamp_duty_paid_by?: string;
  consideration_price_paise?: number;
  stamp_duty_amount_paise?: number;

  // Extraction quality
  confidence_score: number;
  gemini_verification_score?: number;
  fields_extracted: number;
  total_fields: number;
  extraction_method: 'gcp_doc_ai' | 'gemini_only' | 'combined';

  // Raw data for debugging
  raw_doc_ai_data: object;
  raw_gemini_data?: object;

  // Runtime-only fields (not on interface in source, accessed via `as any`)
  is_rental_agreement?: boolean;
  document_type_detected?: string;
  rejection_reason?: string;
  gemini_debug?: object;
  rooms_in_agreement?: number | null;
  property_bhk_type?: string | null;
}

export interface ProcessingResult {
  success: boolean;
  extracted_rental_info_id?: string;
  confidence_score: number;
  needs_manual_review: boolean;
  review_reason?: string;
  contract_status: string;
  is_city_supported: boolean;
  // Fields expected by iOS app (matching DocumentProcessingResponse CodingKeys)
  extraction_status?: string;
  requires_manual_review?: boolean;
  manual_review_reason?: string;
  fields_extracted?: number;
  total_fields?: number;
  error?: string;
  _debug?: object;
}

export interface ExtractionRequest {
  extraction_id: string;
  user_id: string;
}

export interface DocumentAIResult {
  /** Full text extracted via OCR */
  documentText: string;
  /** Parsed entities from Document AI (may be empty for OCR-only processors) */
  extractedData: ExtractedData;
  /** Raw Document AI response (slimmed) */
  rawResponse: object;
}

export interface ExtractionResult {
  success: boolean;
  extractionId: string;
  fieldsExtracted: number;
  confidenceScore: number;
  contractStatus: string;
  extractionMethod: string;
  needsManualReview: boolean;
  reviewReason?: string;
  isCitySupported: boolean;
  error?: string;
}

export interface EvaluationResult {
  needs_manual_review: boolean;
  review_reason?: string;
  contract_status: string;
  missing_fields?: string[];
}

export interface GeminiDebug {
  text_length: number;
  gemini_attempted: boolean;
  vertex_ai_attempted: boolean;
  vertex_ai_success: boolean;
  vertex_ai_error: string | null;
  api_key_attempted: boolean;
  api_key_success: boolean;
  api_key_error: string | null;
  final_result_keys: number;
  mode?: string;
  multimodal_skipped?: string;
  fallback_delegated?: boolean;
  vertex_ai_retried?: boolean;
  vertex_ai_retry_attempt?: number;
  vertex_ai_retry_error?: string;
}
