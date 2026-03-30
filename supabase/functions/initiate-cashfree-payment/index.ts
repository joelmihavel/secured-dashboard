/**
 * Flent Secured v2 - Initiate Cashfree Payment Edge Function
 *
 * Cashfree-only payment initiation. Creates a Cashfree order via Easy Split
 * and returns a payment_session_id for Web Checkout (card/debit/netbanking)
 * or native SDK (UPI).
 *
 * Endpoint: POST /functions/v1/initiate-cashfree-payment
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
import { generateTransactionId } from "../_shared/crypto.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";
import { createOrder, CashfreeError } from "../_shared/cashfree-easysplit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUILD_MARKER = "2026-03-27T16:00-cf-v3-clean";

// PG fee rates — read from env vars, fallback to defaults
function getPgFeeRates(): Record<string, number> {
  return {
    upi: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    upi_intent: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    upi_collect: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? "0"),
    credit_card: parseFloat(Deno.env.get("FEE_RATE_CREDIT_CARD") ?? "0.02"),
    debit_card: parseFloat(Deno.env.get("FEE_RATE_DEBIT_CARD") ?? "0.02"),
    card: parseFloat(Deno.env.get("FEE_RATE_CREDIT_CARD") ?? "0.02"),
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
    .eq("gateway", "cashfree")
    .eq("is_active", true)
    .maybeSingle();
  if (data) {
    const rate = Number(data.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      console.error("[fee_config] Invalid rate for method:", method, data.rate);
      throw new PaymentError("Invalid fee configuration", "INVALID_FEE_CONFIG");
    }
    return { rate, fee_type: data.fee_type ?? 'percentage' };
  }
  const pgFeeRates = getPgFeeRates();
  return { rate: pgFeeRates[method] ?? 0, fee_type: 'percentage' as const };
}

// Normalize payment method values from iOS
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

interface InitiateCashfreeRequest {
  tenancy_id: string;
  amount_paise?: number;
  payment_method: "upi" | "upi_intent" | "upi_collect" | "card" | "netbanking" | "wallet" | "net_banking" | "credit_card" | "debit_card";
  card_type?: "credit" | "debit";
  upi_app?: string;
  upi_vpa?: string;
  bank_code?: string;
  rent_month: string;
  checkout_mode?: string;
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
    enum: ["upi", "upi_intent", "upi_collect", "card", "netbanking", "wallet", "net_banking", "credit_card", "debit_card"],
  },
  card_type: { required: false, type: "string" as const, enum: ["credit", "debit"] },
  upi_app: { required: false, type: "string" as const },
  upi_vpa: { required: false, type: "string" as const },
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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // GET = deployment probe (no auth)
  if (req.method === "GET") {
    return jsonResponse({ _probe: true, _build: BUILD_MARKER, gateway: "cashfree", ts: new Date().toISOString() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;
  let idempotencyKey: string | null = null;
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyManager = new IdempotencyManager(supabase);

  try {
    // Authenticate user via Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AppError("No authentication provided", "AUTH_ERROR", 401);
    }
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    const body = await req.json();

    audit = AuditLogger.fromRequest(supabase, req, userId, "initiate-cashfree-payment");
    console.log("[initiate-cashfree-payment] BUILD:", BUILD_MARKER, "tenancy:", body.tenancy_id, "method:", body.payment_method);

    const validatedBody = validateSchema<InitiateCashfreeRequest>(
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
      bank_code,
      rent_month,
    } = validatedBody;

    const payment_method = normalizePaymentMethod(rawPaymentMethod);

    // Get idempotency key
    idempotencyKey = getIdempotencyKey(req, `cf-payment:${userId}:${rent_month}`);

    // Check idempotency
    const idempotencyResult = await idempotencyManager.check(idempotencyKey, body, {
      userId,
      endpoint: "initiate-cashfree-payment",
    });

    if (!idempotencyResult.isNew && idempotencyResult.cachedResponse) {
      return jsonResponse(idempotencyResult.cachedResponse.body, idempotencyResult.cachedResponse.status);
    }

    // Validate tenancy
    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select("id, monthly_rent_paise, user_id, bank_verified, utility_verified, landlord_approved, rent_due_day, cashback_cutoff_day")
      .eq("id", tenancy_id)
      .single();

    if (tenancyError || !tenancy) {
      throw new ValidationError("Invalid tenancy");
    }
    if (tenancy.user_id !== userId) {
      throw new ValidationError("Tenancy does not belong to this user");
    }

    // Landlord vendor status check (log only, don't block)
    const { data: landlordBank } = await supabase
      .from("bank_accounts")
      .select("cf_beneficiary_id, cf_beneficiary_status")
      .eq("user_id", userId)
      .eq("party_type", "landlord")
      .eq("is_primary", true)
      .eq("verified", true)
      .maybeSingle();

    if (!landlordBank?.cf_beneficiary_id || landlordBank.cf_beneficiary_status !== "ACTIVE") {
      console.warn(`[initiate-cashfree-payment] Landlord vendor not active: ${landlordBank?.cf_beneficiary_id ?? "none"}, status=${landlordBank?.cf_beneficiary_status ?? "none"}`);
    }

    // Amount guardrail
    const MIN_AMOUNT_PAISE = 1000;
    if (validatedBody.amount_paise && validatedBody.amount_paise < MIN_AMOUNT_PAISE) {
      throw new PaymentError("Minimum payment amount is \u20B910", "AMOUNT_TOO_LOW");
    }

    // Check for in-progress payments
    const rentMonthDate = `${rent_month}-01`;

    // Expire stale Cashfree initiated payments
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("tenancy_id", tenancy_id)
      .eq("payment_month", rentMonthDate)
      .eq("status", "initiated")
      .eq("payment_gateway", "cashfree")
      .is("cf_order_id", null);

    const { data: inProgressPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("tenancy_id", tenancy_id)
      .eq("payment_month", rentMonthDate)
      .in("status", ["initiated", "processing"])
      .maybeSingle();

    if (inProgressPayment) {
      throw new PaymentError("Payment already in progress for this month", "PAYMENT_IN_PROGRESS");
    }

    // Check cashback already applied
    const { data: cashbackAlreadyGiven } = await supabase
      .from("payments")
      .select("id")
      .eq("tenancy_id", tenancy_id)
      .eq("payment_month", rentMonthDate)
      .eq("status", "success")
      .gt("cashback_applied_paise", 0)
      .limit(1)
      .maybeSingle();

    const cashbackAlreadyApplied = !!cashbackAlreadyGiven;

    // ── DEMO BYPASS ──
    if (await isTestUser(userId, supabase)) {
      const demoTxnId = `DEMO-CF-${crypto.randomUUID()}`;
      const demoRentPaise = validatedBody.amount_paise ?? tenancy.monthly_rent_paise;
      const demoDueDate = calculateDueDate(rent_month);

      const { data: demoPayment, error: demoError } = await supabase
        .from("payments")
        .insert({
          tenancy_id,
          user_id: userId,
          rent_amount_paise: demoRentPaise,
          pg_fee_paise: 0,
          convenience_fee_paise: 0,
          fee_billing_model: 'included',
          cashback_applied_paise: 0,
          intended_cashback_paise: 0,
          total_amount_paise: demoRentPaise,
          landlord_payout_paise: demoRentPaise,
          net_rent_paise: demoRentPaise,
          flent_subsidy_paise: 0,
          status: "success",
          payment_gateway: "cashfree",
          gateway_order_id: demoTxnId,
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
        throw new PaymentError(`Failed to create demo payment: ${demoError?.message ?? "unknown"}`, "DB_ERROR");
      }

      await idempotencyManager.complete(idempotencyKey, 200, {
        payment_id: demoPayment.id, demo_mode: true, status: "success",
      });

      return jsonResponse({
        success: true,
        data: {
          payment_id: demoPayment.id,
          txn_id: demoTxnId,
          gateway: "cashfree",
          _build: BUILD_MARKER,
          demo_mode: true,
          status: "success",
          original_rent_paise: demoRentPaise,
          cashback_applied_paise: 0,
          total_amount_paise: demoRentPaise,
          landlord_payout_paise: demoRentPaise,
          convenience_fee_paise: 0,
          fee_billing_model: 'included',
          payment_method,
        },
      });
    }
    // ── END DEMO BYPASS ──

    // Calculate amounts
    const originalRentPaise = validatedBody.amount_paise ?? tenancy.monthly_rent_paise;

    const verificationComplete = tenancy.bank_verified
      && tenancy.utility_verified
      && tenancy.landlord_approved;

    const cutoffDay = tenancy.cashback_cutoff_day ?? tenancy.rent_due_day ?? 7;
    const [rentYear, rentMonthNum] = rent_month.split("-").map(Number);
    const cutoffDate = new Date(Date.UTC(rentYear, rentMonthNum - 1, cutoffDay, 18, 29, 59, 999));
    const now = new Date();
    const isPastCutoff = now > cutoffDate;

    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name, phone, cashback_balance_paise")
      .eq("id", userId)
      .single();

    const cashbackOnePct = Math.min(
      Math.floor(originalRentPaise * 0.01),
      Math.floor(tenancy.monthly_rent_paise * 0.01)
    );

    let cashbackDiscountPaise = 0;
    let cashbackEarnedPaise = 0;
    let accumulatedRedeemed = 0;

    if (!isPastCutoff && !cashbackAlreadyApplied) {
      const accumulatedBalance = userProfile?.cashback_balance_paise ?? 0;
      cashbackDiscountPaise = cashbackOnePct + accumulatedBalance;
      cashbackDiscountPaise = Math.min(cashbackDiscountPaise, originalRentPaise);
      accumulatedRedeemed = Math.min(accumulatedBalance, cashbackDiscountPaise - cashbackOnePct);
      accumulatedRedeemed = Math.max(0, accumulatedRedeemed);
      cashbackEarnedPaise = 0; // Never accumulate — always instant discount
    }

    const netRentPaise = originalRentPaise - cashbackDiscountPaise;

    const feeRateKey = (payment_method === "card" && card_type) ? `${card_type}_card` : payment_method;
    const feeConfig = await getFeeConfigForMethod(feeRateKey, supabase);
    // Convenience fee: calculated on net rent (AFTER cashback deduction)
    // This fee is included in the Cashfree order amount — tenant pays one combined amount
    const convenienceFeePaise = feeConfig.fee_type === 'flat_paise'
      ? Math.round(feeConfig.rate)
      : Math.ceil(netRentPaise * feeConfig.rate);

    // Cashfree: total includes rent + convenience fee (minus cashback)
    const totalAmountPaise = netRentPaise + convenienceFeePaise;
    const landlordPayoutPaise = originalRentPaise;

    if (
      !Number.isFinite(originalRentPaise) || originalRentPaise <= 0 ||
      !Number.isFinite(netRentPaise) || netRentPaise < 0 ||
      !Number.isFinite(convenienceFeePaise) || convenienceFeePaise < 0 ||
      !Number.isFinite(totalAmountPaise) || totalAmountPaise <= 0
    ) {
      throw new PaymentError("Internal error: invalid payment amount", "INVALID_AMOUNT");
    }

    const txnId = generateTransactionId("FLENT");
    const dueDate = calculateDueDate(rent_month);

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        tenancy_id,
        user_id: userId,
        rent_amount_paise: originalRentPaise,
        pg_fee_paise: 0,
        estimated_pg_fee_paise: convenienceFeePaise,
        convenience_fee_paise: convenienceFeePaise,
        fee_billing_model: 'included',
        cashback_applied_paise: cashbackDiscountPaise,
        cashback_earned_paise: cashbackEarnedPaise,
        accumulated_redeemed_paise: accumulatedRedeemed,
        intended_cashback_paise: cashbackEarnedPaise,
        total_amount_paise: totalAmountPaise,
        landlord_payout_paise: landlordPayoutPaise,
        net_rent_paise: netRentPaise,
        flent_subsidy_paise: cashbackDiscountPaise,
        status: "initiated",
        payu_txn_id: null,
        payment_gateway: "cashfree",
        gateway_order_id: null,
        gateway_metadata: {},
        payment_method,
        idempotency_key: idempotencyKey,
        payment_month: rentMonthDate,
        due_date: dueDate,
        payment_method_details: { upi_app, upi_vpa, bank_code },
        payu_initiation_params: null,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        user_agent: req.headers.get("user-agent"),
      })
      .select()
      .single();

    if (paymentError || !payment) {
      if (paymentError?.code === "23505") {
        throw new PaymentError("Payment already in progress for this month", "PAYMENT_IN_PROGRESS");
      }
      console.error("Failed to create payment:", paymentError);
      throw new PaymentError("Failed to initiate payment", "DB_ERROR");
    }

    await audit.logSuccess(AuditActions.PAYMENT_INITIATED, "payment", "payment", payment.id, {
      original_rent_paise: originalRentPaise,
      net_rent_paise: netRentPaise,
      estimated_pg_fee_paise: convenienceFeePaise,
      convenience_fee_paise: convenienceFeePaise,
      cashback_discount_paise: cashbackDiscountPaise,
      cashback_earned_paise: cashbackEarnedPaise,
      accumulated_redeemed_paise: accumulatedRedeemed,
      total_amount_paise: totalAmountPaise,
      landlord_payout_paise: landlordPayoutPaise,
      payment_method,
      rent_month,
    });

    // ── CASHFREE ORDER CREATION ──
    const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/payment-webhook`;
    // Map raw (pre-normalization) method to Cashfree order_meta.payment_methods.
    // Short codes: cc, dc, nb, upi (confirmed working with API v2025-01-01).
    const CF_METHOD_MAP: Record<string, string> = {
      card: 'cc',
      credit_card: 'cc',
      debit_card: 'dc',
      netbanking: 'nb',
      upi: 'upi',
    };
    const cfPaymentMethods = CF_METHOD_MAP[rawPaymentMethod] ?? undefined;

    const customerPhone = userProfile?.phone?.replace(/\D/g, '') ?? '';
    if (!customerPhone || customerPhone.length < 10) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      throw new ValidationError("Phone number is required for payment. Please update your profile.");
    }

    let cfOrder;
    try {
      cfOrder = await createOrder({
        amountPaise: totalAmountPaise,
        orderId: `flent-${payment.id.slice(0, 8)}`,
        customerId: userId,
        customerPhone,
        notifyUrl: WEBHOOK_URL,
        paymentMethods: cfPaymentMethods,
      });
    } catch (cfErr) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      console.error('[initiate-cashfree-payment] Cashfree createOrder failed:', cfErr);
      throw new PaymentError(
        cfErr instanceof CashfreeError ? cfErr.message : 'Failed to create Cashfree order',
      );
    }

    if (!cfOrder.order_id || !cfOrder.payment_session_id) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      throw new PaymentError('Cashfree returned incomplete order response');
    }

    // Update payment with Cashfree order ID
    await supabase
      .from('payments')
      .update({
        payment_gateway: 'cashfree',
        cf_order_id: cfOrder.order_id,
        gateway_order_id: cfOrder.order_id,
      })
      .eq('id', payment.id);

    const responseData = {
      payment_id: payment.id,
      txn_id: txnId,
      _build: BUILD_MARKER,
      gateway: "cashfree" as const,
      total_amount_paise: totalAmountPaise,
      original_rent_paise: originalRentPaise,
      cashback_applied_paise: cashbackDiscountPaise,
      cashback_earned_paise: cashbackEarnedPaise,
      accumulated_redeemed_paise: accumulatedRedeemed,
      net_rent_paise: netRentPaise,
      pg_fee_paise: 0,
      estimated_pg_fee_paise: convenienceFeePaise,
      convenience_fee_paise: convenienceFeePaise,
      fee_billing_model: 'included',
      landlord_payout_paise: landlordPayoutPaise,
      payment_method,
      cashback_discount: {
        discount_paise: cashbackDiscountPaise,
        discount_rupees: cashbackDiscountPaise / 100,
        verification_complete: verificationComplete,
        past_cutoff: isPastCutoff,
        cutoff_day: cutoffDay,
        reason: getCashbackBlockerReason(tenancy, verificationComplete, isPastCutoff, cutoffDay, cashbackAlreadyApplied),
      },
      verification_complete: verificationComplete,
      cashfree: {
        payment_session_id: cfOrder.payment_session_id,
        cf_order_id: cfOrder.order_id,
      },
    };

    await idempotencyManager.complete(idempotencyKey, 200, responseData);

    return jsonResponse({
      success: true,
      data: responseData,
    });

  } catch (error) {
    if (idempotencyKey) {
      await idempotencyManager.fail(idempotencyKey, error instanceof Error ? error.message : "Unknown error").catch(() => {});
    }
    return handleError(error, requestId);
  }
});

// ==============================================
// HELPERS
// ==============================================

function calculateDueDate(rentMonth: string): string {
  const [year, month] = rentMonth.split("-").map(Number);
  const dueDate = new Date(year, month - 1, 5);
  return dueDate.toISOString().split("T")[0];
}

function getCashbackBlockerReason(
  _tenancy: { bank_verified: boolean; utility_verified: boolean; landlord_approved: boolean },
  _verificationComplete: boolean,
  isPastCutoff: boolean,
  cutoffDay: number,
  cashbackAlreadyApplied?: boolean,
): string | null {
  if (!isPastCutoff && !cashbackAlreadyApplied) return null;
  if (cashbackAlreadyApplied) return "Cashback has already been applied to a payment this month.";
  if (isPastCutoff) return `Cashback is available only for payments made by the ${ordinal(cutoffDay)} of the month.`;
  return null;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
