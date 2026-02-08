# User Journeys Documentation
## Flent Secured - Complete User Flow Analysis

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-02-01 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document maps all critical user journeys through the Flent Secured app. Each journey includes:
- Screen-by-screen flow
- Decision points and branches
- Expected outcomes
- Edge case triggers

---

## Journey 1: New User Onboarding (P0)

### Flow Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Splash    │────►│  Carousel   │────►│   Sign Up   │
│ (Get Started)│     │ (3 slides)  │     │(Phone+Name) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           │ Skip               │ Valid Input
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Sign Up   │◄────│     OTP     │
                    │             │     │ Verification │
                    └─────────────┘     └─────────────┘
                                               │
                                               │ Valid OTP
                                               ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Agreement  │────►│  Agreement  │
                    │   Upload    │     │   Review    │
                    └─────────────┘     └─────────────┘
                                               │
                                               │ Submit
                                               ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Waitlist   │────►│    Home     │
                    │   Status    │     │ (Zero State)│
                    └─────────────┘     └─────────────┘
```

### Screens & Transitions

| Step | Screen | Figma Node | Action | Next Screen |
|------|--------|------------|--------|-------------|
| 1 | Splash | 1-28055 | Tap "Get Started" | Carousel |
| 1a | Splash | 1-28055 | Tap "Log in" | Sign Up (returning) |
| 2 | Carousel Slide 1 | 1-28071 | Swipe/Tap Next | Carousel Slide 2 |
| 3 | Carousel Slide 2 | 1-28985 | Swipe/Tap Next | Carousel Slide 3 |
| 4 | Carousel Slide 3 | 1-29025 | Tap "Continue" | Sign Up |
| 4a | Carousel (any) | 1-29065 | Tap "Skip" | Sign Up |
| 5 | Sign Up | 1-29108 | Enter phone + name | Sign Up (filled) |
| 6 | Sign Up (filled) | 1-31073 | Toggle consent ON | Sign Up (ready) |
| 7 | Sign Up (ready) | 1-31590 | Tap "Get Started" | OTP Modal |
| 8 | OTP Modal | 1-29025 | Enter 6-digit OTP | Processing |
| 9 | Processing | 41-9460 | Auto (1-2s) | Agreement Upload |
| 10 | Agreement Upload | 1-30090 | Upload PDF | Agreement Review |
| 11 | Agreement Review | 1-30001 | Tap "Proceed" | Waitlist Status |
| 12 | Waitlist Status | 41-11206 | View status | Home (when approved) |

### Expected Outcomes

**Happy Path:**
- User completes onboarding in 3-5 minutes
- User lands on Waitlist screen with "Application in review" status
- Member count and referral code input visible
- User can enter referral code for priority access

**Alternative Paths:**
- Skip carousel → Direct to Sign Up
- Existing user → Login flow (separate journey)
- Referral code entry → Priority waitlist position

### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Phone | 10 digits, numeric only | "Enter a valid 10-digit number" |
| Phone | Unique (not registered) | "This number already exists" |
| Name | Min 2 characters | "Name is too short" |
| Consent | Must be ON | Button disabled until toggled |
| OTP | 6 digits | Auto-validated on 6th digit |
| Agreement | PDF only, max 10MB | "Invalid file format" |

---

## Journey 2: Rent Payment - UPI (P0)

### Flow Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Home     │────►│  Payment    │────►│  Payment    │
│ (Active)    │     │ Transaction │     │  Methods    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │ Review            │ View breakdown     │ Select UPI
       ▼                   ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Payment    │◄────│    UPI      │◄────│  Method     │
│  Success    │     │ Processing  │     │  Selected   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ Done
       ▼
┌─────────────┐
│    Home     │
│(Paid State) │
└─────────────┘
```

### Screens & Transitions

| Step | Screen | Figma Node | Action | Next Screen |
|------|--------|------------|--------|-------------|
| 1 | Home (Active) | 243-5870 | Tap "Review" | Payment Transaction |
| 2 | Payment Transaction | 41-9681 | View rent breakdown | - |
| 3 | Payment Transaction | 41-9681 | Toggle cashback ON/OFF | - |
| 4 | Payment Transaction | 41-9681 | Tap "Pay ₹X now" | Payment Methods |
| 5 | Payment Methods | 243-3923 | Tap UPI card | UPI Selected |
| 6 | UPI Selected | 243-4008 | Tap "Continue" | UPI Processing |
| 7 | UPI Processing | 243-4062 | UPI app opens | External UPI |
| 8 | External UPI | N/A | Complete payment | Callback |
| 9 | Processing | TBD | Realtime status | Success/Failure |
| 10 | Payment Success | 243-4258 | Tap "Done" | Home (Paid) |

