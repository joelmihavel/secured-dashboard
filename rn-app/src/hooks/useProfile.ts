/**
 * Profile Hooks
 *
 * React Query hooks for profile operations:
 * - Update profile (name, email)
 * - Saved payment methods (via profile service)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
// useRouter removed — AuthProvider handles post-signout navigation
import {
  updateProfile,
  getSavedPaymentMethods,
  requestAccountDeletion,
  type UpdateProfileRequest,
  type ProfileData,
  type PaymentMethodsData,
  type SavedPaymentMethod,
  type ProfileError,
} from '../services/api/profile';
import { signOut as apiSignOut } from '../services/api/auth';
import { clearAllStores } from '../stores/resetAll';
import { markUserInitiatedSignOut } from '../providers/AuthProvider';
import { clearUserContext } from '../config/sentry';
import { queryClient as globalQueryClient } from '../providers/QueryProvider';
import { dashboardKeys } from './useDashboard';
import { paymentKeys } from './usePayments';

// ==============================================
// QUERY KEYS
// ==============================================

export const profileKeys = {
  all: ['profile'] as const,
  paymentMethods: () => [...profileKeys.all, 'payment-methods'] as const,
};

// ==============================================
// UPDATE PROFILE MUTATION
// ==============================================

/**
 * Hook to update user profile.
 *
 * Maps RN UI fields to edge function expected shape:
 * - fullName -> full_name (edge function also auto-splits into first/last)
 * - firstName -> first_name
 * - lastName -> last_name
 * - email -> email
 *
 * @returns Mutation with { mutate, isPending, error, data }
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateProfileRequest): Promise<ProfileData> => {
      const { data, error } = await updateProfile(request);

      if (error) {
        throw new Error(error.message);
      }

      return data!;
    },
    onSuccess: () => {
      // Invalidate dashboard to refresh user data across the app
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// SAVED PAYMENT METHODS QUERY (Profile context)
// ==============================================

/**
 * Hook to fetch saved payment methods for the profile screen.
 *
 * Uses the profile service which maps edge function response to the
 * proper RN types (isPrimary, grouped by type, etc.)
 *
 * Note: This is separate from usePaymentMethods in usePayments.ts which
 * uses the payments service. Both call the same edge function but the
 * profile version returns richer data (grouped methods, primary ID).
 */
export function useProfilePaymentMethods() {
  return useQuery({
    queryKey: profileKeys.paymentMethods(),
    queryFn: async () => {
      const { data, error } = await getSavedPaymentMethods();
      if (error) {
        throw new Error(error.message);
      }
      return data!;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// ==============================================
// DELETE ACCOUNT MUTATION
// ==============================================

/**
 * Hook to delete the user's account.
 *
 * On success:
 * 1. Clears Supabase session
 * 2. Resets all Zustand stores (including persisted ones)
 * 3. Clears React Query cache
 * 4. Navigates to splash screen
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (params?: { reason?: string }) => {
      const { data, error } = await requestAccountDeletion(params?.reason);
      if (error) throw new Error(error.message);
      return data!;
    },
    onSuccess: async () => {
      // Signal user-initiated sign-out so AuthProvider navigates immediately
      // (not after 3s transient-failure debounce). AuthProvider handles navigation.
      markUserInitiatedSignOut();
      clearUserContext();
      // SDK signOut fires SIGNED_OUT → AuthProvider navigates to beta-splash
      await apiSignOut().catch(() => {});
      // Nuclear cleanup: all stores, SecureStore keys, query cache, realtime channels
      await clearAllStores();
      globalQueryClient.clear();
    },
    meta: { suppressGlobalError: true },
  });
}

// ==============================================
// COMBINED PROFILE HOOK
// ==============================================

/**
 * Combined hook for profile operations.
 *
 * Provides convenient access to all profile-related queries and mutations
 * in a single hook.
 */
export function useProfile() {
  const updateProfileMutation = useUpdateProfile();
  const paymentMethodsQuery = useProfilePaymentMethods();
  const queryClient = useQueryClient();

  const refreshAll = useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      queryClient.invalidateQueries({ queryKey: paymentKeys.all }),
    ]);
  }, [queryClient]);

  return {
    // Update profile
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
    updateError: updateProfileMutation.error,
    updateSuccess: updateProfileMutation.isSuccess,
    updatedProfile: updateProfileMutation.data,
    resetUpdate: updateProfileMutation.reset,

    // Payment methods
    paymentMethods: paymentMethodsQuery.data ?? null,
    isLoadingMethods: paymentMethodsQuery.isLoading,
    methodsError: paymentMethodsQuery.error,
    refetchMethods: paymentMethodsQuery.refetch,

    // Utilities
    refreshAll,
  };
}
