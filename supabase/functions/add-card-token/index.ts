/**
 * Flent Secured v2 - Add Card Token Edge Function
 *
 * Saves a tokenized card from PayU.
 * The card_token is stored encrypted for PCI-DSS compliance.
 *
 * Endpoint: POST /functions/v1/add-card-token
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { encrypt } from "../_shared/crypto.ts";

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface AddCardTokenRequest {
  card_token: string;
  card_last4: string;
  card_network: string;
  card_type: string;
  card_issuer?: string;
  card_expiry_month: number;
  card_expiry_year: number;
  nickname?: string;
  set_primary?: boolean;
}

const requestSchema = {
  card_token: {
    required: true,
    type: "string" as const,
    minLength: 10,
    custom: (v: unknown) => {
      const token = v as string;
      // PayU tokens are typically alphanumeric
      if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
        return "Invalid card token format";
      }
      return true;
    },
  },
  card_last4: {
    required: true,
    type: "string" as const,
    pattern: /^\d{4}$/,
    custom: (v: unknown) => {
      const last4 = v as string;
      if (last4.length !== 4 || !/^\d+$/.test(last4)) {
        return "card_last4 must be exactly 4 digits";
      }
      return true;
    },
  },
  card_network: {
    required: true,
    type: "string" as const,
    enum: ["visa", "mastercard", "rupay", "amex", "maestro"],
  },
  card_type: {
    required: true,
    type: "string" as const,
    enum: ["credit", "debit"],
  },
  card_issuer: { required: false, type: "string" as const, maxLength: 100 },
  card_expiry_month: {
    required: false,
    type: "number" as const,
    custom: (v: unknown) => {
      if (v == null) return true; // optional
      const month = v as number;
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return "card_expiry_month must be between 1 and 12";
      }
      return true;
    },
  },
  card_expiry_year: {
    required: false,
    type: "number" as const,
    custom: (v: unknown) => {
      if (v == null) return true; // optional
      const year = v as number;
      const currentYear = new Date().getFullYear();
      const maxYear = currentYear + 20;
      if (!Number.isInteger(year) || year < currentYear || year > maxYear) {
        return `card_expiry_year must be between ${currentYear} and ${maxYear}`;
      }
      return true;
    },
  },
  nickname: { required: false, type: "string" as const, maxLength: 50 },
  set_primary: { required: false, type: "boolean" as const },
};

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Validates card expiry is not in the past
 */
function validateCardExpiry(month: number, year: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
}

/**
 * Formats card network name for display
 */
function formatNetworkName(network: string): string {
  const networkNames: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    rupay: "RuPay",
    amex: "American Express",
    maestro: "Maestro",
  };
  return networkNames[network.toLowerCase()] ?? network;
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "add-card-token");

    // Parse and validate request
    const body = await req.json();
    const {
      card_token,
      card_last4,
      card_network,
      card_type,
      card_issuer,
      card_expiry_month,
      card_expiry_year,
      nickname,
      set_primary = false,
    } = validateSchema<AddCardTokenRequest>(body, requestSchema, true);

    // Validate card is not expired (only when expiry is provided)
    if (card_expiry_month && card_expiry_year && !validateCardExpiry(card_expiry_month, card_expiry_year)) {
      throw new ValidationError("Card has expired", { card_expiry: "Expired" });
    }

    // Encrypt the card token before storage
    let encryptedToken: string;
    try {
      encryptedToken = await encrypt(card_token);
    } catch (encryptError) {
      console.error("[add-card-token] Encryption error:", encryptError);
      throw new Error("Failed to securely store card token");
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
    const networkDisplay = formatNetworkName(card_network);
    const displayNickname = nickname ?? `${networkDisplay} ending in ${card_last4}`;

    // Check for existing card (same last4 and network) — webhook may have created a
    // record without token. Upsert: update existing with token, or insert new.
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "card")
      .eq("card_last4", card_last4)
      .eq("card_network", card_network.toLowerCase())
      .is("deleted_at", null)
      .maybeSingle();

    let paymentMethod: Record<string, unknown>;

    if (existing) {
      // Update existing record with the token (webhook may have created it without one)
      const { data: updated, error: updateError } = await supabase
        .from("payment_methods")
        .update({
          card_token: encryptedToken,
          card_type: card_type.toLowerCase(),
          card_issuer,
          card_expiry_month,
          card_expiry_year,
          is_verified: true,
          is_default: set_primary,
          nickname: displayNickname,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("[add-card-token] Update error:", updateError);
        throw new Error(`Failed to update payment method: ${updateError.message}`);
      }
      paymentMethod = updated;
      console.log("[add-card-token] Updated existing card record with token:", existing.id);
    } else {
      // Insert new payment method
      const { data: inserted, error: insertError } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          type: "card",
          card_token: encryptedToken,
          card_last4,
          card_network: card_network.toLowerCase(),
          card_type: card_type.toLowerCase(),
          card_issuer,
          card_expiry_month,
          card_expiry_year,
          is_verified: true,
          is_default: set_primary,
          nickname: displayNickname,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[add-card-token] Insert error:", insertError);
        throw new Error(`Failed to save payment method: ${insertError.message}`);
      }
      paymentMethod = inserted;
    }

    // Log audit event (do not log actual token)
    await audit.logSuccess("CARD_TOKEN_ADDED", "payment", "payment_method", paymentMethod.id, {
      card_last4,
      card_network: card_network.toLowerCase(),
      card_type: card_type.toLowerCase(),
      card_issuer,
      card_expiry_month,
      card_expiry_year,
      is_default: set_primary,
    });

    return jsonResponse({
      success: true,
      data: {
        payment_method_id: paymentMethod.id,
        card_last4: paymentMethod.card_last4,
        card_network: paymentMethod.card_network,
        card_type: paymentMethod.card_type,
        card_issuer: paymentMethod.card_issuer,
        card_expiry_month: paymentMethod.card_expiry_month,
        card_expiry_year: paymentMethod.card_expiry_year,
        is_default: paymentMethod.is_default,
        nickname: paymentMethod.nickname,
      },
    });
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "CARD_TOKEN_ADD_FAILED",
        "payment",
        error instanceof ValidationError ? "VALIDATION_ERROR" : "ADD_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "payment_method"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
