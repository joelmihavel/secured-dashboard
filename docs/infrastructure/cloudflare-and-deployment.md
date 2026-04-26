# Infrastructure: Cloudflare, EAS, Supabase, and Admin Scripts

<!-- STALE-WARNING -->
> ⚠️ **Pre-cleanup-arc doc.** This page was last refreshed before the 2026-04-25/26 cleanup batch (DocAI residency flip, per-service SA migration, Phase 8c audit_logs immutability, Cashfree settlement webhook secret separation, Easy Split → Vendor Adjustments rename, etc.). Specific examples and counts may not match current state. The dated header below reflects when the file was originally written, NOT the current cleanup state. Cross-check against code before relying on details.

> Deployment and infrastructure documentation for Flent Secured.
>
> Last verified: 2026-03-08 from source code inspection.

---

## 1. Cloudflare Worker Proxy

### Purpose

Indian ISPs (Jio, Airtel) periodically DNS-block `*.supabase.co`, causing 522 timeouts for all Supabase API calls. The Cloudflare Worker acts as a transparent HTTP reverse proxy on a custom domain that is not blocked.

### Architecture

```
RN App (devapi.flent.in)  -->  Cloudflare Worker  -->  zqlowjveyqiagnbmfwsb.supabase.co
                                (edge, <1ms added)
```

### Worker Source

**Location:** `cloudflare-worker/src/index.ts`

The worker is a single-file Cloudflare Worker that handles three request types:

**1. CORS Preflight (OPTIONS)**

Returns `204 No Content` with permissive CORS headers. The following custom headers are allowed:
- `authorization`, `x-client-info`, `apikey`, `content-type`
- `x-idempotency-key`, `x-request-id`, `x-admin-key`

CORS max-age is set to 86400 seconds (24 hours).

**2. WebSocket Upgrade**

For Supabase Realtime connections:
- Detects `Upgrade: websocket` header
- Fetches upstream with upgrade headers
- Creates a `WebSocketPair` and bridges messages bidirectionally
- Returns `101 Switching Protocols`

Note: WebSocket proxying between two Cloudflare zones can fail with Error 1101. All realtime features have HTTP polling fallbacks. This is an accepted limitation.

**3. Regular HTTP Requests**

- Rewrites `url.hostname` to `env.SUPABASE_HOST`
- Forwards all headers except `cf-*` internals and `host`
- Passes through `request.body` and `request.method`
- Injects correct `Access-Control-Allow-Origin` matching the request origin
- Sets `Access-Control-Allow-Credentials: true`

### Configuration

**File:** `cloudflare-worker/wrangler.toml`

```toml
name = "supabase-proxy"
main = "src/index.ts"
compatibility_date = "2024-12-01"

routes = [
  { pattern = "devapi.flent.in/*", zone_name = "flent.in" }
]

[vars]
SUPABASE_HOST = "zqlowjveyqiagnbmfwsb.supabase.co"
```

### DNS Setup

- **Domain:** `devapi.flent.in`
- **Cloudflare DNS:** CNAME record, proxied (orange cloud ON -- required for Worker route interception)
- **Cloudflare Account:** Flent (`rishabh@flent.in`), Workers Paid plan ($5/mo, unlimited requests)

### Deployment

```bash
cd cloudflare-worker
npx wrangler deploy
```

Wrangler is authenticated via OAuth (run `npx wrangler login` on first use).

### App Configuration

The RN app connects through the proxy via a single environment variable:

**File:** `rn-app/.env`
```
EXPO_PUBLIC_SUPABASE_URL=https://devapi.flent.in
```

Zero app code changes were needed. All Supabase SDK calls use this env var.

### What Goes Through the Proxy

| Traffic Type | Routes Through Proxy | Notes |
|---|---|---|
| Supabase REST API | Yes | All PostgREST queries |
| Supabase Edge Functions | Yes | All `callEdgeFunction` calls |
| Supabase Auth | Yes | OTP, session management |
| Supabase Storage | Yes | Agreement uploads |
| Supabase Realtime (HTTP) | Yes | Polling fallbacks |
| Supabase Realtime (WS) | Attempted | May fail between CF zones |
| PayU Webhooks | No | Server-to-server, uses `SUPABASE_URL` env on edge functions |
| OTA Updates | No | Served from Expo CDN |

### Backward Compatibility

Users on direct `supabase.co` URL still work when ISP is not blocking. The proxy only matters for blocked networks.

---

## 2. EAS Build and Deployment

### Project Identity

