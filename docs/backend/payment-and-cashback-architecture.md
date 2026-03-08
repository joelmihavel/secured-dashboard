# Payment & Cashback Architecture

> Deep technical documentation of Flent Secured's payment processing, fee calculation, cashback logic, and PayU gateway integration.
>
> Last verified: 2026-03-08 from source code inspection.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Payment Lifecycle](#2-payment-lifecycle)
3. [PayU Gateway Integration](#3-payu-gateway-integration)
4. [Fee System](#4-fee-system)
5. [Cashback System](#5-cashback-system)
6. [Payment Stamps](#6-payment-stamps)
7. [Receipt Generation](#7-receipt-generation)
8. [Database Schema](#8-database-schema)
9. [Frontend Payment Flow](#9-frontend-payment-flow)
10. [Security & Idempotency](#10-security--idempotency)
11. [Cron Jobs & Background Processing](#11-cron-jobs--background-processing)
12. [Edge Cases & Error Handling](#12-edge-cases--error-handling)

---

## 1. Architecture Overview

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT FLOW                                       │
│                                                                              │
│  RN App                    Supabase Edge Functions              PayU India    │
│  ──────                    ──────────────────────               ──────────    │
│                                                                              │
│  EnterAmountContent ──→ initiate-payment ──→ Create payment record           │
│       ↓                      ↓                    ↓                          │
│  MethodSelectorContent    Compute fees        Compute hashes                 │
│       ↓                  Compute cashback     Generate txn ID                │
│  PayU SDK (CBWrapper)        ↓                    ↓                          │
│       ↓               Return PayU params    ←── PayU params ──→ PayU API     │
│  User completes                                                    ↓         │
│  payment in WebView                                           PayU processes │
│       ↓                                                            ↓         │
│  SDK fires event       payment-webhook ←── S2S POST ────── PayU callback     │
│       ↓                      ↓                                               │
│  Status polling         Verify hash                                          │
│       ↓                 Verify amount                                        │
│  PaymentStatusScreen    Update payment status                                │
│       ↓                 Process cashback                                     │
│  Success/Failure        Send notifications                                   │
│                         Auto-save payment method                             │
│                         Queue landlord payout                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **All amounts stored in paise** (1/100 rupee) | Avoids floating-point errors. INR 32,500 = 3,250,000 paise |
| **Server-side hash computation only** | PayU merchant salt never touches the client. PCI DSS compliance |
| **PayU Custom Browser SDK (not Checkout Pro)** | Full UI control. Checkout Pro overrides the app's dark theme |
| **Server-built POST body** | Eliminates encoding mismatches — SDK double-encodes if values are pre-encoded |
| **Optimistic locking on status updates** | Prevents concurrent webhook + cron from double-processing |
| **Multiple successful payments per month allowed** | Users may top up or pay partial amounts |
| **Cashback once per month** | Tracked via `cashback_already_applied` check on payments table |

### Payment Methods Supported

| Method | PayU Mode | Fee Rate | Gate Requirements |
|---|---|---|---|
| UPI | `upi` | Free (0%) | Bank verified |
| Net Banking | `netbanking` | ₹15 flat | Bank verified |
| Debit Card | `debit_card` → `card` (card_type=debit) | 0.9% | Bank verified |
| Credit Card | `card` (card_type=credit) | 1.85% | Bank verified + Landlord approved + Utility verified |

---

## 2. Payment Lifecycle

### Status State Machine

```
                    ┌──── initiated ────┐
                    │                   │
                    ▼                   ▼
              processing          failed (expired_stale)
                    │                   │
          ┌────────┼────────┐           │
          ▼        ▼        ▼           │
       success   failed   (cron        │
          │        │       expired)     │
          │        │           │        │
          │        └───────────┘        │
          │              ↑              │
          │        Late webhook can     │
          │        override failed      │
          │        back to success      │
          ▼                             │
     ┌────────────┐                     │
     │  refunded   │ ←── (PayU refund   │
     │  partially_ │     or auto-refund │
     │  refunded   │     for ₹1 card    │
     └────────────┘     verification)   │
```

### Allowed State Transitions

```
initiated    → processing, success, failed, refunded, partially_refunded
processing   → success, failed, refunded, partially_refunded
failed       → success, refunded, partially_refunded  (late webhook overrides cron expiry)
expired      → success, failed                         (late webhook after cleanup)
success      → refunded, partially_refunded            (post-success refund/dispute)
partially_refunded → refunded                          (full refund completed)
refunded     → (terminal — no transitions)
```

### Detailed Flow

#### Step 1: Initiation (`initiate-payment`)

**Endpoint:** `POST /functions/v1/initiate-payment`

**Auth:** JWT required

**Request body:**

```typescript
{
  tenancy_id: string;          // UUID of the active tenancy
  payment_method: "upi" | "card" | "netbanking" | "debit_card" | "credit_card" | "net_banking";
  card_type?: "credit" | "debit";  // Distinguishes CC vs DC for gate and enforce_paymethod
  rent_month: string;          // "YYYY-MM" format
  amount_paise?: number;       // Optional — defaults to monthly_rent_paise from tenancy
  upi_vpa?: string;            // For UPI collect
  bank_code?: string;          // For netbanking (seamless mode)
  card_token?: string;         // For stored card payments
  checkout_mode?: "sdk";       // Always "sdk" from current app
}
```

**Validation checks (in order):**

1. **Authentication** — JWT must be valid
2. **Rate limiting** — Max 50 payment initiations per user per hour
3. **Schema validation** — All fields validated against type/enum/pattern rules
4. **Payment method normalization** — iOS sends `net_banking`, `credit_card`, `debit_card`; normalized to `netbanking`, `card`
5. **Idempotency check** — Same request within window returns cached response
6. **UPI collect validation** — `upi_vpa` required for `upi_collect` method
7. **Tenancy ownership** — `tenancy.user_id === userId`
8. **Tenancy status** — Must be `active` or `pending_verification`
9. **Bank verification** — `tenancy.bank_verified` must be true
10. **Minimum amount** — At least ₹10 (1000 paise)
11. **Credit card gate** — Requires `landlord_approved` AND `utility_verified`
12. **Stale payment cleanup** — Expire `initiated` payments with no `payu_mihpayid`
13. **Double-charge prevention** — Block if `initiated` or `processing` payment exists for this month
14. **Cashback dedup** — Check if cashback already given this month

**Demo bypass:** Test users (`isTestUser()`) get instant mock success without hitting PayU.

#### Step 2: Amount Calculation

```
originalRentPaise = request.amount_paise ?? tenancy.monthly_rent_paise

┌─ Cashback Gate Checks ─────────────────────────────────────┐
│ 1. Past cutoff?  → No cashback (cutoff day from agreement) │
│ 2. Already applied this month? → No cashback               │
│ 3. All verifications complete?                              │
│    YES → Instant 1% discount + redeem accumulated balance   │
│    NO  → Earn 1% into balance (credited on success)         │
└─────────────────────────────────────────────────────────────┘

netRentPaise      = originalRentPaise - cashbackDiscountPaise
estimatedPgFee    = netRentPaise × feeRate  (or flat fee)
totalAmountPaise  = netRentPaise  (PayU handles fee collection separately)
landlordPayoutPaise = originalRentPaise  (landlord always gets full rent)
```

#### Step 3: PayU Hash Generation

Two hash algorithms computed for diagnostics:
- **v1 (SHA-512):** `sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|||||| + salt)`
- **v2 (HMAC-SHA256):** `hmacSha256(hashInputStr, salt)` — without trailing salt concatenation

Currently uses v1. Both logged for troubleshooting hash mismatches.

Additional hashes computed:
- **VAS hash:** `sha512(key|vas_for_mobile_sdk|default|salt)` — value-added services
- **Payment Related hash:** `sha512(key|payment_related_details_for_mobile_sdk|key:email|salt)` — saved cards

#### Step 4: Payment Record Creation

A `payments` row is inserted with status `initiated`, storing:
- Original rent, net rent, estimated PG fee, cashback amounts
- PayU params (`payu_initiation_params` JSONB column)
- Idempotency key
- Client IP and user agent
- Payment method details (UPI VPA, bank code, etc.)

#### Step 5: PayU SDK (Client-Side)

The RN app receives PayU params and launches the PayU Custom Browser SDK:

1. **Server-built `post_data`** is preferred — ensures exact encoding that passes PayU's hash verification
2. If unavailable, **client-built POST body** via `buildPostDataFallback()` is used as fallback
3. `CBWrapper.openCB()` opens a WKWebView that loads `https://secure.payu.in/_payment` with the POST data
4. User completes payment inside the WebView (UPI PIN, OTP, bank login, etc.)
5. `CBListener` events fire: `onPaymentSuccess`, `onPaymentFailure`, `onPaymentTerminate`
6. 10-minute timeout on the SDK — after that, payment is marked as timed out

**Critical encoding rule:** Values in `post_data` must be RAW (not URL-encoded). The PayU SDK's JS form submission URL-encodes everything once. Pre-encoding causes double-encoding → hash mismatch.

#### Step 6: Webhook Processing (`payment-webhook`)

**Endpoint:** `POST /functions/v1/payment-webhook`

**Auth:** None (verified via PayU hash)

**Content types:** `application/x-www-form-urlencoded` (PayU default) or `application/json`

**Processing steps:**

1. Parse PayU form data/JSON
2. Validate required fields: `txnid`, `status`, `amount`, `hash`
3. **Hash verification** — `verifyPayUWebhookHashWithCharges()` (reverse hash with `additional_charges` support)
4. Find payment by `payu_txn_id`
5. **UDF cross-validation** — `udf1` must match `tenancy_id` (security check)
6. **State transition validation** — Check `ALLOWED_TRANSITIONS` matrix
7. **Duplicate detection** — Skip if same `mihpayid` already processed
8. **Amount verification** — Compare in paise (integers) to avoid floating-point issues
9. **Optimistic lock update** — `UPDATE ... WHERE status = current_status`
10. **Retry on concurrent change** — If optimistic lock fails, re-read and retry if transition still valid
11. **Cutoff re-validation** — If payment completed after cutoff, zero out cashback
12. **Cashback processing** — Path A (instant discount) or Path B (earned into balance)
13. **Auto-save payment method** — UPI/card/netbanking details saved for future use
14. **Auto-refund ₹1 card verifications** — If payment has `metadata.purpose === "card_verification"`
15. **Notifications** — WhatsApp + push notifications for success/failure
16. **Audit logging**

---

## 3. PayU Gateway Integration

### SDK Stack

| Layer | Package | Purpose |
|---|---|---|
| Core PG SDK | `payu-core-pg-react` | Generates correctly formatted POST body |
| Custom Browser SDK | `payu-custom-browser-react` | WKWebView for payment pages |
| CBWrapper | Native module | Bridges RN ↔ PayU Custom Browser |

### SDK Loading Strategy

```
1. Try NativeModules.CBWrapper (direct native module access)
2. Try require('payu-custom-browser-react') (JS module fallback)
3. Fall back to mock payment in __DEV__ (Expo Go)
```

### PayU Configuration

| Setting | Value |
|---|---|
| Merchant Key | From `PAYU_MERCHANT_KEY` env var |
| Merchant Salt | From `PAYU_MERCHANT_SALT` env var |
| Sandbox URL | `https://test.payu.in/_payment` |
| Production URL | `https://secure.payu.in/_payment` |
| Info URL | `https://info.payu.in/merchant/postservice.php` |
| SDK Environment | `'1'` = sandbox, `'0'` = production |
| Success/Failure URL | `{SUPABASE_URL}/functions/v1/payment-webhook` (same endpoint for surl/furl/curl) |

### PayU `enforce_paymethod` Mapping

| Flent Method | PayU `enforce_paymethod` |
|---|---|
| `upi` / `upi_intent` / `upi_collect` | `upi` |
| `card` (credit) | `creditcard` |
| `card` (debit) | `debitcard` |
| `card` (unspecified) | `creditcard\|debitcard` |
| `netbanking` | `netbanking` |
| `wallet` | `cashcard` |

### UDF Fields (User Defined Fields)

PayU supports 5 UDF fields, used to pass context through the payment lifecycle:

| UDF | Value | Purpose |
|---|---|---|
| `udf1` | `tenancy_id` | Links payment to tenancy |
| `udf2` | `rent_month` (YYYY-MM) | Identifies which month's rent |
| `udf3` | `user_id` | Links payment to user |
| `udf4` | (empty) | Reserved |
| `udf5` | (empty) | Reserved |

### WKWebView POST Body Issue

**Problem:** WKWebView drops `httpBody` on POST requests.

**PayU's Solution:** The Custom Browser SDK parses the `post_data` string, creates JavaScript form input elements, and auto-submits the form. This bypasses the `httpBody` limitation.

**Encoding rule:** The SDK uses `removingPercentEncoding` (Swift), which treats `%20` as space but `+` as literal `+`. Therefore:
- Always use `encodeURIComponent` (gives `%20`) for encoding
- Never use `+` for spaces
- Better yet: pass RAW (un-encoded) values in `post_data` — the SDK's form submission handles encoding

---

## 4. Fee System

### Fee Configuration Table (`fee_config`)

```sql
CREATE TABLE fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL UNIQUE,   -- 'upi', 'credit_card', 'debit_card', 'netbanking'
  rate NUMERIC NOT NULL,          -- Rate value (percentage or flat paise)
  fee_type TEXT DEFAULT 'percentage',  -- 'percentage' or 'flat_paise'
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Current Fee Rates

| Method | Rate | Type | Display |
|---|---|---|---|
| UPI | 0 | percentage | Free |
| Credit Card | 0.0185 (1.85%) | percentage | ₹601 fee on ₹32,500 |
| Debit Card | 0.009 (0.9%) | percentage | ₹293 fee on ₹32,500 |
| Net Banking | 1500 | flat_paise | ₹15 fee |

### Fee Calculation Logic

```typescript
// Backend (initiate-payment)
const feeRateKey = (payment_method === "card" && card_type)
  ? `${card_type}_card`   // "credit_card" or "debit_card"
  : payment_method;        // "upi", "netbanking", etc.

const feeConfig = await getFeeConfigForMethod(feeRateKey, supabase);

const estimatedPgFeePaise = feeConfig.fee_type === 'flat_paise'
  ? Math.round(feeConfig.rate)
  : Math.ceil(netRentPaise * feeConfig.rate);
```

### Fee Resolution Order

1. **Database `fee_config` table** — Dynamic, admin-updatable
2. **Environment variables** — `FEE_RATE_UPI`, `FEE_RATE_CREDIT_CARD`, etc.
3. **Hardcoded defaults** — UPI=0%, CC/DC=2%, NB=1.5%

### Important: PayU Handles Fee Collection

The `total_amount_paise` sent to PayU equals `net_rent_paise` only (rent minus cashback discount). **PayU adds their own convenience fee** on top. The `estimated_pg_fee_paise` is for display/records only — it is NOT added to the PayU amount.

### Frontend Fee Display

```typescript
// rn-app/src/services/payment/index.ts
function computeFee(config: FeeRateConfig, amount: number): number {
  if (config.fee_type === 'flat_paise') return Math.round(config.rate / 100);
  return Math.ceil(amount * config.rate);
}

function formatFeeLabel(config: FeeRateConfig, amount: number): string {
  if (config.fee_type === 'flat_paise') {
    const rupees = Math.round(config.rate / 100);
    return `₹${rupees.toLocaleString('en-IN')} fee`;
  }
  if (config.rate === 0) return 'Free';
  const fee = Math.ceil(amount * config.rate);
  return `₹${fee.toLocaleString('en-IN')} fee`;
}
```

The app fetches fee config dynamically from `get-fee-config` edge function, with hardcoded `PAYU_FEE_RATES` as fallback.

---

## 5. Cashback System

### Cashback Philosophy

Flent incentivizes on-time rent payments with a 1% cashback system. The system has two paths depending on the user's verification status:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CASHBACK DECISION TREE                          │
│                                                                     │
│  Payment initiated for rent month YYYY-MM                           │
│       │                                                             │
│       ├── Past cutoff day? ──YES──→ No cashback (neither path)      │
│       │                                                             │
│       ├── Already applied this month? ──YES──→ No cashback          │
│       │                                                             │
│       ├── All verifications complete?                               │
│       │       │                                                     │
│       │       ├── YES (Path A: VERIFIED)                            │
│       │       │    - Instant 1% discount off rent                   │
│       │       │    - PLUS: redeem accumulated balance               │
│       │       │    - User pays: rent - 1% - accumulated_balance     │
│       │       │    - Landlord gets: full rent                       │
│       │       │    - Flent covers: the gap (subsidy)                │
│       │       │                                                     │
│       │       └── NO (Path B: UNVERIFIED)                           │
│       │            - User pays: full rent                           │
│       │            - Earns 1% into cashback balance                 │
│       │            - Redeemable when all verifications complete     │
│       │                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Gate Conditions

#### 1. Cutoff Date Gate

The `cashback_cutoff_day` is extracted from the rent agreement (typically the rent due date). Defaults to 7 if not set.

```typescript
const cutoffDay = tenancy.cashback_cutoff_day ?? tenancy.rent_due_day ?? 7;
const cutoffDate = new Date(Date.UTC(
  rentYear, rentMonthNum - 1, cutoffDay, 18, 29, 59, 999  // End of day IST
));
const isPastCutoff = new Date() > cutoffDate;
```

**IST Conversion:** Cutoff is end of day IST (23:59:59.999 IST = 18:29:59.999 UTC).

#### 2. Verification Gate

All three must be `true` for instant discount (Path A):

| Verification | Source | How It's Set |
|---|---|---|
| `bank_verified` | `verify-bank` edge function | Penny drop verification of landlord bank account |
| `utility_verified` | `verify-utility` edge function | AI matching of utility bill address vs agreement |
| `landlord_approved` | `confirm-extraction` or landlord WhatsApp | Landlord confirms tenancy details |

#### 3. Monthly Dedup Gate

Only one cashback per tenancy per month. Checked via:

```sql
SELECT id FROM payments
WHERE tenancy_id = $1
  AND payment_month = $2
  AND status = 'success'
  AND cashback_applied_paise > 0
LIMIT 1;
```

### Cashback Calculation

```typescript
// 1% of original rent, capped at 1% of agreement rent
const cashbackOnePct = Math.min(
  Math.floor(originalRentPaise * 0.01),
  Math.floor(tenancy.monthly_rent_paise * 0.01)
);
```

**Path A (Verified — instant discount):**

```typescript
cashbackDiscountPaise = cashbackOnePct + accumulatedBalance;
cashbackDiscountPaise = Math.min(cashbackDiscountPaise, originalRentPaise);
accumulatedRedeemed = Math.min(accumulatedBalance, cashbackDiscountPaise - cashbackOnePct);
accumulatedRedeemed = Math.max(0, accumulatedRedeemed);
cashbackEarnedPaise = 0;
```

**Path B (Unverified — earn into balance):**

```typescript
cashbackDiscountPaise = 0;
cashbackEarnedPaise = cashbackOnePct;
```

### Cashback on Payment Success (Webhook)

When the webhook processes a successful payment:

**Path A — Verified (instant discount was applied):**

```typescript
// 1. Record the discount in the ledger (audit entry, type='discount')
await supabase.from("cashback_ledger").insert({
  transaction_type: "discount",
  amount_paise: payment.cashback_applied_paise,
  description: "1% instant discount on rent payment",
});

// 2. If accumulated balance was redeemed, debit it
if (accumulatedUsed > 0) {
  await supabase.from("cashback_ledger").insert({
    transaction_type: "applied",
    amount_paise: accumulatedUsed,
    description: "Accumulated cashback redeemed",
  });
  await supabase.rpc("decrement_cashback_balance", {
    p_user_id: userId,
    p_amount: accumulatedUsed,
  });
}
```

**Path B — Unverified (earn into balance):**

```typescript
// Credit 1% to the user's cashback balance
await supabase.from("cashback_ledger").insert({
  transaction_type: "earned",
  amount_paise: payment.cashback_earned_paise,
  description: "1% cashback earned (pending verification)",
});
await supabase.rpc("increment_cashback_balance", {
  p_user_id: userId,
  p_amount: payment.cashback_earned_paise,
});
```

### Cutoff Re-Validation on Webhook

Edge case: Payment initiated before cutoff but completed (webhook received) after cutoff.

```typescript
if (isSuccess && (payment.cashback_applied_paise > 0 || payment.cashback_earned_paise > 0)) {
  const cutoffDate = /* computed from tenancy */;
  const paidAt = new Date(updateData.paid_at);

  if (paidAt > cutoffDate) {
    // Zero out all cashback on this payment
    updateData.cashback_applied_paise = 0;
    updateData.cashback_earned_paise = 0;
    updateData.intended_cashback_paise = 0;
    updateData.accumulated_redeemed_paise = 0;
  }
}
```

### Auto-Reversal on Refund

Database trigger `trg_auto_reverse_cashback_on_refund` fires when a payment status changes to `refunded`:

1. Finds any `discount` ledger entry for this payment → inserts `reversal`
2. Finds any `earned` ledger entry → inserts `reversal`
3. `sync_cashback_balance()` trigger on `cashback_ledger` recalculates `users.cashback_balance_paise`

### Cashback Blocker Reasons

The initiate-payment response includes a `cashback_discount.reason` string explaining why cashback was not applied:

| Blocker | Message |
|---|---|
| Already applied | "Cashback has already been applied to a payment this month." |
| Past cutoff | "Cashback is available only for payments made by the 7th of the month..." |
| Bank not verified | "Complete bank verification to unlock 1% rent discount" |
| Utility not verified | "Complete utility bill verification to unlock 1% rent discount" |
| Landlord not approved | "Landlord approval required to unlock 1% rent discount" |
| All passed | `null` (no blocker) |

### Cashback Ledger Transaction Types

| Type | Direction | Wallet Impact | Description |
|---|---|---|---|
| `earned` | Credit | +balance | 1% earned on payment (unverified user) |
| `bonus` | Credit | +balance | Promotional bonus |
| `referral_bonus` | Credit | +balance | Referral reward |
| `promotional` | Credit | +balance | Campaign cashback |
| `applied` | Debit | -balance | Accumulated balance redeemed |
| `reversal` | Debit | -balance | Refund reversal |
| `expired` | Debit | -balance | Unused cashback expired |
| `adjustment` | Debit | -balance | Manual support adjustment |
| `discount` | Audit only | No impact | Records instant discount (no wallet movement) |

### Database Functions

| Function | Purpose |
|---|---|
| `get_available_cashback(p_user_id)` | Returns available balance: `SUM(credits) - SUM(debits)` |
| `increment_cashback_balance(p_user_id, p_amount)` | Adds to `users.cashback_balance_paise` |
| `decrement_cashback_balance(p_user_id, p_amount)` | Subtracts from `users.cashback_balance_paise` (floor 0) |
| `debit_cashback(p_user_id, p_amount, ...)` | Row-level locking debit with ledger entry |
| `sync_cashback_balance()` | Trigger: recalculates `users.cashback_balance_paise` on ledger changes |
| `auto_reverse_cashback_on_refund()` | Trigger: reverses cashback when payment is refunded |

### Dashboard Cashback Data

The `dashboard-data` edge function computes cashback summary:

```typescript
cashback: {
  discount_rate: 0.01,                    // Always 1%
  max_discount_paise: Math.floor(monthly_rent_paise * 0.01),
  max_discount: max_discount_paise / 100,
  verification_complete: bank && utility && landlord,
  total_savings_paise: SUM(earned + discount entries),
  total_savings: total_savings_paise / 100,
  available_balance_paise: get_available_cashback(userId),
  available_balance: available_balance_paise / 100,
  legacy_wallet_balance: available_balance,
}
```

---

## 6. Payment Stamps

Payment stamps provide a month-by-month visual history of payment timeliness. Rendered as a grid on the dashboard (PaymentFlipCard back face).

### Classification Logic

For each month from tenancy creation to current month:

```
┌─ Is it a future month or before due date? ─────────────────┐
│   YES + Paid successfully        → on_time / late           │
│   YES + Not paid / processing    → pending (grey)           │
├─ Due date has passed? ──────────────────────────────────────┤
│   Paid successfully before due   → on_time (green)          │
│   Paid successfully after due    → late (yellow)            │
│   Processing / initiated         → pending (grey)           │
│   No success payment             → missed (red)             │
└─────────────────────────────────────────────────────────────┘
```

**Key rules:**
- Tracking starts from `tenancy.created_at`, NOT from agreement lease dates
- If user joined after this month's due date, that month doesn't count
- `failed`, `refunded`, and no-payment all remain `pending` (grey) until due date passes
- Due cutoff: end of `rent_due_day` in IST (23:59:59.999 IST = 18:29:59.999 UTC)
- When multiple payments exist for the same month, the "best" one wins: `success > processing > initiated`

### Edge Functions

- **`get-payment-stamps`** — Full month-by-month stamp data (used for detailed views)
- **`dashboard-data`** — Includes summary stamps (used for dashboard display)

### Frontend Components

**`PaymentFlipCard`** — Interactive card with flip animation:
- **Front face:** Month name, payment badge (paid/late/missed/upcoming), cashback earned, "View Rent Receipt" link
- **Back face:** 3D furniture assets with spring animations, pattern texture overlay
- Badge variants: `paid` (green), `late` (yellow), `missed` (red), `upcoming` (grey)

---

## 7. Receipt Generation

**Endpoint:** `GET /functions/v1/generate-receipt?payment_id=xxx`

Only available for `success` status payments.

### Receipt Data Structure

```typescript
{
  receipt_number: "FS-202603-A1B2C3D4",   // Format: FS-YYYYMM-{last8-of-payment-id}
  payment: {
    amount, pg_fee, cashback_applied, cashback_earned,
    net_amount_paid, payment_method, utr, timeliness ('on_time'|'late')
  },
  tenant: { name, phone, email },
  property: { address, city, state, pincode },
  landlord: { name, bank_account_masked, pan_masked },
  agreement: { cert_id },
  tax: {
    subtotal: pgFeePaise,       // Only PG fee is taxable (rent is not)
    gst_rate: 0.18,             // 18% GST
    cgst_amount, sgst_amount,   // Split 50/50 (intra-state)
    hsn_sac_code: "997212",     // Rental payment facilitation services
  },
  company: { name, gstin, support_email, support_phone }
}
```

### Tax Calculation

GST is applied only on the platform service fee (PG fee), NOT on the rent amount:

```typescript
const gstAmountPaise = Math.round(pgFeePaise * 0.18);
const cgstPaise = Math.round(gstAmountPaise / 2);
const sgstPaise = gstAmountPaise - cgstPaise;  // Avoid rounding errors
```

---

## 8. Database Schema

### `payments` Table — Key Columns

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `tenancy_id` | UUID | FK to tenancies |
| `user_id` | UUID | FK to users |
| `rent_amount_paise` | BIGINT | Original rent amount (before cashback) |
| `pg_fee_paise` | BIGINT | Actual PG fee (set by webhook, 0 at initiation) |
| `estimated_pg_fee_paise` | INTEGER | Estimated fee at initiation (for display) |
| `cashback_applied_paise` | BIGINT | Instant discount applied (verified users) |
| `cashback_earned_paise` | BIGINT | Cashback earned into balance (unverified users) |
| `accumulated_redeemed_paise` | INTEGER | Accumulated balance redeemed in this payment |
| `intended_cashback_paise` | BIGINT | Deprecated (legacy wallet model) |
| `total_amount_paise` | BIGINT | Amount sent to PayU (= net_rent_paise) |
| `landlord_payout_paise` | BIGINT | Amount landlord receives (= original rent) |
| `net_rent_paise` | BIGINT | Rent after cashback discount |
| `flent_subsidy_paise` | BIGINT | Amount Flent covers (= cashback discount) |
| `status` | TEXT | initiated/processing/success/failed/refunded/etc. |
| `payment_gateway` | TEXT | "payu" or "demo" |
| `payu_txn_id` | TEXT | PayU transaction ID (our generated txn ID) |
| `payu_mihpayid` | TEXT | PayU's internal payment ID |
| `payu_status` | TEXT | Raw PayU status string |
| `payu_raw_response` | JSONB | Sanitized webhook payload |
| `payment_method` | TEXT | upi/card/netbanking |
| `payment_method_details` | JSONB | UPI VPA, bank code, card last4, etc. |
| `payment_month` | DATE | "YYYY-MM-01" format |
| `due_date` | DATE | Rent due date (5th of rent month) |
| `paid_at` | TIMESTAMPTZ | When payment was confirmed successful |
| `idempotency_key` | TEXT | For preventing duplicate payments |
| `landlord_payout_status` | TEXT | pending/settled/failed |

### `cashback_ledger` Table

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to users |
| `transaction_type` | TEXT | earned/applied/expired/bonus/adjustment/reversal/discount |
| `amount_paise` | BIGINT | Always positive. Direction determined by type |
| `balance_after_paise` | BIGINT | Running balance after transaction |
| `payment_id` | UUID | FK to payments (nullable) |
| `tenancy_id` | UUID | FK to tenancies (nullable) |
| `description` | TEXT | Human-readable description |
| `expires_at` | TIMESTAMPTZ | When this cashback expires |
| `expired_at` | TIMESTAMPTZ | When it actually expired |
| `created_at` | TIMESTAMPTZ | Transaction timestamp |

### `fee_config` Table

| Column | Type | Description |
|---|---|---|
| `method` | TEXT | Payment method (unique) |
| `rate` | NUMERIC | Fee rate (percentage or flat paise) |
| `fee_type` | TEXT | 'percentage' or 'flat_paise' |
| `is_active` | BOOLEAN | Whether this config is active |

### Key Indexes

```sql
-- Prevent double-earned cashback per payment
CREATE UNIQUE INDEX idx_cashback_ledger_unique_earned
  ON cashback_ledger (payment_id, transaction_type)
  WHERE transaction_type = 'earned' AND payment_id IS NOT NULL;

-- Prevent double-discount per payment
CREATE UNIQUE INDEX idx_cashback_ledger_unique_discount
  ON cashback_ledger (payment_id, transaction_type)
  WHERE transaction_type = 'discount' AND payment_id IS NOT NULL;

-- Efficient cashback balance queries
CREATE INDEX idx_cashback_ledger_user_created
  ON cashback_ledger(user_id, created_at DESC);
```

---

## 9. Frontend Payment Flow

### Screen Flow

```
Home Dashboard
  └─ "Pay Rent" button
      └─ PaymentMethodModal (BottomSheet)
          ├─ Step 1: EnterAmountContent
          │   - Pre-filled with monthly_rent
          │   - Shows rent month + due date
          │   - Validation: cashback impact warnings
          │   - CTA: "Select Payment Method →"
          │
          ├─ Step 2: MethodSelectorContent
          │   - Radio buttons: UPI, Net Banking, Debit Card, Credit Card
          │   - Dynamic fee display (from get-fee-config or hardcoded fallback)
          │   - Credit card: disabled if landlord not approved or utility not verified
          │   - CTA: "Proceed"
          │
          └─ Step 3: PayU SDK launches
              └─ WKWebView (Custom Browser)
                  └─ User completes payment
                      ├─ Success → PaymentStatusScreen (success)
                      ├─ Failure → PaymentStatusScreen (failed)
                      └─ Cancelled → Return to modal
```

### Key Components

| Component | File | Purpose |
|---|---|---|
| `EnterAmountContent` | `rn-app/src/components/payment/PaymentMethodModal/EnterAmountContent.tsx` | Amount input with validation |
| `MethodSelectorContent` | `rn-app/src/components/payment/PaymentMethodModal/MethodSelectorContent.tsx` | Payment method selection |
| `PaymentFlipCard` | `rn-app/src/components/home/PaymentFlipCard.tsx` | Visual payment history card |
| `CashbacksList` | `rn-app/src/components/home/CashbacksList.tsx` | Cashback balance + history list |
| `WarningBanner` | `rn-app/src/components/home/WarningBanner.tsx` | Verification warnings |

### Dashboard State Machine

The dashboard derives its display state from the data:

```typescript
type DashboardState =
  | 'loading'              // Data not yet available
  | 'no_tenancy'           // User has no active tenancy
  | 'pending_verification' // Tenancy exists, verifications incomplete
  | 'all_verified'         // All verified, no payment due
  | 'payment_due'          // Upcoming payment, not overdue
  | 'payment_overdue'      // Upcoming payment is overdue
  | 'payment_processing'   // Payment currently being processed
  | 'payment_success'      // Recent payment successful
  | 'error';               // Error fetching data
```

### Cashback Display Mapping

Recent payments are mapped to cashback entries for the `CashbacksList`:

```typescript
function deriveCashbackEntries(rawPayments, monthlyRent, discountRate) {
  return rawPayments.map(p => {
    // cashback_applied = instant discount (verified)
    // cashback_earned = earned into balance (unverified)
    const cashbackAmount = p.cashback_applied > 0
      ? p.cashback_applied
      : p.cashback_earned;

    // success + cashback > 0 → 'paid'
    // success + cashback = 0 → 'paid' with expected amount
    // failed → 'missed'
    // pending/processing → 'pending'
  });
}
```

### Validation Bubbles (EnterAmountContent)

| Condition | Severity | Message |
|---|---|---|
| Amount < monthly rent | Warning | "Cashback will apply on reduced rent" |
| Amount = monthly rent, not fully verified | Info | "Cashback will be accumulated" |
| Default (amount > 0) | Info | "Cashback will be accumulated" |

---

## 10. Security & Idempotency

### Hash Verification

**Initiation (client → server):** Hash computed server-side, never on client.

**Webhook (PayU → server):** Reverse hash verification with `additional_charges` support:

```
Reverse hash = sha512(salt|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
```

If `additional_charges` present, it's inserted after `salt` in the hash input.

### Amount Tamper Detection

```typescript
const initiatedAmountPaise = payment.total_amount_paise;
const webhookAmountPaise = Math.round(parseFloat(payload.amount) * 100);

if (initiatedAmountPaise !== webhookAmountPaise) {
  // Log security event + reject webhook
  throw new PaymentError("Amount mismatch - potential tampering detected");
}
```

### Idempotency

- **Initiate:** `x-idempotency-key` header or auto-generated from `payment:{userId}:{rent_month}`
- Cached responses returned for duplicate requests within window
- Failed requests are marked so the key can be retried

### Rate Limiting

- Max 50 payment initiations per user per hour
- Enforced by counting recent `payments` rows

### Webhook Payload Sanitization

Only allowlisted fields from PayU are stored in `payu_raw_response`:

```typescript
const SAFE_WEBHOOK_FIELDS = [
  "mihpayid", "status", "txnid", "amount", "productinfo", "firstname",
  "email", "mode", "PG_TYPE", "bankcode", "bank_ref_no", "error", ...
];
```

Card numbers are truncated to last 4 digits before storage.

### Optimistic Locking

```sql
UPDATE payments SET status = $new_status
WHERE id = $payment_id AND status = $current_status
RETURNING id;
```

If no rows returned (concurrent change), the webhook re-reads and retries if the transition is still valid.

---

## 11. Cron Jobs & Background Processing

### `cleanup-stale-payments`

Runs every 30 minutes. Expires payments stuck in `initiated` or `processing` for too long:

- `initiated` for >2 hours → `failed` (payu_status: `expired_no_webhook`)
- `processing` for >24 hours → `failed` (payu_status: `expired_processing`)

### `process-cashback-expiry`

Runs daily. Expires unused cashback older than 90 days:

- Finds `earned` entries where `expires_at < NOW()` and `expired_at IS NULL`
- Creates `expired` entries in the ledger
- Triggers `sync_cashback_balance` to update `users.cashback_balance_paise`

### `send-payment-reminders`

Runs daily at 9 AM IST. Sends WhatsApp/push notifications for upcoming rent:

- 3 days before due date: "Reminder: rent due in 3 days"
- On due date: "Rent is due today"
- 1 day after due date: "Rent is overdue"

### `cleanup-notification-queue`

Processes pending notifications from `notification_queue` table.

---

## 12. Edge Cases & Error Handling

### Stale Payment Cleanup at Initiation

Before creating a new payment, `initiate-payment` expires abandoned payments:

```sql
UPDATE payments
SET status = 'failed', payu_status = 'expired_stale'
WHERE tenancy_id = $1
  AND payment_month = $2
  AND status = 'initiated'
  AND payu_mihpayid IS NULL;  -- Never reached PayU
```

This uses `payu_mihpayid IS NULL` instead of time-based expiry so that backing out of the confirm screen and re-proceeding works immediately.

### Late Webhook After Cron Expiry

If cron marks a payment as `failed` (expired) but PayU later sends a success webhook:

1. `ALLOWED_TRANSITIONS['failed']` includes `'success'`
2. The webhook overrides `failed` → `success`
3. Cashback is processed normally
4. The `paid_at` timestamp is set when the webhook arrives

### Concurrent Webhook + Cron Race

Optimistic locking prevents double-processing:

1. Webhook tries `UPDATE ... WHERE status = 'initiated'` → succeeds
2. Cron tries `UPDATE ... WHERE status = 'initiated'` → 0 rows (already changed)
3. Or vice versa — the first writer wins, the second is a no-op

### Credit Card Eligibility Gate

Credit card payments require additional verification to prevent fraud:

```typescript
if (isCreditCard) {
  if (!tenancy.landlord_approved) {
    throw "Credit card payments require landlord verification"
  }
  if (!tenancy.utility_verified) {
    throw "Credit card payments require utility bill verification"
  }
}
```

Debit cards (`card_type === 'debit'`) skip this gate entirely.

### ₹1 Card Verification Auto-Refund

Card verification payments (`metadata.purpose === "card_verification"`) are automatically refunded on success:

1. Webhook detects `card_verification` purpose
2. Calls PayU `cancel_refund_transaction` API
3. Updates payment status to `refunded`
4. Uses optimistic lock to prevent double-refund

### Payment Method Auto-Save

On successful payment, the webhook saves the payment method for future use:

- **Cards:** Saved with `card_last4`, `card_network`, `card_type`, and optional `store_card_token`
- **UPI:** Extracted from `field3` (intent) or `field7` (collect), validated to contain `@`
- **Netbanking:** Saved with `bank_code`
- Dedup: existing methods are updated rather than duplicated

### PayU Status Mapping

| PayU Status | Flent Status |
|---|---|
| `success`, `captured` | `success` |
| `pending`, `initiated`, `inprogress`, `authorized`, `on_hold` | `processing` |
| `failure`, `usercancelled`, `dropped`, `bounced`, `timeout`, `expired`, `rejected` | `failed` |
| `refunded`, `refund` | `refunded` |
| `partially_refunded`, `partial_refund` | `partially_refunded` |
