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
 *   - contract_status in (manual_review, invalid_document)
 *   - needs_manual_review=true (unless contract_status=confirmed)
 *   - is_city_supported=false
 *   - Missing critical fields (address, rent, tenant name, landlord name)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, getCorsHeaders, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { AuditLogger } from "../_shared/audit.ts";
import { recomputeAndStoreRisk } from "../_shared/risk-utils.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// Minimum age before auto-recovery kicks in (avoid racing with normal flow)
const MIN_AGE_MINUTES = 30;
// If an extraction has been in "processing" for longer than this, it's hung
const PROCESSING_TIMEOUT_MINUTES = 15;
// PostgREST .in() silently truncates/fails with large arrays; chunk to stay safe
const CHUNK_SIZE = 50;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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
    // Precompute cutoffs once (shared across all steps)
    const processingCutoffGlobal = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // ============================================================
    // STEP 0: Global stale-processing cleanup (all user_statuses)
    // Prevents "processing" extractions from lingering forever for
    // users who are not_eligible / approved / etc. (STEP 1.5 below
    // only runs against users in signed_up / waitlisted buckets, so
    // stale rows for rejected users never got cleaned up.)
    // This step ONLY marks status -> failed; it does NOT re-trigger
    // Cloud Run. Non-signed_up users shouldn't be re-extracted.
    // ============================================================
    {
      const { data: globalStale, error: globalStaleErr } = await supabase
        .from("extracted_rental_info")
        .select("id, user_id, updated_at, gemini_raw_response")
        .eq("extraction_status", "processing")
        .lt("updated_at", processingCutoffGlobal);

      if (!globalStaleErr && globalStale && globalStale.length > 0) {
        for (const row of globalStale) {
          const checkpoint = row.gemini_raw_response?.step ?? "unknown";
          await supabase
            .from("extracted_rental_info")
            .update({
              extraction_status: "failed",
              extraction_error: `Processing timed out — extraction hung at step: ${checkpoint}`,
            })
            .eq("id", row.id)
            .eq("extraction_status", "processing");
          console.warn(`[extraction-recovery][global] Marked extraction ${row.id} (user ${row.user_id}) failed — stuck at '${checkpoint}'`);
        }
      } else if (globalStaleErr) {
        console.error("[extraction-recovery][global] Failed to query global stale:", globalStaleErr.message);
      }
    }

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

    // ============================================================
    // Process users in chunks to avoid PostgREST .in() size limits
    // ============================================================
    const userChunks = chunkArray(stuckUsers, CHUNK_SIZE);
    console.log(`[extraction-recovery] Processing ${stuckUsers.length} users in ${userChunks.length} chunk(s) of up to ${CHUNK_SIZE}`);

    // Precompute cutoffs once (shared across all chunks)
    const processingCutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    const PENDING_TIMEOUT_MINUTES = 5;
    const pendingCutoff = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // Accumulate pending extractions to reprocess across all chunks
    const allPendingToReprocess: Array<{ id: string; user_id: string }> = [];

    for (let chunkIdx = 0; chunkIdx < userChunks.length; chunkIdx++) {
      const chunk = userChunks[chunkIdx];
      const chunkUserIds = chunk.map((u: Row) => u.id);
      console.log(`[extraction-recovery] Chunk ${chunkIdx + 1}/${userChunks.length}: ${chunkUserIds.length} users`);

      // Batch fetch extractions, tenancies, waitlist entries for this chunk
      const [extractionsRes, tenanciesRes, waitlistRes] = await Promise.all([
        supabase
          .from("extracted_rental_info")
          .select("id, user_id, extraction_status, user_verified, needs_manual_review, contract_status, is_city_supported, tenant_name, tenant_names, landlord_name, landlord_names, property_address, property_city, property_state, property_pincode, monthly_rent_paise, maintenance_paise, lease_start_date, lease_end_date, rent_due_day, rent_grace_period_days, landlord_phone, landlord_email, tenancy_id, created_at")
          .in("user_id", chunkUserIds)
          .eq("extraction_status", "completed")
          .order("created_at", { ascending: false }),
        supabase
          .from("tenancies")
          .select("id, user_id, extracted_rental_info_id")
          .in("user_id", chunkUserIds),
        supabase
          .from("waitlist_entries")
          .select("user_id, admin_review")
          .in("user_id", chunkUserIds),
      ]);

      // Index: latest extraction per user
      const extractionMap = new Map<string, Row>();
      for (const row of extractionsRes.data ?? []) {
        if (!extractionMap.has(row.user_id)) extractionMap.set(row.user_id, row);
      }

      const tenancyMap = new Map<string, Row>();
      // Key by "user_id:extracted_rental_info_id" for idempotent lookup per extraction
      const tenancyByExtractionMap = new Map<string, Row>();
      for (const row of tenanciesRes.data ?? []) {
        tenancyMap.set(row.user_id, row);
        if (row.extracted_rental_info_id) {
          tenancyByExtractionMap.set(`${row.user_id}:${row.extracted_rental_info_id}`, row);
        }
      }

      const waitlistSet = new Set<string>();
      for (const row of waitlistRes.data ?? []) {
        waitlistSet.add(row.user_id);
      }

      // ============================================================
      // STEP 1.5: Mark stale "processing" extractions as failed
      // ============================================================
      const { data: staleExtractions, error: staleError } = await supabase
        .from("extracted_rental_info")
        .select("id, user_id, created_at, updated_at, gemini_raw_response")
        .in("user_id", chunkUserIds)
        .eq("extraction_status", "processing")
        .lt("updated_at", processingCutoff);

      if (!staleError && staleExtractions && staleExtractions.length > 0) {
        for (const stale of staleExtractions) {
          // Include the last processing checkpoint (if any) in the error message
          const checkpoint = stale.gemini_raw_response?.step ?? "unknown";
          const { error: markError } = await supabase
            .from("extracted_rental_info")
            .update({
              extraction_status: "failed",
              extraction_error: `Processing timed out — extraction hung at step: ${checkpoint}`,
            })
            .eq("id", stale.id)
            .eq("extraction_status", "processing"); // optimistic lock: only update if still processing

          if (markError) {
            console.error(`[extraction-recovery] Failed to mark stale extraction ${stale.id} as failed:`, markError.message);
          } else {
            console.warn(`[extraction-recovery] Marked extraction ${stale.id} (user ${stale.user_id}) as failed — stuck at step '${checkpoint}' since ${stale.updated_at}`);
          }
        }
      } else if (staleError) {
        console.error("[extraction-recovery] Failed to query stale processing extractions:", staleError.message);
      }

      // ============================================================
      // STEP 1.6: Mark stale "pending" extractions as failed
      // Catches the case where upload-document succeeded (file in storage)
      // but process-document was never called (app backgrounded, auth died,
      // network dropped between upload and process trigger).
      // ============================================================
      const { data: stalePending, error: stalePendingError } = await supabase
        .from("extracted_rental_info")
        .select("id, user_id, document_storage_path")
        .in("user_id", chunkUserIds)
        .eq("extraction_status", "pending")
        .not("document_storage_path", "is", null) // file was uploaded
        .lt("updated_at", pendingCutoff);

      if (!stalePendingError && stalePending && stalePending.length > 0) {
        for (const stale of stalePending) {
          const { error: markError } = await supabase
            .from("extracted_rental_info")
            .update({
              extraction_status: "failed",
              extraction_error: "Processing never triggered — auto-recovery will reprocess",
            })
            .eq("id", stale.id)
            .eq("extraction_status", "pending"); // optimistic lock

          if (!markError) {
            allPendingToReprocess.push({ id: stale.id, user_id: stale.user_id });
            console.warn(`[extraction-recovery] Marked pending extraction ${stale.id} (user ${stale.user_id}) as failed — document uploaded but processing never started`);
          } else {
            console.error(`[extraction-recovery] Failed to mark pending extraction ${stale.id}:`, markError.message);
          }
        }
      } else if (stalePendingError) {
        console.error("[extraction-recovery] Failed to query stale pending extractions:", stalePendingError.message);
      }

      // ============================================================
      // STEP 2: Process each user in this chunk
      // ============================================================

      for (const user of chunk) {
        const userId = user.id;
        const extraction = extractionMap.get(userId);
        // Check for tenancy matching THIS extraction (idempotency), falling back to any user tenancy
        const existingTenancyForExtraction = extraction
          ? tenancyByExtractionMap.get(`${userId}:${extraction.id}`)
          : undefined;
        const existingTenancy = existingTenancyForExtraction ?? tenancyMap.get(userId);
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

          // Skip: extraction validation flagged the doc as needing human eyes for
          // missing non-critical fields (security_deposit, lease_start, etc).
          // invalid_document is intentionally NOT skipped: most invalid_document
          // cases are Gemini classifier false-negatives where DocAI extracted
          // complete fields. hasMinimumFields() below catches genuinely
          // unprocessable docs (missing rent/address/parties), and admin triage
          // gates the rest before they advance to KYC.
          if (extraction.contract_status === "manual_review") {
            results.skipped.push({ user_id: userId, reason: `contract_status: manual_review` });
            continue;
          }

          // Skip: needs manual review (and not overridden to confirmed).
          // invalid_document carries needs_manual_review=true by design — let it
          // through this gate so the admin queue can triage classifier-disagreement cases.
          if (extraction.needs_manual_review
              && extraction.contract_status !== "confirmed"
              && extraction.contract_status !== "invalid_document") {
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
            const reason = `Missing critical fields: ${fieldCheck.missing.join(", ")}`;
            console.warn(`[extraction-recovery] Skipping user ${userId} (phone: ${user.phone}): ${reason} [extraction_id=${extraction.id}]`);
            results.skipped.push({ user_id: userId, reason });
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

            // B7/C7: when extraction.rent_due_day is null/0, the `|| 1` fallback
            // below fabricates day-1 silently. Capture so we can leave a
            // breadcrumb in audit_logs after the tenancy is created.
            const rentDueDayInferred = !extraction.rent_due_day;

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
                cashback_cutoff_day: extraction.rent_due_day
                  ? Math.min(extraction.rent_due_day + (extraction.rent_grace_period_days ?? 0), 28)
                  : null,
                lease_start_date: extraction.lease_start_date,
                lease_end_date: extraction.lease_end_date,
                landlord_name: landlordName,
                landlord_names: extraction.landlord_names ?? (landlordName ? [landlordName] : null),
                // landlord_phone/email omitted — tenant provides via invite-landlord flow
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

              // B7/C7: breadcrumb when rent_due_day was fabricated by the
              // fallback. Only on the create-branch (race-branch's racing
              // writer owns its own breadcrumb). Direct insert (not the shared
              // audit logger) so we record the affected user's UUID — the
              // shared logger's context.userId is the literal "system" string
              // for this cron, which would violate audit_logs.user_id UUID FK.
              // Non-fatal: never block recovery on audit failure.
              if (rentDueDayInferred) {
                try {
                  await supabase.from("audit_logs").insert({
                    user_id: userId,
                    actor_type: "system",
                    action: "TENANCY_RENT_DUE_DAY_INFERRED",
                    action_category: "verification",
                    entity_type: "tenancy",
                    entity_id: tenancyId,
                    status: "success",
                    details: {
                      reason: "extraction.rent_due_day was null; inferred to 1 by fallback. Manual review recommended.",
                      extraction_id: extraction.id,
                      fabricated_value: 1,
                    },
                  });
                } catch (auditErr) {
                  console.error("[extraction-recovery] TENANCY_RENT_DUE_DAY_INFERRED audit log failed:", auditErr);
                }
              }
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
                await recomputeAndStoreRisk(userId, supabase);
                actions.push("risk: recomputed");
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
    } // end chunk loop

    // ============================================================
    // Auto-reprocess rescued pending extractions via Cloud Run
    // ============================================================
    // Cloud Run extraction-service has:
    // - 15-min timeout (vs edge function's 150s wall clock)
    // - Heartbeat mechanism so extractions don't falsely look stuck
    // - Fast path for already-completed extractions (finalization only)
    // - Independent network route (different from Supabase edge function pool)
    if (allPendingToReprocess.length > 0) {
      const cloudRunUrl = Deno.env.get("EXTRACTION_SERVICE_URL");
      const extractionSecret = Deno.env.get("EXTRACTION_SECRET");

      if (!cloudRunUrl || !extractionSecret) {
        console.error("[extraction-recovery] Cloud Run not configured — cannot reprocess", {
          hasUrl: !!cloudRunUrl,
          hasSecret: !!extractionSecret,
        });
      } else {
        console.log(`[extraction-recovery] Triggering Cloud Run for ${allPendingToReprocess.length} rescued pending extractions...`);
        for (const entry of allPendingToReprocess) {
          try {
            // Fire-and-forget; Cloud Run processes in background with heartbeat.
            // Short timeout here just ensures the POST lands; Cloud Run keeps
            // running even if this response times out.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10_000);
            try {
              await fetch(`${cloudRunUrl}/extract`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Extraction-Secret": extractionSecret,
                },
                body: JSON.stringify({ extraction_id: entry.id, user_id: entry.user_id }),
                signal: controller.signal,
              });
              console.log(`[extraction-recovery] Cloud Run triggered for ${entry.id}`);
            } finally {
              clearTimeout(timeoutId);
            }
          } catch (err) {
            // AbortError on the 10s guard is expected and fine — Cloud Run
            // keeps processing. Only log unexpected errors.
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("aborted")) {
              console.error(`[extraction-recovery] Cloud Run invocation failed for ${entry.id}:`, msg);
            }
          }
        }
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
