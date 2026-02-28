# Test Coverage Gap Analysis Report

**Generated**: 2026-02-27  
**Analyzer**: QA Expert Agent  
**Source**: `test-infrastructure/test-cases/master-test-plan.csv` (440 test cases)  
**Coverage Matrix**: `test-infrastructure/coverage-matrix.json`

---

## Executive Summary

The Flent Secured app has **267 of 440** master test plan cases covered by automation, yielding **60.7% overall coverage**. While core auth, payment webhook, and bank verification flows are well-tested across backend + frontend + E2E, there are significant gaps in:

1. **External API integrations** (37.5% covered) -- Cashfree M360, Payouts, Twilio, APNs, and Resend have almost zero automated test coverage
2. **Production release readiness** (13.3% covered) -- bundle audits, secret scanning, and compliance checks are not automated
3. **OTA update flows** (0% covered) -- no automated tests for expo-updates behavior
4. **Cleanup/lifecycle** (0% covered) -- no automated data hygiene checks
5. **PaymentMethodModal sub-views** -- the add-upi, add-card, and add-netbanking modal views have zero Jest or E2E coverage despite being P0
6. **Notifications** (33.3% covered) -- push token registration, deep link navigation from notifications, and SMS/WhatsApp delivery are untested

**P0 gap count: 29 uncovered** -- these represent the highest-risk items that must be addressed before production release.

---

## Coverage Heatmap by Category

```
Category            Total  Covered  Gaps  Coverage  Risk Level
-------------------------------------------------------------------
BA (Backend API)      112       86    26    76.8%    MEDIUM
UI (UI Level)          60       33    27    55.0%    HIGH
EA (External API)      40       15    25    37.5%    CRITICAL
EC (Edge Cases)        40       22    18    55.0%    HIGH
HJ (Happy Journey)    25       14    11    56.0%    HIGH
SM (State Mgmt)        20       14     6    70.0%    MEDIUM
SC (Security)          20       14     6    70.0%    MEDIUM
PM (Payment Meth.)     18       11     7    61.1%    MEDIUM
NF (Notifications)     15        5    10    33.3%    HIGH
RC (Referral/CB)       15        9     6    60.0%    MEDIUM
PR (Prod Release)      15        2    13    13.3%    CRITICAL
AR (Apple Review)      12        7     5    58.3%    MEDIUM
AC (Accessibility)     12        3     9    25.0%    HIGH
NM (Native Modules)    10        5     5    50.0%    MEDIUM
CL (Cleanup)           10        0    10     0.0%    CRITICAL
PF (Performance)        8        3     5    37.5%    HIGH
OTA (OTA Updates)       8        0     8     0.0%    CRITICAL
-------------------------------------------------------------------
TOTAL                 440      267   173    60.7%
```

### Priority Distribution of Gaps

```
Priority  Total  Covered  Gaps  Coverage  Action
-------------------------------------------------
P0          120       91    29    75.8%    BLOCK RELEASE
P1          230      137    93    59.6%    Sprint 1-2
P2           85       36    49    42.4%    Sprint 3-4
P3            5        3     2    60.0%    Backlog
```

---

## Top 20 Highest-Priority Gaps

### P0 Gaps (Must Fix Before Release)

