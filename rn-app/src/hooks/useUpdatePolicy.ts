/**
 * Update Policy Hook
 *
 * Fetches `update_policy` from Supabase `app_config` table (anon access)
 * and determines whether the user needs a native store update or an OTA update.
 *
 * Supports three modes:
 *   - "none"   : no update required
 *   - "native" : compare min_app_version against installed binary version
 *   - "ota"    : check expo-updates for a pending OTA bundle
 *
 * Resolution rules:
 *   1. `update_policy` key present → use it
 *   2. Missing → fall back to legacy `min_app_version` key
 *   3. Both missing AND fetch was successful → fail open (legitimate "no policy")
 *   4. Both fetches FAILED (network error / 5xx / Supabase down) → use the
 *      last-good policy persisted from a prior successful fetch. Without this,
 *      a user on a degraded network could bypass a forced native update by
 *      simply opening the app while offline.
 *   5. No prior good policy AND fetch failed → fail open (first-launch offline
 *      is the only path that lands here; we can't block what we never knew).
 */

import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/src/services/supabase/client';
import { compareVersions } from '@/src/hooks/useForceUpdate';

// ─── Public interface ────────────────────────────────────────────────

export interface UpdatePolicy {
  type: 'none' | 'native' | 'ota';
  isRequired: boolean;
  title: string | null;
  message: string | null;
  isLoading: boolean;
  minAppVersion: string | null;
}

// ─── Defaults ────────────────────────────────────────────────────────

const FAIL_OPEN: UpdatePolicy = {
  type: 'none',
  isRequired: false,
  title: null,
  message: null,
  isLoading: false,
  minAppVersion: null,
};

const LOADING: UpdatePolicy = {
  type: 'none',
  isRequired: false,
  title: null,
  message: null,
  isLoading: true,
  minAppVersion: null,
};

// ─── Raw DB shape ────────────────────────────────────────────────────

interface UpdatePolicyPayload {
  type: 'native' | 'ota' | 'none';
  min_app_version: string | null;
  title: string | null;
  message: string | null;
  blocking: boolean;
}

// ─── Session-level cache + last-good persistence ─────────────────────

/**
 * SecureStore key for the last-good policy payload. Used as a fallback when
 * the live fetch fails (network down, Supabase unreachable). Without this,
 * a user could bypass a forced native update simply by opening the app
 * while offline. Cleared on fresh-install (see installDetection.ts).
 */
const LAST_GOOD_POLICY_KEY = 'flent_update_policy_last_good';

let _cachedResult: UpdatePolicy | null = null;

/** Reset the cached result so the next mount re-fetches.
 *  Also clears the persisted last-good — used when the user dismisses the
 *  critical-update screen so they don't get stuck looping on a stale policy.
 */
export function clearUpdatePolicyCache(): void {
  _cachedResult = null;
  SecureStore.deleteItemAsync(LAST_GOOD_POLICY_KEY).catch(() => {});
}

/** Fetch outcomes — distinguishes "no row in DB" from "couldn't reach DB". */
type FetchOutcome =
  | { status: 'ok'; payload: UpdatePolicyPayload | null } // ok-with-payload OR ok-no-row
  | { status: 'error' }; // network/server error — caller should fall back

// ─── Fetch helpers ───────────────────────────────────────────────────

/**
 * Attempt to read the `update_policy` key from `app_config`.
 * Returns:
 *   - { status: 'ok', payload: <parsed> } — row exists and parsed cleanly
 *   - { status: 'ok', payload: null }     — row missing or shape invalid
 *   - { status: 'error' }                  — network/5xx/runtime failure
 * The 'ok-no-row' case is the legitimate fail-open path; 'error' triggers
 * the last-good fallback in the hook so a forced update can't be bypassed.
 */
async function fetchUpdatePolicyKey(): Promise<FetchOutcome> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'update_policy')
      .maybeSingle();

    if (error) return { status: 'error' };
    if (!data?.value) return { status: 'ok', payload: null };

    const raw = data.value as Record<string, unknown>;
    const type = raw.type;
    if (type !== 'native' && type !== 'ota' && type !== 'none') {
      return { status: 'ok', payload: null };
    }

    return {
      status: 'ok',
      payload: {
        type: type as UpdatePolicyPayload['type'],
        min_app_version: typeof raw.min_app_version === 'string' ? raw.min_app_version : null,
        title: typeof raw.title === 'string' ? raw.title : null,
        message: typeof raw.message === 'string' ? raw.message : null,
        blocking: typeof raw.blocking === 'boolean' ? raw.blocking : false,
      },
    };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Fallback: read the legacy `min_app_version` key.
 * Same outcome shape as fetchUpdatePolicyKey.
 */
async function fetchLegacyMinVersion(): Promise<FetchOutcome> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .maybeSingle();

    if (error) return { status: 'error' };
    if (!data?.value) return { status: 'ok', payload: null };

    const config = data.value as { version?: string; message?: string };
    const version = typeof config.version === 'string' ? config.version : null;
    if (!version) return { status: 'ok', payload: null };

    return {
      status: 'ok',
      payload: {
        type: 'native',
        min_app_version: version,
        title: null,
        message: typeof config.message === 'string' ? config.message : null,
        blocking: true,
      },
    };
  } catch {
    return { status: 'error' };
  }
}

