/**
 * Flent Secured v2 - Cashfree Vendor Status Webhook
 *
 * Handles VENDOR_STATUS_UPDATE events from Cashfree Easy Split.
 * Updates bank_accounts.cf_beneficiary_status when a vendor becomes
 * ACTIVE, BLOCKED, ACTION_REQUIRED, etc.
 *
 * Endpoint: POST /functions/v1/cashfree-vendor-webhook
 * Auth: HMAC-SHA256 Base64 signature via x-webhook-signature header
 * Secret: CASHFREE_VENDOR_WEBHOOK_SECRET (preferred) — set separately from
 *         CASHFREE_PG_APP_SECRET so a PG-secret leak can't forge vendor
 *         status updates. See cashfree-split-webhook for the phased
 *         rollout pattern; same applies here.
 *
 * Register URL in Cashfree dashboard → Webhooks → Easy Split → Vendor Status Change:
 *   https://{project-ref}.supabase.co/functions/v1/cashfree-vendor-webhook
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { hmacSha256Base64, timingSafeCompare } from "../_shared/crypto.ts";
import { AuditLogger } from "../_shared/audit.ts";

// Resolve the signing secret with explicit precedence + warning on fallback.
const VENDOR_SECRET = Deno.env.get("CASHFREE_VENDOR_WEBHOOK_SECRET");
const PG_SECRET = Deno.env.get("CASHFREE_PG_APP_SECRET") ?? Deno.env.get("CASHFREE_PG_SECRET_KEY");
const CF_WEBHOOK_SECRET = VENDOR_SECRET ?? PG_SECRET;
if (!CF_WEBHOOK_SECRET) {
  console.error(
    "[cashfree-vendor-webhook] FATAL: neither CASHFREE_VENDOR_WEBHOOK_SECRET nor CASHFREE_PG_APP_SECRET is set",
  );
}
if (!VENDOR_SECRET && PG_SECRET) {
  console.warn(
    "[cashfree-vendor-webhook] Using PG secret as fallback. Set CASHFREE_VENDOR_WEBHOOK_SECRET to a separate value to remove this warning.",
  );
}

interface VendorStatusPayload {
  type: string; // VENDOR_STATUS_UPDATE
  event_time: string;
  data: {
    merchant_vendor_id?: string;
    updated_status?: string;
    past_status?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    const rawBody = await req.text();

    // Verify signature
    const receivedSignature = req.headers.get("x-webhook-signature") ?? "";
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";

    if (!receivedSignature || !timestamp) {
      console.error("[cashfree-vendor-webhook] Missing signature or timestamp headers");
      return jsonResponse({ status: "ignored", reason: "missing headers" });
    }

    const expectedSignature = await hmacSha256Base64(timestamp + rawBody, CF_WEBHOOK_SECRET);
    if (!timingSafeCompare(receivedSignature, expectedSignature)) {
      console.error("[cashfree-vendor-webhook] Signature verification failed");
      return jsonResponse({ status: "ignored", reason: "invalid signature" });
    }

    // Observe-only freshness window (Phase 7e). See cashfree-split-webhook for
    // rationale. Flip `console.warn` to `return jsonResponse(...ignored stale)`
    // once observation confirms legitimate traffic stays inside 5 min.
    const tsSec = parseInt(timestamp, 10);
    if (Number.isFinite(tsSec) && tsSec > 0) {
      const ageSec = Math.floor(Date.now() / 1000) - tsSec;
      if (ageSec > 300) {
        console.warn(
          `[cashfree-vendor-webhook] STALE_TIMESTAMP age=${ageSec}s timestamp=${timestamp} (observe-only — see Phase 7e)`,
        );
      }
    }

    let payload: VendorStatusPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ status: "ignored", reason: "invalid json" });
    }

    if (payload.type !== "VENDOR_STATUS_UPDATE") {
      console.log(`[cashfree-vendor-webhook] Ignoring event type: ${payload.type}`);
      return jsonResponse({ status: "ignored", reason: "not a vendor status event" });
    }

    const vendorId = payload.data?.merchant_vendor_id;
    const newStatus = payload.data?.updated_status;
    const oldStatus = payload.data?.past_status;

    if (!vendorId || !newStatus) {
      return jsonResponse({ status: "ignored", reason: "missing vendor_id or status" });
    }

    console.log(`[cashfree-vendor-webhook] Vendor ${vendorId}: ${oldStatus} → ${newStatus}`);

    // Update bank_accounts.cf_beneficiary_status
    const { data: updated, error: updateError } = await supabase
      .from("bank_accounts")
      .update({ cf_beneficiary_status: newStatus })
      .eq("cf_beneficiary_id", vendorId)
      .select("id, user_id")
      .maybeSingle();

    if (updateError) {
      console.error(`[cashfree-vendor-webhook] DB update failed for vendor ${vendorId}:`, updateError);
    } else if (!updated) {
      console.warn(`[cashfree-vendor-webhook] No bank_account found for cf_beneficiary_id=${vendorId}`);
    } else {
      console.log(`[cashfree-vendor-webhook] Updated bank_account ${updated.id} to ${newStatus}`);
    }

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "cashfree-vendor-webhook",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    await audit.logSuccess(
      "VENDOR_STATUS_CHANGED",
      "payment",
      "bank_account",
      updated?.id,
      {
        vendor_id: vendorId,
        old_status: oldStatus,
        new_status: newStatus,
        user_id: updated?.user_id,
      },
    );

    // Alert on terminal/problematic vendor statuses that block payouts
    const ALERT_STATUSES = ["BLOCKED", "BENE_CREATION_FAILED", "BANK_VALIDATION_FAILED", "ACTION_REQUIRED"];
    if (ALERT_STATUSES.includes(newStatus)) {
      console.error(`[OPS_ALERT] Vendor ${vendorId} is ${newStatus} — landlord payouts will fail, manual intervention required`);

      await audit.logFailure(
        "VENDOR_STATUS_ALERT",
        "landlord",
        newStatus,
        `Cashfree vendor ${vendorId} status changed to ${newStatus} — payouts blocked`,
        "bank_account",
        updated?.id,
        {
          vendor_id: vendorId,
          old_status: oldStatus,
          new_status: newStatus,
          user_id: updated?.user_id,
        },
      );
    }

    return jsonResponse({ status: "success", message: "Vendor status updated" });
  } catch (error) {
    console.error("[cashfree-vendor-webhook] Error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
