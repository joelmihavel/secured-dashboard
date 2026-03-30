/**
 * Flent Secured v2 - Supabase Client Setup
 *
 * Provides configured Supabase clients for Edge Functions.
 * Includes safety checks to prevent accidental production access.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { AuthError } from "./errors.ts";

// ==============================================
// ENVIRONMENT CONFIGURATION
// ==============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Prefer new opaque keys (SB_PUBLISHABLE_KEY / SB_SECRET_KEY) over legacy
// auto-injected vars (SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).
// Legacy vars may contain stale JWT values after key migration (bug #37648).
const SUPABASE_ANON_KEY =
  Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required Supabase environment variables. " +
      "Ensure SUPABASE_URL and SB_PUBLISHABLE_KEY/SB_SECRET_KEY (or legacy SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY) are set."
  );
}

// ==============================================
// CLIENT FACTORIES
// ==============================================

/**
 * Creates a Supabase client with service role (admin) privileges.
 * Use this for operations that need to bypass RLS.
 *
 * @returns Supabase client with service role key
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "x-client-info": "flent-secured-edge-function",
      },
    },
  });
}

/**
 * Creates a Supabase client with the user's JWT.
 * Use this for operations that should respect RLS.
 *
 * @param authHeader - The Authorization header from the request
 * @returns Supabase client authenticated as the user
 */
export function createUserClient(authHeader: string | null): SupabaseClient {
  const token = authHeader?.replace("Bearer ", "") ?? "";

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-client-info": "flent-secured-edge-function",
      },
    },
  });
}

/**
 * Decode a JWT's payload WITHOUT verifying signature.
 * Signature verification is handled by Supabase's getUser() call —
 * this is only for pre-flight expiry checks to avoid wasting a round-trip.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Checks whether a JWT's exp claim is in the past.
 * Returns true if the token is expired.
 */
function isJwtExpired(authHeader: string): boolean {
  const token = authHeader.replace("Bearer ", "");
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false; // Can't check — let getUser() handle it
  return Date.now() > payload.exp * 1000;
}

/**
 * Extracts and validates the user ID from a request's JWT.
 * Checks token expiry BEFORE hitting GoTrue to fail fast on expired tokens.
 *
 * @param authHeader - The Authorization header from the request
 * @returns The user ID if valid, null otherwise
 */
export async function getUserIdFromAuth(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader) return null;

  // Pre-flight expiry check — avoids a wasted GoTrue round-trip
  if (isJwtExpired(authHeader)) {
    console.error("Auth error: token expired");
    return null;
  }

  const client = createUserClient(authHeader);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    console.error("Auth error:", error?.message);
    return null;
  }

  return user.id;
}

/**
 * Creates a Supabase client and validates the user's session.
 * Returns both the client and user info.
 *
 * @param authHeader - The Authorization header from the request
 * @throws AuthError if authentication fails
 */
export async function createAuthenticatedClient(
  authHeader: string | null
): Promise<{ client: SupabaseClient; userId: string; user: { id: string; phone?: string; email?: string } }> {
  if (!authHeader) {
    throw new AuthError("No authorization header provided");
  }

  // Pre-flight expiry check — fail fast with clear error instead of
  // letting GoTrue return a generic "Invalid token" message
  if (isJwtExpired(authHeader)) {
    throw new AuthError("Token expired");
  }

  const client = createUserClient(authHeader);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new AuthError(`Authentication failed: ${error?.message ?? "Invalid token"}`);
  }

  // Check if the token's JTI is in the revoked list.
  // Non-fatal: if the query fails (table doesn't exist, network), allow through.
  const token = authHeader.replace("Bearer ", "");
  const payload = decodeJwtPayload(token);
  const jti = payload?.session_id as string | undefined;
  if (jti) {
    try {
      const serviceClient = createServiceClient();
      const { data: revoked } = await serviceClient
        .from("revoked_tokens")
        .select("jti")
        .eq("jti", jti)
        .maybeSingle();
      if (revoked) {
        throw new AuthError("Session revoked");
      }
    } catch (err) {
      // Only re-throw if it's our AuthError (revoked token).
      // Swallow query failures — don't break auth on table issues.
      if (err instanceof AuthError) throw err;
    }
  }

  return {
    client,
    userId: user.id,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
    },
  };
}

// ==============================================
// SESSION TRACKING
// ==============================================

/**
 * Records a new session in active_sessions after successful authentication.
 * Called by auth-otp after OTP verification.
 *
 * @param userId - The authenticated user's ID
 * @param sessionId - JWT session_id (jti) claim — used for revocation
 * @param request - The original HTTP request (for IP/user-agent metadata)
 */
