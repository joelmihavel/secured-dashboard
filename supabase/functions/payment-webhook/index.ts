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
import { parseRentMonth } from "../_shared/validation.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { scheduleNotification } from "../_shared/notifications.ts";
import { verifyPayUWebhookHashWithCharges, sha512, hmacSha256Base64, timingSafeCompare } from "../_shared/crypto.ts";
import {
  PAYU_MERCHANT_KEY,
  PAYU_MERCHANT_SALT,
  PAYU_INFO_URL,
  fetchWithTimeout,
  requirePayUCredentials,
} from "../_shared/payu-config.ts";

// ==============================================
// CONFIGURATION
// ==============================================

// Validate at startup — uses trimmed credentials from payu-config.ts
requirePayUCredentials();

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

// State transition matrix — PayU webhook is source of truth.
// Defines which transitions are valid when a webhook arrives.
// Cron may mark a payment "failed" (expired_no_webhook), but a late
// PayU webhook can still override it to success/refunded.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  initiated: ["processing", "success", "failed", "refunded", "partially_refunded"],
  processing: ["success", "failed", "refunded", "partially_refunded"],
  failed: ["success", "refunded", "partially_refunded"], // Late webhook overrides cron expiry
  expired: ["success", "failed"],                          // Late webhook after cleanup-stale-payments expiry
  success: ["refunded", "partially_refunded"],            // Post-success refund/dispute
  partially_refunded: ["refunded"],                       // Full refund completed
  refunded: [],                                           // Truly terminal
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
  bank_ref_no?: string;
  bankcode?: string;
  card_no?: string;
  card_last4?: string; // PayU sometimes returns last4 directly instead of card_no
  card_type?: string; // card network from PayU (VISA, MAST, etc.)
  name_on_card?: string;
  store_card_token?: string; // PayU vault token (if store_card=1 was sent)
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
  additional_charges?: string;
  [key: string]: string | undefined; // PayU may send additional fields
}

// ==============================================
// MAIN HANDLER
// ==============================================

// ==============================================
// CASHFREE WEBHOOK SIGNATURE VERIFICATION
// ==============================================

