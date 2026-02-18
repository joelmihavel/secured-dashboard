# Backend Context -- Flent Secured v2 Supabase

Authoritative reference for all backend infrastructure. Supabase project: `zqlowjveyqiagnbmfwsb`.

---

## 1. Database Tables (37 migrations)

### Core Tables

| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | id (UUID, FK auth.users), phone, name, email, avatar_url, onboarding_status, created_at | Extended from auth.users. onboarding_status tracks progression. |
| `tenancies` | id, user_id, landlord_user_id, property_name, property_address, property_city, property_pincode, monthly_rent_paise, security_deposit_paise, lease_start_date, lease_end_date, rent_due_day, status | Status: draft/active/expired/terminated. Core entity linking tenant to property. |
| `payments` | id, tenancy_id, amount_paise, payment_method, status, payu_txn_id, payu_response, cashback_applied_paise, initiated_at, completed_at | Status: pending/processing/success/failed/refunded. PayU integration. |
| `bank_accounts` | id, user_id, account_number_encrypted, ifsc_code, account_holder_name, verified, verification_reference, verified_at | Cashfree Penny Drop verification. Encrypted account numbers. |
| `identity_verifications` | id, user_id, verification_type, status, provider_reference, response_data (JSONB), confidence_score | Cashfree Mobile 360 KYC. Status: pending/success/failed. |
| `cashback_ledger` | id, user_id, transaction_type, amount_paise, balance_after_paise, payment_id, description, expires_at | Double-entry ledger. Types: earned/applied/expired/bonus/adjustment/reversal. Functions: `get_cashback_balance()`, `get_available_cashback()`. |

### Payment Infrastructure

| Table | Key Columns | Notes |
|-------|------------|-------|
| `payment_methods` | id, user_id, type (upi/credit_card/debit_card/netbanking), upi_vpa, card_last_four, card_network, bank_name, is_default, deleted_at | Soft delete. Unique UPI VPA per user. |
| `refunds` | id, payment_id, amount_paise, reason, status, payu_refund_id, initiated_at, completed_at | Status: pending/processing/completed/failed. |
| `idempotency_keys` | id, key (UNIQUE), user_id, endpoint, request_hash (SHA256), response_body (JSONB), status, expires_at | 24h TTL. Functions: `acquire_idempotency_lock()`, `complete_idempotency()`. |

### Referral & Waitlist

| Table | Key Columns | Notes |
|-------|------------|-------|
| `waitlist_entries` | id, user_id, status, priority_score, referral_priority_boost, applied_referral_code, approved_at, rejected_at | Status: pending/approved/rejected. Realtime enabled. |
| `referral_codes` | id, code (UNIQUE), owner_user_id, max_uses, current_uses, reward_amount_paise, code_type | Types: user/promo/influencer/partner. |
| `referral_redemptions` | id, referral_code_id, referee_user_id (UNIQUE), referee/referrer_reward_paise, credited flags | Each user can only use one referral code ever. |

### Verification & Documents

| Table | Key Columns | Notes |
|-------|------------|-------|
| `utility_verifications` | id, user_id, tenancy_id, utility_type, operator_code, consumer_number, status, bill_data (JSONB), address_match_score | API Club verification. Status: pending/success/failed/not_found. |
| `extracted_rental_info` | id, user_id, document_url, extraction_status, extracted_data (JSONB), user_modified_data (JSONB), confidence_score, gemini_verification_score, latitude, longitude | GCP Document AI + Gemini extraction. Status: processing/completed/failed/manual_review. |

### Notifications & Audit

| Table | Key Columns | Notes |
|-------|------------|-------|
| `device_tokens` | id, user_id, token, platform (ios/android/web), active | For push notifications. |
| `notifications` | id, user_id, title, body, type, data (JSONB), read_at | In-app notification store. |
| `notification_preferences` | user_id (PK), push/sms/whatsapp/email_enabled, payment_reminders, quiet_hours | Per-user notification settings. |
| `audit_logs` | id, user_id, actor_type, action, action_category, entity_type, entity_id, details (JSONB), old_values, new_values, ip_address, request_id, status | Immutable trail. Categories: auth/payment/verification/tenancy/profile/landlord/cashback/notification/system/security. Function: `log_audit_event()`. |

---

## 2. Edge Functions (36 functions)

