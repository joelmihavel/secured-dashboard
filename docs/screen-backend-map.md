# Screen-to-Backend Mapping

> Flent Secured -- Comprehensive mapping of every screen to its backend services, edge functions, and database tables.
>
> Last verified: 2026-04-26 (screen-to-endpoint inventory current; payment paths now Cashfree-primary with PayU as legacy fallback; per-flow examples may drift — cross-check against source).

---

## Architecture Overview

```
Screen (.tsx)  -->  Hook (useX)  -->  API Service (.ts)  -->  callEdgeFunction / supabase.from()
                                                                     |
                                                           Supabase Edge Function
                                                                     |
                                                              Database Tables
```

All API calls route through the shared `callEdgeFunction` helper in `rn-app/src/services/supabase/`, which handles JWT injection, error extraction, and timeouts. A few services (notifications, agreement status polling) use direct `supabase.from()` PostgREST queries with RLS.

---

## Master Screen-to-Backend Table

| Screen | Route | API Service | Edge Function(s) Called | Database Tables |
|--------|-------|-------------|------------------------|-----------------|
| Beta Splash | `/(auth)/beta-splash` | -- | -- | -- |
| Carousel | `/(auth)/carousel` | -- | -- | -- |
| Sign Up | `/(auth)/sign-up` | `auth.ts` | `auth-otp` (action: `route_otp`) | `auth.users`, `public.users`, `identity_verifications` |
| OTP Verification | `/(auth)/otp` | `auth.ts` | `auth-otp` (action: `verify_otp`), Supabase Auth `verifyOtp` | `auth.users`, `public.users` |
| Agreement Upload | `/(agreement)/upload` | `agreement.ts` | `upload-document`, `process-document` | `extracted_rental_info`, `storage:rent-agreements` |
| Agreement Review | `/(agreement)/review` | `agreement.ts` | `confirm-extraction`, `update-extraction` | `extracted_rental_info`, `tenancies`, `users`, `waitlist_entries` |
| Waitlist | `/(waitlist)/index` | `waitlist.ts` | `get-waitlist-status`, `join-waitlist`, `claim-invite-code` | `waitlist_entries`, `users`, `invite_codes`, `referral_codes` |
| Waitlist Approved | `/(waitlist)/approved` | -- | -- | -- |
| Setup Carousel | `/(setup)/index` | -- | -- | -- |
| Add Bank | `/(setup)/add-bank` | `setup.ts` | `verify-bank`, `verify-pan` | `bank_accounts`, `tenancies` |
| Add Utility | `/(setup)/add-utility` | `setup.ts` | `verify-utility` (POST), `verify-utility?action=operators` (GET) | `utility_verifications`, `tenancies` |
| Invite Landlord | `/(setup)/invite-landlord` | `setup.ts` | `invite-landlord-whatsapp` | `tenancies` (Twilio WhatsApp) |
| Pending Steps | `/(setup)/pending-steps` | `dashboard.ts` | `dashboard-data` | `users`, `tenancies` |
| Home Dashboard | `/(main)/index` | `dashboard.ts` | `dashboard-data`, `get-payment-stamps` | `users`, `tenancies`, `payments`, `notifications`, `cashback_ledger`, `bank_accounts` |
| Enter Rent | `/(payment)/enter-rent` | `payments.ts`, `dashboard.ts` | `initiate-payment`, `get-fee-config`, `get-netbanking-banks` | `payments`, `tenancies` |
| Confirm Payment | `/(payment)/confirm` | -- | Redirect to `enter-rent` | -- |
| Payment Status | `/(payment)/status` | `payments.ts` | `check-payment-status`, `generate-receipt` | `payments`, `cashback_ledger` |
| Profile | `/(profile)/index` | `dashboard.ts`, `profile.ts` | `dashboard-data`, `delete-account` | `users`, `tenancies` |
| Edit Profile | `/(profile)/edit` | `profile.ts` | `update-profile`, `upload-avatar`, `pixelate-avatar` | `users`, `storage:avatars` |
| Edit Bank Details | `/(profile)/edit-bank-details` | `setup.ts`, `dashboard.ts` | `verify-bank` | `bank_accounts`, `tenancies` |
| View Agreement | `/(profile)/agreement` | `dashboard.ts` | `dashboard-data` | `tenancies`, `extracted_rental_info` |
| Notifications Settings | (via profile) | `notifications.ts` | -- (direct PostgREST) | `notification_preferences` |
| Journey Router | `/index` | `waitlist.ts` | `get-waitlist-status` (fallback) | `users`, `extracted_rental_info` |

