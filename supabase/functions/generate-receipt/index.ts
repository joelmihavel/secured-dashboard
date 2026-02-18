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
import { isTestMode, mockData } from "../_shared/test-mode.ts";

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
    net_amount_paid: number;
    net_amount_paid_paise: number;
    payment_method: string | null;
    status: string;
    rent_month: string;
    rent_month_display: string;
    paid_at: string;
  };

  tenant: {
    name: string;
    phone: string | null;
    email: string | null;
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
    address: string;
    gstin: string;
    support_email: string;
    support_phone: string;
  };
}

// ==============================================
// CONFIGURATION
// ==============================================

const COMPANY_INFO = {
  name: Deno.env.get("COMPANY_NAME") || "Flent Technologies Private Limited",
  address: Deno.env.get("COMPANY_ADDRESS") || "Bangalore, Karnataka, India",
  gstin: Deno.env.get("COMPANY_GSTIN") || "",
  support_email: Deno.env.get("SUPPORT_EMAIL") || "support@flentsecured.com",
  support_phone: Deno.env.get("SUPPORT_PHONE") || "",
};

// GST configuration
const GST_RATE = 0.18; // 18% GST
const HSN_SAC_CODE = "997212"; // SAC code for rental payment facilitation services
const PG_FEE_TAXABLE = true; // PG fee is the taxable service amount

if (!COMPANY_INFO.gstin || !COMPANY_INFO.support_phone) {
  console.warn(
    "WARNING: COMPANY_GSTIN and SUPPORT_PHONE not configured. Receipts will be incomplete."
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

  // MD-131: Test mode support
  if (isTestMode(req)) {
    return jsonResponse({ success: true, data: mockData.receipt });
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

    // Fetch payment with related data
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        id, payu_txn_id, payu_mihpayid,
        amount_paise, pg_fee_paise, cashback_applied_paise, cashback_earned_paise,
        payment_method, status, rent_month, paid_at, created_at,
        tenancies (
          id, property_address, property_city, property_state, property_pincode,
          landlord_name,
          users!tenancies_user_id_fkey (
            first_name, last_name, phone
          ),
          bank_accounts (
            account_number_masked, party_type
          )
        )
      `)
      .eq("id", paymentId)
      .eq("user_id", userId)
      .single();

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

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    // Format rent month for display
    const rentMonthDate = new Date(payment.rent_month);
    const rentMonthDisplay = rentMonthDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    // Generate receipt number
    const receiptNumber = generateReceiptNumber(payment.id, payment.paid_at);

    // Get landlord bank account (masked)
    const tenancy = payment.tenancies as any;
    const landlordBankAccounts = (tenancy?.bank_accounts ?? []).filter(
      (ba: any) => ba.party_type === "landlord"
    );
    const landlordBankMasked = landlordBankAccounts.length > 0
      ? landlordBankAccounts[0].account_number_masked
      : null;

    // Calculate tax breakdown
    const pgFeePaise = payment.pg_fee_paise ?? 0;
    const taxData = includeTax ? calculateTax(pgFeePaise) : null;

    // Build receipt data
    const amountPaise = payment.amount_paise ?? 0;
    const cashbackAppliedPaise = payment.cashback_applied_paise ?? 0;
    const cashbackEarnedPaise = payment.cashback_earned_paise ?? 0;
    const netAmountPaise = amountPaise - cashbackAppliedPaise;

    const receiptData: ReceiptData = {
      receipt_number: receiptNumber,
      generated_at: new Date().toISOString(),

      payment: {
        id: payment.id,
        transaction_id: payment.payu_txn_id,
        payment_gateway_id: payment.payu_mihpayid,
        amount: amountPaise / 100,
        amount_paise: amountPaise,
        pg_fee: pgFeePaise / 100,
        pg_fee_paise: pgFeePaise,
        cashback_applied: cashbackAppliedPaise / 100,
        cashback_applied_paise: cashbackAppliedPaise,
        cashback_earned: cashbackEarnedPaise / 100,
        cashback_earned_paise: cashbackEarnedPaise,
        net_amount_paid: netAmountPaise / 100,
        net_amount_paid_paise: netAmountPaise,
        payment_method: formatPaymentMethod(payment.payment_method),
        status: payment.status,
        rent_month: payment.rent_month,
        rent_month_display: rentMonthDisplay,
        paid_at: payment.paid_at,
      },

      tenant: {
        name: formatTenantName(tenancy?.users),
        phone: tenancy?.users?.phone ?? null,
        email: authUser?.user?.email ?? null,
      },

      property: {
        address: tenancy?.property_address ?? "N/A",
        city: tenancy?.property_city ?? null,
        state: tenancy?.property_state ?? null,
        pincode: tenancy?.property_pincode ?? null,
      },

      landlord: {
        name: tenancy?.landlord_name ?? "N/A",
        bank_account_masked: landlordBankMasked,
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
