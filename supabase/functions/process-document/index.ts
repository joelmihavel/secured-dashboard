// Supabase Edge Function: process-document
// Description: Process uploaded rent agreement documents using GCP Document AI + Gemini Pro
// Features:
// - PDF-only validation
// - GCP Document AI OCR for initial extraction
// - Gemini Pro for verification and enhanced extraction
// - City validation against supported cities
// - Comprehensive error handling for all scenarios
// - Status updates for UI feedback

import { createClient } from "npm:@supabase/supabase-js@2";
import { ensureWaitlistState, finalizeExtractionForOnboarding } from "../_shared/onboarding.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// ============================================
// INTERFACES
// ============================================

interface ProcessDocumentRequest {
  // V2 parameters (preferred)
  extraction_id?: string;
  // V1 parameters (legacy support)
  waitlist_entry_id?: string;
  document_path?: string;
}

interface ExtractedData {
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
}

interface ProcessingResult {
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

// Total expected fields for extraction (including e-stamp fields + rent_due_day)
const TOTAL_EXTRACTION_FIELDS = 24;

// Minimum required fields for successful extraction (user_review status)
// These are critical fields without which extraction is considered incomplete
const MINIMUM_REQUIRED_FIELDS = [
  'property_name',      // Property Name
  'property_state',     // State (or inferrable from city)
  'property_city',      // City
  'property_pincode',   // Pincode
  'tenant_names',       // Tenant(s) Name
  'landlord_names',     // Landlord(s) Name
  'monthly_rent_paise', // Monthly Rent
  'security_deposit_paise', // Security Deposit
  'lease_start_date',   // Rent Start Date
  'certificate_no',     // Certificate No.
] as const;

/**
 * Check if all minimum required fields are present in extracted data
 * Returns { isComplete: boolean, missingFields: string[] }
 */
function validateMinimumRequiredFields(data: Partial<ExtractedData>): {
  isComplete: boolean;
  missingFields: string[];
  extractedCount: number;
} {
  const missingFields: string[] = [];
  let extractedCount = 0;

  // Property Name
  if (data.property_name && data.property_name.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Property Name');
  }

  // State (can be inferred from city)
  if (data.property_state && data.property_state.trim()) {
    extractedCount++;
  } else {
    missingFields.push('State');
  }

  // City
  if (data.property_city && data.property_city.trim()) {
    extractedCount++;
  } else {
    missingFields.push('City');
  }

  // Pincode
  if (data.property_pincode && data.property_pincode.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Pincode');
  }

  // Tenant Names
  if (data.tenant_names && data.tenant_names.length > 0 && data.tenant_names[0]) {
    extractedCount++;
  } else {
    missingFields.push('Tenant Name(s)');
  }

  // Landlord Names
  if (data.landlord_names && data.landlord_names.length > 0 && data.landlord_names[0]) {
    extractedCount++;
  } else {
    missingFields.push('Landlord Name(s)');
  }

  // Monthly Rent
  if (data.monthly_rent_paise && data.monthly_rent_paise > 0) {
    extractedCount++;
  } else {
    missingFields.push('Monthly Rent');
  }

  // Security Deposit
  if (data.security_deposit_paise && data.security_deposit_paise > 0) {
    extractedCount++;
  } else {
    missingFields.push('Security Deposit');
  }

  // Lease Start Date
  if (data.lease_start_date && data.lease_start_date.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Rent Start Date');
  }

  // Certificate No.
  if (data.certificate_no && data.certificate_no.trim()) {
    extractedCount++;
  } else {
    missingFields.push('Certificate No.');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    extractedCount
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = (Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY"))!;
  const supabaseServiceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;

  // Create service role client outside try block so it's accessible in catch
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let extraction_id: string | undefined;
  let completedExtractionPersisted = false;

  try {
    // Validate auth header (required by Supabase Edge Functions)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Missing authorization header" }, 401);
    }

    // Verify user JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("[process-document] Auth error:", authError);
      return jsonResponse({ success: false, error: "Unauthorized" }, 401);
    }

    console.log(`[process-document] Authenticated user: ${user.id}`);

    const body = await req.json();

    // V2: Accept extraction_id (from iOS app) OR V1: waitlist_entry_id + document_path
    extraction_id = body.extraction_id || body.waitlist_entry_id;
    let document_path = body.document_path;

    if (!extraction_id) {
      return jsonResponse({ error: "Missing extraction_id" }, 400);
    }

    console.log(`[process-document] Processing document for extraction: ${extraction_id}`);

    // Fetch extraction record — needed for document_path lookup AND idempotency guard
    const { data: extractionRecord, error: lookupError } = await supabase
      .from("extracted_rental_info")
      .select("document_storage_path, extraction_status, user_verified")
      .eq("id", extraction_id)
      .single();

    if (lookupError || !extractionRecord) {
      console.error("[process-document] Failed to find extraction record:", lookupError);
      return jsonResponse({
        error: "Extraction record not found",
        extraction_id
      }, 404);
    }

    // Idempotency guard: skip if already completed or abandoned
    if (extractionRecord.extraction_status === "completed") {
      console.log(`[process-document] Extraction ${extraction_id} already completed — skipping re-processing`);
      return jsonResponse({
        success: true,
        extracted_rental_info_id: extraction_id,
        message: "Already processed",
        extraction_status: "completed",
      }, 200);
    }
    if (extractionRecord.user_verified) {
      console.log(`[process-document] Extraction ${extraction_id} was abandoned (user_verified=true) — skipping`);
      return jsonResponse({
        success: false,
        error: "Extraction was abandoned",
        extraction_id,
      }, 409);
    }

    if (!document_path) {
      document_path = extractionRecord.document_storage_path;
      console.log(`[process-document] Found document path: ${document_path}`);
    }

    if (!document_path) {
      return jsonResponse({ error: "No document path found for this extraction" }, 400);
    }

    // Update status to processing
    await updateExtractionStatus(supabase, extraction_id, {
      extraction_status: "processing",
    });

    // Validate PDF-only (critical requirement)
    if (!document_path.toLowerCase().endsWith('.pdf')) {
      await updateExtractionStatus(supabase, extraction_id, {
        extraction_status: "failed",
        extraction_error: "Only PDF documents are allowed",
      });

      return jsonResponse({
        success: false,
        error: "Only PDF documents are allowed",
        error_code: "INVALID_FILE_TYPE",
      }, 400);
    }

    // Download document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("rent-agreements")
      .download(document_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download document: ${downloadError?.message}`);
    }

    // Convert to base64 (chunked to avoid stack overflow for large files)
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = arrayBufferToBase64(arrayBuffer);

    // Get GCP credentials
    // Document AI uses secured-by-flent project
    const gcpCredentials = Deno.env.get("GCP_DOCUMENT_AI_CREDENTIALS");
    const gcpProjectId = Deno.env.get("GCP_PROJECT_ID") || "secured-by-flent";
    const gcpProcessorId = Deno.env.get("GCP_PROCESSOR_ID");
    const gcpLocation = Deno.env.get("GCP_LOCATION") || "us";

    // Vertex AI for Secured - uses Flent AI APIs project (flent-ai-project-2)
    // Primary: Vertex AI with dedicated service account
    // Fallback: Gemini API key
    const vertexAiCredentials = Deno.env.get("VERTEX_AI_CREDENTIALS");
    const vertexAiProjectId = Deno.env.get("VERTEX_AI_PROJECT_ID") || "flent-ai-project-2";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY_SECURED") || Deno.env.get("GEMINI_API_KEY");

    // Debug: Log configuration (masking sensitive values)
    console.log("[process-document] Config:", {
      hasGcpCredentials: !!gcpCredentials,
      gcpProjectId,
      hasProcessorId: !!gcpProcessorId,
      gcpLocation,
      hasVertexAiCredentials: !!vertexAiCredentials,
      vertexAiProjectId,
      hasGeminiApiKey: !!geminiApiKey,
      geminiApiKeyPrefix: geminiApiKey ? geminiApiKey.substring(0, 10) + "..." : "NOT SET",
    });

    let extractedData: ExtractedData;

    // Each API call (Document AI, Gemini) has its own 300s timeout via AbortController
    // inside processWithDocumentAI, so no outer Promise.race needed.
    // This allows large documents to use the full budget for each step independently.

    if (gcpCredentials && gcpProcessorId) {
      // Production: Use GCP Document AI + Vertex AI Gemini
      extractedData = await processWithDocumentAI(
        base64Content,
        "application/pdf",
        gcpCredentials,
        gcpProjectId,
        gcpProcessorId,
        gcpLocation,
        vertexAiCredentials,
        vertexAiProjectId,
        geminiApiKey
      );
    } else if (!gcpCredentials) {
      return new Response(
        JSON.stringify({ error: "Document processing not configured", code: "SERVICE_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Has GCP credentials but no processor ID
      return new Response(
        JSON.stringify({ error: "Document processor not configured", code: "SERVICE_UNAVAILABLE" }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if city is supported
    const { data: supportedCities } = await supabase
      .from("supported_cities")
      .select("city_name")
      .eq("is_active", true);

    const isCitySupported = checkCitySupported(
      extractedData.property_city,
      supportedCities?.map(c => c.city_name) || []
    );

    // Derive lease_end_date from lease_start_date + duration when missing
    if (!extractedData.lease_end_date && extractedData.lease_start_date && extractedData.contract_length_months) {
      const start = new Date(extractedData.lease_start_date);
      if (!isNaN(start.getTime())) {
        start.setMonth(start.getMonth() + extractedData.contract_length_months);
        extractedData.lease_end_date = start.toISOString().split('T')[0];
        console.log(`[process-document] Derived lease_end_date=${extractedData.lease_end_date} from start=${extractedData.lease_start_date} + ${extractedData.contract_length_months} months`);
      }
    }

    // Evaluate extraction result using minimum required fields validation
    const evaluationResult = evaluateExtraction(
      extractedData.fields_extracted,
      extractedData.total_fields,
      extractedData.confidence_score,
      isCitySupported,
      extractedData  // Pass full extracted data for minimum fields validation
    );

    // Structured quality log for operator visibility
    console.log("[process-document] Extraction quality:", JSON.stringify({
      extraction_id,
      fields: `${extractedData.fields_extracted}/${extractedData.total_fields}`,
      confidence: extractedData.confidence_score,
      contract_status: evaluationResult.contract_status,
      needs_manual_review: evaluationResult.needs_manual_review,
      city_supported: isCitySupported,
      has_rent: !!extractedData.monthly_rent_paise,
      has_deposit: !!extractedData.security_deposit_paise,
      has_tenant: (extractedData.tenant_names?.length ?? 0) > 0,
      has_landlord: (extractedData.landlord_names?.length ?? 0) > 0,
      has_lease_end: !!extractedData.lease_end_date,
      missing: evaluationResult.missing_fields ?? [],
    }));

    // Store extracted data - update the existing extraction record
    const { data: rentalInfo, error: insertError } = await supabase
      .from("extracted_rental_info")
      .update({
        property_name: extractedData.property_name,
        property_address: extractedData.property_address,
        property_city: extractedData.property_city,
        property_state: extractedData.property_state,
        property_pincode: extractedData.property_pincode,
        micromarket: extractedData.micromarket || extractedData.area_name,
        monthly_rent_paise: extractedData.monthly_rent_paise,
        security_deposit_paise: extractedData.security_deposit_paise,
        maintenance_paise: extractedData.maintenance_paise,
        lease_start_date: extractedData.lease_start_date,
        lease_end_date: extractedData.lease_end_date,
        rent_duration_months: extractedData.contract_length_months,
        rent_escalation_percent: extractedData.rent_escalation_percent,
        rent_due_day: extractedData.rent_due_day,
        agreement_date: extractedData.agreement_date,
        registration_number: extractedData.registration_number,
        // E-stamp fields
        certificate_no: extractedData.certificate_no,
        certificate_issued_date: extractedData.certificate_issued_date,
        account_reference: extractedData.account_reference,
        purchased_by: extractedData.purchased_by,
        description_of_document: extractedData.description_of_document,
        first_party: extractedData.first_party,
        second_party: extractedData.second_party,
        stamp_duty_paid_by: extractedData.stamp_duty_paid_by,
        consideration_price_paise: extractedData.consideration_price_paise,
        stamp_duty_amount_paise: extractedData.stamp_duty_amount_paise,
        // Room/BHK fields
        rooms_in_agreement: (extractedData as any).rooms_in_agreement || null,
        property_bhk_type: (extractedData as any).property_bhk_type || null,
        // Quality metrics
        confidence_score: extractedData.confidence_score,
        gemini_verification_score: extractedData.gemini_verification_score,
        fields_extracted: extractedData.fields_extracted,
        // Direct columns (not in raw_extraction_data)
        tenant_names: extractedData.tenant_names,
        tenant_name: extractedData.tenant_names?.[0] ?? null,
        landlord_names: extractedData.landlord_names,
        landlord_name: extractedData.landlord_names?.length
          ? extractedData.landlord_names.join(" & ")
          : null,
        extraction_method: extractedData.extraction_method,
        is_city_supported: isCitySupported,
        gemini_raw_response: extractedData.raw_gemini_data || (extractedData as any).gemini_debug || null,
        // Raw data for debugging (slimmed to avoid statement timeouts on large docs)
        raw_extraction_data: slimDocAiData(extractedData.raw_doc_ai_data),
        // Update extraction status — mark as extraction_failed if Gemini returned 0 fields
        extraction_status: extractedData.fields_extracted > 0 ? "completed" : "extraction_failed",
        // Persist evaluation results for client-side polling (useExtractionStatus)
        contract_status: evaluationResult.contract_status,
        needs_manual_review: evaluationResult.needs_manual_review,
      })
      .eq("id", extraction_id)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to store extracted data: ${insertError.message}`);
    }

    completedExtractionPersisted = true;

    // NOTE: rental_parties is a VIEW (UNION ALL on extracted_rental_info tenant/landlord columns),
    // not a table. Party data is already stored in tenant_names/landlord_names arrays and
    // tenant_name/landlord_name singular columns on extracted_rental_info. No separate insert needed.

    // Geocode the property address (non-blocking - errors don't fail extraction)
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (googleMapsApiKey && extractedData.property_address) {
      try {
        await geocodePropertyAddress(
          supabase,
          extraction_id,
          extractedData,
          googleMapsApiKey
        );
      } catch (geocodeError) {
        // Log but don't fail extraction due to geocoding errors
        console.error("[process-document] Geocoding failed (non-fatal):", geocodeError);
      }
    }

    const resolvedExtractionStatus = extractedData.fields_extracted > 0 ? "completed" : "extraction_failed";

    const shouldAutoFinalize =
      extractedData.fields_extracted > 0
      && (evaluationResult.contract_status === "user_review"
        || evaluationResult.contract_status === "manual_review");

    if (shouldAutoFinalize && rentalInfo?.user_id) {
      await finalizeExtractionForOnboarding({
        supabase,
        userId: rentalInfo.user_id,
        extractionId: extraction_id,
        confirmedRole: "tenant",
        syncWaitlistFields: {
          extraction_status: resolvedExtractionStatus,
          contract_status: evaluationResult.contract_status,
        },
        autoApproveDemo: true,
      });
    } else {
      await updateWaitlistEntries(supabase, rentalInfo?.user_id, {
        extraction_status: resolvedExtractionStatus,
        contract_status: evaluationResult.contract_status,
      });
    }

    const result: ProcessingResult = {
      success: true,
      extracted_rental_info_id: extraction_id,
      confidence_score: extractedData.confidence_score,
      needs_manual_review: evaluationResult.needs_manual_review,
      review_reason: evaluationResult.review_reason,
      contract_status: evaluationResult.contract_status,
      is_city_supported: isCitySupported,
      // Fields expected by iOS app (matching CodingKeys)
      extraction_status: resolvedExtractionStatus,
      requires_manual_review: evaluationResult.needs_manual_review,
      manual_review_reason: evaluationResult.review_reason,
      fields_extracted: extractedData.fields_extracted,
      // total_fields omitted — column doesn't exist in DB, value is constant (24)
      // Debug fields
      _debug: {
        extraction_method: extractedData.extraction_method,
        property_city: extractedData.property_city,
        monthly_rent_paise: extractedData.monthly_rent_paise,
        document_text_length: (extractedData.raw_doc_ai_data as any)?.document?.text?.length || 0,
        gemini: (extractedData as any).gemini_debug || { note: "gemini_debug not found" },
      }
    };

    return jsonResponse(result);

  } catch (error) {
    console.error("[process-document] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update status to failed with error details for client-side display
    if (extraction_id && !completedExtractionPersisted) {
      await updateExtractionStatus(supabase, extraction_id, {
        extraction_status: "failed",
        extraction_error: errorMessage,
      });
    } else if (extraction_id && completedExtractionPersisted) {
      await updateExtractionStatus(supabase, extraction_id, {
        extraction_error: errorMessage,
      });
    }

    return jsonResponse({
      success: false,
      error: errorMessage,
      error_code: categorizeError(errorMessage),
    }, 500);
  }
});

