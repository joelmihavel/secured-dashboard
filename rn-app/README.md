# Flent Secured

Rent payment app for Indian tenants. Pay rent via UPI, cards, or netbanking with automatic cashback, landlord verification, and agreement management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52, React Native 0.81, expo-router v4 |
| State | Zustand (client) + React Query (server) |
| Backend | Supabase (Auth, PostgREST, Edge Functions, Realtime) |
| Payments | PayU Core SDK (UPI, Cards, Netbanking) |
| Identity | Cashfree M360 (KYC via OTP consent) |
| Auth | Dual-path OTP: Supabase Auth (existing users) + Cashfree M360 (new users) |
| Proxy | Cloudflare Worker (`devapi.flent.in`) — bypasses ISP DNS blocks on `*.supabase.co` |
| CI/CD | EAS Build + EAS Update (OTA) |
| Error Tracking | Sentry (currently disabled, pending RN 0.82 fix) |

## Architecture

```
rn-app/
├── app/                          # Expo Router screens (file-based routing)
│   ├── (auth)/                   # Splash, carousel, sign-up, OTP
│   ├── (agreement)/              # Upload, review, success
│   ├── (waitlist)/               # Pending, approved
│   ├── (setup)/                  # Bank, utility, landlord verification
│   ├── (main)/                   # Home dashboard
│   ├── (payment)/                # Payment flow + status
│   ├── (profile)/                # User profile, settings
│   └── index.tsx                 # Journey-aware router (auth → waitlist → setup → main)
├── src/
│   ├── components/               # 78 components (ui/, composed/, home/, payment/)
│   ├── hooks/                    # useAuth, useDashboard, usePayments, useSetup, etc.
│   ├── services/api/             # Edge function clients (auth, dashboard, payments, etc.)
│   ├── services/supabase/        # Supabase client, realtime manager
│   ├── stores/                   # Zustand stores (auth, upload, payment, setup, etc.)
│   ├── providers/                # AuthProvider, QueryProvider
│   └── theme/                    # Design tokens, colors, typography
├── supabase/                     # Edge functions + migrations (sibling directory)
└── cloudflare-worker/            # Reverse proxy for ISP bypass
```

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

### Build

```bash
npx eas build --profile development    # Simulator
npx eas build --profile preview        # TestFlight (Ad Hoc)
npx eas build --profile production     # App Store
```

### OTA Updates

```bash
eas update --channel preview --message "description"
eas update --channel production --message "description"
```

## Backend

25+ Supabase Edge Functions handle auth, payments, document processing, identity verification, and admin operations. All functions manage auth internally via `getUser()` (gateway JWT verification disabled due to ES256/HS256 mismatch).

Key functions: `auth-otp`, `initiate-payment`, `payment-webhook`, `process-document`, `confirm-extraction`, `dashboard-data`, `verify-bank`, `verify-utility`, `send-landlord-invite`

## Documentation

| Document | Description |
|----------|-------------|
| [Development & Testing Guide](docs/dev-testing-guide.md) | DevNavigator, mock data system, test phones, scenarios, seed scripts, build profiles, production safety |

## Design System

- **Background**: `#131313` / **Cards**: `#202020` / **Accent**: `#FF9A6D`
- **Font**: Plus Jakarta Sans (Regular, Medium, SemiBold, Bold)
- **Spacing**: 8, 12, 16, 24, 32, 40, 48, 64

## License

Proprietary — Flent Technologies
