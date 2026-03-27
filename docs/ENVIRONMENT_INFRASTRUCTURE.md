# Environment Infrastructure — Flent Secured

> Last updated: 2026-03-27

## Architecture Overview

```
Git Branch: dev-cashfreeSDK ──► EAS Preview Build ──► Supabase Branch (v2-backend-dev)
Git Branch: main            ──► EAS Production Build ──► Supabase Main
```

| Layer | Dev / Preview | Production |
|-------|--------------|------------|
| **Git branch** | `dev-cashfreeSDK` | `main` |
| **EAS channel** | `preview` | `production` |
| **EAS environment** | `preview` / `development` | `production` |
| **Supabase project** | `uowjtrzmszuaiokqxgir` (same project) | `uowjtrzmszuaiokqxgir` (same project) |
| **Supabase branch** | `v2-backend-dev` (ref: `zqlowjveyqiagnbmfwsb`) | `main` (ref: `uowjtrzmszuaiokqxgir`) |
| **URL** | `https://zqlowjveyqiagnbmfwsb.supabase.co` | `https://uowjtrzmszuaiokqxgir.supabase.co` |
| **Auth** | Separate auth system (branch-scoped) | Production auth |
| **Payment gateway** | Cashfree (via `initiate-cashfree-payment`) | PayU (via `initiate-payment`) |

## Critical: How Supabase Branching Works

Supabase Branching creates **isolated environments** within the same project:

- **Each branch gets its own project ref and URL** — the branch ref (`zqlowjveyqiagnbmfwsb`) is different from main (`uowjtrzmszuaiokqxgir`)
- **Auth is branch-scoped** — a user on the branch is a different auth user than the same phone on main. They have different UUIDs and sessions.
- **JWTs contain the branch ref** — a JWT from branch auth has `ref: zqlowjveyqiagnbmfwsb`. This is used by the Supabase gateway to route edge function calls.
- **Secrets are inherited** — branch inherits all secrets from the main project. Auto-injected vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are branch-specific.
- **Edge functions are deployed per branch** — `supabase functions deploy --project-ref <branch-ref>` deploys to that branch only.

### Why JWT Ref Routing Matters

The Supabase edge function gateway routes requests based on the `ref` claim in the `Authorization` JWT:
- If a user signed in on **main** (ref: `uowjtrzmszuaiokqxgir`), their JWT routes calls to main — even if the URL is the branch URL.
- If a user signed in on the **branch** (ref: `zqlowjveyqiagnbmfwsb`), their JWT routes calls to the branch.

**This means**: the app MUST sign in against the correct branch URL. A stale session from a different branch will cause "Requested function was not found" errors because the gateway routes to the wrong branch.

**Fix**: When switching environments, users must sign out and sign back in to get a fresh JWT matching the current branch.

## EAS Environment Variables

Set via `eas env:create` or the EAS dashboard (expo.dev > Project > Environment Variables).

### Preview / Development (→ Supabase branch)
```
EXPO_PUBLIC_SUPABASE_URL = https://zqlowjveyqiagnbmfwsb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY = eyJhbG...zqlowjveyqiagnbmfwsb... (branch anon JWT)
EXPO_PUBLIC_CASHFREE_ENV = PRODUCTION
EXPO_PUBLIC_PAYU_KEY = PLycrf
EXPO_PUBLIC_USE_OTP_ROUTING = true
```

### Production (→ Supabase main)
```
EXPO_PUBLIC_SUPABASE_URL = https://uowjtrzmszuaiokqxgir.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x (opaque key)
EXPO_PUBLIC_CASHFREE_ENV = PRODUCTION
EXPO_PUBLIC_PAYU_KEY = PLycrf
EXPO_PUBLIC_USE_OTP_ROUTING = true
```

### Local Development (.env file)
The `.env` file in `rn-app/` points to the **branch** for local `npx expo start`:
```
EXPO_PUBLIC_SUPABASE_URL=https://zqlowjveyqiagnbmfwsb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<branch-anon-jwt>
```

## Secret Management

