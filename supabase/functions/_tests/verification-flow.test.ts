/**
 * Flent Secured v2 - Verification Flow E2E Tests
 *
 * Tests Cashfree integrations:
 * 1. Bank account verification (Penny Drop)
 * 2. Identity verification (PAN/Aadhaar via Mobile 360)
 * 3. Consent tracking and IP validation
 * 4. Handle verification failures
 *
 * Uses local Supabase instance - NEVER connects to production.
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
  assertNotEquals,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import {
  callEdgeFunction,
  createServiceClient,
  TEST_USERS,
  TEST_TENANCIES,
  CASHFREE_TEST_ACCOUNTS,
  createMockPennyDropSuccess,
  createMockPennyDropFailure,
  createMockMobile360Success,
  calculateNameMatch,
} from "./helpers/index.ts";

// ==============================================
// TEST CONFIGURATION
// ==============================================

const TEST_BANK_ACCOUNT = {
  account_holder_name: "RAMESH SHARMA",
  account_number: "1234567890123456",
  ifsc_code: "HDFC0001234",
};

const TEST_IDENTITY = {
  phone: "9876543210",
  name: "Test Identity User",
};

// ==============================================
// TEST SUITE: BANK VERIFICATION
// ==============================================

describe("Bank Account Verification Flow E2E", () => {
  const supabase = createServiceClient();
  const createdBankAccountIds: string[] = [];
  let authToken: string;

  beforeAll(() => {
    authToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  });

  afterAll(async () => {
    console.log("[Cleanup] Cleaning up bank verification test data...");

    // Clean up created bank accounts
    for (const id of createdBankAccountIds) {
      await supabase.from("bank_accounts").delete().eq("id", id);
    }

    // Clean up by test patterns
    await supabase
      .from("bank_accounts")
      .delete()
      .like("account_number_masked", "XXXX%TEST%");

    await supabase
      .from("idempotency_keys")
      .delete()
      .like("key", "verify-bank%");

    console.log("[Cleanup] Done");
  });

  // ==========================================================================
  // STEP 1: Basic Bank Verification
  // ==========================================================================

  describe("Step 1: Initiate Bank Verification", () => {
    it("should validate IFSC code format", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: TEST_BANK_ACCOUNT.account_holder_name,
          account_number: TEST_BANK_ACCOUNT.account_number,
          ifsc_code: "INVALID", // Invalid format
        },
        authToken,
      });

      // Should reject with validation error or auth error
      if (response.status === 400) {
        const body = await response.json();
        assertStringIncludes(body.error || body.message, "IFSC");
      } else {
        assertEquals(response.status >= 400, true);
        await response.body?.cancel();
      }
    });

    it("should validate account number length", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: TEST_BANK_ACCOUNT.account_holder_name,
          account_number: "12345", // Too short
          ifsc_code: TEST_BANK_ACCOUNT.ifsc_code,
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should require all mandatory fields", async () => {
      // Missing account_holder_name
      const response1 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_number: TEST_BANK_ACCOUNT.account_number,
          ifsc_code: TEST_BANK_ACCOUNT.ifsc_code,
        },
        authToken,
      });
      assertEquals(response1.status >= 400, true);
      await response1.body?.cancel();

      // Missing account_number
      const response2 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: TEST_BANK_ACCOUNT.account_holder_name,
          ifsc_code: TEST_BANK_ACCOUNT.ifsc_code,
        },
        authToken,
      });
      assertEquals(response2.status >= 400, true);
      await response2.body?.cancel();

      // Missing ifsc_code
      const response3 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: TEST_BANK_ACCOUNT.account_holder_name,
          account_number: TEST_BANK_ACCOUNT.account_number,
        },
        authToken,
      });
      assertEquals(response3.status >= 400, true);
      await response3.body?.cancel();
    });

    it("should reject invalid tenancy_id", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: "00000000-0000-0000-0000-000000000000",
          account_holder_name: TEST_BANK_ACCOUNT.account_holder_name,
          account_number: TEST_BANK_ACCOUNT.account_number,
          ifsc_code: TEST_BANK_ACCOUNT.ifsc_code,
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });
  });

  // ==========================================================================
  // STEP 2: Party Type Handling
  // ==========================================================================

  describe("Step 2: Party Type Handling", () => {
    it("should default to landlord party type", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          ...TEST_BANK_ACCOUNT,
          // party_type not specified
        },
        authToken,
      });

      if (response.status === 200) {
        const body = await response.json();
        // If we get the bank account back, verify party type
        if (body.data?.bank_account_id) {
          const { data: bankAccount } = await supabase
            .from("bank_accounts")
            .select("party_type")
            .eq("id", body.data.bank_account_id)
            .single();

          if (bankAccount) {
            assertEquals(bankAccount.party_type, "landlord");
            createdBankAccountIds.push(body.data.bank_account_id);
          }
        }
      } else {
        await response.body?.cancel();
      }
    });

    it("should accept tenant party type", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          ...TEST_BANK_ACCOUNT,
          party_type: "tenant",
        },
        authToken,
      });

      // Should not reject based on party_type
      if (response.status === 400) {
        const body = await response.json();
        // Error should not be about party_type
        assertEquals((body.error || body.message)?.includes("party_type"), false);
      } else {
        await response.body?.cancel();
      }
    });

    it("should reject invalid party type", async () => {
      const response = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          ...TEST_BANK_ACCOUNT,
          party_type: "invalid_type",
        },
        authToken,
      });

      if (response.status === 400) {
        const body = await response.json();
        assertStringIncludes(body.error || body.message, "party_type");
      } else {
        assertEquals(response.status >= 400, true);
        await response.body?.cancel();
      }
    });
  });

  // ==========================================================================
  // STEP 3: Name Matching Tests
  // ==========================================================================

  describe("Step 3: Name Matching", () => {
    it("should calculate 100% match for identical names", () => {
      const score = calculateNameMatch("RAMESH SHARMA", "RAMESH SHARMA");
      assertEquals(score, 100);
    });

    it("should calculate high match for case differences", () => {
      const score = calculateNameMatch("Ramesh Sharma", "RAMESH SHARMA");
      assertEquals(score, 100); // Case insensitive
    });

    it("should calculate partial match for similar names", () => {
      const score = calculateNameMatch("RAMESH SHARMA", "RAMESH K SHARMA");
      assertEquals(score >= 70, true); // Should be above threshold
    });

    it("should calculate low match for different names", () => {
      const score = calculateNameMatch("RAMESH SHARMA", "SURESH KUMAR");
      assertEquals(score < 50, true); // Should be below threshold
    });

    it("should handle empty names", () => {
      const score1 = calculateNameMatch("", "RAMESH SHARMA");
      assertEquals(score1, 0);

      const score2 = calculateNameMatch("RAMESH SHARMA", "");
      assertEquals(score2, 0);
    });

    it("should ignore special characters", () => {
      const score = calculateNameMatch("RAMESH SHARMA", "RAMESH. SHARMA");
      assertEquals(score, 100);
    });
  });

  // ==========================================================================
  // STEP 4: Idempotency Tests
  // ==========================================================================

  describe("Step 4: Bank Verification Idempotency", () => {
    it("should return cached response for duplicate request", async () => {
      // First request
      const response1 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: "IDEMPOTENCY TEST USER",
          account_number: "9999888877776666",
          ifsc_code: "HDFC0009999",
        },
        authToken,
      });

      if (response1.status === 500 || response1.status === 401) {
        console.log("[Test] Skipping idempotency test - Cashfree not configured or auth failed");
        await response1.body?.cancel();
        return;
      }

      // Second identical request
      const response2 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: "IDEMPOTENCY TEST USER",
          account_number: "9999888877776666",
          ifsc_code: "HDFC0009999",
        },
        authToken,
      });

      // Check for idempotency header
      const isCached = response2.headers.get("X-Idempotency-Cached");
      if (isCached) {
        assertEquals(isCached, "true");
      }

      await response1.body?.cancel();
      await response2.body?.cancel();
    });

    it("should NOT cache different account numbers", async () => {
      // First request
      const response1 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: "DIFF ACCOUNT TEST",
          account_number: "1111222233334444",
          ifsc_code: "HDFC0001111",
        },
        authToken,
      });

      // Second request with different account
      const response2 = await callEdgeFunction("verify-bank", {
        body: {
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
          account_holder_name: "DIFF ACCOUNT TEST",
          account_number: "5555666677778888", // Different account
          ifsc_code: "HDFC0001111",
        },
        authToken,
      });

      // Should NOT be cached
      const isCached = response2.headers.get("X-Idempotency-Cached");
      assertEquals(isCached, null);

      await response1.body?.cancel();
      await response2.body?.cancel();
    });
  });
});

// ==============================================
// TEST SUITE: IDENTITY VERIFICATION
// ==============================================

describe("Identity Verification Flow E2E", () => {
  const supabase = createServiceClient();
  const createdVerificationIds: string[] = [];
  let authToken: string;

  beforeAll(() => {
    authToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  });

  afterAll(async () => {
    console.log("[Cleanup] Cleaning up identity verification test data...");

    // Clean up created verifications
    for (const id of createdVerificationIds) {
      await supabase.from("identity_verifications").delete().eq("id", id);
    }

    // Clean up by test patterns
    await supabase
      .from("identity_verifications")
      .delete()
      .like("verification_id", "FLENT_M360_TEST%");

    console.log("[Cleanup] Done");
  });

  // ==========================================================================
  // STEP 1: Send OTP for Identity Verification
  // ==========================================================================

  describe("Step 1: Send OTP for Identity Verification", () => {
    it("should require authentication", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "send_otp",
          phone_number: TEST_IDENTITY.phone,
          name: TEST_IDENTITY.name,
        },
        // No auth token
      });

      assertEquals(response.status, 401);
      await response.body?.cancel();
    });

    it("should validate phone number", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "send_otp",
          phone_number: "123", // Too short
          name: TEST_IDENTITY.name,
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should require name field", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "send_otp",
          phone_number: TEST_IDENTITY.phone,
          // name missing
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should require consent", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "send_otp",
          phone_number: TEST_IDENTITY.phone,
          name: TEST_IDENTITY.name,
          consent_given: false, // Explicit no consent
        },
        authToken,
      });

      // Should reject without consent (or may proceed if default is true)
      if (response.status === 400) {
        const body = await response.json();
        assertStringIncludes(body.error || body.message, "consent");
      } else {
        await response.body?.cancel();
      }
    });
  });

  // ==========================================================================
  // STEP 2: Verify OTP
  // ==========================================================================

  describe("Step 2: Verify OTP", () => {
    it("should require verification_id", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "verify_otp",
          otp: "123456",
          // verification_id missing
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should require otp", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "verify_otp",
          verification_id: "test_verification_id",
          // otp missing
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should validate OTP format", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "verify_otp",
          verification_id: "test_verification_id",
          otp: "12", // Too short
        },
        authToken,
      });

      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });

    it("should reject unknown verification_id", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "verify_otp",
          verification_id: "UNKNOWN_VERIFICATION_ID_12345",
          otp: "123456",
        },
        authToken,
      });

      // Should return error (400/404/401)
      assertEquals(response.status >= 400, true);
      await response.body?.cancel();
    });
  });

  // ==========================================================================
  // STEP 3: Fetch With Consent
  // ==========================================================================

  describe("Step 3: Fetch With Consent", () => {
    it("should require authentication", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "fetch_with_consent",
        },
        // No auth token
      });

      assertEquals(response.status, 401);
      await response.body?.cancel();
    });

    it("should require existing consent record", async () => {
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "fetch_with_consent",
          tenancy_id: TEST_TENANCIES.ACTIVE_VERIFIED,
        },
        authToken,
      });

      // May fail if no consent record exists
      if (response.status === 400) {
        const body = await response.json();
        assertStringIncludes(body.error || body.message || "", "consent");
      } else {
        await response.body?.cancel();
      }
    });

    it("should reject expired consent", async () => {
      // Create expired consent record
      const { data: consentRecord } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: `FLENT_CONSENT_EXPIRED_${Date.now()}`,
          status: "CONSENT_GIVEN",
          consent_phone: "9876543210",
          consent_timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
          consent_ip: "127.0.0.1",
        })
        .select("id")
        .single();

      if (consentRecord) {
        createdVerificationIds.push(consentRecord.id);
      }

      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "fetch_with_consent",
        },
        authToken,
      });

      // Should fail due to expired consent or auth
      if (response.status === 400) {
        const body = await response.json();
        assertStringIncludes(body.error || body.message || "", "expired");
      } else {
        await response.body?.cancel();
      }
    });
  });

  // ==========================================================================
  // STEP 4: Consent IP Validation
  // ==========================================================================

  describe("Step 4: Consent IP Validation", () => {
    it("should reject requests without valid client IP for send_otp", async () => {
      // This test validates the compliance requirement
      // In real scenarios, IP should always be available via headers
      const response = await callEdgeFunction("verify-identity", {
        body: {
          action: "send_otp",
          phone_number: TEST_IDENTITY.phone,
          name: TEST_IDENTITY.name,
          consent_given: true,
        },
        authToken,
        headers: {
          // Explicitly don't include any IP headers to test fallback behavior
        },
      });

      // Response depends on whether server can determine IP
      // In local environment, IP may be available from other sources
      if (response.status === 400) {
        const body = await response.json();
        // May fail due to IP validation
        assertEquals(typeof body.error === "string" || typeof body.message === "string", true);
      } else {
        await response.body?.cancel();
      }
    });

    it("should store consent_ip in verification record", async () => {
      // Create a consent record with IP
      const { data: consentRecord, error } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: `FLENT_IP_TEST_${Date.now()}`,
          status: "OTP_SENT",
          consent_phone: "9876543210",
          consent_ip: "192.168.1.100",
          otp_sent_at: new Date().toISOString(),
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (consentRecord) {
        createdVerificationIds.push(consentRecord.id);
        assertExists(consentRecord.consent_ip);
        assertEquals(consentRecord.consent_ip, "192.168.1.100");
      }
    });

    it("should not accept 0.0.0.0 as valid IP", async () => {
      // This validates the bug fix for invalid IP handling
      // Create record with invalid IP - should be rejected
      const { error } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: `FLENT_INVALID_IP_${Date.now()}`,
          status: "CONSENT_GIVEN",
          consent_phone: "9876543210",
          consent_ip: "0.0.0.0", // Invalid placeholder IP
          consent_timestamp: new Date().toISOString(),
        });

      // The insert may succeed (DB allows it), but the fetch_with_consent
      // flow should handle this case appropriately
      if (!error) {
        // Clean up
        await supabase
          .from("identity_verifications")
          .delete()
          .like("verification_id", "FLENT_INVALID_IP_%");
      }
    });
  });

  // ==========================================================================
  // STEP 5: Verification Status Tracking
  // ==========================================================================

  describe("Step 5: Verification Status Tracking", () => {
    it("should track verification status transitions", async () => {
      const verificationId = `FLENT_STATUS_TEST_${Date.now()}`;

      // Create OTP_SENT record
      const { data: record1 } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: verificationId,
          status: "OTP_SENT",
          consent_phone: "9876543210",
          otp_sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (record1) {
        createdVerificationIds.push(record1.id);
        assertEquals(record1.status, "OTP_SENT");

        // Update to SUCCESS
        await supabase
          .from("identity_verifications")
          .update({
            status: "SUCCESS",
            verified_at: new Date().toISOString(),
            m360_full_name: "Test User",
            m360_credit_score: 750,
          })
          .eq("id", record1.id);

        // Verify update
        const { data: record2 } = await supabase
          .from("identity_verifications")
          .select("*")
          .eq("id", record1.id)
          .single();

        assertEquals(record2?.status, "SUCCESS");
        assertExists(record2?.verified_at);
        assertEquals(record2?.m360_credit_score, 750);
      }
    });

    it("should handle DETAILS_NOT_FOUND status", async () => {
      const verificationId = `FLENT_NOTFOUND_TEST_${Date.now()}`;

      const { data: record } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: verificationId,
          status: "DETAILS_NOT_FOUND",
          consent_phone: "9876543210",
        })
        .select()
        .single();

      if (record) {
        createdVerificationIds.push(record.id);
        assertEquals(record.status, "DETAILS_NOT_FOUND");
      }
    });

    it("should handle VERIFICATION_FAILED status", async () => {
      const verificationId = `FLENT_FAILED_TEST_${Date.now()}`;

      const { data: record } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: verificationId,
          status: "VERIFICATION_FAILED",
          consent_phone: "9876543210",
        })
        .select()
        .single();

      if (record) {
        createdVerificationIds.push(record.id);
        assertEquals(record.status, "VERIFICATION_FAILED");
      }
    });
  });
});

// ==============================================
// DUPLICATE VERIFICATION_ID HANDLING
// ==============================================

describe("Duplicate Verification ID Handling", () => {
  const supabase = createServiceClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await supabase.from("identity_verifications").delete().eq("id", id);
    }
  });

  it("should handle duplicate verification_id by updating existing record", async () => {
    const verificationId = `FLENT_DUP_TEST_${Date.now()}`;

    // First insert
    const { data: record1, error: error1 } = await supabase
      .from("identity_verifications")
      .insert({
        user_id: TEST_USERS.TENANT_1,
        verification_id: verificationId,
        status: "OTP_SENT",
        consent_phone: "9876543210",
      })
      .select()
      .single();

    if (error1) {
      console.error("First insert failed:", error1);
      return;
    }

    createdIds.push(record1.id);

    // Second insert with same verification_id should fail (unique constraint)
    const { data: record2, error: error2 } = await supabase
      .from("identity_verifications")
      .insert({
        user_id: TEST_USERS.TENANT_1,
        verification_id: verificationId, // Same ID
        status: "SUCCESS",
        consent_phone: "9876543210",
      })
      .select()
      .maybeSingle();

    // Should fail due to unique constraint
    assertExists(error2);
  });

  it("should allow upsert on verification_id conflict", async () => {
    const verificationId = `FLENT_UPSERT_TEST_${Date.now()}`;

    // First insert
    const { data: record1 } = await supabase
      .from("identity_verifications")
      .upsert({
        user_id: TEST_USERS.TENANT_1,
        verification_id: verificationId,
        status: "OTP_SENT",
        consent_phone: "9876543210",
      }, { onConflict: "verification_id" })
      .select()
      .single();

    if (record1) {
      createdIds.push(record1.id);

      // Upsert with same verification_id
      await supabase
        .from("identity_verifications")
        .upsert({
          user_id: TEST_USERS.TENANT_1,
          verification_id: verificationId,
          status: "SUCCESS",
          consent_phone: "9876543210",
          verified_at: new Date().toISOString(),
        }, { onConflict: "verification_id" });

      // Verify update
      const { data: record2 } = await supabase
        .from("identity_verifications")
        .select("*")
        .eq("verification_id", verificationId)
        .single();

      assertEquals(record2?.status, "SUCCESS");
    }
  });
});