// ============================================
// GCP DOCUMENT AI + GEMINI PRO PROCESSING
// ============================================

async function processWithDocumentAI(
  base64Content: string,
  mimeType: string,
  credentials: string,
  projectId: string,
  processorId: string,
  location: string,
  vertexAiCredentials?: string,
  vertexAiProjectId?: string,
  geminiApiKey?: string
): Promise<ExtractedData> {
  const credentialsJson = JSON.parse(credentials);

  // Get access token for Document AI
  const accessToken = await getGCPAccessToken(credentialsJson);

  // Step 1: Call Document AI for OCR — 300s independent timeout
  console.log("[process-document] Calling GCP Document AI...");
  const DOC_AI_TIMEOUT_MS = 300_000;
  const docAIController = new AbortController();
  const docAITimeout = setTimeout(() => docAIController.abort(), DOC_AI_TIMEOUT_MS);
  let docAIResponse: Response;
  try {
    docAIResponse = await fetch(
      `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawDocument: {
            content: base64Content,
            mimeType: mimeType,
          },
          // Bug 2 fix: Enable imageless mode (raises page limit from 15 to 30)
          // and cap at first 30 pages to avoid PAGE_LIMIT_EXCEEDED for large docs
          processOptions: {
            ocrConfig: {
              premiumFeatures: { computeStyleInfo: false },
            },
            fromStart: 30,
          },
        }),
        signal: docAIController.signal,
      }
    );
  } catch (err: unknown) {
    clearTimeout(docAITimeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Document AI timed out after ${DOC_AI_TIMEOUT_MS / 1000}s — document may be too large`);
    }
    throw err;
  }
  clearTimeout(docAITimeout);

  if (!docAIResponse.ok) {
    const errorText = await docAIResponse.text();
    throw new Error(`Document AI failed: ${errorText}`);
  }

  const docAIResult = await docAIResponse.json();
  const documentText = docAIResult.document?.text || "";

  // Parse initial extraction from entities (may be empty for OCR-only processors)
  let extractedData = parseDocumentAIResponse(docAIResult);

  // Debug tracking for Gemini flow
  const geminiDebug: any = {
    text_length: documentText.length,
    gemini_attempted: false,
    vertex_ai_attempted: false,
    vertex_ai_success: false,
    vertex_ai_error: null,
    api_key_attempted: false,
    api_key_success: false,
    api_key_error: null,
    final_result_keys: 0,
  };

  // Step 2: Use Gemini to extract/verify if text exists
  // Try Vertex AI first (uses dedicated service account for flent-ai-project-2), then fall back to API key
  if (documentText.length > 100) {
    geminiDebug.gemini_attempted = true;
    console.log("[process-document] Document text extracted, using Gemini for entity extraction...");
    console.log(`[process-document] Text length: ${documentText.length} chars`);

    let geminiResult: any = null;

    // Try Vertex AI Gemini with dedicated credentials (flent-ai-project-2)
    // Uses GLOBAL endpoint with provisioned throughput
    if (vertexAiCredentials && vertexAiProjectId) {
      try {
        geminiDebug.vertex_ai_attempted = true;
        console.log(`[process-document] Attempting Vertex AI Gemini GLOBAL (project: ${vertexAiProjectId})...`);

        // Get separate access token for Vertex AI service account
        const vertexCredentialsJson = JSON.parse(vertexAiCredentials);
        const vertexAccessToken = await getGCPAccessToken(vertexCredentialsJson);

        geminiResult = await extractWithVertexAIGemini(
          documentText,
          vertexAccessToken,
          vertexAiProjectId,
          "global"  // Use global endpoint — provisioned throughput
        );
        geminiDebug.vertex_ai_success = true;
        geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
      } catch (vertexError: any) {
        geminiDebug.vertex_ai_error = vertexError.message || String(vertexError);
        console.error("[process-document] Vertex AI Gemini failed:", vertexError.message || vertexError);
        // Retry up to 2 times on "No JSON found" / empty response (safety filter flakiness on PII-heavy docs)
        if (vertexError.message?.includes("No JSON found") || vertexError.message?.includes("empty response")) {
          const maxRetries = 2;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[process-document] Retrying Vertex AI (attempt ${attempt}/${maxRetries}) after 3s (possible safety filter flake)...`);
            await new Promise(r => setTimeout(r, 3000));
            try {
              const retryToken = await getGCPAccessToken(vertexCredentialsJson);
              geminiResult = await extractWithVertexAIGemini(documentText, retryToken, vertexAiProjectId, "global");
              geminiDebug.vertex_ai_success = true;
              geminiDebug.vertex_ai_retried = true;
              geminiDebug.vertex_ai_retry_attempt = attempt;
              geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
              break; // Success — exit retry loop
            } catch (retryError: any) {
              geminiDebug.vertex_ai_retry_error = retryError.message || String(retryError);
              console.error(`[process-document] Vertex AI retry attempt ${attempt} failed:`, retryError.message);
              if (attempt === maxRetries) {
                console.error("[process-document] Vertex AI exhausted all retry attempts");
              }
            }
          }
        }
      }
    } else {
      geminiDebug.vertex_ai_error = "No VERTEX_AI_CREDENTIALS configured";
      console.log("[process-document] Vertex AI credentials not configured, skipping...");
    }

    // Fall back to API key if Vertex AI failed or not configured
    if (!geminiResult && geminiApiKey) {
      geminiDebug.api_key_attempted = true;
      console.log("[process-document] Falling back to Gemini API key...");
      console.log(`[process-document] API key prefix: ${geminiApiKey.substring(0, 10)}...`);
      try {
        geminiResult = await verifyWithGemini(
          documentText,
          extractedData,
          geminiApiKey
        );
        geminiDebug.api_key_success = true;
        geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
        console.log("[process-document] API key Gemini result:", JSON.stringify(geminiResult).substring(0, 500));
      } catch (apiKeyError: any) {
        geminiDebug.api_key_error = apiKeyError.message || String(apiKeyError);
        console.error("[process-document] API key Gemini failed:", apiKeyError.message || apiKeyError);
        // Retry up to 2 times on "No JSON found" / empty response (safety filter flakiness)
        if (apiKeyError.message?.includes("No JSON found") || apiKeyError.message?.includes("empty response")) {
          const maxRetries = 2;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`[process-document] Retrying API key Gemini (attempt ${attempt}/${maxRetries}) after 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            try {
              geminiResult = await verifyWithGemini(documentText, extractedData, geminiApiKey);
              geminiDebug.api_key_success = true;
              geminiDebug.api_key_retried = true;
              geminiDebug.api_key_retry_attempt = attempt;
              geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
              break; // Success — exit retry loop
            } catch (retryError: any) {
              geminiDebug.api_key_retry_error = retryError.message || String(retryError);
              console.error(`[process-document] API key retry attempt ${attempt} failed:`, retryError.message);
              if (attempt === maxRetries) {
                console.error("[process-document] API key Gemini exhausted all retry attempts");
              }
            }
          }
        }
      }
    } else if (!geminiResult) {
      geminiDebug.api_key_error = "No GEMINI_API_KEY_SECURED set";
      console.warn("[process-document] No Gemini fallback available. Entity extraction limited.");
    }

    console.log("[process-document] Final geminiResult:", geminiResult ? Object.keys(geminiResult).length + " keys" : "null");
    console.log("[process-document] Gemini debug:", JSON.stringify(geminiDebug));

    if (geminiResult && Object.keys(geminiResult).length > 0) {
      // Check document classification before merging extraction fields
      if (geminiResult.is_rental_agreement === false) {
        const detectedType = geminiResult.document_type_detected || 'unknown';
        const reason = geminiResult.rejection_reason || `This does not appear to be a rental agreement (detected: ${detectedType}).`;
        console.log(`[process-document] Document rejected: not a rental agreement. Type: ${detectedType}`);
        // Store classification in extractedData so it's persisted for debugging
        (extractedData as any).is_rental_agreement = false;
        (extractedData as any).document_type_detected = detectedType;
        (extractedData as any).rejection_reason = reason;
        (extractedData as any).gemini_debug = geminiDebug;
        return extractedData;
      }

      // Merge Gemini results
      extractedData = mergeGeminiResults(extractedData, geminiResult);
      extractedData.extraction_method = 'combined';
      console.log(`[process-document] Gemini extraction: ${extractedData.fields_extracted} fields extracted`);
    }
  }

  // Store gemini debug in extractedData for debugging
  (extractedData as any).gemini_debug = geminiDebug;

  return extractedData;
}

