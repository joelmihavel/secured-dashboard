# State Management Reference

> Flent Secured React Native App -- State Management Documentation
> Generated from source: `rn-app/src/`
> Last updated: 2026-03-08

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Providers](#providers)
  - [AuthProvider](#authprovider)
  - [QueryProvider](#queryprovider)
- [Zustand Stores](#zustand-stores)
  - [Auth Store](#auth-store)
  - [Payment Store](#payment-store)
  - [Upload Store](#upload-store)
  - [Setup Store](#setup-store)
  - [Waitlist Store](#waitlist-store)
  - [Profile Store](#profile-store)
  - [resetAll](#resetall)
- [Custom Hooks](#custom-hooks)
  - [Auth Hooks](#auth-hooks)
  - [Dashboard Hooks](#dashboard-hooks)
  - [Payment Hooks](#payment-hooks)
  - [Setup Hooks](#setup-hooks)
  - [Waitlist Hooks](#waitlist-hooks)
  - [Agreement Hooks](#agreement-hooks)
  - [Profile Hooks](#profile-hooks)
  - [Infrastructure Hooks](#infrastructure-hooks)
- [API Services](#api-services)
  - [Auth Service](#auth-service)
  - [Dashboard Service](#dashboard-service)
  - [Payments Service](#payments-service)
  - [Setup Service](#setup-service)
  - [Agreement Service](#agreement-service)
  - [Waitlist Service](#waitlist-service)
  - [Profile Service](#profile-service)
  - [Notifications Service](#notifications-service)
  - [Identity Service](#identity-service)
- [Other Services](#other-services)
  - [Supabase Client](#supabase-client)
  - [Realtime Manager](#realtime-manager)
  - [Payment Services](#payment-services-payu)
  - [Push Notifications](#push-notifications)
  - [Error Reporting](#error-reporting)
  - [Global Error Handlers](#global-error-handlers)
  - [Analytics](#analytics)
  - [Performance](#performance)

---

## Architecture Overview

The app uses a layered state management strategy:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI State** | Zustand + immer | Local form state, flow state machines, transient UI flags |
| **Server State** | React Query (@tanstack/react-query) | Cached API data, background refetching, optimistic updates |
| **Auth State** | React Context (AuthProvider) | Session, auth status, single source of truth for login state |
| **Query Config** | React Context (QueryProvider) | QueryClient with AppState focus management, NetInfo online detection |
| **Realtime** | Supabase Realtime (module singleton) | WebSocket subscriptions with ref counting and background recovery |

**Data flow:** Screen -> Hook -> API Service -> Edge Function / Supabase Client

**Convention:**
- Zustand stores hold client-side ephemeral or form state (never server data).
- React Query holds all server data (dashboard, payments, waitlist status, etc.).
- Stores use immer middleware for immutable updates.
- Persisted stores use expo-secure-store via custom adapters.

---

## Providers

### AuthProvider

**File:** `src/providers/AuthProvider.tsx`

Single source of truth for authentication state. Consolidates all `onAuthStateChange` listeners into one location to eliminate race conditions from multiple listeners competing to navigate.

**Context value:**

```typescript
interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;  // !!session || isReviewMode()
}
```

**Auth event handling:**

| Event | Behavior |
|-------|----------|
| `SIGNED_OUT` | Calls `getSession()` first to guard against transient refresh failures (network timeouts, CF proxy cold-start, ISP DNS blocks). Only logs out if no valid session exists. |
| `TOKEN_REFRESHED` | Updates session if new tokens received. On null (transient failure), **preserves** the cached session instead of logging out. This prevents false sign-outs on brief network interruptions. |
| `SIGNED_IN` | Sets session, resets redirect guard, registers push notifications via `registerForPushNotifications()` (non-blocking). |
| `INITIAL_SESSION` | Updates only if a valid session is received (does not overwrite with null). |

**Sign-out flow:**
1. Guards against multiple simultaneous redirects via `hasRedirectedRef`
2. Deactivates review mode if active
3. Calls `clearAllStores()` (resets all Zustand stores + React Query cache)
4. Navigates to `/(auth)/beta-splash`
5. Resets redirect guard after 1000ms

**Foreground refresh:** Uses `useSessionMonitor` to proactively refresh the session when the app returns to foreground after background (5s minimum background time, 30s cooldown).

**Hook:** `useAuthContext()` -- returns the context value.

---

### QueryProvider

**File:** `src/providers/QueryProvider.tsx`

Configures React Query's `QueryClient` with mobile-optimized settings and wires platform-specific integrations.

**Module-level wiring:**

| Integration | Mechanism | Detail |
|-------------|-----------|--------|
| AppState -> focusManager | `AppState.addEventListener('change')` | Sets focused after 3000ms delay on `active` (waits for ResumeOverlay fade + WebSocket reconnect + Hermes GC) |
| NetInfo -> onlineManager | `NetInfo.addEventListener()` | Pauses queries when offline, auto-refetches when back online |

**Query defaults:**

| Setting | Dev | Production |
|---------|-----|------------|
| `staleTime` | 0 (always fresh) | 5 minutes |
| `gcTime` | 0 (no cache) | 30 minutes |
| `retry` | 0 (fail-fast) | 2 |
| `refetchOnWindowFocus` | true | true |
| `refetchOnReconnect` | false | true |
| `mutations.retry` | 0 | 1 |

**MutationCache error handler:** Reports errors via `reportFatalError` but suppresses expected patterns (invite code errors, referral code errors) that should be handled inline by the UI.

**QueryCache error handler:** Adds Sentry breadcrumbs for all query errors.

**Exported:** `queryClient` instance (used by `clearAllStores()` for cache clearing).

---

## Zustand Stores

All stores are in `src/stores/`. Every store uses `immer` middleware for immutable updates and exposes a `reset()` action.

### Auth Store

**File:** `src/stores/auth.ts`

Manages the phone verification flow UI state.

**State machine:** `idle` -> `phone_input` -> `otp_sent` -> `verifying` -> `authenticated` | `error`

**State shape:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `AuthStatus` | Current flow state |
| `phoneNumber` | `string` | Entered phone number |
| `userName` | `string` | Entered user name |
| `otpSent` | `boolean` | Whether OTP has been dispatched |
| `userId` | `string \| null` | Authenticated user ID |
| `isNewUser` | `boolean` | Whether this is a first-time user |
| `consentForMobile360` | `boolean` | M360 identity verification consent |
| `consentTimestamp` | `string \| null` | ISO timestamp of consent |
| `otpRequestId` | `string \| null` | Opaque server reference for OTP routing |
| `otpMethod` | `'supabase' \| 'cashfree' \| null` | Active OTP path |
| `identityStatus` | `IdentityStatus` | M360 identity verification result |
| `error` | `{ code, message } \| null` | Current error |

**Key actions:** `setPhoneNumber`, `setOtpSent`, `setVerifying`, `setAuthenticated`, `setIdentityStatus`, `setError`, `clearError`, `reset`

**Selectors:** `selectAuthStatus`, `selectPhoneNumber`, `selectIsAuthenticated`, `selectAuthError`, `selectOtpRequestId`, `selectOtpMethod`, `selectIdentityStatus`

**Persistence:** None (ephemeral -- resets on app launch).

---

### Payment Store

**File:** `src/stores/payment.ts`

Manages payment flow UI state and PayU SDK session parameters.

**State machine:** `idle` -> `selecting_method` -> `confirming` -> `processing` -> `success` | `failed` | `refunded`

**State shape:**

| Field | Type | Persisted | Description |
|-------|------|-----------|-------------|
| `status` | `PaymentStatus` | No | Current flow state |
| `selectedMethod` | `SelectedPaymentMethod \| null` | No | Chosen payment method |
| `amount` | `number` | No | Payment amount in rupees |
| `dueDate` | `string \| null` | No | Payment due date |
| `tenancyId` | `string \| null` | No | Active tenancy |
| `transactionId` | `string \| null` | No | PayU transaction ID |
| `error` | `{ code, message } \| null` | No | Current error |
| `lastPaymentId` | `string \| null` | **Yes** | Last initiated payment ID (crash recovery) |
| `lastPaymentTimestamp` | `number \| null` | **Yes** | Timestamp of last payment initiation |
| `payuSessionParams` | `PayUSessionParams \| null` | No | PayU SDK params (sensitive -- never persisted) |
| `selectedInstrument` | `object \| null` | No | Selected payment instrument |
| `verificationSkipped` | `boolean` | No | Whether user skipped verification |
| `pendingPaymentReturn` | `boolean` | No | Awaiting PayU SDK return |
| `rentMonth` | `string \| null` | No | Selected rent month |
| `enteredAmount` | `number` | No | User-entered amount in rupees |

**PayUSessionParams type:** Contains `key`, `txnid`, `amount`, `hash`, `vas_hash`, `prd_hash`, `surl`, `furl`, `user_credential`, `udf1-5`, `enforce_paymethod`, `environment`, `post_data`, `payment_url`. Pre-computed hashes from server -- no salt on client.

**Persistence:** Only `lastPaymentId` and `lastPaymentTimestamp` are persisted to expo-secure-store (via `partialize`). Used by `usePaymentRecovery` to resume polling after app crash within a 30-minute window.

**Key actions:** `selectMethod`, `setAmount`, `setProcessing`, `setSuccess`, `setFailed`, `setLastPayment`, `clearLastPayment`, `setPayuSessionParams`, `clearPayuSessionParams`, `setSelectedInstrument`, `reset`

**Selectors:** `selectPaymentStatus`, `selectSelectedMethod`, `selectPaymentAmount`, `selectIsProcessing`, `selectTransactionId`, `selectLastPaymentId`, `selectPayuSessionParams`, `selectSelectedInstrument`, `selectRentMonth`, `selectEnteredAmount`

---

### Upload Store

**File:** `src/stores/upload.ts`

Manages the agreement upload pipeline state. Fully persisted to survive app kills and backgrounding.

**State machine:** `idle` -> `requesting_url` -> `uploading_file` -> `processing` -> `server_processing` -> `completed` | `failed`

**State shape:**

| Field | Type | Description |
|-------|------|-------------|
| `extractionId` | `string \| null` | Backend extraction record ID |
| `uploadPhase` | `UploadPhase` | Current pipeline phase |
| `fileName` | `string \| null` | Uploaded document filename |
| `lastUpdatedAt` | `number` | Timestamp of last phase change |
| `errorCode` | `string \| null` | Error code on failure |
| `errorMessage` | `string \| null` | Error description |
| `dismissedExtractionId` | `string \| null` | Extraction ID abandoned via "Re-upload" |
| `_hasHydrated` | `boolean` | Whether SecureStore rehydration is complete |

**Staleness detection:**
- Active uploads (processing/uploading): stale after 10 minutes
- Completed extractions: stale after 24 hours
- Stale states auto-reset on rehydration

**Key actions:** `startUpload`, `setExtractionId`, `setPhase`, `setError`, `dismissCurrentExtraction`, `reset`, `isStale`

**Persistence:** Full state persisted to expo-secure-store (key: `flent-upload-state`), excluding `_hasHydrated`. Rehydration callback auto-resets stale uploads.

---

### Setup Store

**File:** `src/stores/setup.ts`

Manages the three-step post-approval verification setup flow.

**Steps:** `bank` -> `utility` -> `landlord`

**State shape:**

| Field | Type | Description |
|-------|------|-------------|
| `flowStatus` | `'idle' \| 'in_progress' \| 'completed'` | Overall flow state |
| `currentStep` | `SetupStepId` | Currently active step |
| `bankForm` | `BankFormState` | Bank form fields: accountHolderName, accountNumber, confirmAccountNumber, ifscCode, isVerifying, isVerified |
| `utilityForm` | `UtilityFormState` | Utility form fields: operatorCode, consumerNumber, isVerifying, isVerified |
| `landlordForm` | `LandlordFormState` | Landlord form fields: landlordName, landlordEmail, isSending, isSent |
| `error` | `{ code, message } \| null` | Current error |

**Auto-advance:** `completeStep(step)` marks the step as done and automatically advances `currentStep` to the next incomplete step.

**Key actions:** `setCurrentStep`, `completeStep`, `updateBankForm`, `setBankVerifying`, `setBankVerified`, `updateUtilityForm`, `setUtilityVerifying`, `setUtilityVerified`, `updateLandlordForm`, `setLandlordSending`, `setLandlordSent`, `reset`

**Selectors:** `selectCurrentStep`, `selectFlowStatus`, `selectBankForm`, `selectUtilityForm`, `selectLandlordForm`, `selectSetupError`, `selectIsSetupComplete`

**Persistence:** None (ephemeral).

---

### Waitlist Store

**File:** `src/stores/waitlist.ts`

Manages waitlist screen UI state including referral code input and rejection countdown.

**View states:** `loading` | `pending` | `pending_long` | `approved` | `rejected` | `error`

**State shape:**

| Field | Type | Description |
|-------|------|-------------|
| `viewState` | `WaitlistViewState` | Current view state |
| `userName` | `string` | User's name from auth |
| `referralCode` | `string[]` | Four-element array for each code character |
| `isReferralExpanded` | `boolean` | Whether referral section is expanded |
| `isApplyingReferral` | `boolean` | Loading state for referral application |
| `referralApplied` | `boolean` | Whether a referral has been applied |
| `referralError` | `string \| null` | Referral-specific error message |
| `showConfetti` | `boolean` | Confetti animation flag |
| `nextApplicationCountdown` | `number` | Seconds until rejected users can re-apply |
| `error` | `{ code, message } \| null` | General error |

**Error resilience:** `setError` only switches to error view if the current state is `loading`. Transient polling failures do not wipe the active pending/approved UI.

**Key actions:** `setViewState`, `setReferralCode`, `setReferralCharacter`, `clearReferralCode`, `toggleReferralExpanded`, `setApplyingReferral`, `setReferralApplied`, `setCountdown`, `decrementCountdown`, `reset`

**Selectors:** `selectViewState`, `selectReferralCode`, `selectReferralCodeString`, `selectIsReferralComplete`, `selectIsApplyingReferral`, `selectReferralError`, `selectShowConfetti`, `selectCountdownText`

**Persistence:** None (ephemeral).

---

### Profile Store

**File:** `src/stores/profile.ts`

Manages profile screen editing state, form data, and notification preferences.

**State shape:**

| Field | Type | Description |
|-------|------|-------------|
| `activeTab` | `ProfileTab` | One of: overview, payments, agreement, settings |
| `isEditing` | `boolean` | Whether edit mode is active |
| `form` | `ProfileFormState` | Form fields: fullName, email, avatarUri, isDirty |
| `notificationPrefs` | `NotificationPreferences` | Toggle states: paymentReminders, paymentConfirmations, promotionalOffers, appUpdates |
| `isSaving` | `boolean` | Save in progress |
| `error` | `{ code, message } \| null` | Current error |

**Key actions:** `setActiveTab`, `startEditing`, `cancelEditing`, `updateForm`, `setAvatarUri`, `toggleNotificationPref`, `setNotificationPrefs`, `setSaving`, `reset`

**Selectors:** `selectActiveTab`, `selectIsEditing`, `selectProfileForm`, `selectNotificationPrefs`, `selectIsSaving`, `selectProfileError`, `selectIsFormDirty`

**Persistence:** None (ephemeral).

---

### resetAll

**File:** `src/stores/resetAll.ts`

Utility function that performs a complete state teardown on sign-out:

1. Calls `removeAllChannels()` -- tears down all Supabase Realtime WebSocket channels (must happen before cache clear to avoid stale subscriptions)
2. Resets all 6 Zustand stores (auth, upload, waitlist, payment, setup, profile) via `.getState().reset()`
3. Calls `queryClient.clear()` -- clears all React Query cached data
4. Deletes `flent_last_journey_target` from SecureStore (cached journey route)

Called by `AuthProvider.handleSignOut()` and `DevNavigator` (for scenario switching in dev mode). Extracted as a shared utility for reuse across multiple callers.

---

## Custom Hooks

All hooks are in `src/hooks/` and re-exported via the barrel `src/hooks/index.ts`.

### Auth Hooks

**File:** `src/hooks/useAuth.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useSendOtp` | mutation | Sends OTP via dual-path (Supabase Auth for existing users, Cashfree M360 for new users). Updates auth store with method and otpRequestId. |
| `useVerifyOtp` | mutation | Verifies OTP code. Supabase path: direct SDK call. Cashfree path: edge function verify then setSession. |
| `useResendOtp` | mutation | Resends OTP. Tries M360 first if otpRequestId exists, falls back to Supabase Auth. |

---

### Dashboard Hooks

**File:** `src/hooks/useDashboard.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useDashboard` | query | Fetches aggregated dashboard data (user, tenancy, payments, cashback, notifications). 2min staleTime, refetchOnWindowFocus. |
| `useRefreshDashboard` | imperative | Returns a function to manually invalidate and refetch dashboard data. |
| `useVerificationStatus` | derived | Extracts verification status from dashboard data (bank_verified, utility_verified, landlord_approved). |
| `useCashback` | derived | Extracts cashback balance and discount info from dashboard data. |

**Query key:** `dashboardKeys`

---

### Payment Hooks

**File:** `src/hooks/usePayments.ts`

| Hook | Type | Description |
|------|------|-------------|
| `usePaymentHistory` | query | Fetches paginated payment history with filters. |
| `useInitiatePayment` | mutation | Initiates a payment via the `initiate-payment` edge function. Returns PayU session params. |
| `useGenerateReceipt` | query | Fetches a payment receipt by payment ID. |
| `usePaymentStamps` | query | Fetches monthly payment stamp summary (on-time, late, missed, pending). |
| `usePaymentSchedules` | query | Fetches auto-payment schedules. |
| `useCreateSchedule` | mutation | Creates a new auto-payment schedule. |
| `useManageSchedule` | mutation | Pauses/resumes/deletes a schedule. |
| `useSavingsHistory` | query | Fetches cashback savings history. |
| `useFeeRates` | query | Fetches gateway fee rate configuration (or falls back to hardcoded defaults). |
| `useBankList` | query | Fetches netbanking-supported bank list. |

**Query key:** `paymentKeys`

**File:** `src/hooks/usePaymentFlow.ts`

| Hook | Type | Description |
|------|------|-------------|
| `usePaymentFlow` | imperative | Core PayU SDK orchestration. Implements double-submit guard, SDK launch via `launchCorePayment`, and outcome normalization (success/failed/cancelled). |

**Return type:** `PaymentFlowOutcome` -- { status, paymentId, transactionId, errorMessage }

**File:** `src/hooks/usePaymentRecovery.ts`

| Hook | Type | Description |
|------|------|-------------|
| `usePaymentRecovery` | imperative | Checks persisted `lastPaymentId` within a 30-minute window. If found, routes to payment status polling for crash recovery. |

---

### Setup Hooks

**File:** `src/hooks/useSetup.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useVerifyBank` | mutation | Verifies landlord bank account via Cashfree Penny Drop (30s timeout). Retries on `IDEMPOTENCY_CONFLICT` up to 2 times with exponential backoff (2s, 4s, 8s). On success, optimistically updates dashboard cache (`bank_verified: true`) and derives `verification_complete` status. |
| `useVerifyPan` | mutation | Verifies PAN card via Cashfree PAN Verification (30s timeout). Invalidates dashboard cache on success. |
| `useVerifyUtility` | mutation | Verifies utility bill (electricity) via external API + Gemini matching. |
| `useUtilityOperators` | query | Fetches available electricity operators (public endpoint, no auth). |
| `useSendLandlordInvite` | mutation | Sends landlord WhatsApp invitation via Twilio template. |
| `useResendLandlordInvite` | mutation | Resends landlord invite (phone already saved on tenancy). |
| `useSetupProgress` | derived | Derives setup progress from dashboard verification status. |

**Validation utilities exported:**
- `validateAccountNumber(value)` -- checks length, digits only
- `validateIfscCode(value)` -- checks IFSC format (4 alpha + 0 + 6 alphanum)
- `validatePhoneNumber(value)` -- checks 10-digit Indian phone number
- `validateEmail(value)` -- checks email format
- `validateConsumerNumber(value)` -- checks consumer number format
- `formatAccountNumber(value)` -- formats with spaces
- `formatPhoneNumber(value)` -- formats with digit grouping
- `deriveSetupProgress(verificationStatus)` -- builds step completion state

**Query key:** `setupQueryKeys`

**File:** `src/hooks/useSetupGuard.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useSetupGuard` | imperative | Enforces sequential setup completion (bank -> utility -> landlord). Returns the next required step and whether the user can proceed. |

**Return type:** `SetupGuardResult`

---

### Waitlist Hooks

**File:** `src/hooks/useWaitlist.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useWaitlist` | composite | Main waitlist hook combining status, referral, and invite code state. |
| `useWaitlistStatus` | query | Polls waitlist status every 30 seconds. Maps edge function response to UI state. |
| `useJoinWaitlist` | mutation | Joins the waitlist (idempotent -- returns existing entry if already joined). |
| `useMyReferralCode` | query | Fetches user's personal referral code for sharing. |
| `useApplyReferral` | mutation | Applies a referral code for priority access. |
| `useValidateReferral` | mutation | Validates a referral code without applying it. |

**Query key:** `waitlistKeys`

Includes Realtime subscription for waitlist entry status changes (auto-invalidates query on UPDATE).

---

### Agreement Hooks

**File:** `src/hooks/useAgreement.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useAgreement` | composite | Full 4-step agreement flow orchestrator. |
| `useUploadAgreement` | mutation | Step 1-2: requests signed URL then uploads file bytes via expo-file-system BACKGROUND session. |
| `useExtractedData` | query | Fetches extracted agreement data for the review screen. |
| `useConfirmExtraction` | mutation | Step 4: confirms extracted data with optional user corrections, creates tenancy record. |

**Query key:** `agreementKeys`

Uses `useUploadStore` for persistent upload state across app kills.

**File:** `src/hooks/useExtractionStatus.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useExtractionStatus` | composite | Triple-mechanism extraction status monitoring: polling (3s interval, max 200 polls), Supabase Realtime WebSocket subscription, and AppState listener for background recovery. |

**Return type:** `UseExtractionStatusReturn` -- { status, isComplete, error }

---

### Profile Hooks

**File:** `src/hooks/useProfile.ts`

| Hook | Type | Description |
|------|------|-------------|
| `useProfile` | composite | Main profile hook combining data and actions. |
| `useUpdateProfile` | mutation | Updates user profile (name, email, avatar URL). |
| `useUploadAvatar` | mutation | Two-step avatar upload: requests presigned URL then uploads image file. |
| `usePixelateAvatar` | mutation | Sends image to pixelate-avatar edge function for orange-tinted pixel art generation. |
| `useDeleteAccount` | mutation | Requests account deletion (archives data then deletes). |
| `useProfilePaymentMethods` | query | Fetches saved payment methods for the profile screen. |

**Query key:** `profileKeys`

---

### Infrastructure Hooks

#### useRequireAuth

**File:** `src/hooks/useRequireAuth.ts`

Passive auth guard that reads from AuthProvider context. Returns `{ isAuthenticated, isLoading }`. Dev mode respects `devAuthBypass` flag.

#### useSessionMonitor

**File:** `src/hooks/useSessionMonitor.ts`

AppState listener that proactively refreshes the Supabase session when the app returns to foreground. Uses `getSession()` (not `refreshSession()`) to avoid triggering `SIGNED_OUT` events on non-retryable refresh errors. On successful session check, invalidates `dashboardKeys.all` for fresh data.

| Prop | Type | Description |
|------|------|-------------|
| `enabled` | `boolean` | Only active when user is authenticated and initial load is complete |
| `minBackgroundDuration` | `number` | Minimum background duration (ms) before triggering refresh. Default: 5000ms |

**Constants:** Minimum background duration: 5s. Refresh cooldown: 30s. Uses Sentry breadcrumbs for diagnostics (dynamic require to avoid bundling issues in test environments).

#### useNetworkStatus

**File:** `src/hooks/useNetworkStatus.ts`

NetInfo-based connectivity detection with offline mutation queue.

**Exports:**
- `useNetworkStatus()` -- hook returning `NetworkStatus` { isConnected, type }
- `queueMutation(fn, meta)` -- queues a mutation for offline retry
- `getQueueLength()` -- returns number of queued mutations
- `clearMutationQueue()` -- clears the queue
- `getNetworkStatus()` -- imperative status getter

#### useRealtimeQuery

**File:** `src/hooks/useRealtimeQuery.ts`

Bridge between RealtimeManager's postgres_changes subscriptions and React Query cache invalidation.

#### useDeepLink

**File:** `src/hooks/useDeepLink.ts`

Deep link handler for `flentsecured://` scheme and universal links.

**Exports:**
- `useDeepLink()` -- hook that listens for incoming links
- `useDeepLinkParams()` -- hook that reads stored deep link params
- `resolveDeepLink(url)` -- parses URL into route + params
- `handleDeepLinkUrl(url)` -- processes and stores a deep link URL
- `consumeDeepLinkParams()` -- reads and clears stored params
- `peekDeepLinkParams()` -- reads without clearing

#### useOTAUpdates

**File:** `src/hooks/useOTAUpdates.ts`

expo-updates wrapper managing OTA update lifecycle.

**Return type:** `UseOTAUpdatesReturn` -- { bannerState, downloadProgress, applyUpdate }

**BannerState:** `'hidden'` | `'available'` | `'downloading'` | `'ready'` | `'error'`

Auto-downloads updates. Auto-applies critical updates without user action.

#### useOptimistic

**File:** `src/hooks/useOptimistic.ts`

Optimistic update helpers for React Query mutations.

| Hook | Description |
|------|-------------|
| `useOptimisticPaymentMethod` | Optimistic add/remove of payment methods |
| `useOptimisticProfile` | Optimistic profile field updates |
| `useOptimisticNotification` | Optimistic notification preference toggles |

#### useAnalytics

**File:** `src/hooks/useAnalytics.ts`

Provider-agnostic analytics abstraction.

| Hook | Description |
|------|-------------|
| `useAnalytics` | Returns typed `trackEvent(name, props)` function |
| `useScreenAnalytics` | Auto-tracks screen views on mount |

#### useErrorNavigation

**File:** `src/hooks/useErrorNavigation.ts`

Error event bus to router bridge with transient error suppression. Subscribes to `reportFatalError` events and navigates to error screens.

#### useIdentityVerification

**File:** `src/hooks/useIdentityVerification.ts`

| Hook | Description |
|------|-------------|
| `useIdentityFetch` | Fetches M360 identity data with consent |

#### useNotifications

**File:** `src/hooks/useNotifications.ts`

| Hook | Description |
|------|-------------|
| `useNotificationPreferences` | CRUD for notification preference toggles |

**Query key:** `notificationKeys`

---

## API Services

All API services are in `src/services/api/`. Every service uses `callEdgeFunction()` from the Supabase client for authenticated edge function calls. Services map snake_case backend responses to camelCase TypeScript types.

### Auth Service

**File:** `src/services/api/auth.ts`

Dual-path OTP authentication: Supabase Auth (existing users) and Cashfree M360 (new users).

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `sendOtp(request)` | `auth-otp` (action: `route_otp`) | POST | No | Routes OTP via edge function, then either triggers signInWithOtp or returns M360 otp_request_id |
| `verifyOtp(request)` | `auth-otp` (action: `verify_otp`) | POST | No | Verifies OTP. Supabase path: SDK verifyOtp. Cashfree path: edge function verify + setSession |
| `resendOtp(phone, otpRequestId?)` | `auth-otp` (action: `resend_otp`) | POST | No | Resends OTP. Tries M360 first, falls back to Supabase signInWithOtp |
| `signOut()` | -- | -- | -- | Calls supabase.auth.signOut() |

**Error codes:** `INVALID_PHONE`, `PHONE_EXISTS`, `RATE_LIMITED`, `INVALID_OTP`, `OTP_EXPIRED`, `OTP_ALREADY_USED`, `MAX_ATTEMPTS`, `NETWORK_ERROR`, `TIMEOUT`, `UNKNOWN_ERROR`

**Review mode:** Intercepts review phone numbers before any network call. Returns mock data for review/demo sessions.

---

### Dashboard Service

**File:** `src/services/api/dashboard.ts`

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `fetchDashboard()` | `dashboard-data` | GET/POST | Yes | Returns full aggregated dashboard: user, tenancy, upcoming payment, cashback, recent payments, landlord bank, notifications, payment stamps |

**Mapping functions:**
- `mapRecentPayments(rawPayments)` -- Maps edge function payment data to UI-ready `MappedRecentPayment[]`
- `deriveCashbackEntries(rawPayments, monthlyRent?, discountRate?)` -- Derives cashback entries from payment history
- `getDashboardState(data)` -- Derives dashboard state machine state from data

**Dashboard state machine:** `loading` | `no_tenancy` | `pending_verification` | `all_verified` | `payment_due` | `payment_overdue` | `payment_processing` | `payment_success` | `error`

**Key exported types:** `DashboardData`, `DashboardUser`, `DashboardTenancy`, `TenancyVerificationStatus`, `UpcomingPayment`, `CashbackBalance`, `RawRecentPayment`, `MappedRecentPayment`, `MappedCashbackEntry`, `DashboardPaymentStamps`

**Cashback model:** Supports dual-path cashback -- instant discount (1% deducted from rent for verified users) and legacy wallet accumulation. `CashbackBalance` includes `discount_rate`, `max_discount_paise`, `wallet_balance`, and `available_balance` (from RPC `get_available_cashback`).

**Tenancy data:** Includes `maintenance` (additional rent component), `cashback_cutoff_day`, `landlord_names[]` (all names from agreement), `tenant_names[]`, `security_deposit`, and `verification_status` with `landlord_response` field.

**Payment stamps:** `DashboardPaymentStamps` includes per-month summary (`on_time`, `late`, `missed`, `pending`, `total_months`) and `current_month_status` for the home screen yearly grid visualization.

**Dev mode:** Supports mock data via `withMock('dashboard', ...)` pattern (300ms delay).

---

### Payments Service

**File:** `src/services/api/payments.ts`

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `initiatePayment(params)` | `initiate-payment` | POST | Yes | Initiates a payment. Returns payment_id, PayU params (hashes), total amount, cashback applied, convenience fee, landlord payout |
| `fetchPaymentHistory(params)` | `get-payment-history` | GET | Yes | Paginated payment history with filters. Includes settlement status (gateway, payu, landlord payout) |
| `generateReceipt(paymentId)` | `generate-receipt` | GET | Yes | Generates a payment receipt with tax breakdown |
| `checkPaymentStatus(paymentId)` | `check-payment-status` | POST | Yes | Checks current payment status (polling) |
| `fetchPaymentStamps()` | `get-payment-stamps` | GET | Yes | Monthly payment stamp summary (on_time/late/missed/pending) |
| `getSavedPaymentMethods()` | `get-saved-payment-methods` | GET | Yes | Lists saved payment methods (UPI, cards, netbanking) |
| `addUpiVpa(params)` | `add-upi-vpa` | POST | Yes | Saves a UPI VPA |
| `verifyUpiVpa(params)` | `verify-upi-vpa` | POST | Yes | Validates a UPI VPA before saving |
| `addCardToken(params)` | `add-card-token` | POST | Yes | Saves a tokenized card |
| `verifyCard(params)` | `verify-card` | POST | Yes | Validates a card via Rs 1 charge (auto-refunded) |
| `deletePaymentMethod(id)` | `delete-payment-method` | POST | Yes | Soft or hard deletes a saved method |
| `setDefaultPaymentMethod(id)` | `set-default-payment-method` | POST | Yes | Sets a payment method as default |
| `getPayuStoredCards()` | `get-payu-stored-cards` | GET | Yes | Fetches PayU-side stored card tokens |
| `getBinInfo(bin)` | `get-bin-info` | GET | Yes | BIN lookup for card type/network validation |
| `fetchBankList()` | `get-netbanking-banks` | GET | Yes | Fetches netbanking-supported bank list |
| `saveBankPreference(bankCode)` | `save-bank-preference` | POST | Yes | Saves preferred netbanking bank |
| `createPaymentSchedule(params)` | `create-payment-schedule` | POST | Yes | Creates a recurring auto-payment schedule |
| `getPaymentSchedules()` | `get-payment-schedules` | GET | Yes | Lists active payment schedules |
| `managePaymentSchedule(id, action)` | `manage-payment-schedule` | POST | Yes | Pauses, resumes, or deletes a schedule |
| `getSavingsHistory()` | `get-savings-history` | GET | Yes | Fetches cashback savings history |
| `formatAmount(paise)` | -- | -- | -- | Formats paise to rupee display string |
| `formatRupees(rupees)` | -- | -- | -- | Formats rupees with Indian locale separators |
| `getCurrentRentMonth()` | -- | -- | -- | Returns current rent month as ISO date string |
| `sanitizeErrorForUI(error)` | -- | -- | -- | Maps internal error codes to user-friendly messages |

**Error codes handled:** `ALREADY_PAID`, `PAYMENT_IN_PROGRESS`, `BANK_NOT_VERIFIED`, `AUTH_ERROR`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`, `DB_ERROR`, `UPI_S2S_FAILED`, `UPI_VPA_REQUIRED`, `AMOUNT_TOO_LOW`, `AMOUNT_EXCEEDS_RENT`, `TENANCY_INACTIVE`

---

### Setup Service

**File:** `src/services/api/setup.ts`

| Function | Edge Function | Method | Auth | Timeout | Description |
|----------|--------------|--------|------|---------|-------------|
| `verifyBank(request)` | `verify-bank` | POST | Yes | 30s | Verifies bank account via Cashfree Penny Drop. Returns name match score, verification status. |
| `verifyPan(request)` | `verify-pan` | POST | Yes | 30s | Verifies PAN card via Cashfree. Returns PAN type, registered name, match score. |
| `verifyUtility(request)` | `verify-utility` | POST | Yes | 30s | Verifies utility bill via external API + Gemini AI matching. Returns name/address verification. |
| `getUtilityOperators()` | `verify-utility?action=operators` | GET | No | 15s | Fetches available electricity operators (public). |
| `sendLandlordInvite(request)` | `invite-landlord-whatsapp` | POST | Yes | 15s | Sends WhatsApp invitation to landlord via Twilio template. |
| `resendLandlordInvite(tenancyId)` | `invite-landlord-whatsapp` | POST | Yes | 15s | Resends invite (phone already saved). |
| `deriveSetupProgress(verificationStatus)` | -- | -- | -- | -- | Derives setup progress from dashboard verification status. |
| `buildSetupSteps(bank, utility, landlord)` | -- | -- | -- | -- | Builds setup step configuration. |

**Error codes:** `VALIDATION_ERROR`, `NOT_AUTHENTICATED`, `BANK_NAME_MISMATCH`, `NAME_MISMATCH`, `ADDRESS_MISMATCH`, `EMAIL_FAILED`, `IDEMPOTENCY_CONFLICT`, `NOT_FOUND`, `FORBIDDEN`, `NETWORK_ERROR`, `SERVICE_UNAVAILABLE`, `UNKNOWN_ERROR`

All functions map camelCase request types to snake_case edge function bodies and vice versa for responses. Field-level validation errors are mapped from `details.fields` to camelCase property names.

---

### Agreement Service

**File:** `src/services/api/agreement.ts`

| Function | Edge Function / Method | Auth | Timeout | Description |
|----------|----------------------|------|---------|-------------|
| `requestUploadUrl(fileName, fileType, fileSize)` | `upload-document` POST | Yes | 30s | Step 1: Creates extraction record, returns signed upload URL |
| `uploadFileToSignedUrl(signedUrl, fileUri, mimeType, onProgress?)` | Direct PUT to signed URL | No | -- | Step 2: Uploads file bytes via expo-file-system BACKGROUND session |
| `processDocument(extractionId, documentPath?)` | `process-document` POST | Yes | 120s | Step 3: Triggers OCR (GCP Document AI) + AI extraction (Gemini) |
| `getExtractedAgreementData(extractionId)` | Direct Supabase query | Yes | -- | Fetches full extracted data for review screen |
| `confirmExtraction(request)` | `confirm-extraction` POST | Yes | 15s | Step 4: Confirms extracted data, applies corrections, creates tenancy |
| `updateExtraction(request)` | `update-extraction` POST | Yes | 15s | Pre-confirmation modifications to extracted fields |
| `fetchExtractionStatus(extractionId)` | Direct Supabase query | Yes | -- | Lightweight status-only query for polling |
| `abandonExtraction(extractionId)` | Direct Supabase UPDATE | Yes | -- | Soft-deletes extraction (marks user_verified=true, status=failed) |

**Helper exports:**
- `formatPaiseToRupees(paise)` -- Formats paise to Indian rupee string
- `formatDateDisplay(isoDate)` -- Formats ISO date to "31 Dec 2026"

**Error codes:** `NOT_AUTHENTICATED`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `PROCESSING_IN_PROGRESS`, `EXTRACTION_NOT_FOUND`, `EXTRACTION_NOT_COMPLETE`, `ALREADY_CONFIRMED`, `OCR_FAILED`, `CITY_NOT_SUPPORTED`, `NETWORK_ERROR`, `UPLOAD_FAILED`, `UNKNOWN_ERROR`

---

### Waitlist Service

**File:** `src/services/api/waitlist.ts`

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `getWaitlistStatus()` | `get-waitlist-status` | GET | Yes | Fetches current waitlist status. Maps V1-compat response to WaitlistStatusData shape. |
| `joinWaitlist()` | `join-waitlist` | POST | Yes | Joins waitlist (idempotent -- returns existing entry). |
| `applyReferralCode(code)` | `apply-referral-code` | POST | Yes | Applies 4-10 char alphanumeric referral code. Client-side format validation before network call. |
| `validateReferralCode(code)` | `validate-referral-code` | POST | Yes | Validates referral code without applying. |
| `getMyReferralCode()` | `get-my-referral-code` | GET | Yes | Fetches user's personal referral code for sharing. |
| `claimInviteCode(code)` | `claim-invite-code` | POST | Yes | Validates and claims a 4-char admin-generated invite code (2 letters + 2 digits). |

**State derivation:** `mapRawToWaitlistStatusData()` derives `WaitlistState` from `admin_review` + `extraction_status` fields. Position-based wait estimation (1 day per 50 positions). Countdown timer for rejected users using `next_application_at` or batch config.

**Error codes:** `NOT_AUTHENTICATED`, `AGREEMENT_NOT_CONFIRMED`, `INVALID_REFERRAL`, `REFERRAL_EXPIRED`, `REFERRAL_ALREADY_USED`, `ALREADY_APPLIED`, `INVALID_INVITE_CODE`, `INVITE_CODE_USED`, `INVITE_CODE_ALREADY_CLAIMED`, `RATE_LIMITED`, `NETWORK_ERROR`, `UNKNOWN_ERROR`

**Dev mode:** Supports mock data via `withMock('waitlist', ...)` pattern (200ms delay).

---

### Profile Service

**File:** `src/services/api/profile.ts`

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `updateProfile(request)` | `update-profile` | POST | Yes | Updates user profile fields. Edge function auto-splits full_name into first/last. |
| `requestAvatarUpload(contentType)` | `upload-avatar` | POST | Yes | Requests presigned upload URL for avatar image. |
| `uploadAvatarFile(uploadUrl, fileUri, contentType)` | Direct PUT to signed URL | No | -- | Uploads avatar image to presigned URL. |
| `pixelateAvatar(fileUri, contentType)` | `pixelate-avatar` | POST (FormData) | Yes | Generates orange-tinted pixel art avatar (32x32 -> 64+256px). |
| `getSavedPaymentMethods()` | `get-saved-payment-methods` | GET | Yes | Lists saved payment methods (grouped by type). |
| `requestAccountDeletion(reason?)` | `delete-account` | POST | Yes | Archives all user data then deletes from all tables + auth. |

**Error codes:** `NOT_AUTHENTICATED`, `VALIDATION_ERROR`, `UPDATE_FAILED`, `UPLOAD_FAILED`, `DELETE_FAILED`, `ARCHIVE_ERROR`, `NETWORK_ERROR`, `UNKNOWN_ERROR`

---

### Notifications Service

**File:** `src/services/api/notifications.ts`

Uses direct Supabase client queries (not edge functions) against the `notification_preferences` table.

| Function | Method | Description |
|----------|--------|-------------|
| `getNotificationPreferences()` | SELECT | Fetches current user's notification preferences |
| `updateNotificationPreferences(prefs)` | UPSERT | Updates preferences (creates on first call) |

**Preference fields:** `payment_reminders`, `payment_confirmations`, `cashback_alerts`, `promotional`, `push_enabled`, `whatsapp_enabled`

---

### Identity Service

**File:** `src/services/api/identity.ts`

| Function | Edge Function | Method | Auth | Description |
|----------|--------------|--------|------|-------------|
| `fetchIdentityData(params)` | `identity` (action: `fetch_with_consent`) | POST | Yes | Fetches M360 identity verification data with consent |

---

## Other Services

### Supabase Client

**File:** `src/services/supabase/client.ts`

Configured Supabase client for the React Native app.

**Key configuration:**
- **Auth storage:** Custom `ExpoSecureStoreAdapter` with chunking (1800-byte chunks to stay under Expo Go's 2048-byte SecureStore limit). Splits large sessions across numbered chunks and reassembles on read.
- **Auto refresh:** `autoRefreshToken: true`, `persistSession: true`
- **No URL detection:** `detectSessionInUrl: false` (mobile app)
- **Custom header:** `x-client-info: 'flent-secured-rn'`
- **Realtime:** 15s heartbeat, exponential reconnect backoff (max 30s), dev-mode logger

**`callEdgeFunction<T>(functionName, body, requireAuth, method, timeoutMs)`**

Central authenticated edge function caller. Features:
- **Request timeout:** 15s default via AbortController
- **Auth token management:** Auto-refreshes tokens within 60s of expiry or when session is missing
- **401 retry:** Retries once on 401 with a refreshed token
- **Safe JSON parsing:** Handles non-JSON responses (502, crash, timeout)
- **Error sanitization:** Masks internal DB errors, surfaces user-friendly messages
- **Request tracing:** Adds `x-request-id` header and `x-region: ap-south-1` header
- **Review mode:** Intercepts edge function calls via `interceptEdgeFunction()` before any network call
- **Sentry breadcrumbs:** Logs API calls, errors, timeouts, and network errors

---

### Realtime Manager

**File:** `src/services/supabase/realtimeManager.ts`

Module-level singleton (not a React context) managing all Supabase Realtime subscriptions.

**Features:**
- **Reference counting:** Multiple hooks subscribing to the same table/filter share one WebSocket channel
- **Coalescing:** 100ms debounce per callback prevents thundering herd from rapid DB events
- **iOS background recovery:** AppState listener reconnects all channels after 5+ seconds in background (1500ms delay). Short background (1-5s) schedules a health check instead of full reconnect.
- **Logout cleanup:** `removeAllChannels()` tears down everything on sign-out

**Exports:**
| Function | Description |
|----------|-------------|
| `subscribe(table, event, callback, filter?)` | Subscribe to postgres_changes. Returns unsubscribe function. |
| `reconnectAll()` | Reconnects all active channels with fresh WebSocket connections. |
| `removeAllChannels()` | Removes all channels and clears debounce timers. |
| `getChannelCount()` | Returns active channel count (debugging). |
| `destroy()` | Full teardown including AppState listener. |

---

### Payment Services (PayU)

**File:** `src/services/payment/index.ts`

Unified payment service layer re-exporting PayU Core SDK and storage services.

**Fee rates (hardcoded defaults):**

| Method | Rate | Type |
|--------|------|------|
| UPI | 0% | Free |
| Credit Card | 1.85% | Percentage |
| Debit Card | 0.9% | Percentage |
| Netbanking | Rs 15 | Flat |

**Key exports:**
| Function | Description |
|----------|-------------|
| `initiatePayment(params)` | Unified initiation: calls `initiate-payment` edge function, returns payment ID + PayU params |
| `getGatewayFeeRates()` | Returns fee rate config (hardcoded or fetched) |
| `computeFee(config, amount)` | Computes fee in rupees for given rate + amount |
| `formatFeeLabel(config, amount)` | Human-readable fee label ("Free", "1.85%", "Rs15 fee") |
| `buildSessionParams(raw)` | Maps raw edge function PayU params to typed `PayUSessionParams` |
| `fetchFeeConfig()` | Fetches server-side fee config (falls back to hardcoded) |

**File:** `src/services/payment/payuCoreService.ts`

PayU Core PG SDK integration (Mode B). Handles CC, DC, NB, UPI payment modes. Pre-computed hashes from server -- no salt on client.

**File:** `src/services/payment/storageService.ts`

File upload to Supabase storage with MIME type detection and file validation.

---

### Push Notifications

**File:** `src/services/notifications.ts`

Push notification service with dynamic `expo-notifications` import. Handles notification registration, permission requests, token storage, and deep link routing from notification taps.

---

### Error Reporting

**File:** `src/services/errorReporting.ts`

Central error event bus. Exports `reportFatalError(details)` which:
1. Emits error to all subscribed listeners (useErrorNavigation, etc.)
2. Captures to Sentry (when enabled)
3. Logs to console in dev mode

---

### Global Error Handlers

**File:** `src/services/globalErrorHandlers.ts`

Installs global unhandled promise rejection handler. Filters out expected error patterns:
- WebSocket errors (reconnection attempts)
- Network/fetch errors (transient connectivity)
- Abort errors (intentional cancellation)
- Supabase realtime errors (background recovery)

Only reports genuine unexpected rejections to Sentry.

---

### Analytics

**File:** `src/services/analytics.ts`

Provider-agnostic analytics abstraction. Exports typed event tracking functions that can be wired to any analytics provider (currently a logging stub).

---

### Performance

**File:** `src/services/performance.ts`

Mark/measure performance tracking with Sentry integration. Exports `markStart(name)` and `markEnd(name)` for measuring operation durations.
