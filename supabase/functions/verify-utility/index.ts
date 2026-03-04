/**
 * Flent Secured v2 - Verify Utility Edge Function
 *
 * Verifies property ownership using electricity bills via API Club.
 * Matches:
 * 1. Consumer name on bill with landlord name (ownership verification)
 * 2. Bill address with property address (location verification)
 *
 * Endpoints:
 * - POST /functions/v1/verify-utility - Verify electricity bill
 * - GET /functions/v1/verify-utility?action=operators - Get electricity operator list
 *
 * Auth: Required (JWT) for POST, Optional for GET operators
 *
 * Reference: https://www.apiclub.in/product/electricity_fetch_bill_api
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  ExternalServiceError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { verifyUtilityBillWithGemini } from "../_shared/gemini.ts";
import {
  resolveAgreementNames,
  calculateNameMatchScore as sharedCalculateNameMatchScore,
} from "../_shared/name-match-service.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const API_CLUB_KEY = Deno.env.get("API_CLUB_KEY");
const API_CLUB_BASE_URL =
  Deno.env.get("API_CLUB_BASE_URL") ?? "https://prod.apiclub.in/api/v1";
const PROXY_SECRET = Deno.env.get("PROXY_SECRET");

// Fallback thresholds (only used when Gemini fails)
const ADDRESS_MATCH_THRESHOLD = 0.7;
const NAME_MATCH_THRESHOLD = 0.7;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ==============================================
// TYPES
// ==============================================

interface VerifyUtilityRequest {
  tenancy_id: string;
  consumer_number: string;
  operator_code: string;
  params?: Record<string, string>; // Additional params required by some operators (e.g., "Billing Unit")
}

interface BillFetchResponse {
  code?: number;
  status: string;
  response?: {
    consumer_name?: string;
    customer_name?: string; // API Club BESCOM uses customer_name instead of consumer_name
    bill_amount?: number;
    due_date?: string;
    address?: string;
    state?: string;
    city?: string;
    bill_number?: string;
    bill_date?: string;
    bill_period?: string;
    connection_type?: string;
    meter_number?: string;
    sanctioned_load?: string;
    total_units?: number;
    current_reading?: number;
    previous_reading?: number;
  };
  request_id?: string;
  message?: string;
}

interface OperatorInfo {
  operator_code: string;
  operator_name: string;
  state?: string;
  params?: string[]; // Additional params required by some operators (e.g., "Billing Unit")
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: true, type: "string" as const },
  consumer_number: { required: true, type: "string" as const, minLength: 5, maxLength: 30 },
  operator_code: { required: true, type: "string" as const, minLength: 2, maxLength: 30 },
  params: { required: false, type: "object" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // GET /verify-utility?action=operators - Return electricity operator list
  if (req.method === "GET" && action === "operators") {
    return await handleGetOperators();
  }

  // POST /verify-utility - Verify electricity bill
  if (req.method === "POST") {
    return await handleVerifyUtility(req);
  }

  return errorResponse("Method not allowed", 405);
});

// ==============================================
// GET OPERATORS HANDLER
// ==============================================

async function handleGetOperators(): Promise<Response> {
  if (!API_CLUB_KEY) {
    return errorResponse("API not configured", 503);
  }

  try {
    const response = await fetchWithRetry(`${API_CLUB_BASE_URL}/fetch_bill_operator`, {
      headers: {
        "x-api-key": API_CLUB_KEY,
        "X-Request-Id": `FLENT_OP_${Date.now()}`,
        ...(PROXY_SECRET && { "X-Proxy-Secret": PROXY_SECRET }),
      },
    });

    const data = await response.json();

    // API Club returns object with numeric keys: {"0": {...}, "1": {...}, "timestamp": "..."}
    // NOT an array. We need to extract operator objects from this structure.
    // BUG FIX: Also handle when data/response is an object (not array) with operators nested inside
    let operatorEntries: Record<string, unknown>[];

    if (Array.isArray(data)) {
      // If response is already an array (shouldn't happen, but handle it)
      operatorEntries = data;
    } else if (data.data && Array.isArray(data.data)) {
      // If wrapped in data field as array
      operatorEntries = data.data;
    } else if (data.response && Array.isArray(data.response)) {
      // If wrapped in response field as array
      operatorEntries = data.response;
    } else if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
      // BUG FIX: API Club may return data as object with numeric keys inside "data" field
      operatorEntries = Object.entries(data.data)
        .filter(([key, value]) => {
          const isNumericKey = /^\d+$/.test(key);
          const isOperatorObject =
            typeof value === "object" &&
            value !== null &&
            ("operator_code" in value || "code" in value || "name" in value);
          return isNumericKey && isOperatorObject;
        })
        .map(([, value]) => value as Record<string, unknown>);
    } else if (data.response && typeof data.response === "object" && !Array.isArray(data.response)) {
      // BUG FIX: API Club may return data as object with numeric keys inside "response" field
      operatorEntries = Object.entries(data.response)
        .filter(([key, value]) => {
          const isNumericKey = /^\d+$/.test(key);
          const isOperatorObject =
            typeof value === "object" &&
            value !== null &&
            ("operator_code" in value || "code" in value || "name" in value);
          return isNumericKey && isOperatorObject;
        })
        .map(([, value]) => value as Record<string, unknown>);
    } else if (typeof data === "object" && data !== null) {
      // API Club format: object with numeric keys {"0": {...}, "1": {...}, "timestamp": "..."}
      operatorEntries = Object.entries(data)
        .filter(([key, value]) => {
          // Filter out non-operator keys like "timestamp", keep numeric keys
          const isNumericKey = /^\d+$/.test(key);
          const isOperatorObject =
            typeof value === "object" &&
            value !== null &&
            ("operator_code" in value || "code" in value || "name" in value);
          return isNumericKey && isOperatorObject;
        })
        .map(([, value]) => value as Record<string, unknown>);
    } else {
      operatorEntries = [];
    }

    // Normalize operator data
    const operators: OperatorInfo[] = operatorEntries.map(
      (op: Record<string, unknown>) => ({
        operator_code: String(op.operator_code ?? op.code ?? op.id ?? ""),
        operator_name: String(op.operator_name ?? op.name ?? op.operator ?? "Unknown"),
        state: op.state ? String(op.state) : undefined,
        params: Array.isArray(op.params) ? op.params.map(String) : undefined,
      })
    ).filter(op => op.operator_code); // Filter out any with empty codes

    console.log(`[verify-utility] Fetched ${operators.length} operators from API Club`);

    return jsonResponse({
      success: true,
      data: {
        operators,
        count: operators.length,
      },
    });
  } catch (error) {
    console.error("Failed to fetch operators:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch operators",
      500
    );
  }
}

// ==============================================
// VERIFY UTILITY HANDLER
// ==============================================

async function handleVerifyUtility(req: Request): Promise<Response> {
  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-utility");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateSchema<VerifyUtilityRequest>(
      body,
      requestSchema,
      true
    );

    const { tenancy_id, consumer_number, operator_code, params: operatorParams } = validatedBody;

    // Log verification initiation
    await audit.logSuccess(
      AuditActions.UTILITY_VERIFICATION_INITIATED,
      "verification",
      "utility_verification",
      undefined,
      {
        tenancy_id,
        operator_code,
        consumer_number_masked: maskConsumerNumber(consumer_number),
      }
    );

    // Verify tenancy belongs to user and get landlord + address info
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(`
        id,
        user_id,
        landlord_name,
        property_address,
        property_city,
        property_state,
        property_pincode,
        extracted_rental_info_id
      `)
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new ValidationError("Tenancy not found", { tenancy_id: "Not found" });
    }

    if (tenancy.user_id !== userId) {
      throw new AppError("You don't have permission to modify this tenancy", "FORBIDDEN", 403);
    }

    // ── DEMO BYPASS ──────────────────────────────────────────────────
    if (await isTestUser(userId, supabase)) {
      await supabase.from("tenancies").update({ utility_verified: true }).eq("id", tenancy_id);

      await audit!.logSuccess("UTILITY_VERIFICATION_DEMO_BYPASS", "verification", "utility_verification", undefined, {
        demo: true, tenancy_id, operator_code,
      });

      return jsonResponse({
        success: true,
        data: {
          verification_id: null,
          verified: true,
          name_verified: true,
          address_verified: true,
          bank_name_verified: true,
          consumer_name: "Demo Consumer",
          landlord_name: tenancy.landlord_name ?? "Demo Landlord",
          name_match_score: 100,
          address_match_score: 100,
          bank_name_match_score: 100,
          match_threshold: 70,
          message: "Ownership verified successfully",
          matching_method: "demo_bypass",
        },
      });
    }
    // ── END DEMO BYPASS ──────────────────────────────────────────────

    // Resolve landlord names from agreement (shared service)
    const resolved = await resolveAgreementNames(supabase, tenancy_id, "landlord");
    const allLandlordNames = resolved.names;
    const primaryLandlordName = resolved.primaryName;

    // Fetch electricity bill from API Club
    const billResult = await fetchElectricityBill(consumer_number, operator_code, operatorParams);

    // Build addresses for comparison
    const tenancyAddress = buildAddress(
      tenancy.property_address,
      tenancy.property_city,
      tenancy.property_state,
      tenancy.property_pincode
    );

    const billAddress = buildAddress(
      billResult.response?.address,
      billResult.response?.city,
      billResult.response?.state
    );

    // Determine if bill was fetched successfully
    const isBillFetched = billResult.status === "success" && billResult.response;
    // API Club BESCOM returns customer_name instead of consumer_name — normalize
    const consumerName = billResult.response?.consumer_name ?? billResult.response?.customer_name ?? "";

    // Single Gemini call — all data in, any match = pass
    let isFullyVerified = false;
    let matchScore = 0;
    let bestMatchLandlordName = primaryLandlordName;
    let matchDetails: {
      gemini_used: boolean;
      reasoning?: string;
      match_type?: string;
      match_found_in?: string;
      matched_value?: string;
      all_landlord_names?: string[];
    } = { gemini_used: false };

    if (isBillFetched && consumerName) {
      try {
        console.log("[verify-utility] Single Gemini call: consumer name + landlords + addresses");

        const result = await verifyUtilityBillWithGemini(
          consumerName,
          allLandlordNames,
          tenancyAddress,
          billAddress,
        );

        isFullyVerified = result.verified;
        matchScore = result.confidence / 100;
        bestMatchLandlordName = result.matched_value ?? primaryLandlordName;

        matchDetails = {
          gemini_used: true,
          reasoning: result.reasoning,
          match_type: result.name_match_type,
          match_found_in: result.match_found_in,
          matched_value: result.matched_value ?? undefined,
          all_landlord_names: allLandlordNames.length > 1 ? allLandlordNames : undefined,
        };

        console.log("[verify-utility] Verification result:", {
          verified: isFullyVerified,
          match_found_in: result.match_found_in,
          matched_value: result.matched_value,
          confidence: result.confidence,
          landlord_count: allLandlordNames.length,
        });
      } catch (geminiError) {
        console.warn("[verify-utility] Gemini failed, falling back to algorithmic:", geminiError);

        // Algorithmic fallback: check name overlap against landlords
        let bestNameScore = 0;
        for (const landlordName of allLandlordNames) {
          const score = sharedCalculateNameMatchScore(landlordName, consumerName);
          if (score > bestNameScore) {
            bestNameScore = score;
            bestMatchLandlordName = landlordName;
          }
        }

        // Address fallback
        const addressScore = calculateAddressMatchScore(tenancyAddress, billAddress);

        // Any one match = pass
        isFullyVerified = bestNameScore >= NAME_MATCH_THRESHOLD || addressScore >= ADDRESS_MATCH_THRESHOLD;
        matchScore = Math.max(bestNameScore, addressScore);
      }
    }

    // Create utility verification record
    const verificationData = {
      user_id: userId,
      tenancy_id,
      utility_type: "electricity",
      operator_code,
      operator_name: operator_code,
      consumer_number,
      consumer_name: consumerName || null,
      status: isBillFetched ? "success" : "failed",
      bill_amount_paise: billResult.response?.bill_amount
        ? Math.round(billResult.response.bill_amount * 100)
        : null,
      bill_due_date: billResult.response?.due_date,
      bill_address: billAddress,
      bill_data: billResult.response,
      address_match_score: matchScore * 100,
      name_match_score: matchScore * 100,
      address_verified: isFullyVerified,
      name_verified: isFullyVerified,
      bank_name_match_score: 0,
      bank_name_verified: false,
      verified_at: isFullyVerified ? new Date().toISOString() : null,
      match_details: {
        gemini_used: matchDetails.gemini_used,
        reasoning: matchDetails.reasoning,
        match_type: matchDetails.match_type,
        match_found_in: matchDetails.match_found_in,
        matched_value: matchDetails.matched_value,
        all_landlord_names: matchDetails.all_landlord_names,
      },
    };

    const { data: verification, error: insertError } = await supabase
      .from("utility_verifications")
      .insert(verificationData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert utility verification:", insertError);
      throw new AppError("Failed to save verification result", "DB_ERROR", 500);
    }

    // Update tenancy verification status if fully verified
    if (isFullyVerified) {
      await supabase
        .from("tenancies")
        .update({ utility_verified: true })
        .eq("id", tenancy_id);
    }

    // Log result
    if (isFullyVerified) {
      await audit.logSuccess(
        AuditActions.UTILITY_VERIFICATION_SUCCESS,
        "verification",
        "utility_verification",
        verification.id,
        {
          match_score: matchScore,
          match_found_in: matchDetails.match_found_in,
          matched_value: matchDetails.matched_value,
          consumer_name: consumerName,
          landlord_name: bestMatchLandlordName,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.UTILITY_VERIFICATION_FAILED,
        "verification",
        !isBillFetched ? "BILL_FETCH_FAILED" : "NO_MATCH",
        !isBillFetched
          ? (billResult.message ?? "Failed to fetch bill")
          : `No match found — consumer: "${consumerName}", landlords: ${allLandlordNames.join(", ")}`,
        "utility_verification",
        verification.id,
        {
          match_score: matchScore,
          tenancy_address: tenancyAddress,
          bill_address: billAddress,
          consumer_name: consumerName,
          all_landlord_names: allLandlordNames,
        }
      );
    }

    const message = isFullyVerified
      ? "Ownership verified successfully"
      : !isBillFetched
      ? (billResult.message ?? "Failed to fetch electricity bill")
      : "The electricity bill details do not match the rental agreement. Please ensure you are using the correct consumer number for your rented property.";

    return jsonResponse({
      success: true,
      data: {
        verification_id: verification.id,
        verified: isFullyVerified,
        consumer_name: consumerName,
        landlord_name: bestMatchLandlordName,
        match_score: Math.round(matchScore * 100),
        match_found_in: matchDetails.match_found_in,
        matched_value: matchDetails.matched_value,
        bill_amount: billResult.response?.bill_amount,
        bill_due_date: billResult.response?.due_date,
        message,
        matching_method: matchDetails.gemini_used ? "gemini_ai" : "algorithmic",
        ...(matchDetails.gemini_used && {
          reasoning: matchDetails.reasoning,
          match_type: matchDetails.match_type,
        }),
      },
    });
  } catch (error) {
    if (audit && userId) {
      await audit.logFailure(
        AuditActions.UTILITY_VERIFICATION_FAILED,
        "verification",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "utility_verification"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
}

// ==============================================
// API CLUB ELECTRICITY BILL API
// ==============================================

async function fetchElectricityBill(
  consumerNumber: string,
  operatorCode: string,
  params?: Record<string, string>
): Promise<BillFetchResponse> {
  if (!API_CLUB_KEY) {
    throw new ExternalServiceError("API Club", "API key not configured");
  }

  const requestId = `FLENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  try {
    const requestBody: Record<string, unknown> = {
      consumer_no: consumerNumber,
      operator: operatorCode,
    };
    // Forward operator-specific params (e.g., "Billing Unit" for some operators)
    if (params && Object.keys(params).length > 0) {
      requestBody.params = params;
    }

    const response = await fetchWithRetry(`${API_CLUB_BASE_URL}/fetch_bill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_CLUB_KEY,
        "X-Request-Id": requestId,
        ...(PROXY_SECRET && { "X-Proxy-Secret": PROXY_SECRET }),
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Club electricity bill error:", data);
      return {
        status: "error",
        message: data.message ?? `HTTP ${response.status}`,
      };
    }

    // Handle API Club's response wrapper
    const billData = data.response ?? data;

    // Normalize: API Club BESCOM uses customer_name, our interface expects consumer_name
    if (typeof billData === "object" && billData.customer_name && !billData.consumer_name) {
      billData.consumer_name = billData.customer_name;
    }

    return {
      code: data.code,
      status: data.status ?? "success",
      response: typeof billData === "object" ? billData : undefined,
      request_id: data.request_id,
      message: data.message ?? (typeof billData === "string" ? billData : undefined),
    };
  } catch (error) {
    console.error("API Club electricity bill fetch failed:", error);
    throw new ExternalServiceError(
      "API Club",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// RETRY LOGIC
// ==============================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      // Retry on server errors (5xx) and rate limits (429)
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`API call failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`API call error (attempt ${attempt}/${retries}): ${lastError.message}, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// NOTE: calculateNameMatchScore is now imported from _shared/name-match-service.ts as sharedCalculateNameMatchScore

// ==============================================
// ADDRESS MATCHING
// ==============================================

/**
 * Builds a normalized address string from components.
 */
