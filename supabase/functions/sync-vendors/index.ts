/**
 * Flent Secured v2 - Sync Vendors Edge Function
 *
 * Daily pre-flight check that ensures every verified landlord bank account
 * is registered as an ACTIVE Cashfree Easy Split vendor before payout day.
 *
 * Steps:
 *   1. Query bank_accounts where party_type=landlord, verified=true,
 *      and vendor is missing or not ACTIVE.
 *   2. For new accounts: call createVendor() and store vendor_id + status.
 *   3. For existing non-ACTIVE vendors: poll getVendor() to refresh status.
 *   4. Alert ops if any vendor is BLOCKED (payout will be blocked).
 *
 * Endpoint: POST /functions/v1/sync-vendors
 * Auth: Service role only (called by pg_cron at 10am IST daily)
 * Cron: '30 4 * * *'
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { decrypt } from "../_shared/crypto.ts";
import {
  createVendor,
  getVendor,
  CashfreeError,
} from "../_shared/cashfree-easysplit.ts";

const BATCH_SIZE = 50;

// Statuses that will never self-heal to ACTIVE without manual intervention
const STUCK_STATUSES = new Set([
  "BLOCKED",
  "DELETED",
  "BENE_CREATION_FAILED",
  "BANK_VALIDATION_FAILED",
  "ACTION_REQUIRED",
  "ON_HOLD",
]);

serve(async (req: Request) => {
  console.log("[sync-vendors] Request received:", req.method);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  console.log("[sync-vendors] Env check — APP_ID set:", !!Deno.env.get("CASHFREE_PG_APP_ID"), "SECRET set:", !!Deno.env.get("CASHFREE_PG_APP_SECRET"), "BASE_URL:", Deno.env.get("CASHFREE_PG_BASE_URL") ?? "(unset, defaulting to sandbox)");

  const supabase = createServiceClient();
  console.log("[sync-vendors] Supabase client created");

  try {
    verifyServiceRole(req.headers.get("Authorization"));
    console.log("[sync-vendors] Auth OK");

    const audit = new AuditLogger(supabase, {
      actorType: "service",
      functionName: "sync-vendors",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const results = {
      checked: 0,
      created: 0,
      refreshed: 0,
      blocked: 0,
      errors: 0,
    };

    console.log("[sync-vendors] Querying bank_accounts...");

    // Query all verified landlord bank accounts that need vendor creation or refresh
    const { data: accounts, error: queryError } = await supabase
      .from("bank_accounts")
      .select(`
        id,
        user_id,
        account_holder_name,
        account_number_encrypted,
        ifsc_code,
        cf_beneficiary_id,
        cf_beneficiary_status,
        pan_number_encrypted,
        pan_verified,
        users!inner(phone, email)
      `)
      .eq("party_type", "landlord")
      .eq("verified", true)
      .or("cf_beneficiary_id.is.null,cf_beneficiary_status.neq.ACTIVE")
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("[sync-vendors] DB query failed:", queryError);
      throw new Error(`Failed to query bank accounts: ${queryError.message}`);
    }

    console.log(`[sync-vendors] Query returned ${accounts?.length ?? 0} account(s)`);

    if (!accounts || accounts.length === 0) {
      return jsonResponse({ success: true, data: { message: "All vendors are up to date", ...results } });
    }

    results.checked = accounts.length;

    for (const account of accounts) {
      const user = account.users as { phone: string; email?: string } | null;
      console.log(`[sync-vendors] Processing bank_account ${account.id} — cf_beneficiary_id: ${account.cf_beneficiary_id ?? "null"}, phone set: ${!!user?.phone}, email set: ${!!user?.email}, pan_encrypted: ${!!account.pan_number_encrypted}, pan_verified: ${account.pan_verified}`);

      try {
        // ── NEW VENDOR: cf_beneficiary_id not yet set ─────────────────────
        if (!account.cf_beneficiary_id) {
          console.log(`[sync-vendors] Creating new vendor for bank_account ${account.id}`);

          // Decrypt account number — plaintext exists in memory only for this call
          let accountNumber: string;
          try {
            accountNumber = await decrypt(account.account_number_encrypted);
            console.log(`[sync-vendors] Decrypted account number for bank_account ${account.id}`);
          } catch (decryptErr) {
            const msg = (decryptErr as Error).message;
            console.error(`[sync-vendors] Failed to decrypt account for bank_account ${account.id}:`, msg);
            await audit.logFailure(
              "VENDOR_DECRYPT_ERROR",
              "system",
              "DECRYPT_FAILED",
              msg,
              "bank_account",
              account.id,
            );
            results.errors++;
            continue;
          }

          const vendorId = `VENDOR${account.id.replace(/-/g, "")}`;
          const phone = (user?.phone ?? "").replace(/^\+91/, "");
          const email = user?.email ?? `${account.id}@flent.app`;

          // PAN is mandatory for Individual account type in Cashfree Easy Split
          if (!account.pan_number_encrypted) {
            console.warn(`[sync-vendors] Skipping bank_account ${account.id} — PAN is required for vendor creation but not on record`);
            await audit.logFailure(
              "VENDOR_SKIP_NO_PAN",
              "system",
              "MISSING_PAN",
              "Cannot create Cashfree vendor: PAN number is required for KYC but not available on this landlord's bank account",
              "bank_account",
              account.id,
            );
            results.errors++;
            continue;
          }

          let pan: string;
          try {
            pan = (await decrypt(account.pan_number_encrypted)).trim().toUpperCase();
          } catch (panDecryptErr) {
            const msg = (panDecryptErr as Error).message;
            console.error(`[sync-vendors] Failed to decrypt PAN for bank_account ${account.id}:`, msg);
            await audit.logFailure("VENDOR_PAN_DECRYPT_ERROR", "system", "DECRYPT_FAILED", msg, "bank_account", account.id);
            results.errors++;
            continue;
          }

          const panValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
          console.log(`[sync-vendors] PAN format — length: ${pan.length}, valid_format: ${panValid}, masked: ${pan.slice(0, 5)}*****`);

          if (!panValid) {
            console.error(`[sync-vendors] Skipping bank_account ${account.id} — decrypted PAN has invalid format (length: ${pan.length})`);
            await audit.logFailure("VENDOR_SKIP_INVALID_PAN", "system", "INVALID_PAN_FORMAT", `Decrypted PAN does not match ^[A-Z]{5}[0-9]{4}[A-Z]{1}$ (length: ${pan.length})`, "bank_account", account.id);
            results.errors++;
            continue;
          }

          console.log(`[sync-vendors] Calling createVendor — vendor_id: ${vendorId}, name: ${account.account_holder_name}, phone: "${phone}", email: "${email}", ifsc: ${account.ifsc_code}, pan_verified: ${account.pan_verified}`);

          try {
            let vendor;
            try {
              vendor = await createVendor({
                vendor_id: vendorId,
                name: account.account_holder_name,
                email,
                phone,
                account_number: accountNumber,
                account_holder: account.account_holder_name,
                ifsc: account.ifsc_code,
                pan,
                schedule_option: 2, // T+2 (T+1 not enabled for this merchant)
              });
              console.log(`[sync-vendors] createVendor response — vendor_id: ${vendor.vendor_id}, status: ${vendor.status}`);
              results.created++;
            } catch (createErr) {
              // Vendor already exists in Cashfree (e.g. from a prior run that wrote to CF but not DB)
              const isAlreadyExists = createErr instanceof CashfreeError && createErr.message.includes("vendor already exists");
              if (!isAlreadyExists) throw createErr;
              console.warn(`[sync-vendors] Vendor ${vendorId} already exists in Cashfree — fetching current status`);
              vendor = await getVendor(vendorId);
              console.log(`[sync-vendors] getVendor (recovery) — status: ${vendor.status}`);
              results.refreshed++;
            }

            await supabase
              .from("bank_accounts")
              .update({
                cf_beneficiary_id: vendor.vendor_id ?? vendorId,
                cf_beneficiary_status: vendor.status ?? "IN_BENE_CREATION",
              })
              .eq("id", account.id);

            await audit.logSuccess(
              "VENDOR_CREATED",
              "landlord",
              "bank_account",
              account.id,
              { vendor_id: vendorId, status: vendor.status },
            );

            console.log(`[sync-vendors] Vendor ${vendorId} synced, status: ${vendor.status}`);
          } finally {
            // Clear sensitive values from memory
            accountNumber = "";
            pan = "";
          }

        // ── EXISTING VENDOR: refresh status ───────────────────────────────
        } else {
          console.log(`[sync-vendors] Refreshing existing vendor ${account.cf_beneficiary_id}`);
          const vendor = await getVendor(account.cf_beneficiary_id);
          console.log(`[sync-vendors] getVendor response — status: ${vendor.status}`);

          await supabase
            .from("bank_accounts")
            .update({ cf_beneficiary_status: vendor.status })
            .eq("id", account.id);

          results.refreshed++;

          if (STUCK_STATUSES.has(vendor.status)) {
            results.blocked++;
            console.error(`[sync-vendors] Stuck vendor for bank_account ${account.id}: ${vendor.status}`);
            await audit.logFailure(
              "VENDOR_STUCK",
              "landlord",
              vendor.status,
              `Cashfree vendor ${account.cf_beneficiary_id} is ${vendor.status} — payouts will be blocked, manual intervention required`,
              "bank_account",
              account.id,
              { vendor_id: account.cf_beneficiary_id, status: vendor.status },
            );
          } else {
            console.log(`[sync-vendors] Refreshed vendor ${account.cf_beneficiary_id}: ${vendor.status}`);
          }
        }
      } catch (err) {
        const isCfError = err instanceof CashfreeError;
        const errMsg = isCfError
          ? `HTTP ${(err as CashfreeError).statusCode} — ${err.message}`
          : (err as Error).message;
        console.error(`[sync-vendors] Error processing bank_account ${account.id}:`, errMsg, isCfError ? JSON.stringify((err as CashfreeError).raw) : (err as Error).stack);
        await audit.logFailure(
          "VENDOR_CREATE_ERROR",
          "system",
          isCfError ? `CF_${(err as CashfreeError).statusCode}` : "UNKNOWN",
          errMsg,
          "bank_account",
          account.id,
          { raw: isCfError ? (err as CashfreeError).raw : undefined },
        );
        results.errors++;
      }
    }

    await audit.logSuccess(
      "SYNC_VENDORS_COMPLETED",
      "system",
      undefined,
      undefined,
      results,
    );

    // Alert ops if any vendors are stuck/failed
    if (results.blocked > 0) {
      console.error(`[OPS_ALERT] ${results.blocked} landlord vendor(s) are stuck in Cashfree (BLOCKED/BENE_CREATION_FAILED/ACTION_REQUIRED/etc) — payouts will fail, manual intervention required`);
    }

    console.log("[sync-vendors] Completed:", JSON.stringify(results));
    return jsonResponse({ success: true, data: results });
  } catch (error) {
    console.error("[sync-vendors] Fatal error:", (error as Error).message, (error as Error).stack);
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
