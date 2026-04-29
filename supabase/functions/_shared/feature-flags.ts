/**
 * Feature-flag reader for edge functions.
 *
 * Reads `private.feature_flags` via the SECURITY DEFINER helper
 * `public.get_feature_flag(text)`. Caches each flag for 30 seconds to
 * avoid hammering the DB on every send. Fails CLOSED (returns disabled)
 * on any error so a flag-table outage cannot accidentally re-enable
 * sends that the operator has turned off.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface FlagRow {
  enabled: boolean;
  config: Record<string, unknown>;
}

interface CacheEntry extends FlagRow {
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

// Hoisted to module scope so we don't pay createClient() on every flag read.
// Lazily created on first use because Deno.env may not be ready at import time
// in some test harnesses.
// deno-lint-ignore no-explicit-any
let _serviceClient: any | null = null;

function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
  const key =
    Deno.env.get("SB_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  _serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _serviceClient;
}

export async function getFeatureFlag(key: string): Promise<FlagRow> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return { enabled: cached.enabled, config: cached.config };
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("get_feature_flag", { p_key: key });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      const fail: FlagRow = { enabled: false, config: {} };
      cache.set(key, { ...fail, expiresAt: now + CACHE_TTL_MS });
      return fail;
    }

    // RPC returns a SETOF row — supabase-js returns it as an array
    const row = (Array.isArray(data) ? data[0] : data) as {
      enabled?: boolean;
      config?: Record<string, unknown>;
    };

    const result: FlagRow = {
      enabled: !!row.enabled,
      config: row.config ?? {},
    };
    cache.set(key, { ...result, expiresAt: now + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn(`[feature-flags] read failed for "${key}":`, err);
    const fail: FlagRow = { enabled: false, config: {} };
    cache.set(key, { ...fail, expiresAt: now + CACHE_TTL_MS });
    return fail;
  }
}

export async function isWhatsAppSendEnabled(): Promise<boolean> {
  const flag = await getFeatureFlag("whatsapp_send");
  return flag.enabled;
}

/**
 * Automated funnel sends (cron-driven) are gated by both flags so the
 * operator can pause cron-driven WA without affecting transactional sends.
 * Transactional sends only check `whatsapp_send`.
 */
export async function isWhatsAppAutomatedEnabled(): Promise<boolean> {
  const send = await getFeatureFlag("whatsapp_send");
  if (!send.enabled) return false;
  const auto = await getFeatureFlag("whatsapp_automated");
  return auto.enabled;
}

export async function isWhatsAppBroadcastEnabled(): Promise<boolean> {
  const send = await getFeatureFlag("whatsapp_send");
  if (!send.enabled) return false;
  const bc = await getFeatureFlag("whatsapp_broadcast");
  return bc.enabled;
}

/**
 * Returns the per-user daily WhatsApp cap. Returns `0` (no cap enforced) when
 * the flag is `enabled=false` so the operator can disable the global ceiling
 * by toggling that row instead of editing the config JSON.
 */
export async function getWhatsAppDailyCap(): Promise<number> {
  const flag = await getFeatureFlag("whatsapp_daily_cap_per_user");
  if (!flag.enabled) return 0;
  const cap = (flag.config as { cap?: unknown }).cap;
  return typeof cap === "number" && cap > 0 ? cap : 3;
}

/** Test-only: clear in-memory cache so a fresh read happens. */
export function _clearFeatureFlagCache(): void {
  cache.clear();
}
