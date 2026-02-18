import { act } from '@testing-library/react-native';
import {
  useSetupStore,
  selectCurrentStep,
  selectFlowStatus,
  selectBankForm,
  selectUtilityForm,
  selectLandlordForm,
  selectSetupError,
  selectIsSetupComplete,
} from '../setup';

describe('setupStore', () => {
  beforeEach(() => {
    act(() => {
      useSetupStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const state = useSetupStore.getState();
      expect(state.flowStatus).toBe('idle');
      expect(state.currentStep).toBe('bank');
      expect(state.error).toBeNull();
    });

    it('has correct initial bank form state', () => {
      const { bankForm } = useSetupStore.getState();
      expect(bankForm.accountHolderName).toBe('');
      expect(bankForm.accountNumber).toBe('');
      expect(bankForm.confirmAccountNumber).toBe('');
      expect(bankForm.ifscCode).toBe('');
      expect(bankForm.isVerifying).toBe(false);
      expect(bankForm.isVerified).toBe(false);
    });

    it('has correct initial utility form state', () => {
      const { utilityForm } = useSetupStore.getState();
      expect(utilityForm.operatorCode).toBe('');
      expect(utilityForm.consumerNumber).toBe('');
      expect(utilityForm.isVerifying).toBe(false);
      expect(utilityForm.isVerified).toBe(false);
    });

    it('has correct initial landlord form state', () => {
      const { landlordForm } = useSetupStore.getState();
      expect(landlordForm.landlordName).toBe('');
      expect(landlordForm.landlordEmail).toBe('');
      expect(landlordForm.isSending).toBe(false);
      expect(landlordForm.isSent).toBe(false);
    });
  });

  // ===================================================
  // STEP NAVIGATION ACTIONS
  // ===================================================

  describe('setCurrentStep', () => {
    it('sets current step and starts flow', () => {
      act(() => {
        useSetupStore.getState().setCurrentStep('utility');
      });
      const state = useSetupStore.getState();
      expect(state.currentStep).toBe('utility');
      expect(state.flowStatus).toBe('in_progress');
    });

    it('clears error when setting step', () => {
      act(() => {
        useSetupStore.getState().setError('ERR', 'Error');
        useSetupStore.getState().setCurrentStep('bank');
      });
      expect(useSetupStore.getState().error).toBeNull();
    });

    it.each(['bank', 'utility', 'landlord'] as const)(
      'supports step: %s',
      (step) => {
        act(() => {
          useSetupStore.getState().setCurrentStep(step);
        });
        expect(useSetupStore.getState().currentStep).toBe(step);
      }
    );
  });

  describe('completeStep', () => {
    it('completes bank step and auto-advances to utility', () => {
      act(() => {
        useSetupStore.getState().completeStep('bank');
      });
      const state = useSetupStore.getState();
      expect(state.bankForm.isVerified).toBe(true);
      expect(state.currentStep).toBe('utility');
    });

    it('completes utility step and auto-advances to landlord', () => {
      act(() => {
        useSetupStore.getState().completeStep('utility');
      });
      const state = useSetupStore.getState();
      expect(state.utilityForm.isVerified).toBe(true);
      expect(state.currentStep).toBe('landlord');
    });

    it('completes landlord step and marks flow as completed', () => {
      act(() => {
        useSetupStore.getState().completeStep('landlord');
      });
      const state = useSetupStore.getState();
      expect(state.landlordForm.isSent).toBe(true);
      expect(state.flowStatus).toBe('completed');
    });

    it('completes all steps sequentially and marks flow completed', () => {
      act(() => {
        useSetupStore.getState().completeStep('bank');
        useSetupStore.getState().completeStep('utility');
        useSetupStore.getState().completeStep('landlord');
      });
      const state = useSetupStore.getState();
      expect(state.flowStatus).toBe('completed');
      expect(state.bankForm.isVerified).toBe(true);
      expect(state.utilityForm.isVerified).toBe(true);
      expect(state.landlordForm.isSent).toBe(true);
    });
  });

  // ===================================================
  // BANK FORM ACTIONS
  // ===================================================

  describe('updateBankForm', () => {
    it('updates bank form fields', () => {
      act(() => {
        useSetupStore.getState().updateBankForm({
          accountHolderName: 'Atrish Abh',
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
        });
      });
      const { bankForm } = useSetupStore.getState();
      expect(bankForm.accountHolderName).toBe('Atrish Abh');
      expect(bankForm.accountNumber).toBe('1234567890');
      expect(bankForm.ifscCode).toBe('SBIN0001234');
    });

    it('updates only specified fields, preserves others', () => {
      act(() => {
        useSetupStore.getState().updateBankForm({
          accountHolderName: 'Test',
          accountNumber: '111',
        });
        useSetupStore.getState().updateBankForm({
          ifscCode: 'HDFC0001234',
        });
      });
      const { bankForm } = useSetupStore.getState();
      expect(bankForm.accountHolderName).toBe('Test');
      expect(bankForm.accountNumber).toBe('111');
      expect(bankForm.ifscCode).toBe('HDFC0001234');
    });

    it('updates confirmAccountNumber field', () => {
      act(() => {
        useSetupStore.getState().updateBankForm({
          confirmAccountNumber: '1234567890',
        });
      });
      expect(useSetupStore.getState().bankForm.confirmAccountNumber).toBe('1234567890');
    });
  });

  describe('setBankVerifying', () => {
    it('sets bank verifying to true', () => {
      act(() => {
        useSetupStore.getState().setBankVerifying(true);
      });
      expect(useSetupStore.getState().bankForm.isVerifying).toBe(true);
    });

    it('sets bank verifying to false', () => {
      act(() => {
        useSetupStore.getState().setBankVerifying(true);
        useSetupStore.getState().setBankVerifying(false);
      });
      expect(useSetupStore.getState().bankForm.isVerifying).toBe(false);
    });

    it('clears error when starting verification', () => {
      act(() => {
        useSetupStore.getState().setError('ERR', 'Previous error');
        useSetupStore.getState().setBankVerifying(true);
      });
      expect(useSetupStore.getState().error).toBeNull();
    });
  });

  describe('setBankVerified', () => {
    it('sets bank verified and stops verifying', () => {
      act(() => {
        useSetupStore.getState().setBankVerifying(true);
        useSetupStore.getState().setBankVerified();
      });
      const { bankForm } = useSetupStore.getState();
      expect(bankForm.isVerified).toBe(true);
      expect(bankForm.isVerifying).toBe(false);
    });
  });

  // ===================================================
  // UTILITY FORM ACTIONS
  // ===================================================

  describe('updateUtilityForm', () => {
    it('updates utility form fields', () => {
      act(() => {
        useSetupStore.getState().updateUtilityForm({
          operatorCode: 'BESCOM',
          consumerNumber: '12345678',
        });
      });
      const { utilityForm } = useSetupStore.getState();
      expect(utilityForm.operatorCode).toBe('BESCOM');
      expect(utilityForm.consumerNumber).toBe('12345678');
    });

    it('updates only specified fields, preserves others', () => {
      act(() => {
        useSetupStore.getState().updateUtilityForm({ operatorCode: 'BESCOM' });
        useSetupStore.getState().updateUtilityForm({ consumerNumber: '999' });
      });
      const { utilityForm } = useSetupStore.getState();
      expect(utilityForm.operatorCode).toBe('BESCOM');
      expect(utilityForm.consumerNumber).toBe('999');
    });
  });

  describe('setUtilityVerifying', () => {
    it('sets utility verifying to true', () => {
      act(() => {
        useSetupStore.getState().setUtilityVerifying(true);
      });
      expect(useSetupStore.getState().utilityForm.isVerifying).toBe(true);
    });

    it('sets utility verifying to false', () => {
      act(() => {
        useSetupStore.getState().setUtilityVerifying(true);
        useSetupStore.getState().setUtilityVerifying(false);
      });
      expect(useSetupStore.getState().utilityForm.isVerifying).toBe(false);
    });

    it('clears error when starting verification', () => {
      act(() => {
        useSetupStore.getState().setError('ERR', 'Error');
        useSetupStore.getState().setUtilityVerifying(true);
      });
      expect(useSetupStore.getState().error).toBeNull();
    });
  });

  describe('setUtilityVerified', () => {
    it('sets utility verified and stops verifying', () => {
      act(() => {
        useSetupStore.getState().setUtilityVerifying(true);
        useSetupStore.getState().setUtilityVerified();
      });
      const { utilityForm } = useSetupStore.getState();
      expect(utilityForm.isVerified).toBe(true);
      expect(utilityForm.isVerifying).toBe(false);
    });
  });

  // ===================================================
  // LANDLORD FORM ACTIONS
  // ===================================================

  describe('updateLandlordForm', () => {
    it('updates landlord form fields', () => {
      act(() => {
        useSetupStore.getState().updateLandlordForm({
          landlordName: 'Mr. Landlord',
          landlordEmail: 'landlord@example.com',
        });
      });
      const { landlordForm } = useSetupStore.getState();
      expect(landlordForm.landlordName).toBe('Mr. Landlord');
      expect(landlordForm.landlordEmail).toBe('landlord@example.com');
    });

    it('updates only specified fields, preserves others', () => {
      act(() => {
        useSetupStore.getState().updateLandlordForm({ landlordName: 'Name Only' });
        useSetupStore.getState().updateLandlordForm({ landlordEmail: 'email@test.com' });
      });
      const { landlordForm } = useSetupStore.getState();
      expect(landlordForm.landlordName).toBe('Name Only');
      expect(landlordForm.landlordEmail).toBe('email@test.com');
    });
  });

  describe('setLandlordSending', () => {
    it('sets landlord sending to true', () => {
      act(() => {
        useSetupStore.getState().setLandlordSending(true);
      });
      expect(useSetupStore.getState().landlordForm.isSending).toBe(true);
    });

    it('sets landlord sending to false', () => {
      act(() => {
        useSetupStore.getState().setLandlordSending(true);
        useSetupStore.getState().setLandlordSending(false);
      });
      expect(useSetupStore.getState().landlordForm.isSending).toBe(false);
    });

    it('clears error when starting to send', () => {
      act(() => {
        useSetupStore.getState().setError('ERR', 'Error');
        useSetupStore.getState().setLandlordSending(true);
      });
      expect(useSetupStore.getState().error).toBeNull();
    });
  });

  describe('setLandlordSent', () => {
    it('sets landlord sent and stops sending', () => {
      act(() => {
        useSetupStore.getState().setLandlordSending(true);
        useSetupStore.getState().setLandlordSent();
      });
      const { landlordForm } = useSetupStore.getState();
      expect(landlordForm.isSent).toBe(true);
      expect(landlordForm.isSending).toBe(false);
    });
  });

  // ===================================================
  // ERROR HANDLING ACTIONS
  // ===================================================

  describe('setError', () => {
    it('sets error object', () => {
      act(() => {
        useSetupStore.getState().setError('VERIFICATION_FAILED', 'Bank verification failed');
      });
      expect(useSetupStore.getState().error).toEqual({
        code: 'VERIFICATION_FAILED',
        message: 'Bank verification failed',
      });
    });

    it('overwrites previous error', () => {
      act(() => {
        useSetupStore.getState().setError('ERR_1', 'First');
        useSetupStore.getState().setError('ERR_2', 'Second');
      });
      expect(useSetupStore.getState().error).toEqual({ code: 'ERR_2', message: 'Second' });
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      act(() => {
        useSetupStore.getState().setError('ERR', 'Error');
        useSetupStore.getState().clearError();
      });
      expect(useSetupStore.getState().error).toBeNull();
    });

    it('is safe to call when no error exists', () => {
      act(() => {
        useSetupStore.getState().clearError();
      });
      expect(useSetupStore.getState().error).toBeNull();
    });
  });

  // ===================================================
  // RESET ACTION
  // ===================================================

  describe('reset', () => {
    it('resets all state to initial values', () => {
      act(() => {
        useSetupStore.getState().setCurrentStep('landlord');
        useSetupStore.getState().updateBankForm({
          accountHolderName: 'Test',
          accountNumber: '123',
          ifscCode: 'SBIN001',
        });
        useSetupStore.getState().setBankVerified();
        useSetupStore.getState().updateUtilityForm({
          operatorCode: 'BESCOM',
          consumerNumber: '456',
        });
        useSetupStore.getState().setUtilityVerified();
        useSetupStore.getState().updateLandlordForm({
          landlordName: 'Mr. L',
          landlordEmail: 'l@e.com',
        });
        useSetupStore.getState().setLandlordSent();
        useSetupStore.getState().setError('ERR', 'Error');
      });

      act(() => {
        useSetupStore.getState().reset();
      });

      const state = useSetupStore.getState();
      expect(state.flowStatus).toBe('idle');
      expect(state.currentStep).toBe('bank');
      expect(state.bankForm.accountHolderName).toBe('');
      expect(state.bankForm.isVerified).toBe(false);
      expect(state.utilityForm.operatorCode).toBe('');
      expect(state.utilityForm.isVerified).toBe(false);
      expect(state.landlordForm.landlordName).toBe('');
      expect(state.landlordForm.isSent).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectCurrentStep returns current step', () => {
      expect(selectCurrentStep(useSetupStore.getState())).toBe('bank');

      act(() => {
        useSetupStore.getState().setCurrentStep('utility');
      });
      expect(selectCurrentStep(useSetupStore.getState())).toBe('utility');
    });

    it('selectFlowStatus returns flow status', () => {
      expect(selectFlowStatus(useSetupStore.getState())).toBe('idle');

      act(() => {
        useSetupStore.getState().setCurrentStep('bank');
      });
      expect(selectFlowStatus(useSetupStore.getState())).toBe('in_progress');
    });

    it('selectBankForm returns bank form state', () => {
      const bankForm = selectBankForm(useSetupStore.getState());
      expect(bankForm.accountHolderName).toBe('');
      expect(bankForm.isVerified).toBe(false);

      act(() => {
        useSetupStore.getState().updateBankForm({ accountHolderName: 'Test' });
      });
      expect(selectBankForm(useSetupStore.getState()).accountHolderName).toBe('Test');
    });

    it('selectUtilityForm returns utility form state', () => {
      const utilityForm = selectUtilityForm(useSetupStore.getState());
      expect(utilityForm.operatorCode).toBe('');
      expect(utilityForm.isVerified).toBe(false);

      act(() => {
        useSetupStore.getState().updateUtilityForm({ operatorCode: 'BESCOM' });
      });
      expect(selectUtilityForm(useSetupStore.getState()).operatorCode).toBe('BESCOM');
    });

    it('selectLandlordForm returns landlord form state', () => {
      const landlordForm = selectLandlordForm(useSetupStore.getState());
      expect(landlordForm.landlordName).toBe('');
      expect(landlordForm.isSent).toBe(false);

      act(() => {
        useSetupStore.getState().updateLandlordForm({ landlordName: 'Landlord' });
      });
      expect(selectLandlordForm(useSetupStore.getState()).landlordName).toBe('Landlord');
    });

    it('selectSetupError returns null when no error', () => {
      expect(selectSetupError(useSetupStore.getState())).toBeNull();
    });

    it('selectSetupError returns error when set', () => {
      act(() => {
        useSetupStore.getState().setError('TEST', 'Test');
      });
      expect(selectSetupError(useSetupStore.getState())).toEqual({
        code: 'TEST',
        message: 'Test',
      });
    });

    describe('selectIsSetupComplete', () => {
      it('returns false when no steps are complete', () => {
        expect(selectIsSetupComplete(useSetupStore.getState())).toBe(false);
      });

      it('returns false when only bank is verified', () => {
        act(() => {
          useSetupStore.getState().setBankVerified();
        });
        expect(selectIsSetupComplete(useSetupStore.getState())).toBe(false);
      });

      it('returns false when bank and utility are verified but landlord not sent', () => {
        act(() => {
          useSetupStore.getState().setBankVerified();
          useSetupStore.getState().setUtilityVerified();
        });
        expect(selectIsSetupComplete(useSetupStore.getState())).toBe(false);
      });

      it('returns true when all three steps are complete', () => {
        act(() => {
          useSetupStore.getState().setBankVerified();
          useSetupStore.getState().setUtilityVerified();
          useSetupStore.getState().setLandlordSent();
        });
        expect(selectIsSetupComplete(useSetupStore.getState())).toBe(true);
      });

      it('returns true when completed via completeStep flow', () => {
        act(() => {
          useSetupStore.getState().completeStep('bank');
          useSetupStore.getState().completeStep('utility');
          useSetupStore.getState().completeStep('landlord');
        });
        expect(selectIsSetupComplete(useSetupStore.getState())).toBe(true);
      });
    });
  });

  // ===================================================
  // INTEGRATION: FULL SETUP FLOW
  // ===================================================

  describe('full setup flow integration', () => {
    it('completes entire setup flow end to end', () => {
      // Start bank step
      act(() => {
        useSetupStore.getState().setCurrentStep('bank');
      });
      expect(useSetupStore.getState().flowStatus).toBe('in_progress');

      // Fill bank form
      act(() => {
        useSetupStore.getState().updateBankForm({
          accountHolderName: 'Test User',
          accountNumber: '1234567890',
          confirmAccountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
        });
      });

      // Verify bank
      act(() => {
        useSetupStore.getState().setBankVerifying(true);
      });
      expect(useSetupStore.getState().bankForm.isVerifying).toBe(true);

      act(() => {
        useSetupStore.getState().setBankVerified();
        useSetupStore.getState().completeStep('bank');
      });
      expect(useSetupStore.getState().currentStep).toBe('utility');

      // Fill utility form
      act(() => {
        useSetupStore.getState().updateUtilityForm({
          operatorCode: 'BESCOM',
          consumerNumber: '87654321',
        });
        useSetupStore.getState().setUtilityVerifying(true);
        useSetupStore.getState().setUtilityVerified();
        useSetupStore.getState().completeStep('utility');
      });
      expect(useSetupStore.getState().currentStep).toBe('landlord');

      // Fill landlord form
      act(() => {
        useSetupStore.getState().updateLandlordForm({
          landlordName: 'Mr. Landlord',
          landlordEmail: 'landlord@test.com',
        });
        useSetupStore.getState().setLandlordSending(true);
        useSetupStore.getState().setLandlordSent();
        useSetupStore.getState().completeStep('landlord');
      });

      expect(useSetupStore.getState().flowStatus).toBe('completed');
      expect(selectIsSetupComplete(useSetupStore.getState())).toBe(true);
    });
  });
});
