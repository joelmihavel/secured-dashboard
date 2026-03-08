# Flent Secured v2 -- Edge Functions Reference

> **Last updated:** 2026-03-08
> **Runtime:** Deno (Supabase Edge Functions)
> **Base URL:** `https://devapi.flent.in/functions/v1/` (via Cloudflare Worker proxy)
> **Direct URL:** `https://zqlowjveyqiagnbmfwsb.supabase.co/functions/v1/`

---

## Table of Contents

1. [Quick Reference Table](#quick-reference-table)
2. [Authentication Patterns](#authentication-patterns)
3. [Shared Modules](#shared-modules)
4. [Category 1: Authentication](#1-authentication)
5. [Category 2: Agreement and Extraction](#2-agreement-and-extraction)
6. [Category 3: Waitlist](#3-waitlist)
7. [Category 4: Setup and Verification](#4-setup-and-verification)
8. [Category 5: Payment](#5-payment)
9. [Category 6: Payment Methods](#6-payment-methods)
10. [Category 7: Cashback and Savings](#7-cashback-and-savings)
11. [Category 8: Refunds](#8-refunds)
12. [Category 9: Settlement](#9-settlement)
13. [Category 10: Notifications](#10-notifications)
14. [Category 11: Profile](#11-profile)
15. [Category 12: Referrals](#12-referrals)
16. [Category 13: Admin and Debug](#13-admin-and-debug)

---

## Quick Reference Table

| # | Function | Method | Auth | Description |
|---|----------|--------|------|-------------|
| 1 | `auth-otp` | POST | None | Hybrid OTP router (Supabase Auth + Cashfree M360) |
| 2 | `upload-document` | POST | JWT | Generate signed upload URL for rent agreement PDF |
| 3 | `process-document` | POST | JWT | OCR + Gemini extraction of rent agreements |
| 4 | `confirm-extraction` | POST | JWT | User confirms extracted data, creates tenancy |
| 5 | `update-extraction` | POST | JWT | Pre-confirmation modifications to extracted data |
| 6 | `reprocess-extractions` | POST | Service Role | Admin batch reprocessing of failed extractions |
| 7 | `extraction-recovery` | POST/GET | Service Role | Cron (30-min) recovery for users stuck in extraction/confirmation |
| 8 | `agreement-lifecycle` | GET/POST | JWT or Service Role | State machine for agreement transitions |
| 9 | `join-waitlist` | POST | JWT | Idempotent waitlist entry + risk scoring |
| 10 | `get-waitlist-status` | GET | JWT | Waitlist status + extraction progress |
| 11 | `admin-waitlist` | POST | Admin Key | Admin approve/reject/set_in_progress |
| 12 | `claim-invite-code` | POST | JWT | Validate and claim 4-char invite codes |
| 13 | `verify-bank` | POST | JWT | Cashfree Penny Drop bank verification |
| 14 | `verify-pan` | POST | JWT | Cashfree PAN verification + name matching |
| 15 | `verify-utility` | POST/GET | JWT | API Club electricity bill + Gemini verification |
| 16 | `verify-identity` | POST | JWT | Cashfree M360 identity verification |
| 17 | `verify-card` | POST | JWT | Rs.1 PayU session for card tokenization |
| 18 | `send-landlord-invite` | POST | JWT | Email/token landlord invite |
| 19 | `invite-landlord-whatsapp` | POST | JWT | WhatsApp landlord invite via Twilio |
| 20 | `manage-landlord` | GET/POST/PUT | JWT | CRUD for landlord info on tenancy |
| 21 | `landlord-auth-otp` | POST | None | OTP auth for landlord portal via Cashfree M360 |
| 22 | `landlord-confirm` | GET/POST | Landlord JWT | Landlord approval/dispute of tenancy |
| 23 | `notify-landlord` | POST | JWT or Service Role | Multi-channel landlord notification pipeline |
| 24 | `initiate-payment` | POST | JWT | Create PayU payment session with hash |
| 25 | `payment-webhook` | POST | None (Hash) | PayU S2S callback, hash-verified |
| 26 | `check-payment-status` | GET | JWT | Poll payment status, verify with PayU if stale |
| 27 | `get-payment-history` | GET | JWT | Paginated payment history |
| 28 | `get-payment-schedule` | GET | JWT | Payment schedules for tenancies |
| 29 | `get-payment-stamps` | GET/POST | JWT | Month-by-month payment stamp grid |
| 30 | `generate-receipt` | GET | JWT | Receipt data with tax breakdown |
| 31 | `generate-payu-hash` | POST | JWT | Server-side PayU hash generation |
| 32 | `get-netbanking-banks` | GET | None | Active netbanking banks list |
| 33 | `get-bin-info` | POST | JWT | Card BIN lookup via PayU |
| 34 | `get-fee-config` | GET | JWT | Dynamic PG fee rates |
| 35 | `cleanup-stale-payments` | POST | Service Role | Reconcile stuck payments via PayU verify |
| 36 | `schedule-payment` | POST | JWT | Create/manage recurring payment schedules |
| 37 | `get-saved-payment-methods` | GET | JWT | Retrieve saved payment methods (masked) |
| 38 | `set-default-payment-method` | POST | JWT | Set a payment method as default |
| 39 | `add-upi-vpa` | POST | JWT | Validate and save UPI VPA |
| 40 | `add-card-token` | POST | JWT | Save encrypted card token from PayU |
| 41 | `delete-payment-method` | POST | JWT | Soft/hard delete a payment method |
| 42 | `get-payu-stored-cards` | GET | JWT | Fetch stored card tokens from PayU vault |
| 43 | `save-bank-preference` | POST | JWT | Upsert netbanking bank preference |
| 44 | `calculate-cashback` | GET | JWT | Savings summary (instant 1% discount model) |
| 45 | `get-cashback-history` | GET | JWT | Paginated cashback ledger entries |
| 46 | `initiate-refund` | POST | JWT | PayU refund + cashback reversal |
| 47 | `get-refund-status` | GET | JWT | Refund status by refund_id or payment_id |
| 48 | `settle-to-landlord` | POST | Service Role | Process landlord payouts (cron/admin) |
| 49 | `confirm-payout` | POST | Service Role | Confirm manual landlord payout with UTR |
| 50 | `poll-settlement-status` | POST | Service Role | 3-tier settlement tracking cron |
| 51 | `send-whatsapp` | POST | Service Role | Send WhatsApp via Twilio |
| 52 | `send-sms` | POST | Service Role | Send SMS via Twilio |
| 53 | `send-push-notification` | POST | Service Role | Push via Expo Push API |
| 54 | `notify-user` | POST | Service Role | High-level notification orchestrator |
| 55 | `mark-notification-read` | POST | JWT | Mark notifications as read |
| 56 | `register-device-token` | POST | JWT | Register/update push token |
| 57 | `broadcast-app-update` | POST | Service Role | Broadcast app update to all users |
| 58 | `update-profile` | POST | JWT | Update user profile fields |
| 59 | `upload-avatar` | POST | JWT | Generate presigned avatar upload URL |
| 60 | `pixelate-avatar` | POST | JWT | Pixelate photo with orange tint |
| 61 | `assign-default-avatar` | POST | JWT | Assign random default pixel art avatar |
| 62 | `delete-account` | POST | JWT | Full account deletion + archive |
| 63 | `get-my-referral-code` | GET | JWT | Get or generate user referral code |
| 64 | `apply-referral-code` | POST | JWT | Apply referral code with rewards |
| 65 | `validate-referral-code` | GET/POST | JWT | Validate referral code without applying |
| 66 | `dashboard-data` | GET | JWT | Aggregated home screen dashboard data |
| 67 | `admin-encrypt` | POST | Service Role | AES-256-GCM encryption utility for admin operations |
| 68 | `admin-fetch-views` | GET | Service Role | Aggregated admin dashboard data from database views |
| 69 | `admin-payment-data` | GET | Service Role | Payment reporting with decrypted landlord bank details |
| 70 | `debug-payment` | POST | None | Inspect payment data (TEMPORARY -- delete after investigation) |
| 71 | `payu-hash-test` | GET/POST | None | PayU credential + hash diagnostic |
| 72 | `payu-post-inspector` | POST | None | Capture SDK POST data for debugging |
| 73 | `dev-seed` | POST | Anon Key | Client-side jump-to-screen seeding |
| 74 | `seed-test-data` | POST | Service Role | Seed test user to specific state |
| 75 | `pre-approval-audit` | POST | Admin Key | Pre-approval risk and data-integrity audit |
| 76 | `twilio-debug` | POST | None | Inspect Twilio message statuses (TEMPORARY -- delete after investigation) |
| 77 | `test-gemini-extraction` | POST | None | Diagnostic Gemini extraction test |
| 78 | `sync-netbanking-banks` | POST | Service Role | Sync bank list from PayU |

---

## Authentication Patterns

The codebase uses three authentication patterns:

**1. User JWT (most endpoints)**
```
Authorization: Bearer <user_jwt_token>
apikey: <supabase_anon_key>
```
Validated via `createAuthenticatedClient()`. Returns `{ userId }`.

**2. Service Role (admin/internal endpoints)**
```
Authorization: Bearer <supabase_service_role_key>
```
Validated via `verifyServiceRole()`. Exact string comparison -- no JWT decoding.

**3. Admin Key (body-based)**
```json
{ "admin_key": "<ADMIN_API_KEY env var>" }
```
Used by `admin-waitlist` and `pre-approval-audit`. Compared against `ADMIN_API_KEY` environment variable. Some admin endpoints (like `admin-encrypt`, `admin-fetch-views`) accept either service role or admin key.

**4. No Auth (public or hash-verified)**
Some endpoints like `auth-otp`, `landlord-auth-otp`, `get-netbanking-banks`, and `payment-webhook` accept unauthenticated requests. The webhook uses HMAC-SHA512 hash verification instead. Temporary debug functions (`debug-payment`, `twilio-debug`) also accept unauthenticated requests.

---

## Shared Modules

All shared code resides in `supabase/functions/_shared/`. These modules are imported by multiple edge functions.

### `supabase.ts` -- Database Clients and Auth
- `createServiceClient()` -- Admin client with `SUPABASE_SERVICE_ROLE_KEY`
- `createUserClient(authHeader)` -- Client scoped to user's JWT
- `createAuthenticatedClient(authHeader)` -- Validates JWT, returns `{ client, userId, user }`
- `getUserIdFromAuth(authHeader)` -- Extracts user ID from JWT, returns null on failure
- `verifyServiceRole(authHeader)` -- Asserts the Bearer token equals the service role key (throws `AuthError`)
- `hasServiceRoleAuth(authHeader)` -- Boolean check variant (non-throwing)
- `getSupabaseUrl()` -- Returns `SUPABASE_URL` env var
- `isProduction()` -- Checks `ENVIRONMENT` or `DENO_ENV` for `"production"`
- `isDevelopment()` -- Checks if URL contains localhost/127.0.0.1

Service role verification uses direct token comparison (supports both legacy JWT keys and new `sb_secret_*` keys). No unsigned JWT fallback -- prevents forged admin access.

### `cors.ts` -- CORS and Response Helpers
- `handleCors(req)` -- Returns preflight response for OPTIONS, null otherwise
- `getCorsHeaders(req)` -- Origin allowlisting (production vs development)
- `jsonResponse(data, status?, headers?)` -- JSON response with CORS headers
- `errorResponse(message, status, code?)` -- Error response with CORS headers
- `successResponse(data)` -- Shorthand for success JSON

### `errors.ts` -- Typed Error System
- `AppError` -- Base error with `code`, `statusCode`, `details`
- `AuthError` -- 401 authentication errors
- `ValidationError` -- 400 with field-level error details
- `NotFoundError` -- 404 with entity type and ID
- `RateLimitError` -- 429 with retry-after
- `ExternalServiceError` -- 502 for third-party failures (Cashfree, PayU, Twilio, etc.)
- `IdempotencyError` -- 409 for duplicate operations
- `PaymentError` -- Payment-specific errors with gateway context
- `handleError(error, requestId?)` -- Converts any error to appropriate HTTP response
- `withErrorHandling(handler)` -- Wrapper for async handlers

### `crypto.ts` -- Cryptographic Operations
- `encrypt(plaintext)` / `decrypt(ciphertext)` -- AES-256-GCM with `ENCRYPTION_KEY` env var
- `sha256(input)` / `sha512(input)` -- Hash functions
- `hmacSha256(key, data)` / `hmacSha512(key, data)` -- HMAC functions
- `hmacSha256Base64(key, data)` -- Base64 HMAC (used by Cashfree)
- `generatePayUHash(params)` -- PayU payment hash: `sha512(key|txnid|amount|productinfo|firstname|email|udf1-5||||||salt)`
- `verifyPayUWebhookHash(params)` -- Reverse hash for webhook verification
- `verifyPayUWebhookHashWithCharges(params)` -- Webhook hash with additional charges
- `generateSDKHash(params)` -- Hash for PayU SDK commands (get_user_cards, etc.)
- `timingSafeCompare(a, b)` -- Constant-time string comparison
- `generateTransactionId()` -- Unique transaction ID generator

### `validation.ts` -- Input Validation
Schema validation with field-level errors. Includes phone, bank, and identity validation utilities.
- `validateSchema(body, schema, throwOnError?)` -- Generic schema validator with field-level error details
- Validators: `isValidIndianPhone`, `isValidPhone`, `isValidE164Phone`, `isValidIfsc`, `isValidPan`, `isValidUuid`, `isValidEmail`, `isValidAmountPaise`, `isValidDate`, `isValidRentDueDay`
- Sanitizers: `sanitizePhone`, `formatPhoneWithCountryCode`, `sanitizeIfsc`
- Maskers: `maskAccountNumber`, `maskAadhaar`, `maskPan`

### `audit.ts` -- Audit Logging
Comprehensive audit logging with auto-capture of IP, User-Agent, and requestId.
- `AuditLogger` class with `fromRequest()` factory
- `log(entry)` -- Full audit entry (writes to `audit_logs` table)
- `logSuccess(action, category, entityType, entityId, details)` -- Success shorthand
- `logFailure(action, category, code, message, entityType, entityId?, details?)` -- Failure shorthand
- `AuditActions` -- Constants for standard audit action names

### `notifications.ts` -- Multi-Channel Notification Interface
Unified notification module supporting four delivery channels:
- `sendWhatsApp(message)` -- Twilio WhatsApp (supports both template-based and direct body messages)
- `sendSms(params)` -- Twilio SMS
- `sendEmail(message)` -- Resend API (HTML + plain text, supports cc/bcc)
- `sendPushNotification(params)` -- Expo Push API wrapper (APNs/FCM routing)
- `notifyUser(supabaseUrl, serviceKey, params)` -- High-level orchestrator that calls the `notify-user` edge function, respecting user preferences
- `queueNotification(params)` -- Async queue via `notification_queue` table for deferred delivery
- `MessageTemplates` -- Template strings for notifications

### `notification-templates.ts` -- Template Registry
- 13 notification types with title/body templates
- `NOTIFICATION_ROUTES` -- Deep link routes per notification type
- `PREFERENCE_MAP` -- Maps notification types to user preference columns
- `DB_TYPE_MAP` -- Maps notification types to database enum values
- `interpolateTemplate(template, vars)` -- Variable substitution in templates

### `gemini.ts` -- Gemini AI Integration
- `matchNamesWithGemini(name1, name2)` -- Two-name comparison
- `matchNameAgainstCandidates(inputName, candidates)` -- Single Gemini call for 1 verified name vs N candidates. Supports joint account patterns (e.g., "RAMESH AND SEEMA SHARMA"). Returns best match with score.
- `matchConsumerNameWithPropertyGemini(consumerName, propertyName)` -- Utility bill consumer vs property name
- `verifyUtilityBillWithGemini(billData, tenancyData)` -- Single call replacing 3 sequential calls for consumer name + building name + address matching. Comprehensive utility verification in one prompt.
- `matchAddressesWithGemini(address1, address2)` -- Address comparison
- `verifyUtilityWithGemini(params)` -- Utility bill data verification
- All functions include Levenshtein distance fallbacks when Gemini is unavailable

### `payu-config.ts` -- PayU Configuration
- `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_BASE_URL`, `PAYU_INFO_URL`
- `IS_SANDBOX` -- Boolean based on key pattern
- `fetchWithTimeout(url, options, timeoutMs?)` -- Fetch with configurable timeout (default 30s)
- `requirePayUCredentials()` -- Throws if PayU env vars are missing

### `idempotency.ts` -- Idempotency Management
- `IdempotencyManager` class
- `check(key)` -- Acquires DB-backed lock, returns existing result if already completed
- `complete(key, result)` -- Marks operation as completed with result
- `fail(key, error)` -- Marks operation as failed
- Stale lock reclamation after 60 seconds

### `rate-limit.ts` -- Rate Limiting
- `checkRateLimit(supabase, userId, config)` -- Checks audit_logs for recent actions within window
- `recordAction(supabase, userId, action)` -- Records action for rate limiting

### `risk-utils.ts` -- Risk Scoring
Multi-signal risk scoring used by `join-waitlist` and `extraction-recovery`.
- `computeRisk(userId, supabase)` -- 5 weighted signals:
  - `tenant_name_match` (weight: 5) -- Agreement name vs auth name
  - `m360_risk_intel` (weight: 4) -- Cashfree M360 risk data
  - `m360_data_available` (weight: 3) -- M360 data completeness
  - `credit_score` (weight: 3) -- Credit score from M360
  - `agreement_confidence` (weight: 2) -- Gemini extraction confidence
- Returns `risk_level` (LOW, MED, HIGH, or PENDING) and `risk_factors` array

### `name-utils.ts` -- Name Parsing
- `extractFirstName(fullName)` -- Handles Indian conventions (titles like Mr/Mrs, S/O, D/O, initials, ALL CAPS)

### `name-match-service.ts` -- Name Matching
Deduped name matching logic shared by `verify-bank`, `verify-utility`, and `verify-pan`. Replaces duplicate name comparison blocks that previously existed in each function.
- `resolveAgreementNames(extraction)` -- Extracts tenant and landlord name lists from extraction data
- `matchAgainstAgreementNames(inputName, agreementNames)` -- Multi-candidate Gemini-based name matching
- `calculateNameMatchScore(name1, name2)` -- Deterministic score (Levenshtein-based)
- `matchUtilityConsumerAgainstProperty(consumerName, propertyAddress)` -- Consumer name vs property

### `gateway-router.ts` -- Payment Gateway
- Always returns `"payu"` (simplified; single gateway architecture)

### `avatar-utils.ts` -- Avatar Processing
- `validateImageFile(bytes, maxSize)` -- Magic byte + size validation
- `parseImageDimensions(bytes, format)` -- Extract width/height from PNG/JPEG headers
- `validateDimensions(w, h, max)` -- Max dimension check
- `validateDecompressionRatio(fileSize, w, h)` -- Prevents decompression bombs
- `cleanupOldAvatars(supabase, userId, keepPaths)` -- Remove old avatar files
- `getAvatarPublicUrl(supabase, path)` -- Public URL for avatar
- `getDefaultAvatarUrl(supabase, number)` -- Default pixel art avatar URL

### `transfer-flags.ts` -- Transfer Hold System
Two-layer payout control:
- `getSystemTransferFlag(supabase)` -- Global on/off switch for all landlord transfers
- `isSystemTransferEnabled(supabase)` -- Boolean shorthand
- `checkTransferEligibility(supabase, paymentId, systemConfig)` -- Per-payment eligibility (system flag + individual hold)

### `demo-helpers.ts` -- Test User Detection
- `isTestUser(userId, supabase)` -- Checks `is_test_user` flag in users table

### `seed-helpers.ts` -- Test Data Seeding
- `seedTestUser(phone, sanitizedPhone, targetState, options, supabase)` -- Orchestrator
- Entity helpers for all states: signed_up, extraction_confirmed, waitlisted, approved, active
- `TEST_PHONE_REGEX` -- `+91999990XXXX` pattern
- `VALID_STATES` -- Allowed target states

### `m360-identity-processor.ts` -- M360 Identity Processing
Unified M360 data processing shared by `landlord-auth-otp` and `verify-identity`.
- `buildVerificationData(m360Result)` -- Masks sensitive fields (PAN, Aadhaar, bank accounts) before storage
- `processM360IdentityResult(userId, result, supabase)` -- Updates user profile + risk scores
- `markM360Pending(userId, supabase)` -- Sets identity verification to pending
- `markM360Failed(userId, error, supabase)` -- Records failure

### `cashfree-m360-otp.ts` -- Cashfree Mobile 360
Cashfree M360 OTP and Penny Drop API wrapper.
- `callCashfreeSendOtp(phone, referenceId)` -- Initiate M360 OTP
- `callCashfreeVerifyOtp(phone, otp, referenceId)` -- Verify OTP and retrieve identity data
- `callCashfreePennyDrop(accountNumber, ifsc)` -- Bank account verification via Rs.1 deposit
- `generateCfSignature(body)` -- RSA-OAEP signature for Cashfree API auth
- Full `Mobile360IdentityData` type definition

---

## 1. Authentication

### `auth-otp`

Hybrid authentication router that supports both Supabase Auth OTP and Cashfree Mobile 360 OTP.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/auth-otp` |
| **Auth** | None |
| **Tables** | `users`, `otp_requests`, `identity_verifications` |
| **External** | Cashfree M360, Supabase GoTrue |

**Actions (via `action` field in body):**

- `route_otp` -- Sends OTP to phone number. Routes to M360 for identity verification or Supabase Auth for returning users.
- `verify_otp` -- Verifies OTP code. For M360: retrieves identity data, creates/updates user profile with risk scoring. For Supabase Auth: standard session creation.
- `resend_otp` -- Resends OTP with cooldown enforcement.
- `health` -- Health check returning service status.

**Request (route_otp):**
```json
{
  "action": "route_otp",
  "phone": "+919876543210"
}
```

**Response (route_otp):**
```json
{
  "success": true,
  "data": {
    "otp_sent": true,
    "provider": "cashfree_m360",
    "reference_id": "ref_xxx",
    "is_new_user": true
  }
}
```

**Request (verify_otp):**
```json
{
  "action": "verify_otp",
  "phone": "+919876543210",
  "otp": "123456",
  "reference_id": "ref_xxx"
}
```

**Response (verify_otp):**
```json
{
  "success": true,
  "data": {
    "session": { "access_token": "...", "refresh_token": "..." },
    "user": { "id": "...", "phone": "+919876543210" },
    "is_new_user": true
  }
}
```

**Notes:**
- Demo/test users (matching `+91999990XXXX`) bypass real OTP when `ALLOW_DEMO_AUTH=true`.
- Rate limited: 5 OTP requests per phone per 10 minutes.
- M360 identity data (PAN, Aadhaar, credit score) is masked before storage.

---

## 2. Agreement and Extraction

### `upload-document`

Generates a signed upload URL for rent agreement PDFs to Supabase Storage.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/upload-document` |
| **Auth** | JWT |
| **Tables** | `extracted_rental_info`, `waitlist_entries`, `users` |
| **External** | Supabase Storage |

**Request:**
```json
{
  "content_type": "application/pdf"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "upload_url": "https://...",
    "extraction_id": "uuid",
    "storage_path": "user_id/timestamp.pdf"
  }
}
```

### `process-document`

Processes uploaded rent agreements through GCP Document AI (OCR) followed by Gemini AI extraction to identify tenancy details.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/process-document` |
| **Auth** | JWT |
| **Tables** | `extracted_rental_info`, `rental_parties`, `waitlist_entries`, `supported_cities` |
| **External** | GCP Document AI, Gemini/Vertex AI |

**Request:**
```json
{
  "extraction_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extraction_id": "uuid",
    "status": "completed",
    "property_address": "...",
    "monthly_rent_paise": 2500000,
    "tenant_names": ["John Doe"],
    "landlord_names": ["Jane Smith"],
    "lease_start_date": "2026-01-01",
    "lease_end_date": "2027-01-01",
    "extraction_confidence": 0.92,
    "is_rental_agreement": true
  }
}
```

**Notes:**
- Supports both Vertex AI (global endpoint with provisioned throughput) and Gemini API key as fallback.
- Validates document is actually a rental agreement before extracting.
- City support check against `supported_cities` table.

### `confirm-extraction`

User confirms extracted rental data. Creates a tenancy record and advances user status. Performs a single Gemini AI call to match the tenant's authenticated name against ALL names from the agreement (tenant and landlord name lists), rather than comparing just first names. Updates `users.tenant_match_score` and `users.tenant_match_type` with the result.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/confirm-extraction` |
| **Auth** | JWT |
| **Tables** | `extracted_rental_info`, `tenancies`, `users`, `waitlist_entries` |
| **External** | Gemini (`matchNameAgainstCandidates`) |

**Request:**
```json
{
  "extraction_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tenancy_id": "uuid",
    "status": "pending_verification"
  }
}
```

### `update-extraction`

Allows pre-confirmation modifications to extracted rental data (user corrections).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/update-extraction` |
| **Auth** | JWT |
| **Tables** | `extracted_rental_info` |

**Request:**
```json
{
  "extraction_id": "uuid",
  "updates": {
    "monthly_rent_paise": 3000000,
    "rent_due_day": 5
  }
}
```

### `reprocess-extractions`

Admin-only batch reprocessing of failed or incomplete extractions.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/reprocess-extractions` |
| **Auth** | Service Role |
| **Tables** | `extracted_rental_info`, `rental_parties`, `waitlist_entries`, `supported_cities` |
| **External** | Vertex AI/Gemini |

### `extraction-recovery`

Cron job (30-minute intervals) that catches users stuck in extraction/confirmation states. Finds users with completed extractions who have not reached the waitlist, auto-confirms extraction, creates tenancy + waitlist entry, computes risk score, and sets `user_status` to `waitlisted`. Requires a minimum 30-minute age to avoid racing the normal user flow. Supports `?dry_run=true` for preview without mutations.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/extraction-recovery` |
| **Auth** | Service Role (via cron) |
| **Tables** | `users`, `extracted_rental_info`, `tenancies`, `waitlist_entries` |

**Cases handled:**
1. Extraction completed but not confirmed -- auto-confirms + creates tenancy + waitlist entry
2. Extraction confirmed but no tenancy -- creates tenancy + waitlist entry
3. Tenancy exists but no waitlist entry -- creates waitlist entry
4. All above -- advances `user_status` to `waitlisted`

**Skip conditions:**
- `contract_status` in (`manual_review`, `invalid_document`, `expired`)
- `needs_manual_review=true` (unless `contract_status=confirmed`)
- `is_city_supported=false`
- Missing critical fields (address, rent, tenant name, landlord name)
- Extraction less than 30 minutes old

**Response:**
```json
{
  "message": "Recovery complete",
  "dry_run": false,
  "summary": {
    "recovered": 3,
    "skipped": 12,
    "errors": 0
  },
  "results": {
    "recovered": [...],
    "skipped": [...],
    "errors": [...]
  }
}
```

### `agreement-lifecycle`

State machine for agreement transitions. Supports querying current state and triggering transitions.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST /functions/v1/agreement-lifecycle` |
| **Auth** | JWT or Service Role |
| **Tables** | `tenancies`, `audit_logs` |

---

## 3. Waitlist

### `join-waitlist`

Idempotently creates a waitlist entry for the authenticated user. Computes risk assessment and handles demo auto-approval.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/join-waitlist` |
| **Auth** | JWT |
| **Tables** | `waitlist_entries`, `users`, `tenancies` |

**Gate check:** User must have `user_status` of `agreement_confirmed`, `waitlisted`, `approved`, or `active`.

**Request:** Empty body (user ID from JWT).

**Response:**
```json
{
  "success": true,
  "data": {
    "entry_id": "uuid",
    "position": 42,
    "is_new": true
  }
}
```

**Notes:**
- Computes initial `risk_level` via shared `computeRisk()` from `risk-utils.ts` (5 weighted signals: tenant name match, M360 risk, M360 data, credit score, agreement confidence). Stores `risk_level` and `risk_factors` on the waitlist entry.
- Test users (`isTestUser()`) are auto-approved: waitlist entry approved, user status set to `approved`, tenancy activated.
- Advances `user_status` from `agreement_confirmed` to `waitlisted`.

### `get-waitlist-status`

Returns user's waitlist position, admin review status, and extraction progress.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-waitlist-status` |
| **Auth** | JWT |
| **Tables** | `waitlist_entries`, `extracted_rental_info`, `users` |

### `admin-waitlist`

Admin endpoint to approve, reject, or set applications as in_progress. User status is now synced via a database trigger (`sync_user_status_on_waitlist_change`) instead of manual updates in the function. On approval, tenancy is automatically activated (`pending_verification` to `active`) by a separate database trigger (`auto_activate_tenancy_on_landlord_approval`).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/admin-waitlist` |
| **Auth** | Admin Key (body-based) |
| **Tables** | `waitlist_entries`, `users` (via trigger) |

### `claim-invite-code`

Validates and claims a 4-character invite code for priority waitlist access.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/claim-invite-code` |
| **Auth** | JWT |
| **Tables** | `invite_codes`, `waitlist_entries` |

---

## 4. Setup and Verification

### `verify-bank`

Verifies landlord bank account via Cashfree Penny Drop API. Uses shared `name-match-service.ts` for Gemini-based name matching of account holder name against all agreement landlord names. Uses shared `cashfree-m360-otp.ts` for the penny drop call. Includes comprehensive audit logging via `AuditLogger`.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/verify-bank` |
| **Auth** | JWT |
| **Tables** | `bank_accounts`, `tenancies`, `extracted_rental_info`, `audit_logs` |
| **External** | Cashfree Penny Drop (via `cashfree-m360-otp.ts`), Gemini (via `name-match-service.ts`) |

### `verify-pan`

Verifies PAN card via Cashfree API and matches name against agreement parties using Gemini.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/verify-pan` |
| **Auth** | JWT |
| **Tables** | `tenancies`, `extracted_rental_info` |
| **External** | Cashfree PAN Verification, Gemini |

### `verify-utility`

Fetches electricity bill data from API Club and verifies consumer name and address against tenancy data. Refactored to use a single Gemini call (`verifyUtilityBillWithGemini`) for all name/address verification instead of 3 sequential calls. Uses shared `name-match-service.ts` for name comparison. Bank name cross-check has been removed from the utility verification flow.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST/GET /functions/v1/verify-utility` |
| **Auth** | JWT |
| **Tables** | `tenancies`, `extracted_rental_info` |
| **External** | API Club (electricity), Gemini (via `verifyUtilityBillWithGemini` -- single call) |

### `verify-identity`

Initiates Cashfree Mobile 360 identity verification for the user.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/verify-identity` |
| **Auth** | JWT |
| **Tables** | `identity_verifications`, `users`, `waitlist_entries` |
| **External** | Cashfree M360 |

### `verify-card`

Creates a Rs.1 PayU payment session for card tokenization/verification.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/verify-card` |
| **Auth** | JWT |
| **Tables** | `payments` |
| **External** | PayU |

### `send-landlord-invite`

Sends an email invitation to the landlord with a unique verification token.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/send-landlord-invite` |
| **Auth** | JWT |
| **Tables** | `tenancies`, `landlord_invites` |
| **External** | Resend (email) |

### `invite-landlord-whatsapp`

Sends a WhatsApp invitation to the landlord via Twilio.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/invite-landlord-whatsapp` |
| **Auth** | JWT |
| **Tables** | `tenancies` |
| **External** | Twilio WhatsApp |

### `manage-landlord`

CRUD operations for landlord information on a tenancy.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST/PUT /functions/v1/manage-landlord` |
| **Auth** | JWT |
| **Tables** | `tenancies`, `landlord_invites` |

### `landlord-auth-otp`

OTP authentication for the landlord web portal. Sends/verifies OTP via Cashfree M360 and returns a session token on verification. Separate from tenant auth flow (`auth-otp`). Includes M360 identity data processing via shared `m360-identity-processor.ts` (masks sensitive fields before storage). Rate-limited per phone/IP.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/landlord-auth-otp` |
| **Auth** | None (public endpoint) |
| **Tables** | `auth.users`, `otp_requests`, `users`, `identity_verifications` |
| **External** | Cashfree M360 OTP (via `cashfree-m360-otp.ts`) |

**Actions (via `action` field in body):**

- `send_otp` -- Sends M360 OTP to landlord's phone number
- `verify_otp` -- Verifies OTP, creates/finds landlord user, processes M360 identity data, returns session
- `resend_otp` -- Resends OTP with fresh M360 verification_id
- `health` -- Health check for warm-up cron

### `landlord-confirm`

Landlord reviews tenancy details and confirms or disputes them. Called after `landlord-auth-otp` verification. Handles approve, dispute, and view-only actions. Updates `tenancies.landlord_approved` and `users.user_status` on approval.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST /functions/v1/landlord-confirm` |
| **Auth** | Landlord JWT (from `landlord-auth-otp` session) |
| **Tables** | `tenancies`, `users` |

- **GET** -- Fetch tenancy details for landlord to review
- **POST** -- Confirm (approve) or dispute tenancy

### `notify-landlord`

Multi-channel notification pipeline for landlords. Supports WhatsApp (Twilio template), SMS, email (Resend), and push notification. Also serves as a safety net after `landlord-confirm` -- ensures landlord verification is persisted and tenant is notified. Idempotent.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/notify-landlord` |
| **Auth** | JWT or Service Role |
| **Tables** | `tenancies`, `users`, `notifications`, `notification_queue` |
| **External** | Twilio (WhatsApp, SMS), Resend (email), Expo Push API |

**Response:**
```json
{
  "success": true,
  "data": {
    "tenancy_id": "uuid",
    "tenant_name": "John Doe",
    "landlord_verified": true
  }
}
```

---

## 5. Payment

### `initiate-payment`

Creates a PayU payment session with server-side hash generation. Handles idempotency, instant 1% discount calculation, and fee computation.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/initiate-payment` |
| **Auth** | JWT |
| **Tables** | `payments`, `tenancies`, `fee_config`, `idempotency_keys` |
| **External** | PayU |

### `payment-webhook`

Receives PayU server-to-server callbacks. Verifies hash integrity using HMAC-SHA512 with timing-safe comparison. Updates payment status and records cashback discount audit entries.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/payment-webhook` |
| **Auth** | None (hash-verified via `verifyPayUWebhookHashWithCharges`) |
| **Tables** | `payments`, `cashback_ledger` |
| **External** | PayU `verify_payment` |

### `check-payment-status`

Polls payment status. If payment is stale (stuck in initiated/processing), verifies directly with PayU.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/check-payment-status` |
| **Auth** | JWT |
| **Tables** | `payments` |
| **External** | PayU `verify_payment` |

### `get-payment-history`

Returns paginated payment history for the authenticated user.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-payment-history` |
| **Auth** | JWT |
| **Tables** | `payments` |

### `get-payment-schedule`

Returns payment schedules for user's tenancies.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-payment-schedule` |
| **Auth** | JWT |
| **Tables** | `payment_schedules` |

### `get-payment-stamps`

Returns a month-by-month payment history grid classifying each month as `on_time`, `late`, `missed`, or `pending`. Used for the dashboard stamp visualization.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST /functions/v1/get-payment-stamps?tenancy_id=xxx` |
| **Auth** | JWT |
| **Tables** | `payments`, `tenancies` |

**Response:**
```json
{
  "success": true,
  "data": {
    "stamps": [
      {
        "month": "2026-01",
        "month_display": "Jan 2026",
        "status": "on_time",
        "payment_id": "uuid",
        "paid_at": "2026-01-05T...",
        "due_date": "2026-01-07",
        "days_late": null,
        "amount_paise": 2500000,
        "cashback_applied_paise": 25000,
        "payment_method": "upi"
      }
    ],
    "summary": {
      "total_months": 3,
      "on_time": 2,
      "late": 0,
      "missed": 1,
      "pending": 0
    }
  }
}
```

**Classification logic:**
- Payment tracking starts from tenancy creation date (not agreement lease dates).
- `on_time`: Successful payment before due date cutoff (23:59:59.999 IST).
- `late`: Successful payment after due date. `days_late` calculated.
- `missed`: Due date passed with no successful or processing payment.
- `pending`: Future month, or due date not yet passed, or payment in processing/initiated state.
- All times are IST-aware (UTC+05:30).

### `generate-receipt`

Generates receipt data with tax breakdown for a completed payment.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/generate-receipt` |
| **Auth** | JWT |
| **Tables** | `payments`, `tenancies` |

### `generate-payu-hash`

Server-side PayU hash generation for client SDK usage.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/generate-payu-hash` |
| **Auth** | JWT |
| **Tables** | `payments` |

### `get-netbanking-banks`

Returns list of active netbanking banks.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-netbanking-banks` |
| **Auth** | None |
| **Tables** | `netbanking_banks` |

### `get-bin-info`

Card BIN lookup via PayU to identify card network, type, and issuer.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/get-bin-info` |
| **Auth** | JWT |
| **External** | PayU |

### `get-fee-config`

Returns dynamic payment gateway fee rates by payment method.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-fee-config` |
| **Auth** | JWT |
| **Tables** | `fee_config` |

### `cleanup-stale-payments`

Reconciles payments stuck in initiated/processing state by verifying with PayU.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/cleanup-stale-payments` |
| **Auth** | Service Role |
| **Tables** | `payments` |
| **External** | PayU `verify_payment` |

### `schedule-payment`

Creates and manages recurring monthly payment schedules. Supports create, cancel, pause, and resume actions.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/schedule-payment` |
| **Auth** | JWT |
| **Tables** | `payment_schedules`, `tenancies` |

**Request (create):**
```json
{
  "tenancy_id": "uuid",
  "payment_method": "upi",
  "scheduled_day": 5,
  "auto_apply_cashback": true,
  "upi_vpa": "user@upi"
}
```

**Request (manage):**
```json
{
  "action": "cancel",
  "schedule_id": "uuid"
}
```

**Response (create):**
```json
{
  "success": true,
  "data": {
    "schedule_id": "uuid",
    "status": "active",
    "next_execution_date": "2026-04-05",
    "retry_policy": {
      "max_retries": 3,
      "retry_delays_hours": [4, 12, 24]
    }
  }
}
```

### `dashboard-data`

Aggregates all home screen dashboard data in a single call. Returns user profile, active tenancy, next payment info, cashback summary, recent payments, and notifications. Results cached for 5 minutes.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/dashboard-data` |
| **Auth** | JWT |
| **Tables** | `users`, `tenancies`, `payments`, `cashback_ledger`, `notifications` |

---

## 6. Payment Methods

### `get-saved-payment-methods`

Retrieves user's saved payment methods (UPI, cards, netbanking) with sensitive data masked. Groups by type.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-saved-payment-methods` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_methods": [...],
    "primary_method_id": "uuid",
    "grouped_methods": {
      "upi": [...],
      "cards": [...],
      "netbanking": [...]
    },
    "total_count": 3
  }
}
```

### `set-default-payment-method`

Sets a payment method as the user's default, unsetting any previous default.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/set-default-payment-method` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |

**Request:**
```json
{ "payment_method_id": "uuid" }
```

### `add-upi-vpa`

Validates and saves a UPI Virtual Payment Address. Optionally validates via PayU `validate_vpa` API. Auto-detects UPI provider (GPay, PhonePe, Paytm, etc.).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/add-upi-vpa` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |
| **External** | PayU `validate_vpa` (optional) |

**Request:**
```json
{
  "upi_vpa": "user@okicici",
  "nickname": "My GPay",
  "set_primary": true
}
```

**Notes:**
- Supports `verify_only: true` to validate without saving.
- VPA validation skipped in sandbox mode.
- Duplicate VPA detection prevents re-adding same address.

### `add-card-token`

Saves a tokenized card from PayU. Card token is encrypted with AES-256-GCM before storage (PCI-DSS compliance).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/add-card-token` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |

**Request:**
```json
{
  "card_token": "payu_token_xxx",
  "card_last4": "1234",
  "card_network": "visa",
  "card_type": "credit",
  "card_expiry_month": 12,
  "card_expiry_year": 2028,
  "set_primary": false
}
```

**Notes:**
- Supports upsert: if a card with same last4 + network exists, updates with token.
- Card expiry validation prevents adding expired cards.
- Supported networks: visa, mastercard, rupay, amex, maestro.

### `delete-payment-method`

Soft deletes a payment method (sets `deleted_at` timestamp). If it was the default, reassigns default to the most recently created remaining method. Supports hard delete option.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/delete-payment-method` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |

**Request:**
```json
{
  "payment_method_id": "uuid",
  "hard_delete": false
}
```

### `get-payu-stored-cards`

Fetches stored card tokens from PayU's `get_user_cards` API and joins with local `payment_methods` table. Returns matched cards with `saved_method_id` for client SDK usage.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-payu-stored-cards` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |
| **External** | PayU `get_user_cards` |

**Notes:**
- PCI DSS scope: SAQ A-EP (tokens are non-sensitive vault references).
- CVV is always required for stored card payments (collected in client UI, never sent to server).
- Graceful degradation: returns empty cards on any PayU API error.

### `save-bank-preference`

Upserts a netbanking bank preference. If user already has a netbanking method, updates it; otherwise creates a new one.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/save-bank-preference` |
| **Auth** | JWT |
| **Tables** | `payment_methods` |

**Request:**
```json
{
  "bank_code": "HDFC",
  "bank_name": "HDFC Bank",
  "set_primary": true
}
```

---

## 7. Cashback and Savings

### `calculate-cashback`

Returns savings data from the instant 1% rent discount model. Legacy wallet credit/redeem operations return HTTP 410 deprecation notices.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/calculate-cashback` |
| **Auth** | JWT |
| **Tables** | `cashback_ledger` |

**Response:**
```json
{
  "success": true,
  "data": {
    "discount_rate": 0.01,
    "total_savings_paise": 75000,
    "total_savings": 750,
    "discount_count": 3,
    "legacy_wallet_balance_paise": 0,
    "history": [...]
  }
}
```

### `get-cashback-history`

Returns paginated cashback ledger entries with filtering by tenancy and transaction type.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-cashback-history` |
| **Auth** | JWT |
| **Tables** | `cashback_ledger` |

**Query Parameters:**
- `page` -- Page number (default: 1)
- `limit` -- Items per page (default: 20, max: 100)
- `tenancy_id` -- Filter by tenancy (optional)
- `type` -- Filter by transaction type: earned, redeemed, reversed, expired (optional)

---

## 8. Refunds

### `initiate-refund`

Initiates a refund via PayU's `cancel_refund_transaction` API. Supports full and partial refunds. Reverses cashback earned on the payment.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/initiate-refund` |
| **Auth** | JWT |
| **Tables** | `payments`, `refunds`, `cashback_ledger`, `notification_queue` |
| **External** | PayU Refund API |

**Request:**
```json
{
  "payment_id": "uuid",
  "amount_paise": 2500000,
  "reason": "duplicate_payment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refund_id": "uuid",
    "payment_id": "uuid",
    "amount_paise": 2500000,
    "status": "processing",
    "gateway": "payu",
    "message": "Refund initiated successfully. It will be credited within 5-7 business days."
  }
}
```

**Notes:**
- Valid reasons: `payment_failed`, `duplicate_payment`, `incorrect_amount`, `service_not_delivered`, `user_request`, `technical_error`, `fraud_suspected`, `other`.
- Cashback reversal: earned cashback is clawed back; applied cashback is not re-credited (prevents double-dipping).
- Queues push notification to user on success.

### `get-refund-status`

Retrieves refund status. Supports lookup by refund_id (single) or payment_id (all refunds for that payment).

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-refund-status` |
| **Auth** | JWT |
| **Tables** | `refunds`, `payments`, `tenancies` |

**Query Parameters (one required):**
- `refund_id` -- Specific refund UUID
- `payment_id` -- All refunds for a payment

---

## 9. Settlement

### `settle-to-landlord`

Processes landlord payouts for successfully collected payments. Queries payments that are PayU-settled and ready for landlord transfer. Logs payout details for manual processing via PayU dashboard.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/settle-to-landlord` |
| **Auth** | Service Role |
| **Tables** | `payments`, `tenancies`, `bank_accounts`, `notification_queue` |

**Safeguards:**
- System transfer flag check (`getSystemTransferFlag`) -- global kill switch.
- Per-payment `transfer_hold` flag check -- individual hold.
- Payout amount must not exceed original rent amount (security check).
- Bank account must be verified.
- Optimistic locking on `landlord_payout_status = 'ready'` prevents double-processing.
- Batch size limited to 10 per invocation.
- Ops alert queued on any failures.

### `confirm-payout`

Admin confirms that a landlord payout has been manually processed. Records UTR and sends settlement_complete notification to user.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/confirm-payout` |
| **Auth** | Service Role |
| **Tables** | `payments` |

**Request:**
```json
{
  "payment_id": "uuid",
  "utr": "UTR123456789",
  "settled_at": "2026-03-08T12:00:00Z",
  "notes": "Processed via NEFT"
}
```

**Notes:**
- Supports bulk confirmation via `payment_ids` array (max 50).
- Only confirms payments in `processing` state (set by `settle-to-landlord`).
- Optimistic lock on `landlord_payout_status = 'processing'`.

### `poll-settlement-status`

Cron job (every 30 minutes) with three tiers of settlement tracking.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/poll-settlement-status` |
| **Auth** | Service Role |
| **Tables** | `payments`, `cashback_ledger` |
| **External** | PayU `get_settlement_details`, PayU `verify_payment` |

**Tier 1: PayU to Flent Settlement**
- Checks if PayU has settled successful payments to Flent's account.
- Calls PayU `get_settlement_details` API grouped by payment date.
- Marks payments as `ready` for landlord payout (or `held` if transfer eligibility fails).

**Tier 2: Landlord Payout Monitoring (read-only)**
- Counts and logs payments in `ready`/`processing` state.
- Does NOT mutate status; `settle-to-landlord` owns the `ready` to `processing` transition.

**Reconciliation: Stuck Payments**
- Finds payments stuck in `initiated`/`processing` for more than 15 minutes.
- Verifies with PayU `verify_payment` API.
- Updates status based on PayU response with optimistic locking.
- Logs discount audit entries on successful reconciliation.

**Release: Held Payments**
- When system transfers are re-enabled, releases system-held payments back to `ready`.
- Manually-held payments (`transfer_hold = true`) remain held.

---

## 10. Notifications

### `send-whatsapp`

Sends WhatsApp messages via Twilio. Supports both free-form body and template-based messages.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/send-whatsapp` |
| **Auth** | Service Role |
| **Tables** | `notification_queue` |
| **External** | Twilio WhatsApp API |

### `send-sms`

Sends SMS messages via Twilio. Used for critical alerts and fallback notifications.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/send-sms` |
| **Auth** | Service Role |
| **Tables** | `notification_queue` |
| **External** | Twilio SMS API |

### `send-push-notification`

Sends push notifications via Expo Push API. Automatically routes to APNs/FCM based on token type. Deactivates invalid tokens (DeviceNotRegistered).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/send-push-notification` |
| **Auth** | Service Role |
| **External** | Expo Push API (`https://exp.host/--/api/v2/push/send`) |

**Request:**
```json
{
  "user_id": "uuid",
  "title": "Payment Received",
  "body": "Your rent payment of Rs. 25,000 was successful.",
  "data": { "type": "payment_success", "payment_id": "uuid" },
  "badge": 3,
  "priority": "high"
}
```

**Notes:**
- Batches tokens into groups of 100.
- Supports both `user_id` (looks up all device tokens) and `expo_push_token` (single token).

### `notify-user`

High-level notification orchestrator. Other edge functions call this to send templated notifications respecting user preferences.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/notify-user` |
| **Auth** | Service Role |
| **Tables** | `notification_preferences`, `notifications` |

**Pipeline:**
1. Check user notification preferences (global push_enabled + per-type)
2. Resolve template to title/body using `notification-templates.ts`
3. Create in-app notification record via `create_notification` RPC
4. Send push notification via `send-push-notification` edge function (if allowed)

**Request:**
```json
{
  "user_id": "uuid",
  "notification_type": "payment_success",
  "template_vars": { "amount": "25,000" },
  "priority": "high",
  "related_entity_type": "payment",
  "related_entity_id": "uuid"
}
```

### `mark-notification-read`

Marks notifications as read (specific IDs or all). Returns updated unread count for badge updates.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/mark-notification-read` |
| **Auth** | JWT |

**Request:**
```json
{ "notification_ids": ["uuid1", "uuid2"] }
```
Empty body or empty array marks all notifications as read.

### `register-device-token`

Registers or updates a push notification token (APNs/FCM via Expo).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/register-device-token` |
| **Auth** | JWT |
| **Tables** | `device_tokens` |

**Request:**
```json
{
  "token": "ExponentPushToken[xxx]",
  "platform": "ios",
  "device_id": "device-uuid",
  "device_name": "iPhone 16 Pro",
  "bundle_id": "in.flent.secured",
  "sandbox": false
}
```

### `broadcast-app-update`

Sends an `app_update` push notification to all users with active device tokens. Processes in batches of 50.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/broadcast-app-update` |
| **Auth** | Service Role |
| **Tables** | `device_tokens` |

**Request (optional):**
```json
{
  "store_url": "https://apps.apple.com/...",
  "dry_run": true
}
```

---

## 11. Profile

### `update-profile`

Updates user profile information. Logs old and new values for audit trail.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/update-profile` |
| **Auth** | JWT |
| **Tables** | `users` |

**Request:**
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "avatar_url": "https://..."
}
```

**Notes:**
- Auto-splits `full_name` into `first_name`/`last_name` if not provided separately.
- Syncs `avatar_url` to `profile_image_url` for V1 compatibility.

### `upload-avatar`

Generates a presigned upload URL for avatar images to Supabase Storage. Cleans up previous avatars.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/upload-avatar` |
| **Auth** | JWT |
| **External** | Supabase Storage |

**Request:**
```json
{ "content_type": "image/jpeg" }
```

**Allowed types:** `image/jpeg`, `image/png`, `image/heic`, `image/heif`
**Max file size:** 5MB
**Upload URL expires:** 1 hour

### `pixelate-avatar`

Accepts a user photo via FormData, pixelates it with orange tint (#FF9A6D at 40% blend), and saves multi-resolution outputs (64px thumbnail + 256px avatar).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/pixelate-avatar` |
| **Auth** | JWT |
| **Tables** | `users` |
| **External** | Supabase Storage, Image Transform |

**Pipeline:**
1. Validate image (magic bytes, dimensions, decompression ratio)
2. Upload original to temp path
3. Fetch 32x32 thumbnail via Supabase Image Transform
4. Apply orange tint (#FF9A6D) with luminance-preserving blend
5. Nearest-neighbor upscale to 64x64 and 256x256
6. Upload PNGs, update profile, cleanup temp files

**Rate limit:** 5 pixelations per hour.
**Memory:** ~10MB peak (vs 80-100MB without Image Transform pre-resize).

### `assign-default-avatar`

Assigns a random pre-tinted pixel art avatar (from 30 options) to a user. Idempotent: returns existing avatar if already set.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/assign-default-avatar` |
| **Auth** | JWT |
| **Tables** | `users` |

### `delete-account`

Full account deletion with data archival for App Store compliance (Guideline 5.1.1(v)). Archives all user data to `deleted_users_archive`, then cascades deletes through all related tables before removing the auth user.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/delete-account` |
| **Auth** | JWT |
| **Tables** | `users`, `waitlist_entries`, `extracted_rental_info`, `tenancies`, `payments`, `bank_accounts`, `identity_verifications`, `cashback_ledger`, `device_tokens`, `deleted_users_archive` |

**Deletion order (dependents first):**
1. `device_tokens`
2. `cashback_ledger`
3. `identity_verifications`
4. `payments` (via tenancy IDs + orphaned)
5. `bank_accounts`
6. `tenancies`
7. `extracted_rental_info`
8. `waitlist_entries`
9. `users`
10. Auth user (Supabase GoTrue)

---

## 12. Referrals

### `get-my-referral-code`

Returns the authenticated user's referral code, generating one if it does not exist. Uses `generate_user_referral_code` RPC.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/get-my-referral-code` |
| **Auth** | JWT |
| **Tables** | `referral_codes` |

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "JOHN42",
    "usage_count": 3,
    "max_uses": 10,
    "reward_amount_paise": 10000
  }
}
```

### `apply-referral-code`

Applies a referral code to a user's account. Awards cashback rewards and/or waitlist priority boost. Notifies the referrer.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/apply-referral-code` |
| **Auth** | JWT |
| **Tables** | `referral_applications`, `referral_codes`, `users`, `notification_queue` |

**Request:**
```json
{ "code": "JOHN42" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": "JOHN42",
    "reward_type": "both",
    "rewards": {
      "cashback_paise": 10000,
      "priority_boost": 5
    },
    "new_position": 37,
    "message": "You've received Rs. 100 cashback and priority boost in the waitlist!"
  }
}
```

**Notes:**
- One referral code per user (checks both `referral_applications` table and `users.referral_code_id`).
- Calls `apply_referral_code` and `apply_waitlist_priority_boost` RPCs.
- Queues push notification to referrer.

### `validate-referral-code`

Validates a referral code without applying it. Checks for self-referral and already-applied state.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST /functions/v1/validate-referral-code` |
| **Auth** | JWT |
| **Tables** | `referral_codes`, `referral_applications` |

**Request (GET):** `?code=JOHN42`
**Request (POST):** `{ "code": "JOHN42" }`

---

## 13. Admin and Debug

### `admin-encrypt`

AES-256-GCM encryption/decryption utility for admin operations. Primary use case is encrypting bank details (account numbers) at rest before database storage.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/admin-encrypt` |
| **Auth** | Service Role |
| **Tables** | None (pure utility) |

**Request:**
```json
{ "value": "plaintext_to_encrypt" }
```

**Response:**
```json
{ "encrypted": "base64_encrypted_ciphertext" }
```

### `admin-fetch-views`

Fetches aggregated admin dashboard data from database views. Called by Apps Script (Google Sheets) to populate the admin dashboard. Replaces direct REST API calls which fail with the new `sb_secret_*` key format. Fetches `v_user_funnel`, `v_m360_detail`, and `v_verification_analysis` in parallel.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/admin-fetch-views` |
| **Auth** | Service Role |
| **Tables** | `v_user_funnel` (view), `v_m360_detail` (view), `v_verification_analysis` (view) |

**Response:**
```json
{
  "user_funnel": [...],
  "m360": [...],
  "verifications": [...]
}
```

**Notes:**
- Underlying views join across `users`, `tenancies`, `payments`, `cashback_ledger`, `bank_accounts`, and `identity_verifications` tables.

### `admin-payment-data`

Admin reporting on payment data. Returns payment summaries, settlement status, and cashback data with decrypted landlord bank account numbers. Used by Apps Script for the admin Payments sheet.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /functions/v1/admin-payment-data` |
| **Auth** | Service Role |
| **Tables** | `payments`, `users`, `tenancies`, `bank_accounts`, `cashback_ledger` |

**Notes:**
- Decrypts `account_number_encrypted` using `decrypt()` from `crypto.ts`.
- Falls back to masked version on decrypt failure.
- Joins payments with user (phone, name, status), tenancy (address, city, landlord), and bank account (IFSC, holder name, verification status) data.
- Returns flattened rows with `ll_bank_account`, `ll_bank_ifsc`, `ll_bank_holder`, `ll_bank_verified` fields.

### `debug-payment`

**TEMPORARY -- DELETE after investigation.** Diagnostic function to inspect payment data for a user. Accepts `user_id` or `phone` number in the request body.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/debug-payment` |
| **Auth** | None |
| **Tables** | `payments`, `users`, `tenancies`, `cashback_ledger` |

### `payu-hash-test`

Diagnostic function that tests PayU credentials and hash computation against PayU's actual endpoints. Tests both `verify_payment` and S2S UPI Collect flows.

| Property | Value |
|----------|-------|
| **Endpoint** | `GET/POST /functions/v1/payu-hash-test` |
| **Auth** | None |
| **External** | PayU |

### `payu-post-inspector`

Captures exactly what the PayU SDK sends in a POST request. Compares received hash with recomputed hash to diagnose mismatches. Returns HTML response (SDK expects HTML).

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/payu-post-inspector` |
| **Auth** | None |

### `dev-seed`

Client-side proxy for jump-to-screen functionality. Callable with anon key (no service role needed from client). Internally uses service role to seed test data.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/dev-seed` |
| **Auth** | Anon Key |

**Guards:**
- `ALLOW_DEMO_AUTH` env must be `"true"`.
- Phone must match `+91999990XXXX` pattern.

**Request:**
```json
{
  "phone": "+919999900042",
  "target_state": "active",
  "options": {}
}
```

### `seed-test-data`

Seeds or resets a test user to a specific journey state. Used for Apple Review preparation, dev setup, and automated testing.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/seed-test-data` |
| **Auth** | Service Role |

**Supported target states:**
- `signed_up` -- Auth user + users row only
- `extraction_confirmed` -- + confirmed extracted_rental_info
- `waitlisted` -- + waitlist_entries (admin_review=due)
- `waitlisted_rejected` -- + waitlist (admin_review=rejected)
- `approved` -- + waitlist (approved) + tenancy (pending_verification)
- `active` -- + tenancy (active) + optional payments/cashback

**Guards:**
- Service role required.
- Phone must match `+91999990XXXX` pattern.
- Rate limited: 1 invocation per 5 seconds (via audit_logs check).

### `pre-approval-audit`

Pre-approval checks before admin approves a waitlist user. Validates risk level, extraction quality, city support, and data integrity across a batch of waitlisted users. Returns blockers (must fix) and warnings (review). Supports auto-fix mode.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/pre-approval-audit` |
| **Auth** | Admin Key (body-based) or Service Role |
| **Tables** | `users`, `waitlist_entries`, `extracted_rental_info`, `tenancies`, `identity_verifications` |

**Request:**
```json
{
  "admin_key": "xxx",
  "user_ids": ["uuid1", "uuid2"],
  "auto_fix": true
}
```

**Blockers (must fix):**
- B01: User not found
- B02: User status is not `waitlisted`
- B03: No waitlist entry
- B04: Already approved
- B05: No extraction or incomplete
- B06: Extraction not confirmed by user
- B07: No tenancy record
- B08: Critical tenancy fields missing (address, landlord name, rent due day)
- B09: Zero or missing rent
- B10: Duplicate phone with another approved/active user

**Warnings (review):**
- W01: Lease expired
- W02: Lease expiring within 60 days
- W03: Low extraction confidence (below 70%)
- W04: No identity verification or failed
- W05: High risk level
- W06: Tenant name mismatch (score below 70%)
- W07: Very high rent (above 5 lakh/month)
- W08: Very low rent (below 5K/month)
- W09: No lease end date
- W10: Rent due day above 25th
- W11: Stale application (above 30 days)
- W12: Previously rejected
- W13: Extraction flagged for manual review
- W14: Multiple completed extractions
- W15: Tenancy status not pending_verification or active
- W16: Lease end date before start date
- W17: User has no name

**Auto-fixes (when `auto_fix: true`):**
- Creates missing waitlist entry
- Advances user_status from signed_up/agreement_confirmed to waitlisted
- Creates missing tenancy from extraction data
- Backfills missing tenancy fields from extraction
- Sets full_name from extraction tenant_name

### `twilio-debug`

**TEMPORARY -- DELETE after investigation.** Diagnostic function for checking Twilio message status. Lists recent messages or checks a specific message SID. Accepts `message_sid` in body for specific lookup.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/twilio-debug` |
| **Auth** | None |
| **External** | Twilio REST API (Messages) |

### `test-gemini-extraction`

Diagnostic function to test Gemini extraction on a specific document. Tests both Vertex AI (global endpoint) and API key paths. Stores results in extraction record.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/test-gemini-extraction` |
| **Auth** | None |
| **Tables** | `extracted_rental_info` |
| **External** | GCP Document AI, Vertex AI, Gemini API |

### `sync-netbanking-banks`

Fetches live bank availability from PayU's `getNetbankingStatus` API and syncs to the `netbanking_banks` table. Adds new banks, updates active status, and deactivates missing banks.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /functions/v1/sync-netbanking-banks` |
| **Auth** | Service Role |
| **Tables** | `netbanking_banks` |
| **External** | PayU `getNetbankingStatus` |

---

## Database Tables Referenced

This section lists all database tables referenced across edge functions for cross-reference.

| Table | Primary Functions |
|-------|-------------------|
| `users` | auth-otp, dashboard-data, update-profile, delete-account |
| `tenancies` | confirm-extraction, verify-bank, initiate-payment, settle-to-landlord |
| `payments` | initiate-payment, payment-webhook, get-payment-stamps, settle-to-landlord |
| `extracted_rental_info` | process-document, confirm-extraction, update-extraction |
| `waitlist_entries` | join-waitlist, admin-waitlist, get-waitlist-status |
| `bank_accounts` | verify-bank, settle-to-landlord, admin-payment-data |
| `payment_methods` | get-saved-payment-methods, add-upi-vpa, add-card-token |
| `payment_schedules` | schedule-payment, get-payment-schedule |
| `cashback_ledger` | calculate-cashback, get-cashback-history, payment-webhook |
| `refunds` | initiate-refund, get-refund-status |
| `identity_verifications` | verify-identity, auth-otp, landlord-auth-otp, pre-approval-audit |
| `otp_requests` | auth-otp, landlord-auth-otp |
| `notifications` | notify-user, mark-notification-read |
| `notification_preferences` | notify-user |
| `notification_queue` | initiate-refund, settle-to-landlord, apply-referral-code |
| `device_tokens` | register-device-token, send-push-notification, broadcast-app-update |
| `referral_codes` | get-my-referral-code, apply-referral-code, validate-referral-code |
| `referral_applications` | apply-referral-code, validate-referral-code |
| `invite_codes` | claim-invite-code |
| `landlord_invites` | send-landlord-invite, manage-landlord |
| `netbanking_banks` | get-netbanking-banks, sync-netbanking-banks |
| `fee_config` | get-fee-config, initiate-payment |
| `idempotency_keys` | initiate-payment |
| `audit_logs` | All functions (via AuditLogger) |
| `deleted_users_archive` | delete-account |
| `supported_cities` | process-document, reprocess-extractions |
| `v_user_funnel` (view) | admin-fetch-views |
| `v_m360_detail` (view) | admin-fetch-views |
| `v_verification_analysis` (view) | admin-fetch-views |

---

## External Services

| Service | Purpose | Functions |
|---------|---------|-----------|
| **PayU** | Payment gateway | initiate-payment, payment-webhook, check-payment-status, generate-payu-hash, get-bin-info, add-upi-vpa, get-payu-stored-cards, initiate-refund, cleanup-stale-payments, poll-settlement-status, verify-card, sync-netbanking-banks |
| **Cashfree M360** | Identity verification (OTP + data) | auth-otp, verify-identity, landlord-auth-otp |
| **Cashfree Penny Drop** | Bank account verification | verify-bank |
| **Cashfree PAN** | PAN card verification | verify-pan |
| **API Club** | Electricity bill data | verify-utility |
| **Google Gemini / Vertex AI** | Name matching, address matching, document extraction, utility verification | process-document, confirm-extraction, verify-bank, verify-pan, verify-utility, reprocess-extractions, test-gemini-extraction |
| **GCP Document AI** | OCR for rent agreement PDFs | process-document, test-gemini-extraction |
| **Twilio** | WhatsApp and SMS messaging | send-whatsapp, send-sms, invite-landlord-whatsapp, notify-landlord, twilio-debug |
| **Resend** | Email delivery | send-landlord-invite, notify-landlord |
| **Expo Push API** | Push notifications (APNs/FCM) | send-push-notification, notify-landlord |
| **Supabase Storage** | File storage (agreements, avatars) | upload-document, upload-avatar, pixelate-avatar |
| **Supabase GoTrue** | Auth user management | auth-otp, delete-account |

---

## Error Response Format

All error responses follow a consistent format:

```json
{
  "error": true,
  "message": "Human-readable error description",
  "code": "MACHINE_READABLE_CODE",
  "statusCode": 400,
  "details": { "field": "Specific field error" },
  "requestId": "uuid"
}
```

Common error codes:
- `AUTH_ERROR` (401) -- Missing or invalid authentication
- `VALIDATION_ERROR` (400) -- Invalid request parameters
- `NOT_FOUND` (404) -- Resource not found
- `FORBIDDEN` (403) -- Insufficient permissions
- `RATE_LIMIT_EXCEEDED` (429) -- Too many requests
- `EXTERNAL_SERVICE_ERROR` (502) -- Third-party service failure
- `IDEMPOTENCY_ERROR` (409) -- Duplicate operation
- `PAYMENT_ERROR` (400/500) -- Payment-specific errors
- `DB_ERROR` (500) -- Database operation failure

---

## CORS Configuration

All functions use `handleCors()` for preflight handling and `getCorsHeaders()` for origin allowlisting.

**Allowed origins (production):**
- `https://flent.in`
- `https://www.flent.in`
- `https://app.flent.in`
- `https://devapi.flent.in`

**Allowed origins (development):**
- `http://localhost:*`
- `http://127.0.0.1:*`
- `exp://*` (Expo development)

All responses include:
```
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, x-request-id
```
