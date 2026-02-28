/**
 * Flent Secured v2 - Sync Netbanking Banks Edge Function
 *
 * Admin-only function that fetches live bank availability from PayU's
 * getNetbankingStatus API and syncs to the netbanking_banks table.
 *
 * Run on a schedule or manually — not called by the app directly.
 *
 * Endpoint: POST /functions/v1/sync-netbanking-banks
 * Auth: Service role only
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
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
    // Require service role authentication
    const authHeader = req.headers.get("Authorization");
    verifyServiceRole(authHeader);

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      return errorResponse("PayU not configured", 503);
    }

    const supabase = createServiceClient();

    // Call PayU getNetbankingStatus API
    const command = "getNetbankingStatus";
    const var1 = "default";
    const hashString = `${PAYU_MERCHANT_KEY}|${command}|${var1}|${PAYU_MERCHANT_SALT}`;
    const hash = await sha512(hashString);

    const formData = new URLSearchParams();
    formData.set("key", PAYU_MERCHANT_KEY);
    formData.set("command", command);
    formData.set("var1", var1);
    formData.set("hash", hash);

    const response = await fetch(PAYU_INFO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error(`[sync-netbanking-banks] PayU API error: ${response.status}`);
      return errorResponse("PayU API unavailable", 502);
    }

    const data = await response.json();

    // PayU returns: { status: 1, msg: "...", result: { SBIB: "UP", HDFB: "DOWN", ... } }
    // or sometimes the bank statuses are at top level
    const bankStatuses: Record<string, string> = data.result ?? data;

    if (!bankStatuses || typeof bankStatuses !== "object") {
      console.error("[sync-netbanking-banks] Unexpected PayU response:", JSON.stringify(data).slice(0, 500));
      return errorResponse("Unexpected PayU response format", 502);
    }

    // Filter out non-bank-code keys
    const bankEntries = Object.entries(bankStatuses).filter(
      ([key]) => key !== "status" && key !== "msg" && key !== "result"
    );

    let added = 0;
    let updated = 0;
    let deactivated = 0;

    // Get existing banks from DB
    const { data: existingBanks } = await supabase
      .from("netbanking_banks")
      .select("bank_code, is_active");

    const existingMap = new Map(
      (existingBanks ?? []).map((b: { bank_code: string; is_active: boolean }) => [b.bank_code, b.is_active])
    );

    for (const [bankCode, status] of bankEntries) {
      const isUp = String(status).toUpperCase() === "UP";
      const exists = existingMap.has(bankCode);

      if (exists) {
        // Update is_active based on PayU status
        const wasActive = existingMap.get(bankCode);
        if (wasActive !== isUp) {
          await supabase
            .from("netbanking_banks")
            .update({ is_active: isUp })
            .eq("bank_code", bankCode);

          if (!isUp) deactivated++;
          else updated++;
        }
      } else {
        // New bank from PayU — insert with bank_code as name (admin can update later)
        const { error: insertError } = await supabase
          .from("netbanking_banks")
          .insert({
            bank_code: bankCode,
            bank_name: bankCode, // Placeholder — admin should update with proper name
            is_active: isUp,
          });

        if (!insertError) added++;
        else console.warn(`[sync-netbanking-banks] Failed to insert ${bankCode}:`, insertError.message);
      }
    }

    // Deactivate banks that exist in DB but not in PayU response
    const payuBankCodes = new Set(bankEntries.map(([code]) => code));
    for (const [dbCode, isActive] of existingMap) {
      if (isActive && !payuBankCodes.has(dbCode)) {
        await supabase
          .from("netbanking_banks")
          .update({ is_active: false })
          .eq("bank_code", dbCode);
        deactivated++;
      }
    }

    return jsonResponse({
      success: true,
      data: {
        total_from_payu: bankEntries.length,
        added,
        updated,
        deactivated,
        synced_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
