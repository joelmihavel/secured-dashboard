/**
 * Enter Rent Amount Screen
 *
 * Thin wrapper that opens the PaymentMethodModal with initialView="enter-amount"
 * as a bottom sheet overlay. The actual UI lives in EnterAmountContent.tsx.
 *
 * Route: /(payment)/enter-rent
 * Flow: enter-amount → selector → add-method → confirm
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useDashboard } from '@/src/hooks';
import { usePaymentStore } from '@/src/stores/payment';
import { colors } from '@/src/theme';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';

export default function EnterRentScreen() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const { tenancy, upcomingPayment } = useDashboard();
  const setSelectedInstrument = usePaymentStore((s) => s.setSelectedInstrument);
  const setEnteredAmount = usePaymentStore((s) => s.setEnteredAmount);
  const setRentMonth = usePaymentStore((s) => s.setRentMonth);

  const rentMonth = upcomingPayment?.rent_month
    ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Open modal immediately — the BottomSheet handles its own animation
  useEffect(() => {
    setShowModal(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    // Small delay so the sheet dismiss animation completes before navigating
    setTimeout(() => router.back(), 200);
  }, [router]);

  const handleMethodSelected = useCallback((methodType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedInstrument({ type: methodType as any });
    setShowModal(false);
    router.push('/(payment)/confirm' as never);
  }, [setSelectedInstrument, router]);

  return (
    <View style={styles.container} testID="enter-rent-screen">
      <PaymentMethodModal
        visible={showModal}
        onClose={handleClose}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={rentMonth}
        onProceed={handleMethodSelected}
        initialView="enter-amount"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
