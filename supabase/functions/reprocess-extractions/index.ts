// Admin function: Reprocess failed extractions where Gemini never ran
// Reads cached OCR text from raw_extraction_data, runs Gemini via Vertex AI global endpoint,
// and updates the extraction record with proper data.
// DELETE THIS FUNCTION after all failed extractions are reprocessed.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

const TOTAL_EXTRACTION_FIELDS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const vertexAiCredentials = Deno.env.get("VERTEX_AI_CREDENTIALS");
    const vertexAiProjectId = Deno.env.get("VERTEX_AI_PROJECT_ID") || "flent-ai-project-2";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY_SECURED") || Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional body for specific extraction_ids
    let targetIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body.extraction_ids && Array.isArray(body.extraction_ids)) {
        targetIds = body.extraction_ids;
      }
    } catch {
      // No body or invalid JSON — process all failed
    }

    // Query failed extractions
    let query = supabase
      .from("extracted_rental_info")
      .select("id, user_id, document_storage_path, raw_extraction_data, extraction_method, confidence_score")
      .eq("confidence_score", 0)
      .eq("needs_manual_review", true)
      .eq("extraction_method", "gcp_doc_ai")
      .order("created_at", { ascending: true });

    if (targetIds && targetIds.length > 0) {
      query = query.in("id", targetIds);
    }

    const { data: failedExtractions, error: queryError } = await query;

    if (queryError) {
      return new Response(JSON.stringify({ error: "Query failed", detail: queryError.message }), { status: 500, headers });
    }

    if (!failedExtractions || failedExtractions.length === 0) {
      return new Response(JSON.stringify({ message: "No failed extractions to reprocess" }), { status: 200, headers });
    }

    console.log(`[reprocess] Found ${failedExtractions.length} failed extractions to reprocess`);

    // Get supported cities for evaluation
    const { data: supportedCities } = await supabase
      .from("supported_cities")
      .select("city_name")
      .eq("is_active", true);
    const cityNames = supportedCities?.map(c => c.city_name) || [];

    // Process each extraction
    const results: any[] = [];

    for (const extraction of failedExtractions) {
      const result: any = {
        id: extraction.id,
        user_id: extraction.user_id,
        status: "pending",
      };

      try {
        // Get cached OCR text
        const documentText = extraction.raw_extraction_data?.document?.text || "";
        if (documentText.length < 100) {
          result.status = "skipped";
          result.reason = `OCR text too short: ${documentText.length} chars`;
          results.push(result);
          continue;
        }

        result.text_length = documentText.length;
        console.log(`[reprocess] Processing ${extraction.id}: ${documentText.length} chars`);

        // Run Gemini extraction
        let geminiResult: any = null;

        // Try Vertex AI first
        if (vertexAiCredentials && vertexAiProjectId) {
          try {
            const vertexCreds = JSON.parse(vertexAiCredentials);
            const vertexToken = await getGCPAccessToken(vertexCreds);
            geminiResult = await extractWithVertexAIGemini(documentText, vertexToken, vertexAiProjectId);
            result.gemini_method = "vertex_ai_global";
          } catch (vertexErr: any) {
            result.vertex_ai_error = vertexErr.message;
            console.error(`[reprocess] Vertex AI failed for ${extraction.id}:`, vertexErr.message);
          }
        }

        // Fallback to API key
        if (!geminiResult && geminiApiKey) {
          try {
            geminiResult = await extractWithGeminiApiKey(documentText, geminiApiKey);
            result.gemini_method = "api_key";
          } catch (apiErr: any) {
            result.api_key_error = apiErr.message;
            console.error(`[reprocess] API key failed for ${extraction.id}:`, apiErr.message);
          }
        }

        if (!geminiResult || Object.keys(geminiResult).length === 0) {
          result.status = "failed";
          result.reason = "Gemini extraction returned no results";
          results.push(result);
          continue;
        }

        // Check document classification
        if (geminiResult.is_rental_agreement === false) {
          result.status = "not_rental_agreement";
          result.document_type = geminiResult.document_type_detected;
          result.rejection_reason = geminiResult.rejection_reason;

          // Update the record to reflect this is not a rental agreement
          await supabase
            .from("extracted_rental_info")
            .update({
              extraction_status: "completed",
              extraction_method: "combined",
              contract_status: "invalid_document",
              needs_manual_review: true,
              confidence_score: geminiResult.confidence || 0,
              gemini_raw_response: geminiResult,
            })
            .eq("id", extraction.id);

          results.push(result);
          continue;
        }

        // Merge Gemini results into extracted data
        const merged = mergeGeminiResults(geminiResult);

        // Derive lease_end_date if missing
        if (!merged.lease_end_date && merged.lease_start_date && merged.contract_length_months) {
          const start = new Date(merged.lease_start_date);
          if (!isNaN(start.getTime())) {
            start.setMonth(start.getMonth() + merged.contract_length_months);
            merged.lease_end_date = start.toISOString().split('T')[0];
          }
        }

        // Evaluate extraction
        const isCitySupported = checkCitySupported(merged.property_city, cityNames);
        const evaluation = evaluateExtraction(merged, isCitySupported);

        // Update the extraction record
        const { error: updateError } = await supabase
          .from("extracted_rental_info")
          .update({
            property_name: merged.property_name,
            property_address: merged.property_address,
            property_city: merged.property_city,
            property_state: merged.property_state,
            property_pincode: merged.property_pincode,
            micromarket: merged.micromarket,
            monthly_rent_paise: merged.monthly_rent_paise,
            security_deposit_paise: merged.security_deposit_paise,
            maintenance_paise: merged.maintenance_paise,
            lease_start_date: merged.lease_start_date,
            lease_end_date: merged.lease_end_date,
            rent_duration_months: merged.contract_length_months,
            rent_escalation_percent: merged.rent_escalation_percent,
            rent_due_day: merged.rent_due_day,
            agreement_date: merged.agreement_date,
            registration_number: merged.registration_number,
            certificate_no: merged.certificate_no,
            certificate_issued_date: merged.certificate_issued_date,
            account_reference: merged.account_reference,
            purchased_by: merged.purchased_by,
            description_of_document: merged.description_of_document,
            first_party: merged.first_party,
            second_party: merged.second_party,
            stamp_duty_paid_by: merged.stamp_duty_paid_by,
            consideration_price_paise: merged.consideration_price_paise,
            stamp_duty_amount_paise: merged.stamp_duty_amount_paise,
            rooms_in_agreement: merged.rooms_in_agreement,
            property_bhk_type: merged.property_bhk_type,
            confidence_score: merged.confidence_score,
            gemini_verification_score: merged.gemini_verification_score,
            fields_extracted: merged.fields_extracted,
            tenant_names: merged.tenant_names,
            landlord_names: merged.landlord_names,
            extraction_method: "combined",
            is_city_supported: isCitySupported,
            gemini_raw_response: geminiResult,
            extraction_status: "completed",
            contract_status: evaluation.contract_status,
            needs_manual_review: evaluation.needs_manual_review,
            extraction_error: null,
          })
          .eq("id", extraction.id);

        if (updateError) {
          result.status = "update_failed";
          result.reason = updateError.message;
        } else {
          // rental_parties is a VIEW — party data derived from extraction columns automatically.

          // Update waitlist_entries for V1 compatibility
          if (extraction.user_id) {
            await supabase
              .from("waitlist_entries")
              .update({
                extraction_status: "completed",
                contract_status: evaluation.contract_status,
              })
              .eq("user_id", extraction.user_id);
          }

          result.status = "success";
          result.contract_status = evaluation.contract_status;
          result.confidence = merged.confidence_score;
          result.fields_extracted = merged.fields_extracted;
          result.property_city = merged.property_city;
          result.monthly_rent = merged.monthly_rent_paise ? merged.monthly_rent_paise / 100 : null;
        }
      } catch (err: any) {
        result.status = "error";
        result.reason = err.message;
        console.error(`[reprocess] Error processing ${extraction.id}:`, err.message);
      }

      results.push(result);
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === "success").length,
      failed: results.filter(r => r.status === "failed" || r.status === "error" || r.status === "update_failed").length,
      skipped: results.filter(r => r.status === "skipped").length,
      not_rental: results.filter(r => r.status === "not_rental_agreement").length,
    };

    console.log(`[reprocess] Complete:`, JSON.stringify(summary));

    return new Response(JSON.stringify({ summary, results }), { status: 200, headers });

  } catch (err: any) {
    console.error("[reprocess] Fatal error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
});

