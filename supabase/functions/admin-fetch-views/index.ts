/**
 * Admin Fetch Views — returns data from Supabase views for the admin dashboard.
 * Service-role only. Called by Apps Script (Google Sheets).
 * Replaces direct REST API calls which fail with new sb_secret_* key format.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);
  } catch {
    return errorResponse("Unauthorized", 401);
  }

  const supabase = createServiceClient();

  const [userFunnel, m360, verifications] = await Promise.all([
    supabase.from("v_user_funnel").select("*"),
    supabase.from("v_m360_detail").select("*"),
    supabase.from("v_verification_analysis").select("*"),
  ]);

  if (userFunnel.error) {
    return errorResponse("v_user_funnel: " + userFunnel.error.message, 500);
  }
  if (m360.error) {
    return errorResponse("v_m360_detail: " + m360.error.message, 500);
  }
  if (verifications.error) {
    return errorResponse("v_verification_analysis: " + verifications.error.message, 500);
  }

  return new Response(
    JSON.stringify({
      user_funnel: userFunnel.data,
      m360: m360.data,
      verifications: verifications.data,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
