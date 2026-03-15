/**
 * Flent Secured v2 - Edge Function: pre-approval-audit
 *
 * Runs a comprehensive data-integrity audit on a batch of waitlisted users
 * BEFORE admin approval. Returns blockers (must fix) and warnings (review).
 *
 * Endpoint: POST /functions/v1/pre-approval-audit
 * Auth: body-based admin_key (same as admin-waitlist)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, getCorsHeaders } from "../_shared/cors.ts";
import { ValidationError, AuthError, handleError } from "../_shared/errors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { calculateNameMatchScore } from "../_shared/name-match-service.ts";

// ==============================================
// TYPES
// ==============================================

interface AuditRequest {
  admin_key: string;
  user_ids?: string[];
  user_id?: string;
  auto_fix?: boolean;
}

interface Finding {
  code: string;
  message: string;
}

interface UserAuditResult {
  user_id: string;
  phone: string | null;
  name: string | null;
  status: "READY" | "WARNING" | "BLOCKED";
  blockers: Finding[];
  warnings: Finding[];
  auto_fixes: Array<{ action: string; success: boolean; error?: string }>;
  data_snapshot: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// ==============================================
// MAIN HANDLER
// ==============================================

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);

  if (req.method !== "POST") {
    return jsonResponse({ error: true, message: "Method not allowed" }, 405, headers);
  }

  try {
    const body: AuditRequest = await req.json();

    // Auth: body-based admin_key OR service_role Bearer token (direct key comparison only)
    let isServiceRole = false;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      // Direct comparison only — no unsigned JWT fallback (prevents JWT forgery)
      const svcKey = (Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      if (svcKey && token === svcKey) {
        isServiceRole = true;
      }
    }

    if (!isServiceRole) {
      const expectedKey = Deno.env.get("ADMIN_API_KEY");
      if (!body.admin_key || !expectedKey || body.admin_key !== expectedKey) {
        throw new AuthError("Unauthorized - invalid admin key");
      }
    }

    // Normalize: support single user_id or array user_ids
    const userIds = body.user_ids ?? (body.user_id ? [body.user_id] : []);

    // Validate user_ids
    if (userIds.length === 0) {
      throw new ValidationError("user_ids must be a non-empty array of UUIDs");
    }
    if (userIds.length > 50) {
      throw new ValidationError("Cannot process more than 50 users at once");
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const uid of userIds) {
      if (!uuidRegex.test(uid)) {
        throw new ValidationError(`Invalid UUID: ${uid}`);
      }
    }

    const supabase = createServiceClient();
    const audit = AuditLogger.fromRequest(supabase, req, "admin", "pre-approval-audit");

    // ==============================================
    // 6 BATCH QUERIES IN PARALLEL
    // ==============================================

    const [
      usersResult,
      waitlistResult,
      extractionsResult,
      tenanciesResult,
      identityResult,
    ] = await Promise.all([
      // Q1: users
      supabase
        .from("users")
        .select("id, phone, first_name, last_name, full_name, user_status, role")
        .in("id", userIds),

      // Q2: waitlist_entries
      supabase
        .from("waitlist_entries")
        .select("user_id, admin_review, extraction_id, risk_level, risk_factors, rejection_reasons, created_at")
        .in("user_id", userIds),

      // Q3: extracted_rental_info (latest per user via order + distinct-like logic)
      supabase
        .from("extracted_rental_info")
        .select("id, user_id, extraction_status, user_verified, needs_manual_review, contract_status, tenant_name, tenant_names, landlord_name, landlord_names, monthly_rent_paise, maintenance_paise, lease_start_date, lease_end_date, rent_due_day, extraction_confidence, property_address, property_city, property_state, property_pincode, landlord_phone, landlord_email, tenancy_id")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),

      // Q4: tenancies (latest per user)
      supabase
        .from("tenancies")
        .select("id, user_id, extracted_rental_info_id, status, monthly_rent_paise, property_address, property_city, property_state, property_pincode, landlord_name, landlord_phone, rent_due_day, lease_start_date, lease_end_date, bank_verified, utility_verified, landlord_approved")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),

      // Q5: identity_verifications (latest per user)
      supabase
        .from("identity_verifications")
        .select("user_id, status")
        .in("user_id", userIds)
        .order("created_at", { ascending: false }),
    ]);

    // Index results into Maps (first row per user = latest due to order)
    const usersMap = new Map<string, Row>();
    for (const row of usersResult.data ?? []) {
      usersMap.set(row.id, row);
    }

    const waitlistMap = new Map<string, Row>();
    for (const row of waitlistResult.data ?? []) {
      if (!waitlistMap.has(row.user_id)) waitlistMap.set(row.user_id, row);
    }

    const extractionMap = new Map<string, Row>();
    for (const row of extractionsResult.data ?? []) {
      if (!extractionMap.has(row.user_id)) extractionMap.set(row.user_id, row);
    }

    const tenancyMap = new Map<string, Row>();
    for (const row of tenanciesResult.data ?? []) {
      if (!tenancyMap.has(row.user_id)) tenancyMap.set(row.user_id, row);
    }

    const identityMap = new Map<string, Row>();
    for (const row of identityResult.data ?? []) {
      if (!identityMap.has(row.user_id)) identityMap.set(row.user_id, row);
    }

    // Q6: Duplicate phone check — find input users whose phone is also on another approved/active account
    const dupPhoneSet = new Set<string>();
    const phonesToCheck = new Map<string, string>(); // phone → user_id
    for (const [uid, user] of usersMap) {
      if (user.phone) phonesToCheck.set(user.phone, uid);
    }
    if (phonesToCheck.size > 0) {
      const { data: dupRows } = await supabase
        .from("users")
        .select("id, phone")
        .in("phone", Array.from(phonesToCheck.keys()))
        .not("id", "in", `(${userIds.join(",")})`)
        .in("user_status", ["approved", "active"]);

      for (const row of dupRows ?? []) {
        const inputUserId = phonesToCheck.get(row.phone);
        if (inputUserId) dupPhoneSet.add(inputUserId);
      }
    }

    // ==============================================
    // EVALUATE EACH USER
    // ==============================================

    const auditResults: UserAuditResult[] = [];

    for (const userId of userIds) {
      const blockers: Finding[] = [];
      const warnings: Finding[] = [];

      const user = usersMap.get(userId);
      let waitlist = waitlistMap.get(userId);
      let extraction = extractionMap.get(userId);
      let tenancy = tenancyMap.get(userId);
      const identity = identityMap.get(userId);

      // --- AUTO-FIXES (run before evaluation) ---
      const autoFixes: Array<{ action: string; success: boolean; error?: string }> = [];

      if (body.auto_fix && user) {
        // Fix 1: Missing waitlist entry
        if (!waitlist) {
          try {
            const { data: wlResult } = await supabase.rpc("join_waitlist", { p_user_id: userId });
            autoFixes.push({ action: `created waitlist entry (position: ${wlResult?.entry_position ?? '?'})`, success: true });
            // Refresh waitlist data for this user
            const { data: refreshedWl } = await supabase.from("waitlist_entries").select("user_id, admin_review, extraction_id, risk_level, risk_factors, rejection_reasons, created_at").eq("user_id", userId).single();
            if (refreshedWl) waitlistMap.set(userId, refreshedWl);
          } catch (e) {
            autoFixes.push({ action: "create waitlist entry", success: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        // Fix 2: Advance user_status
        // Accept either user_verified (legacy) or extraction_status='completed' (new flow)
        const extractionReady = extraction?.user_verified || extraction?.extraction_status === "completed";
        if (extractionReady && waitlistMap.has(userId) &&
            (user.user_status === "signed_up" || user.user_status === "agreement_confirmed")) {
          try {
            const oldStatus = user.user_status;
            await supabase.from("users").update({ user_status: "waitlisted", status_updated_at: new Date().toISOString() }).eq("id", userId).in("user_status", ["signed_up", "agreement_confirmed"]);
            user.user_status = "waitlisted";
            autoFixes.push({ action: `advanced user_status from ${oldStatus} to waitlisted`, success: true });
          } catch (e) {
            autoFixes.push({ action: "advance user_status", success: false, error: e instanceof Error ? e.message : String(e) });
          }
        }

        // Fix 3: Missing tenancy (if extraction is completed or user_verified)
        if (extractionReady && !tenancy && !extraction.tenancy_id) {
          // Pre-validate required fields
          const missingFields: string[] = [];
          if (!extraction.property_address) missingFields.push("property_address");
          if (!extraction.monthly_rent_paise || extraction.monthly_rent_paise <= 0) missingFields.push("monthly_rent_paise");
          if (!extraction.lease_start_date) missingFields.push("lease_start_date");

          if (missingFields.length > 0) {
            autoFixes.push({ action: `skip tenancy creation: missing ${missingFields.join(", ")}`, success: false, error: "required fields missing" });
          } else {
            try {
              // Check for existing tenancy first (no unique constraint)
              const { data: existingTenancy } = await supabase.from("tenancies").select("id").eq("user_id", userId).eq("extracted_rental_info_id", extraction.id).maybeSingle();
              if (existingTenancy) {
                autoFixes.push({ action: `tenancy already exists: ${existingTenancy.id}`, success: true });
                tenancyMap.set(userId, existingTenancy);
              } else {
                const rentDueDay = Math.min(28, Math.max(1, extraction.rent_due_day || 1));
                const landlordName = extraction.landlord_name ?? (extraction.landlord_names?.length ? extraction.landlord_names.join(" & ") : null);
                const { data: newTenancy, error: tenancyError } = await supabase.from("tenancies").insert({
                  user_id: userId,
                  extracted_rental_info_id: extraction.id,
                  status: "pending_verification",
                  property_address: extraction.property_address,
                  property_city: extraction.property_city,
                  property_state: extraction.property_state,
                  property_pincode: extraction.property_pincode,
                  monthly_rent_paise: extraction.monthly_rent_paise,
                  maintenance_paise: extraction.maintenance_paise ?? 0,
                  rent_due_day: rentDueDay,
                  cashback_cutoff_day: rentDueDay,
                  lease_start_date: extraction.lease_start_date,
                  lease_end_date: extraction.lease_end_date,
                  landlord_name: landlordName,
                  landlord_names: extraction.landlord_names ?? (landlordName ? [landlordName] : null),
                  landlord_phone: extraction.landlord_phone,
                  landlord_email: extraction.landlord_email,
                }).select("id").single();

                if (tenancyError?.code === "23505") {
                  // Unique constraint — tenancy created by another path (race). Fetch existing.
                  const { data: raceExisting } = await supabase.from("tenancies").select("id")
                    .eq("user_id", userId).eq("extracted_rental_info_id", extraction.id).single();
                  if (raceExisting) tenancyMap.set(userId, raceExisting);
                  autoFixes.push({ action: `tenancy already exists (race): ${raceExisting?.id}`, success: true });
                } else if (tenancyError) {
                  autoFixes.push({ action: "create tenancy", success: false, error: tenancyError.message });
                } else {
                  // Link extraction to tenancy
                  await supabase.from("extracted_rental_info").update({ tenancy_id: newTenancy.id }).eq("id", extraction.id);
                  tenancyMap.set(userId, { ...newTenancy, user_id: userId, extracted_rental_info_id: extraction.id, status: "pending_verification", monthly_rent_paise: extraction.monthly_rent_paise, property_address: extraction.property_address, landlord_name: landlordName, rent_due_day: rentDueDay });
                  autoFixes.push({ action: `created tenancy ${newTenancy.id}`, success: true });
                }
              }
            } catch (e) {
              autoFixes.push({ action: "create tenancy", success: false, error: e instanceof Error ? e.message : String(e) });
            }
          }
        }

        // Fix 4: Missing tenancy fields backfill
        const currentTenancy = tenancyMap.get(userId);
        if (currentTenancy && extraction) {
          const backfillFields: string[] = [];
          const backfillData: Record<string, unknown> = {};
          if (!currentTenancy.property_city && extraction.property_city) { backfillData.property_city = extraction.property_city; backfillFields.push("property_city"); }
          if (!currentTenancy.property_state && extraction.property_state) { backfillData.property_state = extraction.property_state; backfillFields.push("property_state"); }
          if (!currentTenancy.property_pincode && extraction.property_pincode) { backfillData.property_pincode = extraction.property_pincode; backfillFields.push("property_pincode"); }
          if (!currentTenancy.landlord_name && (extraction.landlord_name || extraction.landlord_names?.length)) {
            backfillData.landlord_name = extraction.landlord_name ?? extraction.landlord_names.join(" & ");
            backfillFields.push("landlord_name");
          }
          if (!currentTenancy.landlord_phone && extraction.landlord_phone) { backfillData.landlord_phone = extraction.landlord_phone; backfillFields.push("landlord_phone"); }

          if (backfillFields.length > 0) {
            try {
              await supabase.from("tenancies").update(backfillData).eq("id", currentTenancy.id);
              Object.assign(currentTenancy, backfillData);
              autoFixes.push({ action: `backfilled tenancy fields: ${backfillFields.join(", ")}`, success: true });
            } catch (e) {
              autoFixes.push({ action: "backfill tenancy fields", success: false, error: e instanceof Error ? e.message : String(e) });
            }
          }
        }

        // Fix 5: Missing full_name
        if (!user.full_name && extraction?.tenant_name) {
          try {
            const parts = extraction.tenant_name.split(" ");
            await supabase.from("users").update({
              full_name: extraction.tenant_name,
              first_name: parts[0] || null,
              last_name: parts.slice(1).join(" ") || null,
            }).eq("id", userId);
            user.full_name = extraction.tenant_name;
            autoFixes.push({ action: `set full_name from extraction: ${extraction.tenant_name}`, success: true });
          } catch (e) {
            autoFixes.push({ action: "set full_name", success: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }

      // Re-read from maps after auto-fixes
      waitlist = waitlistMap.get(userId);
      extraction = extractionMap.get(userId);
      tenancy = tenancyMap.get(userId);

      // --- BLOCKERS ---

      // B01: User doesn't exist (short-circuits everything)
      if (!user) {
        blockers.push({ code: "B01", message: "User not found in users table" });
        auditResults.push({
          user_id: userId,
          phone: null,
          name: null,
          status: "BLOCKED",
          blockers,
          warnings,
          auto_fixes: autoFixes,
          data_snapshot: {},
        });
        continue;
      }

      // B02: User status mismatch
      if (user.user_status !== "waitlisted") {
        blockers.push({ code: "B02", message: `User status is '${user.user_status}', expected 'waitlisted'` });
      }

      // B03: No waitlist entry
      if (!waitlist) {
        blockers.push({ code: "B03", message: "No waitlist entry found" });
      }

      // B04: Already approved
      if (waitlist?.admin_review === "approved") {
        blockers.push({ code: "B04", message: "User already approved" });
      }

      // B05: No extraction or incomplete
      if (!extraction) {
        blockers.push({ code: "B05", message: "No rental info extraction found" });
      } else if (extraction.extraction_status !== "completed") {
        blockers.push({ code: "B05", message: `Extraction status is '${extraction.extraction_status}', expected 'completed'` });
      }

      // B06: Extraction not confirmed by user
      // In the new agreement upload flow, extraction_status='completed' is sufficient.
      // user_verified is only required in the legacy flow where users manually confirmed.
      if (extraction && extraction.extraction_status !== "completed" && extraction.user_verified !== true) {
        blockers.push({ code: "B06", message: "Extraction not completed or confirmed by user" });
      }

      // B07: No tenancy
      if (!tenancy) {
        blockers.push({ code: "B07", message: "No tenancy record found" });
      }

      // B08: Critical tenancy fields missing (rent checked separately in B09)
      if (tenancy) {
        const missing: string[] = [];
        if (!tenancy.property_address) missing.push("property_address");
        if (!tenancy.landlord_name) missing.push("landlord_name");
        if (!tenancy.rent_due_day && tenancy.rent_due_day !== 0) missing.push("rent_due_day");
        if (missing.length > 0) {
          blockers.push({ code: "B08", message: `Critical tenancy fields missing: ${missing.join(", ")}` });
        }
      }

      // B09: Zero rent
      if (tenancy && (!tenancy.monthly_rent_paise || tenancy.monthly_rent_paise === 0)) {
        blockers.push({ code: "B09", message: "Monthly rent is zero or missing" });
      }

      // B10: Duplicate phone
      if (dupPhoneSet.has(userId)) {
        blockers.push({ code: "B10", message: "Phone number is shared with another approved/active user" });
      }

      // --- WARNINGS (skip dependent ones if parent blocker fired) ---

      // Lease warnings (depend on tenancy existing)
      if (tenancy) {
        const now = new Date();

        // W01: Lease expired
        if (tenancy.lease_end_date) {
          const leaseEnd = new Date(tenancy.lease_end_date);
          if (leaseEnd < now) {
            warnings.push({ code: "W01", message: `Lease expired on ${tenancy.lease_end_date}` });
          }
          // W02: Lease expiring soon (within 60 days)
          else {
            const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
            if (leaseEnd.getTime() - now.getTime() < sixtyDaysMs) {
              warnings.push({ code: "W02", message: `Lease expires on ${tenancy.lease_end_date} (within 60 days)` });
            }
          }
        }

        // W09: No lease end date
        if (!tenancy.lease_end_date) {
          warnings.push({ code: "W09", message: "No lease end date set" });
        }

        // W07: Very high rent (>5L/month)
        if (tenancy.monthly_rent_paise > 5_000_000) {
          warnings.push({ code: "W07", message: `Very high rent: ${formatRupees(tenancy.monthly_rent_paise)}/month` });
        }

        // W08: Very low rent (<5K/month)
        if (tenancy.monthly_rent_paise > 0 && tenancy.monthly_rent_paise < 500_000) {
          warnings.push({ code: "W08", message: `Very low rent: ${formatRupees(tenancy.monthly_rent_paise)}/month` });
        }

        // W10: Rent due day edge case
        if (tenancy.rent_due_day > 25) {
          warnings.push({ code: "W10", message: `Rent due day is ${tenancy.rent_due_day} (>25th)` });
        }
      }

      // W03: Low extraction confidence (depends on extraction existing)
      if (extraction && typeof extraction.extraction_confidence === "number" && extraction.extraction_confidence < 0.7) {
        warnings.push({ code: "W03", message: `Low extraction confidence: ${(extraction.extraction_confidence * 100).toFixed(0)}%` });
      }

      // W04: No identity verification
      if (!identity || identity.status !== "SUCCESS") {
        warnings.push({ code: "W04", message: identity ? `Identity verification status: ${identity.status}` : "No identity verification record" });
      }

      // W05: High risk level (depends on waitlist existing)
      if (waitlist?.risk_level === "HIGH") {
        warnings.push({ code: "W05", message: "High risk level flagged" });
      }

      // W06: Tenant name mismatch — check ALL tenant_names[], not just the primary
      if (user.full_name && (extraction?.tenant_names?.length || extraction?.tenant_name)) {
        const candidates: string[] = extraction.tenant_names?.length
          ? extraction.tenant_names
          : [extraction.tenant_name];
        let bestScore = 0;
        let bestName = candidates[0];
        for (const candidate of candidates) {
          const score = calculateNameMatchScore(candidate, user.full_name);
          if (score > bestScore) {
            bestScore = score;
            bestName = candidate;
          }
        }
        if (bestScore < 0.7) {
          warnings.push({
            code: "W06",
            message: `Tenant name mismatch: best match '${bestName}' vs user '${user.full_name}' (score: ${(bestScore * 100).toFixed(0)}%) — checked ${candidates.length} name(s)`,
          });
        }
      }

      // W11: Stale application (>30 days)
      if (waitlist?.created_at) {
        const createdAt = new Date(waitlist.created_at);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - createdAt.getTime() > thirtyDaysMs) {
          const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
          warnings.push({ code: "W11", message: `Stale application: submitted ${daysAgo} days ago` });
        }
      }

      // W12: Previously rejected
      if (waitlist?.rejection_reasons && Array.isArray(waitlist.rejection_reasons) && waitlist.rejection_reasons.length > 0) {
        warnings.push({ code: "W12", message: `Previously rejected with ${waitlist.rejection_reasons.length} reason(s)` });
      }

      // W13: Extraction flagged for manual review
      if (extraction?.needs_manual_review) {
        warnings.push({ code: "W13", message: "Extraction flagged for manual review" });
      }

      // W14: Multiple completed extractions
      const allExtractions = (extractionsResult.data ?? []).filter((e: Row) => e.user_id === userId && e.extraction_status === "completed");
      if (allExtractions.length > 1) {
        warnings.push({ code: "W14", message: `User has ${allExtractions.length} completed extractions` });
      }

      // W15: Tenancy status not pending_verification or active
      const updatedTenancy = tenancyMap.get(userId);
      if (updatedTenancy && !["pending_verification", "active"].includes(updatedTenancy.status)) {
        warnings.push({ code: "W15", message: `Tenancy status: ${updatedTenancy.status}` });
      }

      // W16: Invalid lease dates
      if (updatedTenancy?.lease_end_date && updatedTenancy?.lease_start_date) {
        if (new Date(updatedTenancy.lease_end_date) < new Date(updatedTenancy.lease_start_date)) {
          warnings.push({ code: "W16", message: "Lease end date is before start date" });
        }
      }

      // W17: Null full_name after fixes
      if (user && !user.full_name) {
        warnings.push({ code: "W17", message: "User has no name" });
      }

      // --- DATA SNAPSHOT ---
      const dataSnapshot: Record<string, unknown> = {
        user_status: user.user_status ?? "N/A",
        admin_review: waitlist?.admin_review ?? "N/A",
        extraction_status: extraction?.extraction_status ?? "N/A",
        tenancy_status: tenancy?.status ?? "N/A",
        monthly_rent: tenancy?.monthly_rent_paise ? formatRupees(tenancy.monthly_rent_paise) : "N/A",
        lease_period: tenancy
          ? `${tenancy.lease_start_date ?? "?"} to ${tenancy.lease_end_date ?? "?"}`
          : "N/A",
        property_address: tenancy?.property_address ?? "N/A",
        risk_level: waitlist?.risk_level ?? "N/A",
        extraction_confidence: extraction?.extraction_confidence ?? "N/A",
      };

      // --- STATUS ---
      const status = blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "READY";

      auditResults.push({
        user_id: userId,
        phone: user.phone ?? null,
        name: user.full_name ?? ([user.first_name, user.last_name].filter(Boolean).join(" ") || null),
        status,
        blockers,
        warnings,
        auto_fixes: autoFixes,
        data_snapshot: dataSnapshot,
      });
    }

    // ==============================================
    // SUMMARY
    // ==============================================

    const summary = {
      ready: auditResults.filter((r) => r.status === "READY").length,
      warnings: auditResults.filter((r) => r.status === "WARNING").length,
      blocked: auditResults.filter((r) => r.status === "BLOCKED").length,
      fixed: auditResults.reduce((sum, r) => sum + r.auto_fixes.filter(f => f.success).length, 0),
    };

    // Log audit event
    await audit.logSuccess("PRE_APPROVAL_AUDIT_RUN", "system", "waitlist_entries", undefined, {
      total_users: userIds.length,
      auto_fix_enabled: !!body.auto_fix,
      summary,
    });

    return jsonResponse({
      audit_timestamp: new Date().toISOString(),
      total_users: userIds.length,
      auto_fix_enabled: !!body.auto_fix,
      summary,
      users: auditResults,
    }, 200, headers);
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});

// ==============================================
// HELPERS
// ==============================================

function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `\u20B9${rupees.toLocaleString("en-IN")}`;
}
