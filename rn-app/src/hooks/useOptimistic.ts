/**
 * Optimistic Update Hooks (ST-106)
 *
 * Provides optimistic UI updates for mutations that should feel instant.
 * If the server call fails, the UI reverts to the previous state.
 *
 * Integrates with the offline mutation queue from useNetworkStatus.
 *
 * Patterns implemented:
 * 1. Payment method selection (instant visual feedback)
 * 2. Profile updates (show changes immediately, revert on error)
 * 3. Notification toggle (instant toggle, revert on save failure)
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePaymentStore } from '../stores/payment';
import { useProfileStore } from '../stores/profile';
import { paymentKeys } from './usePayments';
import { profileKeys } from './useProfile';
import { dashboardKeys } from './useDashboard';
import { queueMutation, getNetworkStatus } from './useNetworkStatus';
import { addBreadcrumb } from '../config/sentry';

// ==============================================
// OPTIMISTIC PAYMENT METHOD SELECTION
// ==============================================

/**
 * Hook for optimistic payment method selection.
 *
 * Immediately updates the payment store UI, then calls the server.
 * Reverts to previous selection if the server call fails.
 *
 * Usage:
 *   const { selectMethodOptimistic } = useOptimisticPaymentMethod();
 *   selectMethodOptimistic(method, async () => {
 *     await setDefaultPaymentMethod(method.id);
 *   });
 */
export function useOptimisticPaymentMethod() {
  const store = usePaymentStore();
  const queryClient = useQueryClient();
  const previousMethod = useRef(store.selectedMethod);
  const isInFlight = useRef(false);

  const selectMethodOptimistic = useCallback(
    async (
      method: Parameters<typeof store.selectMethod>[0],
      serverCall: () => Promise<void>
    ) => {
      // Only save previous state if no call is in flight — prevents
      // double-tap from overwriting the original rollback target
      if (!isInFlight.current) {
        previousMethod.current = store.selectedMethod;
      }
      isInFlight.current = true;

      // Optimistic update
      store.selectMethod(method);

      try {
        const { isConnected } = getNetworkStatus();

        if (!isConnected) {
          // Queue for later
          queueMutation('select-payment-method', serverCall, false);
          addBreadcrumb('Payment method selected optimistically (offline)', 'optimistic');
          return;
        }

        await serverCall();
        isInFlight.current = false;
        // Invalidate methods cache to reflect server state
        queryClient.invalidateQueries({ queryKey: profileKeys.paymentMethods() });
        addBreadcrumb('Payment method selected optimistically (confirmed)', 'optimistic');
      } catch (error) {
        isInFlight.current = false;
        // Revert on failure
        if (previousMethod.current) {
          store.selectMethod(previousMethod.current);
        } else {
          store.clearMethod();
        }
        addBreadcrumb('Payment method selection reverted', 'optimistic');
        throw error;
      }
    },
    [store, queryClient]
  );

  return { selectMethodOptimistic };
}

// ==============================================
// OPTIMISTIC PROFILE UPDATE
// ==============================================

/**
 * Hook for optimistic profile updates.
 *
 * Immediately updates the profile store form fields, then calls the server.
 * Reverts to previous values if the server call fails.
 *
 * Usage:
 *   const { updateProfileOptimistic } = useOptimisticProfile();
 *   updateProfileOptimistic(
 *     { fullName: 'New Name' },
 *     async () => { await updateProfile({ fullName: 'New Name' }); }
 *   );
 */
export function useOptimisticProfile() {
  const store = useProfileStore();
  const queryClient = useQueryClient();
  const previousForm = useRef({ ...store.form });

  const updateProfileOptimistic = useCallback(
    async (
      fields: { fullName?: string; email?: string },
      serverCall: () => Promise<void>
    ) => {
      // Save previous state
      previousForm.current = { ...store.form };

      // Optimistic update
      store.updateForm(fields);

      try {
        const { isConnected } = getNetworkStatus();

        if (!isConnected) {
          queueMutation('update-profile', serverCall, false);
          addBreadcrumb('Profile updated optimistically (offline)', 'optimistic');
          return;
        }

        await serverCall();
        // Invalidate dashboard to reflect changes everywhere
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        addBreadcrumb('Profile updated optimistically (confirmed)', 'optimistic');
      } catch (error) {
        // Revert on failure
        store.updateForm({
          fullName: previousForm.current.fullName,
          email: previousForm.current.email,
        });
        addBreadcrumb('Profile update reverted', 'optimistic');
        throw error;
      }
    },
    [store, queryClient]
  );

  return { updateProfileOptimistic };
}

// ==============================================
// OPTIMISTIC NOTIFICATION TOGGLE
// ==============================================

/**
 * Hook for optimistic notification preference toggle.
 *
 * Instantly toggles the UI, then calls the server.
 * Reverts on server failure.
 *
 * Usage:
 *   const { toggleNotificationOptimistic } = useOptimisticNotification();
 *   toggleNotificationOptimistic('paymentReminders', async () => {
 *     await updateNotificationPrefs({ paymentReminders: newValue });
 *   });
 */
export function useOptimisticNotification() {
  const store = useProfileStore();
  const previousPrefs = useRef({ ...store.notificationPrefs });

  const toggleNotificationOptimistic = useCallback(
    async (
      key: Parameters<typeof store.toggleNotificationPref>[0],
      serverCall: () => Promise<void>
    ) => {
      // Save previous state
      previousPrefs.current = { ...store.notificationPrefs };

      // Optimistic update
      store.toggleNotificationPref(key);

      try {
        const { isConnected } = getNetworkStatus();

        if (!isConnected) {
          queueMutation(`toggle-notification-${key}`, serverCall, false);
          addBreadcrumb(`Notification ${key} toggled optimistically (offline)`, 'optimistic');
          return;
        }

        await serverCall();
        addBreadcrumb(`Notification ${key} toggled optimistically (confirmed)`, 'optimistic');
      } catch (error) {
        // Revert on failure
        store.setNotificationPrefs(previousPrefs.current);
        addBreadcrumb(`Notification ${key} toggle reverted`, 'optimistic');
        throw error;
      }
    },
    [store]
  );

  return { toggleNotificationOptimistic };
}
