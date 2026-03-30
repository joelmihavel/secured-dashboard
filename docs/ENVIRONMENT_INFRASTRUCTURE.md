# Environment Infrastructure — Flent Secured

> Last updated: 2026-03-31 (v2.2.0 production release)

## Architecture Overview

```
Git Branch: dev    ──► EAS Development Build ──► Supabase Branch (v2-backend-dev)
Git Branch: dev    ──► EAS Preview Build     ──► Supabase Main (production)
Git Branch: main   ──► EAS Production Build  ──► Supabase Main (production)
```

| Layer | Development | Preview | Production |
|-------|------------|---------|------------|
| **Git branch** | `dev` | `dev` | `main` |
| **EAS profile** | `development` | `preview` | `production` |
| **EAS channel** | `development` | `preview` | `production` |
| **Supabase backend** | Branch (`zqlowjveyqiagnbmfwsb`) | Main (`uowjtrzmszuaiokqxgir`) | Main (`uowjtrzmszuaiokqxgir`) |
| **Backend URL** | `https://zqlowjveyqiagnbmfwsb.supabase.co` | `https://api-secured.flent.in` | `https://api-secured.flent.in` |
| **Cashfree mode** | SANDBOX | PRODUCTION | PRODUCTION |
| **Payment gateway** | Cashfree | Cashfree | Cashfree |

## EAS Environment Variables

Set via `eas env:create <environment>` or expo.dev dashboard.

### Development (→ Supabase branch / sandbox payments)
```
EXPO_PUBLIC_SUPABASE_URL       = https://zqlowjveyqiagnbmfwsb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY  = sb_publishable_Euh6wOeHbdsc4Y0aBq3l7g_3-FPkaut
EXPO_PUBLIC_PAYMENT_GATEWAY    = cashfree
EXPO_PUBLIC_CASHFREE_ENV       = SANDBOX
EXPO_PUBLIC_PAYU_KEY           = PLycrf
EXPO_PUBLIC_USE_OTP_ROUTING    = true
```

### Preview (→ production backend / real payments)
```
EXPO_PUBLIC_SUPABASE_URL       = https://api-secured.flent.in
EXPO_PUBLIC_SUPABASE_ANON_KEY  = sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x
EXPO_PUBLIC_PAYMENT_GATEWAY    = cashfree
EXPO_PUBLIC_CASHFREE_ENV       = PRODUCTION
EXPO_PUBLIC_PAYU_KEY           = PLycrf
EXPO_PUBLIC_USE_OTP_ROUTING    = true
```

### Production (→ production backend / real payments)
```
EXPO_PUBLIC_SUPABASE_URL       = https://api-secured.flent.in
EXPO_PUBLIC_SUPABASE_ANON_KEY  = sb_publishable_c80tL8IG3x46DQhLQ7WKfg_QUgIMI2x
EXPO_PUBLIC_PAYMENT_GATEWAY    = cashfree
EXPO_PUBLIC_CASHFREE_ENV       = PRODUCTION
EXPO_PUBLIC_PAYU_KEY           = PLycrf
EXPO_PUBLIC_USE_OTP_ROUTING    = true
```

### Local Development (.env file)
The `.env` file in `rn-app/` is for `npx expo start` only. It points to the dev branch:
```
EXPO_PUBLIC_SUPABASE_URL=https://zqlowjveyqiagnbmfwsb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Euh6wOeHbdsc4Y0aBq3l7g_3-FPkaut
EXPO_PUBLIC_PAYMENT_GATEWAY=cashfree
EXPO_PUBLIC_CASHFREE_ENV=SANDBOX
EXPO_PUBLIC_USE_OTP_ROUTING=true
```

### IMPORTANT: .env vs EAS Dashboard
- **Local dev** (`npx expo start`): reads `.env` file
- **EAS cloud builds** (`eas build`): reads EAS dashboard env vars ONLY (`.env` excluded via `.easignore`)
- **OTA updates** (`eas update`): reads env vars from the machine running the command (local `.env` or system env)
- **Rule**: Never rely on `.env` for builds. Always set vars on the EAS dashboard.

## Supabase Projects

| | Main (Production) | Branch (Dev) |
|---|---|---|
| **Project ref** | `uowjtrzmszuaiokqxgir` | `zqlowjveyqiagnbmfwsb` |
| **Custom domain** | `api-secured.flent.in` | N/A |
| **Direct URL** | `uowjtrzmszuaiokqxgir.supabase.co` | `zqlowjveyqiagnbmfwsb.supabase.co` |
| **Region** | `ap-south-1` (Mumbai) | Same |

### Custom Domain
Production uses `https://api-secured.flent.in` as a custom domain for `uowjtrzmszuaiokqxgir.supabase.co`. This avoids Indian ISP DNS blocks on `*.supabase.co`.

## Phone Number Format Architecture

**Two formats exist by design** — do NOT unify them.

| Table | Format | Example | Used By |
|-------|--------|---------|---------|
| `auth.users.phone` | No `+` prefix | `919099926845` | GoTrue internal lookup |
| `auth.identities.phone` | No `+` prefix | `919099926845` | GoTrue identity matching |
| `public.users.phone` | With `+` prefix | `+919099926845` | App code, edge functions |

**Why**: GoTrue's `/otp` endpoint strips `+` before looking up `auth.users.phone`. If auth.users has `+`, GoTrue can't find the user → tries INSERT → duplicate key error.

The `sync_phone_columns` trigger on `public.users` syncs `phone_number → phone` WITHOUT adding `+`.
Edge functions use `normalizePhoneE164()` (adds `+`) for app-facing operations.

## Secret Management

### Supabase Edge Function Secrets
Set via `supabase secrets set KEY=value --project-ref <ref>`.