---

## Detailed Flow Traces

### 1. Sign Up Flow

```
Screen: (auth)/sign-up.tsx
  --> Hook: useAuth (src/hooks/useAuth.ts)
    --> Service: auth.ts :: sendOtp()
      --> Edge: auth-otp { action: "route_otp", phone_number, name }
        --> NEW USER: Cashfree M360 OTP sent server-side
            Returns: { method: "cashfree", otp_request_id }
        --> EXISTING USER: Server triggers signInWithOtp server-side
            Returns: { method: "supabase", otp_triggered: true }
      --> Tables: auth.users (lookup), identity_verifications (M360 consent)
  --> Navigation: router.push('/(auth)/otp')
```

### 2. OTP Verification Flow

```
Screen: (auth)/otp.tsx
  --> Hook: useAuth (src/hooks/useAuth.ts)
    --> Service: auth.ts :: verifyOtp()
      --> SUPABASE PATH: supabase.auth.verifyOtp({ phone, token, type: "sms" })
          Session auto-created by Supabase Auth.
      --> CASHFREE PATH: Edge: auth-otp { action: "verify_otp", otp_request_id, otp }
          Returns session (setSession) or token_hash (client exchange).
      --> Tables: auth.users (session), public.users (profile)
  --> On SIGNED_IN event: router.replace('/')
    --> Journey router resolves next screen based on user_status
```

### 3. Identity Verification Flow (Background)

```
Service: identity.ts :: recordConsent(), fetchIdentityWithConsent()
  --> Edge: verify-identity { action: "record_consent" | "fetch_with_consent" }
    --> Cashfree Mobile 360 API (PAN, Aadhaar, credit score)
    --> Tables: identity_verifications, users (kyc_status)
  --> Triggered: Non-blocking after OTP verification (when user gave consent)
```

### 4. Agreement Upload Flow

```
Screen: (agreement)/upload.tsx
  --> Hook: useAgreement (src/hooks/useAgreement.ts)
  --> Step 1 - Get Signed URL:
    --> Service: agreement.ts :: requestUploadUrl(fileName, fileType, fileSize)
      --> Edge: upload-document { file_name, file_type, file_size }
        --> Creates extracted_rental_info record (status: "pending")
        --> Returns: { upload_url, extracted_rental_info_id, document_path }
        --> Tables: extracted_rental_info (INSERT)
  --> Step 2 - Upload File:
    --> Service: agreement.ts :: uploadFileToSignedUrl(signedUrl, fileUri, mimeType)
      --> PUT to Supabase Storage signed URL (expo-file-system BACKGROUND session)
      --> Tables: storage:rent-agreements (file bytes)
  --> Step 3 - Trigger Processing:
    --> Service: agreement.ts :: processDocument(extractionId)
      --> Edge: process-document { extraction_id }
        --> Downloads PDF from storage
        --> Runs Gemini AI for entity extraction
        --> Stores results in extracted_rental_info
        --> Returns: { confidence_score, needs_manual_review, fields_extracted }
        --> Tables: extracted_rental_info (UPDATE)
      --> Timeout: 120s (OCR + AI can be slow)
  --> Navigation: router.replace('/(agreement)/review')
```

### 5. Agreement Review Flow

```
Screen: (agreement)/review.tsx
  --> Hook: useAgreement (src/hooks/useAgreement.ts)
  --> Data Fetch:
    --> Service: agreement.ts :: getExtractedAgreementData(extractionId)
      --> Direct PostgREST: supabase.from('extracted_rental_info').select(...)
      --> Maps 24 snake_case columns to camelCase UI types
      --> Tables: extracted_rental_info (SELECT)
  --> User Confirms ("Proceed"):
    --> Service: agreement.ts :: confirmExtraction({ extractionId, confirmedRole: "tenant" })
      --> Edge: confirm-extraction { extraction_id, confirmed_role, ...corrections }
        --> Marks extraction as user_verified
        --> Creates tenancy record
        --> Updates user_status to "agreement_confirmed"
        --> Returns: { tenancy_id, user_status }
        --> Tables: extracted_rental_info (UPDATE), tenancies (INSERT), users (UPDATE), waitlist_entries (INSERT)
  --> Navigation: router.replace('/(waitlist)')
  --> Re-upload:
    --> Service: agreement.ts :: abandonExtraction(extractionId)
      --> Direct PostgREST: UPDATE extracted_rental_info SET user_verified=true, extraction_status='failed'
```

