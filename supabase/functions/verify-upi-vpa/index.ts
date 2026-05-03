/**
 * Flent Secured v2 - Verify UPI VPA Edge Function
 *
 * Verifies a landlord's UPI VPA using PayU VPA Validation API.
 * Used when tenants add their landlord's UPI ID for rent settlement.
 *
 * Endpoint: POST /functions/v1/verify-upi-vpa
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
import { encrypt } from "../_shared/crypto.ts";
import {
  IdempotencyManager,
  generateIdempotencyKey,
} from "../_shared/idempotency.ts";
import {
  resolveAgreementNames,
  matchAgainstAgreementNames,
} from "../_shared/name-match-service.ts";
import { callPayUValidateVpa } from "../_shared/payu-config.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";
import { recomputeAndStoreRisk } from "../_shared/risk-utils.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Name matching threshold (80%)
const NAME_MATCH_THRESHOLD = 0.8;

// UPI VPA format: local-part@provider, 5-50 chars total, exactly one @
const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;

// ==============================================
// TYPES
// ==============================================

interface VerifyUpiVpaRequest {
  tenancy_id?: string; // Optional — not present for pre-waitlist UPI verification
  upi_vpa: string;
  party_type?: "landlord" | "tenant";
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: false, type: "string" as const },
  upi_vpa: {
    required: true,
    type: "string" as const,
    minLength: 5,
    maxLength: 50,
    custom: (v: unknown) => {
      const vpa = v as string;
      const atCount = (vpa.match(/@/g) || []).length;
      if (atCount !== 1) return "UPI ID must contain exactly one @";
      if (!UPI_VPA_PATTERN.test(vpa)) return "Invalid UPI ID format";
      return true;
    },
  },
  party_type: {
    required: false,
    type: "string" as const,
    enum: ["landlord", "tenant"],
  },
};

// ==============================================
// HELPERS
// ==============================================

/**
 * Masks a UPI VPA for display: show first 3 chars of local part + @provider
 */
function maskUpiVpa(vpa: string): string {
  const [local, provider] = vpa.split("@");
  if (local.length <= 3) return vpa;
  return `${local.slice(0, 3)}${"*".repeat(local.length - 3)}@${provider}`;
}

/**
 * Masks a bank account number from UPI penny drop (may be null).
 */
