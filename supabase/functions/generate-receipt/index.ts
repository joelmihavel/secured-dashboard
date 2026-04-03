/**
 * Flent Secured v2 - Generate Receipt Edge Function (BE-087)
 *
 * Generates a rent payment receipt as JSON data including tax breakdown.
 * The mobile app renders this data into a visual receipt.
 *
 * Endpoint: GET /functions/v1/generate-receipt?payment_id=xxx
 *
 * Optional query params:
 * - include_tax: boolean (default: true) - Include GST/tax breakdown
 *
 * Auth: Required (User JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";
import { getVendorRecon, CashfreeError } from "../_shared/cashfree-easysplit.ts";
// ==============================================
// TYPES
// ==============================================

interface ReceiptData {
  receipt_number: string;
  generated_at: string;

  payment: {
    id: string;
    transaction_id: string | null;
    payment_gateway_id: string | null;
    amount: number;
    amount_paise: number;
    pg_fee: number;
    pg_fee_paise: number;
    cashback_applied: number;
    cashback_applied_paise: number;
    cashback_earned: number;
    cashback_earned_paise: number;
    convenience_fee: number;
    convenience_fee_paise: number;
    fee_billing_model: string;
    net_amount_paid: number;
    net_amount_paid_paise: number;
    payment_method: string | null;
    status: string;
    rent_month: string;
    rent_month_display: string;
    paid_at: string;
    utr: string | null;
    timeliness: 'on_time' | 'late' | null;
  };

  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
    pan_masked: string | null;
  };

  property: {
    address: string;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };

  landlord: {
    name: string;
    bank_account_masked: string | null;
    pan_masked: string | null;
  };

  agreement: {
    cert_id: string | null;
  };

  tax: {
    subtotal: number;
    subtotal_paise: number;
    gst_rate: number;
    gst_amount: number;
    gst_amount_paise: number;
    cgst_amount: number;
    sgst_amount: number;
    total_with_tax: number;
    total_with_tax_paise: number;
    hsn_sac_code: string;
    tax_note: string;
  } | null;

  company: {
    name: string;
    gstin: string;
  };
}

// ==============================================
// CONFIGURATION
// ==============================================

const COMPANY_INFO = {
  name: Deno.env.get("COMPANY_NAME") || "Flent Secured",
  gstin: Deno.env.get("COMPANY_GSTIN") || "",
};

// GST configuration
const GST_RATE = 0.18; // 18% GST
const HSN_SAC_CODE = "997212"; // SAC code for rental payment facilitation services
const PG_FEE_TAXABLE = true; // PG fee is the taxable service amount

if (!COMPANY_INFO.gstin) {
  console.warn(
    "WARNING: COMPANY_GSTIN not configured. Receipts will be incomplete."
  );
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse query parameters
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");
    const includeTax = url.searchParams.get("include_tax") !== "false";

    if (!paymentId) {
      throw new AppError("payment_id is required", "VALIDATION_ERROR", 400);
    }

    // Fetch payment with related data (retry once — webhook may still be writing)
    let payment: any = null;
    let paymentError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await supabase
        .from("payments")
        .select(`
          id, user_id, payu_txn_id, payu_mihpayid, payu_bank_ref_num, settlement_utr, gateway_payout_utr, landlord_payout_utr, gateway_settlement_utr,
          payment_gateway, gateway_payment_id, cf_order_id, cf_adjustment_id, payment_method_details,
          landlord_payout_status, landlord_payout_at, landlord_payout_paise,
          rent_amount_paise, pg_fee_paise, convenience_fee_paise, fee_billing_model,
          cashback_applied_paise, cashback_earned_paise,
          payment_method, status, payment_month, paid_at, created_at, due_date,
          tenancies (
            id, property_address, property_city, property_state, property_pincode,
            landlord_name, landlord_pan_masked, agreement_cert_id, rent_due_day,
            landlord_user_id,
            users!tenancies_user_id_fkey (
              first_name, last_name, phone, pan_number
            )
          )
        `)
        .eq("id", paymentId)
        .eq("user_id", userId)
        .single();
      payment = result.data;
      paymentError = result.error;
      if (payment?.status === "success") break;
      // Payment exists but not yet success (webhook race) — wait and retry
      if (attempt === 0 && (!payment || payment.status !== "success")) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (paymentError || !payment) {
      throw new AppError("Payment not found or access denied", "NOT_FOUND", 404);
    }

    // Only allow receipt for successful payments
    if (payment.status !== "success") {
      throw new AppError(
        "Receipt is only available for successful payments",
        "INVALID_STATUS",
        400
      );
    }

    // ── INLINE SETTLEMENT CHECK ──────────────────────────────────────
    // If gateway_payout_utr is missing and the payment has been in processing/retrying
    // for >15 min (Cashfree's recommended wait), try the Vendor Recon API to backfill.
    // This covers cases where the split webhook was missed or delayed.
    // NOTE: Does NOT check "settled" payments — those should have been backfilled
    // by the one-time migration. Keeping this lean to avoid recon API calls on every receipt.
    const RECON_MIN_AGE_MS = 15 * 60_000; // 15 minutes — per Cashfree docs
    const hasNoUtr = !resolveUtr(payment);
    const isSettlementPending = ["processing", "retrying"].includes(payment.landlord_payout_status);
    const payoutAge = payment.landlord_payout_at
      ? Date.now() - new Date(payment.landlord_payout_at).getTime()
      : Infinity;
    const isCashfreePayment = payment.payment_gateway === "cashfree";

    if (hasNoUtr && isSettlementPending && payoutAge > RECON_MIN_AGE_MS && isCashfreePayment) {
      try {
        // Look up vendor_id for this payment's landlord
        const { data: bankAcct } = await supabase
          .from("bank_accounts")
          .select("cf_beneficiary_id")
          .eq("user_id", payment.user_id)
          .eq("party_type", "landlord")
          .eq("is_primary", true)
          .not("cf_beneficiary_id", "is", null)
          .maybeSingle();

        if (bankAcct?.cf_beneficiary_id) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
          const now = new Date().toISOString();
          const recon = await getVendorRecon({
            vendorId: bankAcct.cf_beneficiary_id,
            startDate: sevenDaysAgo,
            endDate: now,
          });

          const settledEntries = (recon.data ?? []).filter(e => e.settled && e.settlement_utr);

          if (settledEntries.length > 0) {
            // Try entity_id match first (precise), then single-entry, then amount
            let matched = payment.cf_adjustment_id
              ? settledEntries.find(e => e.entity_id != null && String(e.entity_id) === String(payment.cf_adjustment_id))
              : null;

            if (!matched && settledEntries.length === 1) {
              matched = settledEntries[0];
            }

            if (!matched) {
              const payoutRupees = (payment.landlord_payout_paise ?? payment.rent_amount_paise) / 100;
              matched = settledEntries.find(e => Math.abs(e.amount - payoutRupees) < 1) ?? null;
            }

            if (matched) {
              // Backfill UTR into the database so future reads are instant
              await supabase.from("payments").update({
                gateway_payout_utr: matched.settlement_utr,
                gateway_payout_id: String(matched.settlement_id),
                gateway_payout_status: "settlement_success",
                gateway_settlement_status: "settled",
                landlord_payout_status: "settled",
                gateway_settled_at: matched.settlement_time,
              }).eq("id", payment.id).in("landlord_payout_status", ["processing", "retrying"]);

              // Update local object so this receipt includes the UTR
              payment.gateway_payout_utr = matched.settlement_utr;
              console.log(`[generate-receipt] Backfilled UTR ${matched.settlement_utr} for payment ${payment.id} via vendor recon`);
            }
          }
        }
      } catch (reconErr) {
        // Non-fatal — receipt still generates with "Pending" UTR
        console.warn("[generate-receipt] Vendor recon check failed:", reconErr instanceof CashfreeError
          ? `HTTP ${reconErr.statusCode}: ${reconErr.message}`
          : reconErr);
      }
    }

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    // Format rent month for display
    const rentMonthDate = new Date(payment.payment_month);
    const rentMonthDisplay = rentMonthDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    // Generate receipt number
    const receiptNumber = generateReceiptNumber(payment.id, payment.paid_at);

    // Get landlord bank account (masked) — fetched separately since bank_accounts
    // has FK to users, not tenancies (PostgREST can't join through tenancies)
    const tenancy = payment.tenancies as any;
    const landlordUserId = tenancy?.landlord_user_id ?? null;
    let landlordBankMasked: string | null = null;
    let landlordBankHolderName: string | null = null;
    if (landlordUserId) {
      const { data: landlordBank } = await supabase
        .from("bank_accounts")
        .select("account_number_masked, account_holder_name")
        .eq("user_id", landlordUserId)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .maybeSingle();
      landlordBankMasked = landlordBank?.account_number_masked ?? null;
      landlordBankHolderName = landlordBank?.account_holder_name ?? null;
    }

    // Calculate tax breakdown
    const pgFeePaise = payment.pg_fee_paise ?? 0;
    const convenienceFeePaise = payment.convenience_fee_paise ?? 0;
    const paymentFeeBillingModel = payment.fee_billing_model ?? "pg_billed";
    const taxData = includeTax ? calculateTax(pgFeePaise) : null;

    // Build receipt data
    const amountPaise = payment.rent_amount_paise ?? 0;
    const cashbackAppliedPaise = payment.cashback_applied_paise ?? 0;
    // If cashback_earned not recorded but payment succeeded, compute as 1% of rent
    const rawEarnedPaise = payment.cashback_earned_paise ?? 0;
    const cashbackEarnedPaise = rawEarnedPaise > 0
      ? rawEarnedPaise
      : (payment.status === "success" ? Math.floor(amountPaise * 0.01) : 0);
    const netAmountPaise = amountPaise - cashbackAppliedPaise;

    const receiptData: ReceiptData = {
      receipt_number: receiptNumber,
      generated_at: new Date().toISOString(),

      payment: {
        id: payment.id,
        transaction_id: payment.payu_txn_id || payment.cf_order_id || payment.gateway_payment_id,
        payment_gateway_id: payment.payu_mihpayid || payment.gateway_payment_id,
        amount: amountPaise / 100,
        amount_paise: amountPaise,
        pg_fee: pgFeePaise / 100,
        pg_fee_paise: pgFeePaise,
        cashback_applied: cashbackAppliedPaise / 100,
        cashback_applied_paise: cashbackAppliedPaise,
        cashback_earned: cashbackEarnedPaise / 100,
        cashback_earned_paise: cashbackEarnedPaise,
        convenience_fee: convenienceFeePaise / 100,
        convenience_fee_paise: convenienceFeePaise,
        fee_billing_model: paymentFeeBillingModel,
        net_amount_paid: netAmountPaise / 100,
        net_amount_paid_paise: netAmountPaise,
        payment_method: formatPaymentMethod(payment.payment_method),
        status: payment.status,
        rent_month: payment.payment_month,
        rent_month_display: rentMonthDisplay,
        paid_at: payment.paid_at,
        utr: (() => { const utr = resolveUtr(payment); console.log(`[generate-receipt] payment=${payment.id} resolveUtr=${utr} gateway_payout_utr=${payment.gateway_payout_utr} landlord_payout_utr=${payment.landlord_payout_utr} status=${payment.landlord_payout_status}`); return utr; })(),
        timeliness: computeTimeliness(payment.paid_at, payment.due_date, tenancy?.rent_due_day, payment.payment_month),
      },

      tenant: {
        name: formatTenantName(tenancy?.users),
        phone: tenancy?.users?.phone ?? null,
        email: authUser?.user?.email ?? null,
        pan_masked: maskPan(tenancy?.users?.pan_number),
      },

      property: {
        address: tenancy?.property_address ?? "N/A",
        city: tenancy?.property_city ?? null,
        state: tenancy?.property_state ?? null,
        pincode: tenancy?.property_pincode ?? null,
      },

      landlord: {
        name: (tenancy?.landlord_name && tenancy.landlord_name !== "Landlord")
          ? tenancy.landlord_name
          : landlordBankHolderName ?? "N/A",
        bank_account_masked: landlordBankMasked,
        pan_masked: tenancy?.landlord_pan_masked ?? null,
      },

      agreement: {
        cert_id: tenancy?.agreement_cert_id ?? null,
      },

      tax: taxData,

      company: COMPANY_INFO,
    };

    return jsonResponse({
      success: true,
      data: receiptData,
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// TAX CALCULATION
// ==============================================

/**
 * Calculates GST tax breakdown on the service fee (PG fee).
 * The rent amount itself is not taxable - only the platform service fee.
 * GST is split equally into CGST and SGST (intra-state) or charged as IGST (inter-state).
 * For simplicity, we default to CGST+SGST (same-state).
 */
