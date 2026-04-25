# Supabase Projects

> **Last reviewed:** 2026-04-25

Cross-reference for the two Supabase projects + how they relate.
For env vars, deploy commands, and edge function patterns see
[docs/ENVIRONMENT_INFRASTRUCTURE.md](../ENVIRONMENT_INFRASTRUCTURE.md).

## Project inventory

| Project | Ref | Custom domain | Region | Branch in main project | Purpose |
|---|---|---|---|---|---|
| **Flent Secured (prod)** | `uowjtrzmszuaiokqxgir` | `api-secured.flent.in` | `ap-south-1` (Mumbai) | n/a (this IS the parent) | Production. Real users, real money. |
| **v2-backend-dev (preview branch)** | `zqlowjveyqiagnbmfwsb` | none | same as parent | branch of `Flent Secured` | Dev environment. Test users only. |

Both projects share:
- Schema (kept in sync via `supabase/migrations/`)
- Edge functions (deployed independently to each via `supabase functions deploy --project-ref`)
- Storage bucket structure (avatars, rent-agreements, whatsapp-assets)
- Cron jobs (19 jobs aligned across both as of 2026-04-25)

But they have:
- Independent auth (a phone signed up on dev is NOT signed up on prod)
- Independent function secrets (`supabase secrets set --project-ref`)
- Independent JWTs — JWTs from one project don't validate against the other
- Independent edge function logs

## Why a Supabase Branch (not just a separate project)

Supabase Branching creates a preview environment within the parent's billing + dashboard. The dev branch:
- Inherits secrets from the parent (initial values, then diverges)
- Auto-injects branch-specific `SUPABASE_*` env vars to edge functions
- Shares the underlying infrastructure SLA
- Can be quickly reset / re-created without re-provisioning a full Supabase project

For this project the branch model means:
- Dev migrations are tested against the same Postgres version + extensions as prod
- Edge functions on dev use the same runtime as prod
- We can cheaply spin up additional preview branches for testing migrations

## Custom domain

`api-secured.flent.in` resolves to `uowjtrzmszuaiokqxgir.supabase.co` via a Cloudflare CNAME (DNS managed in Cloudflare dashboard). The mobile app uses the custom domain for two reasons:

1. **ISP DNS bypass.** Some Indian ISPs block `*.supabase.co` at the DNS level. Custom domain on `flent.in` resolves cleanly.
2. **Stable URL.** If we ever migrate Supabase projects (unlikely), the mobile app's hardcoded URL doesn't have to change — only the CNAME.

The dev branch project does NOT have a custom domain — devs and admin app point at `https://zqlowjveyqiagnbmfwsb.supabase.co` directly. There's no ISP-block concern in dev contexts.

## Edge function auth pattern (`verify_jwt=false`)

All ~93 edge functions are deployed with `--no-verify-jwt`. This is intentional and worth understanding:

**Why:** Supabase issues ES256 JWTs (Elliptic Curve), but the Supabase API gateway only verifies HS256 signatures. So `verify_jwt=true` would reject all real user tokens at the gateway layer.

**How auth still works:** auth is validated INSIDE each function via `supabase/functions/_shared/supabase.ts#createAuthenticatedClient(authHeader)`. This:
1. Decodes the JWT (without signature verification — gateway already passed it through)
2. Checks `revoked_tokens` table for blacklisted sessions (covers sign-out / forced-logout cases)
3. Creates a Supabase client scoped to the user
4. Returns `{userId, user}` for the function to use

So the layered model is:
- Gateway: validates JWT was signed by Supabase (HS256 sanity check)
- Function: decodes JWT to get user identity + checks revocation + scopes the client

Functions that don't need user auth (webhooks, public endpoints like `auth-otp`) skip the `createAuthenticatedClient` call. Webhooks instead verify HMAC signatures from the calling vendor (Cashfree, etc.) — see `cashfree-split-webhook` for the pattern.

**Functions that should NEVER use this pattern:**
- Webhooks: use HMAC signature verification from the source secret
- Service-to-service calls (e.g., Cloud Run → Supabase): use service role key in `Authorization: Bearer <service-role>`
- OTP entry endpoints: rate-limit + phone-format validate, no JWT yet

## Storage buckets

| Bucket | Public? | Purpose |
|---|---|---|
| `avatars` | yes | User profile photos. Read by anyone, write by authenticated user owning the row. |
| `rent-agreements` | no | Rent agreement PDFs uploaded by users. Read by service role only. |
| `whatsapp-assets` | yes | WhatsApp template static images. Read by anyone (Twilio fetches them). |

Storage policies in `supabase/migrations/20260129100002_create_avatars_storage_bucket.sql`, `20260220000001_create_rent_agreements_storage_bucket.sql`, `20260402000002_whatsapp_assets_bucket.sql`.

## Migration tracking

Per Phase 0 of the cleanup, we resolved a version-collision issue between local migration files and the prod tracking table. Current state:

- All migrations committed under `supabase/migrations/` are tracked in `schema_migrations` on prod.
- Dev branch tracking has a few iterative-attempt rows that don't map to local files (legacy from before tracking discipline). Harmless.
- `scripts/ci/lint-migrations.mjs` rule-1 prevents future collisions.

## Operational queries

```sql
-- Are dev and prod schemas drift-detected?
-- Run on both, compare:
SELECT count(*) FILTER (WHERE table_schema='public') AS public_tables,
       (SELECT count(*) FROM information_schema.views WHERE table_schema='public') AS public_views,
       (SELECT count(*) FROM cron.job) AS cron_jobs,
       (SELECT count(*) FROM pg_extension) AS extensions
FROM information_schema.tables WHERE table_schema='public';
```

As of 2026-04-25:
- Both projects: 36 tables, 10 product views, 19 cron jobs
- Dev no longer has pgTAP (dropped in Phase 8a) — was inflating public function count

## Branch lifecycle

To create another preview branch (e.g., for a risky migration test):

```bash
# In Supabase dashboard → Branches → New branch
# Or via API:
curl -X POST 'https://api.supabase.com/v1/projects/uowjtrzmszuaiokqxgir/branches' \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch_name":"migration-test"}'
```

The new branch gets its own project ref. Apply migrations + functions to it independently. Delete when done.
