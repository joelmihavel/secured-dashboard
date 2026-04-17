/**
 * Admin Fetch Views — returns data from Supabase views for the admin dashboard.
 * Admin-only. Called by Apps Script (Google Sheets).
 * Replaces direct REST API calls which fail with new sb_secret_* key format.
 *
 * Auth: admin_key in request body (Supabase relay strips Authorization header
 * for opaque keys, so body-based auth is the only reliable method).
 *
 * Endpoint: POST /functions/v1/admin-fetch-views
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, errorResponse } from "../_shared/cors.ts";
import { AuthError } from "../_shared/errors.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed — use POST with admin_key in body", 405);
  }

  try {
    const body = await req.json();
    const expectedKey = Deno.env.get("ADMIN_API_KEY");
    if (!body.admin_key || !expectedKey || body.admin_key !== expectedKey) {
      return errorResponse("Unauthorized - invalid admin key", 401);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return errorResponse("Auth failed: " + msg, 401);
  }

  const supabase = createServiceClient();

  const [userFunnel, m360, verifications, riskDetail, payments] = await Promise.all([
    supabase.from("v_user_funnel").select("*"),
    supabase.from("v_m360_detail").select("*"),
    supabase.from("v_verification_analysis").select("*"),
    supabase.from("v_risk_detail").select("*"),
    supabase.from("v_payment_detail").select("*"),
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
  if (riskDetail.error) {
    return errorResponse("v_risk_detail: " + riskDetail.error.message, 500);
  }
  if (payments.error) {
    return errorResponse("v_payment_detail: " + payments.error.message, 500);
  }

  return new Response(
    JSON.stringify({
      user_funnel: userFunnel.data,
      m360: m360.data,
      verifications: verifications.data,
      risk_detail: riskDetail.data,
      payments: payments.data,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