async function getGCPAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  console.log("[process-document] Creating JWT for service account:", credentials.client_email);
  const jwt = await createJWT(credentials);
  console.log("[process-document] JWT created, exchanging for access token...");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenResult = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenResult.access_token) {
    console.error("[process-document] Token exchange failed:", JSON.stringify(tokenResult));
    throw new Error(`Failed to get GCP access token: ${tokenResult.error_description || tokenResult.error || 'Unknown error'}`);
  }

  console.log("[process-document] Access token obtained successfully");
  return tokenResult.access_token;
}

// Base64URL encoding (required for JWT - different from standard base64)
function base64url(data: string | Uint8Array): string {
  let base64: string;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...data));
  }
  // Convert to base64url: replace + with -, / with _, and remove padding =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(credentials: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  // Use base64url encoding for JWT (not standard base64)
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const pemContents = credentials.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  // Use base64url for signature as well
  const signatureB64 = base64url(new Uint8Array(signature));
  return `${signatureInput}.${signatureB64}`;
}

// ============================================
// VERTEX AI GEMINI (uses GCP service account)
// ============================================

async function extractWithVertexAIGemini(
  documentText: string,
  accessToken: string,
  projectId: string,
  location: string
): Promise<object> {
  const prompt = `You are analyzing a document that the user claims is an Indian rental/lease agreement. First determine if it actually IS a rental/lease agreement, then extract information.

DOCUMENT TEXT:
${documentText.substring(0, 50000)}

Extract and return a JSON object with these exact fields (use null for fields you cannot find):
{
  "is_rental_agreement": true/false,
  "document_type_detected": "what type of document this actually is (e.g., 'Rental Agreement', 'Leave and License', 'Sale Deed', 'Bank Statement', 'Invoice', 'Resume', 'Unknown')",
  "rejection_reason": "if is_rental_agreement is false, explain why (e.g., 'This appears to be a bank statement, not a rental agreement'). null if is_rental_agreement is true",
  "property_name": "SHORT display name: 'Flat/House#, Society/Complex Name, Locality, Pincode, City'. Example: 'Flat 301, Panchavati Apartments, Indiranagar, 560008, Bangalore'. If no society/complex name, use street: '815, 1st Cross Road, Whitefield, 560066, Bangalore'. MUST be concise — no full address here. MUST NOT repeat the same segment twice (e.g. never 'Flat No. 301, Flat No. 301, ...'). Each comma-separated part must be unique.",
  "property_address": "FULL verbose address as written in the agreement (all lines, landmarks, etc). This is the complete legal address, NOT a display name.",
  "property_city": "city name (e.g., Bangalore, Bengaluru, Mumbai, Delhi)",
  "property_state": "state name (e.g., Karnataka, Maharashtra, Delhi) - infer from city/address if not explicit",
  "property_pincode": "6-digit pincode",
  "micromarket": "locality/area (e.g., Whitefield, Koramangala, HSR Layout, Richmond Town)",
  "monthly_rent": "number only in rupees (e.g., 60000 for Rs. 60,000)",
  "security_deposit": "number only in rupees (e.g., 200000 for Rs. 2,00,000)",
  "rent_escalation_percent": "annual escalation percentage as number (e.g., 5 for 5%)",
  "contract_start_date": "YYYY-MM-DD format",
  "contract_end_date": "YYYY-MM-DD format",
  "contract_length_months": "duration in months as number",
  "rent_due_day": "day of month when rent is due (e.g., 1, 5, 10) - look for phrases like 'rent payable on 5th of every month'",
  "tenant_names": ["array of tenant/lessee names"],
  "landlord_names": ["array of landlord/lessor/owner names"],
  "certificate_no": "certificate number from e-stamp or stamp paper. IMPORTANT: For Mumbai/Maharashtra agreements, the GRN (Government Receipt Number) or Transaction ID serves as the Stamp Certificate ID - if you see 'GRN', 'Transaction ID', or 'Transaction No.' in a Mumbai document, use that as certificate_no. For other states, look for 'Certificate No.' or 'Cert. No.'",
  "certificate_issued_date": "YYYY-MM-DD format - date when stamp certificate was issued",
  "account_reference": "account reference number from e-stamp",
  "purchased_by": "name of person who purchased the stamp paper",
  "description_of_document": "type of document (e.g., 'Rental Agreement', 'Lease Deed', 'Leave and License')",
  "first_party": "first party name as mentioned on stamp paper (usually lessor/landlord)",
  "second_party": "second party name as mentioned on stamp paper (usually lessee/tenant)",
  "stamp_duty_paid_by": "who paid the stamp duty (tenant/landlord/both)",
  "consideration_price": "consideration amount in rupees (numeric value only)",
  "stamp_duty_amount": "stamp duty paid in rupees (numeric value only)",
  "rooms_in_agreement": "number of rooms/bedrooms covered by this agreement as a number (e.g., 1 for single room, 2 for 2BHK, 3 for 3BHK). If the agreement covers only a portion of a larger property (e.g., 'one room in a 3BHK flat'), return only the rented portion count. If unclear or full property, infer from BHK type mentioned (1BHK=1, 2BHK=2, 3BHK=3). null if not determinable.",
  "property_bhk_type": "the BHK type of the FULL property (e.g., '1BHK', '2BHK', '3BHK', '4BHK', 'Studio', 'Independent House'). This is the total property size, not just the rented portion. null if not mentioned.",
  "confidence": "your confidence 0-100 that extraction is accurate"
}

IMPORTANT:
- FIRST: Determine is_rental_agreement. Set to true ONLY if the document is a rental agreement, lease deed, leave and license agreement, or tenancy agreement. Set to false for sale deeds, bank statements, invoices, resumes, or any other non-rental document. If false, set all extraction fields to null.
- For amounts, extract only the numeric value (60000 not "Rs. 60,000")
- For dates, convert to YYYY-MM-DD format
- For names, include all parties mentioned in the agreement. IMPORTANT: Each person must be a SEPARATE array element. If a clause says "RAMESH AND SEEMA JOSHI", return ["RAMESH JOSHI", "SEEMA JOSHI"] as two separate entries, not one combined string.
- For e-stamp fields, look in the stamp/e-stamp section of the document (usually at top or bottom with certificate details)
- For property_state: infer from city if not explicitly mentioned (Bangalore→Karnataka, Mumbai→Maharashtra, Delhi→Delhi NCT)
- MUMBAI EDGE CASE: For Mumbai/Maharashtra agreements, the GRN (Government Receipt Number) or Transaction ID/Transaction No. IS the Stamp Certificate ID. If you detect the city is Mumbai/Maharashtra and see a GRN or Transaction ID, use that value as certificate_no.
- For rooms_in_agreement: Look for phrases like "one room", "single bedroom", "2BHK", "3BHK", "entire flat", "portion of the premises". If tenant is renting only a room in a shared flat, return 1. If renting entire 2BHK, return 2.
- Return ONLY the JSON object, no other text.`;

  // Use Vertex AI Gemini endpoint — global endpoint for provisioned throughput
  // Global: https://aiplatform.googleapis.com/v1/projects/.../locations/global/...
  // Regional: https://{location}-aiplatform.googleapis.com/v1/projects/.../locations/{location}/...
  const host = location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-3-flash-preview:generateContent`;

  // 300s timeout — large agreements can produce 50K+ chars of document text
  const GEMINI_TIMEOUT_MS = 300_000;
  const geminiController = new AbortController();
  const geminiTimeout = setTimeout(() => geminiController.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
      signal: geminiController.signal,
    });
  } catch (err: unknown) {
    clearTimeout(geminiTimeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Vertex AI Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }
  clearTimeout(geminiTimeout);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[process-document] Vertex AI Gemini error:", errorText);
    throw new Error(`Vertex AI Gemini failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const finishReason = result.candidates?.[0]?.finishReason;
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  console.log("[process-document] Vertex AI Gemini response:", textContent.substring(0, 500));
  if (finishReason && finishReason !== "STOP") {
    console.error(`[process-document] Vertex AI finishReason: ${finishReason} (candidates: ${JSON.stringify(result.candidates?.map((c: any) => ({ finishReason: c.finishReason, safetyRatings: c.safetyRatings })))})`);
  }

  if (!textContent || textContent === "{}") {
    throw new Error(`Vertex AI Gemini returned empty response (finishReason: ${finishReason || 'unknown'})`);
  }

  // Parse JSON from response (handle markdown code blocks if present)
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Object.keys(parsed).length === 0) {
      throw new Error("Vertex AI Gemini returned empty JSON");
    }
    console.log("[process-document] Vertex AI parsed:", Object.keys(parsed).length, "fields");
    return parsed;
  }

  console.error(`[process-document] No JSON in Vertex AI response. finishReason: ${finishReason}. textContent (first 500): ${textContent.substring(0, 500)}`);
  throw new Error(`No JSON found in Vertex AI Gemini response (finishReason: ${finishReason || 'unknown'})`);
}

