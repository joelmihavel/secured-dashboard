/**
 * Flent Secured v2 - Dashboard Data Edge Function
 *
 * Aggregates data for the home screen dashboard.
 * Returns tenancy info, upcoming payment, cashback balance, payment history.
 *
 * Endpoint: GET /functions/v1/dashboard-data
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";

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

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId, user } = await createAuthenticatedClient(authHeader);

    // Fetch user profile (include all fields iOS expects)
    const { data: userProfile } = await supabase
      .from("users")
      .select("id, first_name, last_name, phone, email, role, is_role_locked, user_status, kyc_status, cashback_balance_paise, created_at")
      .eq("id", userId)
      .single();

    // Fetch active tenancy
    const { data: tenancy } = await supabase
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
      .maybeSingle();

    // Calculate upcoming payment
    let upcomingPayment = null;
    if (tenancy) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Due date this month or next
      let dueDate = new Date(currentYear, currentMonth, tenancy.rent_due_day);
      if (dueDate < today) {
        // If past due date this month, show next month
        dueDate = new Date(currentYear, currentMonth + 1, tenancy.rent_due_day);
      }

      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if already paid for this month
      const rentMonthStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-01`;
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

    // Fetch cashback balance
    const { data: availableBalance } = await supabase.rpc("get_available_cashback", {
      p_user_id: userId,
    });

    // Fetch cashback stats
    const { data: cashbackStats } = await supabase
      .from("cashback_ledger")
      .select("transaction_type, amount_paise")
      .eq("user_id", userId);

    let totalEarned = 0;
    let totalUsed = 0;
    let pendingBalance = 0;

    for (const entry of cashbackStats ?? []) {
      if (entry.transaction_type === "earned" || entry.transaction_type === "bonus") {
        totalEarned += entry.amount_paise;
      } else if (entry.transaction_type === "applied") {
        totalUsed += entry.amount_paise;
      }
    }

    // Calculate pending (earned but not yet redeemable due to landlord approval)
    if (tenancy && !tenancy.landlord_approved) {
      pendingBalance = (availableBalance ?? 0);
    }

    // Fetch recent payments
    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount_paise, status, rent_month, paid_at, cashback_earned_paise")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentPayments = (payments ?? []).map((p) => ({
      id: p.id,
      amount: p.amount_paise / 100,
      status: p.status,
      rent_month: p.rent_month,
      paid_at: p.paid_at,
      cashback_earned: (p.cashback_earned_paise ?? 0) / 100,
    }));

    // Fetch notifications
    const { data: notifications } = await supabase
      .from("notifications")
      .select("id, title, body, notification_type, action_type, action_data, is_read, created_at")
      .eq("user_id", userId)
      .lte("scheduled_for", new Date().toISOString())
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    const formattedNotifications = (notifications ?? []).map((n) => ({
      id: n.id,
      type: n.notification_type,
      title: n.title,
      message: n.body,
      action_type: n.action_type,
      action_data: n.action_data,
      created_at: n.created_at,
      read: n.is_read,
    }));

    // Get unread count
    const { data: unreadCount } = await supabase.rpc("get_unread_notification_count", {
      p_user_id: userId,
    });

    // Build dashboard response
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
        available_balance: (availableBalance ?? 0) / 100,
        pending_balance: pendingBalance / 100,
        total_earned: totalEarned / 100,
        total_used: totalUsed / 100,
      },
      recent_payments: recentPayments,
      notifications: formattedNotifications,
      unread_notification_count: unreadCount ?? 0,
    };

    return jsonResponse({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
