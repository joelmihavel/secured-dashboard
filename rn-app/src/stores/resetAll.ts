/**
 * Reset All Stores — Shared Utility
 *
 * Extracted from AuthProvider.tsx for reuse by DevNavigator scenario switching.
 * Resets all Zustand stores and clears the React Query cache.
 */

import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './auth';
import { useUploadStore } from './upload';
import { useWaitlistStore } from './waitlist';
import { usePaymentStore } from './payment';
import { useSetupStore } from './setup';
import { useProfileStore } from './profile';
import { queryClient } from '@/src/providers/QueryProvider';
import { removeAllChannels } from '@/src/services/supabase/realtimeManager';

export function clearAllStores() {
  // Tear down all WebSocket channels before clearing query cache
  removeAllChannels();

  useAuthStore.getState().reset();
  useUploadStore.getState().reset();
  useWaitlistStore.getState().reset();
  usePaymentStore.getState().reset();
  useSetupStore.getState().reset();
  useProfileStore.getState().reset();
  queryClient.clear();

  // Clear cached journey route so next launch goes through full resolution
  SecureStore.deleteItemAsync('flent_last_journey_target').catch(() => {});
}
