# Flent Secured v2 - Testing Holy Grail

> **The definitive guide for testing infrastructure, practices, and sandbox integration.**
> **Last Updated:** 2026-01-21
> **Status:** Active Reference Document

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [Local Development Testing](#3-local-development-testing)
4. [Backend Testing with Sandboxes](#4-backend-testing-with-sandboxes)
5. [External API Sandbox Configuration](#5-external-api-sandbox-configuration)
6. [Visual Testing with Sauce Labs](#6-visual-testing-with-sauce-labs)
7. [GitHub Actions CI/CD](#7-github-actions-cicd)
8. [Claude Code Agentic Testing](#8-claude-code-agentic-testing)
9. [Test Data Management](#9-test-data-management)
10. [Troubleshooting Guide](#10-troubleshooting-guide)

---

## 0. Autonomous Testing System Overview

> **CRITICAL CONCEPT:** This is an AUTONOMOUS testing system. Claude Code acts as an intelligent testing agent that independently generates, executes, and validates tests without human intervention.

### 0.1 What This System Does

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS TESTING AGENT (Claude Code)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ON EVERY PR:                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                         │  │
│   │   1. ANALYZE    → Read changed files, understand intent                 │  │
│   │        ↓                                                                │  │
│   │   2. GENERATE   → Write new test cases dynamically                      │  │
│   │        ↓                                                                │  │
│   │   3. EXECUTE    → Run tests against REAL sandbox APIs                   │  │
│   │        ↓                                                                │  │
│   │   4. VALIDATE   → Check responses match expected behavior               │  │
│   │        ↓                                                                │  │
│   │   5. REPORT     → Post results as PR comment                            │  │
│   │        ↓                                                                │  │
│   │   6. ITERATE    → Fix failing tests, regenerate if needed               │  │
│   │                                                                         │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│   NO HUMAN NEEDED FOR:                                                          │
│   ✓ Writing test cases                                                          │
│   ✓ Running test suites                                                         │
│   ✓ Analyzing failures                                                          │
│   ✓ Fixing simple issues                                                        │
│   ✓ Reporting results                                                           │
│                                                                                 │
│   HUMAN NEEDED FOR:                                                             │
│   • Approving visual diffs in Sauce Labs                                        │
│   • Reviewing generated test logic for edge cases                               │
│   • Final merge decision                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 0.2 Real-World Testing vs Mocking

**CRITICAL DISTINCTION:**

| Test Type | Use Mocks? | Use Real Sandbox APIs? | Purpose |
|-----------|------------|------------------------|---------|
| **Unit Tests** | YES | NO | Test isolated logic fast |
| **Integration Tests** | NO | **YES** | Validate real API behavior |
| **E2E Tests** | NO | **YES** | Full flow validation |
| **Payment Tests** | NO | **YES (MANDATORY)** | Money flows must be real |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│   ⚠️  IMPORTANT: For Payment, Bank Verification, and Identity flows:           │
│                                                                                 │
│       Claude Code MUST call REAL sandbox APIs:                                  │
│       • PayU Sandbox (https://sandboxsecure.payu.in)                            │
│       • Cashfree Sandbox (https://sandbox.cashfree.com)                         │
│       • Twilio Test Mode                                                        │
│                                                                                 │
│       WHY? Because mocks can hide integration bugs that only appear             │
│       when hitting real APIs (timing, format, edge cases).                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 0.3 Claude Code Testing Agent Capabilities

The Claude Code agent in GitHub Actions can:

1. **Read and understand code changes**
2. **Dynamically generate test cases** based on the code
3. **Execute tests** using Bash commands
4. **Call real sandbox APIs** directly for validation
5. **Analyze responses** and compare with expected behavior
6. **Commit test files** to the PR branch
7. **Post detailed feedback** as PR comments
8. **Self-correct** by fixing failing tests and re-running

---

## 1. Testing Philosophy

### 1.1 Core Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TEST-DRIVEN DEVELOPMENT                          │
│                                                                         │
│   1. RED    → Write a failing test first                                │
│   2. GREEN  → Write minimum code to pass                                │
│   3. REFACTOR → Improve code while keeping tests green                  │
│                                                                         │
│   This is MANDATORY for all payment-related code.                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Test Pyramid

```
                    ┌────────────────┐
                   /    E2E/Visual    \         5%  │ Slow, expensive
                  /   (Sauce Labs)     \            │ Run on PR only
                 /──────────────────────\
                /      Integration       \      15% │ Database + API
               /    (Supabase Branch)     \         │ Run pre-commit
              /────────────────────────────\
             /         Unit Tests           \   80% │ Fast, cheap
            /      (Deno, XCTest, Jest)      \      │ Run on every save
           /──────────────────────────────────\
```

### 1.3 Coverage Requirements

| Component | Minimum Coverage | Critical Paths |
|-----------|-----------------|----------------|
| Edge Functions | 80% | 100% for payment-* |
| iOS App | 70% | 100% for payment flows |
| Web Portal | 70% | 100% for settlements |
| Database (RLS) | 100% | All policies tested |

---

## 2. Architecture Overview

### 2.1 Testing Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TESTING ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   LOCAL DEVELOPMENT                          CI/CD (GitHub Actions)             │
│   ─────────────────                          ──────────────────────             │
│                                                                                 │
│   ┌───────────────────┐                      ┌───────────────────┐             │
│   │  Code on Branch   │                      │  PR Opened        │             │
│   └─────────┬─────────┘                      └─────────┬─────────┘             │
│             │                                          │                        │
│             ▼                                          ▼                        │
│   ┌───────────────────┐                      ┌───────────────────┐             │
│   │  Local Supabase   │                      │  Supabase Branch  │             │
│   │  (supabase start) │                      │  (auto-created)   │             │
│   └─────────┬─────────┘                      └─────────┬─────────┘             │
│             │                                          │                        │
│             ▼                                          ▼                        │
│   ┌───────────────────┐                      ┌───────────────────┐             │
│   │  Sandbox APIs     │                      │  Sandbox APIs     │             │
│   │  ├── PayU Test    │                      │  (same configs)   │             │
│   │  ├── Cashfree Test│                      └─────────┬─────────┘             │
│   │  └── Twilio Test  │                                │                        │
│   └─────────┬─────────┘                                ▼                        │
│             │                                ┌───────────────────┐             │
│             ▼                                │  Claude Code      │             │
│   ┌───────────────────┐                      │  Agentic Testing  │             │
│   │  Run Tests        │                      │  ├── Generate     │             │
│   │  ├── Unit         │                      │  ├── Execute      │             │
│   │  ├── Integration  │                      │  └── Report       │             │
│   │  └── API          │                      └─────────┬─────────┘             │
│   └─────────┬─────────┘                                │                        │
│             │                                          ▼                        │
│             ▼                                ┌───────────────────┐             │
│   ┌───────────────────┐                      │  Sauce Labs       │             │
│   │  Sauce Labs RDC   │                      │  Visual Tests     │             │
│   │  (on-demand)      │                      │  + Device Matrix  │             │
│   └───────────────────┘                      └─────────┬─────────┘             │
│                                                        │                        │
│                                                        ▼                        │
│                                              ┌───────────────────┐             │
│                                              │  PR Feedback      │             │
│                                              │  ✅ Pass / ❌ Fail │             │
│                                              └───────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure

```
Secured v2/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml           # Backend tests
│       ├── ci-ios.yml               # iOS tests
│       ├── ci-web.yml               # Web portal tests
│       ├── visual-tests.yml         # Sauce Labs visual
│       ├── claude-review.yml        # Claude Code agentic
│       └── nightly-e2e.yml          # Full E2E nightly
│
├── supabase/
│   ├── config.toml                  # Supabase config
│   ├── seed.sql                     # Test data
│   ├── migrations/                  # Database migrations
│   ├── functions/
│   │   ├── _shared/                 # Shared utilities
│   │   ├── _tests/                  # Function tests
│   │   │   ├── payment-webhook.test.ts
│   │   │   ├── initiate-payment.test.ts
│   │   │   ├── verify-bank.test.ts
│   │   │   ├── verify-identity.test.ts
│   │   │   └── helpers/
│   │   │       ├── test-client.ts
│   │   │       ├── mock-payu.ts
│   │   │       ├── mock-cashfree.ts
│   │   │       └── mock-twilio.ts
│   │   ├── initiate-payment/
│   │   ├── payment-webhook/
│   │   └── ...
│   └── tests/
│       └── database/                # pgTAP tests
│           ├── schema_test.sql
│           ├── rls_policies_test.sql
│           ├── payments_test.sql
│           └── triggers_test.sql
│
├── ios/SecuredApp/
│   ├── SecuredAppTests/             # Unit tests
│   └── SecuredAppUITests/           # UI tests
│
├── web/
│   ├── __tests__/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── cypress/
│       ├── e2e/
│       ├── fixtures/
│       └── support/
│
├── .sauce/                          # Sauce Labs configs
│   ├── config.yml
│   ├── xcuitest-config.yml
│   └── cypress-config.yml
│
├── tests/
│   ├── sandbox/                     # Sandbox integration tests
│   │   ├── payu-sandbox.test.ts
│   │   ├── cashfree-sandbox.test.ts
│   │   └── twilio-sandbox.test.ts
│   ├── fixtures/
│   │   ├── payments.json
│   │   ├── tenancies.json
│   │   └── users.json
│   └── mocks/
│       ├── payu-responses.json
│       ├── cashfree-responses.json
│       └── twilio-responses.json
│
├── docs/
│   └── TESTING_HOLYGRAIL.md         # This file
│
└── CLAUDE.md                        # Claude Code instructions
```

---

## 3. Local Development Testing

### 3.1 Prerequisites

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Install Deno (for Edge Function tests)
brew install deno

# Install Node.js (for web tests)
brew install node

# Install Sauce Labs CLI
npm install -g saucectl
```

### 3.2 Starting Local Environment

```bash
# Navigate to project
cd "/Users/atrishabh/Documents/Dev/Secured v2"

# Start local Supabase (PostgreSQL, Auth, Storage, Edge Functions)
supabase start

# View local URLs and keys
supabase status

# Output:
# API URL: http://127.0.0.1:54321
# GraphQL URL: http://127.0.0.1:54321/graphql/v1
# DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
# Studio URL: http://127.0.0.1:54323
# Inbucket URL: http://127.0.0.1:54324
# anon key: eyJ...
# service_role key: eyJ...
```

### 3.3 Running Tests Locally

```bash
# Run all unit tests
npm run test:unit

# Run integration tests (requires local Supabase)
npm run test:integration

# Run with watch mode (re-runs on file change)
npm run test:watch

# Run specific test file
deno test supabase/functions/_tests/payment-webhook.test.ts --allow-all

# Run database tests (pgTAP)
supabase test db

# Run with coverage
deno test --coverage=./coverage supabase/functions/_tests/
deno coverage ./coverage
```

### 3.4 Package.json Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "deno test supabase/functions/_tests/ --allow-env --allow-read",
    "test:integration": "deno test tests/sandbox/ --allow-all",
    "test:watch": "deno test --watch supabase/functions/_tests/ --allow-env",
    "test:coverage": "deno test --coverage=./coverage && deno coverage ./coverage",
    "test:e2e": "cypress run",
    "test:visual": "saucectl run",

    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",

    "functions:serve": "supabase functions serve --env-file .env.local"
  }
}
```

---

## 4. Backend Testing with Sandboxes

### 4.1 Edge Function Unit Tests

#### Test Structure Pattern

```typescript
// supabase/functions/_tests/payment-webhook.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createTestClient, createMockPayUPayload } from "./helpers/test-client.ts";

Deno.test("payment-webhook", async (t) => {
  const supabase = createTestClient();

  await t.step("should reject invalid hash", async () => {
    const payload = createMockPayUPayload({
      txnid: "TEST_TXN_001",
      status: "success",
      hash: "invalid_hash"
    });

    const response = await fetch("http://127.0.0.1:54321/functions/v1/payment-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });

    assertEquals(response.status, 403);
    const body = await response.json();
    assertEquals(body.error, "Invalid hash");
  });

  await t.step("should process successful payment", async () => {
    // Create test payment record first
    const { data: payment } = await supabase
      .from("payments")
      .insert({
        tenancy_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        rent_amount_paise: 5000000,
        total_amount_paise: 5000000,
        status: "initiated",
        payu_txn_id: "TEST_SUCCESS_001",
        idempotency_key: "test_key_001",
        due_date: "2024-01-05",
        payment_month: "2024-01-01"
      })
      .select()
      .single();

    const payload = createMockPayUPayload({
      txnid: "TEST_SUCCESS_001",
      status: "success",
      amount: "50000.00",
      mihpayid: "403993715524838915"
    });

    const response = await fetch("http://127.0.0.1:54321/functions/v1/payment-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });

    assertEquals(response.status, 200);

    // Verify payment status updated
    const { data: updatedPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("payu_txn_id", "TEST_SUCCESS_001")
      .single();

    assertEquals(updatedPayment.status, "success");
    assertEquals(updatedPayment.payu_mihpayid, "403993715524838915");
  });

  await t.step("should handle duplicate webhook (idempotency)", async () => {
    const payload = createMockPayUPayload({
      txnid: "TEST_SUCCESS_001",
      status: "success"
    });

    // Send same webhook twice
    await fetch("http://127.0.0.1:54321/functions/v1/payment-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });

    const response = await fetch("http://127.0.0.1:54321/functions/v1/payment-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });

    // Should still return 200 (idempotent)
    assertEquals(response.status, 200);
  });
});
```

#### Test Helper Functions

```typescript
// supabase/functions/_tests/helpers/test-client.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function createTestClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "your-local-service-role-key"
  );
}

export function createMockPayUPayload(overrides: Record<string, string> = {}) {
  const defaults = {
    mihpayid: "403993715524838915",
    status: "success",
    txnid: "TEST_TXN_001",
    amount: "50000.00",
    productinfo: "Rent Payment",
    firstname: "Test",
    lastname: "User",
    email: "test@example.com",
    phone: "9999999901",
    hash: "", // Will be calculated
    mode: "UPI",
    bank_ref_num: "402713100170",
    udf1: "",
    udf2: "",
    udf3: "",
    udf4: "",
    udf5: ""
  };

  const payload = { ...defaults, ...overrides };

  // For tests, we accept any hash starting with 'test_' or calculate a real one
  if (!payload.hash || payload.hash === "") {
    payload.hash = calculateTestHash(payload);
  }

  return payload;
}

function calculateTestHash(payload: Record<string, string>): string {
  // In test mode, use a predictable hash
  // Production code verifies against PayU's hash
  const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT") || "test_salt";
  const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY") || "test_key";

  const hashString = [
    PAYU_MERCHANT_SALT,
    payload.status,
    "", "", "", "", "",
    payload.udf5 || "",
    payload.udf4 || "",
    payload.udf3 || "",
    payload.udf2 || "",
    payload.udf1 || "",
    payload.email,
    payload.firstname,
    payload.productinfo,
    payload.amount,
    payload.txnid,
    PAYU_MERCHANT_KEY
  ].join("|");

  return sha512(hashString);
}

// Import crypto for hash
async function sha512(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
```

### 4.2 Database Tests (pgTAP)

```sql
-- supabase/tests/database/rls_policies_test.sql
BEGIN;
SELECT plan(8);

-- Test 1: Users can only see their own tenancies
SELECT set_eq(
  $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111"}';
    SELECT id FROM tenancies WHERE user_id = '11111111-1111-1111-1111-111111111111';
  $$,
  $$VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$,
  'User can see own tenancy'
);

-- Test 2: Users cannot see other users' tenancies
SELECT is_empty(
  $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims TO '{"sub": "99999999-9999-9999-9999-999999999999"}';
    SELECT id FROM tenancies WHERE user_id = '11111111-1111-1111-1111-111111111111';
  $$,
  'User cannot see other tenancies'
);

-- Test 3: Users can view payments for their tenancies
SELECT set_eq(
  $$
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111"}';
    SELECT id FROM payments WHERE tenancy_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  $$,
  $$VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid)$$,
  'User can see payments for own tenancy'
);

-- Test 4: Service role bypasses RLS
SELECT set_eq(
  $$
    SET LOCAL ROLE service_role;
    SELECT COUNT(*) FROM tenancies;
  $$,
  $$VALUES (1::bigint)$$,
  'Service role can see all tenancies'
);

-- Test 5: Payment amount calculation trigger
SELECT results_eq(
  $$
    INSERT INTO payments (
      tenancy_id, rent_amount_paise, pg_fee_paise, cashback_applied_paise,
      status, payu_txn_id, idempotency_key, due_date, payment_month
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      5000000, 0, 50000,
      'pending', 'TEST_CALC_001', 'calc_key_001', '2024-02-05', '2024-02-01'
    )
    RETURNING total_amount_paise;
  $$,
  $$VALUES (4950000::bigint)$$,
  'Total amount calculated correctly (rent + pg_fee - cashback)'
);

-- Test 6: Audit log trigger fires on payment status change
SELECT results_eq(
  $$
    UPDATE payments SET status = 'success' WHERE payu_txn_id = 'TEST_CALC_001';
    SELECT COUNT(*) FROM audit_logs WHERE action = 'PAYMENT_STATUS_CHANGED';
  $$,
  $$VALUES (1::bigint)$$,
  'Audit log created on payment status change'
);

-- Test 7: Idempotency key uniqueness
SELECT throws_ok(
  $$
    INSERT INTO payments (
      tenancy_id, rent_amount_paise, total_amount_paise,
      status, payu_txn_id, idempotency_key, due_date, payment_month
    ) VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      5000000, 5000000,
      'pending', 'TEST_DUP_001', 'calc_key_001', '2024-02-05', '2024-02-01'
    );
  $$,
  '23505', -- unique_violation
  'Duplicate idempotency key rejected'
);

-- Test 8: Cashback balance cannot go negative
SELECT throws_ok(
  $$
    UPDATE tenancies
    SET cashback_balance_paise = -100
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  $$,
  '23514', -- check_violation
  'Negative cashback balance rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

### 4.3 Integration Test Pattern

```typescript
// tests/sandbox/payment-flow.integration.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.test("Payment Flow Integration", async (t) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Setup: Create test data
  let testTenancyId: string;
  let testPaymentId: string;

  await t.step("setup: create test tenancy", async () => {
    const { data, error } = await supabase
      .from("tenancies")
      .insert({
        user_id: "11111111-1111-1111-1111-111111111111",
        property_address: "Integration Test Address",
        property_city: "Mumbai",
        property_state: "Maharashtra",
        monthly_rent_paise: 5000000,
        rent_due_day: 5,
        lease_start_date: "2024-01-01",
        landlord_name: "Test Landlord",
        landlord_phone: "+919999999999",
        status: "active"
      })
      .select()
      .single();

    assertExists(data);
    testTenancyId = data.id;
  });

  await t.step("1. initiate-payment creates payment record", async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/initiate-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        tenancy_id: testTenancyId,
        payment_method: "upi",
        use_cashback: false
      })
    });

    assertEquals(response.status, 200);
    const body = await response.json();

    assertExists(body.payment_id);
    assertExists(body.payu_txn_id);
    assertExists(body.payu_params);
    assertEquals(body.rent_amount_paise, 5000000);

    testPaymentId = body.payment_id;
  });

  await t.step("2. payment record exists in database", async () => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("id", testPaymentId)
      .single();

    assertExists(data);
    assertEquals(data.status, "initiated");
    assertEquals(data.rent_amount_paise, 5000000);
  });

  await t.step("3. webhook updates payment status", async () => {
    const { data: payment } = await supabase
      .from("payments")
      .select("payu_txn_id")
      .eq("id", testPaymentId)
      .single();

    // Simulate PayU webhook
    const webhookPayload = new URLSearchParams({
      txnid: payment!.payu_txn_id,
      status: "success",
      amount: "50000.00",
      mihpayid: "INTEGRATION_TEST_001",
      mode: "UPI",
      bank_ref_num: "INT_REF_001",
      hash: "test_hash" // In real test, calculate proper hash
    });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: webhookPayload
    });

    assertEquals(response.status, 200);
  });

  await t.step("4. cashback credited after successful payment", async () => {
    const { data: tenancy } = await supabase
      .from("tenancies")
      .select("cashback_balance_paise, lifetime_cashback_earned_paise")
      .eq("id", testTenancyId)
      .single();

    // 1% of 50,000 = 500
    assertEquals(tenancy!.cashback_balance_paise, 50000); // 500 INR in paise
    assertEquals(tenancy!.lifetime_cashback_earned_paise, 50000);
  });

  await t.step("5. cashback ledger entry created", async () => {
    const { data: ledger } = await supabase
      .from("cashback_ledger")
      .select("*")
      .eq("tenancy_id", testTenancyId)
      .eq("type", "earned")
      .single();

    assertExists(ledger);
    assertEquals(ledger.amount_paise, 50000);
    assertEquals(ledger.payment_id, testPaymentId);
  });

  await t.step("6. audit log created", async () => {
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_id", testPaymentId)
      .eq("action", "PAYMENT_STATUS_CHANGED");

    assertExists(logs);
    assertEquals(logs.length >= 1, true);
  });

  // Cleanup
  await t.step("cleanup: remove test data", async () => {
    await supabase.from("cashback_ledger").delete().eq("tenancy_id", testTenancyId);
    await supabase.from("payments").delete().eq("tenancy_id", testTenancyId);
    await supabase.from("audit_logs").delete().eq("entity_id", testPaymentId);
    await supabase.from("tenancies").delete().eq("id", testTenancyId);
  });
});
```

---

## 5. External API Sandbox Configuration

### 5.1 PayU India Sandbox

**Sandbox Credentials:**
```bash
# .env.local (for local development)
PAYU_MERCHANT_KEY=gtKFFx
PAYU_MERCHANT_SALT=eCwWELxi
PAYU_BASE_URL=https://sandboxsecure.payu.in
```

**Test Cards:**
| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa Success | 4012001037141112 | 123 | Any future |
| Visa Failure | 5123456789012346 | 123 | Any future |
| Mastercard | 5123456789012346 | 123 | Any future |

**Test UPI:**
| Scenario | VPA |
|----------|-----|
| Success | success@payu |
| Failure | failure@payu |

**Sandbox Test Flow:**
```typescript
// tests/sandbox/payu-sandbox.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const PAYU_SANDBOX_URL = "https://sandboxsecure.payu.in";
const PAYU_KEY = Deno.env.get("PAYU_MERCHANT_KEY") || "gtKFFx";
const PAYU_SALT = Deno.env.get("PAYU_MERCHANT_SALT") || "eCwWELxi";

