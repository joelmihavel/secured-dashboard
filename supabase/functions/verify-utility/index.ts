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
import { verifyUtilityWithGemini } from "../_shared/gemini.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const API_CLUB_KEY = Deno.env.get("API_CLUB_KEY");
const API_CLUB_BASE_URL = "https://api.apiclub.in/api/v1";

// Matching thresholds (used as fallback if Gemini fails)
const ADDRESS_MATCH_THRESHOLD = 0.7; // 70%
const NAME_MATCH_THRESHOLD = 0.7; // 70%

// Use Gemini AI for matching (recommended for production)
const USE_GEMINI_MATCHING = Deno.env.get("USE_GEMINI_MATCHING") !== "false";

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
}

interface BillFetchResponse {
  code?: number;
  status: string;
  response?: {
    consumer_name?: string;
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
      },
    });

    const data = await response.json();

    // API Club returns object with numeric keys: {"0": {...}, "1": {...}, "timestamp": "..."}
    // NOT an array. We need to extract operator objects from this structure.
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
    } else if (typeof data === "object" && data !== null) {
      // API Club format: object with numeric keys {"0": {...}, "1": {...}, "timestamp": "..."}
      operatorEntries = Object.entries(data)
        .filter(([key, value]) => {
          // Filter out non-operator keys like "timestamp", keep numeric keys
          const isNumericKey = /^\d+$/.test(key);
          const isOperatorObject =
            typeof value === "object" &&
            value !== null &&
            ("operator_code" in value || "code" in value);
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

    const { tenancy_id, consumer_number, operator_code } = validatedBody;

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
        property_pincode
      `)
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new ValidationError("Tenancy not found", { tenancy_id: "Not found" });
    }

    if (tenancy.user_id !== userId) {
      throw new AppError("You don't have permission to modify this tenancy", "FORBIDDEN", 403);
    }

    // Fetch electricity bill from API Club
    const billResult = await fetchElectricityBill(consumer_number, operator_code);

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
    const consumerName = billResult.response?.consumer_name ?? "";
    const landlordName = tenancy.landlord_name ?? "";

    // Calculate match scores - use Gemini AI if available, fallback to algorithmic
    let addressMatchScore: number;
    let nameMatchScore: number;
    let isAddressVerified: boolean;
    let isNameVerified: boolean;
    let matchDetails: {
      gemini_used: boolean;
      name_reasoning?: string;
      address_reasoning?: string;
      name_match_type?: string;
      address_match_type?: string;
    } = { gemini_used: false };

    if (isBillFetched && USE_GEMINI_MATCHING && consumerName && landlordName) {
      try {
        console.log("[verify-utility] Using Gemini AI for semantic matching");
        const geminiResult = await verifyUtilityWithGemini(
          landlordName,
          consumerName,
          tenancyAddress,
          billAddress
        );

        // Use Gemini results
        nameMatchScore = geminiResult.name_match.confidence / 100;
        addressMatchScore = geminiResult.address_match.confidence / 100;
        isNameVerified = geminiResult.name_match.is_match;
        isAddressVerified = geminiResult.address_match.is_match;
        matchDetails = {
          gemini_used: true,
          name_reasoning: geminiResult.name_match.reasoning,
          address_reasoning: geminiResult.address_match.reasoning,
          name_match_type: geminiResult.name_match.match_type,
          address_match_type: geminiResult.address_match.match_type,
        };

        console.log("[verify-utility] Gemini matching result:", {
          name_match: geminiResult.name_match.is_match,
          name_confidence: geminiResult.name_match.confidence,
          address_match: geminiResult.address_match.is_match,
          address_confidence: geminiResult.address_match.confidence,
          overall: geminiResult.overall_verified,
          recommendation: geminiResult.recommendation,
        });
      } catch (geminiError) {
        console.warn("[verify-utility] Gemini matching failed, falling back to algorithmic:", geminiError);
        // Fallback to algorithmic matching
        addressMatchScore = calculateAddressMatchScore(tenancyAddress, billAddress);
        nameMatchScore = calculateNameMatchScore(landlordName, consumerName);
        isAddressVerified = addressMatchScore >= ADDRESS_MATCH_THRESHOLD;
        isNameVerified = nameMatchScore >= NAME_MATCH_THRESHOLD;
      }
    } else {
      // Use algorithmic matching (Gemini disabled or no data)
      addressMatchScore = isBillFetched ? calculateAddressMatchScore(tenancyAddress, billAddress) : 0;
      nameMatchScore = isBillFetched ? calculateNameMatchScore(landlordName, consumerName) : 0;
      isAddressVerified = isBillFetched && addressMatchScore >= ADDRESS_MATCH_THRESHOLD;
      isNameVerified = isBillFetched && nameMatchScore >= NAME_MATCH_THRESHOLD;
    }

    const isFullyVerified = isAddressVerified && isNameVerified;

    // Create utility verification record
    const verificationData = {
      user_id: userId,
      tenancy_id,
      utility_type: "electricity",
      operator_code,
      operator_name: operator_code,
      consumer_number,
      consumer_name: billResult.response?.consumer_name,
      status: isBillFetched ? "success" : "failed",
      bill_amount_paise: billResult.response?.bill_amount
        ? Math.round(billResult.response.bill_amount * 100)
        : null,
      bill_due_date: billResult.response?.due_date,
      bill_address: billAddress,
      bill_data: billResult.response,
      address_match_score: addressMatchScore * 100,
      name_match_score: nameMatchScore * 100,
      address_verified: isAddressVerified,
      name_verified: isNameVerified,
      verified_at: isFullyVerified ? new Date().toISOString() : null,
      // Gemini AI matching details
      match_details: matchDetails.gemini_used ? {
        gemini_used: true,
        name_reasoning: matchDetails.name_reasoning,
        address_reasoning: matchDetails.address_reasoning,
        name_match_type: matchDetails.name_match_type,
        address_match_type: matchDetails.address_match_type,
      } : null,
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
          address_match_score: addressMatchScore,
          name_match_score: nameMatchScore,
          consumer_name: billResult.response?.consumer_name,
          landlord_name: tenancy.landlord_name,
        }
      );
    } else {
      const failureReason = !isBillFetched
        ? "BILL_FETCH_FAILED"
        : !isNameVerified
        ? "NAME_MISMATCH"
        : "ADDRESS_MISMATCH";

      const failureMessage = !isBillFetched
        ? billResult.message ?? "Failed to fetch bill"
        : !isNameVerified
        ? `Name match ${(nameMatchScore * 100).toFixed(0)}% below threshold (bill: "${billResult.response?.consumer_name}", landlord: "${tenancy.landlord_name}")`
        : `Address match ${(addressMatchScore * 100).toFixed(0)}% below threshold`;

      await audit.logFailure(
        AuditActions.UTILITY_VERIFICATION_FAILED,
        "verification",
        failureReason,
        failureMessage,
        "utility_verification",
        verification.id,
        {
          address_match_score: addressMatchScore,
          name_match_score: nameMatchScore,
          tenancy_address: tenancyAddress,
          bill_address: billAddress,
          landlord_name: tenancy.landlord_name,
          consumer_name: billResult.response?.consumer_name,
        }
      );
    }

    // Build verification message
    let message: string;
    if (isFullyVerified) {
      message = "Ownership verified successfully - landlord name and address match";
    } else if (!isBillFetched) {
      message = billResult.message ?? "Failed to fetch electricity bill";
    } else if (!isNameVerified && !isAddressVerified) {
      message = "Verification failed - neither landlord name nor address match";
    } else if (!isNameVerified) {
      message = "Landlord name on bill doesn't match";
    } else {
      message = "Address on bill doesn't match property address";
    }

    return jsonResponse({
      success: true,
      data: {
        verification_id: verification.id,
        verified: isFullyVerified,
        name_verified: isNameVerified,
        address_verified: isAddressVerified,
        consumer_name: billResult.response?.consumer_name,
        landlord_name: tenancy.landlord_name,
        name_match_score: Math.round(nameMatchScore * 100),
        address_match_score: Math.round(addressMatchScore * 100),
        match_threshold: NAME_MATCH_THRESHOLD * 100,
        bill_amount: billResult.response?.bill_amount,
        bill_due_date: billResult.response?.due_date,
        message,
        // Include Gemini matching details in response
        matching_method: matchDetails.gemini_used ? "gemini_ai" : "algorithmic",
        ...(matchDetails.gemini_used && {
          name_reasoning: matchDetails.name_reasoning,
          address_reasoning: matchDetails.address_reasoning,
          name_match_type: matchDetails.name_match_type,
          address_match_type: matchDetails.address_match_type,
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
  operatorCode: string
): Promise<BillFetchResponse> {
  if (!API_CLUB_KEY) {
    throw new ExternalServiceError("API Club", "API key not configured");
  }

  try {
    const response = await fetchWithRetry(`${API_CLUB_BASE_URL}/fetch_bill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_CLUB_KEY,
      },
      body: JSON.stringify({
        consumer_no: consumerNumber,
        operator: operatorCode,
      }),
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

// ==============================================
// NAME MATCHING
// ==============================================

/**
 * Calculates name match score using Levenshtein distance.
 * Handles common Indian name variations (initials, middle names, etc.)
 */
function calculateNameMatchScore(name1: string, name2: string): number {
  // Normalize names
  const normalize = (s: string) =>
    s
      .toUpperCase()
      .replace(/[^A-Z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return 1;
  if (!n1 || !n2) return 0;

  // Split into words and compare
  const words1 = n1.split(" ");
  const words2 = n2.split(" ");

  // Check if one name contains initials (single letter words)
  const hasInitials1 = words1.some((w) => w.length === 1);
  const hasInitials2 = words2.some((w) => w.length === 1);

  // If initials present, expand comparison
  if (hasInitials1 || hasInitials2) {
    // Compare first letters of each word
    const initials1 = words1.map((w) => w[0]).join("");
    const initials2 = words2.map((w) => w[0]).join("");

    if (initials1 === initials2) {
      return 0.85; // High match for matching initials
    }

    // Check if full name contains initial pattern
    const fullWords1 = words1.filter((w) => w.length > 1);
    const fullWords2 = words2.filter((w) => w.length > 1);

    const fullInitials1 = fullWords1.map((w) => w[0]).join("");
    const fullInitials2 = fullWords2.map((w) => w[0]).join("");

    if (fullInitials1.includes(initials2.replace(/[^A-Z]/g, "")) ||
        fullInitials2.includes(initials1.replace(/[^A-Z]/g, ""))) {
      return 0.8;
    }
  }

  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= n1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[n1.length][n2.length];
  const maxLen = Math.max(n1.length, n2.length);
  return 1 - distance / maxLen;
}

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