// ============================================
// GEMINI PRO VERIFICATION (API key fallback)
// ============================================

async function verifyWithGemini(
  documentText: string,
  initialExtraction: ExtractedData,
  apiKey: string
): Promise<object> {
  // Only include relevant extracted fields, NOT raw_doc_ai_data or raw_gemini_data
  const extractedFields = {
    property_name: initialExtraction.property_name,
    property_address: initialExtraction.property_address,
    property_city: initialExtraction.property_city,
    property_pincode: initialExtraction.property_pincode,
    monthly_rent: initialExtraction.monthly_rent_paise,
    security_deposit: initialExtraction.security_deposit_paise,
    tenant_names: initialExtraction.tenant_names,
    landlord_names: initialExtraction.landlord_names,
  };

  const prompt = `You are analyzing a document that the user claims is an Indian rental/lease agreement. First determine if it actually IS a rental/lease agreement, then extract and verify information.

DOCUMENT TEXT:
${documentText.substring(0, 50000)}

INITIAL EXTRACTION (verify and correct if needed):
${JSON.stringify(extractedFields, null, 2)}

Please extract and return a JSON object with these exact fields:
{
  "is_rental_agreement": true/false,
  "document_type_detected": "what type of document this actually is (e.g., 'Rental Agreement', 'Leave and License', 'Sale Deed', 'Bank Statement', 'Invoice', 'Unknown')",
  "rejection_reason": "if is_rental_agreement is false, explain why. null if true",
  "property_name": "SHORT display name: 'Flat/House#, Society/Complex Name, Locality, Pincode, City'. Example: 'Flat 301, Panchavati Apartments, Indiranagar, 560008, Bangalore'. If no society/complex name, use street: '815, 1st Cross Road, Whitefield, 560066, Bangalore'. MUST be concise — no full address here. MUST NOT repeat the same segment twice. Each comma-separated part must be unique.",
  "property_address": "FULL verbose address as written in the agreement (all lines, landmarks, etc). This is the complete legal address, NOT a display name.",
  "property_city": "city name (e.g., Bangalore, Bengaluru)",
  "property_state": "state name (infer from city if not explicit)",
  "property_pincode": "6-digit pincode",
  "micromarket": "locality/area (e.g., Whitefield, Koramangala, HSR Layout)",
  "monthly_rent": "number in rupees (no currency symbol)",
  "security_deposit": "number in rupees",
  "rent_escalation_percent": "annual escalation % (e.g., 5 for 5%)",
  "contract_start_date": "YYYY-MM-DD format",
  "contract_end_date": "YYYY-MM-DD format",
  "contract_length_months": "number of months",
  "rent_due_day": "day of month when rent is due (e.g., 1, 5, 10)",
  "tenant_names": ["array of tenant names"],
  "landlord_names": ["array of landlord names"],
  "certificate_no": "certificate number from e-stamp or stamp paper. IMPORTANT: For Mumbai/Maharashtra agreements, the GRN (Government Receipt Number) or Transaction ID is the Stamp Certificate ID - use GRN/Transaction ID as certificate_no for Mumbai documents",
  "certificate_issued_date": "YYYY-MM-DD format",
  "account_reference": "account reference from e-stamp",
  "purchased_by": "who purchased the stamp paper",
  "description_of_document": "document type (e.g., Rental Agreement)",
  "first_party": "first party on stamp paper (usually lessor)",
  "second_party": "second party on stamp paper (usually lessee)",
  "stamp_duty_paid_by": "who paid stamp duty",
  "consideration_price": "consideration amount in rupees (number only)",
  "stamp_duty_amount": "stamp duty in rupees (number only)",
  "rooms_in_agreement": "number of rooms/bedrooms covered by this agreement (e.g., 1 for single room, 2 for 2BHK, 3 for 3BHK). If only a portion is rented (e.g., 'one room in a 3BHK'), return the rented portion count. null if not determinable.",
  "property_bhk_type": "BHK type of the FULL property (e.g., '1BHK', '2BHK', '3BHK', 'Studio', 'Independent House'). null if not mentioned.",
  "confidence": "your confidence 0-100 that extraction is accurate"
}

IMPORTANT:
- FIRST: Determine is_rental_agreement. Set to true ONLY for rental agreements, lease deeds, leave and license agreements, or tenancy agreements. Set to false for anything else. If false, set all extraction fields to null.
- For names: Each person must be a SEPARATE array element. "RAMESH AND SEEMA JOSHI" → ["RAMESH JOSHI", "SEEMA JOSHI"]. Never combine multiple people into one string.
- Look for e-stamp fields in the stamp/e-stamp section (usually at top or bottom).
- MUMBAI EDGE CASE: For Mumbai/Maharashtra agreements, the GRN or Transaction ID IS the Stamp Certificate ID.
- For rooms_in_agreement: Look for "one room", "single bedroom", "2BHK", "3BHK", "entire flat", "portion of premises". Partial rent = count rented rooms only.
- Return ONLY the JSON object, no other text.`;

  try {
    console.log("[process-document] Calling Gemini API with key prefix:", apiKey.substring(0, 10) + "...");

    // 300s independent timeout for API key fallback Gemini call
    const FALLBACK_TIMEOUT_MS = 300_000;
    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), FALLBACK_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
            safetySettings: [
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            ],
          }),
          signal: fallbackController.signal,
        }
      );
    } catch (err: unknown) {
      clearTimeout(fallbackTimeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Gemini API key fallback timed out after ${FALLBACK_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    }
    clearTimeout(fallbackTimeout);

    console.log("[process-document] Gemini API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[process-document] Gemini API error response:", errorText);
      throw new Error(`Gemini API failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    const finishReason = result.candidates?.[0]?.finishReason;
    console.log("[process-document] Gemini API raw response:", JSON.stringify(result).substring(0, 1000));
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("[process-document] Gemini text content:", textContent.substring(0, 500));
    if (finishReason && finishReason !== "STOP") {
      console.error(`[process-document] Gemini API finishReason: ${finishReason} (candidates: ${JSON.stringify(result.candidates?.map((c: any) => ({ finishReason: c.finishReason, safetyRatings: c.safetyRatings })))})`);
    }

    if (!textContent) {
      throw new Error(`Gemini API returned empty text content (finishReason: ${finishReason || 'unknown'})`);
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const fieldCount = Object.keys(parsed).length;
      console.log("[process-document] Gemini parsed result:", fieldCount + " fields");
      if (fieldCount === 0) {
        throw new Error("Gemini API returned empty JSON object");
      }
      return parsed;
    }
    console.error(`[process-document] No JSON in Gemini API response. finishReason: ${finishReason}. textContent (first 500): ${textContent.substring(0, 500)}`);
    throw new Error(`No JSON found in Gemini API response (finishReason: ${finishReason || 'unknown'})`);
  } catch (error) {
    console.error("[process-document] Gemini verification error:", error);
    throw error; // Re-throw to trigger proper error handling
  }
}

/** Split joint names like "RAMESH AND SEEMA JOSHI" into individual names */
function splitJointNames(names: string[]): string[] {
  const result: string[] = [];
  for (const name of names) {
    // Split on " AND ", " & ", " / " (case-insensitive, surrounded by spaces)
    const parts = name.split(/\s+(?:AND|&|\/)\s+/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) result.push(trimmed);
    }
  }
  return result;
}

function mergeGeminiResults(docAI: ExtractedData, gemini: any): ExtractedData {
  // Merge results, preferring Gemini for missing fields or corrections
  const merged: ExtractedData = {
    ...docAI,
    property_name: gemini.property_name || docAI.property_name,
    property_address: gemini.property_address || docAI.property_address,
    property_city: gemini.property_city || docAI.property_city,
    property_state: gemini.property_state || docAI.property_state || inferStateFromCity(gemini.property_city || docAI.property_city),
    // Sanitize pincode to 6 digits max (VARCHAR(6) column)
    property_pincode: (gemini.property_pincode || docAI.property_pincode || "")
      .toString().replace(/\D/g, '').substring(0, 6) || undefined,
    micromarket: gemini.micromarket || docAI.micromarket,
    area_name: gemini.micromarket || docAI.area_name,
    // FIX: Convert Gemini rupees to paise (multiply by 100) to match column semantics
    monthly_rent_paise: gemini.monthly_rent
      ? parseInt(String(gemini.monthly_rent)) * 100
      : docAI.monthly_rent_paise,
    security_deposit_paise: gemini.security_deposit
      ? parseInt(String(gemini.security_deposit)) * 100
      : docAI.security_deposit_paise,
    rent_escalation_percent: gemini.rent_escalation_percent != null
      ? Number(gemini.rent_escalation_percent)
      : docAI.rent_escalation_percent,
    lease_start_date: gemini.contract_start_date || docAI.lease_start_date,
    lease_end_date: gemini.contract_end_date || docAI.lease_end_date,
    contract_length_months: gemini.contract_length_months != null
      ? Number(gemini.contract_length_months)
      : docAI.contract_length_months,
    rent_due_day: gemini.rent_due_day != null
      ? Number(gemini.rent_due_day)
      : docAI.rent_due_day,
    tenant_names: gemini.tenant_names?.length > 0
      ? splitJointNames(gemini.tenant_names) : docAI.tenant_names,
    landlord_names: gemini.landlord_names?.length > 0
      ? splitJointNames(gemini.landlord_names) : docAI.landlord_names,
    tenants: gemini.tenant_names?.length > 0
      ? splitJointNames(gemini.tenant_names).map((name: string) => ({ name }))
      : docAI.tenants,
    landlords: gemini.landlord_names?.length > 0
      ? splitJointNames(gemini.landlord_names).map((name: string) => ({ name }))
      : docAI.landlords,
    // E-stamp fields
    certificate_no: gemini.certificate_no || docAI.certificate_no,
    certificate_issued_date: gemini.certificate_issued_date || docAI.certificate_issued_date,
    account_reference: gemini.account_reference || docAI.account_reference,
    purchased_by: gemini.purchased_by || docAI.purchased_by,
    description_of_document: gemini.description_of_document || docAI.description_of_document,
    first_party: gemini.first_party || docAI.first_party,
    second_party: gemini.second_party || docAI.second_party,
    stamp_duty_paid_by: gemini.stamp_duty_paid_by || docAI.stamp_duty_paid_by,
    // FIX: Convert Gemini rupees to paise (multiply by 100) to match column semantics
    consideration_price_paise: gemini.consideration_price
      ? parseInt(String(gemini.consideration_price)) * 100
      : docAI.consideration_price_paise,
    stamp_duty_amount_paise: gemini.stamp_duty_amount
      ? parseInt(String(gemini.stamp_duty_amount)) * 100
      : docAI.stamp_duty_amount_paise,
    // Room/BHK fields
    rooms_in_agreement: gemini.rooms_in_agreement != null ? Number(gemini.rooms_in_agreement) : (docAI as any).rooms_in_agreement || null,
    property_bhk_type: gemini.property_bhk_type || (docAI as any).property_bhk_type || null,
    gemini_verification_score: gemini.confidence || null,
    // Use Gemini's confidence if it's meaningful (>0), otherwise keep Document AI's score.
    // Gemini sometimes returns 0 confidence due to safety filters or empty responses.
    confidence_score: gemini.confidence != null && Number(gemini.confidence) > 0
      ? Number(gemini.confidence)
      : docAI.confidence_score,
    raw_gemini_data: gemini,
    fields_extracted: 0, // Will be recalculated below
  };

  // Sanity-check financial amounts — Gemini can hallucinate negative values or astronomical amounts
  const MAX_RENT_PAISE = 50_00_000_00; // ₹50 lakh max rent (covers luxury properties)
  const MAX_DEPOSIT_PAISE = 500_00_000_00; // ₹5 crore max deposit
  if (merged.monthly_rent_paise != null && (merged.monthly_rent_paise <= 0 || merged.monthly_rent_paise > MAX_RENT_PAISE)) {
    console.warn(`[process-document] Invalid monthly_rent_paise=${merged.monthly_rent_paise}, clearing`);
    merged.monthly_rent_paise = undefined;
  }
  if (merged.security_deposit_paise != null && (merged.security_deposit_paise < 0 || merged.security_deposit_paise > MAX_DEPOSIT_PAISE)) {
    console.warn(`[process-document] Invalid security_deposit_paise=${merged.security_deposit_paise}, clearing`);
    merged.security_deposit_paise = undefined;
  }
  // Sanity-check rooms/BHK
  if (merged.rooms_in_agreement != null && (merged.rooms_in_agreement < 1 || merged.rooms_in_agreement > 20)) {
    merged.rooms_in_agreement = null;
  }
  // Sanity-check rent_due_day (1-28)
  if (merged.rent_due_day != null && (merged.rent_due_day < 1 || merged.rent_due_day > 28)) {
    merged.rent_due_day = undefined;
  }

  // Recalculate fields extracted
  merged.fields_extracted = countExtractedFields(merged);

  return merged;
}

// Helper function to infer state from city name
function inferStateFromCity(city?: string): string | undefined {
  if (!city) return undefined;
  const cityLower = city.toLowerCase();

  // Karnataka cities
  if (cityLower.includes('bangalore') || cityLower.includes('bengaluru') ||
      cityLower.includes('mysore') || cityLower.includes('mysuru') ||
      cityLower.includes('mangalore') || cityLower.includes('hubli')) {
    return 'Karnataka';
  }
  // Maharashtra cities
  if (cityLower.includes('mumbai') || cityLower.includes('pune') ||
      cityLower.includes('nagpur') || cityLower.includes('thane') ||
      cityLower.includes('nashik') || cityLower.includes('aurangabad')) {
    return 'Maharashtra';
  }
  // Delhi
  if (cityLower.includes('delhi') || cityLower.includes('new delhi') ||
      cityLower.includes('noida') || cityLower.includes('gurgaon') ||
      cityLower.includes('gurugram') || cityLower.includes('faridabad') ||
      cityLower.includes('ghaziabad')) {
    return 'Delhi NCR';
  }
  // Tamil Nadu
  if (cityLower.includes('chennai') || cityLower.includes('coimbatore') ||
      cityLower.includes('madurai') || cityLower.includes('tiruchirappalli')) {
    return 'Tamil Nadu';
  }
  // Telangana
  if (cityLower.includes('hyderabad') || cityLower.includes('secunderabad') ||
      cityLower.includes('warangal')) {
    return 'Telangana';
  }
  // West Bengal
  if (cityLower.includes('kolkata') || cityLower.includes('calcutta')) {
    return 'West Bengal';
  }
  // Gujarat
  if (cityLower.includes('ahmedabad') || cityLower.includes('surat') ||
      cityLower.includes('vadodara') || cityLower.includes('rajkot')) {
    return 'Gujarat';
  }

  return undefined;
}

// ============================================
// DOCUMENT AI RESPONSE PARSER
// ============================================

function parseDocumentAIResponse(response: any): ExtractedData {
  const entities = response.document?.entities || [];
  const text = response.document?.text || "";

  const extracted: ExtractedData = {
    tenant_names: [],
    landlord_names: [],
    tenants: [],
    landlords: [],
    confidence_score: 0,
    fields_extracted: 0,
    total_fields: TOTAL_EXTRACTION_FIELDS,
    extraction_method: 'gcp_doc_ai',
    raw_doc_ai_data: response,
  };

  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const entity of entities) {
    const type = (entity.type || "").toLowerCase();
    const value = entity.mentionText || "";
    const confidence = entity.confidence || 0;

    if (value) {
      totalConfidence += confidence;
      confidenceCount++;

      // Property details
      if (type.includes("property") || type.includes("premises") || type.includes("apartment")) {
        extracted.property_name = value;
      } else if (type.includes("address") && !type.includes("email")) {
        extracted.property_address = value;
      } else if (type.includes("city")) {
        extracted.property_city = value;
      } else if (type.includes("pin") || type.includes("postal")) {
        extracted.property_pincode = value.replace(/\D/g, '').substring(0, 6);
      } else if (type.includes("area") || type.includes("locality") || type.includes("neighborhood")) {
        extracted.micromarket = value;
      }

      // Financial
      else if ((type.includes("rent") && type.includes("amount")) || type.includes("monthly_rent")) {
        extracted.monthly_rent_paise = parseAmount(value);
      } else if (type.includes("deposit") || type.includes("security")) {
        extracted.security_deposit_paise = parseAmount(value);
      } else if (type.includes("maintenance")) {
        extracted.maintenance_paise = parseAmount(value);
      } else if (type.includes("escalation") || type.includes("increment")) {
        extracted.rent_escalation_percent = parseFloat(value.replace(/[^0-9.]/g, '')) || undefined;
      }

      // Contract details
      else if (type.includes("start") && type.includes("date")) {
        extracted.lease_start_date = parseDate(value);
      } else if (type.includes("end") && type.includes("date")) {
        extracted.lease_end_date = parseDate(value);
      } else if (type.includes("duration") || type.includes("period") || type.includes("term")) {
        extracted.contract_length_months = parseDuration(value);
      }

      // Parties
      else if (type.includes("tenant") || type.includes("lessee")) {
        if (!extracted.tenant_names.includes(value)) {
          extracted.tenant_names.push(value);
          extracted.tenants.push({ name: value });
        }
      } else if (type.includes("landlord") || type.includes("lessor") || type.includes("owner")) {
        if (!extracted.landlord_names.includes(value)) {
          extracted.landlord_names.push(value);
          extracted.landlords.push({ name: value });
        }
      }
    }
  }

  extracted.confidence_score = confidenceCount > 0
    ? Math.round((totalConfidence / confidenceCount) * 100)
    : 0;

  extracted.fields_extracted = countExtractedFields(extracted);

  return extracted;
}

function countExtractedFields(data: Partial<ExtractedData>): number {
  let count = 0;
  // Property details
  if (data.property_name) count++;
  if (data.property_address) count++;
  if (data.property_city) count++;
  if (data.property_state) count++;
  if (data.property_pincode) count++;
  if (data.micromarket || data.area_name) count++;
  // Financial
  if (data.monthly_rent_paise) count++;
  if (data.security_deposit_paise) count++;
  if (data.rent_escalation_percent) count++;
  // Contract
  if (data.lease_start_date) count++;
  if (data.contract_length_months || data.lease_end_date) count++;
  if (data.rent_due_day) count++;
  // Parties
  if (data.tenant_names && data.tenant_names.length > 0) count++;
  if (data.landlord_names && data.landlord_names.length > 0) count++;
  // E-stamp fields
  if (data.certificate_no) count++;
  if (data.certificate_issued_date) count++;
  if (data.account_reference) count++;
  if (data.purchased_by) count++;
  if (data.description_of_document) count++;
  if (data.first_party) count++;
  if (data.second_party) count++;
  if (data.stamp_duty_paid_by) count++;
  if (data.consideration_price_paise) count++;
  if (data.stamp_duty_amount_paise) count++;
  return count;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert ArrayBuffer to base64 in chunks to avoid stack overflow for large files
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

function parseAmount(value: string): number {
  // NOTE: Returns amount in INR (rupees), NOT paise - despite column names ending in _paise
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", "");
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.round(amount);
}

function parseDate(value: string): string | undefined {
  try {
    // Handle various Indian date formats
    const formats = [
      /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/, // YYYY-MM-DD
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        if (match[3].length === 4) {
          // DD/MM/YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        } else {
          // YYYY-MM-DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      }
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // Return undefined if parsing fails
  }
  return undefined;
}

function parseDuration(value: string): number {
  const match = value.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (value.toLowerCase().includes('year')) {
      return num * 12;
    }
    return num;
  }
  return 11; // Default to 11 months (common in India)
}

function checkCitySupported(city: string | undefined, supportedCities: string[]): boolean {
  if (!city) return false;
  const normalizedCity = city.toLowerCase().trim();
  return supportedCities.some(sc =>
    normalizedCity.includes(sc.toLowerCase()) ||
    sc.toLowerCase().includes(normalizedCity)
  );
}

function evaluateExtraction(
  fieldsExtracted: number,
  totalFields: number,
  confidenceScore: number,
  isCitySupported: boolean,
  extractedData?: Partial<ExtractedData>
): { needs_manual_review: boolean; review_reason?: string; contract_status: string; missing_fields?: string[] } {
  // City support check: Record the flag but do NOT block extraction
  // Unsupported cities proceed normally — the is_city_supported flag is stored separately

  // First check: Document classification — is this actually a rental agreement?
  if (extractedData && (extractedData as any).is_rental_agreement === false) {
    const reason = (extractedData as any).rejection_reason || 'This document does not appear to be a rental agreement.';
    const detectedType = (extractedData as any).document_type_detected || 'unknown';
    console.log(`[process-document] Rejected: not a rental agreement (${detectedType})`);
    return {
      needs_manual_review: true,
      review_reason: reason,
      contract_status: 'invalid_document',
    };
  }

  // Agreement expiry is NOT a blocker — expired leases are common (renewed
  // verbally, extension pending, etc.). The risk engine (computeRisk signal 6)
  // adds a RED "agreement_expiry" factor with weight 4, which auto-escalates
  // risk_level to HIGH. Admin sees this and can reject if warranted.

  // Second check: Critical fields that make the agreement invalid if missing
  // Without these, the agreement is unusable — no point in manual review
  if (extractedData) {
    const criticalMissing: string[] = [];
    if (!extractedData.monthly_rent_paise || extractedData.monthly_rent_paise <= 0) {
      criticalMissing.push('Monthly Rent');
    }
    if (!extractedData.security_deposit_paise || extractedData.security_deposit_paise <= 0) {
      criticalMissing.push('Security Deposit');
    }
    if (!extractedData.lease_end_date || !extractedData.lease_end_date.trim()) {
      criticalMissing.push('Lease End Date');
    }
    if (!extractedData.landlord_names || extractedData.landlord_names.length === 0 || !extractedData.landlord_names[0]) {
      criticalMissing.push('Landlord Name');
    }

    if (criticalMissing.length > 0) {
      console.log(`[process-document] Agreement invalid — missing critical fields: ${criticalMissing.join(', ')}`);
      return {
        needs_manual_review: true,
        review_reason: `This agreement is missing critical information: ${criticalMissing.join(', ')}. Please upload a complete rental agreement.`,
        contract_status: 'invalid_document',
        missing_fields: criticalMissing,
      };
    }
  }

  // Third check: Validate minimum required fields if data is available
  if (extractedData) {
    const validation = validateMinimumRequiredFields(extractedData);

    if (!validation.isComplete) {
      // Missing non-critical fields - needs manual review
      return {
        needs_manual_review: true,
        review_reason: `Missing required fields: ${validation.missingFields.join(', ')}. Our team will review your document manually.`,
        contract_status: 'manual_review',
        missing_fields: validation.missingFields,
      };
    }

    // All minimum fields present = user review (success)
    return {
      needs_manual_review: false,
      contract_status: 'user_review',
    };
  }

  // Fallback: Use old percentage-based logic if extractedData not provided
  // 80% extraction + high confidence + supported city = user review
  if (fieldsExtracted >= totalFields * 0.8 && confidenceScore >= 80) {
    return {
      needs_manual_review: false,
      contract_status: 'user_review',
    };
  }

  // Partial extraction or low confidence
  if (fieldsExtracted < totalFields * 0.5 || confidenceScore < 50) {
    return {
      needs_manual_review: true,
      review_reason: `Extraction incomplete: ${fieldsExtracted}/${totalFields} fields extracted with ${confidenceScore}% confidence. Document may need re-upload or manual review.`,
      contract_status: 'manual_review',
    };
  }

  // Medium confidence - manual review
  return {
    needs_manual_review: true,
    review_reason: `Some information couldn't be extracted clearly (${fieldsExtracted}/${totalFields} fields, ${confidenceScore}% confidence).`,
    contract_status: 'manual_review',
  };
}

/**
 * Strip heavy fields from Document AI response to prevent statement timeouts.
 * Removes base64 page images and caps document text at 100K chars.
 */
function slimDocAiData(raw: object): object {
  try {
    const data = raw as any;
    if (!data?.document) return raw;
    return {
      ...data,
      document: {
        ...data.document,
        text: data.document.text?.substring(0, 100_000),
        pages: data.document.pages?.map((p: any) => {
          const { image, ...rest } = p;
          return rest;
        }),
      },
    };
  } catch {
    return raw;
  }
}

function categorizeError(message: string): string {
  const msg = message.toLowerCase();
  if (message.includes('PDF') || message.includes('file type')) return 'INVALID_FILE_TYPE';
  if (message.includes('download')) return 'FILE_NOT_FOUND';
  if (msg.includes('timed out') || msg.includes('abort')) return 'PROCESSING_TIMEOUT';
  if (msg.includes('safety') || msg.includes('blocked')) return 'SAFETY_FILTER_BLOCKED';
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) return 'RATE_LIMITED';
  if (message.includes('Document AI')) return 'OCR_FAILED';
  if (message.includes('Gemini')) return 'VERIFICATION_FAILED';
  if (message.includes('store') || message.includes('database')) return 'DATABASE_ERROR';
  return 'UNKNOWN_ERROR';
}

