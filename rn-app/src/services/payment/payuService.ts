/**
 * PayU Checkout Pro Service
 *
 * Integrates with PayU's React Native SDK for native checkout experience.
 * Uses Supabase edge function for hash generation (server-side).
 *
 * Payment flow:
 * 1. Client calls initiate-payment edge function to get PayU hash + params
 * 2. Client launches PayU SDK (or mock in Expo Go)
 * 3. PayU sends webhook to payment-webhook edge function (S2S)
 * 4. Client polls payment status from Supabase payments table
 *
 * Note: There is no "verify-payment" or "payment-callback" edge function.
 * The webhook handles status updates server-side; the client polls the
 * payments table directly for status.
 */

import { Alert } from 'react-native';
import { callEdgeFunction } from '../supabase';
import { supabase } from '../supabase';

// ==============================================
// TYPES
// ==============================================

export interface PayUConfig {
  environment: 'sandbox' | 'production';
  merchantKey: string;
}

export interface PayUPaymentParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  hash: string;
  surl: string;
  furl: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface PayUCheckoutResult {
  status: 'success' | 'failure' | 'cancelled';
  txnid?: string;
  payuResponse?: Record<string, string>;
  error?: string;
}

export interface InitiatePaymentParams {
  tenancyId: string;
  amountPaise: number;
  paymentMethod: 'upi' | 'card' | 'netbanking';
  applyCashback: boolean;
  rentMonth: string;
}

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_CONFIG: PayUConfig = {
  environment: __DEV__ ? 'sandbox' : 'production',
  merchantKey: process.env.EXPO_PUBLIC_PAYU_KEY ?? 'PLycrf',
};

// PayU SDK colors
const PAYU_THEME = {
  primaryColor: '#FF9A6D',
  secondaryColor: '#131313',
};

// ==============================================
// SERVICE FUNCTIONS
// ==============================================

/**
 * Initialize PayU payment by getting hash from server
 */
export async function initiatePayUPayment(
  params: InitiatePaymentParams
): Promise<{ data: { paymentId: string; payuParams: PayUPaymentParams } | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      txn_id: string;
      amount_paise: number;
      payu: PayUPaymentParams;
    };
  }>('initiate-payment', {
    tenancy_id: params.tenancyId,
    amount_paise: params.amountPaise,
    payment_method: params.paymentMethod,
    apply_cashback: params.applyCashback,
    rent_month: params.rentMonth,
  }, true);

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data.data) {
    return { data: null, error: 'Failed to initiate payment' };
  }

  return {
    data: {
      paymentId: data.data.payment_id,
      payuParams: data.data.payu,
    },
    error: null,
  };
}

/**
 * PayU SDK Interface (for when the native module is available)
 */
interface PayUBizSdkInterface {
  openCheckoutScreen: (
    config: Record<string, unknown>,
    theme: Record<string, string>,
    onSuccess: (response: Record<string, string>) => void,
    onFailure: (response: Record<string, string>) => void,
    onCancel: () => void
  ) => void;
}

// Try to get PayU SDK - will be null in Expo Go
let PayUBizSdk: PayUBizSdkInterface | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PayUBizSdk = require('react-native-payu-checkout-pro').default;
} catch {
  // SDK not available (expected in Expo Go)
  PayUBizSdk = null;
}

/**
 * Launch PayU Checkout Pro SDK
 *
 * Note: This requires react-native-payu-checkout-pro package.
 * For Expo managed workflow, you need to use development builds.
 */
