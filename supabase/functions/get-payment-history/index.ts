/**
 * Flent Secured v2 - Get Payment History Edge Function
 *
 * Returns paginated payment history for a user with filtering and sorting.
 *
 * Endpoint: GET /functions/v1/get-payment-history
 * Auth: Required (User JWT)
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (success, failed, pending, etc.)
 * - tenancy_id: Filter by tenancy
 * - from_date: Filter from date (YYYY-MM-DD)
 * - to_date: Filter to date (YYYY-MM-DD)
 * - sort: Sort field (created_at, amount, status) (default: created_at)
 * - order: Sort order (asc, desc) (default: desc)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ==============================================
// TYPES
// ==============================================

interface PaymentHistoryItem {
  id: string;
  amount: number;
  pg_fee: number;
  cashback_applied: number;
  cashback_earned: number;
  net_amount: number;
  status: string;
  payment_method: string | null;
  rent_month: string;
  paid_at: string | null;
  created_at: string;
  tenancy: {
    id: string;
    property_address: string;
    landlord_name: string;
  } | null;
  can_download_receipt: boolean;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

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

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse query parameters
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? String(DEFAULT_PAGE)));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT))));
    const status = url.searchParams.get("status");
    const tenancyId = url.searchParams.get("tenancy_id");
    const fromDate = url.searchParams.get("from_date");
    const toDate = url.searchParams.get("to_date");
    const sortField = url.searchParams.get("sort") ?? "created_at";
    const sortOrder = url.searchParams.get("order") ?? "desc";

    // Validate sort field
    const allowedSortFields = ["created_at", "rent_amount_paise", "status", "paid_at", "payment_month"];
    const actualSortField = allowedSortFields.includes(sortField) ? sortField : "created_at";
    const ascending = sortOrder.toLowerCase() === "asc";

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("payments")
      .select(`
        id, rent_amount_paise, pg_fee_paise, cashback_applied_paise, cashback_earned_paise,
        status, payment_method, payment_month, paid_at, created_at,
        tenancies!inner (
          id, property_address, landlord_name
        )
      `, { count: "exact" })
      .eq("user_id", userId);

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    if (tenancyId) {
      query = query.eq("tenancy_id", tenancyId);
    }

    if (fromDate) {
      query = query.gte("created_at", `${fromDate}T00:00:00Z`);
    }

    if (toDate) {
      query = query.lte("created_at", `${toDate}T23:59:59Z`);
    }

    // Apply sorting and pagination
    query = query
      .order(actualSortField, { ascending })
      .range(offset, offset + limit - 1);

    // Execute query
    const { data: payments, error, count } = await query;

    if (error) {
      console.error("Failed to fetch payment history:", error);
      throw new Error("Failed to fetch payment history");
    }

    // Format response
    const formattedPayments: PaymentHistoryItem[] = (payments ?? []).map((p: any) => ({
      id: p.id,
      amount: p.rent_amount_paise / 100,
      pg_fee: p.pg_fee_paise / 100,
      cashback_applied: p.cashback_applied_paise / 100,
      cashback_earned: (p.cashback_earned_paise ?? 0) / 100,
      net_amount: (p.rent_amount_paise - p.cashback_applied_paise) / 100,
      status: p.status,
      payment_method: p.payment_method,
      rent_month: p.payment_month,
      paid_at: p.paid_at,
      created_at: p.created_at,
      tenancy: p.tenancies ? {
        id: p.tenancies.id,
        property_address: p.tenancies.property_address,
        landlord_name: p.tenancies.landlord_name,
      } : null,
      can_download_receipt: p.status === "success",
    }));

    // Calculate pagination metadata
    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationMeta = {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1,
    };

    // Calculate summary stats for the filtered results
    const summaryQuery = supabase
      .from("payments")
      .select("rent_amount_paise, cashback_earned_paise, status")
      .eq("user_id", userId);

    // Apply same filters for summary
    let filteredSummaryQuery = summaryQuery;
    if (status) {
      filteredSummaryQuery = filteredSummaryQuery.eq("status", status);
    }
    if (tenancyId) {
      filteredSummaryQuery = filteredSummaryQuery.eq("tenancy_id", tenancyId);
    }
    if (fromDate) {
      filteredSummaryQuery = filteredSummaryQuery.gte("created_at", `${fromDate}T00:00:00Z`);
    }
    if (toDate) {
      filteredSummaryQuery = filteredSummaryQuery.lte("created_at", `${toDate}T23:59:59Z`);
    }

    const { data: summaryData } = await filteredSummaryQuery;

    const summary = {
      total_paid: 0,
      total_cashback_earned: 0,
      successful_payments: 0,
      failed_payments: 0,
    };

    for (const payment of summaryData ?? []) {
      if (payment.status === "success") {
        summary.total_paid += payment.rent_amount_paise;
        summary.total_cashback_earned += payment.cashback_earned_paise ?? 0;
        summary.successful_payments++;
      } else if (payment.status === "failed") {
        summary.failed_payments++;
      }
    }

    return jsonResponse({
      success: true,
      data: {
        payments: formattedPayments,
        pagination,
        summary: {
          total_paid: summary.total_paid / 100,
          total_cashback_earned: summary.total_cashback_earned / 100,
          successful_payments: summary.successful_payments,
          failed_payments: summary.failed_payments,
        },
        filters_applied: {
          status,
          tenancy_id: tenancyId,
          from_date: fromDate,
          to_date: toDate,
          sort: actualSortField,
          order: sortOrder,
        },
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
