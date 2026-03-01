/**
 * Flent Secured v2 - Idempotency Helper
 *
 * Ensures exactly-once processing for critical operations.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { IdempotencyError } from "./errors.ts";

// ==============================================
// TYPES
// ==============================================

export interface IdempotencyResult {
  isNew: boolean;
  cachedResponse?: {
    status: number;
    body: unknown;
  };
}

export interface IdempotencyOptions {
  userId?: string;
  endpoint: string;
  ttlHours?: number;
}

// ==============================================
// IDEMPOTENCY MANAGER
// ==============================================

/**
 * Manages idempotency keys for Edge Functions.
 */
export class IdempotencyManager {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Generates a SHA-256 hash of the request body for validation.
   */
  private async hashRequest(body: unknown): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Checks if a request has already been processed.
   * Returns cached response if available, or acquires lock for new request.
   *
   * @param key - The idempotency key (client-provided or generated)
   * @param body - The request body to validate
   * @param options - Configuration options
   */
  async check(
    key: string,
    body: unknown,
    options: IdempotencyOptions
  ): Promise<IdempotencyResult> {
    const requestHash = await this.hashRequest(body);
    const { userId, endpoint, ttlHours = 24 } = options;

    // Check for existing key
    const { data: existing, error: selectError } = await this.supabase
      .from("idempotency_keys")
      .select("*")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (selectError) {
      console.error("Idempotency check error:", selectError);
      throw new Error(`Idempotency check failed: ${selectError.message}`);
    }

    // Key exists
    if (existing) {
      // Validate request hash matches
      if (existing.request_hash !== requestHash) {
        throw new IdempotencyError(
          "Idempotency key reused with different request parameters"
        );
      }

      // If completed, return cached response
      if (existing.status === "completed") {
        return {
          isNew: false,
          cachedResponse: {
            status: existing.response_status,
            body: existing.response_body,
          },
        };
      }

      // If still processing, check for stale lock (crashed request)
      if (existing.status === "processing") {
        const lockedAt = existing.locked_at ? new Date(existing.locked_at).getTime() : 0;
        const staleLockMs = 60_000; // 60 seconds — if still "processing" after this, assume crashed
        if (Date.now() - lockedAt > staleLockMs) {
          // Stale lock — reclaim it for this request
          console.warn(`[idempotency] Reclaiming stale lock (locked ${Math.round((Date.now() - lockedAt) / 1000)}s ago)`);
          await this.supabase
            .from("idempotency_keys")
            .update({
              status: "processing",
              locked_at: new Date().toISOString(),
            })
            .eq("key", key);
          return { isNew: true };
        }
        throw new IdempotencyError("Request is currently being processed");
      }

      // If failed, allow retry
      if (existing.status === "failed") {
        // Update to processing
        await this.supabase
          .from("idempotency_keys")
          .update({
            status: "processing",
            locked_at: new Date().toISOString(),
          })
          .eq("key", key);

        return { isNew: true };
      }
    }

    // Insert new key
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    const { error: insertError } = await this.supabase
      .from("idempotency_keys")
      .insert({
        key,
        user_id: userId,
        endpoint,
        request_hash: requestHash,
        request_body: body,
        status: "processing",
        locked_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      // Unique constraint violation - another request beat us
      if (insertError.code === "23505") {
        throw new IdempotencyError("Request is currently being processed");
      }
      throw new Error(`Failed to create idempotency key: ${insertError.message}`);
    }

    return { isNew: true };
  }

  /**
   * Marks an idempotency key as completed with the response.
   */
  async complete(key: string, status: number, body: unknown): Promise<void> {
    const { error } = await this.supabase
      .from("idempotency_keys")
      .update({
        status: "completed",
        response_status: status,
        response_body: body,
        completed_at: new Date().toISOString(),
        locked_at: null,
      })
      .eq("key", key);

    if (error) {
      console.error("Failed to complete idempotency key:", error);
    }
  }

  /**
   * Marks an idempotency key as failed, allowing retry.
   */
  async fail(key: string, errorMessage?: string): Promise<void> {
    const { error } = await this.supabase
      .from("idempotency_keys")
      .update({
        status: "failed",
        response_body: { error: errorMessage },
        locked_at: null,
      })
      .eq("key", key);

    if (error) {
      console.error("Failed to mark idempotency key as failed:", error);
    }
  }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Extracts idempotency key from request headers or generates one.
 */
export function getIdempotencyKey(
  request: Request,
  prefix?: string
): string {
  // Check header first
  const headerKey = request.headers.get("x-idempotency-key");
  if (headerKey) {
    return prefix ? `${prefix}:${headerKey}` : headerKey;
  }

  // Generate one if not provided
  const generated = crypto.randomUUID();
  return prefix ? `${prefix}:${generated}` : generated;
}

/**
 * Generates an idempotency key from request parameters.
 * Useful for ensuring the same operation isn't repeated.
 */
export async function generateIdempotencyKey(
  ...params: unknown[]
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(params));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
