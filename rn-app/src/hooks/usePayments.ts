/**
 * Payments Hooks
 *
 * React Query hooks for payment operations.
 * All mutation hooks expose loading/error states via React Query's useMutation.
 */

import { useQuery, useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  initiatePayment,
  fetchPaymentHistory,
  getSavedPaymentMethods,
  addUpiVpa,
  deletePaymentMethod,
  generateReceipt,
  InitiatePaymentRequest,
  InitiatePaymentData,
  PaymentHistoryItem,
  SavedPaymentMethod,
  PaymentErrorCode,
} from '../services/api/payments';
import { dashboardKeys } from './useDashboard';

// ==============================================
// QUERY KEYS
// ==============================================

export const paymentKeys = {
  all: ['payments'] as const,
  history: () => [...paymentKeys.all, 'history'] as const,
  methods: () => [...paymentKeys.all, 'methods'] as const,
  receipt: (paymentId: string) => [...paymentKeys.all, 'receipt', paymentId] as const,
};

// ==============================================
// PAYMENT HISTORY QUERY
// ==============================================

export function usePaymentHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...paymentKeys.history(), page, limit],
    queryFn: async () => {
      const { data, error } = await fetchPaymentHistory(page, limit);
      if (error) {
        throw new Error(error);
      }
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ==============================================
// SAVED PAYMENT METHODS QUERY
// ==============================================

export function useSavedPaymentMethods() {
  return useQuery({
    queryKey: paymentKeys.methods(),
    queryFn: async () => {
      const { data, error } = await getSavedPaymentMethods();
      if (error) {
        throw new Error(error);
      }
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// ==============================================
// INITIATE PAYMENT MUTATION
// ==============================================

export interface UseInitiatePaymentCallbacks {
  onSuccess?: (data: InitiatePaymentData) => void;
  onError?: (error: PaymentErrorCode) => void;
}

export function useInitiatePayment(callbacks: UseInitiatePaymentCallbacks = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: InitiatePaymentRequest) => {
      const { data, error } = await initiatePayment(request);
      if (error) {
        throw error;
      }
      return data!;
    },
    onSuccess: (data) => {
      // Invalidate payment history and dashboard
      queryClient.invalidateQueries({ queryKey: paymentKeys.history() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      callbacks.onSuccess?.(data);
    },
    onError: (error: PaymentErrorCode) => {
      callbacks.onError?.(error);
    },
  });
}

// ==============================================
// ADD UPI VPA MUTATION
// ==============================================

export interface AddUpiVpaParams {
  vpa: string;
  displayName?: string;
}

export interface AddUpiVpaResult {
  id: string;
  vpa?: string;
  display_name?: string;
}

/**
 * Hook to add a new UPI VPA payment method.
 *
 * @returns Mutation object with:
 * - `mutate(params)` - Function to trigger the mutation
 * - `mutateAsync(params)` - Async version that returns a promise
 * - `isPending` - Loading state
 * - `isError` - Error state
 * - `error` - Error object if failed
 * - `isSuccess` - Success state
 * - `data` - Result data if successful
 * - `reset()` - Reset mutation state
 *
 * @example
 * const { mutate, isPending, error } = useAddUpiVpa();
 *
 * const handleAdd = () => {
 *   mutate({ vpa: 'user@upi', displayName: 'My UPI' });
 * };
 *
 * if (isPending) return <Loading />;
 * if (error) return <Error message={error.message} />;
 */
export function useAddUpiVpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vpa, displayName }: AddUpiVpaParams): Promise<AddUpiVpaResult> => {
      const { data, error } = await addUpiVpa(vpa, displayName);
      if (error) {
        throw new Error(error);
      }
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

// ==============================================
// DELETE PAYMENT METHOD MUTATION
// ==============================================

/**
 * Hook to delete a saved payment method.
 *
 * @returns Mutation object with:
 * - `mutate(methodId)` - Function to trigger deletion
 * - `isPending` - Loading state
 * - `isError` - Error state
 * - `error` - Error object if failed
 * - `reset()` - Reset mutation state
 *
 * @example
 * const { mutate: deleteMethod, isPending, error } = useDeletePaymentMethod();
 *
 * const handleDelete = (id: string) => {
 *   deleteMethod(id, {
 *     onSuccess: () => Alert.alert('Deleted!'),
 *     onError: (err) => Alert.alert('Error', err.message),
 *   });
 * };
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (methodId: string): Promise<void> => {
      const { success, error } = await deletePaymentMethod(methodId);
      if (!success) {
        throw new Error(error ?? 'Failed to delete payment method');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

// ==============================================
// GENERATE RECEIPT MUTATION
// ==============================================

/**
 * Hook to generate a receipt PDF for a completed payment.
 *
 * @returns Mutation object with:
 * - `mutate(paymentId)` - Function to trigger receipt generation
 * - `isPending` - Loading state (true while generating)
 * - `isError` - Error state
 * - `error` - Error object if failed
 * - `data` - Receipt URL/data if successful
 *
 * @example
 * const { mutateAsync: generateReceipt, isPending } = useGenerateReceipt();
 *
 * const handleDownload = async (paymentId: string) => {
 *   try {
 *     const receipt = await generateReceipt(paymentId);
 *     await Share.share({ url: receipt.url });
 *   } catch (err) {
 *     Alert.alert('Error generating receipt');
 *   }
 * };
 */
export function useGenerateReceipt() {
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await generateReceipt(paymentId);
      if (error) {
        throw new Error(error);
      }
      return data!;
    },
  });
}

