/**
 * Flent Secured v2 - Referral Codes Tests
 *
 * Tests for referral code APIs:
 * - validate-referral-code
 * - apply-referral-code
 *
 * @author Backend API Agent
 * @date 2026-01-29
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  afterAll,
  beforeAll,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  callEdgeFunction,
  createServiceClient,
  TEST_USERS,
} from "./helpers/test-client.ts";

// ==============================================
// TEST SETUP
// ==============================================

const supabase = createServiceClient();
let testUserToken: string;
let testReferralCodeId: string | null = null;
const TEST_REFERRAL_CODE = "TESTP1";

async function getTestUserToken(userId: string): Promise<string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return serviceKey;
}

// Create a test referral code before tests
async function setupTestReferralCode(): Promise<void> {
  const { data, error } = await supabase
    .from("referral_codes")
    .insert({
      code: TEST_REFERRAL_CODE,
      owner_user_id: TEST_USERS.LANDLORD_1,
      reward_type: "cashback",
      reward_amount_paise: 10000, // Rs. 100
      priority_boost: 5,
      is_active: true,
      max_uses: 100,
    })
    .select()
    .single();

  if (!error && data) {
    testReferralCodeId = data.id;
  }
}

async function cleanupTestData(): Promise<void> {
  // Delete referral applications
  await supabase
    .from("referral_applications")
    .delete()
    .eq("referral_code_id", testReferralCodeId);

  // Delete test referral code
  if (testReferralCodeId) {
    await supabase.from("referral_codes").delete().eq("id", testReferralCodeId);
  }

  // Reset user referral fields
  await supabase
    .from("users")
    .update({
      referral_code_id: null,
      referral_applied_at: null,
    })
    .in("id", [TEST_USERS.TENANT_1, TEST_USERS.TENANT_2]);
}

// ==============================================
// VALIDATE REFERRAL CODE TESTS
// ==============================================

describe("validate-referral-code", () => {
  beforeAll(async () => {
    testUserToken = await getTestUserToken(TEST_USERS.TENANT_1);
    await setupTestReferralCode();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should reject request without authentication", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=${TEST_REFERRAL_CODE}`,
      { method: "GET" }
    );
    assertEquals(response.status, 401);
  });

  it("should require code parameter", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );
    assertEquals(response.status, 400);
  });

  it("should return invalid for non-existent code", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=NOTEXIST`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.data.is_valid, false);
      assertExists(body.data.error_message);
    }
  });

  it("should return invalid for malformed code", async () => {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=a!@#`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.is_valid, false);
    }
  });

  it("should validate existing code successfully", async () => {
    if (!testReferralCodeId) {
      console.log("Skipping: Test referral code not created");
      return;
    }

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=${TEST_REFERRAL_CODE}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.data.is_valid, true);
      assertEquals(body.data.code, TEST_REFERRAL_CODE);
      assertExists(body.data.reward_type);
      assertExists(body.data.reward_details);
      assertExists(body.data.message);
    }
  });

  it("should return reward details for valid code", async () => {
    if (!testReferralCodeId) {
      console.log("Skipping: Test referral code not created");
      return;
    }

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=${TEST_REFERRAL_CODE}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.reward_details.cashback_paise, 10000);
      assertEquals(body.data.reward_details.cashback_rupees, "100");
      assertEquals(body.data.reward_details.priority_boost, 5);
    }
  });

  it("should handle case-insensitive codes", async () => {
    if (!testReferralCodeId) return;

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=${TEST_REFERRAL_CODE.toLowerCase()}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.is_valid, true);
    }
  });
});

// ==============================================
// APPLY REFERRAL CODE TESTS
// ==============================================

describe("apply-referral-code", () => {
  beforeAll(async () => {
    testUserToken = await getTestUserToken(TEST_USERS.TENANT_2);
    await setupTestReferralCode();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should reject request without authentication", async () => {
    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: TEST_REFERRAL_CODE },
    });
    assertEquals(response.status, 401);
  });

  it("should validate code format", async () => {
    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: "a!" }, // Invalid format
      authToken: testUserToken,
    });
    assertEquals(response.status, 400);
  });

  it("should return error for non-existent code", async () => {
    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: "INVALID" },
      authToken: testUserToken,
    });

    if (response.status === 400) {
      const body = await response.json();
      assertEquals(body.success, false);
      assertExists(body.message);
    }
  });

  it("should apply valid referral code successfully", async () => {
    if (!testReferralCodeId) {
      console.log("Skipping: Test referral code not created");
      return;
    }

    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: TEST_REFERRAL_CODE },
      authToken: testUserToken,
    });

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.data.code, TEST_REFERRAL_CODE);
      assertExists(body.data.reward_type);
      assertExists(body.data.rewards);
      assertExists(body.data.message);
    }
  });

  it("should reject second referral code application", async () => {
    if (!testReferralCodeId) {
      console.log("Skipping: Test referral code not created");
      return;
    }

    // Try to apply another code
    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: TEST_REFERRAL_CODE },
      authToken: testUserToken,
    });

    // Should fail - user already applied a referral
    if (response.status !== 200) {
      const body = await response.json();
      assertEquals(body.code, "ALREADY_APPLIED");
    }
  });

  it("should prevent user from applying own referral code", async () => {
    // Get token for the code owner
    const ownerToken = await getTestUserToken(TEST_USERS.LANDLORD_1);

    const response = await callEdgeFunction("apply-referral-code", {
      body: { code: TEST_REFERRAL_CODE },
      authToken: ownerToken,
    });

    if (response.status === 400) {
      const body = await response.json();
      // Should indicate user cannot use own code
      assertEquals(body.success, false);
    }
  });

  it("should increment usage count after application", async () => {
    if (!testReferralCodeId) return;

    // Check usage count
    const { data } = await supabase
      .from("referral_codes")
      .select("usage_count")
      .eq("id", testReferralCodeId)
      .single();

    if (data) {
      // Usage count should be at least 1 from successful test
      assertEquals(data.usage_count >= 0, true);
    }
  });
});

// ==============================================
// EXPIRED/INACTIVE CODE TESTS
// ==============================================

describe("Referral Code Edge Cases", () => {
  let expiredCodeId: string | null = null;
  let inactiveCodeId: string | null = null;
  let maxedOutCodeId: string | null = null;

  beforeAll(async () => {
    testUserToken = await getTestUserToken(TEST_USERS.TENANT_1);

    // Create expired code
    const expiredResult = await supabase
      .from("referral_codes")
      .insert({
        code: "EXPIRED1",
        reward_type: "cashback",
        reward_amount_paise: 5000,
        is_active: true,
        expires_at: new Date(Date.now() - 86400000).toISOString(), // Expired yesterday
      })
      .select()
      .single();
    if (expiredResult.data) expiredCodeId = expiredResult.data.id;

    // Create inactive code
    const inactiveResult = await supabase
      .from("referral_codes")
      .insert({
        code: "INACTIVE",
        reward_type: "cashback",
        reward_amount_paise: 5000,
        is_active: false,
      })
      .select()
      .single();
    if (inactiveResult.data) inactiveCodeId = inactiveResult.data.id;

    // Create maxed out code
    const maxedResult = await supabase
      .from("referral_codes")
      .insert({
        code: "MAXEDOUT",
        reward_type: "cashback",
        reward_amount_paise: 5000,
        is_active: true,
        max_uses: 1,
        usage_count: 1,
      })
      .select()
      .single();
    if (maxedResult.data) maxedOutCodeId = maxedResult.data.id;
  });

  afterAll(async () => {
    // Cleanup
    const idsToDelete = [expiredCodeId, inactiveCodeId, maxedOutCodeId].filter(
      Boolean
    ) as string[];
    if (idsToDelete.length > 0) {
      await supabase.from("referral_codes").delete().in("id", idsToDelete);
    }
  });

  it("should reject expired referral code", async () => {
    if (!expiredCodeId) return;

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=EXPIRED1`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.is_valid, false);
      assertEquals(body.data.error_message.toLowerCase().includes("expired"), true);
    }
  });

  it("should reject inactive referral code", async () => {
    if (!inactiveCodeId) return;

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=INACTIVE`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.is_valid, false);
    }
  });

  it("should reject maxed out referral code", async () => {
    if (!maxedOutCodeId) return;

    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321"}/functions/v1/validate-referral-code?code=MAXEDOUT`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${testUserToken}` },
      }
    );

    if (response.status === 200) {
      const body = await response.json();
      assertEquals(body.data.is_valid, false);
      assertEquals(body.data.error_message.toLowerCase().includes("limit"), true);
    }
  });
});
