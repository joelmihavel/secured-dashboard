/**
 * Flent Secured v2 - Payment Webhook Edge Function
 *
 * Handles PayU S2S (Server-to-Server) callbacks for payment status updates.
 * Also handles success/failure redirect URLs.
 *
 * Endpoint: POST /functions/v1/payment-webhook
 * Auth: None (verified via hash)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, PaymentError, handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { verifyPayUWebhookHash } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY");
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT");

// Validate required environment variables at startup
if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
  throw new Error(
    "FATAL: PayU credentials not configured. " +
    "Set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT environment variables."
  );
}

// Cashback configuration
const CASHBACK_RATE = 0.01; // 1% cashback on rent payments
const CASHBACK_MAX_PAISE = 100000; // Max ₹1,000 cashback per payment

// PayU status mapping - comprehensive list of all PayU statuses
const PAYU_STATUS_MAP: Record<string, string> = {
  // Success statuses
  success: "success",
  captured: "success",

  // Processing/Pending statuses
  pending: "processing",
  initiated: "processing",
  inprogress: "processing",
  in_progress: "processing",
  on_hold: "processing", // Fraud check hold
  authorized: "processing", // Pre-capture state

  // Failure statuses
  failure: "failed",
  failed: "failed",
  usercancelled: "failed",
  user_cancelled: "failed",
  dropped: "failed",
  bounced: "failed",
  timeout: "failed",
  not_initiated: "failed",
  expired: "failed",
  rejected: "failed",
  cancelled: "failed",

  // Refund statuses
  refunded: "refunded",
  refund: "refunded",
  partially_refunded: "partially_refunded",
  partial_refund: "partially_refunded",
};

// Terminal states - cannot be changed once reached
const TERMINAL_STATES = ["success", "failed", "refunded", "partially_refunded"];

// ==============================================
// TYPES
// ==============================================

interface PayUWebhookPayload {
  mihpayid: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  hash: string;
  error?: string;
  error_Message?: string;
  bank_ref_no?: string;
  bankcode?: string;
  card_no?: string;
  name_on_card?: string;
  mode?: string;
  PG_TYPE?: string;
  addedon?: string;
  udf1?: string; // tenancy_id
  udf2?: string; // rent_month
  udf3?: string; // user_id
  udf4?: string;
  udf5?: string;
  field1?: string;
  field2?: string;
  field3?: string;
  field4?: string;
  field5?: string;
  field6?: string;
  field7?: string;
  field8?: string;
  field9?: string;
  net_amount_debit?: string;
  unmappedstatus?: string;
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
    // Parse form data (PayU sends application/x-www-form-urlencoded)
    const contentType = req.headers.get("content-type") ?? "";
    let payload: PayUWebhookPayload;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as PayUWebhookPayload;
    } else if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      throw new AppError("Unsupported content type", "INVALID_CONTENT_TYPE", 400);
    }

    // Validate required fields before processing
    const requiredFields = ["txnid", "status", "amount", "hash"] as const;
    const missingFields = requiredFields.filter(
      (field) => !payload[field] || payload[field].toString().trim() === ""
    );

    if (missingFields.length > 0) {
      console.error("PayU webhook missing required fields:", missingFields);
      throw new AppError(
        `Missing required fields: ${missingFields.join(", ")}`,
        "VALIDATION_ERROR",
        400
      );
    }

    console.log("PayU webhook received:", {
      txnid: payload.txnid,
      status: payload.status,
      mihpayid: payload.mihpayid,
    });

    // Verify hash
    const isValidHash = await verifyPayUWebhookHash({
      key: PAYU_MERCHANT_KEY,
      txnid: payload.txnid,
      amount: payload.amount,
      productinfo: payload.productinfo,
      firstname: payload.firstname,
      email: payload.email,
      status: payload.status,
      salt: PAYU_MERCHANT_SALT,
      hash: payload.hash,
      udf1: payload.udf1,
      udf2: payload.udf2,
      udf3: payload.udf3,
      udf4: payload.udf4,
      udf5: payload.udf5,
    });

    if (!isValidHash) {
      console.error("PayU hash verification failed");
      throw new AppError("Invalid webhook signature", "INVALID_HASH", 401);
    }

    // Initialize audit logger (no user auth, system action)
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "payment-webhook",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Find the payment record with tenancy details
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, tenancy:tenancies(user_id)")
      .eq("payu_txn_id", payload.txnid)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found for txnid:", payload.txnid);
      throw new PaymentError("Payment not found", "PAYMENT_NOT_FOUND");
    }

    // Idempotency check 1: Skip if payment is already in terminal state
    if (TERMINAL_STATES.includes(payment.status)) {
      console.log(`Payment ${payment.id} already in terminal state: ${payment.status}. Skipping update.`);
      return jsonResponse({
        status: "success",
        message: "Payment already processed (idempotent)",
        payment_id: payment.id,
        current_status: payment.status,
      });
    }

    // Idempotency check 2: Skip if same mihpayid already processed
    if (payment.payu_mihpayid && payment.payu_mihpayid === payload.mihpayid) {
      console.log(`Payment ${payment.id} already has mihpayid ${payload.mihpayid}. Skipping duplicate.`);
      return jsonResponse({
        status: "success",
        message: "Webhook already processed (duplicate mihpayid)",
        payment_id: payment.id,
        current_status: payment.status,
      });
    }

    // CRITICAL SECURITY CHECK: Verify amount matches initiated payment
    // BUG FIX: Use integer comparison in paise to avoid floating-point precision issues
    // PayU sends amount in rupees with decimals (e.g., "50000.00")
    const initiatedAmountPaise = payment.total_amount_paise;
    // Parse webhook amount carefully: multiply by 100 and round to handle floating-point
    const webhookAmountPaise = Math.round(parseFloat(payload.amount) * 100);

    // Also keep string comparison for logging purposes
    const initiatedAmountRupees = (payment.total_amount_paise / 100).toFixed(2);
    const webhookAmountRupees = (webhookAmountPaise / 100).toFixed(2);

    // Compare in paise (integers) for accuracy
    if (initiatedAmountPaise !== webhookAmountPaise) {
      console.error(`[SECURITY] Amount mismatch for payment ${payment.id}:`, {
        initiated: initiatedAmountRupees,
        webhook: webhookAmountRupees,
        txnid: payload.txnid,
        mihpayid: payload.mihpayid,
      });

      // Log security event
      await audit.logFailure(
        "PAYMENT_AMOUNT_MISMATCH",
        "security",
        "AMOUNT_MISMATCH",
        `Webhook amount (₹${webhookAmountRupees}) differs from initiated amount (₹${initiatedAmountRupees})`,
        "payment",
        payment.id,
        {
          initiated_amount: initiatedAmountRupees,
          webhook_amount: webhookAmountRupees,
          mihpayid: payload.mihpayid,
        }
      );

      throw new PaymentError(
        "Amount mismatch - potential tampering detected",
        "AMOUNT_MISMATCH"
      );
    }

    // Extract user_id from the joined tenancy
    const userId = (payment.tenancy as { user_id: string } | null)?.user_id;

    // Map PayU status to our status
    const newStatus = PAYU_STATUS_MAP[payload.status.toLowerCase()] ?? "failed";
    const isSuccess = newStatus === "success";

    // Update payment record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      payu_mihpayid: payload.mihpayid,
      payu_status: payload.status,
      payu_error_code: payload.error,
      payu_error_message: payload.error_Message,
      payment_method_details: {
        ...((payment.payment_method_details as Record<string, unknown>) ?? {}),
        bank_ref_no: payload.bank_ref_no,
        bankcode: payload.bankcode,
        mode: payload.mode,
        pg_type: payload.PG_TYPE,
        card_last4: payload.card_no?.slice(-4),
        name_on_card: payload.name_on_card,
      },
    };

    if (isSuccess) {
      updateData.paid_at = new Date().toISOString();

      // Calculate cashback earned (1% of rent amount)
      const cashbackEarnedPaise = Math.min(
        Math.floor(payment.rent_amount_paise * CASHBACK_RATE),
        CASHBACK_MAX_PAISE
      );
      updateData.cashback_earned_paise = cashbackEarnedPaise;
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id);

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw new AppError("Failed to update payment", "DB_ERROR", 500);
    }

    // If successful, credit cashback
    if (isSuccess && userId && (updateData.cashback_earned_paise as number) > 0) {
      await creditCashback(
        supabase,
        userId,
        updateData.cashback_earned_paise as number,
        payment.id,
        payment.tenancy_id,
        payload.udf2 ?? "" // rent_month
      );
    }

    // Send notifications
    if (isSuccess && userId) {
      await sendPaymentSuccessNotification(supabase, userId, payment, updateData.cashback_earned_paise as number);
    } else if (newStatus === "failed" && userId) {
      await sendPaymentFailedNotification(supabase, userId, payment, payload.error_Message);
    }

    // Log audit event
    await audit.log({
      action: isSuccess ? AuditActions.PAYMENT_SUCCESS : AuditActions.PAYMENT_FAILED,
      category: "payment",
      entityType: "payment",
      entityId: payment.id,
      details: {
        mihpayid: payload.mihpayid,
        status: payload.status,
        amount: payload.amount,
        mode: payload.mode,
        error: payload.error_Message,
      },
      status: "success",
    });

    // Return success to PayU
    return jsonResponse({
      status: "success",
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("Payment webhook error:", error);

    if (audit) {
      await audit.logFailure(
        "PAYMENT_WEBHOOK_ERROR",
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment"
      );
    }

    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// CASHBACK CREDITING
// ==============================================

async function creditCashback(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  amountPaise: number,
  paymentId: string,
  tenancyId: string,
  rentMonth: string
): Promise<void> {
  try {
    // Get current balance
    const { data: currentBalance } = await supabase.rpc("get_cashback_balance", {
      p_user_id: userId,
    });

    const newBalance = (currentBalance ?? 0) + amountPaise;

    // Calculate expiry (90 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Insert ledger entry
    await supabase.from("cashback_ledger").insert({
      user_id: userId,
      transaction_type: "earned",
      amount_paise: amountPaise,
      balance_after_paise: newBalance,
      payment_id: paymentId,
      tenancy_id: tenancyId,
      description: `1% cashback earned on rent payment for ${rentMonth}`,
      expires_at: expiresAt.toISOString(),
    });

    console.log(`Credited ${amountPaise} paise cashback to user ${userId}`);
  } catch (error) {
    console.error("Failed to credit cashback:", error);
    // Don't throw - cashback failure shouldn't fail the payment
  }
}

// ==============================================
// NOTIFICATIONS
// ==============================================

async function sendPaymentSuccessNotification(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  payment: Record<string, unknown>,
  cashbackEarnedPaise: number
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
    const cashbackRupees = (cashbackEarnedPaise / 100).toFixed(0);
    const firstName = user.full_name?.split(" ")[0] ?? "there";

    // Queue WhatsApp notification
    await supabase.from("notification_queue").insert({
      user_id: userId,
      notification_type: "whatsapp",
      payload: {
        to: user.phone,
        body: `Hi ${firstName}, your rent payment of ₹${amountRupees} was successful! You earned ₹${cashbackRupees} cashback.`,
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
          body: `Rent payment of ₹${amountRupees} completed. +₹${cashbackRupees} cashback!`,
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