async function verifyCashfreeSignature(
  timestamp: string,
  rawBody: string,
  receivedSignature: string,
  secretKey: string
): Promise<boolean> {
  // Cashfree signs: timestamp + rawBody (NO separator per Cashfree docs)
  // See: https://docs.cashfree.com/docs/webhooks — "concatenate timestamp and raw body"
  const signedPayload = timestamp + rawBody;
  const expectedSignature = await hmacSha256Base64(signedPayload, secretKey);
  return timingSafeCompare(expectedSignature, receivedSignature);
}

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
    // Read raw body ONCE — needed for Cashfree signature verification
    // and also used by PayU path (since body stream can only be read once)
    const rawBody = await req.text();
    const cfTimestamp = req.headers.get('x-webhook-timestamp');
    const cfSignature = req.headers.get('x-webhook-signature');

    // ── CASHFREE WEBHOOK PATH ──────────────────────────────────────
    if (cfTimestamp && cfSignature) {
      const CF_WEBHOOK_SECRET = Deno.env.get('CASHFREE_PG_APP_SECRET') ?? Deno.env.get('CASHFREE_PG_SECRET_KEY') ?? '';

      const isValid = await verifyCashfreeSignature(cfTimestamp, rawBody, cfSignature, CF_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('[webhook] Cashfree signature verification FAILED');
        return errorResponse('Invalid signature', 400, 'CF_SIGNATURE_FAILED');
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return jsonResponse({ status: 'ignored', reason: 'invalid json' });
      }

      const cfOrderId = event.data?.order?.order_id;
      const cfPaymentId = event.data?.payment?.cf_payment_id;
      const cfStatus = event.data?.payment?.payment_status; // SUCCESS, FAILED, etc.
      const cfAmount = event.data?.order?.order_amount; // in rupees (decimal)
      // Include event type in dedup key to allow different events for same payment
      const eventId = `cf-${cfPaymentId ?? cfOrderId ?? Date.now()}-${event.type ?? 'unknown'}`;

      if (!cfOrderId) {
        console.warn('[webhook] Cashfree event missing order_id, ignoring');
        return jsonResponse({ status: 'ignored', reason: 'missing order_id' });
      }

      console.log('[webhook] Cashfree event received:', {
        type: event.type,
        cf_order_id: cfOrderId,
        cf_payment_id: cfPaymentId,
        status: cfStatus,
      });

      // Dedup check
      const { data: existingWebhook } = await supabase
        .from('processed_webhooks')
        .select('id')
        .eq('event_id', String(eventId))
        .maybeSingle();

      if (existingWebhook) {
        console.log(`[webhook] Duplicate Cashfree event ${eventId}, skipping`);
        return jsonResponse({ success: true, message: 'Already processed' });
      }

      // ── REFUND STATUS WEBHOOK ──────────────────────────────────────
      if (event.type === 'REFUND_STATUS_WEBHOOK' && event.data?.refund) {
        const refundData = event.data.refund;
        const refundId = refundData.refund_id ?? refundData.cf_refund_id;
        const refundStatus = refundData.refund_status; // SUCCESS, FAILED, CANCELLED, PENDING
        const refundOrderId = refundData.order_id;

        console.log('[webhook] Cashfree refund status:', { refundId, refundStatus, refundOrderId });

        // Find refund record by gateway_refund_id or matching order
        const { data: refundRecord } = await supabase
          .from('refunds')
          .select('id, payment_id, status, amount_paise, cashback_reversed_paise')
          .or(`gateway_refund_id.eq.${refundId},gateway_refund_id.eq.${refundData.cf_refund_id}`)
          .maybeSingle();

        if (refundRecord) {
          const statusMap: Record<string, string> = {
            'SUCCESS': 'completed',
            'FAILED': 'failed',
            'CANCELLED': 'cancelled',
            'PENDING': 'processing',
            'ONHOLD': 'processing',
          };
          const newRefundStatus = statusMap[refundStatus] ?? 'processing';

          // Update refund record
          await supabase.from('refunds').update({
            status: newRefundStatus,
            gateway_refund_status: refundStatus,
            gateway_metadata: refundData,
            completed_at: refundStatus === 'SUCCESS' ? new Date().toISOString() : null,
            processed_at: new Date().toISOString(),
          }).eq('id', refundRecord.id);

          // Notify user of successful refund (non-blocking)
          if (refundStatus === 'SUCCESS') {
            const { data: refundPayment } = await supabase
              .from('payments')
              .select('user_id')
              .eq('id', refundRecord.payment_id)
              .single();

            if (refundPayment?.user_id) {
              const refundAmountRupees = (refundRecord.amount_paise / 100).toLocaleString("en-IN");
              scheduleNotification(supabase, getSupabaseUrl(), getServiceKey(), {
                user_id: refundPayment.user_id,
                notification_type: "payment_refunded",
                template_vars: { amount: refundAmountRupees },
                related_entity_type: "payment",
                related_entity_id: String(refundRecord.payment_id),
              }).catch((e) => console.warn("[payment-webhook] Failed to send payment_refunded notification:", e));
            }
          }

          // If refund FAILED — revert payment status and re-credit reversed cashback
          if (refundStatus === 'FAILED' || refundStatus === 'CANCELLED') {
            await supabase.from('payments').update({
              status: 'success',
              refund_amount_paise: 0,
              refund_reason: null,
            }).eq('id', refundRecord.payment_id);

            // Re-credit cashback that was reversed when the refund was initiated
            const reversedAmount = (refundRecord as any).cashback_reversed_paise ?? 0;
            if (reversedAmount > 0) {
              // Find the payment's user_id
              const { data: paymentData } = await supabase
                .from('payments')
                .select('user_id, tenancy_id')
                .eq('id', refundRecord.payment_id)
                .single();

              if (paymentData) {
                try {
                  // sync_cashback_balance trigger on cashback_ledger handles users.cashback_balance_paise
                  await supabase.from('cashback_ledger').insert({
                    user_id: paymentData.user_id,
                    transaction_type: 'reinstatement',
                    amount_paise: reversedAmount,
                    balance_after_paise: 0, // approximate
                    payment_id: refundRecord.payment_id,
                    tenancy_id: paymentData.tenancy_id,
                    reference_type: 'refund',
                    reference_id: refundRecord.id,
                    description: 'Cashback reinstated — refund failed',
                  });
                  console.log(`[webhook] Re-credited ${reversedAmount} paise cashback for failed refund ${refundId}`);
                } catch (cbErr) {
                  console.error(`[webhook] Cashback reinstatement failed:`, cbErr);
                }
              }
            }

            console.warn(`[webhook] Refund ${refundId} FAILED — reverted payment ${refundRecord.payment_id} to success`);
          }

          // Record in processed_webhooks (correct schema: event_id, payment_gateway, payment_id)
          await supabase.from('processed_webhooks').insert({
            event_id: String(eventId),
            payment_gateway: 'cashfree',
            payment_id: refundRecord.payment_id,
          }).catch(() => {});
        } else {
          // No refund record — refund was initiated from Cashfree dashboard directly.
          // Find the payment by order_id and update status.
          if (refundOrderId && (refundStatus === 'SUCCESS' || refundStatus === 'ONHOLD')) {
            const { data: cfPayment } = await supabase
              .from('payments')
              .select('id, status, user_id')
              .or(`cf_order_id.eq.${refundOrderId},gateway_order_id.eq.${refundOrderId}`)
              .maybeSingle();

            if (cfPayment && cfPayment.status !== 'refunded') {
              const newStatus = refundStatus === 'SUCCESS' ? 'refunded' : cfPayment.status;
              await supabase.from('payments').update({
                status: newStatus,
                updated_at: new Date().toISOString(),
              }).eq('id', cfPayment.id);

              // Create a refund record for tracking
              await supabase.from('refunds').insert({
                payment_id: cfPayment.id,
                user_id: cfPayment.user_id,
                amount_paise: Math.round((refundData.refund_amount ?? 0) * 100),
                status: refundStatus === 'SUCCESS' ? 'completed' : 'processing',
                reason: 'Refund via Cashfree dashboard',
                payment_gateway: 'cashfree',
                gateway_refund_id: String(refundId),
                gateway_refund_status: refundStatus,
                gateway_metadata: refundData,
              }).catch((e: unknown) => console.error('[webhook] Failed to create refund record:', e));

              console.log(`[webhook] Dashboard refund: payment ${cfPayment.id} → ${newStatus} (refund_id=${refundId})`);

              // Notify user of successful dashboard refund (non-blocking)
              if (refundStatus === 'SUCCESS' && cfPayment.user_id) {
                const dashboardRefundAmountRupees = (refundData.refund_amount ?? 0).toLocaleString("en-IN");
                scheduleNotification(supabase, getSupabaseUrl(), getServiceKey(), {
                  user_id: cfPayment.user_id,
                  notification_type: "payment_refunded",
                  template_vars: { amount: dashboardRefundAmountRupees },
                  related_entity_type: "payment",
                  related_entity_id: String(cfPayment.id),
                }).catch((e) => console.warn("[payment-webhook] Failed to send payment_refunded notification:", e));
              }
            } else {
              console.warn(`[webhook] Payment not found for dashboard refund order_id=${refundOrderId}`);
            }
          } else {
            console.warn(`[webhook] Refund record not found for refund_id=${refundId}, status=${refundStatus}`);
          }
        }

        // Record in processed_webhooks (dedup for dashboard-initiated refunds too)
        await supabase.from('processed_webhooks').upsert({
          event_id: String(eventId),
          payment_gateway: 'cashfree',
          payment_id: refundOrderId ?? String(refundId),
        }, { onConflict: 'event_id' }).catch(() => {});

        return jsonResponse({ success: true, message: 'Refund status processed' });
      }

      // Find payment by cf_order_id (with retry for rare race condition where
      // webhook arrives before initiate-payment stores cf_order_id)
      let cfPayment = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error: cfLookupErr } = await supabase
          .from('payments')
          .select('*, tenancy:tenancies(user_id, monthly_rent_paise, bank_verified, utility_verified, landlord_approved, cashback_cutoff_day, rent_due_day)')
          .or(`cf_order_id.eq.${cfOrderId},gateway_order_id.eq.${cfOrderId}`)
          .maybeSingle();

        if (data) {
          cfPayment = data;
          break;
        }
        if (attempt < 2) {
          console.warn(`[webhook] Payment not found for cf_order_id=${cfOrderId}, retry ${attempt + 1}/2`);
          await new Promise((r) => setTimeout(r, 1000)); // 1s backoff
        } else {
          console.error(`[webhook] Payment not found after 3 attempts for cf_order_id=${cfOrderId}`, cfLookupErr);
        }
      }

      if (!cfPayment) {
        console.error(`[OPS_ALERT] Cashfree webhook for unknown order ${cfOrderId} — may be orphaned`);
        // Return 200 to prevent Cashfree infinite retries
        return jsonResponse({ status: 'ignored', reason: 'payment_not_found' });
      }

      // Amount validation (convert CF rupees to paise)
      const webhookAmountPaise = Math.round(parseFloat(cfAmount) * 100);
      if (webhookAmountPaise !== cfPayment.total_amount_paise) {
        console.error(`[webhook] SECURITY: Amount mismatch for payment ${cfPayment.id}: webhook=${webhookAmountPaise} vs db=${cfPayment.total_amount_paise}`);
        // Mark payment failed — don't return 400 (causes infinite Cashfree retries)
        await supabase.from("payments").update({
          status: "failed",
          gateway_metadata: {
            ...(typeof cfPayment.gateway_metadata === 'object' ? cfPayment.gateway_metadata : {}),
            amount_mismatch: { webhook: webhookAmountPaise, expected: cfPayment.total_amount_paise },
          },
        }).eq("id", cfPayment.id);
        // Return 200 to acknowledge webhook and stop retries
        return jsonResponse({ success: false, message: "Amount mismatch — payment marked failed" });
      }

      // Map Cashfree status to our status
      const CASHFREE_STATUS_MAP: Record<string, string> = {
        'SUCCESS': 'success',
        'FAILED': 'failed',
        'USER_DROPPED': 'failed',
        'CANCELLED': 'failed',
        'VOID': 'failed',
        'NOT_ATTEMPTED': 'failed',
        'PENDING': 'processing',
      };

      const newCfStatus = CASHFREE_STATUS_MAP[cfStatus] ?? 'failed';

      // Check allowed transitions (reuse ALLOWED_TRANSITIONS from existing code)
      const currentCfStatus = cfPayment.status;
      if (!ALLOWED_TRANSITIONS[currentCfStatus]?.includes(newCfStatus)) {
        console.log(`[webhook] Cashfree transition ${currentCfStatus} -> ${newCfStatus} not allowed, skipping`);
        // Record dedup anyway
        await supabase.from('processed_webhooks').insert({
          event_id: String(eventId),
          payment_id: cfPayment.id,
          payment_gateway: 'cashfree',
        });
        return jsonResponse({ success: true, message: 'Transition not allowed' });
      }

      // Update payment status
      const cfUpdateData: Record<string, unknown> = {
        status: newCfStatus,
        gateway_payment_id: String(cfPaymentId),
        gateway_metadata: event.data,
      };

      if (newCfStatus === 'success') {
        cfUpdateData.paid_at = new Date().toISOString();
        cfUpdateData.landlord_payout_status = 'ready'; // Cashfree: auto-pickup by settle-to-landlord cron
        cfUpdateData.landlord_payout_paise = cfPayment.rent_amount_paise;
        cfUpdateData.cf_split_posted = false; // Signal for settle-to-landlord cron
      }

      // Optimistic lock — only update if status hasn't changed concurrently
      const { data: cfUpdatedRow } = await supabase
        .from('payments')
        .update(cfUpdateData)
        .eq('id', cfPayment.id)
        .eq('status', currentCfStatus)
        .select('id')
        .maybeSingle();

      if (!cfUpdatedRow) {
        // Concurrent change — re-fetch and check
        const { data: freshCfPayment } = await supabase
          .from('payments')
          .select('id, status')
          .eq('id', cfPayment.id)
          .single();

        if (freshCfPayment) {
          const retryAllowed = (ALLOWED_TRANSITIONS[freshCfPayment.status] ?? []).includes(newCfStatus);
          if (retryAllowed) {
            await supabase
              .from('payments')
              .update(cfUpdateData)
              .eq('id', freshCfPayment.id)
              .eq('status', freshCfPayment.status);
            console.log(`[webhook] Cashfree payment ${cfPayment.id}: retried ${freshCfPayment.status} -> ${newCfStatus}`);
          } else {
            console.log(`[webhook] Cashfree payment ${cfPayment.id}: concurrent change to ${freshCfPayment.status}, ${newCfStatus} no longer valid`);
          }
        }
      }

      // Record processed webhook
      await supabase.from('processed_webhooks').insert({
        event_id: String(eventId),
        payment_id: cfPayment.id,
        payment_gateway: 'cashfree',
      });

      // On success: handle cashback and notifications
      if (newCfStatus === 'success') {
        console.log(`[webhook] Cashfree payment ${cfPayment.id} marked success, settlement pending`);

        // Cashback handling — reuse same logic as PayU path
        const cfTenancyData = cfPayment.tenancy as Record<string, any> | null;
        const cfUserId = cfPayment.user_id ?? cfTenancyData?.user_id;

        if (cfUserId && cfPayment.cashback_applied_paise > 0) {
          try {
            await supabase.from("cashback_ledger").insert({
              user_id: cfUserId,
              transaction_type: "discount",
              amount_paise: cfPayment.cashback_applied_paise,
              balance_after_paise: 0,
              payment_id: cfPayment.id,
              tenancy_id: cfPayment.tenancy_id,
              reference_type: "payment",
              reference_id: cfPayment.id,
              description: `1% instant discount on rent payment`,
            });
            const accumulatedUsed = cfPayment.accumulated_redeemed_paise ?? 0;
            if (accumulatedUsed > 0) {
              await supabase.from("cashback_ledger").insert({
                user_id: cfUserId,
                transaction_type: "applied",
                amount_paise: accumulatedUsed,
                balance_after_paise: 0,
                payment_id: cfPayment.id,
                tenancy_id: cfPayment.tenancy_id,
                reference_type: "payment",
                reference_id: cfPayment.id,
                description: `Accumulated cashback redeemed`,
              });
              await supabase.rpc("decrement_cashback_balance", {
                p_user_id: cfUserId,
                p_amount: accumulatedUsed,
              });
            }
          } catch (e) {
            console.error("[webhook] Failed to log Cashfree cashback discount:", e);
          }
        }

        if (cfUserId && cfPayment.cashback_earned_paise > 0) {
          try {
            await supabase.from("cashback_ledger").insert({
              user_id: cfUserId,
              transaction_type: "earned",
              amount_paise: cfPayment.cashback_earned_paise,
              balance_after_paise: 0,
              payment_id: cfPayment.id,
              tenancy_id: cfPayment.tenancy_id,
              reference_type: "payment",
              reference_id: cfPayment.id,
              description: `1% cashback earned (pending verification)`,
            });
            // sync_cashback_balance trigger on cashback_ledger handles users.cashback_balance_paise
          } catch (e) {
            console.error("[webhook] Failed to credit Cashfree earned cashback:", e);
          }
        }

        // Send notifications
        if (cfUserId) {
          await sendPaymentSuccessNotification(supabase, cfUserId, cfPayment, cfPayment.cashback_applied_paise ?? 0);
        }
      } else if (newCfStatus === 'failed') {
        const cfTenancyData = cfPayment.tenancy as Record<string, any> | null;
        const cfUserId = cfPayment.user_id ?? cfTenancyData?.user_id;
        if (cfUserId) {
          await sendPaymentFailedNotification(supabase, cfUserId, cfPayment, cfStatus);
        }
      } else if (newCfStatus === 'processing') {
        const cfTenancyData = cfPayment.tenancy as Record<string, any> | null;
        const cfUserId = cfPayment.user_id ?? cfTenancyData?.user_id;
        if (cfUserId) {
          scheduleNotification(supabase, getSupabaseUrl(), getServiceKey(), {
            user_id: cfUserId,
            notification_type: "payment_processing",
            related_entity_type: "payment",
            related_entity_id: String(cfPayment.id),
          }).catch((e) => console.warn("[payment-webhook] payment_processing notification failed:", e));
        }
      }

      return jsonResponse({ success: true });
    }
    // ── END CASHFREE WEBHOOK PATH ──────────────────────────────────

    // ── PAYU WEBHOOK PATH ──────────────────────────────────────────
    // Parse form data from pre-read rawBody (PayU sends application/x-www-form-urlencoded)
    const contentType = req.headers.get("content-type") ?? "";
    let payload: PayUWebhookPayload;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Parse URL-encoded form data from the raw body string
      const params = new URLSearchParams(rawBody);
      payload = Object.fromEntries(params.entries()) as unknown as PayUWebhookPayload;
    } else if (contentType.includes("application/json")) {
      payload = JSON.parse(rawBody);
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

    // Verify hash (supports additional_charges in hash formula)
    const isValidHash = await verifyPayUWebhookHashWithCharges({
      key: PAYU_MERCHANT_KEY,
      txnid: payload.txnid,
      amount: payload.amount,
      productinfo: payload.productinfo,
      firstname: payload.firstname,
      email: payload.email,
      status: payload.status,
      salt: PAYU_MERCHANT_SALT,
      hash: payload.hash,
      additionalCharges: payload.additional_charges,
      udf1: payload.udf1,
      udf2: payload.udf2,
      udf3: payload.udf3,
      udf4: payload.udf4,
      udf5: payload.udf5,
    });

    if (!isValidHash) {
      // Log diagnostic details for debugging hash mismatches
      console.error("[webhook] Hash verification FAILED. Diagnostic:", {
        key: PAYU_MERCHANT_KEY.slice(0, 4) + "****",
        saltLen: PAYU_MERCHANT_SALT.length,
        txnid: payload.txnid,
        amount: payload.amount,
        productinfo: payload.productinfo,
        firstname: payload.firstname,
        email: payload.email,
        status: payload.status,
        udf1: payload.udf1,
        udf2: payload.udf2,
        udf3: payload.udf3,
        udf4: payload.udf4 ?? "(undefined)",
        udf5: payload.udf5 ?? "(undefined)",
        additional_charges: payload.additional_charges ?? "(none)",
        received_hash_first16: payload.hash?.slice(0, 16),
      });
      // SECURITY: Reject webhook with invalid hash — forged webhooks must not be processed.
      // If Salt v1/v2 mismatch occurs, implement dual-salt verification rather than bypassing.
      throw new PaymentError("Webhook hash verification failed", "HASH_VERIFICATION_FAILED");
    }

    // Initialize audit logger (no user auth, system action)
    audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "payment-webhook",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // PayU dedup: check processed_webhooks table BEFORE main processing (prevents race condition
    // on first occurrence where mihpayid is not yet persisted to the payment row)
    const payuDedupKey = `payu-${payload.mihpayid}-${payload.status}`;
    const { data: existingPayuWebhook } = await supabase
      .from("processed_webhooks")
      .select("id")
      .eq("event_id", payuDedupKey)
      .maybeSingle();
    if (existingPayuWebhook) {
      console.log(`[webhook] PayU duplicate: ${payuDedupKey}`);
      return jsonResponse({ success: true, message: "Duplicate webhook" });
    }
    // Dedup record inserted AFTER payment lookup succeeds — prevents blocking
    // legitimate retries when payment is temporarily not found (race condition).

    // Find the payment record with tenancy details (including monthly_rent_paise for cashback cap)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*, tenancy:tenancies(user_id, monthly_rent_paise, bank_verified, utility_verified, landlord_approved, cashback_cutoff_day, rent_due_day)")
      .eq("payu_txn_id", payload.txnid)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found for txnid:", payload.txnid);
      throw new PaymentError("Payment not found", "PAYMENT_NOT_FOUND");
    }

    // Insert dedup now that payment is confirmed to exist
    await supabase.from("processed_webhooks").insert({
      event_id: payuDedupKey,
      payment_gateway: "payu",
      payment_id: payment.id,
    }).catch(() => {});

    // S9: Cross-validate UDFs against payment record — reject on mismatch
    if (payload.udf1 && payload.udf1 !== payment.tenancy_id) {
      console.error(`[SECURITY] UDF1 mismatch: payload=${payload.udf1}, payment=${payment.tenancy_id}`);
      await audit.logFailure(
        "PAYMENT_UDF_MISMATCH",
        "security",
        "UDF_MISMATCH",
        `Webhook UDF1 doesn't match payment tenancy_id`,
        "payment",
        payment.id
      );
      throw new PaymentError("Webhook tenancy cross-validation failed", "UDF_MISMATCH");
    }

    // Map PayU status early so we can validate the transition
    const newStatus = PAYU_STATUS_MAP[payload.status.toLowerCase()] ?? "failed";

    // Validate state transition — PayU webhook is source of truth
    const allowedNext = ALLOWED_TRANSITIONS[payment.status] ?? [];
    if (!allowedNext.includes(newStatus)) {
      // Same status or disallowed transition — idempotent no-op
      console.log(`Payment ${payment.id}: ${payment.status} → ${newStatus} not allowed. Skipping.`);
      return jsonResponse({
        status: "success",
        message: `Transition ${payment.status} → ${newStatus} not allowed (idempotent)`,
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

    // Extract user_id: prefer payment.user_id (always set), fallback to tenancy join
    // (card verification payments have no tenancy, so tenancy join returns null)
    const tenancyData = payment.tenancy as {
      user_id: string;
      monthly_rent_paise: number;
      bank_verified: boolean;
      utility_verified: boolean;
      landlord_approved: boolean;
    } | null;
    const userId = payment.user_id ?? tenancyData?.user_id;

    // newStatus already computed above (pre-transition validation)
    const isSuccess = newStatus === "success";

    // S6: Sanitize webhook payload — only store allowlisted fields
    const SAFE_WEBHOOK_FIELDS = [
      "mihpayid", "status", "txnid", "amount", "productinfo", "firstname",
      "email", "mode", "PG_TYPE", "bankcode", "bank_ref_no", "error",
      "error_Message", "addedon", "udf1", "udf2", "udf3", "udf4", "udf5",
      "field1", "field2", "field3", "field4", "field5", "field6", "field7",
      "field8", "field9", "net_amount_debit", "unmappedstatus", "additional_charges",
    ];
    const sanitizedPayload: Record<string, unknown> = {};
    for (const key of SAFE_WEBHOOK_FIELDS) {
      if (key in payload) {
        sanitizedPayload[key] = payload[key as keyof PayUWebhookPayload];
      }
    }
    if (payload.card_no) {
      sanitizedPayload.card_last4 = payload.card_no.slice(-4);
    }

    // Update payment record — store sanitized webhook payload
    const updateData: Record<string, unknown> = {
      status: newStatus,
      payu_mihpayid: payload.mihpayid,
      payu_status: payload.status,
      payu_error_code: payload.error,
      payu_error_message: payload.error_Message,
      payu_raw_response: sanitizedPayload,
      payment_method_details: {
        ...((payment.payment_method_details as Record<string, unknown>) ?? {}),
        bank_ref_no: payload.bank_ref_no,
        bankcode: payload.bankcode,
        mode: payload.mode,
        pg_type: payload.PG_TYPE,
        card_last4: payload.card_no?.slice(-4),
      },
    };

    if (isSuccess) {
      // Use PayU's payment completion timestamp (addedon) instead of webhook arrival time.
      // This prevents cutoff mis-evaluation when webhooks arrive late.
      updateData.paid_at = payload.addedon
        ? new Date(payload.addedon).toISOString()
        : new Date().toISOString();
      // cashback_earned_paise is already set correctly at initiation time
      // (0 for verified instant-discount, >0 for unverified earning)

      // Mark ready for settlement — settle-to-landlord queries 'ready'
      updateData.landlord_payout_status = 'ready';
      updateData.landlord_payout_paise = payment.rent_amount_paise;
    }

    // S5/S8: Optimistic lock — only update if status hasn't changed concurrently
    const { data: updatedRow, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id)
      .eq("status", payment.status)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw new AppError("Failed to update payment", "DB_ERROR", 500);
    }

    if (!updatedRow) {
      // Status was changed concurrently (e.g. cron expired it while webhook was in-flight).
      // Re-fetch and retry if the transition is still valid.
      const { data: freshPayment } = await supabase
        .from("payments")
        .select("id, status")
        .eq("id", payment.id)
        .single();

      if (!freshPayment) {
        throw new AppError("Payment not found on retry", "DB_ERROR", 500);
      }

      const retryAllowed = (ALLOWED_TRANSITIONS[freshPayment.status] ?? []).includes(newStatus);
      if (retryAllowed) {
        // Retry the update with the fresh status as the lock
        const { error: retryError } = await supabase
          .from("payments")
          .update(updateData)
          .eq("id", freshPayment.id)
          .eq("status", freshPayment.status);

        if (retryError) {
          console.error("Retry update failed:", retryError);
          throw new AppError("Failed to update payment on retry", "DB_ERROR", 500);
        }
        console.log(`Payment ${payment.id}: retried ${freshPayment.status} → ${newStatus} after concurrent change`);
      } else {
        console.log(`Payment ${payment.id}: concurrent change to ${freshPayment.status}, ${newStatus} no longer valid`);
        return jsonResponse({ status: "success", message: `Payment now in ${freshPayment.status}, transition not allowed` });
      }
    }

    // Cutoff re-validation: ensure payment was completed before the cashback cutoff
    // This prevents edge cases where payment was initiated before cutoff but completed after
    let cashbackBlockedByCutoff = false;
    if (isSuccess && (payment.cashback_applied_paise > 0 || payment.cashback_earned_paise > 0)) {
      const tenancyData = payment.tenancy as Record<string, any> | null;
      const cutoffDay = tenancyData?.cashback_cutoff_day ?? tenancyData?.rent_due_day ?? 7;
      const { year: rentYear, month: rentMonthNum } = parseRentMonth(payment.payment_month as string);
      // End of cutoff day in IST (UTC+05:30) → 18:29:59 UTC
      const cutoffDate = new Date(Date.UTC(rentYear, rentMonthNum - 1, cutoffDay, 18, 29, 59, 999));
      // Use the payment timestamp from PayU (addedon) stored in updateData.paid_at,
      // NOT Date.now() which is the webhook arrival time
      const paidAt = new Date((updateData.paid_at as string) ?? payment.paid_at ?? new Date().toISOString());

      if (paidAt > cutoffDate) {
        console.warn(`[payment-webhook] Payment ${payment.id} completed past cutoff (paid: ${paidAt.toISOString()}, cutoff: ${cutoffDate.toISOString()}). Zeroing cashback.`);
        cashbackBlockedByCutoff = true;
        // Persist zeroed cashback — main update already ran, so issue a second update
        const { error: cutoffErr } = await supabase
          .from("payments")
          .update({
            cashback_applied_paise: 0,
            cashback_earned_paise: 0,
            intended_cashback_paise: 0,
            accumulated_redeemed_paise: 0,
          })
          .eq("id", payment.id);
        if (cutoffErr) {
          console.error(`[payment-webhook] Failed to zero cashback for payment ${payment.id}:`, cutoffErr);
        }
      }
    }

    // PATH A: Verified user — instant discount was applied at initiation
    if (isSuccess && payment.cashback_applied_paise > 0 && userId && !cashbackBlockedByCutoff) {
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

        // Debit accumulated balance if it was redeemed as part of this discount
        const accumulatedUsed = payment.accumulated_redeemed_paise ?? 0;
        if (accumulatedUsed > 0) {
          await supabase.from("cashback_ledger").insert({
            user_id: userId,
            transaction_type: "applied",
            amount_paise: accumulatedUsed,
            balance_after_paise: 0,
            payment_id: payment.id,
            tenancy_id: payment.tenancy_id,
            reference_type: "payment",
            reference_id: payment.id,
            description: `Accumulated cashback redeemed`,
          });
          await supabase.rpc("decrement_cashback_balance", {
            p_user_id: userId,
            p_amount: accumulatedUsed,
          });
        }
      } catch (e) {
        console.error("Failed to log cashback discount:", e);
      }
    }

    // PATH B: Unverified user — earn 1% into balance
    if (isSuccess && payment.cashback_earned_paise > 0 && userId && !cashbackBlockedByCutoff) {
      try {
        await supabase.from("cashback_ledger").insert({
          user_id: userId,
          transaction_type: "earned",
          amount_paise: payment.cashback_earned_paise,
          balance_after_paise: 0,
          payment_id: payment.id,
          tenancy_id: payment.tenancy_id,
          reference_type: "payment",
          reference_id: payment.id,
          description: `1% cashback earned (pending verification)`,
        });
        // sync_cashback_balance trigger on cashback_ledger handles users.cashback_balance_paise
      } catch (e) {
        console.error("Failed to credit earned cashback:", e);
      }
    }

    // Auto-save payment method on success (server-side, more reliable than client)
    if (isSuccess && userId) {
      try {
        const mode = payload.mode?.toUpperCase();
        const methodType = mode === 'CC' || mode === 'DC' ? 'card'
          : mode === 'UPI' ? 'upi'
          : mode === 'NB' ? 'netbanking'
          : null;

        if (methodType) {
          const methodData: Record<string, unknown> = {
            user_id: userId,
            type: methodType,
            is_default: false,
            is_verified: true,
          };

          if (methodType === 'card') {
            // PayU returns card_no (masked) or card_last4 directly
            const last4 = payload.card_no?.slice(-4) ?? payload.card_last4 ?? null;
            // Map PayU bankcode to card network.
            // PayU returns "CC" as bankcode for credit cards (not the network).
            // For debit cards, bankcode IS the network (VISA, MAST, etc.).
            // Also check card_type field which may have the network.
            const bankcodeMap: Record<string, string> = {
              visa: 'visa', mast: 'mastercard', mastercard: 'mastercard',
              rupay: 'rupay', amex: 'amex', maes: 'maestro', maestro: 'maestro',
              dinr: 'mastercard', jcb: 'mastercard',
            };
            const rawBankcode = (payload.bankcode ?? '').toLowerCase();
            const rawCardType = (payload.card_type ?? '').toLowerCase();
            const cardNetwork = bankcodeMap[rawBankcode] ?? bankcodeMap[rawCardType] ?? null;
            methodData.card_last4 = last4;
            methodData.card_network = cardNetwork;
            methodData.card_type = mode === 'CC' ? 'credit' : 'debit';
            const networkDisplay = cardNetwork ? cardNetwork.charAt(0).toUpperCase() + cardNetwork.slice(1) : 'Card';
            methodData.display_name = `${networkDisplay} ****${last4 ?? '????'}`;
            // Save PayU vault token if returned (enables stored card payments)
            if (payload.store_card_token) {
              methodData.card_token = payload.store_card_token;
            }
          } else if (methodType === 'upi') {
            // PayU returns VPA in field3 for UPI INTENT (app-based) and field7 for UPI Collect.
            // field7 sometimes contains status text like "APPROVED OR COMPLETED SUCCESSFULLY|00",
            // so validate the value looks like a VPA (contains @) before using it.
            const pmd = payment.payment_method_details as Record<string, unknown> | null;
            const f3 = payload.field3 && String(payload.field3).includes('@') ? String(payload.field3) : null;
            const f7 = payload.field7 && String(payload.field7).includes('@') ? String(payload.field7) : null;
            const vpa = f3 ?? f7 ?? (pmd?.upi_vpa ? String(pmd.upi_vpa) : null);
            methodData.upi_vpa = vpa;
            methodData.display_name = `UPI - ${vpa ?? 'Unknown'}`;
          } else if (methodType === 'netbanking') {
            // PayU returns bankcode for NB; fallback to initiation data if missing
            const pmd = payment.payment_method_details as Record<string, unknown> | null;
            const bankCode = payload.bankcode ?? pmd?.bank_code ?? null;
            methodData.bank_code = bankCode;
            methodData.bank_name = bankCode;
            methodData.display_name = `Net Banking - ${bankCode ?? 'Bank'}`;
          }

          // Check for existing method to avoid duplicates.
          // Cards: match on user_id + type + card_last4
          // UPI: has a unique index on (user_id, upi_vpa)
          // NB: match on user_id + type + bank_code
          if (methodType === 'card') {
            const last4 = methodData.card_last4 as string | null;
            const cardTypeVal = methodData.card_type as string;
            if (last4) {
              const { data: existing } = await supabase
                .from("payment_methods")
                .select("id")
                .eq("user_id", userId)
                .eq("type", "card")
                .eq("card_last4", last4)
                .eq("card_type", cardTypeVal)
                .is("deleted_at", null)
                .maybeSingle();
              if (existing) {
                // Update existing card record (may add token if we have it now)
                const updateData: Record<string, unknown> = {
                  is_verified: true,
                  card_network: methodData.card_network,
                  display_name: methodData.display_name,
                };
                if (methodData.card_token) updateData.card_token = methodData.card_token;
                await supabase.from("payment_methods").update(updateData).eq("id", existing.id);
                console.log("[webhook] Updated existing card method:", existing.id);
              } else {
                await supabase.from("payment_methods").insert(methodData);
                console.log("[webhook] Inserted new card method for last4:", last4);
              }
            } else {
              console.warn("[webhook] Skipping card save — no card_last4 available");
            }
          } else if (methodType === 'upi') {
            // UPI has a unique index — use upsert
            await supabase
              .from("payment_methods")
              .upsert(methodData, { onConflict: 'user_id,upi_vpa', ignoreDuplicates: true })
              .eq("deleted_at", null);
          } else {
            // Netbanking: check-then-insert
            const bankCode = methodData.bank_code as string | null;
            if (bankCode) {
              const { data: existing } = await supabase
                .from("payment_methods")
                .select("id")
                .eq("user_id", userId)
                .eq("type", "netbanking")
                .eq("bank_code", bankCode)
                .is("deleted_at", null)
                .maybeSingle();
              if (!existing) {
                await supabase.from("payment_methods").insert(methodData);
              }
            }
          }
        }
      } catch (e) {
        // Non-blocking: payment success is more important than method save
        console.error("Failed to auto-save payment method:", e);
      }
    }

    // Auto-refund Rs.1 card verification payments
    if (isSuccess && payment.metadata?.purpose === "card_verification" && payload.mihpayid) {
      try {
        // Idempotency: skip if already refunded
        const { data: currentPayment } = await supabase
          .from("payments")
          .select("status")
          .eq("id", payment.id)
          .single();

        if (currentPayment?.status === "refunded") {
          console.log(`[webhook] Card verification ${payment.id} already refunded, skipping`);
        } else {
          const refundHash = await sha512(
            `${PAYU_MERCHANT_KEY}|cancel_refund_transaction|${payload.mihpayid}|${PAYU_MERCHANT_SALT}`
          );
          const refundResponse = await fetchWithTimeout(PAYU_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              key: PAYU_MERCHANT_KEY!,
              command: "cancel_refund_transaction",
              var1: payload.mihpayid,
              hash: refundHash,
            }).toString(),
          });
          const refundResult = await refundResponse.json();
          console.log(`[webhook] Card verification auto-refund for ${payment.id}:`, refundResult);

          if (refundResult.status === 1) {
            // Optimistic lock: only update to "refunded" if still "success"
            await supabase
              .from("payments")
              .update({ status: "refunded" })
              .eq("id", payment.id)
              .eq("status", "success");
          }
        }
      } catch (e) {
        // Non-blocking: verification succeeded, refund can be retried manually
        console.error(`[webhook] Auto-refund failed for card verification ${payment.id}:`, e);
      }
    }

    // Send notifications
    if (isSuccess && userId) {
      await sendPaymentSuccessNotification(supabase, userId, payment, payment.cashback_applied_paise ?? 0);
    } else if (newStatus === "failed" && userId) {
      await sendPaymentFailedNotification(supabase, userId, payment, payload.error_Message);
    }
    // PayU payment_processing notification removed — all payments now on Cashfree

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
// NOTIFICATIONS
// ==============================================

