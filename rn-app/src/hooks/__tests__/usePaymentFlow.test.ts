/**
 * usePaymentFlow — Unit Tests
 *
 * Tests the shared payment orchestration hook that handles:
 * - Double-submit guard (ref-based)
 * - SDK launch via CBWrapper Mode B
 * - Outcome normalization (success/cancel/failure)
 * - Sensitive data clearing in finally block
 * - Client-side payment method saving (card token, UPI VPA)
 * - React Query cache invalidation
 */

import { renderHook, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { usePaymentFlow } from '../usePaymentFlow';
import type { PaymentFlowOutcome } from '../usePaymentFlow';
import { launchCorePayment } from '@/src/services/payment/payuCoreService';
import type { CorePaymentOutcome, InstrumentParams } from '@/src/services/payment/payuCoreService';
import { addCardToken, addUpiVpa } from '@/src/services/api/payments';
import type { PayUSessionParams } from '@/src/stores/payment';

// ============================================================
// MOCKS
// ============================================================

jest.mock('@/src/services/payment/payuCoreService', () => ({
  launchCorePayment: jest.fn(),
}));

jest.mock('@/src/services/api/payments', () => ({
  addCardToken: jest.fn(),
  addUpiVpa: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Extend expo-haptics mock to include notificationAsync + NotificationFeedbackType
// (global setup.ts only mocks impactAsync)
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// Payment store mock — both hook form and getState()
const mockSetLastPayment = jest.fn();
const mockClearPayuSessionParams = jest.fn();
let mockPayuSessionParams: PayUSessionParams | null = null;

jest.mock('@/src/stores', () => ({
  usePaymentStore: Object.assign(
    // The hook call returns actions
    () => ({
      setLastPayment: mockSetLastPayment,
      clearPayuSessionParams: mockClearPayuSessionParams,
    }),
    // Static getState for reading session params
    {
      getState: () => ({
        payuSessionParams: mockPayuSessionParams,
      }),
    },
  ),
}));

// ============================================================
// TYPED MOCK REFERENCES
// ============================================================

const mockLaunchCorePayment = launchCorePayment as jest.MockedFunction<typeof launchCorePayment>;
const mockAddCardToken = addCardToken as jest.MockedFunction<typeof addCardToken>;
const mockAddUpiVpa = addUpiVpa as jest.MockedFunction<typeof addUpiVpa>;
const mockNotificationAsync = Haptics.notificationAsync as jest.MockedFunction<
  typeof Haptics.notificationAsync
>;

// ============================================================
// FIXTURES
// ============================================================

const MOCK_SESSION_PARAMS: PayUSessionParams = {
  key: 'test-key',
  txnid: 'txn-001',
  amount: '15000',
  productinfo: 'Rent Payment',
  firstname: 'Test',
  email: 'test@flent.in',
  phone: '9876543210',
  surl: 'https://test.flent.in/success',
  furl: 'https://test.flent.in/failure',
  hash: 'abc123hash',
  user_credential: 'test-key:test@flent.in',
};

const CARD_INSTRUMENT: InstrumentParams = {
  bankcode: 'CC',
  card_number: '4111111111111111',
  cvv: '123',
  expiry_year: '2028',
  expiry_month: '12',
  name_on_card: 'Test User',
  store_card: '1',
};

const UPI_INSTRUMENT: InstrumentParams = {
  vpa: 'test@upi',
};

const NB_INSTRUMENT: InstrumentParams = {
  bankcode: 'HDFCB',
};

const PAYMENT_ID = 'pay-uuid-001';

// ============================================================
// HELPERS
// ============================================================

function makeSuccessOutcome(
  payuResponse?: Record<string, unknown>,
): CorePaymentOutcome {
  return {
    status: 'success',
    payuResponse: payuResponse ?? {
      status: 'success',
      txnid: 'txn-001',
      amount: '15000',
    },
  };
}

// ============================================================
// TESTS
// ============================================================

describe('usePaymentFlow', () => {
  const onClearSensitiveData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPayuSessionParams = MOCK_SESSION_PARAMS;
    mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome());
    mockAddCardToken.mockResolvedValue({ data: null, error: null });
    mockAddUpiVpa.mockResolvedValue({ data: null, error: null });
  });

  // ----------------------------------------------------------
  // Double-submit guard
  // ----------------------------------------------------------
  describe('double-submit guard', () => {
    it('blocks the second simultaneous call and returns { status: "blocked" }', async () => {
      // Make the first call hang until we resolve it
      let resolveFirst!: (value: CorePaymentOutcome) => void;
      mockLaunchCorePayment.mockReturnValueOnce(
        new Promise<CorePaymentOutcome>((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { result } = renderHook(() => usePaymentFlow());

      let firstResult: PaymentFlowOutcome | undefined;
      let secondResult: PaymentFlowOutcome | undefined;

      // Start first call (will be pending)
      await act(async () => {
        const firstPromise = result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );

        // Second call while first is still in-flight
        secondResult = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );

        // Now resolve the first
        resolveFirst(makeSuccessOutcome());
        firstResult = await firstPromise;
      });

      expect(secondResult).toEqual({ status: 'blocked' });
      expect(firstResult).toEqual({ status: 'navigating' });
      // SDK was launched only once
      expect(mockLaunchCorePayment).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // Missing session params
  // ----------------------------------------------------------
  describe('missing session params', () => {
    it('returns failure when payuSessionParams is null', async () => {
      mockPayuSessionParams = null;

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({
        status: 'failure',
        error: 'Payment session expired. Please try again.',
      });
      expect(mockLaunchCorePayment).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // SDK success: CC/DC flow
  // ----------------------------------------------------------
  describe('SDK success (CC/DC)', () => {
    it('triggers haptic feedback, saves card token, invalidates cache, and navigates', async () => {
      const cardPayuResponse = {
        status: 'success',
        store_card_token: 'tok_abc123',
        card_no: '411111XXXXXX1111',
        bankcode: 'VISA',
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(cardPayuResponse));

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      // 1. Haptic success feedback
      expect(mockNotificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      );

      // 2. setLastPayment called with paymentId
      expect(mockSetLastPayment).toHaveBeenCalledWith(PAYMENT_ID);

      // 3. addCardToken called with correct params
      // Note: card_expiry_month/year are omitted when PayU response lacks them
      expect(mockAddCardToken).toHaveBeenCalledWith({
        card_token: 'tok_abc123',
        card_last4: '1111',
        card_network: 'visa',
        card_type: 'credit',
      });

      // 4. React Query cache invalidated
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['saved-payment-methods'],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['dashboard'],
      });

      // 5. Router navigates to status screen
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: {
          paymentId: PAYMENT_ID,
          amount: '15000',
          method: 'card',
          initialStatus: 'pending',
        },
      });

      // 6. Returns navigating
      expect(outcome).toEqual({ status: 'navigating' });
    });

    it('maps DC mode to card_type "debit"', async () => {
      const dcPayuResponse = {
        store_card_token: 'tok_dc_xyz',
        card_no: '5555XXXXXXXX4444',
        bankcode: 'MAST',
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(dcPayuResponse));

      const dcInstrument: InstrumentParams = {
        bankcode: 'DC',
        card_number: '5555555555554444',
        cvv: '456',
        expiry_year: '2029',
        expiry_month: '06',
        name_on_card: 'Test',
      };

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'DC',
          dcInstrument,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(mockAddCardToken).toHaveBeenCalledWith(
        expect.objectContaining({
          card_type: 'debit',
        }),
      );
    });
  });

  // ----------------------------------------------------------
  // SDK success: UPI flow
  // ----------------------------------------------------------
  describe('SDK success (UPI)', () => {
    it('saves UPI VPA from payuResponse field7', async () => {
      const upiPayuResponse = {
        status: 'success',
        field7: 'user@okhdfcbank',
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(upiPayuResponse));

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'upi',
          UPI_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(mockAddUpiVpa).toHaveBeenCalledWith('user@okhdfcbank');
      expect(mockAddCardToken).not.toHaveBeenCalled();
      expect(outcome).toEqual({ status: 'navigating' });

      // method param is 'upi' for UPI mode
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ method: 'upi' }),
        }),
      );
    });
  });

  // ----------------------------------------------------------
  // SDK success: Netbanking flow
  // ----------------------------------------------------------
  describe('SDK success (NB)', () => {
    it('does not attempt client-side save for netbanking', async () => {
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome({ status: 'success' }));

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'NB',
          NB_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(mockAddCardToken).not.toHaveBeenCalled();
      expect(mockAddUpiVpa).not.toHaveBeenCalled();
      expect(outcome).toEqual({ status: 'navigating' });

      // method param is 'netbanking' for NB mode
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ method: 'netbanking' }),
        }),
      );
    });
  });

  // ----------------------------------------------------------
  // Card token save failure is non-blocking
  // ----------------------------------------------------------
  describe('card token save failure', () => {
    it('still navigates when addCardToken throws (non-blocking)', async () => {
      const cardPayuResponse = {
        store_card_token: 'tok_fail',
        card_no: '411111XXXXXX1111',
        bankcode: 'VISA',
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(cardPayuResponse));
      mockAddCardToken.mockRejectedValueOnce(new Error('Network timeout'));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      // Navigation still happens
      expect(mockReplace).toHaveBeenCalled();
      expect(outcome).toEqual({ status: 'navigating' });

      // Warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        'Client-side payment method save failed (webhook will retry):',
        expect.any(Error),
      );

      warnSpy.mockRestore();
    });
  });

  // ----------------------------------------------------------
  // SDK cancelled (no txn initiated)
  // ----------------------------------------------------------
  describe('SDK cancelled (no txn)', () => {
    it('returns cancelled with isTxnInitiated false', async () => {
      mockLaunchCorePayment.mockResolvedValue({
        status: 'cancelled',
        isTxnInitiated: false,
      });

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({ status: 'cancelled', isTxnInitiated: false });
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockSetLastPayment).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // SDK cancelled (txn initiated)
  // ----------------------------------------------------------
  describe('SDK cancelled (txn initiated)', () => {
    it('navigates to status screen for server verification', async () => {
      mockLaunchCorePayment.mockResolvedValue({
        status: 'cancelled',
        isTxnInitiated: true,
      });

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'upi',
          UPI_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({ status: 'navigating' });
      expect(mockSetLastPayment).toHaveBeenCalledWith(PAYMENT_ID);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: {
          paymentId: PAYMENT_ID,
          amount: '15000',
          method: 'upi',
          initialStatus: 'pending',
        },
      });
    });
  });

  // ----------------------------------------------------------
  // SDK failure
  // ----------------------------------------------------------
  describe('SDK failure', () => {
    it('triggers error haptic and navigates with initialStatus=failed', async () => {
      mockLaunchCorePayment.mockResolvedValue({
        status: 'failure',
        error: 'Insufficient funds',
      });

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'NB',
          NB_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      // Error haptic feedback
      expect(mockNotificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error,
      );

      // Navigate with failed status
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: {
          paymentId: PAYMENT_ID,
          amount: '15000',
          method: 'netbanking',
          initialStatus: 'failed',
          error: 'Insufficient funds',
        },
      });

      expect(outcome).toEqual({
        status: 'failure',
        error: 'Insufficient funds',
      });
    });

    it('falls back to "Payment failed" when error is undefined', async () => {
      mockLaunchCorePayment.mockResolvedValue({
        status: 'failure',
        // no error field
      });

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({
        status: 'failure',
        error: 'Payment failed',
      });
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ error: 'Payment failed' }),
        }),
      );
    });
  });

  // ----------------------------------------------------------
  // SDK exception (thrown error)
  // ----------------------------------------------------------
  describe('SDK exception', () => {
    it('catches thrown Error and returns failure with message', async () => {
      mockLaunchCorePayment.mockRejectedValue(new Error('Native module crash'));

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({
        status: 'failure',
        error: 'Native module crash',
      });
    });

    it('handles non-Error throws with generic message', async () => {
      mockLaunchCorePayment.mockRejectedValue('string error');

      const { result } = renderHook(() => usePaymentFlow());

      let outcome: PaymentFlowOutcome | undefined;
      await act(async () => {
        outcome = await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(outcome).toEqual({
        status: 'failure',
        error: 'Payment error',
      });
    });
  });

  // ----------------------------------------------------------
  // Sensitive data clearing (finally block)
  // ----------------------------------------------------------
  describe('sensitive data clearing', () => {
    it('calls onClearSensitiveData and clearPayuSessionParams on success', async () => {
      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(onClearSensitiveData).toHaveBeenCalledTimes(1);
      expect(mockClearPayuSessionParams).toHaveBeenCalledTimes(1);
    });

    it('calls cleanup even when SDK throws an exception', async () => {
      mockLaunchCorePayment.mockRejectedValue(new Error('Crash'));

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(onClearSensitiveData).toHaveBeenCalledTimes(1);
      expect(mockClearPayuSessionParams).toHaveBeenCalledTimes(1);
    });

    it('calls cleanup when session params are missing (early return)', async () => {
      mockPayuSessionParams = null;

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(onClearSensitiveData).toHaveBeenCalledTimes(1);
      expect(mockClearPayuSessionParams).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // isExecuting ref
  // ----------------------------------------------------------
  describe('isExecuting ref', () => {
    it('resets to false after completion', async () => {
      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(result.current.isExecuting).toBe(false);
    });

    it('resets to false after SDK error', async () => {
      mockLaunchCorePayment.mockRejectedValue(new Error('Crash'));

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(result.current.isExecuting).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // BUG-2 regression: Card token expiry is always 0/0
  // ----------------------------------------------------------
  describe('BUG-2 regression: card expiry handling', () => {
    /**
     * BUG-2 was partially fixed. The hook now conditionally includes
     * card_expiry_month/year only when the PayU SDK response contains
     * truthy numeric values. When the SDK does not return these fields
     * (which is the common case), they are omitted entirely from the
     * addCardToken call.
     *
     * Remaining concern: The PayU success callback typically does NOT
     * include expiry fields, so in practice the saved card will still
     * have no expiry data. The user-entered expiry from instrumentParams
     * is not used as a fallback.
     */
    it('omits card_expiry_month/year when PayU response lacks them', async () => {
      const cardPayuResponse = {
        store_card_token: 'tok_expiry_test',
        card_no: '411111XXXXXX1111',
        bankcode: 'VISA',
        // No card_expiry_month or card_expiry_year
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(cardPayuResponse));

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      // Expiry fields should NOT be present in the call at all
      const callArgs = mockAddCardToken.mock.calls[0]?.[0];
      expect(callArgs).not.toHaveProperty('card_expiry_month');
      expect(callArgs).not.toHaveProperty('card_expiry_year');
    });

    it('includes card_expiry_month/year when PayU response provides them', async () => {
      const cardPayuResponse = {
        store_card_token: 'tok_with_expiry',
        card_no: '411111XXXXXX1111',
        bankcode: 'VISA',
        card_expiry_month: 12,
        card_expiry_year: 2028,
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(cardPayuResponse));

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      expect(mockAddCardToken).toHaveBeenCalledWith(
        expect.objectContaining({
          card_expiry_month: 12,
          card_expiry_year: 2028,
        }),
      );
    });

    it('does NOT use instrument params expiry as a fallback', async () => {
      // Even though CARD_INSTRUMENT has expiry_month='12', expiry_year='2028',
      // the hook only reads from payuResponse, not instrumentParams
      const cardPayuResponse = {
        store_card_token: 'tok_no_expiry_fallback',
        card_no: '411111XXXXXX1111',
        bankcode: 'VISA',
      };
      mockLaunchCorePayment.mockResolvedValue(makeSuccessOutcome(cardPayuResponse));

      const { result } = renderHook(() => usePaymentFlow());

      await act(async () => {
        await result.current.executePayment(
          'CC',
          CARD_INSTRUMENT,
          PAYMENT_ID,
          onClearSensitiveData,
        );
      });

      const callArgs = mockAddCardToken.mock.calls[0]?.[0];
      // The hook does NOT extract expiry from the instrumentParams (the user input)
      expect(callArgs).not.toHaveProperty('card_expiry_month');
      expect(callArgs).not.toHaveProperty('card_expiry_year');
    });
  });
});
