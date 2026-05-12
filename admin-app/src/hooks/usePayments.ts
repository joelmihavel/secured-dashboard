"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchView } from "@/lib/supabase";
import type { PaymentDetail } from "@/types/user";

export function usePayments(limit?: number) {
  const { data, isLoading, error, refetch } = useQuery<PaymentDetail[]>({
    queryKey: ["payments", "v_payment_detail", limit ?? "all"],
    queryFn: () =>
      fetchView<PaymentDetail>("v_payment_detail", {
        order: { column: "initiated_at", ascending: false },
        ...(limit ? { limit } : {}),
      }),
  });

  return {
    payments: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
