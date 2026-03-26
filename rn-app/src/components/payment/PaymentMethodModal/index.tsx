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
import { initiatePayment, buildSessionParams } from '@/src/services/payment';
import { sanitizeErrorForUI } from '@/src/services/api/payments';
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
        Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
        return null;
      }

      setConfirming();
      const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';

      // Read the user-entered amount from the store (rupees → paise)
      const storeEnteredAmount = usePaymentStore.getState().enteredAmount;
      const amountPaise = storeEnteredAmount > 0 ? Math.round(storeEnteredAmount * 100) : undefined;

      try {
        const { data, error } = await initiatePayment({
          tenancyId,
          paymentMethod: methodType,
          cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
          rentMonth,
          amountPaise,
        });

        if (error || !data) {
          throw new Error(error ?? 'Failed to initiate payment');
        }

        // Demo mode: skip PayU SDK — navigate directly to success
        if (data.demoMode) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);

          router.replace({
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
    [tenancyId, rentMonth, isConnected, router, setConfirming, setProcessing, setLastPayment, setPayuSessionParams, setCashfreeSession],
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
        if (!result) return; // demo mode handled navigation
        currentPaymentId = result.paymentId;
      }

      // Demo mode: payment already recorded as success — navigate to status
      if (isDemoRef.current && currentPaymentId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        pendingInstrumentRef.current = null;
        isDemoRef.current = false;
        router.replace({
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
      if (storeState.cashfreeSessionId && storeState.cfOrderId) {
        // Cashfree path
        const outcome = await executeCashfreePayment(
          pending.methodType as 'upi' | 'card' | 'debit_card' | 'netbanking',
          currentPaymentId,
          storeState.cashfreeSessionId,
          storeState.cfOrderId,
        );

        if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          setModalView('selector');
        } else if (outcome.status === 'failure') {
          pendingInstrumentRef.current = null;
          setPaymentId('');
          Alert.alert('Payment Error', outcome.error || 'Unable to process payment.');
          setModalView('selector');
        }
        // success/navigating: executeCashfreePayment navigates to status screen
      } else {
        // Existing PayU path
        if (!storeState.payuSessionParams) {
          Alert.alert('Session Error', 'Payment session expired. Please go back and try again.');
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
          Alert.alert('Payment Error', outcome.error || 'Unable to process payment.');
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
          Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
          return;
        }

        setIsInitiating(true);
        setConfirming();

        // Determine card type for CC/DC routing
        const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';
        setCardType(resolvedCardType);

        // UPI: no form needed — go straight to confirm screen
        // Payment will be initiated when user taps "Pay" on confirm screen
        if (methodType === 'upi') {
          pendingInstrumentRef.current = {
            methodType: 'upi',
            corePaymentMode: 'upi',
            params: {},
            methodLabel: 'UPI',
          };
          setModalView('confirm-payment');
          setIsInitiating(false);
          return;
        }

        try {
          // Read the user-entered amount from the store (rupees → paise)
          const storeEnteredAmount = usePaymentStore.getState().enteredAmount;
          const amountPaise = storeEnteredAmount > 0 ? Math.round(storeEnteredAmount * 100) : undefined;

          const { data, error } = await initiatePayment({
            tenancyId,
            paymentMethod: methodType,
            cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
            rentMonth,
            amountPaise,
          });

          if (error || !data) {
            throw new Error(error ?? 'Failed to initiate payment');
          }

          // Demo mode: route through confirm screen so Apple reviewers see the full flow
          if (data.demoMode) {
            setProcessing(data.paymentId);
            setLastPayment(data.paymentId);
            setPaymentId(data.paymentId);
            isDemoRef.current = true;

            const methodLabel = methodType === 'card' ? 'Credit Card'
              : methodType === 'debit_card' ? 'Debit Card'
              : methodType === 'netbanking' ? 'Net Banking'
              : methodType;

            pendingInstrumentRef.current = {
              methodType,
              corePaymentMode: methodType,
              params: {},
              methodLabel,
            };
            setModalView('confirm-payment');
            return;
          }

          // Store gateway-specific session data
          if (data.cashfreeSessionId && data.cfOrderId) {
            setCashfreeSession(data.cashfreeSessionId, data.cfOrderId);
          } else if (data.payuParams) {
            setPayuSessionParams(buildSessionParams(data.payuParams as Record<string, string>));
          }
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);
          setPaymentId(data.paymentId);

          // Navigate to add-method form
          const viewMap: Record<Exclude<PaymentMethodType, 'upi'>, ModalView> = {
            card: 'add-card',
            debit_card: 'add-debit-card',
            netbanking: 'add-netbanking',
          };
          setModalView(viewMap[methodType]);
        } catch (err) {
          console.error('PaymentMethodModal initiate error:', err);
          const rawMessage = err instanceof Error ? err.message : 'An error occurred';
          const errorMessage = sanitizeErrorForUI(rawMessage);
          Alert.alert('Payment Error', errorMessage);
        } finally {
          setIsInitiating(false);
        }
      } finally {
        isProceedingRef.current = false;
      }
    },
    [
      tenancyId,
      rentMonth,
      isConnected,
      setConfirming,
      setProcessing,
      setLastPayment,
      setPayuSessionParams,
      setCashfreeSession,
    ],
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
