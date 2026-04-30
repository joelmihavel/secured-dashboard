/**
 * Fresh Install Detection
 *
 * iOS Keychain persists across app uninstall/reinstall. This means Supabase
 * sessions, Zustand stores, and cached routes survive a delete-reinstall cycle.
 * A new user on the same device gets the previous user's stale state.
 *
 * Detection strategy: write a sentinel file to the app's document directory
 * (which IS wiped on uninstall). If the file is missing on launch but Keychain
 * data exists, this is a reinstall — clear all Keychain data.
 *
 * Must run BEFORE Supabase client reads the session from Keychain.
 */

import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { OTA_RELOAD_MARKER_KEY } from '@/src/config/updates';
import { SUPABASE_SESSION_STORAGE_KEY } from '@/src/services/supabase/client';

const SENTINEL_PATH = `${FileSystem.documentDirectory}flent_installed`;
const APP_VERSION_KEY = 'flent_app_version';

/**
 * All SecureStore (Keychain) keys that must be cleared on fresh install.
 * Mirrors PERSISTED_SECURE_STORE_KEYS from resetAll.ts + Supabase session keys.
 */
const ALL_KEYCHAIN_KEYS = [
  // Zustand persisted stores
  'flent-upload-state',
  'payment-recovery',
  // Journey router cache
  'flent_last_journey_target',
  // DB migration marker
  'flent_db_migration',
  // OTA reload marker (imported constant, not hardcoded)
  OTA_RELOAD_MARKER_KEY,
  // App version tracker
  APP_VERSION_KEY,
  // Supabase session (generation-based chunked storage)
  SUPABASE_SESSION_STORAGE_KEY,
  `${SUPABASE_SESSION_STORAGE_KEY}_chunks`,
  `${SUPABASE_SESSION_STORAGE_KEY}_gen`,
  `${SUPABASE_SESSION_STORAGE_KEY}-code-verifier`,
  // Pending offline-signOut revocation queue (Gap #6).
  // Hardcoded (not imported) to avoid an import cycle with api/auth.ts.
  // Must match PENDING_REVOCATION_KEY in src/services/api/auth.ts.
  'flent_pending_revocation',
  // Last-good update-policy fallback. Hardcoded (not imported) to avoid an
  // import cycle with hooks/useUpdatePolicy.ts. Must match LAST_GOOD_POLICY_KEY
  // in that file. Without this, a stale "blocking native" policy could
  // survive delete+reinstall and lock out a fresh user offline.
  'flent_update_policy_last_good',
];

/**
 * Check if this is a fresh install (app was deleted and reinstalled).
 * If yes, wipe all Keychain data to prevent stale state.
 *
 * Call this ONCE at app startup, before AuthProvider initializes.
 * Returns true if a fresh install was detected and Keychain was wiped.
 */
export async function detectAndHandleFreshInstall(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(SENTINEL_PATH);

    if (info.exists) {
      // Sentinel exists — this is a normal launch, not a reinstall
      return false;
    }

    // Sentinel missing — either first-ever install, reinstall, or a prior
    // sentinel-write failure (rare iOS sandbox edge cases). Check Keychain
    // to distinguish first-install from reinstall.
    const hasKeychainData = await checkForKeychainData();

    if (hasKeychainData) {
      // Keychain has data but sentinel is gone. Two possibilities:
      //  (a) Genuine reinstall — old user's data must be wiped.
      //  (b) Sentinel write failed on a previous boot — user is mid-session,
      //      wiping would forcibly sign them out.
      //
      // APP_VERSION_KEY is the disambiguator: it's only set by
      // detectAndHandleVersionChange after the *first successful* boot, and
      // it IS cleared by clearAllKeychainData(). So its presence proves a
      // prior boot completed init on the same Keychain — meaning case (b).
      // (Gap #8)
      const hasVersionKey = await SecureStore.getItemAsync(APP_VERSION_KEY).catch(() => null);
      if (hasVersionKey) {
        console.log(
          '[install-detection] Sentinel missing but version key present — ' +
          'treating as sentinel-write failure, NOT wiping Keychain'
        );
        await FileSystem.writeAsStringAsync(SENTINEL_PATH, Date.now().toString()).catch(() => {});
        return false;
      }

      // No version key + Keychain data → genuine reinstall.
      console.log('[install-detection] Fresh install detected — clearing stale Keychain data');
      await clearAllKeychainData();
    }

    // Write sentinel for future launches
    await FileSystem.writeAsStringAsync(SENTINEL_PATH, Date.now().toString());
    return hasKeychainData;
  } catch (err) {
    console.warn('[install-detection] Error during detection (non-fatal):', err);
    // Best-effort — write sentinel to prevent repeated checks
    try {
      await FileSystem.writeAsStringAsync(SENTINEL_PATH, Date.now().toString());
    } catch { /* ignore */ }
    return false;
  }
}

