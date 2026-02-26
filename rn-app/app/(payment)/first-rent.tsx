import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { PaymentMethodModal } from '@/src/components/payment/PaymentMethodModal';
import { useDashboard } from '@/src/hooks';

export default function FirstRentPaymentScreen() {
  const router = useRouter();
  const { tenancy, upcomingPayment } = useDashboard();

  const handleProceedToTransaction = useCallback(() => {
    // Navigate straight to the confirm transparent modal
    router.replace('/(payment)/confirm');
  }, [router]);

  const date = new Date();
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const rentMonthText = upcomingPayment?.rent_month 
    ? upcomingPayment.rent_month.toUpperCase() 
    : `${monthNames[date.getMonth()]} ${date.getFullYear()} RENT`;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <PaymentMethodModal
        visible={true}
        onClose={() => router.back()}
        tenancyId={tenancy?.id ?? ''}
        rentMonth={upcomingPayment?.rent_month ?? rentMonthText}
        onProceed={handleProceedToTransaction}
      />
    </View>
  );
}
