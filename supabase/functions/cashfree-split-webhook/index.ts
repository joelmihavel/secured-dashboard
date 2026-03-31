/**
 * Flent Secured v2 - Cashfree Easy Split Webhook
 *
 * Handles settlement lifecycle events from Cashfree Easy Split:
 *   VENDOR_SETTLEMENT_SUCCESS  → landlord_payout_status = settled
 *   VENDOR_SETTLEMENT_FAILED   → landlord_payout_status = retrying (36hr cron → failed + refund)
 *   VENDOR_SETTLEMENT_REVERSED → landlord_payout_status = retrying (36hr cron → failed + refund)
 *
 * Endpoint: POST /functions/v1/cashfree-split-webhook
 * Auth: HMAC-SHA256 Base64 signature via x-webhook-signature header
 * Secret: CASHFREE_SPLIT_WEBHOOK_SECRET (set separately from PG secret)
 *
 * Register URL in Cashfree dashboard → Webhooks → Easy Split:
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

const CF_SPLIT_WEBHOOK_SECRET = Deno.env.get("CASHFREE_PG_APP_SECRET") ?? Deno.env.get("CASHFREE_PG_SECRET_KEY")!;

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

    // Find payment(s) by vendor_id → bank_accounts → tenancies → payments
    // Settlement webhooks are vendor-level (no order_id), so we match via vendor identity.
    let payments: Array<{
      id: string;
      user_id: string;
      rent_amount_paise: number;
      landlord_payout_status: string;
      tenancy_id: string;
      payment_month: string;
    }> = [];

    if (vendorId) {
      // Look up bank account by Cashfree vendor ID
      const { data: bankAcct } = await supabase
        .from("bank_accounts")
        .select("user_id")
        .eq("cf_beneficiary_id", vendorId)
        .eq("party_type", "landlord")
        .maybeSingle();

      if (bankAcct) {
        // Find all tenancies for this landlord
        const { data: tenancies } = await supabase
          .from("tenancies")
          .select("id")
          .eq("landlord_user_id", bankAcct.user_id);

        if (tenancies?.length) {
          const tenancyIds = tenancies.map((t: { id: string }) => t.id);
          // Only match the OLDEST eligible payment (FIFO) to avoid updating
          // ALL payments for a landlord when a single settlement arrives.
          const { data } = await supabase
            .from("payments")
            .select("id, user_id, rent_amount_paise, landlord_payout_status, tenancy_id, payment_month")
            .in("tenancy_id", tenancyIds)
            .eq("payment_gateway", "cashfree")
            .in("landlord_payout_status", ["processing", "retrying"])
            .order("paid_at", { ascending: true })
            .limit(1);
          if (data?.length) payments = data;
        }
      }
    }

    // Fallback: try settlement_id match (legacy on-demand transfers)
    if (!payments.length && settlementId) {
      const { data } = await supabase
        .from("payments")
        .select("id, user_id, rent_amount_paise, landlord_payout_status, tenancy_id, payment_month")
        .eq("gateway_payout_id", settlementId)
        .in("landlord_payout_status", ["pending", "ready", "processing", "retrying"])
        .limit(1);
      if (data?.length) payments = data;
    }

    if (!payments.length) {
      console.warn(`[cashfree-split-webhook] No eligible payment found (vendor_id=${vendorId}, settlement_id=${settlementId}, event=${eventType})`);
      await supabase
        .from("processed_webhooks")
        .upsert({ event_id: dedupKey, payment_gateway: "cashfree_split" }, { onConflict: "event_id" });
      return jsonResponse({ status: "ignored", reason: "no eligible payment" });
    }

    // Settlement webhooks are vendor-level: one settlement may cover multiple payments.
    // Process all matched payments in the batch.
    const paymentIds = payments.map((p) => p.id);
    const payment = payments[0]; // primary for logging/notification

    console.log(`[cashfree-split-webhook] Matched ${payments.length} payment(s): ${paymentIds.join(", ")}`);

    // ── VENDOR_SETTLEMENT_INITIATED ──────────────────────────────────
    // Largely redundant: settle-to-landlord already sets 'processing'.
    // Kept as a safety net for any race conditions.
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

      // Mark ALL processing payments for this vendor as settled
      for (const p of payments) {
        await supabase
          .from("payments")
          .update({
            landlord_payout_status: "settled",
            landlord_payout_at: settledOn,
            gateway_payout_utr: settlement?.utr ?? null,
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
          utr: settlement?.utr,
          amount_settled: amountSettled,
          service_charge: serviceCharge,
          payment_count: payments.length,
          settlement_id: settlementId,
        },
      );

      console.log(`[cashfree-split-webhook] Settled ${payments.length} payment(s), UTR: ${settlement?.utr}`);

      // Notify each affected tenant
      const supabaseUrl = getSupabaseUrl();
      const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      for (const p of payments) {
        if (p.user_id) {
          notifyUser(supabaseUrl, serviceKey, {
            user_id: p.user_id,
            notification_type: "settlement_complete",
            template_vars: {
              amount: ((p.rent_amount_paise as number) / 100).toLocaleString("en-IN"),
              utr: settlement?.utr ?? "N/A",
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