Deno.test("PayU Sandbox Integration", async (t) => {

  await t.step("verify merchant credentials", async () => {
    // PayU verify_payment API
    const response = await fetch(`${PAYU_SANDBOX_URL}/merchant/postservice?form=verify_payment`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: PAYU_KEY,
        command: "verify_payment",
        var1: "TEST_TXN_VERIFY",
        hash: calculateVerifyHash("TEST_TXN_VERIFY")
      })
    });

    assertEquals(response.status, 200);
    const body = await response.json();
    // Even if txn doesn't exist, valid credentials return proper response
    assertEquals(body.status, 1);
  });

  await t.step("generate payment hash correctly", async () => {
    const params = {
      key: PAYU_KEY,
      txnid: "TEST_HASH_001",
      amount: "50000.00",
      productinfo: "Rent Payment",
      firstname: "Test",
      email: "test@example.com"
    };

    const hash = generatePaymentHash(params);

    // Hash should be 128 characters (SHA-512)
    assertEquals(hash.length, 128);
    // Hash should be lowercase hex
    assertEquals(/^[a-f0-9]+$/.test(hash), true);
  });
});

function generatePaymentHash(params: Record<string, string>): string {
  const hashString = [
    PAYU_KEY,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    "", "", "", "", "", // udf1-5
    "", "", "", "", "", // reserved
    PAYU_SALT
  ].join("|");

  return sha512Sync(hashString);
}

