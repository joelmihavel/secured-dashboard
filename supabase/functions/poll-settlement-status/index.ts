/**
 * Flent Secured v2 - Poll Settlement Status Edge Function
 *
 * Cron job (every 30 min) that handles:
 * TIER 1: PayU -> Flent settlement tracking (checks if PayU has settled to Flent)
 * TIER 2: Flent -> Landlord payout tracking (queues ready payouts)
 * RECONCILIATION: Resolves stuck payments by verifying with PayU
 *
 * Endpoint: POST /functions/v1/poll-settlement-status
 * Auth: Service role only (called by pg_cron or admin)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { sha512 } from "../_shared/crypto.ts";
import { getSystemTransferFlag, checkTransferEligibility, type SystemTransferFlag } from "../_shared/transfer-flags.ts";
import {
  PAYU_MERCHANT_KEY,
  PAYU_MERCHANT_SALT,
  PAYU_INFO_URL,
  fetchWithTimeout,
} from "../_shared/payu-config.ts";

const BATCH_SIZE = 50;
const STUCK_THRESHOLD_MINUTES = 15;
const SETTLEMENT_LOOKBACK_DAYS = 7;

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

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    // Verify service role authorization
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "poll-settlement-status",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const startTime = Date.now();

    // Fetch system transfer flag once (shared across all tiers)
    const systemConfig = await getSystemTransferFlag(supabase);

    // Release held payments if system flag is now enabled
    const releaseResult = await releaseHeldPayments(supabase, audit, systemConfig);

    // Tier 1: PayU settlement tracking
    const tier1Result = await pollPayUSettlement(supabase, audit, systemConfig);

    // Tier 2 + Reconciliation: depend on Tier 1 marking payments as ready
    const [tier2Result, reconciliationResult] = await Promise.all([
      pollLandlordPayoutReadiness(supabase, audit, systemConfig),
      reconcileStuckPayments(supabase, audit),
    ]);

    const durationMs = Date.now() - startTime;

    await audit.logSuccess(
      "SETTLEMENT_POLL_COMPLETED",
      "system",
      undefined,
      undefined,
      {
        duration_ms: durationMs,
        system_transfers_enabled: systemConfig.enabled,
        released: releaseResult,
        tier1: tier1Result,
        tier2: tier2Result,
        reconciliation: reconciliationResult,
      },
    );

    return jsonResponse({
      success: true,
      data: {
        duration_ms: durationMs,
        system_transfers_enabled: systemConfig.enabled,
        released_held_payments: releaseResult,
        tier1_payu_settlement: tier1Result,
        tier2_landlord_payout: tier2Result,
        reconciliation: reconciliationResult,
      },
    });
  } catch (error) {
    console.error("Poll settlement status error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// RELEASE: Convert system-held payments back to 'ready'
// ==============================================

interface TierResult {
  checked: number;
  updated: number;
  errors: number;
}

/**
 * When system transfers are re-enabled, release payments that were held
 * due to system flag only (transfer_hold = false). Manually-held payments
 * (transfer_hold = true) remain held until explicitly released.
 */
