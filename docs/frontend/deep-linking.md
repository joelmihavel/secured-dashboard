# Deep Linking

> **Last reviewed:** 2026-04-25

The rn-app supports two link types: a **custom scheme** (`flentsecured://`)
for in-app links + Maestro tests, and **iOS universal links + Android app
links** (`https://app.flent.in/...`) for SMS/email/web sources that need
to fall back gracefully if the app isn't installed.

## Configured surfaces

### Custom scheme — `flentsecured://`

Defined in `rn-app/app.json`:
```json
{ "expo": { "scheme": "flentsecured", ... } }
```

Used by:
- Maestro flows that launch directly into a screen via `launchApp.arguments.url`
- Internal app navigation when an external link arrives via `Linking.openURL`
- DevNavigator's "Jump to Screen" feature

Limitation: only works on dev/preview/production native builds. **Doesn't work in Expo Go** — use deep-link routes only after `npx expo run:ios` builds the dev client.

### iOS universal links — `applinks:app.flent.in`

`rn-app/app.json` → `ios.associatedDomains`:
```json
"associatedDomains": ["applinks:app.flent.in"]
```

Apple validates this by fetching `https://app.flent.in/.well-known/apple-app-site-association` (AASA file) and verifying the bundle ID + path matches before opening the app. The AASA file lives somewhere outside this repo (server-side static hosting). If AASA validation fails, links open in Safari, not the app.

### Android app links — intent filter on `https://app.flent.in/`

`rn-app/app.json` → `android.intentFilters`:
```json
{
  "action": "VIEW",
  "autoVerify": true,
  "data": [{ "scheme": "https", "host": "app.flent.in", "pathPrefix": "/" }],
  "category": ["BROWSABLE", "DEFAULT"]
}
```

Verified by fetching `https://app.flent.in/.well-known/assetlinks.json`. Same AASA-equivalent for Android.

## Route conventions

The app uses expo-router (file-based routing under `rn-app/app/`). Deep links map directly to route paths:

| URL | Routes to |
|---|---|
| `flentsecured://` or `https://app.flent.in/` | Root → journey-aware redirect (signed-out → auth, signed-in → main) |
| `flentsecured://(auth)/login-otp` | OTP login screen |
| `flentsecured://(agreement)/upload` | Agreement upload screen |
| `flentsecured://(payment)/enter-rent` | Payment amount entry |
| `flentsecured://(payment)/status?orderId=xxx` | Payment status with query param |
| `flentsecured://(profile)` | Profile main |
| `flentsecured://(dev)/screen-picker` | DevNavigator screen picker (dev only) |

Route groups in parentheses (`(auth)`, `(main)`, etc.) are organizational — they don't appear in the URL. So `flentsecured://login-otp` works AND `flentsecured://(auth)/login-otp` works (latter is more explicit).

## Maestro pattern

Per [docs/testing/index.md](../testing/index.md), Maestro flows can launch directly into a target screen, skipping the journey-router redirect:

```yaml
appId: in.flent.secured
---
- launchApp:
    arguments:
      url: flentsecured://payment/enter-rent
- assertVisible: "Enter rent amount"
```

This is faster than navigating from the auth screen, and isolates the test to the screen-under-test rather than its dependencies. Use deep-link entry for screen-flow tests; use full navigation for journey tests.

## When deep links bring up the wrong screen

The journey router (`rn-app/app/index.tsx` — see `docs/frontend/screens-and-routing.md`) intercepts every route resolution. If a deep link tries to take an unauthenticated user to `(payment)/enter-rent`, the router redirects them to `(auth)/login-otp` first. Same for users in early funnel states being deep-linked to active-state screens — they get redirected to their actual current state.

This is intentional, not a bug. To test a screen in its actual rendered state regardless of auth, use the `(dev)/screen-picker` UI which bypasses the router (dev builds only).

## Source-of-truth file paths

- Scheme: `rn-app/app.json` line 8 (`scheme: "flentsecured"`)
- iOS associated domains: `rn-app/app.json` line 28-30
- Android intent filter: `rn-app/app.json` line 128-144
- Universal-link host: `app.flent.in` (DNS managed via Cloudflare)
- AASA + assetlinks.json: external, not in this repo
- Journey router: `rn-app/app/index.tsx`

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Custom scheme doesn't open app | Expo Go doesn't register schemes | Use a dev-client build (`npx expo run:ios`) |
| Universal link opens Safari instead | AASA file unreachable or misconfigured | Verify `curl https://app.flent.in/.well-known/apple-app-site-association` returns valid JSON |
| Android link opens browser | assetlinks.json missing | Verify `curl https://app.flent.in/.well-known/assetlinks.json` |
| Maestro `launchApp` with URL hangs | Deep link arrives before app is fully booted | Add `extendedWaitUntil` after `launchApp` |
| Deep link goes to wrong screen | Journey router intercepted | Either accept it (testing journey behavior) or use `(dev)/screen-picker` to bypass |
