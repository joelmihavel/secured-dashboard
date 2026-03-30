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
import {
  IdempotencyManager,
  generateIdempotencyKey,
} from "../_shared/idempotency.ts";
import {
  resolveAgreementNames,
  matchAgainstAgreementNames,
  calculateNameMatchScore,
  runOpportunisticNameMatch,
} from "../_shared/name-match-service.ts";
import { generateCfSignature } from "../_shared/cashfree-m360-otp.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Cashfree Penny Drop credentials (used by callCashfreePennyDrop below)
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
  tenancy_id?: string; // Optional — not present for pre-waitlist bank verification
  account_holder_name?: string; // Optional — populated from penny drop response if not provided
  account_number: string;
  ifsc_code: string;
  party_type?: "landlord" | "tenant";
  existing_bank_account_id?: string;
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
  tenancy_id: { required: false, type: "string" as const },
  account_holder_name: { required: false, type: "string" as const, minLength: 2, maxLength: 100 },
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
  existing_bank_account_id: {
    required: false,
    type: "string" as const,
    custom: (v: unknown) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v as string) ||
      "Must be a valid UUID",
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
  let idempotencyKey: string | undefined; // Declared outside try so catch can access it

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
      existing_bank_account_id,
    } = validatedBody;

    const hasTenancy = !!tenancy_id;

    // Sanitize inputs
    const sanitizedIfsc = sanitizeIfsc(ifsc_code);

    // Generate idempotency key to prevent duplicate penny drops (which cost money)
    idempotencyKey = await generateIdempotencyKey(
      "verify-bank",
      hasTenancy ? tenancy_id : userId,
      account_number,
      sanitizedIfsc,
      ...(existing_bank_account_id ? [existing_bank_account_id] : [])
    );

    // Check idempotency - prevent duplicate verifications
    const idempotency = new IdempotencyManager(supabase);
    const idempotencyResult = await idempotency.check(idempotencyKey, validatedBody, {
      userId,
      endpoint: "verify-bank",
      ttlHours: 1, // Short TTL — only prevents rapid duplicate submissions
    });

    // If we have a cached response, return it
    if (!idempotencyResult.isNew && idempotencyResult.cachedResponse) {
      console.log(`[verify-bank] Returning cached response for idempotency key`);
      return new Response(
        JSON.stringify(idempotencyResult.cachedResponse.body),
        {
          status: idempotencyResult.cachedResponse.status,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Cached": "true",
          },
        }
      );
    }

    // Log verification initiation
    await audit.logSuccess(
      AuditActions.BANK_VERIFICATION_INITIATED,
      "verification",
      "bank_account",
      undefined,
      {
        tenancy_id: tenancy_id || "pre-waitlist",
        ifsc_code: sanitizedIfsc,
        account_number_masked: maskAccountNumber(account_number),
        party_type,
      }
    );

    // Verify tenancy belongs to user (skip when no tenancy_id — pre-waitlist flow)
    let tenancy = null;
    if (hasTenancy) {
      const { data: tenancyData, error: tenancyError } = await supabase
        .from("tenancies")
        .select("id, user_id, landlord_name, extracted_rental_info_id")
        .eq("id", tenancy_id)
        .single();

      if (tenancyError || !tenancyData) {
        throw new ValidationError("Tenancy not found", { tenancy_id: "Not found" });
      }

      if (tenancyData.user_id !== userId) {
        throw new AppError("You don't have permission to modify this tenancy", "FORBIDDEN", 403);
      }
      tenancy = tenancyData;
    }

    // ── DEMO BYPASS ──────────────────────────────────────────────────
    if (await isTestUser(userId, supabase)) {
      const maskedAccount = maskAccountNumber(account_number);
      const encryptedAccount = await encrypt(account_number);

      // Simulate penny drop: use account_holder_name if provided, else a realistic demo name
      const demoName = account_holder_name || "RISHABH AGNIHOTRI";
      const { data: demoBankAccount, error: demoErr } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: userId,
          party_type,
          account_holder_name: demoName,
          account_number_encrypted: encryptedAccount,
          account_number_masked: maskedAccount,
          ifsc_code: sanitizedIfsc,
          verified: true,
          penny_drop_status: "SUCCESS",
          penny_drop_name_match_score: 100,
          verified_account_holder_name: demoName,
          verified_at: new Date().toISOString(),
          is_primary: true,
          agreement_name_matched: true,
          agreement_name_match_score: 100,
        })
        .select()
        .single();

      if (demoErr || !demoBankAccount) {
        throw new AppError("Failed to save demo bank account", "DB_ERROR", 500);
      }

      if (hasTenancy && party_type === "landlord") {
        await supabase.from("tenancies").update({ bank_verified: true }).eq("id", tenancy_id);
      }

      await audit!.logSuccess("BANK_VERIFICATION_DEMO_BYPASS", "verification", "bank_account", demoBankAccount.id, {
        demo: true, party_type,
      });

      return jsonResponse({
        success: true,
        data: {
          bank_account_id: demoBankAccount.id,
          verified: true,
          account_number_masked: maskedAccount,
          ifsc_code: sanitizedIfsc,
          verified_name: demoName,
          name_match_score: 100,
          name_match_threshold: 80,
          verification_status: "SUCCESS",
          bank_name: "Demo Bank",
          branch: null,
          agreement_name_matched: true,
          matched_landlord_name: demoName,
          agreement_match_score: 100,
          message: "Bank account verified successfully",
        },
      });
    }
    // ── END DEMO BYPASS ──────────────────────────────────────────────

    // Resolve landlord names from agreement (shared service) — skip when no tenancy
    let allLandlordNames: string[] = [];
    if (hasTenancy) {
      const resolved = await resolveAgreementNames(supabase, tenancy_id!, "landlord");
      allLandlordNames = resolved.names;
    }

    // Safety reset: when editing an existing bank account, set bank_verified = false
    // BEFORE the penny drop call. This prevents a stale verified state if the penny
    // drop fails, times out, or the app crashes mid-flow. The flag gets set back to
    // true only on verification success (existing logic below).
    if (hasTenancy && existing_bank_account_id && party_type === "landlord") {
      await supabase
        .from("tenancies")
        .update({ bank_verified: false })
        .eq("id", tenancy_id);
    }

    // Call Cashfree Penny Drop API
    const pennyDropResult = await callCashfreePennyDrop({
      account_number,
      ifsc_code: sanitizedIfsc,
      account_holder_name: account_holder_name || "ACCOUNT HOLDER",
    });

    // Use bank-returned name as the canonical account holder name
    const resolvedAccountHolderName = pennyDropResult.name_at_bank || account_holder_name || "";

    // Secondary score: user-typed name vs bank name (informational only, not used for gating)
    const nameMatchScore = account_holder_name
      ? calculateNameMatchScore(account_holder_name, pennyDropResult.name_at_bank ?? "")
      : 1; // If user didn't provide name, skip this score

    // Match Cashfree's name_at_bank against agreement landlord names (shared service)
    let agreementNameMatched = false;
    let agreementMatchScore = 0;
    let matchedLandlordName: string | null = null;
    let agreementMatchDetails: Record<string, unknown> = {};

    const nameAtBank = pennyDropResult.name_at_bank ?? "";

    if (pennyDropResult.status === "SUCCESS" && nameAtBank && allLandlordNames.length > 0) {
      const matchResult = await matchAgainstAgreementNames({
        verifiedName: nameAtBank,
        candidateNames: allLandlordNames,
        context: "agreement_bank_verification",
        matchThreshold: NAME_MATCH_THRESHOLD,
      });

      agreementNameMatched = matchResult.matched;
      agreementMatchScore = matchResult.score;
      matchedLandlordName = matchResult.matchedName;
      agreementMatchDetails = {
        ...matchResult.details,
        name_at_bank: nameAtBank,
      };

      console.log("[verify-bank] Agreement name match result:", {
        matched: agreementNameMatched,
        score: agreementMatchScore,
        matched_landlord: matchedLandlordName,
        landlord_count: allLandlordNames.length,
      });
    } else if (allLandlordNames.length === 0) {
      // No landlord names in agreement — skip agreement matching, allow penny drop only
      console.warn("[verify-bank] No landlord names found in agreement, skipping agreement name match");
      agreementNameMatched = true; // Don't block if no agreement data
      agreementMatchDetails = { skipped: true, reason: "no_landlord_names_in_agreement" };
    }

    // Encrypt account number for storage
    const encryptedAccountNumber = await encrypt(account_number);

    // Create bank account record
    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: userId,
        party_type,
        account_holder_name: resolvedAccountHolderName || null,
        account_number_encrypted: encryptedAccountNumber,
        account_number_masked: maskAccountNumber(account_number),
        ifsc_code: sanitizedIfsc,
        verified: pennyDropResult.status === "SUCCESS" && agreementNameMatched,
        penny_drop_txn_id: pennyDropResult.reference_id?.toString(),
        penny_drop_reference_id: pennyDropResult.reference_id,
        penny_drop_status: pennyDropResult.status,
        penny_drop_name_match_score: nameMatchScore * 100, // Store as percentage
        verified_account_holder_name: pennyDropResult.name_at_bank,
        verified_at:
          pennyDropResult.status === "SUCCESS" ? new Date().toISOString() : null,
        is_primary: true, // First account added is primary
        agreement_name_matched: agreementNameMatched,
        agreement_name_match_score: agreementMatchScore,
        agreement_name_match_details: agreementMatchDetails,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert bank account:", insertError);
      throw new AppError("Failed to save bank account", "DB_ERROR", 500);
    }

    // PAN carryover: copy verified PAN data from old bank account to new one
    // DB trigger `ensure_single_primary_bank_account` automatically demotes old row's is_primary
    if (existing_bank_account_id && bankAccount) {
      try {
        const { data: oldBank } = await supabase
          .from("bank_accounts")
          .select("pan_number_encrypted, pan_number_masked, pan_verified, pan_type, pan_registered_name, pan_status, pan_name_match_score, pan_name_matched, pan_verification_details, pan_verified_at")
          .eq("id", existing_bank_account_id)
          .eq("user_id", userId)
          .single();

        if (oldBank?.pan_verified) {
          await supabase
            .from("bank_accounts")
            .update({
              pan_number_encrypted: oldBank.pan_number_encrypted,
              pan_number_masked: oldBank.pan_number_masked,
              pan_verified: oldBank.pan_verified,
              pan_type: oldBank.pan_type,
              pan_registered_name: oldBank.pan_registered_name,
              pan_status: oldBank.pan_status,
              pan_name_match_score: oldBank.pan_name_match_score,
              pan_name_matched: oldBank.pan_name_matched,
              pan_verification_details: oldBank.pan_verification_details,
              pan_verified_at: oldBank.pan_verified_at,
            })
            .eq("id", bankAccount.id);

          console.log(`[verify-bank] Copied PAN data from ${existing_bank_account_id} to ${bankAccount.id}`);
        }
      } catch (panCopyError) {
        // Non-fatal — PAN can be re-verified separately
        console.warn("[verify-bank] Failed to copy PAN data (non-fatal):", panCopyError);
      }
    }

    // Opportunistic matching: if tenancy was created while user was on bank screen,
    // run name matching now instead of waiting for deferred matching (which already ran).
    if (!hasTenancy && bankAccount.verified) {
      const nameForMatch = bankAccount.verified_account_holder_name || resolvedAccountHolderName;
      await runOpportunisticNameMatch({
        supabase,
        userId,
        bankAccountId: bankAccount.id,
        verifiedName: nameForMatch,
        context: "agreement_bank_verification",
        source: "verify-bank",
      });
    }

    // Update tenancy verification status if landlord account verified
    if (hasTenancy && party_type === "landlord" && bankAccount.verified) {
      const tenancyUpdate: Record<string, unknown> = { bank_verified: true };
      // Write back verified landlord name — this is the confirmed landlord whose bank we'll pay into
      if (matchedLandlordName) {
        tenancyUpdate.landlord_name = matchedLandlordName;
      }
      await supabase
        .from("tenancies")
        .update(tenancyUpdate)
        .eq("id", tenancy_id);

      // Advance user_status from approved → active (bank is the mandatory gate)
      const { error: advanceError } = await supabase
        .rpc("check_and_advance_to_active", { p_user_id: userId });

      if (advanceError) {
        console.error("[verify-bank] Failed to advance user_status:", advanceError);
        // Non-fatal — bank is verified, status can be corrected
      }
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
        pennyDropResult.status === "SUCCESS"
          ? (!agreementNameMatched ? "AGREEMENT_NAME_MISMATCH" : "NAME_MISMATCH")
          : pennyDropResult.status,
        pennyDropResult.status === "SUCCESS"
          ? (!agreementNameMatched
            ? `Bank name "${nameAtBank}" did not match agreement landlords: ${allLandlordNames.join(", ")}`
            : `Name match score ${(nameMatchScore * 100).toFixed(0)}% below threshold`)
          : pennyDropResult.message ?? "Verification failed",
        "bank_account",
        bankAccount.id,
        {
          name_match_score: nameMatchScore,
          provided_name: account_holder_name || null,
          bank_name: pennyDropResult.name_at_bank,
          agreement_name_matched: agreementNameMatched,
          agreement_match_score: agreementMatchScore,
          matched_landlord_name: matchedLandlordName,
        }
      );
    }

    const responseBody = {
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
        bank_name: pennyDropResult.bank_name,
        branch: pennyDropResult.branch,
        agreement_name_matched: agreementNameMatched,
        matched_landlord_name: matchedLandlordName,
        agreement_match_score: agreementMatchScore,
        message: bankAccount.verified
          ? "Bank account verified successfully"
          : pennyDropResult.status !== "SUCCESS"
          ? pennyDropResult.message ?? "Bank account verification failed"
          : !agreementNameMatched
          ? "The bank account holder name does not match any landlord in your rental agreement. Please ensure you are adding your landlord's bank account."
          : "Verification failed",
      },
    };

    // Only cache verified results — failed penny drops may be transient
    // and the user should be allowed to retry with the same details.
    if (bankAccount.verified) {
      await idempotency.complete(idempotencyKey, 200, responseBody);
    } else {
      await idempotency.fail(idempotencyKey, responseBody.data.message);
    }

    return jsonResponse(responseBody);
  } catch (error) {
    // Mark idempotency as failed to allow retry
    if (typeof idempotencyKey !== "undefined") {
      const idempotency = new IdempotencyManager(supabase);
      await idempotency.fail(
        idempotencyKey,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
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
    // Build headers with x-cf-signature for public key auth
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
    };
    try {
      const { signature } = await generateCfSignature(CASHFREE_APP_ID);
      headers["x-cf-signature"] = signature;
    } catch (sigErr) {
      console.warn("[verify-bank] x-cf-signature not added:", sigErr instanceof Error ? sigErr.message : String(sigErr));
    }

    const response = await fetch(`${CASHFREE_BASE_URL}/bank-account/sync`, {
      method: "POST",
      headers,
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

// NOTE: calculateNameMatchScore is now imported from _shared/name-match-service.ts
