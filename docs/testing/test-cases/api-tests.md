# API Test Specifications
## Flent Secured - Backend API & Edge Function Tests

<!-- FIGMA_STATUS: N/A -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: false -->

---

## Overview

This document specifies API tests for Supabase Edge Functions and database operations. These tests validate backend logic, authentication, authorization, data integrity, and error handling.

**Platform: Supabase Edge Functions (Deno)**
**Framework: Deno Test**
**Existing Tests: `supabase/functions/_tests/`**

---

## Test Infrastructure

### Existing Setup

```
supabase/functions/
├── _shared/
│   └── supabase-client.ts
├── _tests/
│   ├── auth/
│   ├── payments/
│   └── ...
├── send-otp/
├── verify-otp/
├── create-payment/
└── ...
```

### Test Configuration

```typescript
// deno.json
{
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read _tests/",
    "test:coverage": "deno test --coverage=coverage/ _tests/"
  }
}
```

---

## 1. Authentication API

### API-AUTH-001: Send OTP

**Endpoint:** `POST /functions/v1/send-otp`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-AUTH-001-A | Valid phone number | `{ "phone": "+919876543210" }` | 200: `{ "success": true, "message": "OTP sent" }` |
| API-AUTH-001-B | Invalid phone format | `{ "phone": "123" }` | 400: `{ "error": "Invalid phone number" }` |
| API-AUTH-001-C | Missing phone | `{ }` | 400: `{ "error": "Phone number required" }` |
| API-AUTH-001-D | Rate limited (>3/min) | 4th request in 1 min | 429: `{ "error": "Too many requests" }` |
| API-AUTH-001-E | Phone already registered (login) | Existing phone | 200: Success (login flow) |

**Test Code:**
```typescript
Deno.test('API-AUTH-001-A: sends OTP to valid phone', async () => {
  const response = await fetch(`${BASE_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876543210' }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.success, true);
  assertExists(data.message);
});

