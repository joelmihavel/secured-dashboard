# Flent Secured - Test Infrastructure

Centralized test infrastructure for the Flent Secured React Native app. Contains phone allocations, sandbox test data, SQL audit scripts, release checklists, and team onboarding guides.

---

## Overview

This directory lives alongside `rn-app/` and provides everything needed to:
- Seed and manage test users across QA, CI, and Apple Review
- Run database integrity and security audits
- Execute production release checklists
- Onboard new testers with allocated phone numbers

---

## Quick Start

### 1. Set the DEMO_PHONES Supabase Secret

Copy the value from `phone-config/phone-allocation.json` > `demo_phones_secret_value` and set it:

```bash
supabase secrets set DEMO_PHONES="9999900001:123456,9999900002:654321,..." --project-ref zqlowjveyqiagnbmfwsb
```

### 2. Seed a Test User

```bash
# Seed Apple Review user (pre-seeded active state)
./scripts/seed-apple-review.sh

# Seed a specific test user by phone
./scripts/seed-test-user.sh +919999900001
```

### 3. Run the App

```bash
cd ../rn-app
npx expo start
```

### 4. Log In

Open the app, enter the test phone number and its corresponding OTP from the phone allocation table.

---

## Phone Allocation

See [`phone-config/phone-allocation.json`](phone-config/phone-allocation.json) for the full allocation table.

**Summary:**
| Tester | Phones | Range |
|--------|--------|-------|
| Primary QA | 4 phones | +919999900001 - 00004 |
| Tester 2 | 4 phones | +919999900005 - 00008 |
| Tester 3 | 4 phones | +919999900009 - 00012 |
| Tester 4 | 4 phones | +919999900013 - 00016 |
| Apple Review | 1 phone | +919999900017 |
| CI / Automation | 3 phones | +919999900018 - 00020 |

Each tester has 4 roles: Active/Home, Setup/Waitlist, Edge Cases, Cleanup.

---

## Scripts Reference

| Script | Description | Usage |
|--------|-------------|-------|
| `scripts/seed-apple-review.sh` | Seed the Apple Review demo account | `./scripts/seed-apple-review.sh` |
| `scripts/seed-test-user.sh` | Seed a single test user to a specific state | `./scripts/seed-test-user.sh <phone>` |
| `scripts/cleanup-test-data.sh` | Remove all test user data from database | `./scripts/cleanup-test-data.sh` |

---

## Sandbox Test Data

| File | Contents |
|------|----------|
| [`sandbox-data/payu-test-cards.json`](sandbox-data/payu-test-cards.json) | PayU sandbox cards (Visa, Mastercard), UPI VPAs, netbanking codes |
| [`sandbox-data/cashfree-sandbox.json`](sandbox-data/cashfree-sandbox.json) | Cashfree M360 identity, payouts, PAN verification test data |
| [`sandbox-data/bank-test-data.json`](sandbox-data/bank-test-data.json) | Test bank accounts for penny drop verification |

---

## SQL Audit Scripts

Run these in the Supabase SQL Editor or via `psql`.

| Script | Purpose |
|--------|---------|
| [`sql/orphan-check.sql`](sql/orphan-check.sql) | Find orphaned records across all FK relationships (17 checks) |
| [`sql/rls-verify.sql`](sql/rls-verify.sql) | Verify RLS: cross-tenant isolation, service role bypass, anon denied |
| [`sql/stale-data-audit.sql`](sql/stale-data-audit.sql) | Find test data artifacts that should not exist in production |

---

## CSV Test Plan

The `test-cases/` directory contains CSV test plans organized by app flow. To use:

1. Import any `.csv` file into Google Sheets
2. Columns: Test ID, Category, Flow, Test Case, Steps, Expected Result, Priority, Status
3. Categories: HJ (Happy Journey), UI, EC (Edge Cases), SEC (Security), PERF, INT (Integration)

---

## Apple Review

See [`apple-review/README.md`](apple-review/README.md) for the step-by-step guide provided to Apple reviewers.

**Before submitting to App Store:**
1. Run `scripts/seed-apple-review.sh` to ensure the review account is seeded
2. Copy login credentials from `apple-review/README.md` into App Store Connect review notes
3. Verify the account works by logging in with +91 99999 00017 / OTP 303030

---

## Production Release

See [`release/pre-release-checklist.md`](release/pre-release-checklist.md) for the full checklist.

**Key steps:**
1. Run `sql/stale-data-audit.sql` against production (must return 0 test artifacts)
2. Verify `DEMO_PHONES` is NOT set in production environment
3. Run `sql/rls-verify.sql` to confirm cross-tenant isolation
4. Complete all P0 checklist items before submission

---

## Backend Manual Steps: DEMO_PHONES Secret

The `DEMO_PHONES` Supabase secret controls which phone numbers bypass real SMS OTP.

**To update:**
```bash
# Get current value
supabase secrets list --project-ref zqlowjveyqiagnbmfwsb

# Set new value (comma-separated phone:otp pairs, 10-digit phones without +91)
supabase secrets set DEMO_PHONES="9999900001:123456,9999900002:654321,..." \
  --project-ref zqlowjveyqiagnbmfwsb

# For production: unset or set empty
supabase secrets unset DEMO_PHONES --project-ref zqlowjveyqiagnbmfwsb
```

**Format**: `<10-digit-phone>:<6-digit-otp>` pairs separated by commas. No spaces. No `+91` prefix.

---

## Directory Structure

```
test-infrastructure/
  README.md                          # This file
  phone-config/
    phone-allocation.json            # All test phone numbers and OTPs
  sandbox-data/
    payu-test-cards.json             # PayU sandbox payment instruments
    cashfree-sandbox.json            # Cashfree sandbox test data
    bank-test-data.json              # Test bank accounts for penny drop
  sql/
    orphan-check.sql                 # FK integrity checks (17 queries)
    rls-verify.sql                   # RLS cross-tenant isolation tests
    stale-data-audit.sql             # Find test data in production
  scripts/
    seed-apple-review.sh             # Seed Apple Review demo account
    seed-test-user.sh                # Seed individual test user
    cleanup-test-data.sh             # Remove all test data
  apple-review/
    README.md                        # Apple reviewer login guide
    seed-apple-review.sh             # Symlink -> ../scripts/seed-apple-review.sh
  release/
    pre-release-checklist.md         # Full production release checklist
  audit/
    jest-test-audit.md               # Jest coverage audit template
    coverage-gap-analysis.md         # Category-to-coverage mapping template
  test-cases/
    *.csv                            # CSV test plans by flow
```
