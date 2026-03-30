/**
 * Flent Secured v2 - Payment Stamps Edge Function
 *
 * Returns a month-by-month payment history for a tenancy, classifying each
 * month as on_time, late, missed, or pending. Used to render the payment
 * stamp grid on the dashboard.
 *
 * Endpoint: GET /functions/v1/get-payment-stamps?tenancy_id=xxx
 * Auth: Required (JWT) - user must own the tenancy
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";

// ==============================================
// TYPES
// ==============================================

interface PaymentStampEntry {
  month: string; // "2026-01" ISO
  month_display: string; // "Jan 2026"
  status: "on_time" | "late" | "missed" | "pending";
  payment_id: string | null;
  paid_at: string | null;
  due_date: string; // "2026-01-07"
  days_late: number | null;
  amount_paise: number | null;
  cashback_applied_paise: number | null;
  payment_method: string | null;
}

interface PaymentStampSummary {
  total_months: number;
  on_time: number;
  late: number;
  missed: number;
  pending: number;
}

// ==============================================
// CONSTANTS
// ==============================================

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** IST offset in milliseconds (UTC+05:30) */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ==============================================
// HELPERS
// ==============================================

/**
 * Builds the due-date cutoff for a given month in IST.
 * Returns the end of the due day (23:59:59.999 IST) as a UTC timestamp.
 *
 * @param year  - Calendar year
 * @param month - 0-indexed month (0 = January)
 * @param dueDay - Day of month rent is due
 */
function buildDueCutoffUtc(year: number, month: number, dueDay: number): Date {
  // Clamp dueDay to the last day of the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(dueDay, daysInMonth);

  // 23:59:59.999 IST on the due date, converted to UTC
  const istEndOfDay = new Date(year, month, clampedDay, 23, 59, 59, 999);
  return new Date(istEndOfDay.getTime() - IST_OFFSET_MS);
}

/**
 * Returns the current date/time in IST as a plain object.
 */
function nowInIst(): { year: number; month: number; day: number; date: Date } {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: istNow.getUTCFullYear(),
    month: istNow.getUTCMonth(),
    day: istNow.getUTCDate(),
    date: now,
  };
}

/**
 * Formats "YYYY-MM" from year and 0-indexed month.
 */
