# State Management Context -- Flent Secured v2 React Native

Authoritative reference for all state management in the app.
Covers Zustand stores, React Query hooks, service layer, and Supabase client.

---

## 1. Zustand Stores

Both stores use `zustand/middleware/immer` for immutable updates via mutable syntax.
Import path: `@/src/stores/auth` and `@/src/stores/waitlist`.

### useAuthStore

```ts
// State shape
interface AuthState {
  status: AuthStatus;           // 'idle' | 'phone_input' | 'otp_sent' | 'verifying' | 'authenticated' | 'error'
  phoneNumber: string;
  userName: string;
  otpSent: boolean;
  userId: string | null;
  isNewUser: boolean;
  consentForMobile360: boolean;
  error: { code: string; message: string } | null;
}

// Actions
setPhoneNumber(phone)           // sets status -> 'phone_input', clears error
setUserName(name)
setConsentForMobile360(value)
setOtpSent()                    // sets status -> 'otp_sent'
setVerifying()                  // sets status -> 'verifying'
setAuthenticated(userId, isNew) // sets status -> 'authenticated'
setError(code, message)         // sets status -> 'error'
clearError()                    // reverts to 'otp_sent' or 'phone_input'
reset()                         // returns to initial state

// Selectors
selectAuthStatus, selectPhoneNumber, selectIsAuthenticated, selectAuthError
```

### useWaitlistStore

```ts
// State shape
interface WaitlistState {
  viewState: WaitlistViewState;  // 'loading' | 'pending' | 'pending_long' | 'approved' | 'rejected' | 'error'
  userName: string;
  referralCode: string[];        // 4-character array ['A','B','C','D']
  isReferralExpanded: boolean;
  isApplyingReferral: boolean;
  referralApplied: boolean;
  referralError: string | null;
  showConfetti: boolean;
  nextApplicationCountdown: number;  // seconds, for rejected state
  error: { code: string; message: string } | null;
}

// Actions
setViewState, setUserName, setReferralCode, setReferralCharacter(index, char),
clearReferralCode, toggleReferralExpanded, setReferralExpanded, setApplyingReferral,
setReferralApplied, setReferralError, setShowConfetti, setCountdown, decrementCountdown,
setError, clearError, reset

// Selectors
selectViewState, selectUserName, selectReferralCode, selectReferralCodeString,
selectIsReferralComplete, selectIsApplyingReferral, selectReferralError,
selectShowConfetti, selectError, selectCountdownText (formats HH:MM:SS)
```

---

## 2. Custom Hooks (React Query)

All hooks live in `@/src/hooks/`. Each domain has atomic hooks plus a combined hook.

### Auth Hooks (`useAuth.ts`)

| Hook | Type | Returns |
|------|------|---------|
| `useSendOtp()` | mutation | `mutate(SendOtpRequest)` -- calls `supabase.auth.signInWithOtp` |
| `useVerifyOtp()` | mutation | `mutate(VerifyOtpRequest)` -- calls `supabase.auth.verifyOtp` |
| `useResendOtp()` | mutation | `mutate(channel?)` -- resends to stored phoneNumber |
| `useAuth()` | combined | `{ status, phoneNumber, userName, userId, isNewUser, error, sendCode, verifyCode, resendCode, signOut, isSendingOtp, isVerifyingOtp, isResendingOtp, clearError, reset }` |

Key behavior: `useAuth()` auto-fires `useIdentityFetch` after auth when `isNewUser && consentForMobile360`.

### Waitlist Hooks (`useWaitlist.ts`)

| Hook | Type | Params | Key Config |
|------|------|--------|------------|
| `useWaitlistStatus(options?)` | query | `{ enabled?, useMock?, mockState? }` | staleTime: 10s, retry: 2, polls every 30s when pending, realtime subscription |
| `useJoinWaitlist()` | mutation | none | idempotent |
| `useMyReferralCode(enabled?)` | query | boolean | staleTime: 5min |
| `useApplyReferral()` | mutation | `mutate(code)` | updates store on success/error |
| `useValidateReferral(code)` | query | string | enabled when code.length 4-10, staleTime: 60s |
| `useWaitlist(options?)` | combined | same as status | returns all state + actions, manages countdown timer |