function calculateTax(pgFeePaise: number): ReceiptData["tax"] {
  if (pgFeePaise <= 0 || !PG_FEE_TAXABLE) {
    return {
      subtotal: 0,
      subtotal_paise: 0,
      gst_rate: GST_RATE,
      gst_amount: 0,
      gst_amount_paise: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      total_with_tax: 0,
      total_with_tax_paise: 0,
      hsn_sac_code: HSN_SAC_CODE,
      tax_note: "No taxable service fee on this transaction.",
    };
  }

  // PG fee is the taxable amount (service charge)
  const subtotalPaise = pgFeePaise;
  const gstAmountPaise = Math.round(subtotalPaise * GST_RATE);
  const cgstPaise = Math.round(gstAmountPaise / 2);
  const sgstPaise = gstAmountPaise - cgstPaise; // Avoid rounding errors
  const totalWithTaxPaise = subtotalPaise + gstAmountPaise;

  return {
    subtotal: subtotalPaise / 100,
    subtotal_paise: subtotalPaise,
    gst_rate: GST_RATE,
    gst_amount: gstAmountPaise / 100,
    gst_amount_paise: gstAmountPaise,
    cgst_amount: cgstPaise / 100,
    sgst_amount: sgstPaise / 100,
    total_with_tax: totalWithTaxPaise / 100,
    total_with_tax_paise: totalWithTaxPaise,
    hsn_sac_code: HSN_SAC_CODE,
    tax_note: `GST @${GST_RATE * 100}% applied on platform service fee (CGST ${GST_RATE * 50}% + SGST ${GST_RATE * 50}%).`,
  };
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Generates a unique receipt number.
 * Format: FS-YYYYMM-XXXXXXXX (FS = Flent Secured)
 */
function generateReceiptNumber(paymentId: string, paidAt: string): string {
  const date = new Date(paidAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const shortId = paymentId.replace(/-/g, "").slice(-8).toUpperCase();
  return `FS-${year}${month}-${shortId}`;
}

/**
 * Formats tenant name from user data.
 */
function formatTenantName(user: any): string {
  if (!user) return "N/A";
  const firstName = user.first_name ?? "";
  const lastName = user.last_name ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "N/A";
}

/**
 * Formats payment method for display.
 */
function formatPaymentMethod(method: string | null): string | null {
  if (!method) return null;
  const methodMap: Record<string, string> = {
    upi: "UPI",
    upi_intent: "UPI",
    upi_collect: "UPI Collect",
    card: "Credit/Debit Card",
    cc: "Credit Card",
    dc: "Debit Card",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    nb: "Net Banking",
    netbanking: "Net Banking",
    net_banking: "Net Banking",
    wallet: "Wallet",
  };
  return methodMap[method.toLowerCase()] ?? method;
}

/** Masks a PAN number for display, e.g. "ABCDE1234F" → "ABCDE****F" */
function maskPan(pan: string | null | undefined): string | null {
  if (!pan || pan.length < 5) return null;
  return pan.slice(0, 5) + '****' + pan.slice(-1);
}

/** Resolves UTR (Unique Transaction Reference) — real bank UTRs only.
 *  Internal IDs (cf_order_id, payu_mihpayid, gateway_payment_id) are NOT bank UTRs
 *  and must never be shown on external-facing receipts.
 *  PAYOUT- prefixed values are internal tracking refs from settle-to-landlord (legacy),
 *  not real bank UTRs — filter them out.
 *  Returns null if settlement hasn't completed yet → UI shows "Pending". */
function resolveUtr(payment: any): string | null {
  const isRealUtr = (v: unknown): v is string =>
    typeof v === 'string' && v.length > 0 && !v.startsWith('PAYOUT-');

  if (isRealUtr(payment.gateway_payout_utr)) return payment.gateway_payout_utr;
  if (isRealUtr(payment.landlord_payout_utr)) return payment.landlord_payout_utr;
  if (isRealUtr(payment.gateway_settlement_utr)) return payment.gateway_settlement_utr;
  if (isRealUtr(payment.settlement_utr)) return payment.settlement_utr;
  if (isRealUtr(payment.payu_bank_ref_num)) return payment.payu_bank_ref_num;
  return null;
}

/**
 * Computes whether the payment was on time or late relative to the due date.
 * Uses explicit due_date if available, otherwise derives from rent_due_day + rent_month.
 * Due cutoff is end of day IST (23:59:59.999 IST = 18:29:59.999 UTC).
 */
function computeTimeliness(
  paidAt: string | null,
  dueDate: string | null,
  rentDueDay: number | null,
  rentMonth: string | null
): 'on_time' | 'late' | null {
  if (!paidAt) return null;

  let dueDateObj: Date;
  if (dueDate) {
    dueDateObj = new Date(dueDate);
  } else if (rentDueDay && rentMonth) {
    const monthDate = new Date(rentMonth);
    dueDateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), rentDueDay);
  } else {
    return null;
  }

  // Set due cutoff to end of day IST (23:59:59 IST = 18:29:59 UTC)
  const dueCutoff = new Date(dueDateObj);
  dueCutoff.setUTCHours(18, 29, 59, 999); // 23:59:59.999 IST

  const paidDate = new Date(paidAt);
  return paidDate <= dueCutoff ? 'on_time' : 'late';
}
