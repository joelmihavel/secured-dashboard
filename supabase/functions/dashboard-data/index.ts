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
    avatar_url: string | null;
    created_at: string;
  };
  tenancy: {
    id: string;
    status: string;
    property_address: string;
    property_city: string | null;
    monthly_rent: number;
    maintenance: number;
    rent_due_day: number;
    cashback_cutoff_day: number;
    lease_start_date: string | null;
    lease_end_date: string | null;
    landlord_name: string;
    agreement_cert_id: string | null;
    verification_status: {
      bank_verified: boolean;
      utility_verified: boolean;
      landlord_approved: boolean;
      landlord_response: string | null;
    };
  } | null;
  upcoming_payment: {
    due_date: string;
    amount: number;
    amount_paise: number;
    days_until_due: number;
    is_overdue: boolean;
    cashback_eligible: boolean;
    past_cutoff: boolean;
    cutoff_day: number;
    rent_month: string;
  } | null;
  cashback: {
    discount_rate: number;
    max_discount_paise: number;
    max_discount: number;
    verification_complete: boolean;
    total_savings_paise: number;
    total_savings: number;
    // Legacy (transition period)
    legacy_wallet_balance: number;
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
  landlord_bank: {
    id: string;
    account_holder_name: string;
    account_number_masked: string;
    ifsc_code: string;
    bank_name: string | null;
    verified: boolean;
    pan_number_masked: string | null;
    pan_verified: boolean;
  } | null;
  unread_notification_count: number;
  payment_stamps: {
    summary: {
      on_time: number;
      late: number;
      missed: number;
      pending: number;
      total_months: number;
    };
    current_month_status: 'on_time' | 'late' | 'missed' | 'pending';
  } | null;
}

// ==============================================
// HELPERS: Payment Stamps
// ==============================================

function statusPriority(status: string): number {
  switch (status) {
    case 'success': return 3;
    case 'processing': return 2;
    case 'initiated': return 1;
    default: return 0;
  }
}

