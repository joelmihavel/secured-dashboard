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

const SENTINEL_PATH = `${FileSystem.documentDirectory}flent_installed`;

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
  // OTA reload marker
  'flent_ota_reload_ts',
  // Supabase session (chunked storage)
  'supabase.auth.token',
  'supabase.auth.token_chunks',
  'supabase.auth.token-code-verifier',
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

    // Sentinel missing — either first-ever install or reinstall.
    // Check if ANY Keychain data exists to distinguish.
    const hasKeychainData = await checkForKeychainData();

    if (hasKeychainData) {
      // Keychain data exists but sentinel is gone → reinstall detected
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
    const session = await SecureStore.getItemAsync('supabase.auth.token');
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

async function clearAllKeychainData(): Promise<void> {
  // Clear known keys
  await Promise.all(
    ALL_KEYCHAIN_KEYS.map(key =>
      SecureStore.deleteItemAsync(key).catch(() => {})
    )
  );

  // Clear Supabase session chunks (variable count)
  try {
    const countRaw = await SecureStore.getItemAsync('supabase.auth.token_chunks');
    if (countRaw) {
      const n = parseInt(countRaw, 10);
      for (let i = 1; i < n; i++) {
        await SecureStore.deleteItemAsync(`supabase.auth.token_${i}`).catch(() => {});
      }
    }
  } catch { /* best-effort */ }
}