function buildAddress(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ");
}

/**
 * Calculates similarity score between two addresses.
 * Uses word overlap, pincode matching, and location keywords.
 */
function calculateAddressMatchScore(address1: string, address2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const s1 = normalize(address1);
  const s2 = normalize(address2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Extract significant words (length > 2)
  const words1 = new Set(s1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(s2.split(" ").filter((w) => w.length > 2));

  // Calculate Jaccard similarity
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);
  const jaccardSimilarity = union.size > 0 ? intersection.length / union.size : 0;

  // Extract and compare numbers
  const numbers1 = s1.match(/\d+/g) ?? [];
  const numbers2 = s2.match(/\d+/g) ?? [];

  // Pincode match (6 digits) is very important
  const pincodes1 = numbers1.filter((n) => n.length === 6);
  const pincodes2 = numbers2.filter((n) => n.length === 6);
  const pincodeMatch = pincodes1.some((p) => pincodes2.includes(p)) ? 0.3 : 0;

  // Other number matches (flat, building numbers)
  const otherNumbers1 = numbers1.filter((n) => n.length < 6);
  const otherNumbers2 = numbers2.filter((n) => n.length < 6);
  const numberMatch = otherNumbers1.some((n) => otherNumbers2.includes(n)) ? 0.1 : 0;

  // Location keywords
  const locationKeywords = [
    "nagar", "colony", "society", "apartments", "tower", "heights",
    "residency", "enclave", "complex", "park", "garden", "villa",
    "layout", "sector", "phase", "block", "wing", "floor",
  ];
  const hasLocationMatch = locationKeywords.some(
    (kw) => s1.includes(kw) && s2.includes(kw)
  );
  const locationBonus = hasLocationMatch ? 0.1 : 0;

  // Combine scores
  const finalScore = Math.min(
    jaccardSimilarity * 0.5 + pincodeMatch + numberMatch + locationBonus,
    1
  );

  return finalScore;
}

// ==============================================
// HELPERS
// ==============================================

/**
 * Masks consumer number for logging.
 */
function maskConsumerNumber(consumerNumber: string): string {
  if (consumerNumber.length <= 6) {
    return "***";
  }
  return `${consumerNumber.slice(0, 3)}***${consumerNumber.slice(-3)}`;
}
