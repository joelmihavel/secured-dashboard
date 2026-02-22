/**
 * PayU Checkout Pro Service
 *
 * Integrates with PayU's React Native SDK (payu-non-seam-less-react) for native checkout.
 * Uses Supabase edge functions for secure hash generation (server-side).
 *
 * Payment flow:
 * 1. Client calls initiate-payment edge function to get PayU params + pre-computed hashes
 * 2. Client launches PayU SDK Checkout Pro (native overlay)
 * 3. SDK fires generateHash events -> client forwards to generate-payu-hash edge function
 * 4. SDK fires onPaymentSuccess/onPaymentFailure/onPaymentCancel events
 * 5. PayU sends webhook to payment-webhook edge function (S2S)
 * 6. Client navigates to processing screen and polls payment status
 */

import { Alert, NativeEventEmitter, DeviceEventEmitter, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { callEdgeFunction } from '../supabase';

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
  // SDK-specific fields from initiate-payment response
  user_credential?: string;
  vas_for_mobile_sdk_hash?: string;
  payment_related_details_for_mobile_sdk_hash?: string;
}

export interface PayUCheckoutResult {
  status: 'success' | 'failure' | 'cancelled';
  txnid?: string;
  payuResponse?: Record<string, unknown>;
  error?: string;
  isTxnInitiated?: boolean;
}

export interface InitiatePaymentParams {
  tenancyId: string;
  paymentMethod: 'upi' | 'card' | 'netbanking';
  applyCashback: boolean;
  rentMonth: string;
  checkoutMode?: 'sdk' | 'seamless';
}

// ==============================================
// CONFIGURATION
// ==============================================

const PAYU_MERCHANT_KEY = process.env.EXPO_PUBLIC_PAYU_KEY;

// S7: No fallback key. Crash if missing in production.
if (!PAYU_MERCHANT_KEY && !__DEV__) {
  throw new Error(
    'FATAL: EXPO_PUBLIC_PAYU_KEY environment variable is not set. ' +
    'Cannot run payment system without merchant key.'
  );
}

// ==============================================
// SDK LOADING
// ==============================================

interface PayUBizSdkModule {
  openCheckoutScreen: (config: Record<string, unknown>) => void;
  hashGenerated: (hashMap: Record<string, string>) => void;
}

// Try to get PayU SDK - will be null in Expo Go
let PayUBizSdk: PayUBizSdkModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PayUBizSdk = require('payu-non-seam-less-react').default;
} catch {
  // SDK not available (expected in Expo Go)
  PayUBizSdk = null;
}

// Platform-specific event emitter (CRITICAL)
// Android PayU module does NOT export addListener/removeListeners required by NativeEventEmitter
// iOS module extends RCTEventEmitter which does support it
function getEmitter() {
  if (Platform.OS === 'ios' && PayUBizSdk) {
    return new NativeEventEmitter(PayUBizSdk as unknown as Parameters<typeof NativeEventEmitter>[0]);
  }
  return DeviceEventEmitter;
}

// ==============================================
// CONCURRENCY GUARD (S18 client-side)
// ==============================================

let isCheckoutActive = false;

// ==============================================
// SERVICE FUNCTIONS
// ==============================================

/**
 * Initialize PayU payment by getting hash + params from server
 */