### 6. Waitlist Flow

```
Screen: (waitlist)/index.tsx
  --> Hook: useWaitlist (src/hooks/useWaitlist.ts)
  --> Status Check (on mount + polling):
    --> Service: waitlist.ts :: getWaitlistStatus()
      --> Edge: get-waitlist-status (GET, auth required)
        --> Returns: V1-compat shape with admin_review, waitlist_position, extraction_status
        --> Tables: waitlist_entries (SELECT), users (SELECT), batch_config
  --> Auto-Join (first visit):
    --> Service: waitlist.ts :: joinWaitlist()
      --> Edge: join-waitlist (POST)
        --> Idempotent: returns existing entry if already joined
        --> Tables: waitlist_entries (UPSERT)
  --> Claim Invite Code:
    --> Service: waitlist.ts :: claimInviteCode(code)
      --> Edge: claim-invite-code { code }
        --> Validates 4-char code (2 letters + 2 digits)
        --> Tables: invite_codes (UPDATE), waitlist_entries (UPDATE)
  --> Apply Referral Code:
    --> Service: waitlist.ts :: applyReferralCode(code)
      --> Edge: apply-referral-code { code }
        --> Tables: referral_codes (SELECT), waitlist_entries (UPDATE), cashback_ledger (INSERT)
  --> Validate Referral Code:
    --> Service: waitlist.ts :: validateReferralCode(code)
      --> Edge: validate-referral-code { code }
        --> Tables: referral_codes (SELECT)
  --> Navigation: When approved -> router.replace('/(waitlist)/approved')
```

### 7. Bank Verification Flow

```
Screen: (setup)/add-bank.tsx
  --> Hooks: useVerifyBank, useVerifyPan, useDashboard
  --> Step 1 - Bank Penny Drop:
    --> Service: setup.ts :: verifyBank({ tenancyId, accountNumber, ifscCode })
      --> Edge: verify-bank (POST, 30s timeout)
        --> Cashfree Penny Drop API
        --> Name matching (bank account holder vs agreement landlord names)
        --> Tables: bank_accounts (INSERT), tenancies (UPDATE verification_status)
  --> Step 2 - PAN Verification (chained on bank success):
    --> Service: setup.ts :: verifyPan({ tenancyId, panNumber, bankAccountId })
      --> Edge: verify-pan (POST, 30s timeout)
        --> Cashfree PAN Verification API
        --> Gemini AI name matching
        --> Tables: bank_accounts (UPDATE pan fields), tenancies (UPDATE)
  --> Navigation: router.replace('/(setup)/add-utility')
```

### 8. Utility Verification Flow

```
Screen: (setup)/add-utility.tsx
  --> Hooks: useVerifyUtility, useUtilityOperators, useDashboard
  --> Fetch Operators (on mount):
    --> Service: setup.ts :: getUtilityOperators()
      --> Edge: verify-utility?action=operators (GET, no auth)
        --> Returns: operator list (BESCOM, etc.)
  --> Verify Bill:
    --> Service: setup.ts :: verifyUtility({ tenancyId, operatorCode, consumerNumber })
      --> Edge: verify-utility (POST, 30s timeout)
        --> External bill fetch API
        --> Gemini AI for name + address matching
        --> Tables: utility_verifications (INSERT), tenancies (UPDATE verification_status)
  --> Navigation: router.push('/(setup)/invite-landlord')
```

### 9. Landlord Invite Flow

```
Screen: (setup)/invite-landlord.tsx
  --> Hooks: useSendLandlordInvite, useDashboard
  --> Send Invite:
    --> Service: setup.ts :: sendLandlordInvite({ tenancyId, landlordPhone, countryCode })
      --> Edge: invite-landlord-whatsapp (POST)
        --> Twilio WhatsApp template message to landlord
        --> Tables: tenancies (UPDATE landlord_phone, invite_count)
  --> Navigation: router.push('/(setup)/pending-steps')
```

