/**
 * Admin Fix Vendors — one-time + ongoing admin tool for vendor operations.
 *
 * Actions:
 *   - update_schedule: Batch-update all existing vendors to schedule_option 14 (15-min settlement)
 *   - create_missing: Create vendors for verified bank accounts that don't have one yet
 *   - fix_user: For a specific user, create vendor + retry settlement for their failed payments
 *
 * Endpoint: POST /functions/v1/admin-fix-vendors
 * Auth: admin_key in body
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { decrypt } from "../_shared/crypto.ts";
import {
  createVendor,
  getVendor,
  updateVendor,
  CashfreeError,
} from "../_shared/cashfree-easysplit.ts";

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }

  try {
    const body = await req.json();

    const adminKey = Deno.env.get("ADMIN_API_KEY");
    if (!adminKey || body.admin_key !== adminKey) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    const supabase = createServiceClient();
    const action = body.action as string;

    // ── ACTION: update_schedule ──────────────────────────────────
    // Batch-update all existing vendors from T+2 to 15-min settlement
    if (action === "update_schedule") {
      const targetSchedule = body.schedule_option ?? 14;

      const { data: accounts, error } = await supabase
        .from("bank_accounts")
        .select("id, cf_beneficiary_id, cf_beneficiary_status")
        .eq("party_type", "landlord")
        .not("cf_beneficiary_id", "is", null)
        .limit(100);

      if (error) throw new Error(`Query failed: ${error.message}`);

      const results: Array<{ vendor_id: string; status: string; error?: string }> = [];

      for (const account of accounts ?? []) {
        try {
          const vendor = await updateVendor(account.cf_beneficiary_id, {
            schedule_option: targetSchedule,
          });
          results.push({ vendor_id: account.cf_beneficiary_id, status: vendor.status });
        } catch (err) {
          results.push({
            vendor_id: account.cf_beneficiary_id,
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return jsonResponse({
        success: true,
        action: "update_schedule",
        target_schedule: targetSchedule,
        total: results.length,
        updated: results.filter(r => !r.error).length,
        errors: results.filter(r => r.error).length,
        results,
      }, 200, headers);
    }

    // ── ACTION: fix_user ─────────────────────────────────────────
    // For a specific user phone: create vendor if missing + requeue failed payments
    if (action === "fix_user") {
      const phone = body.phone as string;
      if (!phone) {
        return jsonResponse({ error: "phone is required" }, 400, headers);
      }

      // Find user
      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("id, phone, email, full_name")
        .eq("phone", phone)
        .single();

      if (userErr || !user) {
        return jsonResponse({ error: `User not found for phone ${phone}` }, 404, headers);
      }

      // Find their primary landlord bank account
      const { data: bankAccount, error: baErr } = await supabase
        .from("bank_accounts")
        .select("id, account_holder_name, account_number_encrypted, ifsc_code, upi_vpa, verification_method, pan_number_encrypted, cf_beneficiary_id, cf_beneficiary_status, verified")
        .eq("user_id", user.id)
        .eq("party_type", "landlord")
        .eq("is_primary", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (baErr || !bankAccount) {
        return jsonResponse({ error: "No primary landlord bank account found" }, 404, headers);
      }

      const steps: string[] = [];

      // Step 1: Create vendor if missing
      if (!bankAccount.cf_beneficiary_id) {
        const isUpi = bankAccount.verification_method === "upi_penny_drop" || (!bankAccount.account_number_encrypted && bankAccount.upi_vpa);

        // Need PAN
        if (!bankAccount.pan_number_encrypted) {
          return jsonResponse({
            error: "Cannot create vendor — PAN not verified yet",
            bank_account_id: bankAccount.id,
          }, 400, headers);
        }

        const pan = (await decrypt(bankAccount.pan_number_encrypted)).trim().toUpperCase();
        let accountNumber: string | undefined;
        if (!isUpi && bankAccount.account_number_encrypted) {
          accountNumber = await decrypt(bankAccount.account_number_encrypted);
        }

        const vendorId = `VENDOR${bankAccount.id.replace(/-/g, "")}`;
        const userPhone = (user.phone ?? "").replace(/^\+91/, "");
        const email = user.email ?? `${bankAccount.id}@flent.app`;

        let vendor;
        try {
          vendor = await createVendor({
            vendor_id: vendorId,
            name: bankAccount.account_holder_name,
            email,
            phone: userPhone,
            ...(!isUpi && accountNumber ? {
              account_number: accountNumber,
              account_holder: bankAccount.account_holder_name,
              ifsc: bankAccount.ifsc_code,
            } : {}),
            ...(isUpi ? { upi_vpa: bankAccount.upi_vpa } : {}),
            pan,
            schedule_option: 14,
          });
        } catch (createErr) {
          if (createErr instanceof CashfreeError && createErr.message.includes("vendor already exists")) {
            vendor = await getVendor(vendorId);
          } else {
            throw createErr;
          }
        }

        await supabase.from("bank_accounts").update({
          cf_beneficiary_id: vendor.vendor_id ?? vendorId,
          cf_beneficiary_status: vendor.status ?? "IN_BENE_CREATION",
        }).eq("id", bankAccount.id);

        steps.push(`Vendor created: ${vendor.vendor_id}, status: ${vendor.status}`);
      } else {
        // Vendor exists — update schedule to 14
        try {
          const vendor = await updateVendor(bankAccount.cf_beneficiary_id, { schedule_option: 14 });
          steps.push(`Vendor ${bankAccount.cf_beneficiary_id} schedule updated to 14, status: ${vendor.status}`);
        } catch (err) {
          steps.push(`Vendor schedule update failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Step 2: Requeue any failed payments back to "ready"
      const { data: failedPayments, error: fpErr } = await supabase
        .from("payments")
        .select("id, landlord_payout_status, gateway_payout_status")
        .eq("user_id", user.id)
        .eq("status", "success")
        .eq("landlord_payout_status", "failed")
        .limit(20);

      if (!fpErr && failedPayments && failedPayments.length > 0) {
        const { error: updateErr } = await supabase
          .from("payments")
          .update({
            landlord_payout_status: "ready",
            gateway_payout_status: "Re-queued by admin-fix-vendors",
          })
          .eq("user_id", user.id)
          .eq("status", "success")
          .eq("landlord_payout_status", "failed");

        if (updateErr) {
          steps.push(`Failed to requeue payments: ${updateErr.message}`);
        } else {
          steps.push(`Requeued ${failedPayments.length} failed payment(s) back to "ready"`);
        }
      } else {
        steps.push("No failed payments to requeue");
      }

      return jsonResponse({
        success: true,
        action: "fix_user",
        user_id: user.id,
        phone,
        bank_account_id: bankAccount.id,
        steps,
      }, 200, headers);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400, headers);
  } catch (error) {
    return handleError(error, headers);
  }
});
