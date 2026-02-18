/**
 * Flent Secured v2 - Schedule Payment Edge Function
 *
 * Creates and manages recurring monthly payment schedules.
 * Supports configurable due dates, auto-retry on failure, and pause/resume.
 *
 * Endpoints:
 * - POST /functions/v1/schedule-payment - Create or update a payment schedule
 * - DELETE via POST with action: "cancel" - Cancel a schedule
 *
 * Auth: Required (JWT)
 *
 * Request body (create):
 * {
 *   tenancy_id: string,
 *   payment_method: string,
 *   scheduled_day: number (1-28),
 *   auto_apply_cashback?: boolean,
 *   upi_vpa?: string,
 *   card_token?: string,
 *   bank_code?: string
 * }
 *
 * Request body (cancel/pause/resume):
 * {
 *   action: "cancel" | "pause" | "resume",
 *   schedule_id: string
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  ValidationError,
  NotFoundError,
  handleError,
} from "../_shared/errors.ts";
import {
  validateSchema,
  isValidUuid,
  isValidRentDueDay,
} from "../_shared/validation.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { isTestMode, mockData } from "../_shared/test-mode.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_HOURS = [4, 12, 24]; // Retry after 4h, 12h, 24h

// ==============================================
// TYPES
// ==============================================

interface CreateScheduleRequest {
  tenancy_id: string;
  payment_method: string;
  scheduled_day: number;
  auto_apply_cashback?: boolean;
  upi_vpa?: string;
  card_token?: string;
  bank_code?: string;
}

interface ManageScheduleRequest {
  action: "cancel" | "pause" | "resume";
  schedule_id: string;
}

// ==============================================
// VALIDATION SCHEMAS
// ==============================================

const createSchema = {
  tenancy_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid tenancy ID",
  },
  payment_method: {
    required: true,
    type: "string" as const,
    enum: [
      "upi",
      "upi_intent",
      "upi_collect",
      "card",
      "netbanking",
      "net_banking",
      "credit_card",
      "debit_card",
    ],
  },
  scheduled_day: {
    required: true,
    type: "number" as const,
    custom: (v: unknown) => isValidRentDueDay(v) || "Day must be between 1 and 28",
  },
  auto_apply_cashback: { required: false, type: "boolean" as const },
  upi_vpa: { required: false, type: "string" as const },
  card_token: { required: false, type: "string" as const },
  bank_code: { required: false, type: "string" as const },
};

const manageSchema = {
  action: {
    required: true,
    type: "string" as const,
    enum: ["cancel", "pause", "resume"],
  },
  schedule_id: {
    required: true,
    type: "string" as const,
    custom: (v: unknown) => isValidUuid(v) || "Invalid schedule ID",
  },
};

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return jsonResponse({
      success: true,
      data: {
        schedule_id: mockData.paymentSchedule.id,
        tenancy_id: mockData.paymentSchedule.tenancy_id,
        payment_method: mockData.paymentSchedule.payment_method,
        scheduled_day: mockData.paymentSchedule.scheduled_day,
        auto_apply_cashback: mockData.paymentSchedule.auto_apply_cashback,
        status: "active",
        next_execution_date: mockData.paymentSchedule.next_execution_date,
        monthly_rent_paise: mockData.paymentSchedule.monthly_rent_paise,
        retry_policy: { max_retries: MAX_RETRY_ATTEMPTS, retry_delays_hours: RETRY_DELAY_HOURS },
      },
    });
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "schedule-payment");

    // Parse request body
    const body = await req.json();

    // Route based on whether this is a management action or creation
    if (body.action && body.schedule_id) {
      return await handleManageSchedule(body, supabase, userId, audit);
    }

    return await handleCreateSchedule(body, supabase, userId, audit);
  } catch (error) {
    if (audit && userId) {
      await audit.logFailure(
        "PAYMENT_SCHEDULE_ERROR",
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment_schedule"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// CREATE SCHEDULE HANDLER
// ==============================================

async function handleCreateSchedule(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  audit: AuditLogger
): Promise<Response> {
  const validatedBody = validateSchema<CreateScheduleRequest>(
    body,
    createSchema,
    true
  );

  const {
    tenancy_id,
    payment_method,
    scheduled_day,
    auto_apply_cashback = true,
    upi_vpa,
    card_token,
    bank_code,
  } = validatedBody;

  // Validate payment method specific requirements
  if (payment_method === "upi_collect" && !upi_vpa) {
    throw new ValidationError("UPI VPA is required for UPI collect", {
      upi_vpa: "Required",
    });
  }
  if (
    (payment_method === "card" ||
      payment_method === "credit_card" ||
      payment_method === "debit_card") &&
    !card_token
  ) {
    throw new ValidationError("Card token is required for card payments", {
      card_token: "Required",
    });
  }
  if (
    (payment_method === "netbanking" || payment_method === "net_banking") &&
    !bank_code
  ) {
    throw new ValidationError("Bank code is required for netbanking", {
      bank_code: "Required",
    });
  }

  // Verify tenancy exists and belongs to user
  const { data: tenancy, error: tenancyError } = await supabase
    .from("tenancies")
    .select("id, user_id, status, monthly_rent_paise, bank_verified, landlord_approved")
    .eq("id", tenancy_id)
    .single();

  if (tenancyError || !tenancy) {
    throw new NotFoundError("Tenancy", tenancy_id);
  }

  if (tenancy.user_id !== userId) {
    throw new AppError(
      "You don't have permission for this tenancy",
      "FORBIDDEN",
      403
    );
  }

  if (tenancy.status !== "active" && tenancy.status !== "pending_verification") {
    throw new ValidationError("Tenancy must be active to set up auto-pay", {
      status: `Current status: ${tenancy.status}`,
    });
  }

  if (!tenancy.bank_verified) {
    throw new ValidationError(
      "Landlord bank account must be verified before setting up auto-pay",
      { bank_verified: "Required" }
    );
  }

  // Check for existing active schedule on this tenancy
  const { data: existingSchedule } = await supabase
    .from("payment_schedules")
    .select("id, status")
    .eq("tenancy_id", tenancy_id)
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .maybeSingle();

  if (existingSchedule) {
    throw new AppError(
      "An active payment schedule already exists for this tenancy. Cancel it first or use the update action.",
      "SCHEDULE_EXISTS",
      409
    );
  }

  // Calculate next execution date
  const nextExecutionDate = calculateNextExecutionDate(scheduled_day);

  // Create the schedule
  const { data: schedule, error: insertError } = await supabase
    .from("payment_schedules")
    .insert({
      user_id: userId,
      tenancy_id,
      payment_method,
      scheduled_day,
      auto_apply_cashback,
      payment_method_details: {
        upi_vpa,
        card_token,
        bank_code,
      },
      status: "active",
      next_execution_date: nextExecutionDate,
      retry_count: 0,
      max_retries: MAX_RETRY_ATTEMPTS,
    })
    .select()
    .single();

  if (insertError || !schedule) {
    console.error("Failed to create payment schedule:", insertError);
    throw new AppError("Failed to create payment schedule", "DB_ERROR", 500);
  }

  // Log audit
  await audit.logSuccess(
    "PAYMENT_SCHEDULE_CREATED",
    "payment",
    "payment_schedule",
    schedule.id,
    {
      tenancy_id,
      payment_method,
      scheduled_day,
      next_execution_date: nextExecutionDate,
      auto_apply_cashback,
    }
  );

  return jsonResponse({
    success: true,
    data: {
      schedule_id: schedule.id,
      tenancy_id,
      payment_method,
      scheduled_day,
      auto_apply_cashback,
      status: "active",
      next_execution_date: nextExecutionDate,
      monthly_rent_paise: tenancy.monthly_rent_paise,
      retry_policy: {
        max_retries: MAX_RETRY_ATTEMPTS,
        retry_delays_hours: RETRY_DELAY_HOURS,
      },
    },
  });
}

// ==============================================
// MANAGE SCHEDULE HANDLER
// ==============================================

async function handleManageSchedule(
  body: unknown,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  audit: AuditLogger
): Promise<Response> {
  const validatedBody = validateSchema<ManageScheduleRequest>(
    body,
    manageSchema,
    true
  );

  const { action, schedule_id } = validatedBody;

  // Fetch the schedule
  const { data: schedule, error: fetchError } = await supabase
    .from("payment_schedules")
    .select("*")
    .eq("id", schedule_id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !schedule) {
    throw new NotFoundError("Payment schedule", schedule_id);
  }

  let updateData: Record<string, unknown> = {};
  let auditAction: string;

  switch (action) {
    case "cancel": {
      if (schedule.status === "cancelled") {
        throw new AppError("Schedule is already cancelled", "ALREADY_CANCELLED", 400);
      }
      updateData = {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        next_execution_date: null,
      };
      auditAction = "PAYMENT_SCHEDULE_CANCELLED";
      break;
    }

    case "pause": {
      if (schedule.status !== "active") {
        throw new AppError(
          "Only active schedules can be paused",
          "INVALID_STATE",
          400
        );
      }
      updateData = {
        status: "paused",
        paused_at: new Date().toISOString(),
      };
      auditAction = "PAYMENT_SCHEDULE_PAUSED";
      break;
    }

    case "resume": {
      if (schedule.status !== "paused") {
        throw new AppError(
          "Only paused schedules can be resumed",
          "INVALID_STATE",
          400
        );
      }
      const nextDate = calculateNextExecutionDate(schedule.scheduled_day);
      updateData = {
        status: "active",
        paused_at: null,
        next_execution_date: nextDate,
        retry_count: 0, // Reset retries on resume
      };
      auditAction = "PAYMENT_SCHEDULE_RESUMED";
      break;
    }

    default:
      throw new ValidationError("Invalid action", { action: "Must be cancel, pause, or resume" });
  }

  // Apply update
  const { error: updateError } = await supabase
    .from("payment_schedules")
    .update(updateData)
    .eq("id", schedule_id);

  if (updateError) {
    console.error("Failed to update payment schedule:", updateError);
    throw new AppError("Failed to update payment schedule", "DB_ERROR", 500);
  }

  // Log audit
  await audit.logSuccess(
    auditAction,
    "payment",
    "payment_schedule",
    schedule_id,
    { action, previous_status: schedule.status }
  );

  return jsonResponse({
    success: true,
    data: {
      schedule_id,
      action,
      previous_status: schedule.status,
      new_status: updateData.status,
      next_execution_date: updateData.next_execution_date ?? schedule.next_execution_date,
    },
  });
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Calculates the next execution date for a payment schedule.
 * If the scheduled day has already passed this month, schedules for next month.
 */
function calculateNextExecutionDate(scheduledDay: number): string {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetMonth: number;
  let targetYear: number;

  if (currentDay < scheduledDay) {
    // Schedule for this month
    targetMonth = currentMonth;
    targetYear = currentYear;
  } else {
    // Schedule for next month
    targetMonth = currentMonth + 1;
    targetYear = currentYear;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
  }

  const nextDate = new Date(targetYear, targetMonth, scheduledDay);
  return nextDate.toISOString().split("T")[0];
}

/**
 * Calculates the next retry date based on retry count.
 * Returns null if max retries exceeded.
 */
export function calculateRetryDate(
  retryCount: number,
  maxRetries: number = MAX_RETRY_ATTEMPTS
): string | null {
  if (retryCount >= maxRetries) {
    return null;
  }

  const delayHours = RETRY_DELAY_HOURS[retryCount] ?? RETRY_DELAY_HOURS[RETRY_DELAY_HOURS.length - 1];
  const retryDate = new Date();
  retryDate.setHours(retryDate.getHours() + delayHours);

  return retryDate.toISOString();
}