### 10. Home Dashboard Flow

```
Screen: (main)/index.tsx
  --> Hook: useDashboard (src/hooks/useDashboard.ts)
    --> Service: dashboard.ts :: fetchDashboard()
      --> Edge: dashboard-data (POST/GET, auth required)
        --> Aggregated query: user, tenancy, upcoming_payment, cashback, recent_payments,
            landlord_bank, notifications, payment_stamps
        --> Tables: users, tenancies, payments, cashback_ledger, bank_accounts,
                    notifications, notification_preferences
        --> State machine: getDashboardState() derives UI state
            (loading | no_tenancy | pending_verification | all_verified |
             payment_due | payment_overdue | payment_processing | payment_success)
  --> Payment Stamps:
    --> Edge: get-payment-stamps
      --> Tables: payments (aggregated by month)
  --> Setup Progress (derived):
    --> Service: setup.ts :: deriveSetupProgress(verification_status)
      --> No separate edge function; uses tenancy.verification_status from dashboard-data
```

### 11. Payment Initiation Flow

```
Screen: (payment)/enter-rent.tsx -> PaymentMethodModal component
  --> Hook: usePaymentFlow (src/hooks/usePaymentFlow.ts)
  --> Step 1 - Enter Amount:
    --> UI: PaymentMethodModal/EnterAmountContent
    --> Pre-filled from dashboard upcoming_payment
  --> Step 2 - Select Method:
    --> UI: PaymentMethodModal/MethodSelectorContent
    --> Fee Config:
      --> Edge: get-fee-config
    --> Netbanking Banks:
      --> Edge: get-netbanking-banks
  --> Step 3 - Initiate Payment:
    --> Service: payments.ts :: initiatePayment({ tenancy_id, amount_paise, payment_method, rent_month })
      --> Edge: initiate-payment (POST)
        --> Creates payment record (status: "initiated")
        --> Generates PayU hash server-side
        --> Returns: { payment_id, txn_id, payu: { key, hash, surl, furl, ... } }
        --> Tables: payments (INSERT)
  --> Step 4 - Payment SDK (Cashfree primary as of 2026-04; PayU legacy fallback for older app versions in soak window):
    --> Opens PayU Custom Browser with hash params
    --> PayU server-to-server webhook on completion:
      --> Edge: payment-webhook (POST, no JWT -- PayU webhook)
        --> Validates PayU hash
        --> Updates payment status
        --> Triggers cashback calculation
        --> Tables: payments (UPDATE), cashback_ledger (INSERT)
  --> Navigation: router.replace('/(payment)/status?paymentId=...')
```

### 12. Payment Status Flow

```
Screen: (payment)/status.tsx
  --> Polling (3s interval, 120s timeout, 360s for UPI):
    --> Service: payments.ts :: checkPaymentStatus(paymentId)
      --> Edge: check-payment-status { payment_id }
        --> Tables: payments (SELECT)
  --> Receipt Generation (on success):
    --> Service: payments.ts :: generateReceipt(paymentId)
      --> Edge: generate-receipt { payment_id }
        --> Tables: payments, tenancies, users, bank_accounts
  --> State Machine: PENDING -> SUCCESS | FAILED | REFUNDED
  --> Cache Invalidation: paymentHistory + dashboard queries
```

### 13. Profile Flow

```
Screen: (profile)/index.tsx
  --> Hook: useDashboard (data from dashboard-data edge function)
  --> Sign Out:
    --> Service: auth.ts :: signOut()
      --> supabase.auth.signOut()
  --> Delete Account:
    --> Hook: useDeleteAccount
    --> Service: profile.ts :: requestAccountDeletion(reason)
      --> Edge: delete-account (POST)
        --> Archives all user data, deletes from all tables + auth
        --> Tables: users (DELETE + archive), tenancies, payments, etc.
```

### 14. Edit Profile Flow

```
Screen: (profile)/edit.tsx
  --> Hook: useUpdateProfile
    --> Service: profile.ts :: updateProfile({ fullName, firstName, lastName, email })
      --> Edge: update-profile { full_name, first_name, last_name, email }
        --> Tables: users (UPDATE)
  --> Avatar Upload:
    --> Service: profile.ts :: pixelateAvatar(fileUri, contentType)
      --> Edge: pixelate-avatar (POST, FormData)
        --> Downscale + orange tint + upscale
        --> Tables: users (UPDATE avatar_url), storage:avatars
```

