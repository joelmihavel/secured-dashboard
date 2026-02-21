/**
 * Flent Secured v2 - Get Cashback History Edge Function
 *
 * Returns paginated cashback ledger entries for a user.
 * Shows earned, redeemed, reversed, and expired entries.
 *
 * Endpoint: GET /functions/v1/get-cashback-history
 * Auth: Required (User JWT)
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - tenancy_id: Filter by tenancy (optional)
 * - type: Filter by transaction_type (earned, redeemed, reversed, expired) (optional)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? String(DEFAULT_PAGE), 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));
    const tenancyId = url.searchParams.get("tenancy_id");
    const txType = url.searchParams.get("type");

    const offset = (page - 1) * limit;

    // Get total balance first
    const { data: balanceData } = await supabase
      .from("cashback_ledger")
      .select("balance_after_paise")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = balanceData?.balance_after_paise ?? 0;

    // Build query for ledger entries
    let query = supabase
      .from("cashback_ledger")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (tenancyId) {
      query = query.eq("tenancy_id", tenancyId);
    }

    if (txType) {
      const validTypes = ["earned", "redeemed", "reversed", "expired"];
      if (validTypes.includes(txType)) {
        query = query.eq("transaction_type", txType);
      }
    }

    const { data: entries, count, error } = await query;

    if (error) {
      console.error("Failed to fetch cashback history:", error);
      return errorResponse("Failed to fetch cashback history", 500);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return jsonResponse({
      success: true,
      data: {
        current_balance_paise: currentBalance,
        entries: (entries ?? []).map((e: Record<string, unknown>) => ({
          id: e.id,
          transaction_type: e.transaction_type,
          amount_paise: e.amount_paise,
          balance_after_paise: e.balance_after_paise,
          description: e.description,
          payment_id: e.payment_id,
          tenancy_id: e.tenancy_id,
          created_at: e.created_at,
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1,
        },
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
