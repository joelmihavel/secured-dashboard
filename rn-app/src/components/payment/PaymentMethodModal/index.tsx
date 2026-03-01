/**
 * PaymentMethodModal — Modal Shell / Orchestrator
 *
 * Inline overlay (NOT React Native Modal) for payment method selection
 * and payment execution. Renders as an absolutely-positioned bottom sheet
 * within the initiate.tsx screen.
 *
 * State machine:
 *   selector -> add-upi | add-card | add-netbanking -> (back) -> selector
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
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { usePaymentStore } from '@/src/stores';
import { useDashboard } from '@/src/hooks';
import { initiatePayment, buildSessionParams } from '@/src/services/payment';
import { sanitizeErrorForUI, addUpiVpa, verifyCard } from '@/src/services/api/payments';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { BottomSheet } from '@/src/components/ui';

import { usePaymentFlow } from '@/src/hooks/usePaymentFlow';
import type { ModalView, PaymentMethodType, SavedMethodDetails, PaymentMethodModalProps } from './types';
import { EnterAmountContent } from './EnterAmountContent';
import { MethodSelectorContent } from './MethodSelectorContent';
import { AddUpiContent } from './AddUpiContent';
import { AddCardContent } from './AddCardContent';
import { AddNetbankingContent } from './AddNetbankingContent';
import { EditMethodContent } from './EditMethodContent';
import { EnterCvvContent } from './EnterCvvContent';

export function PaymentMethodModal({
  visible,
  onClose,
  tenancyId,
  rentMonth,
  onProceed,
  initialView = 'enter-amount',
  initialPaymentId,
  initialMethodType,
  initialSavedMethodId,
  context = 'payment',
}: PaymentMethodModalProps) {
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const { tenancy } = useDashboard();
  const [paymentId, setPaymentId] = useState(initialPaymentId ?? '');
  const [isInitiating, setIsInitiating] = useState(false);
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [editMethodType, setEditMethodType] = useState<PaymentMethodType | null>(
    initialMethodType as PaymentMethodType ?? null
  );
  const [editSavedMethodId, setEditSavedMethodId] = useState<string>(initialSavedMethodId ?? '');
  const isProceedingRef = useRef(false);

  // CVV-only flow state
  const [cvvCardToken, setCvvCardToken] = useState('');
  const [cvvCardType, setCvvCardType] = useState<'CC' | 'DC'>('CC');
  const [cvvLastFour, setCvvLastFour] = useState('');
  const [cvvCardNetwork, setCvvCardNetwork] = useState('');

  // Sync paymentId when parent provides a new one (e.g. confirm screen)
  useEffect(() => {
    if (initialPaymentId) setPaymentId(initialPaymentId);
  }, [initialPaymentId]);

  // Sync modalView and edit state when visibility changes
  useEffect(() => {
    if (visible) {
      setModalView(initialView);
      if (initialMethodType) setEditMethodType(initialMethodType as PaymentMethodType);
      if (initialSavedMethodId) setEditSavedMethodId(initialSavedMethodId);
    }
  }, [visible, initialView, initialMethodType, initialSavedMethodId]);

  const { isConnected } = useNetworkStatus();
  const { executePayment } = usePaymentFlow();

  const router = useRouter();
  const {
    setPayuSessionParams,
    clearPayuSessionParams,
    setProcessing,
    setLastPayment,
    setConfirming,
  } = usePaymentStore();

  // --- Close handler: clears session params on EVERY close path ---
  const handleClose = useCallback(() => {
    clearPayuSessionParams();
    setModalView(initialView);
    setPaymentId('');
    setIsInitiating(false);
    isProceedingRef.current = false;
    setCvvCardToken('');
    onClose();
  }, [clearPayuSessionParams, onClose, initialView]);

  // --- Back handler: enter-amount/selector -> close; add-method -> selector ---
  const handleBack = useCallback(() => {
    if (modalView === 'enter-amount' || modalView === 'selector') {
      handleClose();
    } else {
      clearPayuSessionParams();
      setPaymentId('');
      setModalView('selector');
    }
  }, [modalView, clearPayuSessionParams, handleClose]);

  const handleAmountProceed = useCallback((amount: number) => {
    const store = usePaymentStore.getState();
    store.setAmount(amount);
    store.setEnteredAmount(amount);
    if (rentMonth) store.setRentMonth(rentMonth);
    setModalView('selector');
  }, [rentMonth]);

  const handleEdit = useCallback((methodType: PaymentMethodType, savedMethodId: string) => {
    setEditMethodType(methodType);
    setEditSavedMethodId(savedMethodId);
    setModalView('edit-method');
  }, []);

  // --- Setup handler: navigate to add-method view WITHOUT initiating payment ---
  const handleSetup = useCallback((methodType: PaymentMethodType) => {
    const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';
    setCardType(resolvedCardType);
    const viewMap: Record<PaymentMethodType, ModalView> = {
      upi: 'add-upi',
      card: 'add-card',
      debit_card: 'add-debit-card',
      netbanking: 'add-netbanking',
    };
    setModalView(viewMap[methodType]);
  }, []);

  // --- Profile save complete: method saved without rent payment, close modal ---
  const handleSaveComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleClose();
  }, [handleClose]);

  // --- On-demand initiate payment (called by add-method children in setup flow) ---
  const handleInitiateForChild = useCallback(
    async (methodType: PaymentMethodType, instrumentDetails?: { vpa?: string }): Promise<{ paymentId: string } | null> => {
      if (!isConnected) {
        Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
        return null;
      }

      // Profile + Card: Rs.1 verification instead of full rent payment
      if (context === 'profile' && (methodType === 'card' || methodType === 'debit_card')) {
        try {
          const { data, error } = await verifyCard();
          if (error || !data) {
            throw new Error(error ?? 'Failed to initiate card verification');
          }
          setPayuSessionParams(buildSessionParams(data.payu as Record<string, string>));
          setPaymentId(data.payment_id);
          return { paymentId: data.payment_id };
        } catch (err) {
          console.error('PaymentMethodModal verify-card error:', err);
          const rawMessage = err instanceof Error ? err.message : 'An error occurred';
          Alert.alert('Verification Error', sanitizeErrorForUI(rawMessage));
          return null;
        }
      }

      setConfirming();
      const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';

      try {
        const { data, error } = await initiatePayment({
          tenancyId,
          paymentMethod: methodType,
          cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
          rentMonth,
        });

        if (error || !data) {
          throw new Error(error ?? 'Failed to initiate payment');
        }

        // Demo mode: skip PayU SDK — navigate directly to success
        // Do NOT call handleClose() — same reason as handleProceed.
        if (data.demoMode) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);

          // Save payment method for demo users (fire-and-forget)
          if (methodType === 'upi' && instrumentDetails?.vpa) {
            addUpiVpa(instrumentDetails.vpa).catch(() => {});
          }

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

        if (data.payuParams) {
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
    [tenancyId, rentMonth, isConnected, context, router, setConfirming, setProcessing, setLastPayment, setPayuSessionParams],
  );

  // --- Delete success handler: automatically route to setup after deletion ---
  const handleDeleteSuccess = useCallback((methodType: PaymentMethodType) => {
    const viewMap: Record<PaymentMethodType, ModalView> = {
      upi: 'add-upi',
      card: 'add-card',
      debit_card: 'add-debit-card',
      netbanking: 'add-netbanking',
    };
    setModalView(viewMap[methodType]);
  }, []);

  // --- Proceed from method selector: initiate payment + execute or navigate ---
  const handleProceed = useCallback(
    async (methodType: PaymentMethodType, savedDetails?: SavedMethodDetails) => {
      if (isProceedingRef.current) return;
      isProceedingRef.current = true;

      try {
      // Network connectivity check
      if (!isConnected) {
        Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
        return;
      }

      // Enter-rent flow: delegate to parent immediately.
      // The confirm screen handles its own initiatePayment + PayU session.
      // Calling initiatePayment here would create a duplicate payment record
      // AND add 1-3s of API delay before the user sees the confirm screen.
      if (onProceed) {
        onProceed(methodType);
        return;
      }

      setIsInitiating(true);
      setConfirming();

      // Determine card type for CC/DC routing
      const resolvedCardType: 'credit' | 'debit' = methodType === 'debit_card' ? 'debit' : 'credit';
      setCardType(resolvedCardType);

      try {
        const { data, error } = await initiatePayment({
          tenancyId,
          paymentMethod: methodType,
          cardType: (methodType === 'card' || methodType === 'debit_card') ? resolvedCardType : undefined,
          rentMonth,
        });

        if (error || !data) {
          throw new Error(error ?? 'Failed to initiate payment');
        }

        // Demo mode: skip PayU SDK — navigate directly to success
        // Do NOT call handleClose() — it triggers parent's onClose which calls
        // router.back() after 200ms, racing with and overriding this navigation.
        // The router.replace unmounts the parent screen (and this modal) naturally.
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
          return;
        }

        // Self-contained flow: store PayU session params
        if (data.payuParams) {
          setPayuSessionParams(buildSessionParams(data.payuParams as Record<string, string>));
        }
        setProcessing(data.paymentId);
        setLastPayment(data.paymentId);
        setPaymentId(data.paymentId);

        // Saved card with token → CVV-only entry
        if (savedDetails?.cardToken && (methodType === 'card' || methodType === 'debit_card')) {
          setCvvCardToken(savedDetails.cardToken);
          setCvvCardType(savedDetails.cardType ?? (methodType === 'card' ? 'CC' : 'DC'));
          setCvvLastFour(savedDetails.lastFour ?? '');
          setCvvCardNetwork(savedDetails.cardNetwork ?? '');
          setModalView('enter-cvv');
          return;
        }

        // Saved UPI → execute directly with saved VPA
        if (savedDetails?.vpa && methodType === 'upi') {
          const outcome = await executePayment(
            'upi',
            { vpa: savedDetails.vpa },
            data.paymentId,
            () => {},
          );
          if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
            setModalView('selector');
          } else if (outcome.status === 'failure') {
            Alert.alert('Payment Error', outcome.error || 'Unable to process payment. Please try again.');
            setModalView('selector');
          }
          return;
        }

        // Saved Netbanking → execute directly with saved bank code
        if (savedDetails?.bankCode && methodType === 'netbanking') {
          const outcome = await executePayment(
            'NB',
            { bankcode: savedDetails.bankCode },
            data.paymentId,
            () => {},
          );
          if (outcome.status === 'cancelled' || outcome.status === 'blocked') {
            setModalView('selector');
          } else if (outcome.status === 'failure') {
            Alert.alert('Payment Error', outcome.error || 'Unable to process payment. Please try again.');
            setModalView('selector');
          }
          return;
        }

        // Card or no saved details → navigate to add-method form
        const viewMap: Record<PaymentMethodType, ModalView> = {
          upi: 'add-upi',
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
      router,
      executePayment,
      onProceed,
      handleClose,
      setConfirming,
      setProcessing,
      setLastPayment,
      setPayuSessionParams,
    ],
  );

  return (
    <BottomSheet visible={visible} onClose={handleClose} paddingHorizontal={8}>
      <View style={styles.sheetPanel}>
        {modalView === 'enter-amount' && (
          <Animated.View entering={FadeIn.duration(200)} key="enter-amount">
            <EnterAmountContent
              initialAmount={tenancy?.monthly_rent ?? 0}
              onProceed={handleAmountProceed}
              onBack={handleClose}
            />
          </Animated.View>
        )}
        {modalView === 'selector' && (
          <Animated.View entering={FadeIn.duration(200)} key="selector">
            <MethodSelectorContent
              onBack={handleBack}
              onProceed={handleProceed}
              onSetup={handleSetup}
              onEdit={handleEdit}
              isInitiating={isInitiating}
              showEdit={context === 'profile'}
            />
          </Animated.View>
        )}
        {modalView === 'add-upi' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-upi">
            <AddUpiContent paymentId={paymentId} onBack={handleBack} onInitiatePayment={handleInitiateForChild} context={context} onSaveComplete={handleSaveComplete} />
          </Animated.View>
        )}
        {modalView === 'add-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-card">
            <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="credit" onInitiatePayment={handleInitiateForChild} context={context} onSaveComplete={handleSaveComplete} />
          </Animated.View>
        )}
        {modalView === 'add-debit-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-debit">
            <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="debit" onInitiatePayment={handleInitiateForChild} context={context} onSaveComplete={handleSaveComplete} />
          </Animated.View>
        )}
        {modalView === 'add-netbanking' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-nb">
            <AddNetbankingContent paymentId={paymentId} onBack={handleBack} onInitiatePayment={handleInitiateForChild} context={context} onSaveComplete={handleSaveComplete} />
          </Animated.View>
        )}
        {modalView === 'edit-method' && editMethodType && (
          <Animated.View entering={FadeIn.duration(200)} key="edit">
            <EditMethodContent
              methodType={editMethodType}
              savedMethodId={editSavedMethodId}
              onBack={handleBack}
              onProceed={handleProceed}
              onDeleteSuccess={handleDeleteSuccess}
              isInitiating={isInitiating}
              context={context}
            />
          </Animated.View>
        )}
        {modalView === 'enter-cvv' && (
          <Animated.View entering={FadeIn.duration(200)} key="enter-cvv">
            <EnterCvvContent
              paymentId={paymentId}
              onBack={handleBack}
              cardToken={cvvCardToken}
              cardType={cvvCardType}
              lastFour={cvvLastFour}
              cardNetwork={cvvCardNetwork}
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
  },
});
