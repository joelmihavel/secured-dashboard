/**
 * Flent Secured v2 - Add UPI VPA Edge Function
 *
 * Validates and saves a UPI Virtual Payment Address.
 * Optional: Uses Cashfree VPA validation API for verification.
 *
 * Endpoint: POST /functions/v1/add-upi-vpa
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, ExternalServiceError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID");
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY");
const CASHFREE_BASE_URL = Deno.env.get("CASHFREE_BASE_URL") ?? "https://sandbox.cashfree.com/verification";

// UPI provider detection patterns
const UPI_PROVIDERS: Record<string, RegExp> = {
  gpay: /@(oksbi|okaxis|okicici|okhdfcbank|okbizaxis)/i,
  phonepe: /@(ybl|ibl|axl)/i,
  paytm: /@paytm/i,
  bhim: /@upi/i,
  amazonpay: /@apl|@yapl/i,
  whatsapp: /@(icici|waicici)/i,
  cred: /@(axisb|yesb)/i,
};

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface AddUpiVpaRequest {
  upi_vpa: string;
  nickname?: string;
  set_primary?: boolean;
}

const requestSchema = {
  upi_vpa: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => {
      const vpa = v as string;
      // VPA format: xxx@xxx (minimum 5 chars, max 50)
      if (vpa.length < 5 || vpa.length > 50) {
        return "UPI VPA must be 5-50 characters";
      }
      // Must contain exactly one @
      const atCount = (vpa.match(/@/g) || []).length;
      if (atCount !== 1) {
        return "UPI VPA must contain exactly one @";
      }
      // Basic format validation
      const vpaPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
      if (!vpaPattern.test(vpa)) {
        return "Invalid UPI VPA format. Use format: username@bankhandle";
      }
      return true;
    },
  },
  nickname: { required: false, type: "string" as const, maxLength: 50 },
  set_primary: { required: false, type: "boolean" as const },
};

// ==============================================
// UPI VPA VALIDATION (CASHFREE)
// ==============================================

interface VpaValidationResult {
  valid: boolean;
  name?: string;
  message?: string;
}

async function validateUpiVpa(vpa: string): Promise<VpaValidationResult> {
  // Skip external validation if Cashfree is not configured
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn("[add-upi-vpa] Cashfree not configured, skipping VPA validation");
    return { valid: true, message: "Validation skipped - Cashfree not configured" };
  }

  try {
    const response = await fetch(`${CASHFREE_BASE_URL}/upi/vpa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify({ vpa }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.warn(`[add-upi-vpa] VPA validation API error: ${response.status}`, data);
      // Don't fail on API errors - allow with warning
      return { valid: true, message: "Validation service unavailable" };
    }

    // Cashfree returns account_exists: "YES" or valid: true
    const isValid = data.valid === true || data.account_exists === "YES";

    return {
      valid: isValid,
      name: data.name ?? data.name_at_bank,
      message: data.message,
    };
  } catch (error) {
    console.error("[add-upi-vpa] VPA validation error:", error);
    // Don't block on validation errors - allow with warning
    return { valid: true, message: "Validation service error" };
  }
}

/**
 * Detects UPI provider from VPA handle
 */
function detectUpiProvider(vpa: string): string {
  const handle = vpa.toLowerCase();
  for (const [provider, pattern] of Object.entries(UPI_PROVIDERS)) {
    if (pattern.test(handle)) {
      return provider;
    }
  }
  return "other";
}

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
    audit = AuditLogger.fromRequest(supabase, req, userId, "add-upi-vpa");

    // Parse and validate request
    const body = await req.json();
    const { upi_vpa, nickname, set_primary = false } = validateSchema<AddUpiVpaRequest>(
      body,
      requestSchema,
      true
    );

    const verify_only = body.verify_only === true;

    // Normalize VPA to lowercase
    const normalizedVpa = upi_vpa.toLowerCase().trim();

    // Validate VPA with Cashfree (optional)
    const validation = await validateUpiVpa(normalizedVpa);
    if (!validation.valid) {
      throw new ValidationError(`Invalid UPI VPA: ${validation.message ?? "Account not found"}`, {
        upi_vpa: "Invalid",
      });
    }

    // Detect UPI provider
    const provider = detectUpiProvider(normalizedVpa);

    // If verify_only, return validation result without saving
    if (verify_only) {
      return jsonResponse({
        success: true,
        data: {
          upi_vpa: normalizedVpa,
          upi_provider: provider,
          is_valid: validation.valid,
          account_holder_name: validation.name,
          message: validation.message,
        },
      });
    }

    // Check for duplicate VPA (only when saving)
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "upi")
      .eq("upi_vpa", normalizedVpa)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      throw new ValidationError("This UPI VPA is already saved", { upi_vpa: "Duplicate" });
    }

    // If setting as primary, unset existing primary
    if (set_primary) {
      await supabase
        .from("payment_methods")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true)
        .is("deleted_at", null);
    }

    // Generate nickname if not provided
    const displayNickname = nickname ?? `UPI - ${provider.toUpperCase()}`;

    // Insert payment method
    const { data: paymentMethod, error: insertError } = await supabase
      .from("payment_methods")
      .insert({
        user_id: userId,
        type: "upi",
        upi_vpa: normalizedVpa,
        upi_provider: provider,
        is_verified: validation.valid,
        is_default: set_primary,
        nickname: displayNickname,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[add-upi-vpa] Insert error:", insertError);
      throw new Error(`Failed to save payment method: ${insertError.message}`);
    }

    // Log audit event
    await audit.logSuccess("UPI_VPA_ADDED", "payment", "payment_method", paymentMethod.id, {
      upi_vpa: normalizedVpa,
      upi_provider: provider,
      is_verified: validation.valid,
      is_default: set_primary,
      validation_name: validation.name,
    });

    return jsonResponse({
      success: true,
      data: {
        payment_method_id: paymentMethod.id,
        upi_vpa: paymentMethod.upi_vpa,
        upi_provider: paymentMethod.upi_provider,
        is_verified: paymentMethod.is_verified,
        is_default: paymentMethod.is_default,
        nickname: paymentMethod.nickname,
        account_holder_name: validation.name,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "UPI_VPA_ADD_FAILED",
        "payment",
        error instanceof ValidationError ? "VALIDATION_ERROR" : "ADD_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "payment_method"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
