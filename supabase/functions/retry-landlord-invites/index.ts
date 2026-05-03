/**
 * Flent Secured v2 — Retry Landlord Invites
 *
 * Cron-driven (every 15 min via pg_cron). Drains the
 * `landlord_invite_retry_queue` for rows whose `scheduled_for` has arrived
 * and re-attempts the WhatsApp send. Honours the wa_kill_switch flag and
 * 9pm-9am IST quiet hours.
 *
 * Pipeline:
 *   sync send (invite-landlord-whatsapp) → message_sid stored on tenancy
 *   reconcile-landlord-invite-deliveries (1m cron) → fetches Twilio status
 *     → on transient failure: queues a row HERE
 *     → on permanent failure: marks tenancy invited_undelivered
 *   retry-landlord-invites (THIS, 15m cron) → drains the queue
 *     → on success: optimistic 'invited' on tenancy; reconcile cron
 *       will re-classify the new send within ~1 minute
 *     → on sync 4xx failure: bumps queue row + tenancy status as needed
 *
 * Endpoint: POST /functions/v1/retry-landlord-invites
 * Auth: Service role only (cron-driven)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";
import { sendWhatsApp } from "../_shared/notifications.ts";
import { isWhatsAppSendEnabled } from "../_shared/feature-flags.ts";
import {
  reserveWhatsAppSlot,
  releaseWhatsAppSlot,
} from "../_shared/notification-policy.ts";

const MAX_PER_RUN = 50;
const SUBSEQUENT_RETRY_BACKOFF_HOURS = 24;
const JITTER_PCT = 0.15;
const QUIET_HOURS_START_IST = 21; // 9pm IST
const QUIET_HOURS_END_IST = 9; // 9am IST
const MAX_QUIET_HOURS_BUMPS = 5; // after 5 consecutive bumps, force the send
const IST_OFFSET_MINUTES = 330;

// Same classification as reconcile-landlord-invite-deliveries.
// Sync 4xx errors will rarely surface 63049 (that's an async failure), but
// 63015 / 63024 / 21211 etc. can come back synchronously if Twilio rejects
// the request before it reaches Meta.
const TRANSIENT_CODES = new Set<number>([63049, 63017, 30001, 30005]);
const PERMANENT_CODES = new Set<number>([
  63024, 63015, 21211, 21610, 63013, 63014, 63018,
]);

interface QueueRow {
  id: string;
  tenancy_id: string;
  to_phone: string;
  country_code: string;
  content_sid: string;
  retry_count: number;
  max_retries: number;
  quiet_hours_bumps: number;
}

interface TenancyRow {
  id: string;
  user_id: string;
  landlord_phone: string | null;
  country_code: string | null;
  landlord_status: string | null;
  landlord_invite_count: number | null;
}

function jitteredDelayMs(baseHours: number): number {
  const baseMs = baseHours * 60 * 60 * 1000;
  const jitter = (Math.random() * 2 - 1) * JITTER_PCT * baseMs;
  return Math.round(baseMs + jitter);
}

/** Returns true if the current wall-clock IST hour is inside the quiet window. */
function isInQuietHoursIST(): boolean {
  const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  const hour = ist.getUTCHours();
  if (QUIET_HOURS_START_IST <= QUIET_HOURS_END_IST) {
    return hour >= QUIET_HOURS_START_IST && hour < QUIET_HOURS_END_IST;
  }
  // Wraps midnight, e.g. 21..24 OR 0..9
  return hour >= QUIET_HOURS_START_IST || hour < QUIET_HOURS_END_IST;
}

/** Next 9am IST as ISO string. */
function nextQuietHoursEndIso(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  const hour = ist.getUTCHours();
  // If we're already past 9am IST today, next 9am is tomorrow IST.
  // 'past 9am IST today' means hour >= 9.
  const daysAhead = hour >= QUIET_HOURS_END_IST ? 1 : 0;
  const target = new Date(
    Date.UTC(
      ist.getUTCFullYear(),
      ist.getUTCMonth(),
      ist.getUTCDate() + daysAhead,
      QUIET_HOURS_END_IST,
      0,
      0,
    ) - IST_OFFSET_MINUTES * 60_000,
  );
  return target.toISOString();
}

function classifyError(errorMessage: string | undefined): {
  kind: "transient" | "permanent" | "unknown";
  code: number | null;
} {
  if (!errorMessage) return { kind: "unknown", code: null };
  // Twilio error messages typically look like "Failed to send message: ... (63049)"
  // or sometimes just numeric in our wrapper. Try to extract a number.
  const m = errorMessage.match(/\b(2[0-9]{4}|3[0-9]{4}|6[0-9]{4})\b/);
  const code = m ? Number(m[1]) : null;
  if (code != null) {
    if (TRANSIENT_CODES.has(code)) return { kind: "transient", code };
    if (PERMANENT_CODES.has(code)) return { kind: "permanent", code };
  }
  return { kind: "unknown", code };
}