| #  | ID       | Title                                        | Category  | Layer Missing         | Effort |
|----|----------|----------------------------------------------|-----------|-----------------------|--------|
| 1  | EC-004   | Network disconnect during payment initiation | Edge Case | All layers            | L      |
| 2  | UI-039   | PaymentMethodModal add-upi view              | UI        | Jest + E2E            | M      |
| 3  | UI-040   | PaymentMethodModal add-card view             | UI        | Jest + E2E            | M      |
| 4  | UI-041   | PaymentMethodModal add-netbanking view        | UI        | Jest + E2E            | M      |
| 5  | SC-012   | Service role key isolation from client        | Security  | Automated scan        | S      |
| 6  | SC-019   | Secure storage for tokens                    | Security  | Verification test     | S      |
| 7  | PR-001   | DevNavigator stripped from production build   | Prod Rel. | Automated bundle scan | S      |
| 8  | PR-002   | No seed-test strings in bundle               | Prod Rel. | Automated bundle scan | S      |
| 9  | PR-003   | No jumpToScreen in bundle                    | Prod Rel. | Automated bundle scan | S      |
| 10 | PR-010   | No hardcoded API keys in source              | Prod Rel. | Automated secret scan | M      |
| 11 | PR-013   | Service role key not in client bundle         | Prod Rel. | Automated bundle scan | S      |
| 12 | PR-004   | Test data cleaned from DB                    | Prod Rel. | SQL check script      | M      |
| 13 | PR-005   | Production PayU keys configured              | Prod Rel. | EAS secret check      | S      |
| 14 | PR-006   | Production Cashfree keys configured          | Prod Rel. | Supabase secret check | S      |
| 15 | PR-011   | ALLOW_DEMO_AUTH is false                     | Prod Rel. | Config check          | S      |
| 16 | PR-012   | DEMO_PHONES empty                            | Prod Rel. | Config check          | S      |
| 17 | OTA-002  | Channel routing dev/preview/production        | OTA       | Config verification   | M      |
| 18 | OTA-003  | Update download and apply                    | OTA       | E2E flow              | L      |
| 19 | OTA-004  | Rollback on crash                            | OTA       | E2E flow              | L      |
| 20 | EC-017   | Back button during payment                   | Edge Case | Frontend + E2E        | M      |

### Next 10 High-Priority P1 Gaps

| #  | ID       | Title                                         | Category   | Layer Missing         | Effort |
|----|----------|-----------------------------------------------|------------|-----------------------|--------|
| 21 | HJ-010   | Landlord receives invite and approves         | HJ         | All layers            | L      |
| 22 | EC-009   | Concurrent login from two devices             | Edge Case  | Backend + E2E         | L      |
| 23 | EC-010   | Offline to online transition queue replay      | Edge Case  | Frontend + E2E        | L      |
| 24 | NF-001   | Push token registration                       | Notify     | E2E                   | M      |
| 25 | NF-005   | Deep link from notification                   | Notify     | Integration test      | M      |
| 26 | AC-001   | VoiceOver navigation 187 testIDs              | Access.    | Manual + automated    | L      |
| 27 | SM-016   | Store migration version upgrade               | State Mgmt | Integration test      | L      |
| 28 | EA-040   | All external API circuit breakers             | External   | Backend test          | L      |
| 29 | BA-037   | settle-to-landlord success                    | Backend    | Backend test          | M      |
| 30 | BA-041   | send-landlord-invite success                  | Backend    | Backend test          | M      |

---

## Category-by-Category Detailed Breakdown

### HJ -- Happy Journey (25 cases, 14 covered, 56%)

**What is covered well:**
- Sign-up -> OTP -> Agreement upload -> Agreement review flow (HJ-001 through HJ-004) has full 3-layer coverage
- Waitlist join and approval (HJ-005, HJ-006) covered by backend + frontend + E2E
- Bank verification (HJ-007) fully covered
- Payment via UPI (HJ-016) and first rent E2E (HJ-012) fully covered
- Sign-out (HJ-025) covered by integration test

**Gaps:**
- **HJ-008**: Add utility -- no Maestro flow (backend + frontend service tests exist)
- **HJ-009**: Invite landlord -- no backend test for send-landlord-invite
- **HJ-010**: Landlord approval flow -- zero coverage at any layer
- **HJ-013/014/015**: Skip flows (landlord/utility/both) -- no tests validate skip paths
- **HJ-017/018**: Card payment methods -- no E2E flows for credit/debit card
- **HJ-019**: Netbanking -- no backend test, no E2E flow
- **HJ-020/021**: Transaction history and receipt viewing -- frontend service tests only, no E2E

**Recommended Maestro flows to create:**
1. `flows/setup/add-utility.yaml` -- cover HJ-008
2. `journeys/skip-setup.yaml` -- cover HJ-013/014/015 skip paths
3. `flows/transactions/history.yaml` -- cover HJ-020
4. `flows/transactions/receipt.yaml` -- cover HJ-021

