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
import { useCallback, useState } from 'react';
import {
  requestUploadUrl,
  uploadFileToSignedUrl,
  processDocument,
  getExtractedAgreementData,
  confirmExtraction,
  getMockExtractedAgreementData,
  getMockProcessResult,
  ExtractedAgreementData,
  ProcessDocumentResult,
  ConfirmExtractionResult,
  ConfirmExtractionRequest,
  AgreementError,
} from '../services/api/agreement';
import {
  getMimeType,
  validateFileSize,
  validateAgreementType,
} from '../services/payment/storageService';

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
  useMock?: boolean;
  onUploadProgress?: (progress: number) => void;
}

export interface UploadAndProcessResult {
  extractionId: string;
  processResult: ProcessDocumentResult;
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
  const { useMock = false, onUploadProgress } = options;
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (params: {
      fileUri: string;
      fileName: string;
      fileSize: number;
    }): Promise<UploadAndProcessResult> => {
      const { fileUri, fileName, fileSize } = params;

      // Mock mode for development
      if (useMock) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setUploadProgress(100);
        return {
          extractionId: 'mock-extraction-id',
          processResult: getMockProcessResult(),
        };
      }

      // Validate file type
      const mimeType = getMimeType(fileName);
      if (!validateAgreementType(mimeType)) {
        throw {
          code: 'INVALID_FILE_TYPE',
          message: 'Please upload a PDF or image file',
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

      const uploadUrlResult = await requestUploadUrl(fileName, mimeType, fileSize);
      if (uploadUrlResult.error) {
        throw uploadUrlResult.error;
      }

      const { uploadUrl, extractionId, documentPath } = uploadUrlResult.data!;

      // Step 2: Upload file to signed URL
      setUploadProgress(10);
      onUploadProgress?.(10);

      const uploadResult = await uploadFileToSignedUrl(
        uploadUrl,
        fileUri,
        mimeType,
        (progress) => {
          // Scale progress from 10-70%
          const scaled = 10 + Math.round(progress * 0.6);
          setUploadProgress(scaled);
          onUploadProgress?.(scaled);
        }
      );

      if (!uploadResult.success) {
        throw uploadResult.error;
      }

      // Step 3: Trigger processing
      setUploadProgress(75);
      onUploadProgress?.(75);

      const processResult = await processDocument(extractionId, documentPath);
      if (processResult.error) {
        throw processResult.error;
      }

      setUploadProgress(100);
      onUploadProgress?.(100);

      // Invalidate any cached extraction data
      queryClient.invalidateQueries({ queryKey: agreementKeys.extraction(extractionId) });

      return {
        extractionId,
        processResult: processResult.data!,
      };
    },
    onError: () => {
      setUploadProgress(0);
    },
  });

  return {
    ...mutation,
    uploadProgress,
    resetProgress: () => setUploadProgress(0),
  };
}

// ==============================================
// EXTRACTED DATA QUERY (for review screen)
// ==============================================

interface UseExtractedDataOptions {
  enabled?: boolean;
  useMock?: boolean;
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
  const { enabled = true, useMock = false } = options;

  return useQuery({
    queryKey: agreementKeys.extraction(extractionId ?? ''),
    queryFn: async (): Promise<ExtractedAgreementData> => {
      if (useMock) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return getMockExtractedAgreementData();
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
    enabled: enabled && (useMock || !!extractionId),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
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
  });
}

// ==============================================
// COMBINED AGREEMENT HOOK
// ==============================================

interface UseAgreementOptions {
  useMock?: boolean;
  extractionId?: string | null;
}

/**
 * Combined hook for the full agreement flow.
 *
 * Provides upload, process, review, and confirm operations
 * along with all relevant state.
 */
export function useAgreement(options: UseAgreementOptions = {}) {
  const { useMock = false, extractionId = null } = options;

  // Current extraction ID (set after upload or passed in)
  const [currentExtractionId, setCurrentExtractionId] = useState<string | null>(
    extractionId
  );

  // Upload + process mutation
  const uploadMutation = useUploadAgreement({
    useMock,
  });

  // Extracted data query
  const extractedDataQuery = useExtractedData(currentExtractionId, {
    useMock,
    enabled: !!currentExtractionId,
  });

  // Confirm mutation
  const confirmMutation = useConfirmExtraction();

  // Upload handler
  const upload = useCallback(
    async (fileUri: string, fileName: string, fileSize: number) => {
      const result = await uploadMutation.mutateAsync({
        fileUri,
        fileName,
        fileSize,
      });
      setCurrentExtractionId(result.extractionId);
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

    // Actions
    setExtractionId: setCurrentExtractionId,
    resetUpload: () => {
      uploadMutation.reset();
      uploadMutation.resetProgress();
      setCurrentExtractionId(null);
    },
  };
}
