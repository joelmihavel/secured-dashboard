# Flent Secured v2 - Backend Architecture

## Overview

**Production-grade rent payment platform** built on the existing Flent Secured Supabase infrastructure.

| Aspect | Decision |
|--------|----------|
| **Database** | Supabase PostgreSQL (existing: `uowjtrzmszuaiokqxgir`) |
| **API Layer** | Supabase Edge Functions (Deno/TypeScript) |
| **Auth** | Supabase Auth + Twilio Verify (OTP) |
| **Storage** | Supabase Storage (rent agreements) |
| **Realtime** | Supabase Realtime (payment status) |
| **AI Extraction** | GCP Document AI (OCR) + Gemini 2.5 Flash (Vertex AI) |
| **Scheduled Jobs** | pg_cron |
| **Region** | ap-south-1 (Mumbai) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────────────────────────────────────────────────────────┤
│   iOS App (SwiftUI)              Landlord Portal (Next.js)      │
│   └── supabase-swift             └── @supabase/supabase-js      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    SUPABASE (Everything)                         │
│                    Project: Flent Secured                        │
│                    Region: ap-south-1                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   AUTH                                                          │
│   └── Phone OTP via Twilio Verify                               │
│                                                                 │
│   POSTGRESQL (Existing Tables)                                  │
│   ├── users (75 rows)                                           │
│   ├── waitlist (30 rows)                                        │
│   ├── extracted_rental_info (28 rows)                           │
│   ├── rental_parties (71 rows)                                  │
│   ├── supported_cities (7 rows)                                 │
│   ├── device_tokens                                             │
│   └── notification_queue                                        │
│                                                                 │
│   NEW TABLES (v2)                                               │
│   ├── tenancies                                                 │
│   ├── payments                                                  │
│   ├── cashback_ledger                                           │
│   ├── bank_accounts                                             │
│   ├── identity_verifications  (Mobile 360 data)                 │
│   ├── idempotency_keys                                          │
│   └── audit_logs                                                │
│                                                                 │
│   EDGE FUNCTIONS (Existing)                                     │
│   ├── process-document      → Document AI + Gemini extraction   │
│   ├── upload-document       → Storage upload handler            │
│   ├── confirm-extraction    → User confirms extracted data      │
│   ├── get-waitlist-status   → Polling endpoint                  │
│   ├── geocode-address       → Google Maps geocoding             │
│   ├── send-push-notification→ APNs push                         │
│   ├── delete-account        → GDPR compliance                   │
│   └── update-profile        → Profile management                │
│                                                                 │
│   NEW EDGE FUNCTIONS (v2)                                       │
│   ├── initiate-payment      → PayU payment initiation           │
│   ├── payment-webhook       → PayU callback handler             │
│   ├── verify-bank           → Cashfree Penny Drop               │
│   ├── verify-identity       → Cashfree Mobile 360               │
│   ├── verify-utility        → API Club Electricity Bill         │
│   ├── send-whatsapp         → Twilio WhatsApp                   │
│   ├── send-sms              → Twilio SMS                        │
│   ├── landlord-approve      → Landlord approval flow            │
│   ├── calculate-cashback    → Cashback calculation              │
│   └── dashboard-data        → Home screen aggregation           │
│                                                                 │
│   STORAGE                                                       │
│   └── rent-agreements bucket (existing)                         │
│                                                                 │
│   REALTIME                                                      │
│   ├── payment status updates                                    │
│   └── extraction progress                                       │
│                                                                 │
│   pg_cron (Scheduled Jobs)                                      │
│   ├── Payment reminders (3 days before due)                     │
│   ├── Settlement retry (failed payments)                        │
│   ├── Vacancy cover activation                                  │
│   └── Cleanup expired idempotency keys                          │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   PAYMENTS    │  │ VERIFICATION  │  │  DOCUMENTS    │
├───────────────┤  ├───────────────┤  ├───────────────┤
│ PayU India    │  │ Cashfree      │  │ GCP Doc AI    │
│ └── UPI       │  │ ├── Penny Drop│  │ └── OCR       │
│ └── Cards     │  │ └── Mobile360 │  │               │
│ └── NetBanking│  │               │  │ Gemini 2.5    │
│               │  │ API Club      │  │ Flash         │
│               │  │ └── Elec Bill │  │ └── Vertex AI │
└───────────────┘  └───────────────┘  └───────────────┘
            │               │               │
            ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATIONS                                 │
