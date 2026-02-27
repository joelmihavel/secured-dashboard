/**
 * Rate Limiting via audit_logs table
 *
 * Uses the existing audit_logs table to track action counts per user
 * within a sliding window. No new infrastructure needed.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { RateLimitError } from "./errors.ts";

interface RateLimitOptions {
  /** Action identifier (e.g., "pixelate_avatar") */
  action: string;
  /** Maximum allowed calls within the window */
  maxRequests: number;
  /** Window duration in seconds (default: 3600 = 1 hour) */
  windowSeconds?: number;
}

/**
 * Check and enforce rate limit for a user action.
 * Throws RateLimitError if limit exceeded.
 *
 * @param client - Supabase service client
 * @param userId - User ID to rate limit
 * @param options - Rate limit configuration
 */
export async function checkRateLimit(
  client: SupabaseClient,
  userId: string,
  options: RateLimitOptions
): Promise<void> {
  const { action, maxRequests, windowSeconds = 3600 } = options;

  const windowStart = new Date(
    Date.now() - windowSeconds * 1000
  ).toISOString();

  // Count recent actions
  const { count, error } = await client
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check failed:", error.message);
    // Fail open — don't block user if audit_logs query fails
    return;
  }

  if ((count ?? 0) >= maxRequests) {
    throw new RateLimitError(windowSeconds);
  }
}

/**
 * Record an action for rate limiting purposes.
 *
 * @param client - Supabase service client
 * @param userId - User ID
 * @param action - Action identifier
 * @param metadata - Optional extra data to store
 */
export async function recordAction(
  client: SupabaseClient,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
    user_id: userId,
    action,
    metadata: metadata ?? {},
  });

  if (error) {
    console.error("Failed to record rate limit action:", error.message);
  }
}
