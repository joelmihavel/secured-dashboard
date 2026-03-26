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

import { useCallback, useRef, useState } from 'react';
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
import {
  setupCallbacks as setupCashfreeCallbacks,
  removeCallbacks as removeCashfreeCallbacks,
  launchCardPayment,
  launchUPIIntent,
  isCashfreeAvailable,
} from '@/src/services/payment/cashfreeService';
import { callEdgeFunction } from '@/src/services/supabase';
import * as WebBrowser from 'expo-web-browser';
import { addCardToken, addUpiVpa, saveBankPreference } from '@/src/services/api/payments';
import { paymentKeys } from '@/src/hooks/usePayments';
import { dashboardKeys } from '@/src/hooks/useDashboard';
import { profileKeys } from '@/src/hooks/useProfile';
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
  executeCashfreePayment: (
    paymentMethod: 'upi' | 'card' | 'debit_card' | 'netbanking',
    paymentId: string,
    cashfreeSessionId: string,
    cfOrderId: string,
    upiVpa?: string,
    bankCode?: string,
  ) => Promise<PaymentFlowOutcome>;
  isExecuting: boolean;
}

export function usePaymentFlow(): UsePaymentFlowReturn {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);
  // Ref mirrors state for synchronous guard checks inside the async callback
  const isExecutingRef = useRef(false);
  const { setLastPayment, clearPayuSessionParams, clearCashfreeSession } = usePaymentStore();

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
      setIsExecuting(true);
      try {
        const sessionParams = usePaymentStore.getState().payuSessionParams;
        if (!sessionParams) {
          return { status: 'failure', error: 'Payment session expired. Please try again.' };
        }

        // All flows (Card / NB / UPI): await SDK outcome before navigating.
        // PayU Custom Browser handles UPI waiting UX (shows "waiting for approval"
        // screen for Collect mode). No need to pre-navigate — user can press back
        // in the browser to cancel and try another payment method.
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
            // Server-side webhook is the primary save path; client save adds token for faster UX
            const payuResponse = outcome.payuResponse ?? {};
            console.log('[PaymentFlow] PayU response keys:', Object.keys(payuResponse).join(', '));
            if (paymentMode === 'CC' || paymentMode === 'DC') {
              console.log('[PaymentFlow] Card response: store_card_token=', payuResponse.store_card_token ? 'present' : 'MISSING',
                'card_no=', payuResponse.card_no ? 'present' : 'MISSING',
                'card_last4=', payuResponse.card_last4 ?? 'MISSING',
                'bankcode=', payuResponse.bankcode);
            }
            (async () => {
              try {
                if ((paymentMode === 'CC' || paymentMode === 'DC') && payuResponse.store_card_token) {
                  // Map PayU bankcode to card network — PayU returns codes like VISA, MAST, RUPAY, AMEX, MAES
                  const bankcodeToNetwork: Record<string, 'visa' | 'mastercard' | 'rupay' | 'amex' | 'maestro'> = {
                    visa: 'visa', mast: 'mastercard', mastercard: 'mastercard',
                    rupay: 'rupay', amex: 'amex', maes: 'maestro', maestro: 'maestro',
                    dinr: 'mastercard', jcb: 'mastercard', // fallbacks — JCB/Diners processed via Mastercard in India
                  };
                  const rawBankcode = String(payuResponse.bankcode ?? '').toLowerCase();
                  const cardNetwork = bankcodeToNetwork[rawBankcode] ?? 'visa';

                  await addCardToken({
                    card_token: String(payuResponse.store_card_token),
                    card_last4: String(payuResponse.card_no ?? '').slice(-4),
                    card_network: cardNetwork,
                    card_type: paymentMode === 'CC' ? 'credit' : 'debit',
                    ...(Number(payuResponse.card_expiry_month) ? { card_expiry_month: Number(payuResponse.card_expiry_month) } : {}),
                    ...(Number(payuResponse.card_expiry_year) ? { card_expiry_year: Number(payuResponse.card_expiry_year) } : {}),
                  });
                } else if (paymentMode === 'upi') {
                  const pf3 = payuResponse.field3 && String(payuResponse.field3).includes('@') ? String(payuResponse.field3) : null;
                  const pf7 = payuResponse.field7 && String(payuResponse.field7).includes('@') ? String(payuResponse.field7) : null;
                  const vpa = pf3 ?? pf7
                    ?? ('vpa' in instrumentParams ? String((instrumentParams as { vpa: string }).vpa) : null);
                  if (vpa) await addUpiVpa(vpa);
                } else if (paymentMode === 'NB') {
                  const bankcode = payuResponse.bankcode
                    ? String(payuResponse.bankcode)
                    : ('bankcode' in instrumentParams ? String((instrumentParams as { bankcode: string }).bankcode) : null);
                  if (bankcode) {
                    await saveBankPreference(bankcode, bankcode);
                  }
                }
              } catch (saveErr) {
                console.warn('Client-side payment method save failed (webhook will retry):', saveErr);
                captureError(
                  saveErr instanceof Error ? saveErr : new Error(String(saveErr)),
                  { flow: 'payment_method_save', paymentMode }
                );
              }
              queryClient.invalidateQueries({ queryKey: profileKeys.paymentMethods() });
              queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
        onClearSensitiveData();
        clearPayuSessionParams();
        isExecutingRef.current = false;
        setIsExecuting(false);
      }
    },
    [router, setLastPayment, clearPayuSessionParams, queryClient],
  );

  const executeCashfreePayment = useCallback(
    async (
      paymentMethod: 'upi' | 'card' | 'debit_card' | 'netbanking',
      paymentId: string,
      cashfreeSessionId: string,
      cfOrderId: string,
      upiVpa?: string,
      bankCode?: string,
    ): Promise<PaymentFlowOutcome> => {
      if (isExecutingRef.current) {
        return { status: 'blocked' };
      }

      // SDK availability check — matches PayU pattern in launchCorePayment
      if ((paymentMethod === 'card' || paymentMethod === 'debit_card' || paymentMethod === 'upi') && !isCashfreeAvailable()) {
        console.error('[Cashfree] SDK not available for', paymentMethod);
        return { status: 'failure', error: 'Cashfree SDK not available. Please update the app.' };
      }

      isExecutingRef.current = true;
      setIsExecuting(true);

      try {
        if (paymentMethod === 'card' || paymentMethod === 'debit_card') {
          // Card: Launch Cashfree Drop Checkout SDK
          return new Promise<PaymentFlowOutcome>((resolve) => {
            setupCashfreeCallbacks(
              (orderId) => {
                // onVerify — navigate to status screen (webhook determines final state)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setLastPayment(paymentId);
                router.replace({
                  pathname: '/(payment)/status',
                  params: { paymentId, method: 'card', initialStatus: 'pending' },
                } as never);
                resolve({ status: 'navigating' });
              },
              (_error, orderId) => {
                // onError — STILL navigate to status (SDK is not authoritative)
                setLastPayment(paymentId);
                router.replace({
                  pathname: '/(payment)/status',
                  params: { paymentId, method: 'card', initialStatus: 'pending' },
                } as never);
                resolve({ status: 'navigating' });
              },
            );
            launchCardPayment(cashfreeSessionId, cfOrderId);
          });
        } else if (paymentMethod === 'upi' && !upiVpa) {
          // UPI Intent: Launch Cashfree UPI Intent SDK
          return new Promise<PaymentFlowOutcome>((resolve) => {
            setupCashfreeCallbacks(
              (orderId) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setLastPayment(paymentId);
                router.replace({
                  pathname: '/(payment)/status',
                  params: { paymentId, method: 'upi', initialStatus: 'pending' },
                } as never);
                resolve({ status: 'navigating' });
              },
              (_error, orderId) => {
                setLastPayment(paymentId);
                router.replace({
                  pathname: '/(payment)/status',
                  params: { paymentId, method: 'upi', initialStatus: 'pending' },
                } as never);
                resolve({ status: 'navigating' });
              },
            );
            launchUPIIntent(cashfreeSessionId, cfOrderId);
          });
        } else if (paymentMethod === 'upi' && upiVpa) {
          // UPI Collect: API-driven via cashfree-pay-order
          const { data: payData, error: payError } = await callEdgeFunction<{
            success: boolean;
            data: { action: string };
          }>('cashfree-pay-order', {
            payment_session_id: cashfreeSessionId,
            cf_order_id: cfOrderId,
            payment_method: { upi: { channel: 'collect', upi_id: upiVpa } },
          }, true);

          if (payError) {
            return { status: 'failure', error: payError };
          }

          // Navigate to status screen — poll for result
          setLastPayment(paymentId);
          router.replace({
            pathname: '/(payment)/status',
            params: { paymentId, method: 'upi', initialStatus: 'pending' },
          } as never);
          return { status: 'navigating' };
        } else if (paymentMethod === 'netbanking') {
          // Net Banking: API-driven -> redirect URL
          const { data: payData, error: payError } = await callEdgeFunction<{
            success: boolean;
            data: { action: string; data?: { url?: string } };
          }>('cashfree-pay-order', {
            payment_session_id: cashfreeSessionId,
            cf_order_id: cfOrderId,
            payment_method: { netbanking: { channel: 'link', netbanking_bank_code: bankCode ?? 3003 } },
          }, true);

          if (payError || !payData?.data?.data?.url) {
            return { status: 'failure', error: payError ?? 'No redirect URL received' };
          }

          // Open bank login in InAppBrowser
          await WebBrowser.openBrowserAsync(payData.data.data.url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          });

          // After browser closes, navigate to status screen
          setLastPayment(paymentId);
          router.replace({
            pathname: '/(payment)/status',
            params: { paymentId, method: 'netbanking', initialStatus: 'pending' },
          } as never);
          return { status: 'navigating' };
        }

        return { status: 'failure', error: 'Unknown payment method' };
      } catch (err) {
        captureError(
          err instanceof Error ? err : new Error(String(err)),
          { flow: 'cashfree_payment', paymentMethod, paymentId }
        );
        return {
          status: 'failure',
          error: err instanceof Error ? err.message : 'Payment error',
        };
      } finally {
        removeCashfreeCallbacks();
        clearCashfreeSession();
        isExecutingRef.current = false;
        setIsExecuting(false);
      }
    },
    [router, setLastPayment, clearCashfreeSession, queryClient],
  );

  return {
    executePayment,
    executeCashfreePayment,
    isExecuting,
  };
}