// ==============================================
// PAYMENT METHODS ALIAS
// ==============================================

/**
 * Alias for useSavedPaymentMethods for convenience
 */
export const usePaymentMethods = useSavedPaymentMethods;

// ==============================================
// ADD PAYMENT METHOD (GENERIC)
// ==============================================

export interface AddPaymentMethodRequest {
  type: 'upi' | 'card' | 'netbanking';
  details: string;
  metadata?: Record<string, string>;
  isDefault?: boolean;
}

export interface AddPaymentMethodResult {
  id: string;
  type: 'upi' | 'card' | 'netbanking';
  details: string;
  is_default: boolean;
}

/**
 * Hook to add a new payment method (UPI, card, or netbanking).
 *
 * @returns Mutation object with:
 * - `mutate(request)` - Function to trigger the mutation
 * - `mutateAsync(request)` - Async version that returns a promise
 * - `isPending` - Loading state (true while adding)
 * - `isError` - Error state (true if failed)
 * - `error` - Error object if failed
 * - `isSuccess` - Success state (true if completed)
 * - `data` - Result data if successful
 * - `reset()` - Reset mutation state
 *
 * @example
 * const {
 *   mutate: addMethod,
 *   isPending: isAdding,
 *   isError,
 *   error,
 *   isSuccess,
 * } = useAddPaymentMethod();
 *
 * // In component
 * if (isAdding) return <ActivityIndicator />;
 * if (isError) return <Text>Error: {error.message}</Text>;
 *
 * // To add a method
 * addMethod({
 *   type: 'upi',
 *   details: 'user@upi',
 *   isDefault: true,
 * });
 */
export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AddPaymentMethodRequest): Promise<AddPaymentMethodResult> => {
      // For UPI, use the existing addUpiVpa function
      if (request.type === 'upi') {
        const { data, error } = await addUpiVpa(request.details);
        if (error) {
          throw new Error(error);
        }
        return {
          id: data!.id ?? `upi_${Date.now()}`,
          type: 'upi',
          details: request.details,
          is_default: request.isDefault ?? false,
        };
      }

      // For card/netbanking, we'd call a different API
      // For now, simulate success (in production, this would integrate with PayU tokenization)
      if (__DEV__) {
        console.warn(`Card/Netbanking tokenization not implemented - using mock for ${request.type}`);
      }
      return {
        id: `${request.type}_${Date.now()}`,
        type: request.type,
        details: request.details,
        is_default: request.isDefault ?? false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.methods() });
    },
  });
}

// ==============================================
// VERIFY UPI
// ==============================================

export interface VerifyUpiResult {
  verified: boolean;
  name: string;
  vpa: string;
}

