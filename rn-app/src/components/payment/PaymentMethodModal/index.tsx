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

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
} from 'react-native';

import { usePaymentStore } from '@/src/stores';
import { useDashboard } from '@/src/hooks';
import { initiatePayment } from '@/src/services/payment';
import { sanitizeErrorForUI } from '@/src/services/api/payments';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { BottomSheet } from '@/src/components/ui';

import type { ModalView, PaymentMethodType, PaymentMethodModalProps } from './types';
import { EnterAmountContent } from './EnterAmountContent';
import { MethodSelectorContent } from './MethodSelectorContent';
import { AddUpiContent } from './AddUpiContent';
import { AddCardContent } from './AddCardContent';
import { AddNetbankingContent } from './AddNetbankingContent';
import { EditMethodContent } from './EditMethodContent';

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
    onClose();
  }, [clearPayuSessionParams, onClose, initialView]);

  // --- Back handler: from add-method -> selector; from selector -> close ---
  const handleBack = useCallback(() => {
    if (modalView !== 'selector') {
      clearPayuSessionParams();
      setPaymentId('');
      setModalView('selector');
    } else {
      handleClose();
    }
  }, [modalView, clearPayuSessionParams, handleClose]);

  const handleAmountProceed = useCallback((amount: number) => {
    usePaymentStore.getState().setAmount(amount);
    setModalView('selector');
  }, []);

  const handleEdit = useCallback((methodType: PaymentMethodType, savedMethodId: string) => {
    setEditMethodType(methodType);
    setEditSavedMethodId(savedMethodId);
    setModalView('edit-method');
  }, []);

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

  // --- Proceed from method selector: initiate payment + navigate to add-method ---
  const handleProceed = useCallback(
    async (methodType: PaymentMethodType) => {
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

        if (onProceed) {
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);
          onProceed(methodType);
        } else {
          // Store PayU session params + processing state in Zustand
          if (data.payuParams) {
            const p = data.payuParams as Record<string, string>;
            setPayuSessionParams({
              key: p.key,
              txnid: p.txnid,
              amount: p.amount,
              productinfo: p.productinfo,
              firstname: p.firstname,
              email: p.email,
              phone: p.phone,
              surl: p.surl,
              furl: p.furl,
              hash: p.hash,
              vas_hash: p.vas_for_mobile_sdk_hash,
              prd_hash: p.payment_related_details_for_mobile_sdk_hash,
              user_credential: p.user_credential ?? `${p.key}:${p.email}`,
              udf1: p.udf1,
              udf2: p.udf2,
              udf3: p.udf3,
              udf4: p.udf4,
              udf5: p.udf5,
              enforce_paymethod: p.enforce_paymethod,
            });
          }
          setProcessing(data.paymentId);
          setLastPayment(data.paymentId);

          // Set paymentId and switch to the add-method view
          setPaymentId(data.paymentId);
          const viewMap: Record<PaymentMethodType, ModalView> = {
            upi: 'add-upi',
            card: 'add-card',
            debit_card: 'add-debit-card',
            netbanking: 'add-netbanking',
          };
          setModalView(viewMap[methodType]);
        }
      } catch (err) {
        console.error('PaymentMethodModal initiate error:', err);
        const rawMessage = err instanceof Error ? err.message : 'An error occurred';
        const errorMessage = sanitizeErrorForUI(rawMessage);
        Alert.alert('Payment Error', errorMessage);
      } finally {
        setIsInitiating(false);
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
    ],
  );

  return (
    <BottomSheet visible={visible} onClose={handleClose} paddingHorizontal={0}>
      <View style={styles.sheetPanel}>
        {modalView === 'enter-amount' && (
          <EnterAmountContent
            initialAmount={tenancy?.monthly_rent ?? 0}
            onProceed={handleAmountProceed}
            onBack={handleClose}
          />
        )}
        {modalView === 'selector' && (
          <MethodSelectorContent
            onProceed={handleProceed}
            onEdit={handleEdit}
            isInitiating={isInitiating}
          />
        )}
        {modalView === 'add-upi' && (
          <AddUpiContent paymentId={paymentId} onBack={handleBack} />
        )}
        {modalView === 'add-card' && (
          <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="credit" />
        )}
        {modalView === 'add-debit-card' && (
          <AddCardContent paymentId={paymentId} onBack={handleBack} cardType="debit" />
        )}
        {modalView === 'add-netbanking' && (
          <AddNetbankingContent paymentId={paymentId} onBack={handleBack} />
        )}
        {modalView === 'edit-method' && editMethodType && (
          <EditMethodContent
            methodType={editMethodType}
            savedMethodId={editSavedMethodId}
            onBack={handleBack}
            onProceed={handleProceed}
            onDeleteSuccess={handleDeleteSuccess}
            isInitiating={isInitiating}
          />
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
