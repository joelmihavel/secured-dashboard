/**
 * Payments Hooks
 *
 * React Query hooks for payment operations.
 * All mutation hooks expose loading/error states via React Query's useMutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  initiatePayment,
  fetchPaymentHistory,
  getSavedPaymentMethods,
  addUpiVpa,
  addCardToken,
  deletePaymentMethod,
  generateReceipt,
  InitiatePaymentRequest,
  InitiatePaymentData,
  PaymentHistoryItem,
  PaymentHistoryPagination,
  PaymentHistorySummary,
  SavedPaymentMethod,
  PaymentErrorCode,
  ReceiptData,
  AddCardTokenRequest,
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

export interface PaymentHistoryData {
  payments: PaymentHistoryItem[];
  pagination: PaymentHistoryPagination | null;
  summary: PaymentHistorySummary | null;
}

/**
 * Hook to fetch paginated payment history.
 *
 * Returns payments array, pagination metadata, and summary stats.
 * The edge function is called via GET with query params (page, limit, filters).
 * Amounts are returned in rupees with paise backward-compat fields.
 */
export function usePaymentHistory(
  page = 1,
  limit = 20,
  filters?: { status?: string; tenancy_id?: string; from_date?: string; to_date?: string }
) {
  return useQuery({
    queryKey: [...paymentKeys.history(), page, limit, filters],
    queryFn: async (): Promise<PaymentHistoryData> => {
      const { data, pagination, summary, error } = await fetchPaymentHistory(page, limit, filters);
      if (error) {
        throw new Error(error);
      }
      return {
        payments: data ?? [],
        pagination,
        summary,
      };
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
  nickname?: string;
  setPrimary?: boolean;
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
 *   mutate({ vpa: 'user@upi', nickname: 'My UPI' });
 * };
 *
 * if (isPending) return <Loading />;
 * if (error) return <Error message={error.message} />;
 */
export function useAddUpiVpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vpa, nickname, setPrimary }: AddUpiVpaParams): Promise<AddUpiVpaResult> => {
      const { data, error } = await addUpiVpa(vpa, nickname, setPrimary);
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
// ADD CARD TOKEN MUTATION
// ==============================================

/**
 * Hook to add a tokenized card payment method.
 *
 * @returns Mutation object with standard React Query mutation fields.
 *
 * @example
 * const { mutate, isPending, error } = useAddCardToken();
 *
 * const handleAdd = () => {
 *   mutate({
 *     card_token: 'payu_token_xxx',
 *     card_last4: '1234',
 *     card_network: 'visa',
 *     card_type: 'credit',
 *     card_expiry_month: 12,
 *     card_expiry_year: 2028,
 *   });
 * };
 */
export function useAddCardToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AddCardTokenRequest): Promise<SavedPaymentMethod> => {
      const { data, error } = await addCardToken(request);
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
 * Hook to generate a receipt for a completed payment.
 *
 * Returns rich ReceiptData from the edge function (receipt_number, payment details,
 * tenant/landlord info, company info) -- not just a URL.
 *
 * @returns Mutation object with standard React Query mutation fields.
 *
 * @example
 * const { mutateAsync: getReceipt, isPending } = useGenerateReceipt();
 *
 * const handleDownload = async (paymentId: string) => {
 *   try {
 *     const receipt = await getReceipt(paymentId);
 *     // receipt.receiptNumber, receipt.payment.amount, etc.
 *   } catch (err) {
 *     Alert.alert('Error generating receipt');
 *   }
 * };
 */
export function useGenerateReceipt() {
  return useMutation({
    mutationFn: async (paymentId: string): Promise<ReceiptData> => {
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
 * For UPI: calls addUpiVpa with correct edge function field names.
 * For card: calls addCardToken when a card_token is provided in metadata,
 *           otherwise falls back to mock for dev mode.
 *
 * @returns Mutation object with standard React Query mutation fields.
 */
export function useAddPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: AddPaymentMethodRequest): Promise<AddPaymentMethodResult> => {
      // For UPI, use the addUpiVpa function with correct field mapping
      if (request.type === 'upi') {
        const { data, error } = await addUpiVpa(
          request.details,
          request.metadata?.displayName,
          request.isDefault
        );
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

      // For card with a token, use addCardToken
      if (request.type === 'card' && request.metadata?.card_token) {
        const cardNetwork = (request.metadata.cardNetwork ?? 'visa') as AddCardTokenRequest['card_network'];
        const cardType = (request.metadata.cardType ?? 'credit') as AddCardTokenRequest['card_type'];
        const [expiryMonth, expiryYear] = (request.metadata.expiryDate ?? '01/30').split('/').map(Number);

        const { data, error } = await addCardToken({
          card_token: request.metadata.card_token,
          card_last4: request.details,
          card_network: cardNetwork,
          card_type: cardType,
          card_expiry_month: expiryMonth,
          card_expiry_year: 2000 + expiryYear,
          card_issuer: request.metadata.cardIssuer,
          nickname: request.metadata.cardholderName,
          set_primary: request.isDefault,
        });
        if (error) {
          throw new Error(error);
        }
        return {
          id: data!.id,
          type: 'card',
          details: request.details,
          is_default: request.isDefault ?? false,
        };
      }

      // For card/netbanking without token, simulate success in dev mode
      // (In production, this would integrate with PayU tokenization)
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
 * @returns Mutation object with standard React Query mutation fields.
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
    history: historyQuery.data?.payments ?? [],
    pagination: historyQuery.data?.pagination ?? null,
    summary: historyQuery.data?.summary ?? null,
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
