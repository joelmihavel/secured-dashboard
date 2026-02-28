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
import { captureError } from '@/src/config/sentry';

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
      // Flag prevents outer finally from double-clearing sensitive data for UPI background flow
      let upiBackgroundLaunched = false;

      try {
        const sessionParams = usePaymentStore.getState().payuSessionParams;
        if (!sessionParams) {
          return { status: 'failure', error: 'Payment session expired. Please try again.' };
        }

        // UPI Collect: navigate immediately — SDK waits up to 6 min with no webview
        if (paymentMode === 'upi') {
          upiBackgroundLaunched = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLastPayment(paymentId);

          router.replace({
            pathname: '/(payment)/status',
            params: {
              paymentId,
              amount: sessionParams.amount,
              method: 'upi',
              initialStatus: 'pending',
            },
          } as never);

          // Fire SDK in background — don't await
          // Cleanup (onClearSensitiveData, clearPayuSessionParams, isExecutingRef)
          // is handled in .finally() below, NOT the outer finally block.
          launchCorePayment(paymentMode, sessionParams, instrumentParams)
            .then((outcome) => {
              if (__DEV__) {
                console.log('[usePaymentFlow] UPI background SDK outcome:', outcome.status);
              }
              if (outcome.status === 'success' && outcome.payuResponse?.field7) {
                addUpiVpa(String(outcome.payuResponse.field7)).catch(() => {});
              }
              queryClient.invalidateQueries({ queryKey: ['saved-payment-methods'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            })
            .catch((err) => {
              captureError(
                err instanceof Error ? err : new Error(String(err)),
                { flow: 'upi_background_sdk', paymentId },
              );
            })
            .finally(() => {
              onClearSensitiveData();
              clearPayuSessionParams();
              isExecutingRef.current = false;
            });

          return { status: 'navigating' };
        }

        // Card / NB flows: await SDK outcome before navigating
        const outcome: CorePaymentOutcome = await launchCorePayment(
          paymentMode,
          sessionParams,
          instrumentParams,
        );

        switch (outcome.status) {
          case 'success': {
            // Payment succeeded at SDK level — navigate to status IMMEDIATELY
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLastPayment(paymentId);

            // Navigate first — don't block on method save or cache invalidation
            router.replace({
              pathname: '/(payment)/status',
              params: {
                paymentId,
                amount: sessionParams.amount,
                method: paymentMode === 'NB' ? 'netbanking' : paymentMode === 'upi' ? 'upi' : 'card',
                initialStatus: 'pending',
              },
            } as never);

            // Fire-and-forget: save payment method + invalidate cache in background
            // Server-side webhook also saves, so this is a fallback for faster UX
            const payuResponse = outcome.payuResponse ?? {};
            (async () => {
              try {
                if ((paymentMode === 'CC' || paymentMode === 'DC') && payuResponse.store_card_token) {
                  await addCardToken({
                    card_token: String(payuResponse.store_card_token),
                    card_last4: String(payuResponse.card_no ?? '').slice(-4),
                    card_network: (String(payuResponse.bankcode ?? '').toLowerCase()) as 'visa' | 'mastercard' | 'rupay' | 'amex' | 'maestro',
                    card_type: paymentMode === 'CC' ? 'credit' : 'debit',
                    ...(Number(payuResponse.card_expiry_month) ? { card_expiry_month: Number(payuResponse.card_expiry_month) } : {}),
                    ...(Number(payuResponse.card_expiry_year) ? { card_expiry_year: Number(payuResponse.card_expiry_year) } : {}),
                  });
                } else if (paymentMode === 'upi' && payuResponse.field7) {
                  await addUpiVpa(String(payuResponse.field7));
                }
              } catch (saveErr) {
                console.warn('Client-side payment method save failed (webhook will retry):', saveErr);
                captureError(
                  saveErr instanceof Error ? saveErr : new Error(String(saveErr)),
                  { flow: 'payment_method_save', paymentMode }
                );
              }
              queryClient.invalidateQueries({ queryKey: ['saved-payment-methods'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            })();

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
        captureError(
          err instanceof Error ? err : new Error(String(err)),
          { flow: 'payment_execution', paymentMode, paymentId }
        );
        return {
          status: 'failure',
          error: err instanceof Error ? err.message : 'Payment error',
        };
      } finally {
        // S2: Zero sensitive data immediately
        // Skip for UPI background flow — its .finally() handles cleanup after SDK completes
        if (!upiBackgroundLaunched) {
          onClearSensitiveData();
          clearPayuSessionParams();
          isExecutingRef.current = false;
        }
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
