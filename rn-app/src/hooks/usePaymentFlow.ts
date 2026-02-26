/**
 * usePaymentFlow — Shared payment orchestration hook
 *
 * Extracts Core SDK payment execution from instrument screens (card, NB, UPI)
 * to prevent duplication. Handles:
 * - Double-submit guard (ref-based)
 * - SDK launch via CBWrapper Mode B
 * - Outcome normalization (success → processing, cancel → stay/processing, failure → failed)
 * - Sensitive data clearing callback
 */

import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';

import { usePaymentStore } from '@/src/stores';
import {
  launchCorePayment,
  type CorePaymentMode,
  type CorePaymentOutcome,
  type InstrumentParams,
} from '@/src/services/payment/payuCoreService';
import { addCardToken, addUpiVpa } from '@/src/services/api/payments';

export type PaymentFlowOutcome =
  | { status: 'success' | 'navigating' }
  | { status: 'cancelled'; isTxnInitiated: boolean }
  | { status: 'failure'; error: string }
  | { status: 'blocked' };

interface UsePaymentFlowReturn {
  executePayment: (
    paymentMode: CorePaymentMode,
    instrumentParams: InstrumentParams,
    paymentId: string,
    onClearSensitiveData: () => void,
  ) => Promise<PaymentFlowOutcome>;
  isExecuting: boolean;
}

export function usePaymentFlow(): UsePaymentFlowReturn {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isExecutingRef = useRef(false);
  const { setLastPayment, clearPayuSessionParams } = usePaymentStore();

  const executePayment = useCallback(
    async (
      paymentMode: CorePaymentMode,
      instrumentParams: InstrumentParams,
      paymentId: string,
      onClearSensitiveData: () => void,
    ): Promise<PaymentFlowOutcome> => {
      // S7: Double-submit guard
      if (isExecutingRef.current) {
        return { status: 'blocked' };
      }
      isExecutingRef.current = true;

      try {
        const sessionParams = usePaymentStore.getState().payuSessionParams;
        if (!sessionParams) {
          return { status: 'failure', error: 'Payment session expired. Please try again.' };
        }

        // Launch Core SDK
        const outcome: CorePaymentOutcome = await launchCorePayment(
          paymentMode,
          sessionParams,
          instrumentParams,
        );

        switch (outcome.status) {
          case 'success': {
            // Payment succeeded at SDK level — navigate to processing for server verification
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLastPayment(paymentId);

            // Best-effort: save payment method from PayU response
            // Server-side webhook also saves, so this is a fallback for faster UX
            const payuResponse = outcome.payuResponse ?? {};
            try {
              if ((paymentMode === 'CC' || paymentMode === 'DC') && payuResponse.store_card_token) {
                await addCardToken({
                  card_token: String(payuResponse.store_card_token),
                  card_last4: String(payuResponse.card_no ?? '').slice(-4),
                  card_network: (String(payuResponse.bankcode ?? '').toLowerCase()) as 'visa' | 'mastercard' | 'rupay' | 'amex' | 'maestro',
                  card_type: paymentMode === 'CC' ? 'credit' : 'debit',
                  // FIX: BUG-2 — parse expiry from PayU response; omit if unavailable instead of sending 0
                  ...(Number(payuResponse.card_expiry_month) ? { card_expiry_month: Number(payuResponse.card_expiry_month) } : {}),
                  ...(Number(payuResponse.card_expiry_year) ? { card_expiry_year: Number(payuResponse.card_expiry_year) } : {}),
                });
              } else if (paymentMode === 'upi' && payuResponse.field7) {
                await addUpiVpa(String(payuResponse.field7));
              }
              // Netbanking: no client-side save needed — webhook handles it
            } catch (saveErr) {
              // Non-blocking: webhook will handle server-side save
              console.warn('Client-side payment method save failed (webhook will retry):', saveErr);
            }

            // Invalidate React Query cache so home screen reflects saved method
            queryClient.invalidateQueries({ queryKey: ['saved-payment-methods'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });

            router.replace({
              pathname: '/(payment)/status',
              params: {
                paymentId,
                amount: sessionParams.amount,
                method: paymentMode === 'NB' ? 'netbanking' : paymentMode === 'upi' ? 'upi' : 'card',
                initialStatus: 'pending',
              },
            } as never);
            return { status: 'navigating' };
          }

          case 'cancelled':
            if (outcome.isTxnInitiated) {
              // Txn was initiated before cancel — must go to status for verification
              setLastPayment(paymentId);
              router.replace({
                pathname: '/(payment)/status',
                params: {
                  paymentId,
                  amount: sessionParams.amount,
                  method: paymentMode === 'NB' ? 'netbanking' : paymentMode === 'upi' ? 'upi' : 'card',
                  initialStatus: 'pending',
                },
              } as never);
              return { status: 'navigating' };
            }
            // User cancelled before txn — stay on instrument screen
            return { status: 'cancelled', isTxnInitiated: false };

          case 'failure':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            router.replace({
              pathname: '/(payment)/status',
              params: {
                paymentId,
                amount: sessionParams.amount,
                method: paymentMode === 'NB' ? 'netbanking' : paymentMode === 'upi' ? 'upi' : 'card',
                initialStatus: 'failed',
                error: outcome.error ?? 'Payment failed',
              },
            } as never);
            return { status: 'failure', error: outcome.error ?? 'Payment failed' };

          default:
            return { status: 'failure', error: 'Unexpected payment outcome' };
        }
      } catch (err) {
        return {
          status: 'failure',
          error: err instanceof Error ? err.message : 'Payment error',
        };
      } finally {
        // S2: Zero sensitive data immediately
        onClearSensitiveData();
        clearPayuSessionParams();
        isExecutingRef.current = false;
      }
    },
    [router, setLastPayment, clearPayuSessionParams, queryClient],
  );

  return {
    executePayment,
    get isExecuting() {
      return isExecutingRef.current;
    },
  };
}
