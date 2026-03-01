/**
 * EditPaymentMethodModal — Profile-only modal for editing/replacing payment methods
 *
 * Separated from PaymentMethodModal for route isolation.
 * This modal handles ONLY profile context: edit → replace → add-method → save → close.
 *
 * No enter-amount, no selector, no confirm-payment, no enter-cvv.
 * Card replacement uses ₹1 verification via verifyCard API.
 * UPI/NB replacement saves directly without payment.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { usePaymentStore } from '@/src/stores';
import { useDeletePaymentMethod } from '@/src/hooks';
import { buildSessionParams } from '@/src/services/payment';
import { sanitizeErrorForUI, verifyCard } from '@/src/services/api/payments';
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus';
import { BottomSheet } from '@/src/components/ui';

import type { PaymentMethodType } from './types';
import { EditMethodContent } from './EditMethodContent';
import { AddUpiContent } from './AddUpiContent';
import { AddCardContent } from './AddCardContent';
import { AddNetbankingContent } from './AddNetbankingContent';

// ==============================================
// TYPES
// ==============================================

type EditView = 'edit-method' | 'add-upi' | 'add-card' | 'add-debit-card' | 'add-netbanking';

export interface EditPaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  tenancyId: string;
  methodType: PaymentMethodType;
  savedMethodId: string;
}

// ==============================================
// COMPONENT
// ==============================================

export function EditPaymentMethodModal({
  visible,
  onClose,
  tenancyId,
  methodType,
  savedMethodId,
}: EditPaymentMethodModalProps) {
  const [editView, setEditView] = useState<EditView>('edit-method');
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [pendingDeleteMethodId, setPendingDeleteMethodId] = useState('');
  const [paymentId, setPaymentId] = useState('');

  const { mutateAsync: deleteOldMethod } = useDeletePaymentMethod();
  const { isConnected } = useNetworkStatus();
  const { setPayuSessionParams, clearPayuSessionParams } = usePaymentStore();

  // Reset to edit-method when modal opens
  useEffect(() => {
    if (visible) {
      setEditView('edit-method');
      setPaymentId('');
      setPendingDeleteMethodId('');
    }
  }, [visible]);

  // --- Close: reset all state, return to profile ---
  const handleClose = useCallback(() => {
    clearPayuSessionParams();
    setEditView('edit-method');
    setPaymentId('');
    setPendingDeleteMethodId('');
    onClose();
  }, [clearPayuSessionParams, onClose]);

  // --- Back: edit-method → close (profile); add-method → edit-method ---
  const handleBack = useCallback(() => {
    if (editView === 'edit-method') {
      handleClose();
    } else {
      clearPayuSessionParams();
      setPaymentId('');
      setEditView('edit-method');
    }
  }, [editView, clearPayuSessionParams, handleClose]);

  // --- Replace: defer delete of old method, navigate to add-method ---
  const handleReplace = useCallback((replaceMethodType: PaymentMethodType) => {
    setPendingDeleteMethodId(savedMethodId);
    const resolvedCardType: 'credit' | 'debit' = replaceMethodType === 'debit_card' ? 'debit' : 'credit';
    setCardType(resolvedCardType);
    const viewMap: Record<PaymentMethodType, EditView> = {
      upi: 'add-upi',
      card: 'add-card',
      debit_card: 'add-debit-card',
      netbanking: 'add-netbanking',
    };
    setEditView(viewMap[replaceMethodType]);
  }, [savedMethodId]);

  // --- Save complete: fire-and-forget delete old method, show Alert immediately ---
  const handleSaveComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (pendingDeleteMethodId) {
      deleteOldMethod(pendingDeleteMethodId).catch((e) =>
        console.warn('[EditPaymentMethodModal] Deferred delete failed:', e)
      );
      setPendingDeleteMethodId('');
    }
    Alert.alert('Payment Method Updated', 'Your payment method has been saved successfully.', [
      { text: 'OK', onPress: handleClose },
    ]);
  }, [handleClose, pendingDeleteMethodId, deleteOldMethod]);

  // --- Initiate for card ₹1 verification only ---
  const handleInitiateForChild = useCallback(
    async (childMethodType: PaymentMethodType): Promise<{ paymentId: string } | null> => {
      if (!isConnected) {
        Alert.alert('No Connection', "You're offline. Please check your connection and try again.");
        return null;
      }

      if (childMethodType === 'card' || childMethodType === 'debit_card') {
        try {
          const { data, error } = await verifyCard();
          if (error || !data) {
            throw new Error(error ?? 'Failed to initiate card verification');
          }
          setPayuSessionParams(buildSessionParams(data.payu as Record<string, string>));
          setPaymentId(data.payment_id);
          return { paymentId: data.payment_id };
        } catch (err) {
          console.error('[EditPaymentMethodModal] verify-card error:', err);
          const rawMessage = err instanceof Error ? err.message : 'An error occurred';
          Alert.alert('Verification Error', sanitizeErrorForUI(rawMessage));
          return null;
        }
      }

      // UPI/NB don't need payment initiation for profile save
      return null;
    },
    [isConnected, setPayuSessionParams],
  );

  return (
    <BottomSheet visible={visible} onClose={handleClose} paddingHorizontal={8} onBackPress={handleBack}>
      <View style={styles.sheetPanel}>
        {editView === 'edit-method' && (
          <Animated.View entering={FadeIn.duration(200)} key="edit" style={styles.viewContent}>
            <EditMethodContent
              methodType={methodType}
              savedMethodId={savedMethodId}
              onBack={handleBack}
              onProceed={() => {}}
              onDeleteSuccess={handleReplace}
              isInitiating={false}
              context="profile"
            />
          </Animated.View>
        )}
        {editView === 'add-upi' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-upi" style={styles.viewContent}>
            <AddUpiContent
              paymentId=""
              onBack={handleBack}
              context="profile"
              onSaveComplete={handleSaveComplete}
            />
          </Animated.View>
        )}
        {editView === 'add-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-card" style={styles.viewContent}>
            <AddCardContent
              paymentId={paymentId}
              onBack={handleBack}
              cardType="credit"
              onInitiatePayment={handleInitiateForChild}
              context="profile"
              onSaveComplete={handleSaveComplete}
            />
          </Animated.View>
        )}
        {editView === 'add-debit-card' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-debit" style={styles.viewContent}>
            <AddCardContent
              paymentId={paymentId}
              onBack={handleBack}
              cardType="debit"
              onInitiatePayment={handleInitiateForChild}
              context="profile"
              onSaveComplete={handleSaveComplete}
            />
          </Animated.View>
        )}
        {editView === 'add-netbanking' && (
          <Animated.View entering={FadeIn.duration(200)} key="add-nb" style={styles.viewContent}>
            <AddNetbankingContent
              paymentId=""
              onBack={handleBack}
              context="profile"
              onSaveComplete={handleSaveComplete}
            />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

// ==============================================
// STYLES
// ==============================================

const styles = StyleSheet.create({
  sheetPanel: {
    width: '100%',
    flexShrink: 1,
  },
  viewContent: {
    flexShrink: 1,
  },
});
