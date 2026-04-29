/**
 * WhatsApp notification policy helper.
 *
 * Enforces:
 *   - per-(user, notification_type) frequency caps from `notification_policy`
 *   - global per-user daily ceiling from `whatsapp_daily_cap_per_user` flag
 *   - quiet-hours from `notification_preferences` (IST)
 *   - per-channel and per-category opt-outs
 *
 * Race-safe: cap checks + slot claim run in a single Postgres function under a
 * per-user advisory transaction lock (`reserve_whatsapp_slot`), so two
 * parallel callers cannot both pass a "count<cap" check and both send.
 *
 * Flow:
 *   1. checkPrefsAndQuietHours()  — non-racy stable-state check
 *   2. reserveSlot()              — atomic count+insert; returns slot id or skip reason
 *   3. caller sends via Twilio
 *   4. releaseSlot(slot, outcome) — finalizes the row
 *
 * Fail-open on policy lookup error so transient DB issues don't block
 * transactional sends. The master kill-switch is enforced inside
 * `sendWhatsApp` itself (fail-closed).
 */

import { getWhatsAppDailyCap } from "./feature-flags.ts";

const IST_OFFSET_MINUTES = 330; // +5:30
const CHANNEL = "whatsapp";

// Defense-in-depth: the user-pref column name is interpolated into a SELECT
// list; today only service-role can write notification_policy, but if RLS
// ever loosens, this regex prevents the value from carrying SQL.
const SAFE_COLUMN_NAME = /^[a-z_][a-z0-9_]{0,63}$/i;

export type SkipReason =
  | "policy_disabled"
  | "lifetime_cap"
  | "per_day_cap"
  | "per_window_cap"
  | "daily_global_cap"
  | "quiet_hours"
  | "user_pref_disabled";

export type ReserveOutcome =
  | { allowed: true; slotId: string }
  | { allowed: false; reason: SkipReason; detail?: string };

interface PolicyRow {
  enabled: boolean;
  max_per_user_lifetime: number | null;
  max_per_user_per_day: number | null;
  max_per_user_per_window_count: number | null;
  window_seconds: number | null;
  respect_quiet_hours: boolean;
  respect_user_preference_column: string | null;
}

interface PrefsRow {
  whatsapp_enabled?: boolean | null;
  quiet_hours_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  [column: string]: boolean | string | null | undefined;
}

// deno-lint-ignore no-explicit-any
type SupabaseQueryBuilder = any;

interface SupabaseLike {
  from: (table: string) => SupabaseQueryBuilder;
  rpc: (fn: string, args: Record<string, unknown>) => SupabaseQueryBuilder;
}

// ============================================================
// Time / quiet-hours helpers
// ============================================================

/**
 * Returns the UTC instant of "00:00 IST today" in ISO format.
 *
 * Implementation note: we explicitly compute the IST date components rather
 * than relying on Date arithmetic-then-zero, which was ambiguous under
 * UTC-day-rollover scenarios.
 */
export function istStartOfDayUtc(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  // 00:00 IST = (y,m,d, 00:00 UTC) - 5:30
  const utcMs = Date.UTC(y, m, d) - IST_OFFSET_MINUTES * 60_000;
  return new Date(utcMs).toISOString();
}

function withinQuietHours(
  startSec: number | null,
  endSec: number | null,
): boolean {
  if (startSec == null || endSec == null) return false;
  const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
  const nowSec =
    ist.getUTCHours() * 3600 + ist.getUTCMinutes() * 60 + ist.getUTCSeconds();
  // Wraps past midnight (start > end)
  if (startSec <= endSec) return nowSec >= startSec && nowSec < endSec;
  return nowSec >= startSec || nowSec < endSec;
}

function timeStringToSeconds(s: string | null | undefined): number | null {
  if (!s) return null;
  const parts = s.split(":");
  const h = Number.parseInt(parts[0] ?? "", 10);
  if (Number.isNaN(h)) return null;
  const m = Number.parseInt(parts[1] ?? "0", 10);
  const sec = Number.parseInt(parts[2] ?? "0", 10);
  return h * 3600 + (Number.isNaN(m) ? 0 : m) * 60 + (Number.isNaN(sec) ? 0 : sec);
}

// ============================================================
// Policy + prefs check (non-racy)
// ============================================================

async function loadPolicy(
  supabase: SupabaseLike,
  notificationType: string,
): Promise<PolicyRow | null> {
  try {
    const { data } = await supabase
      .from("notification_policy")
      .select(
        "enabled, max_per_user_lifetime, max_per_user_per_day, max_per_user_per_window_count, window_seconds, respect_quiet_hours, respect_user_preference_column",
      )
      .eq("notification_type", notificationType)
      .eq("channel", CHANNEL)
      .maybeSingle();
    return (data as PolicyRow | null) ?? null;
  } catch (err) {
    console.warn(`[policy] lookup failed for ${notificationType}:`, err);
    return null;
  }
}

