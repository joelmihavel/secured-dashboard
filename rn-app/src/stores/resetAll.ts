/**
 * Reset All Stores — Shared Utility
 *
 * Extracted from AuthProvider.tsx for reuse by DevNavigator scenario switching.
 * Resets all Zustand stores, explicitly wipes persisted SecureStore keys,
 * and clears the React Query cache.
 */

import * as SecureStore from 'expo-secure-store';
import { OTA_RELOAD_MARKER_KEY } from '@/src/config/updates';
import { useAuthStore } from './auth';
import { useUploadStore } from './upload';
import { useWaitlistStore } from './waitlist';
import { usePaymentStore } from './payment';
import { useSetupStore } from './setup';
import { useProfileStore } from './profile';
import { queryClient } from '@/src/providers/QueryProvider';
import { removeAllChannels } from '@/src/services/supabase/realtimeManager';

/**
 * SecureStore keys that hold persisted data. These must be explicitly deleted
 * on sign-out because Zustand's persist middleware writes asynchronously —
 * if the app is killed before the write completes, stale data survives.
 *
 * The Supabase session key uses chunked storage (see client.ts), so we also
 * need to clean up any chunk keys.
 */
import { SUPABASE_SESSION_STORAGE_KEY as SUPABASE_SESSION_KEY } from '@/src/services/supabase/client';
const PERSISTED_SECURE_STORE_KEYS = [
  'flent-upload-state',       // Upload store (Zustand persist)
  'payment-recovery',          // Payment store (Zustand persist)
  'flent_last_journey_target', // Cached journey route
  OTA_RELOAD_MARKER_KEY,       // OTA reload marker (prevents stale extended debounce)
];

/**
 * Remove the Supabase session and all its chunks from SecureStore.
 * This is the nuclear option — guarantees no stale session survives
 * even if the SDK's signOut() failed to call _removeSession().
 */
async function clearSupabaseSessionFromStorage(): Promise<void> {
  try {
    // Clear legacy gen 0 chunks
    const countRaw = await SecureStore.getItemAsync(`${SUPABASE_SESSION_KEY}_chunks`);
    if (countRaw) {
      const n = parseInt(countRaw, 10);
      for (let i = 1; i < n; i++) {
        await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_KEY}_${i}`);
      }
      await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_KEY}_chunks`);
    }
    await SecureStore.deleteItemAsync(SUPABASE_SESSION_KEY);

    // Clear generation-based chunks
    const genRaw = await SecureStore.getItemAsync(`${SUPABASE_SESSION_KEY}_gen`);
    if (genRaw) {
      const gen = parseInt(genRaw, 10);
      for (let g = Math.max(1, gen - 2); g <= gen; g++) {
        const prefix = `${SUPABASE_SESSION_KEY}_g${g}`;
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
      await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_KEY}_gen`).catch(() => {});
    }

    // Clear PKCE code verifier
    await SecureStore.deleteItemAsync(`${SUPABASE_SESSION_KEY}-code-verifier`);
  } catch {
    // Best-effort cleanup
  }
}

export async function clearAllStores() {
  // Tear down all WebSocket channels before clearing query cache
  removeAllChannels();

  useAuthStore.getState().reset();
  useUploadStore.getState().reset();
  useWaitlistStore.getState().reset();
  usePaymentStore.getState().reset();
  useSetupStore.getState().reset();
  useProfileStore.getState().reset();
  queryClient.clear();

  // Explicitly delete all persisted SecureStore keys.
  // Don't rely on Zustand's async persist write — if the app is killed
  // before it completes, stale data from the old user survives in keychain.
  await Promise.all(
    PERSISTED_SECURE_STORE_KEYS.map(key =>
      SecureStore.deleteItemAsync(key).catch(() => {})
    )
  );

  // Nuclear cleanup of Supabase session from SecureStore.
  // Handles the case where SDK's signOut() failed (server 500, network error)
  // and _removeSession() was never called, leaving the session in keychain.
  await clearSupabaseSessionFromStorage();
}
