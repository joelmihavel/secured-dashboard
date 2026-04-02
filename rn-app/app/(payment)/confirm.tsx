/**
 * Confirm Payment Screen — Redirect Wrapper
 *
 * The confirm-payment flow now lives inside the PaymentMethodModal bottom sheet
 * (ConfirmPaymentContent.tsx). This route is kept as a redirect for:
 * - Deep links (/payment) that may still reference this path
 * - Any cached push notification payloads
 *
 * Redirects to enter-rent which opens the PaymentMethodModal flow.
 */

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/(payment)/enter-rent');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#131313' }} />;
}
