/**
 * Flent Secured v2 - Initiate Refund Edge Function
 *
 * Initiates a refund request via PayU Refund API.
 * Creates a refund record and reverses cashback if applicable.
 *
 * Endpoint: POST /functions/v1/initiate-refund
 * Auth: Required (JWT)
 *
 * PayU Refund API Reference:
 * POST https://info.payu.in/merchant/postservice
 * Content-Type: application/x-www-form-urlencoded
 * key=<merchant_key>&command=cancel_refund_transaction&var1=<payu_mihpayid>&hash=<sha512(key|command|var1|salt)>
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, NotFoundError, ExternalServiceError, PaymentError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sha512 } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY");
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT");
const PAYU_BASE_URL = Deno.env.get("PAYU_BASE_URL") ?? "https://sandboxsecure.payu.in";

// Refund API endpoint
const PAYU_REFUND_URL = `${PAYU_BASE_URL.replace("secure", "info")}/merchant/postservice`;

// Validate PayU credentials at startup
if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
  console.error("[initiate-refund] FATAL: PayU credentials not configured");
}

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface InitiateRefundRequest {
  payment_id: string;
  amount_paise?: number; // Optional: partial refund amount (defaults to full)
  reason: string;
}

const requestSchema = {
  payment_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid payment ID",
  },
  amount_paise: {
    required: false,
    type: "number" as const,
    custom: (v: unknown) => {
      if (v === undefined || v === null) return true;
      const amount = v as number;
      if (!Number.isInteger(amount) || amount <= 0) {
        return "amount_paise must be a positive integer";
      }
      return true;
    },
  },
  reason: {
    required: true,
    type: "string" as const,
    minLength: 5,
    maxLength: 500,
  },
};

// Valid refund reasons
const VALID_REFUND_REASONS = [
  "payment_failed",
  "duplicate_payment",
  "incorrect_amount",
  "service_not_delivered",
  "user_request",
  "technical_error",
  "fraud_suspected",
  "other",
];

// ==============================================
// PAYU REFUND API
// ==============================================

interface PayURefundResponse {
  status: number;
  msg: string;
  request_id?: string;
  bank_ref_num?: string;
  mihpayid?: string;
  error_code?: string;
}

async function initiatePayURefund(
  mihpayid: string,
  amountRupees: string
): Promise<PayURefundResponse> {
  if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
    throw new ExternalServiceError("PayU", "PayU credentials not configured");
  }

  // Generate hash: sha512(key|command|var1|salt)
  const command = "cancel_refund_transaction";
  const hashString = `${PAYU_MERCHANT_KEY}|${command}|${mihpayid}|${PAYU_MERCHANT_SALT}`;
  const hash = await sha512(hashString);

  // Build form data
  const formData = new URLSearchParams({
    key: PAYU_MERCHANT_KEY,
    command,
    var1: mihpayid,
    var2: crypto.randomUUID(), // Unique token for this refund
    var3: amountRupees, // Refund amount
    hash,
  });

  console.log(`[initiate-refund] Calling PayU refund API for mihpayid: ${mihpayid}, amount: ${amountRupees}`);

  try {
    const response = await fetch(PAYU_REFUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    console.log(`[initiate-refund] PayU response:`, data);

    return data;
  } catch (error) {
    console.error("[initiate-refund] PayU API error:", error);
    throw new ExternalServiceError(
      "PayU",
      error instanceof Error ? error.message : "Failed to call refund API"
    );
  }
}

// ==============================================
// CASHBACK REVERSAL
// ==============================================

async function reverseCashback(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  paymentId: string,
  cashbackEarnedPaise: number,
  cashbackAppliedPaise: number
): Promise<number> {
  let totalReversed = 0;

  // 1. Reverse earned cashback (if any)
  if (cashbackEarnedPaise > 0) {
    // Get current balance
    const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
      p_user_id: userId,
    });

    const newBalance = Math.max((currentBalance ?? 0) - cashbackEarnedPaise, 0);

    await supabase.from("cashback_ledger").insert({
      user_id: userId,
      transaction_type: "reversal",
      amount_paise: cashbackEarnedPaise,
      balance_after_paise: newBalance,
      payment_id: paymentId,
      description: "Cashback reversed due to refund",
    });

    totalReversed += cashbackEarnedPaise;
  }

  // 2. If cashback was applied to this payment, it's already factored into refund amount
  // The user gets back what they paid, which was reduced by cashback
  // We don't re-credit applied cashback as that would be double-dipping

  return totalReversed;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "initiate-refund");

    // Parse and validate request
    const body = await req.json();
    const { payment_id, amount_paise, reason } = validateSchema<InitiateRefundRequest>(
      body,
      requestSchema,
      true
    );

    // Fetch the payment with tenancy info
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *, payment_gateway, gateway_order_id,
        tenancy:tenancies(user_id)
      `)
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      throw new NotFoundError("Payment", payment_id);
    }

    // Verify ownership
    const paymentUserId = (payment.tenancy as { user_id: string } | null)?.user_id;
    if (paymentUserId !== userId) {
      throw new AppError("You don't have permission to refund this payment", "FORBIDDEN", 403);
    }

    // Check payment is in a refundable state
    if (payment.status !== "success") {
      throw new PaymentError(
        `Cannot refund payment with status: ${payment.status}`,
        "INVALID_PAYMENT_STATUS"
      );
    }

    // Check if already refunded
    if (payment.status === "refunded" || payment.refund_amount_paise > 0) {
      throw new PaymentError("Payment has already been refunded", "ALREADY_REFUNDED");
    }

    // Check PayU transaction ID
    if (!payment.payu_mihpayid) {
      throw new PaymentError("Cannot refund: PayU transaction ID not found", "MISSING_PAYU_ID");
    }

    // Determine refund amount
    const maxRefundablePaise = payment.total_amount_paise - (payment.refund_amount_paise || 0);
    const refundAmountPaise = amount_paise ?? maxRefundablePaise;

    if (refundAmountPaise > maxRefundablePaise) {
      throw new ValidationError(
        `Refund amount exceeds maximum refundable: ${maxRefundablePaise} paise`,
        { amount_paise: "Exceeds maximum" }
      );
    }

    // Check for existing pending refund
    const { data: existingRefund } = await supabase
      .from("refunds")
      .select("id, status")
      .eq("payment_id", payment_id)
      .in("status", ["requested", "processing"])
      .maybeSingle();

    if (existingRefund) {
      throw new PaymentError(
        "A refund is already in progress for this payment",
        "REFUND_IN_PROGRESS"
      );
    }

    // Create refund record
    const { data: refund, error: refundError } = await supabase
      .from("refunds")
      .insert({
        payment_id,
        user_id: userId,
        amount_paise: refundAmountPaise,
        reason,
        status: "requested",
        requested_by: userId,
      })
      .select()
      .single();

    if (refundError || !refund) {
      console.error("[initiate-refund] Failed to create refund record:", refundError);
      throw new Error("Failed to create refund record");
    }

    // Convert to rupees for PayU
    const refundAmountRupees = (refundAmountPaise / 100).toFixed(2);

    // Initiate refund via PayU
    let refundResult: { success: boolean; refundId?: string; status: string; message?: string };

    try {
      const payuResponse = await initiatePayURefund(payment.payu_mihpayid, refundAmountRupees);
      const isSuccess = payuResponse.status === 1 || payuResponse.msg?.toLowerCase().includes("success");
      refundResult = {
        success: isSuccess,
        refundId: payuResponse.request_id,
        status: isSuccess ? "processing" : "failed",
        message: payuResponse.msg,
      };
    } catch (payuError) {
      await supabase
        .from("refunds")
        .update({
          status: "failed",
          payu_response: { error: payuError instanceof Error ? payuError.message : "Unknown error" },
        })
        .eq("id", refund.id);
      throw payuError;
    }

    // Process refund result
    const isSuccess = refundResult.success;
    const newStatus = refundResult.status;

    // Update refund record
    await supabase
      .from("refunds")
      .update({
        status: refundResult.status,
        payment_gateway: "payu",
        gateway_refund_id: refundResult.refundId,
        gateway_refund_status: refundResult.status,
        payu_refund_id: refundResult.refundId,
        payu_status: refundResult.message,
        payu_response: refundResult,
        processed_at: refundResult.success ? new Date().toISOString() : null,
        processed_by: "system",
      })
      .eq("id", refund.id);

    // If successful, update payment and reverse cashback
    if (isSuccess) {
      // Update payment record
      await supabase
        .from("payments")
        .update({
          refund_amount_paise: (payment.refund_amount_paise || 0) + refundAmountPaise,
          refund_reason: reason,
          refund_initiated_at: new Date().toISOString(),
          status: refundAmountPaise >= payment.total_amount_paise ? "refunded" : "partially_refunded",
        })
        .eq("id", payment_id);

      // Reverse cashback
      const cashbackReversed = await reverseCashback(
        supabase,
        userId,
        payment_id,
        payment.cashback_earned_paise || 0,
        payment.cashback_applied_paise || 0
      );

      // Update refund with cashback reversal
      await supabase
        .from("refunds")
        .update({ cashback_reversed_paise: cashbackReversed })
        .eq("id", refund.id);
    }

    // Log audit event
    await audit.log({
      action: isSuccess ? AuditActions.PAYMENT_REFUND_INITIATED : "REFUND_INITIATION_FAILED",
      category: "payment",
      entityType: "refund",
      entityId: refund.id,
      details: {
        payment_id,
        refund_amount_paise: refundAmountPaise,
        reason,
        gateway: "payu",
        gateway_response: refundResult,
        cashback_earned_paise: payment.cashback_earned_paise,
      },
      status: isSuccess ? "success" : "failure",
      errorCode: isSuccess ? undefined : "REFUND_FAILED",
      errorMessage: isSuccess ? undefined : refundResult.message,
    });

    // Send notification (queue for async processing)
    if (isSuccess) {
      await supabase.from("notification_queue").insert({
        user_id: userId,
        notification_type: "push",
        payload: {
          title: "Refund Initiated",
          body: `Your refund of Rs. ${(refundAmountPaise / 100).toFixed(0)} has been initiated. It will be credited within 5-7 business days.`,
          data: {
            type: "refund_initiated",
            refund_id: refund.id,
            payment_id,
          },
        },
        status: "pending",
      });
    }

    return jsonResponse({
      success: isSuccess,
      data: {
        refund_id: refund.id,
        payment_id,
        amount_paise: refundAmountPaise,
        status: newStatus,
        gateway: "payu",
        gateway_refund_id: refundResult.refundId,
        message: isSuccess
          ? "Refund initiated successfully. It will be credited within 5-7 business days."
          : `Refund failed: ${refundResult.message}`,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "REFUND_INITIATION_FAILED",
        "payment",
        error instanceof AppError ? error.code : "REFUND_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "refund"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
