/**
 * Agreement Hooks
 *
 * React Query hooks for the agreement upload, processing, and review flow.
 * Wraps agreement API calls with caching and mutation handling.
 *
 * Flow:
 * 1. useUploadAgreement - upload document via signed URL
 * 2. useProcessDocument - trigger OCR + AI extraction
 * 3. useExtractedData - fetch extracted data for review screen
 * 4. useConfirmExtraction - confirm data and create tenancy
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useRef, useEffect } from 'react';
import {
  requestUploadUrl,
  uploadFileToSignedUrl,
  processDocument,
  getExtractedAgreementData,
  confirmExtraction,
  updateExtraction,
  ExtractedAgreementData,
  ProcessDocumentResult,
  ConfirmExtractionResult,
  ConfirmExtractionRequest,
  UpdateExtractionRequest,
  UpdateExtractionResult,
  AgreementError,
} from '../services/api/agreement';
import {
  getMimeType,
  validateFileSize,
  validateAgreementType,
} from '../services/payment/storageService';
import { useUploadStore } from '../stores/upload';
import { isJourneyMode } from '../review/journeyMode';
import { getJourneyExtractedData } from '../review/journeyData';

// ==============================================
// QUERY KEYS
// ==============================================

export const agreementKeys = {
  all: ['agreement'] as const,
  extraction: (id: string) => [...agreementKeys.all, 'extraction', id] as const,
  status: (id: string) => [...agreementKeys.all, 'status', id] as const,
};

// ==============================================
// UPLOAD + PROCESS MUTATION (Steps 1-3 combined)
// ==============================================

export interface UploadAndProcessOptions {
  onUploadProgress?: (progress: number) => void;
}

export interface UploadAndProcessResult {
  extractionId: string;
  processResult?: ProcessDocumentResult;
}

/**
 * Hook to upload and process an agreement document.
 *
 * Combines the full upload flow into a single mutation:
 * 1. Request signed upload URL from edge function
 * 2. Upload file bytes to signed URL
 * 3. Trigger document processing
 *
 * Returns the extraction ID and processing results.
 */
