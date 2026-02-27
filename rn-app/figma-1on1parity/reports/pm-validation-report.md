# PM Validation Report: Figma Parity Audit -- Screen Mapping & Gap Analysis

**Date:** 2026-02-27
**Product:** Flent Secured (Rent Payment Platform for Indian Tenants)
**Scope:** 104 Figma screens mapped to 26 app routes across 14 feature areas
**Figma File:** `HZaVuwWn6B6jOjrmxZ7Kzv` (node `756:188615`)

---

## Executive Summary

The screen mapping covers 104 Figma screen states across 14 feature areas. Overall, the mapping is **structurally sound** with correct tier assignments and comprehensive state coverage for the primary user journeys. However, there are **10 identified gaps** (7 Figma-without-route, 3 route-without-Figma), plus **critical missing states** that could impact user trust and conversion.

**Key Findings:**
- Payment journey (Tier 1) is well-mapped but has a major architectural mismatch: 12 Figma screens reference `(payment)/first-rent` which has been **deleted from the codebase** (commit `cb6125c4`). These screens need route remapping.
- Agreement expired/manual-review states are implemented in code but flagged as gaps -- the mapping is actually **more complete than the gap list suggests**.
- Home invitation sub-states (4 screens) represent a real feature gap with hardcoded routing.
- Three routes exist without Figma designs, two of which are functional and should either get designs or be documented as intentional deviations.

---

## 1. User Journey Validation

### 1.1 New User Journey

**Expected Flow:** Splash --> Carousel --> Sign-up --> OTP --> Agreement Upload --> Agreement Review --> Waitlist --> Setup --> Home

| Step | Figma Screens | Route | States Covered | Status |
|------|--------------|-------|----------------|--------|
| Splash | `1:28055`, `1:28071` | `(auth)/splash`, `(auth)/beta-splash` | initial, animation | COMPLETE |
| Carousel | `1:28985`, `1:29025`, `1:29065` | `(auth)/carousel` | page-1, page-2, page-3 | COMPLETE |
| Sign-up | `1:29108`, `1:31073`, `1:31590`, `1:31671` | `(auth)/sign-up` | empty, filled, error-1, error-2 | COMPLETE |
| OTP | `1:31175`, `1:31277`, `1:31380`, `1:31485` | `(auth)/otp` | empty, filled, error-1, error-2 | COMPLETE |
| Agreement Upload | `1:29914`, `1:30001`, `1:30090`, `1:30178`, `1:30268`, `1:30358` | `(agreement)/upload` | idle, uploading, uploaded, expired, file-too-large, manual-review | COMPLETE |
| Agreement Review | `1:30448`, `1:30820` | `(agreement)/review` | verify, modify | PARTIAL (see below) |
| Waitlist | `41:11206`, `41:11825`, `41:11506`, `41:11613`, `41:11720`, `41:11313`, `41:11410` | `(waitlist)/index`, `(waitlist)/approved` | pending, pending-long, referral-entry, referral-invalid, referral-success, accepted, rejected | COMPLETE |
| Setup | `41:10712`, `41:10859`, `41:11006`, `1:33737`, `597:2833`, `1:34343`, `597:2922`, `1:34150`, `1:34236` | `(setup)/*` | step-1 through step-3, add-bank (default/error), add-utility (default/error), invite-landlord, summary | COMPLETE |
| Home | 30+ screens | `(main)/index` | See Section 1.4 | COMPLETE |

**Missing States in New User Journey:**
- **Agreement Success screen**: The MEMORY.md references an `(agreement)/success` route, but **no such file exists** in the app directory and **no Figma screen maps to it**. After agreement review confirmation, the user transitions to waitlist. This is either by design (inline confirmation then redirect) or a gap.
- **Agreement Review "modify" state** (`1:30820`): The review screen code has **no modify/inline-edit capability**. The `review.tsx` file contains zero references to "modify", "edit", or "inline". The Figma design shows an editable state, but the implementation only supports read-only verify. This is a real functional gap.

### 1.2 Payment Journey

**Expected Flow:** Home --> Payment Selection --> Payment Confirm --> Payment Status (success/failed/processing/refunded)

