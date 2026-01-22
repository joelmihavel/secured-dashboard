/**
 * Flent Secured v2 - Verify Bank Edge Function
 *
 * Verifies bank account ownership using Cashfree Penny Drop API.
 * Used when tenants add their landlord's bank account.
 *
 * Endpoint: POST /functions/v1/verify-bank
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
import {
  validateSchema,
  isValidIfsc,
  sanitizeIfsc,
  maskAccountNumber,
} from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { encrypt } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
const CASHFREE_BASE_URL =
  Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

// Name matching threshold (80%)
const NAME_MATCH_THRESHOLD = 0.8;

// ==============================================
// TYPES
// ==============================================

interface VerifyBankRequest {
  tenancy_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  party_type?: "landlord" | "tenant";
}

interface CashfreePennyDropResponse {
  reference_id: number; // Cashfree returns integer
  status: "SUCCESS" | "FAILURE" | "PENDING";
  name_at_bank?: string;
  account_status?: string;
  account_status_code?: string; // e.g., ACCOUNT_IS_VALID, INVALID_IFSC_FAIL
  bank_name?: string;
  branch?: string;
  city?: string;
  utr?: string;
  name_match_score?: string;
  name_match_result?: "DIRECT_MATCH" | "GOOD_PARTIAL_MATCH" | "MODERATE_PARTIAL_MATCH" | "POOR_PARTIAL_MATCH" | "NO_MATCH";
  message?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: true, type: "string" as const },
  account_holder_name: { required: true, type: "string" as const, minLength: 2, maxLength: 100 },
  account_number: { required: true, type: "string" as const, minLength: 9, maxLength: 18 },
  ifsc_code: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidIfsc(v as string) || "Invalid IFSC code format",
  },
  party_type: {
    required: false,
    type: "string" as const,
    enum: ["landlord", "tenant"],
  },
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
    const { userId: uid, user } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-bank");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateSchema<VerifyBankRequest>(body, requestSchema, true);

    const {
      tenancy_id,
      account_holder_name,
      account_number,
      ifsc_code,
      party_type = "landlord",
    } = validatedBody;

    // Sanitize inputs
    const sanitizedIfsc = sanitizeIfsc(ifsc_code);

    // Log verification initiation
    await audit.logSuccess(
      AuditActions.BANK_VERIFICATION_INITIATED,
      "verification",
      "bank_account",
      undefined,
      {
        tenancy_id,
        ifsc_code: sanitizedIfsc,
        account_number_masked: maskAccountNumber(account_number),
        party_type,
      }
    );

    // Verify tenancy belongs to user
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select("id, user_id, landlord_name")
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new ValidationError("Tenancy not found", { tenancy_id: "Not found" });
    }

    if (tenancy.user_id !== userId) {
      throw new AppError("You don't have permission to modify this tenancy", "FORBIDDEN", 403);
    }

    // Call Cashfree Penny Drop API
    const pennyDropResult = await callCashfreePennyDrop({
      account_number,
      ifsc_code: sanitizedIfsc,
      account_holder_name,
    });

    // Calculate name match score
    const nameMatchScore = calculateNameMatchScore(
      account_holder_name,
      pennyDropResult.name_at_bank ?? ""
    );

    // Encrypt account number for storage
    const encryptedAccountNumber = await encrypt(account_number);

    // Create bank account record
    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: userId,
        party_type,
        account_holder_name,
        account_number_encrypted: encryptedAccountNumber,
        account_number_masked: maskAccountNumber(account_number),
        ifsc_code: sanitizedIfsc,
        verified: pennyDropResult.status === "SUCCESS" && nameMatchScore >= NAME_MATCH_THRESHOLD,
        penny_drop_txn_id: pennyDropResult.reference_id?.toString(),
        penny_drop_reference_id: pennyDropResult.reference_id,
        penny_drop_status: pennyDropResult.status,
        penny_drop_name_match_score: nameMatchScore * 100, // Store as percentage
        verified_account_holder_name: pennyDropResult.name_at_bank,
        verified_at:
          pennyDropResult.status === "SUCCESS" ? new Date().toISOString() : null,
        is_primary: true, // First account added is primary
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert bank account:", insertError);
      throw new AppError("Failed to save bank account", "DB_ERROR", 500);
    }

    // Update tenancy verification status if landlord account verified
    if (party_type === "landlord" && bankAccount.verified) {
      await supabase
        .from("tenancies")
        .update({ bank_verified: true })
        .eq("id", tenancy_id);
    }

    // Log result
    if (bankAccount.verified) {
      await audit.logSuccess(
        AuditActions.BANK_VERIFICATION_SUCCESS,
        "verification",
        "bank_account",
        bankAccount.id,
        {
          name_match_score: nameMatchScore,
          verified_name: pennyDropResult.name_at_bank,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.BANK_VERIFICATION_FAILED,
        "verification",
        pennyDropResult.status === "SUCCESS" ? "NAME_MISMATCH" : pennyDropResult.status,
        pennyDropResult.status === "SUCCESS"
          ? `Name match score ${(nameMatchScore * 100).toFixed(0)}% below threshold`
          : pennyDropResult.message ?? "Verification failed",
        "bank_account",
        bankAccount.id,
        {
          name_match_score: nameMatchScore,
          provided_name: account_holder_name,
          bank_name: pennyDropResult.name_at_bank,
        }
      );
    }

    return jsonResponse({
      success: true,
      data: {
        bank_account_id: bankAccount.id,
        verified: bankAccount.verified,
        account_number_masked: bankAccount.account_number_masked,
        ifsc_code: bankAccount.ifsc_code,
        verified_name: pennyDropResult.name_at_bank,
        name_match_score: Math.round(nameMatchScore * 100),
        name_match_threshold: NAME_MATCH_THRESHOLD * 100,
        verification_status: pennyDropResult.status,
        message: bankAccount.verified
          ? "Bank account verified successfully"
          : pennyDropResult.status === "SUCCESS"
          ? `Name mismatch: provided "${account_holder_name}", bank returned "${pennyDropResult.name_at_bank}"`
          : pennyDropResult.message ?? "Verification failed",
      },
    });
  } catch (error) {
    // Log failure if audit logger initialized
    if (audit && userId) {
      await audit.logFailure(
        AuditActions.BANK_VERIFICATION_FAILED,
        "verification",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "bank_account"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// CASHFREE PENNY DROP API
// ==============================================

async function callCashfreePennyDrop(params: {
  account_number: string;
  ifsc_code: string;
  account_holder_name: string;
}): Promise<CashfreePennyDropResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError(
      "Cashfree",
      "API credentials not configured"
    );
  }

  const referenceId = `FLENT_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/bank-account/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify({
        bank_account: params.account_number,
        ifsc: params.ifsc_code,
        name: params.account_holder_name,
        // Note: reference_id is generated by Cashfree, not sent in request
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree API error:", data);
      throw new ExternalServiceError(
        "Cashfree",
        data.message ?? `HTTP ${response.status}`
      );
    }

    // Map Cashfree response to our interface
    // Use Cashfree's name_match_result instead of custom algorithm when available
    return {
      reference_id: data.reference_id,
      status: data.account_status === "VALID" ? "SUCCESS" : "FAILURE",
      name_at_bank: data.name_at_bank, // Official field name (not registered_name)
      account_status: data.account_status,
      account_status_code: data.account_status_code,
      bank_name: data.bank_name,
      branch: data.branch,
      city: data.city,
      utr: data.utr,
      name_match_score: data.name_match_score,
      name_match_result: data.name_match_result, // Use Cashfree's result
      message: data.message,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;

    console.error("Cashfree Penny Drop failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// NAME MATCHING
// ==============================================

/**
 * Calculates similarity score between two names using Levenshtein distance.
 * Returns a score between 0 and 1.
 */
function calculateNameMatchScore(name1: string, name2: string): number {
  // Normalize names
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const s1 = normalize(name1);
  const s2 = normalize(name2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return 1 - dp[len1][len2] / maxLen;
}
