/**
 * Profile Hooks
 *
 * React Query hooks for profile operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from './useDashboard';
import { callEdgeFunction } from '../services/supabase';

// ==============================================
// UPDATE PROFILE MUTATION
// ==============================================

interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateProfileRequest) => {
      const { data, error } = await callEdgeFunction<{ success: boolean }>(
        'update-profile',
        request,
        true
      );

      if (error) {
        throw new Error(error);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate dashboard to refresh user data
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
