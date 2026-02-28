/**
 * Shared demo/test user detection helpers.
 * Used by edge functions to bypass external services (PayU, Cashfree, API Club)
 * for users with is_test_user = true in the database.
 */

import { createServiceClient } from "./supabase.ts";

type SupabaseClient = ReturnType<typeof createServiceClient>;

/**
 * Check if a user has the is_test_user flag set in the users table.
 * This is the single gate for all demo bypasses.
 */
export async function isTestUser(
  userId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_test_user")
    .eq("id", userId)
    .single();
  return data?.is_test_user === true;
}
