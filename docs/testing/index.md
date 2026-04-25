# Testing Guide — Maestro E2E

The repo ships with a **fully configured Maestro E2E test suite** at `maestro/`. 49 flows total: 39 screen flows + 10 journey flows + 3 profiles (smoke / regression / nightly) + cloud execution script. This guide covers running the tests, the conventions, and how to extend them.

> **Last reviewed:** 2026-04-25

## Contents

```
maestro/
  config.yaml          — global Maestro config (env vars, app id, deep-link scheme)
  ci.yaml              — Maestro Cloud CI configuration (4 device shards)
  run-cloud.sh         — wrapper script for cloud runs
  flows/               — 39 screen-level flows organized by section:
                         auth, agreement, waitlist, setup, main, payment,
                         profile, edge-cases, routing
  journeys/            — 10 end-to-end journeys: new-user-onboarding,
                         payment-card, payment-netbanking, make-payment,
                         manage-profile, network-offline, crash-recovery-payment,
                         profile-management-full, sign-out-relogin, skip-setup
  profiles/
    smoke/             — minimal critical-path coverage; PR gate (5 flows)
    regression/        — full coverage; release gate
    nightly/           — full coverage on dev environment, scheduled daily
```

## Run locally (free)

Local emulator runs are free and fast. Use this for everyday development.

### Prereqs
```bash
brew install maestro
# OR: curl -Ls "https://get.maestro.mobile.dev" | bash
maestro --version  # should print version
```

You also need an iOS simulator or Android emulator booted with the dev build of the app installed. The simplest path:

```bash
cd rn-app
npx expo run:ios   # builds + boots iOS simulator
# OR
npx expo run:android
```

### Run a single flow
```bash
cd Secured-v2
maestro test maestro/flows/auth/login-otp.yaml
```

### Run a profile (e.g., smoke)
```bash
maestro test maestro/profiles/smoke/
```

### Watch mode (auto-rerun on flow file save)
```bash
maestro test --watch maestro/flows/auth/login-otp.yaml
```

## Run in Maestro Cloud (paid; release gate)

`maestro/ci.yaml` defines a 4-device matrix (iPhone 16, iPhone 15, Pixel 8, Pixel 7) so you catch device-specific regressions. Cloud runs cost ~$0.30–$1.00 per flow per device — budget accordingly.

```bash
# Quick smoke (single device)
bash maestro/run-cloud.sh smoke

# Full regression (4 devices, ~30 min)
bash maestro/run-cloud.sh regression
```

Maestro Cloud requires `MAESTRO_CLOUD_API_KEY` env var. Get one from `mobile.dev` dashboard.

### When to use Cloud vs local
| Situation | Use |
|---|---|
| Iterating on a new flow / debugging | **Local emulator** — free, fast |
| Verifying a PR before merge | **GH Actions hosted Android emulator** (Phase 5 CI) — free, slower than local |
| Pre-release regression | **Maestro Cloud** with `regression` profile — covers iOS + Android, multiple device sizes |
| Nightly drift detection on dev | **Maestro Cloud** with `nightly` profile (Phase 5 `maestro-nightly.yml`) |

The plan's CI/CD design uses GH-hosted emulators for PR gates (free) and Maestro Cloud only for `mobile-release.yml` and `maestro-nightly.yml` to keep costs bounded.

## Test data — the seeded users

Maestro flows assume the app has a known seed state. Two layers:

### Local — `supabase/seed.sql`
Runs on every `npm run db:reset`. Creates 3 test users with full journey state:

| Phone | UUID | State |
|---|---|---|
| `+919999999901` | `11111111-…` | Active tenant — fully verified, has tenancy + bank + payments + cashback |
| `+919999999902` | `22222222-…` | Verified landlord paired with tenant 1 |
| `+919999999903` | `33333333-…` | Pending tenant (post-OTP, pre-extraction) |

Dev OTP (when `ALLOW_DEMO_AUTH=true`): **`123456`**.

### Cloud — `seed-test-data` edge fn
For Maestro Cloud or remote dev runs, `seed-test-data` edge fn (`supabase/functions/seed-test-data/`) creates test phones in the `+91999990XXXX` range with controlled journey states. Auth gated to those test phones + service role — see the function source for details.