// deno-lint-ignore no-explicit-any
async function processRow(supabase: any, audit: AuditLogger, row: QueueRow): Promise<string> {
  // 1. Re-fetch tenancy
  const { data: tenancy, error: tErr } = await supabase
    .from("tenancies")
    .select(
      "id, user_id, landlord_phone, country_code, landlord_status, landlord_invite_count",
    )
    .eq("id", row.tenancy_id)
    .single();
  if (tErr || !tenancy) {
    await markRow(supabase, row.id, {
      status: "superseded",
      last_error_message: "tenancy_not_found",
    });
    return "superseded:tenancy_missing";
  }
  const t = tenancy as TenancyRow;

  // 2. State drift checks
  if (
    !["invited", "invited_deferred"].includes(t.landlord_status ?? "")
  ) {
    await markRow(supabase, row.id, {
      status: "superseded",
      last_error_message: `state_advanced:${t.landlord_status}`,
    });
    return `superseded:state_${t.landlord_status}`;
  }

  const livePhone = t.landlord_phone?.replace(/\D/g, "") ?? "";
  const liveCountry = t.country_code ?? "+91";
  if (livePhone !== row.to_phone || liveCountry !== row.country_code) {
    await markRow(supabase, row.id, {
      status: "superseded",
      last_error_message: "phone_or_country_changed",
    });
    return "superseded:phone_changed";
  }

  // 3. Quiet hours (9pm-9am IST). Bump scheduled_for to next 9am IST and
  // increment quiet_hours_bumps. Capped at MAX_QUIET_HOURS_BUMPS to avoid
  // indefinite deferral if cap pressure persists.
  if (isInQuietHoursIST() && row.quiet_hours_bumps < MAX_QUIET_HOURS_BUMPS) {
    await markRow(supabase, row.id, {
      status: "pending",
      scheduled_for: nextQuietHoursEndIso(),
      quiet_hours_bumps: row.quiet_hours_bumps + 1,
    });
    return "quiet_hours_bumped";
  }

  // 4. Slot reservation if landlord is a Flent user. Mirror the sync path:
  // unregistered landlords skip reservation entirely; registered ones go
  // through the policy gate (per-day cap, lifetime cap, kill-switch).
  const e164 = `${liveCountry}${livePhone}`;
  const { data: landlordUser } = await supabase
    .from("users")
    .select("id")
    .eq("phone", e164)
    .maybeSingle();
  const landlordUserId = (landlordUser as { id?: string } | null)?.id ?? null;

  let slotId = "";
  if (landlordUserId) {
    const reservation = await reserveWhatsAppSlot(
      supabase,
      landlordUserId,
      "landlord_invite",
      { source: "retry-landlord-invites", tenancy_id: t.id, queue_row_id: row.id },
    );
    if (!reservation.allowed) {
      // Cap exhausted for this user — defer 24h and don't burn a retry.
      await markRow(supabase, row.id, {
        status: "pending",
        scheduled_for: new Date(Date.now() + jitteredDelayMs(24)).toISOString(),
        last_error_message: `slot_refused:${reservation.reason}`,
      });
      return `slot_refused:${reservation.reason}`;
    }
    slotId = reservation.slotId;
  }

  // 5. Re-fetch tenant name (in case user updated their profile in-between)
  const { data: tenantUser } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", t.user_id)
    .single();
  const tenantFullName = (tenantUser as { full_name?: string } | null)?.full_name ?? "Your tenant";

  // 6. Send via Twilio. sendWhatsApp internally checks the kill-switch.
  let result: { success: boolean; messageId?: string; error?: string } | null = null;
  let sendError: unknown = null;
  try {
    result = await sendWhatsApp({
      to: e164,
      template: row.content_sid,
      templateParams: [tenantFullName],
    });
  } catch (err) {
    sendError = err;
  } finally {
    if (slotId) {
      await releaseWhatsAppSlot(
        supabase,
        slotId,
        result?.success ? "sent" : "failed",
        result?.messageId,
        result?.success
          ? undefined
          : result?.error ??
            (sendError instanceof Error ? sendError.message : "send threw"),
      );
    }
  }

  if (result?.success && result.messageId) {
    // Optimistic: tenancy goes back to 'invited' with the new SID. The
    // reconcile cron will pick up the new SID within ~1 minute and either
    // confirm delivery (status_checked=true) or queue another retry if
    // 63049 fires again (capped at 3 total prior attempts; see reconcile).
    await markRow(supabase, row.id, {
      status: "sent",
      external_id: result.messageId,
      last_attempted_at: new Date().toISOString(),
    });
    await supabase
      .from("tenancies")
      .update({
        landlord_status: "invited",
        landlord_invite_sent_at: new Date().toISOString(),
        last_landlord_invite_message_sid: result.messageId,
        landlord_invite_status_checked: false,
        // Do NOT bump landlord_invite_count — that counter is for tenant-
        // initiated sends, not system retries.
      })
      .eq("id", t.id);

    await audit.logSuccess(
      AuditActions.LANDLORD_INVITE_RETRY_SENT,
      "landlord",
      "tenancy",
      t.id,
      {
        message_sid: result.messageId,
        queue_row_id: row.id,
        retry_count: row.retry_count,
      },
    );
    return "sent";
  }

  // Failure path: Twilio rejected synchronously OR threw.
  const errorMessage =
    result?.error ??
    (sendError instanceof Error ? sendError.message : sendError ? String(sendError) : "send_threw");
  const verdict = classifyError(errorMessage);
  const newRetryCount = row.retry_count + 1;
  const isMaxed = newRetryCount >= row.max_retries;
  const isPermanent = verdict.kind === "permanent" || verdict.kind === "unknown";

  if (isPermanent || isMaxed) {
    // Mark queue row terminal and surface to the tenant.
    await markRow(supabase, row.id, {
      status: "undelivered",
      retry_count: newRetryCount,
      last_attempted_at: new Date().toISOString(),
      last_error_code: verdict.code != null ? String(verdict.code) : null,
      last_error_message: errorMessage.slice(0, 500),
    });
    await supabase
      .from("tenancies")
      .update({ landlord_status: "invited_undelivered" })
      .eq("id", t.id);
    await audit.logFailure(
      AuditActions.LANDLORD_INVITE_UNDELIVERED,
      "landlord",
      verdict.code != null ? `twilio_${verdict.code}` : "send_failed",
      errorMessage,
      "tenancy",
      t.id,
      {
        queue_row_id: row.id,
        classification: isPermanent ? verdict.kind : "transient_max_retries",
        retry_count: newRetryCount,
      },
    );
    return isPermanent ? `permanent:${verdict.code ?? "unknown"}` : "max_retries";
  }

  // Transient and not yet maxed — bump scheduled_for and stay pending.
  const nextScheduledFor = new Date(
    Date.now() + jitteredDelayMs(SUBSEQUENT_RETRY_BACKOFF_HOURS),
  ).toISOString();
  await markRow(supabase, row.id, {
    status: "pending",
    retry_count: newRetryCount,
    scheduled_for: nextScheduledFor,
    last_attempted_at: new Date().toISOString(),
    last_error_code: verdict.code != null ? String(verdict.code) : null,
    last_error_message: errorMessage.slice(0, 500),
  });
  await audit.log({
    action: AuditActions.LANDLORD_INVITE_RETRY_DEFERRED,
    category: "landlord",
    entityType: "tenancy",
    entityId: t.id,
    details: {
      queue_row_id: row.id,
      retry_count: newRetryCount,
      twilio_error_code: verdict.code,
      next_attempt_at: nextScheduledFor,
    },
    status: "partial",
    errorCode: verdict.code != null ? `twilio_${verdict.code}` : "send_failed",
    errorMessage,
  });
  return `transient:${verdict.code ?? "unknown"}:requeued`;
}

