# Testing Context -- Flent Secured v2 React Native

Authoritative reference for testing infrastructure, patterns, and gaps.

---

## 1. Jest Configuration

**File**: `rn-app/jest.config.js`

- **Preset**: `jest-expo` (Expo-optimized test environment)
- **Setup file**: `src/__tests__/setup.ts`
- **Test match**: `**/__tests__/**/*.test.{ts,tsx}` or `**/*.test.{ts,tsx}`
- **Coverage collection**: `src/**/*.{ts,tsx}` (excludes `.d.ts` and `__tests__/`)
- **Path mapping**: All 10 `@/` aliases from tsconfig.json
- **Transform ignore**: react-native, expo, @react-navigation, reanimated, moti, @gorhom, nativewind, react-native-svg

### Coverage Thresholds (Global)
```
branches: 50% | functions: 50% | lines: 50% | statements: 50%
```

---

## 2. Jest Setup (`src/__tests__/setup.ts`)

### Mocks
- `react-native-reanimated` -- full mock, disables `.call()` on default
- `expo-haptics` -- mocks `impactAsync()`, provides `ImpactFeedbackStyle` enum
- `expo-linear-gradient` -- mocks `LinearGradient` as string component

### Utilities
- `@testing-library/react-native/extend-expect` for matchers
- Silences animation-related console.warn
- `jest.useFakeTimers()` setup with cleanup in `afterEach`

---

## 3. Existing Tests

### Component Tests (2 files, 21 cases total)

**PrimaryButton.test.tsx** (10 cases):
- Default, disabled, loading render states
- Without divider / not full-width variant
- onPress fires correctly, blocked when disabled/loading
- Accessibility properties (label, state, disabled state)
- testID rendering

**TextInput.test.tsx** (11 cases):
- Dark variant empty and with value
- Light variant empty and with value
- Error display, disabled state
- onChangeText callback
- testID, label text, error text visibility
- Snapshot tests for both components

### Coverage: ~5% of codebase (only 2 UI components tested)

---

## 4. Maestro E2E (2 flows)

**Location**: `rn-app/.maestro/`
**App ID**: `com.flent.secured`

### open-signup.yaml
```yaml
- launchApp: { clearState: true }
- waitForAnimationToEnd
```
Purpose: verify app launches and animations complete.

### open-waitlist.yaml
```yaml
- launchApp
- waitForAnimationToEnd
- tapOn: "Search screens, routes, or Figma nodes..."
- inputText: "waitlist"
- hideKeyboard
- waitForAnimationToEnd
- tapOn: { text: "Waitlist", index: 1 }
```
Purpose: navigate to waitlist via dev screen picker.

---

## 5. Backend Tests (Supabase)

**Location**: `supabase/functions/_tests/`

### Test Files
- `verify-bank.test.ts` -- bank verification via Cashfree
- `verify-utility.test.ts` -- utility bill verification via API Club
- `payment-flow.test.ts` -- payment initiation and processing
- `payment-methods-refunds.test.ts` -- payment methods CRUD and refunds
- `verification-flow.test.ts` -- identity verification flow
- `user-onboarding-flow.test.ts` -- full onboarding journey
- `utility-bill-flow.test.ts` -- end-to-end utility verification

### Mock Helpers (`_tests/helpers/`)
- `mock-cashfree.ts` -- Cashfree Penny Drop / KYC mocks
- `mock-twilio.ts` -- Twilio OTP verification mocks
- `mock-payu.ts` -- PayU payment gateway mocks
- `mock-apiclub.ts` -- API Club utility verification mocks

### Running Backend Tests
```bash
cd supabase && supabase functions test
# or via CI: deno test supabase/functions/_tests/
```

---

## 6. CI/CD Test Integration

### Backend CI (`.github/workflows/ci-backend.yml`) -- ACTIVE
- Runs on PRs to main affecting `supabase/`
- pgTAP database tests + Deno edge function tests
- Coverage uploaded to Codecov (LCOV format)
- Claude Code AI review for security and coverage

