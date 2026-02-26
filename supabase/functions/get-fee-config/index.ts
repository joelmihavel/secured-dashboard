/**
 * Flent Secured v2 - Fee Configuration Edge Function
 *
 * Returns dynamic payment gateway fee rates.
 * Reads from environment variables, falls back to hardcoded defaults.
 *
 * Endpoint: GET /functions/v1/get-fee-config
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// DEFAULT FEE RATES
// ==============================================

const DEFAULT_RATES = {
  upi: 0,
  credit_card: 0.02,
  debit_card: 0.02,
  netbanking: 0.015,
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    await createAuthenticatedClient(authHeader);

    // Read fee rates from environment variables, fall back to defaults
    const feeRates = {
      upi: parseFloat(Deno.env.get("FEE_RATE_UPI") ?? String(DEFAULT_RATES.upi)),
      credit_card: parseFloat(Deno.env.get("FEE_RATE_CREDIT_CARD") ?? String(DEFAULT_RATES.credit_card)),
      debit_card: parseFloat(Deno.env.get("FEE_RATE_DEBIT_CARD") ?? String(DEFAULT_RATES.debit_card)),
      netbanking: parseFloat(Deno.env.get("FEE_RATE_NETBANKING") ?? String(DEFAULT_RATES.netbanking)),
    };

    return jsonResponse({
      success: true,
      data: {
        fee_rates: feeRates,
        fee_type: "percentage",
        last_updated: new Date().toISOString().split("T")[0],
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