### 15. Edit Bank Details Flow (Post-Onboarding)

```
Screen: (profile)/edit-bank-details.tsx
  --> Hook: useVerifyBank, useDashboard
    --> Service: setup.ts :: verifyBank({ tenancyId, accountNumber, ifscCode, existingBankAccountId })
      --> Edge: verify-bank (POST)
        --> Safety reset -> penny drop -> new row -> copy PAN -> set bank_verified
        --> Tables: bank_accounts (INSERT), tenancies (UPDATE)
```

### 16. View Agreement Flow

```
Screen: (profile)/agreement.tsx
  --> Hook: useDashboard
    --> Data sourced from dashboard-data edge function response
    --> Tables: tenancies, extracted_rental_info (via dashboard aggregation)
```

---

## Journey Router (Entry Point)

```
Screen: app/index.tsx (Journey-Aware Router)
  --> Auth Check: AuthProvider (useAuthContext)
  --> PRIMARY: supabase.auth.getUser() + PostgREST query for user_status
  --> FALLBACK: getWaitlistStatus() edge function
  --> FAST PATH: Cached route from SecureStore (validated in background)

  Status Mapping:
    user_status = "signed_up"           -->  /(agreement)/upload  (or /review if extraction pending)
    user_status = "agreement_confirmed" -->  /(waitlist)
    user_status = "waitlisted"          -->  /(waitlist)
    user_status = "not_eligible"        -->  /(waitlist)
    user_status = "approved"            -->  /(setup)
    user_status = "active"              -->  /(main)
    not authenticated                   -->  /(auth)/beta-splash

  Special Cases:
    - Payment recovery: checks paymentStore for in-progress payment -> /(payment)/status
    - Manual review extraction: checks extracted_rental_info for needs_manual_review -> /(waitlist)
    - Upload store: checks extractionId for completed upload -> /(agreement)/review
```

---

## Edge Function Inventory

All edge functions are deployed to Supabase project `zqlowjveyqiagnbmfwsb` (ap-south-1, Mumbai).

| Edge Function | HTTP Method | Auth Required | Timeout | Called By |
|---------------|-------------|---------------|---------|-----------|
| `auth-otp` | POST | No (public) | default | `auth.ts` |
| `verify-identity` | POST | Yes (JWT) | default | `identity.ts` |
| `upload-document` | POST | Yes (JWT) | 30s | `agreement.ts` |
| `process-document` | POST | Yes (JWT) | 120s | `agreement.ts` |
| `confirm-extraction` | POST | Yes (JWT) | default | `agreement.ts` |
| `update-extraction` | POST | Yes (JWT) | default | `agreement.ts` |
| `get-waitlist-status` | GET | Yes (JWT) | default | `waitlist.ts` |
| `join-waitlist` | POST | Yes (JWT) | default | `waitlist.ts` |
| `claim-invite-code` | POST | Yes (JWT) | default | `waitlist.ts` |
| `apply-referral-code` | POST | Yes (JWT) | default | `waitlist.ts` |
| `validate-referral-code` | POST | Yes (JWT) | default | `waitlist.ts` |
| `get-my-referral-code` | GET | Yes (JWT) | default | `waitlist.ts` |
| `verify-bank` | POST | Yes (JWT) | 30s | `setup.ts` |
| `verify-pan` | POST | Yes (JWT) | 30s | `setup.ts` |
| `verify-utility` | POST/GET | POST: JWT, GET: No | 30s | `setup.ts` |
| `invite-landlord-whatsapp` | POST | Yes (JWT) | default | `setup.ts` |
| `dashboard-data` | POST/GET | Yes (JWT) | default | `dashboard.ts` |
| `get-payment-stamps` | GET | Yes (JWT) | default | `dashboard.ts` |
| `initiate-payment` | POST | Yes (JWT) | default | `payments.ts` |
| `check-payment-status` | POST | Yes (JWT) | default | `payments.ts` |
| `generate-receipt` | GET | Yes (JWT) | default | `payments.ts` |
| `get-fee-config` | GET | Yes (JWT) | default | `payments.ts` |
| `get-netbanking-banks` | GET | Yes (JWT) | default | `payments.ts` |
| `payment-webhook` | POST | No (PayU S2S) | default | PayU server |
| `update-profile` | POST | Yes (JWT) | default | `profile.ts` |
| `upload-avatar` | POST | Yes (JWT) | default | `profile.ts` |
| `pixelate-avatar` | POST | Yes (JWT) | default | `profile.ts` |
| `delete-account` | POST | Yes (JWT) | default | `profile.ts` |
| `get-saved-payment-methods` | GET | Yes (JWT) | default | `profile.ts` |