function computePaymentStamps(
  tenancy: { created_at: string; rent_due_day: number },
  payments: Array<{ payment_month: string; paid_at: string | null; status: string }>
): DashboardData['payment_stamps'] {
  const now = new Date();
  // Payment tracking starts from when the tenancy was created (user joined platform),
  // NOT from agreement lease_start_date. Agreement dates are extraction metadata only.
  // rent_due_day from the agreement is still the cutoff for on_time vs late vs missed.
  const trackingStart = new Date(tenancy.created_at);

  const summary = { on_time: 0, late: 0, missed: 0, pending: 0, total_months: 0 };
  let currentMonthStatus: 'on_time' | 'late' | 'missed' | 'pending' = 'pending';

  // Build a map of payment_month -> payment for O(1) lookup
  const paymentMap = new Map<string, { paid_at: string | null; status: string }>();
  for (const p of payments) {
    const monthKey = p.payment_month.slice(0, 7); // "YYYY-MM"
    // Keep the "best" payment (success > processing > initiated)
    const existing = paymentMap.get(monthKey);
    if (!existing || statusPriority(p.status) > statusPriority(existing.status)) {
      paymentMap.set(monthKey, p);
    }
  }

  // First trackable month: if user joined AFTER this month's due date,
  // that month doesn't count (can't miss a payment that wasn't due yet).
  const dueDay = tenancy.rent_due_day;
  let startYear = trackingStart.getFullYear();
  let startMonth = trackingStart.getMonth();
  if (trackingStart.getDate() > dueDay) {
    // Joined after due day — first real month is next month
    startMonth++;
    if (startMonth > 11) { startMonth = 0; startYear++; }
  }

  let cursor = new Date(startYear, startMonth, 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= endMonth) {
    summary.total_months++;
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), dueDay);
    // Due cutoff: end of due_date in IST (UTC+05:30) = 18:29:59.999 UTC
    const dueCutoff = new Date(dueDate);
    dueCutoff.setUTCHours(18, 29, 59, 999);

    const payment = paymentMap.get(monthKey);
    const isCurrentMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();
    const isFutureMonth = cursor > now;

    // Grey (pending) is the zero state. Stamps only change when:
    // - Payment completed (success) → on_time or late
    // - Due date passed with no success payment → missed
    // failed/refunded/no-payment all remain grey until due date passes.
    let status: 'on_time' | 'late' | 'missed' | 'pending';

    if (isFutureMonth || (isCurrentMonth && now <= dueCutoff)) {
      // Due date hasn't passed — grey unless already paid
      if (payment?.status === 'success') {
        status = new Date(payment.paid_at!) <= dueCutoff ? 'on_time' : 'late';
      } else {
        status = 'pending'; // Grey: pending, processing, initiated, failed, refunded, or no payment
      }
    } else if (payment?.status === 'success') {
      status = new Date(payment.paid_at!) <= dueCutoff ? 'on_time' : 'late';
    } else if (payment && ['processing', 'initiated'].includes(payment.status)) {
      status = 'pending'; // Still processing — keep grey even past due
    } else {
      status = 'missed'; // Due date passed, no success/processing payment
    }

    summary[status]++;
    if (isCurrentMonth) currentMonthStatus = status;

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return { summary, current_month_status: currentMonthStatus };
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
      landlordBankResult,
    ] = await Promise.all([
      // 1. User profile
      supabase
        .from("users")
        .select("id, first_name, last_name, phone, email, role, is_role_locked, user_status, kyc_status, cashback_balance_paise, avatar_url, created_at")
        .eq("id", userId)
        .single(),

      // 2. Active tenancy
      supabase
        .from("tenancies")
        .select(`
          id, status, property_address, property_city,
          monthly_rent_paise, maintenance_paise, rent_due_day, lease_start_date, lease_end_date,
          landlord_name, agreement_cert_id,
          bank_verified, utility_verified, landlord_approved, landlord_response,
          cashback_cutoff_day, created_at
        `)
        .eq("user_id", userId)
        .in("status", ["active", "pending_verification"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Total instant discount savings
      supabase
        .from("cashback_ledger")
        .select("amount_paise")
        .eq("user_id", userId)
        .eq("transaction_type", "discount"),

      // 4. Legacy wallet balance (transition period)
      supabase.rpc("get_available_cashback", { p_user_id: userId }),

      // 5. Recent payments (last 5)
      supabase
        .from("payments")
        .select("id, rent_amount_paise, status, payment_month, paid_at, cashback_earned_paise")
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

      // 8. Landlord bank account (for edit bank details)
      supabase
        .from("bank_accounts")
        .select("id, account_holder_name, account_number_masked, ifsc_code, bank_name, verified, pan_number_masked, pan_verified")
        .eq("user_id", userId)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .maybeSingle(),
    ]);

    const userProfile = userProfileResult.data;
    const tenancy = tenancyResult.data;
    const discountEntries = cashbackBalanceResult.data ?? [];
    const legacyWalletBalance = cashbackStatsResult.data ?? 0;
    const payments = paymentsResult.data ?? [];
    const notifications = notificationsResult.data ?? [];
    const unreadCount = unreadCountResult.data ?? 0;
    const landlordBank = landlordBankResult.data ?? null;

    // ============================================
    // PHASE 1.5: Fetch stamp payments (depends on tenancy)
    // ============================================
    let allTenancyPayments: any[] = [];
    if (tenancy?.id) {
      const { data: stampPayments } = await supabase
        .from("payments")
        .select("payment_month, paid_at, status")
        .eq("tenancy_id", tenancy.id)
        .in("status", ["success", "processing", "initiated"])
        .order("payment_month", { ascending: true });
      allTenancyPayments = stampPayments ?? [];
    }

    // ============================================
    // PHASE 2: Dependent calculations
    // ============================================

    // Calculate upcoming payment (depends on tenancy)
    // Look ahead up to 3 months to find the next unpaid cycle
    // (handles early payments, e.g. user paid March in February)
    let upcomingPayment = null;
    if (tenancy) {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      let baseDueDate = new Date(currentYear, currentMonth, tenancy.rent_due_day);
      if (baseDueDate < today) {
        baseDueDate = new Date(currentYear, currentMonth + 1, tenancy.rent_due_day);
      }

      // Check up to 3 months ahead for the next unpaid month
      // NOTE: lease_end_date does NOT gate payment tracking — agreements often expire
      // while the tenancy continues. Payment lifecycle is forward-looking from creation.
      for (let offset = 0; offset < 3 && !upcomingPayment; offset++) {
        const dueDate = new Date(baseDueDate.getFullYear(), baseDueDate.getMonth() + offset, baseDueDate.getDate());

        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const rentMonthYYYYMM = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
        const rentMonthStr = `${rentMonthYYYYMM}-01`;

        const { data: existingPayment } = await supabase
          .from("payments")
          .select("id, status")
          .eq("tenancy_id", tenancy.id)
          .eq("payment_month", rentMonthStr)
          .in("status", ["success", "processing", "pending"])
          .maybeSingle();

        if (!existingPayment) {
          const cutoffDay = tenancy.cashback_cutoff_day ?? 7;
          const paymentMonth = dueDate.getMonth();
          const paymentYear = dueDate.getFullYear();
          const cutoffDate = new Date(Date.UTC(paymentYear, paymentMonth, cutoffDay, 18, 29, 59, 999));
          const pastCutoff = new Date() > cutoffDate;

          upcomingPayment = {
            due_date: dueDate.toISOString().split("T")[0],
            amount: tenancy.monthly_rent_paise / 100,
            amount_paise: tenancy.monthly_rent_paise,
            days_until_due: daysUntilDue,
            is_overdue: daysUntilDue < 0,
            cashback_eligible: !pastCutoff,
            past_cutoff: pastCutoff,
            cutoff_day: cutoffDay,
            rent_month: rentMonthYYYYMM,
          };
        }
      }
    }

    // Calculate savings summary (instant discount model)
    const totalSavingsPaise = discountEntries.reduce(
      (sum: number, e: { amount_paise: number }) => sum + e.amount_paise, 0
    );
    const legacyBalance = (legacyWalletBalance ?? 0) / 100;
    const maxDiscountPaise = tenancy ? Math.floor(tenancy.monthly_rent_paise * 0.01) : 0;
    const verificationComplete = tenancy
      ? tenancy.bank_verified && tenancy.utility_verified && tenancy.landlord_approved
      : false;

    // Format recent payments
    const recentPayments = payments.map((p: any) => ({
      id: p.id,
      amount: p.rent_amount_paise / 100,
      status: p.status,
      rent_month: p.payment_month,
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
        avatar_url: userProfile?.avatar_url ?? null,
        created_at: userProfile?.created_at ?? new Date().toISOString(),
      },
      tenancy: tenancy
        ? {
            id: tenancy.id,
            status: tenancy.status,
            property_address: tenancy.property_address,
            property_city: tenancy.property_city,
            monthly_rent: tenancy.monthly_rent_paise / 100,
            maintenance: (tenancy.maintenance_paise ?? 0) / 100,
            rent_due_day: tenancy.rent_due_day,
            cashback_cutoff_day: tenancy.cashback_cutoff_day ?? 7,
            lease_start_date: tenancy.lease_start_date ?? null,
            lease_end_date: tenancy.lease_end_date,
            landlord_name: tenancy.landlord_name,
            agreement_cert_id: tenancy.agreement_cert_id ?? null,
            verification_status: {
              bank_verified: tenancy.bank_verified,
              utility_verified: tenancy.utility_verified,
              landlord_approved: tenancy.landlord_approved,
              landlord_response: tenancy.landlord_response ?? null,
            },
          }
        : null,
      upcoming_payment: upcomingPayment,
      cashback: {
        discount_rate: 0.01,
        max_discount_paise: maxDiscountPaise,
        max_discount: maxDiscountPaise / 100,
        verification_complete: verificationComplete,
        total_savings_paise: totalSavingsPaise,
        total_savings: totalSavingsPaise / 100,
        legacy_wallet_balance: legacyBalance,
      },
      recent_payments: recentPayments,
      landlord_bank: landlordBank,
      notifications: formattedNotifications,
      unread_notification_count: unreadCount,
      payment_stamps: tenancy?.created_at
        ? computePaymentStamps(tenancy, allTenancyPayments)
        : null,
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
