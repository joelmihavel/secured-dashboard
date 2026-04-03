/**
 * PaymentMethodModal — Rent Payment Orchestrator
 *
 * Inline overlay (NOT React Native Modal) for rent payment method selection
 * and payment execution. Renders as an absolutely-positioned bottom sheet
 * within the enter-rent.tsx screen.
 *
 * State machine:
 *   enter-amount → selector → [add-card | add-debit-card | add-netbanking | confirm-payment] → PayU SDK
 *
 * UPI skips the form entirely — goes straight from selector to confirm-payment,
 * then PayU Custom Browser opens with enforce_paymethod=upi (user picks UPI app there).
 *
 * Critical behaviors:
 * - Conditional rendering (NOT display:none) ensures SecureCardInput refs
 *   are destroyed when switching views.
 * - clearPayuSessionParams() on EVERY close path (backdrop, back, Android back).
 * - Fresh initiatePayment() call when user proceeds from method selector.
 * - sessionParams from Zustand (single source of truth).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { usePaymentStore } from '@/src/stores';
import { useDashboard } from '@/src/hooks';
import { initiatePayment, buildSessionParams, getPaymentGateway } from '@/src/services/payment';
import { sanitizeErrorForUI, abandonPayment } from '@/src/services/api/payments';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { BottomSheet } from '@/src/components/ui';

import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import type { CorePaymentMode, InstrumentParams } from '@/src/services/payment/payuCoreService';
import type { ModalView, PaymentMethodType, PaymentMethodModalProps } from './types';
import { EnterAmountContent } from './EnterAmountContent';
import { MethodSelectorContent } from './MethodSelectorContent';
import { AddCardContent } from './AddCardContent';
import { AddNetbankingContent } from './AddNetbankingContent';
import { ConfirmPaymentContent } from './ConfirmPaymentContent';

export function PaymentMethodModal({
  visible,
  onClose,
  tenancyId,
  rentMonth,
  initialView = 'enter-amount',
  initialPaymentId,
}: PaymentMethodModalProps) {
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const { tenancy } = useDashboard();
  const [paymentId, setPaymentId] = useState(initialPaymentId ?? '');
  const [isInitiating, setIsInitiating] = useState(false);
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const isProceedingRef = useRef(false);
  const isDemoRef = useRef(false);

  // Pending instrument details: stored between add-method and confirm-payment
  const pendingInstrumentRef = useRef<{
    methodType: PaymentMethodType;
    corePaymentMode: string;
    params: Record<string, string>;
    methodLabel: string;
    clearSensitiveData?: () => void;
  } | null>(null);
  const [isConfirmPaying, setIsConfirmPaying] = useState(false);

  // Sync paymentId when parent provides a new one
  useEffect(() => {
    if (initialPaymentId) setPaymentId(initialPaymentId);
  }, [initialPaymentId]);

  // Sync modalView when visibility changes
  useEffect(() => {
    if (visible) {
      setModalView(initialView);
    }
  }, [visible, initialView]);

  const { isConnected } = useNetworkStatus();
  const { executePayment, executeCashfreePayment } = usePaymentFlow();

  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const {
    setPayuSessionParams,
    clearPayuSessionParams,
    setCashfreeSession,
    clearCashfreeSession,
    setProcessing,
    setLastPayment,
    setConfirming,
  } = usePaymentStore();

  // --- Close handler: clears session params on EVERY close path ---
  const handleClose = useCallback(() => {
    clearPayuSessionParams();
    clearCashfreeSession();
    setModalView(initialView);
    setPaymentId('');
    setIsInitiating(false);
    isProceedingRef.current = false;
    isDemoRef.current = false;
    pendingInstrumentRef.current = null;
    onClose();
  }, [clearPayuSessionParams, clearCashfreeSession, onClose, initialView]);

  // --- Back handler: enter-amount/selector -> close; others -> selector ---
  const handleBack = useCallback(() => {
    if (modalView === 'enter-amount' || modalView === 'selector') {
      handleClose();
    } else if (modalView === 'confirm-payment') {
      pendingInstrumentRef.current = null;
      clearPayuSessionParams();
      clearCashfreeSession();
      setPaymentId('');
      setModalView('selector');
    } else {
      // All add-method views go back to selector
      clearPayuSessionParams();
      clearCashfreeSession();
      setPaymentId('');
      setModalView('selector');
    }
  }, [modalView, clearPayuSessionParams, clearCashfreeSession, handleClose]);

  const handleAmountProceed = useCallback((amount: number) => {
    const store = usePaymentStore.getState();
    store.setAmount(amount);
    store.setEnteredAmount(amount);
    if (rentMonth) store.setRentMonth(rentMonth);
    setModalView('selector');
  }, [rentMonth]);

  // --- On-demand initiate payment (called by add-method children in setup flow) ---
  const handleInitiateForChild = useCallback(
    async (methodType: PaymentMethodType): Promise<{ paymentId: string } | null> => {
      if (!isConnected) {
        Alert.alert('No Connection', "You're offline. Please check your connection and try again");
        return null;
      }

      setConfirming();
      const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';

      // Read the user-entered amount from the store (rupees → paise)
      const storeEnteredAmount = usePaymentStore.getState().enteredAmount;
      const amountPaise = storeEnteredAmount > 0 ? Math.round(storeEnteredAmount * 100) : undefined;

      try {
        const { data, error, stuckPaymentId } = await initiatePayment({
          tenancyId,
          paymentMethod: methodType,
          cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
          rentMonth,
          amountPaise,
        });

        // Handle stuck payment: offer to abandon and retry
        if (stuckPaymentId && !data) {
          Alert.alert(
            'Pending Payment',
            'You have a payment still being processed. Cancel it and try again?',
            [
              { text: 'Wait', style: 'cancel' },
              {
                text: 'Cancel & Retry',
                onPress: async () => {
                  try {
                    await abandonPayment(stuckPaymentId);
                  } catch { /* proceed anyway */ }
                  // Retry after abandoning
                  handleInitiateForChild(methodType);
                },
              },
            ],
          );
          return null;
        }

        if (error || !data) {
          throw new Error(error ?? 'Failed to initiate payment');
        }

        // Demo mode: skip PayU SDK — navigate directly to success
        if (data.demoMode) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);

          routerRef.current.replace({
            pathname: '/(payment)/status',
            params: {
              paymentId: data.paymentId,
              amount: String(usePaymentStore.getState().amount || 0),
              method: methodType === 'debit_card' ? 'card' : methodType,
              initialStatus: 'success',
            },
          } as never);
          return null;
        }

        // Store gateway-specific session data
        console.log('[PaymentMethodModal] initiate response:', JSON.stringify({
          paymentId: data.paymentId,
          hasCashfree: !!(data.cashfreeSessionId && data.cfOrderId),
          hasPayu: !!data.payuParams,
          cashfreeSessionId: data.cashfreeSessionId?.slice(0, 20),
          cfOrderId: data.cfOrderId?.slice(0, 20),
          demoMode: data.demoMode,
        }));
        if (data.demoMode) {
          // Demo/test user — payment already marked as success server-side.
          // Navigate directly to status screen (no PG SDK needed).
          setLastPayment(data.paymentId);
          setPaymentId(data.paymentId);
          onClose?.();
          routerRef.current.replace({
            pathname: '/(payment)/status',
            params: { paymentId: data.paymentId, amount: String(data.totalAmountPaise || 0) },
          });
          return { paymentId: data.paymentId };
        }
        if (data.cashfreeSessionId && data.cfOrderId) {
          setCashfreeSession(data.cashfreeSessionId, data.cfOrderId);
        } else if (data.payuParams) {
          setPayuSessionParams(buildSessionParams(data.payuParams as Record<string, string>));
        }
        setProcessing(data.paymentId);
        setLastPayment(data.paymentId);
        setPaymentId(data.paymentId);

        return { paymentId: data.paymentId };
      } catch (err) {
        console.error('PaymentMethodModal initiate error:', err);
        const rawMessage = err instanceof Error ? err.message : 'An error occurred';
        const errorMessage = sanitizeErrorForUI(rawMessage);
        Alert.alert('Payment Error', errorMessage);
        return null;
      }
    },
    [tenancyId, rentMonth, isConnected, setConfirming, setProcessing, setLastPayment, setPayuSessionParams, setCashfreeSession],
  );

  // --- Ready for confirm: instrument details collected, transition to confirm ---
  const handleReadyForConfirm = useCallback((
    methodType: PaymentMethodType,
    corePaymentMode: string,
    params: Record<string, string>,
    methodLabel: string,
    clearFn?: () => void,
  ) => {
    pendingInstrumentRef.current = {
      methodType,
      corePaymentMode,
      params,
      methodLabel,
      clearSensitiveData: clearFn,
    };
    Keyboard.dismiss();
    setModalView('confirm-payment');
  }, []);

  // --- Confirm pay: execute payment from confirm screen ---
  const handleConfirmPay = useCallback(async () => {
    const pending = pendingInstrumentRef.current;
    if (!pending || isConfirmPaying) return;
    setIsConfirmPaying(true);

    try {
      let currentPaymentId = paymentId;

      // Initiate payment if not yet done (UPI, new methods via confirm)
      if (!currentPaymentId) {
        const result = await handleInitiateForChild(pending.methodType);
        if (!result) {
          pendingInstrumentRef.current = null; // clean up before demo navigation
          return;
        }
        currentPaymentId = result.paymentId;
      }

      // Demo mode: payment already recorded as success — navigate to status
      if (isDemoRef.current && currentPaymentId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pendingInstrumentRef.current = null;
        isDemoRef.current = false;
        routerRef.current.replace({
          pathname: '/(payment)/status',
          params: {
            paymentId: currentPaymentId,
            amount: String(usePaymentStore.getState().amount || 0),
            method: pending.methodType === 'debit_card' ? 'card' : pending.methodType,
            initialStatus: 'success',
          },
        } as never);
        return;
      }

      // Check which gateway to use
      const storeState = usePaymentStore.getState();
      const gatewayRoute = (storeState.cashfreeSessionId && storeState.cfOrderId) ? 'CASHFREE' : 'PAYU';
      console.log('[PaymentMethodModal] Gateway decision:', JSON.stringify({
        hasCashfreeSession: !!storeState.cashfreeSessionId,
        hasCfOrderId: !!storeState.cfOrderId,
        hasPayuParams: !!storeState.payuSessionParams,
        route: gatewayRoute,
        paymentId: currentPaymentId,
      }));
      if (storeState.cashfreeSessionId && storeState.cfOrderId) {
        // Cashfree path
        const outcome = await executeCashfreePayment(
          pending.methodType as 'upi' | 'card' | 'debit_card' | 'netbanking',
          currentPaymentId,
          storeState.cashfreeSessionId,
          storeState.cfOrderId,
          undefined, // upiVpa — UPI Intent uses native picker, no VPA needed
          pending.params?.bankcode, // bankCode for netbanking
        );

        if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          setModalView('selector');
        } else if (outcome.status === 'failure') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          Alert.alert('Payment Error', outcome.error || 'Unable to process payment');
          setModalView('selector');
        }
        // success/navigating: executeCashfreePayment navigates to status screen
      } else {
        // Existing PayU path
        if (!storeState.payuSessionParams) {
          Alert.alert('Session Error', 'Payment session expired. Please go back and try again');
          return;
        }

        const outcome = await executePayment(
          pending.corePaymentMode as CorePaymentMode,
          pending.params as unknown as InstrumentParams,
          currentPaymentId,
          () => {
            pending.clearSensitiveData?.();
            pendingInstrumentRef.current = null;
          },
        );

        if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          setModalView('selector');
        } else if (outcome.status === 'failure') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          Alert.alert('Payment Error', outcome.error || 'Unable to process payment');
          setModalView('selector');
        }
        // success/navigating: executePayment navigates to status screen
      }
    } finally {
      setIsConfirmPaying(false);
    }
  }, [paymentId, executePayment, executeCashfreePayment, handleInitiateForChild, isConfirmPaying]);

  // --- Proceed from method selector ---
  // UPI: skip form, go straight to confirm-payment (PayU handles UPI app selection)
  // Card/Debit: navigate to card form
  // Netbanking: navigate to bank selection form
  const handleProceed = useCallback(
    async (methodType: PaymentMethodType) => {
      if (isProceedingRef.current) return;
      isProceedingRef.current = true;

      try {
        // Network connectivity check
        if (!isConnected) {
          Alert.alert('No Connection', "You're offline. Please check your connection and try again");
          return;
        }

        setConfirming();

        // Determine card type for CC/DC routing
        const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';
        setCardType(resolvedCardType);

        const gateway = getPaymentGateway();
        const methodLabel = methodType === 'card' ? 'Credit Card'
          : methodType === 'debit_card' ? 'Debit Card'
          : methodType === 'netbanking' ? 'Net Banking'
          : 'UPI';

        if (gateway === 'cashfree') {
          // Cashfree: all methods go straight to confirm — SDK handles input UI.
          // Payment is initiated when user taps "Pay" on confirm screen.
          pendingInstrumentRef.current = {
            methodType,
            corePaymentMode: methodType,
            params: {},
            methodLabel,
          };
          setModalView('confirm-payment');
          return;
        }

        // PayU: UPI goes to confirm, card/netbanking need form screens first.
        if (methodType === 'upi') {
          pendingInstrumentRef.current = {
            methodType: 'upi',
            corePaymentMode: 'upi',
            params: {},
            methodLabel: 'UPI',
          };
          setModalView('confirm-payment');
          return;
        }

        // PayU card/netbanking: initiate payment early (need session params for form)
        setIsInitiating(true);
        try {
          const storeEnteredAmount = usePaymentStore.getState().enteredAmount;
          const amountPaise = storeEnteredAmount > 0 ? Math.round(storeEnteredAmount * 100) : undefined;

          const { data, error, stuckPaymentId } = await initiatePayment({
            tenancyId,
            paymentMethod: methodType,
            cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
            rentMonth,
            amountPaise,
          });

          // Handle stuck payment: offer to abandon and retry
          if (stuckPaymentId && !data) {
            Alert.alert(
              'Pending Payment',
              'You have a payment still being processed. Cancel it and try again?',
              [
                { text: 'Wait', style: 'cancel' },
                {
                  text: 'Cancel & Retry',
                  onPress: async () => {
                    try {
                      await abandonPayment(stuckPaymentId);
                    } catch { /* proceed anyway */ }
                    handleProceed(methodType);
                  },
                },
              ],
            );
            return;
          }

          if (error || !data) {
            throw new Error(error ?? 'Failed to initiate payment');
          }

          if (data.demoMode) {
            setProcessing(data.paymentId);
            setLastPayment(data.paymentId);
            setPaymentId(data.paymentId);
            isDemoRef.current = true;
            pendingInstrumentRef.current = {
              methodType, corePaymentMode: methodType, params: {}, methodLabel,
            };
            setModalView('confirm-payment');
            return;
          }

          if (data.payuParams) {
            setPayuSessionParams(buildSessionParams(data.payuParams as Record<string, string>));
          }
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);
          setPaymentId(data.paymentId);

          // Navigate to card form or bank selector
          const viewMap: Record<Exclude<PaymentMethodType, 'upi'>, ModalView> = {
            card: 'add-card',
            debit_card: 'add-debit-card',
            netbanking: 'add-netbanking',
          };
          setModalView(viewMap[methodType]);
        } catch (err) {
          console.error('PaymentMethodModal initiate error:', err);
          const rawMessage = err instanceof Error ? err.message : 'An error occurred';
          Alert.alert('Payment Error', sanitizeErrorForUI(rawMessage));
        } finally {
          setIsInitiating(false);
        }
      } finally {
        isProceedingRef.current = false;
      }
    },
    [isConnected, tenancyId, rentMonth, setConfirming, setProcessing, setLastPayment, setPayuSessionParams, setCashfreeSession],
  );

  return (
    <BottomSheet visible={visible} onClose={handleClose} paddingHorizontal={8} onBackPress={handleBack}>
      <View style={styles.sheetPanel}>
        {modalView === 'enter-amount' && (
          <Animated.View entering={FadeIn.duration(200)} key="enter-amount" style={styles.viewContent}>
            <EnterAmountContent
              initialAmount={tenancy?.monthly_rent ?? 0}
              onProceed={handleAmountProceed}
              onBack={handleClose}
            />
          </Animated.View>
        )}
        {modalView === 'selector' && (
          <Animated.View entering={FadeIn.duration(200)} key="selector" style={styles.viewContent}>
            <MethodSelectorContent
              onBack={handleBack}
              onProceed={handleProceed}
              isInitiating={isInitiating}
            />
          </Animated.View>
        )}
        {modalView === 'add-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-card" style={styles.viewContent}>
            <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="credit" onInitiatePayment={handleInitiateForChild} onReadyForConfirm={handleReadyForConfirm} />
          </Animated.View>
        )}
        {modalView === 'add-debit-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-debit" style={styles.viewContent}>
            <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="debit" onInitiatePayment={handleInitiateForChild} onReadyForConfirm={handleReadyForConfirm} />
          </Animated.View>
        )}
        {modalView === 'add-netbanking' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-nb" style={styles.viewContent}>
            <AddNetbankingContent paymentId={paymentId} onBack={handleBack} onInitiatePayment={handleInitiateForChild} onReadyForConfirm={handleReadyForConfirm} />
          </Animated.View>
        )}
        {modalView === 'confirm-payment' && (
          <Animated.View entering={FadeIn.duration(200)} key="confirm-payment" style={styles.viewContent}>
            <ConfirmPaymentContent
              onBack={handleBack}
              onPay={handleConfirmPay}
              isPaying={isConfirmPaying}
              methodType={pendingInstrumentRef.current?.methodType ?? 'upi'}
              methodLabel={pendingInstrumentRef.current?.methodLabel ?? ''}
            />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetPanel: {
    width: '100%',
    flexShrink: 1,
  },
  viewContent: {
    flexShrink: 1,
  },
});
