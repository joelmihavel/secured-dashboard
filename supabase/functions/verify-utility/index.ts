/**
 * Flent Secured v2 - Verify Utility Edge Function
 *
 * Verifies address using electricity bill via API Club.
 * Used to verify tenant actually resides at the rental property.
 *
 * Endpoint: POST /functions/v1/verify-utility
 * Auth: Required (JWT)
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

// ==============================================
// CONFIGURATION
// ==============================================

const API_CLUB_KEY = Deno.env.get("API_CLUB_KEY");
const API_CLUB_BASE_URL = "https://api.apiclub.in/api/v1";

// Address matching threshold (70%)
const ADDRESS_MATCH_THRESHOLD = 0.7;

// ==============================================
// TYPES
// ==============================================

interface VerifyUtilityRequest {
  tenancy_id: string;
  consumer_number: string;
  operator_code: string;
}

interface ElectricityBillResponse {
  status: string;
  data?: {
    consumer_name?: string;
    consumer_number?: string;
    bill_amount?: number;
    due_date?: string;
    bill_date?: string;
    address?: string;
    state?: string;
    operator_name?: string;
  };
  message?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: true, type: "string" as const },
  consumer_number: { required: true, type: "string" as const, minLength: 5, maxLength: 30 },
  operator_code: { required: true, type: "string" as const, minLength: 2, maxLength: 20 },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

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
        consumer_number_masked: `${consumer_number.slice(0, 3)}***${consumer_number.slice(-3)}`,
      }
    );

    // Verify tenancy belongs to user and get address
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select("id, user_id, property_address, property_city, property_state, property_pincode")
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

    // Calculate address match score
    const tenancyAddress = [
      tenancy.property_address,
      tenancy.property_city,
      tenancy.property_state,
      tenancy.property_pincode,
    ]
      .filter(Boolean)
      .join(", ");

    const billAddress = billResult.data?.address ?? "";
    const addressMatchScore = calculateAddressMatchScore(tenancyAddress, billAddress);

    // Create utility verification record
    const verificationData = {
      user_id: userId,
      tenancy_id,
      utility_type: "electricity",
      operator_code,
      operator_name: billResult.data?.operator_name,
      consumer_number,
      consumer_name: billResult.data?.consumer_name,
      status: billResult.status === "success" ? "success" : "failed",
      bill_amount_paise: billResult.data?.bill_amount
        ? Math.round(billResult.data.bill_amount * 100)
        : null,
      bill_due_date: billResult.data?.due_date,
      bill_address: billAddress,
      bill_data: billResult.data,
      address_match_score: addressMatchScore * 100,
      address_verified: addressMatchScore >= ADDRESS_MATCH_THRESHOLD,
      verified_at:
        addressMatchScore >= ADDRESS_MATCH_THRESHOLD
          ? new Date().toISOString()
          : null,
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

    // Update tenancy verification status if address verified
    if (verification.address_verified) {
      await supabase
        .from("tenancies")
        .update({ utility_verified: true })
        .eq("id", tenancy_id);
    }

    // Log result
    if (verification.address_verified) {
      await audit.logSuccess(
        AuditActions.UTILITY_VERIFICATION_SUCCESS,
        "verification",
        "utility_verification",
        verification.id,
        {
          address_match_score: addressMatchScore,
          consumer_name: billResult.data?.consumer_name,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.UTILITY_VERIFICATION_FAILED,
        "verification",
        billResult.status !== "success" ? "BILL_FETCH_FAILED" : "ADDRESS_MISMATCH",
        billResult.status !== "success"
          ? billResult.message ?? "Failed to fetch bill"
          : `Address match score ${(addressMatchScore * 100).toFixed(0)}% below threshold`,
        "utility_verification",
        verification.id,
        {
          address_match_score: addressMatchScore,
          tenancy_address: tenancyAddress,
          bill_address: billAddress,
        }
      );
    }

    return jsonResponse({
      success: true,
      data: {
        verification_id: verification.id,
        verified: verification.address_verified,
        consumer_name: billResult.data?.consumer_name,
        bill_amount: billResult.data?.bill_amount,
        bill_due_date: billResult.data?.due_date,
        address_match_score: Math.round(addressMatchScore * 100),
        address_match_threshold: ADDRESS_MATCH_THRESHOLD * 100,
        message: verification.address_verified
          ? "Address verified successfully"
          : billResult.status !== "success"
          ? billResult.message ?? "Failed to fetch electricity bill"
          : "Address on bill doesn't match rental property address",
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
});

// ==============================================
// API CLUB ELECTRICITY BILL API
// ==============================================

async function fetchElectricityBill(
  consumerNumber: string,
  operatorCode: string
): Promise<ElectricityBillResponse> {
  if (!API_CLUB_KEY) {
    throw new ExternalServiceError("API Club", "API key not configured");
  }

  try {
    const response = await fetch(`${API_CLUB_BASE_URL}/fetch_bill`, {
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
      console.error("API Club error:", data);
      return {
        status: "error",
        message: data.message ?? `HTTP ${response.status}`,
      };
    }

    return {
      status: data.status ?? "success",
      data: data.data,
      message: data.message,
    };
  } catch (error) {
    console.error("API Club fetch failed:", error);
    throw new ExternalServiceError(
      "API Club",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// ADDRESS MATCHING
// ==============================================

/**
 * Calculates similarity score between two addresses.
 * Uses word overlap and fuzzy matching.
 */
function calculateAddressMatchScore(address1: string, address2: string): number {
  // Normalize addresses
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

  // Word overlap score
  const words1 = new Set(s1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(s2.split(" ").filter((w) => w.length > 2));

  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  const jaccardSimilarity = intersection.length / union.size;

  // Also check if key identifiers match (numbers, pincode)
  const numbers1 = s1.match(/\d+/g) ?? [];
  const numbers2 = s2.match(/\d+/g) ?? [];
  const numberMatch = numbers1.some((n) => numbers2.includes(n)) ? 0.2 : 0;

  return Math.min(jaccardSimilarity + numberMatch, 1);
}

// ==============================================
// OPERATOR LIST ENDPOINT
// ==============================================

/**
 * GET /functions/v1/verify-utility/operators
 * Returns list of supported electricity operators
 */
export async function getOperators(): Promise<Response> {
  if (!API_CLUB_KEY) {
    return errorResponse("API not configured", 503);
  }

  try {
    const response = await fetch(`${API_CLUB_BASE_URL}/fetch_bill_operator`, {
      headers: {
        "x-api-key": API_CLUB_KEY,
      },
    });

    const data = await response.json();

    return jsonResponse({
      success: true,
      data: data.data ?? [],
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch operators",
      500
    );
  }
}
