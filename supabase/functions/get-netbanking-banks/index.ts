/**
 * Flent Secured v2 - Get Netbanking Banks Edge Function
 *
 * Returns active netbanking banks for payment method selection.
 * Public endpoint — no auth required (reference data).
 *
 * Endpoint: GET /functions/v1/get-netbanking-banks
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const supabase = createServiceClient();

    const { data: banks, error } = await supabase
      .from("netbanking_banks")
      .select("bank_code, bank_name, short_name, is_popular")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("bank_name", { ascending: true });

    if (error) {
      console.error("Failed to fetch banks:", error.message);
      return errorResponse("Failed to fetch bank list", 500);
    }

    return jsonResponse({
      success: true,
      data: {
        banks: banks ?? [],
        total_count: banks?.length ?? 0,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
