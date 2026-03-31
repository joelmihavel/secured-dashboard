/**
 * Flent Secured v2 - Confirm Payout Edge Function
 *
 * Admin endpoint to confirm that a landlord payout has been manually processed.
 * Called after admin transfers money to landlord's bank via PayU dashboard / NEFT.
 *
 * Actions:
 * - Marks landlord_payout_status = 'settled'
 * - Records UTR and settlement timestamp
 * - Sends 'settlement_complete' notification to user
 * - Audit logs the confirmation
 *
 * Also supports bulk confirmation for multiple payments.
 *
 * Endpoint: POST /functions/v1/confirm-payout
 * Auth: Service role only (admin action)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { notifyUserWithFallback } from "../_shared/notifications.ts";

// ==============================================
// TYPES
// ==============================================

interface ConfirmPayoutRequest {
  payment_id?: string;
  payment_ids?: string[];
  utr: string;
  settled_at?: string; // ISO timestamp, defaults to now
  notes?: string;
}

interface PayoutResult {
  payment_id: string;
  status: "confirmed" | "skipped" | "failed";
  landlord_name?: string;
  amount_paise?: number;
  error?: string;
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
    // Verify service role authorization
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "confirm-payout",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const body: ConfirmPayoutRequest = await req.json();

    // Validate UTR
    if (!body.utr || body.utr.trim().length === 0) {
      throw new AppError("UTR is required", "VALIDATION_ERROR", 400);
    }

    // Resolve payment IDs (single or bulk)
    const paymentIds: string[] = body.payment_ids ?? (body.payment_id ? [body.payment_id] : []);
    if (paymentIds.length === 0) {
      throw new AppError("payment_id or payment_ids is required", "VALIDATION_ERROR", 400);
    }
    if (paymentIds.length > 50) {
      throw new AppError("Maximum 50 payments per batch", "VALIDATION_ERROR", 400);
    }

    const settledAt = body.settled_at ?? new Date().toISOString();
    const results: PayoutResult[] = [];

    // Fetch all payments in one query
    const { data: payments, error: queryError } = await supabase
      .from("payments")
      .select(`
        id, user_id, rent_amount_paise, landlord_payout_paise,
        landlord_payout_status,
        tenancy:tenancies(landlord_name)
      `)
      .in("id", paymentIds);

    if (queryError) {
      throw new AppError("Failed to query payments", "DB_ERROR", 500);
    }

    if (!payments || payments.length === 0) {
      throw new AppError("No payments found for given IDs", "NOT_FOUND", 404);
    }

    // Build lookup map
    const paymentMap = new Map(payments.map((p) => [p.id, p]));

    for (const paymentId of paymentIds) {
      const payment = paymentMap.get(paymentId);

      if (!payment) {
        results.push({ payment_id: paymentId, status: "failed", error: "Payment not found" });
        continue;
      }

      const tenancy = payment.tenancy as { landlord_name: string } | null;
      const payoutPaise = payment.landlord_payout_paise ?? payment.rent_amount_paise;

      // Only confirm payments in 'processing' state (already picked up by settle-to-landlord)
      if (payment.landlord_payout_status !== "processing") {
        results.push({
          payment_id: paymentId,
          status: "skipped",
          landlord_name: tenancy?.landlord_name,
          amount_paise: payoutPaise,
          error: `Cannot confirm: current status is '${payment.landlord_payout_status}' (expected 'processing')`,
        });
        continue;
      }

      // Update payment to settled
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          landlord_payout_status: "settled",
          landlord_payout_utr: body.utr,
          landlord_payout_at: settledAt,
        })
        .eq("id", paymentId)
        .eq("landlord_payout_status", "processing"); // optimistic lock

      if (updateError) {
        console.error(`Failed to confirm payout for ${paymentId}:`, updateError);
        results.push({
          payment_id: paymentId,
          status: "failed",
          landlord_name: tenancy?.landlord_name,
          amount_paise: payoutPaise,
          error: "Database update failed",
        });
        continue;
      }

      // Send settlement_complete notification to user (with queue fallback)
      if (payment.user_id) {
        const amountRupees = (payoutPaise / 100).toLocaleString("en-IN");
        notifyUserWithFallback(
          getSupabaseUrl(),
          (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
          supabase,
          {
            user_id: payment.user_id,
            notification_type: "settlement_complete",
            template_vars: {
              amount: amountRupees,
              landlord_name: tenancy?.landlord_name ?? "your landlord",
            },
            related_entity_type: "payment",
            related_entity_id: paymentId,
          },
        ).catch(() => {});
      }

      await audit.logSuccess(
        "LANDLORD_PAYOUT_CONFIRMED",
        "payment",
        "payment",
        paymentId,
        {
          utr: body.utr,
          amount_paise: payoutPaise,
          landlord_name: tenancy?.landlord_name,
          payout_ref: payment.landlord_payout_ref,
          notes: body.notes,
        },
      );

      results.push({
        payment_id: paymentId,
        status: "confirmed",
        landlord_name: tenancy?.landlord_name,
        amount_paise: payoutPaise,
      });
    }

    const confirmed = results.filter((r) => r.status === "confirmed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return jsonResponse({
      success: true,
      data: {
        total: results.length,
        confirmed,
        skipped,
        failed,
        results,
      },
    });
  } catch (error) {
    console.error("Confirm payout error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