export async function recordSession(
  userId: string,
  sessionId: string | null,
  request?: Request
): Promise<void> {
  try {
    // Validate IP format before inserting into INET column — malformed
    // x-forwarded-for headers would crash the entire insert.
    const rawIp = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const validIp = rawIp && /^[\d.:a-fA-F]+$/.test(rawIp) ? rawIp : null;

    const serviceClient = createServiceClient();
    await serviceClient.from("active_sessions").insert({
      user_id: userId,
      token_jti: sessionId,
      device_info: request?.headers.get("x-client-info") ?? null,
      ip_address: validIp,
      user_agent: request?.headers.get("user-agent")?.slice(0, 256) ?? null,
    });
  } catch (err) {
    // Non-fatal — don't break login if session tracking fails
    console.error("[session-tracking] Failed to record session:", err);
  }
}

/**
 * Revokes all active sessions for a user.
 * Called on re-authentication (new login) and account deletion.
 * Uses the DB function revoke_all_user_sessions() which also blacklists JTIs.
 *
 * @param userId - The user whose sessions to revoke
 * @param reason - Why sessions are being revoked
 */
export async function revokeUserSessions(
  userId: string,
  reason: string = "Re-authenticated"
): Promise<void> {
  try {
    const serviceClient = createServiceClient();
    await serviceClient.rpc("revoke_all_user_sessions", {
      p_user_id: userId,
      p_reason: reason,
    });
  } catch (err) {
    // Non-fatal — don't break login if revocation fails
    console.error("[session-tracking] Failed to revoke sessions:", err);
  }
}

// ==============================================
// SERVICE ROLE AUTHORIZATION
// ==============================================

/**
 * Verifies that a request is using the service role key.
 * Use this for internal-only endpoints that should not be accessible by users.
 *
 * @param authHeader - The Authorization header from the request
 * @returns true if the request is using service role authentication
 * @throws AuthError if authorization fails
 */
export function verifyServiceRole(authHeader: string | null): boolean {
  if (!authHeader) {
    throw new AuthError("No authorization header provided");
  }

  const token = authHeader.replace("Bearer ", "");

  // Accept the service role key via direct comparison with the env var.
  // This works for both legacy JWT keys and new sb_secret_* keys.
  // No unsigned JWT fallback — that would let anyone forge admin access
  // by crafting a JWT payload with role:"service_role".
  if (token === SUPABASE_SERVICE_ROLE_KEY) {
    return true;
  }

  throw new AuthError("Unauthorized - service role required");
}

/**
 * Checks if request has valid service role authorization.
 * Returns boolean instead of throwing - use for conditional logic.
 *
 * @param authHeader - The Authorization header from the request
 * @returns true if the request is using service role authentication
 */
export function hasServiceRoleAuth(authHeader: string | null): boolean {
  if (!authHeader) return false;

  const token = authHeader.replace("Bearer ", "");
  return token === SUPABASE_SERVICE_ROLE_KEY;
}

// ==============================================
// ENVIRONMENT HELPERS
// ==============================================

/**
 * Checks if we're running in a production environment.
 */
export function isProduction(): boolean {
  const env = Deno.env.get("ENVIRONMENT") ?? Deno.env.get("DENO_ENV");
  return env === "production";
}

/**
 * Checks if we're running in a development/local environment.
 */
export function isDevelopment(): boolean {
  const url = SUPABASE_URL ?? "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}

/**
 * Gets the base URL for the Supabase project.
 */
export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

// ==============================================
// DATABASE TYPES (Generated - keep in sync)
// ==============================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          phone: string | null;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          phone?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
        };
      };
      tenancies: {
        Row: {
          id: string;
          user_id: string;
          status: "pending_verification" | "active" | "expired" | "terminated";
          monthly_rent_paise: number;
          rent_due_day: number;
          lease_start_date: string;
          lease_end_date: string | null;
          property_address: string;
          landlord_name: string;
          landlord_phone: string | null;
          bank_verified: boolean;
          utility_verified: boolean;
          landlord_approved: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          tenancy_id: string;
          user_id: string;
          amount_paise: number;
          pg_fee_paise: number;
          cashback_applied_paise: number;
          status: "pending" | "processing" | "success" | "failed" | "refunded";
          payu_txn_id: string | null;
          payu_mihpayid: string | null;
          payment_method: string | null;
          idempotency_key: string;
          payment_month: string;
          created_at: string;
          paid_at: string | null;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          party_type: "tenant" | "landlord";
          account_holder_name: string;
          account_number_masked: string;
          ifsc_code: string;
          verified: boolean;
          created_at: string;
        };
      };
    };
  };
}