### Payment Breakdown Display

```
┌────────────────────────────────────┐
│ Rent due in 28 days                │
│ Complete setup to unlock cashback  │
│ ┌──────────────────────────────┐   │
│ │ ₹350 available to unlock     │   │
│ └──────────────────────────────┘   │
├────────────────────────────────────┤
│ # Base rent           ₹ 30,000     │
│ # Maintenance         ₹  2,500     │
├────────────────────────────────────┤
│ # Total Rent          ₹ 32,500     │
│ # Cashback 🔒         -₹    325    │
├────────────────────────────────────┤
│ # Payable Rent        ₹ 32,500     │
└────────────────────────────────────┘
│       [ Pay ₹32,500 now ]          │
│ Finish setup in 28:12:12 to be     │
│ eligible for ₹350 cashback         │
└────────────────────────────────────┘
```

### Cashback Rules

| Condition | Eligibility | Amount |
|-----------|-------------|--------|
| Payment before 7th | Eligible | 1% of rent |
| Payment after 7th | Not eligible | ₹0 |
| Verification incomplete | Locked | Shows potential |
| Maximum cap | Applied | ₹10,000 |
| Cashback toggle OFF | Skipped | Full rent paid |

---

## Journey 3: Rent Payment - Net Banking (P0)

### Flow Diagram
```
Home → Payment Transaction → Payment Methods → Net Banking Selected →
Bank Selection → Bank Login (External) → OTP Verification (Bank) →
Processing → Success → Home (Paid)
```

### Key Differences from UPI
- Bank selection dropdown required
- External browser/app redirect
- Longer processing time (30s-2min)
- Different error handling for bank timeouts

---

## Journey 4: Rent Payment - Credit Card (P1)

### Prerequisites
- User status must be "complete" (not just "qualified")
- Credit card payment method added in profile

### Flow
```
Home → Payment Transaction → Payment Methods → Credit Card Selected →
CVV Entry → 3D Secure (External) → Processing → Success → Home (Paid)
```

### Additional Fees
- Credit card fee: 2% + GST
- Clearly displayed before confirmation

---

## Journey 5: Verification Setup (P0)

### Flow Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Home     │────►│   Setup     │────►│    Add      │
│ (Zero State)│     │   Sheet     │     │ Bank Details│
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           │                    │ IFSC + Account
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Invite    │◄────│   Upload    │
                    │  Landlord   │     │Address Proof│
                    └─────────────┘     └─────────────┘
                           │
                           │ Send Invite
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Invitation │────►│    Home     │
                    │   Pending   │     │(Active State)│
                    └─────────────┘     └─────────────┘
