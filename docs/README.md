# Flent Secured

Flent Secured is a mobile fintech application that enables tenants in India to pay rent digitally via UPI, credit/debit cards, and net banking -- and earn 1% cashback on timely payments. The app manages the full tenant lifecycle: identity verification, rent agreement extraction, landlord onboarding, payment processing, and cashback disbursement.

**Current version:** 2.1.1
**Platform:** iOS (React Native)
**Target market:** India (Mumbai initially, expanding to other cities)
**Bundle ID:** `in.flent.secured`

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

- **Payment Processing** -- Rent payments through PayU India gateway supporting UPI, credit cards, debit cards, and net banking. Payments are tracked end-to-end with webhook confirmation.

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
| Database | PostgreSQL 15 (Supabase) | Primary data store with RLS |
| Functions | Supabase Edge Functions (Deno) | 78 serverless API endpoints |
| Auth | Supabase Auth | Phone/OTP-based authentication via Twilio |
| Storage | Supabase Storage | Rent agreement PDFs, avatars |
| Realtime | Supabase Realtime | Live updates (extraction status, payment status) |
| Cron | pg_cron | Scheduled jobs (cashback expiry, stale payment cleanup, settlement polling) |

### External Services

| Service | Purpose |
|---------|---------|
| PayU India | Payment gateway (UPI, cards, net banking) |
| Google Gemini 1.5 Flash | AI-powered rent agreement data extraction |
| Twilio | WhatsApp messages and SMS for landlord invites, notifications, and OTP |
| Resend | Transactional email delivery for landlord notifications |
| Expo Push API | Push notification delivery to registered devices |
| Expo EAS | Cloud builds, OTA updates, app submission |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Proxy | Cloudflare Workers | Reverse proxy for ISP bypass (`devapi.flent.in`) |
| Builds | EAS Build | iOS simulator, device, preview, and production builds |
| Updates | EAS Update | Over-the-air JavaScript bundle updates |
| Admin | Google Apps Script | Admin dashboard auto-sync with Google Sheets |

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

Detailed documentation for each subsystem is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [Backend Edge Functions](./backend/edge-functions.md) | Complete reference for all 78 Supabase edge functions |
| [Database Schema](./backend/database-schema.md) | PostgreSQL table definitions, RLS policies, triggers, and cron jobs |
| [Frontend Screens and Routing](./frontend/screens-and-routing.md) | Screen inventory, route groups, navigation flow, and layout structure |
| [Components Library](./frontend/components.md) | UI component catalog with props, usage examples, and design tokens |
| [State Management](./frontend/state-management.md) | Zustand stores, React Query patterns, and data flow architecture |
| [Payment and Cashback Architecture](./backend/payment-and-cashback-architecture.md) | Payment lifecycle, PayU integration, fee system, cashback system, receipts |
| [Screen-to-Backend Map](./screen-backend-map.md) | Maps every screen to its backend edge functions, queries, and data flow |
| [Infrastructure](./infrastructure/cloudflare-and-deployment.md) | Cloudflare Worker config, EAS build setup, OTA updates, and DNS |

---

## Environment Variables

### Mobile App (rn-app/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL (via CF Worker: `https://devapi.flent.in`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key for client-side auth |
| `EXPO_PUBLIC_PAYU_KEY` | Yes | PayU merchant key for payment gateway |

### EAS Build Secrets

These are configured in the EAS dashboard (not committed to source):

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase URL (set per build profile) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_PAYU_KEY` | PayU merchant key |

### Supabase Edge Function Secrets

These are configured in the Supabase dashboard under Project Settings > Edge Functions:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Internal Supabase URL (used for server-to-server calls) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full database access, bypasses RLS) |
| `PAYU_MERCHANT_KEY` | PayU merchant key |
| `PAYU_MERCHANT_SALT` | PayU merchant salt (for hash generation) |
| `GEMINI_API_KEY` | Google Gemini API key (for agreement extraction) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_MESSAGE_SERVICE_SID` | Twilio messaging service SID |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp sender number |
| `CASHFREE_APP_ID` | Cashfree M360 application ID |
| `CASHFREE_SECRET_KEY` | Cashfree M360 secret key |
| `RESEND_API_KEY` | Resend email API key |
| `ENCRYPTION_KEY` | AES-256-GCM encryption key for bank details at rest |
| `API_CLUB_KEY` | API Club key for utility bill fetching |

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
