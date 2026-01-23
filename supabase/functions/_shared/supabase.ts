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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required Supabase environment variables. " +
      "Ensure SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set."
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
 * Extracts and validates the user ID from a request's JWT.
 *
 * @param authHeader - The Authorization header from the request
 * @returns The user ID if valid, null otherwise
 */
export async function getUserIdFromAuth(
  authHeader: string | null
): Promise<string | null> {
  if (!authHeader) return null;

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

  const client = createUserClient(authHeader);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new AuthError(`Authentication failed: ${error?.message ?? "Invalid token"}`);
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

  // Use strict equality comparison - no substring matching
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new AuthError("Unauthorized - service role required");
  }

  return true;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
        };
        Update: {
          phone?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
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
          rent_month: string;
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
