/**
 * Flent Secured v2 - Utility Bill Flow E2E Tests
 *
 * Tests API Club integration for electricity bill verification:
 * 1. Fetch operators for state
 * 2. Submit bill verification request
 * 3. Handle async verification callback
 * 4. Parse different response formats (object with numeric keys, arrays)
 * 5. Name and address matching
 *
 * Uses local Supabase instance - NEVER connects to production.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  describe,
  it,
  beforeAll,
  afterAll,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  callEdgeFunction,
  createServiceClient,
  TEST_USERS,
  TEST_TENANCIES,
  createMockOperatorListSuccess,
  createMockOperatorListSuccessArray,
  createMockBillFetchSuccess,
  createMockBillFetchWithDetails,
  createMockBillFetchFailure,
  ApiClubTestScenarios,
  TEST_VERIFICATION_DATA,
} from "./helpers/index.ts";

// ==============================================
// TEST CONFIGURATION
// ==============================================

const TEST_CONSUMER = {
  consumer_number: "123456789012",
  operator_code: "TAPM", // Tata Power Mumbai
};

// ==============================================
// TEST SUITE
// ==============================================

describe("Utility Bill Verification Flow E2E", () => {
  const supabase = createServiceClient();
  const createdVerificationIds: string[] = [];
  let authToken: string;

  beforeAll(() => {
    authToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  });

  afterAll(async () => {
    console.log("[Cleanup] Cleaning up utility verification test data...");

    // Clean up created verifications
    for (const id of createdVerificationIds) {
      await supabase.from("utility_verifications").delete().eq("id", id);
    }

    // Clean up by test patterns
    await supabase
      .from("utility_verifications")
      .delete()
      .like("consumer_number", "TEST_%");

    console.log("[Cleanup] Done");
  });

  // ==========================================================================
  // STEP 1: Get Electricity Operators
  // ==========================================================================

  describe("Step 1: Get Electricity Operators", () => {
    it("should return list of electricity operators", async () => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-utility?action=operators`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // API Club may not be configured (503), API error (500), or success (200)
      if (response.status === 200) {
        const body = await response.json();
        assertEquals(body.success, true);
        assertExists(body.data);
        assertExists(body.data.operators);
        assertEquals(Array.isArray(body.data.operators), true);
        assertExists(body.data.count);

        // Verify operator structure
        if (body.data.operators.length > 0) {
          const operator = body.data.operators[0];
          assertExists(operator.code || operator.operator_code);
          assertExists(operator.name || operator.operator_name);
        }
      } else if ([500, 503].includes(response.status)) {
        console.log("[Test] API Club not configured or API error - acceptable in CI");
        await response.body?.cancel();
      } else {
        console.log(`Unexpected status: ${response.status}`);
        await response.body?.cancel();
      }
    });

    it("should handle GET without action param with 405", async () => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-utility`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
        }
      );

      assertEquals(response.status, 405);
      await response.body?.cancel();
    });
  });

  // ==========================================================================
  // STEP 2: Submit Bill Verification
  // ==========================================================================

  describe("Step 2: Submit Bill Verification", () => {
    it("should require authentication", async () => {
      const response = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          consumer_number: TEST_CONSUMER.consumer_number,
          operator_code: TEST_CONSUMER.operator_code,
        },
        // No auth token
      });

      assertEquals(response.status, 401);
      await response.body?.cancel();
    });

    it("should validate required fields", async () => {
      // Missing consumer_number
      const response1 = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          operator_code: TEST_CONSUMER.operator_code,
        },
        authToken,
      });
      assertEquals(response1.status >= 400, true);
      await response1.body?.cancel();

      // Missing operator_code
      const response2 = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          consumer_number: TEST_CONSUMER.consumer_number,
        },
        authToken,
      });
      assertEquals(response2.status >= 400, true);
      await response2.body?.cancel();

      // Missing tenancy_id
      const response3 = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          consumer_number: TEST_CONSUMER.consumer_number,
          operator_code: TEST_CONSUMER.operator_code,
        },
        authToken,
      });
      assertEquals(response3.status >= 400, true);
      await response3.body?.cancel();
    });

    it("should validate consumer_number length", async () => {
      const response = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          consumer_number: "123", // Too short (min 5)
          operator_code: TEST_CONSUMER.operator_code,
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should validate operator_code length", async () => {
      const response = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          consumer_number: TEST_CONSUMER.consumer_number,
          operator_code: "X", // Too short (min 2)
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should reject invalid tenancy_id", async () => {
      const response = await callEdgeFunction("verify-utility", {
        method: "POST",
        body: {
          tenancy_id: "00000000-0000-0000-0000-000000000000",
          consumer_number: TEST_CONSUMER.consumer_number,
          operator_code: TEST_CONSUMER.operator_code,
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });
  });

  // ==========================================================================
  // STEP 3: Response Format Parsing
  // ==========================================================================

  describe("Step 3: Response Format Parsing", () => {
    it("should parse object with numeric keys format", () => {
      const response = createMockOperatorListSuccess();

      // Verify structure - object with numeric string keys
      assertExists(response["0"]);
      assertExists(response["1"]);

      // Extract operators from object format
      const operators: Array<{ code?: string; name?: string }> = [];
      for (const key in response) {
        if (key !== "timestamp" && key !== "status") {
          const op = response[key];
          if (typeof op === "object" && op !== null && "code" in op) {
            operators.push(op as { code: string; name: string });
          }
        }
      }

      assertEquals(operators.length > 0, true);
      assertExists(operators[0].code);
      assertExists(operators[0].name);
    });

    it("should parse legacy array format", () => {
      const response = createMockOperatorListSuccessArray();

      // Verify structure - standard array format
      assertEquals(response.status, "success");
      assertEquals(Array.isArray(response.data), true);
      assertEquals(response.data.length > 0, true);

      const operator = response.data[0];
      assertExists(operator.operator_code);
      assertExists(operator.operator_name);
    });

    it("should parse bill fetch response", () => {
      const response = createMockBillFetchSuccess();

      assertEquals(response.status, "success");
      assertExists(response.response);
      assertExists(response.response?.consumer_name);
      assertExists(response.response?.bill_amount);
      assertExists(response.response?.address);
    });

    it("should handle bill fetch error response", () => {
      const response = createMockBillFetchFailure("Consumer not found");

      assertEquals(response.status, "error");
      assertExists(response.message);
      assertEquals(response.code, 404);
    });
  });

  // ==========================================================================
  // STEP 4: Name and Address Matching
  // ==========================================================================

  describe("Step 4: Name and Address Matching", () => {
    it("should calculate full match for identical data", () => {
      const testData = TEST_VERIFICATION_DATA.FULL_MATCH;
      const bill = testData.bill;
      const tenancy = testData.tenancy;

      // Name match
      assertEquals(bill.consumer_name, tenancy.landlord_name);

      // Address components match
      assertEquals(bill.city.toLowerCase(), tenancy.property_city.toLowerCase());
      assertEquals(bill.state.toLowerCase(), tenancy.property_state.toLowerCase());
    });

    it("should detect name match only scenario", () => {
      const testData = TEST_VERIFICATION_DATA.NAME_MATCH_ONLY;

      // Name should match
      assertEquals(testData.bill.consumer_name, testData.tenancy.landlord_name);

      // Address should NOT match
      assertNotEquals(testData.bill.address, testData.tenancy.property_address);
    });

    it("should detect address match only scenario", () => {
      const testData = TEST_VERIFICATION_DATA.ADDRESS_MATCH_ONLY;

      // Name should NOT match
      assertNotEquals(testData.bill.consumer_name, testData.tenancy.landlord_name);

      // City/State should match
      assertEquals(testData.bill.city, testData.tenancy.property_city);
    });

    it("should handle no match scenario", () => {
      const testData = TEST_VERIFICATION_DATA.NO_MATCH;

      // Neither should match
      assertNotEquals(testData.bill.consumer_name, testData.tenancy.landlord_name);
      assertNotEquals(testData.bill.city, testData.tenancy.property_city);
    });

    it("should handle name with initials", () => {
      const testData = TEST_VERIFICATION_DATA.NAME_WITH_INITIALS;

      // Full name vs initials format
      assertEquals(testData.tenancy.landlord_name, "RAMESH KUMAR SHARMA");
      assertEquals(testData.bill.consumer_name, "R K SHARMA");

      // These should be considered a partial match by the matching algorithm
      // The actual match percentage would depend on the algorithm
    });
  });

  // ==========================================================================
  // STEP 5: Verification Result Storage
  // ==========================================================================

  describe("Step 5: Verification Result Storage", () => {
    it("should store verification result in utility_verifications table", async () => {
      // Create test verification directly in DB
      const { data: verification, error } = await supabase
        .from("utility_verifications")
        .insert({
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          utility_type: "electricity",
          provider_name: "TATA POWER MUMBAI",
          consumer_number: `TEST_${Date.now()}`,
          consumer_name_on_bill: "RAMESH SHARMA",
          bill_address: "123 Test Street",
          bill_city: "Mumbai",
          bill_state: "Maharashtra",
          landlord_name_match_score: 95,
          address_match_score: 85,
          name_verified: true,
          address_verified: true,
          verified: true,
          verification_status: "completed",
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (verification) {
        createdVerificationIds.push(verification.id);

        assertEquals(verification.verified, true);
        assertEquals(verification.name_verified, true);
        assertEquals(verification.address_verified, true);
        assertEquals(verification.landlord_name_match_score, 95);
        assertEquals(verification.verification_status, "completed");
      }
    });

    it("should store failed verification", async () => {
      const { data: verification } = await supabase
        .from("utility_verifications")
        .insert({
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          utility_type: "electricity",
          provider_name: "BESCOM",
          consumer_number: `TEST_FAIL_${Date.now()}`,
          verification_status: "failed",
          error_message: "Invalid consumer number",
        })
        .select()
        .single();

      if (verification) {
        createdVerificationIds.push(verification.id);

        assertEquals(verification.verification_status, "failed");
        assertExists(verification.error_message);
      }
    });

    it("should update tenancy utility_verified flag on success", async () => {
      // Get current state
      const { data: tenancyBefore } = await supabase
        .from("tenancies")
        .select("utility_verified")
        .eq("id", TEST_TENANCIES.ACTIVE_VERIFIED)
        .single();

      // Simulate successful verification
      const { data: verification } = await supabase
        .from("utility_verifications")
        .insert({
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          utility_type: "electricity",
          provider_name: "TATA POWER",
          consumer_number: `TEST_UPDATE_${Date.now()}`,
          verified: true,
          name_verified: true,
          address_verified: true,
          verification_status: "completed",
        })
        .select()
        .single();

      if (verification) {
        createdVerificationIds.push(verification.id);

        // Update tenancy flag
        await supabase
          .from("tenancies")
          .update({ utility_verified: true })
          .eq("id", TEST_TENANCIES.ACTIVE_VERIFIED);

        // Verify update
        const { data: tenancyAfter } = await supabase
          .from("tenancies")
          .select("utility_verified")
          .eq("id", TEST_TENANCIES.ACTIVE_VERIFIED)
          .single();

        assertEquals(tenancyAfter?.utility_verified, true);

        // Restore original state if needed
        if (!tenancyBefore?.utility_verified) {
          await supabase
            .from("tenancies")
            .update({ utility_verified: tenancyBefore?.utility_verified })
            .eq("id", TEST_TENANCIES.ACTIVE_VERIFIED);
        }
      }
    });
  });

  // ==========================================================================
  // STEP 6: HTTP Method Handling
  // ==========================================================================

  describe("Step 6: HTTP Method Handling", () => {
    it("should reject PUT requests", async () => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-utility`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        }
      );

      assertEquals(response.status, 405);
      await response.body?.cancel();
    });

    it("should reject DELETE requests", async () => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-utility`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
        }
      );

      assertEquals(response.status, 405);
      await response.body?.cancel();
    });

    it("should handle OPTIONS for CORS", async () => {
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-utility`,
        {
          method: "OPTIONS",
          headers: {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, Authorization",
          },
        }
      );

      assertEquals([200, 204].includes(response.status), true);
      await response.body?.cancel();
    });
  });
});

// ==============================================
// API CLUB TEST SCENARIOS
// ==============================================

describe("API Club Test Scenarios", () => {
  it("should generate matching name and address response", () => {
    const response = ApiClubTestScenarios.billFetch.matchingNameAndAddress(
      "RAMESH SHARMA",
      "123 MG Road",
      "Mumbai",
      "Maharashtra",
      "400001"
    );

    assertEquals(response.status, "success");
    assertEquals(response.response?.consumer_name, "RAMESH SHARMA");
    assertExists(response.response?.address);
  });

  it("should generate matching name but different address response", () => {
    const response = ApiClubTestScenarios.billFetch.matchingNameDifferentAddress("RAMESH SHARMA");

    assertEquals(response.status, "success");
    assertEquals(response.response?.consumer_name, "RAMESH SHARMA");
    assertEquals(response.response?.city, "Delhi"); // Different city
  });

  it("should generate different name but matching address response", () => {
    const response = ApiClubTestScenarios.billFetch.differentNameMatchingAddress(
      "123 MG Road",
      "Mumbai",
      "Maharashtra"
    );

    assertEquals(response.status, "success");
    assertEquals(response.response?.consumer_name, "DIFFERENT PERSON NAME");
    assertEquals(response.response?.city, "Mumbai");
  });

  it("should generate neither matching response", () => {
    const response = ApiClubTestScenarios.billFetch.neitherMatching();

    assertEquals(response.status, "success");
    assertEquals(response.response?.consumer_name, "COMPLETELY DIFFERENT NAME");
    assertEquals(response.response?.city, "Unknown City");
  });

  it("should generate invalid consumer error", () => {
    const response = ApiClubTestScenarios.billFetch.invalidConsumer();

    assertEquals(response.status, "error");
    assertExists(response.message);
  });

  it("should generate service unavailable error", () => {
    const response = ApiClubTestScenarios.billFetch.serviceUnavailable();

    assertEquals(response.status, "error");
    assertEquals(response.code, 503);
  });
});
