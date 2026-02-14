/**
 * Flent Secured v2 - Apply Referral Code Edge Function
 *
 * Applies a referral code to a user's account.
 * Increments usage count and awards rewards.
 *
 * Endpoint: POST /functions/v1/apply-referral-code
 * Auth: Required (JWT)
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { validateSchema } from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";

// ==============================================
// TYPES & VALIDATION
// ==============================================

interface ApplyReferralCodeRequest {
  code: string;
}

// RPC result type from apply_referral_code function
interface ApplyReferralResult {
  success: boolean;
  reward_type: string | null;
  reward_amount_paise: number | null;
  priority_boost: number | null;
  error_message: string | null;
}

const requestSchema = {
  code: {
    required: true,
    type: "string" as const,
    minLength: 4,
    maxLength: 10,
    custom: (v: unknown) => {
      const code = v as string;
      if (!/^[A-Za-z0-9]+$/.test(code)) {
        return "Referral code must be alphanumeric";
      }
      return true;
    },
  },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405, headers);
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
    audit = AuditLogger.fromRequest(supabase, req, userId, "apply-referral-code");

    // Parse and validate request
    const body = await req.json();
    const { code } = validateSchema<ApplyReferralCodeRequest>(body, requestSchema, true);

    const normalizedCode = code.toUpperCase().trim();

    // Check if user already has a referral applied
    const { data: existingApplication } = await supabase
      .from("referral_applications")
      .select("id, referral_code_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingApplication) {
      throw new AppError("You have already applied a referral code", "ALREADY_APPLIED", 400);
    }

    // Also check users table
    const { data: userData } = await supabase
      .from("users")
      .select("referral_code_id, referral_applied_at")
      .eq("id", userId)
      .single();

    if (userData?.referral_code_id) {
      throw new AppError("You have already applied a referral code", "ALREADY_APPLIED", 400);
    }

    // Call database function to apply the referral code
    // This handles all the logic: validation, usage increment, reward application
    const { data: rpcResult, error: applyError } = await supabase
      .rpc("apply_referral_code", {
        p_user_id: userId,
        p_code: normalizedCode,
      })
      .single();

    // Type assertion for RPC result
    const result = rpcResult as ApplyReferralResult | null;

    if (applyError) {
      console.error("[apply-referral-code] RPC error:", applyError);
      throw new Error("Failed to apply referral code");
    }

    // Check if application was successful
    if (!result?.success) {
      return jsonResponse({
        success: false,
        error: true,
        message: result?.error_message || "Invalid referral code",
        code: "INVALID_CODE",
      }, 400, headers);
    }

    // Get the referral code details for audit
    const { data: codeDetails } = await supabase
      .from("referral_codes")
      .select("id, code, owner_user_id")
      .eq("code", normalizedCode)
      .single();

    // Log audit event
    await audit.logSuccess("REFERRAL_CODE_APPLIED", "profile", "user", userId, {
      referral_code: normalizedCode,
      referral_code_id: codeDetails?.id,
      referrer_user_id: codeDetails?.owner_user_id,
      reward_type: result.reward_type,
      reward_amount_paise: result.reward_amount_paise,
      priority_boost: result.priority_boost,
    });

    // Send notification to referrer (if applicable)
    if (codeDetails?.owner_user_id) {
      const { data: newUser } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", userId)
        .single();

      await supabase.from("notification_queue").insert({
        user_id: codeDetails.owner_user_id,
        notification_type: "push",
        payload: {
          title: "Referral Used!",
          body: `${newUser?.full_name?.split(" ")[0] || "Someone"} used your referral code.`,
          data: {
            type: "referral_used",
            referred_user_id: userId,
          },
        },
        status: "pending",
      });
    }

    // Apply priority boost to waitlist position (if any)
    let newPosition: number | null = null;
    if (result.priority_boost && result.priority_boost > 0) {
      const { data: boostResult, error: boostError } = await supabase
        .rpc("apply_waitlist_priority_boost", {
          p_user_id: userId,
          p_boost: result.priority_boost,
        })
        .single();

      if (boostError) {
        console.warn("[apply-referral-code] Priority boost failed (non-blocking):", boostError);
      } else if (boostResult) {
        const boost = boostResult as { old_position: number; new_position: number; total_boost: number };
        newPosition = boost.new_position;
        console.log(
          `[apply-referral-code] Position boosted: ${boost.old_position} → ${boost.new_position} (total boost: ${boost.total_boost})`
        );
      }
    }

    // Build response message
    const rewards: string[] = [];
    if (result.reward_amount_paise && result.reward_amount_paise > 0) {
      rewards.push(`Rs. ${(result.reward_amount_paise / 100).toFixed(0)} cashback`);
    }
    if (result.priority_boost && result.priority_boost > 0) {
      rewards.push("priority boost in the waitlist");
    }

    const rewardMessage = rewards.length > 0
      ? `You've received ${rewards.join(" and ")}!`
      : "Referral code applied successfully!";

    return jsonResponse({
      success: true,
      data: {
        code: normalizedCode,
        reward_type: result.reward_type,
        rewards: {
          cashback_paise: result.reward_amount_paise || 0,
          cashback_rupees: result.reward_amount_paise
            ? (result.reward_amount_paise / 100).toFixed(0)
            : "0",
          priority_boost: result.priority_boost || 0,
        },
        new_position: newPosition,
        message: rewardMessage,
      },
    }, 200, headers);
  } catch (error) {
    // Log failure
    if (audit && userId) {
      await audit.logFailure(
        "REFERRAL_CODE_APPLY_FAILED",
        "profile",
        error instanceof AppError ? error.code : "APPLY_FAILED",
        error instanceof Error ? error.message : "Unknown error",
        "user",
        userId
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