**Cashfree Secured ID / M360** (identity verification, OTP):
- `CASHFREE_APP_ID` — Verification API client ID (PRODUCTION)
- `CASHFREE_SECRET_KEY` — Verification API secret (PRODUCTION)
- `CASHFREE_BASE_URL` — `https://api.cashfree.com/verification` (PRODUCTION)
- `CASHFREE_PUBLIC_KEY` — RSA public key for x-cf-signature

**Cashfree PG** (payments, Easy Split, settlements):
- `CASHFREE_PG_APP_ID` — PG client ID (PRODUCTION)
- `CASHFREE_PG_APP_SECRET` — PG secret (PRODUCTION) — also used for webhook signature verification
- `CASHFREE_PG_BASE_URL` — `https://api.cashfree.com/pg` (PRODUCTION)

**Other services**:
- `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT` — PayU (legacy fallback)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — OTP delivery
- `GCP_PROJECT_ID`, `GOOGLE_API_KEY`, `GEMINI_API_KEY` — Document AI + Gemini
- `API_CLUB_KEY` — Utility verification
- `ADMIN_API_KEY` — Admin endpoint auth
- `ENCRYPTION_KEY` — Bank account encryption
- `ENVIRONMENT` — `production` on main (controls CORS origin list)

### Auto-injected (branch-specific, never set manually)
- `SUPABASE_URL` — branch/main URL
- `SUPABASE_ANON_KEY` — branch/main anon key
- `SUPABASE_SERVICE_ROLE_KEY` — opaque `sb_secret_*` key

### Cashfree Webhooks (registered in merchant dashboard)
| Webhook | URL | Events |
|---------|-----|--------|
| Payment | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/payment-webhook` | PAYMENT_SUCCESS, PAYMENT_FAILED, REFUND_STATUS_WEBHOOK |
| Easy Split Settlement | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-split-webhook` | VENDOR_SETTLEMENT_SUCCESS/FAILED/REVERSED |
| Vendor Status | `https://uowjtrzmszuaiokqxgir.supabase.co/functions/v1/cashfree-vendor-webhook` | VENDOR_STATUS_UPDATE |

All webhooks use PG App Secret for HMAC-SHA256 signature verification. API version: `2025-01-01`.

## Deployment Workflows

### Dev (local testing + branch backend)
```bash
cd "Secured v2-react-native project"

# Deploy edge functions to branch
supabase functions deploy --project-ref zqlowjveyqiagnbmfwsb

# Push DB migrations to branch
supabase link --project-ref zqlowjveyqiagnbmfwsb
supabase db push

# Build development app
cd rn-app && eas build --profile development --platform ios

# OTA update (dev channel)
cd rn-app && eas update --channel development --message "description"
```

### Preview (internal testing against production backend)
```bash
cd rn-app && eas build --profile preview --platform ios
cd rn-app && eas update --channel preview --message "description"
```

### Production Release
```bash
cd "Secured v2-react-native project"

# 1. Merge dev → release branch → main
git checkout -b release/vX.Y.Z
git checkout main && git merge release/vX.Y.Z --no-ff

# 2. Deploy backend to production
supabase link --project-ref uowjtrzmszuaiokqxgir
supabase db push                    # migrations
supabase functions deploy --project-ref uowjtrzmszuaiokqxgir  # edge functions

# 3. Re-link to dev (prevent accidental prod pushes)
supabase link --project-ref zqlowjveyqiagnbmfwsb

# 4. Build + submit
cd rn-app && eas build --profile production --platform ios
cd rn-app && eas submit --platform ios --profile production

# 5. OTA update (JS-only hotfixes)
cd rn-app && eas update --channel production --message "description"

# 6. Sync main back to dev
git checkout dev && git merge main && git push origin dev
```

## Supabase Branching

Supabase Branching creates **isolated environments** within the same project:

- **Each branch gets its own project ref and URL**
- **Auth is branch-scoped** — same phone on branch ≠ same user on main
- **JWTs contain the branch ref** — routes edge function calls to the correct branch
- **Secrets are inherited** from main project; auto-injected vars are branch-specific
- **Edge functions are deployed per branch**

### JWT Ref Routing
The Supabase gateway routes requests based on the `ref` claim in the JWT:
- JWT from main auth → routes to main edge functions
- JWT from branch auth → routes to branch edge functions
- **Stale session from wrong branch → "Requested function was not found"**
- **Fix**: Sign out and sign back in to get a fresh JWT

## Edge Function Auth Pattern

All functions use `verify_jwt = false` because Supabase issues ES256 JWTs but the gateway only verifies HS256. Auth is validated in function code:

```typescript
const authHeader = req.headers.get("Authorization");
const { userId, user } = await createAuthenticatedClient(authHeader);
```

The `createAuthenticatedClient()` function in `_shared/supabase.ts`:
1. Decodes the JWT
2. Checks `revoked_tokens` table for blacklisted sessions
3. Creates a Supabase client scoped to the user
4. Returns userId and user metadata

## Common Issues

### "Requested function was not found"
- **Cause**: JWT ref doesn't match the branch where the function is deployed
- **Fix**: Sign out and sign back in

### "Unauthorized - service role required"
- **Cause**: Passing legacy JWT instead of opaque `sb_secret_*` key
- **Fix**: Use `Authorization: Bearer <sb_secret_key>`

### "Something went wrong" on sign-up
- **Cause**: Orphaned `public.users` row (no FK cascade from auth.users)
- **Fix**: Delete from BOTH `public.users` AND `auth.users`

### OTA not applying
- **Cause**: Needs 2 app restarts
- **Fix**: Force close → reopen → force close → reopen

### MIGRATIONS_FAILED branch status
- **Cause**: Migration history out of sync
- **Fix**: `supabase migration repair --status applied <version>` or `--status reverted`