| Step | Figma Screens | Route | States Covered | Status |
|------|--------------|-------|----------------|--------|
| Payment Confirm | `41:8695`, `41:9681`, `41:9746`, `243:7398`, `243:6731`, `246:8416` | `(payment)/confirm` | with-cashback, without-cashback, late-payment, first-visit, before-payment, setup-steps | COMPLETE |
| Payment Status | `41:9388`, `41:9563`, `41:9460`, `41:9511`, `41:9635` | `(payment)/status` | success, success-no-cashback, processing, failed, refunded | COMPLETE |

**CRITICAL ISSUE -- Payment Selection Route Mismatch:**

The screen mapping assigns 12 Figma screens to `(payment)/first-rent`:
- `41:8901` (without-setup), `41:9004` (before-7th), `41:9114` (after-7th)
- `41:8369` (add-upi), `41:8529` (add-credit), `41:9224` (add-netbanking)
- 6 component states (credit/upi/netbanking cards, base, active, add-more)

**The `(payment)/first-rent` route has been deleted** (commit `cb6125c4`: "chore: delete first-rent payment screen, route directly to confirm"). No file exists at `app/(payment)/first-rent.tsx`.

This means the payment method selection UI has been consolidated into either:
1. **`(payment)/confirm`** screen (which handles method selection inline), or
2. **`PaymentMethodSelectionSheet`** component (used in home screen via bottom sheet)

The 12 Figma screens mapped to `first-rent` need to be **remapped** to reflect the current architecture. The "add UPI/credit/netbanking" flows now live inside `(profile)/edit-payment-method` and the method selection bottom sheet components.

**Missing Payment States:**
- **Payment timeout state**: The `status.tsx` implements a `timed_out` status (`PendingSubState`), but there is no dedicated Figma screen for "payment verification timed out". This is shown as a variant of the processing state, which may be acceptable.
- **No "initiating payment" loading state**: Between tapping "Pay Now" on confirm and landing on the payment gateway, there is no designed intermediate state. The code uses inline loading on the button, which works but has no Figma spec.

### 1.3 Returning User Journey

**Expected Flow:** Splash --> OTP --> Home (various states)

The journey-aware router in `app/index.tsx` handles this flow:
1. Not authenticated --> `(auth)/beta-splash`
2. Authenticated + `signed_up` --> `(agreement)/upload`
3. Authenticated + `waitlisted`/`agreement_confirmed`/`not_eligible` --> `(waitlist)`
4. Authenticated + `approved` --> `(setup)`
5. Authenticated + `active` --> `(main)`

| Journey Segment | States Covered | Status |
|----------------|----------------|--------|
| Auth check | SkeletonLoader shown during resolution | COMPLETE |
| Error fallback | Falls back to `(agreement)/upload` on API failure | ACCEPTABLE |
| Deep link handling | `flentsecured://` scheme auto-handled | COMPLETE |

**Missing States:**
- **Session expired state**: When a returning user's token has expired, the code redirects to beta-splash. There is no dedicated "session expired" screen that explains what happened and prompts re-login. This creates user confusion.
- **Force update state**: No screen exists for when the app version is outdated and requires a mandatory update.

### 1.4 Home Screen States

The home screen has the most complex state coverage with 30 Figma states across 3 categories:

**Active States (16 screens, Tier 3):**

| State | Figma Node | DashboardState Mapping | Implemented |
|-------|-----------|----------------------|-------------|
| active-complete | `243:2967` | `all_verified` | YES |
| active-complete-v2 | `243:7185` | `all_verified` (cashbacks tab) | YES |
| active-late | `243:3170` | `payment_overdue` | YES |
| active-missed | `243:3378` | `payment_overdue` (extended) | YES |
| active-multi-missed | `243:3586` | `payment_overdue` (extended) | YES |
| active-bank-upi | `243:2762` | `payment_due` | YES |
| active-bank-upi-v2 | `243:6971` | `payment_due` (variant) | YES |
| active-credit-card | `243:3797` | `payment_due` | YES |
| active-netbanking | `243:4006` | `payment_due` | YES |
| active-autopay | `243:7613` | `payment_due` (autopay) | YES |
| active-autopay-pending | `243:7823` | `payment_processing` | YES |
| active-split-payment | `243:8033` | `payment_due` | YES |
| active-partial-payment | `243:8243` | `payment_due` | YES |
| active-advance-payment | `243:8453` | `payment_due` | YES |
| active-payment-scheduled | `243:8663` | `payment_due` (scheduled) | YES |
| active-payment-overdue | `243:8873` | `payment_overdue` | YES |
| active-payment-failed | `243:9083` | `payment_due` (retry) | YES |