### Admin/Internal Edge Functions (not called by app)

| Edge Function | Purpose |
|---------------|---------|
| `admin-waitlist` | Admin panel waitlist management |
| `admin-fetch-views` | Admin dashboard data aggregation |
| `admin-payment-data` | Admin payment reporting |
| `admin-encrypt` | Admin encryption utilities |
| `extraction-recovery` | Cron: auto-confirm stuck extractions (30-min intervals) |
| `landlord-auth-otp` | Landlord portal OTP (Cashfree M360) |
| `landlord-auth-otp` | Landlord OTP authentication (Cashfree M360) |
| `landlord-confirm` | Landlord approval/dispute of tenancy |
| `notify-landlord` | Multi-channel landlord notification (WhatsApp, SMS, email, push) |
| `pre-approval-audit` | Pre-approval risk and quality checks |
| `settle-to-landlord` | Payment settlement to landlord bank |
| `poll-settlement-status` | Check settlement status |
| `initiate-refund` | Refund processing |
| `get-refund-status` | Refund status check |
| `calculate-cashback` | Cashback calculation logic |
| `cleanup-stale-payments` | Cron: cleanup stale payments |
| `send-push-notification` | Push notification delivery |
| `notify-user` | User notification pipeline |
| `broadcast-app-update` | OTA update notification |

---

## Direct PostgREST Queries (No Edge Function)

These services query Supabase tables directly via the JS client with RLS:

| Service | Query | Table | Purpose |
|---------|-------|-------|---------|
| `agreement.ts :: getExtractedAgreementData` | `.from('extracted_rental_info').select(24 cols)` | `extracted_rental_info` | Fetch full extraction for review screen |
| `agreement.ts :: fetchExtractionStatus` | `.from('extracted_rental_info').select(8 cols)` | `extracted_rental_info` | Lightweight polling during processing |
| `agreement.ts :: abandonExtraction` | `.from('extracted_rental_info').update(...)` | `extracted_rental_info` | Soft-delete on re-upload |
| `notifications.ts :: getNotificationPreferences` | `.from('notification_preferences').select(*)` | `notification_preferences` | Read preferences |
| `notifications.ts :: updateNotificationPreferences` | `.from('notification_preferences').upsert(...)` | `notification_preferences` | Write preferences |
| `index.tsx :: queryUserStatus` | `.from('users').select('user_status')` | `users` | Journey router primary path |
| `index.tsx :: checkManualReviewExtraction` | `.from('extracted_rental_info').select(3 cols)` | `extracted_rental_info` | Route to waitlist for manual review |

---

## External Service Integrations

| Service | Used By | Purpose |
|---------|---------|---------|
| Cashfree Mobile 360 | `auth-otp`, `verify-identity` | OTP delivery (new users), identity verification (PAN, Aadhaar, credit score) |
| Supabase Auth (GoTrue) | `auth-otp`, `auth.ts` | OTP delivery (existing users), session management |
| Cashfree Penny Drop | `verify-bank` | Bank account verification (name matching) |
| Cashfree PAN Verification | `verify-pan` | PAN card validation + name matching |
| Gemini AI | `process-document`, `verify-utility`, `verify-pan` | Document extraction, name/address fuzzy matching |
| Twilio WhatsApp | `invite-landlord-whatsapp` | Landlord invitation messages |
| PayU Payment Gateway | `initiate-payment`, `payment-webhook` | Rent payment processing (UPI, cards, netbanking) |
| Supabase Storage | `upload-document` | Agreement PDF storage |
| Cloudflare Workers | `devapi.flent.in` proxy | ISP DNS block bypass |
