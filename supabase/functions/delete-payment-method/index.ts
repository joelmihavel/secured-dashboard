/**
 * Flent Secured v2 - Delete Payment Method Edge Function
 *
 * Soft deletes a payment method and reassigns primary if needed.
 *
 * Endpoint: POST /functions/v1/delete-payment-method
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, NotFoundError, handleError } from "../_shared/errors.ts";
import { validateSchema, isValidUuid } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface DeletePaymentMethodRequest {
  payment_method_id: string;
  hard_delete?: boolean; // Default: false (soft delete)
}

const requestSchema = {
  payment_method_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid payment method ID",
  },
  hard_delete: { required: false, type: "boolean" as const },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "delete-payment-method");

    // Parse and validate request
    const body = await req.json();
    const { payment_method_id, hard_delete = false } = validateSchema<DeletePaymentMethodRequest>(
      body,
      requestSchema,
      true
    );

    // Fetch the payment method
    const { data: paymentMethod, error: fetchError } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("id", payment_method_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !paymentMethod) {
      throw new NotFoundError("Payment method", payment_method_id);
    }

    // Check if it was the primary payment method
    const wasPrimary = paymentMethod.is_primary;
    let newPrimaryId: string | null = null;

    if (hard_delete) {
      // Hard delete - completely remove the record
      const { error: deleteError } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", payment_method_id)
        .eq("user_id", userId);

      if (deleteError) {
        console.error("[delete-payment-method] Hard delete error:", deleteError);
        throw new Error(`Failed to delete payment method: ${deleteError.message}`);
      }
    } else {
      // Soft delete - set deleted_at timestamp and remove primary flag
      const { error: updateError } = await supabase
        .from("payment_methods")
        .update({
          deleted_at: new Date().toISOString(),
          is_primary: false,
        })
        .eq("id", payment_method_id)
        .eq("user_id", userId);

      if (updateError) {
        console.error("[delete-payment-method] Soft delete error:", updateError);
        throw new Error(`Failed to delete payment method: ${updateError.message}`);
      }
    }

    // If it was primary, assign new primary to most recently created method
    if (wasPrimary) {
      const { data: newPrimary, error: newPrimaryError } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newPrimary && !newPrimaryError) {
        newPrimaryId = newPrimary.id;

        await supabase
          .from("payment_methods")
          .update({ is_primary: true })
          .eq("id", newPrimaryId);
      }
    }

    // Log audit event
    await audit.logSuccess("PAYMENT_METHOD_DELETED", "payment", "payment_method", payment_method_id, {
      payment_type: paymentMethod.type,
      was_primary: wasPrimary,
      new_primary_id: newPrimaryId,
      hard_delete,
      deleted_vpa: paymentMethod.upi_vpa,
      deleted_card_last4: paymentMethod.card_last4,
    });

    return jsonResponse({
      success: true,
      data: {
        deleted_id: payment_method_id,
        was_primary: wasPrimary,
        new_primary_id: newPrimaryId,
        hard_deleted: hard_delete,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "PAYMENT_METHOD_DELETE_FAILED",
        "payment",
        error instanceof NotFoundError ? "NOT_FOUND" : "DELETE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "payment_method"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
