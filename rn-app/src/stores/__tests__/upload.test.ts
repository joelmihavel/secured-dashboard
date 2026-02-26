/**
 * Upload Store -- Unit Tests
 *
 * Tests the Zustand upload state management store for agreement uploads.
 * Covers actions, selectors, staleness detection, and persistence partialize.
 */

import { act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  useUploadStore,
  selectUploadPhase,
  selectExtractionId,
  selectUploadFileName,
  selectHasHydrated,
  selectIsUploadActive,
  selectIsServerProcessing,
} from '../upload';
import type { UploadPhase } from '../upload';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALENESS_MS = 10 * 60 * 1000; // 10 minutes -- matches source

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadStore', () => {
  beforeEach(() => {
    act(() => {
      useUploadStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct default values', () => {
      const state = useUploadStore.getState();
      expect(state.uploadPhase).toBe('idle');
      expect(state.extractionId).toBeNull();
      expect(state.fileName).toBeNull();
      expect(state.lastUpdatedAt).toBe(0);
      expect(state.errorCode).toBeNull();
      expect(state.errorMessage).toBeNull();
    });
  });

  // ===================================================
  // ACTIONS
  // ===================================================

  describe('startUpload', () => {
    it('sets phase to requesting_url, sets fileName, updates timestamp, clears errors', () => {
      // Pre-set an error to verify it gets cleared
      act(() => {
        useUploadStore.getState().setError('ERR_UPLOAD', 'Previous error');
      });

      const beforeTime = Date.now();

      act(() => {
        useUploadStore.getState().startUpload('lease-agreement.pdf');
      });

      const state = useUploadStore.getState();
      expect(state.uploadPhase).toBe('requesting_url');
      expect(state.fileName).toBe('lease-agreement.pdf');
      expect(state.lastUpdatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(state.errorCode).toBeNull();
      expect(state.errorMessage).toBeNull();
    });
  });

  describe('setExtractionId', () => {
    it('sets extraction id and updates timestamp', () => {
      const beforeTime = Date.now();

      act(() => {
        useUploadStore.getState().setExtractionId('ext_12345');
      });

      const state = useUploadStore.getState();
      expect(state.extractionId).toBe('ext_12345');
      expect(state.lastUpdatedAt).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('setPhase', () => {
    const phases: UploadPhase[] = [
      'idle',
      'requesting_url',
      'uploading_file',
      'processing',
      'server_processing',
      'completed',
      'failed',
    ];

    it.each(phases)('transitions to %s phase', (phase) => {
      act(() => {
        useUploadStore.getState().setPhase(phase);
      });

      expect(useUploadStore.getState().uploadPhase).toBe(phase);
    });

    it('clears errors when advancing to a non-failed phase', () => {
      // First set an error
      act(() => {
        useUploadStore.getState().setError('ERR_NET', 'Network error');
      });

      expect(useUploadStore.getState().errorCode).toBe('ERR_NET');

      // Transition to a non-failed phase
      act(() => {
        useUploadStore.getState().setPhase('uploading_file');
      });

      const state = useUploadStore.getState();
      expect(state.errorCode).toBeNull();
      expect(state.errorMessage).toBeNull();
    });

    it('does NOT clear errors when transitioning to failed phase', () => {
      act(() => {
        useUploadStore.getState().setError('ERR_OCR', 'OCR failed');
      });

      act(() => {
        useUploadStore.getState().setPhase('failed');
      });

      const state = useUploadStore.getState();
      // errorCode/errorMessage should remain from setError
      expect(state.errorCode).toBe('ERR_OCR');
      expect(state.errorMessage).toBe('OCR failed');
    });

    it('updates lastUpdatedAt on each phase change', () => {
      act(() => {
        useUploadStore.getState().setPhase('processing');
      });

      const firstTimestamp = useUploadStore.getState().lastUpdatedAt;

      // Advance time slightly
      jest.advanceTimersByTime(100);

      act(() => {
        useUploadStore.getState().setPhase('server_processing');
      });

      const secondTimestamp = useUploadStore.getState().lastUpdatedAt;
      expect(secondTimestamp).toBeGreaterThanOrEqual(firstTimestamp);
    });
  });

  describe('setError', () => {
    it('sets phase to failed, sets errorCode and errorMessage, updates timestamp', () => {
      const beforeTime = Date.now();

      act(() => {
        useUploadStore.getState().setError('UPLOAD_TIMEOUT', 'Upload timed out after 60s');
      });

      const state = useUploadStore.getState();
      expect(state.uploadPhase).toBe('failed');
      expect(state.errorCode).toBe('UPLOAD_TIMEOUT');
      expect(state.errorMessage).toBe('Upload timed out after 60s');
      expect(state.lastUpdatedAt).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('reset', () => {
    it('resets all fields to initial values', () => {
      // Set up a dirty state
      act(() => {
        useUploadStore.getState().startUpload('test.pdf');
        useUploadStore.getState().setExtractionId('ext_999');
        useUploadStore.getState().setPhase('processing');
      });

      act(() => {
        useUploadStore.getState().reset();
      });

      const state = useUploadStore.getState();
      expect(state.extractionId).toBeNull();
      expect(state.uploadPhase).toBe('idle');
      expect(state.fileName).toBeNull();
      expect(state.lastUpdatedAt).toBe(0);
      expect(state.errorCode).toBeNull();
      expect(state.errorMessage).toBeNull();
    });

    it('does NOT reset _hasHydrated once set to true', () => {
      act(() => {
        useUploadStore.getState().setHasHydrated(true);
      });

      act(() => {
        useUploadStore.getState().reset();
      });

      expect(useUploadStore.getState()._hasHydrated).toBe(true);
    });
  });

  // ===================================================
  // STALENESS
  // ===================================================

  describe('isStale', () => {
    it('returns false for idle phase', () => {
      // idle is the default
      expect(useUploadStore.getState().isStale()).toBe(false);
    });

    it('returns false for completed phase', () => {
      act(() => {
        useUploadStore.getState().setPhase('completed');
      });

      // Even with old timestamp, completed is never stale
      expect(useUploadStore.getState().isStale()).toBe(false);
    });

    it('returns false when lastUpdatedAt is 0', () => {
      // Force an active phase but keep lastUpdatedAt at 0
      act(() => {
        useUploadStore.setState({ uploadPhase: 'processing', lastUpdatedAt: 0 });
      });

      expect(useUploadStore.getState().isStale()).toBe(false);
    });

    it('returns false for active phase within staleness window', () => {
      act(() => {
        useUploadStore.getState().startUpload('fresh.pdf');
      });

      // Just started -- should not be stale
      expect(useUploadStore.getState().isStale()).toBe(false);
    });

    it('returns true for active phase after 10 minutes', () => {
      act(() => {
        useUploadStore.getState().startUpload('old.pdf');
      });

      // Advance past staleness window
      jest.advanceTimersByTime(STALENESS_MS + 1);

      expect(useUploadStore.getState().isStale()).toBe(true);
    });

    it.each([
      'requesting_url',
      'uploading_file',
      'processing',
      'server_processing',
      'failed',
    ] as UploadPhase[])('returns true for %s phase after staleness window', (phase) => {
      act(() => {
        useUploadStore.getState().setPhase(phase);
      });

      jest.advanceTimersByTime(STALENESS_MS + 1);

      expect(useUploadStore.getState().isStale()).toBe(true);
    });
  });

  // ===================================================
  // PERSISTENCE PARTIALIZE
  // ===================================================

  describe('persistence partialize', () => {
    it('excludes _hasHydrated from persisted state', () => {
      // The persist middleware's partialize function is configured on the store.
      // We can verify by checking the persist API.
      const persistOptions = useUploadStore.persist;
      const state = useUploadStore.getState();

      // Get the partialize function from the persist options
      // and verify _hasHydrated is not included
      const partializedState = persistOptions.getOptions().partialize?.(state) ?? state;

      expect(partializedState).not.toHaveProperty('_hasHydrated');
      expect(partializedState).toHaveProperty('extractionId');
      expect(partializedState).toHaveProperty('uploadPhase');
      expect(partializedState).toHaveProperty('fileName');
      expect(partializedState).toHaveProperty('lastUpdatedAt');
      expect(partializedState).toHaveProperty('errorCode');
      expect(partializedState).toHaveProperty('errorMessage');
    });

    it('excludes action functions from persisted state', () => {
      const state = useUploadStore.getState();
      const partializedState = useUploadStore.persist.getOptions().partialize?.(state) ?? state;

      expect(partializedState).not.toHaveProperty('startUpload');
      expect(partializedState).not.toHaveProperty('setExtractionId');
      expect(partializedState).not.toHaveProperty('setPhase');
      expect(partializedState).not.toHaveProperty('setError');
      expect(partializedState).not.toHaveProperty('reset');
      expect(partializedState).not.toHaveProperty('isStale');
      expect(partializedState).not.toHaveProperty('setHasHydrated');
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectUploadPhase returns current phase', () => {
      act(() => {
        useUploadStore.getState().setPhase('uploading_file');
      });

      const state = useUploadStore.getState();
      expect(selectUploadPhase(state)).toBe('uploading_file');
    });

    it('selectExtractionId returns extraction id', () => {
      act(() => {
        useUploadStore.getState().setExtractionId('ext_abc');
      });

      const state = useUploadStore.getState();
      expect(selectExtractionId(state)).toBe('ext_abc');
    });

    it('selectUploadFileName returns file name', () => {
      act(() => {
        useUploadStore.getState().startUpload('agreement.pdf');
      });

      const state = useUploadStore.getState();
      expect(selectUploadFileName(state)).toBe('agreement.pdf');
    });

    it('selectHasHydrated returns hydration status', () => {
      const stateBefore = useUploadStore.getState();
      // After reset, _hasHydrated may be true if setHasHydrated was called earlier
      // Test the selector function itself
      expect(selectHasHydrated(stateBefore)).toBe(stateBefore._hasHydrated);

      act(() => {
        useUploadStore.getState().setHasHydrated(true);
      });

      expect(selectHasHydrated(useUploadStore.getState())).toBe(true);
    });

    it('selectIsUploadActive returns true for active non-stale phases', () => {
      act(() => {
        useUploadStore.getState().startUpload('active.pdf');
      });

      const state = useUploadStore.getState();
      expect(selectIsUploadActive(state)).toBe(true);
    });

    it('selectIsUploadActive returns false for idle', () => {
      const state = useUploadStore.getState();
      expect(selectIsUploadActive(state)).toBe(false);
    });

    it('selectIsUploadActive returns false for failed', () => {
      act(() => {
        useUploadStore.getState().setError('ERR', 'fail');
      });

      const state = useUploadStore.getState();
      expect(selectIsUploadActive(state)).toBe(false);
    });

    it('selectIsUploadActive returns false when stale', () => {
      act(() => {
        useUploadStore.getState().startUpload('stale.pdf');
      });

      jest.advanceTimersByTime(STALENESS_MS + 1);

      const state = useUploadStore.getState();
      expect(selectIsUploadActive(state)).toBe(false);
    });

    it('selectIsServerProcessing returns true for processing phase', () => {
      act(() => {
        useUploadStore.getState().setPhase('processing');
      });

      const state = useUploadStore.getState();
      expect(selectIsServerProcessing(state)).toBe(true);
    });

    it('selectIsServerProcessing returns true for server_processing phase', () => {
      act(() => {
        useUploadStore.getState().setPhase('server_processing');
      });

      const state = useUploadStore.getState();
      expect(selectIsServerProcessing(state)).toBe(true);
    });

    it('selectIsServerProcessing returns false for other phases', () => {
      const nonServerPhases: UploadPhase[] = ['idle', 'requesting_url', 'uploading_file', 'completed', 'failed'];

      for (const phase of nonServerPhases) {
        act(() => {
          useUploadStore.getState().setPhase(phase);
        });

        const state = useUploadStore.getState();
        expect(selectIsServerProcessing(state)).toBe(false);
      }
    });
  });

  // ===================================================
  // setHasHydrated
  // ===================================================

  describe('setHasHydrated', () => {
    it('sets _hasHydrated to provided value', () => {
      act(() => {
        useUploadStore.getState().setHasHydrated(true);
      });

      expect(useUploadStore.getState()._hasHydrated).toBe(true);

      act(() => {
        useUploadStore.getState().setHasHydrated(false);
      });

      expect(useUploadStore.getState()._hasHydrated).toBe(false);
    });
  });
});