### Auth & Waitlist
| Function | Method | Auth | External | Purpose |
|----------|--------|------|----------|---------|
| `auth-otp` | POST | No | Twilio | Send/verify OTP via SMS |
| `join-waitlist` | POST | Yes | -- | Add user to waitlist (idempotent) |
| `get-waitlist-status` | GET | Yes | -- | Current waitlist status + position |
| `admin-waitlist` | POST | Yes* | -- | Approve/reject waitlist entries (*admin only) |

### Referral
| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `get-my-referral-code` | GET | Yes | Get user's auto-generated referral code |
| `apply-referral-code` | POST | Yes | Apply referral code for priority boost |
| `validate-referral-code` | POST | Yes | Check if referral code is valid |

### Agreement & Documents
| Function | Method | Auth | External | Timeout | Purpose |
|----------|--------|------|----------|---------|---------|
| `upload-document` | POST | Yes | Supabase Storage | 30s | Get signed URL, store metadata |
| `process-document` | POST | Yes | GCP Document AI, Gemini, Google Maps | 120s | OCR extract + AI verify + geocode |
| `confirm-extraction` | POST | Yes | -- | -- | Create tenancy from extracted data |
| `update-extraction` | POST | Yes | -- | -- | Store user modifications to extracted data |

### Payment
| Function | Method | Auth | External | Purpose |
|----------|--------|------|----------|---------|
| `initiate-payment` | POST | Yes | PayU | Create payment, get PayU hash |
| `payment-webhook` | POST | No* | PayU | Receive PayU callback (*signature verified) |
| `get-payment-history` | GET | Yes | -- | Paginated payment list with filters |
| `get-saved-payment-methods` | GET | Yes | -- | List user's payment methods |
| `add-upi-vpa` | POST | Yes | -- | Save UPI VPA |
| `add-card-token` | POST | Yes | -- | Save tokenized card |
| `delete-payment-method` | POST | Yes | -- | Soft-delete payment method |
| `initiate-refund` | POST | Yes | PayU | Start refund process |
| `get-refund-status` | GET | Yes | PayU | Check refund progress |
| `calculate-cashback` | POST | Yes* | -- | Calculate and credit cashback (*system/webhook) |
| `generate-receipt` | GET | Yes | -- | Generate payment receipt data |

### Verification
| Function | Method | Auth | External | Timeout | Purpose |
|----------|--------|------|----------|---------|---------|
| `verify-bank` | POST | Yes | Cashfree (Penny Drop) | 30s | Verify bank account ownership |
| `verify-identity` | POST | Yes | Cashfree (Mobile 360) | -- | KYC identity verification |
| `verify-utility` | GET/POST | Yes | API Club, Gemini | 30s | GET=list operators, POST=verify bill |

### Profile & Setup
| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `update-profile` | POST | Yes | Update user profile fields |
| `upload-avatar` | POST | Yes | Presigned URL for avatar upload |
| `send-landlord-invite` | POST | Yes | Email invite to landlord |
| `landlord-approve` | POST | Yes | Landlord approves/rejects tenancy |
| `dashboard-data` | POST | Yes | Aggregated dashboard (user, tenancy, payments, cashback, verifications) |
| `delete-account` | POST | Yes | GDPR account deletion |

### Notifications
| Function | Method | Auth | External | Purpose |
|----------|--------|------|----------|---------|
| `register-device-token` | POST | Yes | -- | Store push notification token |
| `send-push-notification` | POST | Yes* | Expo Push | Send push via Expo (*system) |
| `send-sms` | POST | Yes* | Twilio | Send SMS message (*system) |
| `send-whatsapp` | POST | Yes* | Twilio | Send WhatsApp message (*system) |
| `mark-notification-read` | POST | Yes | -- | Mark notification as read |

---

## 3. Shared Utilities (`_shared/`)

