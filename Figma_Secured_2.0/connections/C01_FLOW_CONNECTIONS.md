# C01: Flow Connections Map

---
doc_type: connection
status: approved
---

## 🗺️ Master Flow Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SECURED - FLOW CONNECTIONS                              │
│                                                                                         │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                           TENANT MOBILE APP                                     │  │
│   │                                                                                 │  │
│   │   ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐              │  │
│   │   │   F01   │      │   F03   │      │   F04   │      │   F05   │              │  │
│   │   │Onboard- │─────►│ Payment │─────►│ Aadhaar │      │Referral │              │  │
│   │   │  ing    │      │  Flow   │      │   KYC   │      │  Flow   │              │  │
│   │   └────┬────┘      └────┬────┘      └─────────┘      └─────────┘              │  │
│   │        │                │                                                      │  │
│   └────────┼────────────────┼──────────────────────────────────────────────────────┘  │
│            │                │                                                          │
│            │ Invitation     │ 3 Payments                                               │
│            ▼                ▼                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                           LANDLORD WEB PORTAL                                   │  │
│   │                                                                                 │  │
│   │   ┌─────────┐      ┌─────────┐                                                 │  │
│   │   │   F02   │      │   F06   │                                                 │  │
│   │   │Landlord │─────►│ Vacancy │                                                 │  │
│   │   │  Web    │      │  Cover  │                                                 │  │
│   │   └────┬────┘      └─────────┘                                                 │  │
│   │        │                                                                        │  │
│   └────────┼────────────────────────────────────────────────────────────────────────┘  │
│            │                                                                            │
│            │ Confirmation                                                               │
│            ▼                                                                            │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              BACKEND SERVICES                                   │  │
│   │                                                                                 │  │
│   │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │  │
│   │   │ PayU    │  │Cashfree │  │ Google  │  │  SHCIL  │  │ Notifi- │            │  │
│   │   │ Split   │  │  M360   │  │ Vision  │  │  Stamp  │  │ cations │            │  │
│   │   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │  │
│   │                                                                                 │  │
│   └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Flow Dependencies

### F01: Tenant Onboarding

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| Agreement verified | F02: Landlord Web | Always | `tenancy_id`, landlord contact |
| Profile incomplete | F04: Aadhaar KYC | Optional | `user_id` |

**Blocks:**
- F03 (Payment) - Until landlord confirms

---

### F02: Landlord Web

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| Tenancy confirmed | F01 state update | Always | `landlord_id`, confirmation status |
| Cover accepted | F06: Vacancy Cover | If accepted | `cover_id` |
| Bank verified | F03 enablement | Always | `payu_child_merchant_key` |

**Receives:**
- Invitation from F01

---

### F03: Payment

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| 3rd payment success | F06: Cover activation | If cover accepted | `payment_count` |
| Payment success | Wallet update | Always | `cashback_amount` |
| Payment success | Notifications | Always | `payment_details` |

**Requires:**
- F01 complete
- F02 complete (landlord confirmed)

---

### F04: Aadhaar KYC

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| KYC complete | Cashback unlock | Always | `aadhaar_verified` |

**Optional flow - not blocking**

---

### F05: Referral

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| Referral success | Wallet credit | Both parties complete | `bonus_amount` |

**Independent flow**

---

### F06: Vacancy Cover

| Triggers | Target | Condition | Data Passed |
|----------|--------|-----------|-------------|
| Claim submitted | Manual review | When claim | `claim_id` |

**Receives:**
- Activation trigger from F03

---

## 📊 State Dependency Matrix

```
┌────────────────────┬────────────────────────────────────────────────────────────┐
│                    │                    DEPENDS ON                              │
│     FLOW           ├──────────┬──────────┬──────────┬──────────┬──────────────┤
│                    │   F01    │   F02    │   F03    │   F04    │   F05        │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F01: Onboarding    │    -     │    -     │    -     │    -     │      -       │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F02: Landlord      │    ✓     │    -     │    -     │    -     │      -       │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F03: Payment       │    ✓     │    ✓     │    -     │    -     │      -       │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F04: KYC           │    ✓     │    -     │    -     │    -     │      -       │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F05: Referral      │    ✓     │    -     │    -     │    -     │      -       │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ F06: Vacancy Cover │    ✓     │    ✓     │    ✓*    │    -     │      -       │
└────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘

✓ = Required dependency
✓* = Required for activation (3 payments)
- = No dependency
```

---

## 🔄 Event Triggers

### System Events

| Event | Source | Triggers | Actions |
|-------|--------|----------|---------|
| `AGREEMENT_VERIFIED` | F01 | F02 | Create invitation, send notifications |
| `LANDLORD_CONFIRMED` | F02 | F01, F03 | Update tenancy status, enable payments |
| `PAYMENT_SUCCESS` | F03 | F06, Wallet | Credit cashback, update cover count |
| `COVER_ACTIVATED` | F06 | Notifications | Alert landlord |
| `PAYMENT_WINDOW_OPEN` | Cron | F03 | Enable payment button, send reminder |
| `INVITATION_EXPIRED` | Cron | F02 | Notify tenant |

### Notification Triggers

| Event | Recipients | Channels | Template |
|-------|------------|----------|----------|
| Agreement uploaded | Tenant | Push | `agreement_processing` |
| Agreement verified | Tenant | Push, Email | `agreement_verified` |
| Invitation sent | Landlord | Email, SMS, WhatsApp | `landlord_invitation` |
| Landlord confirmed | Tenant | Push, Email | `landlord_confirmed` |
| Payment successful | Tenant, Landlord | Push, Email | `payment_success` |
| Settlement complete | Landlord | Push, SMS | `settlement_complete` |
| Cover activated | Landlord | Email, SMS | `cover_activated` |
| Payment window open | Tenant | Push | `payment_reminder` |
| Payment overdue | Tenant | Push, SMS | `payment_overdue` |

