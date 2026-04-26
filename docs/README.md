# Flent Secured

Flent Secured is a mobile fintech application that enables tenants in India to pay rent digitally via UPI, credit/debit cards, and net banking -- and earn 1% cashback on timely payments. The app manages the full tenant lifecycle: identity verification, rent agreement extraction, landlord onboarding, payment processing, and cashback disbursement.

**Current version:** v2.2.0+ (production deploys 2026-04-25 — see git tags)
**Platform:** iOS (React Native + Expo SDK 52, expo-router v4)
**Target market:** India (Mumbai initially, expanding to other cities)
**Bundle ID:** `in.flent.secured`
**Last reviewed:** 2026-04-25 (post Cashfree migration + Cloud Run extraction split + dev/prod parity)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [User Journey Flow](#user-journey-flow)
6. [Getting Started](#getting-started)
7. [Documentation Index](#documentation-index)
8. [Environment Variables](#environment-variables)
9. [Key Design Decisions](#key-design-decisions)

---

## Project Overview

### What It Does

Flent Secured solves the problem of informal, untracked rent payments in India. Tenants upload their rent agreement, the app extracts key data using AI, and once verified, tenants can pay rent through multiple digital channels. Landlords receive payouts directly to their bank accounts.

### Core Features

- **Rent Agreement OCR** -- Upload a PDF or photo of your rent agreement. Google Gemini AI extracts tenant name, landlord name, rent amount, property address, and lease dates automatically. Users review and confirm the extracted data.

- **Waitlist-Gated Onboarding** -- New users enter a prioritized waitlist after agreement upload. Admin review ensures quality control. Referral codes boost priority.

- **Identity and Address Verification** -- Three-step verification: bank account verification (name matching against agreement), utility bill verification (address confirmation), and landlord invitation via WhatsApp.

- **Payment Processing** -- Rent payments through Cashfree Payments (UPI, credit cards, debit cards, net banking, plus vendor settlement to landlord). PayU is a legacy fallback being phased out — see PayU removal workstream in the implementation plan. All payments tracked end-to-end with webhook confirmation.

- **Cashback Rewards** -- Tenants earn 1% cashback on timely rent payments (paid before the cutoff day each month). Cashback accumulates in a ledger with expiry management.

- **Landlord Payouts** -- Automated settlement to landlord bank accounts with payout tracking and confirmation.

- **Rent Receipts and Payment Stamps** -- Digital rent receipts generated for each payment. Monthly payment stamps track payment history visually.

### Business Model

Tenants pay a small convenience fee on each transaction (varies by payment method). The cashback incentive drives timely payments and platform adoption.

---

## Architecture Overview

```
                                   MOBILE CLIENT
                              +-----------------------+
                              |       iOS App         |
                              |   (Expo / React Native)|
                              |                       |
                              |  Expo Router (routes) |
                              |  Zustand (client)     |
                              |  React Query (server) |
                              +-----------+-----------+
                                          |
                                          | HTTPS
                                          v
                              +-----------+-----------+
                              |  Cloudflare Worker    |
                              |  devapi.flent.in      |
                              |  (Reverse Proxy)      |
                              +-----------+-----------+
                                          |
                                          | Proxied HTTPS
                                          v
               +---------------------------------------------+
               |              SUPABASE PLATFORM               |
               |                                               |
               |  +-------------+  +------------------------+  |
               |  | PostgreSQL  |  | Edge Functions (Deno)  |  |
               |  |   Database  |  |                        |  |
               |  | - users     |  | - auth-otp             |  |
               |  | - payments  |  | - process-document     |  |
               |  | - tenancies |  | - initiate-payment     |  |
               |  | - cashback  |  | - payment-webhook      |  |
               |  | - waitlist  |  | - dashboard-data       |  |
               |  | - etc.      |  | - 80+ more functions   |  |
               |  +-------------+  +------------------------+  |
               |                                               |
               |  +-------------+  +------------------------+  |
               |  | Auth (OTP)  |  | Storage (agreements)   |  |
               |  +-------------+  +------------------------+  |
               |                                               |
               |  +-------------+  +------------------------+  |
               |  | Realtime    |  | Row Level Security     |  |
               |  +-------------+  +------------------------+  |
               +---------------------+------------------------+
                                     |
                      +--------------+--------------+
                      |              |              |
                      v              v              v
               +-----------+  +-----------+  +-----------+
               |   PayU    |  |  Google   |  |  Twilio   |
               |   India   |  |  Gemini   |  |           |
               | (Payments)|  |  (AI/OCR) |  | (WhatsApp |
               |           |  |           |  |  & SMS)   |
               +-----------+  +-----------+  +-----------+
```

### Why the Cloudflare Worker Proxy?

Indian ISPs (Jio, Airtel, and others) periodically block `*.supabase.co` domains at the DNS level, causing 522 timeout errors for users. The Cloudflare Worker at `devapi.flent.in` acts as a transparent reverse proxy, routing all Supabase traffic through a custom domain that ISPs do not block. The app requires zero code changes -- only the `EXPO_PUBLIC_SUPABASE_URL` environment variable points to the proxy instead of Supabase directly.

### Data Flow

1. **Client** makes API calls to `devapi.flent.in` using the Supabase JS SDK.
2. **Cloudflare Worker** rewrites the hostname to the Supabase project host and forwards the request, including auth headers.
3. **Supabase Edge Functions** handle business logic. Each function validates auth internally via `getUser()`.
4. **PostgreSQL** stores all data with Row Level Security (RLS) policies enforcing tenant isolation.
5. **External services** are called server-side only (PayU for payments, Gemini for OCR, Twilio for notifications).

---

## Tech Stack

### Mobile Application

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React Native | 0.81.5 | Cross-platform mobile (iOS focus) |
| Platform | Expo | SDK 54 | Build tooling, native modules, OTA updates |
| Routing | Expo Router | 6 | File-based routing with typed routes |
| Language | TypeScript | 5.9 | Type safety across the codebase |
| Client State | Zustand | 5 | Lightweight stores (auth, payment, setup, upload, waitlist) |
| Server State | TanStack React Query | 5 | Data fetching, caching, and synchronization |
| Animations | React Native Reanimated | 4.1 | Performant UI animations on the UI thread |
| Graphics | React Native SVG | 15.12 | Vector illustrations and icons |
| Animations (Lottie) | Lottie React Native | 7.3 | Complex motion design (loading states, celebrations) |
| Validation | Zod | 3.23 | Runtime schema validation for API responses |

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | PostgreSQL 17 (Supabase) | Primary data store with RLS — 36 tables, 10 product views |
| Functions | Supabase Edge Functions (Deno) | ~93 serverless API endpoints; all use `verify_jwt=false` + in-function auth via `_shared/supabase.ts#createAuthenticatedClient` |
| Auth | Supabase Auth (GoTrue) | Phone/OTP via Twilio + dual-format phone storage (auth.users without `+`, public.users with `+`) |
| Storage | Supabase Storage | Rent agreement PDFs (`rent-agreements`), avatars, WhatsApp assets |
| Realtime | Supabase Realtime | Live updates for extraction status, payment status |
| Cron | pg_cron | 19 scheduled jobs (notification queue, cashback expiry, stale payment cleanup, settlement polling, stamp verification sweep) |

### Heavy-lift extraction (Cloud Run)

| Layer | Technology | Purpose |
|---|---|---|
| extraction-service-{prod,dev} | Cloud Run + Express + Document AI + Vertex Gemini | Long-running PDF extraction (15-min timeout) — invoked by `process-document` edge function via toggle |
| stamp-verification-service-{prod,dev} | Cloud Run + 2Captcha + ZenRows | SHCIL e-Stamp portal verification — called by extraction service |

### External Services

| Service | Purpose |
|---------|---------|
| Cashfree Payments | Primary payment gateway — UPI, cards, netbanking, vendor settlement to landlord |
| Cashfree Mobile 360 (M360) | Identity verification — PAN, credit score, mobile intelligence |
| PayU India | Legacy payment gateway, being phased out (see PayU removal workstream in cleanup plan) |
| Google Document AI | OCR extraction (text-only path) |
| Google Gemini (Vertex AI + API key fallback) | AI-powered rent agreement extraction with multimodal fallback |
| Google Maps Geocoding | Property address → lat/lng |
| SHCIL e-Stamp portal | Stamp certificate verification |
| 2Captcha + ZenRows | SHCIL anti-bot bypass |
| Twilio | WhatsApp + SMS + OTP delivery |
| Expo Push API | Push notifications |
| Expo EAS | Cloud builds, OTA updates, App Store submit |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Proxy | Cloudflare Workers | ISP bypass for `*.supabase.co` (devapi.flent.in) — prod uses custom domain `api-secured.flent.in` |
| GCP Project | `secured-by-flent` (asia-south1) | Hosts all 4 Cloud Run services + Document AI processor + Secret Manager |
| Vertex AI Project | `flent-ai-project-2` | Cross-project Vertex AI access |
| Builds | EAS Build | iOS simulator, device, preview, and production builds |
| Updates | EAS Update | Over-the-air JavaScript bundle updates |
| Admin | Next.js + Vercel (TBD) | Admin dashboard with dev/main env switcher |

### Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#131313` | Primary app background |
| Cards | `#202020` | Card and surface backgrounds |
| Brand Accent | `#FF9A6D` | Primary accent, CTAs, highlights |
| Font | Plus Jakarta Sans | Regular, Medium, SemiBold, Bold weights |
| Spacing Scale | 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64 | Consistent spacing tokens |

---

## Project Structure

```
Secured v2-react-native project/
|
+-- rn-app/                          # React Native application (Expo)
|   +-- app/                         # File-based routes (Expo Router)
|   |   +-- index.tsx                # Journey-aware router (entry point)
|   |   +-- _layout.tsx              # Root layout (fonts, providers, error boundary)
|   |   +-- error.tsx                # Global error screen
|   |   +-- (auth)/                  # Authentication flow
|   |   |   +-- beta-splash.tsx      #   Landing / splash screen
|   |   |   +-- splash.tsx           #   Animated splash
|   |   |   +-- carousel.tsx         #   Onboarding carousel (3 slides)
|   |   |   +-- sign-up.tsx          #   Phone number entry
|   |   |   +-- otp.tsx              #   OTP verification
|   |   +-- (agreement)/             # Rent agreement flow
|   |   |   +-- upload.tsx           #   Upload agreement PDF/photo
|   |   |   +-- review.tsx           #   Review AI-extracted data
|   |   +-- (waitlist)/              # Waitlist status
|   |   |   +-- index.tsx            #   Waitlist position and status
|   |   |   +-- approved.tsx         #   Approval confirmation
|   |   +-- (setup)/                 # Verification setup (post-approval)
|   |   |   +-- index.tsx            #   Setup overview / checklist
|   |   |   +-- add-bank.tsx         #   Bank account verification
|   |   |   +-- add-utility.tsx      #   Utility bill verification
|   |   |   +-- invite-landlord.tsx  #   Landlord WhatsApp invite
|   |   |   +-- pending-steps.tsx    #   Pending verification steps
|   |   +-- (main)/                  # Home dashboard
|   |   |   +-- index.tsx            #   Dashboard with rent status, cashback, payments
|   |   +-- (payment)/               # Payment flow
|   |   |   +-- enter-rent.tsx       #   Enter rent amount
|   |   |   +-- confirm.tsx          #   Confirm payment details
|   |   |   +-- status.tsx           #   Payment processing / success / failed
|   |   +-- (profile)/               # User profile
|   |   |   +-- index.tsx            #   Profile overview
|   |   |   +-- edit.tsx             #   Edit profile details
|   |   |   +-- edit-bank-details.tsx#   Edit bank information
|   |   |   +-- agreement.tsx        #   View uploaded agreement
|   |   +-- (dev)/                   # Development-only tools
|   |       +-- screen-picker.tsx    #   Quick screen navigation (dev builds)
|   |
|   +-- src/
|   |   +-- components/              # UI components (~90 files)
|   |   |   +-- ui/                  #   Primitives: Button, TextInput, OTPInput, etc.
|   |   |   +-- composed/            #   Composed: ConsentToggle, AgreementUploadSection
|   |   |   +-- home/                #   Dashboard: HeadlineSection, PaymentFlipCard, etc.
|   |   |   +-- payment/             #   Payment: PaymentMethodModal, ReceiptCard, etc.
|   |   |   +-- waitlist/            #   Waitlist: ProgressArc, BenefitsCard, etc.
|   |   |   +-- onboarding/          #   Carousel illustrations
|   |   |   +-- patterns/            #   Background patterns (DottedGridPattern)
|   |   |   +-- icons/               #   SVG icon components
|   |   |   +-- dev/                  #   Dev-only: DevNavigator
|   |   |
|   |   +-- hooks/                   # Custom React hooks (23 hooks)
|   |   |   +-- useAuth.ts           #   Authentication state and actions
|   |   |   +-- useDashboard.ts      #   Dashboard data fetching
|   |   |   +-- usePayments.ts       #   Payment history queries
|   |   |   +-- usePaymentFlow.ts    #   Payment initiation flow
|   |   |   +-- useSetup.ts          #   Setup step management
|   |   |   +-- useWaitlist.ts       #   Waitlist status polling
|   |   |   +-- useAgreement.ts      #   Agreement upload and extraction
|   |   |   +-- useProfile.ts        #   Profile data management
|   |   |   +-- useRequireAuth.ts    #   Auth guard hook
|   |   |   +-- useSessionMonitor.ts #   Token refresh and session health
|   |   |   +-- useNetworkStatus.ts  #   Online/offline detection
|   |   |   +-- useOTAUpdates.ts     #   EAS Update checks
|   |   |   +-- useDeepLink.ts       #   Deep link handling
|   |   |   +-- usePaymentRecovery.ts#   Resume interrupted payments
|   |   |   +-- useRealtimeQuery.ts  #   Supabase realtime subscriptions
|   |   |   +-- ... (8 more)
|   |   |
|   |   +-- services/                # API and platform services
|   |   |   +-- api/                 #   Edge function clients
|   |   |   |   +-- auth.ts          #     OTP send/verify
|   |   |   |   +-- agreement.ts     #     Upload, process, confirm extraction
|   |   |   |   +-- dashboard.ts     #     Dashboard data aggregation
|   |   |   |   +-- payments.ts      #     Payment initiation, history, stamps
|   |   |   |   +-- setup.ts         #     Bank, utility, landlord verification
|   |   |   |   +-- waitlist.ts      #     Join waitlist, check status
|   |   |   |   +-- profile.ts       #     Profile CRUD
|   |   |   |   +-- identity.ts      #     Identity verification
|   |   |   |   +-- notifications.ts #     Push notification registration
|   |   |   +-- payment/             #   PayU SDK integration
|   |   |   |   +-- payuCoreService.ts#    PayU hash generation, SDK bridge
|   |   |   |   +-- storageService.ts #    Secure payment data storage
|   |   |   +-- supabase/            #   Supabase client configuration
|   |   |   |   +-- client.ts        #    Singleton Supabase client
|   |   |   |   +-- realtimeManager.ts#   Realtime channel management
|   |   |   +-- analytics.ts         #   Event tracking
|   |   |   +-- notifications.ts     #   Push notification handling
|   |   |   +-- errorReporting.ts    #   Error capture and reporting
|   |   |   +-- performance.ts       #   Performance monitoring
|   |   |   +-- globalErrorHandlers.ts#  Global JS/native error handlers
|   |   |
|   |   +-- stores/                  # Zustand state stores
|   |   |   +-- auth.ts              #   Auth state (session, user, tokens)
|   |   |   +-- payment.ts           #   Payment flow state (amount, method, in-progress)
|   |   |   +-- setup.ts             #   Setup step completion tracking
|   |   |   +-- upload.ts            #   Agreement upload progress and extraction ID
|   |   |   +-- waitlist.ts          #   Waitlist position and status
|   |   |   +-- profile.ts           #   User profile cache
|   |   |   +-- resetAll.ts          #   Reset all stores on sign-out
|   |   |
|   |   +-- providers/               # React context providers
|   |   |   +-- AuthProvider.tsx      #   Auth session management
|   |   |
|   |   +-- theme/                   # Design system tokens
|   |   |   +-- colors.ts            #   Color palette and semantic aliases
|   |   |   +-- typography.ts        #   Font families, sizes, weights
|   |   |   +-- spacing.ts           #   Spacing scale and layout tokens
|   |   |   +-- animations.ts        #   Animation presets
|   |   |
|   |   +-- types/                   # TypeScript type definitions
|   |   +-- config/                  # App configuration (Sentry, feature flags)
|   |   +-- review/                  # App Store review mode utilities
|   |
|   +-- assets/                      # Static assets
|   |   +-- fonts/                   #   PlusJakartaSans, Inter font files
|   |   +-- images/                  #   App icon, splash, illustrations
|   |   +-- lottie/                  #   Lottie animation JSON files
|   |
|   +-- plugins/                     # Expo config plugins
|   |   +-- withPayU/                #   PayU SDK native integration
|   |   +-- withExceptionLogger/     #   Native exception logging
|   |
|   +-- patches/                     # patch-package patches
|   |   +-- expo-constants+18.0.13.patch  # Fixes for spaces-in-path builds
|   |
|   +-- app.json                     # Expo app configuration
|   +-- eas.json                     # EAS Build profiles
|   +-- tsconfig.json                # TypeScript configuration
|   +-- jest.config.js               # Jest test configuration
|   +-- package.json                 # Dependencies
|
+-- supabase/                        # Backend (Supabase)
|   +-- functions/                   # Edge Functions (78 Deno/TypeScript)
|   |   +-- _shared/                 #   Shared utilities
|   |   |   +-- supabase.ts          #     Admin client factory
|   |   |   +-- cors.ts              #     CORS headers
|   |   |   +-- gemini.ts            #     Gemini AI client
|   |   |   +-- notifications.ts     #     Push/WhatsApp/SMS helpers
|   |   +-- auth-otp/                #   OTP send and verify
|   |   +-- process-document/        #   Gemini AI agreement extraction
|   |   +-- confirm-extraction/      #   User confirms extracted data
|   |   +-- join-waitlist/           #   Waitlist entry creation
|   |   +-- admin-waitlist/          #   Admin waitlist management
|   |   +-- verify-bank/             #   Bank account verification
|   |   +-- verify-utility/          #   Utility bill verification
|   |   +-- invite-landlord-whatsapp/#  Landlord WhatsApp invite
|   |   +-- initiate-payment/        #   PayU payment initiation + hash
|   |   +-- payment-webhook/         #   PayU webhook handler
|   |   +-- dashboard-data/          #   Aggregated dashboard response
|   |   +-- generate-receipt/        #   PDF rent receipt generation
|   |   +-- get-payment-stamps/      #   Monthly payment stamp data
|   |   +-- calculate-cashback/      #   Cashback computation
|   |   +-- settle-to-landlord/      #   Landlord payout initiation
|   |   +-- extraction-recovery/    #   Cron: auto-confirm stuck extractions
|   |   +-- landlord-auth-otp/      #   Landlord portal OTP (M360)
|   |   +-- notify-landlord/        #   Multi-channel landlord notifications
|   |   +-- admin-fetch-views/      #   Admin dashboard data views
|   |   +-- admin-payment-data/     #   Admin payment reporting
|   |   +-- pre-approval-audit/     #   Pre-approval risk checks
|   |   +-- ... (60+ more functions)
|   |
|   +-- migrations/                  # SQL migrations (100+)
|   +-- config.toml                  # Local development configuration
|
+-- cloudflare-worker/               # Cloudflare Worker (reverse proxy)
|   +-- src/
|   |   +-- index.ts                 #   Proxy logic (HTTP + WebSocket)
|   +-- wrangler.toml                #   Worker configuration
|
+-- scripts/                         # Admin and operational tools
|   +-- apps-script/                 #   Google Apps Script for admin sheet
|   +-- create-admin-sheet.py        #   Admin Google Sheet setup
|   +-- deploy-apps-script.py        #   Apps Script deployment
|
+-- docs/                            # Documentation (you are here)
```

---

## User Journey Flow

The app follows a strictly gated linear flow. Each step must be completed before proceeding to the next.

### 1. Sign Up

The user opens the app and sees the onboarding carousel highlighting key value propositions (cashback, secure payments, easy setup). They enter their phone number and verify via OTP. A Supabase Auth account is created on successful verification.

**Screens:** `beta-splash` -> `carousel` -> `sign-up` -> `otp`
**Backend:** `auth-otp` edge function (Twilio SMS)

### 2. Agreement Upload

The user uploads their rent agreement as a PDF or photograph. The document is stored in Supabase Storage and then processed by Google Gemini AI, which extracts structured data: tenant name, landlord name, monthly rent, property address, lease start/end dates, and city. The user reviews the extracted data and can edit any fields before confirming.

**Screens:** `upload` -> `review`
**Backend:** `upload-document`, `process-document`, `confirm-extraction`

### 3. Waitlist

After confirming the extracted agreement data, the user enters the waitlist. Their position is determined by signup order plus any referral code priority boost. An admin reviews the application (agreement quality, city eligibility, risk signals). The user sees their waitlist position and can share a referral code to improve priority.

**Screens:** `waitlist/index` -> `waitlist/approved`
**Backend:** `join-waitlist`, `get-waitlist-status`, `admin-waitlist`

### 4. Setup (Post-Approval)

Once approved, the user completes three verification steps:

- **Bank Verification:** Enter bank account details (account number, IFSC). The system verifies the account holder name matches the tenant name on the agreement.
- **Utility Verification:** Upload a utility bill. The system cross-references the address with the agreement address.
- **Landlord Invite:** Enter the landlord's phone number. The app sends a WhatsApp message inviting the landlord to confirm the tenancy.

All three steps must be completed to activate the account.

**Screens:** `setup/index` -> `add-bank` -> `add-utility` -> `invite-landlord` -> `pending-steps`
**Backend:** `verify-bank`, `verify-utility`, `invite-landlord-whatsapp`, `notify-landlord`

### 5. Home Dashboard

The main screen shows:
- Current rent due amount and due date
- Payment status for the current month (paid / upcoming / overdue)
- Cashback balance and history
- Monthly payment stamps (visual record of payment history)
- Setup completion status (if any verification steps are still pending)
- Quick-pay button to initiate a payment

**Screens:** `main/index`
**Backend:** `dashboard-data`, `get-payment-stamps`, `get-cashback-history`

### 6. Pay Rent

The user taps "Pay Rent" and selects a payment method:
- **UPI:** Enter UPI VPA or scan QR
- **Credit/Debit Card:** Enter card details
- **Net Banking:** Select bank from list

The app shows a fee breakdown (convenience fee varies by method), the user confirms, and the PayU SDK handles the payment flow. On completion, the app polls for webhook confirmation and displays success or failure.

**Screens:** `enter-rent` -> `confirm` -> `status`
**Backend:** `initiate-payment`, `generate-payu-hash`, `payment-webhook`, `check-payment-status`

### 7. Ongoing Usage

After the first payment, users return each month to pay rent. They earn 1% cashback on payments made before the monthly cutoff date. The app generates digital rent receipts, tracks payment history, and shows cashback accumulation. Landlords receive automated payout settlements.

**Backend:** `calculate-cashback`, `generate-receipt`, `settle-to-landlord`, `poll-settlement-status`

### Journey Router

The app's entry point (`app/index.tsx`) is a journey-aware router that determines the correct screen on every app launch:

1. Check auth state (is the user signed in?)
2. Query `user_status` from the database (via PostgREST, with edge function fallback)
3. Map status to the correct route: `signed_up` -> agreement, `waitlisted` -> waitlist, `approved` -> setup, `active` -> main dashboard
4. Cache the resolved route in SecureStore for instant navigation on subsequent launches

This ensures users always land on the correct screen regardless of where they left off, even after app kills or crashes.

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **Xcode** 16 or later (for iOS builds)
- **Expo CLI**: `npm install -g expo-cli`
- **Supabase CLI**: `brew install supabase/tap/supabase`
- **EAS CLI**: `npm install -g eas-cli` (for cloud builds and OTA updates)
- **CocoaPods**: `gem install cocoapods` (installed automatically by Expo prebuild)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd "Secured v2-react-native project"

# Install dependencies
cd rn-app
npm install
```

The `postinstall` script automatically runs `patch-package` to apply necessary patches (primarily for spaces-in-path build compatibility).

### Environment Setup

Create a `.env` file in the `rn-app/` directory:

```bash
# Supabase (via Cloudflare Worker proxy)
EXPO_PUBLIC_SUPABASE_URL=https://devapi.flent.in
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# PayU India
EXPO_PUBLIC_PAYU_KEY=<your-payu-merchant-key>
```

To retrieve the Supabase anon key:
```bash
supabase projects api-keys --project-ref zqlowjveyqiagnbmfwsb
```

### Running the App

**Development (Expo Go or Dev Client):**
```bash
cd rn-app
npx expo start
```

**iOS Simulator Build:**
```bash
cd rn-app
npx expo prebuild --clean
npx expo run:ios
```

**Physical Device (via EAS):**
```bash
cd rn-app
eas build --platform ios --profile development:device
```

### Running Tests

```bash
cd rn-app
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### EAS Build Profiles

| Profile | Purpose | Distribution |
|---------|---------|-------------|
| `development` | Simulator build with dev client | Internal |
| `development:device` | Physical device build with dev client | Internal |
| `preview` | Ad Hoc distribution for testing | Internal |
| `production` | App Store submission | Store |

```bash
# Build for simulator
eas build --platform ios --profile development

# Build for physical device
eas build --platform ios --profile development:device

# Preview build (Ad Hoc)
eas build --platform ios --profile preview

# Push OTA update to preview channel
eas update --channel preview --message "Bug fix description"
```

### Supabase Local Development

```bash
# Start local Supabase (from project root)
supabase start

# Deploy a specific edge function
supabase functions deploy <function-name> --project-ref zqlowjveyqiagnbmfwsb

# Run database migrations
supabase db push --project-ref zqlowjveyqiagnbmfwsb
```

### Cloudflare Worker

```bash
# Deploy the reverse proxy worker
cd cloudflare-worker
npx wrangler deploy
```

---

## Documentation Index

Detailed documentation for each subsystem is available in the `docs/` directory.

> **Index status:** the docs structure is being reshaped during the 2026-04-25 cleanup (see `/Users/atrishabh/.claude/plans/okay-now-i-ticklish-castle.md` for the plan). Some docs below are accurate, some are partially stale, some are net-new TODOs. Each row tells you which.

### Active reference docs

| Document | Description | Status |
|---|---|---|
| [Environment Infrastructure](./ENVIRONMENT_INFRASTRUCTURE.md) | EAS profiles, Supabase projects, Cloud Run services (incl. dev/prod split), shared GCP resources, deployment commands | ✅ Fresh (2026-04-25) |
| [Backend Edge Functions](./backend/edge-functions.md) | Reference for the ~93 Supabase edge functions, auth pattern (`verify_jwt=false` + in-function validation) | ⚠️ Counts stale; see "rewrite pending" below |
| [Frontend Screens and Routing](./frontend/screens-and-routing.md) | Screen inventory, route groups, navigation flow | ✅ Mostly current |
| [Components Library](./frontend/components.md) | UI component catalog | ✅ Mostly current |
| [State Management](./frontend/state-management.md) | Zustand + React Query patterns | ✅ Mostly current |
| [Screen-to-Backend Map](./screen-backend-map.md) | Maps screens to edge functions and data flow | ⚠️ Predates Cashfree migration |
| [Payment and Cashback Architecture](./backend/payment-and-cashback-architecture.md) | Payment lifecycle, fee system, cashback system | ⚠️ Predates Cashfree+M360 migration |
| [WhatsApp Notifications](./WHATSAPP_NOTIFICATIONS.md) | Twilio WhatsApp integration | ✅ Current |

### Local development

| Document | Description |
|---|---|
| Repo root [README.md](../README.md) "Run Locally" | Two-path Quick Start: full local Supabase via `npm run dev:up`, or point at the dev branch |
| [supabase/.env.local.example](../supabase/.env.local.example) | Template for local edge function secrets |
| [rn-app/.env.local.example](../rn-app/.env.local.example) | Template for local rn-app env (auto-generated by `dev-up.sh`) |

### Operations and incidents

| Document | Description |
|---|---|
| [Incident response runbook](./operations/incident-response.md) | Per-surface rollback verbs (Cloud Run / edge fns / migrations / OTA), P0/P1 playbooks, "do NOT do during incident" |
| [Recovery runbook](./operations/recovery-runbook.md) | Daily-backup-snapshot recovery (Supabase PITR not enabled on this project); selective row restore + schema rollback paths |

### Archives

| Path | Why archived |
|---|---|
| [docs/audit/archive/](./audit/archive/) | Historical audit reports (DocAI, error handling, retry logic, gemini safety) — pre-Cashfree migration era |
| [docs/Plans/archive/](./Plans/archive/) | Old implementation plans whose work has shipped |
| [scripts/legacy/](../scripts/legacy/) | One-shot v1→v2 migration scripts kept for emergency rerun |

### Rewrite pending (Phase 4 of cleanup plan, partially done)

These docs need refresh to reflect what actually shipped:
- `backend/edge-functions.md` — recount + per-function auth-pattern table
- `backend/payment-and-cashback-architecture.md` — Cashfree PG, vendor adjustments, M360 identity
- `screen-backend-map.md` — Cashfree screens, stamp screens
- New: `backend/cashfree-integration.md`, `backend/stamp-verification.md`, `backend/cron-jobs.md`
- New: `frontend/deep-linking.md`, `development/index.md` (DevNavigator + dev-seed), `testing/index.md` (Maestro)
- New: `infrastructure/gcp-iam.md`, `infrastructure/data-residency.md`, `infrastructure/supabase-projects.md`

---

## Environment Variables

> **Where env lives — the four-surface model** (full detail in [ENVIRONMENT_INFRASTRUCTURE.md](./ENVIRONMENT_INFRASTRUCTURE.md)):
>
> 1. **EAS dashboard** — build-time `EXPO_PUBLIC_*` for the rn-app
> 2. **Supabase function secrets** — `supabase secrets set <KEY>=<VAL> --project-ref <REF>`
> 3. **Cloud Run env vars** — `gcloud run services update <svc> --update-env-vars KEY=VAL`
> 4. **GCP Secret Manager** — referenced by name from Cloud Run via `--update-secrets`
>
> Rule: each value lives on **one** surface. Code reads via the central env modules: `rn-app/src/config/env.ts`, `admin-app/src/lib/env.ts`, `cloud-run/extraction-service/src/config.ts`. Direct `process.env.X` reads outside these modules are blocked by `npm run lint:env`.

### Mobile App (rn-app)

The rn-app reads `EXPO_PUBLIC_*` env vars through `rn-app/src/config/env.ts`. Three loading paths:

| Path | When | Source |
|---|---|---|
| Local dev | `npx expo start` after `npm run dev:up` | `rn-app/.env.local` (auto-generated) |
| EAS build | `eas build` for development/preview/production profiles | EAS dashboard → Project Settings → Environment Variables |
| OTA update | `eas update --channel <ch>` | EAS dashboard (same as build) |

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL — `127.0.0.1:54321` locally, `api-secured.flent.in` in prod, `zqlowjveyqiagnbmfwsb.supabase.co` for dev branch |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/publishable key (safe to ship in JS bundle) |
| `EXPO_PUBLIC_PAYMENT_GATEWAY` | No | `cashfree` (default) or `payu` (legacy fallback) |
| `EXPO_PUBLIC_CASHFREE_ENV` | No | `SANDBOX` for development/preview, `PRODUCTION` for production |
| `EXPO_PUBLIC_PAYU_KEY` | No | PayU merchant key (only used when `EXPO_PUBLIC_PAYMENT_GATEWAY=payu`) |
| `EXPO_PUBLIC_USE_OTP_ROUTING` | No | `true` enables Twilio routing; `false` falls back to demo OTP |
| `APP_ENV` | No | Set by EAS profiles: `development` / `preview` / `production` |

### Supabase Edge Function Secrets

Set per project: `supabase secrets set KEY=VALUE --project-ref <ref>`. Auto-injected vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are branch-specific — do NOT set manually.

| Variable | Required | Description |
|---|---|---|
| `CASHFREE_APP_ID` | Yes | Cashfree Verification API client ID |
| `CASHFREE_SECRET_KEY` | Yes | Cashfree Verification API secret |
| `CASHFREE_BASE_URL` | Yes | Cashfree verification base URL (`https://api.cashfree.com/verification` for prod) |
| `CASHFREE_PUBLIC_KEY` | Yes | RSA public key for `x-cf-signature` |
| `CASHFREE_PG_APP_ID` | Yes | Cashfree Payment Gateway client ID |
| `CASHFREE_PG_APP_SECRET` | Yes | Cashfree PG secret + webhook HMAC key |
| `CASHFREE_PG_BASE_URL` | Yes | Cashfree PG base URL (`https://api.cashfree.com/pg`) |
| `CASHFREE_SPLIT_WEBHOOK_SECRET` | Yes | **Should be separate from PG secret** — see Phase 7e in cleanup plan; current code has a bug treating PG secret as fallback |
| `PAYU_MERCHANT_KEY` | Optional (legacy) | PayU merchant key — only needed while PayU fallback is alive |
| `PAYU_MERCHANT_SALT` | Optional (legacy) | PayU salt for hash generation |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio for SMS + WhatsApp |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token |
| `TWILIO_MESSAGE_SERVICE_SID` | Yes | Twilio messaging service SID |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (extraction fallback path) |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key for bank account encryption at rest |
| `ADMIN_API_KEY` | Yes | Gates admin-only edge functions (`admin-waitlist`, `admin-fetch-views`, etc.) |
| `API_CLUB_KEY` | Yes | API Club for utility bill fetch (proxied via `api-club-proxy` Cloud Run for IP whitelist) |
| `EXTRACTION_SERVICE_URL` | Optional | Cloud Run extraction-service URL (`-prod` or `-dev`). Unset = in-process extraction |
| `EXTRACTION_SECRET` | Pair-with-URL | Shared secret for X-Extraction-Secret header |
| `CLOUD_RUN_PERCENTAGE` | Optional | 0–100 traffic split to Cloud Run (only on `process-document` decision logic) |
| `STAMP_VERIFICATION_SERVICE_URL` | Optional | Stamp verification Cloud Run URL (set on prod only currently) |
| `STAMP_VERIFICATION_SECRET` | Pair-with-URL | Shared secret for stamp verification |
| `ALLOW_DEMO_AUTH` | Local/dev only | Allows `seed-test-data` and `dev-seed` to seed journey state — must be `false` in prod |

### Cloud Run services (managed via `gcloud run services update`)

Per service: `extraction-service-prod`, `extraction-service-dev`, `stamp-verification-service-prod`, `stamp-verification-service-dev`. Env vars listed in `docs/ENVIRONMENT_INFRASTRUCTURE.md` § "Cloud Run Services".

### Cloudflare Worker

| Variable | Description |
|----------|-------------|
| `SUPABASE_HOST` | Target Supabase host (configured in `wrangler.toml`) |

---

## Key Design Decisions

### Journey-Aware Routing

Rather than using conditional renders or auth guards in layouts, the app uses a single entry-point router (`app/index.tsx`) that resolves the user's current journey state and navigates imperatively. This avoids layout re-mount crashes and ensures deterministic navigation regardless of app state.

### Auth Handled at Entry, Not in Layouts

All `_layout.tsx` files always render their `<Stack>` navigator unconditionally. Auth checks are never placed in layouts because unmounting the native `react-native-screens` container causes crashes on re-mount. The root `index.tsx` handles all auth-based routing.

### PostgREST-First Routing with Edge Function Fallback

The journey router uses a three-tier approach: first, it checks a cached `user_status` from SecureStore for instant routing. If no cache exists, it queries `user_status` directly via PostgREST (which leverages the SDK's built-in token management). If PostgREST fails, it falls back to the `getWaitlistStatus()` edge function. This makes routing resilient to individual service outages.

### Cloudflare Worker over Supabase Custom Domains

Indian ISP DNS blocks on `*.supabase.co` necessitated a proxy solution. Supabase custom domains were attempted but routing never propagated correctly. The Cloudflare Worker approach was instant and reliable, requiring only an environment variable change in the app.

### Direct Imports over Barrel Re-exports in Components

Components inside `src/components/` import other components using direct paths (e.g., `@/src/components/ui/Typography`) rather than the parent barrel (`@/src/components`). This prevents circular dependency issues that manifest as `undefined` imports in Hermes release builds.

### patch-package for Build Compatibility

The project path contains spaces, which breaks several Expo/RN build scripts that use unquoted shell variables. Rather than renaming the project, `patch-package` patches are applied automatically via `postinstall` to quote the relevant paths in `expo-constants`.

---

*Last updated: March 2026*
