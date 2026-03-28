/**
 * Force Update Hook
 *
 * Checks app_config.min_app_version from Supabase (anon access)
 * and determines if the current app version requires a forced update.
 *
 * Fails open: any network/parse error → no blocking.
 * Caches result for session (no repeated fetches).
 */

import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/src/services/supabase/client';

export interface ForceUpdateState {
  isRequired: boolean;
  message: string | null;
  isLoading: boolean;
}

/**
 * Compare two semver strings.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Session-level cache — survives re-renders but not app restarts
let _cachedResult: ForceUpdateState | null = null;

export function useForceUpdate(): ForceUpdateState {
  const [state, setState] = useState<ForceUpdateState>(
    _cachedResult ?? { isRequired: false, message: null, isLoading: true }
  );
  const hasFetchedRef = useRef(!!_cachedResult);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'min_app_version')
          .maybeSingle();

        if (error || !data?.value) {
          // Fail open — don't block users
          const result: ForceUpdateState = { isRequired: false, message: null, isLoading: false };
          _cachedResult = result;
          setState(result);
          return;
        }

        const config = data.value as { version: string | null; message: string | null };
        const minVersion = config.version;

        if (!minVersion) {
          // No enforcement — version is null
          const result: ForceUpdateState = { isRequired: false, message: null, isLoading: false };
          _cachedResult = result;
          setState(result);
          return;
        }

        const currentVersion = Constants.expoConfig?.version;
        if (!currentVersion) {
          // Can't determine current version — fail open
          const result: ForceUpdateState = { isRequired: false, message: null, isLoading: false };
          _cachedResult = result;
          setState(result);
          return;
        }

        const isOutdated = compareVersions(currentVersion, minVersion) < 0;
        const result: ForceUpdateState = {
          isRequired: isOutdated,
          message: isOutdated ? (config.message || null) : null,
          isLoading: false,
        };
        _cachedResult = result;
        setState(result);
      } catch {
        // Fail open on any exception
        const result: ForceUpdateState = { isRequired: false, message: null, isLoading: false };
        _cachedResult = result;
        setState(result);
      }
    })();
  }, []);

  return state;
}
