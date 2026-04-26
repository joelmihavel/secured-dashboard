/**
 * Flent Secured v2 - Cashfree Vendor Settlement Webhook
 *
 * Handles vendor settlement lifecycle events from Cashfree (the URL/feature
 * is referred to as "Easy Split" in the Cashfree dashboard, but we don't use
 * the auto-split-at-order Easy Split feature — settlement happens via
 * createAdjustment() AFTER payment success in settle-to-landlord cron).
 *
 *   VENDOR_SETTLEMENT_SUCCESS  → landlord_payout_status = settled
 *   VENDOR_SETTLEMENT_FAILED   → landlord_payout_status = retrying (36hr cron → failed + refund)
 *   VENDOR_SETTLEMENT_REVERSED → landlord_payout_status = retrying (36hr cron → failed + refund)
 *
 * The webhook is the FAST path for settlement detection. The BACKUP path is
 * `poll-settlement-status` cron (every 30 min) calling /pg/recon/vendor —
 * see reconcileVendorSettlements() in that function. If this webhook is
 * delayed or lost, the recon cron eventually picks up the same settlement.
 *
 * IMPORTANT: Vendor settlement webhooks are at the VENDOR level, not per-order.
 * A single settlement (one bank UTR) covers ALL pending vendor balance, which may
 * include multiple adjustments/payments. All matched payments get the same UTR.
 *
 * The webhook payload does NOT contain adjustment_id or order_id — matching is
 * done by vendor_id → bank_accounts → tenancies → payments.
 *
 * Endpoint: POST /functions/v1/cashfree-split-webhook
 * Auth:     HMAC-SHA256 Base64 signature via x-webhook-signature header
 * Secret:   CASHFREE_PG_APP_SECRET — Cashfree signs ALL webhooks (PG payment,
 *           vendor settlement, vendor status) with the merchant's project-wide
 *           PG Client Secret. There is no per-webhook signing key in
 *           Cashfree's dashboard or API. See docs/backend/cashfree-integration.md
 *           "Webhook signing" for the security model.
 *
 * Register URL in Cashfree dashboard → Webhooks (Vendor Settlement events):
 *   https://{project-ref}.supabase.co/functions/v1/cashfree-split-webhook
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { hmacSha256Base64, timingSafeCompare } from "../_shared/crypto.ts";
import { notifyUser } from "../_shared/notifications.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Cashfree signs all webhooks with the merchant-wide PG Client Secret.
// There is no per-webhook signing key in their dashboard. See header.
const CF_SPLIT_WEBHOOK_SECRET = Deno.env.get("CASHFREE_PG_APP_SECRET") ?? Deno.env.get("CASHFREE_PG_SECRET_KEY");
if (!CF_SPLIT_WEBHOOK_SECRET) {
  console.error(
    "[cashfree-split-webhook] FATAL: CASHFREE_PG_APP_SECRET (or legacy CASHFREE_PG_SECRET_KEY) is not set",
  );
}

// ==============================================
// TYPES
// ==============================================

interface SplitWebhookPayload {
  type: string; // VENDOR_SETTLEMENT_SUCCESS, VENDOR_SETTLEMENT_FAILED, VENDOR_SETTLEMENT_REVERSED
  event_time?: string;
  data: {
    settlement?: {
      settlement_id?: number | string;
      status?: string;
      vendor_id?: string;
      utr?: string;
      settlement_amount?: number;
      amount_settled?: number;
      service_charge?: number;
      service_tax?: number;
      adjustment?: number;
      vendor_transaction_amount?: number;
      payment_amount?: number;
      payment_from?: string;
      payment_till?: string;
      settlement_initiated_on?: string;
      settled_on?: string;
      reason?: string;
      account_mode?: string;
      settled_orders_count?: number;
    };
  };
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
  let audit: AuditLogger | null = null;

  try {
    const rawBody = await req.text();

    // Verify signature — same method as payment-webhook
    const receivedSignature = req.headers.get("x-webhook-signature") ?? "";
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";

    if (!receivedSignature || !timestamp) {
      console.error("[cashfree-split-webhook] Missing signature or timestamp headers");
      return jsonResponse({ status: "ignored", reason: "missing headers" });
    }

    const expectedSignature = await hmacSha256Base64(timestamp + rawBody, CF_SPLIT_WEBHOOK_SECRET);
    if (!timingSafeCompare(receivedSignature, expectedSignature)) {
      console.error("[cashfree-split-webhook] Signature verification failed");
      return jsonResponse({ status: "ignored", reason: "invalid signature" });
    }

    // Observe-only freshness window (Phase 7e). Cashfree's x-webhook-timestamp
    // is epoch seconds. We log when age > 5 min so we can measure how often
    // legitimate webhooks land outside the window before flipping to enforcement.
    // Once observation shows ≥99.9% of legit webhooks land inside 5 min, swap
    // the warn for `return jsonResponse({ status: "ignored", reason: "stale" })`.
    const tsSec = parseInt(timestamp, 10);
    if (Number.isFinite(tsSec) && tsSec > 0) {
      const ageSec = Math.floor(Date.now() / 1000) - tsSec;
      if (ageSec > 300) {
        console.warn(
          `[cashfree-split-webhook] STALE_TIMESTAMP age=${ageSec}s timestamp=${timestamp} (observe-only — see Phase 7e)`,
        );
      }
    }

    let payload: SplitWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ status: "ignored", reason: "invalid json" });
    }

    const eventType = payload.type;
    const settlement = payload.data?.settlement;
    const settlementId = String(settlement?.settlement_id ?? "");
    const vendorId = settlement?.vendor_id ?? "";

    console.log("[cashfree-split-webhook] Event:", eventType,
      "settlement_id:", settlementId, "vendor_id:", vendorId,
      "utr:", settlement?.utr,
      "amount_settled:", settlement?.amount_settled,
      "settled_orders_count:", settlement?.settled_orders_count);

    // Vendor settlement webhooks always carry settlement_id + vendor_id
    if (!settlementId && !vendorId) {
      return jsonResponse({ status: "ignored", reason: "no identifiers" });
    }

    // Dedup by settlement_id + event type (unique per settlement lifecycle event)
    const dedupKey = `cf-split-${settlementId || vendorId}-${eventType}`;
    const { data: existing } = await supabase
      .from("processed_webhooks")
      .select("event_id")
      .eq("event_id", dedupKey)
      .maybeSingle();

    if (existing) {
      console.log(`[cashfree-split-webhook] Duplicate webhook for ${dedupKey}, skipping`);
      return jsonResponse({ status: "success", message: "Already processed" });
    }

    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "cashfree-split-webhook",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // ── MATCH PAYMENTS BY VENDOR ──────────────────────────────────────
    // Vendor settlement webhooks are at the VENDOR level (not per-order/adjustment).
    // A single settlement covers all pending vendor balance. Match ALL processing
    // payments for this vendor — they all share the same bank UTR.
    const paymentFields = "id, user_id, rent_amount_paise, landlord_payout_paise, landlord_payout_status, landlord_payout_at, tenancy_id, payment_month";
    let payments: Array<{
      id: string;
      user_id: string;
      rent_amount_paise: number;
      landlord_payout_paise: number | null;
      landlord_payout_status: string;
      landlord_payout_at: string | null;
      tenancy_id: string;
      payment_month: string;
    }> = [];

    if (vendorId) {
      // vendor_id → bank_accounts → tenancies → ALL processing payments
      const { data: bankAcct } = await supabase
        .from("bank_accounts")
        .select("user_id")
        .eq("cf_beneficiary_id", vendorId)
        .eq("party_type", "landlord")
        .maybeSingle();

      if (bankAcct) {
        const { data: tenancies } = await supabase
          .from("tenancies")
          .select("id")
          .eq("landlord_user_id", bankAcct.user_id);

        if (tenancies?.length) {
          const tenancyIds = tenancies.map((t: { id: string }) => t.id);
          const { data } = await supabase
            .from("payments")
            .select(paymentFields)
            .in("tenancy_id", tenancyIds)
            .eq("payment_gateway", "cashfree")
            .in("landlord_payout_status", ["processing", "retrying"])
            .order("paid_at", { ascending: true });
          if (data?.length) payments = data;
        }
      }
    }

    // Legacy fallback: settlement_id match (for payments that have gateway_payout_id stored)
    if (!payments.length && settlementId) {
      const { data } = await supabase
        .from("payments")
        .select(paymentFields)
        .eq("gateway_payout_id", settlementId)
        .in("landlord_payout_status", ["pending", "ready", "processing", "retrying"]);
      if (data?.length) payments = data;
    }

    if (!payments.length) {
      console.warn(`[cashfree-split-webhook] No eligible payment found (vendor_id=${vendorId}, settlement_id=${settlementId}, event=${eventType})`);
      await supabase
        .from("processed_webhooks")
        .upsert({ event_id: dedupKey, payment_gateway: "cashfree_split" }, { onConflict: "event_id" });
      return jsonResponse({ status: "ignored", reason: "no eligible payment" });
    }

    const paymentIds = payments.map((p) => p.id);
    const payment = payments[0]; // primary for logging/notification

    console.log(`[cashfree-split-webhook] Matched ${payments.length} payment(s): ${paymentIds.join(", ")}`);

    // ── VENDOR_SETTLEMENT_INITIATED ──────────────────────────────────
    if (eventType === "VENDOR_SETTLEMENT_INITIATED" || eventType === "VENDOR_SETTLEMENT_CREATED") {
      for (const p of payments) {
        await supabase
          .from("payments")
          .update({ landlord_payout_status: "processing" })
          .eq("id", p.id)
          .in("landlord_payout_status", ["pending", "ready"]);
      }

      await audit.logSuccess(
        "VENDOR_SETTLEMENT_INITIATED",
        "payment",
        "payment",
        payment.id,
        { vendor_id: vendorId, payment_count: payments.length, settlement_id: settlementId },
      );

      console.log(`[cashfree-split-webhook] Settlement initiated for ${payments.length} payment(s)`);

    // ── VENDOR_SETTLEMENT_SUCCESS ─────────────────────────────────────
    } else if (eventType === "VENDOR_SETTLEMENT_SUCCESS") {
      const amountSettled = settlement?.amount_settled ?? 0;
      const serviceCharge = settlement?.service_charge ?? 0;
      const settledOn = settlement?.settled_on ?? new Date().toISOString();
      // The real bank UTR from Cashfree — this is the bank transfer reference
      const bankUtr = settlement?.utr ?? null;

      // Amount guard: with 15-min settlement cycles, a newer adjustment could be
      // in "processing" but NOT included in this bank transfer. Use amount_settled
      // from the webhook to determine which payments are in this batch.
      // Sort by landlord_payout_at ascending (FIFO — oldest adjustments settle first),
      // accumulate payout amounts, and stop when we'd exceed amount_settled.
      const amountSettledPaise = Math.round(amountSettled * 100);
      let paymentsToSettle = payments;
      let skippedPayments: typeof payments = [];

      if (amountSettledPaise > 0 && payments.length > 1) {
        // Sort FIFO: oldest adjustment first (by landlord_payout_at, then paid_at proxy via payment_month)
        const sorted = [...payments].sort((a, b) =>
          (a.landlord_payout_at ?? "").localeCompare(b.landlord_payout_at ?? "")
        );

        let runningTotal = 0;
        const included: typeof payments = [];
        const excluded: typeof payments = [];

        for (const p of sorted) {
          const payoutPaise = p.landlord_payout_paise ?? p.rent_amount_paise;
          if (runningTotal + payoutPaise <= amountSettledPaise) {
            runningTotal += payoutPaise;
            included.push(p);
          } else {
            excluded.push(p);
          }
        }

        // Only apply the guard if the included total approximately matches amount_settled.
        // Tolerance: ₹1 (100 paise) to account for Cashfree service charge rounding.
        if (included.length > 0 && Math.abs(runningTotal - amountSettledPaise) < 100) {
          paymentsToSettle = included;
          skippedPayments = excluded;
        } else {
          // Amounts don't reconcile — log warning and settle all (safer than dropping payments)
          console.warn(`[cashfree-split-webhook] Amount guard inconclusive: matched ${sorted.length} payments totaling ₹${(runningTotal / 100).toFixed(2)}, webhook says ₹${amountSettled}. Settling all.`);
        }
      }

      if (skippedPayments.length > 0) {
        console.log(`[cashfree-split-webhook] Skipped ${skippedPayments.length} payment(s) not in this settlement batch: ${skippedPayments.map(p => p.id).join(", ")}`);
      }

      for (const p of paymentsToSettle) {
        await supabase
          .from("payments")
          .update({
            landlord_payout_status: "settled",
            landlord_payout_at: settledOn,
            gateway_payout_utr: bankUtr,
            gateway_settlement_status: "settled",
            settlement_status: "settled",
            gateway_payout_status: "settlement_success",
            gateway_payout_id: settlementId || null,
            gateway_settled_at: settledOn,
          })
          .eq("id", p.id)
          .in("landlord_payout_status", ["processing", "retrying"]);
      }

      await audit.logSuccess(
        "VENDOR_SETTLEMENT_SUCCESS",
        "payment",
        "payment",
        payment.id,
        {
          vendor_id: vendorId,
          utr: bankUtr,
          amount_settled: amountSettled,
          service_charge: serviceCharge,
          payment_count: paymentsToSettle.length,
          skipped_count: skippedPayments.length,
          settlement_id: settlementId,
        },
      );

      console.log(`[cashfree-split-webhook] Settled ${paymentsToSettle.length} payment(s), UTR: ${bankUtr}`);

      // Notify each affected tenant
      const supabaseUrl = getSupabaseUrl();
      const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      for (const p of paymentsToSettle) {
        if (p.user_id) {
          notifyUser(supabaseUrl, serviceKey, {
            user_id: p.user_id,
            notification_type: "settlement_complete",
            template_vars: {
              amount: ((p.rent_amount_paise as number) / 100).toLocaleString("en-IN"),
              utr: bankUtr ?? "N/A",
            },
            related_entity_type: "payment",
            related_entity_id: p.id,
          }).catch((e) => console.error("[cashfree-split-webhook] Notify failed:", e));
        }
      }

    // ── VENDOR_SETTLEMENT_FAILED / REVERSED ───────────────────────────
    // Set to 'retrying' (not 'failed') — Cashfree may auto-retry from vendor balance.
    // After 36hr from paid_at with no success, poll-settlement-status → 'failed' + refund.
    } else if (eventType === "VENDOR_SETTLEMENT_FAILED" || eventType === "VENDOR_SETTLEMENT_REVERSED") {
      const isReversed = eventType === "VENDOR_SETTLEMENT_REVERSED";

      for (const p of payments) {
        await supabase
          .from("payments")
          .update({ landlord_payout_status: "retrying" })
          .eq("id", p.id)
          .in("landlord_payout_status", ["processing", "retrying"]);
      }

      await audit.logFailure(
        "VENDOR_SETTLEMENT_FAILED",
        "payment",
        isReversed ? "SETTLEMENT_REVERSED" : "SETTLEMENT_FAILED",
        `Cashfree settlement ${isReversed ? "reversed" : "failed"} for ${payments.length} payment(s)`,
        "payment",
        payment.id,
        {
          vendor_id: vendorId,
          reason: settlement?.reason,
          event_type: eventType,
          payment_count: payments.length,
          settlement_id: settlementId,
        },
      );

      console.error(
        `[OPS_ALERT] ${eventType} for ${payments.length} payment(s)`,
        isReversed ? "— requires manual review" : "",
      );

      // Do NOT notify tenant here — status is 'retrying', not terminal.
      // poll-settlement-status sends settlement_failed notification after 36hr timeout + refund.

    } else {
      console.log(`[cashfree-split-webhook] Unhandled event type: ${eventType}`);
    }

    // Mark as processed
    await supabase
      .from("processed_webhooks")
      .upsert({ event_id: dedupKey, payment_gateway: "cashfree_split" }, { onConflict: "event_id" });

    return jsonResponse({ status: "success", message: "Webhook processed" });
  } catch (error) {
    console.error("[cashfree-split-webhook] Error:", error);

    if (audit) {
      await audit.logFailure(
        "SPLIT_WEBHOOK_ERROR",
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment",
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
