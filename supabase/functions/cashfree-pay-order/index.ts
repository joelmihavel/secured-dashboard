/**
 * Flent Secured v2 - Cashfree Pay Order
 *
 * Proxies Cashfree Order Pay API for headless payment methods:
 * - UPI Collect (sends collect request to VPA)
 * - Net Banking (returns redirect URL)
 *
 * SECURITY: Validates payment ownership before forwarding to Cashfree.
 *
 * Endpoint: POST /functions/v1/cashfree-pay-order
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CF_APP_ID = Deno.env.get("CASHFREE_PG_APP_ID")!;
const CF_SECRET_KEY = Deno.env.get("CASHFREE_PG_APP_SECRET") ?? Deno.env.get("CASHFREE_PG_SECRET_KEY")!;
const CF_BASE_URL = (
  Deno.env.get("CASHFREE_PG_BASE_URL") ?? "https://sandbox.cashfree.com"
).replace(/\/$/, "");
const CF_API_VERSION = "2025-01-01";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Auth — uses getSession() internally via createAuthenticatedClient
    // NOTE: createAuthenticatedClient uses getUser() which is server-side (edge function),
    // not client-side, so it is safe here. Project rule #33 applies to the RN client only.
    const authHeader = req.headers.get("Authorization");
    const { userId, user } = await createAuthenticatedClient(authHeader);

    const body = await req.json();
    const { payment_session_id, payment_method, cf_order_id } = body;

    if (!payment_session_id || !payment_method) {
      return errorResponse("Missing payment_session_id or payment_method", 400);
    }

    // Client sends payment_method as an object: { upi: { channel: 'collect', upi_id: '...' } }
    // or { netbanking: { channel: 'link', netbanking_bank_code: '...' } }
    // Validate the top-level key, not the object itself
    const VALID_METHODS = ["upi", "netbanking"];
    const methodKey = typeof payment_method === "object" && payment_method !== null
      ? Object.keys(payment_method)[0]
      : String(payment_method);
    if (!VALID_METHODS.includes(methodKey)) {
      return errorResponse(`Invalid payment_method: must be one of ${VALID_METHODS.join(", ")}`, 400);
    }

    if (!cf_order_id) {
      return errorResponse("Missing cf_order_id", 400);
    }

    // SECURITY: Ownership validation
    const serviceClient = createServiceClient();
    const { data: payment, error: lookupErr } = await serviceClient
      .from("payments")
      .select("id, user_id, cf_order_id, status")
      .eq("cf_order_id", cf_order_id)
      .single();

    if (!payment) {
      console.error(
        `[cashfree-pay-order] Payment not found for cf_order_id=${cf_order_id}`,
        lookupErr
      );
      return errorResponse("Payment not found", 404);
    }

    if (payment.user_id !== userId) {
      console.error(
        `[cashfree-pay-order] Ownership violation: user ${userId} tried to pay order owned by ${payment.user_id}`
      );
      return errorResponse("Forbidden", 403);
    }

    if (payment.status !== "initiated" && payment.status !== "processing") {
      return errorResponse(
        `Payment in terminal state: ${payment.status}`,
        400
      );
    }

    // Proxy to Cashfree Order Pay API (sessions endpoint)
    // See: https://docs.cashfree.com/reference/pg-pay-order
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let cfResponse: Response;
    try {
      cfResponse = await fetch(`${CF_BASE_URL}/pg/orders/sessions`, {
        method: "POST",
        headers: {
          "x-client-id": CF_APP_ID,
          "x-client-secret": CF_SECRET_KEY,
          "x-api-version": CF_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_session_id,
          payment_method,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return errorResponse("Cashfree API timed out", 504);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const cfData = await cfResponse.json();

    if (!cfResponse.ok) {
      console.error(`[cashfree-pay-order] Cashfree error:`, cfData);
      return errorResponse(
        cfData.message ?? "Cashfree payment failed",
        cfResponse.status
      );
    }

    // Update payment status to processing (idempotent — only if still initiated)
    await serviceClient
      .from("payments")
      .update({ status: "processing" })
      .eq("id", payment.id)
      .eq("status", "initiated");

    return jsonResponse({ success: true, data: cfData });
  } catch (err) {
    console.error("[cashfree-pay-order] Error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal error",
      500
    );
  }
});
