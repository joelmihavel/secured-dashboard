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

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const PAYU_BASE_URL = Deno.env.get("PAYU_BASE_URL") ?? "https://sandboxsecure.payu.in";

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
        pg_fee_paise, total_amount_paise, landlord_payout_paise,
        landlord_payout_status, payu_txn_id, payu_mihpayid,
        payu_status, payu_settlement_status, payu_settlement_utr,
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

    // Check if payment is stuck and needs PayU verification
    let payuVerified = false;
    let payuVerifyResult: Record<string, unknown> | null = null;

    const isStuck = ["initiated", "processing"].includes(payment.status);
    const createdAt = new Date(payment.created_at).getTime();
    const ageMs = Date.now() - createdAt;
    const isStale = ageMs > STALE_THRESHOLD_MS;

    if (isStuck && isStale && payment.payu_txn_id) {
      // Call PayU verify_payment API
      try {
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

              // Calculate cashback earned (same formula as webhook)
              const { data: tenancyData } = await supabase
                .from("tenancies")
                .select("monthly_rent_paise")
                .eq("id", payment.tenancy_id)
                .single();

              if (tenancyData) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                const monthlyCap = Math.floor(tenancyData.monthly_rent_paise * 0.01);

                const { data: monthlyEarnings } = await supabase
                  .from("cashback_ledger")
                  .select("amount_paise")
                  .eq("user_id", userId)
                  .eq("transaction_type", "earned")
                  .gte("created_at", startOfMonth.toISOString())
                  .lte("created_at", endOfMonth.toISOString());

                const earnedThisMonth = (monthlyEarnings || []).reduce(
                  (sum: number, e: { amount_paise: number }) => sum + e.amount_paise,
                  0
                );
                const capRemaining = Math.max(0, monthlyCap - earnedThisMonth);
                const cashbackEarned = Math.min(
                  Math.floor(payment.rent_amount_paise * 0.01),
                  capRemaining
                );

                updateData.cashback_earned_paise = cashbackEarned;
                updateData.landlord_payout_status = "pending";
                updateData.landlord_payout_paise = payment.rent_amount_paise;

                // Credit cashback
                if (cashbackEarned > 0) {
                  const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
                    p_user_id: userId,
                  });
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + 90);

                  await supabase.from("cashback_ledger").insert({
                    user_id: userId,
                    transaction_type: "earned",
                    amount_paise: cashbackEarned,
                    balance_after_paise: (currentBalance ?? 0) + cashbackEarned,
                    payment_id: payment.id,
                    tenancy_id: payment.tenancy_id,
                    description: `1% cashback earned on rent payment for ${payment.payment_month}`,
                    expires_at: expiresAt.toISOString(),
                  });
                }
              }
            }

            if (mappedStatus === "failed" && payment.cashback_applied_paise > 0) {
              // Reverse cashback on failure
              await supabase.from("cashback_ledger").insert({
                user_id: userId,
                amount_paise: payment.cashback_applied_paise,
                transaction_type: "reversal",
                reference_type: "payment",
                reference_id: payment.id,
                description: "Cashback reversed due to payment failure (status check)",
              });
            }

            await supabase
              .from("payments")
              .update(updateData)
              .eq("id", payment.id);

            // Update local payment object for response
            payment.status = mappedStatus;
            payment.payu_status = String(payuVerifyResult.status);
            if (mappedStatus === "success") {
              payment.cashback_earned_paise = updateData.cashback_earned_paise as number ?? 0;
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
        total_amount_paise: payment.total_amount_paise,
        landlord_payout_paise: payment.landlord_payout_paise,
        landlord_payout_status: payment.landlord_payout_status ?? null,
        settlement_status: payment.payu_settlement_status ?? null,
        settlement_utr: payment.payu_settlement_utr ?? null,
        payment_method: payment.payment_method,
        payment_month: payment.payment_month,
        created_at: payment.created_at,
        paid_at: payment.paid_at,
        payu_verified: payuVerified,
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

  const PAYU_INFO_URL = Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice";
  const response = await fetch(PAYU_INFO_URL, {
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