function formatMonthIso(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Formats "Jan 2026" from year and 0-indexed month.
 */
function formatMonthDisplay(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/**
 * Formats "YYYY-MM-DD" for a due date.
 */
function formatDueDate(year: number, month: number, dueDay: number): string {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(dueDay, daysInMonth);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
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

    // Parse tenancy_id from query params
    const url = new URL(req.url);
    const tenancyId = url.searchParams.get("tenancy_id");

    if (!tenancyId) {
      return errorResponse(
        "tenancy_id query parameter is required",
        400,
        "MISSING_PARAM"
      );
    }

    // ============================================
    // PHASE 1: Fetch tenancy and verify ownership
    // ============================================

    const { data: tenancy, error: tenancyError } = await supabase
      .from("tenancies")
      .select(
        "id, user_id, rent_due_day, cashback_cutoff_day, status, created_at, monthly_rent_paise"
      )
      .eq("id", tenancyId)
      .single();

    if (tenancyError || !tenancy) {
      throw new AppError("Tenancy not found", "NOT_FOUND", 404);
    }

    if (tenancy.user_id !== userId) {
      throw new AppError(
        "You don't have permission to view this tenancy",
        "FORBIDDEN",
        403
      );
    }

    // ============================================
    // PHASE 2: Fetch all relevant payments
    // ============================================

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, payment_month, paid_at, rent_amount_paise, status, cashback_applied_paise, payment_method"
      )
      .eq("tenancy_id", tenancyId)
      .in("status", ["success", "processing", "initiated"])
      .order("payment_month", { ascending: true });

    if (paymentsError) {
      console.error("Failed to fetch payments:", paymentsError);
      throw new AppError(
        "Failed to fetch payment data",
        "DB_ERROR",
        500
      );
    }

    const paymentList = payments ?? [];

    // Index payments by month key (YYYY-MM) for O(1) lookup
    const paymentsByMonth = new Map<
      string,
      { id: string; paid_at: string | null; rent_amount_paise: number; status: string; cashback_applied_paise: number; payment_method: string | null }
    >();

    // Filter out test payments (e.g. ₹10) — only real rent payments count
    // for stamp classification. Uses 50% of monthly rent as threshold to
    // accommodate partial payments while excluding obvious test amounts.
    const minRentPaise = Math.floor((tenancy.monthly_rent_paise ?? 0) * 0.5);

    for (const p of paymentList) {
      // payment_month is stored as "YYYY-MM-01"; extract "YYYY-MM"
      const monthKey = p.payment_month
        ? p.payment_month.substring(0, 7)
        : null;

      if (!monthKey) continue;

      // Skip test payments — ₹10 test transactions shouldn't count as rent paid
      if (p.rent_amount_paise < minRentPaise) continue;

      // Prefer the most terminal status: success > processing > initiated
      const existing = paymentsByMonth.get(monthKey);
      if (
        !existing ||
        statusPriority(p.status) > statusPriority(existing.status)
      ) {
        paymentsByMonth.set(monthKey, {
          id: p.id,
          paid_at: p.paid_at,
          rent_amount_paise: p.rent_amount_paise,
          status: p.status,
          cashback_applied_paise: p.cashback_applied_paise ?? 0,
          payment_method: p.payment_method ?? null,
        });
      }
    }

    // ============================================
    // PHASE 3: Build month range
    // ============================================

    // Payment tracking starts from tenancy creation (when user joined platform),
    // NOT from agreement lease dates. Agreement dates are extraction metadata only.
    // cashback_cutoff_day (grace period) is used for on_time/late/missed classification;
    // rent_due_day is only for display ("Your rent is due on the 1st").
    const trackingStart = new Date(tenancy.created_at);
    const dueDay = tenancy.rent_due_day;
    // cashback_cutoff_day is the grace-period day used for on_time/late/missed classification.
    // rent_due_day is only used for the due_date display field.
    const cutoffDay = tenancy.cashback_cutoff_day ?? tenancy.rent_due_day;

    const ist = nowInIst();
    const currentYear = ist.year;
    const currentMonth = ist.month;
    const currentDay = ist.day;

    // First trackable month: if user joined AFTER this month's due date,
    // that month doesn't count (can't miss a payment that wasn't due yet).
    let startYear = trackingStart.getFullYear();
    let startMonth = trackingStart.getMonth();
    if (trackingStart.getDate() > dueDay) {
      startMonth++;
      if (startMonth > 11) { startMonth = 0; startYear++; }
    }

    // End month: always current month (no lease_end_date cap)
    const endYear = currentYear;
    const endMonth = currentMonth;

    // ============================================
    // PHASE 4: Classify each month
    // ============================================

    const stamps: PaymentStampEntry[] = [];
    const summary: PaymentStampSummary = {
      total_months: 0,
      on_time: 0,
      late: 0,
      missed: 0,
      pending: 0,
    };

    let y = startYear;
    let m = startMonth;

    while (y < endYear || (y === endYear && m <= endMonth)) {
      const monthKey = formatMonthIso(y, m);
      const dueDateStr = formatDueDate(y, m, dueDay); // display: actual rent due date
      const dueCutoffUtc = buildDueCutoffUtc(y, m, cutoffDay); // classification: cashback grace period
      const payment = paymentsByMonth.get(monthKey) ?? null;

      let status: PaymentStampEntry["status"];
      let daysLate: number | null = null;

      // Is this a future month or current month where cutoff date hasn't passed?
      const isFutureMonth =
        y > currentYear || (y === currentYear && m > currentMonth);
      const isCurrentMonth = y === currentYear && m === currentMonth;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const clampedCutoffDay = Math.min(cutoffDay, daysInMonth);
      const dueDateNotPassed = isCurrentMonth && currentDay <= clampedCutoffDay;

      // Grey (pending) is the zero state. Stamps only change when:
      // - Payment completed (success) → on_time or late
      // - Due date passed with no success payment → missed
      // failed/refunded/no-payment all remain grey until due date passes.
      if (isFutureMonth || dueDateNotPassed) {
        // Due date hasn't passed — grey unless already paid
        if (payment && payment.status === "success" && payment.paid_at) {
          const paidAtUtc = new Date(payment.paid_at);
          if (paidAtUtc <= dueCutoffUtc) {
            status = "on_time";
          } else {
            status = "late";
            daysLate = Math.ceil(
              (paidAtUtc.getTime() - dueCutoffUtc.getTime()) / 86400000
            );
          }
        } else {
          status = "pending"; // Grey: pending, processing, initiated, failed, refunded, or no payment
        }
      } else if (payment && payment.status === "success" && payment.paid_at) {
        // Successful payment exists - check if on time
        const paidAtUtc = new Date(payment.paid_at);
        if (paidAtUtc <= dueCutoffUtc) {
          status = "on_time";
        } else {
          status = "late";
          daysLate = Math.ceil(
            (paidAtUtc.getTime() - dueCutoffUtc.getTime()) / 86400000
          );
        }
      } else if (
        payment &&
        (payment.status === "processing" || payment.status === "initiated")
      ) {
        // Still processing — keep grey even past due
        status = "pending";
      } else {
        // Due date passed, no success/processing payment → missed
        status = "missed";
      }

      stamps.push({
        month: monthKey,
        month_display: formatMonthDisplay(y, m),
        status,
        payment_id: payment?.id ?? null,
        paid_at: payment?.paid_at ?? null,
        due_date: dueDateStr,
        days_late: daysLate,
        amount_paise: payment?.rent_amount_paise ?? null,
        cashback_applied_paise: payment?.cashback_applied_paise ?? null,
        payment_method: payment?.payment_method ?? null,
      });

      summary.total_months++;
      summary[status]++;

      // Advance to next month
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    // ============================================
    // Return response
    // ============================================

    return jsonResponse({
      success: true,
      data: {
        stamps,
        summary,
      },
    });
  } catch (error) {
    console.error("Get payment stamps error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// UTILITIES
// ==============================================

/**
 * Returns a numeric priority for payment status.
 * Higher = more terminal / more important.
 */
function statusPriority(status: string): number {
  switch (status) {
    case "success":
      return 3;
    case "processing":
      return 2;
    case "initiated":
      return 1;
    default:
      return 0;
  }
}
