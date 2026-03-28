/**
 * Flent Secured v2 - Fee Configuration Edge Function
 *
 * Returns dynamic payment gateway fee rates.
 * Reads from fee_config DB table, falls back to hardcoded defaults.
 *
 * Endpoint: GET /functions/v1/get-fee-config
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// DEFAULT FEE RATES (fallback if DB query fails)
// ==============================================

interface FeeEntry {
  rate: number;
  fee_type: 'percentage' | 'flat_paise';
}

const DEFAULT_RATES: Record<string, FeeEntry> = {
  upi: { rate: 0, fee_type: 'percentage' },
  credit_card: { rate: 0.0185, fee_type: 'percentage' },
  debit_card: { rate: 0.009, fee_type: 'percentage' },
  netbanking: { rate: 1500, fee_type: 'flat_paise' },
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

    const supabase = createServiceClient();

    // Parse gateway query param (default = 'default' i.e. PayU)
    const url = new URL(req.url);
    const requestedGateway = url.searchParams.get("gateway") ?? "default";

    // Read fee rates from fee_config table filtered by gateway
    let feeRates: Record<string, FeeEntry> = { ...DEFAULT_RATES };
    let lastUpdated = new Date().toISOString();
    let resolvedGateway = requestedGateway;

    const { data: rows, error: dbError } = await supabase
      .from("fee_config")
      .select("method, rate, fee_type, updated_at")
      .eq("is_active", true)
      .eq("gateway", requestedGateway);

    if (dbError) {
      console.warn("[get-fee-config] DB query failed, using defaults:", dbError.message);
    } else if (rows && rows.length > 0) {
      // Map rows to fee rates object with fee_type
      for (const row of rows) {
        feeRates[row.method] = {
          rate: Number(row.rate),
          fee_type: row.fee_type ?? 'percentage',
        };
      }
      // Use the most recent updated_at
      const dates = rows
        .map((r: { updated_at?: string }) => r.updated_at)
        .filter(Boolean) as string[];
      if (dates.length > 0) {
        lastUpdated = dates.sort().pop()!;
      }
    } else if (requestedGateway !== "default") {
      // No rows found for the requested gateway — fall back to 'default'
      console.warn(`[get-fee-config] No rows for gateway '${requestedGateway}', falling back to 'default'`);
      resolvedGateway = "default";

      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("fee_config")
        .select("method, rate, fee_type, updated_at")
        .eq("is_active", true)
        .eq("gateway", "default");

      if (fallbackError) {
        console.warn("[get-fee-config] Fallback DB query failed, using defaults:", fallbackError.message);
      } else if (fallbackRows && fallbackRows.length > 0) {
        for (const row of fallbackRows) {
          feeRates[row.method] = {
            rate: Number(row.rate),
            fee_type: row.fee_type ?? 'percentage',
          };
        }
        const dates = fallbackRows
          .map((r: { updated_at?: string }) => r.updated_at)
          .filter(Boolean) as string[];
        if (dates.length > 0) {
          lastUpdated = dates.sort().pop()!;
        }
      }
    }

    // Determine fee billing model based on the resolved gateway
    const feeBillingModel = resolvedGateway === "cashfree" ? "included" : "pg_billed";

    return jsonResponse({
      success: true,
      data: {
        fee_rates: {
          upi: feeRates.upi ?? DEFAULT_RATES.upi,
          credit_card: feeRates.credit_card ?? DEFAULT_RATES.credit_card,
          debit_card: feeRates.debit_card ?? DEFAULT_RATES.debit_card,
          netbanking: feeRates.netbanking ?? DEFAULT_RATES.netbanking,
        },
        fee_billing_model: feeBillingModel,
        gateway: resolvedGateway,
        last_updated: lastUpdated.split("T")[0],
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
