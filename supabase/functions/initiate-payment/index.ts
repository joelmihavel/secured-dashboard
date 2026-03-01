/**
 * Flent Secured v2 - Initiate Payment Edge Function
 *
 * Initiates a rent payment via PayU. Returns PayU-specific params
 * for the client to complete the payment flow.
 *
 * Endpoint: POST /functions/v1/initiate-payment
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
  PaymentError,
  RateLimitError,
  handleError,
} from "../_shared/errors.ts";
import { validateSchema, isValidAmountPaise, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { IdempotencyManager, getIdempotencyKey } from "../_shared/idempotency.ts";
import { generatePayUHash, generateTransactionId, sha512 } from "../_shared/crypto.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";
import {
  PAYU_MERCHANT_KEY,
  PAYU_MERCHANT_SALT,
  PAYU_BASE_URL,
  PAYU_SDK_ENVIRONMENT,
  IS_SANDBOX,
} from "../_shared/payu-config.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// PG fee rates — read from env vars, fallback to defaults
function getPgFeeRates(): Record<string, number> {
  return {
    upi: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    upi_intent: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    upi_collect: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    credit_card: parseFloat(Deno.env.get("FEE_RATE_CREDIT_CARD") ?? "0.02"),
    debit_card: parseFloat(Deno.env.get("FEE_RATE_DEBIT_CARD") ?? "0.02"),
    card: parseFloat(Deno.env.get("FEE_RATE_CREDIT_CARD") ?? "0.02"), // backward compat
    netbanking: parseFloat(Deno.env.get("FEE_RATE_NETBANKING") ?? "0.015"),
    wallet: parseFloat(Deno.env.get("FEE_RATE_WALLET") ?? "0.02"),
  };
}

// Fee config from DB (with flat fee support)
async function getFeeConfigForMethod(method: string, supabase: any) {
  const { data } = await supabase
    .from("fee_config")
    .select("rate, fee_type")
    .eq("method", method)
    .eq("is_active", true)
    .maybeSingle();
  if (data) return { rate: Number(data.rate), fee_type: data.fee_type ?? 'percentage' };
  // Fallback to env-based percentage rates
  const pgFeeRates = getPgFeeRates();
  return { rate: pgFeeRates[method] ?? 0, fee_type: 'percentage' as const };
}

// PayU enforce_paymethod values per normalized payment method.
// Controls which payment option PayU's Custom Browser allows —
// even if someone tampers with the client, PayU will reject disallowed methods.
const PAYU_ENFORCE_PAYMETHOD: Record<string, string> = {
  upi: "UPI",
  upi_intent: "UPI",
  upi_collect: "UPI",
  card: "creditcard|debitcard",
  credit_card: "creditcard",
  debit_card: "debitcard",
  netbanking: "netbanking",
  wallet: "cashcard",
};

/** Resolve enforce_paymethod based on card_type signal */
function resolveEnforcePaymethod(paymentMethod: string, cardType?: string): string {
  if (paymentMethod === "card" && cardType === "credit") return "creditcard";
  if (paymentMethod === "card" && cardType === "debit") return "debitcard";
  return PAYU_ENFORCE_PAYMETHOD[paymentMethod] ?? "";
}

// Normalize payment method values from iOS
// iOS sends: net_banking, credit_card, debit_card
// Backend expects: netbanking, card
const PAYMENT_METHOD_ALIASES: Record<string, string> = {
  net_banking: "netbanking",
  credit_card: "card",
  debit_card: "card",
};

function normalizePaymentMethod(method: string): string {
  return PAYMENT_METHOD_ALIASES[method] || method;
}

// ==============================================
// TYPES
// ==============================================

interface InitiatePaymentRequest {
  tenancy_id: string;
  amount_paise?: number; // Optional - defaults to monthly rent
  // Accept both iOS and backend formats (normalized internally)
  payment_method: "upi" | "upi_intent" | "upi_collect" | "card" | "netbanking" | "wallet" | "net_banking" | "credit_card" | "debit_card";
  card_type?: "credit" | "debit"; // Distinguishes CC vs DC for gate and enforce_paymethod
  upi_app?: string; // For upi_intent: gpay, phonepe, paytm, etc.
  upi_vpa?: string; // For upi_collect
  card_token?: string; // For card payments (tokenized)
  bank_code?: string; // For netbanking
  rent_month: string; // YYYY-MM format
}