### `dev-seed` — jump to a specific journey state
The DevNavigator UI in dev builds (`(dev)/screen-picker`) backs onto `dev-seed` edge fn. Use this when you need a specific tenant state for a test:

```yaml
# Maestro flow snippet
- runFlow:
    file: ../setup/jump-to-state.yaml
    env:
      TARGET_STATE: waitlisted_approved
```

## TestID conventions

Maestro relies heavily on `testID` props on RN components. Coverage is currently sparse (~15-20 of ~90 components annotated). Extending coverage is a continuous workstream.

### Conventions

```tsx
// Pressable / button
<Pressable testID="login-otp-submit" onPress={onSubmit}>...</Pressable>

// TextInput
<TextInput testID="otp-input" value={otp} onChangeText={setOtp} />

// Container that wraps a list / flow
<View testID="payment-method-modal-list">...</View>
```

Naming pattern: `<screen>-<component>-<action>` (lowercase, dashes). Keep stable across releases — Maestro flows reference these by exact match.

### When TestID isn't enough

Use `accessibilityLabel` for screen-reader-friendly + Maestro-friendly identification:

```tsx
<Image
  source={...}
  testID="payment-success-checkmark"
  accessibilityLabel="Payment successful"
/>
```

Maestro can match either; accessibilityLabel doubles as a11y win.

## Deep linking

`rn-app/app.json` defines:
- iOS: `applinks:app.flent.in` — universal links from `https://app.flent.in/...`
- Android: intent filter on `https://app.flent.in/`
- Custom scheme: `flentsecured://...`

Maestro can launch the app directly into a screen using deep links — faster than navigating through the journey:

```yaml
appId: in.flent.secured
---
- launchApp:
    arguments:
      url: flentsecured://payment/enter-rent
- assertVisible: "Enter rent amount"
```

Use this in flows that test a single screen's behavior in isolation rather than the full journey to get there.

> Document deep-link routes in `docs/frontend/deep-linking.md` (TODO — not yet written; track via the cleanup plan's Phase 4).

## Adding a new flow

1. Pick a section under `maestro/flows/<section>/`
2. Create `<flow-name>.yaml` with this skeleton:
   ```yaml
   appId: ${APP_ID}
   ---
   - launchApp:
       arguments:
         url: ${DEEP_LINK_SCHEME}://path/to/screen
   - assertVisible: "Expected screen header"
   - tapOn:
       id: "some-test-id"
   - inputText: ${TEST_INPUT}
   - assertVisible:
       text: "Success state"
       timeout: 10000
   ```
3. Use `${ENV_VAR}` interpolation for anything per-environment (test phone, deep link scheme, etc.) — see `maestro/config.yaml` for the full list.
4. Run locally: `maestro test maestro/flows/<section>/<flow-name>.yaml`
5. Once green, link from the relevant journey if applicable.
6. Add to `profiles/smoke/` only if it's a critical-path test (auth, payment success path).

## Failure debugging

```bash
# Run with verbose output
maestro test --debug maestro/flows/auth/login-otp.yaml

# Capture screenshots on failure
maestro test --output-dir /tmp/maestro-output maestro/flows/...

# Inspect a running app
maestro studio
```

Common gotchas:
- **Element not found** — check `testID` exists in the component AND the screen has rendered. Add `extendedWaitUntil` if the screen needs time to load.
- **Flaky timing** — Maestro's default 5s wait may not be enough for screens that fetch data. Use `extendedWaitUntil` with `assertVisible` and a longer timeout.
- **Deep link fails** — verify the URL scheme is registered and the app handles the path. `flentsecured://` only works on dev/preview builds, not Expo Go.

## Plan integration

Per the cleanup plan, Phase 5 wires Maestro into CI:
- `pr-gates.yml` runs `smoke` profile on every PR, on a GH-hosted Android emulator (free)
- `maestro-nightly.yml` runs `nightly` profile on dev branch via Maestro Cloud, files an issue on failure
- `mobile-release.yml` runs `regression` profile via Maestro Cloud before EAS submit

These are pending — see the plan for status.
