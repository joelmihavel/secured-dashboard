"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchView } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";

export function useUsers() {
  const { data, isLoading, error, refetch } = useQuery<UserFunnel[]>({
    queryKey: ["users", "v_user_funnel"],
    queryFn: () =>
      fetchView<UserFunnel>("v_user_funnel", {
        order: { column: "signed_up_at", ascending: false },
      }),
  });

  return {
    users: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
