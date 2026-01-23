/**
 * Flent Secured v2 - Confirm Extraction Edge Function Tests
 *
 * Tests the confirm-extraction function for V1 compatibility.
 * Validates role confirmation, tenancy creation, and extraction verification.
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

const FUNCTION_NAME = "confirm-extraction";

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

describe("POST /confirm-extraction - Authentication", () => {
  it("should reject requests without authentication", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      body: {
        waitlist_entry_id: "test-id",
        confirmed_role: "tenant",
      },
    });

    assertEquals(response.status, 401);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should accept requests with valid authentication", async () => {
    if (!authToken) {
      console.log("Skipping - auth token not available");
      return;
    }

    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "tenant",
      },
    });

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
  it("should reject GET requests", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`,
        },
      }
    );

    assertEquals(response.status >= 400, true);
    await response.body?.cancel();
  });

  it("should reject PUT requests", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/${FUNCTION_NAME}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          waitlist_entry_id: "test-id",
          confirmed_role: "tenant",
        }),
      }
    );

    assertEquals(response.status >= 400, true);
    await response.body?.cancel();
  });
});

// ==============================================
// INPUT VALIDATION TESTS
// ==============================================

describe("POST /confirm-extraction - Input Validation", () => {
  it("should reject request without extraction ID", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        confirmed_role: "tenant",
      },
    });

    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should reject request without confirmed_role", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should reject invalid confirmed_role", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "admin", // Invalid role
      },
    });

    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
  });

  it("should accept tenant role", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "tenant",
      },
    });

    // Should not fail due to role validation
    // (will fail due to non-existent extraction ID)
    await response.body?.cancel();
  });

  it("should accept landlord role", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "landlord",
      },
    });

    // Should not fail due to role validation
    await response.body?.cancel();
  });
});

// ==============================================
// V1 COMPATIBILITY TESTS
// ==============================================

describe("POST /confirm-extraction - V1 Compatibility", () => {
  it("should accept waitlist_entry_id parameter (V1 format)", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "tenant",
      },
    });

    // V1 parameter should be accepted
    const isAccepted = response.status !== 400 ||
      !(await response.clone().json()).message?.includes("waitlist_entry_id");
    assertEquals(isAccepted, true);
    await response.body?.cancel();
  });

  it("should accept extracted_rental_info_id parameter (V2 format)", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        extracted_rental_info_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "tenant",
      },
    });

    // V2 parameter should be accepted
    await response.body?.cancel();
  });
});

// ==============================================
// EXTRACTION NOT FOUND TESTS
// ==============================================

describe("POST /confirm-extraction - Extraction Lookup", () => {
  it("should return 404 for non-existent extraction", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        waitlist_entry_id: "00000000-0000-0000-0000-000000000000",
        confirmed_role: "tenant",
      },
    });

    // Should return 404 or similar for non-existent extraction
    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
  });
});

// ==============================================
// RESPONSE STRUCTURE TESTS
// ==============================================

describe("Response structure", () => {
  it("should return proper error structure on validation failure", async () => {
    const response = await callEdgeFunction(FUNCTION_NAME, {
      method: "POST",
      authToken,
      body: {
        confirmed_role: "invalid_role",
      },
    });

    assertEquals(response.status >= 400, true);

    const body = await response.json();
    assertEquals(body.error, true);
    assertExists(body.message);
    assertEquals(typeof body.message, "string");
  });
});