```

### Verification Steps (3 Required)

| Step | Name | Action | Verification Method |
|------|------|--------|---------------------|
| 1 | Add Landlord's Bank | Enter IFSC + Account | Penny drop |
| 2 | Upload Address Proof | Upload utility bill | Manual review |
| 3 | Invite Landlord | Send email/SMS | Landlord confirmation |

### Screens & Transitions

| Step | Screen | Figma Node | Action | Next Screen |
|------|--------|------------|--------|-------------|
| 1 | Home (Zero) | 243-6731 | Tap "Finish Setup" | Setup Sheet |
| 2 | Setup Sheet | 243-6731 | Tap "Add landlord's bank" | Bank Entry |
| 3 | Bank Entry | TBD | Enter IFSC code | Bank Details |
| 4 | Bank Details | TBD | Enter account number | Verification |
| 5 | Verification | TBD | Auto penny drop | Success/Retry |
| 6 | Setup Sheet | 243-6731 | Tap "Upload address proof" | Upload |
| 7 | Upload | TBD | Select utility bill | Preview |
| 8 | Preview | TBD | Confirm upload | Success |
| 9 | Setup Sheet | 243-6731 | Tap "Invite landlord" | Invite Form |
| 10 | Invite Form | TBD | Enter landlord email | Send |
| 11 | Send | TBD | Tap "Send Invite" | Pending |

### Landlord Invitation States

| State | Display | User Action |
|-------|---------|-------------|
| Not Sent | "Invite your landlord" | Can send |
| Sent | "Invitation sent" | Wait |
| Pending (<24h) | "Waiting for response (X hrs)" | Wait |
| Pending (>24h) | "Reminder available" | Can resend |
| Accepted | "Landlord confirmed" | None |
| Declined | "Landlord declined" | Contact support |

---

## Journey 6: Profile Management (P1)

### Flow
```
Home → Profile (tap avatar) → Profile Main → [Edit Details / Payment Methods / Support]
```

### Profile Sections

1. **Payment History Chart**
   - Visual bar chart: On time / Paid late / Not Paid
   - Months: JAN - MAY displayed

2. **Secured Account**
   - User name and creation date
   - View Agreement link

3. **Payment Information**
   - Edit UPI Method
   - Edit Credit Card
   - Edit Bank Account

4. **Support**
   - Contact Support
   - Rate the App

5. **App**
   - Sign Out
   - Delete Account

---

## Journey 7: Transaction History (P1)

### Flow
```
Home → Recent Payments tab → Transaction List → Transaction Detail
```

### Transaction States

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| Completed | ✓ | Green | Payment successful |
| Processing | ⟳ | Orange | Payment in progress |
| Failed | ✗ | Red | Payment failed |
| Refunded | ↩ | Blue | Amount refunded |

---

## Journey 8: Returning User Login (P0)

### Flow
```
Splash → Sign Up (Login mode) → Phone Entry → OTP → Home
```

### Key Differences from New User
- No carousel shown
- No agreement upload
- Directly to Home after OTP
- Home state based on user status

---

## Journey 9: Password Reset / Account Recovery (P2)

### Flow
```
Sign Up → Forgot Password → Phone Entry → OTP → Password Reset → Login
```

*Note: Current implementation uses OTP-only authentication, no password.*

---

## Journey 10: Account Deletion (P2)

### Flow
```
Profile → Delete Account → Confirmation Modal → OTP Verification →
Account Deleted → Splash
```

### Data Deletion Policy
- All personal data removed within 30 days
- Payment history anonymized for records
- Cannot be undone

---

## Journey 11: Deep Link Handling (P1)

### Supported Deep Links

| Link | Destination | Parameters |
|------|-------------|------------|
| `flent://payment` | Payment Transaction | tenancyId |
| `flent://profile` | Profile | - |
| `flent://verify` | Verification Setup | step |
| `flent://invite/accept` | Landlord Accept | token |

### Deep Link Flow
```
External Link → App Launch → Auth Check → Route to Destination
```

---

## Journey 12: Push Notification Actions (P1)

### Notification Types & Actions

| Type | Tap Action | Destination |
|------|------------|-------------|
| Payment Due | Open payment | Payment Transaction |
| Payment Success | View receipt | Transaction Detail |
| Payment Failed | Retry | Payment Transaction |
| Landlord Accepted | View home | Home (Active) |
| Referral Bonus | View cashback | Cashback tab |

---

## Journey Matrix

| Journey | Priority | Screens | Est. Test Cases |
|---------|----------|---------|-----------------|
| New User Onboarding | P0 | 12 | 25 |
| Payment - UPI | P0 | 8 | 20 |
| Payment - Net Banking | P0 | 10 | 15 |
| Payment - Credit Card | P1 | 10 | 15 |
| Verification Setup | P0 | 10 | 18 |
| Profile Management | P1 | 6 | 12 |
| Transaction History | P1 | 4 | 8 |
| Returning User Login | P0 | 4 | 10 |
| Account Recovery | P2 | 5 | 8 |
| Account Deletion | P2 | 4 | 6 |
| Deep Link Handling | P1 | - | 12 |
| Push Notifications | P1 | - | 10 |

**Total Estimated Test Cases: ~159**

---

## Appendix: Screen State Mapping

### Home Screen States (20+)

| State | Condition | Visual Indicator |
|-------|-----------|------------------|
| Zero State | No verifications | Setup prompts |
| Zero + UPI | UPI added, no verify | Partial setup |
| Zero + Cashback | Cashback available | Cashback badge |
| Active Qualified | Bank verified | Can pay |
| Active Complete | All verified | Full features |
| Late Payment | After 7th | Warning banner |
| Missed Payment | 30+ days | Overdue alert |
| Multiple Missed | 60+ days | Escalation notice |
| Paid This Month | Payment complete | Success state |

---

*Document generated: 2026-01-31*
*Next review: When Figma designs update*
