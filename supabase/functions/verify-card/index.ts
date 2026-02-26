/**
 * Flent Secured v2 - Verify Card Edge Function
 *
 * Creates a Rs.1 PayU session for card tokenization/verification.
 * The webhook handles token saving; this function only initiates.
 * After successful verification, the webhook auto-refunds the Rs.1.
 *
 * Endpoint: POST /functions/v1/verify-card
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  AppError,
  RateLimitError,
  PaymentError,
  handleError,
} from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { generatePayUHash, generateTransactionId, sha512 } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  let audit: AuditLogger | null = null;
  let userId: string | null = null;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId: uid } = await createAuthenticatedClient(authHeader);
    userId = uid;

    // Initialize audit logger
    audit = AuditLogger.fromRequest(supabase, req, userId, "verify-card");

    // Rate limit: max 3 card verifications per user per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentVerifications } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("payment_method", "card")
      .gte("created_at", oneDayAgo)
      .contains("metadata", { purpose: "card_verification" });

    if ((recentVerifications ?? 0) >= 3) {
      throw new RateLimitError(86400); // 24 hours
    }

    // Get user details for PayU order creation
    const { data: userProfile } = await supabase
      .from("users")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .single();

    const firstname = userProfile?.first_name ?? "User";
    const email = `${userId}@flent.app`;
    const phone = userProfile?.phone ?? "";

    // Generate transaction ID
    const txnId = generateTransactionId("CVFY");

    // PayU params for Rs.1 verification charge
    const amount = "1.00";
    const productinfo = "card_verification";

    const payuHash = await generatePayUHash({
      key: PAYU_MERCHANT_KEY,
      txnid: txnId,
      amount,
      productinfo,
      firstname,
      email,
      salt: PAYU_MERCHANT_SALT,
      udf1: "",
      udf2: "",
      udf3: userId,
    });

    // SDK hashes
    const userCredential = `${PAYU_MERCHANT_KEY}:${email}`;
    const vasHash = await sha512(
      `${PAYU_MERCHANT_KEY}|vas_for_mobile_sdk|default|${PAYU_MERCHANT_SALT}`
    );
    const paymentRelatedHash = await sha512(
      `${PAYU_MERCHANT_KEY}|payment_related_details_for_mobile_sdk|${userCredential}|${PAYU_MERCHANT_SALT}`
    );

    // Webhook URLs
    const surl = `${SUPABASE_URL}/functions/v1/payment-webhook`;
    const furl = `${SUPABASE_URL}/functions/v1/payment-webhook`;

    // Create a lightweight payment record for tracking
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        rent_amount_paise: 100, // Rs.1 = 100 paise
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        intended_cashback_paise: 0,
        total_amount_paise: 100,
        landlord_payout_paise: 0,
        net_rent_paise: 100,
        flent_subsidy_paise: 0,
        status: "initiated",
        payu_txn_id: txnId,
        payment_gateway: "payu",
        gateway_order_id: txnId,
        gateway_metadata: { key: PAYU_MERCHANT_KEY, txnid: txnId, amount },
        payment_method: "card",
        metadata: { purpose: "card_verification" },
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        user_agent: req.headers.get("user-agent"),
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("[verify-card] Failed to create payment record:", paymentError);
      throw new PaymentError("Failed to initiate card verification", "DB_ERROR");
    }

    // Log audit
    await audit.logSuccess("CARD_VERIFICATION_INITIATED", "payment", "payment", payment.id, {
      txn_id: txnId,
      amount,
    });

    return jsonResponse({
      success: true,
      data: {
        payment_id: payment.id,
        txn_id: txnId,
        payu: {
          key: PAYU_MERCHANT_KEY,
          txnid: txnId,
          amount,
          productinfo,
          firstname,
          email,
          phone,
          hash: payuHash,
          surl,
          furl,
          curl: furl,
          udf1: "",
          udf2: "",
          udf3: userId,
          user_credential: userCredential,
          vas_for_mobile_sdk_hash: vasHash,
          payment_related_details_for_mobile_sdk_hash: paymentRelatedHash,
          enforce_paymethod: "creditcard|debitcard",
        },
      },
    });
  } catch (error) {
    if (audit && userId) {
      await audit.logFailure(
        "CARD_VERIFICATION_FAILED",
        "payment",
        error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        error instanceof Error ? error.message : "Unknown error",
        "payment"
      );
    }
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
