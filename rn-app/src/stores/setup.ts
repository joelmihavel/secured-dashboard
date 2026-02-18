/**
 * Setup Store
 *
 * Zustand store for post-approval setup flow UI state.
 * Tracks current step, form data, and verification statuses.
 * Server data (verification results) is handled by React Query hooks.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ==============================================
// TYPES
// ==============================================

export type SetupStepId = 'bank' | 'utility' | 'landlord';

export type SetupFlowStatus =
  | 'idle'
  | 'in_progress'
  | 'completed';

interface BankFormState {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  isVerifying: boolean;
  isVerified: boolean;
}

interface UtilityFormState {
  operatorCode: string;
  consumerNumber: string;
  isVerifying: boolean;
  isVerified: boolean;
}

interface LandlordFormState {
  landlordName: string;
  landlordEmail: string;
  isSending: boolean;
  isSent: boolean;
}

interface SetupState {
  flowStatus: SetupFlowStatus;
  currentStep: SetupStepId;
  bankForm: BankFormState;
  utilityForm: UtilityFormState;
  landlordForm: LandlordFormState;
  error: {
    code: string;
    message: string;
  } | null;
}

interface SetupActions {
  // Flow navigation
  setCurrentStep: (step: SetupStepId) => void;
  completeStep: (step: SetupStepId) => void;

  // Bank form
  updateBankForm: (fields: Partial<BankFormState>) => void;
  setBankVerifying: (verifying: boolean) => void;
  setBankVerified: () => void;

  // Utility form
  updateUtilityForm: (fields: Partial<UtilityFormState>) => void;
  setUtilityVerifying: (verifying: boolean) => void;
  setUtilityVerified: () => void;

  // Landlord form
  updateLandlordForm: (fields: Partial<LandlordFormState>) => void;
  setLandlordSending: (sending: boolean) => void;
  setLandlordSent: () => void;

  // Error handling
  setError: (code: string, message: string) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

type SetupStore = SetupState & SetupActions;

// ==============================================
// INITIAL STATE
// ==============================================

const initialBankForm: BankFormState = {
  accountHolderName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  isVerifying: false,
  isVerified: false,
};

const initialUtilityForm: UtilityFormState = {
  operatorCode: '',
  consumerNumber: '',
  isVerifying: false,
  isVerified: false,
};

const initialLandlordForm: LandlordFormState = {
  landlordName: '',
  landlordEmail: '',
  isSending: false,
  isSent: false,
};

const initialState: SetupState = {
  flowStatus: 'idle',
  currentStep: 'bank',
  bankForm: initialBankForm,
  utilityForm: initialUtilityForm,
  landlordForm: initialLandlordForm,
  error: null,
};

// ==============================================
// STORE
// ==============================================

export const useSetupStore = create<SetupStore>()(
  immer((set) => ({
    ...initialState,

    setCurrentStep: (step) =>
      set((state) => {
        state.currentStep = step;
        state.flowStatus = 'in_progress';
        state.error = null;
      }),

    completeStep: (step) =>
      set((state) => {
        if (step === 'bank') state.bankForm.isVerified = true;
        if (step === 'utility') state.utilityForm.isVerified = true;
        if (step === 'landlord') state.landlordForm.isSent = true;

        // Auto-advance to next step
        const steps: SetupStepId[] = ['bank', 'utility', 'landlord'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex < steps.length - 1) {
          state.currentStep = steps[currentIndex + 1];
        } else {
          state.flowStatus = 'completed';
        }
      }),

    // Bank form
    updateBankForm: (fields) =>
      set((state) => {
        Object.assign(state.bankForm, fields);
      }),

    setBankVerifying: (verifying) =>
      set((state) => {
        state.bankForm.isVerifying = verifying;
        state.error = null;
      }),

    setBankVerified: () =>
      set((state) => {
        state.bankForm.isVerified = true;
        state.bankForm.isVerifying = false;
      }),

    // Utility form
    updateUtilityForm: (fields) =>
      set((state) => {
        Object.assign(state.utilityForm, fields);
      }),

    setUtilityVerifying: (verifying) =>
      set((state) => {
        state.utilityForm.isVerifying = verifying;
        state.error = null;
      }),

    setUtilityVerified: () =>
      set((state) => {
        state.utilityForm.isVerified = true;
        state.utilityForm.isVerifying = false;
      }),

    // Landlord form
    updateLandlordForm: (fields) =>
      set((state) => {
        Object.assign(state.landlordForm, fields);
      }),

    setLandlordSending: (sending) =>
      set((state) => {
        state.landlordForm.isSending = sending;
        state.error = null;
      }),

    setLandlordSent: () =>
      set((state) => {
        state.landlordForm.isSent = true;
        state.landlordForm.isSending = false;
      }),

    // Error handling
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

export const selectCurrentStep = (state: SetupStore) => state.currentStep;
export const selectFlowStatus = (state: SetupStore) => state.flowStatus;
export const selectBankForm = (state: SetupStore) => state.bankForm;
export const selectUtilityForm = (state: SetupStore) => state.utilityForm;
export const selectLandlordForm = (state: SetupStore) => state.landlordForm;
export const selectSetupError = (state: SetupStore) => state.error;
export const selectIsSetupComplete = (state: SetupStore) =>
  state.bankForm.isVerified && state.utilityForm.isVerified && state.landlordForm.isSent;
