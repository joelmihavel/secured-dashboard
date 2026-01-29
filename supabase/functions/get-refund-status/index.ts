/**
 * Flent Secured v2 - Get Refund Status Edge Function
 *
 * Retrieves the status of a refund request.
 *
 * Endpoint: GET /functions/v1/get-refund-status?refund_id=xxx
 *           GET /functions/v1/get-refund-status?payment_id=xxx
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, NotFoundError, handleError } from "../_shared/errors.ts";
import { isValidUuid } from "../_shared/validation.ts";

// ==============================================
// STATUS DESCRIPTIONS
// ==============================================

const STATUS_DESCRIPTIONS: Record<string, string> = {
  requested: "Refund request has been submitted",
  processing: "Refund is being processed by the payment gateway",
  completed: "Refund has been credited to your account",
  failed: "Refund failed. Please contact support.",
  rejected: "Refund request was rejected",
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse query parameters
    const url = new URL(req.url);
    const refundId = url.searchParams.get("refund_id");
    const paymentId = url.searchParams.get("payment_id");

    if (!refundId && !paymentId) {
      throw new ValidationError("Either refund_id or payment_id is required");
    }

    // Validate IDs
    if (refundId && !isValidUuid(refundId)) {
      throw new ValidationError("Invalid refund_id format");
    }
    if (paymentId && !isValidUuid(paymentId)) {
      throw new ValidationError("Invalid payment_id format");
    }

    // Build query
    let query = supabase
      .from("refunds")
      .select(`
        id,
        payment_id,
        amount_paise,
        status,
        reason,
        rejection_reason,
        payu_refund_id,
        payu_status,
        cashback_reversed_paise,
        requested_at,
        processed_at,
        completed_at,
        created_at,
        payment:payments(
          id,
          rent_amount_paise,
          total_amount_paise,
          payment_month,
          tenancy:tenancies(user_id)
        )
      `)
      .eq("user_id", userId);

    if (refundId) {
      query = query.eq("id", refundId);
    } else if (paymentId) {
      query = query.eq("payment_id", paymentId);
    }

    const { data: refunds, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("[get-refund-status] Query error:", error);
      throw new Error("Failed to fetch refund status");
    }

    // If querying by refund_id, return single refund
    if (refundId) {
      if (!refunds || refunds.length === 0) {
        throw new NotFoundError("Refund", refundId);
      }

      const refund = refunds[0];

      return jsonResponse({
        success: true,
        data: {
          refund_id: refund.id,
          payment_id: refund.payment_id,
          amount_paise: refund.amount_paise,
          amount_rupees: (refund.amount_paise / 100).toFixed(2),
          status: refund.status,
          status_description: STATUS_DESCRIPTIONS[refund.status] || refund.status,
          reason: refund.reason,
          rejection_reason: refund.rejection_reason,
          payu_refund_id: refund.payu_refund_id,
          payu_status: refund.payu_status,
          cashback_reversed_paise: refund.cashback_reversed_paise,
          requested_at: refund.requested_at,
          processed_at: refund.processed_at,
          completed_at: refund.completed_at,
          estimated_completion: refund.status === "processing"
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        },
      });
    }

    // If querying by payment_id, return all refunds for that payment
    if (!refunds || refunds.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          payment_id: paymentId,
          refunds: [],
          total_refunded_paise: 0,
        },
      });
    }

    // Calculate total refunded
    const totalRefundedPaise = refunds.reduce((sum, r) => {
      return sum + (r.status === "completed" ? r.amount_paise : 0);
    }, 0);

    const totalPendingPaise = refunds.reduce((sum, r) => {
      return sum + (["requested", "processing"].includes(r.status) ? r.amount_paise : 0);
    }, 0);

    return jsonResponse({
      success: true,
      data: {
        payment_id: paymentId,
        refunds: refunds.map((r) => ({
          refund_id: r.id,
          amount_paise: r.amount_paise,
          amount_rupees: (r.amount_paise / 100).toFixed(2),
          status: r.status,
          status_description: STATUS_DESCRIPTIONS[r.status] || r.status,
          reason: r.reason,
          rejection_reason: r.rejection_reason,
          payu_refund_id: r.payu_refund_id,
          requested_at: r.requested_at,
          completed_at: r.completed_at,
        })),
        total_refunded_paise: totalRefundedPaise,
        total_refunded_rupees: (totalRefundedPaise / 100).toFixed(2),
        total_pending_paise: totalPendingPaise,
        total_pending_rupees: (totalPendingPaise / 100).toFixed(2),
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