**OBSERVATION:** The `DashboardState` type in `dashboard.ts` only defines 9 states: `loading`, `no_tenancy`, `pending_verification`, `all_verified`, `payment_due`, `payment_overdue`, `payment_processing`, `payment_success`, `error`. The 16+ Figma home active states need to be rendered by combining `DashboardState` with payment method type and payment history. The code appears to handle this through conditional rendering within the main `HomeScreen` component, which is correct architecturally.

**Empty States (12 screens, Tier 4):**
All mapped to `(main)/index` with various `empty-*` state identifiers. These represent progressive onboarding states within the dashboard. Coverage is comprehensive.

**Invitation States (5 screens, Tier 4):**

| State | Figma Node | Implemented |
|-------|-----------|-------------|
| invitation-sent | `243:4258` | YES (hardcoded default) |
| invitation-resent-recent | `243:4462` | NO -- hardcoded to `invitation_sent` |
| invitation-resent-old | `243:4666` | NO -- hardcoded to `invitation_sent` |
| invitation-failed | `243:4870` | NO -- hardcoded to `invitation_sent` |
| invitation-declined | `243:5074` | NO -- hardcoded to `invitation_sent` |

The code at `app/(main)/index.tsx:398-402` explicitly documents this gap with a comment: *"For now we map to invitation_sent as default... Can be extended to: 'invitation_resent_recent', 'invitation_resent_old', 'invitation_failed', 'invitation_declined'"*

### 1.5 Profile Journey

**Expected Flow:** Home --> Profile --> Edit / Payment Methods / Agreement

| Screen | Figma Node | Route | Status |
|--------|-----------|-------|--------|
| Profile Main | `41:8760` | `(profile)/index` | COMPLETE |
| Profile Edit | `41:8880` | `(profile)/edit` | COMPLETE |
| Payment Methods (UPI) | `41:8450` | `(profile)/payment-methods` | COMPLETE |
| Payment Methods (Card) | `41:8612` | `(profile)/payment-methods` | COMPLETE |
| Payment Methods (Bank) | `41:9307` | `(profile)/payment-methods` | COMPLETE |
| Agreement View | `41:9811` | `(profile)/agreement` | COMPLETE |

**Missing Profile Screens:**
- **Notifications screen**: MEMORY.md lists `(profile)/notifications` as a route, but no file exists and no Figma screen covers it. This is a planned feature without design or implementation.
- **Help screen**: Referenced in MEMORY.md but the profile index simply opens a `mailto:` link to `secured@flent.in`. No dedicated help screen exists in Figma or code.
- **About screen**: Referenced in MEMORY.md but does not exist in either Figma or the codebase.

### 1.6 Error/Edge Case Coverage

| Scenario | Figma Coverage | Code Coverage | Status |
|----------|---------------|---------------|--------|
| Agreement expired | `1:30178` | `error_expired` in upload.tsx | COVERED (see note) |
| Agreement manual review | `1:30358` | `manual_review` in upload.tsx | COVERED (see note) |
| File too large | `1:30268` | `error_size` in upload.tsx | COMPLETE |
| Referral codes | `41:11506`, `41:11613`, `41:11720` | entry, invalid, success | COMPLETE |
| Waitlist rejected | `41:11410` | `rejected` state | COMPLETE |
| Add bank error | `597:2833` | error state | COMPLETE |
| Add utility error | `597:2922` | error state | COMPLETE |

**NOTE on Agreement Gaps:** The gap analysis flags `Agreement --expired` (`1:30178`), `Agreement --manual review` (`1:30358`), and `Agreement --modify` (`1:30820`) as "Figma without route." However, the first two are **actually implemented** -- the upload.tsx has `error_expired` and `manual_review` upload states that render distinct UI for these cases. The gap list should be updated to reflect that these states ARE handled within the existing `(agreement)/upload` route. Only the "modify" state is a genuine functional gap.

---

## 2. RICE Priority (Tier) Validation

### Tier 1 -- Trust-Critical (Payment Screens): 18 screens

**Assessment: CORRECT but needs route cleanup**

All payment confirm states (6), payment status states (5), and payment selection states (7 including add-method screens) are correctly assigned Tier 1. These screens directly handle money and any visual discrepancy could erode user trust or cause payment errors.

