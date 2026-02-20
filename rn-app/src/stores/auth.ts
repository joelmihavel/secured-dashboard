/**
 * Auth Store
 *
 * Zustand store for authentication state management.
 * Handles phone verification flow and session state.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ==============================================
// TYPES
// ==============================================

export type AuthStatus =
  | 'idle' // Initial state
  | 'phone_input' // User entering phone
  | 'otp_sent' // OTP has been sent
  | 'verifying' // OTP verification in progress
  | 'authenticated' // User authenticated
  | 'error'; // Error state

interface AuthState {
  status: AuthStatus;
  phoneNumber: string;
  userName: string;
  otpSent: boolean;
  userId: string | null;
  isNewUser: boolean;
  consentForMobile360: boolean;
  consentTimestamp: string | null;
  error: {
    code: string;
    message: string;
  } | null;
}

interface AuthActions {
  // Phone entry
  setPhoneNumber: (phone: string) => void;
  setUserName: (name: string) => void;

  // Consent
  setConsentForMobile360: (value: boolean) => void;

  // OTP flow
  setOtpSent: () => void;
  setVerifying: () => void;
  setAuthenticated: (userId: string, isNewUser: boolean) => void;

  // Error handling
  setError: (code: string, message: string) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// ==============================================
// INITIAL STATE
// ==============================================

const initialState: AuthState = {
  status: 'idle',
  phoneNumber: '',
  userName: '',
  otpSent: false,
  userId: null,
  isNewUser: false,
  consentForMobile360: false,
  consentTimestamp: null,
  error: null,
};

// ==============================================
// STORE
// ==============================================

export const useAuthStore = create<AuthStore>()(
  immer((set) => ({
    ...initialState,

    setPhoneNumber: (phone) =>
      set((state) => {
        state.phoneNumber = phone;
        state.status = 'phone_input';
        state.error = null;
      }),

    setUserName: (name) =>
      set((state) => {
        state.userName = name;
      }),

    setConsentForMobile360: (value) =>
      set((state) => {
        state.consentForMobile360 = value;
        state.consentTimestamp = value ? new Date().toISOString() : null;
      }),

    setOtpSent: () =>
      set((state) => {
        state.otpSent = true;
        state.status = 'otp_sent';
        state.error = null;
      }),

    setVerifying: () =>
      set((state) => {
        state.status = 'verifying';
        state.error = null;
      }),

    setAuthenticated: (userId, isNewUser) =>
      set((state) => {
        state.userId = userId;
        state.isNewUser = isNewUser;
        state.status = 'authenticated';
        state.error = null;
      }),

    setError: (code, message) =>
      set((state) => {
        state.error = { code, message };
        state.status = 'error';
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
        if (state.status === 'error') {
          state.status = state.otpSent ? 'otp_sent' : 'phone_input';
        }
      }),

    reset: () => set(initialState),
  }))
);

// ==============================================
// SELECTORS
// ==============================================

export const selectAuthStatus = (state: AuthStore) => state.status;
export const selectPhoneNumber = (state: AuthStore) => state.phoneNumber;
export const selectIsAuthenticated = (state: AuthStore) => state.status === 'authenticated';
export const selectAuthError = (state: AuthStore) => state.error;
