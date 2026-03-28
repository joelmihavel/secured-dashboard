/**
 * Flent Secured v2 - Check Payment Status Edge Function
 *
 * Checks the current status of a payment. If the payment is stuck in
 * initiated/processing state for > 2 minutes, verifies with PayU directly.
 *
 * Endpoint: GET /functions/v1/check-payment-status?payment_id=xxx
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
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sha512 } from "../_shared/crypto.ts";
import {
  PAYU_MERCHANT_KEY,
  PAYU_MERCHANT_SALT,
  PAYU_INFO_URL,
  fetchWithTimeout,
} from "../_shared/payu-config.ts";

// How old a payment must be (in ms) before we check PayU directly
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

// PayU status mapping (same as payment-webhook)
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

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const audit = AuditLogger.fromRequest(supabase, req, userId, "check-payment-status");

    // Parse query params
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");

    if (!paymentId) {
      return errorResponse("payment_id query parameter is required", 400, "MISSING_PARAM");
    }

    // Fetch payment with tenancy details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        id, tenancy_id, user_id, status, rent_amount_paise,
        cashback_applied_paise, cashback_earned_paise,
        pg_fee_paise, convenience_fee_paise, fee_billing_model,
        total_amount_paise, landlord_payout_paise,
        landlord_payout_status, payu_txn_id, payu_mihpayid,
        payu_status, payu_settlement_status, payu_settlement_utr,
        payment_gateway, gateway_order_id, gateway_payment_id, gateway_status,
        gateway_settlement_status, gateway_settlement_utr,
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
      throw new AppError("You don't have permission to view this payment", "FORBIDDEN", 403);
    }

    // Check if payment is stuck and needs gateway verification
    let payuVerified = false;
    let payuVerifyResult: Record<string, unknown> | null = null;

    const isStuck = ["initiated", "processing"].includes(payment.status);
    const createdAt = new Date(payment.created_at).getTime();
    const ageMs = Date.now() - createdAt;
    const isStale = ageMs > STALE_THRESHOLD_MS;

    const isDemoPayment = payment.payment_gateway === "demo";

    if (isStuck && isStale && payment.payu_txn_id && !isDemoPayment) {
      try {
        // PayU verification path
        payuVerifyResult = await verifyWithPayU(payment.payu_txn_id);
        payuVerified = true;

        if (payuVerifyResult && payuVerifyResult.status) {
          const payuStatus = String(payuVerifyResult.status).toLowerCase();
          const mappedStatus = PAYU_STATUS_MAP[payuStatus] ?? "failed";

          // If PayU shows a terminal state but our DB doesn't, update
          if (mappedStatus !== payment.status && ["success", "failed"].includes(mappedStatus)) {
            const updateData: Record<string, unknown> = {
              status: mappedStatus,
              payu_status: payuVerifyResult.status,
              payu_mihpayid: payuVerifyResult.mihpayid ?? payment.payu_mihpayid,
            };

            if (mappedStatus === "success") {
              updateData.paid_at = new Date().toISOString();
              // cashback_earned_paise already set at initiation (>0 for unverified, 0 for verified)
              updateData.landlord_payout_status = "pending";
              updateData.landlord_payout_paise = payment.rent_amount_paise;
            }

            const { data: lockResult } = await supabase
              .from("payments")
              .update(updateData)
              .eq("id", payment.id)
              .eq("status", payment.status)
              .select("id")
              .maybeSingle();

            if (lockResult && mappedStatus === "success") {
              // PATH A: Verified — log instant discount + debit accumulated
              if (payment.cashback_applied_paise > 0) {
                try {
                  await supabase.from("cashback_ledger").insert({
                    user_id: userId,
                    transaction_type: "discount",
                    amount_paise: payment.cashback_applied_paise,
                    balance_after_paise: 0,
                    payment_id: payment.id,
                    tenancy_id: payment.tenancy_id,
                    reference_type: "payment",
                    reference_id: payment.id,
                    description: "1% instant discount on rent payment (reconciliation)",
                  });
                  const accumulatedUsed = payment.accumulated_redeemed_paise ?? 0;
                  if (accumulatedUsed > 0) {
                    await supabase.from("cashback_ledger").insert({
                      user_id: userId,
                      transaction_type: "applied",
                      amount_paise: accumulatedUsed,
                      balance_after_paise: 0,
                      payment_id: payment.id,
                      tenancy_id: payment.tenancy_id,
                      reference_type: "payment",
                      reference_id: payment.id,
                      description: "Accumulated cashback redeemed (reconciliation)",
                    });
                    await supabase.rpc("decrement_cashback_balance", {
                      p_user_id: userId,
                      p_amount: accumulatedUsed,
                    });
                  }
                } catch (e) {
                  console.error("Failed to log cashback discount on reconciliation:", e);
                }
              }

              // PATH B: Unverified — credit earned cashback to balance
              if (payment.cashback_earned_paise > 0) {
                try {
                  await supabase.from("cashback_ledger").insert({
                    user_id: userId,
                    transaction_type: "earned",
                    amount_paise: payment.cashback_earned_paise,
                    balance_after_paise: 0,
                    payment_id: payment.id,
                    tenancy_id: payment.tenancy_id,
                    reference_type: "payment",
                    reference_id: payment.id,
                    description: "1% cashback earned (reconciliation)",
                  });
                  await supabase.rpc("increment_cashback_balance", {
                    p_user_id: userId,
                    p_amount: payment.cashback_earned_paise,
                  });
                } catch (e) {
                  console.error("Failed to credit earned cashback on reconciliation:", e);
                }
              }
            }

            // Update local payment object for response
            payment.status = mappedStatus;
            payment.payu_status = String(payuVerifyResult.status);
            if (mappedStatus === "success") {
              payment.landlord_payout_status = "pending";
            }

            await audit.logSuccess(
              "PAYMENT_STATUS_RECONCILED",
              "payment",
              "payment",
              payment.id,
              {
                old_status: "initiated/processing",
                new_status: mappedStatus,
                source: "payu_verify",
              }
            );

            // Note: Reconciliation to "success" means the user's payment went through,
            // NOT that the landlord has been paid. settlement_complete notification
            // fires when landlord payout is manually confirmed via admin endpoint.
          }
        }
      } catch (verifyError) {
        console.error("PayU verify_payment failed:", verifyError);
        // Non-fatal — return DB status
      }
    }

    return jsonResponse({
      success: true,
      data: {
        payment_id: payment.id,
        status: payment.status,
        rent_amount_paise: payment.rent_amount_paise,
        cashback_applied_paise: payment.cashback_applied_paise ?? 0,
        cashback_earned_paise: payment.cashback_earned_paise ?? 0,
        pg_fee_paise: payment.pg_fee_paise ?? 0,
        convenience_fee_paise: payment.convenience_fee_paise ?? 0,
        fee_billing_model: payment.fee_billing_model ?? "pg_billed",
        total_amount_paise: payment.total_amount_paise,
        landlord_payout_paise: payment.landlord_payout_paise,
        landlord_payout_status: payment.landlord_payout_status ?? null,
        settlement_status: payment.gateway_settlement_status ?? payment.payu_settlement_status ?? null,
        settlement_utr: payment.gateway_settlement_utr ?? payment.payu_settlement_utr ?? null,
        payment_method: payment.payment_method,
        payment_month: payment.payment_month,
        created_at: payment.created_at,
        paid_at: payment.paid_at,
        gateway_verified: payuVerified,
        payu_verified: payuVerified, // backward compat
      },
    });
  } catch (error) {
    console.error("Check payment status error:", error);
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