// ============================================
// GEMINI EXTRACTION
// ============================================

function buildExtractionPrompt(documentText: string): string {
  return `You are analyzing a document that the user claims is an Indian rental/lease agreement. First determine if it actually IS a rental/lease agreement, then extract information.

DOCUMENT TEXT:
${documentText.substring(0, 50000)}

Extract and return a JSON object with these exact fields (use null for fields you cannot find):
{
  "is_rental_agreement": true/false,
  "document_type_detected": "what type of document this actually is",
  "rejection_reason": "if is_rental_agreement is false, explain why. null if true",
  "property_name": "SHORT display name: 'Flat/House#, Society/Complex Name, Locality, Pincode, City'",
  "property_address": "FULL verbose address as written in the agreement",
  "property_city": "city name",
  "property_state": "state name - infer from city if not explicit",
  "property_pincode": "6-digit pincode",
  "micromarket": "locality/area name",
  "monthly_rent": "number only in rupees",
  "security_deposit": "number only in rupees",
  "rent_escalation_percent": "annual escalation percentage as number",
  "contract_start_date": "YYYY-MM-DD format",
  "contract_end_date": "YYYY-MM-DD format",
  "contract_length_months": "duration in months as number",
  "rent_due_day": "day of month when rent is due",
  "tenant_names": ["array of tenant/lessee names"],
  "landlord_names": ["array of landlord/lessor/owner names"],
  "certificate_no": "certificate number from e-stamp. For Mumbai/Maharashtra, use GRN or Transaction ID as certificate_no",
  "certificate_issued_date": "YYYY-MM-DD format",
  "account_reference": "account reference from e-stamp",
  "purchased_by": "who purchased the stamp paper",
  "description_of_document": "document type (e.g., Rental Agreement)",
  "first_party": "first party on stamp paper (usually lessor)",
  "second_party": "second party on stamp paper (usually lessee)",
  "stamp_duty_paid_by": "who paid stamp duty",
  "consideration_price": "consideration amount in rupees (number only)",
  "stamp_duty_amount": "stamp duty in rupees (number only)",
  "rooms_in_agreement": "number of rooms/bedrooms covered by this agreement (e.g., 1 for single room, 2 for 2BHK, 3 for 3BHK). If only a portion is rented, return the rented portion count. null if not determinable.",
  "property_bhk_type": "BHK type of the FULL property (e.g., '1BHK', '2BHK', '3BHK', 'Studio', 'Independent House'). null if not mentioned.",
  "confidence": "your confidence 0-100"
}

IMPORTANT:
- FIRST: Determine is_rental_agreement. Set to true ONLY for rental/lease agreements.
- For amounts, extract only the numeric value (60000 not "Rs. 60,000")
- For dates, convert to YYYY-MM-DD format
- For property_state: infer from city if not explicitly mentioned
- MUMBAI: GRN or Transaction ID IS the Stamp Certificate ID
- For rooms_in_agreement: Look for "one room", "single bedroom", "2BHK", "3BHK", "entire flat", "portion of premises". Partial rent = count rented rooms only.
- Return ONLY the JSON object, no other text.`;
}