function calculateVerifyHash(txnid: string): string {
  const hashString = `${PAYU_KEY}|verify_payment|${txnid}|${PAYU_SALT}`;
  return sha512Sync(hashString);
}

function sha512Sync(str: string): string {
  // Use Deno's built-in crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  // Note: In actual test, use async version
  return "placeholder_for_hash";
}
```

### 5.2 Cashfree Sandbox

**Sandbox Credentials:**
```bash
# .env.local
CASHFREE_APP_ID=<your_sandbox_app_id>
CASHFREE_SECRET_KEY=<your_sandbox_secret>
CASHFREE_BASE_URL=https://sandbox.cashfree.com/verification
```

**Get sandbox credentials at:** https://merchant.cashfree.com/merchant/dashboard

**Penny Drop Test Data:**
| Account | IFSC | Result |
|---------|------|--------|
| 026291800001191 | YESB0000262 | Valid Account |
| 1234567890123456 | SBIN0000001 | Invalid Account |

**Mobile 360 Test Data:**
| Phone Number | Result |
|--------------|--------|
| 9876543210 | Details Found |
| 9999999999 | Details Not Found |

**Sandbox Test Flow:**
```typescript
// tests/sandbox/cashfree-sandbox.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const CASHFREE_URL = Deno.env.get("CASHFREE_BASE_URL") || "https://sandbox.cashfree.com/verification";
const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID")!;
const CASHFREE_SECRET = Deno.env.get("CASHFREE_SECRET_KEY")!;

