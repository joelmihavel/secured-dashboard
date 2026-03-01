/**
 * Enter Rent Amount Screen
 *
 * Thin wrapper that opens the PaymentMethodModal with initialView="enter-amount"
 * as a bottom sheet overlay. The modal handles the entire payment flow internally:
 *   enter-amount → selector → add-method → "Save & Pay ₹X" → PayU SDK → status
 *
 * Route: /(payment)/enter-rent
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { useDashboard } from '@/src/hooks';
import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';

export default function EnterRentScreen() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const { tenancy, upcomingPayment } = useDashboard();

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

  return (
    <View style={styles.container} testID="enter-rent-screen">
      <PaymentMethodModal
        visible={showModal}
        onClose={handleClose}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={rentMonth}
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