// ==============================================
// VALIDATION SCHEMA
// ==============================================

const requestSchema = {
  tenancy_id: { required: true, type: "string" as const, custom: isValidUuid },
  amount_paise: { required: false, type: "number" as const, custom: isValidAmountPaise },
  payment_method: {
    required: true,
    type: "string" as const,
    // Accept both iOS and backend formats
    enum: ["upi", "upi_intent", "upi_collect", "card", "netbanking", "wallet", "net_banking", "credit_card", "debit_card"],
  },
  card_type: { required: false, type: "string" as const, enum: ["credit", "debit"] },
  upi_app: { required: false, type: "string" as const },
  upi_vpa: { required: false, type: "string" as const },
  card_token: { required: false, type: "string" as const },
  bank_code: { required: false, type: "string" as const },
  checkout_mode: { required: false, type: "string" as const, enum: ["sdk", "seamless"] },
  rent_month: {
    required: true,
    type: "string" as const,
    pattern: /^\d{4}-\d{2}$/,
  },
};

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

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;
  let idempotencyKey: string | null = null;
  const idempotencyManager = new IdempotencyManager(supabase);

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid, user } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "initiate-payment");

    // S15: Rate limit — max 5 payment initiations per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentPayments } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((recentPayments ?? 0) >= 5) {
      throw new RateLimitError(3600);
    }

    // Parse and validate request body
    const body = await req.json();
    console.log("[initiate-payment] Request for tenancy:", body.tenancy_id, "method:", body.payment_method);
    const validatedBody = validateSchema<InitiatePaymentRequest>(
      body,
      requestSchema,
      true
    );

    const {
      tenancy_id,
      payment_method: rawPaymentMethod,
      card_type,
      upi_app,
      upi_vpa,
      card_token,
      bank_code,
      rent_month,
    } = validatedBody;
    const checkout_mode = (validatedBody as Record<string, unknown>).checkout_mode as string | undefined;

    // Normalize payment method (iOS sends net_banking, credit_card, debit_card)
    const payment_method = normalizePaymentMethod(rawPaymentMethod);

    // Get idempotency key
    idempotencyKey = getIdempotencyKey(req, `payment:${userId}:${rent_month}`);

    // Check idempotency
    const idempotencyResult = await idempotencyManager.check(idempotencyKey, body, {
      userId,
      endpoint: "initiate-payment",
    });

    if (!idempotencyResult.isNew && idempotencyResult.cachedResponse) {
      return jsonResponse(idempotencyResult.cachedResponse.body, idempotencyResult.cachedResponse.status);
    }

    // Validate payment method specific requirements
    // Phase 3.2: SDK mode lets PayU handle instrument selection, so card_token/bank_code not required
    const isSDKMode = checkout_mode === "sdk";
    if (payment_method === "upi_collect" && !upi_vpa) {
      throw new ValidationError("UPI VPA is required for UPI collect", { upi_vpa: "Required" });
    }
    if (!isSDKMode) {
      if (payment_method === "card" && !card_token) {
        throw new ValidationError("Card token is required for seamless card payments", { card_token: "Required" });
      }
      if (payment_method === "netbanking" && !bank_code) {
        throw new ValidationError("Bank code is required for seamless netbanking", { bank_code: "Required" });
      }
    }

    // Fetch tenancy and validate
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(`
        id, user_id, status, monthly_rent_paise, landlord_name,
        bank_verified, utility_verified, landlord_approved,
        cashback_cutoff_day, rent_due_day
      `)
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new ValidationError("Tenancy not found", { tenancy_id: "Not found" });
    }

    if (tenancy.user_id !== userId) {
      throw new AppError("You don't have permission for this tenancy", "FORBIDDEN", 403);
    }

    if (tenancy.status !== "active" && tenancy.status !== "pending_verification") {
      throw new PaymentError("Tenancy is not active", "TENANCY_INACTIVE");
    }

    if (!tenancy.bank_verified) {
      throw new PaymentError("Landlord bank account not verified yet", "BANK_NOT_VERIFIED");
    }

    // S1: Server-side amount validation — never trust client amount below canonical rent
    const canonicalAmountPaise = tenancy.monthly_rent_paise;
    if (validatedBody.amount_paise && validatedBody.amount_paise < canonicalAmountPaise) {
      throw new PaymentError("Amount cannot be less than monthly rent", "AMOUNT_TOO_LOW");
    }

    // Credit card requires landlord approval + utility verification
    // Debit card (card_type === 'debit') skips this gate
    const isCreditCard = ['card', 'CC'].includes(payment_method)
      && (card_type === 'credit' || card_type === undefined); // backward compat: unspecified = credit
    if (isCreditCard) {
      if (!tenancy.landlord_approved) {
        throw new PaymentError(
          "Credit card payments require landlord verification. Your landlord must accept the tenancy first.",
          "LANDLORD_NOT_APPROVED"
        );
      }
      if (!tenancy.utility_verified) {
        throw new PaymentError(
          "Credit card payments require utility bill verification to confirm landlord ownership.",
          "UTILITY_NOT_VERIFIED"
        );
      }
    }

    // Check for existing payment this month
    const rentMonthDate = `${rent_month}-01`;

    // Expire stale initiated payments (abandoned pre-fetch or user exit)
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("payments")
      .update({ status: "failed", payu_status: "expired_stale" })
      .eq("tenancy_id", tenancy_id)
      .eq("payment_month", rentMonthDate)
      .eq("status", "initiated")
      .lt("created_at", TEN_MINUTES_AGO);

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("tenancy_id", tenancy_id)
      .eq("payment_month", rentMonthDate)
      .in("status", ["initiated", "processing", "success"])
      .maybeSingle();

    if (existingPayment) {
      if (existingPayment.status === "success") {
        throw new PaymentError("Payment already completed for this month", "ALREADY_PAID");
      }
      throw new PaymentError("Payment already in progress for this month", "PAYMENT_IN_PROGRESS");
    }

    // ── DEMO BYPASS ──────────────────────────────────────────────────
    // Test users get instant mock success without hitting PayU.
    if (await isTestUser(userId, supabase)) {
      const demoTxnId = `DEMO-${crypto.randomUUID()}`;
      const demoRentPaise = validatedBody.amount_paise ?? tenancy.monthly_rent_paise;
      const demoDueDate = calculateDueDate(rent_month);

      const { data: demoPayment, error: demoError } = await supabase
        .from("payments")
        .insert({
          tenancy_id,
          user_id: userId,
          rent_amount_paise: demoRentPaise,
          pg_fee_paise: 0,
          cashback_applied_paise: 0,
          intended_cashback_paise: 0,
          total_amount_paise: demoRentPaise,
          landlord_payout_paise: demoRentPaise,
          net_rent_paise: demoRentPaise,
          flent_subsidy_paise: 0,
          status: "success",
          payment_gateway: "demo",
          gateway_order_id: demoTxnId,
          payu_txn_id: demoTxnId,
          payment_method,
          idempotency_key: idempotencyKey,
          payment_month: rentMonthDate,
          due_date: demoDueDate,
          paid_at: new Date().toISOString(),
          landlord_payout_status: "settled",
        })
        .select()
        .single();

      if (demoError || !demoPayment) {
        console.error("[initiate-payment] Demo insert error:", JSON.stringify(demoError));
        throw new PaymentError(`Failed to create demo payment: ${demoError?.message ?? "unknown"}`, "DB_ERROR");
      }

      await audit!.logSuccess("PAYMENT_DEMO_BYPASS", "payment", "payment", demoPayment.id, {
        demo: true, rent_paise: demoRentPaise, payment_method, rent_month,
      });

      await idempotencyManager.complete(idempotencyKey, 200, {
        payment_id: demoPayment.id, demo_mode: true, status: "success",
      });

      return jsonResponse({
        success: true,
        data: {
          payment_id: demoPayment.id,
          txn_id: demoTxnId,
          gateway: "demo",
          demo_mode: true,
          status: "success",
          original_rent_paise: demoRentPaise,
          cashback_applied_paise: 0,
          net_rent_paise: demoRentPaise,
          pg_fee_paise: 0,
          total_amount_paise: demoRentPaise,
          landlord_payout_paise: demoRentPaise,
          payment_method,
        },
      });
    }
    // ── END DEMO BYPASS ──────────────────────────────────────────────

    // Calculate amounts
    const originalRentPaise = validatedBody.amount_paise ?? tenancy.monthly_rent_paise;

    // Verification gate — instant 1% discount only if ALL verifications complete
    const verificationComplete = tenancy.bank_verified
      && tenancy.utility_verified
      && tenancy.landlord_approved;

    // Cutoff gate — cashback only if payment is made on or before the cutoff day
    // cutoff_day comes from the rent agreement; defaults to 7 if not specified
    const cutoffDay = tenancy.cashback_cutoff_day ?? 7;
    const [rentYear, rentMonthNum] = rent_month.split("-").map(Number);
    // Cutoff date: end of cutoff day in IST (UTC+05:30) → 18:29:59 UTC
    const cutoffDate = new Date(Date.UTC(rentYear, rentMonthNum - 1, cutoffDay, 18, 29, 59, 999));
    const now = new Date();
    const isPastCutoff = now > cutoffDate;

    // Instant 1% discount (no wallet, no earn/redeem)
    // Requires: all verifications complete AND payment before cutoff
    const cashbackDiscountPaise = (verificationComplete && !isPastCutoff)
      ? Math.min(
          Math.floor(originalRentPaise * 0.01),        // 1% of entered amount
          Math.floor(tenancy.monthly_rent_paise * 0.01) // capped at 1% of agreement rent
        )
      : 0;

    const netRentPaise = originalRentPaise - cashbackDiscountPaise;

    // PG fee on net payable (what the gateway actually charges)
    // Use card_type-specific rate if available, otherwise fall back to payment_method
    const feeRateKey = (payment_method === "card" && card_type) ? `${card_type}_card` : payment_method;
    const feeConfig = await getFeeConfigForMethod(feeRateKey, supabase);
    const pgFeePaise = feeConfig.fee_type === 'flat_paise'
      ? Math.round(feeConfig.rate)
      : Math.ceil(netRentPaise * feeConfig.rate);

    // Total amount the gateway charges the user
    const totalAmountPaise = netRentPaise + pgFeePaise;
    // Landlord always gets full rent
    const landlordPayoutPaise = originalRentPaise;

    // Generate transaction ID
    const txnId = generateTransactionId("FLENT");

    // Get user details for PayU order creation
    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .single();

    const firstname = userProfile?.first_name ?? "User";
    const email = `${userId}@flent.app`; // PayU requires email

    // Generate PayU hash — amount is what PayU charges (chargeableRent + pgFee)
    const productinfo = `Rent payment for ${rent_month}`;
    const amountStr = (totalAmountPaise / 100).toFixed(2); // PayU expects amount in rupees

    const payuParams = {
      key: PAYU_MERCHANT_KEY,
      txnid: txnId,
      amount: amountStr,
      productinfo,
      firstname,
      email,
      salt: PAYU_MERCHANT_SALT,
      udf1: tenancy_id,
      udf2: rent_month,
      udf3: userId,
    };

    // PayU hash generation
    const userCredential = `${PAYU_MERCHANT_KEY}:${email}`;
    const payuHash = await generatePayUHash(payuParams);
    const vasHash = await sha512(`${PAYU_MERCHANT_KEY}|vas_for_mobile_sdk|default|${PAYU_MERCHANT_SALT}`);
    const paymentRelatedHash = await sha512(`${PAYU_MERCHANT_KEY}|payment_related_details_for_mobile_sdk|${userCredential}|${PAYU_MERCHANT_SALT}`);

    // Diagnostic: log hash input for debugging (salt masked)
    const maskedSalt = PAYU_MERCHANT_SALT.slice(0, 4) + "****" + PAYU_MERCHANT_SALT.slice(-4);
    const hashInputForLog = `${PAYU_MERCHANT_KEY}|${txnId}|${amountStr}|${productinfo}|${firstname}|${email}|${payuParams.udf1 ?? ""}|${payuParams.udf2 ?? ""}|${payuParams.udf3 ?? ""}|||||||${maskedSalt}`;
    console.log("[initiate-payment] Hash diagnostic:", {
      hashInput: hashInputForLog,
      hashOutput: payuHash.slice(0, 16) + "...",
      environment: PAYU_SDK_ENVIRONMENT,
      baseUrl: PAYU_BASE_URL,
      isSandbox: IS_SANDBOX,
      key: PAYU_MERCHANT_KEY,
      amount: amountStr,
      txnid: txnId,
    });

    // Calculate due date (5th of the rent month, or next month if already past)
    const dueDate = calculateDueDate(rent_month);

    // Create payment record — rent_amount_paise stores the ORIGINAL rent, not the reduced amount
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        tenancy_id,
        user_id: userId,
        rent_amount_paise: originalRentPaise,
        pg_fee_paise: pgFeePaise,
        cashback_applied_paise: cashbackDiscountPaise,
        intended_cashback_paise: 0,
        total_amount_paise: totalAmountPaise,
        landlord_payout_paise: landlordPayoutPaise,
        net_rent_paise: netRentPaise,
        flent_subsidy_paise: cashbackDiscountPaise,
        status: "initiated",
        payu_txn_id: txnId,
        payment_gateway: "payu",
        gateway_order_id: txnId,
        gateway_metadata: { key: PAYU_MERCHANT_KEY, txnid: txnId, amount: amountStr },
        payment_method,
        idempotency_key: idempotencyKey,
        payment_month: rentMonthDate,
        due_date: dueDate,
        payment_method_details: {
          upi_app,
          upi_vpa,
          bank_code,
        },
        payu_initiation_params: {
          key: PAYU_MERCHANT_KEY,
          txnid: txnId,
          amount: amountStr,
          productinfo,
          firstname,
          email,
          phone: userProfile?.phone ?? "",
          udf1: tenancy_id,
          udf2: rent_month,
          udf3: userId,
        },
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        user_agent: req.headers.get("user-agent"),
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("Failed to create payment:", paymentError);
      throw new PaymentError("Failed to initiate payment", "DB_ERROR");
    }

    // Log audit
    await audit.logSuccess(AuditActions.PAYMENT_INITIATED, "payment", "payment", payment.id, {
      original_rent_paise: originalRentPaise,
      net_rent_paise: netRentPaise,
      pg_fee_paise: pgFeePaise,
      cashback_discount_paise: cashbackDiscountPaise,
      total_amount_paise: totalAmountPaise,
      landlord_payout_paise: landlordPayoutPaise,
      payment_method,
      rent_month,
    });

    // Build response based on payment method
    const surl = `${SUPABASE_URL}/functions/v1/payment-webhook`;
    const furl = `${SUPABASE_URL}/functions/v1/payment-webhook`;
    const curl = `${SUPABASE_URL}/functions/v1/payment-webhook`;

    const responseData = {
      payment_id: payment.id,
      txn_id: txnId,
      gateway: "payu" as const,
      original_rent_paise: originalRentPaise,
      cashback_applied_paise: cashbackDiscountPaise,
      net_rent_paise: netRentPaise,
      pg_fee_paise: pgFeePaise,
      total_amount_paise: totalAmountPaise,
      landlord_payout_paise: landlordPayoutPaise,
      payment_method,

      cashback_discount: {
        discount_paise: cashbackDiscountPaise,
        discount_rupees: cashbackDiscountPaise / 100,
        verification_complete: verificationComplete,
        past_cutoff: isPastCutoff,
        cutoff_day: cutoffDay,
        reason: getCashbackBlockerReason(tenancy, verificationComplete, isPastCutoff, cutoffDay),
      },
      verification_complete: verificationComplete,

      // PayU params for client
      payu: {
        key: PAYU_MERCHANT_KEY,
        txnid: txnId,
        amount: amountStr,
        productinfo,
        firstname,
        email,
        phone: userProfile?.phone ?? "",
        hash: payuHash,
        surl,
        furl,
        curl,
        udf1: tenancy_id,
        udf2: rent_month,
        udf3: userId,
        user_credential: userCredential,
        vas_for_mobile_sdk_hash: vasHash,
        payment_related_details_for_mobile_sdk_hash: paymentRelatedHash,
        enforce_paymethod: resolveEnforcePaymethod(payment_method, card_type),
        // SDK environment: '1' = sandbox, '0' = production — client uses this instead of __DEV__
        environment: PAYU_SDK_ENVIRONMENT,
      },

      // Method-specific data (PayU UPI intent only)
      ...(payment_method === "upi_intent" && {
        intent_url: buildUpiIntentUrl({
          key: PAYU_MERCHANT_KEY,
          txnid: txnId,
          amount: amountStr,
          productinfo,
          firstname,
          email,
          hash: payuHash,
          upi_app,
        }),
      }),
    };

    // Complete idempotency
    await idempotencyManager.complete(idempotencyKey, 200, responseData);

    return jsonResponse({
      success: true,
      data: responseData,
    });
  } catch (error) {
    // Mark idempotency as failed
    if (idempotencyKey) {
      await idempotencyManager.fail(
        idempotencyKey,
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    if (audit && userId) {
      await audit.logFailure(
        AuditActions.PAYMENT_FAILED,
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// UPI INTENT URL BUILDER
// ==============================================

/**
 * Calculates the due date for a rent payment.
 * Default: 5th of the rent month
 */
function calculateDueDate(rentMonth: string): string {
  const [year, month] = rentMonth.split("-").map(Number);
  // Due date is 5th of the rent month
  const dueDate = new Date(year, month - 1, 5);
  return dueDate.toISOString().split("T")[0];
}

/**
 * Returns a human-readable reason why cashback cannot be applied.
 * Checks cutoff date first (more actionable for the user), then verification.
 */
function getCashbackBlockerReason(
  tenancy: { bank_verified: boolean; utility_verified: boolean; landlord_approved: boolean },
  verificationComplete: boolean,
  isPastCutoff: boolean,
  cutoffDay: number,
): string | null {
  // If both gates pass, no blocker
  if (verificationComplete && !isPastCutoff) return null;

  // Cutoff takes priority — user can't fix verification in time if already past cutoff
  if (isPastCutoff) {
    return `Cashback is available only for payments made by the ${ordinal(cutoffDay)} of the month. Pay on time next month to earn 1% cashback.`;
  }

  // Verification blockers
  return getVerificationBlockerReason(tenancy);
}

/**
 * Returns a human-readable reason for incomplete verification.
 */
function getVerificationBlockerReason(tenancy: {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
}): string {
  if (!tenancy.bank_verified) {
    return "Complete bank verification to unlock 1% rent discount";
  }
  if (!tenancy.utility_verified) {
    return "Complete utility bill verification to unlock 1% rent discount";
  }
  if (!tenancy.landlord_approved) {
    return "Landlord approval required to unlock 1% rent discount";
  }
  return "Complete all verifications to unlock 1% rent discount";
}

/** Returns ordinal suffix for a day number (1st, 2nd, 3rd, 7th, etc.) */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildUpiIntentUrl(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  hash: string;
  upi_app?: string;
}): string {
  // This would typically come from PayU's API response
  // For now, return a placeholder that the client will handle
  const baseUrl = `${PAYU_BASE_URL}/_payment`;

  const urlParams = new URLSearchParams({
    key: params.key,
    txnid: params.txnid,
    amount: params.amount,
    productinfo: params.productinfo,
    firstname: params.firstname,
    email: params.email,
    hash: params.hash,
    pg: "UPI",
    bankcode: params.upi_app?.toUpperCase() ?? "UPI",
  });

  return `${baseUrl}?${urlParams.toString()}`;
}