Deno.test('API-AUTH-001-D: rate limits excessive requests', async () => {
  const phone = '+919999900001';

  // Send 3 requests (allowed)
  for (let i = 0; i < 3; i++) {
    await fetch(`${BASE_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
  }

  // 4th request should be rate limited
  const response = await fetch(`${BASE_URL}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  assertEquals(response.status, 429);
});
```

---

### API-AUTH-002: Verify OTP

**Endpoint:** `POST /functions/v1/verify-otp`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-AUTH-002-A | Valid OTP | `{ "phone": "...", "otp": "123456" }` | 200: `{ "token": "...", "user": {...} }` |
| API-AUTH-002-B | Invalid OTP | `{ "phone": "...", "otp": "000000" }` | 401: `{ "error": "Invalid OTP" }` |
| API-AUTH-002-C | Expired OTP | OTP older than 5 min | 401: `{ "error": "OTP expired" }` |
| API-AUTH-002-D | Max attempts exceeded | 4th wrong attempt | 401: `{ "error": "Too many attempts", "lockout": true }` |
| API-AUTH-002-E | No pending OTP | Phone without send-otp | 400: `{ "error": "No OTP pending" }` |
| API-AUTH-002-F | New user creates account | First-time phone | 200: User created, status = "signedUp" |
| API-AUTH-002-G | Existing user logs in | Returning phone | 200: User returned, existing status |

**Test Code:**
```typescript
Deno.test('API-AUTH-002-A: verifies valid OTP', async () => {
  const phone = '+919876543210';

  // First send OTP
  await sendOTP(phone);

  // Verify with test OTP
  const response = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: '123456' }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertExists(data.token);
  assertExists(data.user);
  assertExists(data.user.id);
});

Deno.test('API-AUTH-002-D: locks out after max attempts', async () => {
  const phone = '+919999900002';
  await sendOTP(phone);

  // 3 wrong attempts
  for (let i = 0; i < 3; i++) {
    await fetch(`${BASE_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '000000' }),
    });
  }

  // 4th attempt - should be locked
  const response = await fetch(`${BASE_URL}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: '000000' }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.lockout, true);
});
```

---

### API-AUTH-003: Refresh Token

**Endpoint:** `POST /functions/v1/refresh-token`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-AUTH-003-A | Valid refresh token | `{ "refreshToken": "..." }` | 200: New access token |
| API-AUTH-003-B | Expired refresh token | Old token | 401: Token expired |
| API-AUTH-003-C | Invalid token format | Malformed | 400: Invalid token |
| API-AUTH-003-D | Revoked token | User logged out | 401: Token revoked |

---

## 2. User API

### API-USER-001: Get User Profile

**Endpoint:** `GET /functions/v1/user/profile`

| Test ID | Scenario | Auth | Expected Response |
|---------|----------|------|-------------------|
| API-USER-001-A | Authenticated user | Valid token | 200: User profile |
| API-USER-001-B | No auth header | None | 401: Unauthorized |
| API-USER-001-C | Expired token | Expired | 401: Token expired |
| API-USER-001-D | Invalid token | Malformed | 401: Invalid token |

---

### API-USER-002: Update User Profile

**Endpoint:** `PATCH /functions/v1/user/profile`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-USER-002-A | Update name | `{ "name": "New Name" }` | 200: Updated profile |
| API-USER-002-B | Empty name | `{ "name": "" }` | 400: Validation error |
| API-USER-002-C | Update email | `{ "email": "new@test.com" }` | 200: Email updated |
| API-USER-002-D | Invalid email format | `{ "email": "invalid" }` | 400: Invalid email |

---

### API-USER-003: Delete Account

**Endpoint:** `DELETE /functions/v1/user/account`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-USER-003-A | Valid delete request | With OTP confirmation | 200: Account scheduled |
| API-USER-003-B | Without OTP | No confirmation | 400: OTP required |
| API-USER-003-C | Active payment pending | Has pending payment | 400: Cannot delete |
| API-USER-003-D | Verify data anonymized | After delete | Personal data removed |

---

## 3. Payment API

### API-PAY-001: Get Payment Details

**Endpoint:** `GET /functions/v1/payments/current`

| Test ID | Scenario | Setup | Expected Response |
|---------|----------|-------|-------------------|
| API-PAY-001-A | Rent due this month | Active tenancy | 200: Payment breakdown |
| API-PAY-001-B | Already paid | Payment complete | 200: Paid status |
| API-PAY-001-C | No active tenancy | New user | 404: No tenancy |
| API-PAY-001-D | Cashback eligible | Before 7th | 200: Cashback amount included |
| API-PAY-001-E | Cashback not eligible | After 7th | 200: Cashback = 0 |

**Test Code:**
```typescript
Deno.test('API-PAY-001-A: returns payment breakdown', async () => {
  const token = await getTestUserToken('qualified');

  const response = await fetch(`${BASE_URL}/payments/current`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  assertExists(data.baseRent);
  assertExists(data.maintenance);
  assertExists(data.total);
  assertEquals(data.total, data.baseRent + data.maintenance);
});

Deno.test('API-PAY-001-D: includes cashback when eligible', async () => {
  // Set date to 5th of month
  const token = await getTestUserToken('qualified');

  const response = await fetch(`${BASE_URL}/payments/current`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();
  assertExists(data.cashback);
  assert(data.cashback.amount > 0);
  assertEquals(data.cashback.eligible, true);
});
```

---

### API-PAY-002: Create Payment

**Endpoint:** `POST /functions/v1/payments/create`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-PAY-002-A | UPI payment | `{ "method": "upi", "amount": 32500 }` | 200: Payment intent |
| API-PAY-002-B | Net banking | `{ "method": "netbanking", "bankCode": "HDFC" }` | 200: Bank redirect URL |
| API-PAY-002-C | Credit card | `{ "method": "card" }` | 200: Card form data |
| API-PAY-002-D | Invalid amount | `{ "amount": -100 }` | 400: Invalid amount |
| API-PAY-002-E | Duplicate payment | Same month paid | 400: Already paid |
| API-PAY-002-F | With cashback | `{ "applyCashback": true }` | 200: Reduced amount |
| API-PAY-002-G | Idempotency key | Same key twice | 200: Same response (no duplicate) |

**Test Code:**
```typescript
Deno.test('API-PAY-002-G: respects idempotency key', async () => {
  const token = await getTestUserToken('qualified');
  const idempotencyKey = crypto.randomUUID();

  // First request
  const response1 = await fetch(`${BASE_URL}/payments/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method: 'upi', amount: 32500 }),
  });

  const data1 = await response1.json();

  // Second request with same key
  const response2 = await fetch(`${BASE_URL}/payments/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method: 'upi', amount: 32500 }),
  });

  const data2 = await response2.json();

  // Should return same payment ID
  assertEquals(data1.paymentId, data2.paymentId);
});
```

---

### API-PAY-003: Payment Webhook

**Endpoint:** `POST /functions/v1/payments/webhook`

| Test ID | Scenario | Payload | Expected Action |
|---------|----------|---------|-----------------|
| API-PAY-003-A | Success callback | `{ "status": "success" }` | Update payment, notify user |
| API-PAY-003-B | Failure callback | `{ "status": "failed" }` | Update payment, allow retry |
| API-PAY-003-C | Invalid signature | Bad HMAC | 401: Invalid webhook |
| API-PAY-003-D | Replay attack | Old timestamp | 400: Request expired |
| API-PAY-003-E | Unknown payment ID | Invalid ID | 404: Payment not found |

---

### API-PAY-004: Get Payment History

**Endpoint:** `GET /functions/v1/payments/history`

| Test ID | Scenario | Query Params | Expected Response |
|---------|----------|--------------|-------------------|
| API-PAY-004-A | Default pagination | None | 200: Last 10 payments |
| API-PAY-004-B | Custom page size | `?limit=20` | 200: 20 payments |
| API-PAY-004-C | Date range filter | `?from=2026-01-01&to=2026-01-31` | 200: Filtered |
| API-PAY-004-D | Empty history | New user | 200: Empty array |

---

## 4. Verification API

### API-VER-001: Verify Bank Account

**Endpoint:** `POST /functions/v1/verification/bank`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-VER-001-A | Valid IFSC + Account | Valid details | 200: Bank name, verified |
| API-VER-001-B | Invalid IFSC | Bad format | 400: Invalid IFSC |
| API-VER-001-C | IFSC not found | Unknown IFSC | 404: Bank not found |
| API-VER-001-D | Penny drop failed | Account mismatch | 400: Verification failed |
| API-VER-001-E | Account already added | Duplicate | 400: Already verified |

**Test Code:**
```typescript
Deno.test('API-VER-001-A: verifies valid bank account', async () => {
  const token = await getTestUserToken('new');

  const response = await fetch(`${BASE_URL}/verification/bank`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ifsc: 'HDFC0001234',
      accountNumber: '1234567890',
      confirmAccountNumber: '1234567890',
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.verified, true);
  assertExists(data.bankName);
});
```

---

### API-VER-002: Upload Document

**Endpoint:** `POST /functions/v1/verification/document`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-VER-002-A | Valid PDF upload | PDF file | 200: Upload success |
| API-VER-002-B | Invalid file type | .exe file | 400: Invalid file type |
| API-VER-002-C | File too large | >10MB | 400: File too large |
| API-VER-002-D | Empty file | 0 bytes | 400: Empty file |
| API-VER-002-E | Agreement upload | PDF for agreement | 200: Agreement stored |

---

### API-VER-003: Send Landlord Invitation

**Endpoint:** `POST /functions/v1/verification/landlord-invite`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-VER-003-A | Valid email invite | Email address | 200: Invitation sent |
| API-VER-003-B | Valid phone invite | Phone number | 200: SMS sent |
| API-VER-003-C | Invalid email | Bad format | 400: Invalid email |
| API-VER-003-D | Resend too soon | Within 24h | 400: Wait for cooldown |
| API-VER-003-E | Resend after cooldown | After 24h | 200: Resent |

---

### API-VER-004: Landlord Accept Invitation

**Endpoint:** `POST /functions/v1/verification/landlord-accept`

| Test ID | Scenario | Request | Expected Response |
|---------|----------|---------|-------------------|
| API-VER-004-A | Valid token | Correct token | 200: Accepted |
| API-VER-004-B | Expired token | Old token | 400: Token expired |
| API-VER-004-C | Invalid token | Wrong token | 401: Invalid token |
| API-VER-004-D | Already accepted | Duplicate accept | 400: Already accepted |

---

## 5. Cashback API

### API-CSH-001: Calculate Cashback

**Endpoint:** `GET /functions/v1/cashback/calculate`

| Test ID | Scenario | Setup | Expected Response |
|---------|----------|-------|-------------------|
| API-CSH-001-A | Standard 1% | Rent = 30,000 | 200: Cashback = 300 |
| API-CSH-001-B | Max cap applied | Rent = 1,500,000 | 200: Cashback = 10,000 |
| API-CSH-001-C | After 7th | Day = 8 | 200: Cashback = 0, not eligible |
| API-CSH-001-D | User not qualified | Status = signedUp | 200: Cashback locked |
| API-CSH-001-E | User complete | Status = complete | 200: Full cashback |

**Test Code:**
```typescript
Deno.test('API-CSH-001-B: applies max cap', async () => {
  const token = await getTestUserToken('qualified_high_rent');

  const response = await fetch(`${BASE_URL}/cashback/calculate`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  // 1,500,000 * 1% = 15,000, but cap is 10,000
  assertEquals(data.cashbackAmount, 10000);
  assertEquals(data.capped, true);
});
```

---

## 6. Realtime Subscriptions

### API-RT-001: Payment Status Updates

**Channel:** `payment_status:{paymentId}`

| Test ID | Scenario | Event | Expected Payload |
|---------|----------|-------|------------------|
| API-RT-001-A | Payment processing | Status change | `{ "status": "processing" }` |
| API-RT-001-B | Payment success | Completion | `{ "status": "success", "transactionId": "..." }` |
| API-RT-001-C | Payment failure | Error | `{ "status": "failed", "error": "..." }` |

---

### API-RT-002: User Status Updates

**Channel:** `user_status:{userId}`

| Test ID | Scenario | Event | Expected Payload |
|---------|----------|-------|------------------|
| API-RT-002-A | Landlord accepts | Verification | `{ "verification": "landlord_accepted" }` |
| API-RT-002-B | Status upgrade | Qualified → Complete | `{ "status": "complete" }` |

---

## 7. Database Integrity Tests

### API-DB-001: Foreign Key Constraints

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| API-DB-001-A | Delete user with payments | DELETE user | Cascade or block |
| API-DB-001-B | Create payment without user | INSERT payment | Foreign key error |
| API-DB-001-C | Invalid tenancy reference | INSERT with bad ID | Foreign key error |

---

### API-DB-002: Unique Constraints

| Test ID | Scenario | Action | Expected Result |
|---------|----------|--------|-----------------|
| API-DB-002-A | Duplicate phone number | INSERT | Unique violation |
| API-DB-002-B | Duplicate payment same month | INSERT | Unique violation |
| API-DB-002-C | Duplicate idempotency key | INSERT | Return existing |

---

### API-DB-003: Row Level Security

| Test ID | Scenario | Query | Expected Result |
|---------|----------|-------|-----------------|
| API-DB-003-A | User reads own data | SELECT payments | Own payments only |
| API-DB-003-B | User reads other's data | SELECT payments | Empty/denied |
| API-DB-003-C | Anon reads protected | SELECT users | Denied |
| API-DB-003-D | Service role bypasses | SELECT all | All rows |

**Test Code:**
```typescript
Deno.test('API-DB-003-A: user only sees own payments', async () => {
  const user1Token = await getTestUserToken('user1');
  const user2Token = await getTestUserToken('user2');

  // User 1 queries
  const response1 = await supabase
    .from('payments')
    .select('*')
    .headers({ Authorization: `Bearer ${user1Token}` });

  // All payments should belong to user1
  for (const payment of response1.data) {
    assertEquals(payment.user_id, 'user1-id');
  }
});
```

---

## Test Utilities

### Test Data Seeding

```typescript
async function seedTestData() {
  // Create test users
  const users = [
    { phone: '+919999900001', name: 'Test New', status: 'signedUp' },
    { phone: '+919999900002', name: 'Test Waitlist', status: 'waitlisted' },
    { phone: '+919999900003', name: 'Test Qualified', status: 'qualified' },
    { phone: '+919999900004', name: 'Test Complete', status: 'complete' },
  ];

  for (const user of users) {
    await supabase.from('users').upsert(user);
  }

  // Create test tenancies
  // ...
}
```

### Mock External Services

```typescript
// Mock payment gateway
Deno.serve({ port: 8080 }, (req) => {
  const url = new URL(req.url);

  if (url.pathname === '/upi/initiate') {
    return new Response(JSON.stringify({
      transactionId: 'mock-tx-' + Date.now(),
      redirectUrl: 'upi://pay?...',
    }));
  }

  return new Response('Not Found', { status: 404 });
});
```

---

## Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| Authentication | 15 | P0 |
| User | 8 | P1 |
| Payment | 18 | P0 |
| Verification | 14 | P0 |
| Cashback | 5 | P1 |
| Realtime | 5 | P1 |
| Database | 10 | P0 |
| **Total** | **75** | - |

---

*Document generated: 2026-01-31*
*Backend stable: Less frequent design changes*
