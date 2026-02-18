import { act } from '@testing-library/react-native';
import {
  useAuthStore,
  selectAuthStatus,
  selectPhoneNumber,
  selectIsAuthenticated,
  selectAuthError,
} from '../auth';

describe('authStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const state = useAuthStore.getState();
      expect(state.status).toBe('idle');
      expect(state.phoneNumber).toBe('');
      expect(state.userName).toBe('');
      expect(state.otpSent).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.isNewUser).toBe(false);
      expect(state.consentForMobile360).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // PHONE ENTRY ACTIONS
  // ===================================================

  describe('setPhoneNumber', () => {
    it('sets phone number and transitions to phone_input', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('9876543210');
      });
      const state = useAuthStore.getState();
      expect(state.phoneNumber).toBe('9876543210');
      expect(state.status).toBe('phone_input');
    });

    it('clears any existing error', () => {
      act(() => {
        useAuthStore.getState().setError('SOME_ERR', 'Previous error');
      });
      expect(useAuthStore.getState().error).not.toBeNull();

      act(() => {
        useAuthStore.getState().setPhoneNumber('1234567890');
      });
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('allows updating phone number multiple times', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('1111111111');
      });
      expect(useAuthStore.getState().phoneNumber).toBe('1111111111');

      act(() => {
        useAuthStore.getState().setPhoneNumber('2222222222');
      });
      expect(useAuthStore.getState().phoneNumber).toBe('2222222222');
    });

    it('handles empty string', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('');
      });
      expect(useAuthStore.getState().phoneNumber).toBe('');
      expect(useAuthStore.getState().status).toBe('phone_input');
    });
  });

  describe('setUserName', () => {
    it('sets user name', () => {
      act(() => {
        useAuthStore.getState().setUserName('Atrish');
      });
      expect(useAuthStore.getState().userName).toBe('Atrish');
    });

    it('does not change status', () => {
      const statusBefore = useAuthStore.getState().status;
      act(() => {
        useAuthStore.getState().setUserName('TestUser');
      });
      expect(useAuthStore.getState().status).toBe(statusBefore);
    });
  });

  // ===================================================
  // CONSENT ACTION
  // ===================================================

  describe('setConsentForMobile360', () => {
    it('sets consent to true', () => {
      act(() => {
        useAuthStore.getState().setConsentForMobile360(true);
      });
      expect(useAuthStore.getState().consentForMobile360).toBe(true);
    });

    it('sets consent to false', () => {
      act(() => {
        useAuthStore.getState().setConsentForMobile360(true);
      });
      expect(useAuthStore.getState().consentForMobile360).toBe(true);

      act(() => {
        useAuthStore.getState().setConsentForMobile360(false);
      });
      expect(useAuthStore.getState().consentForMobile360).toBe(false);
    });
  });

  // ===================================================
  // OTP FLOW ACTIONS
  // ===================================================

  describe('setOtpSent', () => {
    it('sets otpSent to true and transitions to otp_sent', () => {
      act(() => {
        useAuthStore.getState().setOtpSent();
      });
      const state = useAuthStore.getState();
      expect(state.otpSent).toBe(true);
      expect(state.status).toBe('otp_sent');
    });

    it('clears any existing error', () => {
      act(() => {
        useAuthStore.getState().setError('ERR', 'Some error');
        useAuthStore.getState().setOtpSent();
      });
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setVerifying', () => {
    it('transitions to verifying status', () => {
      act(() => {
        useAuthStore.getState().setVerifying();
      });
      expect(useAuthStore.getState().status).toBe('verifying');
    });

    it('clears any existing error', () => {
      act(() => {
        useAuthStore.getState().setError('ERR', 'Some error');
        useAuthStore.getState().setVerifying();
      });
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('setAuthenticated', () => {
    it('sets userId, isNewUser, and transitions to authenticated', () => {
      act(() => {
        useAuthStore.getState().setAuthenticated('user_123', true);
      });
      const state = useAuthStore.getState();
      expect(state.userId).toBe('user_123');
      expect(state.isNewUser).toBe(true);
      expect(state.status).toBe('authenticated');
    });

    it('handles existing user (isNewUser = false)', () => {
      act(() => {
        useAuthStore.getState().setAuthenticated('user_456', false);
      });
      const state = useAuthStore.getState();
      expect(state.userId).toBe('user_456');
      expect(state.isNewUser).toBe(false);
      expect(state.status).toBe('authenticated');
    });

    it('clears any existing error', () => {
      act(() => {
        useAuthStore.getState().setError('ERR', 'Error');
        useAuthStore.getState().setAuthenticated('user_789', false);
      });
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('full OTP flow transition', () => {
    it('transitions through otp_sent -> verifying -> authenticated', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('9876543210');
      });
      expect(useAuthStore.getState().status).toBe('phone_input');

      act(() => {
        useAuthStore.getState().setOtpSent();
      });
      expect(useAuthStore.getState().status).toBe('otp_sent');
      expect(useAuthStore.getState().otpSent).toBe(true);

      act(() => {
        useAuthStore.getState().setVerifying();
      });
      expect(useAuthStore.getState().status).toBe('verifying');

      act(() => {
        useAuthStore.getState().setAuthenticated('user_final', true);
      });
      const state = useAuthStore.getState();
      expect(state.status).toBe('authenticated');
      expect(state.userId).toBe('user_final');
      expect(state.isNewUser).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // ERROR HANDLING ACTIONS
  // ===================================================

  describe('setError', () => {
    it('sets error object and transitions to error status', () => {
      act(() => {
        useAuthStore.getState().setError('INVALID_OTP', 'The OTP entered is incorrect');
      });
      const state = useAuthStore.getState();
      expect(state.error).toEqual({
        code: 'INVALID_OTP',
        message: 'The OTP entered is incorrect',
      });
      expect(state.status).toBe('error');
    });

    it('overwrites a previous error', () => {
      act(() => {
        useAuthStore.getState().setError('ERR_1', 'First error');
        useAuthStore.getState().setError('ERR_2', 'Second error');
      });
      expect(useAuthStore.getState().error).toEqual({
        code: 'ERR_2',
        message: 'Second error',
      });
    });
  });

  describe('clearError', () => {
    it('clears the error and returns to otp_sent if OTP was sent', () => {
      act(() => {
        useAuthStore.getState().setOtpSent();
        useAuthStore.getState().setError('INVALID_OTP', 'Wrong');
      });
      expect(useAuthStore.getState().status).toBe('error');

      act(() => {
        useAuthStore.getState().clearError();
      });
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.status).toBe('otp_sent');
    });

    it('returns to phone_input if no OTP has been sent', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('123');
        useAuthStore.getState().setError('RATE_LIMIT', 'Too many attempts');
        useAuthStore.getState().clearError();
      });
      expect(useAuthStore.getState().status).toBe('phone_input');
    });

    it('does not change status when not in error state', () => {
      act(() => {
        useAuthStore.getState().setOtpSent();
      });
      expect(useAuthStore.getState().status).toBe('otp_sent');

      act(() => {
        useAuthStore.getState().clearError();
      });
      // Status should remain otp_sent since it was not 'error'
      expect(useAuthStore.getState().status).toBe('otp_sent');
    });

    it('is a no-op when there is no error to clear', () => {
      const stateBefore = useAuthStore.getState();
      act(() => {
        useAuthStore.getState().clearError();
      });
      const stateAfter = useAuthStore.getState();
      expect(stateAfter.error).toBeNull();
      expect(stateAfter.status).toBe(stateBefore.status);
    });
  });

  // ===================================================
  // RESET ACTION
  // ===================================================

  describe('reset', () => {
    it('resets all fields to initial state', () => {
      act(() => {
        useAuthStore.getState().setPhoneNumber('9876543210');
        useAuthStore.getState().setUserName('TestUser');
        useAuthStore.getState().setConsentForMobile360(true);
        useAuthStore.getState().setOtpSent();
        useAuthStore.getState().setAuthenticated('user_1', true);
      });
      // Verify state has changed
      expect(useAuthStore.getState().status).toBe('authenticated');

      act(() => {
        useAuthStore.getState().reset();
      });
      const state = useAuthStore.getState();
      expect(state.status).toBe('idle');
      expect(state.phoneNumber).toBe('');
      expect(state.userName).toBe('');
      expect(state.otpSent).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.isNewUser).toBe(false);
      expect(state.consentForMobile360).toBe(false);
      expect(state.error).toBeNull();
    });

    it('clears error state on reset', () => {
      act(() => {
        useAuthStore.getState().setError('FATAL', 'Something broke');
        useAuthStore.getState().reset();
      });
      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().status).toBe('idle');
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectAuthStatus returns current status', () => {
      expect(selectAuthStatus(useAuthStore.getState())).toBe('idle');

      act(() => {
        useAuthStore.getState().setPhoneNumber('123');
      });
      expect(selectAuthStatus(useAuthStore.getState())).toBe('phone_input');

      act(() => {
        useAuthStore.getState().setOtpSent();
      });
      expect(selectAuthStatus(useAuthStore.getState())).toBe('otp_sent');
    });

    it('selectPhoneNumber returns current phone number', () => {
      expect(selectPhoneNumber(useAuthStore.getState())).toBe('');

      act(() => {
        useAuthStore.getState().setPhoneNumber('9876543210');
      });
      expect(selectPhoneNumber(useAuthStore.getState())).toBe('9876543210');
    });

    it('selectIsAuthenticated returns false when not authenticated', () => {
      expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    });

    it('selectIsAuthenticated returns true when authenticated', () => {
      act(() => {
        useAuthStore.getState().setAuthenticated('user_1', false);
      });
      expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    });

    it('selectAuthError returns null when no error', () => {
      expect(selectAuthError(useAuthStore.getState())).toBeNull();
    });

    it('selectAuthError returns error when set', () => {
      act(() => {
        useAuthStore.getState().setError('TEST', 'Test error');
      });
      expect(selectAuthError(useAuthStore.getState())).toEqual({
        code: 'TEST',
        message: 'Test error',
      });
    });
  });
});
