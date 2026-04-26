# Flent Secured -- Database Schema Documentation

<!-- STALE-WARNING -->
> ⚠️ **Pre-cleanup-arc doc.** This page was last refreshed before the 2026-04-25/26 cleanup batch (DocAI residency flip, per-service SA migration, Phase 8c audit_logs immutability, Cashfree settlement webhook secret separation, Easy Split → Vendor Adjustments rename, etc.). Specific examples and counts may not match current state. The dated header below reflects when the file was originally written, NOT the current cleanup state. Cross-check against code before relying on details.

**Last updated:** 2026-03-08
**Database:** PostgreSQL (Supabase-managed)
**Project ID:** `zqlowjveyqiagnbmfwsb`
**Region:** `ap-south-1` (Mumbai, India)

---

## Table of Contents

1. [Entity Relationship Overview](#1-entity-relationship-overview)
2. [Core Tables](#2-core-tables)
3. [Database Functions and Triggers](#3-database-functions-and-triggers)
4. [Cron Jobs](#4-cron-jobs)
5. [Row Level Security Policies](#5-row-level-security-policies)
6. [User Status State Machine](#6-user-status-state-machine)
7. [Enums and Custom Types](#7-enums-and-custom-types)
8. [Views](#8-views)
9. [Storage Buckets](#9-storage-buckets)
10. [Extensions](#10-extensions)
11. [Recent Migrations](#11-recent-migrations)

---

## 1. Entity Relationship Overview

The Flent Secured database models a rent payment platform where tenants pay rent to landlords, with verification workflows and cashback incentives. The schema is organized around these primary domains:

### Domain Map

```
AUTH DOMAIN                    PAYMENT DOMAIN
+-----------+                  +------------+
| auth.users|--trigger-------->| users      |
+-----------+                  +-----+------+
                                     |
                                     | 1:N
                               +-----v------+
                               | tenancies  |<-----+ extracted_rental_info
                               +-----+------+      |
                                     |              |
                        +------------+--------+     |
                        |            |        |     |
                   +----v---+  +----v----+ +--v--+  |
                   |payments|  |bank_accts| |utility|
                   +----+---+  +---------+ |verifs |
                        |                  +-------+
                   +----v--------+
                   |cashback_ledg|
                   +-------------+

VERIFICATION DOMAIN             ENGAGEMENT DOMAIN
+-----------------------+       +------------------+
| identity_verifications|       | waitlist_entries  |
+-----------------------+       | notifications     |
                                | notification_queue|
                                | referral_codes    |
                                | invite_codes      |
                                +------------------+
```

### Key Relationships

- **auth.users -> users**: One-to-one. Trigger `on_auth_user_created` auto-creates a `public.users` row when a Supabase Auth user signs up.
- **users -> tenancies**: One-to-many. A user (tenant) can have multiple tenancies (rental relationships).
- **tenancies -> payments**: One-to-many. Each tenancy generates monthly rent payments.
- **tenancies -> bank_accounts**: Linked via `user_id`. Bank accounts are verified against the tenancy's landlord.
- **tenancies -> extracted_rental_info**: One-to-one via `extracted_rental_info_id`. Tenancy data is copied from AI-extracted agreement data for immutability.
- **users -> waitlist_entries**: One-to-one. Every user gets a waitlist entry with admin review workflow.
- **users -> identity_verifications**: One-to-many. Cashfree Mobile 360 KYC verification results.
- **payments -> cashback_ledger**: One-to-many. Each successful payment generates cashback ledger entries.
- **payments -> refunds**: One-to-many. Refund tracking for failed/disputed payments.

---

## 2. Core Tables

### 2.1 users

Extended user profiles linked to Supabase Auth. Created automatically via the `handle_new_user()` trigger on `auth.users`.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | -- | PK, FK -> `auth.users(id)` ON DELETE CASCADE | Matches Supabase Auth user ID |
| `full_name` | `VARCHAR(255)` | YES | NULL | -- | Legacy full name (split into first/last) |
| `first_name` | `VARCHAR(100)` | YES | NULL | -- | First name collected during onboarding |
| `last_name` | `VARCHAR(100)` | YES | NULL | -- | Last name collected during onboarding |
| `phone` | `VARCHAR(20)` | YES | NULL | UNIQUE | Phone number (original format from auth) |
| `phone_number` | `VARCHAR(15)` | YES | NULL | -- | V1 compat: 10-digit normalized phone (synced with `phone`) |
| `email` | `VARCHAR(255)` | YES | NULL | -- | Email address |
| `pan_number` | `VARCHAR(10)` | YES | NULL | -- | PAN card number |
| `pan_verified` | `BOOLEAN` | NO | `false` | -- | Whether PAN has been verified |
| `aadhaar_last4` | `VARCHAR(4)` | YES | NULL | -- | Last 4 digits of Aadhaar |
| `aadhaar_verified` | `BOOLEAN` | NO | `false` | -- | Whether Aadhaar has been verified |
| `kyc_status` | `VARCHAR(20)` | NO | `'pending'` | CHECK: `pending`, `in_progress`, `verified`, `failed` | KYC verification status |
| `onboarding_completed` | `BOOLEAN` | NO | `false` | -- | Whether user completed onboarding |
| `is_onboarded` | `BOOLEAN` | YES | `false` | -- | V1 compat: alias for `onboarding_completed` |
| `cashback_balance_paise` | `INTEGER` | NO | `0` | CHECK: >= 0 | DEPRECATED: Wallet removed in instant-discount model. Synced by trigger. |
| `referral_code` | `VARCHAR(10)` | YES | NULL | UNIQUE | User's personal referral code |
| `referred_by` | `UUID` | YES | NULL | FK -> `users(id)` | Who referred this user |
| `referral_applied_at` | `TIMESTAMPTZ` | YES | NULL | -- | When referral code was applied |
| `role` | `user_role` enum | YES | NULL | -- | `tenant` or `landlord` |
| `is_role_locked` | `BOOLEAN` | YES | `false` | -- | Whether role is locked after assignment |
| `role_locked_at` | `TIMESTAMPTZ` | YES | NULL | -- | When role was locked |
| `user_status` | `user_status_enum` | YES | `'signed_up'` | -- | Master journey state (see Section 6) |
| `status_updated_at` | `TIMESTAMPTZ` | YES | NULL | -- | When user_status last changed |
| `status_updated_by` | `UUID` | YES | NULL | FK -> `users(id)` | Who changed the status |
| `avatar_url` | `TEXT` | YES | NULL | -- | Profile image URL |
| `avatar_storage_path` | `TEXT` | YES | NULL | -- | Supabase Storage path for avatar |
| `profile_image_url` | `TEXT` | YES | NULL | -- | V1 compat: synced with `avatar_url` |
| `is_test_user` | `BOOLEAN` | YES | `false` | -- | Test user flag (bypasses PayU hash validation) |
| `is_verified` | `BOOLEAN` | YES | `false` | -- | V1 compat: verification flag |
| `is_active` | `BOOLEAN` | YES | `true` | -- | Whether user account is active |
| `metadata` | `JSONB` | YES | `'{}'` | -- | Flexible metadata storage |
| `name_source` | `TEXT` | YES | NULL | CHECK: `m360`, `user_input`, `agreement` | Where the authoritative name came from |
| `matched_tenant_index` | `INTEGER` | YES | NULL | -- | Which agreement tenant matched this user |
| `tenant_match_score` | `INTEGER` | YES | NULL | -- | Tenant name match confidence (0-100) |
| `tenant_match_type` | `TEXT` | YES | NULL | CHECK: `exact`, `strong`, `partial`, `weak`, `no_match` | Quality of tenant name match |
| `m360_status` | `TEXT` | YES | NULL | CHECK: `pending`, `fetched`, `not_available`, `failed` | Mobile 360 verification status for OTP routing |
| `m360_status_updated_at` | `TIMESTAMPTZ` | YES | NULL | -- | When m360_status last changed |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update timestamp (auto-updated by trigger) |

**Indexes:** `phone`, `email`, `referral_code`, `kyc_status`, `first_name`, `last_name`, `phone_number`, `user_status`, `role`, `name_source`, `m360_status` (partial, non-null only)

---

### 2.2 tenancies

Verified rental relationships between tenants and landlords. Data is copied from `extracted_rental_info` for immutability after verification.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Tenancy ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | Tenant user ID |
| `extracted_rental_info_id` | `UUID` | YES | NULL | FK -> `extracted_rental_info(id)` ON DELETE SET NULL | Source extraction record |
| `status` | `TEXT` | NO | `'pending_verification'` | CHECK: `pending_verification`, `active`, `expired`, `terminated` | Tenancy status |
| `monthly_rent_paise` | `BIGINT` | NO | -- | CHECK: > 0 | Monthly rent in paise |
| `maintenance_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Monthly maintenance charge in paise |
| `rent_due_day` | `INTEGER` | NO | -- | CHECK: 1-28 | Day of month rent is due |
| `cashback_cutoff_day` | `INTEGER` | YES | NULL | CHECK: NULL or 1-28 | Last day to qualify for cashback (default: 7th if NULL) |
| `lease_start_date` | `DATE` | NO | -- | -- | Lease start date |
| `lease_end_date` | `DATE` | YES | NULL | CHECK: > `lease_start_date` if set | Lease end date |
| `property_address` | `TEXT` | NO | -- | -- | Full property address |
| `property_city` | `TEXT` | YES | NULL | -- | City name |
| `property_state` | `TEXT` | YES | NULL | -- | State name |
| `property_pincode` | `VARCHAR(6)` | YES | NULL | -- | PIN code |
| `landlord_name` | `TEXT` | NO | -- | -- | Landlord's full name |
| `landlord_phone` | `VARCHAR(15)` | YES | NULL | -- | Landlord's phone number |
| `landlord_email` | `TEXT` | YES | NULL | -- | Landlord's email |
| `landlord_user_id` | `UUID` | YES | NULL | FK -> `users(id)` | If landlord has a Flent account |
| `bank_verified` | `BOOLEAN` | NO | `false` | -- | Whether landlord's bank is verified |
| `utility_verified` | `BOOLEAN` | NO | `false` | -- | Whether utility bill is verified |
| `landlord_approved` | `BOOLEAN` | NO | `false` | -- | Whether landlord confirmed the tenancy |
| `pan_verified` | `BOOLEAN` | YES | `false` | -- | Whether landlord PAN is verified |
| `landlord_approval_token` | `TEXT` | YES | NULL | -- | Secure token for landlord approval URL |
| `landlord_token_expires_at` | `TIMESTAMPTZ` | YES | NULL | -- | When approval token expires |
| `landlord_invite_sent_at` | `TIMESTAMPTZ` | YES | NULL | -- | When invite was last sent |
| `landlord_invite_count` | `INTEGER` | NO | `0` | -- | Number of invites sent |
| `landlord_otp_hash` | `TEXT` | YES | NULL | -- | SHA-256 hash of landlord OTP |
| `landlord_otp_expires_at` | `TIMESTAMPTZ` | YES | NULL | -- | When OTP expires |
| `landlord_otp_attempts` | `INTEGER` | NO | `0` | -- | OTP generation attempts (rate limiting) |
| `landlord_otp_verified` | `BOOLEAN` | NO | `false` | -- | Whether landlord OTP is verified |
| `landlord_response` | `TEXT` | YES | NULL | CHECK: `approved`, `disputed`, `pending` | Landlord's response |
| `landlord_dispute_reason` | `TEXT` | YES | NULL | -- | Reason if disputed |
| `landlord_approved_at` | `TIMESTAMPTZ` | YES | NULL | -- | When landlord approved |
| `landlord_disputed_at` | `TIMESTAMPTZ` | YES | NULL | -- | When landlord disputed |
| `landlord_pan_masked` | `VARCHAR(10)` | YES | NULL | -- | Landlord PAN masked format for receipts |
| `landlord_pan_encrypted` | `TEXT` | YES | NULL | -- | Landlord PAN encrypted for backend use |
| `landlord_status` | `TEXT` | YES | `'none'` | CHECK: `none`, `invited`, `verified`, `declined` | Landlord invitation status |
| `country_code` | `VARCHAR(10)` | YES | NULL | -- | Landlord's phone country code |
| `agreement_cert_id` | `TEXT` | YES | NULL | UNIQUE | Certificate ID for receipts (e.g., `FS-AGR-202601-A1B2C3D4`) |
| `vacancy_cover_active` | `BOOLEAN` | NO | `false` | -- | Whether vacancy cover is active |
| `vacancy_cover_started_at` | `TIMESTAMPTZ` | YES | NULL | -- | When vacancy cover started |
| `cashback_balance_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Per-tenancy cashback balance |
| `lifetime_cashback_earned_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Lifetime cashback earned for this tenancy |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Row creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update timestamp |

**Constraints:** `unique_user_extraction` UNIQUE on `(user_id, extracted_rental_info_id)`, `valid_lease_dates`, `valid_rent_due_day`

**Indexes:** `user_id`, `status`, `landlord_user_id`, `landlord_approval_token`, active tenancies per user

---

### 2.3 payments

All rent payment transactions with full audit trail.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Payment ID |
| `tenancy_id` | `UUID` | NO | -- | FK -> `tenancies(id)` ON DELETE RESTRICT | Associated tenancy |
| `user_id` | `UUID` | YES | NULL | FK -> `auth.users(id)` | Denormalized user ID (auto-set by trigger) |
| `rent_amount_paise` | `BIGINT` | NO | -- | CHECK: > 0 | Base rent amount in paise |
| `pg_fee_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Payment gateway fee in paise |
| `cashback_applied_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Cashback deducted from this payment |
| `cashback_earned_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | DEPRECATED: Set to 0 for instant-discount model |
| `intended_cashback_paise` | `INTEGER` | YES | `0` | -- | DEPRECATED: No deferred wallet debit needed |
| `total_amount_paise` | `BIGINT` | NO | -- | CHECK: > 0 | Total charged (rent + fees - cashback) |
| `flent_subsidy_paise` | `BIGINT` | NO | `0` | CHECK: >= 0 | Flent's 1% instant discount subsidy |
| `net_rent_paise` | `BIGINT` | YES | NULL | -- | Actual amount tenant pays after discount |
| `status` | `TEXT` | NO | `'initiated'` | CHECK: `initiated`, `processing`, `success`, `failed`, `refunded`, `partially_refunded`, `expired` | Payment status |
| `payment_gateway` | `TEXT` | YES | `'payu'` | CHECK: `payu`, `cashfree`, `demo` | Which payment gateway was used |
| `payment_method` | `TEXT` | YES | NULL | CHECK: `upi`, `upi_intent`, `upi_collect`, `card`, `netbanking`, `wallet`, `CC`, `NB` | Payment method type |
| `payment_method_details` | `JSONB` | YES | NULL | -- | Bank name, UPI app, card type, etc. |
| `idempotency_key` | `TEXT` | NO | -- | UNIQUE | Prevents duplicate payments |
| `due_date` | `DATE` | NO | -- | -- | Payment due date |
| `payment_month` | `DATE`/`TEXT` | NO | -- | -- | First day of the rent month |
| **PayU-specific columns** | | | | | |
| `payu_txn_id` | `TEXT` | YES | NULL | -- | PayU transaction ID |
| `payu_mihpayid` | `TEXT` | YES | NULL | UNIQUE | PayU's unique transaction ID |
| `payu_bank_ref_num` | `TEXT` | YES | NULL | -- | Bank reference number |
| `payu_status` | `TEXT` | YES | NULL | -- | Raw status from PayU |
| `payu_error_code` | `TEXT` | YES | NULL | -- | PayU error code |
| `payu_error_message` | `TEXT` | YES | NULL | -- | PayU error message |
| `payu_raw_response` | `JSONB` | YES | NULL | -- | Full PayU webhook response |
| `payu_initiation_params` | `JSONB` | YES | NULL | -- | Parameters sent to PayU at initiation |
| **Gateway-agnostic columns** | | | | | |
| `gateway_order_id` | `TEXT` | YES | NULL | -- | Generic gateway order ID |
| `gateway_payment_id` | `TEXT` | YES | NULL | -- | Generic gateway payment ID |
| `gateway_status` | `TEXT` | YES | NULL | -- | Generic gateway status |
| `gateway_error_code` | `TEXT` | YES | NULL | -- | Generic gateway error code |
| `gateway_error_message` | `TEXT` | YES | NULL | -- | Generic gateway error message |
| `gateway_metadata` | `JSONB` | YES | `'{}'` | -- | Gateway-specific raw data |
| **Settlement tracking** | | | | | |
| `settlement_status` | `TEXT` | YES | `'pending'` | CHECK: `pending`, `processing`, `settled`, `failed` | Legacy single-tier settlement |
| `settled_to_bank_account_id` | `UUID` | YES | NULL | FK -> `bank_accounts(id)` | Bank account settled to |
| `settlement_utr` | `TEXT` | YES | NULL | -- | UTR from bank settlement |
| `payu_settlement_status` | `TEXT` | YES | `'pending'` | CHECK: `pending`, `processing`, `settled`, `failed` | Tier 1: PayU to Flent settlement |
| `payu_settlement_utr` | `TEXT` | YES | NULL | -- | UTR from PayU settlement |
| `payu_settled_at` | `TIMESTAMPTZ` | YES | NULL | -- | When PayU settled to Flent |
| `gateway_settlement_status` | `TEXT` | YES | `'pending'` | -- | Generic gateway settlement status |
| `gateway_settlement_utr` | `TEXT` | YES | NULL | -- | Generic gateway settlement UTR |
| `gateway_settled_at` | `TIMESTAMPTZ` | YES | NULL | -- | When gateway settled |
| `gateway_payout_id` | `TEXT` | YES | NULL | -- | Cashfree payout ID |
| `gateway_payout_status` | `TEXT` | YES | NULL | -- | Cashfree payout status |
| `gateway_payout_utr` | `TEXT` | YES | NULL | -- | Cashfree payout UTR |
| `landlord_payout_status` | `TEXT` | YES | `'pending'` | CHECK: `pending`, `ready`, `held`, `processing`, `settled`, `failed` | Tier 2: Flent to landlord payout |
| `landlord_payout_paise` | `BIGINT` | YES | NULL | -- | Amount disbursed to landlord |
| `landlord_payout_utr` | `TEXT` | YES | NULL | -- | UTR from landlord payout |
| `landlord_payout_at` | `TIMESTAMPTZ` | YES | NULL | -- | When Flent paid landlord |
| **Transfer hold** | | | | | |
| `transfer_hold` | `BOOLEAN` | NO | `false` | -- | Whether payout is on hold |
| `transfer_hold_reason` | `TEXT` | YES | NULL | -- | Reason for hold |
| `transfer_hold_at` | `TIMESTAMPTZ` | YES | NULL | -- | When hold was placed |
| `transfer_hold_by` | `TEXT` | YES | NULL | -- | Who placed the hold |
| **Refund tracking** | | | | | |
| `refund_amount_paise` | `BIGINT` | YES | `0` | CHECK: >= 0 | Total refunded amount |
| `refund_reason` | `TEXT` | YES | NULL | -- | Reason for refund |
| `refund_initiated_at` | `TIMESTAMPTZ` | YES | NULL | -- | When refund was initiated |
| `refund_completed_at` | `TIMESTAMPTZ` | YES | NULL | -- | When refund was completed |
| **Fraud prevention** | | | | | |
| `ip_address` | `INET` | YES | NULL | -- | Client IP address |
| `user_agent` | `TEXT` | YES | NULL | -- | Client user agent |
| `device_fingerprint` | `TEXT` | YES | NULL | -- | Device fingerprint hash |
| `error_message` | `TEXT` | YES | NULL | -- | Generic error message |
| **Timestamps** | | | | | |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Payment initiation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update (auto-trigger) |
| `paid_at` | `TIMESTAMPTZ` | YES | NULL | -- | When confirmed successful |
| `settled_at` | `TIMESTAMPTZ` | YES | NULL | -- | When settled to landlord |

**Unique Indexes:** `payu_mihpayid`, `idempotency_key`, `idx_payments_unique_month` (tenancy_id, payment_month WHERE status IN initiated/processing/success), `idx_payments_active_per_month` (tenancy_id, payment_month WHERE status NOT IN failed/expired/refunded)

**Indexes:** `tenancy_id`, `status`, `user_id`, `payment_month`, `settlement_status`, `payment_gateway`, `gateway_order_id`, `gateway_payment_id`, `created_at DESC`

---

### 2.4 extracted_rental_info

Rental information extracted from uploaded lease agreements via AI (Gemini). Source of truth for tenancy creation.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Extraction record ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | Uploading user |
| `tenancy_id` | `UUID` | YES | NULL | FK -> `tenancies(id)` ON DELETE SET NULL | Linked tenancy |
| `document_storage_path` | `TEXT` | NO | -- | -- | Supabase Storage path |
| `document_type` | `TEXT` | NO | -- | CHECK: `lease_agreement`, `rent_receipt`, `utility_bill`, `bank_statement` | Document type |
| `original_filename` | `TEXT` | YES | NULL | -- | Original uploaded filename |
| `file_size_bytes` | `INTEGER` | YES | NULL | -- | File size |
| `mime_type` | `TEXT` | YES | NULL | -- | MIME type |
| `extraction_status` | `TEXT` | NO | `'pending'` | CHECK: `pending`, `processing`, `completed`, `failed`, `manual_review` | Extraction pipeline status |
| `extraction_provider` | `TEXT` | YES | NULL | -- | AI provider (e.g., `google_document_ai`) |
| `extraction_confidence` | `DECIMAL(5,4)` | YES | NULL | -- | AI confidence score (0.0000-1.0000) |
| `extraction_error` | `TEXT` | YES | NULL | -- | Error message if extraction failed |
| `extraction_method` | `TEXT` | YES | NULL | -- | Method used for extraction |
| `confidence_score` | `DECIMAL(5,2)` | YES | NULL | -- | Overall confidence score |
| `gemini_verification_score` | `DECIMAL(5,2)` | YES | NULL | -- | Gemini verification score |
| `fields_extracted` | `INTEGER` | YES | NULL | -- | Number of fields extracted |
| `contract_status` | `TEXT` | YES | `'uploading'` | -- | Document validity status |
| `needs_manual_review` | `BOOLEAN` | YES | `false` | -- | Flag when AI confidence is low |
| `is_city_supported` | `BOOLEAN` | YES | `false` | -- | Whether city is in supported list |
| **Extracted party data** | | | | | |
| `landlord_name` | `TEXT` | YES | NULL | -- | Landlord's name |
| `landlord_phone` | `TEXT` | YES | NULL | -- | Landlord's phone |
| `landlord_email` | `TEXT` | YES | NULL | -- | Landlord's email |
| `landlord_address` | `TEXT` | YES | NULL | -- | Landlord's address |
| `landlord_names` | `TEXT[]` | YES | NULL | -- | Array of all landlord names found |
| `tenant_name` | `TEXT` | YES | NULL | -- | Tenant's name |
| `tenant_phone` | `TEXT` | YES | NULL | -- | Tenant's phone |
| `tenant_email` | `TEXT` | YES | NULL | -- | Tenant's email |
| `tenant_names` | `TEXT[]` | YES | NULL | -- | Array of all tenant names found |
| **Property details** | | | | | |
| `property_address` | `TEXT` | YES | NULL | -- | Full property address |
| `property_city` | `TEXT` | YES | NULL | -- | City |
| `property_state` | `TEXT` | YES | NULL | -- | State |
| `property_pincode` | `TEXT` | YES | NULL | -- | PIN code |
| `property_type` | `TEXT` | YES | NULL | -- | `apartment`, `house`, `commercial` |
| `property_name` | `TEXT` | YES | NULL | -- | Name of apartment/complex |
| `micromarket` | `TEXT` | YES | NULL | -- | Locality/micromarket |
| **Financial details** | | | | | |
| `monthly_rent_paise` | `BIGINT` | YES | NULL | -- | Monthly rent in paise |
| `security_deposit_paise` | `BIGINT` | YES | NULL | -- | Security deposit |
| `maintenance_paise` | `BIGINT` | YES | NULL | -- | Maintenance charge |
| `rent_due_day` | `INTEGER` | YES | NULL | CHECK: 1-28 | Day rent is due |
| **Lease dates** | | | | | |
| `lease_start_date` | `DATE` | YES | NULL | -- | Lease start |
| `lease_end_date` | `DATE` | YES | NULL | -- | Lease end |
| `rent_duration_months` | `INTEGER` | YES | NULL | -- | Lease duration |
| `rent_escalation_percent` | `DECIMAL(5,2)` | YES | NULL | -- | Annual rent escalation |
| `agreement_date` | `DATE` | YES | NULL | -- | Date agreement was signed |
| `registration_number` | `TEXT` | YES | NULL | -- | Agreement registration number |
| **E-stamp fields** | | | | | |
| `certificate_no` | `TEXT` | YES | NULL | -- | E-stamp certificate number |
| `certificate_issued_date` | `DATE` | YES | NULL | -- | Certificate issue date |
| `account_reference` | `TEXT` | YES | NULL | -- | E-stamp account reference |
| `purchased_by` | `TEXT` | YES | NULL | -- | Who purchased the e-stamp |
| `description_of_document` | `TEXT` | YES | NULL | -- | Document description on stamp |
| `first_party` | `TEXT` | YES | NULL | -- | First party name |
| `second_party` | `TEXT` | YES | NULL | -- | Second party name |
| `stamp_duty_paid_by` | `TEXT` | YES | NULL | -- | Who paid stamp duty |
| `consideration_price_paise` | `BIGINT` | YES | NULL | -- | Consideration price |
| `stamp_duty_amount_paise` | `BIGINT` | YES | NULL | -- | Stamp duty amount |
| **Geocoding** | | | | | |
| `latitude` | `DOUBLE PRECISION` | YES | NULL | -- | Geocoded latitude |
| `longitude` | `DOUBLE PRECISION` | YES | NULL | -- | Geocoded longitude |
| `geocode_formatted_address` | `TEXT` | YES | NULL | -- | Google Maps formatted address |
| `geocode_place_id` | `TEXT` | YES | NULL | -- | Google Maps place ID |
| `geocoded_at` | `TIMESTAMPTZ` | YES | NULL | -- | When geocoding was performed |
| **Verification and raw data** | | | | | |
| `user_verified` | `BOOLEAN` | NO | `false` | -- | User confirmed extracted data |
| `verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | Confirmation timestamp |
| `corrections_made` | `JSONB` | YES | NULL | -- | Manual corrections JSON |
| `user_modified_data` | `JSONB` | YES | `'{}'` | -- | User's modified data |
| `modification_history` | `JSONB` | YES | `'[]'` | -- | History of all modifications |
| `raw_extraction_response` | `JSONB` | YES | NULL | -- | Full AI extraction response |
| `gemini_raw_response` | `JSONB` | YES | NULL | -- | Full Gemini AI response |
| `raw_extraction_data` | `JSONB` | YES | NULL | -- | Raw extraction data |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Record creation |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

---

### 2.5 bank_accounts

Bank accounts for landlords (receiving rent) and tenants (refunds). Verified via Cashfree Penny Drop and PAN verification.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Bank account ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | Account owner |
| `party_type` | `TEXT` | NO | -- | CHECK: `tenant`, `landlord` | Whose bank account |
| `account_holder_name` | `TEXT` | NO | -- | -- | Holder's name |
| `account_number_encrypted` | `TEXT` | NO | -- | -- | AES-256 encrypted account number |
| `account_number_masked` | `TEXT` | NO | -- | -- | Display format: `XXXX1234` |
| `ifsc_code` | `VARCHAR(11)` | NO | -- | -- | Bank IFSC code |
| `bank_name` | `TEXT` | YES | NULL | -- | Bank name |
| `branch_name` | `TEXT` | YES | NULL | -- | Branch name |
| `account_type` | `TEXT` | YES | `'savings'` | CHECK: `savings`, `current` | Account type |
| **Penny Drop verification** | | | | | |
| `verified` | `BOOLEAN` | NO | `false` | -- | Whether verified via penny drop |
| `penny_drop_txn_id` | `TEXT` | YES | NULL | -- | Cashfree transaction ID |
| `penny_drop_reference_id` | `TEXT` | YES | NULL | -- | Cashfree reference ID |
| `penny_drop_status` | `TEXT` | YES | NULL | -- | SUCCESS, FAILED, PENDING |
| `penny_drop_name_match_score` | `DECIMAL(5,2)` | YES | NULL | -- | Name matching percentage |
| `verified_account_holder_name` | `TEXT` | YES | NULL | -- | Name returned by bank |
| `verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | Verification timestamp |
| **PAN verification** | | | | | |
| `pan_number_encrypted` | `TEXT` | YES | NULL | -- | AES-256 encrypted PAN |
| `pan_number_masked` | `VARCHAR(10)` | YES | NULL | -- | Masked PAN display |
| `pan_verified` | `BOOLEAN` | YES | `false` | -- | PAN verification status |
| `pan_type` | `TEXT` | YES | NULL | CHECK: `Individual`, `HUF`, `Company`, `Trust`, `AOP`, `BOI`, `Government`, `AJP`, `LLP` | PAN entity type |
| `pan_registered_name` | `TEXT` | YES | NULL | -- | Name registered with PAN |
| `pan_status` | `TEXT` | YES | NULL | -- | PAN status from Cashfree |
| `pan_name_match_score` | `DECIMAL(5,2)` | YES | NULL | -- | PAN name match score |
| `pan_name_matched` | `BOOLEAN` | YES | NULL | -- | Whether PAN name matched landlord |
| `pan_verification_details` | `JSONB` | YES | NULL | -- | Full verification response |
| `pan_verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | PAN verification timestamp |
| **Agreement name matching** | | | | | |
| `agreement_name_matched` | `BOOLEAN` | YES | NULL | -- | Whether bank name matched a landlord |
| `agreement_name_match_score` | `DECIMAL(5,2)` | YES | NULL | -- | Best match score (0-100) |
| `agreement_name_match_details` | `JSONB` | YES | NULL | -- | Gemini AI match reasoning |
| **Cashfree beneficiary** | | | | | |
| `cf_beneficiary_id` | `TEXT` | YES | NULL | -- | Cashfree beneficiary ID |
| `cf_beneficiary_status` | `TEXT` | YES | NULL | -- | Cashfree beneficiary status |
| `is_primary` | `BOOLEAN` | NO | `false` | -- | Primary account for user |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

**Unique Index:** `(user_id, party_type) WHERE is_primary = TRUE` -- one primary per party type

---

### 2.6 identity_verifications

Cashfree Mobile 360 verification results for KYC. Contains comprehensive identity data.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Verification record ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | User being verified |
| `tenancy_id` | `UUID` | YES | NULL | FK -> `tenancies(id)` ON DELETE SET NULL | Associated tenancy |
| `verification_id` | `TEXT` | NO | -- | -- | Cashfree verification ID |
| `reference_id` | `TEXT` | YES | NULL | -- | Correlation ID |
| `status` | `TEXT` | NO | -- | CHECK: `SUCCESS`, `DETAILS_NOT_FOUND`, `PENDING`, `FAILED` | Verification result |
| `verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | When verified |
| **Mobile 360 data** | | | | | |
| `m360_full_name` | `TEXT` | YES | NULL | -- | Verified full name |
| `m360_gender` | `TEXT` | YES | NULL | -- | Gender |
| `m360_date_of_birth` | `DATE` | YES | NULL | -- | Date of birth |
| `m360_age` | `INTEGER` | YES | NULL | -- | Computed age |
| `m360_occupation` | `TEXT` | YES | NULL | -- | Occupation |
| `m360_total_income` | `TEXT` | YES | NULL | -- | Income range (e.g., "5-10 Lakhs") |
| `m360_relatives` | `JSONB` | YES | NULL | -- | Array: `[{name, relation}]` |
| `m360_phone_numbers` | `JSONB` | YES | NULL | -- | Array: `[{number, type, source}]` |
| `m360_emails` | `JSONB` | YES | NULL | -- | Array: `[{email, source}]` |
| `m360_pan_details` | `JSONB` | YES | NULL | -- | `[{pan, name, type, aadhaar_linked}]` |
| `m360_aadhaar_masked` | `TEXT` | YES | NULL | -- | Last 4 digits: `XXXX XXXX 1234` |
| `m360_passport_details` | `JSONB` | YES | NULL | -- | Passport data |
| `m360_driving_license_details` | `JSONB` | YES | NULL | -- | DL data |
| `m360_voter_details` | `JSONB` | YES | NULL | -- | Voter ID data |
| `m360_ration_card_details` | `JSONB` | YES | NULL | -- | Ration card data |
| `m360_bank_accounts` | `JSONB` | YES | NULL | -- | `[{account_masked, ifsc, bank_name}]` |
| `m360_employment_details` | `JSONB` | YES | NULL | -- | UAN, EPFO, employment |
| `m360_addresses` | `JSONB` | YES | NULL | -- | `[{address, city, state, pincode, type, source}]` |
| `m360_credit_score` | `INTEGER` | YES | NULL | -- | Credit score (300-900) |
| `m360_mobile_intelligence` | `JSONB` | YES | NULL | -- | `{valid, subscriber_status, connection_type, provider, connection_date}` |
| `m360_risk_intelligence` | `JSONB` | YES | NULL | -- | `{safe, risk_level, reason, description}` |
| `m360_social_profiles` | `JSONB` | YES | NULL | -- | `[{platform, url, username}]` |
| `raw_response` | `JSONB` | YES | NULL | -- | Full API response for audit |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Record creation |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

---

### 2.7 cashback_ledger

Double-entry ledger for all cashback transactions. Immutable -- rows are only inserted, never updated (except `expired_at`).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Ledger entry ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | User |
| `transaction_type` | `TEXT` | NO | -- | CHECK: `earned`, `applied`, `expired`, `bonus`, `referral_bonus`, `promotional`, `adjustment`, `reversal`, `discount` | Transaction type |
| `amount_paise` | `BIGINT` | NO | -- | CHECK: > 0 | Amount (always positive, type determines direction) |
| `balance_after_paise` | `BIGINT` | NO | -- | -- | Running balance after transaction |
| `payment_id` | `UUID` | YES | NULL | FK -> `payments(id)` ON DELETE SET NULL | Related payment |
| `tenancy_id` | `UUID` | YES | NULL | FK -> `tenancies(id)` ON DELETE SET NULL | Related tenancy |
| `description` | `TEXT` | NO | -- | -- | Human-readable description |
| `promo_code` | `TEXT` | YES | NULL | -- | Promotional code used |
| `referral_user_id` | `UUID` | YES | NULL | FK -> `users(id)` | Referring user |
| `reference_id` | `UUID` | YES | NULL | -- | Reference entity ID |
| `reference_type` | `TEXT` | YES | NULL | -- | Reference entity type |
| `expires_at` | `TIMESTAMPTZ` | YES | NULL | -- | When cashback expires (90 days) |
| `expired_at` | `TIMESTAMPTZ` | YES | NULL | -- | When actually expired |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Entry creation time |

**Transaction type semantics:**
- **Credits** (add to balance): `earned`, `bonus`, `referral_bonus`, `promotional`
- **Debits** (subtract from balance): `applied`, `reversal`, `expired`, `adjustment`
- **Audit only** (no wallet impact): `discount` (records instant 1% rent discount)

**Unique Indexes:** `(payment_id, transaction_type) WHERE transaction_type = 'earned'`, `(payment_id, transaction_type) WHERE transaction_type = 'discount'` -- prevents double-credit

---

### 2.8 waitlist_entries

Tracks user position in the waitlist with admin review workflow. Created automatically on user signup via trigger.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Entry ID |
| `user_id` | `UUID` | NO | -- | UNIQUE, FK -> `auth.users(id)` ON DELETE CASCADE | User (one entry per user) |
| `position` / `waitlist_position` | `INTEGER` | NO | -- | -- | Queue position (lower = earlier) |
| `admin_review` | `TEXT` | NO | `'due'` | CHECK: `due`, `in_progress`, `approved`, `rejected` | Admin review status |
| `rejection_reasons` | `TEXT[]` | YES | `'{}'` | -- | Array of rejection reasons |
| `next_application_at` | `TIMESTAMPTZ` | YES | NULL | -- | Cooldown after rejection |
| `priority_boost` | `INTEGER` | NO | `0` | -- | Cumulative referral boost |
| `extraction_id` | `UUID` | YES | NULL | FK -> `extracted_rental_info(id)` | Linked agreement extraction |
| `invite_code_id` | `UUID` | YES | NULL | FK -> `invite_codes(id)` | Used invite code |
| `batch_number` | `INTEGER` | YES | `1` | -- | Batch assignment |
| `risk_level` | `TEXT` | YES | `'PENDING'` | CHECK: `LOW`, `MED`, `HIGH`, `PENDING` | Computed risk level |
| `risk_factors` | `JSONB` | YES | `'[]'` | -- | Risk factor details |
| `risk_computed_at` | `TIMESTAMPTZ` | YES | NULL | -- | When risk was computed |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Entry creation |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

---

### 2.9 utility_verifications

Electricity bill verifications for address proof. Validates that the tenant's claimed address matches their utility bill address.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Verification ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | User |
| `tenancy_id` | `UUID` | YES | NULL | FK -> `tenancies(id)` ON DELETE SET NULL | Associated tenancy |
| `utility_type` | `TEXT` | NO | `'electricity'` | CHECK: `electricity` | Currently electricity only |
| `operator_code` | `TEXT` | NO | -- | -- | e.g., `BESCOM`, `TPDDL` |
| `operator_name` | `TEXT` | YES | NULL | -- | Human-readable name |
| `consumer_number` | `TEXT` | NO | -- | -- | Consumer/account number |
| `consumer_name` | `TEXT` | YES | NULL | -- | Name on bill |
| `status` | `TEXT` | NO | `'pending'` | CHECK: `pending`, `success`, `failed`, `not_found` | Verification status |
| `verification_reference` | `TEXT` | YES | NULL | -- | API Club reference |
| `bill_amount_paise` | `BIGINT` | YES | NULL | -- | Bill amount |
| `bill_due_date` | `DATE` | YES | NULL | -- | Bill due date |
| `bill_period_from` | `DATE` | YES | NULL | -- | Billing period start |
| `bill_period_to` | `DATE` | YES | NULL | -- | Billing period end |
| `bill_address` | `TEXT` | YES | NULL | -- | Address on bill |
| `bill_data` | `JSONB` | YES | NULL | -- | Full bill response |
| `address_match_score` | `DECIMAL(5,2)` | YES | NULL | -- | Match with tenancy address |
| `address_verified` | `BOOLEAN` | NO | `false` | -- | Whether address matches |
| `name_match_score` | `DECIMAL(5,2)` | YES | NULL | -- | Consumer name vs landlord match |
| `name_verified` | `BOOLEAN` | NO | `false` | -- | Whether name matches landlord |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |
| `verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | Verification timestamp |

---

### 2.10 notifications

In-app notifications for users.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Notification ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | Recipient |
| `title` | `TEXT` | NO | -- | -- | Notification title |
| `body` | `TEXT` | NO | -- | -- | Notification body text |
| `notification_type` | `TEXT` | NO | -- | CHECK: see expanded list below | Type category |
| `action_type` | `TEXT` | YES | NULL | -- | `navigate`, `open_url`, etc. |
| `action_data` | `JSONB` | YES | NULL | -- | `{screen, params}` or `{url}` |
| `is_read` | `BOOLEAN` | NO | `false` | -- | Read status |
| `read_at` | `TIMESTAMPTZ` | YES | NULL | -- | When read |
| `dismissed_at` | `TIMESTAMPTZ` | YES | NULL | -- | Soft delete |
| `scheduled_for` | `TIMESTAMPTZ` | NO | `NOW()` | -- | When to show |
| `expires_at` | `TIMESTAMPTZ` | YES | NULL | -- | Auto-expire date |
| `related_entity_type` | `TEXT` | YES | NULL | -- | `payment`, `tenancy`, etc. |
| `related_entity_id` | `UUID` | YES | NULL | -- | Related entity ID |
| `priority` | `TEXT` | NO | `'normal'` | CHECK: `low`, `normal`, `high`, `urgent` | Priority level |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |

**Notification types:** `payment_reminder`, `payment_success`, `payment_failed`, `cashback_earned`, `cashback_expiring`, `landlord_approved`, `landlord_disputed`, `verification_complete`, `verification_required`, `general`, `promo`, `waitlist_approved`, `waitlist_rejected`, `rent_due`, `rent_due_tomorrow`, `rent_overdue`, `settlement_complete`, `settlement_failed`, `landlord_confirmed`, `landlord_rejected`, `app_update`, `reminder_utility`, `reminder_landlord_invite`, `reminder_agreement`

---

### 2.11 notification_queue

Outbound notification delivery queue (push, SMS, WhatsApp, email).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Queue entry ID |
| `user_id` | `UUID` | YES | NULL | FK -> `users(id)` ON DELETE CASCADE | Recipient |
| `notification_type` | `TEXT` | NO | `'push'` | CHECK: `push`, `whatsapp`, `sms`, `email` | Delivery channel |
| `payload` | `JSONB` | NO | `'{}'` | -- | Notification content |
| `status` | `TEXT` | NO | `'pending'` | CHECK: `pending`, `processing`, `sent`, `failed` | Delivery status |
| `scheduled_for` | `TIMESTAMPTZ` | NO | `NOW()` | -- | When to send |
| `sent_at` | `TIMESTAMPTZ` | YES | NULL | -- | When sent |
| `error_message` | `TEXT` | YES | NULL | -- | Delivery error |
| `external_id` | `TEXT` | YES | NULL | -- | External service reference |
| `retry_count` | `INTEGER` | NO | `0` | -- | Number of retries attempted |
| `max_retries` | `INTEGER` | NO | `3` | -- | Maximum retry attempts |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Queue entry creation |

---

### 2.12 payment_methods

Saved payment methods (UPI, Cards, Net Banking). Supports soft deletion.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Payment method ID |
| `user_id` | `UUID` | NO | -- | FK -> `auth.users(id)` ON DELETE CASCADE | Owner |
| `type` | `TEXT` | NO | -- | CHECK: `upi`, `card`, `netbanking` | Method type |
| `display_name` | `TEXT` | NO | -- | -- | e.g., "HDFC Debit ****1234" |
| `upi_vpa` | `TEXT` | YES | NULL | -- | UPI VPA (e.g., `user@oksbi`) |
| `upi_provider` | `TEXT` | YES | NULL | -- | UPI app name |
| `card_token` | `TEXT` | YES | NULL | -- | Gateway tokenized card (never full details) |
| `card_last4` | `VARCHAR(4)` | YES | NULL | -- | Last 4 digits |
| `card_network` | `TEXT` | YES | NULL | CHECK: `visa`, `mastercard`, `rupay`, `amex`, `diners`, `maestro` | Card network |
| `card_type` | `TEXT` | YES | NULL | CHECK: `credit`, `debit`, `prepaid` | Card type |
| `card_issuer` | `TEXT` | YES | NULL | -- | Issuing bank |
| `card_expiry` | `TEXT` | YES | NULL | -- | MM/YY format |
| `card_expiry_month` | `INTEGER` | YES | NULL | CHECK: 1-12 | Structured expiry month |
| `card_expiry_year` | `INTEGER` | YES | NULL | CHECK: 2024-2050 | Structured expiry year |
| `bank_code` | `TEXT` | YES | NULL | -- | Net banking bank code |
| `bank_name` | `TEXT` | YES | NULL | -- | Bank name |
| `nickname` | `TEXT` | YES | NULL | -- | User-defined friendly name |
| `is_default` | `BOOLEAN` | NO | `false` | -- | Default payment method |
| `is_verified` | `BOOLEAN` | NO | `false` | -- | Whether verified |
| `verification_status` | `TEXT` | YES | `'pending'` | CHECK: `pending`, `verified`, `failed`, `expired` | Verification status |
| `verified_at` | `TIMESTAMPTZ` | YES | NULL | -- | Verification timestamp |
| `payment_gateway` | `TEXT` | YES | `'payu'` | -- | Gateway provider |
| `gateway_instrument_id` | `TEXT` | YES | NULL | -- | Gateway instrument reference |
| `metadata` | `JSONB` | YES | `'{}'` | -- | Provider-specific data |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |
| `deleted_at` | `TIMESTAMPTZ` | YES | NULL | -- | Soft delete timestamp |

**View:** `payment_methods_safe` -- excludes `card_token` for client-facing queries.

---

### 2.13 refunds

Tracks refund requests and their processing status.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Refund ID |
| `payment_id` | `UUID` | NO | -- | FK -> `payments(id)` ON DELETE RESTRICT | Source payment |
| `amount_paise` | `BIGINT` | NO | -- | CHECK: > 0 | Refund amount in paise |
| `status` | `TEXT` | NO | `'requested'` | CHECK: `requested`, `processing`, `completed`, `failed`, `rejected`, `cancelled` | Refund status |
| `reason` | `TEXT` | NO | -- | -- | Refund reason |
| `rejection_reason` | `TEXT` | YES | NULL | -- | Why refund was rejected |
| `payu_refund_id` | `TEXT` | YES | NULL | -- | PayU refund transaction ID |
| `payu_status` | `TEXT` | YES | NULL | -- | Raw PayU status |
| `payu_response` | `JSONB` | YES | NULL | -- | Full PayU response |
| `payment_gateway` | `TEXT` | YES | `'payu'` | -- | Gateway used |
| `gateway_refund_id` | `TEXT` | YES | NULL | -- | Generic gateway refund ID |
| `gateway_refund_status` | `TEXT` | YES | NULL | -- | Generic gateway refund status |
| `gateway_metadata` | `JSONB` | YES | `'{}'` | -- | Gateway-specific data |
| `refund_arn` | `TEXT` | YES | NULL | -- | Acquirer Reference Number |
| `bank_reference` | `TEXT` | YES | NULL | -- | Bank reference |
| `initiated_by` | `UUID` | YES | NULL | FK -> `auth.users(id)` | Who initiated |
| `processed_by` | `TEXT` | YES | NULL | -- | `system`, `admin`, or admin user ID |
| `idempotency_key` | `TEXT` | YES | NULL | UNIQUE | Prevents duplicate refunds |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |
| `processed_at` | `TIMESTAMPTZ` | YES | NULL | -- | When processed by gateway |
| `completed_at` | `TIMESTAMPTZ` | YES | NULL | -- | When money credited back |

---

### 2.14 referral_codes

Referral and promotional codes for user acquisition.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Code ID |
| `code` | `VARCHAR(10)` | NO | -- | UNIQUE | The referral code string |
| `owner_user_id` | `UUID` | YES | NULL | FK -> `auth.users(id)` ON DELETE SET NULL | Code owner (NULL for system promos) |
| `max_uses` | `INTEGER` | YES | `10` | -- | Maximum redemptions |
| `current_uses` | `INTEGER` | NO | `0` | CHECK: >= 0 | Current redemption count |
| `reward_amount_paise` | `BIGINT` | NO | `10000` | -- | DEPRECATED: Use referee/referrer fields |
| `referrer_reward_paise` | `BIGINT` | NO | `10000` | -- | Reward for code owner (Rs 100) |
| `referee_reward_paise` | `BIGINT` | NO | `10000` | -- | Reward for code user (Rs 100) |
| `is_active` | `BOOLEAN` | NO | `true` | -- | Whether code is active |
| `expires_at` | `TIMESTAMPTZ` | YES | NULL | -- | Expiration date |
| `code_type` | `TEXT` | NO | `'user'` | CHECK: `user`, `promo`, `influencer`, `partner` | Code category |
| `campaign_name` | `TEXT` | YES | NULL | -- | Campaign name for promos |
| `metadata` | `JSONB` | YES | `'{}'` | -- | Additional data |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

---

### 2.15 referral_redemptions

Tracks which users redeemed which referral codes. Each user can only use one referral code ever.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Redemption ID |
| `referral_code_id` | `UUID` | NO | -- | FK -> `referral_codes(id)` ON DELETE RESTRICT | Code used |
| `referee_user_id` | `UUID` | NO | -- | FK -> `auth.users(id)` ON DELETE CASCADE, UNIQUE | User who used the code |
| `referee_reward_paise` | `BIGINT` | NO | -- | -- | Reward for referee |
| `referrer_reward_paise` | `BIGINT` | NO | -- | -- | Reward for referrer |
| `referee_credited` | `BOOLEAN` | NO | `false` | -- | Whether referee cashback credited |
| `referrer_credited` | `BOOLEAN` | NO | `false` | -- | Whether referrer cashback credited |
| `referee_credited_at` | `TIMESTAMPTZ` | YES | NULL | -- | Referee credit timestamp |
| `referrer_credited_at` | `TIMESTAMPTZ` | YES | NULL | -- | Referrer credit timestamp |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Redemption time |

---

### 2.16 invite_codes

Admin-generated 4-character invite codes. Format: 2 letters + 2 digits in shuffled positions. Letters exclude I/O, digits exclude 0/1 to avoid confusion.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Code ID |
| `code` | `VARCHAR(4)` | NO | -- | UNIQUE | 4-character invite code |
| `status` | `TEXT` | NO | `'available'` | CHECK: `available`, `used`, `revoked` | Code status |
| `used_by` | `UUID` | YES | NULL | FK -> `auth.users(id)` ON DELETE SET NULL | Who used it |
| `used_at` | `TIMESTAMPTZ` | YES | NULL | -- | When used |
| `batch_number` | `INTEGER` | NO | `1` | -- | Generation batch |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |

---

### 2.17 invite_code_attempts

Rate limiting table for invite code validation attempts.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Attempt ID |
| `user_id` | `UUID` | NO | -- | FK -> `auth.users(id)` ON DELETE CASCADE | User attempting |
| `code_attempted` | `VARCHAR(10)` | NO | -- | -- | Code that was tried |
| `was_valid` | `BOOLEAN` | NO | `false` | -- | Whether attempt succeeded |
| `attempted_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Attempt timestamp |

---

### 2.18 idempotency_keys

Ensures exactly-once processing for critical operations (especially payments).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Record ID |
| `key` | `TEXT` | NO | -- | UNIQUE | Client-provided idempotency key |
| `user_id` | `UUID` | YES | NULL | FK -> `users(id)` ON DELETE CASCADE | Associated user |
| `endpoint` | `TEXT` | NO | -- | -- | e.g., `initiate-payment`, `verify-bank` |
| `request_hash` | `TEXT` | NO | -- | -- | SHA256 of request body |
| `request_body` | `JSONB` | YES | NULL | -- | Stored request |
| `response_status` | `INTEGER` | YES | NULL | -- | Cached HTTP status |
| `response_body` | `JSONB` | YES | NULL | -- | Cached response |
| `status` | `TEXT` | NO | `'pending'` | CHECK: `pending`, `processing`, `completed`, `failed` | Processing status |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `completed_at` | `TIMESTAMPTZ` | YES | NULL | -- | Completion time |
| `expires_at` | `TIMESTAMPTZ` | NO | `NOW() + 24h` | -- | TTL (auto-cleaned by cron) |
| `locked_at` | `TIMESTAMPTZ` | YES | NULL | -- | Lock acquisition time |
| `locked_by` | `TEXT` | YES | NULL | -- | Instance ID holding lock |

---

### 2.19 audit_logs

Immutable audit trail for all significant system events. Retained for 1 year (payment and security logs kept indefinitely).

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Log entry ID |
| `user_id` | `UUID` | YES | NULL | FK -> `users(id)` ON DELETE SET NULL | Who performed the action |
| `actor_type` | `TEXT` | NO | -- | CHECK: `user`, `system`, `admin`, `service` | Actor category |
| `action` | `TEXT` | NO | -- | -- | e.g., `PAYMENT_INITIATED`, `BANK_VERIFIED` |
| `action_category` | `TEXT` | NO | -- | CHECK: `auth`, `payment`, `verification`, `tenancy`, `profile`, `landlord`, `cashback`, `notification`, `system`, `security` | Action domain |
| `entity_type` | `TEXT` | YES | NULL | -- | Affected entity table name |
| `entity_id` | `UUID` | YES | NULL | -- | Affected entity ID |
| `details` | `JSONB` | YES | NULL | -- | Action-specific data |
| `old_values` | `JSONB` | YES | NULL | -- | Previous state |
| `new_values` | `JSONB` | YES | NULL | -- | New state |
| `ip_address` | `INET` | YES | NULL | -- | Client IP |
| `user_agent` | `TEXT` | YES | NULL | -- | Client user agent |
| `request_id` | `TEXT` | YES | NULL | -- | Correlation ID |
| `function_name` | `TEXT` | YES | NULL | -- | Edge function name |
| `function_version` | `TEXT` | YES | NULL | -- | Edge function version |
| `status` | `TEXT` | NO | `'success'` | CHECK: `success`, `failure`, `partial` | Result status |
| `error_code` | `TEXT` | YES | NULL | -- | Error code |
| `error_message` | `TEXT` | YES | NULL | -- | Error details |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Log timestamp |

---

### 2.20 device_tokens

Push notification tokens for mobile and web devices.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Token record ID |
| `user_id` | `UUID` | NO | -- | FK -> `users(id)` ON DELETE CASCADE | Token owner |
| `token` | `TEXT` | NO | -- | UNIQUE with `platform` | FCM/APNs token |
| `platform` | `TEXT` | NO | -- | CHECK: `ios`, `android`, `web` | Device platform |
| `device_id` | `TEXT` | YES | NULL | -- | Device identifier |
| `device_name` | `TEXT` | YES | NULL | -- | Device name |
| `is_active` | `BOOLEAN` | NO | `true` | -- | Active status |
| `last_used_at` | `TIMESTAMPTZ` | YES | NULL | -- | Last usage |
| `bundle_id` | `TEXT` | YES | NULL | -- | App bundle ID |
| `sandbox` | `BOOLEAN` | NO | `false` | -- | iOS sandbox/production |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | -- | Last update |

---

### 2.21 payment_schedules

Auto-pay / scheduled payment configurations.

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK | Schedule ID |
| `user_id` | `UUID` | NO | -- | FK -> `auth.users(id)` ON DELETE CASCADE | User |
| `tenancy_id` | `UUID` | NO | -- | FK -> `tenancies(id)` ON DELETE CASCADE | Tenancy |
| `payment_method` | `TEXT` | NO | -- | CHECK: `upi`, `card`, `netbanking`, `wallet` | Method |
| `scheduled_day` | `INTEGER` | NO | -- | CHECK: 1-28 | Day of month |
| `auto_apply_cashback` | `BOOLEAN` | YES | `false` | -- | Auto-apply cashback |
| `upi_vpa` | `TEXT` | YES | NULL | -- | UPI VPA |
| `card_token` | `TEXT` | YES | NULL | -- | Tokenized card |
| `bank_code` | `TEXT` | YES | NULL | -- | Bank code |
| `status` | `TEXT` | NO | `'active'` | CHECK: `active`, `paused`, `cancelled` | Schedule status |
| `next_execution_date` | `DATE` | YES | NULL | -- | Next payment date |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | -- | Creation time |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | -- | Last update |

**Unique Index:** `(user_id, tenancy_id) WHERE status = 'active'` -- one active schedule per tenancy

---

### 2.22 Other Tables

#### supported_cities
Cities where Flent Secured is available. Public read access.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | City ID |
| `city_name` | `TEXT` | -- | City name (UNIQUE) |
| `state` | `TEXT` | NULL | State name |
| `is_active` | `BOOLEAN` | `true` | Whether active |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation time |

**Seed data:** Bangalore (Karnataka), Mumbai (Maharashtra)

#### fee_config
Dynamic payment gateway fee rates. Replaces hardcoded environment variables.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Config ID |
| `method` | `TEXT` | -- | UNIQUE. e.g., `upi`, `credit_card`, `debit_card`, `netbanking` |
| `rate` | `NUMERIC` | -- | Fee rate (e.g., 0.02 = 2%) |
| `fee_type` | `TEXT` | `'percentage'` | Fee calculation type |
| `is_active` | `BOOLEAN` | `true` | Whether active |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

**Seed values:** UPI = 0%, Credit Card = 2%, Debit Card = 2%, Netbanking = 1.5%

#### app_config
Dynamic application configuration stored as key-value pairs.

| Column | Type | Description |
|--------|------|-------------|
| `key` | `TEXT` | PK. Config key name |
| `value` | `JSONB` | Config value |
| `updated_at` | `TIMESTAMPTZ` | Last update |

**Seed keys:**
- `review_timeline`: `{"hours": 24, "display_text": "Approximately 24 hrs"}`
- `batch_config`: `{"current_batch": 1, "batch_size": 200, ...}`
- `landlord_transfers`: `{"enabled": true, ...}` (system-level transfer pause flag)

#### notification_preferences
User-level notification settings. Auto-created on user signup.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | `UUID` | -- | PK, FK -> `auth.users(id)` |
| `push_enabled` | `BOOLEAN` | `true` | Push notifications |
| `sms_enabled` | `BOOLEAN` | `true` | SMS notifications |
| `whatsapp_enabled` | `BOOLEAN` | `true` | WhatsApp |
| `email_enabled` | `BOOLEAN` | `true` | Email |
| `payment_reminders` | `BOOLEAN` | `true` | Payment reminder preference |
| `payment_confirmations` | `BOOLEAN` | `true` | Payment confirmation |
| `cashback_notifications` | `BOOLEAN` | `true` | Cashback updates |
| `landlord_updates` | `BOOLEAN` | `true` | Landlord status |
| `verification_updates` | `BOOLEAN` | `true` | Verification status |
| `promotional` | `BOOLEAN` | `false` | Marketing (opt-in required) |
| `quiet_hours_enabled` | `BOOLEAN` | `false` | Enable quiet hours |
| `quiet_hours_start` | `TIME` | NULL | e.g., 22:00 |
| `quiet_hours_end` | `TIME` | NULL | e.g., 08:00 |

#### otp_requests
Server-side OTP routing state for unified auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | PK | Request ID |
| `phone` | `TEXT` | NOT NULL | Phone number |
| `provider` | `TEXT` | CHECK: `twilio`, `cashfree_m360` | OTP provider |
| `verification_id` | `TEXT` | -- | Twilio SID or Cashfree verification_id |
| `status` | `TEXT` | CHECK: `pending`, `verified`, `expired`, `failed` | Request status |
| `created_at` | `TIMESTAMPTZ` | -- | Creation time |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Expiration time |
| `verified_at` | `TIMESTAMPTZ` | -- | Verification time |
| `client_ip` | `TEXT` | -- | Client IP for rate limiting |

#### processed_webhooks
Webhook deduplication table. Auto-cleaned after 7 days.

| Column | Type | Description |
|--------|------|-------------|
| `event_id` | `TEXT` | PK. Webhook event ID |
| `payment_gateway` | `TEXT` | Gateway source |
| `payment_id` | `UUID` | FK -> `payments(id)` |
| `processed_at` | `TIMESTAMPTZ` | When processed |
| `expires_at` | `TIMESTAMPTZ` | Auto-expire after 7 days |

#### deleted_users_archive
Archive of deleted user data for compliance and potential recovery.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` | PK |
| `original_user_id` | `UUID` | UNIQUE. Original user ID |
| `deleted_at` | `TIMESTAMPTZ` | Deletion time |
| `user_data` | `JSONB` | Archived user profile |
| `waitlist_data` | `JSONB` | Archived waitlist entry |
| `extracted_rental_info_data` | `JSONB` | Archived extraction data |
| `rental_parties_data` | `JSONB` | Archived party data |
| `tenancies_data` | `JSONB` | Archived tenancies |
| `payments_data` | `JSONB` | Archived payments |
| `bank_accounts_data` | `JSONB` | Archived bank accounts |
| `auth_metadata` | `JSONB` | Auth metadata |
| `deletion_reason` | `TEXT` | Default: `user_requested` |
| `deletion_initiated_by` | `TEXT` | Default: `user` |

---

## 3. Database Functions and Triggers

### 3.1 User Lifecycle Functions

#### `handle_new_user()` -- TRIGGER on `auth.users` AFTER INSERT
Creates a `public.users` row when a new Supabase Auth user signs up. Role-aware: reads `user_type` from `raw_user_meta_data` to set `role` (e.g., landlord web signup passes `user_type: 'landlord'`). Normalizes phone numbers to 10-digit format. Uses `ON CONFLICT (id) DO UPDATE` for re-registration edge cases.

**Trigger:** `on_auth_user_created` on `auth.users`

#### `sync_phone_columns()` -- TRIGGER on `users` BEFORE UPDATE
Bidirectional sync between V1 and V2 column pairs:
- `phone` <-> `phone_number` (10-digit normalization)
- `onboarding_completed` <-> `is_onboarded`
- `avatar_url` <-> `profile_image_url`

**Trigger:** `sync_phone_columns_trigger` on `public.users`

#### `check_and_advance_to_active(p_user_id UUID)` -- FUNCTION
Advances a user from `approved` to `active` status if bank verification is complete. Bank verification is the mandatory gate; utility and landlord verification are optional.

#### `sync_user_status_on_waitlist_change()` -- TRIGGER on `waitlist_entries` AFTER UPDATE
Fires on UPDATE of `waitlist_entries.admin_review`. Uses `IS DISTINCT FROM` checks to only fire on actual value transitions. When admin_review changes:
- `approved`: Sets `user_status = 'approved'` and activates the user's `pending_verification` tenancy to `active`.
- `rejected`: Sets `user_status = 'not_eligible'`.

> **Note:** Prior to migration `20260308000003`, rejection incorrectly kept `user_status` as `'waitlisted'` instead of setting `'not_eligible'`.

**Trigger:** `on_waitlist_admin_review_change` on `waitlist_entries`

### 3.2 Waitlist Functions

#### `join_waitlist(p_user_id UUID)` -- FUNCTION
Idempotently adds a user to the waitlist. Returns existing entry if one exists, otherwise assigns next position and creates entry.

#### `next_waitlist_position()` -- FUNCTION
Returns `MAX(position) + 1` from `waitlist_entries`.

#### `apply_waitlist_priority_boost(p_user_id UUID, p_boost INTEGER)` -- FUNCTION
Decrements the user's waitlist position by `p_boost` (minimum position: 1). Tracks cumulative boost.

#### `get_onboarded_count()` -- FUNCTION
Returns count of `waitlist_entries` where `admin_review = 'approved'`.

#### `auto_join_waitlist()` -- TRIGGER on `users` AFTER INSERT
**DROPPED.** Users must now confirm their agreement before joining the waitlist (gated by `user_status` state machine).

#### `link_extraction_to_waitlist()` -- TRIGGER on `extracted_rental_info` AFTER INSERT
Links a new extraction record to the user's existing waitlist entry.

### 3.3 Cashback Functions

#### `get_cashback_balance(p_user_id UUID)` -- FUNCTION
Returns the running balance from the most recent `cashback_ledger` entry.

#### `get_available_cashback(p_user_id UUID)` -- FUNCTION
Computes available cashback:
- Credits: `earned`, `bonus`, `referral_bonus`, `promotional`
- Debits: `applied`, `reversal`, `expired`, `adjustment`
- Returns `GREATEST(credits - debits, 0)`

#### `debit_cashback(p_user_id, p_amount, p_payment_id, p_tenancy_id, p_description)` -- FUNCTION
Atomic cashback debit with row-level locking. Raises exception if insufficient balance. Inserts `applied` ledger entry.

#### `sync_cashback_balance()` -- TRIGGER on `cashback_ledger` AFTER INSERT/UPDATE/DELETE
Recalculates and updates `users.cashback_balance_paise` whenever the ledger changes.

#### `auto_reverse_cashback_on_refund()` -- TRIGGER on `payments` AFTER UPDATE
When payment status changes to `refunded`, automatically inserts `reversal` entries for any `discount` or `earned` cashback entries.

#### `expire_old_cashback()` -- FUNCTION (called by cron)
Processes expired cashback: inserts `expired` entries and marks original entries as expired.

### 3.4 Payment Functions

#### `set_payment_user_id()` -- TRIGGER on `payments` BEFORE INSERT
Auto-populates `user_id` from the tenancy when not explicitly provided.

#### `expire_stale_payments()` -- FUNCTION (called by cron)
Marks payments in `initiated` or `processing` status as `failed` after 5 minutes without a gateway response.

### 3.5 Notification Functions

#### `send_payment_reminders()` -- FUNCTION (called by cron)
Runs daily at 9 AM IST. For each active tenancy, checks if rent is due in 3 days and no payment exists. Enqueues WhatsApp and push notifications.

#### `process_notification_queue()` -- FUNCTION (called by cron)
Processes pending notifications. Routes to appropriate edge function (`send-whatsapp`, `send-sms`, `send-push-notification`) via `net.http_post()`.

#### `create_notification(...)` -- FUNCTION
Helper to create in-app notification entries.

#### `mark_notifications_read(p_user_id, p_notification_ids[])` -- FUNCTION
Marks specific or all notifications as read.

#### `get_unread_notification_count(p_user_id)` -- FUNCTION
Returns count of unread, non-expired, currently-scheduled notifications.

#### `create_default_notification_preferences()` -- TRIGGER on `users` AFTER INSERT
Auto-creates default `notification_preferences` row for each new user.

### 3.6 Referral Functions

#### `validate_referral_code(p_code TEXT)` -- FUNCTION
Validates a referral code. Returns `is_valid`, `code_id`, `reward_paise`, and `error_message`.

#### `apply_referral_code(p_user_id UUID, p_code TEXT)` -- FUNCTION
Applies a referral code: validates, checks self-use, creates `referral_redemptions` record.

#### `generate_user_referral_code(p_user_id UUID)` -- FUNCTION
Generates or retrieves a unique 6-character alphanumeric referral code for a user.

### 3.7 Invite Code Functions

#### `generate_invite_codes(p_count INTEGER)` -- FUNCTION
Generates a batch of 4-character invite codes. Letters: A-Z excluding I/O. Digits: 2-9 excluding 0/1.

#### `claim_invite_code(p_user_id UUID, p_code TEXT)` -- FUNCTION
Atomic validate + claim with `SELECT FOR UPDATE SKIP LOCKED` to prevent race conditions.

### 3.8 Landlord Verification Functions

#### `generate_landlord_otp(p_tenancy_id UUID, p_email TEXT)` -- FUNCTION
Generates a 6-digit OTP for landlord verification. Validates email matches, rate limits to 5 attempts, stores SHA-256 hash, expires in 10 minutes.

#### `verify_landlord_otp(p_tenancy_id UUID, p_otp TEXT)` -- FUNCTION
Verifies landlord OTP by comparing hash. Clears OTP on success.

### 3.9 Bank Account Functions

#### `ensure_single_primary_bank_account()` -- TRIGGER on `bank_accounts`
Ensures only one primary account per user per party_type.

### 3.10 Idempotency Functions

#### `acquire_idempotency_lock(key, user_id, endpoint, request_hash, request_body, instance_id)` -- FUNCTION
Checks for existing key, returns cached response if completed, acquires lock if new. Uses `FOR UPDATE SKIP LOCKED`.

#### `complete_idempotency(key, status, response)` -- FUNCTION
Marks idempotency record as completed with cached response.

### 3.11 Device Token Functions

#### `register_device_token(...)` -- FUNCTION
Upserts a device token. Reactivates if previously deactivated.

#### `deactivate_device_token(token, platform)` -- FUNCTION
Marks a device token as inactive (e.g., on logout).

#### `get_user_device_tokens(user_id)` -- FUNCTION
Returns all active device tokens for a user.

### 3.12 Infrastructure Functions

#### `invoke_edge_function(fn_name TEXT, body JSONB)` -- FUNCTION (SECURITY DEFINER)
Invokes a Supabase edge function with service role auth. Reads the service role key from `private.edge_function_config`. Only callable by postgres (pg_cron runs as superuser).

#### `generate_agreement_cert_id()` -- TRIGGER on `tenancies` BEFORE INSERT/UPDATE
Auto-generates `agreement_cert_id` in format `FS-AGR-YYYYMM-XXXXXXXX` when tenancy status changes to `active`.

### 3.13 Audit Triggers

| Trigger | Table | Events | Purpose |
|---------|-------|--------|---------|
| `trigger_audit_payment_status` | `payments` | UPDATE of `status` | Logs payment status transitions |
| `trigger_audit_tenancy_verification` | `tenancies` | UPDATE of verification flags | Logs verification flag changes |
| `trigger_audit_bank_accounts` | `bank_accounts` | INSERT/UPDATE/DELETE | Full audit trail |
| `trigger_audit_identity_verifications` | `identity_verifications` | INSERT | Logs new verifications |
| `trigger_audit_cashback_ledger` | `cashback_ledger` | INSERT | Logs cashback transactions |
| `trigger_audit_utility_verifications` | `utility_verifications` | INSERT/UPDATE | Logs utility verifications |
| `trigger_audit_app_config` | `app_config` | UPDATE | RBI PA/PG compliance audit |

### 3.14 updated_at Triggers

Every mutable table has a `BEFORE UPDATE` trigger that sets `updated_at = NOW()`:

`users`, `tenancies`, `payments`, `bank_accounts`, `identity_verifications`, `utility_verifications`, `device_tokens`, `payment_methods`, `refunds`, `referral_codes`, `notification_preferences`, `payment_schedules`, `waitlist_entries`, `extracted_rental_info`, `fee_config`

---

## 4. Cron Jobs

All jobs use `pg_cron` extension. Times shown in UTC (IST = UTC + 5:30).

| Job Name | Schedule | Type | Description |
|----------|----------|------|-------------|
| `payment-reminders` | `30 3 * * *` (9:00 AM IST daily) | SQL function | Sends payment reminders 3 days before due date via WhatsApp and push |
| `process-notifications` | `*/5 * * * *` (every 5 min) | SQL function | Processes pending notifications from `notification_queue` |
| `cleanup-idempotency-keys` | `30 20 * * *` (2:00 AM IST daily) | SQL query | Deletes expired idempotency keys |
| `expire-cashback` | `30 19 * * *` (1:00 AM IST daily) | SQL function | Expires cashback entries past their 90-day validity |
| `retry-failed-notifications` | `*/15 * * * *` (every 15 min) | SQL query | Resets failed notifications to `pending` for retry (up to `max_retries`, within 24h) |
| `cleanup-audit-logs` | `0 0 * * 0` (Sunday midnight UTC) | SQL query | Deletes audit logs older than 1 year (except `payment` and `security` categories) |
| `expire-stale-payments` | `* * * * *` (every minute) | SQL function | Marks payments stuck in `initiated`/`processing` for >5 minutes as `failed` |
| `expire-stale-otp-requests` | `*/5 * * * *` (every 5 min) | SQL query | Marks expired pending OTP requests as `expired` |
| `cleanup-processed-webhooks` | `0 3 * * *` (3:00 AM UTC daily) | SQL query | Deletes `processed_webhooks` entries past their 7-day TTL |
| `warmup-auth-otp` | `*/4 * * * *` (every 4 min) | Edge function | Keeps auth-otp edge function warm (via `invoke_edge_function`) |
| `poll-settlement-and-reconcile` | `*/30 * * * *` (every 30 min) | Edge function | Polls PayU settlement status for successful payments |
| `settle-to-landlord` | `15 * * * *` (hourly at :15) | Edge function | Disburses settled funds to landlord bank accounts |
| `cleanup-stale-payments` | `*/30 * * * *` (every 30 min) | Edge function | Additional cleanup via edge function |
| `extraction-recovery` | `*/30 * * * *` (every 30 min) | Edge function | Recovers stuck extraction processing jobs |

---

## 5. Row Level Security Policies

RLS is enabled on all tables. The security model follows a consistent pattern:

### Access Pattern Summary

| Table | Authenticated Users | Service Role |
|-------|-------------------|--------------|
| `users` | SELECT/UPDATE own row | Full access |
| `tenancies` | SELECT/INSERT/UPDATE own (by `user_id` or `landlord_user_id`) | Full access |
| `payments` | SELECT own (via tenancy join) | Full access for all operations |
| `bank_accounts` | SELECT/INSERT/UPDATE own; DELETE only if `verified = false` | Full access |
| `identity_verifications` | SELECT own | Full access |
| `cashback_ledger` | SELECT own | Full access |
| `idempotency_keys` | SELECT own | Full access |
| `audit_logs` | SELECT own (excluding `security`/`system` categories) | INSERT (append-only), SELECT all, **DELETE restricted** to rows older than 1 year AND not in `payment`/`security` categories. **No UPDATE policy** — UPDATEs are blocked entirely (Phase 8c immutability, 2026-04-26). |
| `extracted_rental_info` | SELECT/INSERT/UPDATE own | Full access |
| `device_tokens` | Full CRUD on own tokens | Full access |
| `notifications` | SELECT/UPDATE own | Full access |
| `notification_queue` | None | Full access (service only) |
| `payment_methods` | SELECT own (where `deleted_at IS NULL`), INSERT/UPDATE/DELETE own | Full access |
| `refunds` | SELECT own (via payment -> tenancy join) | Full access |
| `referral_codes` | SELECT active public codes; SELECT own codes | Full access |
| `referral_redemptions` | SELECT own; SELECT as referrer (via code owner) | Full access |
| `notification_preferences` | SELECT/UPDATE/INSERT own | Full access |
| `waitlist_entries` | SELECT own | Full access |
| `supported_cities` | SELECT all (public read) | -- |
| `fee_config` | SELECT all (public read) | -- |
| `app_config` | SELECT all (authenticated) | Full access |
| `invite_codes` | None | Full access (service only) |
| `invite_code_attempts` | None | Full access (service only) |
| `otp_requests` | None | Full access (service only) |
| `deleted_users_archive` | None | Full access (service only) |

### Key Security Principles

1. **Users can only see their own data.** All user-facing SELECT policies filter by `auth.uid() = user_id`.
2. **Write operations for sensitive tables are service-role only.** Payments, cashback, identity verifications, and refunds are modified exclusively through edge functions using the service role.
3. **Landlord cross-access** is handled via explicit policies (e.g., landlords can SELECT tenancies where `landlord_user_id = auth.uid()`).
4. **Audit logs** hide `security` and `system` category entries from regular users.
5. **Soft-deleted payment methods** are excluded from user SELECT queries via `deleted_at IS NULL`.

---

## 6. User Status State Machine

The `user_status` column on the `users` table is the master journey state. It uses the `user_status_enum` type.

### State Diagram

```
                    +-------------+
                    |  signed_up  |
                    +------+------+
                           |
                    Agreement uploaded
                    & confirmed
                           |
              +------------v-----------+
              | agreement_confirmed    |
              +------------+-----------+
                           |
                    Join waitlist
                    (edge function)
                           |
                  +--------v--------+
                  |   waitlisted    |
                  +--------+--------+
                           |
              +-----------/ \-----------+
              |                         |
        Admin approves           Admin rejects
              |                         |
      +-------v-------+     +----------v---------+
      |   approved    |     |   not_eligible      |
      +-------+-------+     +--------------------+
              |
       Bank verified
       (check_and_advance)
              |
      +-------v-------+
      |    active     |
      +---------------+
```

### Transitions

| From | To | Triggered By | Gate/Condition |
|------|----|-------------|----------------|
| `signed_up` | `agreement_confirmed` | `confirm-extraction` edge function | User confirms extracted rental data |
| `agreement_confirmed` | `waitlisted` | `join-waitlist` edge function | User enters waitlist |
| `waitlisted` | `approved` | `sync_user_status_on_waitlist_change()` trigger | Admin sets `waitlist_entries.admin_review = 'approved'` |
| `waitlisted` | `not_eligible` | `sync_user_status_on_waitlist_change()` trigger | Admin sets `waitlist_entries.admin_review = 'rejected'` |
| `approved` | `active` | `check_and_advance_to_active()` function | Bank verification complete (`tenancies.bank_verified = true`) |

### Business Rules

- **Agreement confirmation** is mandatory before waitlist entry. The auto-join-waitlist trigger was dropped.
- **Bank verification** is the mandatory gate from `approved` to `active`. Without it, users remain in `approved` but cannot make payments.
- **Utility verification** and **landlord approval** are optional. They are tracked on the `tenancies` table and affect cashback eligibility, not user status.
- **Tenancy activation** happens alongside waitlist approval: the `sync_user_status_on_waitlist_change` trigger also sets the tenancy from `pending_verification` to `active`.

---

## 7. Enums and Custom Types

| Type Name | Values | Used By |
|-----------|--------|---------|
| `user_role` | `tenant`, `landlord` | `users.role` |
| `user_status_enum` | `signed_up`, `agreement_confirmed`, `waitlisted`, `approved`, `active`, `not_eligible` | `users.user_status` |
| `extraction_status_enum` | `pending`, `in_progress`, `completed`, `failed` | V1 compatibility |
| `contract_upload_status` | `not_uploaded`, `uploading`, `upload_failed`, `processing`, `processing_failed`, `user_review`, `manual_review`, `confirmed`, `rejected_by_user`, `approved`, `rejected` | V1 compatibility |

---

## 8. Views

### `payment_methods_safe`
Excludes `card_token` from `payment_methods`. Filters out soft-deleted rows. Used for all client-facing queries.

### `waitlist` (V1 compatibility)
Maps `extracted_rental_info` to V1 waitlist format. Joins with `users` for referral data.

### `rental_parties` (V1 compatibility)
Exposes tenant and landlord names from `extracted_rental_info` as separate rows with party_type.

### `scheduled_jobs`
Read-only view of `cron.job` table for monitoring active cron jobs.

### `v_user_funnel`
Comprehensive admin view joining 90+ columns across the full user lifecycle. Built for the admin dashboard to provide a single-row-per-user summary from sign-up through payments.

**Lateral joins (all use `LATERAL ... LIMIT 1` for deduplication):**
1. `waitlist_entries` -- waitlist position and admin review status
2. `extracted_rental_info` -- agreement extraction data (rent, landlord, address)
3. `tenancies` -- tenancy status, verification flags, landlord details
4. `bank_accounts` -- primary bank account and verification status
5. `identity_verifications` -- M360 identity fields (`risk_level`, `credit_score`, KYC data)
6. Payment aggregates -- `total_paid`, `payment_count`, `last_payment_date`
7. Stamp aggregates -- `total_stamps`, `redeemed_stamps`

**Access control:** `REVOKE ALL` from `anon`; `GRANT SELECT` to `service_role` only.

> **Note:** Prior to migration `20260308000004`, the tenancies join was a plain `LEFT JOIN`, which produced duplicate rows when a user had multiple tenancy records. The migration also cleaned up orphan duplicate tenancies.

---

## 9. Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `rent-agreements` | Uploaded lease agreement PDFs/images | Authenticated users (own files), service role |
| `avatars` | User profile images | Authenticated users (own files) |

---

## 10. Extensions

| Extension | Purpose |
|-----------|---------|
| `pg_cron` | Scheduled background jobs |
| `pg_net` | HTTP requests from database (edge function invocation) |
| `pgcrypto` | UUID generation (`gen_random_uuid()`) |

### Private Schema

A `private` schema stores secrets:
- `private.edge_function_config`: Key-value table for the service role key, readable only by postgres (superuser). Used by `invoke_edge_function()` to authenticate cron-initiated edge function calls.

---

## 11. Recent Migrations

Migrations are located in `supabase/migrations/` and applied via `supabase db push` or `supabase migration up`.

### `20260308000003_fix_rejection_status_in_trigger.sql`

**Purpose:** Fixes the `sync_user_status_on_waitlist_change` trigger function. When `admin_review` changes to `'rejected'`, the trigger now correctly sets `user_status` to `'not_eligible'`. The previous migration (`20260308000002_auto_activate_tenancy_on_landlord_approval`) had a bug where rejection kept the status as `'waitlisted'`.

**Changes to trigger behavior:**
- On approval (`admin_review = 'approved'`): Sets `user_status = 'approved'` and activates the user's `pending_verification` tenancy to `active`.
- On rejection (`admin_review = 'rejected'`): Sets `user_status = 'not_eligible'`.
- Both paths use `IS DISTINCT FROM` checks to only fire on actual value transitions (prevents no-op updates from re-triggering).

### `20260308000004_fix_user_funnel_tenancy_dedup.sql`

**Purpose:** Fixes the `v_user_funnel` view producing duplicate rows when a user has multiple tenancy records. The root cause was that the `tenancies` join used a plain `LEFT JOIN` while all other entity joins already used `LATERAL ... LIMIT 1`.

**Changes:**
1. **Data cleanup:** Removes orphan duplicate tenancies. For users with multiple tenancy rows, keeps the one linked to the extraction record (`extraction_id` match), or the newest by `created_at` if they share the same `extraction_id`.
2. **View recreation:** Drops and recreates `v_user_funnel` with `LATERAL ... LIMIT 1` for the tenancies join, consistent with all other lateral joins.
3. **View scope:** Includes 90+ columns spanning `users`, `waitlist_entries`, `extracted_rental_info`, `tenancies`, `bank_accounts`, `identity_verifications`, and payment/stamp aggregates.
4. **Grants:** `REVOKE ALL` from `anon`; `GRANT SELECT` to `service_role` only.

### `20260425082914_waitlist_entries_user_fk_cascade.sql` (Phase 1 cleanup, 2026-04-25)

**Purpose:** Adds `ON DELETE CASCADE` foreign key from `waitlist_entries.user_id` to `users.id`. Cleans up orphan waitlist entries that had been inflating `get_onboarded_count()`.

**Changes:**
1. Deletes orphan rows where `user_id` no longer exists in `users`.
2. Adds the FK constraint idempotently.

### `20260425131920_payment_webhook_events_dedup.sql` (webhook hardening, 2026-04-25)

**Purpose:** Adds `payment_webhook_events` dedup table for replay defense on Cashfree (and other) webhooks. Composite PK `(source, event_id)`, 30-day retention via `cleanup_payment_webhook_events()` helper function.

**Note:** Currently dormant — webhook handlers still dedup via the existing `processed_webhooks` table. Cleanup option: drop one of the two tables in a follow-up.

### `20260425141812_drop_send_payment_reminders.sql` (Phase 8b, 2026-04-25)

**Purpose:** Drops the orphan `send_payment_reminders()` SQL function. Pre-archive verification confirmed zero callers (the corresponding edge fn `send-reminders` is part of Phase 6 archival).

### `20260425141937_audit_logs_immutability.sql` (Phase 8c, 2026-04-25, applied to prod 2026-04-26)

**Purpose:** Replaces the overly broad `audit_logs_service_all` policy with stricter command-scoped policies enforcing append-only semantics:
- `audit_logs_service_insert` — INSERT (append-only) for service_role.
- `audit_logs_service_select` — SELECT for service_role; existing `audit_logs_user_select` preserved for authenticated users.
- `audit_logs_service_cleanup_only` — DELETE only when `created_at < NOW() - INTERVAL '1 year'` AND `action_category NOT IN ('payment','security')`. Matches the cleanup-audit-logs cron pattern.
- **No UPDATE policy** — UPDATE is blocked entirely. Audit corrections must be logged as new rows with `action_category='audit_correction'`.

**Why:** RBI Master Direction on Digital Payment Security Controls + DPDP Act audit trail requirements imply payment + security audit rows should be immutable. The previous policy let any service-role code path silently rewrite or wipe audit trail.

### `20260425143501_payment_gateway_killswitch.sql` (Phase 3.5a, 2026-04-25)

**Purpose:** Lays the foundation for SERVER-DRIVEN payment gateway selection (replacing today's build-time `EXPO_PUBLIC_PAYMENT_GATEWAY` env var). Adds a `payment_gateway` row to `app_config` with `primary` (default `cashfree`) and `emergency_fallback` (`payu`) fields.

**Changes:**
1. Inserts the `app_config` row idempotently with the safe defaults.
2. Adds `get_payment_gateway()` SECURITY DEFINER helper function (returns `'cashfree'` if config missing or empty).
3. Grants EXECUTE only to `service_role`.

**Status:** Currently OBSERVE-ONLY in `initiate-payment` edge fn (Phase 3.5b) — the function logs `GATEWAY_DIVERGENCE` warnings when client-chosen gateway disagrees with server config but does not yet override. Flip to enforce in Phase 3.5c after observation period.
