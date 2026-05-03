/**
 * Flent Secured v2 - Settle to Landlord Edge Function
 *
 * Processes landlord payouts for successfully collected payments.
 * Flent collects from user via PayU, then separately transfers to landlord.
 *
 * Logs payout details for manual processing via PayU dashboard.
 *
 * Endpoint: POST /functions/v1/settle-to-landlord
 * Auth: Service role only (called by cron or admin)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole, getSupabaseUrl } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { getSystemTransferFlag } from "../_shared/transfer-flags.ts";
import { createAdjustment, CashfreeError } from "../_shared/cashfree-pg-vendors.ts";
import { notifyUserWithFallback } from "../_shared/notifications.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const BATCH_SIZE = 10; // Max payments to process per invocation (payout fraud control)

// Minimum age before a payment is eligible for landlord settlement attempt.
// Prevents the race where landlord bank verification (penny drop + Cashfree
// vendor creation, ~30s–9min observed) finishes AFTER settle-to-landlord's
// first cron tick, causing a permanent failure (Faris case, 2026-05-02).
// 10 min covers the worst observed bank-verification latency with margin.
const MIN_PAYMENT_AGE_MS = 10 * 60 * 1000;

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

  try {
    // Verify service role authorization
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "settle-to-landlord",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // System flag early return
    const systemFlag = await getSystemTransferFlag(supabase);
    if (!systemFlag.enabled) {
      await audit.logSuccess(
        "LANDLORD_SETTLEMENT_SKIPPED",
        "system",
        undefined,
        undefined,
        { reason: systemFlag.reason ?? "System transfers disabled" },
      );
      return jsonResponse({
        success: true,
        data: {
          processed: 0,
          message: "Landlord transfers disabled",
          reason: systemFlag.reason,
        },
      });
    }

    // Query payments ready for landlord payout:
    // - Payment successful (user paid via PayU)
    // - PayU settlement confirmed (money reached Flent's account)
    // - Landlord payout status is 'ready' (not 'pending' — that transition belongs to Tier 1)
    // - Not individually held (transfer_hold = false)
    const { data: payments, error: queryError } = await supabase
      .from("payments")
      .select(`
        id, tenancy_id, user_id, rent_amount_paise, landlord_payout_paise,
        total_amount_paise, flent_subsidy_paise,
        landlord_payout_status, gateway_payout_status, payu_settlement_status, payu_txn_id,
        payment_gateway, gateway_order_id, gateway_settlement_status,
        cf_order_id, cf_adjustment_id, payout_retry_count,
        transfer_hold, transfer_hold_reason,
        payment_month, paid_at,
        tenancy:tenancies(
          id, landlord_name, landlord_phone, property_address,
          landlord_user_id
        )
      `)
      .eq("status", "success")
      .eq("landlord_payout_status", "ready")
      .eq("transfer_hold", false)
      // Race guard: only attempt payout once landlord bank verification has
      // had time to complete. See MIN_PAYMENT_AGE_MS comment above.
      .lt("paid_at", new Date(Date.now() - MIN_PAYMENT_AGE_MS).toISOString())
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("Failed to query payments for settlement:", queryError);
      throw new AppError("Failed to query payments", "DB_ERROR", 500);
    }

    if (!payments || payments.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          processed: 0,
          message: "No payments pending landlord payout",
        },
      });
    }

    const results: Array<{
      payment_id: string;
      status: "processing" | "failed" | "deferred";
      amount_paise: number;
      landlord_name: string;
      error?: string;
    }> = [];

    for (const payment of payments) {
      const tenancy = payment.tenancy as {
        id: string;
        landlord_name: string;
        landlord_phone: string | null;
        property_address: string;
        landlord_user_id: string | null;
      } | null;

      if (!tenancy) {
        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payment.landlord_payout_paise ?? payment.rent_amount_paise,
          landlord_name: "Unknown",
          error: "Tenancy not found",
        });
        continue;
      }

      // Defense-in-depth: per-payment hold check (catches TOCTOU race)
      if (payment.transfer_hold) {
        await audit.logSuccess(
          "LANDLORD_TRANSFER_HELD",
          "payment",
          "payment",
          payment.id,
          {
            reason: payment.transfer_hold_reason ?? "Payment held",
            source: "settle-to-landlord-loop",
          },
        );
        continue;
      }

      // Fetch landlord bank details: try landlord_user_id first, then fall back to tenant's user_id
      let bankAccount = null;
      const bankOwnerIds = [tenancy.landlord_user_id, payment.user_id].filter(Boolean) as string[];
      for (const ownerId of bankOwnerIds) {
        if (bankAccount) break;
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("id, account_holder_name, account_number_masked, ifsc_code, verified, cf_beneficiary_id, cf_beneficiary_status")
          .eq("user_id", ownerId)
          .eq("party_type", "landlord")
          .eq("is_primary", true)
          .maybeSingle();
        if (bank) bankAccount = bank;
      }

      const payoutAmountPaise = payment.landlord_payout_paise ?? payment.rent_amount_paise;

      // Security check: payout must not exceed the original rent amount.
      // With instant discount, total_amount_paise (net_rent + pg_fee) can be less than
      // landlord_payout_paise (full rent), so we compare against rent_amount_paise instead.
      const maxAllowedPayout = payment.rent_amount_paise;
      if (payoutAmountPaise > maxAllowedPayout) {
        console.error(
          `[SECURITY] Payout ${payoutAmountPaise} exceeds rent amount ${maxAllowedPayout} for payment ${payment.id}`
        );
        await audit.logFailure(
          "LANDLORD_PAYOUT_FAILED",
          "security",
          "PAYOUT_EXCEEDS_RENT",
          `Payout ${payoutAmountPaise} exceeds rent amount ${maxAllowedPayout}`,
          "payment",
          payment.id,
          { tenancy_id: tenancy?.id, payout_paise: payoutAmountPaise, rent_paise: maxAllowedPayout },
        );
        // Notify user of settlement failure (with queue fallback)
        notifyUserWithFallback(
          getSupabaseUrl(),
          (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
          supabase,
          {
            user_id: payment.user_id,
            notification_type: "settlement_failed",
            template_vars: { amount: (payoutAmountPaise / 100).toLocaleString("en-IN") },
            related_entity_type: "payment",
            related_entity_id: payment.id,
          },
        ).catch(() => {});

        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy?.landlord_name ?? "Unknown",
          error: "Payout exceeds rent amount",
        });
        continue;
      }

      if (!bankAccount || !bankAccount.verified) {
        // Cannot process — bank not verified
        const { error: updateError } = await supabase
          .from("payments")
          .update({
            landlord_payout_status: "failed",
            gateway_payout_status: "Landlord bank account not verified",
          })
          .eq("id", payment.id);

        if (updateError) {
          console.error(`Failed to update payment ${payment.id}:`, updateError);
        }

        await audit.logFailure(
          "LANDLORD_PAYOUT_FAILED",
          "payment",
          "BANK_NOT_VERIFIED",
          "Landlord bank account not verified",
          "payment",
          payment.id,
          { tenancy_id: tenancy.id, amount_paise: payoutAmountPaise },
        );

        // Notify user of settlement failure (with queue fallback)
        notifyUserWithFallback(
          getSupabaseUrl(),
          (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
          supabase,
          {
            user_id: payment.user_id,
            notification_type: "settlement_failed",
            template_vars: { amount: (payoutAmountPaise / 100).toLocaleString("en-IN") },
            related_entity_type: "payment",
            related_entity_id: payment.id,
          },
        ).catch(() => {});

        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy.landlord_name,
          error: "Landlord bank account not verified",
        });
        continue;
      }

      const payoutRef = `PAYOUT-${payment.id.slice(0, 8)}-${Date.now().toString(36)}`;

      // Optimistic lock: set to 'processing' first (prevents double-processing)
      // NOTE: landlord_payout_utr is NOT set here — it must only contain real bank UTRs
      // (set by cashfree-split-webhook or confirm-payout). payoutRef is for audit logs only.
      const { data: updatedRow, error: updateError } = await supabase
        .from("payments")
        .update({
          landlord_payout_status: "processing",
          landlord_payout_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("landlord_payout_status", "ready")
        .select("id")
        .maybeSingle();

      if (updateError || !updatedRow) {
        console.error(`Failed to update payment ${payment.id} to processing:`, updateError ?? "optimistic lock failed");
        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy.landlord_name,
          error: updateError ? "Failed to update status" : "Payment already picked up by another process",
        });
        continue;
      }

      // ── CASHFREE EASY SPLIT: on-demand transfer ──
      if (payment.payment_gateway === "cashfree") {
        const vendorId = bankAccount.cf_beneficiary_id;
        if (!vendorId) {
          // Vendor not yet created — revert to "ready" so next cron run retries
          // (sync-vendors will create the vendor, then settle-to-landlord picks it up)
          console.warn(`[settle-to-landlord] No cf_beneficiary_id for bank ${bankAccount.id} — reverting to ready for retry`);
          await supabase.from("payments").update({
            landlord_payout_status: "ready",
            gateway_payout_status: "Waiting for Cashfree vendor creation",
          }).eq("id", payment.id);
          results.push({
            payment_id: payment.id, status: "deferred", amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name, error: "No Cashfree vendor ID — will retry",
          });
          continue;
        }

        if (bankAccount.cf_beneficiary_status !== "ACTIVE") {
          // Vendor exists but not yet active — check retry count before reverting to "ready"
          const currentVendorStatus = bankAccount.cf_beneficiary_status;
          const retryCount = payment.payout_retry_count ?? 0;

          if (retryCount >= 10) {
            // Max retries exceeded — mark as permanently failed
            console.error(`[settle-to-landlord] Vendor ${vendorId} stuck in ${currentVendorStatus} after ${retryCount} retries — marking payment ${payment.id} as failed`);
            await supabase.from("payments").update({
              landlord_payout_status: "failed",
              gateway_payout_status: `Vendor stuck in ${currentVendorStatus} after ${retryCount} retries`,
            }).eq("id", payment.id);

            await audit.logFailure(
              "LANDLORD_PAYOUT_FAILED",
              "payment",
              "VENDOR_STUCK_MAX_RETRIES",
              `Vendor ${vendorId} stuck in ${currentVendorStatus} after ${retryCount} retries`,
              "payment",
              payment.id,
              { vendor_id: vendorId, vendor_status: currentVendorStatus, retry_count: retryCount },
            );

            results.push({
              payment_id: payment.id, status: "failed", amount_paise: payoutAmountPaise,
              landlord_name: tenancy.landlord_name, error: `Vendor stuck in ${currentVendorStatus} after ${retryCount} retries`,
            });
            continue;
          }

          // Revert to "ready" with incremented retry count
          console.warn(`[settle-to-landlord] Vendor ${vendorId} status is ${currentVendorStatus}, deferring payment ${payment.id} (retry ${retryCount + 1})`);
          await supabase.from("payments").update({
            landlord_payout_status: "ready",
            gateway_payout_status: `Vendor not active (${currentVendorStatus}) — retry ${retryCount + 1}`,
            payout_retry_count: retryCount + 1,
          }).eq("id", payment.id);
          results.push({
            payment_id: payment.id, status: "deferred", amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name, error: `Vendor status: ${currentVendorStatus} — will retry (${retryCount + 1}/10)`,
          });
          continue;
        }

        // Duplicate guard: if an adjustment was already created for this payment, skip
        if (payment.cf_adjustment_id) {
          console.warn(`[settle-to-landlord] Payment ${payment.id} already has cf_adjustment_id=${payment.cf_adjustment_id} — skipping duplicate adjustment`);
          await supabase.from("payments").update({
            landlord_payout_status: "processing",
            gateway_payout_status: "adjustment_credited",
          }).eq("id", payment.id);
          results.push({
            payment_id: payment.id, status: "processing", amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name,
          });
          continue;
        }

        try {
          const adjustResult = await createAdjustment({
            vendorId,
            amountPaise: payoutAmountPaise,
            paymentId: payment.id,
            remark: `Rent ${payment.payment_month} - ${tenancy.landlord_name}`,
          });

          console.log("[settle-to-landlord] Cashfree adjustment created:", {
            payment_id: payment.id,
            vendor_id: vendorId,
            status: adjustResult.status,
            amount_paise: payoutAmountPaise,
          });

          await supabase.from("payments").update({
            landlord_payout_status: "processing",
            gateway_payout_status: "adjustment_credited",
            cf_adjustment_id: adjustResult.adjustment_id ?? null,
          }).eq("id", payment.id);

          await audit.logSuccess("LANDLORD_PAYOUT_INITIATED", "payment", "payment", payment.id, {
            gateway: "cashfree", vendor_id: vendorId,
            amount_paise: payoutAmountPaise, landlord_name: tenancy.landlord_name,
            method: "adjustment",
          });

          results.push({
            payment_id: payment.id, status: "processing", amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name,
          });
        } catch (cfErr) {
          const errMsg = cfErr instanceof CashfreeError ? cfErr.message : String(cfErr);
          const isCfError = cfErr instanceof CashfreeError;
          const statusCode = isCfError ? (cfErr as CashfreeError).statusCode : 0;

          // For transient errors (5xx/timeout), keep as "processing" — the adjustment
          // may have been created at Cashfree despite the error response. Reverting to
          // "ready" would cause a duplicate adjustment on the next cron run.
          // The recon cron (poll-settlement-status) will reconcile these.
          const isTransient = statusCode >= 500 || statusCode === 0;

          console.error(`[settle-to-landlord] Cashfree adjustment failed for ${payment.id} (HTTP ${statusCode}, transient=${isTransient}):`, cfErr);

          if (isTransient) {
            // Keep as "processing" — do NOT revert to "ready" to prevent duplicate adjustments
            await supabase.from("payments").update({
              gateway_payout_status: `Cashfree adjustment pending (transient ${statusCode}): ${errMsg}`,
            }).eq("id", payment.id);
            results.push({
              payment_id: payment.id, status: "processing", amount_paise: payoutAmountPaise,
              landlord_name: tenancy.landlord_name, error: `Transient error — will reconcile`,
            });
          } else {
            await supabase.from("payments").update({
              landlord_payout_status: "failed",
              gateway_payout_status: `Cashfree adjustment failed (${statusCode}): ${errMsg}`,
            }).eq("id", payment.id);
            results.push({
              payment_id: payment.id, status: "failed", amount_paise: payoutAmountPaise,
              landlord_name: tenancy.landlord_name, error: errMsg,
            });
          }
        }
        continue;
      }

      // ── PAYU: manual-logging payout path ──
      console.log("[LANDLORD_PAYOUT] Ready for manual processing:", {
        payout_ref: payoutRef, payment_id: payment.id, payu_txn_id: payment.payu_txn_id,
        amount_paise: payoutAmountPaise, amount_rupees: (payoutAmountPaise / 100).toFixed(2),
        landlord_name: tenancy.landlord_name, bank_ifsc: bankAccount.ifsc_code,
      });

      await audit.logSuccess("LANDLORD_PAYOUT_INITIATED", "payment", "payment", payment.id, {
        gateway: "payu", payout_ref: payoutRef, amount_paise: payoutAmountPaise,
        landlord_name: tenancy.landlord_name, bank_ifsc: bankAccount.ifsc_code,
      });

      results.push({
        payment_id: payment.id, status: "processing", amount_paise: payoutAmountPaise,
        landlord_name: tenancy.landlord_name,
      });
    }

    const processed = results.filter((r) => r.status === "processing").length;
    const failed = results.filter((r) => r.status === "failed").length;

    // Alert ops if there are failures
    if (failed > 0) {
      console.error(`[OPS_ALERT] ${failed} landlord payouts failed out of ${results.length} attempted`);

      // Queue notification to ops
      await supabase.from("notification_queue").insert({
        notification_type: "internal",
        payload: {
          channel: "ops",
          title: "Landlord Payout Failures",
          body: `${failed} out of ${results.length} landlord payouts failed. Check settle-to-landlord logs.`,
          failures: results.filter((r) => r.status === "failed"),
        },
        status: "pending",
      });
    }

    return jsonResponse({
      success: true,
      data: {
        total: results.length,
        processed,
        failed,
        results,
      },
    });
  } catch (error) {
    console.error("Settle to landlord error:", error);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
