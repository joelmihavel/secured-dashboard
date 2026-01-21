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

// PayU status mapping
const PAYU_STATUS_MAP: Record<string, string> = {
  success: "success",
  failure: "failed",
  pending: "processing",
  userCancelled: "failed",
  dropped: "failed",
  bounced: "failed",
  initiated: "processing",
};

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
  bank_ref_num?: string;
  bankcode?: string;
  cardnum?: string;
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

    // Find the payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("payu_txn_id", payload.txnid)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found for txnid:", payload.txnid);
      throw new PaymentError("Payment not found", "PAYMENT_NOT_FOUND");
    }

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
        bank_ref_num: payload.bank_ref_num,
        bankcode: payload.bankcode,
        mode: payload.mode,
        pg_type: payload.PG_TYPE,
        card_last4: payload.cardnum?.slice(-4),
        name_on_card: payload.name_on_card,
      },
    };

    if (isSuccess) {
      updateData.paid_at = new Date().toISOString();

      // Calculate cashback earned (1% of amount)
      const cashbackEarnedPaise = Math.min(
        Math.floor(payment.amount_paise * CASHBACK_RATE),
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
    if (isSuccess && (updateData.cashback_earned_paise as number) > 0) {
      await creditCashback(
        supabase,
        payment.user_id,
        updateData.cashback_earned_paise as number,
        payment.id,
        payment.tenancy_id,
        payload.udf2 ?? "" // rent_month
      );
    }

    // Send notifications
    if (isSuccess) {
      await sendPaymentSuccessNotification(supabase, payment, updateData.cashback_earned_paise as number);
    } else if (newStatus === "failed") {
      await sendPaymentFailedNotification(supabase, payment, payload.error_Message);
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
  payment: Record<string, unknown>,
  cashbackEarnedPaise: number
): Promise<void> {
  try {
    // Get user details
    const { data: user } = await supabase
      .from("users")
      .select("first_name, phone")
      .eq("id", payment.user_id)
      .single();

    if (!user) return;

    const amountRupees = ((payment.amount_paise as number) / 100).toFixed(0);
    const cashbackRupees = (cashbackEarnedPaise / 100).toFixed(0);

    // Queue WhatsApp notification
    await supabase.from("notification_queue").insert({
      user_id: payment.user_id,
      notification_type: "whatsapp",
      payload: {
        to: user.phone,
        body: `Hi ${user.first_name}, your rent payment of ₹${amountRupees} was successful! You earned ₹${cashbackRupees} cashback. 🎉`,
      },
      status: "pending",
    });

    // Queue push notification
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", payment.user_id);

    for (const dt of deviceTokens ?? []) {
      await supabase.from("notification_queue").insert({
        user_id: payment.user_id,
        notification_type: "push",
        payload: {
          device_token: dt.token,
          title: "Payment Successful! 🎉",
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
  payment: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    // Get user details
    const { data: user } = await supabase
      .from("users")
      .select("first_name, phone")
      .eq("id", payment.user_id)
      .single();

    if (!user) return;

    // Queue push notification
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", payment.user_id);

    for (const dt of deviceTokens ?? []) {
      await supabase.from("notification_queue").insert({
        user_id: payment.user_id,
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
