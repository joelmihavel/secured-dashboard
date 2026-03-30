/**
 * Flent Secured v2 - Edge Function: compute-risk
 *
 * Admin-only endpoint for (re)computing risk scores.
 * Useful for manual refresh from admin dashboard and batch re-computation.
 *
 * Endpoint: POST /functions/v1/compute-risk
 * Auth: admin_key in body (same pattern as admin-waitlist)
 *
 * Body: { admin_key: string, user_ids: string[] }
 * Returns: { results: [{ user_id, risk_level, risk_phase, risk_factors }] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { ValidationError, AuthError, handleError } from "../_shared/errors.ts";
import { recomputeAndStoreRisk } from "../_shared/risk-utils.ts";

const MAX_BATCH_SIZE = 100;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const body = await req.json();

    // ── Auth ──
    const adminKey = Deno.env.get("ADMIN_API_KEY");
    if (!adminKey || body.admin_key !== adminKey) {
      throw new AuthError("Invalid admin key");
    }

    // ── Validate ──
    const userIds = body.user_ids;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError("user_ids must be a non-empty array");
    }
    if (userIds.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Maximum ${MAX_BATCH_SIZE} users per request`);
    }

    const supabase = createServiceClient();

    // ── Compute risk for each user ──
    const results: Array<{
      user_id: string;
      risk_level: string;
      risk_phase: string;
      risk_factors: unknown[];
      error?: string;
    }> = [];

    for (const userId of userIds) {
      try {
        const result = await recomputeAndStoreRisk(userId, supabase);
        const postOnlyFactors = [
          "m360_risk_intel", "m360_data_available", "credit_score",
          "utility_verification", "landlord_response",
        ];
        const hasPost = result.risk_factors.some((f) => postOnlyFactors.includes(f.factor));

        results.push({
          user_id: userId,
          risk_level: result.risk_level,
          risk_phase: hasPost ? "post" : "pre",
          risk_factors: result.risk_factors,
        });
      } catch (err) {
        results.push({
          user_id: userId,
          risk_level: "PENDING",
          risk_phase: "pre",
          risk_factors: [],
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => !r.error).length;
    const failCount = results.filter((r) => r.error).length;

    return jsonResponse(
      {
        success: true,
        message: `Computed risk for ${successCount} users${failCount > 0 ? ` (${failCount} failed)` : ""}`,
        results,
      },
      200,
      headers,
    );
  } catch (error) {
    return handleError(error, headers);
  }
});