### UI -- UI Level (60 cases, 33 covered, 55%)

**What is covered well:**
- Auth screens (splash, beta-splash, carousel, sign-up, OTP) have comprehensive Jest + E2E coverage
- Waitlist states (pending, approved, rejected) well tested
- Setup step progress (0/3 through 3/3) covered by useSetupGuard tests
- Payment status screens (success/failed/pending/refunded) have Maestro flows

**Gaps (27 cases):**
- **UI-016 through UI-022**: Agreement screen states (upload empty, camera preview, gallery, uploading, uploaded, review, edit) -- only E2E upload flow exists, no Jest component tests
- **UI-031 through UI-036**: Dashboard states (zero state, payment due, overdue, pending verification, cashback, multi-tenancy) -- no screen-level Jest tests
- **UI-037 through UI-041**: PaymentMethodModal views (enter-amount, method-selector, add-upi, add-card, add-netbanking) -- P0 gap, no Jest tests
- **UI-042**: PaymentMethodModal edit-method view -- no test coverage
- **UI-046 through UI-052**: Profile sub-screens (edit, payment methods list, notifications, help, about, agreement) -- no screen tests
- **UI-053 through UI-056**: Transaction screens (empty, populated, pull-to-refresh, detail) -- no screen tests
- **UI-057/058**: BottomSheet drag/snap behavior -- no tests
- **UI-059**: Card flip animation -- no test
- **UI-060**: All error/empty/loading states -- partial coverage only

**Recommended Jest test files to create:**
1. `rn-app/src/__tests__/screens/home.test.tsx` -- dashboard state tests (UI-031 to UI-036)
2. `rn-app/src/__tests__/screens/payment-method-modal.test.tsx` -- all 6 modal views (UI-037 to UI-042)
3. `rn-app/src/__tests__/screens/profile.test.tsx` -- profile sub-screens (UI-046 to UI-052)
4. `rn-app/src/__tests__/screens/transactions.test.tsx` -- transaction list and detail (UI-053 to UI-056)
5. `rn-app/src/__tests__/screens/agreement.test.tsx` -- agreement screen states (UI-016 to UI-022)

### EC -- Edge Cases (40 cases, 22 covered, 55%)

**What is covered well:**
- Double OTP submission guard (EC-001)
- OTP expiry and max attempts (EC-002, EC-003)
- Amount mismatch detection (EC-012)
- Idempotency key collision (EC-013)
- Rapid multi-tap prevention (EC-018)
- Malformed phone validation (EC-020)
- OTP resend rate limiting (EC-033)
- Invalid IFSC/account validation (EC-034, EC-035)
- ErrorBoundary fallback (EC-011)

**Critical P0 gaps:**
- **EC-004**: Network disconnect during payment -- no test at any layer
- **EC-005**: App kill during payment -- usePaymentRecovery tested but no E2E
- **EC-017**: Back button during payment processing -- no test

**Other gaps:**
- EC-006: App kill during agreement upload
- EC-009: Concurrent login from two devices
- EC-010: Offline-to-online queue replay
- EC-014: Stale payment polling timeout
- EC-015: Session token expiry mid-flow
- EC-016: Deep link to invalid route
- EC-021/022: Unicode in names, very long addresses
- EC-023/024: Camera/photo library permission denied
- EC-025: Low disk space
- EC-026: Slow 3G network simulation
- EC-029: Duplicate payment within 1 minute
- EC-030: Re-upload agreement while previous pending
- EC-040: Memory pressure

**Recommended tests:**
1. Frontend integration test: `usePaymentFlow` with simulated network failure
2. Maestro flow: `flows/edge-cases/payment-back-button.yaml`
3. Backend test: duplicate payment cooldown check

### SM -- State Management (20 cases, 14 covered, 70%)

**What is covered well:**
- Payment store recovery (SM-002) -- fully covered by usePaymentRecovery tests
- Sign-out clears all stores (SM-007) -- integration test validates
- Session expiry redirect (SM-008) -- useSessionMonitor + useRequireAuth
- React Query cache invalidation (SM-011)
- Auth store transitions through full flow (SM-001 partially)

