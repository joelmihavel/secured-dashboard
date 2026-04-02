/**
 * Payment Recovery Hook
 *
 * Checks for in-progress payments on app startup.
 * If a recent payment (within 30 min) is found persisted in SecureStore,
 * navigates to the processing screen to resume polling.
 *
 * Phase 4.8: Crash recovery — handles app force-kill during PayU checkout.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { usePaymentStore } from '@/src/stores/payment';

const RECOVERY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export function usePaymentRecovery() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const rootNavigationState = useRootNavigationState();
  const hasChecked = useRef(false);

  useEffect(() => {
    // Guard: don't navigate until the Root Layout's Stack is mounted
    if (!rootNavigationState?.key) return;

    const checkRecovery = () => {
      if (hasChecked.current) return;
      hasChecked.current = true;

      const { lastPaymentId, lastPaymentTimestamp, clearLastPayment } =
        usePaymentStore.getState();

      if (!lastPaymentId || !lastPaymentTimestamp) return;

      const elapsed = Date.now() - lastPaymentTimestamp;
      if (elapsed > RECOVERY_WINDOW_MS) {
        clearLastPayment();
        return;
      }

      // Check if payment already reached terminal state before resuming
      // (handles case where app was killed after success but before persist completed)
      const checkAndRecover = async () => {
        try {
          const { callEdgeFunction } = await import('@/src/services/supabase/client');
          const { data } = await callEdgeFunction<{ data: { status: string } }>(
            `check-payment-status?payment_id=${lastPaymentId}`, {}, true, 'GET'
          );
          const serverStatus = data?.data?.status;
          if (serverStatus === 'success' || serverStatus === 'failed' || serverStatus === 'refunded') {
            // Already terminal — don't show status screen again
            clearLastPayment();
            return;
          }
        } catch {
          // Network error — fall through to recovery screen
        }
        // Still in progress — resume polling on status screen
        routerRef.current.replace({
          pathname: '/(payment)/status',
          params: { paymentId: lastPaymentId, initialStatus: 'pending' },
        } as never);
      };
      checkAndRecover();
    };

    // Wait for Zustand persist middleware to hydrate from SecureStore
    if (usePaymentStore.persist.hasHydrated()) {
      checkRecovery();
    } else {
      const unsub = usePaymentStore.persist.onFinishHydration(checkRecovery);
      return unsub;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNavigationState?.key]);
}