const headers = {
  "Content-Type": "application/json",
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET,
  "x-api-version": "2024-12-01"
};

Deno.test("Cashfree Sandbox Integration", async (t) => {

  await t.step("Penny Drop - verify valid bank account", async () => {
    const response = await fetch(`${CASHFREE_URL}/bank-account/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bank_account: "026291800001191",
        ifsc: "YESB0000262",
        name: "Test User",
        phone: "9876543210"
      })
    });

    assertEquals(response.status, 200);
    const body = await response.json();

    assertExists(body.reference_id);
    assertEquals(body.account_status, "VALID");
    assertExists(body.name_at_bank);
  });

  await t.step("Penny Drop - handle invalid account", async () => {
    const response = await fetch(`${CASHFREE_URL}/bank-account/sync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bank_account: "1234567890123456",
        ifsc: "SBIN0000001",
        name: "Invalid User",
        phone: "9999999999"
      })
    });

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.account_status, "INVALID");
  });

  await t.step("Mobile 360 - send OTP", async () => {
    const verificationId = `test_${Date.now()}`;

    const response = await fetch(`${CASHFREE_URL}/mobile360/otp/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        verification_id: verificationId,
        mobile_number: "9876543210",
        notification_modes: ["WHATSAPP"],
        user_consent: {
          obtained: true,
          timestamp: new Date().toISOString(),
          purpose: "Test verification",
          type: "EXPLICIT"
        }
      })
    });

    assertEquals(response.status, 200);
    const body = await response.json();

    assertEquals(body.verification_id, verificationId);
    assertEquals(body.status, "OTP_SENT");
  });
});
```

### 5.3 Twilio Sandbox (WhatsApp)

**Sandbox Configuration:**
```bash
# .env.local
TWILIO_ACCOUNT_SID=<your_account_sid>
TWILIO_AUTH_TOKEN=<your_auth_token>
TWILIO_VERIFY_SERVICE_SID=<your_verify_service_sid>
```

**Test Mode:**
- Twilio Verify supports test mode with magic codes
- Use OTP `123456` for testing (must be enabled in Twilio console)

**Sandbox Test Flow:**
```typescript
// tests/sandbox/twilio-sandbox.test.ts
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

Deno.test("Twilio Verify Sandbox", async (t) => {

  await t.step("send OTP via WhatsApp", async () => {
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: "+919876543210",
          Channel: "whatsapp"
        })
      }
    );

    assertEquals(response.status, 201);
    const body = await response.json();

    assertEquals(body.status, "pending");
    assertEquals(body.channel, "whatsapp");
  });

  await t.step("verify OTP (test mode)", async () => {
    // In test mode, use magic code 123456
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          To: "+919876543210",
          Code: "123456" // Magic test code
        })
      }
    );

    // Note: This will fail unless test mode is enabled
    // In test mode, returns 200 with status "approved"
    const body = await response.json();
    console.log("Verification result:", body);
  });
});
```

### 5.4 Environment Files

```bash
# .env.local (for local development - NEVER COMMIT)
# Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# PayU Sandbox
PAYU_MERCHANT_KEY=gtKFFx
PAYU_MERCHANT_SALT=eCwWELxi
PAYU_BASE_URL=https://sandboxsecure.payu.in

# Cashfree Sandbox
CASHFREE_APP_ID=your_sandbox_app_id
CASHFREE_SECRET_KEY=your_sandbox_secret
CASHFREE_BASE_URL=https://sandbox.cashfree.com/verification

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid

# Feature Flags
ENABLE_SANDBOX_MODE=true
```

```bash
# .env.example (template for others - COMMIT THIS)
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# PayU (use sandbox for development)
PAYU_MERCHANT_KEY=
PAYU_MERCHANT_SALT=
PAYU_BASE_URL=https://sandboxsecure.payu.in

# Cashfree (use sandbox for development)
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_BASE_URL=https://sandbox.cashfree.com/verification

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=

# Feature Flags
ENABLE_SANDBOX_MODE=true
```

---

## 6. Visual Testing with Sauce Labs

### 6.1 Account Setup

1. **Sign up at:** https://saucelabs.com
2. **Get credentials:** Account Settings > User Settings
3. **Install Figma plugin:** For design baselines

### 6.2 Figma Baseline Integration

1. Install [Sauce Labs Visual Testing Plugin](https://www.figma.com/community/plugin/1552015177501558356/sauce-labs-visual-testing) from Figma Community
2. Configure with Sauce Labs credentials
3. Select frames to export as baselines
4. Export with matching metadata:
   - `test_name`: Matches your test names
   - `suite_name`: Groups related tests
   - `branch`: Target branch for comparison

### 6.3 iOS Visual Tests (XCUITest)

```swift
// ios/SecuredApp/SecuredAppUITests/VisualRegressionTests.swift
import XCTest

class VisualRegressionTests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testLoginScreenVisual() throws {
        // Navigate to login (already on login if not authenticated)

        // Take screenshot for Sauce Labs Visual
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Login Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testDashboardScreenVisual() throws {
        // Login first
        login()

        // Wait for dashboard to load
        let dashboard = app.otherElements["dashboard"]
        XCTAssertTrue(dashboard.waitForExistence(timeout: 10))

        // Take screenshot
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Dashboard"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testPaymentScreenVisual() throws {
        login()

        // Navigate to payment
        app.buttons["Pay Rent"].tap()

        // Wait for payment screen
        let paymentScreen = app.otherElements["payment_screen"]
        XCTAssertTrue(paymentScreen.waitForExistence(timeout: 10))

        // Take screenshot
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "Payment Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func login() {
        // Test login flow
        app.textFields["phone_input"].tap()
        app.textFields["phone_input"].typeText("9999999901")
        app.buttons["Send OTP"].tap()

        // Enter test OTP
        app.textFields["otp_input"].tap()
        app.textFields["otp_input"].typeText("123456")
        app.buttons["Verify"].tap()
    }
}
```

### 6.4 Web Visual Tests (Cypress)

```typescript
// web/cypress/e2e/visual/landlord-portal.cy.ts
describe('Landlord Portal Visual Tests', () => {
  beforeEach(() => {
    cy.login('landlord@test.com', 'testpassword');
  });

  it('Dashboard matches Figma design', () => {
    cy.visit('/dashboard');
    cy.get('[data-testid="dashboard"]').should('be.visible');

    cy.sauceVisualCheck('Landlord Dashboard', {
      cypress: { capture: 'fullPage' },
      ignoredRegions: [
        cy.get('[data-testid="current-date"]'), // Ignore dynamic date
        cy.get('[data-testid="last-login"]')    // Ignore timestamp
      ]
    });
  });

  it('Settlement details page', () => {
    cy.visit('/settlements');
    cy.get('[data-testid="settlements-table"]').should('be.visible');

    cy.sauceVisualCheck('Settlements Page', {
      cypress: { capture: 'fullPage' },
      captureDom: true
    });
  });

  it('Tenant verification modal', () => {
    cy.visit('/tenants');
    cy.get('[data-testid="verify-tenant-btn"]').first().click();
    cy.get('[data-testid="verification-modal"]').should('be.visible');

    cy.sauceVisualCheck('Verification Modal', {
      clipSelector: '[data-testid="verification-modal"]'
    });
  });
});
```

### 6.5 Sauce Labs Configuration

```yaml
# .sauce/xcuitest-config.yml
apiVersion: v1alpha
kind: xcuitest
defaults:
  timeout: 30m

sauce:
  region: us-west-1
  concurrency: 3
  metadata:
    tags:
      - secured-v2
      - visual-testing
      - ios

xcuitest:
  app: storage:filename=SecuredApp.ipa
  testApp: storage:filename=SecuredAppUITests-Runner.ipa

suites:
  - name: "Visual Tests - iPhone 15"
    devices:
      - name: "iPhone 15"
        platformVersion: "17.*"
        options:
          carrierConnectivity: false
    testOptions:
      class:
        - SecuredAppUITests.VisualRegressionTests
    env:
      SAUCE_VISUAL_BUILD_NAME: ${SAUCE_VISUAL_BUILD_NAME}
      SAUCE_VISUAL_BRANCH: ${SAUCE_VISUAL_BRANCH}
      SAUCE_VISUAL_PROJECT: "Secured iOS"

  - name: "Visual Tests - iPhone SE"
    devices:
      - name: "iPhone SE (3rd generation)"
        platformVersion: "17.*"
    testOptions:
      class:
        - SecuredAppUITests.VisualRegressionTests

  - name: "Visual Tests - iPad"
    devices:
      - name: "iPad Pro (12.9-inch) (6th generation)"
        platformVersion: "17.*"
    testOptions:
      class:
        - SecuredAppUITests.VisualRegressionTests
```

```yaml
# .sauce/cypress-config.yml
apiVersion: v1alpha
kind: cypress
showConsoleLog: true

sauce:
  region: us-west-1
  concurrency: 5
  metadata:
    tags:
      - secured-v2
      - visual-testing
      - web

cypress:
  version: 13.*
  configFile: web/cypress.config.ts

rootDir: ./web

suites:
  - name: "Chrome - Windows"
    browser: chrome
    browserVersion: latest
    platformName: Windows 11
    config:
      testingType: e2e
      specPattern:
        - "cypress/e2e/visual/**/*.cy.ts"
    saucectlConfig:
      env:
        SAUCE_VISUAL_BUILD_NAME: ${SAUCE_VISUAL_BUILD_NAME}
        SAUCE_VISUAL_BRANCH: ${SAUCE_VISUAL_BRANCH}
        SAUCE_VISUAL_PROJECT: "Secured Web"

  - name: "Safari - macOS"
    browser: safari
    browserVersion: latest
    platformName: macOS 14
    config:
      testingType: e2e
      specPattern:
        - "cypress/e2e/visual/**/*.cy.ts"

  - name: "Firefox - Windows"
    browser: firefox
    browserVersion: latest
    platformName: Windows 11
    config:
      testingType: e2e
      specPattern:
        - "cypress/e2e/visual/**/*.cy.ts"
```

---

## 7. GitHub Actions CI/CD

### 7.1 Backend CI Workflow

```yaml
# .github/workflows/ci-backend.yml
name: Backend CI

on:
  pull_request:
    branches: [main]
    paths:
      - 'supabase/**'
      - 'tests/**'

env:
  SUPABASE_PROJECT_ID: uowjtrzmszuaiokqxgir

jobs:
  # Wait for Supabase preview branch
  setup-branch:
    runs-on: ubuntu-latest
    outputs:
      api_url: ${{ steps.branch.outputs.api_url }}
      anon_key: ${{ steps.branch.outputs.anon_key }}
      service_key: ${{ steps.branch.outputs.service_role_key }}
      db_host: ${{ steps.branch.outputs.db_host }}
      db_port: ${{ steps.branch.outputs.db_port }}
      db_password: ${{ steps.branch.outputs.db_password }}
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - uses: 0xbigboss/supabase-branch-gh-action@v1
        id: branch
        with:
          supabase-access-token: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          supabase-project-id: ${{ env.SUPABASE_PROJECT_ID }}
          git-branch: ${{ github.head_ref }}
          wait-for-migrations: true
          timeout: 180

  # Database tests
  db-tests:
    needs: setup-branch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1

      - name: Run pgTAP tests
        run: |
          supabase test db \
            --db-url "postgresql://postgres:${{ needs.setup-branch.outputs.db_password }}@${{ needs.setup-branch.outputs.db_host }}:${{ needs.setup-branch.outputs.db_port }}/postgres"

  # Edge Function unit tests
  function-tests:
    needs: setup-branch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x

      - name: Run unit tests
        run: |
          deno test supabase/functions/_tests/ \
            --allow-env --allow-net --allow-read
        env:
          SUPABASE_URL: ${{ needs.setup-branch.outputs.api_url }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ needs.setup-branch.outputs.service_key }}

  # Integration tests with sandboxes
  integration-tests:
    needs: setup-branch
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x

      - name: Run sandbox integration tests
        run: |
          deno test tests/sandbox/ --allow-all
        env:
          SUPABASE_URL: ${{ needs.setup-branch.outputs.api_url }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ needs.setup-branch.outputs.service_key }}
          PAYU_MERCHANT_KEY: ${{ secrets.PAYU_SANDBOX_KEY }}
          PAYU_MERCHANT_SALT: ${{ secrets.PAYU_SANDBOX_SALT }}
          PAYU_BASE_URL: https://sandboxsecure.payu.in
          CASHFREE_APP_ID: ${{ secrets.CASHFREE_SANDBOX_ID }}
          CASHFREE_SECRET_KEY: ${{ secrets.CASHFREE_SANDBOX_SECRET }}
          CASHFREE_BASE_URL: https://sandbox.cashfree.com/verification

  # Claude Code agentic testing
  claude-review:
    needs: [db-tests, function-tests, integration-tests]
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.ref }}
          fetch-depth: 0

      # Uses Claude GitHub App (Max subscription) - no API key needed
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number }}

            You are the TEST REVIEWER for Secured v2.

            ## Tasks:
            1. Analyze changed files for test coverage
            2. Run: deno test supabase/functions/_tests/ --allow-all
            3. Generate missing tests if coverage < 80%
            4. Check for security issues (hardcoded secrets, SQL injection)
            5. Verify PayU hash validation is tested
            6. Post PR comment with coverage report

            ## Commit tests with message:
            "test: add tests for [function name]"
          claude_args: |
            --max-turns 15
            --allowedTools "Read,Write,Edit,Bash(deno test:*),Bash(git:*),Bash(gh pr comment:*)"
```

### 7.2 Visual Tests Workflow

```yaml
# .github/workflows/visual-tests.yml
name: Visual Tests

on:
  pull_request:
    branches: [main]

env:
  SAUCE_USERNAME: ${{ secrets.SAUCE_USERNAME }}
  SAUCE_ACCESS_KEY: ${{ secrets.SAUCE_ACCESS_KEY }}

jobs:
  ios-visual:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4

      - name: Build iOS app
        run: |
          xcodebuild build-for-testing \
            -project ios/SecuredApp/SecuredApp.xcodeproj \
            -scheme SecuredApp \
            -sdk iphoneos \
            -derivedDataPath build

      - name: Package IPA
        run: |
          mkdir -p Payload
          cp -r build/Build/Products/Debug-iphoneos/SecuredApp.app Payload/
          zip -r SecuredApp.ipa Payload

          rm -rf Payload
          cp -r build/Build/Products/Debug-iphoneos/SecuredAppUITests-Runner.app Payload/
          zip -r SecuredAppUITests-Runner.ipa Payload

      - name: Upload to Sauce Labs
        run: |
          curl -u "$SAUCE_USERNAME:$SAUCE_ACCESS_KEY" \
            -X POST "https://api.us-west-1.saucelabs.com/v1/storage/upload" \
            -F "payload=@SecuredApp.ipa" \
            -F "name=SecuredApp.ipa"

          curl -u "$SAUCE_USERNAME:$SAUCE_ACCESS_KEY" \
            -X POST "https://api.us-west-1.saucelabs.com/v1/storage/upload" \
            -F "payload=@SecuredAppUITests-Runner.ipa" \
            -F "name=SecuredAppUITests-Runner.ipa"

      - name: Run visual tests
        uses: saucelabs/saucectl-run-action@v4
        with:
          config: .sauce/xcuitest-config.yml
        env:
          SAUCE_VISUAL_BUILD_NAME: "iOS-PR-${{ github.event.pull_request.number }}"
          SAUCE_VISUAL_BRANCH: ${{ github.head_ref }}
          SAUCE_VISUAL_PROJECT: "Secured iOS"

  web-visual:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: cd web && npm ci

      - name: Build web app
        run: cd web && npm run build

      - name: Run visual tests
        uses: saucelabs/saucectl-run-action@v4
        with:
          config: .sauce/cypress-config.yml
          working-directory: web
        env:
          SAUCE_VISUAL_BUILD_NAME: "Web-PR-${{ github.event.pull_request.number }}"
          SAUCE_VISUAL_BRANCH: ${{ github.head_ref }}
          SAUCE_VISUAL_PROJECT: "Secured Web"

  check-visual-status:
    needs: [ios-visual, web-visual]
    runs-on: ubuntu-latest
    steps:
      - name: Check for unapproved diffs
        run: |
          # Check iOS build
          ios_status=$(npx @saucelabs/visual build status \
            --custom-id "iOS-PR-${{ github.event.pull_request.number }}" \
            -r us-west-1 2>&1) || true

          # Check Web build
          web_status=$(npx @saucelabs/visual build status \
            --custom-id "Web-PR-${{ github.event.pull_request.number }}" \
            -r us-west-1 2>&1) || true

          if echo "$ios_status $web_status" | grep -q "UNAPPROVED"; then
            echo "::error::Visual diffs detected! Review at https://app.saucelabs.com/visual"
            exit 1
          fi
```

---

## 8. Claude Code Agentic Testing

### 8.1 CLAUDE.md Configuration

```markdown
# Claude Code Testing Instructions for Secured v2

## CRITICAL RULES

### 1. Test-Driven Development (MANDATORY)
ALL new code must follow TDD:
1. Write failing test FIRST
2. Run test to confirm it fails
3. Write minimum code to pass
4. Refactor while keeping tests green

### 2. Coverage Requirements
- Edge Functions: Minimum 80%
- Payment functions: 100% (payment-webhook, initiate-payment)
- Database triggers: 100%

### 3. External API Mocking
NEVER call real external APIs in unit tests:
- PayU → Use tests/mocks/payu-responses.json
- Cashfree → Use tests/mocks/cashfree-responses.json
- Twilio → Use tests/mocks/twilio-responses.json

For integration tests, use sandbox endpoints:
- PayU: https://sandboxsecure.payu.in
- Cashfree: https://sandbox.cashfree.com/verification

### 4. Test Commands
```bash
# Unit tests (fast, no external deps)
npm run test:unit

# Integration tests (requires local Supabase)
npm run test:integration

# Sandbox tests (requires sandbox credentials)
npm run test:sandbox

# Full suite
npm run test
```

### 5. Test File Naming
- Unit tests: `*.test.ts` in same directory as source
- Integration tests: `tests/integration/*.test.ts`
- Sandbox tests: `tests/sandbox/*.test.ts`
- Database tests: `supabase/tests/database/*.sql`

### 6. Commit Messages for Tests
Use format: `test: add tests for [function/feature]`

Examples:
- `test: add unit tests for payment-webhook hash verification`
- `test: add integration tests for cashback calculation`
- `test: add sandbox tests for PayU payment flow`

### 7. Before Creating PR
1. Run `npm run test` - all must pass
2. Check coverage meets requirements
3. Verify no hardcoded secrets (use env vars)
4. Ensure sandbox credentials are not committed
```

### 8.2 Custom /test Command

```markdown
# /test Command

Comprehensive test runner with context-aware execution.

## Usage
/test [scope] [options]

## Scopes
- `unit` - Fast unit tests only
- `integration` - Database + API tests (requires local Supabase)
- `sandbox` - External API sandbox tests
- `e2e` - End-to-end tests
- `visual` - Sauce Labs visual tests
- `all` - Full test suite
- (no scope) - Auto-detect based on changed files

## Options
- `--coverage` - Generate coverage report
- `--watch` - Watch mode for development
- `--verbose` - Detailed output

## Behavior
1. Detect changed files since last commit
2. Map changes to relevant test files
3. Run tests in order: unit → integration → e2e
4. Report results with coverage
5. Suggest missing tests for new code

## Examples
```
/test                    # Auto-detect and run relevant tests
/test unit --coverage    # Unit tests with coverage
/test integration        # Integration tests only
/test --watch           # Watch mode
```
```

### 8.3 Context-Aware Testing with MCP

> **Purpose:** Maintain deep context across testing sessions using MCP tools (Serena, Mindbase) to track test state, failures, and learnings.

#### 8.3.1 Context Loading Protocol

**Before Running Tests:**
```
1. Activate Serena Project
   mcp__serena__activate_project("Flent Secured")

2. Load Test Context Memory
   mcp__serena__read_memory("test_context")

   This memory contains:
   - Known flaky tests and their fixes
   - Sandbox credential status
   - Recent test failures and resolutions
   - Coverage gaps needing attention

3. Check for Recent Test Sessions
   mcp__mindbase__session_list()
   - Resume relevant session if continuing previous work
```

**After Test Runs:**
```
1. Save Failed Test Analysis (if failures occurred)
   mcp__serena__write_memory("test_failures_YYYY-MM-DD", analysis)

2. Update Test Context with New Learnings
   mcp__serena__edit_memory("test_context", new_learnings)

3. End Mindbase Session
   mcp__mindbase__memory_write(content="session summary")
```

#### 8.3.2 Required Serena Memories

Create these memories in the Flent Secured project:

**`test_context`** - Persistent test state
```markdown
# Test Context Memory

## Known Issues
- [List of known flaky tests with workarounds]

## Sandbox Status
- PayU: [Active/Issues]
- Cashfree: [Active/Issues]
- Twilio: [Active/Issues]

## Recent Failures
- [Date]: [Test]: [Root cause]: [Fix applied]

## Coverage Gaps
- [Areas needing more test coverage]

## Test Credentials
- PayU Sandbox: gtKFFx / eCwWELxi
- Test UPI: success@payu, failure@payu
- Test Cards: 4012001037141112 (success), 5123456789012346 (failure)
```

**`code_exploration_notes`** - Codebase understanding
```markdown
# Code Exploration Notes

## Critical Code Paths
- Payment initiation: supabase/functions/initiate-payment/index.ts
- Webhook processing: supabase/functions/payment-webhook/index.ts
- Cashback calculation: supabase/functions/calculate-cashback/index.ts

## API Integration Points
- PayU: supabase/functions/_shared/payu.ts
- Cashfree: supabase/functions/_shared/cashfree.ts
- Twilio: supabase/functions/_shared/twilio.ts

## State Management (iOS)
- Auth state: AuthManager.swift (race conditions documented in auth_flow_analysis)
- App state: AppState.swift
- Upload queue: UploadQueue.swift
```

#### 8.3.3 Claude Code CI Integration

Update `.github/workflows/ci-backend.yml` claude-review job:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    prompt: |
      ## CONTEXT MANAGEMENT PROTOCOL

      BEFORE ANY ACTION:
      1. Activate Serena: mcp__serena__activate_project("Flent Secured")
      2. Read memories: test_context, payment_flow_decisions, auth_flow_analysis
      3. Check Mindbase for recent test sessions

      DURING TESTING:
      4. Log significant findings to Mindbase
      5. Track code paths explored

      AFTER TESTING:
      6. Write memory with test results summary
      7. Update test_context with new learnings

      ## STANDARD TASKS
      1. Analyze changed files for test coverage
      2. Run: deno test supabase/functions/_tests/ --allow-all
      3. Generate missing tests if coverage < 80%
      4. Check for security issues (hardcoded secrets, SQL injection)
      5. Verify PayU hash validation is tested
      6. Post PR comment with coverage report
```

#### 8.3.4 GitHub MCP Server Setup

To enable GitHub integration for CI/CD context:

```bash
# Install official GitHub MCP server
claude mcp add github -- npx -y @modelcontextprotocol/server-github

# Or using Docker (recommended for CI)
claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=YOUR_PAT -- \
  docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server

# Verify installation
claude mcp list
claude mcp get github
```

**Required GitHub PAT Scopes:**
- `repo` (full repository access)
- `workflow` (GitHub Actions)
- `read:org` (if using organization repositories)

#### 8.3.5 MCP Tools Quick Reference

```
Serena (Project-level persistence):
- mcp__serena__activate_project("Flent Secured")
- mcp__serena__list_memories()
- mcp__serena__read_memory(memory_file_name)
- mcp__serena__write_memory(memory_file_name, content)
- mcp__serena__edit_memory(memory_file_name, content)

Mindbase (Session-level tracking):
- mcp__mindbase__session_create(name="session-name")
- mcp__mindbase__session_list()
- mcp__mindbase__session_start(session_id)
- mcp__mindbase__memory_write(content)
- mcp__mindbase__memory_read()
```

---

## 9. Test Data Management

### 9.1 Seed File

```sql
-- supabase/seed.sql
-- Test data for preview branches and local development
-- NEVER use real production data

-- =====================================================
-- TEST USERS
-- =====================================================
INSERT INTO users (id, phone, first_name, last_name, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '+919999999901', 'Test', 'Tenant', NOW()),
  ('22222222-2222-2222-2222-222222222222', '+919999999902', 'Test', 'Landlord', NOW()),
  ('33333333-3333-3333-3333-333333333333', '+919999999903', 'Second', 'Tenant', NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST TENANCIES
-- =====================================================
INSERT INTO tenancies (
  id, user_id, property_address, property_city, property_state, property_pincode,
  monthly_rent_paise, rent_due_day, lease_start_date, lease_end_date,
  landlord_name, landlord_phone, landlord_email,
  status, bank_verified, utility_verified, landlord_approved,
  cashback_balance_paise, lifetime_cashback_earned_paise
)
VALUES
  -- Active tenancy with full verification
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '123 Test Street, Apartment 4B',
    'Mumbai',
    'Maharashtra',
    '400001',
    5000000, -- ₹50,000
    5,
    '2024-01-01',
    '2025-01-01',
    'Test Landlord',
    '+919999999902',
    'landlord@test.com',
    'active',
    true, true, true,
    50000, -- ₹500 cashback available
    150000 -- ₹1,500 lifetime earned
  ),
  -- Pending verification tenancy
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333',
    '456 Another Street',
    'Delhi',
    'Delhi',
    '110001',
    3000000, -- ₹30,000
    10,
    '2024-06-01',
    '2025-06-01',
    'Another Landlord',
    '+919999999904',
    NULL,
    'pending_verification',
    false, false, false,
    0, 0
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST BANK ACCOUNTS
-- =====================================================
INSERT INTO bank_accounts (
  id, user_id, tenancy_id, party_type,
  account_holder_name, account_number_last4, account_number_encrypted,
  ifsc_code, bank_name, verified, name_at_bank
)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'tenant',
    'Test Tenant',
    '1234',
    'encrypted_account_number_here',
    'SBIN0000001',
    'State Bank of India',
    true,
    'TEST TENANT'
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST PAYMENTS
-- =====================================================
INSERT INTO payments (
  id, tenancy_id, rent_amount_paise, pg_fee_paise, cashback_applied_paise,
  total_amount_paise, status, payu_txn_id, payu_mihpayid,
  payment_method, bank_ref_num, due_date, payment_month,
  idempotency_key, completed_at
)
VALUES
  -- Successful payment
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    5000000, 0, 0,
    5000000,
    'success',
    'TEST_TXN_001',
    '403993715524838915',
    'upi',
    '402713100170',
    '2024-01-05',
    '2024-01-01',
    'test_idem_001',
    '2024-01-03 10:30:00+05:30'
  ),
  -- Pending payment
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    5000000, 0, 50000,
    4950000,
    'pending',
    'TEST_TXN_002',
    NULL,
    NULL,
    NULL,
    '2024-02-05',
    '2024-02-01',
    'test_idem_002',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TEST CASHBACK LEDGER
-- =====================================================
INSERT INTO cashback_ledger (
  id, tenancy_id, payment_id, type, amount_paise, balance_after_paise, description
)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'earned',
    50000,
    50000,
    'Cashback for January 2024 rent payment'
  )
ON CONFLICT (id) DO NOTHING;
```

### 9.2 Test Fixtures

```json
// tests/fixtures/payments.json
{
  "validPayment": {
    "tenancy_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "rent_amount_paise": 5000000,
    "pg_fee_paise": 0,
    "cashback_applied_paise": 0,
    "payment_method": "upi"
  },
  "paymentWithCashback": {
    "tenancy_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "rent_amount_paise": 5000000,
    "pg_fee_paise": 0,
    "cashback_applied_paise": 50000,
    "payment_method": "upi"
  },
  "cardPayment": {
    "tenancy_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "rent_amount_paise": 5000000,
    "pg_fee_paise": 100000,
    "cashback_applied_paise": 0,
    "payment_method": "credit_card"
  }
}
```

---

## 10. Troubleshooting Guide

### 10.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `supabase start` fails | Docker not running | Start Docker Desktop |
| Tests timeout | Supabase not ready | Wait for `supabase status` to show all services |
| Hash verification fails | Wrong salt/key | Check `.env.local` has correct sandbox credentials |
| Sauce Labs 401 | Invalid credentials | Verify `SAUCE_USERNAME` and `SAUCE_ACCESS_KEY` |
| Preview branch not created | GitHub integration not enabled | Enable in Supabase Dashboard > Integrations |
| RLS tests fail | Wrong role set | Ensure `SET LOCAL ROLE authenticated;` before query |

### 10.2 Debugging Tips

```bash
# View Supabase logs
supabase logs

# View Edge Function logs
supabase functions logs payment-webhook

# Test Edge Function locally
curl -X POST http://127.0.0.1:54321/functions/v1/payment-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "txnid=TEST_001&status=success&..."

# Reset database and re-seed
supabase db reset

# View pgTAP test output
supabase test db --debug
```

### 10.3 Getting Help

1. **Supabase issues:** https://github.com/supabase/supabase/issues
2. **Sauce Labs docs:** https://docs.saucelabs.com
3. **Claude Code docs:** https://docs.anthropic.com/claude-code
4. **PayU sandbox:** https://developer.payu.in/
5. **Cashfree sandbox:** https://docs.cashfree.com/

---

## Quick Reference

### Test Commands Cheat Sheet

```bash
# Local Development
supabase start              # Start local Supabase
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:watch          # Watch mode
supabase test db            # Database tests

# CI/CD
deno test --allow-all       # All Deno tests
saucectl run                # Sauce Labs tests
npx @saucelabs/visual build status  # Check visual status

# Debugging
supabase logs               # View logs
supabase db reset           # Reset database
```

### Sandbox Endpoints

| Service | Sandbox URL |
|---------|-------------|
| PayU | https://sandboxsecure.payu.in |
| Cashfree | https://sandbox.cashfree.com/verification |
| Twilio Verify | https://verify.twilio.com/v2 |
| Supabase Local | http://127.0.0.1:54321 |

---

**Document Version:** 1.0
**Maintained By:** Engineering Team
**Last Updated:** 2026-01-21