async function updateExtractionStatus(
  supabase: any,
  extractionId: string,
  updates: Record<string, any>
) {
  const { error } = await supabase
    .from("extracted_rental_info")
    .update(updates)
    .eq("id", extractionId);

  if (error) {
    console.error("[process-document] Failed to update extraction status:", error);
  }
}

async function updateWaitlistEntries(
  supabase: any,
  userId: string | undefined,
  updates: Record<string, any>
) {
  if (!userId) return;

  try {
    await ensureWaitlistState({
      supabase,
      userId,
    });
  } catch (joinError) {
    console.log(
      "[process-document] Note: failed to ensure waitlist state (non-fatal):",
      joinError instanceof Error ? joinError.message : String(joinError),
    );
  }

  const { error } = await supabase
    .from("waitlist_entries")
    .update(updates)
    .eq("user_id", userId);

  if (error) {
    // Non-fatal - waitlist_entries is for V1 compatibility only
    console.log("[process-document] Note: waitlist_entries update failed (non-fatal):", error.message);
  }
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================
// GEOCODING
// ============================================

async function geocodePropertyAddress(
  supabase: any,
  extractedRentalInfoId: string,
  extractedData: ExtractedData,
  googleMapsApiKey: string
): Promise<void> {
  // Construct full address from extracted components
  const addressParts: string[] = [];

  if (extractedData.property_name) {
    addressParts.push(extractedData.property_name);
  }
  if (extractedData.property_address) {
    addressParts.push(extractedData.property_address);
  }
  if (extractedData.property_city) {
    addressParts.push(extractedData.property_city);
  }
  if (extractedData.property_state) {
    addressParts.push(extractedData.property_state);
  }
  if (extractedData.property_pincode) {
    addressParts.push(extractedData.property_pincode);
  }

  if (addressParts.length < 2) {
    console.log("[process-document] Skipping geocoding - insufficient address components");
    return;
  }

  // Add India to improve geocoding accuracy
  const fullAddress = addressParts.join(", ") + ", India";
  const encodedAddress = encodeURIComponent(fullAddress);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`;

  console.log(`[process-document] Geocoding address: ${fullAddress}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    console.log(`[process-document] Geocoding returned no results: ${data.status}`);
    return;
  }

  const bestResult = data.results[0];
  const location = bestResult.geometry?.location;

  if (!location || !location.lat || !location.lng) {
    console.log("[process-document] Geocoding result missing coordinates");
    return;
  }

  console.log(`[process-document] Geocoded to: (${location.lat}, ${location.lng}) - ${bestResult.formatted_address}`);

  // Update the extracted_rental_info record with geocoding results
  const { error: updateError } = await supabase
    .from("extracted_rental_info")
    .update({
      latitude: location.lat,
      longitude: location.lng,
      geocode_formatted_address: bestResult.formatted_address,
      geocode_place_id: bestResult.place_id,
      geocoded_at: new Date().toISOString(),
    })
    .eq("id", extractedRentalInfoId);

  if (updateError) {
    console.error("[process-document] Failed to store geocoding result:", updateError);
    throw updateError;
  }

  console.log(`[process-document] Successfully geocoded property for rental info ${extractedRentalInfoId}`);
}