### Visual Regression (`.github/workflows/visual-tests.yml`) -- INFRASTRUCTURE ONLY
- Manual dispatch, iOS (Sauce Labs XCUITest) + Web (Playwright)
- Config files exist in `.sauce/`, no actual test suites written

### Frontend CI -- NOT YET IMPLEMENTED
Needed: `tsc --noEmit`, `eslint .`, `jest --coverage`, Maestro Cloud

---

## 7. Test Pyramid Target

```
         ┌──────────────────┐
         │   E2E Journeys   │  5 multi-screen flows (Maestro)
         │   Current: 2     │  Target: 5 auth + onboarding + payment + profile + transactions
         ├──────────────────┤
         │ Functional Flows  │  21 per-screen flows (Maestro)
         │   Current: 0     │  One per route, covers all states
         ├──────────────────┤
         │  Integration      │  Service layer against Supabase
         │   Current: 0     │  Target: ~20 test files
         ├──────────────────┤
         │    Unit Tests     │  Components, stores, hooks, utils
         │   Current: 2     │  Target: ~50 test files, 70%+ coverage
         └──────────────────┘
```

---

## 8. Test Categories & What to Write

### Unit Tests (Jest + @testing-library/react-native)
**Components** (15 shared, only 2 tested):
- Screen, Text, TextButton, PhoneInput, OTPInput, DottedPattern
- DocumentUploadCard, FileUploadZone, ConsentToggle, CarouselDots
- Logo, ErrorBoundary

**Stores** (2 Zustand stores, 0 tested):
- useAuthStore: state transitions, actions, selectors
- useWaitlistStore: state transitions, countdown logic, referral handling

**Hooks** (10+ hooks, 0 tested):
- useAuth, useWaitlist, useDashboard, useAgreement
- usePayments, useProfile, useSetup, useRequireAuth

**Utils** (0 tested):
- errorHandling.ts: Result type, tryCatch, getErrorMessage

### Integration Tests
- Auth flow: sendOtp -> verifyOtp -> session
- Payment flow: initiate -> webhook -> status
- Waitlist flow: join -> status -> approve
- Agreement: upload -> process -> extract -> confirm

### Maestro Flows (per-screen functional)
```
rn-app/.maestro/
  screens/           ← 21 files, one per route
    splash.yaml
    carousel.yaml
    sign-up.yaml
    otp.yaml         ← test all 4 states
    waitlist.yaml    ← test 6 states
    ...
  journeys/          ← 5 E2E user paths
    auth-journey.yaml
    onboarding-journey.yaml
    payment-success-journey.yaml
    payment-failure-journey.yaml
    profile-journey.yaml
  subflows/          ← reusable
    navigate-to-screen.yaml
    login.yaml
```

### Maestro Cloud (regression)
- Build: `npx eas-cli build --platform ios --profile e2e-test --local`
- Run: `maestro cloud --api-key KEY --device-os iOS-18-2 --device-model iPhone-16-Pro app.zip .maestro/`
- Tags: `--include-tags regression`, `--include-tags smoke`, `--include-tags e2e`
- 1 cloud device = serial execution

---

## 9. Test Scripts

```bash
# Unit tests
npm test                    # run all Jest tests
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report
npm run test:snapshot       # update snapshots

# Backend tests
cd supabase && supabase functions test

# Maestro E2E
cd rn-app && maestro test .maestro/
```

---

## 10. Testing Gaps Summary

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| Unit test files | 2 | ~50 | High |
| Unit test cases | 21 | ~200 | High |
| Coverage | ~5% | 70%+ | High |
| Maestro flows | 2 | 26 (21 screens + 5 journeys) | Medium |
| Integration tests | 0 | ~20 | Medium |
| Visual regression | infra only | baselines + automated | Low |
| Accessibility tests | 0 | per-screen | Low |
| Performance tests | 0 | startup + animation FPS | Low |