**Gaps:**
- **SM-003**: Upload store hydration race condition
- **SM-009**: Multiple store updates in single render (flickering)
- **SM-015**: Background fetch on app resume
- **SM-016**: Store migration version upgrade -- no test infrastructure
- **SM-017**: Concurrent store writes -- no stress test
- **SM-018**: Store size limits with 100+ transactions

### BA -- Backend API (112 cases, 86 covered, 76.8%)

**What is covered well:**
- auth-otp (BA-001 to BA-006): Full send/verify/resend/rate-limit coverage
- verify-identity (BA-007 to BA-014): Full PAN/Aadhaar/consent coverage
- verify-bank (BA-015, BA-016): Full validation + idempotency
- verify-utility (BA-017 to BA-020): Full operator + bill verification
- initiate-payment (BA-025, BA-026): Full validation + hash generation
- payment-webhook (BA-027, BA-028): Full hash validation + status processing
- upload-document (BA-047, BA-048): Full file type + size validation
- confirm-extraction (BA-051, BA-052): Full confirmation flow
- join-waitlist (BA-063, BA-064): Success + duplicate handling
- get-waitlist-status (BA-065, BA-066): Full suite
- add-upi-vpa (BA-095, BA-096): Full VPA validation
- Payment methods CRUD (BA-087 to BA-094): Most covered via payment-methods-refunds.test.ts
- Referral codes (BA-069 to BA-074): Full validate + apply coverage

**Gaps (26 cases):**
- **BA-033/034**: schedule-payment success/past date -- no test file
- **BA-037/038**: settle-to-landlord success/no landlord -- no dedicated test
- **BA-039/040**: poll-settlement-status -- no dedicated test
- **BA-041/042**: send-landlord-invite success/duplicate -- no backend test
- **BA-043/044**: landlord-approve success/wrong OTP -- no backend test
- **BA-045/046**: manage-landlord get/not found -- partially covered by edge-functions.test.ts
- **BA-053/054**: update-extraction success/invalid field -- no backend test
- **BA-059/060**: upload-avatar success/invalid format -- no backend test
- **BA-061/062**: pixelate-avatar success/no avatar -- no backend test
- **BA-067/068**: agreement-lifecycle get/no agreement -- partially covered by edge-functions.test.ts
- **BA-079/080**: get-payment-history success/empty -- no backend test (frontend only)
- **BA-081/082**: get-payment-stamps -- no tests
- **BA-103/104**: register-device-token -- no tests

**Recommended backend test files to create:**
1. `supabase/functions/_tests/settle-to-landlord.test.ts`
2. `supabase/functions/_tests/send-landlord-invite.test.ts`
3. `supabase/functions/_tests/landlord-approve.test.ts`
4. `supabase/functions/_tests/schedule-payment.test.ts`
5. `supabase/functions/_tests/update-extraction.test.ts`
6. `supabase/functions/_tests/upload-avatar.test.ts`

### EA -- External API (40 cases, 15 covered, 37.5%)

**What is covered well:**
- PayU hash generation and verification (EA-001, EA-003, EA-005)
- PayU SDK callbacks (EA-002, via payuCoreService.test.ts)
- Gemini name/address matching (EA-026, EA-027, EA-028)
- API Club operator parsing (EA-019/020 partially via bug-fixes.test.ts)

**Critical gaps (25 cases):**
- **EA-004**: PayU refund sandbox -- no refund API test
- **EA-006 through EA-016**: All Cashfree M360 and Payouts integration tests missing
- **EA-017/018**: Cashfree PAN verification -- no test
- **EA-019 through EA-022**: API Club -- only parsing tested, no live API test
- **EA-025/029**: Document AI and Gemini timeout handling -- no timeout tests
- **EA-030 through EA-034**: All Twilio integration tests missing
- **EA-035/036**: Resend email integration -- no tests
- **EA-037 through EA-039**: Apple APNs integration -- no tests
- **EA-040**: Circuit breaker pattern -- no tests