**Issues:**
- The 12 screens mapped to `(payment)/first-rent` need route correction since the route was deleted. The underlying UI still exists but lives in different components now.
- Payment method component screens (8 screens, currently Tier 4) represent the payment card selection UI that users see during the payment flow. Consider promoting the 3 "add method" screens (`add-upi`, `add-credit`, `add-netbanking`) to Tier 1 since they are part of the critical payment path.

**Recommendation:**
- Keep Tier 1 for all payment confirm + status screens.
- Promote `add-upi` (41:8369), `add-credit` (41:8529), `add-netbanking` (41:9224) from Tier 1 mapping under first-rent to Tier 1 under `(profile)/edit-payment-method` since that is where these flows now live.
- Keep payment card components (base, active, selected variants) at Tier 4 as they are sub-components.

### Tier 2 -- Conversion-Critical (Auth + Agreement): 21 screens

**Assessment: CORRECT**

Auth screens (splash through OTP) and agreement screens are correctly Tier 2. These are the first screens users encounter and directly impact conversion rate.

**Should any be promoted to Tier 1?**
- **No.** While auth/agreement are conversion-critical, they do not involve money movement. A visual discrepancy in OTP causes confusion but does not risk financial loss. Tier 2 is appropriate.
- **Exception consideration:** The agreement review/verify screen (`1:30448`) could be argued as Tier 1 since agreement errors directly impact whether a user can start paying rent. However, since the screen is read-only (verify only), the risk of financial impact is low. Keep at Tier 2.

### Tier 3 -- Retention (Home + Setup + Profile): 25 screens

**Assessment: MOSTLY CORRECT with one exception**

Home active states, setup screens, and profile screens are correctly Tier 3. These serve existing users.

**Exception:** Home `active-payment-failed` (`243:9083`) should be considered for Tier 1 promotion. When a user's payment fails and they return to the home screen, the visual state of that failed payment card is trust-critical. A user needs to clearly understand that their payment failed and needs retry action.

### Tier 4 -- Polish (Empty States, Invitation, Components): 23 screens

**Assessment: CORRECT**

Empty states, invitation variants, and payment card components are correctly the lowest priority. These are either progressive disclosure states or component-level designs.

---

## 3. Gap Analysis Deep Dive

### 3.1 Figma Screens Without Routes (7 identified, 4 actual gaps)

#### Gap 1: Agreement --expired (`1:30178`) -- FALSE GAP

**Severity:** Not a gap
**Evidence:** `upload.tsx:235` defines `UploadState = 'idle' | 'uploading' | 'success' | 'error_expired' | 'error_size' | 'manual_review'`. The `error_expired` state renders the expired UI within the existing `(agreement)/upload` route. Line 287 defines `STATE_CONFIG[error_expired]` with the correct error message.
**Action:** Remove from gap list. Update screen-mapping.json to mark this as covered by `(agreement)/upload` state `expired`.

#### Gap 2: Agreement --manual review (`1:30358`) -- FALSE GAP

**Severity:** Not a gap
**Evidence:** `upload.tsx:315` defines `STATE_CONFIG[manual_review]` with appropriate UI. The manual review state is triggered when OCR cannot fully parse the agreement and human review is needed.
**Action:** Remove from gap list. Already handled by `(agreement)/upload` state `manual-review`.

#### Gap 3: Agreement --modify (`1:30820`) -- REAL GAP (P1)

**Severity:** P1 -- Conversion impact
**Current behavior:** Agreement review screen (`review.tsx`) is completely read-only. There are zero references to "modify", "edit", or inline field editing in the code. Users who see OCR extraction errors cannot correct them without re-uploading the entire document.
**Business impact:** Users with slightly incorrect OCR results (wrong date, misspelled name) must re-upload their agreement. This creates friction in the conversion funnel and increases support tickets.
**Recommendation:** Implement inline field editing on the review screen matching Figma node `1:30820`. Fields like tenant name, landlord name, rent amount, and dates should be editable with validation.
**Workaround:** Re-upload is currently the only path. Acceptable for MVP but should be addressed before scale.

#### Gap 4-7: Home Invitation Sub-States (4 screens) -- REAL GAPS (P2)

**Screens:**
- `243:4462` Home --Resent <24hrs
- `243:4666` Home --Resent >24hrs
- `243:4870` Home --Invitation Failed
- `243:5074` Home --Declined

