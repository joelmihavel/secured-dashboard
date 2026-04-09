"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchView } from "@/lib/supabase";

export interface AuditLog {
  id: string;
  action: string;
  action_category: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
  ip_address: string | null;
}

export function useAuditLogs(options?: { limit?: number; action?: string }) {
  const limit = options?.limit ?? 30;
  const action = options?.action;

  const { data, isLoading, error, refetch } = useQuery<AuditLog[]>({
    queryKey: ["audit_logs", limit, action],
    queryFn: () =>
      fetchView<AuditLog>("audit_logs", {
        order: { column: "created_at", ascending: false },
        limit,
        filters: action
          ? [{ column: "action", operator: "eq", value: action }]
          : undefined,
      }),
  });

  return {
    logs: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
