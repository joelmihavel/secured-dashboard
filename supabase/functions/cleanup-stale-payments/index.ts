/**
 * Flent Secured v2 - Cleanup Stale Payments Edge Function
 *
 * Expires stale initiated payments that have no PayU response after 30 minutes.
 * Verifies with PayU before expiring to avoid killing in-flight transactions.
 *
 * Endpoint: POST /functions/v1/cleanup-stale-payments
 * Auth: Admin API key (x-admin-key header)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { sha512 } from "../_shared/crypto.ts";
import { getCashfreeOrder, getCashfreePayments } from "../_shared/cashfree-orders.ts";
import { CF_STATUS_MAP, CF_ORDER_STATUS_MAP } from "../_shared/cashfree-errors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  try {
    // Verify this is called by a scheduled function or admin
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    if (adminKey !== expectedKey) {
      return errorResponse("Unauthorized", 401);
    }

    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    // Find stale initiated payments with no gateway confirmation
    const { data: stalePayments, error } = await supabase
      .from("payments")
      .select("id, payu_txn_id, status, created_at, payment_gateway, gateway_order_id")
      .eq("status", "initiated")
      .lt("created_at", cutoff)
      .or("and(payu_mihpayid.is.null,payment_gateway.neq.cashfree),and(gateway_payment_id.is.null,payment_gateway.eq.cashfree)")
      .limit(50);

    if (error) {
      throw error;
    }

    let expired = 0;
    let stillProcessing = 0;

    for (const payment of stalePayments ?? []) {
      if (payment.payment_gateway === 'cashfree' && payment.gateway_order_id) {
        // Verify with Cashfree
        try {
          const order = await getCashfreeOrder(payment.gateway_order_id);
          const orderStatus = String(order.order_status ?? "");

          if (orderStatus === "EXPIRED") {
            // Cashfree already expired it
            const { data: updated } = await supabase
              .from("payments")
              .update({ status: "expired", gateway_status: "EXPIRED" })
              .eq("id", payment.id)
              .eq("status", "initiated")
              .select("id")
              .maybeSingle();
            if (updated) expired++;
            continue;
          }

          if (orderStatus === "PAID" || orderStatus === "ACTIVE") {
            // Check payment attempts
            const payments_list = await getCashfreePayments(payment.gateway_order_id);
            const hasActivePayment = payments_list.some(
              (p: Record<string, unknown>) => ["SUCCESS", "PENDING"].includes(String(p.payment_status))
            );
            if (hasActivePayment) {
              stillProcessing++;
              continue;
            }
          }

          // No active payments — safe to expire
          const { data: updated } = await supabase
            .from("payments")
            .update({ status: "expired", gateway_status: orderStatus })
            .eq("id", payment.id)
            .eq("status", "initiated")
            .select("id")
            .maybeSingle();
          if (updated) expired++;
        } catch (cfError) {
          // Cashfree API error — do NOT expire; the payment may still be valid.
          // Skip this payment and let the next cleanup cycle retry.
          console.error(`Cashfree verification failed for payment ${payment.id}, skipping:`, cfError);
          continue;
        }
        continue;
      }

      // Existing PayU path (unchanged)
      if (payment.payu_txn_id) {
        // Verify with PayU before expiring
        try {
          const result = await verifyWithPayU(payment.payu_txn_id);
          if (
            result.status &&
            !["not_found", "not_initiated"].includes(String(result.status).toLowerCase())
          ) {
            stillProcessing++;
            continue; // Payment may still be processing at bank
          }
        } catch {
          // PayU verification failed - safe to expire
        }
      }

      // Expire the payment with optimistic lock
      const { data: updated } = await supabase
        .from("payments")
        .update({ status: "expired" })
        .eq("id", payment.id)
        .eq("status", "initiated")
        .select("id")
        .maybeSingle();

      if (updated) {
        expired++;
      }
    }

    return jsonResponse({
      success: true,
      data: {
        expired,
        still_processing: stillProcessing,
        total_checked: stalePayments?.length ?? 0,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// PAYU VERIFY
// ==============================================

async function verifyWithPayU(txnId: string): Promise<Record<string, unknown>> {
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
