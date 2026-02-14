/**
 * Flent Secured v2 - Get My Referral Code Edge Function
 *
 * Returns the authenticated user's referral code, generating one if it doesn't exist.
 * Uses the existing generate_user_referral_code RPC function.
 *
 * Endpoint: GET /functions/v1/get-my-referral-code
 * Auth: Required (JWT)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     code: string,
 *     usage_count: number,
 *     max_uses: number,
 *     reward_amount_paise: number
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "GET") {
    return jsonResponse(
      { error: true, message: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
      405,
      headers
    );
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Generate or retrieve referral code via RPC
    const { data: code, error: rpcError } = await supabase
      .rpc("generate_user_referral_code", { p_user_id: userId });

    if (rpcError) {
      console.error("[get-my-referral-code] RPC error:", rpcError);
      throw new Error("Failed to generate referral code");
    }

    // Fetch code details for usage info
    const { data: codeDetails, error: queryError } = await supabase
      .from("referral_codes")
      .select("code, current_uses, max_uses, referee_reward_paise")
      .eq("owner_user_id", userId)
      .eq("code_type", "user")
      .single();

    if (queryError) {
      // Code was generated but we can't fetch details — return just the code
      return jsonResponse(
        {
          success: true,
          data: {
            code: code as string,
            usage_count: 0,
            max_uses: 10,
            reward_amount_paise: 10000,
          },
        },
        200,
        headers
      );
    }

    return jsonResponse(
      {
        success: true,
        data: {
          code: codeDetails.code,
          usage_count: codeDetails.current_uses,
          max_uses: codeDetails.max_uses,
          reward_amount_paise: codeDetails.referee_reward_paise,
        },
      },
      200,
      headers
    );
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
