/**
 * Flent Secured v2 - Poll Settlement Status Edge Function
 *
 * Cron job (every 30 min) that:
 *   1. RELEASE: Converts system-held payments to 'pending' when flag re-enabled
 *   2. RECONCILIATION: Resolves stuck initiated/processing Cashfree payments
 *      by calling getOrderPaymentStatus() on each
 *   3. MONITORING: Alerts ops if any landlord_payout_status='pending'/'processing'
 *      payments are older than 24h
 *
 * Tier 1 (PayU → Flent settlement tracking) is removed — Cashfree Easy Split
 * on-demand transfer handles landlord settlement via settle-to-landlord cron.
 *
 * Endpoint: POST /functions/v1/poll-settlement-status
 * Auth: Service role only (called by pg_cron every 30 min)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { getSystemTransferFlag, type SystemTransferFlag } from "../_shared/transfer-flags.ts";
import { getOrderPaymentStatus, CashfreeError } from "../_shared/cashfree-easysplit.ts";

const BATCH_SIZE = 50;
const STUCK_THRESHOLD_MINUTES = 15;
const PAYOUT_ALERT_HOURS = 24;

interface TierResult {
  checked: number;
  updated: number;
  errors: number;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    verifyServiceRole(req.headers.get("Authorization"));

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "poll-settlement-status",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const startTime = Date.now();
    const systemConfig = await getSystemTransferFlag(supabase);

    const releaseResult = await releaseHeldPayments(supabase, audit, systemConfig);
    const [reconciliationResult, monitoringResult] = await Promise.all([
      reconcileStuckPayments(supabase, audit),
      monitorPendingPayouts(supabase, audit),
    ]);

    const durationMs = Date.now() - startTime;

    await audit.logSuccess(
      "SETTLEMENT_POLL_COMPLETED",
      "system",
      undefined,
      undefined,
      { duration_ms: durationMs, released: releaseResult, reconciliation: reconciliationResult, monitoring: monitoringResult },
    );

    return jsonResponse({
      success: true,
      data: {
        duration_ms: durationMs,
        released_held_payments: releaseResult,
        reconciliation: reconciliationResult,
        monitoring: monitoringResult,
      },
    });
  } catch (error) {
    console.error("[poll-settlement-status] Error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// RELEASE: Convert system-held payments back to 'pending'
// ==============================================

async function releaseHeldPayments(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  systemConfig: SystemTransferFlag,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  if (!systemConfig.enabled) return result;

  try {
    const { data: heldPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("landlord_payout_status", "held")
      .eq("transfer_hold", false)
      .limit(BATCH_SIZE);

    if (!heldPayments?.length) return result;

    result.checked = heldPayments.length;

    for (const payment of heldPayments) {
      try {
        await supabase
          .from("payments")
          .update({ landlord_payout_status: "pending" })
          .eq("id", payment.id)
          .eq("landlord_payout_status", "held");
        result.updated++;
      } catch (err) {
        console.error(`[release] Failed for payment ${payment.id}:`, err);
        result.errors++;
      }
    }

    if (result.updated > 0) {
      await audit.logSuccess("HELD_PAYMENTS_RELEASED", "payment", undefined, undefined, {
        released_count: result.updated,
      });
      console.log(`[release] Released ${result.updated} system-held payments to 'pending'`);
    }
  } catch (err) {
    console.error("[release] Error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// RECONCILIATION: Stuck Cashfree Payments
// ==============================================

/**
 * Resolves payments stuck in initiated/processing state for > 15 minutes.
 * Calls Cashfree getOrderPaymentStatus() to check actual state.
 */
async function reconcileStuckPayments(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: stuckPayments } = await supabase
      .from("payments")
      .select("id, user_id, tenancy_id, cf_order_id, gateway_order_id, status, rent_amount_paise, cashback_applied_paise, payment_month, created_at")
      .in("status", ["initiated", "processing"])
      .eq("payment_gateway", "cashfree")
      .lt("created_at", stuckThreshold)
      .not("cf_order_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!stuckPayments?.length) return result;

    result.checked = stuckPayments.length;
    console.log(`[reconciliation] Found ${stuckPayments.length} stuck Cashfree payments older than ${STUCK_THRESHOLD_MINUTES} min`);

    for (const payment of stuckPayments) {
      try {
        const cfOrderId = payment.cf_order_id ?? payment.gateway_order_id;
        if (!cfOrderId) continue;

        const orderStatus = await getOrderPaymentStatus(cfOrderId);

        let newStatus: string | null = null;
        if (orderStatus.order_status === "PAID") {
          newStatus = "success";
        } else if (orderStatus.order_status === "EXPIRED" || orderStatus.order_status === "TERMINATED" || orderStatus.order_status === "TERMINATION_REQUESTED") {
          newStatus = "failed";
        } else {
          // ACTIVE = still pending — leave as-is
          continue;
        }

        if (newStatus === payment.status) continue;

        const updateData: Record<string, unknown> = { status: newStatus };

        if (newStatus === "success") {
          updateData.paid_at = new Date().toISOString();
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

        if (!lockResult) {
          console.warn(`[reconciliation] Optimistic lock failed for payment ${payment.id}`);
          continue;
        }

        result.updated++;

        await audit.logSuccess(
          "PAYMENT_RECONCILED",
          "payment",
          "payment",
          payment.id,
          { old_status: payment.status, new_status: newStatus, cf_order_id: cfOrderId },
        );

        console.log(`[reconciliation] Payment ${payment.id}: ${payment.status} → ${newStatus}`);
      } catch (err) {
        const msg = err instanceof CashfreeError
          ? `HTTP ${(err as CashfreeError).statusCode}: ${err.message}`
          : (err as Error).message;
        console.error(`[reconciliation] Failed to reconcile payment ${payment.id}:`, msg);
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[reconciliation] Error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// MONITORING: Stale pending/processing payouts
// ==============================================

/**
 * Alerts ops if any landlord_payout_status=pending/processing payments
 * are older than 24 hours (indicates a stuck settlement pipeline).
 */
async function monitorPendingPayouts(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<{ stale_count: number; total_paise: number }> {
  try {
    const alertThreshold = new Date(Date.now() - PAYOUT_ALERT_HOURS * 60 * 60 * 1000).toISOString();

    const { data: stalePayouts } = await supabase
      .from("payments")
      .select("id, rent_amount_paise, landlord_payout_paise, paid_at, landlord_payout_status")
      .eq("status", "success")
      .in("landlord_payout_status", ["pending", "processing"])
      .lt("paid_at", alertThreshold)
      .limit(BATCH_SIZE);

    if (!stalePayouts?.length) return { stale_count: 0, total_paise: 0 };

    const totalPaise = stalePayouts.reduce(
      (sum, p) => sum + (p.landlord_payout_paise ?? p.rent_amount_paise),
      0,
    );

    console.error(
      `[OPS_ALERT] ${stalePayouts.length} landlord payout(s) pending/processing for > ${PAYOUT_ALERT_HOURS}h` +
      ` (₹${(totalPaise / 100).toFixed(2)} total)`,
    );

    await audit.logSuccess(
      "STALE_PAYOUTS_DETECTED",
      "payment",
      undefined,
      undefined,
      { stale_count: stalePayouts.length, total_paise: totalPaise, payment_ids: stalePayouts.map((p) => p.id) },
    );

    return { stale_count: stalePayouts.length, total_paise: totalPaise };
  } catch (err) {
    console.error("[monitoring] Error:", err);
    return { stale_count: 0, total_paise: 0 };
  }
}