| Property | Value |
|---|---|
| EAS Project ID | `76348d87-1f03-489a-a606-9d7bab4acd66` |
| EAS Account | `rishabhatflent` |
| Bundle ID | `in.flent.secured` |
| App Store Connect App ID | `6757275258` |

### Build Profiles

Defined in `rn-app/eas.json`:

| Profile | Distribution | Channel | Simulator | Auto-Increment | Notes |
|---------|-------------|---------|-----------|----------------|-------|
| `development` | internal | `development` | Yes (iOS) | No | For iOS Simulator testing |
| `development:device` | internal | `development` | No | No | For physical device dev builds |
| `preview` | internal | `preview` | No | Yes | Ad Hoc distribution for internal testing |
| `production` | -- | `production` | No | Yes | App Store / Production |

All non-production profiles set `SENTRY_DISABLE_AUTO_UPLOAD=true`.

### Build Commands

```bash
# Development (simulator)
cd rn-app
eas build --profile development --platform ios

# Development (physical device)
eas build --profile development:device --platform ios

# Preview (Ad Hoc, internal testers)
eas build --profile preview --platform ios

# Production
eas build --profile production --platform ios
```

### OTA Updates

JavaScript-only changes can be deployed without a new binary build:

```bash
cd rn-app
eas update --channel preview --message "description of changes"
```

OTA updates are served from Expo CDN and are unaffected by the Supabase proxy or ISP blocks.

### App Store Submission

```bash
cd rn-app
eas submit --platform ios --profile production
```

Uses ASC API key at `/Users/atrishabh/Documents/Dev/iOS APN Keys/App Store Connect Key/AuthKey_P8AM5FW523.p8`.

### EAS Secrets

The following secrets are set in EAS and injected at build time:

| Secret | Purpose |
|--------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API endpoint (proxy URL) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/publishable key |
| `EXPO_PUBLIC_PAYU_KEY` | PayU merchant key |

### Known Build Issues

**Spaces in project path:** The project lives at `Secured v2-react-native project` (with spaces). This breaks several build tools. Fixed via `patch-package`:

- `patches/expo-constants+18.0.13.patch`: Quotes `$PODS_TARGET_SRCROOT` in podspec and `$PROJECT_DIR` in `get-app-config-ios.sh`. This was the root cause of 20+ release crashes.
- After `expo prebuild --clean`, must also fix:
  - `ios/FlentSecured.xcodeproj/project.pbxproj`: Replace backtick RN bundle script
  - `ios/.xcode.env.local`: Add `export SENTRY_DISABLE_AUTO_UPLOAD=true`

### Local Build Commands

```bash
# Prebuild native directories
cd rn-app
npx expo prebuild --clean

# Simulator build
xcodebuild -workspace ios/FlentSecured.xcworkspace \
  -scheme FlentSecured \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build

# Physical device release build
xcodebuild -workspace ios/FlentSecured.xcworkspace \
  -scheme FlentSecured \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=H84887VH7U \
  CODE_SIGN_IDENTITY="Apple Development" \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGNING_ALLOWED=YES \
  build
```

---

## 3. Supabase Deployment

### Project Details

| Property | Value |
|---|---|
| Project ID | `zqlowjveyqiagnbmfwsb` |
| URL | `https://zqlowjveyqiagnbmfwsb.supabase.co` |
| Region | `ap-south-1` (Mumbai, India) |
| Proxy URL | `https://devapi.flent.in` |

### Edge Function Deployment

Deploy a single function:

```bash
supabase functions deploy <function-name> --project-ref zqlowjveyqiagnbmfwsb
```

Deploy all functions:

```bash
supabase functions deploy --project-ref zqlowjveyqiagnbmfwsb
```

Edge function source files are at `supabase/functions/<name>/index.ts`. Shared utilities live in `supabase/functions/_shared/`:

| Shared Module | Purpose |
|---|---|
| `cors.ts` | CORS headers for edge function responses |
| `gemini.ts` | Gemini AI client for extraction and matching |
| `notifications.ts` | Push notification and in-app notification helpers |
| `supabase.ts` | Supabase admin client (service role) for edge functions |

### Database Migrations

Push migrations to production:

```bash
supabase db push --project-ref zqlowjveyqiagnbmfwsb
```

Migration files are at `supabase/migrations/`. Recent migrations include:

| Migration | Purpose |
|---|---|
| `20260305130001_add_bank_details_to_user_funnel.sql` | Bank details columns on user funnel |
| `20260306000001_add_extraction_recovery_cron.sql` | Cron job for retrying failed extractions |
| `20260307000001_security_hardening.sql` | RLS policies and security improvements |
| `20260308000001_migrate_cron_keys_to_vault.sql` | Move API keys to Supabase Vault |
| `20260308000002_auto_activate_tenancy_on_landlord_approval.sql` | Auto-activate tenancy when landlord approves |

