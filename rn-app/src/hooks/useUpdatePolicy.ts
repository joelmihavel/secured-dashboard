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
 * Falls back to legacy `min_app_version` key if `update_policy` is missing.
 * Fails open: any network/parse/runtime error results in no blocking.
 * Caches result for the session (module-level variable, cleared on app restart).
 */

import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
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

// ─── Session-level cache ─────────────────────────────────────────────

let _cachedResult: UpdatePolicy | null = null;

/** Reset the cached result so the next mount re-fetches. */
export function clearUpdatePolicyCache(): void {
  _cachedResult = null;
}

// ─── Fetch helpers ───────────────────────────────────────────────────

/**
 * Attempt to read the `update_policy` key from `app_config`.
 * Returns the parsed payload or null on any failure.
 */
async function fetchUpdatePolicyKey(): Promise<UpdatePolicyPayload | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'update_policy')
      .maybeSingle();

    if (error || !data?.value) return null;

    const raw = data.value as Record<string, unknown>;

    // Validate minimum shape
    const type = raw.type;
    if (type !== 'native' && type !== 'ota' && type !== 'none') return null;

    return {
      type: type as UpdatePolicyPayload['type'],
      min_app_version: typeof raw.min_app_version === 'string' ? raw.min_app_version : null,
      title: typeof raw.title === 'string' ? raw.title : null,
      message: typeof raw.message === 'string' ? raw.message : null,
      blocking: typeof raw.blocking === 'boolean' ? raw.blocking : false,
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: read the legacy `min_app_version` key.
 * If present, treat it as a native-only blocking update.
 */
async function fetchLegacyMinVersion(): Promise<UpdatePolicyPayload | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'min_app_version')
      .maybeSingle();

    if (error || !data?.value) return null;

    const config = data.value as { version?: string; message?: string };
    const version = typeof config.version === 'string' ? config.version : null;

    if (!version) return null;

    return {
      type: 'native',
      min_app_version: version,
      title: null,
      message: typeof config.message === 'string' ? config.message : null,
      blocking: true,
    };
  } catch {
    return null;
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
        let payload = await fetchUpdatePolicyKey();

        // 2. Fallback to legacy min_app_version key
        if (!payload) {
          payload = await fetchLegacyMinVersion();
        }

        // 3. Both missing — fail open
        if (!payload) {
          _cachedResult = FAIL_OPEN;
          setState(FAIL_OPEN);
          return;
        }

        // 4. Resolve the policy based on type
        const result = await resolvePolicy(payload);
        _cachedResult = result;
        setState(result);
      } catch {
        // Top-level safety net — fail open
        _cachedResult = FAIL_OPEN;
        setState(FAIL_OPEN);
      }
    })();
  }, []);

  return state;
}