/** Read the last-good payload from SecureStore. Returns null if missing/corrupt. */
async function readLastGoodPolicy(): Promise<UpdatePolicyPayload | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_GOOD_POLICY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = parsed.type;
    if (type !== 'native' && type !== 'ota' && type !== 'none') return null;
    return {
      type: type as UpdatePolicyPayload['type'],
      min_app_version: typeof parsed.min_app_version === 'string' ? parsed.min_app_version : null,
      title: typeof parsed.title === 'string' ? parsed.title : null,
      message: typeof parsed.message === 'string' ? parsed.message : null,
      blocking: typeof parsed.blocking === 'boolean' ? parsed.blocking : false,
    };
  } catch {
    return null;
  }
}

/** Persist a successfully-fetched payload as the new last-good fallback. */
async function persistLastGoodPolicy(payload: UpdatePolicyPayload | null): Promise<void> {
  try {
    if (payload === null) {
      // No policy on server — clear any stale last-good so we don't fail closed
      // against a server that has explicitly removed the policy.
      await SecureStore.deleteItemAsync(LAST_GOOD_POLICY_KEY).catch(() => {});
      return;
    }
    await SecureStore.setItemAsync(LAST_GOOD_POLICY_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal — last-good persistence is best-effort.
  }
}

// ─── Resolution logic ────────────────────────────────────────────────

async function resolvePolicy(payload: UpdatePolicyPayload): Promise<UpdatePolicy> {
  const base = {
    title: payload.title,
    message: payload.message,
    isLoading: false,
    minAppVersion: payload.min_app_version,
  };

  // ── type: none ──
  if (payload.type === 'none') {
    return { ...base, type: 'none', isRequired: false };
  }

  // ── type: native ──
  if (payload.type === 'native') {
    if (!payload.min_app_version) {
      // No version constraint specified — nothing to enforce
      return { ...base, type: 'native', isRequired: false };
    }

    const currentVersion = Constants.expoConfig?.version;
    if (!currentVersion) {
      // Cannot determine current version — fail open
      return { ...base, type: 'native', isRequired: false };
    }

    const isOutdated = compareVersions(currentVersion, payload.min_app_version) < 0;
    return {
      ...base,
      type: 'native',
      isRequired: isOutdated && payload.blocking,
    };
  }

  // ── type: ota ──
  if (payload.type === 'ota') {
    // In dev/Expo Go, Updates is disabled — nothing to do
    if (!Updates.isEnabled) {
      return { ...base, type: 'ota', isRequired: false };
    }

    try {
      const update = await Updates.checkForUpdateAsync();
      return {
        ...base,
        type: 'ota',
        isRequired: update.isAvailable && payload.blocking,
      };
    } catch {
      // OTA check failed (network, runtime, etc.) — fail open
      return { ...base, type: 'ota', isRequired: false };
    }
  }

  // Unreachable, but satisfy exhaustiveness — fail open
  return FAIL_OPEN;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useUpdatePolicy(): UpdatePolicy {
  const [state, setState] = useState<UpdatePolicy>(_cachedResult ?? LOADING);
  const hasFetchedRef = useRef(!!_cachedResult);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    (async () => {
      try {
        // 1. Try the new update_policy key
        const primary = await fetchUpdatePolicyKey();

        // 2. If primary errored, try the legacy key. If it also errored,
        //    fall back to the persisted last-good policy. If primary returned
        //    ok-no-row, the legacy key is the documented fallback.
        let resolved: UpdatePolicyPayload | null = null;
        let bothFetchesFailed = false;

        if (primary.status === 'ok' && primary.payload) {
          resolved = primary.payload;
        } else {
          const legacy = await fetchLegacyMinVersion();
          if (legacy.status === 'ok' && legacy.payload) {
            resolved = legacy.payload;
          } else if (primary.status === 'error' && legacy.status === 'error') {
            bothFetchesFailed = true;
          }
          // else: at least one fetch returned ok-no-row → legitimately no policy
        }

        if (resolved) {
          // Live fetch succeeded with a payload — persist as last-good and resolve.
          persistLastGoodPolicy(resolved); // fire-and-forget
          const result = await resolvePolicy(resolved);
          _cachedResult = result;
          setState(result);
          return;
        }

        if (bothFetchesFailed) {
          // Network/server error on BOTH fetches. Don't blindly fail open —
          // if we have a last-good policy from a prior successful run, honor
          // it so a forced native update can't be bypassed by going offline.
          const lastGood = await readLastGoodPolicy();
          if (lastGood) {
            const result = await resolvePolicy(lastGood);
            _cachedResult = result;
            setState(result);
            return;
          }
          // No last-good (first launch offline) — only path that legitimately
          // fails open under network failure.
          _cachedResult = FAIL_OPEN;
          setState(FAIL_OPEN);
          return;
        }

        // Both fetches succeeded with no payload → server confirms no policy.
        // Clear any stale last-good so we don't fail closed next time.
        persistLastGoodPolicy(null); // fire-and-forget
        _cachedResult = FAIL_OPEN;
        setState(FAIL_OPEN);
      } catch {
        // Top-level safety net. Try last-good before failing open.
        const lastGood = await readLastGoodPolicy().catch(() => null);
        if (lastGood) {
          const result = await resolvePolicy(lastGood).catch(() => FAIL_OPEN);
          _cachedResult = result;
          setState(result);
          return;
        }
        _cachedResult = FAIL_OPEN;
        setState(FAIL_OPEN);
      }
    })();
  }, []);

  return state;
}
