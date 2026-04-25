# Flent Secured

Rent payment app for Indian tenants. Pay rent via UPI, cards, or netbanking with 1% cashback, AI-powered agreement extraction, landlord verification, and automated payouts.

**Platform:** iOS (React Native) | **Target:** India (Mumbai initially) | **Bundle ID:** `in.flent.secured`

## Repository Structure

```
├── rn-app/                  # React Native Expo app (SDK 52, expo-router v4)
├── supabase/                # Backend: Edge Functions (25+) + SQL migrations
│   ├── functions/           # Auth, payments, document processing, verification, admin
│   └── migrations/          # Database schema, RLS policies, triggers, cron jobs
├── cloudflare-worker/       # Reverse proxy on devapi.flent.in (ISP bypass for *.supabase.co)
├── scripts/                 # Admin tooling (Google Sheets, Python utilities)
├── maestro/                 # E2E test flows
├── test-infrastructure/     # Test gap analysis
└── docs/                    # Project documentation
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 52, React Native 0.81, expo-router v4 |
| State | Zustand (client) + React Query (server) |
| Backend | Supabase (Auth, PostgREST, Edge Functions, Realtime) |
| Payments | Cashfree Payments (UPI, Cards, Netbanking, Easy Split settlement) — PayU is legacy fallback being phased out |
| Identity | Cashfree Mobile 360 (KYC via OTP consent) |
| Document AI | Google Document AI (OCR) + Gemini 3 Flash (extraction) |
| Proxy | Cloudflare Worker — bypasses ISP DNS blocks on `*.supabase.co` |
| CI/CD | EAS Build + EAS Update (OTA) |

## User Journey

```
Sign Up → OTP → Agreement Upload → AI Extraction → Review → Waitlist
→ Admin Approval → Setup (Bank + Utility + Landlord) → Active Dashboard → Pay Rent
```

## Quick Start

### Option A — local everything (isolated dev, recommended)

Runs the full backend (Supabase + edge functions, optionally Cloud Run extraction) on your machine. No cloud project, no real money, real Indian users not visible.

**Prereqs (one-time):**
- Docker Desktop or [OrbStack](https://orbstack.dev)
- Node.js 20+
- `supabase` CLI (already global; or use `npx supabase ...`)

```bash
git clone https://github.com/flent-homes/Secured-v2.git && cd Secured-v2

# 1. Fill in test creds (Cashfree sandbox, Twilio test, Gemini key, etc.)
cp supabase/.env.local.example supabase/.env.local
$EDITOR supabase/.env.local

# 2. Boot local Supabase + edge functions (auto-writes rn-app/.env.local)
npm run dev:up
#   Or for physical-device testing on the same wifi:
#   WITH_LAN_ACCESS=1 npm run dev:up

# 3. In a separate terminal, start the mobile app
cd rn-app && npm install && npx expo start
```

**What's NOT real locally:**
- WhatsApp / SMS: Twilio test creds don't deliver. OTP appears in `auth-otp` function logs and in [Inbucket](http://127.0.0.1:54324) (catch-all email + SMS).
- Cashfree: hits sandbox APIs (real test transactions, no real money).
- pg_cron schedules: extension is available locally but jobs only run if you trigger them manually via Studio SQL.
- Push notifications: FCM not configured locally; expect silent no-ops on `send-push-notification`.

**Reset local data:** `npm run db:reset` wipes + reapplies migrations + reseeds.

**Test users (already in seed.sql):**
| Phone | UUID prefix | State |
|---|---|---|
| `+919999999901` | `11111111-…` | Active tenant, fully verified, payments + cashback |
| `+919999999902` | `22222222-…` | Verified landlord paired with the tenant above |
| `+919999999903` | `33333333-…` | Early funnel (post-OTP, pre-extraction) |

Use OTP `123456` in dev mode (gated by `ALLOW_DEMO_AUTH=true`).

### Option B — point at the Supabase dev branch (cloud)

Useful when you don't want to run Docker locally. Targets the v2-backend-dev Supabase project shared with the team.

```bash
cd rn-app
cp .env.local.example .env.local
# Replace EXPO_PUBLIC_SUPABASE_URL with https://zqlowjveyqiagnbmfwsb.supabase.co
# and the anon key with the dev-branch publishable key.
npm install && npx expo start
```

This points at the dev branch, which has the same edge functions and Cloud Run wiring as prod (per `docs/ENVIRONMENT_INFRASTRUCTURE.md`).

## Documentation

Comprehensive documentation lives in [`docs/`](docs/README.md):

| Document | Description |
|----------|-------------|
| [Project Overview](docs/README.md) | Architecture, tech stack, user journey, design decisions |
| [Backend — Edge Functions](docs/backend/edge-functions.md) | All 25+ Supabase Edge Functions with request/response specs |
| [Backend — Database Schema](docs/backend/database-schema.md) | Tables, RLS policies, triggers, and cron jobs |
| [Frontend — State Management](docs/frontend/state-management.md) | Zustand stores, React Query patterns, data flow |
| [Infrastructure — Cloudflare & Deployment](docs/infrastructure/cloudflare-and-deployment.md) | CF Worker proxy, EAS builds, OTA updates |
| [Screen-Backend Map](docs/screen-backend-map.md) | Every screen mapped to its backend endpoints and data flow |
| [E2E Test Report](docs/BACKEND_E2E_AUDIT_REPORT.md) | Backend endpoint test coverage and findings |
| [Development & Testing Guide](rn-app/docs/dev-testing-guide.md) | DevNavigator, mock data, test phones, build profiles |

## License

Proprietary — Flent Technologies
