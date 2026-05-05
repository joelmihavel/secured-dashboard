/**
 * Admin Backfill Bank — server-side bank-account backfill for founder-vouched users.
 *
 * Use case: an admin wants to insert a verified landlord bank row + register
 * the Cashfree vendor without making the user re-run the in-app verify-bank
 * flow. The naïve "just INSERT into bank_accounts" path is broken because:
 *   1. account_number_encrypted / pan_number_encrypted are AES-256-GCM with
 *      ENCRYPTION_KEY (env var). A SQL insert with NULL there means
 *      settlement code can't decrypt to make Cashfree payouts.
 *   2. cf_beneficiary_id must be created via Cashfree's vendor API. Without
 *      it, settlement payouts get rejected.
 *
 * This function does both server-side, mirroring exactly what verify-bank
 * does on a real penny-drop SUCCESS path (minus the actual penny-drop call).
 *
 * Endpoint: POST /functions/v1/admin-backfill-bank
 * Auth: admin_key in body (matches ADMIN_API_KEY env var)
 * Bypasses: penny-drop, agreement-name-match check, PAN verification API.
 *           Caller is asserting all three are valid (founder vouching).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { encrypt } from "../_shared/crypto.ts";
import {
  createVendor,
  getVendor,
  CashfreeError,
} from "../_shared/cashfree-pg-vendors.ts";

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) return "XXXXXXXX";
  const last4 = accountNumber.slice(-4);
  return "X".repeat(Math.max(8, accountNumber.length - 4)) + last4;
}

function maskPan(pan: string): string {
  // Match existing app's mask format: first 2 + 6 X + last 2
  if (!pan || pan.length !== 10) return "XXXXXXXXXX";
  return pan.slice(0, 2) + "XXXXXX" + pan.slice(-2);
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const body = await req.json();

    // Admin auth — accept either admin_key (matches ADMIN_API_KEY env var,
    // same pattern as admin-fix-vendors) OR a service_role JWT in the
    // Authorization header (the Supabase platform verifies JWTs at the
    // gateway when verify_jwt=true, so by the time we're here a service_role
    // JWT means the caller has full admin access). Either is acceptable for
    // this admin-only function.
    const adminKey = Deno.env.get("ADMIN_API_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    let isServiceRole = false;
    try {
      // Decode JWT payload (no signature check — gateway already verified)
      const parts = bearerToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        isServiceRole = payload?.role === "service_role";
      }
    } catch {
      // ignore — not a valid JWT, fall through to admin_key check
    }
    const hasValidAdminKey =
      !!adminKey && typeof body.admin_key === "string" && body.admin_key === adminKey;
    if (!isServiceRole && !hasValidAdminKey) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    const {
      user_id,
      account_number,
      ifsc,
      account_holder_name,
      pan,
      pan_holder_name,
      reason,
    } = body as {
      user_id?: string;
      account_number?: string;
      ifsc?: string;
      account_holder_name?: string;
      pan?: string;
      pan_holder_name?: string;
      reason?: string;
    };

    // Required field check
    const missing: string[] = [];
    if (!user_id) missing.push("user_id");
    if (!account_number) missing.push("account_number");
    if (!ifsc) missing.push("ifsc");
    if (!account_holder_name) missing.push("account_holder_name");
    if (!pan) missing.push("pan");
    if (missing.length > 0) {
      return jsonResponse(
        { error: `Missing required fields: ${missing.join(", ")}` },
        400,
        headers
      );
    }

    const supabase = createServiceClient();

    // Verify the target user exists
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, phone, email, full_name, user_status")
      .eq("id", user_id!)
      .single();

    if (userErr || !user) {
      return jsonResponse(
        { error: `User not found: ${user_id}` },
        404,
        headers
      );
    }

    // Refuse if there's already a primary landlord bank row — caller should
    // resolve manually rather than blindly create a duplicate.
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id, verified, cf_beneficiary_id")
      .eq("user_id", user_id!)
      .eq("party_type", "landlord")
      .eq("is_primary", true)
      .maybeSingle();

    if (existing) {
      return jsonResponse(
        {
          error:
            "Primary landlord bank row already exists. Delete it manually first if you want to replace.",
          existing_bank_account_id: existing.id,
          existing_verified: existing.verified,
          existing_cf_beneficiary_id: existing.cf_beneficiary_id,
        },
        409,
        headers
      );
    }

    // Encrypt sensitive data using the production AES-256-GCM helper.
    const sanitizedAccount = (account_number ?? "").replace(/\s/g, "");
    const sanitizedIfsc = (ifsc ?? "").trim().toUpperCase();
    const sanitizedPan = (pan ?? "").trim().toUpperCase();
    const resolvedAccountHolderName = (account_holder_name ?? "").trim();
    const resolvedPanHolderName = (pan_holder_name ?? account_holder_name ?? "").trim();

    const encryptedAccount = await encrypt(sanitizedAccount);
    const encryptedPan = await encrypt(sanitizedPan);

    // INSERT the bank row with all gates green. Penny-drop / PAN-verify /
    // agreement-name-match are bypassed and noted in the match details.
    const matchDetails = {
      source: "admin_backfill",
      reason: reason ?? "founder-vouched manual entry",
      backfilled_at: new Date().toISOString(),
      bypassed: ["penny_drop", "pan_api", "agreement_name_match"],
    };

    const { data: bankAccount, error: insertError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id,
        party_type: "landlord",
        account_holder_name: resolvedAccountHolderName,
        account_number_encrypted: encryptedAccount,
        account_number_masked: maskAccountNumber(sanitizedAccount),
        ifsc_code: sanitizedIfsc,
        verified: true,
        verified_at: new Date().toISOString(),
        verified_account_holder_name: resolvedAccountHolderName,
        penny_drop_status: "ADMIN_BACKFILL",
        penny_drop_name_match_score: 100,
        agreement_name_matched: true,
        agreement_name_match_score: 100,
        agreement_name_match_details: matchDetails,
        pan_number_encrypted: encryptedPan,
        pan_number_masked: maskPan(sanitizedPan),
        pan_verified: true,
        pan_verified_at: new Date().toISOString(),
        pan_status: "VALID",
        pan_name_matched: true,
        pan_name_match_score: 100,
        pan_registered_name: resolvedPanHolderName,
        pan_type: "Individual",
        pan_verification_details: {
          source: "admin_backfill",
          backfilled_at: new Date().toISOString(),
        },
        is_primary: true,
        verification_method: "bank_penny_drop",
      })
      .select()
      .single();

    if (insertError || !bankAccount) {
      console.error("[admin-backfill-bank] Insert failed:", insertError);
      return jsonResponse(
        { error: `Insert failed: ${insertError?.message ?? "unknown"}` },
        500,
        headers
      );
    }

    // Create Cashfree vendor so settlement payouts can route to landlord.
    // schedule_option=9 → every 3h, 24*7 (matches admin-fix-vendors default).
    const vendorId = `VENDOR${bankAccount.id.replace(/-/g, "")}`;
    const userPhone = (user.phone ?? "").replace(/^\+91/, "");
    const email = user.email ?? `${bankAccount.id}@flent.app`;

    let vendor;
    let vendorError: string | null = null;
    try {
      vendor = await createVendor({
        vendor_id: vendorId,
        name: resolvedAccountHolderName,
        email,
        phone: userPhone,
        account_number: sanitizedAccount,
        account_holder: resolvedAccountHolderName,
        ifsc: sanitizedIfsc,
        pan: sanitizedPan,
        schedule_option: 9,
      });
    } catch (createErr) {
      if (
        createErr instanceof CashfreeError &&
        createErr.message.includes("vendor already exists")
      ) {
        try {
          vendor = await getVendor(vendorId);
        } catch (getErr) {
          vendorError = getErr instanceof Error ? getErr.message : String(getErr);
        }
      } else {
        vendorError = createErr instanceof Error ? createErr.message : String(createErr);
      }
    }

    if (vendor) {
      await supabase
        .from("bank_accounts")
        .update({
          cf_beneficiary_id: vendor.vendor_id ?? vendorId,
          cf_beneficiary_status: vendor.status ?? "IN_BENE_CREATION",
        })
        .eq("id", bankAccount.id);
    }

    // Sync the denormalised mirror on tenancy + advance user_status.
    await supabase
      .from("tenancies")
      .update({ bank_verified: true, updated_at: new Date().toISOString() })
      .eq("user_id", user_id!);

    // Approve admin queue + flip to approved (idempotent).
    await supabase
      .from("waitlist_entries")
      .update({ admin_review: "approved" })
      .eq("user_id", user_id!);

    await supabase
      .from("users")
      .update({
        user_status: "approved",
        status_updated_at: new Date().toISOString(),
        legacy_post_waitlist_bank_required: false,
      })
      .eq("id", user_id!)
      .not("user_status", "in", '("approved","active","not_eligible")');

    // Auto-advance to active if eligible.
    const { error: advanceErr } = await supabase.rpc(
      "check_and_advance_to_active",
      { p_user_id: user_id }
    );
    if (advanceErr) {
      console.warn(
        "[admin-backfill-bank] check_and_advance_to_active failed:",
        advanceErr
      );
    }

    // Final state read-back.
    const { data: finalUser } = await supabase
      .from("users")
      .select("user_status")
      .eq("id", user_id!)
      .single();

    return jsonResponse(
      {
        success: true,
        user_id,
        bank_account_id: bankAccount.id,
        cf_beneficiary_id: vendor?.vendor_id ?? null,
        cf_beneficiary_status: vendor?.status ?? null,
        vendor_error: vendorError,
        final_user_status: (finalUser as { user_status?: string } | null)?.user_status ?? null,
      },
      200,
      headers
    );
  } catch (error) {
    console.error("[admin-backfill-bank] Unexpected error:", error);
    return handleError(error, headers);
  }
});
