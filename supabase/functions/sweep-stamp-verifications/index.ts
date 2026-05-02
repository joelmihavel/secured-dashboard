/**
 * Sweep Stamp Verifications — Safety-net Cron Edge Function
 *
 * Runs once per night. Finds Karnataka extractions uploaded in the last 48
 * hours that don't have a terminal stamp verification row (due to
 * extraction-service container death, SHCIL downtime, etc.) and triggers
 * /verify on stamp-verification-service for each.
 *
 * Cron path: scoped to last 48h, capped at 5/run. If we ever exceed the
 * cap regularly, that's a signal that fire-and-forget is failing and we
 * should move to Cloud Tasks (Phase 3).
 *
 * One-shot backfill: pass ?lookback_hours=N&max_per_run=N (URL-clamped to
 * 1 year / 200 rows). The cron never sets query params so its behavior is
 * preserved; this gives operators a knob to drain historical stragglers
 * without redeploying.
 *
 * Schedule: Daily at 03:30 IST via pg_cron
 * Auth: Service role only (called from invoke_edge_function)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const DEFAULT_MAX_PER_RUN = 5;
const DEFAULT_LOOKBACK_HOURS = 48;

// Hard caps on overrides — protects the verify-service from being asked to
// process huge batches by an accidental misuse.
const MAX_OVERRIDE_LOOKBACK_HOURS = 24 * 365; // 1 year
const MAX_OVERRIDE_BATCH = 200;

function parsePositiveInt(raw: string | null, fallback: number, cap: number): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, cap);
}

function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
}

function getServiceKey(): string {
  return Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

serve(async (request: Request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    const verificationUrl = Deno.env.get("STAMP_VERIFICATION_SERVICE_URL");
    const verificationSecret = Deno.env.get("STAMP_VERIFICATION_SECRET");
    if (!verificationUrl || !verificationSecret) {
      return errorResponse(
        "STAMP_VERIFICATION_SERVICE_URL or STAMP_VERIFICATION_SECRET not configured",
        500
      );
    }

    const supabase = createClient(getSupabaseUrl(), getServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Defaults match the nightly cron. Overrides are URL-bounded so an
    // operator can do a one-shot backfill without redeploying — the cron
    // never passes query params, so its behavior is unchanged.
    const url = new URL(request.url);
    const lookbackHours = parsePositiveInt(
      url.searchParams.get('lookback_hours'),
      DEFAULT_LOOKBACK_HOURS,
      MAX_OVERRIDE_LOOKBACK_HOURS,
    );
    const maxPerRun = parsePositiveInt(
      url.searchParams.get('max_per_run'),
      DEFAULT_MAX_PER_RUN,
      MAX_OVERRIDE_BATCH,
    );

    const { data: candidates, error: qErr } = await supabase.rpc(
      'find_stamp_verification_stragglers',
      { lookback_hours: lookbackHours }
    );

    if (qErr) {
      console.error('[sweep] RPC query failed:', qErr);
      return errorResponse(`Query failed: ${qErr.message}`, 500);
    }

    const candidateRows = (candidates ?? []) as Array<{ id: string; created_at: string }>;
    const totalStragglers = candidateRows.length;
    const batch = candidateRows.slice(0, maxPerRun);

    console.log(
      `[sweep] Found ${totalStragglers} stragglers, processing ${batch.length} (lookback=${lookbackHours}h, max=${maxPerRun})`
    );

    const results: Array<{ id: string; http_status?: number; error?: string }> = [];
    for (const row of batch) {
      try {
        const res = await fetch(`${verificationUrl.replace(/\/$/, '')}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Verification-Secret': verificationSecret,
          },
          body: JSON.stringify({ extraction_id: row.id }),
        });
        results.push({ id: row.id, http_status: res.status });
        console.log(`[sweep] ${row.id} → HTTP ${res.status}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id: row.id, error: message });
        console.error(`[sweep] ${row.id} → ${message}`);
      }
    }

    return jsonResponse({
      sweep_completed: true,
      lookback_hours: lookbackHours,
      max_per_run: maxPerRun,
      total_stragglers: totalStragglers,
      processed: batch.length,
      capped: totalStragglers > maxPerRun,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sweep] Unhandled error:', err);
    return errorResponse(message, 500);
  }
});