**Severity:** P2 -- Retention impact
**Current behavior:** All invitation states are hardcoded to `invitation_sent` (confirmed in `index.tsx:398-402`). Users cannot distinguish between a recently sent invitation, a failed one, or a declined one.
**Business impact:** When a landlord declines or fails to respond, the tenant has no feedback and no ability to take corrective action. They may believe their invitation is still pending when it has actually failed. This could cause churn.
**Backend dependency:** The backend (Supabase) needs to track and expose invitation status granularity: `sent`, `resent_recent`, `resent_old`, `failed`, `declined`.
**Recommendation:** Implement as part of the landlord invitation flow improvement. Backend must surface invitation lifecycle states. Frontend should render the appropriate Figma variant based on the invitation status and timestamp.

### 3.2 Routes Without Figma (3 identified)

#### Gap 8: `(payment)/cashback-history` -- NEEDS DESIGN (P2)

**Current state:** Fully implemented screen (`cashback-history.tsx`) showing lifetime savings and per-payment discount history. Uses `FlatList` with proper loading/empty states. Well-structured with design tokens.
**Business rationale:** Cashback/savings visibility drives repeat usage and is a differentiator for Flent. This screen was built to support the savings narrative but has no Figma design spec.
**Recommendation:** Request Figma design. This screen should be audited for visual parity once designed. It is a retention driver and should be at Tier 3.

#### Gap 9: `app/error.tsx` -- INTENTIONAL, NO DESIGN NEEDED (P3)

**Current state:** Functional error boundary screen using monospace font. Shows error details and a "Try Again" button.
**Business rationale:** This is a system-level error screen that should ideally never be seen. It uses the app's theme colors but intentionally has a technical aesthetic to signal something went wrong.
**Recommendation:** Low priority. Consider designing a user-friendly error screen if crash analytics show users hitting this screen frequently. For now, acceptable as-is.

#### Gap 10: `(profile)/edit-payment-method` -- NEEDS DESIGN CONSOLIDATION (P1)

**Current state:** Fully implemented screen with UPI, credit card, and netbanking editing flows. References Figma nodes `684:5467`, `684:5627`, `684:6320` in its code comments, but these nodes are not in the screen-mapping.json.
**Business rationale:** This screen is on the critical path for users who need to change their payment method. It is PCI-compliant and feature-complete.
**Recommendation:** Add the referenced Figma nodes (`684:5467`, `684:5627`, `684:6320`) to screen-mapping.json. These exist in Figma but were missed during the mapping exercise. Assign Tier 1 since this is payment-related.

---

## 4. Missing Screen States (Not in Figma or Implementation)

### 4.1 Critical Missing States (P0/P1)

| Missing State | Category | Impact | Recommendation |
|--------------|----------|--------|----------------|
| **Payment gateway loading** | Payment | Users see a blank moment between "Pay Now" tap and gateway load | Design an interstitial with branding + "Redirecting to payment gateway..." |
| **Agreement success/confirmation** | Agreement | After review confirmation, no explicit success state before waitlist redirect | Consider a brief success screen or animated transition |
| **Session expired** | Auth | Returning users with expired tokens get silently redirected to login | Design an explanatory screen: "Your session has expired. Please sign in again." |
| **Network error (global)** | System | Network failures during critical flows have no designed recovery UI | Design a reusable network error overlay/banner (the `OfflineBanner` component exists in payment status but needs Figma spec) |

### 4.2 Loading/Skeleton States

| Screen | Loading State | Status |
|--------|--------------|--------|
| Home | `ActivityIndicator` + "Loading your dashboard..." text | Implemented, no Figma spec |
| Waitlist | `SkeletonLoader` component | Implemented, no Figma spec |
| Payment Confirm | Inline button loading | Implemented, no Figma spec |
| Payment Status | Processing state serves as loading | Covered by Figma |
| Profile | No explicit loading state found | MISSING |
| Agreement Upload | Button loading state | Implemented, no Figma spec |
| Journey Router (index.tsx) | `SkeletonLoader` | Implemented, no Figma spec |

**Recommendation:** Design a standardized skeleton loading pattern for all screens. The `SkeletonLoader` component exists but has no Figma spec.

### 4.3 Confirmation Dialogs