### Supabase Secrets (inherited by branches)
All external API secrets are set on the **main project** and automatically inherited by branches:
- `CASHFREE_PG_APP_ID`, `CASHFREE_PG_APP_SECRET`, `CASHFREE_PG_BASE_URL` — Production Cashfree keys (same for dev testing)
- `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, etc. — PayU keys
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, etc. — OTP service

### Auto-injected (branch-specific)
These are automatically set by Supabase per branch — never set manually:
- `SUPABASE_URL` — branch URL
- `SUPABASE_ANON_KEY` — branch anon key
- `SUPABASE_SERVICE_ROLE_KEY` — opaque key (`sb_secret_*` format on new projects)

### Opaque Keys
This project uses Supabase's new opaque key format:
- **Publishable key**: `sb_publishable_*` (used as anon key in production)
- **Secret key**: `sb_secret_*` (used as service role key in edge functions)

The `verifyServiceRole()` function in `_shared/supabase.ts` compares against `Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`. When calling service-role-protected functions, use:
```bash
curl -H "Authorization: Bearer sb_secret_<key>" ...
```

For the branch: `sb_secret_F9RFPyanPWbSHy5cjBEpaA_gjonTXGE`

## Deployment Workflows

### Dev / Preview (Cashfree testing)
```bash
# 1. Deploy edge functions to branch
cd "Secured v2-react-native project"
supabase functions deploy --project-ref zqlowjveyqiagnbmfwsb

# 2. Deploy single function
supabase functions deploy initiate-cashfree-payment --project-ref zqlowjveyqiagnbmfwsb --no-verify-jwt

# 3. Push DB migrations to branch
supabase db push  # (linked to main, applies to branch via migration files)

# 4. Build preview app
cd rn-app && eas build --profile preview --platform ios

# 5. OTA update (JS-only changes)
cd rn-app && eas update --channel preview --message "description"
```

### Production (PayU)
```bash
# 1. Deploy edge functions to main
supabase functions deploy --project-ref uowjtrzmszuaiokqxgir

# 2. Push DB migrations to production
supabase db push  # linked project

# 3. Build production app
cd rn-app && eas build --profile production --platform ios

# 4. Submit to App Store
cd rn-app && eas submit --platform ios --profile production

# 5. OTA update
cd rn-app && eas update --channel production --message "description"
```

### Cashfree → Production Migration (when ready)
1. Push `20260326000003_cashfree_migration.sql` to main: move it back from local-only
2. Deploy `initiate-cashfree-payment` to main: `supabase functions deploy initiate-cashfree-payment --project-ref uowjtrzmszuaiokqxgir --no-verify-jwt`
3. Update `payment/index.ts`: change `useCashfree` to config-driven or DB flag
4. Update EAS production env if needed
5. Build + submit production app

## Edge Function Auth Pattern

All functions use `verify_jwt = false` in `config.toml` because Supabase issues ES256 user JWTs but the gateway only verifies HS256. Auth is validated in function code:

```typescript
// Standard pattern — used by all authenticated functions
const authHeader = req.headers.get("Authorization");
const { userId, user } = await createAuthenticatedClient(authHeader);
```

The gateway still reads the JWT `ref` claim for routing — it just skips signature verification.

## Same User on Both Environments

The same phone number (e.g., `9099926845`) can be signed in on both:
- **Preview app** → authenticated against branch auth → separate user UUID
- **Production app** → authenticated against main auth → different user UUID

They are completely independent auth sessions. No cross-contamination.

## Common Issues

### "Requested function was not found"
- **Cause**: JWT ref doesn't match the branch where the function is deployed
- **Fix**: Sign out and sign back in to get a fresh JWT for the current branch

### "Unauthorized - service role required"
- **Cause**: Passing legacy JWT instead of opaque `sb_secret_*` key
- **Fix**: Use `Authorization: Bearer sb_secret_F9RFPyanPWbSHy5cjBEpaA_gjonTXGE`

### OTA not applying
- **Cause**: Needs 2 app restarts (1st downloads, 2nd applies)
- **Fix**: Force close → reopen → force close → reopen

### MIGRATIONS_FAILED branch status
- **Cause**: Migration history out of sync (manual SQL applied without migration file)
- **Fix**: `supabase migration repair --status applied <version>` or `--status reverted`