async function checkForKeychainData(): Promise<boolean> {
  try {
    // Check the most common key — Supabase session
    const session = await SecureStore.getItemAsync(SUPABASE_SESSION_STORAGE_KEY);
    if (session) return true;

    // Check upload store
    const upload = await SecureStore.getItemAsync('flent-upload-state');
    if (upload) return true;

    // Check cached route
    const route = await SecureStore.getItemAsync('flent_last_journey_target');
    if (route) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Detect app version change after a forced update.
 * If version changed, wipe all persisted Zustand stores and cached routes
 * so old-schema data doesn't crash the new code. The Supabase session is
 * preserved — the user stays logged in but gets a fresh local state.
 *
 * Returns true if a version change was detected and stores were wiped.
 */
export async function detectAndHandleVersionChange(): Promise<boolean> {
  try {
    const currentVersion = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version;
    if (!currentVersion) return false;

    const storedVersion = await SecureStore.getItemAsync(APP_VERSION_KEY).catch(() => null);
    if (storedVersion === currentVersion) return false;

    // Version changed (or first tracked launch)
    if (storedVersion) {
      // Actual version change — wipe Zustand persisted stores + cached route.
      // Do NOT wipe Supabase session or DB migration marker — user stays logged in.
      console.log(`[install-detection] App version changed: ${storedVersion} → ${currentVersion} — clearing persisted stores`);
      const storeKeys = [
        'flent-upload-state',
        'payment-recovery',
        'flent_last_journey_target',
      ];
      await Promise.all(
        storeKeys.map(key => SecureStore.deleteItemAsync(key).catch(() => {}))
      );
    }

    await SecureStore.setItemAsync(APP_VERSION_KEY, currentVersion).catch(() => {});
    return !!storedVersion; // true only on actual change, not first install
  } catch {
    return false;
  }
}

async function clearAllKeychainData(): Promise<void> {
  // Clear known keys
  await Promise.all(
    ALL_KEYCHAIN_KEYS.map(key =>
      SecureStore.deleteItemAsync(key).catch(() => {})
    )
  );

  // Clear Supabase session chunks — both legacy (gen 0) and generation-based
  try {
    // Legacy chunks (gen 0)
    const countRaw = await SecureStore.getItemAsync(`${SUPABASE_SESSION_STORAGE_KEY}_chunks`);
    if (countRaw) {
      const n = parseInt(countRaw, 10);
      for (let i = 1; i < n; i++) {
        await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_STORAGE_KEY}_${i}`).catch(() => {});
      }
    }
    // Generation-based chunks (gen 1+)
    const genRaw = await SecureStore.getItemAsync(`${SUPABASE_SESSION_STORAGE_KEY}_gen`);
    if (genRaw) {
      const gen = parseInt(genRaw, 10);
      // Clean up to 3 generations (current + 2 stale)
      for (let g = Math.max(1, gen - 2); g <= gen; g++) {
        const prefix = `${SUPABASE_SESSION_STORAGE_KEY}_g${g}`;
        const gc = await SecureStore.getItemAsync(`${prefix}_chunks`).catch(() => null);
        if (gc) {
          const n = parseInt(gc, 10);
          for (let i = 1; i < n; i++) {
            await SecureStore.deleteItemAsync(`${prefix}_${i}`).catch(() => {});
          }
          await SecureStore.deleteItemAsync(`${prefix}_chunks`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(prefix).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_STORAGE_KEY}_gen`).catch(() => {});
    }
  } catch { /* best-effort */ }
}
