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
 * Tier 1 (PayU → Flent settlement tracking) is removed — Cashfree vendor
 * adjustment + on-demand transfer handles landlord settlement via
 * settle-to-landlord cron (createAdjustment then native vendor schedule).
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
import { getOrderPaymentStatus, createRefund, getVendorRecon, CashfreeError } from "../_shared/cashfree-pg-vendors.ts";
import { notifyUser } from "../_shared/notifications.ts";
import { getSupabaseUrl } from "../_shared/supabase.ts";

const BATCH_SIZE = 50;
const STUCK_THRESHOLD_MINUTES = 15;
const PAYOUT_ALERT_HOURS = 24;
const REFUND_THRESHOLD_HOURS = 36;

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
    const stuckPendingResult = await recoverStuckPendingPayouts(supabase, audit);
    const [reconciliationResult, monitoringResult, refundResult, vendorReconResult] = await Promise.all([
      reconcileStuckPayments(supabase, audit),
      monitorPendingPayouts(supabase, audit),
      checkRefundEligibility(supabase, audit),
      reconcileVendorSettlements(supabase, audit),
    ]);

    const durationMs = Date.now() - startTime;

    await audit.logSuccess(
      "SETTLEMENT_POLL_COMPLETED",
      "system",
      undefined,
      undefined,
      { duration_ms: durationMs, released: releaseResult, stuck_pending: stuckPendingResult, reconciliation: reconciliationResult, monitoring: monitoringResult, refunds: refundResult, vendor_recon: vendorReconResult },
    );

    return jsonResponse({
      success: true,
      data: {
        duration_ms: durationMs,
        released_held_payments: releaseResult,
        stuck_pending_recovered: stuckPendingResult,
        reconciliation: reconciliationResult,
        monitoring: monitoringResult,
        refunds: refundResult,
        vendor_recon: vendorReconResult,
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
          .update({ landlord_payout_status: "ready" })
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
// SAFETY NET: Recover stuck pending payouts
// ==============================================

/**
 * Payments where status='success' but landlord_payout_status='pending'
 * are stuck — the webhook set success but failed to set 'ready'.
 * This safety net catches them after 30 minutes and transitions to 'ready'.
 */
async function recoverStuckPendingPayouts(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    const { data: stuckPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("status", "success")
      .eq("landlord_payout_status", "pending")
      .eq("transfer_hold", false)
      .lt("paid_at", new Date(Date.now() - 30 * 60_000).toISOString())
      .limit(BATCH_SIZE);

    if (!stuckPayments?.length) return result;

    result.checked = stuckPayments.length;
    console.warn(`[stuck-pending] Found ${stuckPayments.length} stuck payments (success + pending > 30min)`);

    for (const payment of stuckPayments) {
      try {
        const { data: updated } = await supabase
          .from("payments")
          .update({ landlord_payout_status: "ready" })
          .eq("id", payment.id)
          .eq("landlord_payout_status", "pending")
          .select("id")
          .maybeSingle();

        if (updated) {
          result.updated++;
          console.log(`[stuck-pending] Recovered payment ${payment.id} → ready`);
        }
      } catch (err) {
        console.error(`[stuck-pending] Failed for payment ${payment.id}:`, err);
        result.errors++;
      }
    }

    if (result.updated > 0) {
      await audit.logSuccess("STUCK_PENDING_RECOVERED", "payment", undefined, undefined, {
        recovered_count: result.updated,
      });
      console.error(`[OPS_ALERT] ${result.updated} payment(s) were stuck in success+pending — auto-recovered to ready`);
    }
  } catch (err) {
    console.error("[stuck-pending] Error:", err);
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
      .select("id, user_id, tenancy_id, cf_order_id, gateway_order_id, status, payment_gateway, rent_amount_paise, cashback_applied_paise, payment_month, created_at")
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
          updateData.landlord_payout_status = "ready"; // Both PayU and Cashfree — settle-to-landlord queries "ready"
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
// VENDOR RECON: Backup for missed split webhooks
// ==============================================

/**
 * Polls Cashfree Vendor Recon API for payments stuck in 'processing'
 * where the split webhook was missed or didn't match.
 *
 * Matching strategy (in priority order):
 *   1. entity_id → cf_adjustment_id (precise, if Cashfree returns our adjustment_id)
 *   2. Vendor-level: if vendor has only ONE stuck payment, that's the match
 *   3. Amount-based: match by payout amount within ₹1 tolerance (fallback)
 *
 * Cashfree recommends waiting 15+ min after settlement webhook before calling
 * the recon API. This function only runs on payments stuck for >1 hour, so
 * the timing constraint is always satisfied.
 *
 * Only checks payments that have been in 'processing' for >1 hour
 * (gives the webhook time to arrive first).
 */
async function reconcileVendorSettlements(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    // Find Cashfree payments stuck in processing for >1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: stuckPayments } = await supabase
      .from("payments")
      .select("id, user_id, tenancy_id, rent_amount_paise, landlord_payout_paise, cf_adjustment_id, paid_at")
      .eq("status", "success")
      .eq("payment_gateway", "cashfree")
      .in("landlord_payout_status", ["processing", "retrying"])
      .lt("landlord_payout_at", oneHourAgo)
      .limit(BATCH_SIZE);

    if (!stuckPayments?.length) return result;

    result.checked = stuckPayments.length;
    console.log(`[vendor-recon] Found ${stuckPayments.length} stuck Cashfree payment(s) — checking vendor settlements`);

    // Look up vendor IDs via bank_accounts for each payment's user
    const vendorPayments = new Map<string, typeof stuckPayments>();
    for (const payment of stuckPayments) {
      const { data: bankAcct } = await supabase
        .from("bank_accounts")
        .select("cf_beneficiary_id")
        .eq("user_id", payment.user_id)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .not("cf_beneficiary_id", "is", null)
        .maybeSingle();

      const vendorId = bankAcct?.cf_beneficiary_id;
      if (!vendorId) continue;

      if (!vendorPayments.has(vendorId)) vendorPayments.set(vendorId, []);
      vendorPayments.get(vendorId)!.push(payment);
    }

    // For each vendor, call recon API and match settlements
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const now = new Date().toISOString();

    for (const [vendorId, payments] of vendorPayments) {
      try {
        const recon = await getVendorRecon({
          vendorId,
          startDate: sevenDaysAgo,
          endDate: now,
        });

        if (!recon.data?.length) continue;

        // Filter to settled entries with UTR
        const settledEntries = recon.data.filter(e => e.settled && e.settlement_utr);
        if (!settledEntries.length) continue;

        // Build a set of unmatched payments for this vendor
        const unmatchedPayments = [...payments];

        for (let i = unmatchedPayments.length - 1; i >= 0; i--) {
          const payment = unmatchedPayments[i];
          let matchedEntry: typeof settledEntries[0] | null = null;

          // Strategy 1: Match by entity_id → cf_adjustment_id (precise)
          if (payment.cf_adjustment_id) {
            const adjIdStr = String(payment.cf_adjustment_id);
            matchedEntry = settledEntries.find(e =>
              e.entity_id != null && String(e.entity_id) === adjIdStr
            ) ?? null;
          }

          // Strategy 2: If only one stuck payment for this vendor, take any settled entry
          if (!matchedEntry && unmatchedPayments.length === 1 && settledEntries.length > 0) {
            matchedEntry = settledEntries[0];
          }

          // Strategy 3: Match by amount (within ₹1 tolerance)
          if (!matchedEntry) {
            const payoutAmountRupees = ((payment.landlord_payout_paise ?? payment.rent_amount_paise) / 100);
            matchedEntry = settledEntries.find(e =>
              Math.abs(e.amount - payoutAmountRupees) < 1
            ) ?? null;
          }

          if (matchedEntry) {
            const { error: updateErr } = await supabase
              .from("payments")
              .update({
                landlord_payout_status: "settled",
                settlement_status: "settled",
                gateway_settlement_status: "settled",
                gateway_payout_utr: matchedEntry.settlement_utr,
                gateway_payout_status: "settlement_success",
                gateway_payout_id: String(matchedEntry.settlement_id),
                gateway_settled_at: matchedEntry.settlement_time,
              })
              .eq("id", payment.id)
              .in("landlord_payout_status", ["processing", "retrying"]);

            if (!updateErr) {
              result.updated++;
              console.log(`[vendor-recon] Payment ${payment.id} → settled (UTR: ${matchedEntry.settlement_utr})`);

              // Remove matched entry to prevent double-matching
              const idx = settledEntries.indexOf(matchedEntry);
              if (idx >= 0) settledEntries.splice(idx, 1);
              unmatchedPayments.splice(i, 1);

              await audit.logSuccess("VENDOR_RECON_SETTLED", "payment", "payment", payment.id, {
                vendor_id: vendorId,
                utr: matchedEntry.settlement_utr,
                settlement_id: matchedEntry.settlement_id,
                entity_id: matchedEntry.entity_id,
                match_strategy: payment.cf_adjustment_id && String(matchedEntry.entity_id) === String(payment.cf_adjustment_id)
                  ? "entity_id"
                  : unmatchedPayments.length === 0 ? "single_payment" : "amount",
              });

              // Send settlement notification (webhook was missed, so user hasn't been notified)
              const supabaseUrl = getSupabaseUrl();
              const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              notifyUser(supabaseUrl, serviceKey, {
                user_id: payment.user_id,
                notification_type: "settlement_complete",
                template_vars: {
                  amount: ((payment.landlord_payout_paise ?? payment.rent_amount_paise) / 100).toLocaleString("en-IN"),
                  utr: matchedEntry.settlement_utr ?? "N/A",
                },
                related_entity_type: "payment",
                related_entity_id: payment.id,
              }).catch((e) => console.error("[vendor-recon] Notify failed:", e));
            } else {
              result.errors++;
            }
          }
        }
      } catch (err) {
        console.error(`[vendor-recon] Failed for vendor ${vendorId}:`, err);
        result.errors++;
      }
    }

    if (result.updated > 0) {
      console.log(`[vendor-recon] Reconciled ${result.updated} vendor settlement(s) via backup recon API`);
    }
  } catch (err) {
    console.error("[vendor-recon] Error:", err);
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
      .in("landlord_payout_status", ["pending", "ready", "processing"])
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

// ==============================================
// REFUND: 36hr retrying → failed + Cashfree refund
// ==============================================

/**
 * Payments stuck in 'retrying' OR 'processing' where paid_at + 36h < now
 * are deterministically moved to 'failed' and a Cashfree PG refund is initiated.
 *
 * 'retrying' = Cashfree sent VENDOR_SETTLEMENT_FAILED/REVERSED webhook
 * 'processing' = settle-to-landlord created adjustment, but no settlement
 *                webhook ever arrived (missed webhook + recon API also failed)
 *
 * Two-step refund: Cashfree Create Refund API with refund_splits debits
 * the vendor balance and refunds the customer in one atomic call.
 */
async function checkRefundEligibility(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    const refundThreshold = new Date(Date.now() - REFUND_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

    const { data: retryingPayments } = await supabase
      .from("payments")
      .select(`
        id, user_id, tenancy_id, cf_order_id, gateway_order_id,
        rent_amount_paise, total_amount_paise, landlord_payout_paise,
        cashback_earned_paise, cashback_applied_paise, accumulated_redeemed_paise,
        payment_gateway, paid_at,
        tenancy:tenancies(landlord_user_id)
      `)
      .eq("status", "success")
      .in("landlord_payout_status", ["retrying", "processing"])
      .eq("payment_gateway", "cashfree")
      .lt("paid_at", refundThreshold)
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!retryingPayments?.length) return result;

    result.checked = retryingPayments.length;
    console.log(`[refund] Found ${retryingPayments.length} Cashfree payments in 'retrying' for > ${REFUND_THRESHOLD_HOURS}h`);

    for (const payment of retryingPayments) {
      try {
        const orderId = payment.cf_order_id ?? payment.gateway_order_id;
        if (!orderId) {
          console.error(`[refund] No cf_order_id for payment ${payment.id}, skipping`);
          result.errors++;
          continue;
        }

        // Find vendor ID for refund_splits
        const tenancy = payment.tenancy as { landlord_user_id: string | null } | null;
        let vendorId: string | null = null;
        const lookupUserIds = [tenancy?.landlord_user_id, payment.user_id].filter(Boolean) as string[];
        for (const uid of lookupUserIds) {
          if (vendorId) break;
          const { data: bank } = await supabase
            .from("bank_accounts")
            .select("cf_beneficiary_id")
            .eq("user_id", uid)
            .eq("party_type", "landlord")
            .eq("is_primary", true)
            .maybeSingle();
          if (bank?.cf_beneficiary_id) vendorId = bank.cf_beneficiary_id;
        }

        const refundAmountPaise = payment.total_amount_paise;
        const refundId = `REFUND-${payment.id.slice(0, 8)}-${Date.now().toString(36)}`;

        // Deterministically mark as failed first (prevents re-processing)
        const { data: lockResult } = await supabase
          .from("payments")
          .update({
            landlord_payout_status: "failed",
            gateway_payout_status: `Settlement failed after ${REFUND_THRESHOLD_HOURS}h — refund initiated`,
          })
          .eq("id", payment.id)
          .in("landlord_payout_status", ["retrying", "processing"])
          .select("id")
          .maybeSingle();

        if (!lockResult) {
          console.warn(`[refund] Optimistic lock failed for payment ${payment.id} (already processed)`);
          continue;
        }

        // Call Cashfree Create Refund API
        const vendorAmountPaise = payment.landlord_payout_paise ?? payment.rent_amount_paise;
        const refundResult = await createRefund({
          orderId,
          amountPaise: refundAmountPaise,
          refundId,
          note: `Settlement to landlord failed after ${REFUND_THRESHOLD_HOURS}h — automatic refund`,
          vendorId: vendorId ?? undefined,
          vendorAmountPaise: vendorId ? vendorAmountPaise : undefined,
        });

        console.log(`[refund] Cashfree refund initiated for payment ${payment.id}:`, {
          refund_id: refundId,
          cf_refund_id: refundResult.cf_refund_id,
          refund_status: refundResult.refund_status,
          amount: refundAmountPaise,
        });

        // Create refund record in DB
        await supabase.from("refunds").insert({
          payment_id: payment.id,
          user_id: payment.user_id,
          amount_paise: refundAmountPaise,
          reason: "settlement_failed_timeout",
          status: refundResult.refund_status === "SUCCESS" ? "completed" : "processing",
          payment_gateway: "cashfree",
          gateway_refund_id: refundResult.cf_refund_id ?? refundId,
          gateway_refund_status: refundResult.refund_status,
          gateway_metadata: refundResult,
          initiated_by: null,
          processed_by: "system",
          requested_at: new Date().toISOString(),
        });

        // Update payment status to refunded
        await supabase.from("payments").update({
          status: "refunded",
          refund_amount_paise: refundAmountPaise,
          refund_reason: "settlement_failed_timeout",
          refund_initiated_at: new Date().toISOString(),
        }).eq("id", payment.id);

        // Reverse earned cashback (unverified users had balance credited on success webhook)
        if (payment.cashback_earned_paise && payment.cashback_earned_paise > 0) {
          try {
            await supabase.rpc("decrement_cashback_balance", {
              p_user_id: payment.user_id,
              p_amount: payment.cashback_earned_paise,
            });
            await supabase.from("cashback_ledger").insert({
              user_id: payment.user_id,
              transaction_type: "reversal",
              amount_paise: payment.cashback_earned_paise,
              balance_after_paise: 0, // approximate — RPC handles actual balance
              payment_id: payment.id,
              tenancy_id: payment.tenancy_id,
              reference_type: "refund",
              reference_id: payment.id,
              description: "Cashback reversed — settlement failed auto-refund",
            });
            console.log(`[refund] Reversed ${payment.cashback_earned_paise} paise earned cashback for payment ${payment.id}`);
          } catch (cbErr) {
            console.error(`[refund] Cashback reversal failed for payment ${payment.id}:`, cbErr);
          }
        }

        // Also reverse accumulated cashback that was redeemed in this payment
        // (the instant 1% discount portion is already reflected in the lower refund amount,
        //  but the accumulated balance debit needs to be re-credited)
        const accumulatedUsed = (payment as Record<string, any>).accumulated_redeemed_paise ?? 0;
        if (accumulatedUsed > 0) {
          try {
            // sync_cashback_balance trigger on cashback_ledger handles users.cashback_balance_paise
            await supabase.from("cashback_ledger").insert({
              user_id: payment.user_id,
              transaction_type: "reinstatement",
              amount_paise: accumulatedUsed,
              balance_after_paise: 0,
              payment_id: payment.id,
              tenancy_id: payment.tenancy_id,
              reference_type: "refund",
              reference_id: payment.id,
              description: "Accumulated cashback reinstated — settlement failed auto-refund",
            });
            console.log(`[refund] Reinstated ${accumulatedUsed} paise accumulated cashback for payment ${payment.id}`);
          } catch (cbErr) {
            console.error(`[refund] Accumulated cashback reinstatement failed for payment ${payment.id}:`, cbErr);
          }
        }

        // Notify user
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        notifyUser(supabaseUrl, serviceKey, {
          user_id: payment.user_id,
          notification_type: "settlement_failed",
          template_vars: {
            amount: (refundAmountPaise / 100).toLocaleString("en-IN"),
          },
          related_entity_type: "payment",
          related_entity_id: payment.id,
        }).catch((e) => console.error("[refund] Notify failed:", e));

        await audit.logSuccess(
          "SETTLEMENT_REFUND_INITIATED",
          "payment",
          "payment",
          payment.id,
          {
            refund_id: refundId,
            cf_refund_id: refundResult.cf_refund_id,
            refund_amount_paise: refundAmountPaise,
            vendor_id: vendorId,
            refund_status: refundResult.refund_status,
          },
        );

        result.updated++;
      } catch (err) {
        const msg = err instanceof CashfreeError
          ? `HTTP ${err.statusCode}: ${err.message}`
          : (err as Error).message;
        console.error(`[refund] Failed to process refund for payment ${payment.id}:`, msg);

        await audit.logFailure(
          "SETTLEMENT_REFUND_FAILED",
          "payment",
          err instanceof CashfreeError ? "CASHFREE_REFUND_ERROR" : "REFUND_ERROR",
          msg,
          "payment",
          payment.id,
        );

        result.errors++;
      }
    }

    if (result.updated > 0 || result.errors > 0) {
      console.log(`[refund] Processed ${result.updated} refunds, ${result.errors} errors out of ${result.checked} eligible`);
    }
  } catch (err) {
    console.error("[refund] Error:", err);
    result.errors++;
  }

  return result;
}
