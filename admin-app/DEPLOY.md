# Admin Panel Deploy Checklist

Hosted on Vercel, gated by `ADMIN_EMAILS` allow-list. Everything below assumes you already have a Vercel account connected to the GitHub repo.

## 1. Local sanity check first

```sh
cd admin-app
cp .env.local.example .env.local   # if not already done
# Fill in every value in .env.local — see "Env vars" below
npm install
npm run dev
```

Visit `http://localhost:3000`. Expected:

- `/` redirects to `/login` (you're not signed in).
- Sign in with any email NOT in `ADMIN_EMAILS` → red "not on the admin allow-list" banner, session cleared.
- Sign in with `rishabh@flent.in` → lands on `/overview`.
- `/triage` loads; verification pips populated for users that have `stamp_verification_status = 'verified'`.
- Approve a dev-backend test user → success banner.

If any of those fail locally, do NOT deploy yet.

## 2. Vercel project setup

1. **New Project** → import the repo.
2. **Root Directory** → set to `admin-app/` (not the repo root).
3. **Framework Preset** → Next.js (auto-detected).
4. **Build / Install / Output** → defaults.
5. **Environment Variables** — see the table below. Set them for **Production**, then mirror to **Preview** (so PR previews work).

## 3. Env vars

| Name | Where | Value | Notes |
|------|-------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_DEV_ANON_KEY` | Production + Preview | dev anon key | Public — shipped to browser. |
| `NEXT_PUBLIC_SUPABASE_MAIN_ANON_KEY` | Production + Preview | prod anon key | Public — shipped to browser. |
| `SUPABASE_DEV_SERVICE_ROLE_KEY` | Production + Preview | dev service-role | Server-only. |
| `SUPABASE_MAIN_SERVICE_ROLE_KEY` | Production + Preview | prod service-role | Server-only. |
| `SUPABASE_DEV_URL` | Production + Preview | `https://zqlowjveyqiagnbmfwsb.supabase.co` | Optional (default baked in). |
| `SUPABASE_URL` | Production + Preview | `https://uowjtrzmszuaiokqxgir.supabase.co` | Optional (default baked in). |
| `ADMIN_KEY` | Production + Preview | value of prod `admin-waitlist`'s `ADMIN_API_KEY` | Server-only. **Mismatch = every approve 401s.** Find it via `supabase secrets list --project-ref uowjtrzmszuaiokqxgir`. |
| `ADMIN_EMAILS` | Production + Preview | `rishabh@flent.in` | Comma-separated. Adding an admin = update + redeploy. |

`NEXT_PUBLIC_ADMIN_KEY` is **NO LONGER USED** — if you have it set anywhere, remove it. The browser bundle will not contain it.

## 4. Deploy preview, smoke test

1. Push a non-main branch → Vercel builds a preview.
2. Visit preview URL.
3. Verify the same five behaviors from §1 (with prod backend this time — pick a *non-destructive* user to test against, e.g. only test the read path, do NOT approve a real user from preview).

## 5. Promote to production

- In Vercel, mark the green build as Production, OR merge the branch to `main` and let main auto-promote.
- Optional custom domain (e.g. `admin.flent.in`):
  - Vercel Project → Settings → Domains → add domain.
  - Add the CNAME / A records in your DNS provider.

## 6. Post-deploy verification (against prod)

- `/` redirects to `/login`.
- Sign-in with non-allow-listed email is bounced.
- Sign-in with allow-listed email lands on `/overview`.
- `/triage` queue renders, pips populated.
- User-detail page shows the chip row (Bank, Utility, Landlord, Identity, Agreement, Stamp).
- Approval preflight blocks for users with `extraction_status = 'extraction_failed'` with the new explicit message.
- DevTools → Network: every privileged call goes through `/api/admin`; no `admin_key` visible in any request body.
- DevTools → Sources / Application: no `ADMIN_KEY` value in the JS bundles.

## 7. Rolling back

Vercel dashboard → Deployments → previous green deploy → Promote to Production. Edge function `ADMIN_API_KEY` is unchanged, so the previous admin-app build keeps working.

## What's still manual / out of scope

- Tying admin email into `audit_logs.actor_id` — current audit log says `actor_type = 'admin'` opaquely. Add when a second admin joins.
- Surfacing `landlord_status` enum (only the boolean is in `v_user_funnel` today).
- Gemini name-match details from `bank_accounts`.
- Rate limiting on `/api/admin`.
