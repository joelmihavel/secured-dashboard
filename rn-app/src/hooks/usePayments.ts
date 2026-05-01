/**
 * Payments Hooks
 *
 * React Query hooks for payment operations.
 * All mutation hooks expose loading/error states via React Query's useMutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  initiatePayment,
  fetchPaymentHistory,
  generateReceipt,
  createPaymentSchedule,
  managePaymentSchedule,
  getPaymentSchedules,
  getSavingsHistory,
  fetchBankList,
  InitiatePaymentRequest,
  InitiatePaymentData,
  PaymentHistoryItem,
  PaymentHistoryPagination,
  PaymentHistorySummary,
  PaymentErrorCode,
  ReceiptData,
  CreateScheduleRequest,
  ManageScheduleRequest,
  fetchPaymentStamps,
  PaymentStampsResponse,
  NetbankingBank,
} from '../services/api/payments';
import { fetchFeeConfig, getGatewayFeeRates, getPaymentGateway, type GatewayFeeRates } from '../services/payment';
import { dashboardKeys } from './useDashboard';

// ==============================================
// QUERY KEYS
// ==============================================

export const paymentKeys = {
  all: ['payments'] as const,
  history: () => [...paymentKeys.all, 'history'] as const,
  receipt: (paymentId: string) => [...paymentKeys.all, 'receipt', paymentId] as const,
  schedules: () => [...paymentKeys.all, 'schedules'] as const,
  cashback: () => [...paymentKeys.all, 'cashback'] as const,
  stamps: (tenancyId: string) => [...paymentKeys.all, 'stamps', tenancyId] as const,
  feeRates: () => [...paymentKeys.all, 'fee-rates'] as const,
  bankList: () => [...paymentKeys.all, 'bank-list'] as const,
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
// RECEIPT QUERY
// ==============================================
// Pre-warmed from the home dashboard so /(payment)/success can paint the
// full receipt body on first render — no post-mount fetch flash.
// staleTime is long because a settled receipt is immutable; Cashfree
// settlement updates a separate field that the home rebroadcast picks up.

export function useReceipt(paymentId: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.receipt(paymentId ?? ''),
    queryFn: async (): Promise<ReceiptData | null> => {
      if (!paymentId) return null;
      const { data, error } = await generateReceipt(paymentId);
      if (error) throw new Error(error);
      return data ?? null;
    },
    enabled: !!paymentId,
    staleTime: 1000 * 60 * 30, // 30 min — receipts are immutable post-settlement
  });
}

// ==============================================
// PAYMENT STAMPS QUERY
// ==============================================

export function usePaymentStamps(tenancyId: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.stamps(tenancyId ?? ''),
    queryFn: async (): Promise<PaymentStampsResponse> => {
      if (!tenancyId) throw new Error('No tenancy ID');
      const { data, error } = await fetchPaymentStamps(tenancyId);
      if (error) throw new Error(error);
      if (!data) throw new Error('Unexpected empty response');
      return data;
    },
    enabled: !!tenancyId,
    staleTime: 1000 * 60 * 60, // 1 hour — payment stamps rarely change within a session
  });
}

// ==============================================
// FEE RATES QUERY
// ==============================================

/**
 * Hook to fetch dynamic fee rates from the server.
 * Falls back to hardcoded defaults while loading or on error.
 * Caches for 1 hour.
 */
export function useFeeRates() {
  return useQuery<GatewayFeeRates>({
    queryKey: paymentKeys.feeRates(),
    queryFn: fetchFeeConfig,
    staleTime: 1000 * 60 * 60, // 1 hour
    // Use current gateway's rates as placeholder to prevent fee flash on first render
    placeholderData: getGatewayFeeRates(getPaymentGateway()),
  });
}

// ==============================================
// NETBANKING BANK LIST QUERY
// ==============================================

/**
 * Hook to fetch netbanking banks from Supabase.
 * Falls back to static BANK_LIST while loading or on error.
 * Caches for 1 hour.
 */
export function useBankList() {
  return useQuery<NetbankingBank[]>({
    queryKey: paymentKeys.bankList(),
    queryFn: async () => {
      const { data, error } = await fetchBankList();
      if (error || !data) {
        throw new Error(error ?? 'Failed to fetch bank list');
      }
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
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
    meta: { suppressGlobalError: true },
    mutationFn: async (request: InitiatePaymentRequest) => {
      const { data, error } = await initiatePayment(request);
      if (error) {
        const err = new Error(error.message);
        (err as any).code = error.code;
        throw err;
      }
      if (!data) throw new Error('Unexpected empty response');
      return data;
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
      if (!data) throw new Error('Unexpected empty response');
      return data;
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// PAYMENT SCHEDULE HOOKS
// ==============================================

export function usePaymentSchedules(tenancyId?: string) {
  return useQuery({
    queryKey: [...paymentKeys.schedules(), tenancyId],
    queryFn: async () => {
      const { data, error } = await getPaymentSchedules(tenancyId, 'active');
      if (error) throw new Error(error);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateScheduleRequest) => {
      const { data, error } = await createPaymentSchedule(request);
      if (error) throw new Error(error);
      if (!data) throw new Error('Unexpected empty response');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.schedules() });
    },
    meta: { suppressGlobalError: true },
  });
}

export function useManageSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ManageScheduleRequest) => {
      const { data, error } = await managePaymentSchedule(request);
      if (error) throw new Error(error);
      if (!data) throw new Error('Unexpected empty response');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.schedules() });
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// SAVINGS HISTORY HOOK (replaces cashback history)
// ==============================================

export function useSavingsHistory() {
  return useQuery({
    queryKey: [...paymentKeys.cashback(), 'savings'],
    queryFn: async () => {
      const { data, error } = await getSavingsHistory();
      if (error) throw new Error(error);
      if (!data) throw new Error('Unexpected empty response');
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

