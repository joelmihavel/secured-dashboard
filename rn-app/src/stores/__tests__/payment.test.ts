import { act } from '@testing-library/react-native';
import {
  usePaymentStore,
  selectPaymentStatus,
  selectSelectedMethod,
  selectPaymentAmount,
  selectPaymentError,
  selectIsProcessing,
  selectTransactionId,
} from '../payment';
import type { SelectedPaymentMethod } from '../payment';

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
});
