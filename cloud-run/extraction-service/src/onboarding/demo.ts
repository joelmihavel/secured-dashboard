/**
 * Flent Secured v2 - Demo/Test User Helpers (Cloud Run Port)
 *
 * Ported from:
 *   supabase/functions/_shared/demo-helpers.ts -> isTestUser
 *   supabase/functions/_shared/onboarding.ts   -> maybeAutoApproveDemoUser
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ==============================================
// TEST USER DETECTION
// ==============================================

/**
 * Check if a user has the is_test_user flag set in the users table.
 * This is the single gate for all demo bypasses.
 */
export async function isTestUser(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("is_test_user")
    .eq("id", userId)
    .single();
  return (data as Record<string, any>)?.is_test_user === true;
}

// ==============================================
// AUTO-APPROVE DEMO USER
// ==============================================

export async function maybeAutoApproveDemoUser(options: {
  supabase: SupabaseClient;
  userId: string;
  waitlistEntryId?: string;
}): Promise<{ autoApproved: boolean; finalUserStatus: string }> {
  const { supabase, userId, waitlistEntryId } = options;

  if (!waitlistEntryId || !(await isTestUser(userId, supabase))) {
    return { autoApproved: false, finalUserStatus: "waitlisted" };
  }

  const { data: tenancy } = await supabase
    .from("tenancies")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "pending_verification", "active"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!(tenancy as Record<string, any>)?.id) {
    return { autoApproved: false, finalUserStatus: "waitlisted" };
  }

  await supabase
    .from("waitlist_entries")
    .update({ admin_review: "approved" })
    .eq("id", waitlistEntryId);

  await supabase
    .from("users")
    .update({
      user_status: "approved",
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await supabase
    .from("tenancies")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", (tenancy as Record<string, any>).id)
    .in("status", ["pending", "pending_verification"]);

  return { autoApproved: true, finalUserStatus: "approved" };
}
