/**
 * Flent Secured v2 - Generate PayU Hash Edge Function
 *
 * Secure hash generation endpoint. NEVER accepts raw hashStrings from the client.
 * All hashes are computed server-side from stored payment initiation params.
 *
 * Endpoint: POST /functions/v1/generate-payu-hash
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, createAuthenticatedClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AppError, ValidationError, handleError } from "../_shared/errors.ts";
import { sha512 } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;

const VALID_HASH_NAMES = [
  "payment",
  "vas_for_mobile_sdk",
  "payment_related_details_for_mobile_sdk",
  "verify_payment",
];

// Rate limit: max hash requests per payment
const MAX_HASHES_PER_PAYMENT = 20;
const hashCountMap = new Map<string, number>();

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabase = createServiceClient();

  try {
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const body = await req.json();
    const { payment_id, hash_name } = body;

    if (!payment_id || !hash_name) {
      throw new ValidationError("payment_id and hash_name are required");
    }

    // SECURITY: Reject any raw hashString from client
    if (body.hashString || body.hash_string) {
      throw new AppError(
        "Raw hashString not accepted. Use payment_id + hash_name.",
        "INVALID_REQUEST",
        400
      );
    }

    if (!VALID_HASH_NAMES.includes(hash_name)) {
      throw new ValidationError(
        `Invalid hash_name. Must be one of: ${VALID_HASH_NAMES.join(", ")}`
      );
    }

    // Rate limit per payment
    const count = hashCountMap.get(payment_id) ?? 0;
    if (count >= MAX_HASHES_PER_PAYMENT) {
      throw new AppError("Too many hash requests for this payment", "RATE_LIMITED", 429);
    }
    hashCountMap.set(payment_id, count + 1);

    // Fetch payment record (verify ownership)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(
        "id, user_id, payu_txn_id, total_amount_paise, payu_initiation_params, tenancy:tenancies(user_id)"
      )
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      throw new AppError("Payment not found", "NOT_FOUND", 404);
    }

    const tenancyUserId = (payment.tenancy as { user_id: string } | null)?.user_id;
    if (tenancyUserId !== userId && payment.user_id !== userId) {
      throw new AppError("Unauthorized", "FORBIDDEN", 403);
    }

    const initParams = payment.payu_initiation_params as Record<string, string>;
    if (!initParams) {
      throw new AppError("Payment initiation params not found", "INVALID_STATE", 400);
    }

    let hash: string;
    const key = PAYU_MERCHANT_KEY;
    const salt = PAYU_MERCHANT_SALT;

    switch (hash_name) {
      case "payment": {
        const hashString = `${key}|${initParams.txnid}|${initParams.amount}|${initParams.productinfo}|${initParams.firstname}|${initParams.email}|${initParams.udf1 ?? ""}|${initParams.udf2 ?? ""}|${initParams.udf3 ?? ""}|${initParams.udf4 ?? ""}|${initParams.udf5 ?? ""}||||||${salt}`;
        hash = await sha512(hashString);
        break;
      }
      case "vas_for_mobile_sdk": {
        hash = await sha512(`${key}|vas_for_mobile_sdk|default|${salt}`);
        break;
      }
      case "payment_related_details_for_mobile_sdk": {
        const userCredential = `${key}:${initParams.email}`;
        hash = await sha512(
          `${key}|payment_related_details_for_mobile_sdk|${userCredential}|${salt}`
        );
        break;
      }
      case "verify_payment": {
        hash = await sha512(`${key}|verify_payment|${initParams.txnid}|${salt}`);
        break;
      }
      default:
        throw new ValidationError("Unsupported hash_name");
    }

    return jsonResponse({ success: true, data: { hash_name, hash } });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
