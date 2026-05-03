/**
 * Flent Secured v2 — Reconcile Landlord-Invite Deliveries
 *
 * Cron-driven (every 1 min via pg_cron). Polls Twilio for the terminal
 * delivery status of recent landlord-invite sends and transitions
 * tenancies to invited_deferred / invited_undelivered when the message
 * ultimately fails on Meta's side (e.g. error 63049 — marketing cap).
 *
 * Why not a webhook: Twilio status callbacks require signature verification
 * + a public endpoint, and silently dropped status events are hard to
 * detect. Polling is more reliable and idempotent — we re-query until we
 * get a terminal status or hit the 1h cutoff.
 *
 * Endpoint: POST /functions/v1/reconcile-landlord-invite-deliveries
 * Auth: Service role only (cron-driven)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createServiceClient, verifyServiceRole } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { handleError } from "../_shared/errors.ts";
import { AuditLogger, AuditActions } from "../_shared/audit.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_API_KEY_SID = Deno.env.get("TWILIO_API_KEY_SID");
const TWILIO_API_KEY_SECRET = Deno.env.get("TWILIO_API_KEY_SECRET");
const TWILIO_LANDLORD_INVITE_TEMPLATE_SID = Deno.env.get(
  "TWILIO_LANDLORD_INVITE_TEMPLATE_SID",
);

// Twilio error code classification.
// Source: https://www.twilio.com/docs/api/errors and observed behavior on
// the Flent Homes WABA. "Transient" = recipient-side fatigue or temporary
// channel issue that can roll off; queue a retry. "Permanent" = recipient
// is unreachable or the content is rejected; don't retry, surface to user.
const TRANSIENT_CODES = new Set<number>([
  63049, // Meta cross-business marketing cap (recipient-side, rolls off in 1-4 days)
  63017, // Channel could not find From address (often transient if WABA flapped)
  30001, // Queue overflow
  30005, // Unknown destination handset (could be temporary handset issue)
]);
const PERMANENT_CODES = new Set<number>([
  63024, // WhatsApp number is not registered
  63015, // Channel can not accept messages with this content (template content rejection)
  21211, // Invalid 'To' number
  21610, // Recipient unsubscribed
  63013, // Unknown channel
  63014, // Template SID mismatch / not approved on this WABA
  63018, // Outbound disabled for this number
]);

// Tenancies older than this are presumed delivered (or terminally lost) and
// marked checked to stop polling. Twilio messages typically settle within
// 30 seconds; 1 hour is generous.
const STALE_AFTER_MS = 60 * 60 * 1000;
// Don't poll until Twilio has had a chance to update the status. Twilio
// typically reports terminal status within 5-30s of the send.
const SETTLE_DELAY_MS = 30 * 1000;
// Conservative per-run cap so a backlog doesn't blow up the cron run time.
const MAX_PER_RUN = 50;

// Backoff schedule for the FIRST retry from a sync send. Subsequent retries
// (handled by retry-landlord-invites) use 24h.
const FIRST_RETRY_BACKOFF_HOURS = 8;
const JITTER_PCT = 0.15;

interface Tenancy {
  id: string;
  user_id: string;
  landlord_phone: string | null;
  country_code: string | null;
  last_landlord_invite_message_sid: string | null;
  landlord_invite_sent_at: string | null;
}

interface TwilioMessage {
  sid: string;
  status: string; // queued | sending | sent | delivered | undelivered | failed | read | receiving | accepted | scheduled | canceled
  error_code: number | null;
  error_message: string | null;
  date_sent: string | null;
  date_updated: string | null;
}

function jitteredDelayMs(baseHours: number): number {
  const baseMs = baseHours * 60 * 60 * 1000;
  const jitter = (Math.random() * 2 - 1) * JITTER_PCT * baseMs; // ±JITTER_PCT
  return Math.round(baseMs + jitter);
}

async function fetchTwilioMessage(sid: string): Promise<TwilioMessage | null> {
  if (!TWILIO_ACCOUNT_SID || (!TWILIO_AUTH_TOKEN && !TWILIO_API_KEY_SECRET)) {
    console.warn("[reconcile] Twilio credentials missing — skipping fetch");
    return null;
  }
  const authUser = TWILIO_API_KEY_SID || TWILIO_ACCOUNT_SID;
  const authPass = TWILIO_API_KEY_SECRET || TWILIO_AUTH_TOKEN;
  const auth = btoa(`${authUser}:${authPass}`);
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/${sid}.json`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (resp.status === 404) {
      console.warn(`[reconcile] Twilio message ${sid} not found (404)`);
      return null;
    }
    if (!resp.ok) {
      console.warn(`[reconcile] Twilio fetch failed for ${sid}: ${resp.status}`);
      return null;
    }
    return await resp.json() as TwilioMessage;
  } catch (err) {
    console.warn(`[reconcile] Twilio fetch threw for ${sid}:`, err);
    return null;
  }
}

type Classification =
  | { kind: "in_flight" }
  | { kind: "delivered" }
  | { kind: "transient"; code: number; message: string }
  | { kind: "permanent"; code: number; message: string };

function classify(msg: TwilioMessage): Classification {
  const terminalSuccess = ["delivered", "sent", "read", "receiving"];
  const terminalFailure = ["undelivered", "failed", "canceled"];
  if (terminalSuccess.includes(msg.status)) return { kind: "delivered" };
  if (terminalFailure.includes(msg.status)) {
    const code = Number(msg.error_code ?? 0);
    if (TRANSIENT_CODES.has(code)) {
      return { kind: "transient", code, message: msg.error_message ?? "" };
    }
    if (PERMANENT_CODES.has(code)) {
      return { kind: "permanent", code, message: msg.error_message ?? "" };
    }
    // Unknown error code — be conservative, treat as permanent so we don't
    // hammer Twilio with retries that would just fail the same way.
    return {
      kind: "permanent",
      code,
      message: msg.error_message ?? `unknown_status_${msg.status}_code_${code}`,
    };
  }
  // queued / sending / accepted / scheduled — still in flight
  return { kind: "in_flight" };
}

// deno-lint-ignore no-explicit-any
async function processTenancy(supabase: any, audit: AuditLogger, t: Tenancy): Promise<string> {
  if (!t.last_landlord_invite_message_sid) return "skipped:no_sid";
  const msg = await fetchTwilioMessage(t.last_landlord_invite_message_sid);
  if (!msg) {
    // Couldn't reach Twilio — leave as unchecked, retry next minute.
    return "skipped:fetch_failed";
  }
  const verdict = classify(msg);

  if (verdict.kind === "in_flight") {
    // Still queued at Twilio; come back next tick.
    return "in_flight";
  }

  if (verdict.kind === "delivered") {
    await supabase
      .from("tenancies")
      .update({ landlord_invite_status_checked: true })
      .eq("id", t.id);
    return "delivered";
  }

  // Failure — terminal at Twilio. Decide between retry vs. surface.
  if (verdict.kind === "permanent") {
    await supabase
      .from("tenancies")
      .update({
        landlord_status: "invited_undelivered",
        landlord_invite_status_checked: true,
      })
      .eq("id", t.id);

    await audit.logFailure(
      AuditActions.LANDLORD_INVITE_UNDELIVERED,
      "landlord",
      `twilio_${verdict.code}`,
      verdict.message,
      "tenancy",
      t.id,
      {
        message_sid: t.last_landlord_invite_message_sid,
        twilio_error_code: verdict.code,
        classification: "permanent",
      },
    );
    return `permanent:${verdict.code}`;
  }

  // Transient — queue retry, unless we've already exhausted retries for
  // this tenancy. Each prior non-superseded retry attempt counts; once
  // we've burned 3 attempts and Meta is still capping, we surface to the
  // tenant rather than retry forever.
  const { count: priorAttempts } = await supabase
    .from("landlord_invite_retry_queue")
    .select("id", { count: "exact", head: true })
    .eq("tenancy_id", t.id)
    .neq("status", "superseded");

  if ((priorAttempts ?? 0) >= 3) {
    await supabase
      .from("tenancies")
      .update({
        landlord_status: "invited_undelivered",
        landlord_invite_status_checked: true,
      })
      .eq("id", t.id);
    await audit.logFailure(
      AuditActions.LANDLORD_INVITE_UNDELIVERED,
      "landlord",
      `twilio_${verdict.code}_max_retries`,
      `${verdict.message} (after ${priorAttempts} prior retry attempts)`,
      "tenancy",
      t.id,
      {
        message_sid: t.last_landlord_invite_message_sid,
        twilio_error_code: verdict.code,
        classification: "transient_max_retries",
        prior_retry_attempts: priorAttempts,
      },
    );
    return `permanent:max_retries:${verdict.code}`;
  }

  // Snapshot send-time inputs onto the queue row; the retry cron will
  // re-validate against the live tenancy at send time (in case the tenant
  // changes the phone number in the interim).
  if (!TWILIO_LANDLORD_INVITE_TEMPLATE_SID) {
    console.error(
      "[reconcile] TWILIO_LANDLORD_INVITE_TEMPLATE_SID env missing — cannot queue retry",
    );
    return "error:no_template_sid";
  }
  const phone = t.landlord_phone?.replace(/\D/g, "") ?? "";
  const country = t.country_code ?? "+91";
  if (!phone) {
    // Tenancy lost the phone somehow; treat as permanent.
    await supabase
      .from("tenancies")
      .update({
        landlord_status: "invited_undelivered",
        landlord_invite_status_checked: true,
      })
      .eq("id", t.id);
    return "permanent:missing_phone";
  }

  // First retry uses 8h backoff; subsequent retries (priorAttempts >= 1
  // means this is at least the second retry-attempt cycle) use 24h.
  const backoffHours = (priorAttempts ?? 0) === 0
    ? FIRST_RETRY_BACKOFF_HOURS
    : 24;
  const scheduledFor = new Date(
    Date.now() + jitteredDelayMs(backoffHours),
  ).toISOString();

  const { error: insertErr } = await supabase
    .from("landlord_invite_retry_queue")
    .insert({
      tenancy_id: t.id,
      to_phone: phone,
      country_code: country,
      content_sid: TWILIO_LANDLORD_INVITE_TEMPLATE_SID,
      initial_error_code: String(verdict.code),
      status: "pending",
      retry_count: priorAttempts ?? 0,
      max_retries: 3,
      scheduled_for: scheduledFor,
    });
  if (insertErr) {
    console.error("[reconcile] Failed to queue retry for tenancy", t.id, insertErr);
    return "error:queue_insert_failed";
  }

  await supabase
    .from("tenancies")
    .update({
      landlord_status: "invited_deferred",
      landlord_invite_status_checked: true,
    })
    .eq("id", t.id);

  await audit.log({
    action: AuditActions.LANDLORD_INVITE_DEFERRED,
    category: "landlord",
    entityType: "tenancy",
    entityId: t.id,
    details: {
      message_sid: t.last_landlord_invite_message_sid,
      twilio_error_code: verdict.code,
      twilio_error_message: verdict.message,
      first_retry_at: scheduledFor,
    },
    status: "partial",
    errorCode: `twilio_${verdict.code}`,
    errorMessage: verdict.message,
  });
  return `transient:${verdict.code}:queued`;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    verifyServiceRole(req.headers.get("Authorization"));
    const supabase = createServiceClient();
    const audit = new AuditLogger(supabase, {
      actorType: "system",
      functionName: "reconcile-landlord-invite-deliveries",
      requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    });

    const settleCutoff = new Date(Date.now() - SETTLE_DELAY_MS).toISOString();
    const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

    // Pick due tenancies. Order by sent_at so older ones reconcile first.
    const { data, error } = await supabase
      .from("tenancies")
      .select(
        "id, user_id, landlord_phone, country_code, last_landlord_invite_message_sid, landlord_invite_sent_at",
      )
      .eq("landlord_status", "invited")
      .eq("landlord_invite_status_checked", false)
      .not("last_landlord_invite_message_sid", "is", null)
      .lte("landlord_invite_sent_at", settleCutoff)
      .gte("landlord_invite_sent_at", staleCutoff)
      .order("landlord_invite_sent_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (error) {
      console.error("[reconcile] Tenancy pickup query failed:", error);
      return errorResponse("Pickup query failed", 500);
    }

    const tenancies = (data ?? []) as Tenancy[];

    // Mark tenancies older than the stale cutoff as checked, so we don't
    // poll them forever. Done as a separate query (no SID load on Twilio).
    const { error: staleErr } = await supabase
      .from("tenancies")
      .update({ landlord_invite_status_checked: true })
      .eq("landlord_status", "invited")
      .eq("landlord_invite_status_checked", false)
      .not("last_landlord_invite_message_sid", "is", null)
      .lt("landlord_invite_sent_at", staleCutoff);
    if (staleErr) {
      console.warn("[reconcile] Stale-mark update failed:", staleErr);
    }

    const results: Record<string, number> = {};
    for (const t of tenancies) {
      const outcome = await processTenancy(supabase, audit, t);
      results[outcome] = (results[outcome] ?? 0) + 1;
    }

    return jsonResponse({
      success: true,
      data: { picked: tenancies.length, outcomes: results },
    });
  } catch (error) {
    return handleError(error, req.headers.get("x-request-id") ?? undefined);
  }
});