├─────────────────────────────────────────────────────────────────┤
│   Twilio WhatsApp     │    Twilio SMS   │    APNs Push          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### Proven in Production
- Current Flent Secured has **75 users**, **28 extracted agreements**
- `process-document` Edge Function handles GCP Document AI + Gemini 2.5 Flash
- 150s timeout sufficient (400s on Pro plan)

### Simplicity for Solo Developer
- Single codebase (Supabase Edge Functions)
- No Redis, Cloud Run, or separate workers to manage
- Deploy with `supabase functions deploy`
- Debug with Supabase Dashboard logs

### Cost Effective
| Service | Monthly Cost |
|---------|-------------|
| Supabase Pro | $25 |
| GCP Document AI | Free tier (1K pages) |
| Gemini 2.5 Flash | ~$5 (via Vertex AI) |
| Third-party APIs | Usage-based |
| **Total** | **~$30-50/month** |

*$100K GCP credits available for Vertex AI, Document AI*

---

## Edge Function Timeout Strategy

| Operation | Typical Duration | Timeout |
|-----------|-----------------|---------|
| CRUD operations | <100ms | 10s |
| Payment initiation | 2-5s | 30s |
| Bank verification (Penny Drop) | 5-15s | 60s |
| Identity verification (M360) | 5-10s | 60s |
| **Document extraction** | 15-45s | 150s |
| Notification dispatch | 1-3s | 30s |

Pro plan provides **400s timeout** - sufficient for all operations.

---

## Document Extraction (Existing Implementation)

```
process-document Edge Function
│
├── 1. Download PDF from Supabase Storage
├── 2. GCP Document AI → OCR text extraction
├── 3. Gemini 2.5 Flash (Vertex AI) → Entity extraction
│      └── Extracts: property, parties, rent, dates, e-stamp
├── 4. Store in extracted_rental_info table
├── 5. Update waitlist status
└── 6. Trigger push notification
```

**AI Model:** `gemini-2.5-flash` via Vertex AI (us-central1)
- Stronger reasoning than Flash Lite
- Essential for complex Indian rent agreements
- 10-15s extraction time acceptable

---

## Production Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Idempotency** | PostgreSQL table with TTL cleanup via pg_cron |
| **Audit Logging** | Database triggers on sensitive tables |
| **Transaction Integrity** | PostgreSQL functions with ACID |
| **Rate Limiting** | pg_advisory_lock per user/endpoint |
| **Error Handling** | Try-catch with Supabase error logging |
| **Error Tracking** | Sentry for Edge Function errors |
| **Product Analytics** | PostHog for custom events and funnels |
| **Retry Logic** | pg_cron scheduled retries for failed operations |

### Idempotency Pattern (Payment)
```typescript
// In initiate-payment Edge Function
const { data: existing } = await supabase
  .from('idempotency_keys')
  .select('response')
  .eq('key', idempotencyKey)
  .gt('expires_at', new Date().toISOString())
  .single();

if (existing) {
  return new Response(JSON.stringify(existing.response));
}

// Process payment...
await supabase.from('idempotency_keys').insert({
  key: idempotencyKey,
  response: paymentResult,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
});
```

---

## Database Schema Changes

### Modified: users table
```sql
-- Add first_name and last_name columns (collected during onboarding)
ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN last_name VARCHAR(100);

-- Migrate existing full_name data (split on first space)
UPDATE users
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
WHERE full_name IS NOT NULL AND full_name != '';

-- Keep full_name as computed for backward compatibility
-- Or create a generated column:
-- ALTER TABLE users ADD COLUMN full_name_computed TEXT
--   GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED;
```