### Dashboard Hooks (`useDashboard.ts`)

| Hook | Type | Key Config |
|------|------|------------|
| `useDashboard(options?)` | query | staleTime: 2min, optional refetchInterval |
| `useRefreshDashboard()` | util | returns `() => invalidateQueries(['dashboard'])` |
| `useVerificationStatus()` | derived | returns `{ bankVerified, utilityVerified, landlordApproved, allVerified, pendingSteps }` |
| `useCashback()` | derived | returns `{ availableBalance, pendingBalance, totalEarned, totalUsed, hasBalance }` |

`useDashboard` returns: raw data accessors (`user`, `tenancy`, `upcomingPayment`, `cashback`) plus UI-mapped `recentPayments` and `cashbackEntries`, plus `dashboardState` (state machine: `loading | no_tenancy | pending_verification | all_verified | payment_due | payment_overdue | payment_processing | payment_success | error`).

### Agreement Hooks (`useAgreement.ts`)

| Hook | Type | Returns |
|------|------|---------|
| `useUploadAgreement(options?)` | mutation | `{ ...mutation, uploadProgress, resetProgress }` -- 3-step: signed URL, upload, process |
| `useExtractedData(extractionId, options?)` | query | `ExtractedAgreementData`, staleTime: 5min, retry: 2 |
| `useConfirmExtraction()` | mutation | creates tenancy, invalidates dashboard |
| `useUpdateExtraction()` | mutation | stores modifications in `user_modified_data` JSONB |
| `useAgreement(options?)` | combined | `{ extractionId, uploadProgress, upload, isUploading, extractedData, confirm, update, resetUpload, ... }` |

### Payment Hooks (`usePayments.ts`)

| Hook | Type | Key Config |
|------|------|------------|
| `usePaymentHistory(page?, limit?, filters?)` | query | staleTime: 5min |
| `useSavedPaymentMethods()` | query | staleTime: 10min |
| `useInitiatePayment(callbacks?)` | mutation | invalidates history + dashboard |
| `useAddUpiVpa()` | mutation | invalidates methods |
| `useAddCardToken()` | mutation | invalidates methods |
| `useAddPaymentMethod()` | mutation | generic, routes to UPI/card/netbanking |
| `useVerifyUpi()` | mutation | currently mock (1.5s delay) |
| `useDeletePaymentMethod()` | mutation | invalidates methods |
| `useGenerateReceipt()` | mutation | returns rich `ReceiptData` |
| `usePayments()` | combined | all history, methods, mutations, `refreshAll` |

### Profile Hooks (`useProfile.ts`)

| Hook | Type | Returns |
|------|------|---------|
| `useUpdateProfile()` | mutation | maps camelCase to snake_case, invalidates dashboard |
| `useUploadAvatar()` | mutation | 3-step presigned URL flow, invalidates dashboard |
| `useProfilePaymentMethods()` | query | richer than payment's version (grouped, primaryId), staleTime: 10min |
| `useProfile()` | combined | `{ updateProfile, uploadAvatar, paymentMethods, refreshAll, ... }` |

### Setup Hooks (`useSetup.ts`)

| Hook | Type | Edge Function |
|------|------|---------------|
| `useVerifyBank()` | mutation | `verify-bank` (POST, 30s timeout, Cashfree Penny Drop) |
| `useUtilityOperators()` | query | `verify-utility?action=operators` (GET, staleTime: 1hr, mock fallback) |
| `useVerifyUtility()` | mutation | `verify-utility` (POST, 30s timeout, API Club + Gemini) |
| `useSendLandlordInvite()` | mutation | `send-landlord-invite` (POST, email) |
| `useResendLandlordInvite()` | mutation | same edge fn with `resend=true` |
| `useSetupProgress(tenancyId)` | derived | derived from `useDashboard()`, NOT a separate API call |

Validation helpers exported: `validateAccountNumber`, `validateIfscCode`, `validatePhoneNumber`, `validateEmail`, `validateConsumerNumber`.
Format helpers: `formatAccountNumber`, `formatPhoneNumber`.

### Other Hooks

