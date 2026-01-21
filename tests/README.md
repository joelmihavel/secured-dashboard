# Flent Secured v2 - Testing Infrastructure

This directory contains the testing infrastructure for Flent Secured v2.

## Directory Structure

```
tests/
├── fixtures/                    # JSON test data fixtures
│   ├── payments.json           # Payment test scenarios
│   └── tenancies.json          # Tenancy test data
├── sandbox/                     # Sandbox API integration tests
├── mocks/                       # Static mock response files
└── README.md                    # This file

supabase/
├── seed.sql                     # Database seed data for testing
├── tests/
│   └── database/               # pgTAP database tests
│       ├── 00_setup.sql        # Test environment setup
│       ├── 01_rls_policies.sql # RLS policy tests
│       └── 02_payment_functions.sql # Payment function tests
└── functions/
    └── _tests/                  # Edge Function tests
        ├── helpers/            # Test utilities and mocks
        │   ├── index.ts        # Central export
        │   ├── test-client.ts  # Supabase test client
        │   ├── mock-payu.ts    # PayU mock utilities
        │   ├── mock-cashfree.ts # Cashfree mock utilities
        │   └── mock-twilio.ts  # Twilio mock utilities
        └── *.test.ts           # Test files

.github/workflows/
├── ci-backend.yml              # Backend CI/CD pipeline
├── ci-ios.yml                  # iOS CI/CD pipeline
└── visual-tests.yml            # Visual regression tests

.sauce/
├── xcuitest-config.yml         # Sauce Labs iOS config
└── web-visual-config.yml       # Sauce Labs web config
```

## Quick Start

### Prerequisites

1. **Supabase CLI**: `brew install supabase/tap/supabase`
2. **Deno**: `brew install deno`
3. **Environment**: Copy `.env.example` to `.env.local` and fill in values

### Running Tests

#### Database Tests (pgTAP)
```bash
# Start local Supabase
supabase start

# Run database tests
supabase test db
```

#### Edge Function Tests
```bash
# Run all tests
deno test supabase/functions/_tests/ --allow-all

# Run specific test file
deno test supabase/functions/_tests/payment-webhook.test.ts --allow-all

# Run with coverage
deno test supabase/functions/_tests/ --allow-all --coverage=./coverage
deno coverage ./coverage --lcov > coverage.lcov
```

#### Local Development with Sandbox APIs
```bash
# Start Supabase with seed data
supabase db reset

# Serve Edge Functions locally
supabase functions serve --env-file .env.local
```

## Test Data

### Test Users (from seed.sql)

| ID | Phone | Role | Status |
|----|-------|------|--------|
| `11111111-...` | +919999999901 | Tenant | Verified |
| `22222222-...` | +919999999902 | Landlord | Verified |
| `33333333-...` | +919999999903 | Tenant | Pending |

### Test Tenancies

| ID | User | Status | Monthly Rent |
|----|------|--------|--------------|
| `aaaaaaaa-...` | User 1 | Active | ₹50,000 |
| `bbbbbbbb-...` | User 3 | Pending | ₹45,000 |

### Sandbox Credentials

See `.env.example` for sandbox API credentials:
- **PayU**: `https://sandboxsecure.payu.in`
- **Cashfree**: `https://sandbox.cashfree.com/verification`
- **Twilio**: Test mode with magic codes

## Mock Utilities

### PayU Mocks
```typescript
import { PayUTestScenarios, createMockPayUWebhook } from './helpers';

// Generate success webhook
const payload = PayUTestScenarios.successfulUPI("TXN_123");

// Generate failure webhook
const failed = PayUTestScenarios.failedInsufficientFunds("TXN_456");
```

### Cashfree Mocks
```typescript
import { CashfreeTestScenarios } from './helpers';

// Penny drop success
const pennyDrop = CashfreeTestScenarios.pennyDrop.validAccount();

// Mobile 360 verification
const mobile360 = CashfreeTestScenarios.mobile360.fullData("VER_123");
```

### Twilio Mocks
```typescript
import { TwilioTestScenarios, TWILIO_CONFIG } from './helpers';

// OTP sent
const otpSent = TwilioTestScenarios.verification.otpSentSMS("+919999999901");

// Use test OTP
const testOtp = TWILIO_CONFIG.TEST_OTP; // "123456"
```

## CI/CD Pipelines

### Backend CI (`ci-backend.yml`)
- Creates Supabase preview branch
- Runs pgTAP database tests
- Runs Edge Function unit tests
- Runs sandbox integration tests
- Claude Code review for coverage

### iOS CI (`ci-ios.yml`)
- Builds and runs unit tests
- Runs UI tests on simulator
- SwiftLint check
- Claude Code review

### Visual Tests (`visual-tests.yml`)
- Sauce Labs XCUITest for iOS
- Sauce Labs Playwright for Web
- Cross-browser testing
- Nightly and release trigger

## Coverage Requirements

| Component | Target | Critical |
|-----------|--------|----------|
| Edge Functions | 80% | 100% for payment-* |
| Database (RLS) | 100% | All policies |
| iOS App | 70% | 100% for payments |

## Best Practices

1. **Never use production data** - Always use seed data or fixtures
2. **Sandbox APIs only** - Never hit production payment/verification APIs
3. **Idempotency** - Test webhook deduplication
4. **Security** - Test hash validation, amount tampering
5. **Audit logging** - Verify all state changes are logged

## Troubleshooting

### "Database not seeded"
```bash
supabase db reset
```

### "Edge Function not found"
```bash
supabase functions serve --env-file .env.local
```

### "Sandbox API error"
Check credentials in `.env.local` match sandbox environment.

## Related Documentation

- [TESTING_HOLYGRAIL.md](../docs/TESTING_HOLYGRAIL.md) - Complete testing guide
- [BACKEND_ARCHITECTURE.md](../docs/BACKEND_ARCHITECTURE.md) - Backend architecture
- [Supabase Testing](https://supabase.com/docs/guides/testing)
