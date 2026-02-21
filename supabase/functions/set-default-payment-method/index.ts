/**
 * Flent Secured v2 - Set Default Payment Method Edge Function
 *
 * Sets a payment method as the user's default, unsetting any previous default.
 *
 * Endpoint: POST /functions/v1/set-default-payment-method
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-02-21
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

interface SetDefaultPaymentMethodRequest {
  payment_method_id: string;
}

const requestSchema = {
  payment_method_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid payment method ID",
  },
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "set-default-payment-method");

    // Parse and validate request
    const body = await req.json();
    const { payment_method_id } = validateSchema<SetDefaultPaymentMethodRequest>(
      body,
      requestSchema,
      true
    );

    // Verify the payment method exists and belongs to user
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

    // Unset all user's methods as default
    const { error: unsetError } = await supabase
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (unsetError) {
      console.error("[set-default-payment-method] Unset default error:", unsetError);
      throw new Error(`Failed to update payment methods: ${unsetError.message}`);
    }

    // Set the requested method as default
    const { data: updatedMethod, error: setError } = await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", payment_method_id)
      .select()
      .single();

    if (setError) {
      console.error("[set-default-payment-method] Set default error:", setError);
      throw new Error(`Failed to set default payment method: ${setError.message}`);
    }

    // Log audit event
    await audit.logSuccess(
      "DEFAULT_PAYMENT_METHOD_SET",
      "payment",
      "payment_method",
      payment_method_id,
      {
        payment_type: updatedMethod.type,
        nickname: updatedMethod.nickname,
      }
    );

    return jsonResponse({
      success: true,
      data: {
        payment_method_id: updatedMethod.id,
        type: updatedMethod.type,
        is_default: updatedMethod.is_default,
        nickname: updatedMethod.nickname,
        upi_vpa: updatedMethod.upi_vpa,
        card_last4: updatedMethod.card_last4,
        card_network: updatedMethod.card_network,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "SET_DEFAULT_PAYMENT_METHOD_FAILED",
        "payment",
        error instanceof NotFoundError ? "NOT_FOUND" : "UPDATE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "payment_method"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