function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
}

function getServiceKey(): string {
  return Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function sendPaymentSuccessNotification(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  payment: Record<string, unknown>,
  savedPaise: number
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    const amountRupees = ((payment.rent_amount_paise as number) / 100).toLocaleString("en-IN");
    const savedRupees = (savedPaise / 100).toLocaleString("en-IN");
    const firstName = user?.full_name?.split(" ")[0] ?? "there";

    await scheduleNotification(supabase, getSupabaseUrl(), getServiceKey(), {
      user_id: userId,
      notification_type: "payment_success",
      template_vars: { name: firstName, amount: amountRupees, cashback: savedRupees },
      related_entity_type: "payment",
      related_entity_id: String(payment.id),
    }).catch((e) => console.error("Payment success notification failed:", e));
  } catch (error) {
    console.error("Failed to send success notification:", error);
  }
}

async function sendPaymentFailedNotification(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  payment: Record<string, unknown>,
  _errorMessage?: string
): Promise<void> {
  try {
    const amountRupees = ((payment.rent_amount_paise as number) / 100).toLocaleString("en-IN");

    await scheduleNotification(supabase, getSupabaseUrl(), getServiceKey(), {
      user_id: userId,
      notification_type: "payment_failed",
      template_vars: { amount: amountRupees },
      related_entity_type: "payment",
      related_entity_id: String(payment.id),
    }).catch((e) => console.error("Payment failed notification failed:", e));
  } catch (error) {
    console.error("Failed to send failure notification:", error);
  }
}