---

## 🧭 User Journey Paths

### Path 1: Happy Path (New Tenant)

```
Day 1:
├── Download app
├── Enter phone → OTP
├── Consent → M360 data fetch
├── Confirm profile
├── Upload agreement
├── OCR processing
├── Confirm details
└── Landlord invitation sent

Day 1-3:
└── Waiting for landlord

Day 2 (Landlord):
├── Receive email/SMS
├── Open link
├── OTP verification
├── Confirm tenancy
├── Accept vacancy cover
├── Add bank details
└── Completed

Day 2 (Tenant):
└── Push notification: "Landlord confirmed!"

Day 1 of Month:
├── Payment window opens
├── Open app → Pay rent card active
├── Tap pay → Summary screen
├── Apply cashback (if any)
├── Select payment method
├── PayU checkout
├── Payment success
├── Cashback credited (pending)
└── Receipt available

Day 3 of Month:
└── Landlord receives settlement

After 3 Payments:
└── Vacancy cover activates
```

### Path 2: Landlord Doesn't Respond

```
Day 1:
└── Tenant completes onboarding, invitation sent

Day 3:
└── Auto-reminder #1 to landlord

Day 5:
└── Auto-reminder #2 to landlord

Day 7:
├── Token expires
└── Notify tenant to resend

Day 8:
├── Tenant taps "Remind landlord"
└── New invitation sent

...continues until confirmed or tenant gives up
```

### Path 3: Payment Failure

```
Payment Window:
├── Tenant initiates payment
├── Reaches PayU checkout
├── Payment fails (insufficient funds)
├── Error screen shown
│
├── Option A: Retry
│   └── Back to payment method selection
│
├── Option B: Different method
│   └── Select another payment method
│
└── Option C: Later
    └── Back to home (payment still due)
```

---

## 🚦 Blocking States

### Tenant App Blocks

| State | Blocked Action | Resolution |
|-------|----------------|------------|
| `PENDING_LANDLORD` | Payment | Wait for landlord confirmation |
| `AGREEMENT_PENDING` | Full access | Complete agreement upload |
| `OUTSIDE_PAYMENT_WINDOW` | Payment | Wait for 1st of month |
| `ALREADY_PAID_THIS_MONTH` | Payment | Wait for next month |
| `KYC_REQUIRED` | Cashback redemption | Complete Aadhaar KYC |

### Landlord Web Blocks

| State | Blocked Action | Resolution |
|-------|----------------|------------|
| `TOKEN_EXPIRED` | Confirmation | Request new link |
| `OTP_BLOCKED` | Verification | Wait 15 minutes |
| `BANK_VERIFICATION_FAILED` | Complete setup | Retry bank details |
| `PAYU_ONBOARDING_PENDING` | Receive payments | Wait for PayU KYC |

---

## 📱 Deep Links

### Mobile App

| Deep Link | Target | Parameters |
|-----------|--------|------------|
| `secured://home` | Home screen | - |
| `secured://pay` | Payment flow | `tenancy_id` |
| `secured://receipt/{id}` | Receipt view | `payment_id` |
| `secured://wallet` | Cashback wallet | - |
| `secured://referral` | Referral screen | `code` (optional) |
| `secured://profile` | Profile | - |

### Web Portal

| URL | Target | Parameters |
|-----|--------|------------|
| `landlord.secured.app/confirm/{token}` | Confirmation flow | `token` |
| `landlord.secured.app/dashboard` | Landlord dashboard | (future) |

---

## 🔄 Cron Jobs

| Job | Schedule | Action |
|-----|----------|--------|
| `payment_window_reminder` | 1st of month, 9 AM | Notify tenants |
| `payment_overdue_reminder` | 5th of month, 9 AM | Notify unpaid tenants |
| `invitation_expiry_check` | Daily, midnight | Expire old tokens, notify |
| `landlord_reminder` | Every 2 days | Remind unconfirmed landlords |
| `cashback_expiry` | Daily, midnight | Expire old cashback |
| `settlement_status_sync` | Every 4 hours | Sync PayU settlement status |

---

## 🧪 Testing Scenarios

### End-to-End Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Complete onboarding | F01 → F02 → F03 | Payment successful |
| Cashback redemption | F01 → F02 → F03 → F03 (with cashback) | Reduced payment |
| Cover activation | F01 → F02 → F03 × 3 | Cover status = ACTIVE |
| Landlord timeout | F01 → Wait 7 days | Token expired, tenant notified |
| Payment retry | F03 fail → F03 retry | Success on retry |

### Integration Tests

| Integration | Test | Expected |
|-------------|------|----------|
| Cashfree M360 | OTP + data fetch | Profile populated |
| Google Vision | OCR upload | Text extracted |
| SHCIL | Stamp verification | Valid/invalid response |
| PayU | Split payment | Settlement released |
| PayU | Webhook | Status updated |

---

## 📊 Monitoring Points

| Flow | Metric | Alert Threshold |
|------|--------|-----------------|
| F01 | Onboarding completion rate | < 50% |
| F01 | OCR success rate | < 90% |
| F02 | Landlord confirmation rate | < 40% (7 days) |
| F03 | Payment success rate | < 95% |
| F03 | Settlement release time | > 5 minutes |
| F06 | Cover activation rate | < 80% |