| Dialog | Current Implementation | Figma Design |
|--------|----------------------|--------------|
| Delete payment method | `Alert.alert()` (system dialog) | NONE |
| Logout confirmation | Not found | NONE |
| Agreement re-upload confirmation | `Alert.alert()` | NONE |
| Cancel payment in progress | Not found | NONE |

**Recommendation:** For v1, system `Alert.alert()` dialogs are acceptable. For design polish, consider custom bottom sheet confirmations matching the app's dark theme. Tier 4 priority.

### 4.4 Toast/Notification Feedback

| Action | Feedback | Status |
|--------|----------|--------|
| Payment method added | Not visible | MISSING |
| Profile updated | Not visible | MISSING |
| Referral code applied | Inline state change | COVERED |
| Agreement uploaded | State transitions to uploading/success | COVERED |
| Network restored | `OfflineBanner` component | PARTIAL |

**Recommendation:** Implement a toast notification system for success/error feedback on non-critical actions. Not in Figma, should be designed.

### 4.5 Deep Link Landing States

| Deep Link Target | State | Status |
|-----------------|-------|--------|
| Payment receipt | `(payment)/status` with `source=receipt_view` | IMPLEMENTED |
| Specific transaction | No `(transactions)/[id]` route exists | MISSING (route referenced in MEMORY.md but not implemented) |
| Notification action | No notification screen exists | MISSING |

---

## 5. Fix Priority Recommendations

### P0 -- Blocks Critical Flows or Risks Money

| # | Issue | Screens Affected | Action Required | Effort |
|---|-------|-----------------|-----------------|--------|
| 1 | **Remap `(payment)/first-rent` screens** | 12 Figma screens (`41:8901`, `41:9004`, `41:9114`, `41:8369`, `41:8529`, `41:9224`, + 6 components) | Update screen-mapping.json to point to correct routes: payment selection states to `(payment)/confirm` or `PaymentMethodSelectionSheet`; add-method states to `(profile)/edit-payment-method` | S -- mapping only |
| 2 | **Add missing Figma nodes for edit-payment-method** | `684:5467`, `684:5627`, `684:6320` | Add to screen-mapping.json with Tier 1 | S -- mapping only |
| 3 | **Remove false gaps from gap list** | `1:30178` (expired), `1:30358` (manual review) | Update gaps section in screen-mapping.json | S -- mapping only |

### P1 -- Hurts Conversion or Creates Confusion

| # | Issue | Screens Affected | Action Required | Effort |
|---|-------|-----------------|-----------------|--------|
| 4 | **Agreement --modify** (`1:30820`) | `(agreement)/review` | Implement inline field editing on review screen; fields: tenant name, landlord name, rent amount, dates, property address | L |
| 5 | **Payment gateway interstitial** | `(payment)/confirm` | Design and implement a branded loading state between "Pay Now" tap and gateway redirect | M |
| 6 | **Session expired screen** | `app/index.tsx` | Design and implement a screen explaining session expiry with re-login CTA | S |
| 7 | **Cashback history Figma design** | `(payment)/cashback-history` | Request design from Figma team; audit for parity once designed | M (design dependency) |

### P2 -- Affects Polish but Does Not Block Functionality

| # | Issue | Screens Affected | Action Required | Effort |
|---|-------|-----------------|-----------------|--------|
| 8 | **Home invitation sub-states** (4 screens) | `(main)/index` | Backend: expose invitation lifecycle states. Frontend: render `resent_recent`, `resent_old`, `failed`, `declined` variants | L |
| 9 | **Skeleton/loading state designs** | All screens | Design standardized skeleton patterns in Figma; current implementations work but lack design spec | M (design dependency) |
| 10 | **Home active-payment-failed tier promotion** | `243:9083` | Consider promoting from Tier 3 to Tier 1 given trust implications of failed payment display | S -- tier change only |
| 11 | **Transactions route** | `(transactions)/index`, `(transactions)/[id]` | MEMORY.md references these routes but they do not exist in the app. Either implement or remove from documentation | M |

### P3 -- Nice-to-Have Improvements

