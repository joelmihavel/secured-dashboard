/**
 * Flent Secured v2 - Extraction Recovery
 *
 * Automated backup flow that catches users stuck in extraction/confirmation.
 * Finds users with completed extractions who haven't reached waitlist,
 * auto-creates tenancy + waitlist entry, and advances them.
 *
 * Runs on cron (every 30 min) or manually via POST.
 * Auth: service_role JWT only.
 *
 * Cases handled:
 *   1. Extraction completed, not confirmed -> auto-confirm + create tenancy + waitlist
 *   2. Extraction confirmed, no tenancy -> create tenancy + waitlist
 *   3. Tenancy exists, no waitlist entry -> create waitlist entry
 *   4. All above -> set user_status to 'waitlisted'
 *
 * Skip conditions:
 *   - contract_status in (manual_review, invalid_document, expired)
 *   - needs_manual_review=true (unless contract_status=confirmed)
 *   - is_city_supported=false
 *   - Missing critical fields (address, rent, tenant name, landlord name)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { computeRisk } from "../_shared/risk-utils.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// Minimum age before auto-recovery kicks in (avoid racing with normal flow)
const MIN_AGE_MINUTES = 30;

function hasMinimumFields(extraction: Row): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!extraction.property_address) missing.push("property_address");
  if (!extraction.monthly_rent_paise || extraction.monthly_rent_paise <= 0) missing.push("monthly_rent_paise");
  if (!extraction.security_deposit_paise && extraction.security_deposit_paise !== 0) missing.push("security_deposit_paise");
  const hasTenantName = extraction.tenant_name || (extraction.tenant_names?.length > 0 && extraction.tenant_names[0]);
  if (!hasTenantName) missing.push("tenant_name");
  const hasLandlordName = extraction.landlord_name || (extraction.landlord_names?.length > 0 && extraction.landlord_names[0]);
  if (!hasLandlordName) missing.push("landlord_name");
  return { valid: missing.length === 0, missing };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const withCors = (response: Response): Response => {
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  };

  // Auth: service_role only
  try {
    verifyServiceRole(req.headers.get("Authorization"));
  } catch {
    return withCors(errorResponse("Unauthorized", 401));
  }

  const supabase = createServiceClient();
  const audit = AuditLogger.fromRequest(supabase, req, "system", "extraction-recovery");

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "true";
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60 * 1000).toISOString();

  const results: {
    recovered: Array<{ user_id: string; phone: string; name: string | null; actions: string[] }>;
    skipped: Array<{ user_id: string; reason: string }>;
    errors: Array<{ user_id: string; error: string }>;
  } = { recovered: [], skipped: [], errors: [] };

  try {
    // ============================================================
    // STEP 1: Find users with completed extractions stuck at signed_up/agreement_confirmed
    // ============================================================

    const { data: stuckUsers, error: queryError } = await supabase
      .from("users")
      .select("id, phone, full_name, first_name, last_name, user_status")
      .in("user_status", ["signed_up", "agreement_confirmed", "waitlisted"])
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("[extraction-recovery] Failed to query users:", queryError);
      return withCors(errorResponse("Failed to query users: " + queryError.message, 500));
    }

    if (!stuckUsers || stuckUsers.length === 0) {
      return withCors(jsonResponse({
        message: "No users to process",
        dry_run: dryRun,
        results,
      }));
    }

    const userIds = stuckUsers.map((u: Row) => u.id);

    // Batch fetch extractions, tenancies, waitlist entries
    const [extractionsRes, tenanciesRes, waitlistRes] = await Promise.all([
      supabase
        .from("extracted_rental_info")
        .select("id, user_id, extraction_status, user_verified, needs_manual_review, contract_status, is_city_supported, tenant_name, tenant_names, landlord_name, landlord_names, property_address, property_city, property_state, property_pincode, monthly_rent_paise, maintenance_paise, lease_start_date, lease_end_date, rent_due_day, landlord_phone, landlord_email, tenancy_id, created_at")
        .in("user_id", userIds)
        .eq("extraction_status", "completed")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenancies")
        .select("id, user_id, extracted_rental_info_id")
        .in("user_id", userIds),
      supabase
        .from("waitlist_entries")
        .select("user_id, admin_review")
        .in("user_id", userIds),
    ]);

    // Index: latest extraction per user
    const extractionMap = new Map<string, Row>();
    for (const row of extractionsRes.data ?? []) {
      if (!extractionMap.has(row.user_id)) extractionMap.set(row.user_id, row);
    }

    const tenancyMap = new Map<string, Row>();
    for (const row of tenanciesRes.data ?? []) {
      tenancyMap.set(row.user_id, row);
    }

    const waitlistSet = new Set<string>();
    for (const row of waitlistRes.data ?? []) {
      waitlistSet.add(row.user_id);
    }

    // ============================================================
    // STEP 2: Process each user
    // ============================================================

    for (const user of stuckUsers) {
      const userId = user.id;
      const extraction = extractionMap.get(userId);
      const existingTenancy = tenancyMap.get(userId);
      const hasWaitlist = waitlistSet.has(userId);
      const actions: string[] = [];

      try {
        // Skip: no completed extraction
        if (!extraction) {
          results.skipped.push({ user_id: userId, reason: "No completed extraction" });
          continue;
        }

        // Skip: extraction too recent (let normal flow handle it)
        if (extraction.created_at > cutoff) {
          results.skipped.push({ user_id: userId, reason: `Extraction too recent (< ${MIN_AGE_MINUTES}min)` });
          continue;
        }

        // Skip: already fully set up (waitlisted + has tenancy + has waitlist entry)
        if (user.user_status === "waitlisted" && existingTenancy && hasWaitlist) {
          results.skipped.push({ user_id: userId, reason: "Already fully set up" });
          continue;
        }

        // Skip: contract flagged by process-document (needs admin intervention)
        if (["manual_review", "invalid_document", "expired"].includes(extraction.contract_status)) {
          results.skipped.push({ user_id: userId, reason: `contract_status: ${extraction.contract_status}` });
          continue;
        }

        // Skip: needs manual review (and not overridden to confirmed)
        if (extraction.needs_manual_review && extraction.contract_status !== "confirmed") {
          results.skipped.push({ user_id: userId, reason: "needs_manual_review=true" });
          continue;
        }

        // Skip: unsupported city
        if (extraction.is_city_supported === false) {
          results.skipped.push({ user_id: userId, reason: "Unsupported city" });
          continue;
        }

        if (dryRun) {
          const wouldDo: string[] = [];
          if (!extraction.user_verified) wouldDo.push("auto-confirm extraction");
          if (!existingTenancy) wouldDo.push("create tenancy");
          if (!hasWaitlist) wouldDo.push("create waitlist entry + compute risk");
          if (user.user_status === "signed_up" || user.user_status === "agreement_confirmed") wouldDo.push(`advance from ${user.user_status} to waitlisted`);
          results.recovered.push({
            user_id: userId,
            phone: user.phone,
            name: user.full_name ?? ([user.first_name, user.last_name].filter(Boolean).join(" ") || null),
            actions: wouldDo.map(a => "[DRY RUN] " + a),
          });
          continue;
        }

        // Validate minimum fields BEFORE auto-confirming extraction
        // (prevents confirming garbage data that can't become a tenancy)
        const fieldCheck = hasMinimumFields(extraction);
        if (!fieldCheck.valid && !existingTenancy && !extraction.tenancy_id) {
          results.skipped.push({ user_id: userId, reason: `Missing critical fields: ${fieldCheck.missing.join(", ")}` });
          continue;
        }

        // --- Action 1: Auto-confirm extraction if not verified ---
        if (!extraction.user_verified) {
          await supabase
            .from("extracted_rental_info")
            .update({
              user_verified: true,
              verified_at: new Date().toISOString(),
              needs_manual_review: false,
              contract_status: "confirmed",
            })
            .eq("id", extraction.id);
          actions.push("auto-confirmed extraction");
        }

        // --- Action 2: Create tenancy if missing ---
        let tenancyId = existingTenancy?.id ?? extraction.tenancy_id;

        if (!existingTenancy && !extraction.tenancy_id) {
          const landlordName = extraction.landlord_name
            ?? (extraction.landlord_names?.length ? extraction.landlord_names.join(" & ") : null);

          const { data: newTenancy, error: tenancyError } = await supabase
            .from("tenancies")
            .insert({
              user_id: userId,
              extracted_rental_info_id: extraction.id,
              status: "pending_verification",
              property_address: extraction.property_address,
              property_city: extraction.property_city,
              property_state: extraction.property_state,
              property_pincode: extraction.property_pincode,
              monthly_rent_paise: extraction.monthly_rent_paise,
              maintenance_paise: extraction.maintenance_paise ?? 0,
              rent_due_day: extraction.rent_due_day || 1,
              cashback_cutoff_day: extraction.rent_due_day || null,
              lease_start_date: extraction.lease_start_date,
              lease_end_date: extraction.lease_end_date,
              landlord_name: landlordName,
              landlord_names: extraction.landlord_names ?? (landlordName ? [landlordName] : null),
              landlord_phone: extraction.landlord_phone,
              landlord_email: extraction.landlord_email,
            })
            .select("id")
            .single();

          if (tenancyError?.code === "23505") {
            // Tenancy already exists (confirm-extraction beat us) — fetch existing
            const { data: existing } = await supabase
              .from("tenancies").select("id")
              .eq("user_id", userId).eq("extracted_rental_info_id", extraction.id).single();
            tenancyId = existing?.id;
            actions.push("tenancy already exists (race)");
          } else if (tenancyError) {
            results.errors.push({ user_id: userId, error: "Tenancy creation failed: " + tenancyError.message });
            continue;
          } else {
            tenancyId = newTenancy.id;

            // Link extraction to tenancy
            await supabase
              .from("extracted_rental_info")
              .update({ tenancy_id: tenancyId })
              .eq("id", extraction.id);

            actions.push("created tenancy " + tenancyId);
          }
        } else if (existingTenancy) {
          actions.push("tenancy already exists");
        }

        // --- Action 3: Create waitlist entry if missing ---
        if (!hasWaitlist) {
          const { error: waitlistError } = await supabase
            .from("waitlist_entries")
            .insert({
              user_id: userId,
              extraction_id: extraction.id,
              admin_review: "due",
              risk_level: "PENDING",
            });

          if (waitlistError) {
            // Unique constraint = already exists, not an error
            if (waitlistError.code === "23505") {
              actions.push("waitlist entry already exists (race)");
            } else {
              results.errors.push({ user_id: userId, error: "Waitlist insert failed: " + waitlistError.message });
              continue;
            }
          } else {
            actions.push("created waitlist entry (admin_review: due)");
            // Compute risk for the new waitlist entry
            try {
              const risk = await computeRisk(userId, supabase);
              await supabase.from("waitlist_entries")
                .update({ risk_level: risk.risk_level, risk_factors: risk.risk_factors })
                .eq("user_id", userId);
              actions.push(`risk: ${risk.risk_level}`);
            } catch {
              actions.push("risk computation failed (stays PENDING)");
            }
          }
        } else {
          actions.push("waitlist entry already exists");
        }

        // --- Action 4: Advance user_status to waitlisted ---
        if (user.user_status === "signed_up" || user.user_status === "agreement_confirmed") {
          // Set name from extraction if user has no name
          const updatePayload: Row = {
            user_status: "waitlisted",
            status_updated_at: new Date().toISOString(),
          };

          if (!user.full_name && extraction.tenant_name) {
            updatePayload.full_name = extraction.tenant_name;
            const parts = extraction.tenant_name.split(" ");
            updatePayload.first_name = parts[0] || null;
            updatePayload.last_name = parts.slice(1).join(" ") || null;
          }

          // Optimistic lock: only advance signed_up or agreement_confirmed
          const { data: updatedRows } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", userId)
            .in("user_status", ["signed_up", "agreement_confirmed"])
            .select("id");

          if (!updatedRows?.length) {
            actions.push("user_status already advanced (skipped)");
          } else {
            actions.push(`advanced from ${user.user_status} to waitlisted`);
          }
        }

        results.recovered.push({
          user_id: userId,
          phone: user.phone,
          name: user.full_name ?? extraction.tenant_name ?? null,
          actions,
        });
      } catch (err) {
        results.errors.push({
          user_id: userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Log summary
    await audit.logSuccess("EXTRACTION_RECOVERY_RUN", "system", "users", undefined, {
      dry_run: dryRun,
      recovered: results.recovered.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    });

    return withCors(jsonResponse({
      message: `Recovery complete${dryRun ? " (dry run)" : ""}`,
      dry_run: dryRun,
      summary: {
        recovered: results.recovered.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      results,
    }));
  } catch (error) {
    console.error("[extraction-recovery] Fatal error:", error);
    return withCors(errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    ));
  }
});
