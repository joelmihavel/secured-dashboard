import { act } from '@testing-library/react-native';
import {
  usePaymentStore,
  selectPaymentStatus,
  selectSelectedMethod,
  selectPaymentAmount,
  selectPaymentError,
  selectIsProcessing,
  selectTransactionId,
  selectLastPaymentId,
  selectLastPaymentTimestamp,
  selectPayuSessionParams,
  selectSelectedInstrument,
  selectVerificationSkipped,
  selectPendingPaymentReturn,
} from '../payment';
import type { SelectedPaymentMethod, PayUSessionParams } from '../payment';

const mockUpiMethod: SelectedPaymentMethod = {
  id: 'upi_1',
  type: 'upi',
  displayName: 'user@okicici',
};

const mockCardMethod: SelectedPaymentMethod = {
  id: 'card_1',
  type: 'card',
  displayName: 'Visa ending 4242',
  last4: '4242',
  isPrimary: true,
};

const mockNetbankingMethod: SelectedPaymentMethod = {
  id: 'nb_1',
  type: 'netbanking',
  displayName: 'HDFC Bank',
};

describe('paymentStore', () => {
  beforeEach(() => {
    act(() => {
      usePaymentStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const state = usePaymentStore.getState();
      expect(state.status).toBe('idle');
      expect(state.selectedMethod).toBeNull();
      expect(state.amount).toBe(0);
      expect(state.dueDate).toBeNull();
      expect(state.tenancyId).toBeNull();
      expect(state.transactionId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // METHOD SELECTION ACTIONS
  // ===================================================

  describe('selectMethod', () => {
    it('sets UPI method and transitions to selecting_method', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockUpiMethod);
      });
      const state = usePaymentStore.getState();
      expect(state.selectedMethod).toEqual(mockUpiMethod);
      expect(state.status).toBe('selecting_method');
    });

    it('sets card method with last4 and isPrimary', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockCardMethod);
      });
      const state = usePaymentStore.getState();
      expect(state.selectedMethod).toEqual(mockCardMethod);
      expect(state.selectedMethod?.last4).toBe('4242');
      expect(state.selectedMethod?.isPrimary).toBe(true);
    });

    it('sets netbanking method', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockNetbankingMethod);
      });
      expect(usePaymentStore.getState().selectedMethod).toEqual(mockNetbankingMethod);
    });

    it('clears any existing error', () => {
      act(() => {
        usePaymentStore.getState().setError('PREVIOUS', 'Old error');
        usePaymentStore.getState().selectMethod(mockUpiMethod);
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });

    it('replaces previously selected method', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockUpiMethod);
        usePaymentStore.getState().selectMethod(mockCardMethod);
      });
      expect(usePaymentStore.getState().selectedMethod).toEqual(mockCardMethod);
    });
  });

  describe('clearMethod', () => {
    it('clears method and returns to idle', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockUpiMethod);
        usePaymentStore.getState().clearMethod();
      });
      const state = usePaymentStore.getState();
      expect(state.selectedMethod).toBeNull();
      expect(state.status).toBe('idle');
    });

    it('is safe to call when no method is selected', () => {
      act(() => {
        usePaymentStore.getState().clearMethod();
      });
      expect(usePaymentStore.getState().selectedMethod).toBeNull();
      expect(usePaymentStore.getState().status).toBe('idle');
    });
  });

  // ===================================================
  // AMOUNT AND METADATA ACTIONS
  // ===================================================

  describe('setAmount', () => {
    it('sets payment amount', () => {
      act(() => {
        usePaymentStore.getState().setAmount(15000);
      });
      expect(usePaymentStore.getState().amount).toBe(15000);
    });

    it('handles zero amount', () => {
      act(() => {
        usePaymentStore.getState().setAmount(25000);
        usePaymentStore.getState().setAmount(0);
      });
      expect(usePaymentStore.getState().amount).toBe(0);
    });

    it('handles decimal amounts', () => {
      act(() => {
        usePaymentStore.getState().setAmount(15000.5);
      });
      expect(usePaymentStore.getState().amount).toBe(15000.5);
    });
  });

  describe('setDueDate', () => {
    it('sets due date', () => {
      act(() => {
        usePaymentStore.getState().setDueDate('2026-03-07');
      });
      expect(usePaymentStore.getState().dueDate).toBe('2026-03-07');
    });

    it('allows updating due date', () => {
      act(() => {
        usePaymentStore.getState().setDueDate('2026-03-07');
        usePaymentStore.getState().setDueDate('2026-04-07');
      });
      expect(usePaymentStore.getState().dueDate).toBe('2026-04-07');
    });
  });

  describe('setTenancyId', () => {
    it('sets tenancy ID', () => {
      act(() => {
        usePaymentStore.getState().setTenancyId('tenancy_abc123');
      });
      expect(usePaymentStore.getState().tenancyId).toBe('tenancy_abc123');
    });

    it('allows updating tenancy ID', () => {
      act(() => {
        usePaymentStore.getState().setTenancyId('tenancy_1');
        usePaymentStore.getState().setTenancyId('tenancy_2');
      });
      expect(usePaymentStore.getState().tenancyId).toBe('tenancy_2');
    });
  });

  // ===================================================
  // PAYMENT FLOW ACTIONS
  // ===================================================

  describe('setConfirming', () => {
    it('transitions to confirming status', () => {
      act(() => {
        usePaymentStore.getState().setConfirming();
      });
      expect(usePaymentStore.getState().status).toBe('confirming');
    });

    it('clears error', () => {
      act(() => {
        usePaymentStore.getState().setError('ERR', 'Error');
        usePaymentStore.getState().setConfirming();
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });
  });

  describe('setProcessing', () => {
    it('transitions to processing with transaction ID', () => {
      act(() => {
        usePaymentStore.getState().setProcessing('txn_123');
      });
      const state = usePaymentStore.getState();
      expect(state.status).toBe('processing');
      expect(state.transactionId).toBe('txn_123');
    });

    it('clears error', () => {
      act(() => {
        usePaymentStore.getState().setError('ERR', 'Error');
        usePaymentStore.getState().setProcessing('txn_456');
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });
  });

  describe('setSuccess', () => {
    it('transitions to success status', () => {
      act(() => {
        usePaymentStore.getState().setSuccess();
      });
      expect(usePaymentStore.getState().status).toBe('success');
    });

    it('clears error', () => {
      act(() => {
        usePaymentStore.getState().setError('ERR', 'Error');
        usePaymentStore.getState().setSuccess();
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });
  });

  describe('setFailed', () => {
    it('transitions to failed with error', () => {
      act(() => {
        usePaymentStore.getState().setFailed('PAYMENT_DECLINED', 'Card declined');
      });
      const state = usePaymentStore.getState();
      expect(state.status).toBe('failed');
      expect(state.error).toEqual({ code: 'PAYMENT_DECLINED', message: 'Card declined' });
    });
  });

  describe('setRefunded', () => {
    it('transitions to refunded status', () => {
      act(() => {
        usePaymentStore.getState().setRefunded();
      });
      expect(usePaymentStore.getState().status).toBe('refunded');
    });
  });

  describe('full payment flow transition', () => {
    it('transitions through selecting -> confirming -> processing -> success', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockUpiMethod);
      });
      expect(usePaymentStore.getState().status).toBe('selecting_method');

      act(() => {
        usePaymentStore.getState().setConfirming();
      });
      expect(usePaymentStore.getState().status).toBe('confirming');

      act(() => {
        usePaymentStore.getState().setProcessing('txn_flow');
      });
      expect(usePaymentStore.getState().status).toBe('processing');

      act(() => {
        usePaymentStore.getState().setSuccess();
      });
      expect(usePaymentStore.getState().status).toBe('success');
    });

    it('transitions through processing -> failed', () => {
      act(() => {
        usePaymentStore.getState().setProcessing('txn_fail');
        usePaymentStore.getState().setFailed('TIMEOUT', 'Gateway timeout');
      });
      const state = usePaymentStore.getState();
      expect(state.status).toBe('failed');
      expect(state.transactionId).toBe('txn_fail');
      expect(state.error).toEqual({ code: 'TIMEOUT', message: 'Gateway timeout' });
    });

    it('transitions through success -> refunded', () => {
      act(() => {
        usePaymentStore.getState().setProcessing('txn_refund');
        usePaymentStore.getState().setSuccess();
        usePaymentStore.getState().setRefunded();
      });
      expect(usePaymentStore.getState().status).toBe('refunded');
      expect(usePaymentStore.getState().transactionId).toBe('txn_refund');
    });
  });

  // ===================================================
  // ERROR HANDLING ACTIONS
  // ===================================================

  describe('setError', () => {
    it('sets error object', () => {
      act(() => {
        usePaymentStore.getState().setError('NETWORK', 'Connection failed');
      });
      expect(usePaymentStore.getState().error).toEqual({
        code: 'NETWORK',
        message: 'Connection failed',
      });
    });

    it('does not change status (unlike setFailed)', () => {
      act(() => {
        usePaymentStore.getState().setConfirming();
        usePaymentStore.getState().setError('VALIDATION', 'Invalid amount');
      });
      // setError does not modify status
      expect(usePaymentStore.getState().status).toBe('confirming');
    });

    it('overwrites previous error', () => {
      act(() => {
        usePaymentStore.getState().setError('ERR_1', 'First');
        usePaymentStore.getState().setError('ERR_2', 'Second');
      });
      expect(usePaymentStore.getState().error).toEqual({ code: 'ERR_2', message: 'Second' });
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      act(() => {
        usePaymentStore.getState().setError('NETWORK', 'Connection failed');
        usePaymentStore.getState().clearError();
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });

    it('is safe to call when no error exists', () => {
      act(() => {
        usePaymentStore.getState().clearError();
      });
      expect(usePaymentStore.getState().error).toBeNull();
    });
  });

  // ===================================================
  // RESET ACTION
  // ===================================================

  describe('reset', () => {
    it('resets all state to initial values', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockCardMethod);
        usePaymentStore.getState().setAmount(25000);
        usePaymentStore.getState().setDueDate('2026-03-07');
        usePaymentStore.getState().setTenancyId('tenancy_1');
        usePaymentStore.getState().setProcessing('txn_789');
        usePaymentStore.getState().setError('ERR', 'Error');
      });

      act(() => {
        usePaymentStore.getState().reset();
      });

      const state = usePaymentStore.getState();
      expect(state.status).toBe('idle');
      expect(state.selectedMethod).toBeNull();
      expect(state.amount).toBe(0);
      expect(state.dueDate).toBeNull();
      expect(state.tenancyId).toBeNull();
      expect(state.transactionId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectPaymentStatus returns current status', () => {
      expect(selectPaymentStatus(usePaymentStore.getState())).toBe('idle');

      act(() => {
        usePaymentStore.getState().setConfirming();
      });
      expect(selectPaymentStatus(usePaymentStore.getState())).toBe('confirming');
    });

    it('selectSelectedMethod returns null initially', () => {
      expect(selectSelectedMethod(usePaymentStore.getState())).toBeNull();
    });

    it('selectSelectedMethod returns selected method', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockCardMethod);
      });
      expect(selectSelectedMethod(usePaymentStore.getState())).toEqual(mockCardMethod);
    });

    it('selectPaymentAmount returns current amount', () => {
      expect(selectPaymentAmount(usePaymentStore.getState())).toBe(0);

      act(() => {
        usePaymentStore.getState().setAmount(12500);
      });
      expect(selectPaymentAmount(usePaymentStore.getState())).toBe(12500);
    });

    it('selectPaymentError returns null when no error', () => {
      expect(selectPaymentError(usePaymentStore.getState())).toBeNull();
    });

    it('selectPaymentError returns error when set', () => {
      act(() => {
        usePaymentStore.getState().setError('TEST', 'Test error');
      });
      expect(selectPaymentError(usePaymentStore.getState())).toEqual({
        code: 'TEST',
        message: 'Test error',
      });
    });

    describe('selectIsProcessing', () => {
      it('returns false for idle', () => {
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(false);
      });

      it('returns true for confirming', () => {
        act(() => {
          usePaymentStore.getState().setConfirming();
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(true);
      });

      it('returns true for processing', () => {
        act(() => {
          usePaymentStore.getState().setProcessing('txn_1');
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(true);
      });

      it('returns false for success', () => {
        act(() => {
          usePaymentStore.getState().setSuccess();
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(false);
      });

      it('returns false for failed', () => {
        act(() => {
          usePaymentStore.getState().setFailed('ERR', 'Failed');
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(false);
      });

      it('returns false for refunded', () => {
        act(() => {
          usePaymentStore.getState().setRefunded();
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(false);
      });

      it('returns false for selecting_method', () => {
        act(() => {
          usePaymentStore.getState().selectMethod(mockUpiMethod);
        });
        expect(selectIsProcessing(usePaymentStore.getState())).toBe(false);
      });
    });

    it('selectTransactionId returns null initially', () => {
      expect(selectTransactionId(usePaymentStore.getState())).toBeNull();
    });

    it('selectTransactionId returns transaction ID after processing', () => {
      act(() => {
        usePaymentStore.getState().setProcessing('txn_sel');
      });
      expect(selectTransactionId(usePaymentStore.getState())).toBe('txn_sel');
    });
  });

  // ===================================================
  // PayU SESSION PARAMS (in-memory only)
  // ===================================================

  describe('PayU session params', () => {
    const mockParams: PayUSessionParams = {
      key: 'PLycrf',
      txnid: 'txn-payu-001',
      amount: '25000',
      productinfo: 'Rent Feb 2026',
      firstname: 'Rishabh',
      email: 'rishabh@flent.in',
      phone: '+919876543210',
      surl: 'https://api.flent.in/payment/success',
      furl: 'https://api.flent.in/payment/failure',
      hash: 'a1b2c3d4e5f6',
      user_credential: 'PLycrf:rishabh@flent.in',
    };

    it('setPayuSessionParams stores params', () => {
      act(() => {
        usePaymentStore.getState().setPayuSessionParams(mockParams);
      });
      expect(usePaymentStore.getState().payuSessionParams).toEqual(mockParams);
    });

    it('clearPayuSessionParams clears to null', () => {
      act(() => {
        usePaymentStore.getState().setPayuSessionParams(mockParams);
        usePaymentStore.getState().clearPayuSessionParams();
      });
      expect(usePaymentStore.getState().payuSessionParams).toBeNull();
    });

    it('payuSessionParams is NOT included in persisted state (partialize)', () => {
      // The store's partialize option returns only { lastPaymentId, lastPaymentTimestamp }.
      // PayU session params must NOT appear in persisted keys.
      act(() => {
        usePaymentStore.getState().setPayuSessionParams(mockParams);
      });

      const state = usePaymentStore.getState();
      // Access the store's persist API to check partialize output
      const persistApi = (usePaymentStore as unknown as { persist: { getOptions: () => { partialize: (s: typeof state) => Record<string, unknown> } } }).persist;
      const partialized = persistApi.getOptions().partialize(state);

      expect(partialized).toHaveProperty('lastPaymentId');
      expect(partialized).toHaveProperty('lastPaymentTimestamp');
      expect(partialized).not.toHaveProperty('payuSessionParams');
      expect(partialized).not.toHaveProperty('selectedInstrument');
      expect(partialized).not.toHaveProperty('verificationSkipped');
      expect(partialized).not.toHaveProperty('pendingPaymentReturn');
    });
  });

  // ===================================================
  // SELECTED INSTRUMENT
  // ===================================================

  describe('selectedInstrument', () => {
    it('setSelectedInstrument stores { type, bankCode }', () => {
      act(() => {
        usePaymentStore.getState().setSelectedInstrument({ type: 'netbanking', bankCode: 'HDFC' });
      });
      expect(usePaymentStore.getState().selectedInstrument).toEqual({
        type: 'netbanking',
        bankCode: 'HDFC',
      });
    });

    it('setSelectedInstrument with UPI type (no bankCode)', () => {
      act(() => {
        usePaymentStore.getState().setSelectedInstrument({ type: 'upi' });
      });
      expect(usePaymentStore.getState().selectedInstrument).toEqual({ type: 'upi' });
    });

    it('setSelectedInstrument(null) clears it', () => {
      act(() => {
        usePaymentStore.getState().setSelectedInstrument({ type: 'card' });
        usePaymentStore.getState().setSelectedInstrument(null);
      });
      expect(usePaymentStore.getState().selectedInstrument).toBeNull();
    });
  });

  // ===================================================
  // VERIFICATION FLOW STATE
  // ===================================================

  describe('verification flow', () => {
    it('setVerificationSkipped(true) stores true', () => {
      act(() => {
        usePaymentStore.getState().setVerificationSkipped(true);
      });
      expect(usePaymentStore.getState().verificationSkipped).toBe(true);
    });

    it('setVerificationSkipped(false) stores false', () => {
      act(() => {
        usePaymentStore.getState().setVerificationSkipped(true);
        usePaymentStore.getState().setVerificationSkipped(false);
      });
      expect(usePaymentStore.getState().verificationSkipped).toBe(false);
    });

    it('setPendingPaymentReturn(true) stores true', () => {
      act(() => {
        usePaymentStore.getState().setPendingPaymentReturn(true);
      });
      expect(usePaymentStore.getState().pendingPaymentReturn).toBe(true);
    });

    it('setPendingPaymentReturn(false) stores false', () => {
      act(() => {
        usePaymentStore.getState().setPendingPaymentReturn(true);
        usePaymentStore.getState().setPendingPaymentReturn(false);
      });
      expect(usePaymentStore.getState().pendingPaymentReturn).toBe(false);
    });
  });

  // ===================================================
  // PERSISTENCE (lastPayment)
  // ===================================================

  describe('lastPayment persistence fields', () => {
    it('setLastPayment sets both id and timestamp', () => {
      const beforeCall = Date.now();

      act(() => {
        usePaymentStore.getState().setLastPayment('pay-persist-001');
      });

      const state = usePaymentStore.getState();
      expect(state.lastPaymentId).toBe('pay-persist-001');
      expect(state.lastPaymentTimestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(state.lastPaymentTimestamp).toBeLessThanOrEqual(Date.now());
    });

    it('clearLastPayment clears both id and timestamp', () => {
      act(() => {
        usePaymentStore.getState().setLastPayment('pay-persist-002');
        usePaymentStore.getState().clearLastPayment();
      });

      const state = usePaymentStore.getState();
      expect(state.lastPaymentId).toBeNull();
      expect(state.lastPaymentTimestamp).toBeNull();
    });

    it('partialize returns ONLY lastPaymentId and lastPaymentTimestamp', () => {
      act(() => {
        usePaymentStore.getState().selectMethod(mockCardMethod);
        usePaymentStore.getState().setAmount(25000);
        usePaymentStore.getState().setProcessing('txn_persist');
        usePaymentStore.getState().setLastPayment('pay-persist-003');
      });

      const state = usePaymentStore.getState();
      const persistApi = (usePaymentStore as unknown as { persist: { getOptions: () => { partialize: (s: typeof state) => Record<string, unknown> } } }).persist;
      const partialized = persistApi.getOptions().partialize(state);

      // Should include ONLY these two keys
      expect(Object.keys(partialized).sort()).toEqual(
        ['lastPaymentId', 'lastPaymentTimestamp'].sort()
      );
      expect(partialized.lastPaymentId).toBe('pay-persist-003');
      expect(typeof partialized.lastPaymentTimestamp).toBe('number');
    });
  });

  // ===================================================
  // ADDITIONAL SELECTORS
  // ===================================================

  describe('additional selectors', () => {
    it('selectLastPaymentId returns null initially', () => {
      expect(selectLastPaymentId(usePaymentStore.getState())).toBeNull();
    });

    it('selectLastPaymentId returns id after setLastPayment', () => {
      act(() => {
        usePaymentStore.getState().setLastPayment('pay-sel-001');
      });
      expect(selectLastPaymentId(usePaymentStore.getState())).toBe('pay-sel-001');
    });

    it('selectLastPaymentTimestamp returns null initially', () => {
      expect(selectLastPaymentTimestamp(usePaymentStore.getState())).toBeNull();
    });

    it('selectLastPaymentTimestamp returns timestamp after setLastPayment', () => {
      act(() => {
        usePaymentStore.getState().setLastPayment('pay-sel-002');
      });
      expect(typeof selectLastPaymentTimestamp(usePaymentStore.getState())).toBe('number');
    });

    it('selectPayuSessionParams returns null initially', () => {
      expect(selectPayuSessionParams(usePaymentStore.getState())).toBeNull();
    });

    it('selectPayuSessionParams returns params after set', () => {
      const params: PayUSessionParams = {
        key: 'PLycrf',
        txnid: 'txn-sel-001',
        amount: '25000',
        productinfo: 'Rent',
        firstname: 'Test',
        email: 'test@flent.in',
        phone: '+919999999999',
        surl: 'https://surl',
        furl: 'https://furl',
        hash: 'hash123',
        user_credential: 'PLycrf:test@flent.in',
      };
      act(() => {
        usePaymentStore.getState().setPayuSessionParams(params);
      });
      expect(selectPayuSessionParams(usePaymentStore.getState())).toEqual(params);
    });

    it('selectSelectedInstrument returns null initially', () => {
      expect(selectSelectedInstrument(usePaymentStore.getState())).toBeNull();
    });

    it('selectSelectedInstrument returns instrument after set', () => {
      act(() => {
        usePaymentStore.getState().setSelectedInstrument({ type: 'card' });
      });
      expect(selectSelectedInstrument(usePaymentStore.getState())).toEqual({ type: 'card' });
    });

    it('selectVerificationSkipped returns false initially', () => {
      expect(selectVerificationSkipped(usePaymentStore.getState())).toBe(false);
    });

    it('selectVerificationSkipped returns true after set', () => {
      act(() => {
        usePaymentStore.getState().setVerificationSkipped(true);
      });
      expect(selectVerificationSkipped(usePaymentStore.getState())).toBe(true);
    });

    it('selectPendingPaymentReturn returns false initially', () => {
      expect(selectPendingPaymentReturn(usePaymentStore.getState())).toBe(false);
    });

    it('selectPendingPaymentReturn returns true after set', () => {
      act(() => {
        usePaymentStore.getState().setPendingPaymentReturn(true);
      });
      expect(selectPendingPaymentReturn(usePaymentStore.getState())).toBe(true);
    });
  });
});
