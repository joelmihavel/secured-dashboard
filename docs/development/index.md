# Development Guide — DevNavigator + Dev Tooling

> **Last reviewed:** 2026-04-25

This guide covers the dev-only tooling that lives in `rn-app/app/(dev)/`,
`rn-app/src/__dev__/`, and the `dev-seed` + `seed-test-data` edge functions.

For local Supabase setup see [docs/local-dev.md](../local-dev.md).
For Maestro tests see [docs/testing/index.md](../testing/index.md).

## DevNavigator

A floating dev-only UI panel exposed in the app on dev/preview builds. Tree-shaken in production by `__DEV__` guard.

### Where it lives
```
rn-app/app/(dev)/
  _layout.tsx              # __DEV__-gated stack
  screen-picker.tsx        # Jump-to-screen UI
  critical-update-preview.tsx

rn-app/src/components/dev/
  DevNavigator.tsx         # The floating launcher
  ...
rn-app/src/__dev__/
  jumpToScreen.ts          # Backs the screen picker, calls dev-seed edge fn
```

### Features

| Feature | What it does |
|---|---|
| **Quick Login** | Hardcoded buttons for `+919999900001/002/003` with corresponding OTPs (`123456` / `654321` / `111111`). Skips real Twilio in dev. |
| **Mock toggles** | Per-feature toggles (dashboard / payments / waitlist / agreement / setup / profile) flip in-memory React Query cache to a preset state for screenshot work or Maestro flows. |
| **Scenario Picker** | Preset cache scenarios (e.g., "active tenant with overdue payment") that overlay multiple toggles at once. |
| **Screen Navigator** | Direct jump to any expo-router screen by route name — useful for designer reviews. |
| **Font scale override** | Forces large/small font scale to verify text doesn't truncate or overflow. |
| **Jump-to-State (via dev-seed)** | Calls the `dev-seed` edge fn to put the test phone into a target journey state (`signed_up | agreement_confirmed | waitlisted | approved | active`) plus optional payment-history state. |

### When DevNavigator is NOT available

- Production builds (`__DEV__ === false`)
- Any build where `EXPO_PUBLIC_USE_OTP_ROUTING=true` AND `ALLOW_DEMO_AUTH=false` on the backend (the demo OTPs won't work)
- Builds shipping to TestFlight Production (`production` profile)

It IS available on:
- Local `npx expo start`
- EAS development profile builds
- EAS preview profile builds (which point at prod backend, but DevNavigator UI still loads)

## seed-test-data edge function

`supabase/functions/seed-test-data/` — gated to test phones in the `+91999990XXXX` range.

### What it does
Creates or upserts a test user into a specific journey state, including:
- `auth.users` row + `public.users` row
- `extracted_rental_info` row at the appropriate extraction status
- `tenancies` row (active / pending_verification / etc.)
- `bank_accounts` (verified or not)
- `identity_verifications` (M360 success or pending)
- Optional `payments` history (for "active tenant with N successful payments" scenarios)
- Optional `cashback_ledger` rows

### How it's gated
- Service role auth required at the function level
- Phone must match `+91999990\d{4}` regex
- `ALLOW_DEMO_AUTH=true` must be set in supabase function secrets
- Body validates against a strict schema — junk inputs reject with 400

### Used by
- Apple Review (when an App Store reviewer needs to see specific journey states)
- Maestro CI (`docs/testing/index.md` references this)
- Manual debugging (rn-app DevNavigator's "Jump to state" UI)

## dev-seed edge function

`supabase/functions/dev-seed/` — thin proxy for the rn-app DevNavigator's "Jump to Screen" feature. Calls `seed-test-data` internally with simplified inputs.

### Difference from seed-test-data
- `seed-test-data`: full-featured, accepts any journey state + payment count + flags. Used by Apple Review and Maestro.
- `dev-seed`: simplified, takes just `{phone, target_state}`. Used by the in-app UI.

Both gate on `ALLOW_DEMO_AUTH=true` + service role.

## Test data hygiene

| Rule | Why |
|---|---|
| Never seed real PII into local Supabase | Local DB is isolated but if you `supabase db dump` and share, real data leaks |
| Test phones MUST match `+91999990\d{4}` | The seed function regex enforces this. Manual inserts that bypass the regex won't be cleaned up by the dev-only RLS policies |
| `ALLOW_DEMO_AUTH=false` in production | Verified per-environment. Setting this to true in prod allows the seed function to manipulate real users |
| The 3 seeded users in `seed.sql` are deleted + recreated on every `db reset` | If you customize a test user manually, save the SQL elsewhere |

## What's NOT here (yet)

- Mock service worker for offline RN testing — would be useful for Maestro `network-offline` flow
- A "scenario library" UI in DevNavigator beyond the 6 preset toggles — not yet built
- Per-component Storybook — not yet wired

These are tracked informally; raise a PR if you want to build any of them.
