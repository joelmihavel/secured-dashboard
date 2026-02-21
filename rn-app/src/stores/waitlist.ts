/**
 * Waitlist Store
 *
 * Zustand store for waitlist UI state management.
 * Handles local state that doesn't need to be persisted.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ==============================================
// TYPES
// ==============================================

export type WaitlistViewState =
  | 'loading'
  | 'pending'
  | 'pending_long'
  | 'approved'
  | 'rejected'
  | 'error';

interface WaitlistState {
  // View state
  viewState: WaitlistViewState;

  // User info (from auth)
  userName: string;

  // Referral code input (4 characters)
  referralCode: string[];

  // Referral state
  isReferralExpanded: boolean;
  isApplyingReferral: boolean;
  referralApplied: boolean;
  referralError: string | null;

  // UI state
  showConfetti: boolean;

  // Countdown timer for rejected state
  nextApplicationCountdown: number;

  // Error state
  error: {
    code: string;
    message: string;
  } | null;
}

interface WaitlistActions {
  // View state
  setViewState: (state: WaitlistViewState) => void;

  // User info
  setUserName: (name: string) => void;

  // Referral code
  setReferralCode: (code: string[]) => void;
  setReferralCharacter: (index: number, char: string) => void;
  clearReferralCode: () => void;

  // Referral state
  toggleReferralExpanded: () => void;
  setReferralExpanded: (expanded: boolean) => void;
  setApplyingReferral: (applying: boolean) => void;
  setReferralApplied: (applied: boolean) => void;
  setReferralError: (error: string | null) => void;

  // UI state
  setShowConfetti: (show: boolean) => void;

  // Countdown
  setCountdown: (seconds: number) => void;
  decrementCountdown: () => void;

  // Error handling
  setError: (code: string, message: string) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

type WaitlistStore = WaitlistState & WaitlistActions;

// ==============================================
// INITIAL STATE
// ==============================================

const initialState: WaitlistState = {
  viewState: 'loading',
  userName: '',
  referralCode: ['', '', '', ''],
  isReferralExpanded: false,
  isApplyingReferral: false,
  referralApplied: false,
  referralError: null,
  showConfetti: false,
  nextApplicationCountdown: 0,
  error: null,
};

// ==============================================
// STORE
// ==============================================

export const useWaitlistStore = create<WaitlistStore>()(
  immer((set) => ({
    ...initialState,

    setViewState: (viewState) =>
      set((state) => {
        state.viewState = viewState;
        state.error = null;
      }),

    setUserName: (name) =>
      set((state) => {
        state.userName = name;
      }),

    setReferralCode: (code) =>
      set((state) => {
        state.referralCode = code;
        state.referralError = null;
      }),

    setReferralCharacter: (index, char) =>
      set((state) => {
        if (index >= 0 && index < 4) {
          // Only accept alphanumeric characters, uppercase
          const filtered = char.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
          state.referralCode[index] = filtered;
          state.referralError = null;
        }
      }),

    clearReferralCode: () =>
      set((state) => {
        state.referralCode = ['', '', '', ''];
        state.referralError = null;
      }),

    toggleReferralExpanded: () =>
      set((state) => {
        state.isReferralExpanded = !state.isReferralExpanded;
      }),

    setReferralExpanded: (expanded) =>
      set((state) => {
        state.isReferralExpanded = expanded;
      }),

    setApplyingReferral: (applying) =>
      set((state) => {
        state.isApplyingReferral = applying;
      }),

    setReferralApplied: (applied) =>
      set((state) => {
        state.referralApplied = applied;
        if (applied) {
          state.referralError = null;
        }
      }),

    setReferralError: (error) =>
      set((state) => {
        state.referralError = error;
      }),

    setShowConfetti: (show) =>
      set((state) => {
        state.showConfetti = show;
      }),

    setCountdown: (seconds) =>
      set((state) => {
        state.nextApplicationCountdown = Math.max(0, seconds);
      }),

    decrementCountdown: () =>
      set((state) => {
        if (state.nextApplicationCountdown > 0) {
          state.nextApplicationCountdown -= 1;
        }
      }),

    setError: (code, message) =>
      set((state) => {
        state.error = { code, message };
        state.viewState = 'error';
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
        if (state.viewState === 'error') {
          state.viewState = 'pending';
        }
      }),

    reset: () => set(initialState),
  }))
);

// ==============================================
// SELECTORS
// ==============================================

export const selectViewState = (state: WaitlistStore) => state.viewState;
export const selectUserName = (state: WaitlistStore) => state.userName;
export const selectReferralCode = (state: WaitlistStore) => state.referralCode;
export const selectReferralCodeString = (state: WaitlistStore) => state.referralCode.join('');
export const selectIsReferralComplete = (state: WaitlistStore) =>
  state.referralCode.every((char) => char.length > 0);
export const selectIsApplyingReferral = (state: WaitlistStore) => state.isApplyingReferral;
export const selectReferralError = (state: WaitlistStore) => state.referralError;
export const selectShowConfetti = (state: WaitlistStore) => state.showConfetti;
export const selectError = (state: WaitlistStore) => state.error;

/**
 * Format countdown as DD:HH:MM:SS (for multi-day countdowns like 30-day rejection cooldown)
 * or HH:MM:SS (for countdowns under 24 hours).
 */
export const selectCountdownText = (state: WaitlistStore) => {
  const totalSeconds = state.nextApplicationCountdown;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};
