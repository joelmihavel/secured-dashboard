/**
 * Flent Secured v2 - Abandon Payment Edge Function
 *
 * Lets the client explicitly abandon a stuck payment. Verifies with the
 * payment gateway before marking as failed, to avoid losing payments
 * that actually succeeded on the gateway side.
 *
 * Endpoint: POST /functions/v1/abandon-payment
 * Body: { payment_id: string }
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
  NotFoundError,
  PaymentError,
  handleError,
} from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { sha512 } from "../_shared/crypto.ts";
import {
  PAYU_MERCHANT_KEY,
  PAYU_MERCHANT_SALT,
  PAYU_INFO_URL,
  fetchWithTimeout,
} from "../_shared/payu-config.ts";
import { getOrderPaymentStatus, CashfreeError } from "../_shared/cashfree-pg-vendors.ts";

// PayU status mapping (same as check-payment-status / payment-webhook)
const PAYU_STATUS_MAP: Record<string, string> = {
  success: "success",
  captured: "success",
  pending: "processing",
  initiated: "processing",
  inprogress: "processing",
  in_progress: "processing",
  on_hold: "processing",
  authorized: "processing",
  failure: "failed",
  failed: "failed",
  usercancelled: "failed",
  user_cancelled: "failed",
  dropped: "failed",
  bounced: "failed",
  timeout: "failed",
  not_initiated: "failed",
  expired: "failed",
  rejected: "failed",
  cancelled: "failed",
};

// Terminal statuses — no action needed if payment is already in one of these
const TERMINAL_STATUSES = ["success", "failed", "refunded", "expired"];

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

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = AuditLogger.fromRequest(supabase, req, userId, "abandon-payment");

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const paymentId = body.payment_id;

    if (!paymentId || typeof paymentId !== "string") {
      return errorResponse("payment_id is required", 400, "MISSING_PARAM");
    }

    // Fetch payment with tenancy details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        id, tenancy_id, user_id, status, rent_amount_paise,
        cashback_applied_paise, cashback_earned_paise,
        accumulated_redeemed_paise,
        pg_fee_paise, convenience_fee_paise, fee_billing_model,
        total_amount_paise, landlord_payout_paise,
        landlord_payout_status, payu_txn_id, payu_mihpayid,
        payu_status,
        payment_gateway, gateway_order_id, gateway_payment_id, gateway_status,
        cf_order_id,
        payment_method, payment_month, created_at, paid_at,
        tenancy:tenancies(user_id)
      `)
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new NotFoundError("Payment", paymentId);
    }

    // Verify ownership
    const tenancyUserId = (payment.tenancy as { user_id: string } | null)?.user_id;
    if (tenancyUserId !== userId && payment.user_id !== userId) {
      throw new AppError("You don't have permission to abandon this payment", "FORBIDDEN", 403);
    }

    // If already terminal, return current status — nothing to do
    if (TERMINAL_STATUSES.includes(payment.status)) {
      return jsonResponse({
        success: true,
        data: {
          payment_id: payment.id,
          status: payment.status,
          abandoned: false,
          gateway_verified: false,
          message: `Payment is already ${payment.status}`,
        },
      });
    }

    // Payment is in initiated/processing — verify with gateway then abandon
    let gatewayVerified = false;
    let finalStatus = "failed"; // Default: mark as failed (user explicitly abandoned)

    const isCashfree = payment.payment_gateway === "cashfree";
    const cfOrderId = payment.cf_order_id ?? payment.gateway_order_id;

    // ── Cashfree verification path ──
    if (isCashfree && cfOrderId) {
      try {
        const orderStatus = await getOrderPaymentStatus(cfOrderId);
        gatewayVerified = true;

        if (orderStatus.order_status === "PAID") {
          finalStatus = "success";
        } else {
          // ACTIVE, EXPIRED, TERMINATED, TERMINATION_REQUESTED — all become failed
          finalStatus = "failed";
        }
      } catch (verifyError) {
        console.error("Cashfree verify failed during abandon:", verifyError instanceof CashfreeError
          ? `HTTP ${verifyError.statusCode}: ${verifyError.message}`
          : verifyError);
        // Verification error — user explicitly asked to abandon, mark as failed
        finalStatus = "failed";
      }
    }
    // ── PayU verification path ──
    else if (payment.payu_txn_id && !isCashfree) {
      try {
        const payuResult = await verifyWithPayU(payment.payu_txn_id);
        gatewayVerified = true;

        if (payuResult && payuResult.status) {
          const payuStatus = String(payuResult.status).toLowerCase();
          const mappedStatus = PAYU_STATUS_MAP[payuStatus] ?? "failed";

          if (mappedStatus === "success") {
            finalStatus = "success";
          } else {
            finalStatus = "failed";
          }
        }
      } catch (verifyError) {
        console.error("PayU verify failed during abandon:", verifyError);
        // Verification error — user explicitly asked to abandon, mark as failed
        finalStatus = "failed";
      }
    }
    // ── No gateway IDs — just mark as failed ──

    // Build update data
    const updateData: Record<string, unknown> = { status: finalStatus };

    if (finalStatus === "success") {
      updateData.paid_at = new Date().toISOString();
      updateData.landlord_payout_status = "ready";
      updateData.landlord_payout_paise = payment.rent_amount_paise;
    } else {
      updateData.error_message = `Payment abandoned by user (gateway_verified: ${gatewayVerified})`;
    }

    // Optimistic lock: only update if status hasn't changed since we read it
    const { data: lockResult } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id)
      .eq("status", payment.status)
      .select("id")
      .maybeSingle();

    if (!lockResult) {
      // Status changed between read and update — re-fetch and return current
      const { data: refreshed } = await supabase
        .from("payments")
        .select("id, status")
        .eq("id", payment.id)
        .single();

      return jsonResponse({
        success: true,
        data: {
          payment_id: payment.id,
          status: refreshed?.status ?? payment.status,
          abandoned: false,
          gateway_verified: gatewayVerified,
          message: "Payment status changed concurrently",
        },
      });
    }

    // If we discovered the payment actually succeeded, mirror the
    // live-webhook ledger shape: split cashback_applied_paise into
    // 'discount' (1%) and 'flat_bonus' rows. The partial unique indexes
    // on cashback_ledger (payment_id, transaction_type) make these inserts
    // idempotent against a webhook that fires concurrently.
    if (finalStatus === "success" && payment.cashback_applied_paise > 0) {
      const flatBonusPaise = (payment as Record<string, any>).flat_bonus_paise ?? 0;
      const onePctPaise = payment.cashback_applied_paise - flatBonusPaise;

      if (onePctPaise > 0) {
        try {
          await supabase.from("cashback_ledger").insert({
            user_id: userId,
            transaction_type: "discount",
            amount_paise: onePctPaise,
            balance_after_paise: 0,
            payment_id: payment.id,
            tenancy_id: payment.tenancy_id,
            reference_type: "payment",
            reference_id: payment.id,
            description: "1% instant discount on rent payment (abandon-verify)",
          });
        } catch (e) {
          console.error("Failed to log discount on abandon-verify:", e);
        }
      }

      if (flatBonusPaise > 0) {
        try {
          await supabase.from("cashback_ledger").insert({
            user_id: userId,
            transaction_type: "flat_bonus",
            amount_paise: flatBonusPaise,
            balance_after_paise: 0,
            payment_id: payment.id,
            tenancy_id: payment.tenancy_id,
            reference_type: "payment",
            reference_id: payment.id,
            description: "Flat cashback (promo) (abandon-verify)",
          });
        } catch (e) {
          console.error("Failed to log flat bonus on abandon-verify:", e);
        }
      }
    }

    // Audit log
    await audit.logSuccess(
      "PAYMENT_ABANDONED",
      "payment",
      "payment",
      payment.id,
      {
        old_status: payment.status,
        new_status: finalStatus,
        gateway_verified: gatewayVerified,
        source: isCashfree && cfOrderId
          ? "cashfree_verify"
          : payment.payu_txn_id
            ? "payu_verify"
            : "no_gateway",
      }
    );

    return jsonResponse({
      success: true,
      data: {
        payment_id: payment.id,
        status: finalStatus,
        abandoned: true,
        gateway_verified: gatewayVerified,
      },
    });
  } catch (error) {
    console.error("Abandon payment error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// PAYU VERIFY PAYMENT API
// ==============================================

/**
 * Calls PayU verify_payment API to check transaction status.
 * Hash formula: sha512(key|command|var1|salt)
 */
async function verifyWithPayU(txnId: string): Promise<Record<string, unknown>> {
  const command = "verify_payment";
  const hashString = `${PAYU_MERCHANT_KEY}|${command}|${txnId}|${PAYU_MERCHANT_SALT}`;
  const hash = await sha512(hashString);

  const formData = new URLSearchParams();
  formData.set("key", PAYU_MERCHANT_KEY);
  formData.set("command", command);
  formData.set("var1", txnId);
  formData.set("hash", hash);

  const response = await fetchWithTimeout(PAYU_INFO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`PayU verify_payment returned ${response.status}`);
  }

  const result = await response.json();

  // PayU returns { status: 1, msg: "...", transaction_details: { txnId: { ... } } }
  if (result.status === 1 && result.transaction_details) {
    const txnDetails = result.transaction_details[txnId];
    if (txnDetails) {
      return txnDetails;
    }
  }

  console.warn("PayU verify_payment unexpected response:", JSON.stringify(result).slice(0, 500));
  return {};
}