**Onboarding flow change:**
- Phone number + First name + Last name collected together
- `full_name` kept for backward compatibility (existing Edge Functions)
- New code uses `first_name` and `last_name` directly

---

## New Database Tables (v2)

### tenancies
```sql
CREATE TABLE tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  extracted_rental_info_id UUID REFERENCES extracted_rental_info(id),
  status TEXT CHECK (status IN ('pending_verification', 'active', 'expired', 'terminated')),
  -- Copied from extraction for immutability
  monthly_rent_paise BIGINT NOT NULL,
  rent_due_day INTEGER NOT NULL,
  lease_start_date DATE NOT NULL,
  lease_end_date DATE,
  -- Verification status
  bank_verified BOOLEAN DEFAULT FALSE,
  utility_verified BOOLEAN DEFAULT FALSE,
  landlord_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID REFERENCES tenancies(id),
  amount_paise BIGINT NOT NULL,
  pg_fee_paise BIGINT NOT NULL,
  cashback_applied_paise BIGINT DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded')),
  payu_txn_id TEXT,
  payment_method TEXT, -- upi, card, netbanking
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
);
```

### bank_accounts
```sql
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  party_type TEXT CHECK (party_type IN ('tenant', 'landlord')),
  account_holder_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL, -- Last 4 digits
  ifsc_code TEXT NOT NULL,
  bank_name TEXT,
  verified BOOLEAN DEFAULT FALSE,
  penny_drop_txn_id TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### identity_verifications (Mobile 360 data)
```sql
CREATE TABLE identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  tenancy_id UUID REFERENCES tenancies(id),

  -- Verification metadata
  verification_id TEXT NOT NULL,           -- Cashfree verification_id
  reference_id TEXT,                       -- Cashfree reference_id
  status TEXT NOT NULL,                    -- SUCCESS, DETAILS_NOT_FOUND, PENDING
  verified_at TIMESTAMPTZ,

  -- Personal details (from Mobile 360)
  m360_full_name TEXT,
  m360_gender TEXT,
  m360_date_of_birth DATE,
  m360_age INTEGER,
  m360_occupation TEXT,
  m360_total_income TEXT,
  m360_relatives JSONB,                    -- Array of relatives

  -- Contact info
  m360_phone_numbers JSONB,                -- Array: [{number, type, source}]
  m360_emails JSONB,                       -- Array: [{email, source}]

  -- Identity documents (masked/partial for security)
  m360_pan_details JSONB,                  -- [{pan, name, type, aadhaar_linked}]
  m360_aadhaar_masked TEXT,                -- Last 4 digits only
  m360_passport_details JSONB,
  m360_driving_license_details JSONB,
  m360_voter_details JSONB,
  m360_ration_card_details JSONB,

  -- Financial data
  m360_bank_accounts JSONB,                -- [{account_masked, ifsc, bank_name}]
  m360_employment_details JSONB,           -- UAN, EPFO, establishment

  -- Addresses
  m360_addresses JSONB,                    -- [{address, city, state, pincode, type}]

  -- Intelligence scores
  m360_credit_score INTEGER,
  m360_mobile_intelligence JSONB,          -- {valid, subscriber_status, connection_type, provider}
  m360_risk_intelligence JSONB,            -- {safe, risk_level, reason, description}

  -- Raw response for audit
  raw_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_identity_verifications_user ON identity_verifications(user_id);
