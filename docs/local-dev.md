# Local Development Guide

Long-form supplement to the [README.md "Run Locally"](../README.md#quick-start) section. This doc covers the full local-dev story: prereqs, the `dev-up.sh` orchestrator, what behaves differently locally, the test users, and troubleshooting.

> **Last reviewed:** 2026-04-25

---

## Why local first

Two reasons:

1. **Isolation.** Real Indian users have rent agreements + bank accounts in the prod DB. You don't want to accidentally read or write that during dev. Local Supabase is a separate Postgres + edge runtime + auth on your machine — same schema, synthetic data only.
2. **Speed.** `npx expo start` against `127.0.0.1:54321` skips the Cloudflare proxy + Mumbai network round-trip. Iteration loop is ~30% faster.

The alternative — pointing the rn-app at the cloud `v2-backend-dev` Supabase branch — works fine for read-only inspection but doesn't isolate writes (your dev branch DB is shared with the team).

---

## Prereqs (one-time)

| Tool | Why | Install |
|---|---|---|
| Docker Desktop or [OrbStack](https://orbstack.dev) | Supabase CLI starts Postgres + GoTrue + Storage in containers | Standard download |
| Node.js 20+ | rn-app, admin-app, cloud-run all need ≥20 | `nvm install 20` |
| `supabase` CLI | Boots local stack + deploys edge functions | `brew install supabase/tap/supabase` (already global on Rishabh's machine) |
| (Optional) `gcloud` CLI | Only if running Cloud Run extraction-service locally | `brew install --cask google-cloud-sdk` |

Verify:
```bash
docker info               # daemon running
node --version            # v20.x or v22.x
supabase --version        # ≥ 2.84
```

---

## The single command

```bash
git clone https://github.com/flent-homes/Secured-v2.git
cd Secured-v2

cp supabase/.env.local.example supabase/.env.local
$EDITOR supabase/.env.local        # fill in test creds (Cashfree sandbox, Twilio test, Gemini key)

npm run dev:up
```

What `dev:up` does (sourced from `scripts/dev-up.sh`):
1. Verifies Docker is running, exits with a clear error if not
2. `supabase start` — boots Postgres (54322), GoTrue (54321/auth), Storage (54321/storage), Inbucket (54324, catch-all email/SMS), Studio (54323), Edge runtime (54321/functions/v1)
3. `supabase db reset` — applies every migration in order, runs `seed.sql`
4. Captures the auto-generated anon + service-role keys
5. Writes `rn-app/.env.local` and `admin-app/.env.local` with the captured keys + URLs
6. Starts `supabase functions serve --env-file supabase/.env.local` in the foreground (Ctrl-C to stop)

Then in a separate terminal:
```bash
cd rn-app
npm install        # first time only
npx expo start
```

Open the Expo Go app on your phone (must be on the same wifi if `WITH_LAN_ACCESS=1`) or hit `i` for iOS simulator.

---

## Variants

### Physical device on the same wifi

The default binds Supabase to `127.0.0.1` so coffee-shop wifi neighbours can't reach your local stack. To test on a real iPhone:

```bash
WITH_LAN_ACCESS=1 npm run dev:up
```

`dev-up.sh` detects your LAN IP via `ipconfig getifaddr en0` (macOS) / `hostname -I` (Linux), writes that into `rn-app/.env.local`, and prints a security warning. **Don't do this on hostile networks** — the local Supabase still has a default service-role key reachable to anyone on the same segment.

USB tether is the safer alternative — your phone gets a `172.20.10.x` address that only you reach.

### Run Cloud Run extraction-service locally too

```bash
WITH_EXTRACTION=1 npm run dev:up
```

This also runs `cloud-run/extraction-service` via `npm run dev` (tsx). The local edge function `process-document` can delegate to it via:

```
EXTRACTION_SERVICE_URL=http://host.docker.internal:8080
EXTRACTION_SECRET=local-dev-extraction-secret
CLOUD_RUN_PERCENTAGE=100
```

(Already templated in `supabase/.env.local.example`.)

`host.docker.internal` is how the supabase functions container reaches your host's Cloud Run dev process. On Linux Docker, you may need `--add-host host.docker.internal:host-gateway` — open a PR if you hit this.

---

## Test users (seeded by `supabase/seed.sql`)

Three users are inserted on every `db reset`. Phones are dev-only (`+91 99999 99 9XX`) and the OTP is **`123456`** when `ALLOW_DEMO_AUTH=true` is set in `supabase/.env.local`.

| User | UUID prefix | Phone | State |
|---|---|---|---|
| Test Tenant | `11111111-…` | `+919999999901` | Fully verified, has tenancy + bank + identity verification + 2 payments + cashback |
| Test Landlord | `22222222-…` | `+919999999902` | Verified landlord paired with the tenant above |
| Pending Tenant | `33333333-…` | `+919999999903` | Early funnel — post-OTP, pre-extraction |

To pick a journey state on the fly, the `(dev)/screen-picker` route + `dev-seed` edge function let you jump tenant 1 to any state (`signed_up | agreement_confirmed | waitlisted | approved | active`) plus optional payment-history state. See `rn-app/src/__dev__/jumpToScreen.ts`.

---

## What's NOT real locally

| Surface | Behavior |
|---|---|
| **WhatsApp + SMS** | Twilio test creds simulate sends without delivery. Inbound OTPs appear in [Inbucket](http://127.0.0.1:54324) under the `+919999...` mailbox AND in the `auth-otp` edge function logs. |
| **Cashfree payments** | Sandbox API. Real test transactions, no real money. Use Cashfree's sandbox card numbers from their docs. |
| **PayU** | Sandbox if you've set `EXPO_PUBLIC_PAYMENT_GATEWAY=payu` + `EXPO_PUBLIC_CASHFREE_ENV=SANDBOX`. Default is Cashfree-sandbox. |
| **Push notifications** | FCM not configured locally; `send-push-notification` no-ops silently. |
| **pg_cron jobs** | Extension is available locally but jobs only fire if you trigger them manually (`SELECT cron.job_run_details()` shows nothing). |
| **Stamp verification** | `stamp-verification-service` is a separate Cloud Run service whose source isn't in this repo. Not available locally. |
| **Document AI / Vertex Gemini** | Will work IF you fill in `GEMINI_API_KEY` and have GCP creds via `GCP_DOCUMENT_AI_CREDENTIALS`. Skip if you're not testing extraction. |
| **Cloudflare Worker proxy** | Bypassed entirely — your phone hits `http://192.168.x.y:54321` directly. |

---

## Reset local data

```bash
npm run db:reset       # wipes Postgres, reapplies all migrations, runs seed.sql
npm run dev:down       # stop everything (preserves data)
npm run dev:up         # restart (preserves data unless you also db:reset)
```

`db:reset` is destructive on local data only — your cloud projects are untouched.

---

## Common issues

### `Docker is not running`
Open Docker Desktop or OrbStack and wait for the daemon to come up.

### `Could not parse anon/service keys from supabase status`
`supabase status -o json` failed. Run `supabase status` manually; if it errors, run `supabase start` first then re-run `dev:up`.

### Phone can't reach the local Supabase via LAN IP
- Verify both devices on same wifi (not "guest" or "isolated")
- Verify the URL in `rn-app/.env.local` matches your machine's actual LAN IP (`ipconfig getifaddr en0`)
- macOS firewall: allow incoming connections to Docker / Postgres
- Restart Expo dev server after `.env.local` changes (Expo reads env vars at boot, not on hot reload)

### Edge function returns 401 in dev
Check `ALLOW_DEMO_AUTH=true` is set in `supabase/.env.local` for any function gated on this flag (e.g., `seed-test-data`, `dev-seed`).

### `db reset` fails on a cron migration
Some early migrations call `cron.schedule(...)` directly assuming pg_cron exists. supabase/postgres image bundles the extension; if it's not auto-enabled run `CREATE EXTENSION IF NOT EXISTS pg_cron;` in Studio, then `db reset` again. If you continue to hit this, file an issue and we'll add an extension shim migration.

### Edge function can't reach extraction-service when `WITH_EXTRACTION=1`
The functions container reaches the host via `host.docker.internal` (macOS/Windows) or `--add-host host.docker.internal:host-gateway` (Linux). Verify `EXTRACTION_SERVICE_URL` in `supabase/.env.local` uses `host.docker.internal:8080`, not `127.0.0.1:8080` or `localhost:8080`.

---

## Editing `dev-up.sh`

The orchestrator is a single bash script. If you change behavior, please:

1. Keep the Docker preflight first
2. Default to `127.0.0.1` — opt-in to LAN via env flag
3. Print the summary table at the end so devs know what's listening where
4. Maintain idempotency — running it twice should produce the same result

Pull requests welcome.