| Module | Exports | Purpose |
|--------|---------|---------|
| `cors.ts` | `corsHeaders` | CORS headers for all edge functions |
| `supabase.ts` | `createClient()`, `createServiceClient()` | Supabase clients (anon + service role) |
| `validation.ts` | `validatePhone()`, `validateEmail()`, `validateUUID()`, etc. | Input validation helpers |
| `errors.ts` | `ApiError`, `handleError()`, `errorResponse()` | Standardized error responses |
| `crypto.ts` | `hashString()`, `generateToken()`, `verifyPayUHash()` | Cryptographic operations + PayU signature |
| `audit.ts` | `logAudit()` | Wrapper around `log_audit_event()` DB function |
| `idempotency.ts` | `checkIdempotency()`, `completeIdempotency()` | Idempotency key management |
| `notifications.ts` | `sendNotification()`, `notifyUser()` | Push/SMS/WhatsApp notification dispatch |
| `gemini.ts` | `callGemini()` | Gemini AI API wrapper |

---

## 4. External Services

| Service | Purpose | Env Vars |
|---------|---------|----------|
| **PayU** | Payment gateway (Checkout Pro) | `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_BASE_URL` |
| **Cashfree** | Bank verification (Penny Drop), KYC (Mobile 360) | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_BASE_URL` |
| **Twilio** | OTP SMS, WhatsApp messages | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| **API Club** | Utility bill verification (electricity/gas/water) | `API_CLUB_KEY` |
| **Google Gemini** | Agreement AI verification + extraction enhancement | `GEMINI_API_KEY` (uses gemini-2.5-flash) |
| **GCP Document AI** | Agreement OCR extraction | `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_PROCESSOR_ID` |
| **Google Maps** | Property address geocoding | `GOOGLE_MAPS_API_KEY` |
| **Expo Push** | Push notifications | `EXPO_ACCESS_TOKEN` |

---

## 5. RLS Policies

All tables have RLS enabled. Pattern:
- **User SELECT**: `user_id = auth.uid()` (own data only)
- **Landlord SELECT**: `landlord_user_id = auth.uid()` (on tenancies/payments)
- **User INSERT/UPDATE**: `user_id = auth.uid()` with CHECK
- **Service role**: `FOR ALL USING (true)` (edge functions use service role)
- **Audit logs**: user can see own non-security/non-system logs only
- **Bank accounts**: users can only delete unverified accounts

Tables with RLS: users, tenancies, payments, bank_accounts, identity_verifications, cashback_ledger, idempotency_keys, audit_logs, utility_verifications, waitlist_entries, payment_methods, refunds, referral_codes, referral_redemptions, notification_preferences, device_tokens, notifications.

---

## 6. Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `agreements` | Uploaded rental agreement PDFs | Authenticated upload, service role read |
| `utility-bills` | Utility bill images/PDFs | Authenticated upload |
| `id-documents` | Identity verification documents | Authenticated upload, service role only |
| `receipts` | Generated payment receipts | Authenticated read |
| `avatars` | User profile pictures | Public read, authenticated upload |

---

## 7. Realtime

Enabled on `waitlist_entries` table for live status updates (polling + realtime subscription in `useWaitlistStatus` hook).

---

## 8. Database Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_cashback_balance(user_id)` | BIGINT | Current cashback balance from last ledger entry |
| `get_available_cashback(user_id)` | BIGINT | Non-expired cashback (earned - used - expired) |
| `acquire_idempotency_lock(key, ...)` | TABLE(acquired, existing_response, existing_status) | Atomic idempotency check + lock |
| `complete_idempotency(key, status, response)` | VOID | Mark idempotency record complete |
| `log_audit_event(...)` | UUID | Insert audit log entry |
| `audit_table_changes()` | TRIGGER | Auto-audit trigger on INSERT/UPDATE |

---

## 9. Test Infrastructure

### Test Files (`_tests/`)
- `verify-bank.test.ts`, `verify-utility.test.ts`, `payment-flow.test.ts`
- `payment-methods-refunds.test.ts`, `verification-flow.test.ts`
- `user-onboarding-flow.test.ts`, `utility-bill-flow.test.ts`

### Mock Helpers (`_tests/helpers/`)
- `mock-cashfree.ts` -- Penny Drop / KYC mocks
- `mock-twilio.ts` -- OTP verification mocks
- `mock-payu.ts` -- payment gateway mocks
- `mock-apiclub.ts` -- utility verification mocks

### Running Tests
```bash
# Local
cd supabase && supabase functions test

# CI
deno test supabase/functions/_tests/ --allow-all
```

---

## 10. pg_cron Jobs

Defined in migration `20260121000012_create_pg_cron_jobs.sql`:
- Expired idempotency key cleanup
- Cashback expiration processing
- Other scheduled maintenance tasks