CREATE INDEX idx_identity_verifications_verification ON identity_verifications(verification_id);
```

**Mobile 360 data points stored:**
- Personal: name, gender, DOB, age, occupation, income, relatives
- Contact: phone numbers, emails
- Documents: PAN, Aadhaar (masked), Passport, DL, Voter ID, Ration Card
- Financial: bank accounts, employment/EPFO details
- Addresses: multiple addresses with type
- Scores: credit score, mobile intelligence, risk assessment

---

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL, -- PAYMENT_INITIATED, BANK_VERIFIED, etc.
  entity_type TEXT, -- payment, tenancy, bank_account
  entity_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## External API Integration

### PayU India (Payments) - Seamless Integration

**Integration Method:** Seamless (Custom UI) - not hosted checkout

**Why Seamless:**
- 100% custom SwiftUI payment screens
- Native UPI Intent (opens GPay/PhonePe directly)
- Zero PCI scope (PayU tokenization for cards)
- Premium user experience for high-value rent payments

**Payment Methods & Implementation:**

| Method | Custom UI | Implementation |
|--------|-----------|----------------|
| UPI Intent | Full control | Intent URL → opens UPI app directly |
| UPI Collect | Full control | User enters VPA → collect request |
| Cards | Full control | PayU Secure Fields → tokenization |
| Net Banking | Bank selection | SFSafariViewController redirect |
| Wallets | Selection | Redirect flow |

**Payment Flow:**
```
iOS App                     Edge Functions                 PayU
   │                              │                          │
   │──── initiate-payment ───────▶│                          │
   │     {tenancy_id, amount,     │                          │
   │      method, idempotency_key}│                          │
   │                              │──── Generate Hash ──────▶│
   │                              │◀─── Payment Params ──────│
   │◀─── {hash, txn_id, key,     │                          │
   │      intent_url/redirect}    │                          │
   │                              │                          │
   │════ UPI Intent / Card Token / Bank Redirect ════════════│
   │                              │                          │
   │                              │◀─── Webhook (S2S) ───────│
   │                              │     {status, txn_id}     │
   │                              │                          │
   │◀─── Realtime Update ─────────│                          │
   │     (Supabase Realtime)      │                          │
```

**UPI Intent Implementation (iOS):**
```swift
// Custom SwiftUI screen with UPI app icons
// User taps GPay

// 1. Initiate payment via Edge Function
let response = await supabase.functions.invoke("initiate-payment", body: [
    "tenancy_id": tenancyId,
    "method": "upi_intent",
    "upi_app": "gpay"
])

// 2. Open UPI app directly
if let intentUrl = URL(string: response.data.intentUrl) {
    await UIApplication.shared.open(intentUrl)
}

// 3. Listen for payment confirmation via Realtime
supabase.channel("payments")
    .on("postgres_changes", filter: "id=eq.\(paymentId)") { payload in
        // Update UI based on payment status
    }
```

**Card Tokenization (Zero PCI Scope):**
```swift
// Custom card entry form
// Card data → PayU SDK → Token (never touches your server)

let cardToken = await PayUTokenizer.tokenize(
    cardNumber: cardField.text,
    expiry: expiryField.text,
    cvv: cvvField.text
)

// Send only token to Edge Function
let response = await supabase.functions.invoke("initiate-payment", body: [
    "tenancy_id": tenancyId,
    "method": "card",
    "card_token": cardToken
])
```

**Edge Functions:**
- `initiate-payment` - Generate hash, create payment record, return intent/redirect URL
- `payment-webhook` - PayU S2S callback, update payment status, trigger notifications

### Cashfree (Verification)
- **Penny Drop:** Verify bank account ownership
- **Mobile 360:** Verify phone number ownership

### API Club - Electricity Bill Verification
- **Purpose:** Verify address via electricity bill (works across India, not just BESCOM)
- **Endpoint:** Edge Function `verify-utility`
- **API:** `POST https://api.apiclub.in/api/v1/fetch_bill`
- **Auth:** `x-api-key` header
- **Params:** `consumer_no`, `operator` (from operator list API)
- **Operators:** Fetch from `GET https://api.apiclub.in/api/v1/fetch_bill_operator`
- **Docs:** https://apiclub.readme.io/reference/electricity-bill-fetch

### Twilio (All Communications)
- **Twilio Verify:** Phone OTP (existing)
- **Twilio WhatsApp:** Payment reminders, receipts
- **Twilio SMS:** Critical alerts, fallback notifications
- **Benefit:** Single vendor for all communications

---

## Observability & Analytics

