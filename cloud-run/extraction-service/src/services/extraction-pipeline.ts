/**
 * Flent Secured v2 - Extraction Pipeline (Cloud Run)
 *
 * Main orchestrator for the full document extraction pipeline.
 * Ported from: supabase/functions/process-document/index.ts processExtractionBackground()
 *
 * Steps:
 *   1.  Fetch extraction record from DB
 *   2.  Download PDF from Supabase Storage
 *   3.  Convert to base64
 *   4.  Call Document AI OCR
 *   5.  Persist OCR text immediately (slimDocAiData)
 *   6.  If text >= 100 chars: try Vertex AI Gemini (300s) -> if fails, try API key (300s)
 *   7.  If text < 100 chars: try multimodal Vertex AI -> if fails, try multimodal API key
 *       (inline < 7MB, URL 7-15MB)
 *   8.  Check is_rental_agreement
 *   9.  Merge results (mergeGeminiResults)
 *   10. Evaluate (evaluateExtraction)
 *   11. Derive lease_end_date if missing
 *   12. Check city support from DB
 *   13. Persist all fields to extracted_rental_info
 *   14. Geocode property address (non-blocking)
 *   15. Finalize onboarding (call imported function)
 *   16. Send notification on failure
 *
 * Heartbeat: updates gemini_raw_response.last_heartbeat every 30s during processing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { ExtractedData, ExtractionResult, GeminiDebug } from '../types.js';

// Services
import { createServiceClient, getSupabaseUrl, getServiceKey } from './supabase.js';
import { callDocumentAI } from './document-ai.js';
import { extractWithVertexAIGemini, extractMultimodalVertexAI, isRetryableGeminiError } from './gemini-vertex.js';
import { callGeminiApiKeyText, callGeminiApiKeyMultimodal, callGeminiApiKeyMultimodalUrl } from './gemini-apikey.js';
import { Heartbeat } from './heartbeat.js';
import { scheduleNotification } from './notifications.js';
import { geocodePropertyAddress } from './geocoding.js';
import { triggerStampVerification } from './stamp-verification.js';

// Extraction helpers
import { mergeGeminiResults } from '../extraction/merge.js';
import { evaluateExtraction, checkCitySupported } from '../extraction/evaluate.js';
import { slimDocAiData, arrayBufferToBase64 } from '../extraction/utils.js';
import { TOTAL_EXTRACTION_FIELDS } from '../extraction/schema.js';

// Onboarding
import { finalizeExtractionForOnboarding } from '../onboarding/finalize.js';

// Constants
const MAX_INLINE_PDF_BYTES = 7 * 1024 * 1024;   // 7 MB Gemini inline base64 limit
const MAX_URL_PDF_BYTES = 15 * 1024 * 1024;     // 15 MB Gemini HTTPS fileUri limit

export interface ExtractionPipelineInput {
  extractionId: string;
  userId: string;
}

/**
 * Run the full extraction pipeline for a given extraction record.
 *
 * @param input - Object with extractionId and userId
 * @returns Extraction result with status and quality metrics
 */
