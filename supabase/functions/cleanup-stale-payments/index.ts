/**
 * Flent Secured v2 - Cleanup Stale Payments Edge Function
 *
 * Reconciles payments that reached PayU but never received a webhook.
 * Calls PayU verify_payment API to get the real status, then updates
 * our DB accordingly (same logic as check-payment-status reconciliation).
 *
 * The SQL cron `expire_stale_payments()` handles abandoned payments
 * (payu_mihpayid IS NULL) every minute. This function handles the
 * other case: payments that DID reach PayU but are stuck in
 * initiated/processing because the webhook was lost.
 *
 * Endpoint: POST /functions/v1/cleanup-stale-payments
 * Auth: Service role JWT or x-admin-key header
 * Schedule: Every 30 minutes via pg_cron
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, hasServiceRoleAuth } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { sha512 } from "../_shared/crypto.ts";
import { getOrderPaymentStatus } from "../_shared/cashfree-pg-vendors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;

// Only reconcile payments older than 10 minutes (give webhook time to arrive)
const STALE_THRESHOLD_MINUTES = 10;
const BATCH_SIZE = 20;

// PayU status mapping (same as payment-webhook and check-payment-status)
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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  try {
    // Verify caller: accept either admin key or service_role JWT (for pg_cron)
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    const authHeader = req.headers.get("Authorization");

    const isAdminKey = expectedKey && adminKey === expectedKey;
    const isServiceRole = hasServiceRoleAuth(authHeader);

    if (!isAdminKey && !isServiceRole) {
      return errorResponse("Unauthorized", 401);
    }

    const cutoff = new Date(
      Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
    ).toISOString();

    // Find payments that reached PayU (have payu_txn_id) but are stuck
    // in initiated/processing without a webhook response
    const { data: stalePayments, error } = await supabase
      .from("payments")
      .select(
        "id, user_id, tenancy_id, payu_txn_id, status, " +
        "rent_amount_paise, cashback_applied_paise, cashback_earned_paise, " +
        "accumulated_redeemed_paise, created_at",
      )
      .in("status", ["initiated", "processing"])
      .lt("created_at", cutoff)
      .not("payu_txn_id", "is", null)
      .neq("payment_gateway", "demo")
      .limit(BATCH_SIZE);

    if (error) {
      throw error;
    }

    let reconciled = 0;
    let stillProcessing = 0;
    let verifyFailed = 0;

    for (const payment of stalePayments ?? []) {
      if (!payment.payu_txn_id) continue;

      try {
        const payuResult = await verifyWithPayU(payment.payu_txn_id);

        if (!payuResult.status) {
          // PayU has no record — will be caught by SQL cron if mihpayid is null
          verifyFailed++;
          continue;
        }

        const payuStatus = String(payuResult.status).toLowerCase();
        const mappedStatus = PAYU_STATUS_MAP[payuStatus] ?? "failed";

        // Only act on terminal states
        if (!["success", "failed"].includes(mappedStatus)) {
          stillProcessing++;
          continue;
        }

        // Skip if already in the target status
        if (mappedStatus === payment.status) continue;

        // Build update
        const updateData: Record<string, unknown> = {
          status: mappedStatus,
          payu_status: payuResult.status,
          payu_mihpayid: payuResult.mihpayid ?? null,
        };

        if (mappedStatus === "success") {
          updateData.paid_at = new Date().toISOString();
          updateData.landlord_payout_status = "ready";
          updateData.landlord_payout_paise = payment.rent_amount_paise;
        }

        // Optimistic lock: only update if status hasn't changed
        const { data: lockResult } = await supabase
          .from("payments")
          .update(updateData)
          .eq("id", payment.id)
          .eq("status", payment.status)
          .select("id")
          .maybeSingle();

        if (lockResult) {
          reconciled++;

          // Handle cashback ledger entries on success (same as webhook/check-payment-status)
          if (mappedStatus === "success" && payment.user_id) {
            await handleCashbackOnSuccess(supabase, payment);
          }
        }
      } catch (e) {
        console.error(
          `Failed to verify payment ${payment.id}:`,
          e instanceof Error ? e.message : e,
        );
        verifyFailed++;
      }
    }

    // ==============================================
    // CASHFREE STALE PAYMENTS — same cutoff, different identifier
    // ==============================================

    const { data: cfStalePayments } = await supabase
      .from("payments")
      .select(
        "id, user_id, tenancy_id, cf_order_id, status, " +
        "rent_amount_paise, cashback_applied_paise, cashback_earned_paise, " +
        "accumulated_redeemed_paise, created_at",
      )
      .not("cf_order_id", "is", null)
      .in("status", ["initiated", "processing"])
      .lt("created_at", cutoff)
      .limit(BATCH_SIZE);

    let cfReconciled = 0;
    let cfStillProcessing = 0;
    let cfVerifyFailed = 0;

    for (const payment of cfStalePayments ?? []) {
      if (!payment.cf_order_id) continue;

      try {
        const cfResult = await getOrderPaymentStatus(payment.cf_order_id);
        const orderStatus = (cfResult.order_status ?? "").toUpperCase();

        // PAID → success, EXPIRED/TERMINATED → failed, anything else → still processing
        let mappedStatus: string;
        if (orderStatus === "PAID") {
          mappedStatus = "success";
        } else if (["EXPIRED", "TERMINATED"].includes(orderStatus)) {
          mappedStatus = "failed";
        } else {
          cfStillProcessing++;
          continue;
        }

        // Skip if already in the target status
        if (mappedStatus === payment.status) continue;

        const updateData: Record<string, unknown> = {
          status: mappedStatus,
          gateway_status: orderStatus,
        };

        if (mappedStatus === "success") {
          updateData.paid_at = new Date().toISOString();
          updateData.landlord_payout_status = "ready";
          updateData.landlord_payout_paise = payment.rent_amount_paise;
        }

        // Optimistic lock: only update if status hasn't changed
        const { data: lockResult } = await supabase
          .from("payments")
          .update(updateData)
          .eq("id", payment.id)
          .eq("status", payment.status)
          .select("id")
          .maybeSingle();

        if (lockResult) {
          cfReconciled++;

          // Handle cashback ledger entries on success
          if (mappedStatus === "success" && payment.user_id) {
            await handleCashbackOnSuccess(supabase, payment);
          }
        }
      } catch (e) {
        console.error(
          `Failed to verify Cashfree payment ${payment.id}:`,
          e instanceof Error ? e.message : e,
        );
        cfVerifyFailed++;
      }
    }

    const totalChecked = (stalePayments?.length ?? 0) + (cfStalePayments?.length ?? 0);
    const totalReconciled = reconciled + cfReconciled;
    const totalProcessing = stillProcessing + cfStillProcessing;
    const totalVerifyFailed = verifyFailed + cfVerifyFailed;

    console.log(
      `cleanup-stale-payments: checked=${totalChecked} ` +
      `reconciled=${totalReconciled} processing=${totalProcessing} failed=${totalVerifyFailed} ` +
      `(payu: ${stalePayments?.length ?? 0} checked, ${reconciled} reconciled | ` +
      `cashfree: ${cfStalePayments?.length ?? 0} checked, ${cfReconciled} reconciled)`,
    );

    return jsonResponse({
      success: true,
      data: {
        reconciled: totalReconciled,
        still_processing: totalProcessing,
        verify_failed: totalVerifyFailed,
        total_checked: totalChecked,
        payu: {
          checked: stalePayments?.length ?? 0,
          reconciled,
          still_processing: stillProcessing,
          verify_failed: verifyFailed,
        },
        cashfree: {
          checked: cfStalePayments?.length ?? 0,
          reconciled: cfReconciled,
          still_processing: cfStillProcessing,
          verify_failed: cfVerifyFailed,
        },
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// CASHBACK HANDLING
// ==============================================

interface PaymentRecord {
  id: string;
  user_id: string;
  tenancy_id: string;
  cashback_applied_paise: number;
  cashback_earned_paise: number;
  accumulated_redeemed_paise: number;
}

async function handleCashbackOnSuccess(
  supabase: ReturnType<typeof createServiceClient>,
  payment: PaymentRecord,
): Promise<void> {
  const userId = payment.user_id;

  // PATH A: Verified — log instant discount
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
    } catch (e) {
      console.error("Failed to log cashback discount on reconciliation:", e);
    }
  }

  // PATH A2: Debit accumulated cashback redeemed (independent of instant discount)
  const accumulatedUsed = payment.accumulated_redeemed_paise ?? 0;
  if (accumulatedUsed > 0) {
    try {
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
    } catch (e) {
      console.error("Failed to debit accumulated cashback on reconciliation:", e);
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
      // sync_cashback_balance trigger on cashback_ledger handles users.cashback_balance_paise
    } catch (e) {
      console.error("Failed to credit earned cashback on reconciliation:", e);
    }
  }
}

// ==============================================
// PAYU VERIFY
// ==============================================

async function verifyWithPayU(
  txnId: string,
): Promise<Record<string, unknown>> {
  const command = "verify_payment";
  const hashString = `${PAYU_MERCHANT_KEY}|${command}|${txnId}|${PAYU_MERCHANT_SALT}`;
  const hash = await sha512(hashString);

  const formData = new URLSearchParams();
  formData.set("key", PAYU_MERCHANT_KEY);
  formData.set("command", command);
  formData.set("var1", txnId);
  formData.set("hash", hash);

  const PAYU_INFO_URL =
    Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice";
  const response = await fetch(PAYU_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  if (!response.ok) throw new Error(`PayU returned ${response.status}`);
  const result = await response.json();

  if (result.status === 1 && result.transaction_details) {
    return result.transaction_details[txnId] ?? {};
  }
  return {};
}
