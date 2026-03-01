/**
 * Flent Secured v2 - Get PayU Stored Cards Edge Function
 *
 * Fetches stored card tokens from PayU's get_user_cards API and joins with
 * our payment_methods table to return matched cards with saved_method_id.
 *
 * Card tokens from PayU are non-sensitive (like database IDs). They are used
 * by the client SDK to initiate payments without re-entering full card details.
 * CVV is collected in the client UI and goes directly to the SDK, never our server.
 *
 * PCI DSS scope: SAQ A-EP (tokens are non-sensitive vault references).
 *
 * Endpoint: GET /functions/v1/get-payu-stored-cards
 * Auth: Required (JWT)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  createServiceClient,
  createAuthenticatedClient,
} from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  AppError,
  handleError,
} from "../_shared/errors.ts";
import { generateSDKHash } from "../_shared/crypto.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY")!;
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT")!;
const PAYU_INFO_URL = Deno.env.get("PAYU_INFO_URL") ?? "https://info.payu.in/merchant/postservice.php";

// ==============================================
// TYPES
// ==============================================

interface PayUCard {
  card_token: string;
  card_no: string;        // masked e.g. "XXXXXXXXXXXX1234"
  card_brand: string;     // "VISA", "MASTERCARD", etc.
  card_type: string;      // "CC" or "DC"
  name_on_card: string;
  card_mode: string;
  // PayU may include additional fields
  [key: string]: unknown;
}

interface PayUGetUserCardsResponse {
  status: number;
  msg: string;
  user_cards?: PayUCard[];
}

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const { userId } = await createAuthenticatedClient(authHeader);

    const supabase = createServiceClient();

    // Build user_credential for PayU (same format as payment sessions)
    const email = `${userId}@flent.app`;
    const userCredential = `${PAYU_MERCHANT_KEY}:${email}`;

    // Generate hash for get_user_cards command
    const hash = await generateSDKHash({
      key: PAYU_MERCHANT_KEY,
      salt: PAYU_MERCHANT_SALT,
      command: "get_user_cards",
      var1: userCredential,
    });

    // Call PayU get_user_cards API
    const formData = new URLSearchParams();
    formData.set("command", "get_user_cards");
    formData.set("key", PAYU_MERCHANT_KEY);
    formData.set("var1", userCredential);
    formData.set("hash", hash);

    const payuResponse = await fetch(PAYU_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!payuResponse.ok) {
      console.error("[get-payu-stored-cards] PayU API error:", payuResponse.status);
      // Graceful degradation: return empty cards (client falls back to full card entry)
      return jsonResponse({ success: true, data: { cards: [] } });
    }

    const payuData = await payuResponse.json();

    // PayU returns status 0 for success.
    // IMPORTANT: user_cards is an OBJECT keyed by card_token, not an array.
    // Convert to array with Object.values().
    const userCardsRaw = payuData.user_cards;
    const userCardsArray: PayUCard[] = payuData.status === 0 && userCardsRaw
      ? (Array.isArray(userCardsRaw) ? userCardsRaw : Object.values(userCardsRaw))
      : [];

    if (userCardsArray.length === 0) {
      // No stored cards or API error — return empty (graceful degradation)
      return jsonResponse({ success: true, data: { cards: [] } });
    }

    // Fetch our saved card methods for this user
    const { data: savedMethods, error: dbError } = await supabase
      .from("payment_methods")
      .select("id, card_last4, card_type, card_network")
      .eq("user_id", userId)
      .eq("type", "card")
      .is("deleted_at", null);

    if (dbError) {
      console.error("[get-payu-stored-cards] DB error:", dbError);
      return jsonResponse({ success: true, data: { cards: [] } });
    }

    // Join PayU cards with our records on last4 + card_type
    const matchedCards = userCardsArray
      .map((payuCard) => {
        // Extract last 4 from masked number (e.g. "XXXXXXXXXXXX1234" → "1234")
        const last4 = payuCard.card_no.slice(-4);
        // Map PayU card_type to our DB format
        const dbCardType = payuCard.card_type === "CC" ? "credit" : "debit";

        // Find matching record in our DB
        const dbMatch = savedMethods?.find(
          (m) => m.card_last4 === last4 && m.card_type === dbCardType
        );

        if (!dbMatch) return null; // PayU card not in our DB — skip

        return {
          saved_method_id: dbMatch.id,
          card_token: payuCard.card_token,
          card_no: payuCard.card_no,
          card_brand: payuCard.card_brand,
          card_type: payuCard.card_type, // "CC" or "DC"
          name_on_card: payuCard.name_on_card,
          cvv_required: true, // Always require CVV for stored card payments
        };
      })
      .filter(Boolean);

    return jsonResponse({
      success: true,
      data: { cards: matchedCards },
    });
  } catch (error) {
    // For any unexpected error, return empty cards for graceful degradation
    if (error instanceof AppError) {
      return handleError(error, req.headers.get("x-request-id") ?? undefined);
    }
    console.error("[get-payu-stored-cards] Unexpected error:", error);
    return jsonResponse({ success: true, data: { cards: [] } });
  }
});