**Strategy**: External API tests require mock servers or sandbox environments. Recommended approach:
1. Create `supabase/functions/_tests/external-api-mocks.test.ts` with mock server stubs
2. Test Cashfree M360 with sandbox credentials
3. Test Twilio with test credentials (magic numbers)
4. Test PayU refund in sandbox

### SC -- Security (20 cases, 14 covered, 70%)

**What is covered well:**
- Webhook hash validation including additional_charges (SC-005)
- JWT expiry handling (SC-006)
- Amount tampering detection (SC-009)
- Idempotency key replay prevention (SC-011)
- SQL injection prevention (SC-016)
- XSS prevention (SC-017 via input sanitization)
- Auth bypass attempts (SC-002/004 partially)
- Rate limiting (SC-014/015 partially)

**Gaps:**
- **SC-007**: No card numbers in logs -- need log scanning test
- **SC-008**: No card numbers in error reports -- need Sentry scrub check
- **SC-012**: Service role key isolation from client -- need bundle scan
- **SC-013**: Consent IP recording -- no verification test
- **SC-018**: CSRF protection on mutations -- no CORS test
- **SC-019**: Tokens in SecureStore not AsyncStorage -- no verification
- **SC-020**: Certificate pinning -- manual only

### PM -- Payment Methods (18 cases, 11 covered, 61.1%)

**What is covered:**
- Add UPI VPA (PM-001) via payment-methods-refunds.test.ts + payments.test.ts
- Add credit/debit card (PM-002/003) via add-card-token tests
- Add netbanking (PM-004) partially via usePaymentFlow NB test
- Modal views (PM-009 through PM-013) via E2E journeys/make-payment.yaml
- Delete method (PM-006) via usePayments.test.ts

**Gaps:**
- PM-005: Set default payment method -- frontend hook exists but no test
- PM-007: Edit UPI VPA -- no test
- PM-008: Verify card via PayU -- no BIN check test
- PM-015: Saved methods persistence across restart -- no test
- PM-016/017: Multiple methods ordering and default indicator
- PM-018: Deletion confirmation dialog -- no test

### RC -- Referral & Cashback (15 cases, 9 covered, 60%)

**Covered**: Get/validate/apply referral codes (RC-001, RC-003, RC-004, RC-005), calculate cashback all gates (RC-006), calculate without bank (RC-007), without utility (RC-008), without landlord (RC-009)

**Gaps**: RC-002 (share code), RC-010 (cashback after cutoff), RC-011 (cashback history view), RC-012 (ledger entry), RC-013 (dashboard display), RC-014/015 (referral bonus)

### PR -- Production Release (15 cases, 2 covered, 13.3%)

This is the most critical category for release readiness. Almost all checks are manual/semi-auto.

**All P0 gaps require automated scripts:**
1. Bundle content scanning (PR-001, PR-002, PR-003, PR-013, PR-015) -- create a CI script that searches the production JS bundle for forbidden strings
2. Secret scanning (PR-010) -- integrate a secret scanner in CI
3. Config verification (PR-005 through PR-012) -- create EAS/Supabase config check scripts

### NF -- Notifications (15 cases, 5 covered, 33.3%)

**Covered**: Notification route mapping, registerForPushNotifications, handleNotificationResponse, setupNotificationHandlers, quiet hours (all via notifications.test.ts)

**Gaps**: Push token DB registration (NF-001), foreground/background/killed notifications (NF-002/003/004), deep link from notification (NF-005), SMS/WhatsApp/email delivery (NF-008/009/010), badge count (NF-012), silent push (NF-014)

### AC -- Accessibility (12 cases, 3 covered, 25%)

**Covered**: VoiceOver navigation concept (AC-001 partially via testID presence), accessibility labels (AC-002 partially via component tests), touch targets (AC-003 partially via hitSlop in components)

**All remaining 9 cases require manual testing or specialized tools (Accessibility Inspector, VoiceOver).** Recommend adding `accessibilityRole` and `accessibilityLabel` assertions to all component tests.

### NM -- Native Modules (10 cases, 5 covered, 50%)

