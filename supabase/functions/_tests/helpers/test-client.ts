/**
 * Flent Secured v2 - Test Client Utilities
 * @version 1.1.0
 *
 * Provides helper functions for Edge Function testing.
 * Uses local Supabase instance or preview branches - NEVER connects to production.
 */

// Use jsr for better Deno compatibility in CI environments
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ==============================================
// CONFIGURATION
// ==============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SB_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

// Production project ID - tests NEVER run against this
const PRODUCTION_PROJECT_ID = "uowjtrzmszuaiokqxgir";

// Safety check: Block production, allow local and preview branches
const isLocalUrl = SUPABASE_URL.includes("127.0.0.1") || SUPABASE_URL.includes("localhost");
const isProductionUrl = SUPABASE_URL.includes(PRODUCTION_PROJECT_ID);

if (!isLocalUrl && isProductionUrl) {
  throw new Error(
    "SAFETY: Tests cannot run against production Supabase. " +
    "Use local instance (http://127.0.0.1:54321) or a preview branch."
  );
}

// ==============================================
// CLIENT FACTORIES
// ==============================================

/**
 * Creates a Supabase client with service role (admin) access.
 * Use for test setup/teardown and bypassing RLS.
 */
export function createServiceClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a Supabase client with anon key.
 * Use for testing RLS policies as an unauthenticated user.
 */
export function createAnonClient(): SupabaseClient {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY not set");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a Supabase client authenticated as a specific user.
 * Use for testing RLS policies as an authenticated user.
 */
export async function createAuthenticatedClient(userId: string): Promise<SupabaseClient> {
  const serviceClient = createServiceClient();

  // Generate a JWT for the test user
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email: `test-${userId}@flent.test`,
  });

  if (error) {
    throw new Error(`Failed to create authenticated client: ${error.message}`);
  }

  // Create client with the user's session
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Note: In actual tests, you'd verify the magic link or use a test JWT

  return client;
}

// ==============================================
// TEST DATA HELPERS
// ==============================================

/** Standard test user IDs (match seed.sql) */
export const TEST_USERS = {
  TENANT_1: "11111111-1111-1111-1111-111111111111",
  LANDLORD_1: "22222222-2222-2222-2222-222222222222",
  TENANT_2: "33333333-3333-3333-3333-333333333333",
} as const;

/** Standard test tenancy IDs (match seed.sql) */
export const TEST_TENANCIES = {
  ACTIVE_VERIFIED: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  PENDING_VERIFICATION: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
} as const;

/** Standard test payment IDs (match seed.sql) */
export const TEST_PAYMENTS = {
  SUCCESS: "11111111-0001-1111-1111-111111111111",
  PENDING: "22222222-0001-2222-2222-222222222222",
} as const;

// ==============================================
// EDGE FUNCTION HELPERS
// ==============================================

/**
 * Calls a local Edge Function.
 * @param functionName - Name of the function (e.g., "payment-webhook")
 * @param options - Fetch options (method, body, headers)
 */
export async function callEdgeFunction(
  functionName: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    authToken?: string;
  } = {}
): Promise<Response> {
  const { method = "POST", body, headers = {}, authToken } = options;

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (authToken) {
    requestHeaders["Authorization"] = `Bearer ${authToken}`;
  }

  return fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Calls an Edge Function with form-urlencoded body (for webhooks).
 * Accepts any object - converts values to strings and filters out undefined.
 */
export async function callEdgeFunctionForm(
  functionName: string,
  // deno-lint-ignore no-explicit-any
  formData: Record<string, any>,
  headers: Record<string, string> = {}
): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  // Convert to string record, filtering out undefined values
  const cleanData: Record<string, string> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (value !== undefined && value !== null) {
      cleanData[key] = String(value);
    }
  }

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(cleanData),
  });
}

// ==============================================
// CLEANUP HELPERS
// ==============================================

/**
 * Cleans up test data created during a test.
 * Call in afterEach or at the end of test suites.
 */
export async function cleanupTestData(
  supabase: SupabaseClient,
  tables: {
    payments?: string[];
    tenancies?: string[];
    users?: string[];
    cashback_ledger?: string[];
    audit_logs?: string[];
  }
): Promise<void> {
  // Delete in reverse order of foreign key dependencies
  if (tables.audit_logs?.length) {
    await supabase.from("audit_logs").delete().in("id", tables.audit_logs);
  }
  if (tables.cashback_ledger?.length) {
    await supabase.from("cashback_ledger").delete().in("id", tables.cashback_ledger);
  }
  if (tables.payments?.length) {
    await supabase.from("payments").delete().in("id", tables.payments);
  }
  if (tables.tenancies?.length) {
    await supabase.from("tenancies").delete().in("id", tables.tenancies);
  }
  if (tables.users?.length) {
    await supabase.from("users").delete().in("id", tables.users);
  }
}

// ==============================================
// ASSERTION HELPERS
// ==============================================

/**
 * Asserts that a response has the expected status code.
 */
export function assertStatus(response: Response, expected: number): void {
  if (response.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${response.status}`
    );
  }
}

/**
 * Asserts that a response body contains expected fields.
 */
export async function assertResponseContains(
  response: Response,
  expectedFields: string[]
): Promise<Record<string, unknown>> {
  const body = await response.json();

  for (const field of expectedFields) {
    if (!(field in body)) {
      throw new Error(`Expected field "${field}" not found in response`);
    }
  }

  return body;
}

// ==============================================
// TIMING HELPERS
// ==============================================

/**
 * Waits for a condition to be true, with timeout.
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
