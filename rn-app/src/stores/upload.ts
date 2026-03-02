/**
 * Upload Store
 *
 * Persisted Zustand store for agreement upload state management.
 * Survives app kills and backgrounding — prevents flash on resume.
 *
 * Uses expo-secure-store for persistence (same as Supabase auth session).
 * Serialized state is ~200 bytes — well under SecureStore's 2KB iOS limit.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// ==============================================
// TYPES
// ==============================================

export type UploadPhase =
  | 'idle'               // No upload in progress
  | 'requesting_url'     // Step 1: calling upload-document for signed URL
  | 'uploading_file'     // Step 2: XHR PUT to signed URL
  | 'processing'         // Step 3: process-document called, awaiting OCR/AI
  | 'server_processing'  // Handed off to backend — useExtractionStatus drives UI
  | 'completed'          // Extraction completed, ready for review
  | 'failed';            // Any step failed

interface UploadState {
  extractionId: string | null;
  uploadPhase: UploadPhase;
  fileName: string | null;
  lastUpdatedAt: number;       // Date.now() of last phase change
  errorCode: string | null;
  errorMessage: string | null;
  /** Extraction ID the user explicitly abandoned via "Re-upload".
   *  useMountDiscovery skips this ID so it won't resurrect the old record. */
  dismissedExtractionId: string | null;
  _hasHydrated: boolean;
}

interface UploadActions {
  startUpload: (fileName: string) => void;
  setExtractionId: (id: string) => void;
  setPhase: (phase: UploadPhase) => void;
  setError: (code: string, message: string) => void;
  reset: () => void;
  isStale: () => boolean;
  setHasHydrated: (v: boolean) => void;
}

type UploadStore = UploadState & UploadActions;

// ==============================================
// CONSTANTS
// ==============================================

const STALENESS_MS = 10 * 60 * 1000; // 10 minutes (2x backend's 5-min reset)
/** BUG 5 FIX: Completed-but-unconfirmed extractions go stale after 24 hours */
const COMPLETED_STALENESS_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'flent-upload-state';

// ==============================================
// SECURE STORE ADAPTER
// ==============================================

const secureStoreAdapter: StateStorage = {
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
      // Silent fail — upload state is recoverable from DB
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silent fail
    }
  },
};

// ==============================================
// INITIAL STATE
// ==============================================

const initialState: UploadState = {
  extractionId: null,
  uploadPhase: 'idle',
  fileName: null,
  lastUpdatedAt: 0,
  errorCode: null,
  errorMessage: null,
  dismissedExtractionId: null,
  _hasHydrated: false,
};

// ==============================================
// STORE
// ==============================================

export const useUploadStore = create<UploadStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      startUpload: (fileName) =>
        set((state) => {
          state.uploadPhase = 'requesting_url';
          state.fileName = fileName;
          state.lastUpdatedAt = Date.now();
          state.errorCode = null;
          state.errorMessage = null;
          state.dismissedExtractionId = null; // new upload = fresh start
        }),

      setExtractionId: (id) =>
        set((state) => {
          state.extractionId = id;
          state.lastUpdatedAt = Date.now();
        }),

      setPhase: (phase) =>
        set((state) => {
          state.uploadPhase = phase;
          state.lastUpdatedAt = Date.now();
          // Clear error when advancing to a non-failed phase
          if (phase !== 'failed') {
            state.errorCode = null;
            state.errorMessage = null;
          }
        }),

      setError: (code, message) =>
        set((state) => {
          state.uploadPhase = 'failed';
          state.errorCode = code;
          state.errorMessage = message;
          state.lastUpdatedAt = Date.now();
        }),

      reset: () =>
        set((state) => {
          // Remember the abandoned extraction so useMountDiscovery won't resurrect it.
          // CRITICAL: Only overwrite dismissedExtractionId if we have a real extractionId.
          // Without this guard, a double-reset (extractionStatus.reset() then agreement.resetUpload())
          // erases the dismissed marker — the second call finds extractionId=null and sets
          // dismissedExtractionId=null, allowing useMountDiscovery to resurrect the old record.
          if (state.extractionId) {
            state.dismissedExtractionId = state.extractionId;
          }
          state.extractionId = null;
          state.uploadPhase = 'idle';
          state.fileName = null;
          state.lastUpdatedAt = 0;
          state.errorCode = null;
          state.errorMessage = null;
          // Note: _hasHydrated is NOT reset — it stays true once set
        }),

      isStale: () => {
        const { uploadPhase, lastUpdatedAt } = get();
        if (uploadPhase === 'idle') return false;
        if (lastUpdatedAt === 0) return false;
        // BUG 5 FIX: Completed phase goes stale after 24 hours —
        // abandoned completed extractions won't persist forever.
        if (uploadPhase === 'completed') {
          return Date.now() - lastUpdatedAt > COMPLETED_STALENESS_MS;
        }
        return Date.now() - lastUpdatedAt > STALENESS_MS;
      },

      setHasHydrated: (v) =>
        set((state) => {
          state._hasHydrated = v;
        }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStoreAdapter),
      // Only persist what we need — exclude _hasHydrated (runtime-only)
      partialize: (state) => ({
        extractionId: state.extractionId,
        uploadPhase: state.uploadPhase,
        fileName: state.fileName,
        lastUpdatedAt: state.lastUpdatedAt,
        errorCode: state.errorCode,
        errorMessage: state.errorMessage,
        dismissedExtractionId: state.dismissedExtractionId,
      }),
      onRehydrateStorage: () => (state) => {
        // Auto-reset stale non-completed uploads on hydration
        if (state && state.isStale()) {
          state.reset();
        }
        // Mark hydration complete — this unblocks the loading gate
        useUploadStore.setState({ _hasHydrated: true });
      },
    }
  )
);

// ==============================================
// SELECTORS
// ==============================================

export const selectUploadPhase = (state: UploadStore) => state.uploadPhase;
export const selectExtractionId = (state: UploadStore) => state.extractionId;
export const selectUploadFileName = (state: UploadStore) => state.fileName;
export const selectHasHydrated = (state: UploadStore) => state._hasHydrated;
export const selectIsUploadActive = (state: UploadStore) =>
  state.uploadPhase !== 'idle' && state.uploadPhase !== 'failed' && !state.isStale();
export const selectIsServerProcessing = (state: UploadStore) =>
  state.uploadPhase === 'server_processing' || state.uploadPhase === 'processing';
