# Flent Secured v2 - Production Readiness Report

**Generated:** 2026-01-25
**Version:** Backend Infrastructure Deep Dive
**Prepared By:** Claude Code (Opus 4.5) - Comprehensive Analysis

---

## Executive Summary

This report provides a comprehensive production readiness assessment of the Flent Secured v2 iOS app backend infrastructure. The analysis covers all external integrations, database schema, edge functions, security measures, and identifies gaps requiring remediation before production deployment.

### Overall Production Readiness Score: **68/100**

| Category | Score | Status |
|----------|-------|--------|
| Architecture | 90% | Ready |
| Database Schema | 85% | Ready with minor fixes |
| Edge Functions | 80% | Ready with improvements |
| PayU Payments | 70% | Critical gaps |
| Cashfree Verification | 65% | Missing idempotency |
| Twilio Communication | 40% | OTP not implemented |
| API Club Utility | 55% | Critical parsing bug |
| Resend Email | 60% | Domain verification needed |
| GCP Integration | 75% | Configuration needed |
| Test Coverage | 50% | Major gaps |
| Security | 85% | Good with improvements |

### Go/No-Go Assessment: **CONDITIONAL GO**

**Blockers that must be resolved:**
1. Fix API Club operator list parsing (object vs array)
2. Fix identity_verifications OTP_SENT status constraint
3. Add amount verification to PayU webhook
4. Verify Resend email domain