/**
 * Hook to verify a UPI VPA before adding it as a payment method.
 *
 * @returns Mutation object with:
 * - `mutate({ upiId })` - Function to trigger verification
 * - `isPending` - Loading state (true while verifying)
 * - `isError` - Error state
 * - `error` - Error object if verification failed
 * - `data` - Verification result with account holder name
 *
 * @example
 * const { mutate: verify, isPending, data, error } = useVerifyUpi();
 *
 * const handleVerify = () => {
 *   verify({ upiId: 'user@okicici' });
 * };
 *
 * if (isPending) return <Text>Verifying...</Text>;
 * if (data?.verified) return <Text>Account: {data.name}</Text>;
 */
export function useVerifyUpi() {
  return useMutation({
    mutationFn: async ({ upiId }: { upiId: string }): Promise<VerifyUpiResult> => {
      // In production, this would call PayU's VPA verification API
      // For now, simulate verification
      const MOCK_VERIFICATION_DELAY_MS = 1500;
      await new Promise((resolve) => setTimeout(resolve, MOCK_VERIFICATION_DELAY_MS));

      // Extract name from UPI ID (simulated)
      const name = upiId.split('@')[0].replace(/[._]/g, ' ');
      return {
        verified: true,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        vpa: upiId,
      };
    },
  });
}

// ==============================================
// COMBINED PAYMENT HOOK
// ==============================================

/**
 * Combined hook for common payment operations.
 * Provides a convenient interface for all payment-related queries and mutations
 * with explicit loading and error states.
 *
 * @returns Object containing:
 * - Query states: `history`, `savedMethods` with loading/error states
 * - Mutations: `initiatePayment`, `addMethod`, `deleteMethod` with states
 * - Utilities: `refreshAll` to invalidate all payment caches
 *
 * @example
 * const {
 *   // Data
 *   history,
 *   savedMethods,
 *
 *   // Loading states
 *   isLoadingHistory,
 *   isLoadingMethods,
 *   isInitiating,
 *   isAddingMethod,
 *   isDeletingMethod,
 *
 *   // Error states
 *   historyError,
 *   methodsError,
 *   initiateError,
 *   addMethodError,
 *   deleteMethodError,
 *
 *   // Mutations
 *   initiatePayment,
 *   addMethod,
 *   deleteMethod,
 *
 *   // Utilities
 *   refreshAll,
 * } = usePayments();
 */
export function usePayments() {
  const historyQuery = usePaymentHistory();
  const methodsQuery = useSavedPaymentMethods();
  const initiatePaymentMutation = useInitiatePayment();
  const addMethodMutation = useAddPaymentMethod();
  const deleteMethodMutation = useDeletePaymentMethod();
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
  }, [queryClient]);

  return {
    // History query
    history: historyQuery.data ?? [],
    isLoadingHistory: historyQuery.isLoading,
    historyError: historyQuery.error,
    refetchHistory: historyQuery.refetch,

    // Saved methods query
    savedMethods: methodsQuery.data ?? [],
    isLoadingMethods: methodsQuery.isLoading,
    methodsError: methodsQuery.error,
    refetchMethods: methodsQuery.refetch,

    // Initiate payment mutation
    initiatePayment: initiatePaymentMutation.mutate,
    initiatePaymentAsync: initiatePaymentMutation.mutateAsync,
    isInitiating: initiatePaymentMutation.isPending,
    initiateError: initiatePaymentMutation.error as PaymentErrorCode | null,
    initiateSuccess: initiatePaymentMutation.isSuccess,
    resetInitiate: initiatePaymentMutation.reset,

    // Add payment method mutation
    addMethod: addMethodMutation.mutate,
    addMethodAsync: addMethodMutation.mutateAsync,
    isAddingMethod: addMethodMutation.isPending,
    addMethodError: addMethodMutation.error,
    addMethodSuccess: addMethodMutation.isSuccess,
    addedMethod: addMethodMutation.data,
    resetAddMethod: addMethodMutation.reset,

    // Delete payment method mutation
    deleteMethod: deleteMethodMutation.mutate,
    deleteMethodAsync: deleteMethodMutation.mutateAsync,
    isDeletingMethod: deleteMethodMutation.isPending,
    deleteMethodError: deleteMethodMutation.error,
    deleteMethodSuccess: deleteMethodMutation.isSuccess,
    resetDeleteMethod: deleteMethodMutation.reset,

    // Utilities
    refreshAll,
  };
}
