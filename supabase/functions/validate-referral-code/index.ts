/**
 * Flent Secured v2 - Validate Referral Code Edge Function
 *
 * Validates a referral code without applying it.
 * Returns code details if valid.
 *
 * Endpoint: POST /functions/v1/validate-referral-code  (body: { code: "XXXXXX" })
 *       OR: GET  /functions/v1/validate-referral-code?code=XXXXXX
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";

// ==============================================
// TYPES
// ==============================================

// RPC result type from validate_referral_code function
interface ValidateReferralResult {
  is_valid: boolean;
  code_id: string | null;
  owner_name: string | null;
  reward_type: string | null;
  reward_amount_paise: number | null;
  priority_boost: number | null;
  error_message: string | null;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  // Accept both GET (query params) and POST (JSON body) for mobile client compatibility
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405, headers);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Extract code from query params (GET) or body (POST)
    let code: string | undefined;

    if (req.method === "GET") {
      const url = new URL(req.url);
      code = url.searchParams.get("code")?.trim().toUpperCase();
    } else {
      // POST - read from JSON body
      try {
        const body = await req.json();
        code = typeof body.code === "string" ? body.code.trim().toUpperCase() : undefined;
      } catch {
        throw new ValidationError("Invalid JSON body", { body: "Must be valid JSON" });
      }
    }

    if (!code) {
      throw new ValidationError("Referral code is required", { code: "Required" });
    }

    // Validate code format (alphanumeric, 4-10 chars)
    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      return jsonResponse({
        success: true,
        data: {
          is_valid: false,
          error_message: "Invalid referral code format",
        },
      }, 200, headers);
    }

    // Check if user already has a referral applied
    const { data: existingApplication } = await supabase
      .from("referral_applications")
      .select("id, referral_code_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingApplication) {
      return jsonResponse({
        success: true,
        data: {
          is_valid: false,
          error_message: "You have already applied a referral code",
          already_applied: true,
        },
      }, 200, headers);
    }

    // Call database function to validate
    const { data: rpcResult, error: validationError } = await supabase
      .rpc("validate_referral_code", { p_code: code })
      .single();

    if (validationError) {
      console.error("[validate-referral-code] Validation error:", validationError);
      throw new Error("Failed to validate referral code");
    }

    // Type assertion for RPC result
    const validationResult = rpcResult as ValidateReferralResult | null;

    // Check if it's the user's own code
    if (validationResult?.code_id) {
      const { data: userOwnCode } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("id", validationResult.code_id)
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (userOwnCode) {
        return jsonResponse({
          success: true,
          data: {
            is_valid: false,
            error_message: "You cannot use your own referral code",
          },
        }, 200, headers);
      }
    }

    if (!validationResult?.is_valid) {
      return jsonResponse({
        success: true,
        data: {
          is_valid: false,
          error_message: validationResult?.error_message || "Invalid referral code",
        },
      }, 200, headers);
    }

    // Return valid code details
    return jsonResponse({
      success: true,
      data: {
        is_valid: true,
        code: code,
        referred_by: validationResult.owner_name
          ? `Referred by ${validationResult.owner_name.split(" ")[0]}`
          : null,
        reward_type: validationResult.reward_type,
        reward_details: {
          cashback_paise: validationResult.reward_amount_paise || 0,
          cashback_rupees: validationResult.reward_amount_paise
            ? (validationResult.reward_amount_paise / 100).toFixed(0)
            : "0",
          priority_boost: validationResult.priority_boost || 0,
        },
        message: getRewardMessage(
          validationResult.reward_type,
          validationResult.reward_amount_paise,
          validationResult.priority_boost
        ),
      },
    }, 200, headers);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

/**
 * Generates a human-readable reward message
 */
function getRewardMessage(
  rewardType: string | null,
  cashbackPaise: number | null,
  priorityBoost: number | null
): string {
  const rewards: string[] = [];

  if (rewardType === "cashback" || rewardType === "both") {
    if (cashbackPaise && cashbackPaise > 0) {
      rewards.push(`Rs. ${(cashbackPaise / 100).toFixed(0)} cashback`);
    }
  }

  if (rewardType === "priority" || rewardType === "both") {
    if (priorityBoost && priorityBoost > 0) {
      rewards.push(`priority boost in waitlist`);
    }
  }

  if (rewards.length === 0) {
    return "Valid referral code";
  }

  return `You'll get ${rewards.join(" and ")} when you apply this code!`;
}