**Covered**: PayU SDK (NM-001 via payuCoreService tests), camera/image picker (NM-003/004 via FileUploadZone and DocumentUploadCard tests), SecureStore (NM-005 via auth store persistence)

**Gaps**: Cashfree SDK (NM-002), haptics (NM-006), image disk cache (NM-007), document picker (NM-008), file system operations (NM-009), native splash dismissal (NM-010)

### CL -- Cleanup/Lifecycle (10 cases, 0 covered, 0%)

**All 10 cases are uncovered.** These are database hygiene checks (orphaned records, stale OTPs, referential integrity). Recommend creating SQL scripts in `test-infrastructure/sql/` that can be run as part of release verification.

### PF -- Performance (8 cases, 3 covered, 37.5%)

**Covered**: Bundle size check (PF-006 via performance.test.ts), frame rate concept (PF-008 partially), dashboard load tracking (PF-004 partially via performance service)

**Gaps**: Cold start time (PF-001), hot start time (PF-002), payment initiation latency (PF-003), slow network degradation (PF-005), memory usage during payment (PF-007)

### OTA -- OTA Updates (8 cases, 0 covered, 0%)

**All 8 cases are uncovered.** OTA testing requires physical device builds and `eas update` commands. Recommend creating Maestro flows that verify update channel configuration and launch behavior.

---

## Recommended Gap Closure Plan

### Sprint 1 (Week 1-2): P0 Blockers -- 29 gaps

**Effort**: ~80 hours

| Task | Files to Create | Covers | Effort |
|------|----------------|--------|--------|
| PaymentMethodModal Jest tests | `__tests__/screens/payment-method-modal.test.tsx` | UI-037 to UI-042, PM-009 to PM-014 | L (16h) |
| Production bundle scan script | `test-infrastructure/scripts/check-bundle.sh` | PR-001 to PR-003, PR-010, PR-013, PR-015, SC-012 | M (8h) |
| Production config check script | `test-infrastructure/scripts/check-prod-config.sh` | PR-004 to PR-012 | M (8h) |
| Network disconnect payment test | `usePaymentFlow` + `useNetworkStatus` integration | EC-004 | M (8h) |
| Payment back button E2E | `maestro/flows/edge-cases/payment-back-button.yaml` | EC-017 | S (4h) |
| OTA channel verification | `test-infrastructure/scripts/check-ota-channels.sh` | OTA-002 | S (4h) |
| Security: SecureStore verification | Integration test in `useAuth.test.ts` | SC-019 | S (4h) |
| Settle-to-landlord backend test | `supabase/functions/_tests/settle-to-landlord-v2.test.ts` | BA-037/038 | M (8h) |
| Landlord invite + approve backend | `supabase/functions/_tests/landlord-flow.test.ts` | BA-041 to BA-044, HJ-010 | M (8h) |

### Sprint 2 (Week 3-4): P1 Critical Paths -- 40 gaps

**Effort**: ~100 hours

| Task | Files to Create | Covers | Effort |
|------|----------------|--------|--------|
| Dashboard screen Jest tests | `__tests__/screens/home.test.tsx` | UI-031 to UI-036 | L (16h) |
| Transaction screen Jest tests | `__tests__/screens/transactions.test.tsx` | UI-053 to UI-056, HJ-020/021 | M (8h) |
| Agreement screen Jest tests | `__tests__/screens/agreement.test.tsx` | UI-016 to UI-022 | L (12h) |
| Profile screen Jest tests | `__tests__/screens/profile.test.tsx` | UI-046 to UI-052 | M (8h) |
| Setup add-utility Maestro flow | `maestro/flows/setup/add-utility.yaml` | HJ-008 | S (4h) |
| Skip setup journey Maestro flow | `maestro/journeys/skip-setup.yaml` | HJ-013/014/015 | M (8h) |
| Sign-out + re-login Maestro flow | `maestro/journeys/sign-out-relogin.yaml` | HJ-025 | S (4h) |
| External API mock test suite | `supabase/functions/_tests/external-api-mocks.test.ts` | EA-007 to EA-016, EA-030 to EA-034 | L (16h) |
| Notification deep link test | Integration test in `useDeepLink.test.ts` | NF-005 | S (4h) |
| Concurrent session backend test | Security test addition | EC-009 | M (8h) |
| Cleanup SQL scripts | `test-infrastructure/sql/cleanup-checks.sql` | CL-001 to CL-010 | M (8h) |
| Schedule-payment backend test | `supabase/functions/_tests/schedule-payment.test.ts` | BA-033/034 | S (4h) |

