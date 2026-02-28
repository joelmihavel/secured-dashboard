# Flent Secured -- Development & Testing Infrastructure Guide

Last updated: 2026-02-27

---

## Table of Contents

1. [Overview](#1-overview)
2. [DevNavigator -- The Dev Toolkit](#2-devnavigator----the-dev-toolkit)
3. [Mock Data System](#3-mock-data-system)
4. [Scenarios](#4-scenarios)
5. [Test Phone Numbers & Quick Login](#5-test-phone-numbers--quick-login)
6. [Backend: Seed Test Data](#6-backend-seed-test-data)
7. [Backend: Deploying & Configuring](#7-backend-deploying--configuring)
8. [Build Profiles & Bundle Safety](#8-build-profiles--bundle-safety)
9. [Adding New Features to the Dev System](#9-adding-new-features-to-the-dev-system)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

### What Was Built

The Flent Secured React Native app ships with a two-environment architecture designed to maximize developer velocity while guaranteeing zero dev code in production bundles.

| Environment   | `__DEV__` | `APP_ENV`     | Mock data | DevNavigator | Test phones |
|---------------|-----------|---------------|-----------|--------------|-------------|
| Development   | `true`    | `development` | Available | Visible      | Bypass SMS  |
| Release       | `false`   | `production`  | Excluded  | Excluded     | Disabled    |

**Why this matters:** Every piece of dev infrastructure -- mock functions, the DevNavigator overlay, test data factories, the `__dev__/` and `__mocks__/` directories -- is physically removed from production bundles via Metro's `blockList` and `__DEV__` compile-time gates. There is no runtime flag to accidentally leave on.

### Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|  Development Mode (__DEV__ = true)                                                |
|                                                                                   |
|  +-------------------+      +-------------------+      +---------------------+    |
|  | DevNavigator      |      | devConfig.ts      |      | devStore.ts         |    |
|  | (FAB + Sheet)     |----->| Mock toggles      |      | Active scenario     |    |
|  |                   |      | Test phones        |      | Font scale override |    |
|  | - Quick Login     |      +--------+----------+      +----------+----------+    |
|  | - Mock Toggles    |               |                            |               |
|  | - Font Scale      |               v                            |               |
|  | - Screen Nav      |      +--------+----------+                 |               |
|  | - Scenario Picker |      | withMock()        |                 |               |
|  +-------------------+      | (per-service HOF) |                 |               |
|                             +--------+----------+                 |               |
|                                      |                            |               |
|                 +--------------------+--------------------+       |               |
|                 |                    |                    |       |               |
|          +------v------+     +------v------+     +------v------+ |               |
|          | dashboard   |     | payments    |     | waitlist    | |               |
|          | service     |     | service     |     | service     | |               |
|          |             |     |             |     |             | |               |
|          | realFn()    |     | realFn()    |     | realFn()    | |               |
|          | mockFn()    |     | mockFn()    |     | mockFn()    | |               |
|          +------+------+     +------+------+     +------+------+ |               |
|                 |                    |                    |       |               |
|          +------v------+     +------v------+     +------v------+ |               |
|          | __mocks__/  |     | __mocks__/  |     | testData    | |               |
|          | dashboard   |     | payments    |     | Factory     | |               |
|          +-------------+     +-------------+     +-------------+ |               |
|                                                                   |               |
|  +-------------------+      +-----------------------------------+ |               |
|  | scenarios.ts      |----->| React Query Cache                 |<+               |
|  | (state presets)   |      | queryClient.setQueryData()        |                 |
|  +-------------------+      +-----------------------------------+                 |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  Production Mode (__DEV__ = false)                                                |
|                                                                                   |
|  Metro blockList removes: src/__dev__/*, src/__mocks__/*,                         |
|                           src/services/api/__mocks__/*                            |
|                                                                                   |
|  All withMock() calls compile to: return realFn;                                  |
|  DevNavigator require() compiles to: null                                         |
+-----------------------------------------------------------------------------------+

Backend (Supabase Edge Functions):
+-------------------------------------------------------------------+
|                                                                   |
|  auth-otp                        seed-test-data                   |
|  +---------------------------+   +---------------------------+    |
|  | ALLOW_DEMO_AUTH=true      |   | Service role auth only    |    |
|  | DEMO_PHONES map           |   | Test phone regex guard    |    |
|  |                           |   |                           |    |
|  | send_otp:                 |   | Targets:                  |    |
|  |   demo phone? skip SMS   |   |   signed_up               |    |
|  |   create otp_request     |   |   agreement_confirmed     |    |
|  |                           |   |   waitlisted              |    |
|  | verify_otp:               |   |   waitlisted_rejected     |    |
|  |   demo phone? check map  |   |   approved                |    |
|  |   create session          |   |   active (+payments)      |    |
|  +---------------------------+   +---------------------------+    |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## 2. DevNavigator -- The Dev Toolkit

The DevNavigator is a floating overlay rendered in the root layout (`app/_layout.tsx`) as a sibling to the navigation stack. It is visible only in development builds.

### How to Open It

A draggable orange FAB (Floating Action Button) labeled **"D"** appears in the bottom-right corner of the screen. Tap it to open the bottom sheet. The FAB can be dragged anywhere on screen to avoid obscuring UI you are working on.

To temporarily hide the FAB (for example, when taking parity screenshots), set `HIDE_DEV_NAV = true` in `src/components/dev/DevNavigator.tsx`.

### Sections

The bottom sheet contains five sections, top to bottom:

#### Quick Login

Three buttons, one per test phone number. Tapping a button performs a complete login flow in the background:

1. Calls `auth-otp` with `action: send_otp` for the test phone
2. The edge function recognizes the demo phone and skips real SMS
3. Immediately calls `auth-otp` with `action: verify_otp` using the hardcoded OTP
4. Sets the Supabase session from the response tokens
5. AuthProvider detects the new session and navigates accordingly

A loading spinner replaces the button label while login is in progress. All buttons are disabled during a login attempt to prevent double-fires.

| Button Label     | Phone           | OTP      |
|------------------|-----------------|----------|
| Active User      | +919999900001   | 123456   |
| Waitlisted User  | +919999900002   | 654321   |
| New Signup       | +919999900003   | 111111   |

#### Mock Service Toggles

- **All Mocks** (master toggle): Flips every service mock on or off. Toggling this clears the React Query cache and resets all Zustand stores to prevent stale data mixing between real and mock sources.
- **Mock Services** (collapsible): Per-service toggles for `dashboard`, `payments`, `waitlist`, `agreement`, `setup`, and `profile`. Expanding the section shows individual switches.

Default state on app start: `dashboard` and `payments` mocks are ON; all others are OFF.

#### Font Scale Override

Five preset buttons: **1.0x**, **1.15x**, **1.3x**, **1.5x**, **2.0x**. Selecting a value stores it in `devStore` and overrides the system font scale for accessibility testing. Selecting **1.0x** resets to the system default.

> Note: The font scale override requires consuming components to read from `useDevStore`. It is available for testing how custom text components handle Dynamic Type scaling.

#### Screen Navigator

A searchable, flat list of every screen route in the app grouped by section (Auth, Home, Payment, Profile, Setup, Waitlist, Agreement). The search box filters by screen name, route path, or section label.

- **Tap** a screen: navigates directly to that route.
- **Long-press** a screen with a scenario dot (small orange circle): opens the Scenario Picker overlay.

#### Scenario Picker

When you long-press a screen that has associated scenarios, a centered modal appears listing available state presets. Tapping a scenario triggers the 6-step injection pipeline (see [Scenarios](#4-scenarios) below). A "Default (no scenario)" option is always present at the bottom, which clears the active scenario and navigates normally.

The currently active scenario is shown as an orange badge in the sheet header, with an "X" button to clear it.

---

## 3. Mock Data System

### The `withMock()` Pattern

`withMock()` is a higher-order function that wraps a real API function and a mock function with the same return type. It replaces the old scattered `DEV_USE_MOCK_*` boolean flags with a type-safe, centralized mechanism.

**File:** `src/__dev__/withMock.ts`

```ts
function withMock<TArgs extends unknown[], TResult>(
  serviceName: ServiceName,
  realFn: (...args: TArgs) => Promise<TResult>,
  mockFn: (...args: TArgs) => Promise<TResult>,
  options?: { delayMs?: number }
): (...args: TArgs) => Promise<TResult>
```

**How it works:**

1. If `__DEV__` is `false`, the function returns `realFn` immediately -- the mock branch is dead code and Metro eliminates it entirely.
2. If `__DEV__` is `true`, the returned wrapper function checks `devMockConfig[serviceName]` at call time via a dynamic `import()`.
3. If the toggle is ON, the mock function runs (with optional simulated latency). If OFF, the real function runs.
4. The `delayMs` option simulates network latency to help expose race conditions and loading state bugs.

**TypeScript enforces that `realFn` and `mockFn` have identical signatures and return types.** If you change the real function's interface, the compiler forces you to update the mock.

### How Mock Data Flows

```
User flips toggle in DevNavigator
        |
        v
devConfig.devMockConfig['dashboard'] = true
        |
        v
fetchDashboard() is called by React Query
        |
        v
withMock() wrapper checks devMockConfig['dashboard']
        |
        +-- true  --> fetchDashboardMock() --> dynamic import('./__mocks__/dashboard-mock')
        |                                          --> returns MOCK_DASHBOARD_DATA
        +-- false --> fetchDashboardReal() --> callEdgeFunction('dashboard-data')
```

### How to Add Mock Support to a New Service

**Step 1:** Add the service name to the `ServiceName` union type in `src/__dev__/devConfig.ts`:

```ts
export type ServiceName = 'dashboard' | 'payments' | 'waitlist' | 'agreement'
  | 'setup' | 'profile' | 'your-new-service';
```

**Step 2:** Add a default toggle value in the same file:

```ts
export const devMockConfig: Record<ServiceName, boolean> = {
  dashboard: true,
  payments: true,
  waitlist: false,
  agreement: false,
  setup: false,
  profile: false,
  'your-new-service': false,
};
```

**Step 3:** Create a mock data file at `src/services/api/__mocks__/your-service-mock.ts`:

```ts
import type { YourDataType } from '../your-service';

export const MOCK_YOUR_DATA: YourDataType = {
  // ... realistic mock data
};
```

**Step 4:** In your service file (e.g., `src/services/api/your-service.ts`), define the real and mock functions, then wrap with `withMock()`:

```ts
async function fetchDataReal(): Promise<{ data: YourDataType | null; error: string | null }> {
  // ... real edge function call
}

async function fetchDataMock(): Promise<{ data: YourDataType | null; error: string | null }> {
  const { MOCK_YOUR_DATA } = await import('./__mocks__/your-service-mock');
  return { data: MOCK_YOUR_DATA, error: null };
}

const _fetchData = __DEV__
  ? (() => {
      const { withMock } = require('@/src/__dev__/withMock');
      return withMock('your-new-service', fetchDataReal, fetchDataMock, { delayMs: 200 });
    })()
  : fetchDataReal;

export const fetchData = _fetchData;
```

**Step 5:** Add the service name to `SERVICE_NAMES` in `src/components/dev/DevNavigator.tsx`:

```ts
const SERVICE_NAMES: ServiceName[] = [
  'dashboard', 'payments', 'waitlist', 'agreement', 'setup', 'profile',
  'your-new-service',
];
```

### Production Safety Mechanisms

Three independent layers ensure dev code never reaches production:

| Layer                | Mechanism                                                     | What it protects                     |
|----------------------|---------------------------------------------------------------|--------------------------------------|
| `__DEV__` gate       | Compile-time constant; `false` in release                     | `withMock()` returns `realFn` only   |
| Metro `blockList`    | Regex excludes `__dev__/`, `__mocks__/` dirs from bundle      | Mock files are physically absent     |
| Conditional require  | `const DevNavigator = __DEV__ ? require(...) : null`          | DevNavigator component not bundled   |

---

## 4. Scenarios

Scenarios are predefined application states that can be activated with a single tap from the DevNavigator. They inject data directly into the React Query cache, bypassing the network entirely.

### Available Scenarios

| Scenario Key              | Target Screen        | What It Sets Up                                                    |
|---------------------------|----------------------|--------------------------------------------------------------------|
| `waitlist:pending`        | Waitlist             | Waitlist status = pending, position #142, est. 3 days              |
| `waitlist:approved`       | Waitlist             | Waitlist status = approved, batch #1                               |
| `waitlist:rejected`       | Waitlist             | Waitlist status = rejected, 30-day cooldown, rejection reasons     |
| `home:payment_due`        | Home Dashboard       | Active tenancy, upcoming payment with 7 days until due             |
| `home:payment_overdue`    | Home Dashboard       | Active tenancy, payment 5 days overdue, past cutoff, no cashback   |
| `home:no_tenancy`         | Home Dashboard       | No tenancy, no upcoming payment (empty state)                      |
| `home:pending_verification` | Home Dashboard     | Tenancy exists but bank/utility/landlord not all verified          |
| `payment:history`         | Transactions         | 6 months of payment history entries                                |

### How Scenario Activation Works (6-Step Pipeline)

When you tap a scenario in the Scenario Picker, the following happens synchronously:

```
Step 1: Cancel in-flight queries
        queryClient.cancelQueries()

Step 2: Nuclear cache clear
        queryClient.clear()

Step 3: Reset all Zustand stores
        clearAllStores()
        (auth, upload, waitlist, payment, setup, profile)

Step 4: Set active scenario in devStore
        useDevStore.getState().setScenario(scenarioKey)

Step 5: Seed React Query cache with scenario data
        queryClient.setQueryData(['dashboard'], { data: scenario.dashboard, error: null })
        queryClient.setQueryData(['waitlist-status'], { data: scenario.waitlist, error: null })
        (etc., based on which keys the scenario defines)

Step 6: Navigate to target screen
        router.push(path)
```

This ensures the screen renders immediately with the desired state, with no network round-trip and no leftover data from a previous state.

### How to Add a New Scenario

**Step 1:** Define the scenario data in `src/__dev__/scenarios.ts`:

```ts
export const SCENARIOS = {
  // ... existing scenarios ...
  'home:payment_processing': {
    dashboard: createMockDashboardData({
      upcoming_payment: null,
      recent_payments: [
        { id: 'pay-001', amount: 25000, status: 'processing',
          rent_month: '2026-03-01', paid_at: null, cashback_earned: 0 },
      ],
    }),
  },
} as const satisfies Record<string, Record<string, unknown>>;
```

**Step 2:** Add the scenario to the appropriate screen in the `SECTIONS` array in `src/components/dev/DevNavigator.tsx`:

```ts
{
  name: 'Home Dashboard',
  path: '/(main)',
  scenarios: [
    { label: 'Payment Due', key: 'home:payment_due' },
    { label: 'Payment Overdue', key: 'home:payment_overdue' },
    { label: 'No Tenancy', key: 'home:no_tenancy' },
    { label: 'Pending Verification', key: 'home:pending_verification' },
    { label: 'Payment Processing', key: 'home:payment_processing' },  // <-- new
  ],
},
```

**Step 3:** If the scenario uses a new React Query cache key, add the seeding logic in the `activateScenario` function in `DevNavigator.tsx`:

```ts
if ('yourNewKey' in scenario) {
  queryClient.setQueryData(['your-query-key'], {
    data: scenario.yourNewKey,
    error: null,
  });
}
```

---

## 5. Test Phone Numbers & Quick Login

### Available Test Phones

| Phone            | OTP     | Purpose                           | Seeded User State     |
|------------------|---------|-----------------------------------|-----------------------|
| +919999900001    | 123456  | Active user (full journey)        | Use `seed-test-data`  |
| +919999900002    | 654321  | Waitlisted user                   | Use `seed-test-data`  |
| +919999900003    | 111111  | New signup (minimal state)        | Use `seed-test-data`  |

All test phone numbers follow the pattern `+91999990XXXX`. The backend strictly validates this pattern and refuses to operate on any phone outside it.

### How the Backend DEMO_PHONES Bypass Works

The auth-otp edge function (`supabase/functions/auth-otp/index.ts`) has a two-gate system:

**Gate 1: Environment flag**

```ts
const ALLOW_DEMO = Deno.env.get("ALLOW_DEMO_AUTH") === "true";
```

If `ALLOW_DEMO` is `false`, demo phone logic is entirely skipped and these phones go through normal SMS delivery (which will fail since they are not real numbers).

**Gate 2: Phone-to-OTP map**

```ts
const DEMO_PHONES_RAW = Deno.env.get("DEMO_PHONES");
// Parsed to: { "+919999900001": "123456", "+919999900002": "654321", ... }
```

**Send OTP flow (demo path):**

1. Client sends `{ action: "send_otp", phone_number: "+919999900001" }`
2. Edge function checks: `ALLOW_DEMO && DEMO_PHONES[sanitizedPhone]`
3. If both true: creates an `otp_request` row with `provider: "demo"` (no SMS sent)
4. Returns `{ otp_request_id, expires_in: 600 }`

**Verify OTP flow (demo path):**

1. Client sends `{ action: "verify_otp", phone_number: "+919999900001", otp: "123456", otp_request_id: "..." }`
2. Edge function looks up the `otp_request` row, sees `provider: "demo"`
3. Compares submitted OTP against `DEMO_PHONES[sanitizedPhone]` map
4. If match: creates/finds auth user, generates session token, returns success with `token_hash`

### How to Add a New Test Phone Number

**Server side:**

1. Update the `DEMO_PHONES` Supabase secret to include the new entry:

```bash
supabase secrets set DEMO_PHONES="+919999900001:123456,+919999900002:654321,+919999900003:111111,+919999900004:222222" --project-ref zqlowjveyqiagnbmfwsb
```

2. Redeploy the `auth-otp` function (or it will pick up secrets on next cold start):

```bash
supabase functions deploy auth-otp --project-ref zqlowjveyqiagnbmfwsb
```

**Client side:**

3. Add the phone to `TEST_PHONES` in `src/__dev__/devConfig.ts`:

```ts
export const TEST_PHONES = [
  { phone: '+919999900001', otp: '123456', label: 'Active User' },
  { phone: '+919999900002', otp: '654321', label: 'Waitlisted User' },
  { phone: '+919999900003', otp: '111111', label: 'New Signup' },
  { phone: '+919999900004', otp: '222222', label: 'Apple Reviewer' },  // <-- new
] as const;
```

### Apple Review Setup

Apple requires a test account for app review. Use this procedure before each TestFlight submission:

1. **Enable demo auth** on production Supabase:

```bash
supabase secrets set ALLOW_DEMO_AUTH=true --project-ref zqlowjveyqiagnbmfwsb
```

2. **Seed the reviewer's test user** to the appropriate state:

```bash
cd rn-app
./scripts/seed-test.sh active +919999900001
```

3. **Provide Apple** with the test credentials in App Store Connect:
   - Phone: `+919999900001`
   - OTP: `123456`

4. **After approval** (optional), disable demo auth:

```bash
supabase secrets set ALLOW_DEMO_AUTH=false --project-ref zqlowjveyqiagnbmfwsb
```

> The `ALLOW_DEMO_AUTH` flag is separate from `DEMO_PHONES`. Even if `DEMO_PHONES` is set, demo login is disabled when `ALLOW_DEMO_AUTH` is not `"true"`.

---

## 6. Backend: Seed Test Data

### What It Does

The `seed-test-data` edge function (`supabase/functions/seed-test-data/index.ts`) resets a test phone number's user to a specific journey state. It is idempotent: running it twice with the same target state produces the same result.

The function works by building state progressively:

1. Ensures an auth user exists (creates or finds)
2. Upserts the user profile row
3. Cleans downstream entities that conflict with the target state
4. Builds up entities to match the target state

### Available Target States

| Target State             | What Gets Created                                                         |
|--------------------------|---------------------------------------------------------------------------|
| `signed_up`              | Auth user + users profile row. Nothing else.                              |
| `agreement_confirmed`    | + Agreement (status: confirmed) + extraction with realistic data          |
| `waitlisted`             | + All of above + waitlist entry (status: pending, position: 42)           |
| `waitlisted_rejected`    | + All of above + waitlist entry (status: rejected)                        |
| `approved`               | + All of above + waitlist (approved) + tenancy (pending_verification)     |
| `active`                 | + All of above + tenancy (active, fully verified) + optional payments     |

For the `active` state, additional options are available:

| Option                   | Default | Description                                  |
|--------------------------|---------|----------------------------------------------|
| `with_payment_history`   | `true` (for active state) | Include payment history rows    |
| `payment_count`          | `3`     | Number of monthly payments to seed           |
| `with_cashback`          | `true`  | Include 1% cashback on each payment          |

### Using the CLI Script

```bash
cd rn-app

# Basic usage: seed default phone to a state
./scripts/seed-test.sh signed_up
./scripts/seed-test.sh active

# Specify a different test phone
./scripts/seed-test.sh approved +919999900002

# Customize payment options via env vars
SEED_PAYMENT_COUNT=6 SEED_CASHBACK=true ./scripts/seed-test.sh active +919999900001
```

The script:
- Validates the target state against the allowed list
- Validates the phone matches the `+91999990XXXX` pattern
- Retrieves the service role key from Supabase CLI (you must be logged in)
- Calls the edge function and pretty-prints the JSON response

### Safety Guards

| Guard                    | What it prevents                                                    |
|--------------------------|---------------------------------------------------------------------|
| Service role auth        | Only callable with the service role key (not user JWTs)             |
| Test phone regex         | Only `+91999990XXXX` phones are allowed -- rejects all others       |
| Real user protection     | Only phones matching `+91999990XXXX` are accepted; `is_test_user=true` is set only for Apple review phones (00001, 00002) |
| Rate limiting            | 1 invocation per 5 seconds (checked via audit_logs)                 |
| Audit logging            | Every seed operation is recorded with masked phone + target state   |

---

## 7. Backend: Deploying & Configuring

### Setting Supabase Secrets

```bash
# Set demo auth flag
supabase secrets set ALLOW_DEMO_AUTH=true --project-ref zqlowjveyqiagnbmfwsb

# Set demo phone map (comma-separated phone:otp pairs)
supabase secrets set DEMO_PHONES="+919999900001:123456,+919999900002:654321,+919999900003:111111" --project-ref zqlowjveyqiagnbmfwsb

# Verify current secrets
supabase secrets list --project-ref zqlowjveyqiagnbmfwsb
```

### Deploying Edge Functions

```bash
# Deploy a single function
supabase functions deploy auth-otp --project-ref zqlowjveyqiagnbmfwsb
supabase functions deploy seed-test-data --project-ref zqlowjveyqiagnbmfwsb

# Deploy all functions
supabase functions deploy --project-ref zqlowjveyqiagnbmfwsb
```

### Enable/Disable ALLOW_DEMO_AUTH

This is the master switch for demo phone login. It has no effect on any other functionality.

```bash
# Enable (required for dev Quick Login and Apple Review)
supabase secrets set ALLOW_DEMO_AUTH=true --project-ref zqlowjveyqiagnbmfwsb

# Disable (recommended after Apple approval)
supabase secrets set ALLOW_DEMO_AUTH=false --project-ref zqlowjveyqiagnbmfwsb
```

**Important:** Secrets take effect on the next cold start of the edge function. To force immediate effect, redeploy:

```bash
supabase functions deploy auth-otp --project-ref zqlowjveyqiagnbmfwsb
```

### Apple Review Cycle

| Phase              | ALLOW_DEMO_AUTH | Action                                                          |
|--------------------|-----------------|-----------------------------------------------------------------|
| Pre-submission     | `true`          | `seed-test.sh active +919999900001`, provide credentials to Apple |
| Under review       | `true`          | Leave enabled -- reviewer needs it                              |
| After approval     | `false` (optional) | Disable if you prefer. Demo phones still cannot bypass without it |
| Next submission    | `true`          | Re-enable, re-seed, re-submit                                  |

---

## 8. Build Profiles & Bundle Safety

### EAS Build Profiles

Defined in `eas.json`:

| Profile       | `APP_ENV`     | Distribution | `__DEV__` | Notes                              |
|---------------|---------------|--------------|-----------|------------------------------------|
| `development` | `development` | `internal`   | `true`    | Simulator build, dev client        |
| `preview`     | `preview`     | `internal`   | `false`   | Internal testing, no dev tools     |
| `production`  | `production`  | App Store    | `false`   | Release build, auto-increment      |

### Metro blockList

In `metro.config.js`, when `NODE_ENV === 'production'`:

```js
config.resolver.blockList = [
  /src\/__dev__\/.*/,          // devConfig, withMock, devStore, scenarios
  /src\/__mocks__\/.*/,        // testDataFactory
  /src\/services\/api\/__mocks__\/.*/, // dashboard-mock, payments-mock
];
```

These directories and all files within them are completely excluded from the production JavaScript bundle. Any `import()` or `require()` referencing them would fail at bundle time (which is the desired behavior -- it means dev code accidentally leaked past a `__DEV__` guard).

### DevNavigator Conditional Require

In `app/_layout.tsx`:

```ts
const DevNavigator = __DEV__
  ? require('@/src/components/dev/DevNavigator').DevNavigator
  : null;
```

And in the JSX:

```tsx
{DevNavigator && <DevNavigator />}
```

In production, `__DEV__` is `false`, so `DevNavigator` is `null` and the `require()` call is dead code -- Metro never bundles the component file.

### How to Verify the Production Bundle Contains No Dev Code

Build a local production bundle and search for dev-only strings:

```bash
cd rn-app

# Generate the JS bundle
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file node_modules/expo-router/entry.js \
  --bundle-output /tmp/flent-bundle.js

# Search for dev-only strings (should all return 0 matches)
grep -c "devMockConfig" /tmp/flent-bundle.js       # expect: 0
grep -c "DevNavigator" /tmp/flent-bundle.js         # expect: 0
grep -c "withMock" /tmp/flent-bundle.js             # expect: 0
grep -c "testDataFactory" /tmp/flent-bundle.js      # expect: 0
grep -c "MOCK_DASHBOARD_DATA" /tmp/flent-bundle.js  # expect: 0
grep -c "919999900001" /tmp/flent-bundle.js         # expect: 0
```

If any of these return a non-zero count, a `__DEV__` guard is missing somewhere.

### React Query Configuration by Environment

The `QueryProvider` (`src/providers/QueryProvider.tsx`) adjusts caching behavior based on `__DEV__`:

| Setting             | Development       | Production         | Why                                        |
|---------------------|-------------------|--------------------|---------------------------------------------|
| `staleTime`         | `0` (always fresh)| `5 minutes`        | Dev needs instant refresh after toggling mocks |
| `gcTime`            | `0` (no cache)    | `30 minutes`       | Prevents stale mock data from persisting    |
| `retry`             | `0` (fail-fast)   | `2`                | Dev sees errors immediately                 |
| `refetchOnReconnect`| `false`           | `true`             | No spurious refetches during dev            |
| Mutation retries    | `0`               | `1`                | Same rationale                              |

---

## 9. Adding New Features to the Dev System

### Checklist: Adding a New Mock Service

- [ ] Add service name to `ServiceName` type in `src/__dev__/devConfig.ts`
- [ ] Add default toggle value in `devMockConfig`
- [ ] Create mock data file in `src/services/api/__mocks__/`
- [ ] Define `realFn` and `mockFn` in the service file
- [ ] Wrap with `withMock()` using the `__DEV__` + IIFE pattern
- [ ] Export the wrapped function
- [ ] Add service to `SERVICE_NAMES` in `DevNavigator.tsx`
- [ ] Verify mock file is covered by Metro `blockList` regex

### Checklist: Adding a New Scenario

- [ ] Create or use factory functions from `src/__mocks__/testDataFactory.ts`
- [ ] Add the scenario entry to `SCENARIOS` in `src/__dev__/scenarios.ts`
- [ ] Associate the scenario with a screen in `SECTIONS` in `DevNavigator.tsx`
- [ ] If using a new query key, add cache seeding logic in `activateScenario()`
- [ ] Test: long-press the screen in DevNavigator, select the new scenario, verify state

### Checklist: Adding a New Test Phone Number

- [ ] Server: update `DEMO_PHONES` secret (add `+91999990XXXX:YYYYYY`)
- [ ] Server: redeploy `auth-otp` function
- [ ] Client: add entry to `TEST_PHONES` in `src/__dev__/devConfig.ts`
- [ ] Verify Quick Login works in DevNavigator

### Checklist: Adding a New DevNavigator Section

In `src/components/dev/DevNavigator.tsx`:

- [ ] Add section header using `renderSectionHeader('Your Section')`
- [ ] Add section content between the header and `renderDivider()`
- [ ] Add any new state variables at the component top
- [ ] If the section needs new configuration, add it to `devConfig.ts` or `devStore.ts` (see guidance below)

**When to use which store:**

| Data type                | Where to put it      | Why                                          |
|--------------------------|----------------------|----------------------------------------------|
| Environment config       | `devConfig.ts`       | Module-level object, resets on restart        |
| Mutable UI state         | `devStore.ts`        | Zustand store, survives Fast Refresh          |
| Screen routes/sections   | `DevNavigator.tsx`   | Component-local constant                     |
| Mock data                | `__mocks__/` dir     | Separated for Metro exclusion                 |

---

## 10. Troubleshooting

### Stale Data After Switching Mocks

**Symptom:** You toggled a mock service on/off, but the screen still shows old data.

**Cause:** React Query cache or Zustand store retained the previous data.

**Fix:**
1. Use the "All Mocks" toggle (it does a full cache + store clear automatically).
2. Or manually: pull down to refresh on the screen, or close/reopen the app.
3. For scenarios, the activation pipeline already clears everything -- re-activate the scenario.

### Quick Login Failing

**Symptom:** Tapping a Quick Login button shows an error alert.

**Possible causes and fixes:**

| Error message                          | Cause                          | Fix                                         |
|----------------------------------------|--------------------------------|---------------------------------------------|
| "Demo authentication is not available" | `ALLOW_DEMO_AUTH` is not true  | `supabase secrets set ALLOW_DEMO_AUTH=true`  |
| "OTP request not found or expired"     | Timing issue / stale request   | Try again (idempotency window is 30s)       |
| "Invalid OTP"                          | OTP mismatch                   | Verify `DEMO_PHONES` secret matches client   |
| Network-related error                  | Edge function not deployed     | `supabase functions deploy auth-otp`         |
| "Non-2xx response from edge function"  | Function crashed               | Check edge function logs: `supabase functions logs auth-otp --project-ref zqlowjveyqiagnbmfwsb` |

### Seed Script Fails

**Symptom:** `scripts/seed-test.sh` returns an HTTP error.

| HTTP Code | Meaning                       | Fix                                               |
|-----------|-------------------------------|----------------------------------------------------|
| 401       | Invalid service role key      | Run `supabase login` first                          |
| 403       | Phone belongs to real user    | Use a `+91999990XXXX` phone only                    |
| 405       | Wrong HTTP method             | The function only accepts POST                      |
| 429       | Rate limited                  | Wait 5 seconds and try again                        |
| 500       | Server error                  | Check function logs for details                     |

### DevNavigator FAB Not Visible

**Symptom:** The orange "D" button does not appear.

**Possible causes:**
1. `HIDE_DEV_NAV` is set to `true` in `DevNavigator.tsx`. Set it back to `false`.
2. Running a production/preview build where `__DEV__` is `false`. Use a development build.
3. The FAB was dragged off-screen. Restart the app to reset its position.

### Mock Toggle Has No Effect on a Service

**Symptom:** Flipping a toggle in DevNavigator does not change the data.

**Possible cause:** The service function does not use `withMock()`. Check the service file for the pattern:

```ts
const _fetchSomething = __DEV__
  ? (() => {
      const { withMock } = require('@/src/__dev__/withMock');
      return withMock('serviceName', realFn, mockFn);
    })()
  : realFn;
```

If this pattern is missing, the service always calls the real function regardless of the toggle.

### Scenario Data Disappears After Navigation

**Symptom:** You activate a scenario, the screen shows correct data briefly, then it refetches and shows real (or empty) data.

**Cause:** React Query's `staleTime` is `0` in dev, so the seeded data is immediately considered stale. A background refetch replaces it with real API data (or an error if the user has no real backend data).

**Fix:** Enable the corresponding mock toggle before activating the scenario. When the mock is on, the refetch hits the mock function instead of the real API, preserving your scenario's intent. Alternatively, if you want pure cache-only behavior, temporarily disable the query's `refetchOnMount` in the hook.

### Production Bundle Contains Dev Code

**Symptom:** The verification grep (Section 8) returns non-zero matches.

**Fix:**
1. Ensure the import uses `__DEV__` guards. A bare `import` statement (not inside an `if` or ternary) will always be included.
2. Use dynamic `import()` inside mock functions, not top-level `import` statements.
3. Verify `metro.config.js` `blockList` patterns match the file paths.
4. Run `npx expo start --clear` to bust the Metro cache and rebuild.

---

## Appendix: File Reference

| File (relative to `rn-app/`)                          | Purpose                                      |
|-------------------------------------------------------|----------------------------------------------|
| `src/__dev__/devConfig.ts`                            | Mock toggles, test phone numbers              |
| `src/__dev__/withMock.ts`                             | Higher-order mock switching function          |
| `src/__dev__/scenarios.ts`                            | Scenario definitions                          |
| `src/__dev__/devStore.ts`                             | Zustand store for dev-only mutable state      |
| `src/__mocks__/testDataFactory.ts`                    | Typed mock data generators                    |
| `src/services/api/__mocks__/dashboard-mock.ts`        | Static mock dashboard data                    |
| `src/services/api/__mocks__/payments-mock.ts`         | Static mock payment methods data              |
| `src/components/dev/DevNavigator.tsx`                 | Dev overlay component (FAB + sheet)           |
| `src/stores/resetAll.ts`                              | Utility to clear all stores + query cache     |
| `src/providers/QueryProvider.tsx`                     | React Query client (dev/prod settings)        |
| `app/_layout.tsx`                                     | Root layout (conditional DevNavigator load)   |
| `metro.config.js`                                     | Metro bundler config (prod blockList)         |
| `eas.json`                                            | EAS build profiles                            |
| `scripts/seed-test.sh`                                | CLI for seeding test user data                |

| File (relative to project root)                       | Purpose                                      |
|-------------------------------------------------------|----------------------------------------------|
| `supabase/functions/auth-otp/index.ts`                | OTP edge function with demo phone bypass      |
| `supabase/functions/seed-test-data/index.ts`          | Test data seeding edge function               |