export async function initiatePayUPayment(
  params: InitiatePaymentParams
): Promise<{ data: { paymentId: string; payuParams: PayUPaymentParams } | null; error: string | null }> {
  const { data, error } = await callEdgeFunction<{
    success: boolean;
    data: {
      payment_id: string;
      txn_id: string;
      total_amount_paise: number;
      payu: PayUPaymentParams;
    };
  }>('initiate-payment', {
    tenancy_id: params.tenancyId,
    payment_method: params.paymentMethod,
    apply_cashback: params.applyCashback,
    rent_month: params.rentMonth,
    checkout_mode: params.checkoutMode ?? 'sdk',
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
 * Launch PayU Checkout Pro SDK
 *
 * Registers event listeners INSIDE this function, BEFORE calling openCheckoutScreen.
 * Cleans up ALL listeners when the Promise resolves.
 * Uses platform-specific event emitter (NativeEventEmitter for iOS, DeviceEventEmitter for Android).
 */
export async function launchPayUCheckout(
  paymentId: string,
  payuParams: PayUPaymentParams
): Promise<PayUCheckoutResult> {
  // S4: Production safety guard
  if (!PayUBizSdk) {
    if (__DEV__) {
      console.warn('PayU SDK not available in Expo Go - using mock checkout');
      Alert.alert(
        'Demo Mode',
        'PayU SDK not available in Expo Go. Using simulated payment.',
        [{ text: 'Continue' }]
      );
      return mockPayUCheckout(payuParams);
    }
    // S4: In production, throw if SDK unavailable
    throw new Error('PayU SDK not available. Please update the app.');
  }

  // S18: Concurrency guard
  if (isCheckoutActive) {
    throw new Error('Checkout already in progress');
  }
  isCheckoutActive = true;

  const emitter = getEmitter();

  return new Promise<PayUCheckoutResult>((resolve) => {
    const subscriptions: EmitterSubscription[] = [];

    const cleanup = () => {
      subscriptions.forEach(s => s.remove());
      isCheckoutActive = false;
    };

    // generateHash delegate (S17 - SECURE: sends payment_id + hash_name, NOT raw hashString)
    subscriptions.push(
      emitter.addListener('generateHash', async (event: { hashName: string; hashString?: string }) => {
        try {
          const { data } = await callEdgeFunction<{ success: boolean; data: { hash: string } }>(
            'generate-payu-hash',
            {
              payment_id: paymentId,  // From closure - NOT from SDK event
              hash_name: event.hashName,
            },
            true
          );

          if (data?.data?.hash) {
            PayUBizSdk!.hashGenerated({ [event.hashName]: data.data.hash });
          } else {
            // Hash generation failed - cannot proceed
            cleanup();
            resolve({ status: 'failure', error: 'Hash generation failed' });
          }
        } catch (err) {
          console.error('Hash generation error:', err);
          cleanup();
          resolve({ status: 'failure', error: 'Hash generation failed' });
        }
      })
    );

    // Success handler
    subscriptions.push(
      emitter.addListener('onPaymentSuccess', (event: Record<string, unknown>) => {
        const parsed = parseEventPayload(event);
        cleanup();
        resolve({
          status: 'success',
          txnid: String(parsed.txnid ?? ''),
          payuResponse: parsed,
        });
      })
    );

    // Failure handler
    subscriptions.push(
      emitter.addListener('onPaymentFailure', (event: Record<string, unknown>) => {
        const parsed = parseEventPayload(event);
        cleanup();
        resolve({
          status: 'failure',
          txnid: String(parsed.txnid ?? ''),
          payuResponse: parsed,
          error: String(parsed.error_Message ?? parsed.error ?? 'Payment failed'),
        });
      })
    );

    // Cancel handler (with Android isTxnInitiated typo fix)
    subscriptions.push(
      emitter.addListener('onPaymentCancel', (event: Record<string, unknown>) => {
        // Android SDK bug: field is 'ixTxnInitiated' (typo). iOS sends 'isTxnInitiated'.
        const isTxnInitiated = Boolean(
          event.isTxnInitiated ?? event.ixTxnInitiated ?? false
        );
        cleanup();
        resolve({
          status: 'cancelled',
          isTxnInitiated,
        });
      })
    );

    // Error handler
    subscriptions.push(
      emitter.addListener('onError', (event: Record<string, unknown>) => {
        cleanup();
        resolve({
          status: 'failure',
          error: String(event.error ?? event.message ?? 'PayU SDK error'),
        });
      })
    );

    // Build checkout config and launch
    // openCheckoutScreen takes ONE argument (single dict), NOT 5 callback args
    const checkoutConfig = {
      payUPaymentParams: {
        key: payuParams.key,
        transactionId: payuParams.txnid,
        amount: payuParams.amount,
        productInfo: payuParams.productinfo,
        firstName: payuParams.firstname,
        email: payuParams.email,
        phone: payuParams.phone,
        ios_surl: payuParams.surl,
        ios_furl: payuParams.furl,
        android_surl: payuParams.surl,
        android_furl: payuParams.furl,
        // Environment: "0" = Production, "1" = Sandbox (confirmed from PayU docs)
        environment: __DEV__ ? '1' : '0',
        userCredential: payuParams.user_credential ?? `${payuParams.key}:${payuParams.email}`,
        udf1: payuParams.udf1 ?? '',
        udf2: payuParams.udf2 ?? '',
        udf3: payuParams.udf3 ?? '',
        udf4: payuParams.udf4 ?? '',
        udf5: payuParams.udf5 ?? '',
        additionalParam: {
          payment_related_details_for_mobile_sdk: payuParams.payment_related_details_for_mobile_sdk_hash ?? '',
          vas_for_mobile_sdk: payuParams.vas_for_mobile_sdk_hash ?? '',
        },
      },
      payUCheckoutProConfig: {
        primaryColor: '#FF9A6D',
        secondaryColor: '#131313',
        merchantName: 'Flent Secured',
        showExitConfirmationOnCheckoutScreen: true,
        showExitConfirmationOnPaymentScreen: true,
        merchantResponseTimeout: 25000,
        surePayCount: 1,
      },
    };

    try {
      PayUBizSdk!.openCheckoutScreen(checkoutConfig);
    } catch (err) {
      cleanup();
      resolve({
        status: 'failure',
        error: err instanceof Error ? err.message : 'Failed to open checkout',
      });
    }
  });
}

// ==============================================
// PLATFORM-SPECIFIC PAYLOAD PARSING
// ==============================================

/**
 * Parse Android/iOS event payloads.
 * Android sends merchantResponse and payuResponse as JSON strings.
 * iOS sends objects directly.
 */
function parseEventPayload(event: Record<string, unknown>): Record<string, unknown> {
  try {
    // Try payuResponse first
    const response = event.payuResponse ?? event.merchantResponse ?? event;
    if (typeof response === 'string') {
      return JSON.parse(response);
    }
    return response as Record<string, unknown>;
  } catch {
    return event;
  }
}

// ==============================================
// MOCK CHECKOUT (Development Only)
// ==============================================

const MOCK_SUCCESS_RATE = 0.9;
const DEFAULT_MOCK_DELAY_MS = 2000;

/**
 * Mock PayU checkout for development/testing.
 * WARNING: This is NOT a real payment - for development only.
 */
export async function mockPayUCheckout(
  payuParams: PayUPaymentParams,
  simulatedDelay = DEFAULT_MOCK_DELAY_MS
): Promise<PayUCheckoutResult> {
  if (__DEV__) {
    console.warn('Using MOCK PayU checkout - not a real payment');
  }

  await new Promise((resolve) => setTimeout(resolve, simulatedDelay));

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

// ==============================================
// PAYMENT STATUS POLLING
// ==============================================

/**
 * Verify payment status by polling the payments table directly.
 * The payment-webhook edge function updates status server-side.
 */
export async function verifyPaymentStatus(
  paymentId: string
): Promise<{ status: 'success' | 'failure' | 'pending'; error?: string }> {
  try {
    // Import supabase lazily to avoid circular deps
    const { supabase } = await import('../supabase');

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
    } else if (['failed', 'refunded', 'expired'].includes(paymentStatus)) {
      return { status: 'failure' };
    } else {
      return { status: 'pending' };
    }
  } catch (error) {
    return {
      status: 'pending',
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
