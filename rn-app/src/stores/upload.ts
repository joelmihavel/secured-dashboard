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
  /** Whether user completed or skipped the pre-waitlist bank details step.
   *  Prevents showing the bank screen again on cold-start routing. */
  bankStepCompleted: boolean;
  /** User ID that owns this upload state. Used to detect cross-user state
   *  leakage (e.g., device shared between users or stale Keychain data). */
  ownerId: string | null;
  _hasHydrated: boolean;
}

interface UploadActions {
  startUpload: (fileName: string, userId?: string) => void;
  setExtractionId: (id: string) => void;
  setPhase: (phase: UploadPhase) => void;
  setError: (code: string, message: string) => void;
  prepareForReupload: (params: {
    extractionId?: string | null;
    fileName?: string | null;
    errorCode?: string;
    errorMessage: string;
  }) => void;
  reset: () => void;
  /** Mark the current extraction as dismissed (user chose "Re-upload").
   *  Sets dismissedExtractionId WITHOUT clearing other state — safe to call
   *  before navigation. useMountDiscovery checks this to prevent resurrection. */
  dismissCurrentExtraction: () => void;
  /** Mark the pre-waitlist bank step as completed or skipped. */
  completeBankStep: () => void;
  isStale: () => boolean;
  /** Reset if stored state belongs to a different user. Returns true if reset. */
  validateOwner: (currentUserId: string) => boolean;
  setHasHydrated: (v: boolean) => void;
}

type UploadStore = UploadState & UploadActions;

// ==============================================
// PHASE TRANSITION VALIDATION
// ==============================================

/** Ordered forward phases — index determines valid forward transitions */
const PHASE_ORDER: readonly UploadPhase[] = [
  'idle',
  'requesting_url',
  'uploading_file',
  'processing',
  'server_processing',
  'completed',
] as const;

/**
 * Check whether a phase transition is valid.
 * Rules:
 * - Forward transitions only (idle -> requesting_url -> ... -> completed)
 * - Any phase -> failed (errors can happen anytime)
 * - Any phase -> idle (reset)
 */
function isValidPhaseTransition(from: UploadPhase, to: UploadPhase): boolean {
  if (to === 'failed' || to === 'idle') return true;
  const fromIdx = PHASE_ORDER.indexOf(from);
  const toIdx = PHASE_ORDER.indexOf(to);
  // Both must be recognized phases, and target must be strictly ahead
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx > fromIdx;
}

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
  bankStepCompleted: false,
  ownerId: null,
  _hasHydrated: false,
};

// ==============================================
// STORE
// ==============================================

export const useUploadStore = create<UploadStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      startUpload: (fileName, userId) =>
        set((state) => {
          state.uploadPhase = 'requesting_url';
          state.fileName = fileName;
          state.lastUpdatedAt = Date.now();
          state.errorCode = null;
          state.errorMessage = null;
          if (userId) state.ownerId = userId;
          state.dismissedExtractionId = null; // new upload = fresh start
        }),

      setExtractionId: (id) =>
        set((state) => {
          state.extractionId = id;
          state.lastUpdatedAt = Date.now();
        }),

      setPhase: (phase) =>
        set((state) => {
          if (!isValidPhaseTransition(state.uploadPhase, phase)) {
            console.warn(
              `[UploadStore] Invalid phase transition: ${state.uploadPhase} -> ${phase}. Ignoring.`
            );
            return;
          }
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

      prepareForReupload: ({ extractionId, fileName, errorCode = 'REUPLOAD_REQUIRED', errorMessage }) =>
        set((state) => {
          const dismissedId = extractionId ?? state.extractionId;
          if (dismissedId) {
            state.dismissedExtractionId = dismissedId;
          }
          state.extractionId = null;
          state.uploadPhase = 'failed';
          state.fileName = fileName ?? state.fileName;
          state.errorCode = errorCode;
          state.errorMessage = errorMessage;
          state.lastUpdatedAt = Date.now();
        }),

      dismissCurrentExtraction: () =>
        set((state) => {
          if (state.extractionId) {
            state.dismissedExtractionId = state.extractionId;
          }
        }),

      completeBankStep: () =>
        set((state) => {
          state.bankStepCompleted = true;
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
          state.bankStepCompleted = false;
          state.ownerId = null;
          // Note: _hasHydrated is NOT reset — it stays true once set
        }),

      isStale: () => {
        const { uploadPhase, lastUpdatedAt, bankStepCompleted } = get();
        if (uploadPhase === 'idle') return false;
        if (lastUpdatedAt === 0) return false;
        // BUG 5 FIX: Completed phase goes stale after 24 hours —
        // abandoned completed extractions won't persist forever.
        if (uploadPhase === 'completed') {
          return Date.now() - lastUpdatedAt > COMPLETED_STALENESS_MS;
        }
        // Don't mark as stale while extraction is server-side processing
        // and bank step is already done — user would lose their bank step progress.
        if (bankStepCompleted && (uploadPhase === 'server_processing' || uploadPhase === 'processing')) {
          return Date.now() - lastUpdatedAt > COMPLETED_STALENESS_MS; // 24h, not 10min
        }
        return Date.now() - lastUpdatedAt > STALENESS_MS;
      },

      validateOwner: (currentUserId) => {
        const { ownerId, uploadPhase } = get();
        if (ownerId && ownerId !== currentUserId && uploadPhase !== 'idle') {
          console.log(`[UploadStore] Owner mismatch: stored=${ownerId}, current=${currentUserId} — resetting`);
          get().reset();
          return true;
        }
        return false;
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
        bankStepCompleted: state.bankStepCompleted,
        ownerId: state.ownerId,
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
