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
    landlord_phone: string | null;
    tenant_names: string[];
    security_deposit: number;
    agreement_cert_id: string | null;
    verification_status: {
      bank_verified: boolean;
      utility_verified: boolean;
      landlord_approved: boolean;
      landlord_response: string | null;
      landlord_status: string;
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
    cashback_applied: number;
    payment_method: string | null;
    settlement_status: string | null;
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
    upi_vpa: string | null;
    verification_method: string | null;
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
  tenancy: { created_at: string; rent_due_day: number; cashback_cutoff_day?: number },
  payments: Array<{ payment_month: string; paid_at: string | null; status: string }>
): DashboardData['payment_stamps'] {
  // Use IST for month determination — consistent with upcomingPayment calculation
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const now = new Date(); // UTC for cutoff comparisons (cutoffDate is already UTC-adjusted)
  // Payment tracking starts from when the tenancy was created (user joined platform),
  // NOT from agreement lease_start_date. Agreement dates are extraction metadata only.
  // cashback_cutoff_day (grace period) is used for on_time/late/missed classification;
  // rent_due_day is only for display ("Your rent is due on the 1st").
  const trackingStart = new Date(tenancy.created_at);
  const cutoffDay = tenancy.cashback_cutoff_day ?? tenancy.rent_due_day;

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
  const endMonth = new Date(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1);

  while (cursor <= endMonth) {
    summary.total_months++;
    const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    // Classification uses cashback_cutoff_day (grace period), not rent_due_day
    const cutoffDate = new Date(cursor.getFullYear(), cursor.getMonth(), cutoffDay);
    // Due cutoff: end of cutoff day in IST (UTC+05:30) = 18:29:59.999 UTC
    const dueCutoff = new Date(cutoffDate);
    dueCutoff.setUTCHours(18, 29, 59, 999);

    const payment = paymentMap.get(monthKey);
    const isCurrentMonth = cursor.getFullYear() === nowIST.getUTCFullYear() && cursor.getMonth() === nowIST.getUTCMonth();
    const isFutureMonth = cursor > endMonth;

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
          landlord_name, landlord_phone, agreement_cert_id,
          bank_verified, utility_verified, landlord_approved, landlord_response, landlord_status,
          cashback_cutoff_day, created_at, extracted_rental_info_id
        `)
        .eq("user_id", userId)
        .in("status", ["active", "pending_verification"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 3. Total cashback earned (earned + discount entries)
      supabase
        .from("cashback_ledger")
        .select("amount_paise, transaction_type")
        .eq("user_id", userId)
        .in("transaction_type", ["earned", "discount"]),

      // 4. Legacy wallet balance (transition period)
      supabase.rpc("get_available_cashback", { p_user_id: userId }),

      // 5. Recent payments (last 5)
      supabase
        .from("payments")
        .select("id, rent_amount_paise, status, payment_month, paid_at, cashback_earned_paise, cashback_applied_paise, payment_method, landlord_payout_status")
        .eq("user_id", userId)
        .neq("status", "initiated")
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
        .select("id, account_holder_name, account_number_masked, ifsc_code, bank_name, verified, pan_number_masked, pan_verified, upi_vpa, verification_method")
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
    // PHASE 1.5: Fetch extracted_rental_info + stamp payments (depend on tenancy)
    // ============================================
    // Fetch extracted_rental_info separately (no FK on Main DB, so PostgREST
    // embedded resource join fails silently and nulls the entire tenancy row).
    let extractedRentalInfo: { tenant_names: string[]; security_deposit_paise: number } | null = null;
    if (tenancy?.extracted_rental_info_id) {
      const { data: eriData } = await supabase
        .from("extracted_rental_info")
        .select("tenant_names, security_deposit_paise")
        .eq("id", tenancy.extracted_rental_info_id)
        .maybeSingle();
      extractedRentalInfo = eriData;
    }

    let allTenancyPayments: any[] = [];
    if (tenancy?.id) {
      // Filter out test payments (e.g. ₹10) — only real rent payments count.
      // Uses 50% of monthly rent as threshold.
      const minRentPaise = Math.floor((tenancy.monthly_rent_paise ?? 0) * 0.5);
      const { data: stampPayments } = await supabase
        .from("payments")
        .select("payment_month, paid_at, status, rent_amount_paise")
        .eq("tenancy_id", tenancy.id)
        .in("status", ["success", "processing", "initiated"])
        .gte("rent_amount_paise", minRentPaise)
        .order("payment_month", { ascending: true });
      allTenancyPayments = stampPayments ?? [];
    }

    // ============================================
    // PHASE 2: Dependent calculations
    // ============================================

    // Calculate upcoming payment (depends on tenancy)
    // Always use the current calendar month — do NOT auto-advance to the next
    // unpaid month. Multiple payments for the same month are allowed.
    //
    // CRITICAL: Use IST (UTC+5:30) for all date calculations. Deno Deploy runs in UTC,
    // but all users are in India. Without IST, there's a 5.5-hour window at each month
    // boundary where the server disagrees with the client about which month it is.
    let upcomingPayment = null;
    if (tenancy) {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const nowUTC = new Date();
      const nowIST = new Date(nowUTC.getTime() + IST_OFFSET_MS);
      const currentMonth = nowIST.getUTCMonth();
      const currentYear = nowIST.getUTCFullYear();
      const todayDay = nowIST.getUTCDate();

      // Clamp rent_due_day to the last day of the month (e.g., rent_due_day=31 in Feb → 28)
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const clampedDueDay = Math.min(tenancy.rent_due_day, daysInMonth);

      const dueDate = new Date(currentYear, currentMonth, clampedDueDay);
      const daysUntilDue = clampedDueDay - todayDay;

      const rentMonthYYYYMM = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
      const rentMonthStr = `${rentMonthYYYYMM}-01`;

      // Check if the actual rent was paid this month.
      // Count payments >= 50% of monthly rent (ignores ₹10 test payments but allows partial payments).
      // Use limit(1) instead of maybeSingle() — multiple qualifying payments may exist.
      const minRentThreshold = Math.floor(tenancy.monthly_rent_paise * 0.5);
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("id, status, rent_amount_paise")
        .eq("tenancy_id", tenancy.id)
        .eq("payment_month", rentMonthStr)
        .eq("status", "success")
        .gte("rent_amount_paise", minRentThreshold)
        .limit(1);
      const existingPayment = existingPayments?.[0] ?? null;

      const cutoffDay = tenancy.cashback_cutoff_day ?? 7;
      const cutoffDate = new Date(Date.UTC(currentYear, currentMonth, cutoffDay, 18, 29, 59, 999));
      const pastCutoff = nowUTC > cutoffDate;

      upcomingPayment = {
        due_date: dueDate.toISOString().split("T")[0],
        amount: tenancy.monthly_rent_paise / 100,
        amount_paise: tenancy.monthly_rent_paise,
        days_until_due: daysUntilDue,
        is_overdue: daysUntilDue < 0,
        cashback_eligible: !pastCutoff && !existingPayment,
        past_cutoff: pastCutoff,
        cutoff_day: cutoffDay,
        rent_month: rentMonthYYYYMM,
        already_paid: !!existingPayment,
      };
    }

    // Calculate savings summary (earned + discount entries)
    const totalSavingsPaise = discountEntries.reduce(
      (sum: number, e: { amount_paise: number }) => sum + e.amount_paise, 0
    );
    // Available cashback balance from RPC (canonical source of truth)
    const availableCashbackPaise = legacyWalletBalance ?? 0;
    const legacyBalance = availableCashbackPaise / 100;
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
      cashback_applied: (p.cashback_applied_paise ?? 0) / 100,
      payment_method: p.payment_method ?? null,
      settlement_status: p.landlord_payout_status ?? null,
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
            landlord_phone: tenancy.landlord_phone ?? null,
            tenant_names: extractedRentalInfo?.tenant_names ?? [],
            security_deposit: (extractedRentalInfo?.security_deposit_paise ?? 0) / 100,
            agreement_cert_id: tenancy.agreement_cert_id ?? null,
            created_at: tenancy.created_at,
            verification_status: {
              bank_verified: tenancy.bank_verified,
              utility_verified: tenancy.utility_verified,
              landlord_approved: tenancy.landlord_approved,
              landlord_response: tenancy.landlord_response ?? null,
              landlord_status: tenancy.landlord_status ?? 'none',
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
        available_balance_paise: availableCashbackPaise,
        available_balance: legacyBalance,
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
