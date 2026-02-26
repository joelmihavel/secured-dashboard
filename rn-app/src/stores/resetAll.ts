/**
 * Reset All Stores — Shared Utility
 *
 * Extracted from AuthProvider.tsx for reuse by DevNavigator scenario switching.
 * Resets all Zustand stores and clears the React Query cache.
 */

import { useAuthStore } from './auth';
import { useUploadStore } from './upload';
import { useWaitlistStore } from './waitlist';
import { usePaymentStore } from './payment';
import { useSetupStore } from './setup';
import { useProfileStore } from './profile';
import { queryClient } from '@/src/providers/QueryProvider';

export function clearAllStores() {
  useAuthStore.getState().reset();
  useUploadStore.getState().reset();
  useWaitlistStore.getState().reset();
  usePaymentStore.getState().reset();
  useSetupStore.getState().reset();
  useProfileStore.getState().reset();
  queryClient.clear();
}