async function extractWithVertexAIGemini(
  documentText: string,
  accessToken: string,
  projectId: string,
): Promise<any> {
  const prompt = buildExtractionPrompt(documentText);

  // Global endpoint for provisioned throughput
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!textContent) throw new Error("Empty Vertex AI response");

  // Try direct JSON.parse first (responseMimeType=application/json gives clean JSON),
  // fall back to regex for markdown-wrapped responses
  try {
    return JSON.parse(textContent);
  } catch {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Vertex AI response");
    return JSON.parse(jsonMatch[0]);
  }
}

async function extractWithGeminiApiKey(
  documentText: string,
  apiKey: string,
): Promise<any> {
  const prompt = buildExtractionPrompt(documentText);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText.substring(0, 500)}`);
  }

  const result = await response.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!textContent) throw new Error("Empty Gemini API response");

  try {
    return JSON.parse(textContent);
  } catch {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Gemini API response");
    return JSON.parse(jsonMatch[0]);
  }
}

// ============================================
// DATA MERGING (mirrors process-document logic)
// ============================================

/** Split joint names like "RAMESH AND SEEMA JOSHI" into individual names */
function splitJointNames(names: string[]): string[] {
  const result: string[] = [];
  for (const name of names) {
    const parts = name.split(/\s+(?:AND|&|\/)\s+/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) result.push(trimmed);
    }
  }
  return result;
}

function mergeGeminiResults(gemini: any): any {
  const merged: any = {
    property_name: gemini.property_name || null,
    property_address: gemini.property_address || null,
    property_city: gemini.property_city || null,
    property_state: gemini.property_state || inferStateFromCity(gemini.property_city),
    property_pincode: (gemini.property_pincode || "").toString().replace(/\D/g, '').substring(0, 6) || null,
    micromarket: gemini.micromarket || null,
    // Convert rupees to paise
    monthly_rent_paise: gemini.monthly_rent ? parseInt(String(gemini.monthly_rent)) * 100 : null,
    security_deposit_paise: gemini.security_deposit ? parseInt(String(gemini.security_deposit)) * 100 : null,
    maintenance_paise: null,
    rent_escalation_percent: gemini.rent_escalation_percent != null ? Number(gemini.rent_escalation_percent) : null,
    lease_start_date: gemini.contract_start_date || null,
    lease_end_date: gemini.contract_end_date || null,
    contract_length_months: gemini.contract_length_months != null ? Number(gemini.contract_length_months) : null,
    rent_due_day: gemini.rent_due_day != null ? Number(gemini.rent_due_day) : null,
    tenant_names: gemini.tenant_names?.length > 0 ? splitJointNames(gemini.tenant_names) : [],
    landlord_names: gemini.landlord_names?.length > 0 ? splitJointNames(gemini.landlord_names) : [],
    // E-stamp fields
    certificate_no: gemini.certificate_no || null,
    certificate_issued_date: gemini.certificate_issued_date || null,
    account_reference: gemini.account_reference || null,
    purchased_by: gemini.purchased_by || null,
    description_of_document: gemini.description_of_document || null,
    first_party: gemini.first_party || null,
    second_party: gemini.second_party || null,
    stamp_duty_paid_by: gemini.stamp_duty_paid_by || null,
    consideration_price_paise: gemini.consideration_price ? parseInt(String(gemini.consideration_price)) * 100 : null,
    stamp_duty_amount_paise: gemini.stamp_duty_amount ? parseInt(String(gemini.stamp_duty_amount)) * 100 : null,
    rooms_in_agreement: gemini.rooms_in_agreement != null ? Number(gemini.rooms_in_agreement) : null,
    property_bhk_type: gemini.property_bhk_type || null,
    gemini_verification_score: gemini.confidence || null,
    confidence_score: gemini.confidence != null && Number(gemini.confidence) > 0
      ? Number(gemini.confidence) : 0,
    agreement_date: null,
    registration_number: null,
    fields_extracted: 0,
  };

  // Sanity-check financial amounts (same guards as process-document)
  const MAX_RENT_PAISE = 50_00_000_00;
  const MAX_DEPOSIT_PAISE = 500_00_000_00;
  if (merged.monthly_rent_paise != null && (merged.monthly_rent_paise <= 0 || merged.monthly_rent_paise > MAX_RENT_PAISE)) {
    console.warn(`[reprocess] Invalid monthly_rent_paise=${merged.monthly_rent_paise}, clearing`);
    merged.monthly_rent_paise = null;
  }
  if (merged.security_deposit_paise != null && (merged.security_deposit_paise < 0 || merged.security_deposit_paise > MAX_DEPOSIT_PAISE)) {
    console.warn(`[reprocess] Invalid security_deposit_paise=${merged.security_deposit_paise}, clearing`);
    merged.security_deposit_paise = null;
  }
  if (merged.rooms_in_agreement != null && (merged.rooms_in_agreement < 1 || merged.rooms_in_agreement > 20)) {
    merged.rooms_in_agreement = null;
  }
  if (merged.rent_due_day != null && (merged.rent_due_day < 1 || merged.rent_due_day > 28)) {
    merged.rent_due_day = null;
  }

  merged.fields_extracted = countExtractedFields(merged);
  return merged;
}

function inferStateFromCity(city?: string): string | null {
  if (!city) return null;
  const cl = city.toLowerCase();
  if (cl.includes('bangalore') || cl.includes('bengaluru') || cl.includes('mysore') || cl.includes('mysuru')) return 'Karnataka';
  if (cl.includes('mumbai') || cl.includes('pune') || cl.includes('nagpur') || cl.includes('thane')) return 'Maharashtra';
  if (cl.includes('delhi') || cl.includes('noida') || cl.includes('gurgaon') || cl.includes('gurugram')) return 'Delhi NCR';
  if (cl.includes('chennai') || cl.includes('coimbatore')) return 'Tamil Nadu';
  if (cl.includes('hyderabad') || cl.includes('secunderabad')) return 'Telangana';
  if (cl.includes('kolkata')) return 'West Bengal';
  if (cl.includes('ahmedabad') || cl.includes('surat')) return 'Gujarat';
  return null;
}

function countExtractedFields(data: any): number {
  let count = 0;
  if (data.property_name) count++;
  if (data.property_address) count++;
  if (data.property_city) count++;
  if (data.property_state) count++;
  if (data.property_pincode) count++;
  if (data.micromarket) count++;
  if (data.monthly_rent_paise) count++;
  if (data.security_deposit_paise) count++;
  if (data.rent_escalation_percent) count++;
  if (data.lease_start_date) count++;
  if (data.contract_length_months || data.lease_end_date) count++;
  if (data.rent_due_day) count++;
  if (data.tenant_names?.length > 0) count++;
  if (data.landlord_names?.length > 0) count++;
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

function checkCitySupported(city: string | undefined, supportedCities: string[]): boolean {
  if (!city) return false;
  const nc = city.toLowerCase().trim();
  return supportedCities.some(sc => nc.includes(sc.toLowerCase()) || sc.toLowerCase().includes(nc));
}

function evaluateExtraction(data: any, isCitySupported: boolean): { needs_manual_review: boolean; review_reason?: string; contract_status: string } {
  // Check document classification
  if (data.is_rental_agreement === false) {
    return {
      needs_manual_review: true,
      review_reason: data.rejection_reason || 'Not a rental agreement',
      contract_status: 'invalid_document',
    };
  }

  // Expired agreements are NOT a blocker — common for verbal renewals and
  // extensions pending. Risk engine flags these as RED (agreement_expiry signal).
  // Log for visibility but proceed with extraction.

  // Check critical fields
  const criticalMissing: string[] = [];
  if (!data.monthly_rent_paise || data.monthly_rent_paise <= 0) criticalMissing.push('Monthly Rent');
  if (!data.security_deposit_paise || data.security_deposit_paise <= 0) criticalMissing.push('Security Deposit');
  if (!data.lease_end_date) criticalMissing.push('Lease End Date');
  if (!data.landlord_names?.length) criticalMissing.push('Landlord Name');

  if (criticalMissing.length > 0) {
    return {
      needs_manual_review: true,
      review_reason: `Missing critical fields: ${criticalMissing.join(', ')}.`,
      contract_status: 'invalid_document',
    };
  }

  // Minimum required fields check
  const minMissing: string[] = [];
  if (!data.property_name?.trim()) minMissing.push('Property Name');
  if (!data.property_state?.trim()) minMissing.push('State');
  if (!data.property_city?.trim()) minMissing.push('City');
  if (!data.property_pincode?.trim()) minMissing.push('Pincode');
  if (!data.tenant_names?.length) minMissing.push('Tenant Name(s)');
  if (!data.landlord_names?.length) minMissing.push('Landlord Name(s)');
  if (!data.monthly_rent_paise || data.monthly_rent_paise <= 0) minMissing.push('Monthly Rent');
  if (!data.security_deposit_paise || data.security_deposit_paise <= 0) minMissing.push('Security Deposit');
  if (!data.lease_start_date?.trim()) minMissing.push('Rent Start Date');
  if (!data.certificate_no?.trim()) minMissing.push('Certificate No.');

  if (minMissing.length > 0) {
    return {
      needs_manual_review: true,
      review_reason: `Missing fields: ${minMissing.join(', ')}.`,
      contract_status: 'manual_review',
    };
  }

  // All good
  return {
    needs_manual_review: false,
    contract_status: 'user_review',
  };
}

// ============================================
// GCP AUTH
// ============================================

async function getGCPAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createJWT(credentials);
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
    throw new Error(`GCP auth failed: ${tokenResult.error_description || tokenResult.error}`);
  }
  return tokenResult.access_token;
}

function base64url(data: string | Uint8Array): string {
  let base64: string;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...data));
  }
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

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const keyData = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const encoder = new TextEncoder();

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

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${signatureInput}.${signatureB64}`;
}
