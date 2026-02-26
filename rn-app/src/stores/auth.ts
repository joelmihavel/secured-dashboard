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

export type IdentityStatus = 'completed' | 'pending' | 'not_available' | null;

interface AuthState {
  status: AuthStatus;
  phoneNumber: string;
  userName: string;
  otpSent: boolean;
  userId: string | null;
  isNewUser: boolean;
  consentForMobile360: boolean;
  consentTimestamp: string | null;
  otpRequestId: string | null;       // Opaque server ref for OTP routing
  identityStatus: IdentityStatus;    // M360 identity verification result
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
  setOtpSent: (otpRequestId?: string) => void;
  setVerifying: () => void;
  setAuthenticated: (userId: string, isNewUser: boolean, identityStatus?: IdentityStatus) => void;

  // Identity status (post-verify update)
  setIdentityStatus: (status: IdentityStatus) => void;

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
  otpRequestId: null,
  identityStatus: null,
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

    setOtpSent: (otpRequestId) =>
      set((state) => {
        state.otpSent = true;
        state.status = 'otp_sent';
        state.error = null;
        if (otpRequestId !== undefined) {
          state.otpRequestId = otpRequestId;
        }
      }),

    setVerifying: () =>
      set((state) => {
        state.status = 'verifying';
        state.error = null;
      }),

    setAuthenticated: (userId, isNewUser, identityStatus) =>
      set((state) => {
        state.userId = userId;
        state.isNewUser = isNewUser;
        state.status = 'authenticated';
        state.error = null;
        if (identityStatus !== undefined) {
          state.identityStatus = identityStatus;
        }
      }),

    setIdentityStatus: (status) =>
      set((state) => {
        state.identityStatus = status;
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
export const selectOtpRequestId = (state: AuthStore) => state.otpRequestId;
export const selectIdentityStatus = (state: AuthStore) => state.identityStatus;
