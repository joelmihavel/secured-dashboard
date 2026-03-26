/**
 * Flent Secured v2 - Cashfree Easy Split Webhook
 *
 * Handles settlement lifecycle events from Cashfree Easy Split:
 *   VENDOR_SETTLEMENT_SUCCESS  → landlord_payout_status = settled
 *   VENDOR_SETTLEMENT_FAILED   → landlord_payout_status = failed + ops alert
 *   VENDOR_SETTLEMENT_REVERSED → landlord_payout_status = failed + ops alert
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
  data: {
    order?: {
      order_id?: string;
    };
    settlement?: {
      vendor_id?: string;
      settlement_id?: number | string;
      cf_payment_id?: string | number;
      amount_settled?: number;
      service_charge?: number;
      utr?: string;
      settlement_date?: string;
      reason?: string;
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

    const expectedSignature = await hmacSha256Base64(timestamp + "." + rawBody, CF_SPLIT_WEBHOOK_SECRET);
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
    const orderId = payload.data?.order?.order_id;
    const cfPaymentId = String(payload.data?.settlement?.cf_payment_id ?? "");
    const settlementId = String(payload.data?.settlement?.settlement_id ?? "");
    const vendorId = payload.data?.settlement?.vendor_id ?? "";

    console.log("[cashfree-split-webhook] Event:", eventType, "order_id:", orderId,
      "cf_payment_id:", cfPaymentId, "settlement_id:", settlementId, "vendor_id:", vendorId);

    // On-demand transfers may not have an order_id — require at least one identifier
    if (!orderId && !settlementId && !vendorId) {
      return jsonResponse({ status: "ignored", reason: "no identifiers" });
    }

    // Dedup check — event_id format: cf-split-{identifier}-{eventType}
    const dedupKey = `cf-split-${cfPaymentId || settlementId || orderId}-${eventType}`;
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

    // Find the payment — try multiple strategies:
    // 1. By cf_order_id/gateway_order_id (order-level splits)
    // 2. By cf_settlement_id (on-demand transfers — stored by settle-to-landlord)
    // 3. By vendor_id match (fallback for on-demand transfers)
    let payment = null;

    if (orderId) {
      const { data } = await supabase
        .from("payments")
        .select("id, user_id, rent_amount_paise, landlord_payout_status, tenancy_id, payment_month")
        .or(`cf_order_id.eq.${orderId},gateway_order_id.eq.${orderId}`)
        .in("landlord_payout_status", ["pending", "processing"])
        .maybeSingle();
      payment = data;
    }

    if (!payment && settlementId) {
      const { data } = await supabase
        .from("payments")
        .select("id, user_id, rent_amount_paise, landlord_payout_status, tenancy_id, payment_month")
        .eq("cf_settlement_id", settlementId)
        .in("landlord_payout_status", ["pending", "processing"])
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      console.warn(`[cashfree-split-webhook] No eligible payment found (order_id=${orderId}, settlement_id=${settlementId}, event=${eventType})`);
      // Insert dedup record and return 200 to prevent Cashfree retries
      await supabase
        .from("processed_webhooks")
        .upsert({ event_id: dedupKey, payment_gateway: "cashfree_split" }, { onConflict: "event_id" });
      return jsonResponse({ status: "ignored", reason: "no eligible payment" });
    }

    const settlement = payload.data?.settlement ?? {};

    // ── VENDOR_SETTLEMENT_INITIATED ──────────────────────────────────
    if (eventType === "VENDOR_SETTLEMENT_INITIATED") {
      await supabase
        .from("payments")
        .update({ landlord_payout_status: "processing" })
        .eq("id", payment.id)
        .eq("landlord_payout_status", "pending");

      await audit.logSuccess(
        "VENDOR_SETTLEMENT_INITIATED",
        "payment",
        "payment",
        payment.id,
        { vendor_id: settlement.vendor_id },
      );

      console.log(`[cashfree-split-webhook] Settlement initiated for payment ${payment.id}`);

    // ── VENDOR_SETTLEMENT_SUCCESS ─────────────────────────────────────
    } else if (eventType === "VENDOR_SETTLEMENT_SUCCESS") {
      const amountSettled = settlement.amount_settled ?? 0;
      const serviceCharge = settlement.service_charge ?? 0;

      await supabase
        .from("payments")
        .update({
          landlord_payout_status: "settled",
          landlord_payout_at: settlement.settlement_date ?? new Date().toISOString(),
          gateway_payout_utr: settlement.utr ?? null,
          net_collected_paise: Math.round(amountSettled * 100),
          actual_pg_fee_paise: Math.round(serviceCharge * 100),
        })
        .eq("id", payment.id)
        .in("landlord_payout_status", ["pending", "processing"]);

      await audit.logSuccess(
        "VENDOR_SETTLEMENT_SUCCESS",
        "payment",
        "payment",
        payment.id,
        {
          vendor_id: settlement.vendor_id,
          utr: settlement.utr,
          amount_settled: amountSettled,
          service_charge: serviceCharge,
        },
      );

      console.log(`[cashfree-split-webhook] Settled payment ${payment.id}, UTR: ${settlement.utr}`);

      // Notify tenant
      if (payment.user_id) {
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        notifyUser(supabaseUrl, serviceKey, {
          user_id: payment.user_id,
          notification_type: "settlement_complete",
          template_vars: {
            amount: ((payment.rent_amount_paise as number) / 100).toLocaleString("en-IN"),
            utr: settlement.utr ?? "N/A",
          },
          related_entity_type: "payment",
          related_entity_id: payment.id,
        }).catch((e) => console.error("[cashfree-split-webhook] Notify failed:", e));
      }

    // ── VENDOR_SETTLEMENT_FAILED / REVERSED ───────────────────────────
    } else if (eventType === "VENDOR_SETTLEMENT_FAILED" || eventType === "VENDOR_SETTLEMENT_REVERSED") {
      const isReversed = eventType === "VENDOR_SETTLEMENT_REVERSED";

      await supabase
        .from("payments")
        .update({ landlord_payout_status: "failed" })
        .eq("id", payment.id)
        .in("landlord_payout_status", ["pending", "processing"]);

      await audit.logFailure(
        "VENDOR_SETTLEMENT_FAILED",
        "payment",
        isReversed ? "SETTLEMENT_REVERSED" : "SETTLEMENT_FAILED",
        `Cashfree settlement ${isReversed ? "reversed" : "failed"} for payment ${payment.id}`,
        "payment",
        payment.id,
        {
          vendor_id: settlement.vendor_id,
          reason: settlement.reason,
          event_type: eventType,
        },
      );

      console.error(
        `[OPS_ALERT] ${eventType} for payment ${payment.id}`,
        isReversed ? "— requires manual review" : "",
      );

      // Notify tenant about settlement failure
      if (payment.user_id) {
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        notifyUser(supabaseUrl, serviceKey, {
          user_id: payment.user_id,
          notification_type: "settlement_failed",
          template_vars: {
            amount: ((payment.rent_amount_paise as number) / 100).toLocaleString("en-IN"),
          },
          related_entity_type: "payment",
          related_entity_id: payment.id,
        }).catch((e) => console.error("[cashfree-split-webhook] Notify failed:", e));
      }

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
