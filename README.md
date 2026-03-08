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
| Payments | PayU India (UPI, Cards, Netbanking) |
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

```bash
cd rn-app
npm install
cp .env.example .env          # Add Supabase URL + keys
npx expo start                # Development server
```

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