async function checkPrefsAndQuietHours(
  supabase: SupabaseLike,
  userId: string,
  policy: PolicyRow | null,
): Promise<{ allowed: true } | { allowed: false; reason: SkipReason; detail?: string }> {
  // Always check whatsapp_enabled. If a policy row is present and asks for
  // a category column or quiet-hours, fold them into the same query.
  let prefColumn: string | null = null;
  if (policy?.respect_user_preference_column) {
    if (!SAFE_COLUMN_NAME.test(policy.respect_user_preference_column)) {
      console.warn(
        `[policy] unsafe column name in notification_policy: ${policy.respect_user_preference_column}`,
      );
    } else {
      prefColumn = policy.respect_user_preference_column;
    }
  }

  const wantsQuietHours = !!policy?.respect_quiet_hours;
  const selectColumns = [
    "whatsapp_enabled",
    prefColumn,
    wantsQuietHours ? "quiet_hours_enabled" : null,
    wantsQuietHours ? "quiet_hours_start" : null,
    wantsQuietHours ? "quiet_hours_end" : null,
  ]
    .filter((c): c is string => !!c)
    .join(", ");

  try {
    const { data } = await supabase
      .from("notification_preferences")
      .select(selectColumns)
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = data as PrefsRow | null;
    if (!prefs) return { allowed: true }; // no prefs row → fail-open

    if (prefs.whatsapp_enabled === false) {
      return { allowed: false, reason: "user_pref_disabled", detail: "whatsapp_enabled=false" };
    }
    if (prefColumn && prefs[prefColumn] === false) {
      return { allowed: false, reason: "user_pref_disabled", detail: `${prefColumn}=false` };
    }
    if (
      wantsQuietHours &&
      prefs.quiet_hours_enabled === true &&
      withinQuietHours(
        timeStringToSeconds(prefs.quiet_hours_start as string | null | undefined),
        timeStringToSeconds(prefs.quiet_hours_end as string | null | undefined),
      )
    ) {
      return { allowed: false, reason: "quiet_hours" };
    }
    return { allowed: true };
  } catch (err) {
    console.warn(`[policy] prefs lookup failed for ${userId}:`, err);
    return { allowed: true }; // fail-open
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Reserves a send slot for a (user, notification_type). Either returns a
 * slot id that the caller MUST release after the send completes, or returns
 * a skip reason. The slot reservation runs under an advisory lock, so it's
 * race-safe across parallel callers.
 *
 * After Twilio returns: call `releaseWhatsAppSlot(supabase, slotId, outcome, ...)`.
 * If Twilio call throws or the caller fails to release, the row stays in
 * 'pending' and counts toward the cap for ~24h (until natural day rollover).
 * That's acceptable conservative behavior; the operator can manually clean
 * stale 'pending' rows if needed.
 */
export async function reserveWhatsAppSlot(
  supabase: SupabaseLike,
  userId: string,
  notificationType: string,
  context: Record<string, unknown> = {},
): Promise<ReserveOutcome> {
  const policy = await loadPolicy(supabase, notificationType);

  if (policy && !policy.enabled) {
    return { allowed: false, reason: "policy_disabled" };
  }

  // Non-racy stable-state checks first (cheaper, fail fast)
  const prefsCheck = await checkPrefsAndQuietHours(supabase, userId, policy);
  if (!prefsCheck.allowed) return prefsCheck;

  const dailyCap = await getWhatsAppDailyCap();

  try {
    const { data, error } = await supabase.rpc("reserve_whatsapp_slot", {
      p_user_id: userId,
      p_notification_type: notificationType,
      p_per_day_cap: policy?.max_per_user_per_day ?? null,
      p_per_window_cap: policy?.max_per_user_per_window_count ?? null,
      p_window_seconds: policy?.window_seconds ?? null,
      p_lifetime_cap: policy?.max_per_user_lifetime ?? null,
      p_global_daily_cap: dailyCap > 0 ? dailyCap : null,
      p_ist_day_start: istStartOfDayUtc(),
      p_context: context,
    });

    if (error || !data) {
      console.warn(`[policy] reserve RPC failed for ${userId}/${notificationType}:`, error);
      // Fail-OPEN on RPC error — transactional sends should not be blocked by
      // a transient DB issue. The kill-switch is the safety net.
      return { allowed: true, slotId: "" };
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { slot_id: string | null; allowed: boolean; reason: string | null }
      | undefined;
    if (!row) return { allowed: true, slotId: "" };

    if (row.allowed && row.slot_id) {
      return { allowed: true, slotId: row.slot_id };
    }
    return {
      allowed: false,
      reason: (row.reason as SkipReason) ?? "policy_disabled",
    };
  } catch (err) {
    console.warn(`[policy] reserve threw for ${userId}/${notificationType}:`, err);
    return { allowed: true, slotId: "" };
  }
}

export async function releaseWhatsAppSlot(
  supabase: SupabaseLike,
  slotId: string,
  outcome: "sent" | "failed" | "skipped",
  externalId?: string,
  errorMessage?: string,
): Promise<void> {
  if (!slotId) return; // open-failure path; nothing to release
  try {
    await supabase.rpc("release_whatsapp_slot", {
      p_slot_id: slotId,
      p_outcome: outcome,
      p_external_id: externalId ?? null,
      p_error_message: errorMessage ?? null,
    });
  } catch (err) {
    console.warn(`[policy] release failed for slot ${slotId}:`, err);
  }
}

/**
 * Logs a send outcome that didn't go through the slot-reservation path
 * (e.g. broadcast skips, kill-switch failures recorded after the fact).
 * Skips and failures only — successful sends should always go through
 * reserveWhatsAppSlot/releaseWhatsAppSlot so they count toward caps.
 */
export async function logSendOutcome(
  supabase: SupabaseLike,
  params: {
    user_id: string;
    notification_type: string;
    outcome: "sent" | "skipped" | "failed";
    skip_reason?: string;
    external_id?: string;
    error_message?: string;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("notification_send_log").insert({
      user_id: params.user_id,
      notification_type: params.notification_type,
      channel: CHANNEL,
      outcome: params.outcome,
      skip_reason: params.skip_reason,
      external_id: params.external_id,
      error_message: params.error_message,
      context: params.context ?? {},
    });
  } catch (err) {
    console.warn("[policy] logSendOutcome failed:", err);
  }
}
