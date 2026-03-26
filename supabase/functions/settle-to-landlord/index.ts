/**
 * Flent Secured v2 - Settle to Landlord Edge Function
 *
 * Retry cron for failed postSplit() calls.
 * Easy Split settlement is automatic after a successful split config is posted —
 * this function exists only to retry payments where the inline postSplit()
 * in payment-webhook failed.
 *
 * Query: status=success AND cf_split_posted=false AND split_retry_count < 3
 *        AND paid_at < now() - 5 min (grace period for in-flight webhook)
 *
 * On postSplit() success: cf_split_posted=true, landlord_payout_status=processing
 * On postSplit() failure: split_retry_count += 1
 *   If split_retry_count reaches 3: landlord_payout_status=failed + ops alert
 *
 * Endpoint: POST /functions/v1/settle-to-landlord
 * Auth: Service role only (called by pg_cron every 30 min)
 * Cron: '15 * * * *'
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { getSystemTransferFlag } from "../_shared/transfer-flags.ts";
import { notifyUser } from "../_shared/notifications.ts";
import { postSplit, CashfreeError } from "../_shared/cashfree-easysplit.ts";

const BATCH_SIZE = 10;
const MAX_RETRY_COUNT = 3;
// Grace period: skip payments paid in the last 5 min (give payment-webhook time to run first)
const GRACE_PERIOD_MINUTES = 5;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    verifyServiceRole(req.headers.get("Authorization"));

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "settle-to-landlord",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // System flag early return
    const systemFlag = await getSystemTransferFlag(supabase);
    if (!systemFlag.enabled) {
      return jsonResponse({
        success: true,
        data: { processed: 0, message: "Landlord transfers disabled", reason: systemFlag.reason },
      });
    }

    // Grace period: ignore payments paid within the last 5 minutes
    const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000).toISOString();

    // Find payments that need a postSplit() retry
    const { data: payments, error: queryError } = await supabase
      .from("payments")
      .select(`
        id, user_id, tenancy_id, rent_amount_paise, landlord_payout_paise,
        cf_order_id, gateway_order_id, split_retry_count, paid_at,
        tenancy:tenancies(landlord_user_id, landlord_name)
      `)
      .eq("status", "success")
      .eq("payment_gateway", "cashfree")
      .eq("cf_split_posted", false)
      .lt("split_retry_count", MAX_RETRY_COUNT)
      .lt("paid_at", graceCutoff)
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      throw new AppError("Failed to query payments", "DB_ERROR", 500);
    }

    if (!payments || payments.length === 0) {
      return jsonResponse({ success: true, data: { processed: 0, message: "No split retries needed" } });
    }

    const results = { total: payments.length, posted: 0, retried: 0, failed_final: 0, errors: 0 };

    for (const payment of payments) {
      const tenancy = payment.tenancy as { landlord_user_id: string | null; landlord_name: string } | null;
      const cfOrderId = payment.cf_order_id ?? payment.gateway_order_id;

      if (!cfOrderId) {
        console.error(`[settle-to-landlord] No cf_order_id for payment ${payment.id}`);
        results.errors++;
        continue;
      }

      // Fetch landlord's active vendor
      const landlordUserId = tenancy?.landlord_user_id;
      if (!landlordUserId) {
        console.error(`[settle-to-landlord] No landlord_user_id for payment ${payment.id}`);
        results.errors++;
        continue;
      }

      const { data: bankAccount } = await supabase
        .from("bank_accounts")
        .select("cf_beneficiary_id, cf_beneficiary_status")
        .eq("user_id", landlordUserId)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .eq("verified", true)
        .maybeSingle();

      if (!bankAccount?.cf_beneficiary_id || bankAccount.cf_beneficiary_status !== "ACTIVE") {
        console.warn(`[settle-to-landlord] Landlord vendor not ACTIVE for payment ${payment.id} — skipping this cycle`);
        results.errors++;
        continue;
      }

      const payoutAmountPaise = payment.landlord_payout_paise ?? payment.rent_amount_paise;

      try {
        await postSplit({
          cfOrderId,
          vendorId: bankAccount.cf_beneficiary_id,
          amountPaise: payoutAmountPaise,
          paymentId: payment.id,
        });

        await supabase
          .from("payments")
          .update({
            cf_split_posted: true,
            landlord_payout_status: "processing",
          })
          .eq("id", payment.id);

        await audit.logSuccess(
          "SPLIT_POSTED_RETRY",
          "payment",
          "payment",
          payment.id,
          { cf_order_id: cfOrderId, vendor_id: bankAccount.cf_beneficiary_id, retry_count: payment.split_retry_count },
        );

        console.log(`[settle-to-landlord] Split posted (retry ${payment.split_retry_count + 1}) for payment ${payment.id}`);
        results.posted++;
      } catch (err) {
        const newRetryCount = (payment.split_retry_count ?? 0) + 1;
        const isFinal = newRetryCount >= MAX_RETRY_COUNT;
        const msg = err instanceof CashfreeError
          ? `HTTP ${(err as CashfreeError).statusCode}: ${err.message}`
          : (err as Error).message;

        console.error(`[settle-to-landlord] postSplit failed (attempt ${newRetryCount}/${MAX_RETRY_COUNT}) for payment ${payment.id}:`, msg);

        const updatePayload: Record<string, unknown> = { split_retry_count: newRetryCount };
        if (isFinal) {
          updatePayload.landlord_payout_status = "failed";
        }

        await supabase.from("payments").update(updatePayload).eq("id", payment.id);

        if (isFinal) {
          results.failed_final++;
          console.error(`[OPS_ALERT] Split failed after ${MAX_RETRY_COUNT} retries for payment ${payment.id} — manual intervention required`);

          await audit.logFailure(
            "SPLIT_FAILED_MAX_RETRIES",
            "payment",
            "SPLIT_FAILED",
            `postSplit failed after ${MAX_RETRY_COUNT} retries: ${msg}`,
            "payment",
            payment.id,
            { cf_order_id: cfOrderId, vendor_id: bankAccount.cf_beneficiary_id },
          );

          // Notify tenant
          if (payment.user_id) {
            const supabaseUrl = getSupabaseUrl();
            const serviceKey = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            notifyUser(supabaseUrl, serviceKey, {
              user_id: payment.user_id,
              notification_type: "settlement_failed",
              template_vars: { amount: (payoutAmountPaise / 100).toLocaleString("en-IN") },
              related_entity_type: "payment",
              related_entity_id: payment.id,
            }).catch((e) => console.error("[settle-to-landlord] Notify failed:", e));
          }
        } else {
          results.retried++;
        }
      }
    }

    if (results.failed_final > 0) {
      console.error(`[OPS_ALERT] ${results.failed_final} payment(s) failed split after max retries — require manual intervention`);
    }

    return jsonResponse({ success: true, data: results });
  } catch (error) {
    console.error("[settle-to-landlord] Fatal error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
