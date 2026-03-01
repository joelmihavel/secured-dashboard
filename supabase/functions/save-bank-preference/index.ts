/**
 * Flent Secured v2 - Save Bank Preference Edge Function
 *
 * Upserts a netbanking bank preference for the user.
 * If the user already has a netbanking method, updates it;
 * otherwise creates a new one.
 *
 * Endpoint: POST /functions/v1/save-bank-preference
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface SaveBankPreferenceRequest {
  bank_code: string;
  bank_name: string;
  set_primary?: boolean;
}

const requestSchema = {
  bank_code: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => {
      const code = v as string;
      if (code.length < 2 || code.length > 10) {
        return "Bank code must be 2-10 characters";
      }
      if (!/^[A-Z0-9]+$/i.test(code)) {
        return "Invalid bank code format";
      }
      return true;
    },
  },
  bank_name: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => {
      const name = v as string;
      if (name.trim().length < 2 || name.length > 100) {
        return "Bank name must be 2-100 characters";
      }
      return true;
    },
  },
  set_primary: { required: false, type: "boolean" as const },
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "save-bank-preference");

    // Parse and validate request
    const body = await req.json();
    const { bank_code, bank_name, set_primary = true } = validateSchema<SaveBankPreferenceRequest>(
      body,
      requestSchema,
      true
    );

    const normalizedCode = bank_code.toUpperCase().trim();
    const normalizedName = bank_name.trim();

    // Check if user already has a netbanking method
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "netbanking")
      .is("deleted_at", null)
      .maybeSingle();

    let paymentMethod;

    if (existing) {
      // Update existing netbanking method
      const { data: updated, error: updateError } = await supabase
        .from("payment_methods")
        .update({
          bank_code: normalizedCode,
          bank_name: normalizedName,
          nickname: `Net Banking - ${normalizedName}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("[save-bank-preference] Update error:", updateError);
        throw new Error(`Failed to update bank preference: ${updateError.message}`);
      }
      paymentMethod = updated;
    } else {
      // Insert new netbanking method
      const { data: inserted, error: insertError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          type: "netbanking",
          display_name: `Net Banking - ${normalizedName}`,
          bank_code: normalizedCode,
          bank_name: normalizedName,
          is_verified: true,
          is_default: set_primary,
          nickname: `Net Banking - ${normalizedName}`,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[save-bank-preference] Insert error:", insertError);
        throw new Error(`Failed to save bank preference: ${insertError.message}`);
      }
      paymentMethod = inserted;
    }

    // If setting as primary, unset other defaults
    if (set_primary) {
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true)
        .neq("id", paymentMethod.id)
        .is("deleted_at", null);

      // Set this one as default
      await supabase
        .from("payment_methods")
        .update({ is_default: true })
        .eq("id", paymentMethod.id);
    }

    // Log audit event
    await audit.logSuccess(
      existing ? "BANK_PREFERENCE_UPDATED" : "BANK_PREFERENCE_ADDED",
      "payment",
      "payment_method",
      paymentMethod.id,
      {
        bank_code: normalizedCode,
        bank_name: normalizedName,
        is_default: set_primary,
        was_update: !!existing,
      }
    );

    return jsonResponse({
      success: true,
      data: {
        payment_method_id: paymentMethod.id,
        bank_code: paymentMethod.bank_code,
        bank_name: paymentMethod.bank_name,
        is_default: set_primary,
        nickname: paymentMethod.nickname,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "BANK_PREFERENCE_SAVE_FAILED",
        "payment",
        error instanceof ValidationError ? "VALIDATION_ERROR" : "SAVE_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "payment_method"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
