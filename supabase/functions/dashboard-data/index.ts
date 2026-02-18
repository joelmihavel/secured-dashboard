/**
 * Flent Secured v2 - Dashboard Data Aggregation Edge Function (BE-091)
 *
 * Aggregates all data for the home screen dashboard in a single call.
 * Optimized with parallel queries and 5-minute caching.
 *
 * Returns: user profile, active tenancy, next payment, cashback summary,
 *          recent payments, and notifications.
 *
 * Endpoint: GET /functions/v1/dashboard-data
 * Auth: Required (JWT)
 *
 * Cache: Results are cached for 5 minutes per user via Cache-Control headers.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { isTestMode, mockData } from "../_shared/test-mode.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CACHE_TTL_SECONDS = 300; // 5 minutes

// ==============================================
// TYPES
// ==============================================

interface DashboardData {
  user: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    role: string;
    is_role_locked: boolean;
    user_status: string;
    kyc_status: string | null;
    cashback_balance_paise: number;
    created_at: string;
  };
  tenancy: {
    id: string;
    status: string;
    property_address: string;
    property_city: string | null;
    monthly_rent: number;
    rent_due_day: number;
    lease_end_date: string | null;
    landlord_name: string;
    verification_status: {
      bank_verified: boolean;
      utility_verified: boolean;
      landlord_approved: boolean;
    };
  } | null;
  upcoming_payment: {
    due_date: string;
    amount: number;
    amount_paise: number;
    days_until_due: number;
    is_overdue: boolean;
    cashback_eligible: boolean;
    rent_month: string;
  } | null;
  cashback: {
    available_balance: number;
    pending_balance: number;
    total_earned: number;
    total_used: number;
  };
  recent_payments: Array<{
    id: string;
    amount: number;
    status: string;
    rent_month: string;
    paid_at: string | null;
    cashback_earned: number;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    action_type: string | null;
    action_data: unknown | null;
    created_at: string;
    read: boolean;
  }>;
  unread_notification_count: number;
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Accept both GET and POST (iOS Supabase SDK uses POST by default)
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return jsonResponse(
      { success: true, data: mockData.dashboard },
      200,
      { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` }
    );
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // ============================================
    // PHASE 1: Parallel independent queries
    // ============================================
    const [
      userProfileResult,
      tenancyResult,
      cashbackBalanceResult,
      cashbackStatsResult,
      paymentsResult,
      notificationsResult,
      unreadCountResult,
    ] = await Promise.all([
      // 1. User profile
      supabase
        .from("users")
        .select("id, first_name, last_name, phone, email, role, is_role_locked, user_status, kyc_status, cashback_balance_paise, created_at")
        .eq("id", userId)
        .single(),

      // 2. Active tenancy
      supabase
        .from("tenancies")
        .select(`
          id, status, property_address, property_city,
          monthly_rent_paise, rent_due_day, lease_end_date,
          landlord_name, bank_verified, utility_verified, landlord_approved
        `)
        .eq("user_id", userId)
        .in("status", ["active", "pending_verification"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Available cashback balance
      supabase.rpc("get_available_cashback", { p_user_id: userId }),

      // 4. Cashback stats (earned/used totals)
      supabase
        .from("cashback_ledger")
        .select("transaction_type, amount_paise")
        .eq("user_id", userId),

      // 5. Recent payments (last 5)
      supabase
        .from("payments")
        .select("id, amount_paise, status, rent_month, paid_at, cashback_earned_paise")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),

      // 6. Notifications (last 10, active only)
      supabase
        .from("notifications")
        .select("id, title, body, notification_type, action_type, action_data, is_read, created_at")
        .eq("user_id", userId)
        .lte("scheduled_for", new Date().toISOString())
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10),

      // 7. Unread notification count
      supabase.rpc("get_unread_notification_count", { p_user_id: userId }),
    ]);

    const userProfile = userProfileResult.data;
    const tenancy = tenancyResult.data;
    const availableBalance = cashbackBalanceResult.data ?? 0;
    const cashbackStats = cashbackStatsResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const notifications = notificationsResult.data ?? [];
    const unreadCount = unreadCountResult.data ?? 0;

    // ============================================
    // PHASE 2: Dependent calculations
    // ============================================

    // Calculate upcoming payment (depends on tenancy)
    let upcomingPayment = null;
    if (tenancy) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let dueDate = new Date(currentYear, currentMonth, tenancy.rent_due_day);
      if (dueDate < today) {
        dueDate = new Date(currentYear, currentMonth + 1, tenancy.rent_due_day);
      }

      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const rentMonthStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-01`;

      // Check if already paid (secondary query only when tenancy exists)
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, status")
        .eq("tenancy_id", tenancy.id)
        .eq("rent_month", rentMonthStr)
        .in("status", ["success", "processing", "pending"])
        .maybeSingle();

      if (!existingPayment) {
        upcomingPayment = {
          due_date: dueDate.toISOString().split("T")[0],
          amount: tenancy.monthly_rent_paise / 100,
          amount_paise: tenancy.monthly_rent_paise,
          days_until_due: daysUntilDue,
          is_overdue: daysUntilDue < 0,
          cashback_eligible: tenancy.landlord_approved === true,
          rent_month: rentMonthStr,
        };
      }
    }

    // Calculate cashback summary
    let totalEarned = 0;
    let totalUsed = 0;
    let pendingBalance = 0;

    for (const entry of cashbackStats) {
      if (entry.transaction_type === "earned" || entry.transaction_type === "bonus") {
        totalEarned += entry.amount_paise;
      } else if (entry.transaction_type === "applied") {
        totalUsed += entry.amount_paise;
      }
    }

    if (tenancy && !tenancy.landlord_approved) {
      pendingBalance = availableBalance;
    }

    // Format recent payments
    const recentPayments = payments.map((p: any) => ({
      id: p.id,
      amount: p.amount_paise / 100,
      status: p.status,
      rent_month: p.rent_month,
      paid_at: p.paid_at,
      cashback_earned: (p.cashback_earned_paise ?? 0) / 100,
    }));

    // Format notifications
    const formattedNotifications = notifications.map((n: any) => ({
      id: n.id,
      type: n.notification_type,
      title: n.title,
      message: n.body,
      action_type: n.action_type,
      action_data: n.action_data,
      created_at: n.created_at,
      read: n.is_read,
    }));

    // ============================================
    // Build response
    // ============================================
    const dashboardData: DashboardData = {
      user: {
        id: userProfile?.id ?? userId,
        first_name: userProfile?.first_name ?? "User",
        last_name: userProfile?.last_name ?? null,
        phone: userProfile?.phone ?? null,
        email: userProfile?.email ?? null,
        role: userProfile?.role ?? "tenant",
        is_role_locked: userProfile?.is_role_locked ?? false,
        user_status: userProfile?.user_status ?? "active",
        kyc_status: userProfile?.kyc_status ?? null,
        cashback_balance_paise: userProfile?.cashback_balance_paise ?? 0,
        created_at: userProfile?.created_at ?? new Date().toISOString(),
      },
      tenancy: tenancy
        ? {
            id: tenancy.id,
            status: tenancy.status,
            property_address: tenancy.property_address,
            property_city: tenancy.property_city,
            monthly_rent: tenancy.monthly_rent_paise / 100,
            rent_due_day: tenancy.rent_due_day,
            lease_end_date: tenancy.lease_end_date,
            landlord_name: tenancy.landlord_name,
            verification_status: {
              bank_verified: tenancy.bank_verified,
              utility_verified: tenancy.utility_verified,
              landlord_approved: tenancy.landlord_approved,
            },
          }
        : null,
      upcoming_payment: upcomingPayment,
      cashback: {
        available_balance: availableBalance / 100,
        pending_balance: pendingBalance / 100,
        total_earned: totalEarned / 100,
        total_used: totalUsed / 100,
      },
      recent_payments: recentPayments,
      notifications: formattedNotifications,
      unread_notification_count: unreadCount,
    };

    return jsonResponse(
      { success: true, data: dashboardData },
      200,
      { "Cache-Control": `private, max-age=${CACHE_TTL_SECONDS}` }
    );
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
