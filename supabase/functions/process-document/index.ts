/**
 * Flent Secured v2 - Process Document Edge Function
 *
 * Processes uploaded documents (lease agreements, rent receipts, etc.)
 * and extracts rental information using AI vision.
 *
 * Endpoint: POST /functions/v1/process-document
 * Auth: Required (User JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MAX_FILE_SIZE_MB = 10;
const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// ==============================================
// TYPES
// ==============================================

interface ProcessDocumentRequest {
  extraction_id: string; // ID of the extracted_rental_info record
}

interface ExtractedInfo {
  landlord_name?: string;
  landlord_phone?: string;
  landlord_email?: string;
  landlord_address?: string;
  tenant_name?: string;
  tenant_phone?: string;
  tenant_email?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_pincode?: string;
  property_type?: string;
  monthly_rent?: number;
  security_deposit?: number;
  maintenance?: number;
  rent_due_day?: number;
  lease_start_date?: string;
  lease_end_date?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  extraction_id: { required: true, type: "string" as const },
};

// ==============================================
// EXTRACTION PROMPT
// ==============================================

const EXTRACTION_PROMPT = `You are an expert at extracting rental information from Indian lease agreements and rent-related documents.

Analyze this document image and extract the following information. Return ONLY a valid JSON object with these fields (use null for fields you cannot find):

{
  "landlord_name": "Full name of the landlord/owner",
  "landlord_phone": "Phone number (Indian format, 10 digits)",
  "landlord_email": "Email address",
  "landlord_address": "Full address of landlord",
  "tenant_name": "Full name of the tenant/lessee",
  "tenant_phone": "Phone number (Indian format, 10 digits)",
  "tenant_email": "Email address",
  "property_address": "Full property address being rented",
  "property_city": "City name",
  "property_state": "State name",
  "property_pincode": "6-digit PIN code",
  "property_type": "apartment OR house OR commercial OR other",
  "monthly_rent": 25000,
  "security_deposit": 75000,
  "maintenance": 2000,
  "rent_due_day": 5,
  "lease_start_date": "2024-01-01",
  "lease_end_date": "2025-01-01"
}

Important:
- All monetary values should be numbers (in INR, not paise)
- Dates should be in YYYY-MM-DD format
- Phone numbers should be 10 digits without country code
- If a field is not present or unclear, use null
- Return ONLY the JSON object, no additional text`;

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Check OpenAI API key is configured
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return errorResponse("Document processing service not configured", 503);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = new AuditLogger(supabase, {
      actorType: "user",
      userId: userId,
      functionName: "process-document",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Parse and validate request
    const body = await req.json();
    const { extraction_id } = validateSchema<ProcessDocumentRequest>(
      body,
      requestSchema,
      true
    );

    // Fetch extraction record
    const { data: extraction, error: fetchError } = await supabase
      .from("extracted_rental_info")
      .select("*")
      .eq("id", extraction_id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !extraction) {
      throw new AppError("Extraction record not found", "NOT_FOUND", 404);
    }

    // Check if already processed
    if (extraction.extraction_status === "completed") {
      return jsonResponse({
        success: true,
        data: {
          already_processed: true,
          extraction_id: extraction.id,
        },
      });
    }

    // Update status to processing
    await supabase
      .from("extracted_rental_info")
      .update({
        extraction_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", extraction_id);

    // Download the document from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(extraction.document_storage_path);

    if (downloadError || !fileData) {
      await markExtractionFailed(
        supabase,
        extraction_id,
        "Failed to download document from storage"
      );
      throw new AppError("Failed to download document", "STORAGE_ERROR", 500);
    }

    // Validate file size
    const fileSizeMB = fileData.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      await markExtractionFailed(
        supabase,
        extraction_id,
        `File too large: ${fileSizeMB.toFixed(1)}MB exceeds ${MAX_FILE_SIZE_MB}MB limit`
      );
      throw new ValidationError("File too large", {
        file_size: `Maximum size is ${MAX_FILE_SIZE_MB}MB`,
      });
    }

    // Convert to base64 for OpenAI
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Data = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    // Determine media type
    const mimeType = extraction.mime_type ?? "image/jpeg";
    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      await markExtractionFailed(
        supabase,
        extraction_id,
        `Unsupported file type: ${mimeType}`
      );
      throw new ValidationError("Unsupported file type", {
        mime_type: `Supported types: ${SUPPORTED_MIME_TYPES.join(", ")}`,
      });
    }

    // Call OpenAI Vision API
    const extractedInfo = await callOpenAIVision(base64Data, mimeType);

    // Calculate confidence based on how many fields were extracted
    const totalFields = 18;
    const extractedFields = Object.values(extractedInfo).filter(
      (v) => v !== null && v !== undefined
    ).length;
    const confidence = extractedFields / totalFields;

    // Update extraction record with results
    const { error: updateError } = await supabase
      .from("extracted_rental_info")
      .update({
        extraction_status: confidence > 0.3 ? "completed" : "manual_review",
        extraction_provider: "openai_vision",
        extraction_confidence: confidence,
        landlord_name: extractedInfo.landlord_name,
        landlord_phone: extractedInfo.landlord_phone,
        landlord_email: extractedInfo.landlord_email,
        landlord_address: extractedInfo.landlord_address,
        tenant_name: extractedInfo.tenant_name,
        tenant_phone: extractedInfo.tenant_phone,
        tenant_email: extractedInfo.tenant_email,
        property_address: extractedInfo.property_address,
        property_city: extractedInfo.property_city,
        property_state: extractedInfo.property_state,
        property_pincode: extractedInfo.property_pincode,
        property_type: extractedInfo.property_type,
        monthly_rent_paise: extractedInfo.monthly_rent
          ? extractedInfo.monthly_rent * 100
          : null,
        security_deposit_paise: extractedInfo.security_deposit
          ? extractedInfo.security_deposit * 100
          : null,
        maintenance_paise: extractedInfo.maintenance
          ? extractedInfo.maintenance * 100
          : null,
        rent_due_day: extractedInfo.rent_due_day,
        lease_start_date: extractedInfo.lease_start_date,
        lease_end_date: extractedInfo.lease_end_date,
        raw_extraction_response: extractedInfo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", extraction_id);

    if (updateError) {
      console.error("Failed to update extraction:", updateError);
      throw new AppError("Failed to save extraction results", "DB_ERROR", 500);
    }

    // Log audit
    await audit.logSuccess(
      AuditActions.DOCUMENT_PROCESSED,
      "extraction",
      "extracted_rental_info",
      extraction_id,
      {
        document_type: extraction.document_type,
        extraction_confidence: confidence,
        fields_extracted: extractedFields,
        needs_review: confidence <= 0.3,
      }
    );

    return jsonResponse({
      success: true,
      data: {
        extraction_id: extraction_id,
        status: confidence > 0.3 ? "completed" : "manual_review",
        confidence: confidence,
        fields_extracted: extractedFields,
        extracted_info: extractedInfo,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Calls OpenAI Vision API to extract info from document image.
 */
async function callOpenAIVision(
  base64Data: string,
  mimeType: string
): Promise<ExtractedInfo> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("OpenAI API error:", errorData);
    throw new AppError(
      "Document processing failed",
      "OPENAI_ERROR",
      502
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  // Parse the JSON response
  try {
    // Handle potential markdown code blocks
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
      content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    return JSON.parse(jsonStr.trim());
  } catch (parseError) {
    console.error("Failed to parse OpenAI response:", content);
    throw new AppError(
      "Failed to parse extracted information",
      "PARSE_ERROR",
      500
    );
  }
}

/**
 * Marks an extraction as failed with error message.
 */
async function markExtractionFailed(
  supabase: any,
  extractionId: string,
  errorMessage: string
): Promise<void> {
  await supabase
    .from("extracted_rental_info")
    .update({
      extraction_status: "failed",
      extraction_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", extractionId);
}
