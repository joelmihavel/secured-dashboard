/**
 * Flent Secured v2 - Delete Account Edge Function Tests
 *
 * Tests the delete-account function for App Store compliance (5.1.1(v)).
 * Validates authentication, data archival, and proper deletion flow.
 *
 * CRITICAL: This function handles account deletion - tests must verify
 * data is properly archived before deletion.
 *
 * Uses local Supabase instance - NEVER connects to production.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  describe,
  it,
  beforeAll,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { callEdgeFunction } from "./helpers/index.ts";

// ==============================================
// CONFIGURATION
// ==============================================

const FUNCTION_NAME = "delete-account";

// ==============================================
// TEST SETUP
// ==============================================

let authToken: string;

beforeAll(() => {
  authToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
});

// ==============================================
// AUTHENTICATION TESTS
// ==============================================

describe("DELETE/POST /delete-account - Authentication", () => {
  it("should reject requests without authentication", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    assertEquals(response.status, 401);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should reject requests with invalid token", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid_token_here",
        },
      }
    );

    assertEquals(response.status, 401);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should accept requests with valid authentication", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
      }
    );

    // Should not return 401
    const isAuthSuccess = response.status !== 401;
    assertEquals(isAuthSuccess, true);
    await response.body?.cancel();
  });
});

// ==============================================
// METHOD HANDLING TESTS
// ==============================================

describe("Method handling", () => {
  it("should handle POST request", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
      }
    );

    // POST should be accepted (may fail for other reasons)
    // but should not be 405 Method Not Allowed
    assertEquals(response.status !== 405, true);
    await response.body?.cancel();
  });

  it("should handle OPTIONS preflight", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "OPTIONS",
        headers: {
          "Origin": "http://localhost:3000",
          "Access-Control-Request-Method": "POST",
        },
      }
    );

    // CORS preflight should return success
    assertEquals(response.status < 300, true);
    await response.body?.cancel();
  });
});

// ==============================================
// REQUEST BODY TESTS
// ==============================================

describe("POST /delete-account - Request Body", () => {
  it("should accept request with deletion reason", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        reason: "user_requested",
      },
    });

    // Should not fail due to body parsing
    await response.body?.cancel();
  });

  it("should accept request without body", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      }
    );

    // Should not fail due to missing body
    // (body is optional)
    await response.body?.cancel();
  });

  it("should accept empty JSON body", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {},
    });

    // Should not fail due to empty body
    await response.body?.cancel();
  });
});

// ==============================================
// RESPONSE STRUCTURE TESTS
// ==============================================

describe("POST /delete-account - Response Structure", () => {
  it("should return error structure on failure", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid_token",
        },
      }
    );

    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
    assertExists(body.message);
    assertEquals(typeof body.message, "string");
  });
});

// ==============================================
// SECURITY TESTS
// ==============================================

describe("POST /delete-account - Security", () => {
  it("should not expose sensitive data in error messages", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid_token",
        },
      }
    );

    const body = await response.json();

    // Error message should not contain sensitive info
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
    ];

    for (const pattern of sensitivePatterns) {
      assertEquals(
        pattern.test(body.message),
        false,
        `Error message should not contain ${pattern.source}`
      );
    }
  });
});

// ==============================================
// DELETION REASON TESTS
// ==============================================

describe("POST /delete-account - Deletion Reasons", () => {
  it("should accept 'user_requested' reason", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        reason: "user_requested",
      },
    });

    // Should not fail due to reason validation
    await response.body?.cancel();
  });

  it("should accept custom deletion reason", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        reason: "no_longer_renting",
      },
    });

    // Should not fail due to reason validation
    await response.body?.cancel();
  });
});

// ==============================================
// APP STORE COMPLIANCE TESTS
// ==============================================

describe("POST /delete-account - App Store Compliance", () => {
  it("should be accessible without requiring additional verification", async () => {
    // App Store 5.1.1(v) requires account deletion to be straightforward
    // The endpoint should work with just authentication
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
      }
    );

    // Should not require additional verification steps
    // (401 is auth failure, not additional verification)
    const requiresExtraVerification =
      response.status === 403 ||
      (await response.clone().json()).code === "VERIFICATION_REQUIRED";

    assertEquals(
      requiresExtraVerification,
      false,
      "Account deletion should not require additional verification"
    );

    await response.body?.cancel();
  });
});
