/**
 * Payment Store
 *
 * Zustand store for payment flow UI state.
 * Manages selected payment method, processing status, and payment amount.
 * Server data (history, saved methods) is handled by React Query hooks.
 *
 * Persists lastPaymentId and lastPaymentTimestamp via expo-secure-store
 * to allow resuming payment polling after app crash/kill.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import * as SecureStore from 'expo-secure-store';

// ==============================================
// TYPES
// ==============================================

export type PaymentMethodType = 'upi' | 'card' | 'debit_card' | 'netbanking';

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
  cardType?: 'credit' | 'debit';
}

/**
 * PayU session params from initiate-payment edge function.
 * Stored in memory only (never persisted) for Core SDK Mode B flow.
 * Contains pre-computed hashes — no salt on client.
 */
export interface PayUSessionParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  vas_hash?: string;
  prd_hash?: string;
  user_credential: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  enforce_paymethod?: string;
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
  // Persisted recovery fields
  lastPaymentId: string | null;
  lastPaymentTimestamp: number | null;
  // Core SDK fields (in-memory only, never persisted)
  payuSessionParams: PayUSessionParams | null;
  selectedInstrument: { type: PaymentMethodType; bankCode?: string } | null;
  // Verification flow state (in-memory only)
  verificationSkipped: boolean;
  pendingPaymentReturn: boolean;
  // Enter rent screen state (in-memory only)
  rentMonth: string | null;
  enteredAmount: number;
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
  setLastPayment: (id: string) => void;
  clearLastPayment: () => void;
  // Core SDK actions
  setPayuSessionParams: (params: PayUSessionParams) => void;
  clearPayuSessionParams: () => void;
  setSelectedInstrument: (instrument: { type: PaymentMethodType; bankCode?: string } | null) => void;
  // Verification flow actions
  setVerificationSkipped: (skipped: boolean) => void;
  setPendingPaymentReturn: (pending: boolean) => void;
  // Enter rent screen actions
  setRentMonth: (month: string) => void;
  setEnteredAmount: (amount: number) => void;
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
  lastPaymentId: null,
  lastPaymentTimestamp: null,
  // Core SDK fields — never persisted (card data security)
  payuSessionParams: null,
  selectedInstrument: null,
  // Verification flow state
  verificationSkipped: false,
  pendingPaymentReturn: false,
  // Enter rent screen state
  rentMonth: null,
  enteredAmount: 0,
};

// ==============================================
// SECURE STORAGE ADAPTER (for persist middleware)
// ==============================================

const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail — non-critical persistence
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};

// ==============================================
// STORE
// ==============================================

export const usePaymentStore = create<PaymentStore>()(
  persist(
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

      setLastPayment: (id) =>
        set((state) => {
          state.lastPaymentId = id;
          state.lastPaymentTimestamp = Date.now();
        }),

      clearLastPayment: () =>
        set((state) => {
          state.lastPaymentId = null;
          state.lastPaymentTimestamp = null;
        }),

      // Core SDK actions — memory only, never persisted
      setPayuSessionParams: (params) =>
        set((state) => {
          state.payuSessionParams = params;
        }),

      clearPayuSessionParams: () =>
        set((state) => {
          state.payuSessionParams = null;
        }),

      setSelectedInstrument: (instrument) =>
        set((state) => {
          state.selectedInstrument = instrument;
        }),

      // Verification flow actions
      setVerificationSkipped: (skipped) =>
        set((state) => {
          state.verificationSkipped = skipped;
        }),

      setPendingPaymentReturn: (pending) =>
        set((state) => {
          state.pendingPaymentReturn = pending;
        }),

      // Enter rent screen actions
      setRentMonth: (month) =>
        set((state) => {
          state.rentMonth = month;
        }),

      setEnteredAmount: (amount) =>
        set((state) => {
          state.enteredAmount = amount;
        }),
    })),
    {
      name: 'payment-recovery',
      storage: createJSONStorage(() => secureStoreAdapter),
      partialize: (state) => ({
        lastPaymentId: state.lastPaymentId,
        lastPaymentTimestamp: state.lastPaymentTimestamp,
      }),
    }
  )
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
export const selectLastPaymentId = (state: PaymentStore) => state.lastPaymentId;
export const selectLastPaymentTimestamp = (state: PaymentStore) => state.lastPaymentTimestamp;
export const selectPayuSessionParams = (state: PaymentStore) => state.payuSessionParams;
export const selectSelectedInstrument = (state: PaymentStore) => state.selectedInstrument;
export const selectVerificationSkipped = (state: PaymentStore) => state.verificationSkipped;
export const selectPendingPaymentReturn = (state: PaymentStore) => state.pendingPaymentReturn;
export const selectRentMonth = (state: PaymentStore) => state.rentMonth;
export const selectEnteredAmount = (state: PaymentStore) => state.enteredAmount;
