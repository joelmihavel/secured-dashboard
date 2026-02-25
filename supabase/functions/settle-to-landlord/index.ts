/**
 * Flent Secured v2 - Settle to Landlord Edge Function
 *
 * Processes landlord payouts for successfully collected payments.
 * Flent collects from user via PayU, then separately transfers to landlord.
 *
 * MVP: Logs payout details for manual processing.
 * V2: Integrates with payout API (Cashfree/RazorpayX).
 *
 * Endpoint: POST /functions/v1/settle-to-landlord
 * Auth: Service role only (called by cron or admin)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { createBeneficiary, createTransfer, getTransferStatus, createSettlementAdjustment } from "../_shared/cashfree-payouts.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const BATCH_SIZE = 10; // Max payments to process per invocation (payout fraud control)

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

    // Query payments ready for landlord payout:
    // - Payment successful (user paid via PayU)
    // - PayU settlement confirmed (money reached Flent's account)
    // - Landlord payout still pending
    const { data: payments, error: queryError } = await supabase
      .from("payments")
      .select(`
        id, tenancy_id, user_id, rent_amount_paise, landlord_payout_paise,
        total_amount_paise, flent_subsidy_paise,
        landlord_payout_status, payu_settlement_status, payu_txn_id,
        payment_gateway, gateway_order_id, gateway_settlement_status,
        payment_month, paid_at,
        tenancy:tenancies(
          id, landlord_name, landlord_phone, property_address,
          landlord_bank_account_id
        )
      `)
      .eq("status", "success")
      .in("landlord_payout_status", ["pending", "ready"])
      .or("payu_settlement_status.eq.settled,gateway_settlement_status.eq.settled")
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
      status: "processing" | "failed";
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
        landlord_bank_account_id: string | null;
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

      // Fetch landlord bank details
      let bankAccount = null;
      if (tenancy.landlord_bank_account_id) {
        const { data: bank } = await supabase
          .from("bank_accounts")
          .select("id, account_holder_name, account_number_masked, ifsc_code, verified, cf_beneficiary_id")
          .eq("id", tenancy.landlord_bank_account_id)
          .single();
        bankAccount = bank;
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
            landlord_payout_error: "Landlord bank account not verified",
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

        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy.landlord_name,
          error: "Landlord bank account not verified",
        });
        continue;
      }

      // Route to appropriate payout method based on gateway
      if (payment.payment_gateway === 'cashfree') {
        // Cashfree Payouts API
        try {
          // Check/create beneficiary
          const beneficiaryId = bankAccount.cf_beneficiary_id;
          if (!beneficiaryId) {
            // Beneficiary must be pre-created during bank verification (verify-bank function).
            // We cannot create one here because we only have the masked account number.
            throw new Error(
              `No Cashfree beneficiary found for bank account ${tenancy.landlord_bank_account_id}. ` +
              `Re-verify the bank account to create the beneficiary.`
            );
          }

          // Create transfer
          const transferId = `PAYOUT-${payment.id.slice(0, 8)}-${Date.now().toString(36)}`;
          const transfer = await createTransfer({
            transferId,
            amount: payoutAmountPaise / 100, // Cashfree expects rupees
            transferMode: "IMPS",
            beneficiaryId,
            remarks: `Rent payout for ${payment.payment_month}`,
          });

          // If there's a Flent subsidy (1% instant discount), create a settlement
          // adjustment to cover the gap from merchant balance so landlord gets full rent.
          const subsidyPaise = payment.flent_subsidy_paise ?? 0;
          if (subsidyPaise > 0 && payment.gateway_order_id) {
            try {
              await createSettlementAdjustment(
                payment.gateway_order_id,
                subsidyPaise,
                `Flent 1% instant discount subsidy for payment ${payment.id}`,
              );
              console.log(
                `[CASHFREE_ADJUSTMENT] Created ${subsidyPaise} paise adjustment for payment ${payment.id}`
              );
            } catch (adjError) {
              // Log but don't block the payout — adjustment can be retried or handled manually
              console.error(
                `[CASHFREE_ADJUSTMENT] Failed for payment ${payment.id}:`,
                adjError,
              );
              await audit.logFailure(
                "SETTLEMENT_ADJUSTMENT_FAILED",
                "payment",
                "CASHFREE_ADJUSTMENT_ERROR",
                adjError instanceof Error ? adjError.message : "Adjustment API error",
                "payment",
                payment.id,
                { subsidy_paise: subsidyPaise, order_id: payment.gateway_order_id },
              );
            }
          }

          // Update payment with payout details
          await supabase
            .from("payments")
            .update({
              landlord_payout_status: "processing",
              landlord_payout_ref: transferId,
              landlord_payout_initiated_at: new Date().toISOString(),
              gateway_payout_id: transfer.transfer_id,
              gateway_payout_status: transfer.status,
            })
            .eq("id", payment.id);

          results.push({
            payment_id: payment.id,
            status: "processing",
            amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name,
          });
          continue;
        } catch (payoutError) {
          console.error(`Cashfree payout failed for payment ${payment.id}:`, payoutError);

          // Persist failure status to DB so it is not retried blindly
          await supabase
            .from("payments")
            .update({
              landlord_payout_status: "failed",
              landlord_payout_error: payoutError instanceof Error ? payoutError.message : "Payout API error",
            })
            .eq("id", payment.id);

          results.push({
            payment_id: payment.id,
            status: "failed",
            amount_paise: payoutAmountPaise,
            landlord_name: tenancy.landlord_name,
            error: payoutError instanceof Error ? payoutError.message : "Payout API error",
          });
          continue;
        }
      }

      // PayU path: existing manual logging (unchanged)
      const payoutRef = `PAYOUT-${payment.id.slice(0, 8)}-${Date.now().toString(36)}`;

      console.log("[LANDLORD_PAYOUT] Ready for manual processing:", {
        payout_ref: payoutRef,
        payment_id: payment.id,
        payu_txn_id: payment.payu_txn_id,
        amount_paise: payoutAmountPaise,
        amount_rupees: (payoutAmountPaise / 100).toFixed(2),
        landlord_name: tenancy.landlord_name,
        landlord_phone: tenancy.landlord_phone,
        bank_holder: bankAccount.account_holder_name,
        bank_account_masked: bankAccount.account_number_masked,
        bank_ifsc: bankAccount.ifsc_code,
        property: tenancy.property_address,
        payment_month: payment.payment_month,
      });

      // Update payment status to processing
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          landlord_payout_status: "processing",
          landlord_payout_ref: payoutRef,
          landlord_payout_initiated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (updateError) {
        console.error(`Failed to update payment ${payment.id} to processing:`, updateError);
        results.push({
          payment_id: payment.id,
          status: "failed",
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy.landlord_name,
          error: "Failed to update status",
        });
        continue;
      }

      await audit.logSuccess(
        "LANDLORD_PAYOUT_INITIATED",
        "payment",
        "payment",
        payment.id,
        {
          payout_ref: payoutRef,
          amount_paise: payoutAmountPaise,
          landlord_name: tenancy.landlord_name,
          bank_ifsc: bankAccount.ifsc_code,
        },
      );

      results.push({
        payment_id: payment.id,
        status: "processing",
        amount_paise: payoutAmountPaise,
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
