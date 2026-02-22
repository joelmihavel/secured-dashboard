/**
 * Flent Secured v2 - Initiate Payment Edge Function
 *
 * Initiates a rent payment via PayU Seamless Integration.
 * Returns payment hash and redirect/intent URL for the client.
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

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const PAYU_BASE_URL = Deno.env.get("PAYU_BASE_URL") ?? "https://test.payu.in";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// PG fee rates (approximate)
const PG_FEE_RATES: Record<string, number> = {
  upi: 0, // UPI is typically free or very low
  upi_intent: 0,
  upi_collect: 0,
  card: 0.02, // 2%
  netbanking: 0.015, // 1.5%
  wallet: 0.02, // 2%
};

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
  upi_app?: string; // For upi_intent: gpay, phonepe, paytm, etc.
  upi_vpa?: string; // For upi_collect
  card_token?: string; // For card payments (tokenized)
  bank_code?: string; // For netbanking
  apply_cashback?: boolean; // Whether to apply available cashback
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
  upi_app: { required: false, type: "string" as const },
  upi_vpa: { required: false, type: "string" as const },
  card_token: { required: false, type: "string" as const },
  bank_code: { required: false, type: "string" as const },
  apply_cashback: { required: false, type: "boolean" as const },
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
    const validatedBody = validateSchema<InitiatePaymentRequest>(
      body,
      requestSchema,
      true
    );

    const {
      tenancy_id,
      payment_method: rawPaymentMethod,
      upi_app,
      upi_vpa,
      card_token,
      bank_code,
      apply_cashback = true,
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
        bank_verified, utility_verified, landlord_approved
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
    if (['card', 'CC'].includes(payment_method)) {
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

    // Calculate amounts
    const originalRentPaise = validatedBody.amount_paise ?? tenancy.monthly_rent_paise;
    const rentAmountPaise = originalRentPaise; // Preserve original for storage

    // Verification gate - cashback can only be APPLIED (deducted from payment) if all verifications complete
    const canApplyCashback = apply_cashback
      && tenancy.bank_verified
      && tenancy.utility_verified
      && tenancy.landlord_approved;

    // Monthly cashback cap = 1% of agreement rent (not payment rent)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthlyCap = Math.floor(tenancy.monthly_rent_paise * 0.01);

    // How much earned this month already
    const { data: monthlyEarnings } = await supabase
      .from('cashback_ledger')
      .select('amount_paise')
      .eq('user_id', userId)
      .eq('transaction_type', 'earned')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    const earnedThisMonth = (monthlyEarnings || []).reduce((sum: number, e: { amount_paise: number }) => sum + e.amount_paise, 0);
    const capRemaining = Math.max(0, monthlyCap - earnedThisMonth);
    const maxCashback = Math.min(Math.floor(originalRentPaise * 0.01), capRemaining);

    // Get available cashback wallet balance
    let availableBalance = 0;
    if (canApplyCashback) {
      const { data: cashbackBalance } = await supabase.rpc("get_available_cashback", {
        p_user_id: userId,
      });
      availableBalance = cashbackBalance ?? 0;
    }

    // Only apply if verification gate passes
    const cashbackAppliedPaise = canApplyCashback ? Math.min(availableBalance, maxCashback) : 0;
    const chargeableRentPaise = originalRentPaise - cashbackAppliedPaise;

    // Calculate PG fee on the chargeable amount (what PayU actually charges)
    const feeRate = PG_FEE_RATES[payment_method] ?? 0.02;
    const pgFeePaise = Math.ceil(chargeableRentPaise * feeRate);

    // Total amount PayU charges the user
    const totalAmountPaise = chargeableRentPaise + pgFeePaise;
    // What Flent transfers to landlord (always original rent, unaffected by cashback)
    const landlordPayoutPaise = originalRentPaise;

    // Generate transaction ID
    const txnId = generateTransactionId("FLENT");

    // Get user details for PayU
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

    const hash = await generatePayUHash(payuParams);

    // Phase 3.4: Pre-compute static SDK hashes
    const userCredential = `${PAYU_MERCHANT_KEY}:${email}`;
    const vasHash = await sha512(`${PAYU_MERCHANT_KEY}|vas_for_mobile_sdk|default|${PAYU_MERCHANT_SALT}`);
    const paymentRelatedHash = await sha512(`${PAYU_MERCHANT_KEY}|payment_related_details_for_mobile_sdk|${userCredential}|${PAYU_MERCHANT_SALT}`);

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
        cashback_applied_paise: cashbackAppliedPaise,
        intended_cashback_paise: cashbackAppliedPaise,
        total_amount_paise: totalAmountPaise,
        landlord_payout_paise: landlordPayoutPaise,
        status: "initiated",
        payu_txn_id: txnId,
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

    // S16: Cashback debit is deferred to webhook success handler
    // intended_cashback_paise is stored on the payment record but NOT debited from the ledger here

    // Log audit
    await audit.logSuccess(AuditActions.PAYMENT_INITIATED, "payment", "payment", payment.id, {
      original_rent_paise: originalRentPaise,
      chargeable_rent_paise: chargeableRentPaise,
      pg_fee_paise: pgFeePaise,
      cashback_applied_paise: cashbackAppliedPaise,
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
      original_rent_paise: originalRentPaise,
      cashback_applied_paise: cashbackAppliedPaise,
      chargeable_rent_paise: chargeableRentPaise,
      pg_fee_paise: pgFeePaise,
      total_amount_paise: totalAmountPaise,
      landlord_payout_paise: landlordPayoutPaise,
      payment_method,

      cashback_eligibility: {
        eligible: canApplyCashback,
        reason: !canApplyCashback ? getVerificationBlockerReason(tenancy) : null,
        max_cashback_paise: maxCashback,
        wallet_balance_paise: availableBalance,
      },

      // PayU params for client
      payu: {
        key: PAYU_MERCHANT_KEY,
        txnid: txnId,
        amount: amountStr,
        productinfo,
        firstname,
        email,
        phone: userProfile?.phone ?? "",
        hash,
        surl,
        furl,
        curl,
        udf1: tenancy_id,
        udf2: rent_month,
        udf3: userId,
        user_credential: userCredential,
        vas_for_mobile_sdk_hash: vasHash,
        payment_related_details_for_mobile_sdk_hash: paymentRelatedHash,
      },

      // Method-specific data
      ...(payment_method === "upi_intent" && {
        intent_url: buildUpiIntentUrl({
          key: PAYU_MERCHANT_KEY,
          txnid: txnId,
          amount: amountStr,
          productinfo,
          firstname,
          email,
          hash,
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
 */
function getVerificationBlockerReason(tenancy: {
  bank_verified: boolean;
  utility_verified: boolean;
  landlord_approved: boolean;
}): string {
  if (!tenancy.bank_verified) {
    return "Complete bank verification to unlock cashback";
  }
  if (!tenancy.utility_verified) {
    return "Complete utility bill verification to unlock cashback";
  }
  if (!tenancy.landlord_approved) {
    return "Landlord approval required to unlock cashback";
  }
  return "Complete all verifications to unlock cashback";
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