**Estimated remediation effort:** 10-15 engineering days

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Database Schema Analysis](#2-database-schema-analysis)
3. [External Integration Analysis](#3-external-integration-analysis)
4. [Security Assessment](#4-security-assessment)
5. [Test Coverage Analysis](#5-test-coverage-analysis)
6. [Credential Configuration](#6-credential-configuration)
7. [Priority Matrix](#7-priority-matrix)
8. [Remediation Plan](#8-remediation-plan)
9. [Appendices](#9-appendices)

---

## 1. Project Overview

### 1.1 Architecture

```
iOS App (Swift) <---> Supabase Edge Functions <---> External APIs
                            |
                            v
                    PostgreSQL Database
                    (Supabase Hosted)
```

### 1.2 Technology Stack

| Component | Technology |
|-----------|------------|
| Backend Runtime | Deno (Supabase Edge Functions) |
| Database | PostgreSQL 15 (Supabase) |
| Authentication | Supabase Auth |
| Payments | PayU India |
| Bank Verification | Cashfree Penny Drop |
| Identity Verification | Cashfree Mobile 360 |
| Utility Verification | API Club |
| SMS/WhatsApp | Twilio |
| Email | Resend |
| Document Processing | GCP Document AI + Vertex AI Gemini |

### 1.3 Edge Functions Inventory (18 total)

| Function | Purpose | Status |
|----------|---------|--------|
| initiate-payment | PayU payment initiation | Production Ready |
| payment-webhook | PayU callback handler | Needs fixes |
| verify-bank | Cashfree Penny Drop | Needs idempotency |
| verify-identity | Cashfree Mobile 360 | DB constraint issue |
| verify-utility | API Club electricity | Critical bug |
| process-document | GCP Document AI | Production Ready |
| upload-document | Storage upload | Production Ready |
| confirm-extraction | User confirmation | Production Ready |
| get-waitlist-status | V1 compatibility | Production Ready |
| delete-account | GDPR compliance | Production Ready |
| calculate-cashback | Cashback logic | Production Ready |
| dashboard-data | Home screen data | Production Ready |
| generate-receipt | Payment receipts | Production Ready |
| get-payment-history | Paginated history | Production Ready |
| send-sms | Twilio SMS | DLT registration needed |
| send-whatsapp | Twilio WhatsApp | Templates needed |
| send-landlord-invite | Email invitation | Domain verification needed |
| landlord-approve | Landlord approval | Production Ready |

---

## 2. Database Schema Analysis

### 2.1 Tables (15 total)

| Table | Records Purpose | Status |
|-------|-----------------|--------|
| users | User profiles | Ready |
| tenancies | Rental agreements | Ready |
| payments | Payment transactions | Ready |
| bank_accounts | Verified bank accounts | Ready |
| identity_verifications | Mobile 360 data | **CHECK constraint issue** |
| utility_verifications | Electricity data | Ready |
| cashback_ledger | Cashback tracking | Ready |
| idempotency_keys | Deduplication | Ready |
| audit_logs | Compliance logs | Ready |
| device_tokens | Push notifications | Ready |
| notifications | In-app notifications | Ready |
| notification_queue | Scheduled notifications | Ready |
| extracted_rental_info | Document extraction | Ready |
| waitlist_entries | V1 compatibility | Ready |
| deleted_users_archive | GDPR archives | Ready |

### 2.2 Critical Issue: identity_verifications Status Constraint

**Problem:** The `status` CHECK constraint is missing 'OTP_SENT' value that code uses.

**Current Constraint:**
```sql
CHECK (status IN ('SUCCESS', 'DETAILS_NOT_FOUND', 'PENDING', 'FAILED'))
```

**Code Usage (verify-identity/index.ts:295):**
```typescript
status: "OTP_SENT"  // Will fail CHECK constraint!
```

**Fix Required:**
```sql
-- Migration: 20260125000001_fix_identity_verifications_status.sql
ALTER TABLE identity_verifications
  DROP CONSTRAINT IF EXISTS identity_verifications_status_check;

ALTER TABLE identity_verifications
  ADD CONSTRAINT identity_verifications_status_check
  CHECK (status IN ('SUCCESS', 'DETAILS_NOT_FOUND', 'PENDING', 'FAILED', 'OTP_SENT'));
```

### 2.3 RPC Functions (29 total)

All critical RPC functions exist and are properly defined:
- `get_cashback_balance()`
- `get_available_cashback()`
- `get_unread_notification_count()`
- `generate_landlord_otp()`
- `verify_landlord_otp()`
- `create_notification()`

### 2.4 RLS Policies (41 total)

All tables have proper Row Level Security policies. Users can only access their own data.

### 2.5 pg_cron Jobs (6 scheduled)

| Job | Schedule | Purpose |
|-----|----------|---------|
| payment-reminders | 9 AM IST daily | 3-day advance reminders |
| process-notifications | Every 5 min | Queue processing |
| cleanup-idempotency-keys | 2 AM IST daily | Expired key cleanup |
| expire-cashback | 1 AM IST daily | Cashback expiration |
| retry-failed-notifications | Every 15 min | Retry queue |
| cleanup-audit-logs | Weekly | Old log cleanup |

---

## 3. External Integration Analysis

### 3.1 PayU India (Payments)

**Status: 70% Production Ready**

#### What's Working:
- Hash calculation (SHA-512) - Correct for both request and webhook
- Basic webhook handling
- Idempotency for initiation
- Test coverage for happy paths

#### Critical Issues:

| Issue | Severity | Impact |
|-------|----------|--------|
| Missing status codes | HIGH | Payments stuck in wrong state |
| No amount verification in webhook | CRITICAL | Fraud vulnerability |
| Race condition in idempotency | MEDIUM | Potential double processing |
| No refund API | MEDIUM | Cannot process refunds |
| No webhook IP whitelist | MEDIUM | Security gap |

**Missing PayU Status Codes:**
```typescript
// Current (incomplete)
const PAYU_STATUS_MAP = {
  success: "success",
  failure: "failed",
  pending: "processing",
  // ... basic statuses
};

// Missing (must add)
inProgress: "processing",
refunded: "refunded",
on_hold: "processing",
not_initiated: "failed",
timeout: "failed",
```

**Amount Verification Missing:**
```typescript
// CRITICAL: Add this check in payment-webhook
const initiatedAmount = (payment.total_amount_paise / 100).toFixed(2);
if (payload.amount !== initiatedAmount) {
  throw new PaymentError("AMOUNT_MISMATCH", "Webhook amount differs from initiated");
}
```

#### Sandbox Test Credentials:
```
PAYU_MERCHANT_KEY=AVYL14
PAYU_MERCHANT_SALT=FJbwKKi4u6aybjbRbnB28uqUmyjxkcJd
PAYU_BASE_URL=https://sandboxsecure.payu.in
```

---

### 3.2 Cashfree (Verification)

**Status: 65% Production Ready**

#### What's Working:
- Penny Drop API integration
- Mobile 360 OTP flow (logic)
- Name matching algorithms
- PII masking

#### Critical Issues:

| Issue | Severity | Impact |
|-------|----------|--------|
| No idempotency in verify-bank | HIGH | Duplicate penny drops (cost $$$) |
| consent_ip hardcoded to 0.0.0.0 | HIGH | Compliance violation |
| No OTP rate limiting | MEDIUM | Cost accumulation |
| INDETERMINATE status not handled | MEDIUM | User confusion |
| x-api-version header missing | LOW | Future compatibility |

**Idempotency Fix Required (verify-bank):**
```typescript
// Add at start of function
const idempotencyKey = `verify-bank:${tenancy_id}:${account_number}:${ifsc_code}`;
const existingKey = await idempotencyManager.get(idempotencyKey);
if (existingKey?.status === "completed") {
  return existingKey.response;
}
```

**consent_ip Fix Required:**
```typescript
// Replace hardcoded value
consent_ip: req.headers.get("x-forwarded-for")?.split(",")[0] ||
            req.headers.get("cf-connecting-ip") ||
            "unknown"
```

#### Sandbox Test Credentials:
```
CASHFREE_APP_ID=TEST1034592538ac75e53841bda803bf52954301
CASHFREE_SECRET_KEY=cfsk_ma_test_43bfd384ce563bf0469bb155652ec080_56ea6d03
CASHFREE_BASE_URL=https://sandbox.cashfree.com/verification
```

---

### 3.3 API Club (Utility Verification)

**Status: 55% Production Ready**

#### CRITICAL BUG: Operator List Parsing

**Problem:** Real API returns object with numeric keys, code expects array.

**Real API Response:**
```json
{
  "0": {"operator_code": "TAPM", "operator_name": "Tata Power Mumbai"},
  "1": {"operator_code": "BESC", "operator_name": "BESCOM Bangalore"},
  "timestamp": "2026-01-25T14:40:18+05:30"
}
```

**Current Code (BROKEN):**
```typescript
const operators = (data.data ?? data.response ?? []).map(...)
// Returns empty array because data.data and data.response don't exist!
```

**Fix Required:**
```typescript
const operators: OperatorInfo[] = Object.values(data)
  .filter((item): item is Record<string, unknown> =>
    typeof item === "object" &&
    item !== null &&
    "operator_code" in item
  )
  .map((op) => ({
    operator_code: op.operator_code,
    operator_name: op.operator_name,
    state: op.state,
    params: op.params ?? [],  // Some operators need additional params
  }));
```

**Mock Data Incorrect:**
```typescript
// mock-apiclub.ts uses wrong codes
operator_code: "TATA_MUM"  // WRONG - Real is "TAPM"
operator_code: "BESCOM"    // WRONG - Real is "BESC"
```

#### Other Issues:

| Issue | Severity | Impact |
|-------|----------|--------|
| Operator parsing bug | CRITICAL | GET operators returns empty |
| Mock codes wrong | HIGH | Tests pass but prod fails |
| No additional params support | MEDIUM | Some operators blocked |
| No Hindi/regional support | MEDIUM | South/East India failures |
| No request timeout | LOW | Potential hangs |

#### Sandbox Test Credentials:
```
API_CLUB_KEY=apclb_xFYl1e614gGd0CJrpqiVHdDA4efa1a68
```

---

### 3.4 Twilio (Communication)

**Status: 40% Production Ready**

#### CRITICAL: Twilio Verify NOT Implemented

The `TWILIO_VERIFY_SERVICE_SID` is defined but **never used**. Phone OTP authentication is NOT functional.

**Current State:**
- SMS sending: Works (but no DLT registration for India)
- WhatsApp: Sandbox only (no production templates)
- Twilio Verify: **NOT IMPLEMENTED**

#### Required Implementation:

Option A: Enable Supabase Auth Twilio Integration
```toml
# config.toml
[auth.sms.twilio]
enabled = true
account_sid = "env(TWILIO_ACCOUNT_SID)"
auth_token = "env(TWILIO_AUTH_TOKEN)"
message_service_sid = "env(TWILIO_VERIFY_SERVICE_SID)"
```

Option B: Create Custom OTP Functions
```typescript
// send-otp/index.ts
POST /v2/Services/{VERIFY_SID}/Verifications
Body: { To: phone, Channel: "sms" }

// verify-otp/index.ts
POST /v2/Services/{VERIFY_SID}/VerificationCheck
Body: { To: phone, Code: otp }
```

#### India Compliance Requirements:
1. **DLT Registration** - Mandatory for SMS in India
2. **Sender ID Registration** - e.g., "FLENT"
3. **Template Registration** - All SMS templates must be pre-approved

#### Production Credentials:
```
TWILIO_ACCOUNT_SID=ACa1d44932d3d7e5f359012a666c442b4f
TWILIO_AUTH_TOKEN=b52083d9c5e05de6fa378e0a6c7495c0
TWILIO_VERIFY_SERVICE_SID=VA81e230b4e79ddcd025d1fa3dbc3263bb
```

---

### 3.5 Resend (Email)

**Status: 60% Production Ready**

#### Critical Issue: Domain Verification

**Problem:** `flentsecured.com` must be verified in Resend dashboard before production.

**Current From Address:**
```typescript
const EMAIL_FROM_ADDRESS = "Flent Secured <noreply@flentsecured.com>";
```

**Required DNS Records:**
```
SPF:   v=spf1 include:_spf.resend.com ~all
DKIM:  CNAME records from Resend dashboard
DMARC: v=DMARC1; p=none; rua=mailto:dmarc@flentsecured.com
```

#### Other Issues:
- No bounce/complaint webhook handling
- HTML templates not escaped (XSS potential)
- No email rate limiting

#### Production Credentials:
```
RESEND_API_KEY=re_j2c9Dycj_DRfbH5Jm548Foeq36beFnLui
```

---

### 3.6 GCP Services

**Status: 75% Production Ready**

#### Projects Configured:

| Project | Purpose | APIs Enabled |
|---------|---------|--------------|
| secured-by-flent | Document AI | documentai, storage, secretmanager |
| flent-ai-project-2 | Vertex AI Gemini | aiplatform, generativelanguage |

#### Service Accounts:
- `flent-document-ai@secured-by-flent.iam.gserviceaccount.com`
- `vertex-ai-secured@flent-ai-project-2.iam.gserviceaccount.com`

#### Gemini API Key (for Secured):
```
GEMINI_API_KEY_SECURED=AIzaSyCXufqpmkzxRskJr-l1u7H6h2Ym9rQdMj8
```

#### Configuration Required:
1. Create Document AI processor in `secured-by-flent` project
2. Set `GCP_PROCESSOR_ID` environment variable
3. Configure service account key JSON as secret
4. Test with real rental agreement PDFs

---

## 4. Security Assessment

### 4.1 Strengths

| Measure | Status |
|---------|--------|
| PayU hash validation | Implemented correctly |
| Bank account encryption (AES-256-GCM) | Implemented |
| PII masking (Aadhaar, PAN) | Implemented |
| Audit logging | Comprehensive |
| RLS policies | All tables covered |
| Idempotency keys | Most functions covered |
| JWT authentication | Via Supabase Auth |
| Service role verification | Strict equality checks |

### 4.2 Gaps

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| No PayU webhook IP whitelist | MEDIUM | Whitelist PayU IP ranges |
| No rate limiting on public endpoints | MEDIUM | Implement per-user limits |
| Encryption key rotation | LOW | Document rotation procedure |
| Email template XSS | LOW | Escape user input in HTML |

---

## 5. Test Coverage Analysis

### 5.1 Current Coverage

| Function | Test File | Coverage |
|----------|-----------|----------|
| initiate-payment | initiate-payment.test.ts | **Good** |
| payment-webhook | payment-webhook.test.ts | **Good** |
| verify-utility | verify-utility.test.ts | **Partial** |
| matching-algorithms | matching-algorithms.test.ts | **Good** |
| confirm-extraction | confirm-extraction.test.ts | Unknown |
| delete-account | delete-account.test.ts | Unknown |
| upload-document | upload-document.test.ts | Unknown |
| get-waitlist-status | get-waitlist-status.test.ts | Unknown |

### 5.2 Missing Tests (Critical)

| Function | Lines of Code | Priority |
|----------|---------------|----------|
| verify-bank | ~400 | HIGH |
| verify-identity | ~600 | HIGH |
| process-document | ~1500 | HIGH |
| send-landlord-invite | ~300 | MEDIUM |
| landlord-approve | ~500 | MEDIUM |

### 5.3 Database Tests

**Status:** pgTAP test framework configured but no tests written.

**Required:** Tests for RLS policies, triggers, and RPC functions.

---

## 6. Credential Configuration

### 6.1 Required Supabase Secrets

```bash
# Payment Gateway
supabase secrets set PAYU_MERCHANT_KEY="AVYL14"
supabase secrets set PAYU_MERCHANT_SALT="FJbwKKi4u6aybjbRbnB28uqUmyjxkcJd"

# Verification Services
supabase secrets set CASHFREE_APP_ID="TEST1034592538ac75e53841bda803bf52954301"
supabase secrets set CASHFREE_SECRET_KEY="cfsk_ma_test_43bfd384ce563bf0469bb155652ec080_56ea6d03"
supabase secrets set API_CLUB_KEY="apclb_xFYl1e614gGd0CJrpqiVHdDA4efa1a68"

# Communication
supabase secrets set TWILIO_ACCOUNT_SID="ACa1d44932d3d7e5f359012a666c442b4f"
supabase secrets set TWILIO_AUTH_TOKEN="b52083d9c5e05de6fa378e0a6c7495c0"
supabase secrets set TWILIO_VERIFY_SERVICE_SID="VA81e230b4e79ddcd025d1fa3dbc3263bb"
supabase secrets set RESEND_API_KEY="re_j2c9Dycj_DRfbH5Jm548Foeq36beFnLui"

# GCP Services
supabase secrets set GEMINI_API_KEY_SECURED="AIzaSyCXufqpmkzxRskJr-l1u7H6h2Ym9rQdMj8"
supabase secrets set GCP_PROJECT_ID="secured-by-flent"
supabase secrets set VERTEX_AI_PROJECT_ID="flent-ai-project-2"
# GCP service account keys should be stored as JSON secrets
```

### 6.2 Environment Variables (.env.local)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# PayU (Sandbox)
PAYU_MERCHANT_KEY=AVYL14
PAYU_MERCHANT_SALT=FJbwKKi4u6aybjbRbnB28uqUmyjxkcJd
PAYU_BASE_URL=https://sandboxsecure.payu.in

# Cashfree (Sandbox)
CASHFREE_APP_ID=TEST1034592538ac75e53841bda803bf52954301
CASHFREE_SECRET_KEY=cfsk_ma_test_43bfd384ce563bf0469bb155652ec080_56ea6d03
CASHFREE_BASE_URL=https://sandbox.cashfree.com/verification

# API Club
API_CLUB_KEY=apclb_xFYl1e614gGd0CJrpqiVHdDA4efa1a68

# Twilio
TWILIO_ACCOUNT_SID=ACa1d44932d3d7e5f359012a666c442b4f
TWILIO_AUTH_TOKEN=b52083d9c5e05de6fa378e0a6c7495c0
TWILIO_VERIFY_SERVICE_SID=VA81e230b4e79ddcd025d1fa3dbc3263bb

# Resend
RESEND_API_KEY=re_j2c9Dycj_DRfbH5Jm548Foeq36beFnLui

# GCP
GCP_PROJECT_ID=secured-by-flent
VERTEX_AI_PROJECT_ID=flent-ai-project-2
GEMINI_API_KEY_SECURED=AIzaSyCXufqpmkzxRskJr-l1u7H6h2Ym9rQdMj8
```

---

## 7. Priority Matrix

### 7.1 P0 - Critical (Must Fix Before Production)

| # | Issue | Function | Effort |
|---|-------|----------|--------|
| 1 | API Club operator parsing bug | verify-utility | 2 hours |
| 2 | identity_verifications OTP_SENT constraint | Database | 30 min |
| 3 | PayU amount verification | payment-webhook | 1 hour |
| 4 | Resend domain verification | External | 1 day |
| 5 | Cashfree consent_ip fix | verify-identity | 30 min |

### 7.2 P1 - High Priority (Before Launch)

| # | Issue | Function | Effort |
|---|-------|----------|--------|
| 6 | Add missing PayU status codes | payment-webhook | 2 hours |
| 7 | Add idempotency to verify-bank | verify-bank | 4 hours |
| 8 | Implement Twilio Verify or enable Supabase integration | config/functions | 1 day |
| 9 | Add verify-bank tests | Tests | 1 day |
| 10 | Add verify-identity tests | Tests | 1 day |
| 11 | Update mock-apiclub.ts operator codes | Tests | 1 hour |

### 7.3 P2 - Medium Priority (First Month)

| # | Issue | Function | Effort |
|---|-------|----------|--------|
| 12 | Add process-document tests | Tests | 2 days |
| 13 | Implement PayU refund API | New function | 2 days |
| 14 | Add OTP rate limiting | verify-identity | 4 hours |
| 15 | Create Document AI processor | GCP Console | 2 hours |
| 16 | DLT registration for India SMS | External | 1 week |
| 17 | WhatsApp Business templates | External | 1 week |

### 7.4 P3 - Low Priority (When Possible)

| # | Issue | Function | Effort |
|---|-------|----------|--------|
| 18 | Refactor process-document (1500 lines) | process-document | 3 days |
| 19 | Add webhook IP whitelist | payment-webhook | 2 hours |
| 20 | Add rate limiting | All public functions | 1 day |
| 21 | Centralize email templates | send-landlord-invite | 1 day |
| 22 | Add Hindi/regional support | verify-utility | 2 days |
| 23 | pgTAP database tests | Tests | 3 days |

---

## 8. Remediation Plan

### Week 1: Critical Fixes

**Day 1-2:**
- [ ] Fix API Club operator parsing (P0-1)
- [ ] Create migration for OTP_SENT status (P0-2)
- [ ] Add PayU amount verification (P0-3)
- [ ] Fix Cashfree consent_ip (P0-5)

**Day 3:**
- [ ] Verify Resend domain (P0-4)
- [ ] Add missing PayU status codes (P1-6)
- [ ] Update mock-apiclub.ts codes (P1-11)

**Day 4-5:**
- [ ] Add idempotency to verify-bank (P1-7)
- [ ] Choose and implement OTP solution (P1-8)

### Week 2: Testing & Polish

**Day 6-8:**
- [ ] Write verify-bank tests (P1-9)
- [ ] Write verify-identity tests (P1-10)
- [ ] Run full test suite and fix issues

**Day 9-10:**
- [ ] End-to-end testing with sandbox credentials
- [ ] Documentation updates
- [ ] Staging deployment

### Week 3: Production Preparation

- [ ] Configure production credentials
- [ ] Final security review
- [ ] Load testing
- [ ] Monitoring setup
- [ ] Production deployment

---

## 9. Appendices

### 9.1 PayU Test Cards (Sandbox)

| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4012001037141112 | 123 | Any future | Success |
| 5123456789012346 | 123 | Any future | Failure |
| 4012001038443335 | 123 | Any future | 3DS Required |

### 9.2 Test UPI VPAs

| VPA | Result |
|-----|--------|
| success@payu | Success |
| failure@payu | Failure |

### 9.3 Cashfree Test Data

| Account Number | IFSC | Result |
|----------------|------|--------|
| 026291800001191 | YESB0000262 | Valid |

### 9.4 API Club Verified Operators (69 total)

Major metros: TAPM (Mumbai), BESC (Bangalore), TNEB (Chennai), CESC (Kolkata), SPDC (Hyderabad)

Full list available via: `GET https://api.apiclub.in/api/v1/fetch_bill_operator`

### 9.5 GCP Project Configuration

| Project | ID | Purpose |
|---------|----|---------|
| Document AI | secured-by-flent | OCR processing |
| Vertex AI | flent-ai-project-2 | Gemini 2.5 Flash |

Service accounts configured and accessible via gcloud CLI.

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-25 | Claude Code (Opus 4.5) | Initial comprehensive analysis |

---

*Report generated by Claude Code using deep analysis of codebase, real API testing, and documentation research.*
