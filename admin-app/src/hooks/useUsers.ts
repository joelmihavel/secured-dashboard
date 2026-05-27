"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchView } from "@/lib/supabase";
import type { UserFunnel } from "@/types/user";

function normalize(users: UserFunnel[]): UserFunnel[] {
  return users.map((u) => ({
    ...u,
    // DB returns "" when first_name + last_name are both null; normalize to null
    name: u.name?.trim() || null,
    landlord_name: u.landlord_name?.trim() || null,
    landlord_display_name: u.landlord_display_name?.trim() || null,
    // Treat incomplete extractions as not completed
    extraction_status:
      u.extraction_status === "completed" &&
      !u.monthly_rent_paise &&
      !u.property_address &&
      !u.lease_start_date
        ? "extraction_failed"
        : u.extraction_status,
  }));
}

export function useUsers() {
  const { data, isLoading, error, refetch } = useQuery<UserFunnel[]>({
    queryKey: ["users", "v_user_funnel"],
    queryFn: () =>
      fetchView<UserFunnel>("v_user_funnel", {
        order: { column: "signed_up_at", ascending: false },
      }),
    select: normalize,
  });

  return {
    users: data ?? [],
    loading: isLoading,
    error,
    refetch,
  };
}
