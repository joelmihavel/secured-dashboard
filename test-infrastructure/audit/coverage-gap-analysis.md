# Coverage Gap Analysis - Flent Secured

> Maps CSV test plan categories to current Jest/code coverage status.
> **Last updated**: _[DATE]_

---

## Category Legend

| Code | Category | Description |
|------|----------|-------------|
| HJ | Happy Journey | Core user flows working end-to-end |
| UI | UI Parity | Figma-to-code visual match |
| EC | Edge Cases | Error handling, boundary conditions |
| SEC | Security | RLS, auth, data isolation |
| PERF | Performance | Load times, animations, memory |
| INT | Integration | Backend API integration correctness |
| NAV | Navigation | Route transitions, deep links, back behavior |
| STATE | State Management | Zustand stores, React Query cache |
| OFFLINE | Offline | Network failure handling, retry logic |
| A11Y | Accessibility | Screen reader, contrast, touch targets |

---

## Coverage Matrix

### Authentication Flow

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Sign up with valid phone | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| OTP entry (correct) | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| OTP entry (incorrect) | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| OTP expiry | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| OTP resend | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Rate limiting | SEC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Waitlist Flow

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| New user lands on waitlist | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Waitlist approval transition | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Already approved user skips waitlist | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Agreement Flow

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Upload agreement photo | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Review extracted info | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Edit extracted fields | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Corrupt file upload | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Large file upload | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Setup Flow

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Add bank account | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Add utility | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Invite landlord | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Skip optional steps | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Invalid IFSC | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Penny drop verification | INT | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Home Dashboard

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Dashboard loads with data | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Rent due card display | UI | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Cashback balance | UI | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Overdue state | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Pull to refresh | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Empty state (no payments yet) | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Payment Flow

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Enter rent amount | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Select payment method (UPI) | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Select payment method (Card) | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Select payment method (Netbanking) | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Payment success | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Payment failure | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Payment processing timeout | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Webhook processing | INT | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Duplicate payment prevention | SEC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Profile

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| View profile | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Edit profile | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| View payment methods | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Delete account | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Cross-tenant data isolation | SEC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Transactions

| Test Case | Category | Unit Test | Integration Test | Manual Test | Status |
|-----------|----------|-----------|-----------------|-------------|--------|
| Transaction list | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Transaction detail | HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Empty transaction list | EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| Pagination / infinite scroll | PERF | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Gap Summary

| Category | Total Cases | Covered | Gaps | Coverage % |
|----------|-------------|---------|------|------------|
| HJ | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| UI | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| EC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| SEC | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| PERF | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| INT | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| NAV | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| STATE | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| OFFLINE | _TBD_ | _TBD_ | _TBD_ | _TBD_ |
| A11Y | _TBD_ | _TBD_ | _TBD_ | _TBD_ |

---

## Priority Actions

1. _[To be filled after running jest --coverage and analyzing results]_
2. _..._
3. _..._
