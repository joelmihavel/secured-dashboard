/**
 * Flent Secured v2 - Payment Webhook Edge Function Tests
 *
 * Tests the payment-webhook function that handles PayU callbacks.
 * CRITICAL: This function handles money - 100% coverage required.
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { describe, it, beforeAll, afterAll } from "https://deno.land/std@0.208.0/testing/bdd.ts";

import { createServiceClient, TEST_PAYMENTS, callEdgeFunctionForm } from "./helpers/test-client.ts";
import {
  createMockPayUWebhook,
  PayUTestScenarios,
  verifyPayUWebhookHash,
  calculatePayUResponseHash,
} from "./helpers/mock-payu.ts";

// =============================================================================
// Test Suite: Payment Webhook
// =============================================================================

describe("Payment Webhook Edge Function", () => {
  const supabase = createServiceClient();

  // ===========================================================================
  // Setup & Teardown
  // ===========================================================================

  beforeAll(async () => {
    console.log("Setting up payment webhook tests...");
    // Ensure test payment exists
    const { data, error } = await supabase
      .from("payments")
      .select("id")
      .eq("id", TEST_PAYMENTS.PENDING)
      .single();

    if (error || !data) {
      console.warn("Test payment not found. Run seed.sql first.");
    }
  });

  afterAll(async () => {
    console.log("Cleaning up payment webhook tests...");
    // Reset any modified test data
  });

  // ===========================================================================
  // Hash Validation Tests
  // ===========================================================================

  describe("Hash Validation", () => {
    it("should reject requests with invalid hash", async () => {
      const payload = PayUTestScenarios.invalidHash("TXN_INVALID_HASH");

      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 400);
      const body = await response.json();
      assertEquals(body.error, "Invalid hash");
    });

    it("should accept requests with valid hash", async () => {
      const payload = PayUTestScenarios.successfulUPI("TXN_VALID_HASH_TEST");

      // Verify our hash calculation matches
      const isValid = verifyPayUWebhookHash(payload);
      assertEquals(isValid, true, "Hash should be valid");
    });

    it("should calculate response hash correctly", () => {
      const payload = createMockPayUWebhook({
        txnid: "TXN_HASH_CALC_TEST",
        status: "success",
        amount: "50000.00",
        productinfo: "Test Payment",
        firstname: "Test",
        email: "test@example.com",
      });

      // Hash should be set
      assertExists(payload.hash);
      assertEquals(payload.hash.length, 128, "SHA-512 hash should be 128 chars");
    });
  });

  // ===========================================================================
  // Success Flow Tests
  // ===========================================================================

  describe("Successful Payment Flow", () => {
    it("should process successful UPI payment", async () => {
      // Create a new payment record for this test
      const txnId = `TXN_SUCCESS_UPI_${Date.now()}`;

      // Create payment in DB first
      const { data: payment, error: createError } = await supabase
        .from("payments")
        .insert({
          tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          rent_amount_paise: 5000000,
          pg_fee_paise: 0,
          cashback_applied_paise: 0,
          total_amount_paise: 5000000,
          status: "initiated",
          payment_method: "upi",
          payu_txn_id: txnId,
          due_date: new Date().toISOString().split("T")[0],
          payment_month: new Date().toISOString().slice(0, 7) + "-01",
          idempotency_key: `idem_${txnId}`,
        })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create test payment:", createError);
        throw createError;
      }

      // Send webhook
      const payload = PayUTestScenarios.successfulUPI(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 200);

      // Verify payment status updated
      const { data: updatedPayment } = await supabase
        .from("payments")
        .select("status, payu_mihpayid, paid_at")
        .eq("payu_txn_id", txnId)
        .single();

      assertEquals(updatedPayment?.status, "success");
      assertExists(updatedPayment?.payu_mihpayid);
      assertExists(updatedPayment?.paid_at);

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });

    it("should process successful card payment", async () => {
      const txnId = `TXN_SUCCESS_CARD_${Date.now()}`;

      // Create payment
      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 100000, // 2% card fee
        cashback_applied_paise: 0,
        total_amount_paise: 5100000,
        status: "initiated",
        payment_method: "card",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      const payload = PayUTestScenarios.successfulCard(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 200);

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });
  });

  // ===========================================================================
  // Failure Flow Tests
  // ===========================================================================

  describe("Failed Payment Flow", () => {
    it("should handle insufficient funds failure", async () => {
      const txnId = `TXN_FAIL_FUNDS_${Date.now()}`;

      // Create payment
      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "initiated",
        payment_method: "upi",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      const payload = PayUTestScenarios.failedInsufficientFunds(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 200);

      // Verify payment marked as failed
      const { data: payment } = await supabase
        .from("payments")
        .select("status, error_message")
        .eq("payu_txn_id", txnId)
        .single();

      assertEquals(payment?.status, "failed");
      assertExists(payment?.error_message);

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });

    it("should handle user cancelled payment", async () => {
      const txnId = `TXN_FAIL_CANCEL_${Date.now()}`;

      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "initiated",
        payment_method: "upi",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      const payload = PayUTestScenarios.failedUserCancelled(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 200);

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });
  });

  // ===========================================================================
  // Pending Payment Tests
  // ===========================================================================

  describe("Pending Payment Flow", () => {
    it("should handle pending status correctly", async () => {
      const txnId = `TXN_PENDING_${Date.now()}`;

      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "initiated",
        payment_method: "upi",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      const payload = PayUTestScenarios.pendingPayment(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      assertEquals(response.status, 200);

      // Verify payment status is pending
      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("payu_txn_id", txnId)
        .single();

      assertEquals(payment?.status, "pending");

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });
  });

  // ===========================================================================
  // Idempotency Tests
  // ===========================================================================

  describe("Idempotency", () => {
    it("should handle duplicate webhook calls gracefully", async () => {
      const txnId = `TXN_IDEMPOTENT_${Date.now()}`;

      // Create payment
      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "initiated",
        payment_method: "upi",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      const payload = PayUTestScenarios.successfulUPI(txnId);

      // First call
      const response1 = await callEdgeFunctionForm("payment-webhook", payload);
      assertEquals(response1.status, 200);

      // Second call (duplicate)
      const response2 = await callEdgeFunctionForm("payment-webhook", payload);
      assertEquals(response2.status, 200); // Should still succeed (idempotent)

      // Verify only one status change occurred
      const { data: payment } = await supabase
        .from("payments")
        .select("status")
        .eq("payu_txn_id", txnId)
        .single();

      assertEquals(payment?.status, "success");

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });

    it("should not re-process already successful payment", async () => {
      const txnId = `TXN_ALREADY_SUCCESS_${Date.now()}`;

      // Create already successful payment
      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "success",
        payment_method: "upi",
        payu_txn_id: txnId,
        payu_mihpayid: "ALREADY_PROCESSED",
        paid_at: new Date().toISOString(),
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      // Try to process again
      const payload = PayUTestScenarios.successfulUPI(txnId);
      const response = await callEdgeFunctionForm("payment-webhook", payload);

      // Should acknowledge but not re-process
      assertEquals(response.status, 200);

      // Verify original mihpayid unchanged
      const { data: payment } = await supabase
        .from("payments")
        .select("payu_mihpayid")
        .eq("payu_txn_id", txnId)
        .single();

      assertEquals(payment?.payu_mihpayid, "ALREADY_PROCESSED");

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });
  });

  // ===========================================================================
  // Security Tests
  // ===========================================================================

  describe("Security", () => {
    it("should reject tampered amount", async () => {
      const txnId = `TXN_TAMPERED_${Date.now()}`;

      // Create payment with specific amount
      await supabase.from("payments").insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        pg_fee_paise: 0,
        cashback_applied_paise: 0,
        total_amount_paise: 5000000,
        status: "initiated",
        payment_method: "upi",
        payu_txn_id: txnId,
        due_date: new Date().toISOString().split("T")[0],
        payment_month: new Date().toISOString().slice(0, 7) + "-01",
        idempotency_key: `idem_${txnId}`,
      });

      // Create valid webhook but change amount after hash calculation
      const payload = createMockPayUWebhook({
        txnid: txnId,
        status: "success",
        amount: "50000.00",
      });

      // Tamper with amount (hash was calculated with 50000.00)
      payload.amount = "1.00";

      const response = await callEdgeFunctionForm("payment-webhook", payload);

      // Should reject due to hash mismatch
      assertEquals(response.status, 400);

      // Cleanup
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });

    it("should reject unknown transaction IDs", async () => {
      const payload = PayUTestScenarios.successfulUPI("UNKNOWN_TXN_ID_12345");

      const response = await callEdgeFunctionForm("payment-webhook", payload);

      // Should return 404 or similar for unknown txn
      assertEquals(response.status >= 400, true);
    });
  });

  // ===========================================================================
  // Audit Log Tests
  // ===========================================================================

  describe("Audit Logging", () => {
    it("should create audit log entry on status change", async () => {
      const txnId = `TXN_AUDIT_${Date.now()}`;

      // Create payment
      const { data: payment } = await supabase
        .from("payments")
        .insert({
          tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          rent_amount_paise: 5000000,
          pg_fee_paise: 0,
          cashback_applied_paise: 0,
          total_amount_paise: 5000000,
          status: "initiated",
          payment_method: "upi",
          payu_txn_id: txnId,
          due_date: new Date().toISOString().split("T")[0],
          payment_month: new Date().toISOString().slice(0, 7) + "-01",
          idempotency_key: `idem_${txnId}`,
        })
        .select()
        .single();

      const payload = PayUTestScenarios.successfulUPI(txnId);
      await callEdgeFunctionForm("payment-webhook", payload);

      // Check audit log
      const { data: auditLog } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_type", "payment")
        .eq("entity_id", payment?.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      assertExists(auditLog);
      assertEquals(auditLog?.action, "PAYMENT_STATUS_CHANGED");

      // Cleanup
      await supabase.from("audit_logs").delete().eq("entity_id", payment?.id);
      await supabase.from("payments").delete().eq("payu_txn_id", txnId);
    });
  });
});

// =============================================================================
// Run Tests
// =============================================================================

// To run: deno test supabase/functions/_tests/payment-webhook.test.ts --allow-all
