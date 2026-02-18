/**
 * Payment Store
 *
 * Zustand store for payment flow UI state.
 * Manages selected payment method, processing status, and payment amount.
 * Server data (history, saved methods) is handled by React Query hooks.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ==============================================
// TYPES
// ==============================================

export type PaymentMethodType = 'upi' | 'card' | 'netbanking';

export type PaymentStatus =
  | 'idle'
  | 'selecting_method'
  | 'confirming'
  | 'processing'
  | 'success'
  | 'failed'
  | 'refunded';

export interface SelectedPaymentMethod {
  id: string;
  type: PaymentMethodType;
  displayName: string;
  last4?: string;
  isPrimary?: boolean;
}

interface PaymentState {
  status: PaymentStatus;
  selectedMethod: SelectedPaymentMethod | null;
  amount: number;
  dueDate: string | null;
  tenancyId: string | null;
  transactionId: string | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface PaymentActions {
  selectMethod: (method: SelectedPaymentMethod) => void;
  clearMethod: () => void;
  setAmount: (amount: number) => void;
  setDueDate: (date: string) => void;
  setTenancyId: (id: string) => void;
  setConfirming: () => void;
  setProcessing: (transactionId: string) => void;
  setSuccess: () => void;
  setFailed: (code: string, message: string) => void;
  setRefunded: () => void;
  setError: (code: string, message: string) => void;
  clearError: () => void;
  reset: () => void;
}

type PaymentStore = PaymentState & PaymentActions;

// ==============================================
// INITIAL STATE
// ==============================================

const initialState: PaymentState = {
  status: 'idle',
  selectedMethod: null,
  amount: 0,
  dueDate: null,
  tenancyId: null,
  transactionId: null,
  error: null,
};

// ==============================================
// STORE
// ==============================================

export const usePaymentStore = create<PaymentStore>()(
  immer((set) => ({
    ...initialState,

    selectMethod: (method) =>
      set((state) => {
        state.selectedMethod = method;
        state.status = 'selecting_method';
        state.error = null;
      }),

    clearMethod: () =>
      set((state) => {
        state.selectedMethod = null;
        state.status = 'idle';
      }),

    setAmount: (amount) =>
      set((state) => {
        state.amount = amount;
      }),

    setDueDate: (date) =>
      set((state) => {
        state.dueDate = date;
      }),

    setTenancyId: (id) =>
      set((state) => {
        state.tenancyId = id;
      }),

    setConfirming: () =>
      set((state) => {
        state.status = 'confirming';
        state.error = null;
      }),

    setProcessing: (transactionId) =>
      set((state) => {
        state.status = 'processing';
        state.transactionId = transactionId;
        state.error = null;
      }),

    setSuccess: () =>
      set((state) => {
        state.status = 'success';
        state.error = null;
      }),

    setFailed: (code, message) =>
      set((state) => {
        state.status = 'failed';
        state.error = { code, message };
      }),

    setRefunded: () =>
      set((state) => {
        state.status = 'refunded';
      }),

    setError: (code, message) =>
      set((state) => {
        state.error = { code, message };
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
      }),

    reset: () => set(initialState),
  }))
);

// ==============================================
// SELECTORS
// ==============================================

export const selectPaymentStatus = (state: PaymentStore) => state.status;
export const selectSelectedMethod = (state: PaymentStore) => state.selectedMethod;
export const selectPaymentAmount = (state: PaymentStore) => state.amount;
export const selectPaymentError = (state: PaymentStore) => state.error;
export const selectIsProcessing = (state: PaymentStore) =>
  state.status === 'processing' || state.status === 'confirming';
export const selectTransactionId = (state: PaymentStore) => state.transactionId;
