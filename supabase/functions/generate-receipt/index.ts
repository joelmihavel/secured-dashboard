/**
 * Flent Secured v2 - Generate Receipt Edge Function
 *
 * Generates a rent payment receipt in JSON format.
 * Can be used by the mobile app to render the receipt or generate PDF.
 *
 * Endpoint: GET /functions/v1/generate-receipt?payment_id=xxx
 * Auth: Required (User JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, handleError } from "../_shared/errors.ts";

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
    pg_fee: number;
    cashback_applied: number;
    cashback_earned: number;
    net_amount_paid: number;
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
  };

  landlord: {
    name: string;
    bank_account_masked: string | null;
  };

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

// Validate required company info for receipts
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

  const supabase = createServiceClient();

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse query parameters
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");

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
          id, property_address, property_city, landlord_name,
          users!tenancies_user_id_fkey (
            first_name, last_name, phone
          ),
          bank_accounts (
            account_number_masked
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
    const landlordBankAccounts = tenancy?.bank_accounts ?? [];
    const landlordBankMasked = landlordBankAccounts.length > 0
      ? landlordBankAccounts[0].account_number_masked
      : null;

    // Build receipt data
    const receiptData: ReceiptData = {
      receipt_number: receiptNumber,
      generated_at: new Date().toISOString(),

      payment: {
        id: payment.id,
        transaction_id: payment.payu_txn_id,
        payment_gateway_id: payment.payu_mihpayid,
        amount: payment.amount_paise / 100,
        pg_fee: payment.pg_fee_paise / 100,
        cashback_applied: payment.cashback_applied_paise / 100,
        cashback_earned: (payment.cashback_earned_paise ?? 0) / 100,
        net_amount_paid: (payment.amount_paise - payment.cashback_applied_paise) / 100,
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
      },

      landlord: {
        name: tenancy?.landlord_name ?? "N/A",
        bank_account_masked: landlordBankMasked,
      },

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

  // Use last 8 characters of payment ID (UUID)
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
    card: "Credit/Debit Card",
    cc: "Credit Card",
    dc: "Debit Card",
    nb: "Net Banking",
    netbanking: "Net Banking",
    wallet: "Wallet",
  };

  return methodMap[method.toLowerCase()] ?? method;
}
