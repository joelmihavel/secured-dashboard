import { act } from '@testing-library/react-native';
import {
  useWaitlistStore,
  selectViewState,
  selectUserName,
  selectReferralCode,
  selectReferralCodeString,
  selectIsReferralComplete,
  selectIsApplyingReferral,
  selectReferralError,
  selectShowConfetti,
  selectError,
  selectCountdownText,
} from '../waitlist';

describe('waitlistStore', () => {
  beforeEach(() => {
    act(() => {
      useWaitlistStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const state = useWaitlistStore.getState();
      expect(state.viewState).toBe('loading');
      expect(state.userName).toBe('');
      expect(state.referralCode).toEqual(['', '', '', '']);
      expect(state.isReferralExpanded).toBe(false);
      expect(state.isApplyingReferral).toBe(false);
      expect(state.referralApplied).toBe(false);
      expect(state.referralError).toBeNull();
      expect(state.showConfetti).toBe(false);
      expect(state.nextApplicationCountdown).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // VIEW STATE ACTIONS
  // ===================================================

  describe('setViewState', () => {
    it('sets view state and clears error', () => {
      act(() => {
        useWaitlistStore.getState().setError('ERR', 'failed');
        useWaitlistStore.getState().setViewState('approved');
      });
      const state = useWaitlistStore.getState();
      expect(state.viewState).toBe('approved');
      expect(state.error).toBeNull();
    });

    it.each(['loading', 'pending', 'pending_long', 'approved', 'rejected', 'error'] as const)(
      'supports view state: %s',
      (viewState) => {
        act(() => {
          useWaitlistStore.getState().setViewState(viewState);
        });
        expect(useWaitlistStore.getState().viewState).toBe(viewState);
      }
    );
  });

  // ===================================================
  // USER NAME
  // ===================================================

  describe('setUserName', () => {
    it('sets user name', () => {
      act(() => {
        useWaitlistStore.getState().setUserName('Atrish');
      });
      expect(useWaitlistStore.getState().userName).toBe('Atrish');
    });

    it('allows updating user name', () => {
      act(() => {
        useWaitlistStore.getState().setUserName('First');
        useWaitlistStore.getState().setUserName('Second');
      });
      expect(useWaitlistStore.getState().userName).toBe('Second');
    });
  });

  // ===================================================
  // REFERRAL CODE ACTIONS
  // ===================================================

  describe('setReferralCode', () => {
    it('sets full referral code', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCode(['A', 'B', 'C', '1']);
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['A', 'B', 'C', '1']);
    });

    it('clears referral error when setting code', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Invalid code');
        useWaitlistStore.getState().setReferralCode(['X', 'Y', 'Z', '9']);
      });
      expect(useWaitlistStore.getState().referralError).toBeNull();
    });
  });

  describe('setReferralCharacter', () => {
    it('sets individual character with uppercase conversion', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, 'a');
        useWaitlistStore.getState().setReferralCharacter(1, 'b');
      });
      const code = useWaitlistStore.getState().referralCode;
      expect(code[0]).toBe('A');
      expect(code[1]).toBe('B');
      expect(code[2]).toBe('');
      expect(code[3]).toBe('');
    });

    it('accepts numeric characters', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, '5');
        useWaitlistStore.getState().setReferralCharacter(1, '9');
      });
      expect(useWaitlistStore.getState().referralCode[0]).toBe('5');
      expect(useWaitlistStore.getState().referralCode[1]).toBe('9');
    });

    it('filters non-alphanumeric characters', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, '@');
        useWaitlistStore.getState().setReferralCharacter(1, '!');
        useWaitlistStore.getState().setReferralCharacter(2, ' ');
        useWaitlistStore.getState().setReferralCharacter(3, '#');
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['', '', '', '']);
    });

    it('only takes first character from multi-char input', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, 'abc');
      });
      expect(useWaitlistStore.getState().referralCode[0]).toBe('A');
    });

    it('ignores out-of-range index (too high)', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(5, 'X');
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['', '', '', '']);
    });

    it('ignores out-of-range index (negative)', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(-1, 'Y');
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['', '', '', '']);
    });

    it('ignores index at boundary (index 4)', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(4, 'Z');
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['', '', '', '']);
    });

    it('clears referral error when setting character', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Bad code');
        useWaitlistStore.getState().setReferralCharacter(0, 'A');
      });
      expect(useWaitlistStore.getState().referralError).toBeNull();
    });
  });

  describe('clearReferralCode', () => {
    it('clears all referral code characters', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCode(['A', 'B', 'C', 'D']);
        useWaitlistStore.getState().clearReferralCode();
      });
      expect(useWaitlistStore.getState().referralCode).toEqual(['', '', '', '']);
    });

    it('clears referral error', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Some error');
        useWaitlistStore.getState().clearReferralCode();
      });
      expect(useWaitlistStore.getState().referralError).toBeNull();
    });
  });

  // ===================================================
  // REFERRAL EXPANSION ACTIONS
  // ===================================================

  describe('toggleReferralExpanded', () => {
    it('toggles from false to true', () => {
      act(() => {
        useWaitlistStore.getState().toggleReferralExpanded();
      });
      expect(useWaitlistStore.getState().isReferralExpanded).toBe(true);
    });

    it('toggles from true back to false', () => {
      act(() => {
        useWaitlistStore.getState().toggleReferralExpanded();
        useWaitlistStore.getState().toggleReferralExpanded();
      });
      expect(useWaitlistStore.getState().isReferralExpanded).toBe(false);
    });
  });

  describe('setReferralExpanded', () => {
    it('sets expanded to true', () => {
      act(() => {
        useWaitlistStore.getState().setReferralExpanded(true);
      });
      expect(useWaitlistStore.getState().isReferralExpanded).toBe(true);
    });

    it('sets expanded to false', () => {
      act(() => {
        useWaitlistStore.getState().setReferralExpanded(true);
        useWaitlistStore.getState().setReferralExpanded(false);
      });
      expect(useWaitlistStore.getState().isReferralExpanded).toBe(false);
    });
  });

  // ===================================================
  // REFERRAL STATE ACTIONS
  // ===================================================

  describe('setApplyingReferral', () => {
    it('sets applying to true', () => {
      act(() => {
        useWaitlistStore.getState().setApplyingReferral(true);
      });
      expect(useWaitlistStore.getState().isApplyingReferral).toBe(true);
    });

    it('sets applying to false', () => {
      act(() => {
        useWaitlistStore.getState().setApplyingReferral(true);
        useWaitlistStore.getState().setApplyingReferral(false);
      });
      expect(useWaitlistStore.getState().isApplyingReferral).toBe(false);
    });
  });

  describe('setReferralApplied', () => {
    it('sets applied to true and clears referral error', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Previous error');
        useWaitlistStore.getState().setReferralApplied(true);
      });
      const state = useWaitlistStore.getState();
      expect(state.referralApplied).toBe(true);
      expect(state.referralError).toBeNull();
    });

    it('sets applied to false without clearing referral error', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Some error');
        useWaitlistStore.getState().setReferralApplied(false);
      });
      const state = useWaitlistStore.getState();
      expect(state.referralApplied).toBe(false);
      // When applied=false, referralError is NOT cleared per the implementation
      expect(state.referralError).toBe('Some error');
    });
  });

  describe('setReferralError', () => {
    it('sets referral error string', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Invalid referral code');
      });
      expect(useWaitlistStore.getState().referralError).toBe('Invalid referral code');
    });

    it('clears referral error with null', () => {
      act(() => {
        useWaitlistStore.getState().setReferralError('Error');
        useWaitlistStore.getState().setReferralError(null);
      });
      expect(useWaitlistStore.getState().referralError).toBeNull();
    });
  });

  // ===================================================
  // UI STATE ACTIONS
  // ===================================================

  describe('setShowConfetti', () => {
    it('sets confetti to true', () => {
      act(() => {
        useWaitlistStore.getState().setShowConfetti(true);
      });
      expect(useWaitlistStore.getState().showConfetti).toBe(true);
    });

    it('sets confetti to false', () => {
      act(() => {
        useWaitlistStore.getState().setShowConfetti(true);
        useWaitlistStore.getState().setShowConfetti(false);
      });
      expect(useWaitlistStore.getState().showConfetti).toBe(false);
    });
  });

  // ===================================================
  // COUNTDOWN ACTIONS
  // ===================================================

  describe('setCountdown', () => {
    it('sets countdown value', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(3600);
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(3600);
    });

    it('clamps negative values to 0', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(-5);
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(0);
    });

    it('accepts zero', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(100);
        useWaitlistStore.getState().setCountdown(0);
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(0);
    });
  });

  describe('decrementCountdown', () => {
    it('decrements countdown by 1', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(10);
        useWaitlistStore.getState().decrementCountdown();
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(9);
    });

    it('does not decrement below 0', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(0);
        useWaitlistStore.getState().decrementCountdown();
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(0);
    });

    it('decrements from 1 to 0 and stops', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(1);
        useWaitlistStore.getState().decrementCountdown();
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(0);

      act(() => {
        useWaitlistStore.getState().decrementCountdown();
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(0);
    });

    it('decrements multiple times correctly', () => {
      act(() => {
        useWaitlistStore.getState().setCountdown(5);
        useWaitlistStore.getState().decrementCountdown();
        useWaitlistStore.getState().decrementCountdown();
        useWaitlistStore.getState().decrementCountdown();
      });
      expect(useWaitlistStore.getState().nextApplicationCountdown).toBe(2);
    });
  });

  // ===================================================
  // ERROR HANDLING ACTIONS
  // ===================================================

  describe('setError', () => {
    it('sets error and transitions viewState to error', () => {
      act(() => {
        useWaitlistStore.getState().setError('ERR', 'Something went wrong');
      });
      const state = useWaitlistStore.getState();
      expect(state.error).toEqual({ code: 'ERR', message: 'Something went wrong' });
      expect(state.viewState).toBe('error');
    });

    it('overwrites previous error', () => {
      act(() => {
        useWaitlistStore.getState().setError('ERR_1', 'First');
        useWaitlistStore.getState().setError('ERR_2', 'Second');
      });
      expect(useWaitlistStore.getState().error).toEqual({ code: 'ERR_2', message: 'Second' });
    });
  });

  describe('clearError', () => {
    it('clears error and returns viewState to pending from error state', () => {
      act(() => {
        useWaitlistStore.getState().setError('ERR', 'Something went wrong');
      });
      expect(useWaitlistStore.getState().viewState).toBe('error');

      act(() => {
        useWaitlistStore.getState().clearError();
      });
      const state = useWaitlistStore.getState();
      expect(state.error).toBeNull();
      expect(state.viewState).toBe('pending');
    });

    it('does not change viewState when not in error state', () => {
      act(() => {
        useWaitlistStore.getState().setViewState('approved');
      });

      act(() => {
        useWaitlistStore.getState().clearError();
      });
      expect(useWaitlistStore.getState().viewState).toBe('approved');
    });

    it('is a no-op when there is no error', () => {
      act(() => {
        useWaitlistStore.getState().setViewState('pending');
      });
      act(() => {
        useWaitlistStore.getState().clearError();
      });
      expect(useWaitlistStore.getState().error).toBeNull();
      expect(useWaitlistStore.getState().viewState).toBe('pending');
    });
  });

  // ===================================================
  // RESET ACTION
  // ===================================================

  describe('reset', () => {
    it('resets all fields to initial state', () => {
      act(() => {
        useWaitlistStore.getState().setViewState('approved');
        useWaitlistStore.getState().setUserName('TestUser');
        useWaitlistStore.getState().setReferralCode(['A', 'B', 'C', 'D']);
        useWaitlistStore.getState().setReferralExpanded(true);
        useWaitlistStore.getState().setApplyingReferral(true);
        useWaitlistStore.getState().setReferralApplied(true);
        useWaitlistStore.getState().setShowConfetti(true);
        useWaitlistStore.getState().setCountdown(500);
        useWaitlistStore.getState().setError('ERR', 'Error');
      });

      act(() => {
        useWaitlistStore.getState().reset();
      });

      const state = useWaitlistStore.getState();
      expect(state.viewState).toBe('loading');
      expect(state.userName).toBe('');
      expect(state.referralCode).toEqual(['', '', '', '']);
      expect(state.isReferralExpanded).toBe(false);
      expect(state.isApplyingReferral).toBe(false);
      expect(state.referralApplied).toBe(false);
      expect(state.referralError).toBeNull();
      expect(state.showConfetti).toBe(false);
      expect(state.nextApplicationCountdown).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectViewState returns current view state', () => {
      expect(selectViewState(useWaitlistStore.getState())).toBe('loading');

      act(() => {
        useWaitlistStore.getState().setViewState('approved');
      });
      expect(selectViewState(useWaitlistStore.getState())).toBe('approved');
    });

    it('selectUserName returns current user name', () => {
      expect(selectUserName(useWaitlistStore.getState())).toBe('');

      act(() => {
        useWaitlistStore.getState().setUserName('Atrish');
      });
      expect(selectUserName(useWaitlistStore.getState())).toBe('Atrish');
    });

    it('selectReferralCode returns referral code array', () => {
      expect(selectReferralCode(useWaitlistStore.getState())).toEqual(['', '', '', '']);

      act(() => {
        useWaitlistStore.getState().setReferralCode(['W', 'X', 'Y', 'Z']);
      });
      expect(selectReferralCode(useWaitlistStore.getState())).toEqual(['W', 'X', 'Y', 'Z']);
    });

    it('selectReferralCodeString joins the code array', () => {
      expect(selectReferralCodeString(useWaitlistStore.getState())).toBe('');

      act(() => {
        useWaitlistStore.getState().setReferralCode(['A', 'B', 'C', 'D']);
      });
      expect(selectReferralCodeString(useWaitlistStore.getState())).toBe('ABCD');
    });

    it('selectReferralCodeString returns partial string for incomplete code', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, 'A');
        useWaitlistStore.getState().setReferralCharacter(1, 'B');
      });
      expect(selectReferralCodeString(useWaitlistStore.getState())).toBe('AB');
    });

    it('selectIsReferralComplete returns false when not all chars filled', () => {
      expect(selectIsReferralComplete(useWaitlistStore.getState())).toBe(false);

      act(() => {
        useWaitlistStore.getState().setReferralCharacter(0, 'A');
        useWaitlistStore.getState().setReferralCharacter(1, 'B');
      });
      expect(selectIsReferralComplete(useWaitlistStore.getState())).toBe(false);
    });

    it('selectIsReferralComplete returns true when all chars filled', () => {
      act(() => {
        useWaitlistStore.getState().setReferralCode(['A', 'B', 'C', 'D']);
      });
      expect(selectIsReferralComplete(useWaitlistStore.getState())).toBe(true);
    });

    it('selectIsApplyingReferral returns current applying state', () => {
      expect(selectIsApplyingReferral(useWaitlistStore.getState())).toBe(false);

      act(() => {
        useWaitlistStore.getState().setApplyingReferral(true);
      });
      expect(selectIsApplyingReferral(useWaitlistStore.getState())).toBe(true);
    });

    it('selectReferralError returns current referral error', () => {
      expect(selectReferralError(useWaitlistStore.getState())).toBeNull();

      act(() => {
        useWaitlistStore.getState().setReferralError('Invalid code');
      });
      expect(selectReferralError(useWaitlistStore.getState())).toBe('Invalid code');
    });

    it('selectShowConfetti returns confetti state', () => {
      expect(selectShowConfetti(useWaitlistStore.getState())).toBe(false);

      act(() => {
        useWaitlistStore.getState().setShowConfetti(true);
      });
      expect(selectShowConfetti(useWaitlistStore.getState())).toBe(true);
    });

    it('selectError returns error object', () => {
      expect(selectError(useWaitlistStore.getState())).toBeNull();

      act(() => {
        useWaitlistStore.getState().setError('NET', 'Network error');
      });
      expect(selectError(useWaitlistStore.getState())).toEqual({
        code: 'NET',
        message: 'Network error',
      });
    });

    describe('selectCountdownText', () => {
      it('formats zero as 00:00:00', () => {
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('00:00:00');
      });

      it('formats hours, minutes, seconds correctly', () => {
        act(() => {
          useWaitlistStore.getState().setCountdown(3661); // 1h 1m 1s
        });
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('01:01:01');
      });

      it('formats large values correctly', () => {
        act(() => {
          useWaitlistStore.getState().setCountdown(86399); // 23h 59m 59s
        });
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('23:59:59');
      });

      it('formats minutes and seconds only', () => {
        act(() => {
          useWaitlistStore.getState().setCountdown(754); // 12m 34s
        });
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('00:12:34');
      });

      it('formats seconds only', () => {
        act(() => {
          useWaitlistStore.getState().setCountdown(45);
        });
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('00:00:45');
      });

      it('formats exactly one hour', () => {
        act(() => {
          useWaitlistStore.getState().setCountdown(3600);
        });
        expect(selectCountdownText(useWaitlistStore.getState())).toBe('01:00:00');
      });
    });
  });
});
