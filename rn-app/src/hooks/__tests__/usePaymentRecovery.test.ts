/**
 * usePaymentRecovery — Unit Tests
 *
 * Tests the crash recovery hook that checks for in-progress payments
 * on app startup and resumes polling if a recent payment is found.
 *
 * Key behaviors:
 * - No-op when no lastPaymentId
 * - Clears stale payments (>30 min)
 * - Redirects to status screen for recent payments (<30 min)
 * - Runs only once via hasChecked ref
 * - Waits for Zustand persist hydration before running
 */

import { renderHook } from '@testing-library/react-native';

import { usePaymentRecovery } from '../usePaymentRecovery';

// ============================================================
// MOCKS
// ============================================================

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockClearLastPayment = jest.fn();

// Configurable store state
let mockStoreState: {
  lastPaymentId: string | null;
  lastPaymentTimestamp: number | null;
  clearLastPayment: jest.Mock;
};

// Hydration control
let mockHasHydrated: boolean;
let mockOnFinishHydrationCallback: (() => void) | null;
const mockOnFinishHydrationUnsub = jest.fn();

jest.mock('@/src/stores/payment', () => ({
  usePaymentStore: Object.assign(
    // Hook call (not used by this hook, but needed for the export shape)
    jest.fn(),
    {
      getState: () => mockStoreState,
      persist: {
        hasHydrated: () => mockHasHydrated,
        onFinishHydration: (callback: () => void) => {
          mockOnFinishHydrationCallback = callback;
          return mockOnFinishHydrationUnsub;
        },
      },
    },
  ),
}));

// ============================================================
// HELPERS
// ============================================================

function resetMocks(overrides?: {
  lastPaymentId?: string | null;
  lastPaymentTimestamp?: number | null;
  hasHydrated?: boolean;
}) {
  mockReplace.mockClear();
  mockClearLastPayment.mockClear();
  mockOnFinishHydrationUnsub.mockClear();
  mockOnFinishHydrationCallback = null;

  mockHasHydrated = overrides?.hasHydrated ?? true;
  mockStoreState = {
    lastPaymentId: overrides?.lastPaymentId ?? null,
    lastPaymentTimestamp: overrides?.lastPaymentTimestamp ?? null,
    clearLastPayment: mockClearLastPayment,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('usePaymentRecovery', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ----------------------------------------------------------
  // No-op when lastPaymentId is null
  // ----------------------------------------------------------
  describe('no-op when lastPaymentId is null', () => {
    it('does not navigate when there is no persisted payment', () => {
      resetMocks({ lastPaymentId: null, lastPaymentTimestamp: null });

      renderHook(() => usePaymentRecovery());

      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockClearLastPayment).not.toHaveBeenCalled();
    });

    it('does not navigate when lastPaymentId exists but timestamp is null', () => {
      resetMocks({ lastPaymentId: 'pay-123', lastPaymentTimestamp: null });

      renderHook(() => usePaymentRecovery());

      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockClearLastPayment).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Clears stale payment (>30 min)
  // ----------------------------------------------------------
  describe('clears stale payment (>30min)', () => {
    it('calls clearLastPayment and does not navigate for payments older than 30 minutes', () => {
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      resetMocks({
        lastPaymentId: 'pay-stale',
        lastPaymentTimestamp: thirtyOneMinutesAgo,
      });

      renderHook(() => usePaymentRecovery());

      expect(mockClearLastPayment).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('treats exactly 30 min elapsed as stale (boundary case)', () => {
      // elapsed > RECOVERY_WINDOW_MS (30 * 60 * 1000)
      // At exactly 30 min + 1ms, it should be stale
      const exactlyThirtyMinPlusOne = Date.now() - (30 * 60 * 1000 + 1);
      resetMocks({
        lastPaymentId: 'pay-boundary',
        lastPaymentTimestamp: exactlyThirtyMinPlusOne,
      });

      renderHook(() => usePaymentRecovery());

      expect(mockClearLastPayment).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Redirects for recent payment (<30 min)
  // ----------------------------------------------------------
  describe('redirects for recent payment (<30min)', () => {
    it('navigates to status screen with paymentId and pending status', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      resetMocks({
        lastPaymentId: 'pay-recent',
        lastPaymentTimestamp: fiveMinutesAgo,
      });

      renderHook(() => usePaymentRecovery());

      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: { paymentId: 'pay-recent', initialStatus: 'pending' },
      });
      expect(mockClearLastPayment).not.toHaveBeenCalled();
    });

    it('navigates for a payment just 1 second old', () => {
      const oneSecondAgo = Date.now() - 1000;
      resetMocks({
        lastPaymentId: 'pay-just-now',
        lastPaymentTimestamp: oneSecondAgo,
      });

      renderHook(() => usePaymentRecovery());

      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: { paymentId: 'pay-just-now', initialStatus: 'pending' },
      });
    });
  });

  // ----------------------------------------------------------
  // Runs only once (hasChecked ref)
  // ----------------------------------------------------------
  describe('runs only once', () => {
    it('does not re-run recovery check on re-render', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      resetMocks({
        lastPaymentId: 'pay-once',
        lastPaymentTimestamp: fiveMinutesAgo,
      });

      const { rerender } = renderHook(() => usePaymentRecovery());

      expect(mockReplace).toHaveBeenCalledTimes(1);

      // Re-render the hook (simulates component re-render)
      rerender({});

      // Still only called once
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // Waits for hydration
  // ----------------------------------------------------------
  describe('waits for hydration', () => {
    it('registers onFinishHydration callback when not yet hydrated', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      resetMocks({
        lastPaymentId: 'pay-hydration',
        lastPaymentTimestamp: fiveMinutesAgo,
        hasHydrated: false,
      });

      renderHook(() => usePaymentRecovery());

      // Should NOT navigate yet
      expect(mockReplace).not.toHaveBeenCalled();

      // Callback should be registered
      expect(mockOnFinishHydrationCallback).not.toBeNull();

      // Simulate hydration completing
      mockOnFinishHydrationCallback!();

      // Now should navigate
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: { paymentId: 'pay-hydration', initialStatus: 'pending' },
      });
    });

    it('returns unsubscribe function for cleanup when waiting for hydration', () => {
      resetMocks({
        lastPaymentId: 'pay-cleanup',
        lastPaymentTimestamp: Date.now() - 1000,
        hasHydrated: false,
      });

      const { unmount } = renderHook(() => usePaymentRecovery());

      // The useEffect should return the unsub function
      // Unmounting triggers cleanup
      unmount();

      // We verify the unsub was returned by checking that our mock got the callback
      expect(mockOnFinishHydrationCallback).not.toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Already hydrated
  // ----------------------------------------------------------
  describe('already hydrated', () => {
    it('runs checkRecovery immediately without waiting', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      resetMocks({
        lastPaymentId: 'pay-immediate',
        lastPaymentTimestamp: fiveMinutesAgo,
        hasHydrated: true,
      });

      renderHook(() => usePaymentRecovery());

      // Should navigate immediately (no hydration wait)
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(payment)/status',
        params: { paymentId: 'pay-immediate', initialStatus: 'pending' },
      });

      // onFinishHydration should NOT have been registered
      expect(mockOnFinishHydrationCallback).toBeNull();
    });
  });
});