function maskBankAccount(account: string | undefined | null): string {
  if (!account || account.length <= 4) return account ?? "N/A";
  const last4 = account.slice(-4);
  return `${"X".repeat(account.length - 4)}${last4}`;
}

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
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-upi-vpa");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateSchema<VerifyUpiVpaRequest>(body, requestSchema, true);

    const {
      tenancy_id,
      upi_vpa,
      party_type = "landlord",
    } = validatedBody;

    const hasTenancy = !!tenancy_id;

    // Normalize VPA to lowercase
    const normalizedVpa = upi_vpa.trim().toLowerCase();

    // Generate idempotency key to prevent duplicate penny drops (which cost money)
    idempotencyKey = await generateIdempotencyKey(
      "verify-upi-vpa",
      hasTenancy ? tenancy_id : userId,
      normalizedVpa
    );

    // Check idempotency - prevent duplicate verifications
    const idempotency = new IdempotencyManager(supabase);
    const idempotencyResult = await idempotency.check(idempotencyKey, validatedBody, {
      userId,
      endpoint: "verify-upi-vpa",
      ttlHours: 1, // Short TTL -- only prevents rapid duplicate submissions
    });

    // If we have a cached response, return it
    if (!idempotencyResult.isNew && idempotencyResult.cachedResponse) {
      console.log(`[verify-upi-vpa] Returning cached response for idempotency key`);
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
        upi_vpa: maskUpiVpa(normalizedVpa),
        party_type,
        verification_method: "upi_penny_drop",
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

    // -- DEMO BYPASS --------------------------------------------------------
    if (await isTestUser(userId, supabase)) {
      const demoName = "RISHABH AGNIHOTRI";

      // Deactivate existing primary bank accounts for this user+party
      await supabase
        .from("bank_accounts")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("party_type", party_type)
        .eq("is_primary", true);

      const { data: demoBankAccount, error: demoErr } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: userId,
          party_type,
          account_holder_name: demoName,
          account_number_encrypted: null,
          account_number_masked: normalizedVpa,
          ifsc_code: null,
          upi_vpa: normalizedVpa,
          verification_method: "upi_penny_drop",
          verified: true,
          penny_drop_status: "SUCCESS",
          penny_drop_name_match_score: 100,
          verified_account_holder_name: demoName,
          verified_at: new Date().toISOString(),
          is_primary: true,
          agreement_name_matched: true,
          agreement_name_match_score: 100,
          pan_verified: false,
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
        demo: true, party_type, verification_method: "upi_penny_drop",
      });

      return jsonResponse({
        success: true,
        data: {
          bank_account_id: demoBankAccount.id,
          verified: true,
          upi_vpa: normalizedVpa,
          verified_name: demoName,
          name_match_score: 100,
          name_match_threshold: NAME_MATCH_THRESHOLD * 100,
          verification_status: "SUCCESS",
          bank_name: "Demo Bank",
          ifsc: null,
          message: "UPI verified successfully",
          agreement_name_matched: true,
          matched_landlord_name: demoName,
          agreement_match_score: 100,
        },
      });
    }
    // -- END DEMO BYPASS ----------------------------------------------------

    // Resolve landlord names from agreement.
    //
    // Pre-fix this only ran when hasTenancy=true; for pre-waitlist users
    // (no tenancy yet) it left allLandlordNames empty and the bypass branch
    // below set agreement_name_matched=true regardless. The deferred-match
    // path would later catch the mismatch but kept verified=true. Per
    // product flow, name match is mandatory BEFORE the user moves forward
    // — there is no longer a deferred path. Refuse if names aren't
    // available (and do this BEFORE the VPA validation call so we don't
    // hit Cashfree for a verification we'd reject anyway).
    let allLandlordNames: string[] = [];
    if (hasTenancy) {
      const resolved = await resolveAgreementNames(supabase, tenancy_id!, "landlord");
      allLandlordNames = resolved.names;
    } else {
      const { data: extraction } = await supabase
        .from("extracted_rental_info")
        .select("landlord_name, landlord_names, extraction_status")
        .eq("user_id", userId)
        .eq("extraction_status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (extraction) {
        const seen = new Set<string>();
        if (typeof extraction.landlord_name === "string" && extraction.landlord_name.trim()) {
          seen.add(extraction.landlord_name);
        }
        if (Array.isArray(extraction.landlord_names)) {
          for (const n of extraction.landlord_names) {
            if (typeof n === "string" && n.trim()) seen.add(n);
          }
        }
        allLandlordNames = [...seen];
      }
    }

    if (allLandlordNames.length === 0) {
      return jsonResponse(
        {
          error: true,
          code: "AGREEMENT_NOT_PROCESSED",
          message:
            "We couldn't read your landlord's name from your rental agreement. " +
            "Sometimes agreement processing takes some time, please try again in few minutes.",
        },
        409
      );
    }

    // Call PayU VPA Validation API
    const pennyDropResult = await callPayUValidateVpa(normalizedVpa);

    // Handle INVALID VPA early with concise error for UI hint text
    if (pennyDropResult.status === "INVALID") {
      // Still create an audit trail for failed attempts
      await audit.logFailure(
        AuditActions.BANK_VERIFICATION_FAILED,
        "verification",
        "UPI_VPA_INVALID",
        "VPA does not exist or is inactive",
        "bank_account",
        undefined,
        { upi_vpa: maskUpiVpa(normalizedVpa) }
      );

      await idempotency.fail(idempotencyKey, "UPI VPA invalid");

      return jsonResponse(
        {
          error: true,
          code: "UPI_VPA_INVALID",
          message: "This UPI ID doesn't exist",
          fields: { upi_vpa: "Check and re-enter your UPI ID" },
        },
        400
      );
    }

    // VPA is VALID -- proceed with name matching
    const nameAtBank = pennyDropResult.name_at_bank ?? "";

    // Match Cashfree's name_at_bank against agreement landlord names
    let agreementNameMatched = false;
    let agreementMatchScore = 0;
    let matchedLandlordName: string | null = null;
    let agreementMatchDetails: Record<string, unknown> = {};

    if (nameAtBank) {
      // allLandlordNames is guaranteed non-empty here — the early refusal
      // above (AGREEMENT_NOT_PROCESSED) returned before we reached the VPA
      // call. Match synchronously.
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

      console.log("[verify-upi-vpa] Agreement name match result:", {
        matched: agreementNameMatched,
        score: agreementMatchScore,
        matched_landlord: matchedLandlordName,
        landlord_count: allLandlordNames.length,
      });
    }

    const isVerified = pennyDropResult.status === "VALID" && agreementNameMatched;

    // Handle name mismatch — send full name, UI shows it below the field
    if (pennyDropResult.status === "VALID" && !agreementNameMatched && allLandlordNames.length > 0) {

      // Still save the bank account row (unverified) for audit trail
      // Deactivate existing primary bank accounts
      await supabase
        .from("bank_accounts")
        .update({ is_primary: false })
        .eq("user_id", userId)
        .eq("party_type", party_type)
        .eq("is_primary", true);

      const encryptedAccount = pennyDropResult.bank_account
        ? await encrypt(pennyDropResult.bank_account)
        : null;

      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: userId,
          party_type,
          account_holder_name: nameAtBank || null,
          account_number_encrypted: encryptedAccount,
          account_number_masked: pennyDropResult.bank_account
            ? maskBankAccount(pennyDropResult.bank_account)
            : normalizedVpa,
          ifsc_code: pennyDropResult.ifsc || null,
          upi_vpa: normalizedVpa,
          verification_method: "upi_penny_drop",
          verified: false,
          penny_drop_status: "NAME_MISMATCH",
          verified_account_holder_name: nameAtBank,
          verified_at: null,
          is_primary: true,
          agreement_name_matched: false,
          agreement_name_match_score: agreementMatchScore,
          agreement_name_match_details: agreementMatchDetails,
          pan_verified: false,
        })
        .select()
        .single();

      await audit.logFailure(
        AuditActions.BANK_VERIFICATION_FAILED,
        "verification",
        "AGREEMENT_NAME_MISMATCH",
        `Bank name "${nameAtBank}" did not match agreement landlords: ${allLandlordNames.join(", ")}`,
        "bank_account",
        bankAccount?.id,
        {
          name_at_bank: nameAtBank,
          agreement_name_matched: false,
          agreement_match_score: agreementMatchScore,
          matched_landlord_name: matchedLandlordName,
        }
      );

      await idempotency.fail(idempotencyKey, "Name mismatch");

      return jsonResponse(
        {
          error: true,
          code: "NAME_MISMATCH",
          message: "UPI account name doesn't match your landlord",
          fields: { upi_vpa: "Name doesn't match" },
          found_name: nameAtBank,
        },
        400
      );
    }

    // Encrypt bank account number if available
    const encryptedAccount = pennyDropResult.bank_account
      ? await encrypt(pennyDropResult.bank_account)
      : null;

    // Deactivate existing primary bank accounts for this user+party
    await supabase
      .from("bank_accounts")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("party_type", party_type)
      .eq("is_primary", true);

    // Create bank account record
    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: userId,
        party_type,
        account_holder_name: nameAtBank || null,
        account_number_encrypted: encryptedAccount,
        account_number_masked: pennyDropResult.bank_account
          ? maskBankAccount(pennyDropResult.bank_account)
          : normalizedVpa,
        ifsc_code: pennyDropResult.ifsc || null,
        upi_vpa: normalizedVpa,
        verification_method: "upi_penny_drop",
        verified: isVerified,
        penny_drop_status: "SUCCESS",
        verified_account_holder_name: nameAtBank,
        verified_at: isVerified ? new Date().toISOString() : null,
        is_primary: true,
        agreement_name_matched: agreementNameMatched,
        agreement_name_match_score: agreementMatchScore,
        agreement_name_match_details: agreementMatchDetails,
        pan_verified: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert bank account:", insertError);
      throw new AppError("Failed to save bank account", "DB_ERROR", 500);
    }

    // (No opportunistic matching — name match is now synchronous above. The
    // pre-fix code ran a late match here for the pre-waitlist case, which
    // could leave a row with verified=true but agreement_name_matched=false.
    // With the early refusal at AGREEMENT_NOT_PROCESSED + the inline match,
    // the bank row's verified flag now strictly reflects name-match status.)

    // Update tenancy verification status if landlord account verified
    if (hasTenancy && party_type === "landlord" && bankAccount.verified) {
      const tenancyUpdate: Record<string, unknown> = { bank_verified: true };
      // Write back verified landlord name
      if (matchedLandlordName) {
        tenancyUpdate.landlord_name = matchedLandlordName;
      }
      await supabase
        .from("tenancies")
        .update(tenancyUpdate)
        .eq("id", tenancy_id);

      // Advance user_status from approved -> active (bank is the mandatory gate)
      const { error: advanceError } = await supabase
        .rpc("check_and_advance_to_active", { p_user_id: userId });

      if (advanceError) {
        console.error("[verify-upi-vpa] Failed to advance user_status:", advanceError);
        // Non-fatal -- bank is verified, status can be corrected
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
          verified_name: nameAtBank,
          agreement_match_score: agreementMatchScore,
          verification_method: "upi_penny_drop",
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.BANK_VERIFICATION_FAILED,
        "verification",
        "VERIFICATION_FAILED",
        "UPI penny drop verification did not result in verified state",
        "bank_account",
        bankAccount.id,
        {
          name_at_bank: nameAtBank,
          agreement_name_matched: agreementNameMatched,
          agreement_match_score: agreementMatchScore,
        }
      );
    }

    // Recompute risk after UPI verification
    try {
      await recomputeAndStoreRisk(userId, supabase);
    } catch (riskErr) {
      console.error("[verify-upi-vpa] Risk recompute failed (non-fatal):", riskErr);
    }

    const responseBody = {
      success: true,
      data: {
        bank_account_id: bankAccount.id,
        verified: bankAccount.verified,
        upi_vpa: normalizedVpa,
        verified_name: nameAtBank,
        name_match_score: agreementMatchScore,
        name_match_threshold: NAME_MATCH_THRESHOLD * 100,
        verification_status: "SUCCESS",
        bank_name: pennyDropResult.ifsc_details?.bank ?? null,
        ifsc: pennyDropResult.ifsc ?? null,
        message: bankAccount.verified
          ? "UPI verified successfully"
          : "UPI verification could not be completed",
        agreement_name_matched: agreementNameMatched,
        matched_landlord_name: matchedLandlordName,
        agreement_match_score: agreementMatchScore,
      },
    };

    // Only cache verified results -- failed may be transient
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

    // Map ExternalServiceError to concise UI response
    if (error instanceof ExternalServiceError) {
      return jsonResponse(
        {
          error: true,
          code: "SERVICE_UNAVAILABLE",
          message: "UPI verification unavailable right now",
        },
        502
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

