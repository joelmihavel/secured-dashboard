/**
 * Flent Secured v2 - Get Payment Schedule Edge Function
 *
 * Returns payment schedule(s) for a user's tenancies.
 *
 * Endpoint: GET /functions/v1/get-payment-schedule
 * Auth: Required (User JWT)
 *
 * Query params:
 * - tenancy_id: Filter by specific tenancy (optional)
 * - status: Filter by status (active, paused, cancelled) (optional)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { isTestMode, mockData } from "../_shared/test-mode.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return jsonResponse({
      success: true,
      data: {
        schedules: [mockData.paymentSchedule],
        total: 1,
      },
    });
  }

  const supabase = createServiceClient();

  try {
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const url = new URL(req.url);
    const tenancyId = url.searchParams.get("tenancy_id");
    const status = url.searchParams.get("status");

    let query = supabase
      .from("payment_schedules")
      .select(`
        id,
        tenancy_id,
        payment_method,
        scheduled_day,
        auto_apply_cashback,
        status,
        next_execution_date,
        retry_count,
        max_retries,
        created_at,
        updated_at,
        tenancies!inner (
          id,
          monthly_rent_paise,
          property_address,
          landlord_name
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (tenancyId) {
      query = query.eq("tenancy_id", tenancyId);
    }

    if (status) {
      const validStatuses = ["active", "paused", "cancelled"];
      if (validStatuses.includes(status)) {
        query = query.eq("status", status);
      }
    }

    const { data: schedules, error } = await query;

    if (error) {
      console.error("Failed to fetch payment schedules:", error);
      return errorResponse("Failed to fetch payment schedules", 500);
    }

    return jsonResponse({
      success: true,
      data: {
        schedules: (schedules ?? []).map((s: Record<string, unknown>) => ({
          id: s.id,
          tenancy_id: s.tenancy_id,
          payment_method: s.payment_method,
          scheduled_day: s.scheduled_day,
          auto_apply_cashback: s.auto_apply_cashback,
          status: s.status,
          next_execution_date: s.next_execution_date,
          retry_count: s.retry_count,
          max_retries: s.max_retries,
          monthly_rent_paise: (s.tenancies as Record<string, unknown>)?.monthly_rent_paise,
          property_address: (s.tenancies as Record<string, unknown>)?.property_address,
          landlord_name: (s.tenancies as Record<string, unknown>)?.landlord_name,
          created_at: s.created_at,
        })),
        total: (schedules ?? []).length,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