> **Note:** Detailed implementation of Sentry and PostHog will be planned during implementation phase after core app functionality is complete. The sections below outline the high-level approach and event taxonomy.

### Sentry (Error Tracking)
- **Purpose:** Track and alert on Edge Function errors
- **Integration:** `@sentry/deno` in Edge Functions
- **Captures:**
  - Unhandled exceptions
  - Payment failures
  - Third-party API errors (PayU, Cashfree, etc.)
  - Document extraction failures
- **Alerts:** Slack/email notifications for critical errors

```typescript
// _shared/sentry.ts
import * as Sentry from "npm:@sentry/deno";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  environment: Deno.env.get("ENVIRONMENT") || "production",
  tracesSampleRate: 0.1, // 10% of transactions
});

export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

// Usage in Edge Functions
try {
  await processPayment(data);
} catch (error) {
  captureError(error, { user_id, payment_id, amount });
  throw error;
}
```

### PostHog (Product Analytics)
- **Purpose:** Track user behavior, funnels, feature usage
- **Integration:** PostHog iOS SDK + Server-side API (Edge Functions)
- **Events to track:**

**Onboarding & Verification Events:**
| Event | Properties | Purpose |
|-------|------------|---------|
| `onboarding_started` | user_id | Funnel start |
| `document_uploaded` | user_id, file_type, size_bytes | Upload tracking |
| `extraction_completed` | user_id, fields_extracted, confidence | AI quality |
| `bank_verified` | user_id, bank_name, verification_time_ms | Verification funnel |
| `identity_verified` | user_id, credit_score, risk_level | M360 completion |
| `utility_verified` | user_id, operator, state | Address verification |
| `landlord_approved` | tenancy_id, approval_time_hours | Approval rate |

**Payment Events (Comprehensive):**
| Event | Properties | Purpose |
|-------|------------|---------|
| `payment_screen_viewed` | user_id, tenancy_id, amount_paise | Funnel entry |
| `payment_method_selected` | user_id, method (upi/card/netbanking) | Method preference |
| `payment_upi_app_selected` | user_id, app (gpay/phonepe/paytm/other) | UPI app analytics |
| `payment_initiated` | user_id, txn_id, amount_paise, method | SDK/intent launched |
| `payment_processing` | user_id, txn_id | Awaiting confirmation |
| `payment_success` | user_id, txn_id, amount_paise, method, latency_ms | Revenue tracking |
| `payment_failed` | user_id, txn_id, error_code, error_message, method | Failure analysis |
| `payment_cancelled` | user_id, txn_id, cancellation_stage | Drop-off analysis |
| `payment_retry_attempted` | user_id, original_txn_id, retry_count | Retry behavior |
| `refund_initiated` | user_id, txn_id, amount_paise, reason | Refund tracking |
| `refund_completed` | user_id, txn_id, amount_paise, refund_time_hours | Refund success |

**Engagement Events:**
| Event | Properties | Purpose |
|-------|------------|---------|
| `cashback_earned` | user_id, amount_paise, source | Engagement |
| `cashback_redeemed` | user_id, amount_paise, payment_id | Redemption tracking |
| `dashboard_viewed` | user_id, days_until_due | App engagement |
| `notification_received` | user_id, type (reminder/receipt/alert) | Notification effectiveness |

```typescript
// _shared/posthog.ts
const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY");
const POSTHOG_HOST = "https://app.posthog.com";

export async function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, any>
) {
  await fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_API_KEY,
      event,
      distinct_id: distinctId,
      properties: {
        ...properties,
        $lib: "supabase-edge-function",
      },
    }),
  });
}

// Usage
await trackEvent(user_id, "payment_success", {
  amount_paise: 5000000,
  method: "upi",
  tenancy_id,
});
```

### iOS Integration (PostHog)
```swift
// AppDelegate or dedicated Analytics service
import PostHog

PostHogSDK.shared.setup(PostHogConfig(apiKey: "phc_xxx"))

// Track events
PostHogSDK.shared.capture("document_uploaded", properties: [
  "file_type": "pdf",
  "size_bytes": fileSize
])
```