async function releaseHeldPayments(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  systemConfig: SystemTransferFlag,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  // Only release when system is enabled
  if (!systemConfig.enabled) {
    return result;
  }

  try {
    // Find system-held payments (held status but no manual hold)
    const { data: heldPayments } = await supabase
      .from("payments")
      .select("id")
      .eq("landlord_payout_status", "held")
      .eq("transfer_hold", false)
      .limit(BATCH_SIZE);

    if (!heldPayments || heldPayments.length === 0) {
      return result;
    }

    result.checked = heldPayments.length;

    for (const payment of heldPayments) {
      try {
        await supabase
          .from("payments")
          .update({ landlord_payout_status: "ready" })
          .eq("id", payment.id)
          .eq("landlord_payout_status", "held"); // optimistic lock

        result.updated++;
      } catch (err) {
        console.error(`Failed to release held payment ${payment.id}:`, err);
        result.errors++;
      }
    }

    if (result.updated > 0) {
      await audit.logSuccess(
        "HELD_PAYMENTS_RELEASED",
        "payment",
        undefined,
        undefined,
        {
          released_count: result.updated,
          payment_ids: heldPayments.map((p) => p.id),
        },
      );
      console.log(`[RELEASE] Released ${result.updated} system-held payments to 'ready'`);
    }
  } catch (err) {
    console.error("Release held payments error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// TIER 1: PayU -> Flent Settlement
// ==============================================

/**
 * Checks if PayU has settled successful payments to Flent's account.
 * Calls PayU get_settlement_details API.
 */
async function pollPayUSettlement(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  systemConfig: SystemTransferFlag,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    // Find successful payments where PayU settlement is pending/processing
    // Only look back SETTLEMENT_LOOKBACK_DAYS to avoid querying ancient records
    const lookbackDate = new Date(Date.now() - SETTLEMENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingPayments } = await supabase
      .from("payments")
      .select("id, payu_txn_id, payu_mihpayid, total_amount_paise, paid_at")
      .eq("status", "success")
      .in("payu_settlement_status", ["pending", "processing"])
      .not("payu_mihpayid", "is", null)
      .gt("created_at", lookbackDate)
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!pendingPayments || pendingPayments.length === 0) {
      return result;
    }

    result.checked = pendingPayments.length;

    // Group payments by paid_at date for batch settlement queries
    // PayU get_settlement_details takes date as var1 in dd-mm-yyyy format
    const paymentsByDate = new Map<string, typeof pendingPayments>();
    for (const payment of pendingPayments) {
      const paidDate = payment.paid_at ? new Date(payment.paid_at) : new Date();
      const dateKey = `${String(paidDate.getDate()).padStart(2, "0")}-${String(paidDate.getMonth() + 1).padStart(2, "0")}-${paidDate.getFullYear()}`;
      if (!paymentsByDate.has(dateKey)) {
        paymentsByDate.set(dateKey, []);
      }
      paymentsByDate.get(dateKey)!.push(payment);
    }

    // Query PayU settlement details per date
    for (const [dateStr, datePayments] of paymentsByDate) {
      try {
        const settlementData = await getPayUSettlementDetails(dateStr);

        if (!settlementData) continue;

        for (const payment of datePayments) {
          try {
            // Look for this payment's mihpayid in the settlement response
            const paymentSettlement = findSettlementForPayment(settlementData, payment.payu_mihpayid);

            if (paymentSettlement) {
              const settlementStatus = String(paymentSettlement.status ?? "").toLowerCase();
              const utr = paymentSettlement.bank_ref_no ?? paymentSettlement.UTR ?? null;

              const updateData: Record<string, unknown> = {
                payu_settlement_status: settlementStatus === "settled" ? "settled" : "processing",
              };

              if (settlementStatus === "settled") {
                updateData.payu_settlement_utr = utr;
                updateData.payu_settled_at = paymentSettlement.settlement_date ?? new Date().toISOString();

                // Check transfer eligibility before marking as 'ready'
                const eligibility = await checkTransferEligibility(supabase, payment.id, systemConfig);
                if (eligibility.allowed) {
                  updateData.landlord_payout_status = "ready";
                } else {
                  updateData.landlord_payout_status = "held";
                  await audit.logSuccess(
                    "LANDLORD_TRANSFER_HELD",
                    "payment",
                    "payment",
                    payment.id,
                    {
                      reason: eligibility.reason,
                      system_enabled: eligibility.system_enabled,
                      transaction_held: eligibility.transaction_held,
                    },
                  );
                }
              }

              await supabase
                .from("payments")
                .update(updateData)
                .eq("id", payment.id);

              if (settlementStatus === "settled") {
                result.updated++;
                // Note: This is Tier 1 (PayU → Flent). The settlement_complete
                // notification fires later when landlord actually gets paid
                // (manual payout confirmed via admin endpoint).
              }
            }
          } catch (err) {
            console.error(`Failed to process settlement for payment ${payment.id}:`, err);
            result.errors++;
          }
        }
      } catch (err) {
        console.error(`Failed to get settlement details for date ${dateStr}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    console.error("TIER 1 settlement polling error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// TIER 2: Flent -> Landlord Payout Readiness
// ==============================================

/**
 * Monitors payments awaiting landlord payout (read-only).
 *
 * Does NOT mutate status — settle-to-landlord (hourly cron) owns the
 * ready → processing transition. This avoids a race where Tier 2
 * moved payments to 'processing' before settle-to-landlord could
 * pick them up (it queries 'ready').
 */
async function pollLandlordPayoutReadiness(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
  _systemConfig: SystemTransferFlag,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    // Count payments in each payout stage for monitoring
    const { data: readyPayments } = await supabase
      .from("payments")
      .select("id, rent_amount_paise, landlord_payout_paise, payment_month")
      .eq("status", "success")
      .in("landlord_payout_status", ["ready", "processing"])
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!readyPayments || readyPayments.length === 0) {
      return result;
    }

    result.checked = readyPayments.length;

    const totalPaise = readyPayments.reduce(
      (sum, p) => sum + (p.landlord_payout_paise ?? p.rent_amount_paise),
      0,
    );

    await audit.logSuccess(
      "LANDLORD_PAYOUTS_MONITOR",
      "payment",
      undefined,
      undefined,
      {
        count: readyPayments.length,
        total_paise: totalPaise,
        total_rupees: (totalPaise / 100).toFixed(2),
        payment_ids: readyPayments.map((p) => p.id),
      },
    );

    console.log(`[TIER2] ${readyPayments.length} payments awaiting landlord payout (₹${(totalPaise / 100).toFixed(2)})`);
  } catch (err) {
    console.error("TIER 2 landlord payout monitoring error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// RECONCILIATION: Stuck Payments
// ==============================================

/**
 * Reconciles payments stuck in initiated/processing state for > 15 minutes.
 * Calls PayU verify_payment API to resolve status.
 */
async function reconcileStuckPayments(
  supabase: ReturnType<typeof createServiceClient>,
  audit: AuditLogger,
): Promise<TierResult> {
  const result: TierResult = { checked: 0, updated: 0, errors: 0 };

  try {
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    // Find stuck payments with a PayU transaction ID
    const { data: stuckPayments } = await supabase
      .from("payments")
      .select("id, user_id, tenancy_id, payu_txn_id, status, rent_amount_paise, cashback_applied_paise, intended_cashback_paise, payment_month, created_at")
      .in("status", ["initiated", "processing"])
      .lt("created_at", stuckThreshold)
      .not("payu_txn_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!stuckPayments || stuckPayments.length === 0) {
      return result;
    }

    result.checked = stuckPayments.length;
    console.log(`[RECONCILIATION] Found ${stuckPayments.length} stuck payments older than ${STUCK_THRESHOLD_MINUTES} min`);

    for (const payment of stuckPayments) {
      try {
        const updateData: Record<string, unknown> = {};

        // PayU reconciliation
        const payuResult = await verifyWithPayU(payment.payu_txn_id);

        if (!payuResult || !payuResult.status) {
          console.warn(`[RECONCILIATION] No PayU result for ${payment.payu_txn_id}`);
          continue;
        }

        const payuStatus = String(payuResult.status).toLowerCase();
        const mappedStatus = PAYU_STATUS_MAP[payuStatus];
        const gatewayStatus = payuResult.status;

        updateData.payu_status = payuResult.status;
        updateData.payu_mihpayid = payuResult.mihpayid ?? null;

        if (!mappedStatus || mappedStatus === payment.status) {
          continue;
        }

        updateData.status = mappedStatus;

        if (mappedStatus === "success") {
          updateData.paid_at = new Date().toISOString();
          updateData.landlord_payout_status = "pending";
          updateData.landlord_payout_paise = payment.rent_amount_paise;

          // Deprecated in instant-discount model — no cashback earning
          updateData.cashback_earned_paise = 0;

          // Log discount audit entry if applicable
          if (payment.cashback_applied_paise > 0 && payment.user_id) {
            try {
              await supabase.from("cashback_ledger").insert({
                user_id: payment.user_id,
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
              console.error("Failed to log discount audit on reconciliation:", e);
            }
          }
        }

        await supabase
          .from("payments")
          .update(updateData)
          .eq("id", payment.id)
          .eq("status", payment.status);

        result.updated++;

        await audit.logSuccess(
          "PAYMENT_RECONCILED",
          "payment",
          "payment",
          payment.id,
          {
            old_status: payment.status,
            new_status: mappedStatus,
            gateway: "payu",
            gateway_status: gatewayStatus,
            txn_id: payment.payu_txn_id,
          },
        );

        console.log(`[RECONCILIATION] Payment ${payment.id}: ${payment.status} -> ${mappedStatus}`);
      } catch (err) {
        console.error(`[RECONCILIATION] Failed to reconcile payment ${payment.id}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    console.error("RECONCILIATION error:", err);
    result.errors++;
  }

  return result;
}

// ==============================================
// PAYU API HELPERS
// ==============================================

/**
 * Calls PayU get_settlement_details API.
 * Hash formula: sha512(key|command|var1|salt)
 * var1 = date in dd-mm-yyyy format
 */
async function getPayUSettlementDetails(dateStr: string): Promise<Record<string, unknown> | null> {
  try {
    const command = "get_settlement_details";
    const hashString = `${PAYU_MERCHANT_KEY}|${command}|${dateStr}|${PAYU_MERCHANT_SALT}`;
    const hash = await sha512(hashString);

    const formData = new URLSearchParams();
    formData.set("key", PAYU_MERCHANT_KEY);
    formData.set("command", command);
    formData.set("var1", dateStr);
    formData.set("hash", hash);

    const response = await fetchWithTimeout(PAYU_INFO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.warn(`PayU get_settlement_details returned ${response.status} for date ${dateStr}`);
      return null;
    }

    const result = await response.json();

    if (result.status === 1) {
      return result;
    }

    return null;
  } catch (err) {
    console.error(`PayU get_settlement_details error for date ${dateStr}:`, err);
    return null;
  }
}

/**
 * Searches the PayU settlement response for a specific payment's mihpayid.
 */
function findSettlementForPayment(
  settlementData: Record<string, unknown>,
  mihpayid: string,
): Record<string, unknown> | null {
  // PayU settlement response may contain transaction-level details
  // Structure varies: could be keyed by mihpayid or contained in an array
  if (settlementData[mihpayid]) {
    return settlementData[mihpayid] as Record<string, unknown>;
  }

  // Check in settlement_details or txn_details arrays
  for (const key of ["settlement_details", "txn_details", "Txn_details"]) {
    const details = settlementData[key];
    if (Array.isArray(details)) {
      const match = details.find(
        (d: Record<string, unknown>) => d.mihpayid === mihpayid || d.payuid === mihpayid,
      );
      if (match) return match;
    } else if (details && typeof details === "object") {
      const detailsObj = details as Record<string, unknown>;
      if (detailsObj[mihpayid]) {
        return detailsObj[mihpayid] as Record<string, unknown>;
      }
    }
  }

  return null;
}

/**
 * Calls PayU verify_payment API.
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

  if (result.status === 1 && result.transaction_details) {
    const txnDetails = result.transaction_details[txnId];
    if (txnDetails) {
      return txnDetails;
    }
  }

  return {};
}
