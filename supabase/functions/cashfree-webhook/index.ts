/**
 * Flent Secured v2 - Cashfree Webhook Edge Function
 *
 * Handles Cashfree PG webhook events for payment status updates.
 * Mirrors the PayU payment-webhook pattern with Cashfree-specific
 * signature verification, payload structure, and status mapping.
 *
 * Endpoint: POST /functions/v1/cashfree-webhook
 * Auth: None (verified via HMAC-SHA256 signature)
 *
 * Security:
 * - HMAC-SHA256 + Base64 signature verification
 * - Timestamp replay protection (5-minute window)
 * - Idempotency via processed_webhooks table
 * - Amount verification with float tolerance (1-paisa)
 * - Optimistic locking on payment status updates
 * - Sanitized payload storage (no raw secrets)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, PaymentError, handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { verifyCashfreeWebhookSignature } from "../_shared/cashfree-common.ts";
import { CF_STATUS_MAP } from "../_shared/cashfree-errors.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const CASHFREE_PG_SECRET_KEY = Deno.env.get("CASHFREE_PG_SECRET_KEY");

// Validate required environment variables at startup
if (!CASHFREE_PG_SECRET_KEY) {
  throw new Error(
    "FATAL: Cashfree PG secret key not configured. " +
    "Set CASHFREE_PG_SECRET_KEY environment variable."
  );
}

// Terminal states - cannot be changed once reached
const TERMINAL_STATES = ["success", "failed", "refunded", "partially_refunded"];

// ==============================================
// TYPES
// ==============================================

interface CashfreeWebhookPayload {
  type: string; // "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_FAILED_WEBHOOK", etc.
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_tags: Record<string, string>;
    };
    payment: {
      cf_payment_id: string;
      payment_status: string; // "SUCCESS", "FAILED", "USER_DROPPED", etc.
      payment_amount: number;
      payment_currency: string;
      payment_method: {
        [key: string]: unknown; // upi, card, netbanking, etc.
      };
      payment_time: string;
      payment_message?: string;
      bank_reference?: string;
      auth_id?: string;
    };
  };
}

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

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;

  try {
    // CRITICAL: Read raw body FIRST before JSON parsing.
    // JSON.parse() can alter decimal precision and break signature verification.
    const rawBody = await req.text();

    // Extract signature headers
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");

    if (!signature || !timestamp) {
      throw new AppError(
        "Missing webhook signature or timestamp headers",
        "MISSING_SIGNATURE",
        400
      );
    }

    // Verify HMAC-SHA256 signature (also validates timestamp within 5-minute window)
    const isValidSignature = await verifyCashfreeWebhookSignature(
      rawBody,
      timestamp,
      signature,
      CASHFREE_PG_SECRET_KEY
    );

    if (!isValidSignature) {
      console.error("Cashfree webhook signature verification failed");
      throw new AppError("Invalid webhook signature", "INVALID_SIGNATURE", 401);
    }

    // Now parse the verified raw body as JSON
    let payload: CashfreeWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError("Invalid JSON payload", "INVALID_JSON", 400);
    }

    // Validate required payload structure
    if (!payload.data?.order?.order_id || !payload.data?.payment?.cf_payment_id) {
      throw new AppError(
        "Missing required fields: data.order.order_id, data.payment.cf_payment_id",
        "VALIDATION_ERROR",
        400
      );
    }

    console.log("Cashfree webhook received:", {
      type: payload.type,
      order_id: payload.data.order.order_id,
      cf_payment_id: payload.data.payment.cf_payment_id,
      payment_status: payload.data.payment.payment_status,
    });

    // Initialize audit logger (no user auth, system action)
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "cashfree-webhook",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // --------------------------------------------------
    // Idempotency check via deterministic dedup key
    // --------------------------------------------------
    const headerIdempotencyKey = req.headers.get("x-idempotency-key");
    if (headerIdempotencyKey) {
      console.log(`Webhook x-idempotency-key header: ${headerIdempotencyKey}`);
    }
    // Always generate a deterministic dedup key from payload fields
    const dedupKey = `cashfree:${payload.data.order.order_id}:${payload.data.payment.cf_payment_id}:${payload.data.payment.payment_status}`;

    const { data: existingWebhook } = await supabase
      .from("processed_webhooks")
      .select("event_id")
      .eq("event_id", dedupKey)
      .maybeSingle();

    if (existingWebhook) {
      console.log(`Webhook already processed: dedup_key=${dedupKey}`);
      return jsonResponse({
        status: "success",
        message: "Webhook already processed (idempotent)",
      });
    }

    // --------------------------------------------------
    // Look up payment by gateway_order_id
    // --------------------------------------------------
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, tenancy:tenancies(user_id, monthly_rent_paise, bank_verified, utility_verified, landlord_approved)")
      .eq("gateway_order_id", payload.data.order.order_id)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found for gateway_order_id:", payload.data.order.order_id);
      throw new PaymentError("Payment not found", "PAYMENT_NOT_FOUND");
    }

    // Cross-validation: Ensure payment was initiated via Cashfree
    if (payment.payment_gateway !== "cashfree") {
      console.error(
        `[SECURITY] Gateway mismatch: payment ${payment.id} has gateway=${payment.payment_gateway}, expected cashfree`
      );
      await audit.logFailure(
        "PAYMENT_GATEWAY_MISMATCH",
        "security",
        "GATEWAY_MISMATCH",
        `Webhook for cashfree but payment gateway is ${payment.payment_gateway}`,
        "payment",
        payment.id
      );
      throw new PaymentError(
        "Payment gateway mismatch",
        "GATEWAY_MISMATCH"
      );
    }

    // --------------------------------------------------
    // Terminal state idempotency check
    // --------------------------------------------------
    if (TERMINAL_STATES.includes(payment.status)) {
      console.log(`Payment ${payment.id} already in terminal state: ${payment.status}. Skipping update.`);
      return jsonResponse({
        status: "success",
        message: "Payment already processed (idempotent)",
        payment_id: payment.id,
        current_status: payment.status,
      });
    }

    // Duplicate cf_payment_id check
    if (
      payment.gateway_payment_id &&
      payment.gateway_payment_id === String(payload.data.payment.cf_payment_id)
    ) {
      console.log(
        `Payment ${payment.id} already has cf_payment_id ${payload.data.payment.cf_payment_id}. Skipping duplicate.`
      );
      return jsonResponse({
        status: "success",
        message: "Webhook already processed (duplicate cf_payment_id)",
        payment_id: payment.id,
        current_status: payment.status,
      });
    }

    // --------------------------------------------------
    // Amount verification with float tolerance
    // --------------------------------------------------
    const webhookAmountPaise = Math.round(payload.data.payment.payment_amount * 100);
    const storedAmountPaise = payment.total_amount_paise;

    if (Math.abs(webhookAmountPaise - storedAmountPaise) > 1) {
      const webhookAmountRupees = (webhookAmountPaise / 100).toFixed(2);
      const storedAmountRupees = (storedAmountPaise / 100).toFixed(2);

      console.error(`[SECURITY] Amount mismatch for payment ${payment.id}:`, {
        stored: storedAmountRupees,
        webhook: webhookAmountRupees,
        order_id: payload.data.order.order_id,
        cf_payment_id: payload.data.payment.cf_payment_id,
      });

      await audit.logFailure(
        "PAYMENT_AMOUNT_MISMATCH",
        "security",
        "AMOUNT_MISMATCH",
        `Webhook amount (${webhookAmountRupees}) differs from stored amount (${storedAmountRupees})`,
        "payment",
        payment.id,
        {
          stored_amount: storedAmountRupees,
          webhook_amount: webhookAmountRupees,
          cf_payment_id: payload.data.payment.cf_payment_id,
        }
      );

      throw new PaymentError(
        "Amount mismatch - potential tampering detected",
        "AMOUNT_MISMATCH"
      );
    }

    // --------------------------------------------------
    // Extract user/tenancy context
    // --------------------------------------------------
    const tenancyData = payment.tenancy as {
      user_id: string;
      monthly_rent_paise: number;
      bank_verified: boolean;
      utility_verified: boolean;
      landlord_approved: boolean;
    } | null;
    const userId = tenancyData?.user_id;

    // --------------------------------------------------
    // Map Cashfree status to internal status
    // --------------------------------------------------
    const newStatus = CF_STATUS_MAP[payload.data.payment.payment_status] ?? "failed";
    const isSuccess = newStatus === "success";

    // --------------------------------------------------
    // Sanitize webhook payload for storage
    // --------------------------------------------------
    const sanitizedMetadata: Record<string, unknown> = {
      type: payload.type,
      order_id: payload.data.order.order_id,
      order_amount: payload.data.order.order_amount,
      order_currency: payload.data.order.order_currency,
      order_tags: payload.data.order.order_tags,
      cf_payment_id: payload.data.payment.cf_payment_id,
      payment_status: payload.data.payment.payment_status,
      payment_amount: payload.data.payment.payment_amount,
      payment_currency: payload.data.payment.payment_currency,
      payment_time: payload.data.payment.payment_time,
      payment_message: payload.data.payment.payment_message,
      bank_reference: payload.data.payment.bank_reference,
      auth_id: payload.data.payment.auth_id,
      // Store payment method type but sanitize sensitive details
      payment_method_type: Object.keys(payload.data.payment.payment_method ?? {})[0] ?? "unknown",
    };

    // --------------------------------------------------
    // Build update data
    // --------------------------------------------------
    const updateData: Record<string, unknown> = {
      status: newStatus,
      gateway_payment_id: String(payload.data.payment.cf_payment_id),
      gateway_status: payload.data.payment.payment_status,
      gateway_error_code: isSuccess ? null : payload.data.payment.payment_status,
      gateway_error_message: isSuccess ? null : (payload.data.payment.payment_message ?? null),
      gateway_metadata: sanitizedMetadata,
      payment_method_details: {
        ...((payment.payment_method_details as Record<string, unknown>) ?? {}),
        bank_reference: payload.data.payment.bank_reference,
        auth_id: payload.data.payment.auth_id,
        payment_method: payload.data.payment.payment_method,
        payment_time: payload.data.payment.payment_time,
      },
    };

    if (isSuccess) {
      updateData.paid_at = new Date().toISOString();

      // In instant-discount model, cashback_earned_paise is deprecated (set to 0)
      updateData.cashback_earned_paise = 0;

      // Queue landlord payout on success
      updateData.landlord_payout_status = "pending";
      updateData.landlord_payout_paise = payment.rent_amount_paise;
    }

    // --------------------------------------------------
    // Optimistic locking: only update if status hasn't changed concurrently
    // --------------------------------------------------
    const { data: updatedRow, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id)
      .eq("status", payment.status) // Optimistic lock
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw new AppError("Failed to update payment", "DB_ERROR", 500);
    }

    if (!updatedRow) {
      // Status was changed concurrently -- re-fetch and check
      const { data: freshPayment } = await supabase
        .from("payments")
        .select("id, status")
        .eq("id", payment.id)
        .single();

      if (freshPayment && TERMINAL_STATES.includes(freshPayment.status)) {
        return jsonResponse({
          status: "success",
          message: "Payment already in terminal state",
        });
      }
      throw new AppError(
        "Failed to update payment - concurrent modification",
        "CONCURRENT_UPDATE",
        409
      );
    }

    // --------------------------------------------------
    // Record in processed_webhooks for deduplication
    // --------------------------------------------------
    await supabase.from("processed_webhooks").insert({
      event_id: dedupKey,
      payment_gateway: "cashfree",
      payment_id: payment.id,
    }).then(({ error }) => {
      if (error) {
        console.warn("Failed to record processed webhook (non-fatal):", error.message);
      }
    });

    // --------------------------------------------------
    // Log instant discount as audit trail entry
    // --------------------------------------------------
    if (isSuccess && payment.cashback_applied_paise > 0 && userId) {
      try {
        await supabase.from("cashback_ledger").insert({
          user_id: userId,
          transaction_type: "discount",
          amount_paise: payment.cashback_applied_paise,
          balance_after_paise: 0,
          payment_id: payment.id,
          tenancy_id: payment.tenancy_id,
          reference_type: "payment",
          reference_id: payment.id,
          description: `1% instant discount on rent payment`,
        });
      } catch (e) {
        console.error("Failed to log cashback discount:", e);
      }
    }

    // --------------------------------------------------
    // Notifications
    // --------------------------------------------------
    if (isSuccess && userId) {
      await sendPaymentSuccessNotification(
        supabase,
        userId,
        payment,
        payment.cashback_applied_paise ?? 0
      );
    } else if (newStatus === "failed" && userId) {
      await sendPaymentFailedNotification(
        supabase,
        userId,
        payment,
        payload.data.payment.payment_message
      );
    }

    // --------------------------------------------------
    // Audit log
    // --------------------------------------------------
    await audit.log({
      action: isSuccess ? AuditActions.PAYMENT_SUCCESS : AuditActions.PAYMENT_FAILED,
      category: "payment",
      entityType: "payment",
      entityId: payment.id,
      details: {
        cf_payment_id: payload.data.payment.cf_payment_id,
        payment_status: payload.data.payment.payment_status,
        payment_amount: payload.data.payment.payment_amount,
        payment_method_type: Object.keys(payload.data.payment.payment_method ?? {})[0],
        error_message: payload.data.payment.payment_message,
        gateway: "cashfree",
      },
      status: "success",
    });

    // Return success to Cashfree
    return jsonResponse({
      status: "success",
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Cashfree webhook error:", error);

    if (audit) {
      await audit.logFailure(
        "CASHFREE_WEBHOOK_ERROR",
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment"
      );
    }

    // Permanent errors should return 200 so Cashfree does NOT retry.
    // Only transient failures (DB, network, concurrency) should return non-2xx.
    const PERMANENT_ERROR_CODES = [
      "AMOUNT_MISMATCH",
      "GATEWAY_MISMATCH",
      "VALIDATION_ERROR",
      "MISSING_SIGNATURE",
      "INVALID_SIGNATURE",
      "INVALID_JSON",
    ];

    const errorCode = error instanceof AppError ? error.code : undefined;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorCode && PERMANENT_ERROR_CODES.includes(errorCode)) {
      return jsonResponse({ success: false, error: errorMessage, code: errorCode }, 200);
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// NOTIFICATIONS
// ==============================================

async function sendPaymentSuccessNotification(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  payment: Record<string, unknown>,
  savedPaise: number
): Promise<void> {
  try {
    // Get user details
    const { data: user } = await supabase
      .from("users")
      .select("full_name, phone")
      .eq("id", userId)
      .single();

    if (!user) return;

    const amountRupees = ((payment.rent_amount_paise as number) / 100).toFixed(0);
    const savedRupees = (savedPaise / 100).toFixed(0);
    const firstName = user.full_name?.split(" ")[0] ?? "there";

    // Queue WhatsApp notification
    await supabase.from("notification_queue").insert({
      user_id: userId,
      notification_type: "whatsapp",
      payload: {
        to: user.phone,
        body: `Hi ${firstName}, your rent payment of Rs.${amountRupees} was successful! You saved Rs.${savedRupees} with Flent!`,
      },
      status: "pending",
    });

    // Queue push notification
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId);

    for (const dt of deviceTokens ?? []) {
      await supabase.from("notification_queue").insert({
        user_id: userId,
        notification_type: "push",
        payload: {
          device_token: dt.token,
          title: "Payment Successful!",
          body: `Rent payment of Rs.${amountRupees} completed. You saved Rs.${savedRupees}!`,
          data: {
            type: "payment_success",
            payment_id: payment.id,
          },
        },
        status: "pending",
      });
    }
  } catch (error) {
    console.error("Failed to send success notification:", error);
  }
}

async function sendPaymentFailedNotification(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  payment: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    // Get user's device tokens for push notification
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId);

    for (const dt of deviceTokens ?? []) {
      await supabase.from("notification_queue").insert({
        user_id: userId,
        notification_type: "push",
        payload: {
          device_token: dt.token,
          title: "Payment Failed",
          body: "Your rent payment couldn't be processed. Please try again.",
          data: {
            type: "payment_failed",
            payment_id: payment.id,
            error: errorMessage,
          },
        },
        status: "pending",
      });
    }
  } catch (error) {
    console.error("Failed to send failure notification:", error);
  }
}