// deno-lint-ignore no-explicit-any
async function markRow(
  supabase: any,
  rowId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("landlord_invite_retry_queue")
    .update(patch)
    .eq("id", rowId);
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    verifyServiceRole(req.headers.get("Authorization"));

    // Kill-switch: pause processing entirely. Rows stay 'pending' with their
    // existing scheduled_for and resume on the next tick after toggle.
    if (!(await isWhatsAppSendEnabled())) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "wa_kill_switch",
      });
    }

    const supabase = createServiceClient();
    const audit = new AuditLogger(supabase, {
      actorType: "system",
      functionName: "retry-landlord-invites",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    // Pick due rows. We can't use FOR UPDATE SKIP LOCKED through PostgREST,
    // so instead we use a two-step claim: select pending+due rows, then
    // atomically flip them to 'processing' filtering on status='pending'.
    // Concurrent runs (rare; cron is single-threaded) would race on the
    // UPDATE and only one would win per row.
    const { data: due, error: pickErr } = await supabase
      .from("landlord_invite_retry_queue")
      .select("id, tenancy_id, to_phone, country_code, content_sid, retry_count, max_retries, quiet_hours_bumps")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(MAX_PER_RUN);
    if (pickErr) {
      console.error("[retry] pickup failed:", pickErr);
      return errorResponse("Pickup failed", 500);
    }

    const rows = (due ?? []) as QueueRow[];
    const processedIds: string[] = [];
    const results: Record<string, number> = {};

    for (const row of rows) {
      // Atomic claim — if another worker grabbed it first, status will no
      // longer be 'pending' and the update will affect 0 rows.
      const { data: claimed, error: claimErr } = await supabase
        .from("landlord_invite_retry_queue")
        .update({
          status: "processing",
          last_attempted_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) {
        results["skipped:claim_lost"] = (results["skipped:claim_lost"] ?? 0) + 1;
        continue;
      }

      const outcome = await processRow(supabase, audit, row);
      results[outcome] = (results[outcome] ?? 0) + 1;
      processedIds.push(row.id);
    }

    return jsonResponse({
      success: true,
      data: { picked: rows.length, processed: processedIds.length, outcomes: results },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
