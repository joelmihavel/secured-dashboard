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
import { useRouter } from 'expo-router';
import { usePaymentStore } from '@/src/stores/payment';

const RECOVERY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export function usePaymentRecovery() {
  const router = useRouter();
  const hasChecked = useRef(false);

  useEffect(() => {
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

      // Recent payment in progress — resume polling on processing screen
      router.replace({
        pathname: '/(payment)/processing',
        params: { paymentId: lastPaymentId },
      } as never);
    };

    // Wait for Zustand persist middleware to hydrate from SecureStore
    if (usePaymentStore.persist.hasHydrated()) {
      checkRecovery();
    } else {
      const unsub = usePaymentStore.persist.onFinishHydration(checkRecovery);
      return unsub;
    }
  }, [router]);
}