### Service Role Key Retrieval

```bash
supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb
```

This prints both the `anon` (publishable) and `service_role` keys.

---

## 4. Admin Scripts

### Google Apps Script (Admin Dashboard Auto-Sync)

**Location:** `scripts/apps-script/Code.js`

A Google Apps Script that auto-syncs Supabase data to a Google Sheet every 10 minutes. Features:

- Fetches data from the `admin-fetch-views` edge function using service role key
- Formats sheets with McKinsey-grade styling: color-coded statuses, conditional formatting
- Embedded KPI formulas and charts
- Converts UTC timestamps to IST (UTC+5:30) for display

**Configuration:**
- Supabase URL: `https://zqlowjveyqiagnbmfwsb.supabase.co`
- Keys stored in Google Apps Script Properties (never hardcoded)
- Bootstrap function `_bootstrap()` verifies keys are set

**Deployment:**
- Uses `clasp` (Google Apps Script CLI)
- Config at `scripts/apps-script/.clasp.json` and `scripts/apps-script/appsscript.json`

### create-admin-sheet.py

**Location:** `scripts/create-admin-sheet.py`

Python script that creates the Admin Dashboard Google Sheet, deploys the Apps Script, and runs the first sync.

- Uses `gspread` OAuth credentials
- Authenticates via `~/.config/gspread/authorized_user.json`
- Creates sheet structure via Google Sheets API
- Pushes Apps Script code via Google Apps Script API

### deploy-apps-script.py

**Location:** `scripts/deploy-apps-script.py`

Deploys the Apps Script to an existing Google Sheet.

- Re-authenticates with `script.projects` OAuth scope
- Retrieves Supabase service key via CLI
- Pushes updated Code.js content to the Apps Script project
- Target sheet ID: `114HbdCPKcFZvU5iFt8OWSXlKpJ6O8rEQVKInOA5jcIo`

Run from terminal:

```bash
python3 scripts/deploy-apps-script.py
```

Browser opens for Google OAuth authorization on first run.

### format-admin-sheet.py

**Location:** `scripts/format-admin-sheet.py`

Applies additional formatting to the Admin Dashboard sheet:

- Adds a Status Legend tab with status mappings
- Adds M360 tab for Cashfree identity verification data
- Applies conditional formatting (color-coded statuses)
- Enhances formatting across all tabs

### approve-waitlist-user.sh

**Location:** `scripts/approve-waitlist-user.sh`

Shell script to manually approve a user on the waitlist via the admin API.

---

## 5. Key Infrastructure Notes

### Network Resilience

- **ISP DNS blocks:** Solved by Cloudflare Worker proxy on `devapi.flent.in`
- **Never use Supabase custom domains:** Routing never propagated (`sb-project-ref: null`). The Worker approach is instant and reliable.
- **CF orange cloud proxy must be ON** for Worker route interception
- **WebSocket between CF zones is impossible** (Error 1101). Realtime features use HTTP polling fallbacks.

### Payment Infrastructure

- **PayU webhooks are server-to-server:** Edge function `SUPABASE_URL` env var points to direct Supabase URL (not the proxy). Webhooks are unaffected by ISP blocks.
- **PayU Custom Browser SDK uses JS form submission:** WKWebView drops `httpBody` on POST. The SDK parses `post_data`, creates JS form inputs, and auto-submits. Always use `encodeURIComponent` (gives `%20`) for spaces, never `+`.
- **PayU hash validation:** All hash computation happens server-side in the `initiate-payment` edge function.

### Build Path Workarounds

The project path contains spaces (`Secured v2-react-native project`). This requires:
- `patch-package` patches for `expo-constants` (auto-applied by postinstall)
- Manual fixes to `project.pbxproj` and `.xcode.env.local` after `expo prebuild --clean`

### Sentry

Currently disabled in build. `@sentry/react-native/expo` plugin removed from `app.json`, `Sentry = null` in `sentry.ts`. To re-enable, restore the plugin config and verify compatibility with the current RN version.

### Review Mode

The app has a review mode for App Store review. Activated by specific phone numbers (`isReviewPhone()`). In review mode:
- No real Supabase session is created
- OTP is validated locally with a fixed code
- AuthProvider treats `isReviewMode()` as authenticated
- All API calls return mock data
- Deactivated on sign-out