| # | Issue | Screens Affected | Action Required | Effort |
|---|-------|-----------------|-----------------|--------|
| 12 | **Error boundary screen design** | `app/error.tsx` | Design a user-friendly error screen if analytics show frequent hits | S |
| 13 | **Confirmation dialog designs** | Multiple | Replace system `Alert.alert()` with themed bottom sheets for delete/logout/cancel flows | M |
| 14 | **Toast notification system** | Multiple | Design and implement toast feedback for non-critical actions (payment method added, profile saved) | M |
| 15 | **Force update screen** | New route | Design screen for mandatory app updates | S |
| 16 | **Profile sub-screens** (notifications, help, about) | `(profile)/*` | Either design these screens or formally descope them from the product | S-M |

---

## 6. Screen Mapping Corrections Required

The following corrections should be applied to `screen-mapping.json`:

### 6.1 Route Remapping for Deleted `(payment)/first-rent`

```json
// BEFORE (incorrect -- route deleted)
{ "figmaNodeId": "41:8901", "route": "(payment)/first-rent", "state": "without-setup" }

// AFTER (correct -- consolidated into confirm)
{ "figmaNodeId": "41:8901", "route": "(payment)/confirm", "state": "method-selection-no-setup" }
```

All 12 `first-rent` entries need remapping:
- `41:8901`, `41:9004`, `41:9114` --> `(payment)/confirm` (payment selection states are now inline in confirm flow)
- `41:8369`, `41:8529`, `41:9224` --> `(profile)/edit-payment-method` (add-method flows)
- 6 component states --> keep as `(payment)/confirm` component substates or `(main)/index` (PaymentMethodSelectionSheet)

### 6.2 New Entries to Add

```json
{ "figmaNodeId": "684:5467", "screenName": "Edit UPI Method", "route": "(profile)/edit-payment-method", "state": "edit-upi", "category": "payment-edit", "tier": 1 },
{ "figmaNodeId": "684:5627", "screenName": "Edit Credit Card", "route": "(profile)/edit-payment-method", "state": "edit-card", "category": "payment-edit", "tier": 1 },
{ "figmaNodeId": "684:6320", "screenName": "Edit Net Banking", "route": "(profile)/edit-payment-method", "state": "edit-netbanking", "category": "payment-edit", "tier": 1 }
```

### 6.3 Gap List Corrections

Remove from `figmaWithoutRoute`:
- `1:30178` (Agreement --expired) -- handled by upload.tsx `error_expired` state
- `1:30358` (Agreement --manual review) -- handled by upload.tsx `manual_review` state

These are state variants rendered within existing routes, not missing routes.

### 6.4 Updated Gap Summary

After corrections:
- **Figma without route: 5** (Agreement modify + 4 invitation sub-states)
- **Route without Figma: 3** (cashback-history, error.tsx, edit-payment-method -- though edit-payment-method has Figma nodes that were unmapped)
- **Deleted route with Figma mappings: 12** (first-rent screens needing remapping)
- **True net gaps: 5** functional gaps + 3 design gaps = 8 total

---

## 7. Metric Tracking Recommendations

To measure the impact of parity fixes, track:

| Metric | Baseline Source | Target |
|--------|----------------|--------|
| Payment completion rate | Payment confirm --> status success conversion | Baseline current, target +5% after P0/P1 fixes |
| Agreement review drop-off | Users who view review but do not confirm | Expect reduction after modify feature (P1 #4) |
| Invitation resolution rate | Invitations sent vs. landlord response | Expect improvement after sub-state visibility (P2 #8) |
| Support tickets for "expired" | Support category analysis | Expect reduction since state already implemented |
| Cashback engagement | Users visiting cashback history vs. total active | Track adoption after Figma design + parity fix |
| Error boundary hits | Crash/error analytics | Track to determine P3 #12 priority |

---

## 8. Summary Statistics

| Metric | Count |
|--------|-------|
| Total Figma screens in mapping | 104 |
| Total app routes (non-test, non-layout) | 26 |
| Screens correctly mapped | 89 |
| Screens needing route remap (first-rent deletion) | 12 |
| Screens needing addition (edit-payment-method) | 3 |
| True functional gaps (Figma exists, code missing) | 5 |
| Design gaps (code exists, Figma missing) | 3 |
| False gaps (incorrectly flagged) | 2 |
| Missing states (neither Figma nor code) | 10+ |
| Tier 1 screens | 18 |
| Tier 2 screens | 21 |
| Tier 3 screens | 25 |
| Tier 4 screens | 23 |

---

*Report generated by PM Agent for Flent Secured Figma Parity Audit, 2026-02-27*
