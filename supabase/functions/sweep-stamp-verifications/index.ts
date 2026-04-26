/**
 * Sweep Stamp Verifications — Safety-net Cron Edge Function
 *
 * Runs once per night. Finds Karnataka extractions uploaded in the last 48
 * hours that don't have a terminal stamp verification row (due to
 * extraction-service container death, SHCIL downtime, etc.) and triggers
 * /verify on stamp-verification-service for each.
 *
 * Does NOT backfill history — deliberately scoped to last 48h so older
 * uploads don't get retriggered indefinitely. Existing certs get verified
 * via a one-shot backfill script, not this cron.
 *
 * Capped at 5 stragglers per run to bound runtime. If we ever exceed the
 * cap regularly, that's a signal that fire-and-forget is failing and we
 * should move to Cloud Tasks (Phase 3).
 *
 * Schedule: Daily at 03:30 IST via pg_cron
 * Auth: Service role only (called from invoke_edge_function)
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const MAX_PER_RUN = 5;
const LOOKBACK_HOURS = 48;

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

    const { data: candidates, error: qErr } = await supabase.rpc(
      'find_stamp_verification_stragglers',
      { lookback_hours: LOOKBACK_HOURS }
    );

    if (qErr) {
      console.error('[sweep] RPC query failed:', qErr);
      return errorResponse(`Query failed: ${qErr.message}`, 500);
    }

    const candidateRows = (candidates ?? []) as Array<{ id: string; created_at: string }>;
    const totalStragglers = candidateRows.length;
    const batch = candidateRows.slice(0, MAX_PER_RUN);

    console.log(
      `[sweep] Found ${totalStragglers} stragglers, processing ${batch.length}`
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
      lookback_hours: LOOKBACK_HOURS,
      total_stragglers: totalStragglers,
      processed: batch.length,
      capped: totalStragglers > MAX_PER_RUN,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sweep] Unhandled error:', err);
    return errorResponse(message, 500);
  }
});
