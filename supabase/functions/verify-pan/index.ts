/**
 * Flent Secured v2 - Verify PAN Edge Function
 *
 * Verifies PAN card ownership using Cashfree PAN Verification API.
 * Matches PAN registered name against landlord names from rental agreement.
 *
 * Endpoint: POST /functions/v1/verify-pan
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
import { validateSchema, isValidPan, maskPan } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { encrypt, decrypt } from "../_shared/crypto.ts";
import {
  IdempotencyManager,
  generateIdempotencyKey,
} from "../_shared/idempotency.ts";
import {
  resolveAgreementNames,
  matchAgainstAgreementNames,
  runOpportunisticNameMatch,
} from "../_shared/name-match-service.ts";
import { generateCfSignature } from "../_shared/cashfree-m360-otp.ts";
import { createVendor, getVendor, CashfreeError } from "../_shared/cashfree-easysplit.ts";
import { recomputeAndStoreRisk } from "../_shared/risk-utils.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
const CASHFREE_BASE_URL =
  Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

// ==============================================
// TYPES
// ==============================================

interface VerifyPanRequest {
  tenancy_id?: string; // Optional — not present for pre-waitlist PAN verification
  pan_number: string;
  bank_account_id: string;
}

interface CashfreePanResponse {
  valid: boolean;
  registered_name?: string;
  name_pan_card?: string;
  type?: string; // "Individual", "HUF", "Company", etc.
  pan_status?: string;
  reference_id?: number;
  message?: string;
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: false, type: "string" as const },
  pan_number: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: 10,
    custom: (v: unknown) => isValidPan(v as string) || "Invalid PAN format (e.g. ABCDE1234F)",
  },
  bank_account_id: { required: true, type: "string" as const },
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
  let idempotencyKey: string | undefined;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-pan");

    // Parse and validate request body
    const body = await req.json();
    const validatedBody = validateSchema<VerifyPanRequest>(body, requestSchema, true);

    const { tenancy_id, pan_number, bank_account_id } = validatedBody;
    const hasTenancy = !!tenancy_id;
    const sanitizedPan = pan_number.toUpperCase();

    // Generate idempotency key (PAN verification costs money)
    idempotencyKey = await generateIdempotencyKey(
      "verify-pan",
      hasTenancy ? tenancy_id : userId,
      sanitizedPan
    );

    // Check idempotency
    const idempotency = new IdempotencyManager(supabase);
    const idempotencyResult = await idempotency.check(idempotencyKey, validatedBody, {
      userId,
      endpoint: "verify-pan",
      ttlHours: 24,
    });

    if (!idempotencyResult.isNew && idempotencyResult.cachedResponse) {
      // Validate the referenced bank account still exists before returning cached response
      const cachedBody = idempotencyResult.cachedResponse.body as Record<string, unknown>;
      const cachedData = cachedBody?.data as Record<string, unknown> | undefined;
      const cachedBankAccountId = cachedData?.bank_account_id ?? bank_account_id;

      let cacheValid = true;
      if (cachedBankAccountId) {
        const { data: bankExists } = await supabase
          .from("bank_accounts")
          .select("id")
          .eq("id", cachedBankAccountId as string)
          .maybeSingle();
        if (!bankExists) {
          console.warn(`[verify-pan] Cached bank_account_id ${cachedBankAccountId} no longer exists, invalidating cache`);
          cacheValid = false;
          await idempotency.fail(idempotencyKey!, "Cached bank account deleted");
        }
      }

      if (cacheValid) {
        console.log("[verify-pan] Returning cached response for idempotency key");
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
      // Cache invalid — fall through to fresh verification
    }

    // Log verification initiation
    await audit.logSuccess(
      AuditActions.PAN_VERIFICATION_INITIATED,
      "verification",
      "pan_verification",
      undefined,
      {
        tenancy_id: tenancy_id || "pre-waitlist",
        pan_masked: maskPan(sanitizedPan),
        bank_account_id,
      }
    );

    // Verify tenancy belongs to user (skip when no tenancy_id — pre-waitlist flow)
    let tenancy = null;
    if (hasTenancy) {
      const { data: tenancyData, error: tenancyError } = await supabase
        .from("tenancies")
        .select("id, user_id")
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

    // Verify bank account exists and belongs to user
    const { data: bankAccount, error: bankError } = await supabase
      .from("bank_accounts")
      .select("id, user_id")
      .eq("id", bank_account_id)
      .eq("user_id", userId)
      .single();

    if (bankError || !bankAccount) {
      throw new ValidationError("Bank account not found", { bank_account_id: "Not found" });
    }

    // Call Cashfree PAN Verification API
    const panResult = await callCashfreePanVerify(sanitizedPan);

    // Extract results
    const registeredName = panResult.registered_name ?? panResult.name_pan_card ?? "";
    const panValid = panResult.valid;
    const panType = panResult.type ?? determinePanType(sanitizedPan);
    const panStatus = panResult.pan_status ?? (panValid ? "VALID" : "INVALID");

    // Determine Gemini context based on PAN type
    const geminiContext = (panType === "HUF" || sanitizedPan[3] === "H")
      ? "pan_huf_verification" as const
      : "pan_verification" as const;

    // Strip "(HUF)" suffix for HUF PANs before matching
    let nameForMatching = registeredName;
    if (geminiContext === "pan_huf_verification") {
      nameForMatching = registeredName.replace(/\s*\(HUF\)\s*$/i, "").trim();
    }

    // Resolve landlord names from agreement (skip when no tenancy — pre-waitlist flow)
    let resolvedNames: string[] = [];
    if (hasTenancy) {
      const resolved = await resolveAgreementNames(supabase, tenancy_id!, "landlord");
      resolvedNames = resolved.names;
    }

    // Match PAN name against landlord names
    let matchResult;
    if (panValid && nameForMatching && resolvedNames.length > 0) {
      matchResult = await matchAgainstAgreementNames({
        verifiedName: nameForMatching,
        candidateNames: resolvedNames,
        context: geminiContext,
      });
    } else if (resolvedNames.length === 0) {
      // No landlord names — skip matching, don't block
      matchResult = {
        matched: true,
        matchedName: null,
        score: 0,
        details: { gemini_used: false, skipped: true, reason: hasTenancy ? "no_landlord_names_in_agreement" : "pre_waitlist_no_tenancy" },
      };
    } else {
      matchResult = {
        matched: false,
        matchedName: null,
        score: 0,
        details: { gemini_used: false, skipped: true, reason: panValid ? "empty_registered_name" : "pan_invalid" },
      };
    }

    // Encrypt PAN for storage
    const encryptedPan = await encrypt(sanitizedPan);

    // Update bank_accounts row with PAN columns
    const { error: updateError } = await supabase
      .from("bank_accounts")
      .update({
        pan_number_encrypted: encryptedPan,
        pan_number_masked: maskPan(sanitizedPan),
        pan_verified: panValid && matchResult.matched,
        pan_type: panType,
        pan_registered_name: registeredName,
        pan_status: panStatus,
        pan_name_match_score: matchResult.score,
        pan_name_matched: matchResult.matched,
        pan_verification_details: matchResult.details,
        pan_verified_at: panValid && matchResult.matched ? new Date().toISOString() : null,
      })
      .eq("id", bank_account_id);

    if (updateError) {
      console.error("[verify-pan] Failed to update bank account:", updateError);
      throw new AppError("Failed to save PAN verification result", "DB_ERROR", 500);
    }

    // Opportunistic matching: if tenancy was created while user was on PAN screen,
    // run name matching now instead of waiting for deferred matching (which already ran).
    if (!hasTenancy && panValid) {
      await runOpportunisticNameMatch({
        supabase,
        userId,
        bankAccountId: bank_account_id,
        verifiedName: nameForMatching,
        context: "pan_verification",
        source: "verify-pan",
      });
    }

    // Update tenancy pan_verified if matched (skip when no tenancy — pre-waitlist flow)
    if (hasTenancy && panValid && matchResult.matched) {
      await supabase
        .from("tenancies")
        .update({ pan_verified: true })
        .eq("id", tenancy_id);
    }

    // ── IMMEDIATE VENDOR REGISTRATION ────────────────────────────
    // Register landlord as Cashfree Easy Split vendor right after PAN
    // verification succeeds. Don't wait for the daily sync-vendors cron.
    // Skip when no tenancy — pre-waitlist flow has no landlord to register.
    if (hasTenancy && panValid && matchResult.matched) {
      try {
        // Fetch bank account with encrypted fields + UPI VPA for vendor creation
        const { data: fullBankAccount } = await supabase
          .from("bank_accounts")
          .select("id, account_holder_name, account_number_encrypted, ifsc_code, upi_vpa, verification_method, cf_beneficiary_id")
          .eq("id", bank_account_id)
          .single();

        if (fullBankAccount && !fullBankAccount.cf_beneficiary_id) {
          const isUpiAccount = fullBankAccount.verification_method === "upi_penny_drop" || (!fullBankAccount.account_number_encrypted && fullBankAccount.upi_vpa);

          // Decrypt account number for Cashfree API (only for bank accounts)
          let accountNumber: string | undefined;
          if (!isUpiAccount && fullBankAccount.account_number_encrypted) {
            accountNumber = await decrypt(fullBankAccount.account_number_encrypted);
          }

          // Fetch user phone/email for vendor record
          const { data: userRecord } = await supabase
            .from("users")
            .select("phone, email")
            .eq("id", userId)
            .single();

          const vendorId = `VENDOR${bank_account_id.replace(/-/g, "")}`;
          const phone = (userRecord?.phone ?? "").replace(/^\+91/, "");
          const email = userRecord?.email ?? `${bank_account_id}@flent.app`;

          let vendor;
          try {
            vendor = await createVendor({
              vendor_id: vendorId,
              name: fullBankAccount.account_holder_name,
              email,
              phone,
              // Bank path (traditional)
              ...((!isUpiAccount && accountNumber) ? {
                account_number: accountNumber,
                account_holder: fullBankAccount.account_holder_name,
                ifsc: fullBankAccount.ifsc_code,
              } : {}),
              // UPI path
              ...(isUpiAccount ? { upi_vpa: fullBankAccount.upi_vpa } : {}),
              pan: sanitizedPan,
              schedule_option: 9, // every 3 hours 24*7
            });
          } catch (createErr) {
            // Vendor may already exist from a prior attempt
            if (createErr instanceof CashfreeError && createErr.message.includes("vendor already exists")) {
              vendor = await getVendor(vendorId);
            } else {
              throw createErr;
            }
          }

          // Store vendor ID and initial status on bank account
          await supabase
            .from("bank_accounts")
            .update({
              cf_beneficiary_id: vendor.vendor_id ?? vendorId,
              cf_beneficiary_status: vendor.status ?? "IN_BENE_CREATION",
            })
            .eq("id", bank_account_id);

          console.log(`[verify-pan] Vendor ${vendorId} created immediately, status: ${vendor.status}`);

          await audit!.logSuccess(
            "VENDOR_CREATED_IMMEDIATE",
            "landlord",
            "bank_account",
            bank_account_id,
            { vendor_id: vendorId, status: vendor.status },
          );
        }
      } catch (vendorErr) {
        // Vendor creation failure should NOT block PAN verification response
        // sync-vendors daily cron will pick it up as fallback
        console.error("[verify-pan] Immediate vendor creation failed (sync-vendors will retry):", vendorErr);
      }
    }
    // ── END IMMEDIATE VENDOR REGISTRATION ────────────────────────

    // Log result
    if (panValid && matchResult.matched) {
      await audit.logSuccess(
        AuditActions.PAN_VERIFICATION_SUCCESS,
        "verification",
        "pan_verification",
        bank_account_id,
        {
          pan_type: panType,
          name_match_score: matchResult.score,
          matched_landlord_name: matchResult.matchedName,
        }
      );
    } else {
      await audit.logFailure(
        AuditActions.PAN_VERIFICATION_FAILED,
        "verification",
        !panValid ? "PAN_INVALID" : "PAN_NAME_MISMATCH",
        !panValid
          ? `PAN ${maskPan(sanitizedPan)} is not valid`
          : `PAN name "${registeredName}" did not match agreement landlords: ${resolvedNames.join(", ")}`,
        "pan_verification",
        bank_account_id,
        {
          pan_type: panType,
          pan_valid: panValid,
          registered_name: registeredName,
          name_match_score: matchResult.score,
          matched_landlord_name: matchResult.matchedName,
        }
      );
    }

    // Recompute risk after PAN verification
    try {
      await recomputeAndStoreRisk(userId, supabase);
    } catch (riskErr) {
      console.error("[verify-pan] Risk recompute failed (non-fatal):", riskErr);
    }

    // Build message
    let message: string;
    if (panValid && matchResult.matched) {
      message = "PAN verified successfully";
    } else if (!panValid) {
      message = "PAN card is not valid. Please check the PAN number.";
    } else {
      message = "The PAN holder name does not match any landlord in your rental agreement. Please ensure you are verifying your landlord's PAN.";
    }

    const responseBody = {
      success: true,
      data: {
        pan_verified: panValid && matchResult.matched,
        pan_valid: panValid,
        pan_type: panType,
        registered_name: registeredName,
        name_matched: matchResult.matched,
        name_match_score: matchResult.score,
        matched_landlord_name: matchResult.matchedName,
        message,
      },
    };

    // Cache response for idempotency
    await idempotency.complete(idempotencyKey, 200, responseBody);

    return jsonResponse(responseBody);
  } catch (error) {
    // Mark idempotency as failed
    if (idempotencyKey) {
      const idempotency = new IdempotencyManager(supabase);
      await idempotency.fail(
        idempotencyKey,
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    if (audit && userId) {
      await audit.logFailure(
        AuditActions.PAN_VERIFICATION_FAILED,
        "verification",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "pan_verification"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// CASHFREE PAN VERIFICATION API
// ==============================================

async function callCashfreePanVerify(panNumber: string): Promise<CashfreePanResponse> {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new ExternalServiceError("Cashfree", "API credentials not configured");
  }

  try {
    // Build headers with x-cf-signature for non-whitelisted IPs
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-client-id": CASHFREE_APP_ID,
      "x-client-secret": CASHFREE_SECRET_KEY,
    };
    try {
      const { signature } = await generateCfSignature(CASHFREE_APP_ID);
      headers["x-cf-signature"] = signature;
    } catch (sigErr) {
      console.warn("[verify-pan] x-cf-signature not added:", sigErr instanceof Error ? sigErr.message : String(sigErr));
    }

    const response = await fetch(`${CASHFREE_BASE_URL}/pan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pan: panNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[verify-pan] Cashfree API error:", data);
      throw new ExternalServiceError(
        "Cashfree",
        data.message ?? `HTTP ${response.status}`
      );
    }

    return {
      valid: data.valid ?? false,
      registered_name: data.registered_name,
      name_pan_card: data.name_pan_card,
      type: data.type,
      pan_status: data.pan_status,
      reference_id: data.reference_id,
      message: data.message,
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;

    console.error("[verify-pan] Cashfree PAN verification failed:", error);
    throw new ExternalServiceError(
      "Cashfree",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// ==============================================
// HELPERS
// ==============================================

/**
 * Determines PAN type from the 4th character of PAN number.
 * PAN format: ABCDE1234F where 4th char indicates entity type.
 */
function determinePanType(pan: string): string {
  const typeChar = pan[3]?.toUpperCase();
  const typeMap: Record<string, string> = {
    P: "Individual",
    H: "HUF",
    C: "Company",
    T: "Trust",
    A: "AOP",
    B: "BOI",
    G: "Government",
    J: "AJP",
    L: "LLP",
    F: "Firm",
  };
  return typeMap[typeChar] ?? "Individual";
}
