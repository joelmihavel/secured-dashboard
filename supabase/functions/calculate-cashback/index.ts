/**
 * Flent Secured v2 - Savings Summary Edge Function
 *
 * Returns savings data from the instant 1% rent discount model.
 * Legacy credit/redeem operations return deprecation notices.
 *
 * Endpoints:
 * - GET  /functions/v1/calculate-cashback - Get savings summary (total discounts, per-payment history)
 * - POST /functions/v1/calculate-cashback - DEPRECATED: Returns deprecation notice
 *
 * Auth: User JWT (GET)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createServiceClient();

  try {
    // GET - Fetch cashback summary
    if (req.method === "GET") {
      return await handleGetCashbackSummary(req, supabase);
    }

    if (req.method === "POST") {
      return jsonResponse({
        success: false,
        error: "DEPRECATED",
        message: "Wallet credit/redeem operations are deprecated. Cashback is now an automatic 1% instant discount on rent payments.",
      }, 410);
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// GET CASHBACK SUMMARY
// ==============================================

async function handleGetCashbackSummary(
  req: Request,
  supabase: ReturnType<typeof createServiceClient>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const { userId } = await createAuthenticatedClient(authHeader);

  // Run queries in parallel
  const [
    savingsHistoryResult,
    lifetimeStatsResult,
    legacyBalanceResult,
  ] = await Promise.all([
    // Recent savings entries (instant discount + flat bonus audit trail)
    supabase
      .from("cashback_ledger")
      .select("id, transaction_type, amount_paise, payment_id, tenancy_id, description, created_at")
      .eq("user_id", userId)
      .in("transaction_type", ["discount", "flat_bonus"])
      .order("created_at", { ascending: false })
      .limit(20),
    // Lifetime stats: total savings + legacy earned/applied
    supabase
      .from("cashback_ledger")
      .select("transaction_type, amount_paise")
      .eq("user_id", userId),
    // Legacy wallet balance (for backward compat display during transition)
    supabase.rpc("get_available_cashback", { p_user_id: userId }),
  ]);

  const savingsHistory = savingsHistoryResult.data ?? [];
  const stats = lifetimeStatsResult.data ?? [];
  const legacyBalance = legacyBalanceResult.data ?? 0;

  // Calculate savings stats. 'discount' (1%) and 'flat_bonus' both
  // represent money the user did NOT pay (instant gateway-side discount).
  let totalDiscountSavings = 0;
  let totalLegacyEarned = 0;
  let totalLegacyRedeemed = 0;

  for (const entry of stats) {
    switch (entry.transaction_type) {
      case "discount":
      case "flat_bonus":
        totalDiscountSavings += entry.amount_paise;
        break;
      case "earned":
      case "bonus":
      case "referral_bonus":
      case "promotional":
        totalLegacyEarned += entry.amount_paise;
        break;
      case "applied":
        totalLegacyRedeemed += entry.amount_paise;
        break;
    }
  }

  const formattedHistory = savingsHistory.map((entry: any) => ({
    id: entry.id,
    type: entry.transaction_type, // 'discount' | 'flat_bonus'
    amount_paise: entry.amount_paise,
    amount: entry.amount_paise / 100,
    payment_id: entry.payment_id,
    description: entry.description,
    created_at: entry.created_at,
  }));

  return jsonResponse({
    success: true,
    data: {
      // New instant discount model
      discount_rate: 0.01,
      total_savings_paise: totalDiscountSavings,
      total_savings: totalDiscountSavings / 100,
      discount_count: savingsHistory.length,
      // Legacy wallet data (for transition period)
      legacy_wallet_balance_paise: legacyBalance,
      legacy_wallet_balance: legacyBalance / 100,
      legacy_total_earned_paise: totalLegacyEarned,
      legacy_total_redeemed_paise: totalLegacyRedeemed,
      // Savings history (discount entries only)
      history: formattedHistory,
    },
  });
}