export function useUploadAgreement(options: UploadAndProcessOptions = {}) {
  const { onUploadProgress } = options;
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // Cleanup simulated progress timer on unmount
  useEffect(() => clearProgressTimer, [clearProgressTimer]);

  const mutation = useMutation({
    mutationFn: async (params: {
      fileUri: string;
      fileName: string;
      fileSize: number;
    }): Promise<UploadAndProcessResult> => {
      const { fileUri, fileName, fileSize } = params;

      // Guard against unreadable files (size=0 or undefined from DocumentPicker)
      if (!fileSize || fileSize <= 0) {
        throw {
          code: 'INVALID_FILE_TYPE',
          message: 'Could not read the file. Please try selecting it again.',
        } as AgreementError;
      }

      // Validate file type
      const mimeType = getMimeType(fileName);
      if (!validateAgreementType(mimeType)) {
        throw {
          code: 'INVALID_FILE_TYPE',
          message: 'Please upload a PDF file',
        } as AgreementError;
      }

      // Validate file size (50MB max per edge function)
      if (!validateFileSize(fileSize, 50)) {
        throw {
          code: 'FILE_TOO_LARGE',
          message: 'File is too large. Maximum size is 50MB.',
        } as AgreementError;
      }

      // Step 1: Request signed upload URL
      setUploadProgress(5);
      onUploadProgress?.(5);
      useUploadStore.getState().startUpload(fileName);

      const uploadUrlResult = await requestUploadUrl(fileName, mimeType, fileSize);
      if (uploadUrlResult.error) {
        throw uploadUrlResult.error;
      }

      const { uploadUrl, extractionId, documentPath } = uploadUrlResult.data!;
      const store = useUploadStore.getState();
      store.setExtractionId(extractionId);
      store.setPhase('requesting_url');

      // Step 2: Upload file to signed URL
      setUploadProgress(10);
      onUploadProgress?.(10);
      useUploadStore.getState().setPhase('uploading_file');

      // Start simulated progress — FileSystem.uploadAsync has no progress callbacks,
      // so we increment by 2% every 500ms, capped at 65% to leave room for the jump to 75%
      clearProgressTimer();
      progressTimerRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 65) return prev;
          return prev + 2;
        });
      }, 500);

      let uploadResult = await uploadFileToSignedUrl(
        uploadUrl,
        fileUri,
        mimeType,
      );

      // Auto-retry up to 2 times with exponential backoff (2s, 4s).
      // Only retry on network errors and 5xx server errors — not 4xx client
      // errors like 403 (expired URL) which won't succeed on retry.
      const MAX_UPLOAD_RETRIES = 2;
      for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
        if (uploadResult.success || !uploadResult.error) break;

        const errorCode = uploadResult.error.code;
        const errorMsg = uploadResult.error.message ?? '';

        // Network errors are always retryable
        const isNetworkError = errorCode === 'NETWORK_ERROR';

        // UPLOAD_FAILED is retryable only for 5xx server errors, not 4xx
        const is5xxError =
          errorCode === 'UPLOAD_FAILED' &&
          !errorMsg.includes('expired') &&
          !errorMsg.includes('interrupted') &&
          /status\s+5\d{2}/.test(errorMsg);

        if (!isNetworkError && !is5xxError) break;

        const delayMs = 2000 * Math.pow(2, attempt - 1); // 2s, 4s
        if (__DEV__) {
          console.log(
            `[useAgreement] Upload retry ${attempt}/${MAX_UPLOAD_RETRIES} after ${delayMs}ms (${errorCode}: ${errorMsg})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        uploadResult = await uploadFileToSignedUrl(uploadUrl, fileUri, mimeType);
      }

      // Stop simulated progress
      clearProgressTimer();

      if (!uploadResult.success) {
        throw uploadResult.error;
      }

      // Step 3: Trigger processing — fire-and-forget.
      // The edge function runs OCR + AI extraction (30-120s). Instead of blocking
      // the mutation for the entire duration, we fire the request and let
      // useExtractionStatus (polling + Realtime) drive all UI transitions.
      // This gives immediate feedback: the UI shows "Processing your agreement..."
      // and the status tracking detects completion/failure/manual_review.
      setUploadProgress(75);
      onUploadProgress?.(75);
      useUploadStore.getState().setPhase('server_processing');

      // Fire processing request — don't await.
      // If the request itself fails (network drop, edge function 500),
      // the DB row stays at 'pending' and polling would spin forever.
      // Surface the error immediately so the UI can show retry.
      processDocument(extractionId, documentPath).catch((err) => {
        if (__DEV__) console.log('[useAgreement] processDocument fire-and-forget error:', err);
        const agreementErr = err as unknown as AgreementError;
        useUploadStore.getState().setError(
          agreementErr?.code ?? 'PROCESSING_TRIGGER_FAILED',
          agreementErr?.message ?? 'Failed to start document processing. Please try again.'
        );
      });

      return {
        extractionId,
      };
    },
    onError: (error) => {
      clearProgressTimer();
      setUploadProgress(0);
      const agreementErr = error as unknown as AgreementError;
      useUploadStore.getState().setError(
        agreementErr?.code ?? 'UNKNOWN_ERROR',
        agreementErr?.message ?? 'Upload failed'
      );
    },
    meta: { suppressGlobalError: true },
  });

  return {
    ...mutation,
    uploadProgress,
    resetProgress: () => {
      clearProgressTimer();
      setUploadProgress(0);
    },
  };
}

// ==============================================
// EXTRACTED DATA QUERY (for review screen)
// ==============================================

interface UseExtractedDataOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch extracted agreement data for the review screen.
 *
 * @param extractionId - The extraction record ID
 * @param options - Query options
 */
export function useExtractedData(
  extractionId: string | null,
  options: UseExtractedDataOptions = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: agreementKeys.extraction(extractionId ?? ''),
    queryFn: async (): Promise<ExtractedAgreementData> => {
      // Journey demo mode: return mock extracted data (bypasses PostgREST)
      if (isJourneyMode()) {
        return getJourneyExtractedData() as unknown as ExtractedAgreementData;
      }

      if (!extractionId) {
        throw new Error('Missing extraction ID');
      }

      const result = await getExtractedAgreementData(extractionId);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    enabled: enabled && !!extractionId,
    staleTime: 0, // Always fetch fresh — prevents "Not Found" from stale processing-phase cache
    retry: 2,
  });
}

// ==============================================
// CONFIRM EXTRACTION MUTATION
// ==============================================

/**
 * Hook to confirm extracted data after user review.
 *
 * Creates a tenancy record and locks the user role.
 */
export function useConfirmExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      request: ConfirmExtractionRequest
    ): Promise<ConfirmExtractionResult> => {
      const result = await confirmExtraction(request);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate extraction data cache
      queryClient.invalidateQueries({ queryKey: agreementKeys.all });
      // Also invalidate dashboard since tenancy was created
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// UPDATE EXTRACTION MUTATION
// ==============================================

/**
 * Hook to update extracted data with user modifications before confirmation.
 *
 * Stores modifications in user_modified_data JSONB and invalidates cache.
 */
export function useUpdateExtraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      request: UpdateExtractionRequest
    ): Promise<UpdateExtractionResult> => {
      const result = await updateExtraction(request);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate extraction data to refetch updated values
      queryClient.invalidateQueries({ queryKey: agreementKeys.extraction(data.extractionId) });
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// COMBINED AGREEMENT HOOK
// ==============================================

interface UseAgreementOptions {
  extractionId?: string | null;
  /** Whether to fetch extraction data. Default: true.
   *  Set to false on upload screen to prevent caching empty data during processing. */
  fetchExtractedData?: boolean;
}

/**
 * Combined hook for the full agreement flow.
 *
 * Provides upload, process, review, and confirm operations
 * along with all relevant state.
 */
export function useAgreement(options: UseAgreementOptions = {}) {
  const { extractionId = null, fetchExtractedData = true } = options;

  // Current extraction ID — sourced from persisted store, with prop override
  const uploadStore = useUploadStore();
  const currentExtractionId = extractionId ?? uploadStore.extractionId;

  // Upload + process mutation
  const uploadMutation = useUploadAgreement();

  // Extracted data query — only enabled when caller needs it.
  // Upload screen sets fetchExtractedData=false to prevent caching empty data
  // during processing (root cause of "Not Found" on review screen).
  const extractedDataQuery = useExtractedData(currentExtractionId, {
    enabled: fetchExtractedData && !!currentExtractionId,
  });

  // Confirm mutation
  const confirmMutation = useConfirmExtraction();

  // Update mutation
  const updateMutation = useUpdateExtraction();

  // Upload handler
  const upload = useCallback(
    async (fileUri: string, fileName: string, fileSize: number) => {
      const result = await uploadMutation.mutateAsync({
        fileUri,
        fileName,
        fileSize,
      });
      // extractionId already set in store by mutation phase tracking
      return result;
    },
    [uploadMutation]
  );

  // Confirm handler
  const confirm = useCallback(
    async (corrections?: Partial<Omit<ConfirmExtractionRequest, 'extractionId'>>) => {
      if (!currentExtractionId) {
        throw new Error('No extraction to confirm');
      }
      return confirmMutation.mutateAsync({
        extractionId: currentExtractionId,
        ...corrections,
      });
    },
    [currentExtractionId, confirmMutation]
  );

  // Update handler (save modifications before confirmation)
  const update = useCallback(
    async (modifications: Record<string, string | number | boolean>) => {
      if (!currentExtractionId) {
        throw new Error('No extraction to update');
      }
      return updateMutation.mutateAsync({
        extractionId: currentExtractionId,
        modifications,
      });
    },
    [currentExtractionId, updateMutation]
  );

  return {
    // State
    extractionId: currentExtractionId,
    uploadProgress: uploadMutation.uploadProgress,

    // Upload
    upload,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error as AgreementError | null,

    // Extracted data
    extractedData: extractedDataQuery.data ?? null,
    isLoadingExtraction: extractedDataQuery.isLoading,
    extractionError: extractedDataQuery.error as AgreementError | null,

    // Process result (from upload mutation)
    processResult: uploadMutation.data?.processResult ?? null,

    // Confirm
    confirm,
    isConfirming: confirmMutation.isPending,
    confirmResult: confirmMutation.data ?? null,
    confirmError: confirmMutation.error as AgreementError | null,

    // Update (pre-confirmation modifications)
    update,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error as AgreementError | null,

    // Actions
    setExtractionId: (id: string | null) => {
      if (id) {
        uploadStore.setExtractionId(id);
      }
    },
    resetUpload: () => {
      uploadMutation.reset();
      uploadMutation.resetProgress();
      uploadStore.reset();
    },
  };
}
