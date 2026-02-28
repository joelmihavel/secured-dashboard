/**
 * Flent Secured v2 - Get BIN Info Edge Function
 *
 * Looks up card BIN (first 6 digits) info via PayU's getBinInfo API.
 * Returns card type, issuing bank, and domesticity.
 *
 * Endpoint: POST /functions/v1/get-bin-info
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAuthenticatedClient, createServiceClient } from "../_shared/supabase.ts";
import { isTestUser } from "../_shared/demo-helpers.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { ValidationError, handleError } from "../_shared/errors.ts";
import { sha512 } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const PAYU_INFO_URL = Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice";

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

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    // Parse request
    const body = await req.json();
    const bin = String(body.bin ?? "").trim();

    // Validate BIN: must be exactly 6 digits
    if (!/^\d{6}$/.test(bin)) {
      throw new ValidationError("BIN must be exactly 6 digits", { bin: "Invalid format" });
    }

    // ── DEMO BYPASS ──────────────────────────────────────────────────
    const serviceClient = createServiceClient();
    if (await isTestUser(userId, serviceClient)) {
      const DEMO_BINS: Record<string, { is_domestic: boolean; issuing_bank: string; card_type: string; card_brand: string }> = {
        "512345": { is_domestic: true, issuing_bank: "HDFC Bank", card_type: "credit", card_brand: "mastercard" },
        "401200": { is_domestic: true, issuing_bank: "ICICI Bank", card_type: "credit", card_brand: "visa" },
        "411111": { is_domestic: true, issuing_bank: "SBI", card_type: "debit", card_brand: "visa" },
        "524000": { is_domestic: true, issuing_bank: "Axis Bank", card_type: "credit", card_brand: "mastercard" },
      };

      const demoData = DEMO_BINS[bin] ?? {
        is_domestic: true,
        issuing_bank: "Demo Bank",
        card_type: "credit",
        card_brand: bin.startsWith("4") ? "visa" : "mastercard",
      };

      return jsonResponse({ success: true, data: { bin, ...demoData } });
    }
    // ── END DEMO BYPASS ──────────────────────────────────────────────

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      return jsonResponse({
        success: false,
        error: "PayU not configured",
      }, 503);
    }

    // Call PayU getBinInfo API
    const command = "getBinInfo";
    const hashString = `${PAYU_MERCHANT_KEY}|${command}|${bin}|${PAYU_MERCHANT_SALT}`;
    const hash = await sha512(hashString);

    const formData = new URLSearchParams();
    formData.set("key", PAYU_MERCHANT_KEY);
    formData.set("command", command);
    formData.set("var1", bin);
    formData.set("hash", hash);

    const response = await fetch(PAYU_INFO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`[get-bin-info] PayU API error: ${response.status}`);
      return jsonResponse({
        success: false,
        error: "BIN lookup service unavailable",
      }, 502);
    }

    const data = await response.json();

    // PayU returns: { status: 1, result: { isDomestic, issuingBank, cardType, cardCategory } }
    if (data.status !== 1 || !data.result) {
      console.warn("[get-bin-info] PayU getBinInfo returned non-success:", data.msg ?? data);
      return jsonResponse({
        success: false,
        error: data.msg ?? "BIN not found",
      }, 404);
    }

    const result = data.result;

    return jsonResponse({
      success: true,
      data: {
        bin,
        is_domestic: result.isDomestic === "Y",
        issuing_bank: result.issuingBank ?? null,
        card_type: result.cardType ? String(result.cardType).toLowerCase() : null,
        card_brand: result.cardCategory ?? null,
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