| Hook | Returns |
|------|---------|
| `useRequireAuth()` | `{ isReady, isAuthenticated }` -- guards protected routes, redirects to `/(auth)/beta-splash`. Skips auth in `__DEV__`. |
| `useIdentityFetch()` | fire-and-forget mutation for Cashfree Mobile 360 identity fetch |

---

## 3. Service Layer

All services in `@/src/services/api/`. Pattern: define raw edge function response types, map snake_case to camelCase, return `{ data, error }`.

| Service | Edge Functions Called | Auth | Method |
|---------|---------------------|------|--------|
| `auth.ts` | Supabase Auth SDK directly (`signInWithOtp`, `verifyOtp`) | N/A | N/A |
| `waitlist.ts` | `get-waitlist-status` (GET), `join-waitlist` (POST), `get-my-referral-code` (GET), `apply-referral-code` (POST), `validate-referral-code` (POST) | All require auth | Mixed |
| `dashboard.ts` | `dashboard-data` (POST) | Required | POST |
| `identity.ts` | `verify-identity` (POST) | Required | POST |
| `payments.ts` | `initiate-payment` (POST), `get-payment-history` (GET), `get-saved-payment-methods` (GET), `add-upi-vpa` (POST), `add-card-token` (POST), `delete-payment-method` (POST), `generate-receipt` (GET) | All require auth | Mixed |
| `profile.ts` | `update-profile` (POST), `upload-avatar` (POST), `get-saved-payment-methods` (GET) | All require auth | Mixed |
| `setup.ts` | `verify-bank` (POST, 30s), `verify-utility` (POST/GET, 30s), `send-landlord-invite` (POST) | All require auth | Mixed |
| `agreement.ts` | `upload-document` (POST, 30s), `process-document` (POST, 120s), `confirm-extraction` (POST), `update-extraction` (POST), plus direct Supabase table query for `getExtractedAgreementData` | All require auth | POST |

Additional services:
- `payment/payuService.ts` -- PayU Checkout Pro integration (native SDK or mock in Expo Go), payment status polling via direct Supabase table query
- `payment/storageService.ts` -- file upload to Supabase Storage buckets (agreements, utility-bills, id-documents, receipts)
- `notifications.ts` -- push notification scaffolding (NOT YET ACTIVE, all code commented out pending `expo-notifications` install)

---

## 4. React Query Config

Configured in `@/src/providers/QueryProvider.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 30 * 60 * 1000,         // 30 minutes
      retry: 2,
      retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),  // exponential backoff, max 30s
      refetchOnWindowFocus: false,     // mobile: no window focus events
      refetchOnReconnect: true,
    },
    mutations: { retry: 1 },
  },
});
```

Query key factories follow the pattern: `domainKeys.all -> domainKeys.subkey(params)`.

---

## 5. Supabase Client

Configured in `@/src/services/supabase/client.ts`.

- **Session storage**: `expo-secure-store` (encrypted on-device)
- **Auto refresh**: enabled
- **Persist session**: enabled
- **Client header**: `x-client-info: flent-secured-rn`
- **Env vars**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (fail-fast if missing)

### callEdgeFunction signature

```ts
async function callEdgeFunction<T>(
  functionName: string,
  body?: Record<string, unknown>,   // POST body or GET query params
  requireAuth?: boolean,            // default false
  method?: 'GET' | 'POST',         // default 'POST'
  timeoutMs?: number                // default 15_000
): Promise<{ data: T | null; error: string | null }>
```

- GET: converts body object to URLSearchParams
- POST: `JSON.stringify(body)`
- Timeout: `AbortController` with configurable ms
- Headers: `apikey`, `Content-Type: application/json`, `x-request-id: rn-{timestamp}-{random}`
- Auth: reads `session.access_token` from `supabase.auth.getSession()`

---

## 6. Error Handling Utilities

Located in `@/src/utils/errorHandling.ts`:

- `Result<T>` -- discriminated union: `{ success: true, data: T } | { success: false, error: AppError }`
- `tryCatch(fn, errorMessage)` -- wraps async with try/catch, returns `Result<T>`
- `getErrorMessage(error)` -- extracts string from Error, string, or `{ message }` shapes
- `logError(context, error)` -- dev-only console.error, TODO: Sentry in prod
- `createError(message, code?, originalError?)` and `createSuccess(data)`