export async function launchPayUCheckout(
  payuParams: PayUPaymentParams
): Promise<PayUCheckoutResult> {
  if (!PayUBizSdk) {
    if (__DEV__) {
      console.warn('PayU SDK not available in Expo Go - using mock checkout');
      // Show alert to make it obvious to developers/testers
      Alert.alert(
        'Demo Mode',
        'PayU SDK not available in Expo Go. Using simulated payment.',
        [{ text: 'Continue' }]
      );
    }
    return mockPayUCheckout(payuParams);
  }

  try {
    const payUCheckoutProConfig = {
      ...payuParams,
      environment: PAYU_CONFIG.environment === 'sandbox' ? 0 : 1, // 0 for sandbox, 1 for production
      merchantName: 'Flent Secured',
      showExitConfirmationOnCheckoutScreen: true,
      showExitConfirmationOnPaymentScreen: true,
      surePayCount: 0,
    };

    // PayU theme customization
    const payUThemeConfig = {
      primaryColor: PAYU_THEME.primaryColor,
      secondaryColor: PAYU_THEME.secondaryColor,
    };

    return new Promise((resolve) => {
      PayUBizSdk!.openCheckoutScreen(
        payUCheckoutProConfig,
        payUThemeConfig,
        (response: Record<string, string>) => {
          // Success callback
          resolve({
            status: 'success',
            txnid: response.txnid,
            payuResponse: response,
          });
        },
        (response: Record<string, string>) => {
          // Failure callback
          resolve({
            status: 'failure',
            txnid: response.txnid,
            payuResponse: response,
            error: response.error_Message || 'Payment failed',
          });
        },
        () => {
          // Cancel callback
          resolve({
            status: 'cancelled',
          });
        }
      );
    });
  } catch (error) {
    // If SDK throws, return error
    if (__DEV__) {
      console.warn('PayU SDK error:', error);
    }
    return {
      status: 'failure',
      error: 'PayU SDK error. Using mock payment.',
    };
  }
}

// Mock checkout configuration
const MOCK_SUCCESS_RATE = 0.9; // 90% success rate for simulated payments
const DEFAULT_MOCK_DELAY_MS = 2000;

/**
 * Mock PayU checkout for development/testing
 * Used when PayU SDK is not available (Expo Go)
 *
 * WARNING: This is NOT a real payment - for development only
 */
export async function mockPayUCheckout(
  payuParams: PayUPaymentParams,
  simulatedDelay = DEFAULT_MOCK_DELAY_MS
): Promise<PayUCheckoutResult> {
  // Show warning in development to make mock checkout obvious
  if (__DEV__) {
    console.warn('Using MOCK PayU checkout - not a real payment');
  }

  // Add artificial delay to simulate real checkout experience
  await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

  // Use named constant instead of magic number
  const isSuccess = Math.random() < MOCK_SUCCESS_RATE;

  if (isSuccess) {
    return {
      status: 'success',
      txnid: payuParams.txnid,
      payuResponse: {
        status: 'success',
        txnid: payuParams.txnid,
        amount: payuParams.amount,
        mode: 'DC',
        bankcode: 'HDFC',
      },
    };
  } else {
    return {
      status: 'failure',
      txnid: payuParams.txnid,
      error: 'Payment declined by bank',
    };
  }
}

/**
 * Verify payment status by polling the payments table directly.
 *
 * The payment-webhook edge function (S2S from PayU) updates the payments table.
 * The client polls this table to detect when the status changes from "initiated"/"processing"
 * to a terminal state ("success", "failed", "refunded").
 *
 * NOTE: There is no "verify-payment" edge function. The webhook handles this server-side.
 */
export async function verifyPaymentStatus(
  paymentId: string
): Promise<{ status: 'success' | 'failure' | 'pending'; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('status')
      .eq('id', paymentId)
      .single();

    if (error) {
      return { status: 'pending', error: error.message };
    }

    if (!data) {
      return { status: 'pending', error: 'Payment not found' };
    }

    const paymentStatus = data.status as string;

    if (paymentStatus === 'success') {
      return { status: 'success' };
    } else if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
      return { status: 'failure' };
    } else {
      // initiated, processing, pending -- still in progress
      return { status: 'pending' };
    }
  } catch (error) {
    return {
      status: 'pending',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Update payment status after PayU SDK callback.
 *
 * NOTE: In the real flow, PayU sends a server-to-server webhook to the
 * payment-webhook edge function, which handles the official status update.
 *
 * This client-side function is a fallback for when the PayU SDK returns
 * before the webhook fires. It records the client-side PayU response
 * as metadata on the payment record so we have a record of what the
 * SDK reported. The actual status update comes from the webhook.
 *
 * This updates the payment_method_details JSONB column, NOT the status column.
 */
export async function updatePaymentStatus(
  paymentId: string,
  payuResponse: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only store the client-side SDK response as metadata.
    // The webhook is the authoritative source for status changes.
    const { error } = await supabase
      .from('payments')
      .update({
        payment_method_details: {
          client_sdk_response: payuResponse,
          client_reported_status: payuResponse.status,
          client_reported_at: new Date().toISOString(),
        },
      })
      .eq('id', paymentId);

    if (error) {
      // Non-critical: webhook will handle the real update
      if (__DEV__) {
        console.warn('Failed to store client SDK response:', error.message);
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
