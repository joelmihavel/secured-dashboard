# Screens and Routing Reference

> Flent Secured -- React Native (Expo Router 6)
> Last updated: 2026-03-08

This document provides a comprehensive reference for every screen and route in the Flent Secured mobile application. It covers the routing architecture, full navigation flow, per-screen details (purpose, components, API calls, navigation targets, state management), and layout patterns.

---

## Table of Contents

1. [Routing Architecture](#1-routing-architecture)
2. [Navigation Flow](#2-navigation-flow)
3. [Screen Details](#3-screen-details)
   - [Auth Screens](#31-auth-screens)
   - [Agreement Screens](#32-agreement-screens)
   - [Waitlist Screens](#33-waitlist-screens)
   - [Setup Screens](#34-setup-screens)
   - [Main Screens](#35-main-screens)
   - [Payment Screens](#36-payment-screens)
   - [Profile Screens](#37-profile-screens)
   - [Other Screens](#38-other-screens)
4. [Layout Patterns](#4-layout-patterns)
5. [Route Group Summary Table](#5-route-group-summary-table)

---

## 1. Routing Architecture

### File-Based Routing with Expo Router 6

The app uses Expo Router's file-based routing convention. Every `.tsx` file inside `rn-app/app/` becomes a route. Route groups (directories prefixed with parentheses) provide organizational grouping without affecting the URL path.

### Root Layout (`_layout.tsx`)

The root layout wraps the entire app in a provider stack. It never returns `null` -- doing so would crash the navigator. The provider hierarchy from outermost to innermost:

```
KeyboardProvider
  ErrorBoundary
    QueryProvider          (React Query)
      AuthProvider         (Supabase auth state)
        GestureHandlerRootView
          ThemeProvider     (custom dark theme, bg #131313)
            SafeAreaProvider
              StatusBar
              OfflineBanner
              UpdateBanner
              <Stack>      (root navigator)
```

**Key behaviors:**

- **Custom dark theme** -- Background color `#131313` on all screens to prevent white flashes during navigation transitions.
- **DOMException polyfill** -- Runs before any import to prevent Hermes crashes on iOS background resume (Supabase Realtime references `DOMException`).
- **Font loading** -- Loads PlusJakartaSans (Regular, Medium, SemiBold, Bold) and Inter-Regular. The native splash screen stays visible until fonts load.
- **Splash screen timing** -- `SplashScreen.hideAsync()` is NOT called on font load. It is deferred to `index.tsx` after journey resolution, with an 8-second safety timeout.
- **Global defaults** -- `maxFontSizeMultiplier` capped at 1.3 for `Text` and 1.2 for `TextInput` to control Dynamic Type scaling.
- **Sentry init** -- Deferred to a microtask to avoid TurboModule contention at module scope.
- **OTA updates** -- Auto-check on foreground via `setupAutoUpdateCheck()`.
- **Deep linking** -- Handled by `useDeepLink()` hook.
- **Error navigation** -- `useErrorNavigation()` bridges the error event bus to `router.replace('/error')`.

**Root Stack screen registration:**

| Screen Name | Animation | Notes |
|---|---|---|
| `index` | (default fade) | Journey router -- renders `SkeletonLoader` |
| `error` | fade | Error fallback |
| `(auth)` | slide_from_right, 250ms | Auth flow |
| `(main)` | fade | Home dashboard |
| `(setup)` | fade | Post-approval setup |
| `(payment)` | fade, transparentModal | Overlay on top of main |
| `(waitlist)` | fade | Waitlist screens |
| `(agreement)` | fade | Agreement upload/review |
| `(profile)` | slide_from_right, 250ms | Profile screens |
| `(dev)` | (default) | DEV only, conditional render |

All screens use `freezeOnBlur: true`, `gestureEnabled: false`, and `headerShown: false`.

### Journey-Aware Router (`index.tsx`)

The root `index.tsx` is the entry point for all authenticated sessions. It determines where the user should land based on their `user_status` in the database.

**Resolution strategy (three paths):**

1. **Fast path** -- Reads a cached route from `SecureStore` (`flent_last_journey_target`). If found and valid (`/(main)`, `/(setup)`, or `/(waitlist)`), navigates immediately. Background-validates via PostgREST and corrects if stale. This avoids 1-3s of network calls on every app open.

2. **Primary path** -- Calls `supabase.auth.getUser()` (server-side validation), then queries `public.users` via PostgREST for `user_status`. If `getUser()` returns 404 (user deleted server-side), forces sign-out to clear the stale cached session.

3. **Fallback path** -- If PostgREST fails, calls the `getWaitlistStatus()` edge function via `callEdgeFunction`.

**Additional pre-flight checks:**

- Waits for upload store hydration (max 500ms) before reading extraction state.
- Checks `usePaymentStore` for an in-progress payment (within 30 minutes). If found, routes directly to `/(payment)/status` for crash recovery.
- If both routing paths fail but a valid session exists (transient network issue), defaults to `/(agreement)/upload` as a safe fallback rather than signing out.

**Status-to-route mapping:**

| `user_status` | Target Route |
|---|---|
| `approved` | `/(setup)` |
| `active` | `/(main)` |
| `agreement_confirmed`, `waitlisted`, `not_eligible` | `/(waitlist)` |
| `signed_up` | Depends on upload/extraction state (see below) |
| Any other / not found | `/(agreement)/upload` |
| Not authenticated | `/(auth)/beta-splash` |

**Special handling for `signed_up` status:**

- Checks for a completed extraction awaiting manual review via PostgREST query on `extracted_rental_info`.
- If manual review pending, routes to `/(waitlist)`.
- If upload store has a completed extraction (not dismissed), routes to `/(agreement)/review`.
- Otherwise routes to `/(agreement)/upload`.

**Payment recovery:**

Before resolving the journey, checks `usePaymentStore` for an in-progress payment (within 30 minutes). If found, routes directly to `/(payment)/status?paymentId=...&initialStatus=pending`.

**Review mode:**

If `isReviewMode()` is true (App Store review), routes directly to `/(main)` without a real Supabase session.

### Route Groups

| Group | Purpose | Layout Animation |
|---|---|---|
| `(auth)` | Authentication flow (splash, carousel, sign-up, OTP) | slide_from_right |
| `(agreement)` | Agreement upload and review | slide_from_right |
| `(waitlist)` | Waitlist pending, rejected, approved | slide_from_right |
| `(setup)` | Post-approval setup (bank, utility, landlord invite) | slide_from_right |
| `(main)` | Home dashboard | (none) |
| `(payment)` | Payment flow (enter rent, confirm, status) | slide_from_bottom (transparentModal) |
| `(profile)` | User profile, agreement view, bank details edit | slide_from_right |
| `(dev)` | Dev-only screen picker (conditional, `__DEV__` only) | (default) |

---

## 2. Navigation Flow

```
App Launch
    |
    v
[index.tsx] -- Journey Router
    |
    |-- Not authenticated -------> (auth)/beta-splash
    |                                      |
    |                               auto-navigate (2.5s)
    |                                      |
    |                                      v
    |                               (auth)/splash
    |                                      |
    |                            "Get Started" or "Log in"
    |                                      |
    |                                      v
    |                               (auth)/carousel
    |                                      |
    |                                "Skip" or swipe
    |                                      |
    |                                      v
    |                               (auth)/sign-up
    |                                      |
    |                              "Get Started" (OTP sent)
    |                                      |
    |                                      v
    |                               (auth)/otp  [bottom sheet modal]
    |                                      |
    |                              OTP verified --> SIGNED_IN
    |                                      |
    |                                      v
    |                              router.replace('/')
    |                              [re-enters journey router]
    |
    |-- signed_up (no extraction) -> (agreement)/upload
    |                                      |
    |                              Document uploaded + processed
    |                                      |
    |                                      v
    |                               (agreement)/review
    |                                      |
    |                              "Proceed" (confirm extraction)
    |                                      |
    |                                      v
    |-- waitlisted/agreement_confirmed -> (waitlist)/index
    |                                      |
    |                              Admin approves (auto-redirect)
    |                                      |
    |                                      v
    |                               (waitlist)/approved
    |                                      |
    |                              "Step Inside"
    |                                      |
    |                                      v
    |-- approved -----------------> (setup)/index  [3-step carousel]
    |                                      |
    |                              "Start Flenting"
    |                                      |
    |                                      v
    |                               (setup)/add-bank
    |                                      |
    |                              Bank + PAN verified
    |                                      |
    |                                      v
    |                               (setup)/add-utility
    |                                      |
    |                              Utility verified (or skip)
    |                                      |
    |                                      v
    |                               (setup)/invite-landlord
    |                                      |
    |                              Invite sent (or skip)
    |                                      |
    |                                      v
    |                               (setup)/pending-steps
    |                                      |
    |                              "Start Earning"
    |                                      |
    |                                      v
    |-- active -------------------> (main)/index  [home dashboard]
    |                                  |       |
    |                           Pay Rent    Profile
    |                              |           |
    |                              v           v
    |                      (payment)/      (profile)/
    |                      enter-rent      index
    |                          |              |
    |                          v         edit / agreement /
    |                      (payment)/    edit-bank-details
    |                      status
    |
    |-- Error at any point ------> /error
```

---

## 3. Screen Details

### 3.1 Auth Screens

#### `/(auth)/beta-splash` -- Beta Splash Screen

| Property | Value |
|---|---|
| **Route** | `/(auth)/beta-splash` |
| **File** | `app/(auth)/beta-splash.tsx` |
| **Purpose** | Animated brand splash with "BETA LAUNCH" badge. Auto-navigates to the main splash screen after 2.5 seconds. |
| **Key Components** | `Screen`, `Logo`, `Text`, `DottedGridPattern`, Reanimated `Animated.View` |
| **API Services** | None |
| **Navigation Targets** | `/(auth)/splash` (auto-navigate after 2.5s, skipped in preview mode) |
| **State Management** | Local animation shared values (`logoOpacity`, `logoScale`, `badgeOpacity`, `badgeTranslateY`) |
| **Search Params** | `preview` -- if `"true"`, disables auto-navigation (used for dev screenshots) |

#### `/(auth)/splash` -- Get Started Screen

| Property | Value |
|---|---|
| **Route** | `/(auth)/splash` |
| **File** | `app/(auth)/splash.tsx` |
| **Purpose** | Main landing screen with brand heading ("Make your rent work for you"), "Get Started" CTA button, and "Already a user? Log in" link. |
| **Key Components** | `Screen`, `Logo`, `Text`, `PrimaryButton`, `DottedGridPattern` |
| **API Services** | None |
| **Navigation Targets** | `/(auth)/carousel` (via "Get Started" -- `router.replace`), `/(auth)/sign-up` (via "Log in" -- `router.push`) |
| **State Management** | `navigating` ref to prevent double-tap |

#### `/(auth)/carousel` -- Onboarding Carousel

| Property | Value |
|---|---|
| **Route** | `/(auth)/carousel` |
| **File** | `app/(auth)/carousel.tsx` |
| **Purpose** | Three-slide horizontal swipeable carousel introducing key features: cashback on rent, renting benefits, and landlord benefits. Background illustrations cross-fade between slides. |
| **Key Components** | `Screen`, `Logo`, `Text`, `DottedGridPattern`, `CarouselDots`, `FlatList` (horizontal, paginated), `Illustration1/2/3` |
| **API Services** | None |
| **Navigation Targets** | `/(auth)/sign-up` (via "Skip"/"Continue" button -- `router.push`) |
| **State Management** | `activeIndex` state driven by `onViewableItemsChanged` callback |
| **Search Params** | `page` -- initial carousel page (1-indexed) |

#### `/(auth)/sign-up` -- Sign Up Screen

| Property | Value |
|---|---|
| **Route** | `/(auth)/sign-up` |
| **File** | `app/(auth)/sign-up.tsx` |
| **Purpose** | Collects user phone number and name with country code selector and consent toggle. Sends OTP via Supabase Auth (or Mobile360 for identity verification). |
| **Key Components** | `Screen`, `Logo`, `Text`, `PrimaryButton`, `PhoneInput`, `TextInput`, `DottedGridPattern`, `ConsentToggle`, `KeyboardAwareScrollView` |
| **API Services** | `useAuth().sendCode()` -- sends OTP to phone number |
| **Navigation Targets** | `/(auth)/otp` (on successful OTP send -- `router.push`) |
| **State Management** | `useAuthStore` (Zustand) -- `setUserName()`, `setConsentForMobile360()`. Local state for phone, name, country code, consent, validation errors. |
| **Validation** | Phone: country-specific digit count, India requires first digit 6-9. Name: minimum 2 characters. Consent: required. |

#### `/(auth)/otp` -- OTP Verification (Bottom Sheet)

| Property | Value |
|---|---|
| **Route** | `/(auth)/otp` |
| **File** | `app/(auth)/otp.tsx` |
| **Purpose** | Six-digit OTP entry presented as a bottom sheet modal over the sign-up screen. Features auto-verify on complete entry, resend with cooldown, exponential backoff on failures, and OTP expiration timer. |
| **Key Components** | `BottomSheet`, `OTPInput`, `PrimaryButton`, `Text` |
| **API Services** | `useAuth().verifyCode()` -- verifies OTP against Supabase Auth. `useAuth().resendCode()` -- re-sends OTP. `supabase.auth.onAuthStateChange` -- listens for `SIGNED_IN` event. |
| **Navigation Targets** | `/` (root -- re-enters journey router on successful verification via `router.replace`) |
| **State Management** | `useAuthStore` (reads `userName`, `phoneNumber`). Local state for OTP value, cooldown timers, resend countdown, OTP expiry. Ref-based guards for double-submission prevention. |
| **Presentation** | `transparentModal` with fade animation -- sign-up screen visible behind |
| **Timers** | Resend cooldown: 10 seconds. OTP validity: 600 seconds (10 minutes). Exponential backoff on errors: 2s, 4s, 8s, capped at 15s. |

---

### 3.2 Agreement Screens

#### `/(agreement)/upload` -- Agreement Upload

| Property | Value |
|---|---|
| **Route** | `/(agreement)/upload` |
| **File** | `app/(agreement)/upload.tsx` |
| **Purpose** | Allows the user to upload a rental agreement document (PDF or image). Handles file selection via `expo-document-picker`, upload progress animation, real-time extraction status polling, and error recovery. |
| **Key Components** | `Screen`, `Text`, `PrimaryButton`, `Logo`, `DottedGridPattern`, Reanimated animations for upload progress |
| **API Services** | `useAgreement().upload()` -- uploads document to Supabase Storage. `useExtractionStatus()` -- polls extraction status. `abandonExtraction()` -- soft-deletes an extraction on re-upload. |
| **Navigation Targets** | `/(agreement)/review` (on extraction complete -- `router.replace`). Uses `useMountDiscovery` to detect existing extractions and redirect. |
| **State Management** | `useUploadStore` (Zustand, persisted to SecureStore) -- tracks `uploadPhase`, `extractionId`, `dismissedExtractionId`, `fileName`. React Query for extraction data. |
| **Search Params** | `forceNew` -- if `"true"`, skips mount discovery and starts fresh upload |
| **File Validation** | MIME type validation, file size limit, agreement type check |

#### `/(agreement)/review` -- Agreement Review

| Property | Value |
|---|---|
| **Route** | `/(agreement)/review` |
| **File** | `app/(agreement)/review.tsx` |
| **Purpose** | Displays extracted agreement details (Agreement ID, property, tenants, landlords, rent, deposit, duration, exit date) in read-only detail rows. User confirms details to proceed or re-uploads. |
| **Key Components** | `Screen`, `Text`, `PrimaryButton`, `DottedGridPattern`, `DetailRow` (custom), `FlentLogoIcon`, `AgreementIdIcon`, `PropertyIcon`, `TenantIcon`, `LandlordIcon` |
| **API Services** | `useAgreement().extractedData` -- fetches extracted data. `useAgreement().confirm()` -- confirms extraction (calls `confirm-extraction` edge function). `abandonExtraction()` -- soft-deletes extraction on re-upload. |
| **Navigation Targets** | `/(waitlist)` (on confirm -- `router.replace`). `/(agreement)/upload` (on "Re-upload Agreement" -- `router.replace` with `forceNew`). |
| **State Management** | `useUploadStore` (reads `extractionId`, `dismissedExtractionId`). React Query with stale cache retry logic (up to 5 retries with 1.5s delays). Refetch on app foreground via `AppState` listener. |
| **Search Params** | `extractionId` -- extraction ID (falls back to persisted store value) |

---

### 3.3 Waitlist Screens

#### `/(waitlist)/index` -- Waitlist Status

| Property | Value |
|---|---|
| **Route** | `/(waitlist)` |
| **File** | `app/(waitlist)/index.tsx` |
| **Purpose** | Multi-state waitlist screen with 6 view states: loading, pending, pending_long, rejected, approved, error. Includes application timeline, referral code input, progress arc, and benefits card. Auto-redirects to approved screen with animated transition. |
| **Key Components** | `Screen`, `Text`, `Logo`, `PrimaryButton`, `ApplicationTimeline`, `ReferralCodeInput`, `ProgressArc`, `BenefitsCard`, `DottedGridPattern`, `SkeletonLoader` |
| **API Services** | `useWaitlist()` -- fetches waitlist status (calls `join-waitlist` or `admin-waitlist` edge functions). `joinWaitlist()` -- auto-joins on first visit. `claimInviteCode()` -- validates and applies referral code. |
| **Navigation Targets** | `/(waitlist)/approved` (auto-redirect when `viewState === 'approved'` -- animated transition). `/(agreement)/upload` (if `AGREEMENT_NOT_CONFIRMED` error). |
| **State Management** | `useWaitlist` hook manages all waitlist state (status, viewState, referralCode, countdownText, etc.). Pull-to-refresh via `RefreshControl`. |
| **View States** | `loading` (skeleton), `pending` (timeline + invite code), `pending_long` (different messaging), `approved` (auto-redirect), `rejected` (reasons + countdown), `error` (retry) |

#### `/(waitlist)/approved` -- Waitlist Approved

| Property | Value |
|---|---|
| **Route** | `/(waitlist)/approved` |
| **File** | `app/(waitlist)/approved.tsx` |
| **Purpose** | Celebration screen shown when user is approved. Features confetti animation, spring-animated header, timeline showing all steps complete, benefits card, and "Step Inside" CTA. |
| **Key Components** | `Text`, `Logo`, `PrimaryButton`, `ApplicationTimeline`, `BenefitsCard`, `DottedGridPattern`, `LottieView` (confetti) |
| **API Services** | `useWaitlist()` -- reads user name, status data for timeline |
| **Navigation Targets** | `/(setup)` (via "Step Inside" -- `router.replace` with fade transition) |
| **State Management** | `useWaitlist` hook. Animation shared values for header, timeline, transition overlay. |
| **Haptic Feedback** | `Haptics.notificationAsync(Success)` on mount |

---

### 3.4 Setup Screens

#### `/(setup)/index` -- Setup Carousel

| Property | Value |
|---|---|
| **Route** | `/(setup)` |
| **File** | `app/(setup)/index.tsx` |
| **Purpose** | Three-card horizontal carousel introducing the setup steps: add landlord bank details, upload address proof, invite landlord. Cards have decorative perforations, crosshatch patterns, and a Flent logo. |
| **Key Components** | `Screen`, `Text`, `PrimaryButton`, `Logo`, `DottedGridPattern`, `FlatList` (horizontal, snapped), `SetupCard` (custom), `PageIndicator` (custom) |
| **API Services** | None |
| **Navigation Targets** | `/(setup)/add-bank` (via "Start Flenting" button, only active on last step) |
| **State Management** | `activeIndex` local state. Button is disabled on steps 1-2, active on step 3. |
| **Search Params** | `step` -- initial step (1-indexed) for automated testing |

#### `/(setup)/add-bank` -- Add Bank Details

| Property | Value |
|---|---|
| **Route** | `/(setup)/add-bank` |
| **File** | `app/(setup)/add-bank.tsx` |
| **Purpose** | Collects landlord bank account number, IFSC code, and PAN card number. Runs penny-drop verification followed by PAN verification in a chained flow. |
| **Key Components** | `Text`, `TextInput`, `PrimaryButton`, `ScreenTitle`, `Logo`, `AlertBanner`, `KeyboardAvoidingView` |
| **API Services** | `useVerifyBank().mutate()` -- calls `verify-bank` edge function (Cashfree penny drop). `useVerifyPan().mutate()` -- calls PAN verification (chained on bank success). `useDashboard()` -- reads `tenancy.id`. |
| **Navigation Targets** | `/(setup)/add-utility` (auto-navigate 1.2s after both bank + PAN verified) |
| **State Management** | Local form state (accountNumber, ifscCode, panCard). Verification results tracked separately for bank and PAN. Fields lock after individual verification succeeds. |
| **Progress Bar** | Shows 33% (step 1 of 3) |
| **Validation** | Account number: 9-18 digits. IFSC: standard format. PAN: `[A-Z]{5}\d{4}[A-Z]`. |

#### `/(setup)/add-utility` -- Verify Utility Bill

| Property | Value |
|---|---|
| **Route** | `/(setup)/add-utility` |
| **File** | `app/(setup)/add-utility.tsx` |
| **Purpose** | Verifies the user's electricity bill to confirm their address. Features an operator selector (with BESCOM as default) and consumer number input. Can be skipped. |
| **Key Components** | `Text`, `TextInput`, `PrimaryButton`, `ScreenTitle`, `BackButton`, `AlertBanner`, `DottedGridPattern`, `KeyboardAvoidingView`, `Modal` (operator picker) |
| **API Services** | `useVerifyUtility().mutate()` -- calls `verify-utility` edge function. `useUtilityOperators()` -- fetches available operators list. `useDashboard()` -- reads `tenancy.id`. |
| **Navigation Targets** | `/(setup)/invite-landlord` (on verification success or skip). `/(main)` (on skip/success if `reentry` param is set). |
| **State Management** | Local form state. Animated progress bar (33% to 67%). Operator list via React Query. |
| **Progress Bar** | Animates from 33% to 67% (step 2 of 3) |
| **Search Params** | `reentry` -- if set, navigates back to `/(main)` instead of forward |

#### `/(setup)/invite-landlord` -- Invite Landlord

| Property | Value |
|---|---|
| **Route** | `/(setup)/invite-landlord` |
| **File** | `app/(setup)/invite-landlord.tsx` |
| **Purpose** | Collects the landlord's phone number and sends a WhatsApp invite. Pre-fills from existing tenancy data. Can be skipped. Includes a "How to invite your landlord?" banner with learn-more link. |
| **Key Components** | `Screen`, `Text`, `PhoneInput`, `PrimaryButton`, `ScreenTitle`, `BackButton`, `AlertBanner`, `DottedGridPattern`, `KeyboardAvoidingView` |
| **API Services** | `useSendLandlordInvite().mutate()` -- calls `invite-landlord-whatsapp` edge function. `useDashboard()` -- reads `tenancy.id`, `tenancy.landlord_phone`. |
| **Navigation Targets** | `/(setup)/pending-steps` (on invite success or skip). `/(main)` (if `reentry` param is set). |
| **State Management** | Local form state. Animated progress bar (67% to 100%). |
| **Progress Bar** | Animates from 67% to 100% (step 3 of 3) |
| **Search Params** | `reentry` -- if set, navigates back to `/(main)` instead of forward |

#### `/(setup)/pending-steps` -- Personalized Cashback Plan

| Property | Value |
|---|---|
| **Route** | `/(setup)/pending-steps` |
| **File** | `app/(setup)/pending-steps.tsx` |
| **Purpose** | Displays a personalized cashback plan card showing the user's name, cashback rate (1%), monthly rent, and estimated monthly cashback. Acts as the final setup summary before entering the main app. |
| **Key Components** | `Screen`, `Text`, `Logo`, `PrimaryButton`, `DottedGridPattern`, `BgLine` (decorative) |
| **API Services** | `useDashboard()` -- reads `user` (name) and `tenancy` (monthly_rent) |
| **Navigation Targets** | `/(main)` (via "Start Earning" -- `router.replace`) |
| **State Management** | Dashboard data via React Query |

---

### 3.5 Main Screens

#### `/(main)/index` -- Home Dashboard

| Property | Value |
|---|---|
| **Route** | `/(main)` |
| **File** | `app/(main)/index.tsx` |
| **Purpose** | The primary app dashboard. Renders different layouts based on `DashboardState` (empty, no_tenancy, setup_incomplete, pending_verification, all_verified, payment_due, payment_overdue). Includes greeting header, headline/cashback cards, rent status carousel, tab switcher (Recent Payments / Cashbacks), and a bottom footer with "Pay Rent" CTA. Redirects to `/(agreement)/upload` if `no_tenancy`. |
| **Key Components** | `Screen`, `Text`, `Logo`, `PrimaryButton`, `DottedGridPattern`, `HomeHeader`, `HeadlineSection`, `WarningBanner`, `StatusNotificationBanner`, `RentStatusCarousel`, `TabSwitcher`, `RecentPaymentsList`, `CashbacksList`, `BottomFooter`, `HomeEmptyState`, `VerificationCheckSheet`, `SetupProgressCard`, `EmptyPaymentsState`, `CashbackEmptyState` |
| **API Services** | `useDashboard()` -- fetches all dashboard data (user, tenancy, payments, cashbacks, verification status). `useRefreshDashboard()` -- pull-to-refresh. `usePaymentStamps()` -- fetches payment stamp images. |
| **Navigation Targets** | `/(payment)/enter-rent` (via "Pay Rent" footer button or inline CTA). `/(profile)` (via profile avatar tap). `/(setup)/add-utility?reentry=true` and `/(setup)/invite-landlord?reentry=true` (via setup progress cards). |
| **State Management** | `useDashboard` React Query hook. `usePaymentStore` (Zustand). `DashboardState` derived from resolved data (`getDashboardState()`). Tab state for Recent Payments / Cashbacks switcher. |
| **Dashboard States** | `empty` (no payments yet), `no_tenancy` (redirects to agreement upload), `setup_incomplete` (missing bank/utility/landlord), `pending_verification` (waiting for verification), `all_verified` (all steps done), `payment_due` (normal due state), `payment_overdue` (overdue warning) |

---

### 3.6 Payment Screens

#### `/(payment)/enter-rent` -- Enter Rent Amount

| Property | Value |
|---|---|
| **Route** | `/(payment)/enter-rent` |
| **File** | `app/(payment)/enter-rent.tsx` |
| **Purpose** | Thin wrapper that opens the `PaymentMethodModal` bottom sheet with `initialView="enter-amount"`. The modal handles the entire payment flow internally: enter amount, select payment method (UPI/card/netbanking), add method details, initiate payment via PayU SDK. |
| **Key Components** | `PaymentMethodModal` (contains `EnterAmountContent`, `MethodSelectorContent`, add-method sub-views) |
| **API Services** | Inside `PaymentMethodModal`: `initiate-payment` edge function (via `usePayments()`), PayU Custom Browser SDK for payment gateway. `useDashboard()` -- reads `tenancy`, `upcomingPayment`. |
| **Navigation Targets** | Back to previous screen (on close). `/(payment)/status` (on payment initiated, via PayU callback). |
| **State Management** | Local `showModal` state. Modal manages its own internal navigation state. |
| **Presentation** | `transparentModal` with no animation (the BottomSheet handles its own slide-up) |

#### `/(payment)/confirm` -- Confirm Payment (Redirect)

| Property | Value |
|---|---|
| **Route** | `/(payment)/confirm` |
| **File** | `app/(payment)/confirm.tsx` |
| **Purpose** | Legacy redirect wrapper. The confirm-payment flow now lives inside `PaymentMethodModal`. This route is kept for backward compatibility with deep links and cached push notification payloads. Immediately redirects to `/(payment)/enter-rent`. |
| **Key Components** | None (plain `View`) |
| **API Services** | None |
| **Navigation Targets** | `/(payment)/enter-rent` (immediate redirect) |

#### `/(payment)/status` -- Payment Status

| Property | Value |
|---|---|
| **Route** | `/(payment)/status` |
| **File** | `app/(payment)/status.tsx` |
| **Purpose** | Consolidated status screen replacing separate success/processing/failed screens. Uses a `useReducer` state machine to render PENDING, SUCCESS, FAILED, REFUNDED, or TIMED_OUT states. Features payment receipt card, polling, PDF receipt generation, and contact support. |
| **Key Components** | `Screen`, `Text`, `PrimaryButton`, `BackButton`, `PaymentReceiptCard`, `DashedDivider`, `OfflineBanner` |
| **API Services** | `checkPaymentStatus()` -- polls payment status (5s interval, 300s timeout for card/netbanking, 360s for UPI; Realtime handles fast path). `generateReceipt()` -- fetches receipt data from `generate-receipt` edge function. `useRealtimeQuery()` -- Supabase Realtime subscription for status updates. `expo-print` + `expo-sharing` -- PDF receipt generation. |
| **Navigation Targets** | `/(main)` (via "Go Home" or back button). `/(payment)/enter-rent` (via "Try Again" on failure). |
| **State Management** | `useReducer` (`statusReducer`) with `StatusState` and `PendingSubState`. `usePaymentStore` (clears `lastPaymentId` on resolution). `useNetworkStatus()` for network-aware polling. React Query cache invalidation on status resolution (`paymentHistory`, `dashboard`). |
| **Search Params** | `paymentId`, `amount`, `method`, `cashback`, `transactionId`, `initialStatus`, `error`, `source`, `landlordName`, `agreementId` |
| **Back Guard** | Intercepts hardware back when pending (shows alert). Navigates home otherwise. |

---

### 3.7 Profile Screens

#### `/(profile)/index` -- Profile Home

| Property | Value |
|---|---|
| **Route** | `/(profile)` |
| **File** | `app/(profile)/index.tsx` |
| **Purpose** | Main profile screen with sections: Secured Account (user info, agreement), Payment Information (edit bank details), Support (contact support, rate app), and App (terms, privacy, sign out, delete account). |
| **Key Components** | `Screen`, `Text`, `Avatar`, `TextInput` (read-only), `PhoneInput` (read-only), `BackButton`, `DottedGridPattern`, `MenuItem`, `CardMenuItem` |
| **API Services** | `useDashboard()` -- reads `user`, `tenancy`. `useAuth().signOut()` -- signs out. `useDeleteAccount().mutate()` -- deletes account. `StoreReview.requestReview()` -- app store review prompt. |
| **Navigation Targets** | Back (via back button). `/(profile)/edit` (via user info row). `/(profile)/agreement` (via "View Agreement"). `/(profile)/edit-bank-details` (via "Edit Landlord Bank Details"). External: `mailto:secured@flent.in` (support), App Store URL (rate), `flent.in` (terms, privacy). |
| **State Management** | Dashboard data via React Query |

#### `/(profile)/edit` -- Edit Profile

| Property | Value |
|---|---|
| **Route** | `/(profile)/edit` |
| **File** | `app/(profile)/edit.tsx` |
| **Purpose** | Edit user profile. Currently allows editing user name and viewing city and phone (read-only). Shows user avatar. |
| **Key Components** | `Screen`, `Text`, `TextInput`, `PhoneInput` (disabled), `PrimaryButton`, `Avatar`, `BackButton`, `DottedGridPattern`, `KeyboardAvoidingView` |
| **API Services** | `useDashboard()` -- reads `user` data. `useUpdateProfile().mutate()` -- updates user name (calls profile update edge function). |
| **Navigation Targets** | Back (via back button or on save success) |
| **State Management** | Local form state (name, city). React Query mutation for update. |

#### `/(profile)/agreement` -- View Agreement

| Property | Value |
|---|---|
| **Route** | `/(profile)/agreement` |
| **File** | `app/(profile)/agreement.tsx` |
| **Purpose** | Read-only view of the confirmed rental agreement details. Shows same fields as the review screen (Agreement ID, property, tenants, landlords, rent, deposit, duration, exit date) but without edit capability. |
| **Key Components** | `Screen`, `Text`, `BackButton`, `DottedGridPattern`, `InlineDetailRow` (custom), `StackedDetailRow` (custom) |
| **API Services** | `useDashboard()` -- reads `tenancy` data |
| **Navigation Targets** | Back (via back button) |
| **State Management** | Dashboard data via React Query. Computed detail rows from tenancy data. |

#### `/(profile)/edit-bank-details` -- Edit Bank Details

| Property | Value |
|---|---|
| **Route** | `/(profile)/edit-bank-details` |
| **File** | `app/(profile)/edit-bank-details.tsx` |
| **Purpose** | Allows users to update landlord bank details after onboarding. Pre-fills from existing bank data. Runs Cashfree penny drop verification. PAN is frozen (read-only, carried over on backend). |
| **Key Components** | `Screen`, `Text`, `TextInput`, `PrimaryButton`, `ScreenTitle`, `BackButton`, `AlertBanner`, `DottedGridPattern`, `KeyboardAvoidingView` |
| **API Services** | `useDashboard()` -- reads `tenancy.id`, `landlordBank`. `useVerifyBank().mutate()` -- calls `verify-bank` edge function with `existingBankAccountId` for update flow (safety reset, penny drop, insert new row, copy PAN). |
| **Navigation Targets** | Back (auto-navigate 1.2s after verification success) |
| **State Management** | Local form state (pre-filled from `landlordBank`). Verification result tracking. Fields lock after verification succeeds. |
| **Validation** | Account holder name: required. Account number: 9-18 digits. IFSC: standard format. PAN: read-only, shown with masked value. |

---

### 3.8 Other Screens

#### `/error` -- Error Screen

| Property | Value |
|---|---|
| **Route** | `/error` |
| **File** | `app/error.tsx` |
| **Purpose** | Generic error screen for recoverable errors. Auto-triggered by the error event bus for fatal errors (5xx, unhandled rejections). Shows error title, message, error ID badge, expandable technical details, primary action button, and contact support link. Detects error loops (3+ errors in 30s) and switches to "Contact Support" mode. |
| **Key Components** | `Screen`, `Text`, `PrimaryButton`, `WarningIcon` (SVG) |
| **API Services** | `buildSupportEmailUri()` -- constructs pre-filled support email |
| **Navigation Targets** | Back or home (via primary action). `mailto:` (via contact support). Configurable via `action` search param. |
| **Search Params** | `title`, `message`, `action` ("back"/"home"/"retry"/route path), `actionLabel`, `errorId`, `timestamp`, `source`, `technicalMessage`, `isLooping` |

#### `/(dev)/screen-picker` -- Dev Screen Picker

| Property | Value |
|---|---|
| **Route** | `/(dev)/screen-picker` |
| **File** | `app/(dev)/screen-picker.tsx` |
| **Purpose** | Development-only screen navigator. Lists all screens organized by group with search, Figma node IDs toggle, and expand/collapse controls. Only available when `__DEV__` is true. |
| **Key Components** | `SafeAreaView`, `ScrollView`, `TextInput` (search), `Switch` (Figma IDs toggle) |
| **API Services** | None |
| **Navigation Targets** | Any screen in the app (via `router.push`) |
| **State Management** | Local state for search query, expanded sections, Figma nodes toggle |
| **Exports** | `DISABLE_SCREEN_PICKER` (boolean) -- set to `true` to bypass picker. `DEV_DIRECT_SCREEN` (string or null) -- set to a route path for direct navigation. |

---

## 4. Layout Patterns

### Critical: All Layouts MUST Render `<Stack>` Unconditionally

Every `_layout.tsx` in the app (root and nested) must render a `<Stack>` (or `<Slot>`) navigator on **every render**, including while auth is loading. This is a hard requirement from Expo Router's native screen management.

**What happens if violated:** Returning a plain `<View>` or `null` while waiting for data destroys the native `react-native-screens` container. When the Stack re-renders on the next state change, the native side crashes with "PropertyDOM doesn't exist" because the previous screen views were deallocated.

**The fix:** Auth redirects are handled exclusively in the root `index.tsx` journey router, not in individual layouts. All six protected layouts (`agreement`, `main`, `setup`, `waitlist`, `profile`, `payment`) render their `<Stack>` unconditionally.

### Common Layout Configuration

All nested layouts share this pattern:

```tsx
export default function SomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black[700] },
        animation: 'slide_from_right',  // or 'fade'
        freezeOnBlur: true,  // prevents background re-render
      }}
    >
      <Stack.Screen name="screen-name" />
    </Stack>
  );
}
```

### Layout-Specific Variations

| Layout | Animation | Special Options |
|---|---|---|
| **Auth** | `slide_from_right` (250ms) | OTP screen uses `transparentModal` + `fade` with transparent background |
| **Agreement** | `slide_from_right` | Standard |
| **Waitlist** | `slide_from_right` | Standard |
| **Setup** | `slide_from_right` | Standard |
| **Main** | (none specified) | Single screen (index) |
| **Payment** | `slide_from_bottom` (250ms) | `transparentModal` presentation. `enter-rent` has `animation: 'none'`. `status` overrides to `card` presentation with `fade`. |
| **Profile** | `slide_from_right` | Standard |
| **Dev** | (default) | Conditionally rendered (`__DEV__` only) |

### Background Pattern

Nearly all screens use `<DottedGridPattern fadeMask={false} />` as a background layer. This renders:
- Dotted grid image at 8% opacity
- Optional background shape (gradient overlay at 40-48% opacity)
- The component is positioned absolutely behind content

### Screen Component

Most screens wrap content in the shared `<Screen>` component which handles:
- Background color (`#131313`)
- Safe area insets (configurable via `safeAreaTop`/`safeAreaBottom`)
- Optional padding (`padded` prop)
- Test IDs for automated testing

---

## 5. Route Group Summary Table

| Route | File | Auth Required | Key API Calls |
|---|---|---|---|
| `/` | `index.tsx` | Varies | `supabase.auth.getUser()`, PostgREST `users`, `getWaitlistStatus()` |
| `/error` | `error.tsx` | No | None |
| `/(auth)/beta-splash` | `(auth)/beta-splash.tsx` | No | None |
| `/(auth)/splash` | `(auth)/splash.tsx` | No | None |
| `/(auth)/carousel` | `(auth)/carousel.tsx` | No | None |
| `/(auth)/sign-up` | `(auth)/sign-up.tsx` | No | `sendCode()` (Supabase Auth OTP) |
| `/(auth)/otp` | `(auth)/otp.tsx` | No | `verifyCode()`, `resendCode()`, `onAuthStateChange` |
| `/(agreement)/upload` | `(agreement)/upload.tsx` | Yes | `upload()`, `useExtractionStatus()`, `abandonExtraction()` |
| `/(agreement)/review` | `(agreement)/review.tsx` | Yes | `extractedData`, `confirm()`, `abandonExtraction()` |
| `/(waitlist)` | `(waitlist)/index.tsx` | Yes | `useWaitlist()`, `joinWaitlist()`, `claimInviteCode()` |
| `/(waitlist)/approved` | `(waitlist)/approved.tsx` | Yes | `useWaitlist()` |
| `/(setup)` | `(setup)/index.tsx` | Yes | None |
| `/(setup)/add-bank` | `(setup)/add-bank.tsx` | Yes | `verify-bank`, PAN verification |
| `/(setup)/add-utility` | `(setup)/add-utility.tsx` | Yes | `verify-utility`, `useUtilityOperators()` |
| `/(setup)/invite-landlord` | `(setup)/invite-landlord.tsx` | Yes | `invite-landlord-whatsapp` |
| `/(setup)/pending-steps` | `(setup)/pending-steps.tsx` | Yes | `useDashboard()` |
| `/(main)` | `(main)/index.tsx` | Yes | `useDashboard()`, `usePaymentStamps()` |
| `/(payment)/enter-rent` | `(payment)/enter-rent.tsx` | Yes | `initiate-payment`, PayU SDK |
| `/(payment)/confirm` | `(payment)/confirm.tsx` | Yes | None (redirect) |
| `/(payment)/status` | `(payment)/status.tsx` | Yes | `checkPaymentStatus()`, `generateReceipt()`, Supabase Realtime |
| `/(profile)` | `(profile)/index.tsx` | Yes | `useDashboard()`, `signOut()`, `deleteAccount()` |
| `/(profile)/edit` | `(profile)/edit.tsx` | Yes | `useDashboard()`, `updateProfile()` |
| `/(profile)/agreement` | `(profile)/agreement.tsx` | Yes | `useDashboard()` |
| `/(profile)/edit-bank-details` | `(profile)/edit-bank-details.tsx` | Yes | `verify-bank` (update mode) |
| `/(dev)/screen-picker` | `(dev)/screen-picker.tsx` | Yes | None |

**Total: 24 screens** (excluding test files)