export async function runExtractionPipeline(
  input: ExtractionPipelineInput
): Promise<ExtractionResult> {
  const { extractionId, userId } = input;
  const supabase = createServiceClient();
  const heartbeat = new Heartbeat(supabase, extractionId, 30_000);
  let completedExtractionPersisted = false;

  try {
    heartbeat.start();

    // ================================================================
    // Step 1: Fetch extraction record
    // ================================================================
    await heartbeat.updateStep('fetching_record');

    const { data: extraction, error: fetchError } = await supabase
      .from('extracted_rental_info')
      .select('id, user_id, document_storage_path, extraction_status, extraction_method, contract_status, fields_extracted, latitude, longitude, property_name, property_address, property_city, property_state, property_pincode')
      .eq('id', extractionId)
      .single();

    if (fetchError || !extraction) {
      throw new Error(`Extraction not found: ${fetchError?.message ?? extractionId}`);
    }

    // ================================================================
    // Fast path: if extraction is already completed, skip re-extraction
    // and just run finalization (tenancy, waitlist, risk).
    // This handles users whose extraction succeeded but finalization failed.
    // ================================================================
    if (extraction.extraction_status === 'completed') {
      console.log(`[pipeline] Extraction ${extractionId} already completed — running finalization only`);
      await heartbeat.updateStep('finalizing_only');

      // Backfill geocoding for extractions that completed before geocoding
      // was configured (GOOGLE_MAPS_API_KEY was not set on earlier Cloud Run
      // revisions, so these records have null lat/lng).
      if (!extraction.latitude && extraction.property_address) {
        try {
          await geocodePropertyAddress(supabase, extractionId, {
            property_name: extraction.property_name,
            property_address: extraction.property_address,
            property_city: extraction.property_city,
            property_state: extraction.property_state,
            property_pincode: extraction.property_pincode,
          });
        } catch (geocodeError) {
          console.error('[pipeline] Fast-path geocoding failed (non-fatal):', geocodeError);
        }
      }

      try {
        const { finalizeExtractionForOnboarding } = await import('../onboarding/finalize.js');
        const finResult = await finalizeExtractionForOnboarding({
          supabase,
          userId,
          extractionId,
          confirmedRole: 'tenant',
          autoApproveDemo: true,
        });
        console.log('[pipeline] Finalization-only result:', {
          tenancyId: finResult.tenancyId,
          waitlistEntryId: finResult.waitlistEntryId,
          finalUserStatus: finResult.finalUserStatus,
          autoApprovedDemo: finResult.autoApprovedDemo,
        });
      } catch (finErr) {
        console.error('[pipeline] Finalization-only failed:', finErr);
      }

      heartbeat.stop();
      completedExtractionPersisted = true;
      return {
        success: true,
        extractionId,
        fieldsExtracted: extraction.fields_extracted ?? 0,
        confidenceScore: 0,
        contractStatus: extraction.contract_status ?? 'user_review',
        extractionMethod: extraction.extraction_method ?? 'unknown',
        needsManualReview: false,
        isCitySupported: true,
      };
    }

    const documentPath = extraction.document_storage_path;
    if (!documentPath) {
      throw new Error('No document_storage_path on extraction record');
    }

    // ================================================================
    // Step 2: Download PDF from Supabase Storage
    // ================================================================
    await heartbeat.updateStep('downloading');

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('rent-agreements')
      .download(documentPath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download document: ${downloadError?.message}`);
    }

    // ================================================================
    // Step 3: Convert to base64
    // ================================================================
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = arrayBufferToBase64(arrayBuffer);

    // ================================================================
    // Step 4: Get GCP credentials from central config
    // ================================================================
    const gcpCredentials = config.gcp.docAiCredentials;
    const gcpProjectId = config.gcp.projectId;
    const gcpProcessorId = config.gcp.processorId;
    const gcpLocation = config.gcp.location;

    const vertexAiCredentials = config.vertex.credentials;
    const vertexAiProjectId = config.vertex.projectId;
    const geminiApiKey = config.geminiApiKey;

    console.log('[pipeline] Config:', {
      hasGcpCredentials: !!gcpCredentials,
      gcpProjectId,
      hasProcessorId: !!gcpProcessorId,
      gcpLocation,
      hasVertexAiCredentials: !!vertexAiCredentials,
      vertexAiProjectId,
      hasGeminiApiKey: !!geminiApiKey,
      geminiApiKeyPrefix: geminiApiKey ? geminiApiKey.substring(0, 10) + '...' : 'NOT SET',
    });

    if (!gcpCredentials || !gcpProcessorId) {
      await updateExtractionStatus(supabase, extractionId, {
        extraction_status: 'extraction_failed',
        extraction_error: 'Document processing service not configured',
      });
      scheduleNotification(userId, 'agreement_upload_failed').catch((e) =>
        console.warn('[pipeline] Failed to send notification:', e)
      );
      throw new Error('Document processing not configured');
    }

    // ================================================================
    // Step 5: Call Document AI OCR
    // ================================================================
    await heartbeat.updateStep('doc_ai');

    let docAIResult: Awaited<ReturnType<typeof callDocumentAI>>;
    let docAIFailureMessage: string | null = null;
    try {
      docAIResult = await callDocumentAI(
        base64Content,
        gcpCredentials,
        gcpProjectId,
        gcpProcessorId,
        gcpLocation
      );
    } catch (docAiErr: any) {
      // DocAI may reject large PDFs (>15 pages) with the OCR processor's
      // sync API page limit, or fail for other reasons. Don't abort the
      // whole pipeline -- fall through to the Gemini multimodal PDF path,
      // which handles up to hundreds of pages natively.
      docAIFailureMessage = docAiErr?.message ?? String(docAiErr);
      console.warn(`[pipeline] Document AI failed, falling back to Gemini multimodal PDF: ${docAIFailureMessage}`);
      docAIResult = {
        documentText: '',
        extractedData: { fields_extracted: 0 } as any,
        rawResponse: { doc_ai_error: docAIFailureMessage } as any,
      };
    }

    let extractedData = docAIResult.extractedData;
    const documentText = docAIResult.documentText;

    // ================================================================
    // Step 6: Persist OCR text immediately
    // ================================================================
    if (documentText.length > 0) {
      await supabase
        .from('extracted_rental_info')
        .update({
          raw_extraction_data: docAIResult.rawResponse,
          gemini_raw_response: {
            step: 'doc_ai_complete',
            ocr_chars: documentText.length,
            started_at: new Date().toISOString(),
          },
        })
        .eq('id', extractionId);
    }

    // Debug tracking for Gemini flow
    const geminiDebug: GeminiDebug = {
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

    // ================================================================
    // Step 7: Gemini extraction (text-based or multimodal)
    // ================================================================
    if (documentText.length > 100) {
      // ---- TEXT-BASED EXTRACTION ----
      geminiDebug.gemini_attempted = true;
      console.log(`[pipeline] Text mode -- ${documentText.length} chars`);

      let geminiResult: Record<string, unknown> | null = null;

      // Try Vertex AI first
      if (vertexAiCredentials && vertexAiProjectId) {
        try {
          geminiDebug.vertex_ai_attempted = true;
          await heartbeat.updateStep('gemini_vertex_ai');
          console.log(`[pipeline] Attempting Vertex AI Gemini GLOBAL (project: ${vertexAiProjectId})...`);

          geminiResult = await extractWithVertexAIGemini(
            documentText,
            vertexAiCredentials,
            vertexAiProjectId,
            config.vertex.location
          );
          geminiDebug.vertex_ai_success = true;
          geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
        } catch (vertexError: any) {
          geminiDebug.vertex_ai_error = vertexError.message || String(vertexError);
          console.error('[pipeline] Vertex AI Gemini failed:', vertexError.message || vertexError);

          // Retry up to 2 times on transient / safety-filter errors
          if (isRetryableGeminiError(vertexError.message)) {
            const maxRetries = 2;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              console.log(`[pipeline] Retrying Vertex AI (attempt ${attempt}/${maxRetries}) after 3s...`);
              await new Promise(r => setTimeout(r, 3000));
              try {
                geminiResult = await extractWithVertexAIGemini(
                  documentText,
                  vertexAiCredentials,
                  vertexAiProjectId,
                  config.vertex.location
                );
                geminiDebug.vertex_ai_success = true;
                geminiDebug.vertex_ai_retried = true;
                geminiDebug.vertex_ai_retry_attempt = attempt;
                geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
                break;
              } catch (retryError: any) {
                geminiDebug.vertex_ai_retry_error = retryError.message || String(retryError);
                console.error(`[pipeline] Vertex AI retry attempt ${attempt} failed:`, retryError.message);
                if (attempt === maxRetries) {
                  console.error('[pipeline] Vertex AI exhausted all retry attempts');
                }
              }
            }
          }
        }
      } else {
        geminiDebug.vertex_ai_error = 'No VERTEX_AI_CREDENTIALS configured';
        console.log('[pipeline] Vertex AI credentials not configured, skipping...');
      }

      // If Vertex AI failed, try API key fallback
      if (!geminiResult && geminiApiKey) {
        try {
          geminiDebug.api_key_attempted = true;
          await heartbeat.updateStep('gemini_api_key');
          console.log('[pipeline] Attempting Gemini API key fallback...');

          geminiResult = await callGeminiApiKeyText(documentText, geminiApiKey);
          geminiDebug.api_key_success = true;
          geminiDebug.final_result_keys = geminiResult ? Object.keys(geminiResult).length : 0;
        } catch (apiKeyError: any) {
          geminiDebug.api_key_error = apiKeyError.message || String(apiKeyError);
          console.error('[pipeline] Gemini API key fallback failed:', apiKeyError.message);
        }
      }

      // Process Gemini result
      if (geminiResult && Object.keys(geminiResult).length > 0) {
        // Check document classification
        if (geminiResult.is_rental_agreement === false) {
          const detectedType = (geminiResult.document_type_detected as string) || 'unknown';
          const reason = (geminiResult.rejection_reason as string) ||
            `This does not appear to be a rental agreement (detected: ${detectedType}).`;
          console.log(`[pipeline] Document rejected: not a rental agreement. Type: ${detectedType}`);
          (extractedData as any).is_rental_agreement = false;
          (extractedData as any).document_type_detected = detectedType;
          (extractedData as any).rejection_reason = reason;
          (extractedData as any).gemini_debug = geminiDebug;
        } else {
          // Merge Gemini results
          extractedData = mergeGeminiResults(extractedData, geminiResult);
          extractedData.extraction_method = 'combined';
          console.log(`[pipeline] Gemini extraction: ${extractedData.fields_extracted} fields extracted`);
        }
      } else if (geminiDebug.gemini_attempted && !geminiResult) {
        console.warn('[pipeline] All Gemini extraction paths failed. Falling back to Document AI only.');
        extractedData.extraction_method = 'gcp_doc_ai';
        if (extractedData.fields_extracted === 0) {
          const err = new Error('Both Gemini and Document AI failed to extract any fields from the document');
          (err as any).debugData = {
            gemini_debug: geminiDebug,
            raw_doc_ai_data: docAIResult.rawResponse,
            extraction_method: extractedData.extraction_method || 'gcp_doc_ai',
          };
          throw err;
        }
      }
    } else {
      // ---- MULTIMODAL PDF FALLBACK ----
      geminiDebug.gemini_attempted = true;
      geminiDebug.mode = 'multimodal_pdf';
      console.log(`[pipeline] OCR text too short (${documentText.length} chars), trying multimodal PDF extraction...`);

      const pdfSizeBytes = Math.ceil(base64Content.length * 3 / 4);

      if (pdfSizeBytes > MAX_URL_PDF_BYTES) {
        console.warn(`[pipeline] PDF too large for multimodal (${Math.round(pdfSizeBytes / 1024 / 1024)}MB > 15MB limit)`);
        geminiDebug.multimodal_skipped = 'pdf_too_large';
      } else {
        let geminiResult: Record<string, unknown> | null = null;

        // Try Vertex AI multimodal first (only for PDFs <= 7MB inline)
        if (pdfSizeBytes <= MAX_INLINE_PDF_BYTES && vertexAiCredentials && vertexAiProjectId) {
          try {
            geminiDebug.vertex_ai_attempted = true;
            await heartbeat.updateStep('gemini_vertex_ai_multimodal');
            console.log('[pipeline] Attempting Vertex AI multimodal PDF extraction...');

            geminiResult = await extractMultimodalVertexAI(
              base64Content,
              vertexAiCredentials,
              vertexAiProjectId,
              config.vertex.location
            );
            if (geminiResult) {
              geminiDebug.vertex_ai_success = true;
              geminiDebug.final_result_keys = Object.keys(geminiResult).length;
              console.log(`[pipeline] Multimodal Vertex AI: ${Object.keys(geminiResult).length} keys extracted`);
            }
          } catch (vertexErr: any) {
            geminiDebug.vertex_ai_error = vertexErr.message;
            console.error('[pipeline] Multimodal Vertex AI error:', vertexErr.message);
          }
        }

        // If Vertex AI failed, try API key multimodal
        if (!geminiResult && geminiApiKey) {
          try {
            geminiDebug.api_key_attempted = true;
            await heartbeat.updateStep('gemini_api_key_multimodal');

            if (pdfSizeBytes <= MAX_INLINE_PDF_BYTES) {
              // Small PDF: inline base64
              console.log(`[pipeline] API key inline multimodal -- ${Math.round(pdfSizeBytes / 1024)}KB`);
              geminiResult = await callGeminiApiKeyMultimodal(base64Content, geminiApiKey);
            } else {
              // Large PDF (7-15MB): generate signed URL
              console.log(`[pipeline] API key URL multimodal -- ${Math.round(pdfSizeBytes / 1024 / 1024)}MB (signed URL)`);
              const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
                .from('rent-agreements')
                .createSignedUrl(documentPath, 600); // 10 min expiry

              if (signedUrlErr || !signedUrlData?.signedUrl) {
                throw new Error(`Signed URL failed: ${signedUrlErr?.message}`);
              }

              geminiResult = await callGeminiApiKeyMultimodalUrl(signedUrlData.signedUrl, geminiApiKey);
            }

            if (geminiResult) {
              geminiDebug.api_key_success = true;
              geminiDebug.final_result_keys = Object.keys(geminiResult).length;
            }
          } catch (apiKeyErr: any) {
            geminiDebug.api_key_error = apiKeyErr.message;
            console.error('[pipeline] API key multimodal failed:', apiKeyErr.message);
          }
        }

        // Process multimodal result
        if (geminiResult && Object.keys(geminiResult).length > 0) {
          if (geminiResult.is_rental_agreement === false) {
            const detectedType = (geminiResult.document_type_detected as string) || 'unknown';
            const reason = (geminiResult.rejection_reason as string) ||
              `Not a rental agreement (detected: ${detectedType}).`;
            console.log(`[pipeline] Multimodal: document rejected -- ${detectedType}`);
            (extractedData as any).is_rental_agreement = false;
            (extractedData as any).document_type_detected = detectedType;
            (extractedData as any).rejection_reason = reason;
            (extractedData as any).gemini_debug = geminiDebug;
          } else {
            extractedData = mergeGeminiResults(extractedData, geminiResult);
            extractedData.extraction_method = 'combined';
            console.log(`[pipeline] Multimodal extraction: ${extractedData.fields_extracted} fields extracted`);
          }
        } else {
          console.warn('[pipeline] Multimodal PDF extraction returned no results');
          if (extractedData.fields_extracted === 0) {
            const err = new Error('OCR returned insufficient text and multimodal PDF extraction also failed');
            (err as any).debugData = {
              gemini_debug: geminiDebug,
              raw_doc_ai_data: docAIResult.rawResponse,
              extraction_method: 'gcp_doc_ai',
            };
            throw err;
          }
        }
      }
    }

    // Store gemini debug in extractedData
    (extractedData as any).gemini_debug = geminiDebug;

    // ================================================================
    // Step 8-10: Evaluate extraction
    // ================================================================
    await heartbeat.updateStep('evaluating');

    // Derive lease_end_date from lease_start_date + duration when missing
    if (!extractedData.lease_end_date && extractedData.lease_start_date && extractedData.contract_length_months) {
      const start = new Date(extractedData.lease_start_date);
      if (!isNaN(start.getTime())) {
        start.setMonth(start.getMonth() + extractedData.contract_length_months);
        extractedData.lease_end_date = start.toISOString().split('T')[0];
        console.log(`[pipeline] Derived lease_end_date=${extractedData.lease_end_date} from start=${extractedData.lease_start_date} + ${extractedData.contract_length_months} months`);
      }
    }

    // Check city support
    const { data: supportedCities } = await supabase
      .from('supported_cities')
      .select('city_name')
      .eq('is_active', true);

    const isCitySupported = checkCitySupported(
      extractedData.property_city,
      supportedCities?.map((c: { city_name: string }) => c.city_name) || []
    );

    // Evaluate extraction result.
    // documentText is the raw OCR text from DocAI — we pass it so evaluator
    // can distinguish "stamp paper page absent from PDF" (user forgot page 1)
    // from "stamp paper present but Certificate No. unparseable" (admin review).
    const evaluationResult = evaluateExtraction(
      extractedData.fields_extracted,
      extractedData.total_fields,
      extractedData.confidence_score,
      isCitySupported,
      extractedData,
      documentText
    );

    // Structured quality log
    console.log('[pipeline] Extraction quality:', JSON.stringify({
      extraction_id: extractionId,
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

    // ================================================================
    // Step 13: Persist all fields to extracted_rental_info
    // ================================================================
    await heartbeat.updateStep('persisting');

    const resolvedExtractionStatus = (extractedData.fields_extracted > 0 && (extractedData as any).is_rental_agreement !== false)
      ? 'completed'
      : 'extraction_failed';

    const { data: rentalInfo, error: updateError } = await supabase
      .from('extracted_rental_info')
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
        rent_grace_period_days: extractedData.rent_grace_period_days ?? null,
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
        // Direct columns
        tenant_names: extractedData.tenant_names,
        tenant_name: extractedData.tenant_names?.[0] ?? null,
        landlord_names: extractedData.landlord_names,
        landlord_name: extractedData.landlord_names?.length
          ? extractedData.landlord_names.join(' & ')
          : null,
        extraction_method: extractedData.extraction_method,
        is_city_supported: isCitySupported,
        gemini_raw_response: extractedData.raw_gemini_data || (extractedData as any).gemini_debug || null,
        raw_extraction_data: slimDocAiData(extractedData.raw_doc_ai_data),
        extraction_status: resolvedExtractionStatus,
        contract_status: evaluationResult.contract_status,
        needs_manual_review: evaluationResult.needs_manual_review,
      })
      .eq('id', extractionId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to store extracted data: ${updateError.message}`);
    }

    completedExtractionPersisted = true;

    // Fire-and-forget SHCIL stamp verification for Karnataka extractions
    // with a certificate number. Service is idempotent (short-circuits on
    // existing 'verified' row) and writes its own stamp_verifications row.
    // Karnataka-only mirrors the sweep-stamp-verifications safety-net cron.
    if (
      resolvedExtractionStatus === 'completed'
      && extractedData.certificate_no
      && extractedData.property_state?.trim().toLowerCase() === 'karnataka'
    ) {
      try {
        triggerStampVerification(extractionId);
      } catch (err) {
        console.warn('[pipeline] Stamp verification trigger threw (non-fatal):', err);
      }
    }

    // ================================================================
    // Step 14: Geocode property address (non-blocking)
    // ================================================================
    if (extractedData.property_address) {
      try {
        await geocodePropertyAddress(supabase, extractionId, extractedData);
      } catch (geocodeError) {
        console.error('[pipeline] Geocoding failed (non-fatal):', geocodeError);
      }
    }

    // ================================================================
    // Step 15: Finalize onboarding
    // ================================================================
    await heartbeat.updateStep('finalizing');

    // Notify user if extraction failed OR completed with an invalid document
    // that recovery cannot pick up. Recovery-eligible invalid_document rows
    // (Gemini classifier false-negatives where DocAI extracted full fields)
    // get silently routed to the admin triage queue instead — telling the
    // user to re-upload would conflict with that flow.
    //
    // Recovery eligibility mirrors extraction-recovery/index.ts:hasMinimumFields()
    // plus the supported-city gate.
    //
    // missing_stamp_paper is intentionally NOT recovery-eligible: by
    // construction the agreement body extracted cleanly (only Certificate No.
    // is missing), so the recoveryEligible field-presence predicate would be
    // true — but the user definitionally didn't include page 1, so admin
    // triage cannot fix it. The only path forward is re-upload, so we always
    // notify and bypass the admin-queue routing.
    const recoveryEligible =
      evaluationResult.contract_status === 'invalid_document'
      && !!extractedData.property_address
      && !!extractedData.monthly_rent_paise && extractedData.monthly_rent_paise > 0
      && extractedData.security_deposit_paise != null
      && (extractedData.tenant_names?.length ?? 0) > 0
      && !!extractedData.tenant_names?.[0]
      && (extractedData.landlord_names?.length ?? 0) > 0
      && !!extractedData.landlord_names?.[0]
      && isCitySupported !== false;

    const shouldNotifyReupload =
      resolvedExtractionStatus === 'extraction_failed'
      || (evaluationResult.contract_status === 'invalid_document' && !recoveryEligible)
      || evaluationResult.contract_status === 'missing_stamp_paper';

    if (shouldNotifyReupload) {
      scheduleNotification(userId, 'agreement_upload_failed', undefined, {
        relatedEntityType: 'extraction',
        relatedEntityId: extractionId,
      }).catch((e) =>
        console.warn('[pipeline] Failed to send agreement_upload_failed notification:', e)
      );
    }

    const shouldAutoFinalize =
      extractedData.fields_extracted > 0
      && (evaluationResult.contract_status === 'user_review'
        || evaluationResult.contract_status === 'manual_review');

    if (shouldAutoFinalize && rentalInfo?.user_id) {
      try {
        await finalizeExtractionForOnboarding({
          supabase,
          userId: rentalInfo.user_id,
          extractionId,
          confirmedRole: 'tenant',
          syncWaitlistFields: {
            extraction_status: resolvedExtractionStatus,
            contract_status: evaluationResult.contract_status,
          },
          autoApproveDemo: true,
        });
      } catch (finalizeError) {
        console.error('[pipeline] Finalization failed (non-fatal):', finalizeError);
      }
    } else {
      // Update waitlist entries for V1 compatibility
      await updateWaitlistEntries(supabase, rentalInfo?.user_id, {
        extraction_status: resolvedExtractionStatus,
        contract_status: evaluationResult.contract_status,
      });
    }

    heartbeat.stop();

    console.log('[pipeline] Extraction completed successfully:', {
      extraction_id: extractionId,
      fields_extracted: extractedData.fields_extracted,
      contract_status: evaluationResult.contract_status,
      extraction_method: extractedData.extraction_method,
    });

    return {
      success: true,
      extractionId,
      fieldsExtracted: extractedData.fields_extracted,
      confidenceScore: extractedData.confidence_score,
      contractStatus: evaluationResult.contract_status,
      extractionMethod: extractedData.extraction_method,
      needsManualReview: evaluationResult.needs_manual_review,
      reviewReason: evaluationResult.review_reason,
      isCitySupported,
    };
  } catch (err) {
    heartbeat.stop();

    const errorMessage = err instanceof Error ? err.message : String(err);
    const debugData = (err as any)?.debugData;

    console.error(JSON.stringify({
      severity: 'ERROR',
      message: 'Extraction pipeline failed',
      extraction_id: extractionId,
      user_id: userId,
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    }));

    // Update extraction status if not already persisted
    if (!completedExtractionPersisted) {
      await updateExtractionStatus(supabase, extractionId, {
        extraction_status: 'failed',
        extraction_error: errorMessage,
        ...(debugData ? {
          gemini_raw_response: debugData.gemini_debug || null,
          raw_extraction_data: debugData.raw_doc_ai_data || null,
        } : {}),
      }).catch(() => {});

      // Step 16: Send notification on failure
      scheduleNotification(userId, 'agreement_upload_failed').catch((e) =>
        console.warn('[pipeline] Failed to send failure notification:', e)
      );
    }

    return {
      success: false,
      extractionId,
      fieldsExtracted: 0,
      confidenceScore: 0,
      contractStatus: 'failed',
      extractionMethod: 'none',
      needsManualReview: false,
      isCitySupported: false,
      error: errorMessage,
    };
  }
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Update extraction status in the database.
 */
async function updateExtractionStatus(
  supabase: SupabaseClient,
  extractionId: string,
  updates: Record<string, any>
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('extracted_rental_info')
    .update(updates)
    .eq('id', extractionId);

  if (error) {
    console.error('[pipeline] Failed to update extraction status:', error);
  }

  return { error };
}

/**
 * Update waitlist entries for V1 compatibility.
 */
async function updateWaitlistEntries(
  supabase: SupabaseClient,
  userId: string | undefined,
  updates: Record<string, any>
): Promise<void> {
  if (!userId) return;

  const { error } = await supabase
    .from('waitlist_entries')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    // Non-fatal - waitlist_entries is for V1 compatibility only
    console.log('[pipeline] Note: waitlist_entries update failed (non-fatal):', error.message);
  }
}