---

## Scheduled Jobs (pg_cron)

```sql
-- Payment reminders (daily at 9 AM IST)
SELECT cron.schedule('payment-reminders', '30 3 * * *', $$
  SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/send-payment-reminders',
    headers := '{"Authorization": "Bearer <service_key>"}'::jsonb
  );
$$);

-- Cleanup expired idempotency keys (daily at 2 AM IST)
SELECT cron.schedule('cleanup-idempotency', '30 20 * * *', $$
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
$$);

-- Retry failed settlements (every 6 hours)
SELECT cron.schedule('retry-settlements', '0 */6 * * *', $$
  SELECT net.http_post(
    url := 'https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/retry-settlements',
    headers := '{"Authorization": "Bearer <service_key>"}'::jsonb
  );
$$);
```

---

## Edge Functions Structure

```
supabase/functions/
├── _shared/
│   ├── supabase.ts          # Supabase client setup
│   ├── audit.ts             # Audit logging helper
│   ├── idempotency.ts       # Idempotency key helper
│   └── notifications.ts     # Push/WhatsApp/SMS helpers
│
├── process-document/        # Existing - Document AI + Gemini
├── upload-document/         # Existing - Storage upload
├── confirm-extraction/      # Existing - User confirmation
├── get-waitlist-status/     # Existing - Polling
├── geocode-address/         # Existing - Google Maps
├── send-push-notification/  # Existing - APNs
├── delete-account/          # Existing - GDPR
├── update-profile/          # Existing - Profile
│
├── initiate-payment/        # NEW - PayU payment
├── payment-webhook/         # NEW - PayU callback
├── verify-bank/             # NEW - Cashfree Penny Drop
├── verify-identity/         # NEW - Cashfree M360
├── verify-utility/          # NEW - API Club Elec Bill
├── landlord-approve/        # NEW - Landlord flow
├── calculate-cashback/      # NEW - Cashback logic
├── dashboard-data/          # NEW - Home aggregation
├── send-whatsapp/           # NEW - Twilio WhatsApp
├── send-sms/                # NEW - Twilio SMS
├── send-payment-reminders/  # NEW - Cron job handler
└── retry-settlements/       # NEW - Cron job handler
```

---

## Implementation Phases

### Phase 1: Database & Core APIs
- [ ] Create new tables (tenancies, payments, bank_accounts, audit_logs)
- [ ] Set up RLS policies for new tables
- [ ] Create audit logging triggers
- [ ] Implement idempotency table and cleanup cron

### Phase 2: Verification Flow
- [ ] `verify-bank` - Cashfree Penny Drop integration
- [ ] `verify-identity` - Cashfree Mobile 360 integration
- [ ] `verify-utility` - API Club Electricity Bill integration
- [ ] `landlord-approve` - Landlord approval flow

### Phase 3: Payment Flow
- [ ] `initiate-payment` - PayU payment initiation
- [ ] `payment-webhook` - PayU callback handler
- [ ] `calculate-cashback` - Cashback calculation
- [ ] Payment status realtime subscription

### Phase 4: Notifications
- [ ] `send-whatsapp` - Twilio WhatsApp integration
- [ ] `send-sms` - Twilio SMS integration
- [ ] `send-payment-reminders` - Cron job
- [ ] Receipt generation and delivery

### Phase 5: Dashboard & Polish
- [ ] `dashboard-data` - Home screen aggregation
- [ ] Transaction history endpoints
- [ ] Landlord portal endpoints
- [ ] Error handling and monitoring

---

## Verification Checklist

- [ ] All Edge Functions deploy successfully
- [ ] Document extraction works (existing)
- [ ] Payment flow end-to-end test
- [ ] Bank verification via Penny Drop
- [ ] WhatsApp notification delivery
- [ ] Realtime payment status updates
- [ ] Audit logs capture all actions
- [ ] Idempotency prevents double payments
- [ ] pg_cron jobs execute on schedule