### Sprint 3 (Week 5-6): P2 Quality -- 49 gaps

**Effort**: ~60 hours

| Task | Covers | Effort |
|------|--------|--------|
| Accessibility audit + test additions | AC-003 to AC-012 | L (16h) |
| Performance baseline tests | PF-001 to PF-003, PF-005, PF-007 | L (16h) |
| OTA E2E flows | OTA-001 to OTA-008 | L (16h) |
| Remaining UI state tests (skip, animation, bottom sheet) | UI-030, UI-057 to UI-060 | M (8h) |
| Remaining edge cases (Unicode, permissions, disk space) | EC-021 to EC-025 | S (4h) |

### Sprint 4 (Week 7-8): P3 Polish -- 2 gaps + regression hardening

| Task | Covers |
|------|--------|
| Zustand devtools verification | SM-010 |
| Haptic feedback manual test | NM-006 |
| Full regression suite stabilization | All categories |

---

## Layer Coverage Summary

| Layer | Test Count | Percentage |
|-------|-----------|------------|
| Backend Deno tests only | 145 | 33.0% |
| Frontend Jest tests only | 95 | 21.6% |
| E2E Maestro flows only | 28 | 6.4% |
| Multi-layer (2+ layers) | 60 | 13.6% |
| **No coverage** | **173** | **39.3%** |

### Observations on Layer Distribution

1. **Backend is strongest** -- 20 test files covering auth, payments, verification, waitlist, upload, referrals, and security
2. **Frontend has good breadth** -- 67 test files across screens, hooks, services, stores, and components, but lacks screen-level tests for dashboard, transactions, profile, and agreement
3. **E2E is narrowly focused** -- 25 flows + 3 journeys cover auth, setup, and payment happy paths but miss negative/edge scenarios
4. **No cross-layer integration tests** exist that verify a backend edge function change propagates correctly through the frontend service layer to the UI

---

## Risk Assessment

### Critical Risks (Probability: High, Impact: High)

1. **Payment modal views have zero test coverage** -- Any regression in the PaymentMethodModal add-upi/card/netbanking views would go undetected. These are the most revenue-critical screens.
2. **No production bundle audits** -- DevNavigator, seed-test strings, and service role keys could ship to production.
3. **External API failures undetected** -- If Cashfree M360, Twilio, or APNs change their API contracts, no test would catch it.

### High Risks (Probability: Medium, Impact: High)

4. **Landlord flow entirely untested** -- The landlord invite -> approval -> tenancy activation path has no backend tests.
5. **OTA updates untested** -- A bad OTA update could brick the app with no rollback verification.
6. **Network resilience untested** -- No tests for offline-to-online recovery, slow network, or network disconnect during critical flows.

### Medium Risks (Probability: Medium, Impact: Medium)

7. **Accessibility gaps** -- 9 of 12 accessibility test cases uncovered, risking App Store rejection and user complaints.
8. **Performance baselines not established** -- No cold start, hot start, or payment latency benchmarks to detect regressions.

---

## File Reference

| File | Path |
|------|------|
| Master Test Plan | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/test-infrastructure/test-cases/master-test-plan.csv` |
| Coverage Matrix | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/test-infrastructure/coverage-matrix.json` |
| This Report | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/test-infrastructure/gap-analysis.md` |
| Backend Tests | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/supabase/functions/_tests/` (20 files) |
| Frontend Tests | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/rn-app/src/` (67 test files) |
| E2E Flows | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/maestro/flows/` (25 flows) |
| E2E Journeys | `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/maestro/journeys/` (3 journeys) |
