# Secured v2 - Product Brainstorming Document

> **Purpose:** Comprehensive product brainstorming before visual design. Document-first approach.
> **Status:** BRAINSTORMING - Awaiting approval before FigJam creation

---

## 1. Product Vision

### 1.1 What is Secured?
A premium rent payment platform for India that:
- Enables digital rent payments with instant cashback
- Provides landlords with vacancy protection
- Creates trust through verification of both parties

### 1.2 Core Value Exchange
```
TENANT                          LANDLORD                        FLENT/SECURED
─────────────────────────────────────────────────────────────────────────
• 1% cashback on rent           • Vacancy cover (₹1.5L max)     • User data/network
• Digital payment proof         • Bank-verified settlements     • Future fintech upsell
• Credit history building       • Verified tenants              • Insurance premium share
• Cashback reduces next rent    • Replacement guarantee         • Platform stickiness
```

### 1.3 Business Model
```
PAYMENT FLOW:
Tenant pays: ₹50,000 rent + PG fees (based on payment method)
├── Landlord receives: ₹50,000 (FULL amount)
├── PG fees: Paid by tenant (varies by method)
└── Flent retains: ₹0 from rent transaction

CASHBACK MODEL:
Month 1: Tenant pays ₹50,000 → Earns ₹500 cashback (1%)
Month 2: Tenant pays ₹49,500 (₹500 cashback applied) → Earns ₹495 cashback
Month 3: Tenant pays ₹49,005 (₹495 cashback applied) → Earns ₹490 cashback
...and so on

VACANCY COVER REVENUE:
Monthly premium: 0.50% of rent (paid from tenant's payment or Flent subsidy)
Example: ₹50,000 rent → ₹250/month premium
Annual premium per tenant: ~₹3,000

MONETIZATION STRATEGY:
• Vacancy cover premium (partnership with Assurekit)
• Future credit products
• Premium features (priority support, higher limits)
• B2B landlord services
```

---

## 2. User Journeys (Comprehensive)

### 2.1 High-Level Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            TENANT JOURNEY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ONBOARDING              WAITLIST           APPROVED            ACTIVE          │
│  ──────────              ────────           ────────            ──────          │
│  Phone + OTP             Extraction         Pending Steps       Pay Rent        │
│       ↓                  in progress        screen shown             ↓          │
│  Mobile 360 (consent)         ↓                  ↓              Earn Cashback   │
│       ↓                  Review &           Skip or Complete         ↓          │
│  Name verification       confirm data       landlord setup      Use Cashback    │
│       ↓                       ↓                  ↓                   ↓          │
│  Upload Agreement        Submit to          Home screen         View History    │
│       ↓                  waitlist           unlocked                            │
│  Background upload            ↓                                                 │
│  + extraction            Wait for                                               │
│                          approval                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          LANDLORD JOURNEY (WEB)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Receive Invite (SMS/WhatsApp/Email)                                            │
│       ↓                                                                         │
│  Open Web Portal → Enter OTP                                                    │
│       ↓                                                                         │
│  Review Tenancy Details → Confirm/Dispute                                       │
│       ↓                                                                         │
│  Optional: Upload Utility Bill (ownership proof)                                │
│       ↓                                                                         │
│  Enter Bank Details → Penny Drop Verification                                   │
│       ↓                                                                         │
│  Name Matching (80% threshold)                                                  │
│       ↓                                                                         │
│  Accept Vacancy Cover Terms                                                     │
│       ↓                                                                         │
│  CONFIRMED - Ready to receive payments                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Onboarding Flow (Detailed)

### 3.1 Step 1: Phone + OTP (Twilio Verify)

**Screen: Phone Entry**
```
┌─────────────────────────────────────────┐
│                                         │
│         [Flent Logo]                    │
│                                         │
│    Pay rent. Earn rewards.              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ +91 │ Enter mobile number       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  By continuing, you agree to our        │
│  Terms of Service and Privacy Policy    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: OTP Verification**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Enter verification code              │
│    Sent to +91 98765 43210              │
│                                         │
│     ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│     │ 4 │ │ 5 │ │ 6 │ │ _ │ │ _ │ │ _ ││
│     └───┘ └───┘ └───┘ └───┘ └───┘ └───┘│
│                                         │
│    Resend code in 0:28                  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Verify →                  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Technical Flow:**
```
User enters phone → Twilio Verify sends OTP
         ↓
User enters OTP → Twilio verifies
         ↓
OTP verification SUCCESS acts as CONSENT for Cashfree Mobile 360
         ↓
Backend calls Cashfree Mobile 360 API (user doesn't see this)
         ↓
Store: { full_name, pan_status, aadhaar_linked } in user profile
         ↓
Proceed to name verification screen
```

**Edge Cases:**
| Scenario | Handling |
|----------|----------|
| OTP expired | "Code expired. Tap to resend." |
| Wrong OTP 3x | Lock for 5 minutes, show countdown |
| Twilio down | Show error, retry button |
| Mobile 360 fails silently | Continue without data, manual entry later if needed |

### 3.2 Step 2: Name Verification

**Screen: Verify Your Name**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Is this your name?                   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │    Atri Sharma                  │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│    This name was verified from your     │
│    mobile number records.               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   ✓ Yes, this is correct        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   ✎ Edit my name                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**If User Edits Name:**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Enter your full name                 │
│    (as per your rent agreement)         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Atri Sharma                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Zero State (Mobile 360 returned no name):**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    What's your name?                    │
│    (as per your rent agreement)         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Enter your full name            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 3.3 Step 3: Agreement Upload

**Screen: Upload Agreement**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Upload your rent agreement           │
│                                         │
│    ┌───────────────────────────────┐    │
│    │                               │    │
│    │      📄                       │    │
│    │                               │    │
│    │   Tap to upload PDF or        │    │
│    │   take photos of your         │    │
│    │   rent agreement              │    │
│    │                               │    │
│    │   Supported: PDF, JPG, PNG    │    │
│    │   Max size: 10MB              │    │
│    │                               │    │
│    └───────────────────────────────┘    │
│                                         │
│    Why do we need this?                 │
│    To verify your tenancy details       │
│    and protect both you and your        │
│    landlord.                            │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Upload in Progress (Background Upload on iOS)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Processing your agreement            │
│                                         │
│    ┌───────────────────────────────┐    │
│    │                               │    │
│    │   📄 Rent_Agreement.pdf       │    │
│    │   ████████████░░░░░ 75%       │    │
│    │                               │    │
│    │   Uploading...                │    │
│    │                               │    │
│    └───────────────────────────────┘    │
│                                         │
│    This may take a minute.              │
│    You can continue using the app.      │
│                                         │
│    We'll notify you when ready.         │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Extraction Complete - Review Data**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    Verify your details                  │
│                                         │
│    We extracted this from your          │
│    agreement. Please verify.            │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Property Address                │    │
│  │ 123 MG Road, Koramangala        │    │
│  │ Bangalore - 560034              │ ✎  │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Monthly Rent                    │    │
│  │ ₹50,000                         │ ✎  │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Agreement Period                │    │
│  │ Jan 1, 2024 - Dec 31, 2024      │ ✎  │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Landlord Name                   │    │
│  │ Ramesh Kumar                    │ ✎  │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Landlord Phone                  │    │
│  │ +91 98765 12345                 │ ✎  │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    Submit to Waitlist →         │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Extraction States:**

| State | UI | Next Action |
|-------|-----|-------------|
| **COMPLETE** (all fields extracted) | Show review screen with all fields | User verifies → Submit |
| **PARTIAL** (missing some fields) | Show review with empty fields highlighted | User fills missing → Submit (goes to UNDER_REVIEW) |
| **FAILED** (extraction failed) | "We couldn't read your agreement" | Prompt re-upload |

**Screen: Extraction Failed**
```
┌─────────────────────────────────────────┐
│                                         │
│  ← Back                                 │
│                                         │
│    😕 We couldn't read your agreement   │
│                                         │
│    This might happen if:                │
│    • The image is blurry                │
│    • The document is handwritten        │
│    • The file is corrupted              │
│                                         │
│    ┌───────────────────────────────┐    │
│    │      Try Again →               │    │
│    └───────────────────────────────┘    │
│                                         │
│    ┌───────────────────────────────┐    │
│    │   Enter Details Manually       │    │
│    └───────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Technical Flow (Backend):**
```
iOS uploads file → Supabase Storage (background upload)
         ↓
Trigger Edge Function: process_agreement
         ↓
GCP Document AI → Extract text
         ↓
Gemini API → Parse structured data
         ↓
Store in extracted_rental_info table
         ↓
Update user status → Push notification to app
         ↓
App shows review screen
```

### 3.4 Step 4: Waitlist Submission

**Screen: Submission Confirmation**
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│            ✓                            │
│                                         │
│    You're on the waitlist!              │
│                                         │
│    We're reviewing your details.        │
│    This usually takes 24-48 hours.      │
│                                         │
│    We'll notify you once approved.      │
│                                         │
│    Position: #127 in queue              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Got it →                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Meanwhile, refer friends and         │
│    earn ₹250 bonus cashback!            │
│    [Share Referral Link]                │
│                                         │
└─────────────────────────────────────────┘
```

**Waitlist Statuses:**
| Status | Description | User Sees |
|--------|-------------|-----------|
| SUBMITTED | Just submitted | "We're reviewing your application" |
| UNDER_REVIEW | Manual review needed | "Our team is reviewing your details" |
| APPROVED | Ready for next step | Push notification → Pending steps screen |
| REJECTED | Not eligible | "Unfortunately, we can't onboard you at this time" with reason |

### 3.5 Step 5: Post-Approval - Pending Steps

**Three Steps Overview:**

| Step | Who Does It | Required For | Can Skip? |
|------|-------------|--------------|-----------|
| 1. Add Landlord's Bank Account | Tenant | Making any payment | No - mandatory before payment |
| 2. Add Utility ID (Bescom) | Tenant | Redeeming 1% cashback | Yes - but cashback accrues, can't use |
| 3. Landlord Approval | Landlord via link | Credit card payments + cashback redemption | Yes - but features locked |

**Screen: Complete Your Setup**
```
┌─────────────────────────────────────────┐
│                                         │
│  🎉 You're approved!                    │
│                                         │
│    Complete these steps to unlock       │
│    all features.                        │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 1. Add landlord's bank account  │    │
│  │    Required to make rent payments│    │
│  │    ⚠️ MANDATORY                  │    │
│  │                         [Start] │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 2. Verify property (Utility ID) │    │
│  │    Link your electricity account│    │
│  │    To redeem cashback           │    │
│  │                         [Start] │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 3. Get landlord approval        │    │
│  │    We'll send them a link       │    │
│  │    To verify your tenancy       │    │
│  │                         [Start] │    │
│  └─────────────────────────────────┘    │
│                                         │
│    ─────────────────────────────────    │
│    Skipping steps 2 & 3 will:           │
│    • Lock credit card payments          │
│    • Accrue cashback (not redeemable)   │
│    ─────────────────────────────────    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    Skip for now →                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**User Status Logic:**

| Completed Steps | User Status | Can Pay? | Cashback | Credit Card |
|-----------------|-------------|----------|----------|-------------|
| None | QUALIFIED | No (no bank) | Accrues | Locked |
| Bank only | QUALIFIED | Yes | Accrues (can't redeem) | Locked |
| Bank + Utility | QUALIFIED | Yes | Accrues (can't redeem until landlord approves) | Locked |
| Bank + Landlord | QUALIFIED | Yes | Redeemable | Locked (need utility) |
| All three | COMPLETE | Yes | Redeemable | Unlocked |

### 3.6 Step 6: Add Landlord Bank Account

**Purpose:** Tenant adds landlord's bank details so rent can be settled directly.

**Screen: Add Bank Account**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Add Landlord's Bank Account          │
│                                         │
│    Your rent will be settled directly   │
│    to this account.                     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Account Holder Name             │    │
│  │ (as per bank records)           │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ Ramesh Kumar              │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Account Number                  │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ 1234567890123             │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Confirm Account Number          │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ 1234567890123             │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ IFSC Code                       │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ HDFC0001234               │   │    │
│  │ └───────────────────────────┘   │    │
│  │ Bank: HDFC Bank, Koramangala    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Verify Account →         │    │
│  └─────────────────────────────────┘    │
│                                         │
│    We'll verify this account using      │
│    a ₹1 penny drop test.                │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification in Progress**
```
┌─────────────────────────────────────────┐
│                                         │
│            ⏳                           │
│                                         │
│    Verifying bank account...            │
│                                         │
│    This usually takes a few seconds.    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification Success**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✓                            │
│                                         │
│    Account Verified!                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Account Holder                 │    │
│  │  RAMESH KUMAR                   │    │
│  │                                 │    │
│  │  Bank                           │    │
│  │  HDFC Bank                      │    │
│  │                                 │    │
│  │  Account                        │    │
│  │  ****0123                       │    │
│  └─────────────────────────────────┘    │
│                                         │
│    ✓ Name matches landlord details      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Name Mismatch Warning**
```
┌─────────────────────────────────────────┐
│                                         │
│            ⚠️                           │
│                                         │
│    Name doesn't match exactly           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Bank account name:             │    │
│  │  RAMESH K                       │    │
│  │                                 │    │
│  │  Landlord name (from agreement):│    │
│  │  Ramesh Kumar                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Is this the same person?             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Yes, continue anyway          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   No, enter different account   │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Note: Mismatched names may require   │
│    additional verification later.       │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification Failed**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✗                            │
│                                         │
│    Verification Failed                  │
│                                         │
│    We couldn't verify this account.     │
│    This might happen if:                │
│                                         │
│    • Account number is incorrect        │
│    • IFSC code is wrong                 │
│    • Account is closed/inactive         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Try Again →              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Contact Support               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Technical Flow (Backend):**
```
Tenant enters bank details
         ↓
Backend validates IFSC format
         ↓
Call Cashfree/Razorpay Penny Drop API
         ↓
₹1 transferred to account
         ↓
Response: account_holder_name, bank_name
         ↓
Name matching algorithm (80% threshold)
         ↓
IF match >= 80%: Auto-approve
IF match < 80%: Show warning, allow proceed with flag
IF failed: Show error, request retry
         ↓
Store in bank_accounts table with verification status
```

**When Can Bank Account Be Added:**

| Timing | Flow |
|--------|------|
| During post-approval setup | Recommended, part of pending steps |
| Skipped, added later | Can add from Profile > Property > Bank Account |
| During first payment | If no bank account exists, prompt to add before payment |

**User Status After Bank Step:**

| Action | Can Pay? | Cashback Status |
|--------|----------|-----------------|
| Bank added | Yes | Earns but cannot redeem (needs utility + landlord) |
| Bank not added | No | N/A |

---

### 3.7 Step 7: Add Utility ID (Bescom API) - Tenant Action

**Purpose:** Tenant links their electricity account to verify they live at the property. Required to redeem cashback.

**Screen: Verify Your Property**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Verify Your Property                 │
│                                         │
│    Link your electricity account to     │
│    prove you live at this address.      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Electricity Provider            │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ BESCOM (Bangalore)      ▼ │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Consumer Number / Account ID    │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ 1234567890               │   │    │
│  │ └───────────────────────────┘   │    │
│  │                                 │    │
│  │ Find this on your electricity   │    │
│  │ bill or BESCOM app              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Verify Account →         │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Why do we need this?                 │
│    To verify you live at this address   │
│    and unlock your 1% cashback.         │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification in Progress**
```
┌─────────────────────────────────────────┐
│                                         │
│            ⏳                           │
│                                         │
│    Verifying your electricity account   │
│                                         │
│    Connecting to BESCOM...              │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification Success**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✓                            │
│                                         │
│    Property Verified!                   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Consumer Name                  │    │
│  │  RAMESH KUMAR                   │    │
│  │                                 │    │
│  │  Service Address                │    │
│  │  123 MG Road, Koramangala       │    │
│  │  Bangalore - 560034             │    │
│  │                                 │    │
│  │  Consumer Number                │    │
│  │  1234567890                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│    ✓ Address matches your agreement     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Address Mismatch Warning**
```
┌─────────────────────────────────────────┐
│                                         │
│            ⚠️                           │
│                                         │
│    Address doesn't match exactly        │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  BESCOM Address:                │    │
│  │  123 MG Road, KRM Layout        │    │
│  │                                 │    │
│  │  Agreement Address:             │    │
│  │  123 MG Road, Koramangala       │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Is this the same property?           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Yes, continue anyway          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   No, enter different ID        │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Verification Failed**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✗                            │
│                                         │
│    Verification Failed                  │
│                                         │
│    We couldn't verify this account.     │
│    This might happen if:                │
│                                         │
│    • Consumer number is incorrect       │
│    • Account is inactive                │
│    • BESCOM service is down             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Try Again →              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Skip for now                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Note: You can pay rent without this  │
│    but cashback will accrue, not redeem │
│                                         │
└─────────────────────────────────────────┘
```

**Technical Flow (Backend):**
```
Tenant enters consumer number + selects provider
         ↓
Backend validates format
         ↓
Call BESCOM API (or respective utility API)
         ↓
API Response: {
  consumer_name: "RAMESH KUMAR",
  service_address: "123 MG Road...",
  consumer_number: "1234567890",
  status: "active"
}
         ↓
Address matching algorithm (fuzzy match with agreement address)
         ↓
IF match >= 70%: Auto-approve
IF match < 70%: Show warning, allow proceed with flag
IF API failed: Show error, allow skip
         ↓
Store in properties table:
  - electricity_consumer_number
  - ownership_verified = true/false
  - verification_method = 'bescom_api'
```

**Supported Utility Providers (Phase 1 - Bangalore):**

| Provider | API | Coverage |
|----------|-----|----------|
| BESCOM | Bangalore Electricity Supply Company API | Bangalore |

**Future Expansion:**
- MSEDCL (Maharashtra)
- TATA Power (Mumbai)
- BSES (Delhi)
- TNEB (Tamil Nadu)

**Why This Step Matters:**
- Proves tenant actually lives at the property
- Reduces fraud (can't claim any random address)
- Required to unlock cashback redemption
- Address on utility bill should match agreement

---

### 3.8 Step 8: Landlord Approval - Landlord Action

**Purpose:** Landlord confirms the tenancy details. They do NOT add bank details (tenant already did that).

**What Landlord Receives:**
```
WhatsApp/SMS/Email Message:

"Hi Ramesh Kumar,

Your tenant Atri Sharma has added you to Flent for
rent payments at 123 MG Road, Koramangala.

Confirm to get FREE vacancy cover up to ₹1.5L!

Tap to verify: https://flent.in/verify/abc123

This link expires in 7 days."
```

**Landlord Web Portal Flow:**

**Screen 1: OTP Verification**
```
┌─────────────────────────────────────────┐
│                                         │
│         [Flent Logo]                    │
│                                         │
│    Verify Your Phone                    │
│                                         │
│    We sent a code to +91 98765 12345    │
│                                         │
│     ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│     │   │ │   │ │   │ │   │ │   │ │   ││
│     └───┘ └───┘ └───┘ └───┘ └───┘ └───┘│
│                                         │
│    Resend code in 0:28                  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Verify →                  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen 2: Review Tenancy Details**
```
┌─────────────────────────────────────────┐
│                                         │
│    Confirm Your Tenant                  │
│                                         │
│    Please verify these details are      │
│    correct.                             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Tenant Name                    │    │
│  │  Atri Sharma                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Property Address               │    │
│  │  123 MG Road, Koramangala       │    │
│  │  Bangalore - 560034             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Monthly Rent                   │    │
│  │  ₹50,000                        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Agreement Period               │    │
│  │  Jan 1, 2024 - Dec 31, 2024     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Bank Account for Settlement    │    │
│  │  HDFC Bank ****0123             │    │
│  │  (Added by tenant)              │    │
│  │                        [Edit]   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✓ Confirm - All details correct│    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✗ Dispute - Something is wrong │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**If Landlord Clicks "Edit" on Bank Account:**
```
┌─────────────────────────────────────────┐
│                                         │
│    Update Bank Account                  │
│                                         │
│    Your tenant added these details.     │
│    Update if incorrect.                 │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Current: HDFC Bank ****0123     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Account Holder Name             │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ Ramesh Kumar              │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Account Number                  │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ 9876543210123             │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ IFSC Code                       │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │ ICIC0001234               │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Verify & Update →        │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen 3: Vacancy Cover Terms**
```
┌─────────────────────────────────────────┐
│                                         │
│    🛡️ Free Vacancy Cover                │
│                                         │
│    Get protected if your tenant         │
│    vacates unexpectedly!                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Coverage Amount                │    │
│  │  Up to ₹1,50,000                │    │
│  │  (or 1 month's rent)            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  What's Covered                 │    │
│  │  • Un-occupancy (30 days)       │    │
│  │  • Tenant abandonment (60 days) │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Waiting Period                 │    │
│  │  90 days from activation        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Premium                        │    │
│  │  0.50% of monthly rent          │    │
│  │  (Paid by Flent on your behalf) │    │
│  └─────────────────────────────────┘    │
│                                         │
│    [View Full Terms & Conditions]       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ☐ I accept the terms           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Complete Setup →         │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen 4: Confirmation**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✓                            │
│                                         │
│    You're All Set!                      │
│                                         │
│    You've confirmed Atri Sharma as      │
│    your tenant.                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  What happens next:             │    │
│  │                                 │    │
│  │  • Rent payments will be        │    │
│  │    settled to your account      │    │
│  │                                 │    │
│  │  • Vacancy cover activates      │    │
│  │    after 90 days                │    │
│  │                                 │    │
│  │  • You'll get notifications     │    │
│  │    when rent is paid            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Done                     │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**If Landlord Clicks "Dispute":**
```
┌─────────────────────────────────────────┐
│                                         │
│    Report an Issue                      │
│                                         │
│    What's incorrect?                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ This person is not my tenant  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ Wrong property address        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ Incorrect rent amount         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ Wrong bank account            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ○ Other issue                   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Additional details:             │    │
│  │ ┌───────────────────────────┐   │    │
│  │ │                           │   │    │
│  │ │                           │   │    │
│  │ └───────────────────────────┘   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Submit Dispute →         │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Technical Flow (Backend):**
```
Tenant initiates landlord invite
         ↓
Generate unique token (expires 7 days)
         ↓
Send via Gupshup WhatsApp (₹0.50) or MSG91 SMS (₹0.15)
         ↓
Store in landlord_invitations table:
  - tenancy_id, token, sent_via, sent_at, expires_at
         ↓
Landlord clicks link
         ↓
Web portal loads, sends OTP to landlord phone
         ↓
Landlord verifies OTP
         ↓
Show tenancy details + bank account (pre-filled by tenant)
         ↓
IF Confirm:
  - Update tenancy: landlord_confirmed_at = now()
  - Update landlord_invitation: completed_at = now()
  - If all 3 steps done: Update user status to COMPLETE
  - Create vacancy_cover record
  - Send push notification to tenant
         ↓
IF Dispute:
  - Flag tenancy for review
  - Pause any payments
  - Notify ops team
  - Send notification to tenant
```

**Reminder Flow:**
```
IF landlord doesn't respond in 48 hours:
  - Send reminder (same channel)
  - reminder_count += 1

IF 3 reminders sent (6 days):
  - Mark as unresponsive
  - Tenant can still pay (QUALIFIED status)
  - Cashback accrues but not redeemable
```

---

### 3.9 Agreement Upload Technical Details

**iOS Background Upload:**
```swift
// Use URLSession background configuration
let config = URLSessionConfiguration.background(withIdentifier: "com.flent.upload")
config.isDiscretionary = false
config.sessionSendsLaunchEvents = true

// Upload continues even if app is backgrounded
// Completion handler called when done
```

**Backend Processing Flow:**
```
1. File uploaded to Supabase Storage
2. Database trigger calls Edge Function
3. Edge Function:
   a. Download file from storage
   b. Call GCP Document AI for OCR
   c. Call Gemini for structured extraction
   d. Validate extracted data:
      - Rent >= ₹45,000?
      - City in supported_cities?
      - Agreement not expired?
      - Name matches user profile (fuzzy)?
   e. Store results in extracted_rental_info
   f. Update waitlist status
   g. Send push notification
```

**Extraction Validation Rules:**

| Field | Required | Validation |
|-------|----------|------------|
| property_address | Yes | Non-empty, recognizable address format |
| monthly_rent | Yes | >= ₹45,000, numeric |
| tenant_name | Yes | Fuzzy match with user's verified name (70%+) |
| landlord_name | Yes | Non-empty |
| landlord_phone | No | Valid Indian mobile if present |
| agreement_start | Yes | Valid date, not > 30 days in future |
| agreement_end | Yes | Valid date, > start date |
| security_deposit | No | Numeric if present |

### 3.8 SHCIL Stamp Validation (Optional Enhancement)

**What is SHCIL?**
Stock Holding Corporation of India Limited - handles e-stamping for legal documents.
Website: https://www.shcilestamp.com/

**Validation Flow:**
```
Extract stamp certificate number from agreement
         ↓
Backend calls SHCIL validation (via Firecrawl/Hyperbrowser MCP)
         ↓
Validate: Stamp exists, amount matches, date valid
         ↓
Mark agreement as "stamp verified" (trust badge)
```

**Why Optional?**
- Not all agreements have e-stamps
- Physical stamps can't be verified this way
- Adds processing time
- Make it a "verified" badge, not a requirement

---

## 4. Verification Deep Dive

### 4.1 Landlord Verification Flow

**Step 1: Invitation**
```
Channels (priority order):
1. WhatsApp Business API (highest open rate)
2. SMS (fallback)
3. Email (if provided)

Message content:
"Hi {landlord_name}, your tenant {tenant_name} has added you
to Secured for rent payments at {property_address}.
Confirm to get FREE ₹1.5L vacancy cover: {link}"
```

**Step 2: OTP Verification**
```
Landlord clicks link → Web portal opens
         ↓
Pre-filled phone number (from tenant's submission)
         ↓
OTP sent to landlord's phone
         ↓
Verified → Proceed to confirmation
```

**Step 3: Tenancy Confirmation**
```
Display extracted data:
- Tenant name
- Property address
- Monthly rent
- Agreement period

Options:
[✓ Confirm - This is correct]
[✕ Dispute - Something is wrong]
```

**Step 4: Electricity Bill Validation (Optional)**
```
Purpose: Verify landlord owns the property
         ↓
Landlord uploads recent electricity bill
         ↓
OCR extracts: Name, Address, Consumer number
         ↓
Match against:
- Landlord name (fuzzy match)
- Property address (fuzzy match)
         ↓
If match: "Property ownership verified" badge
If no match: Allow anyway, flag for review
```

### 4.2 Bank Account Verification (Penny Drop)

**What is Penny Drop?**
Transfer ₹1 to the account and verify it goes through. Returns account holder name.

**Flow:**
```
Landlord enters:
- Account holder name
- Account number
- IFSC code
         ↓
Call Penny Drop API (Cashfree/Razorpay)
         ↓
Response: {
  status: "success",
  account_holder_name: "RAMESH KUMAR",
  bank_name: "HDFC Bank"
}
         ↓
Name matching algorithm
```

**Name Matching (80% Threshold):**
```
Why 80%?
- Indian names have variations: Ramesh Kumar vs R. Kumar vs Ramesh K
- Bank records may abbreviate
- Middle names may be missing

Algorithm:
1. Normalize: lowercase, remove titles (Mr/Mrs/Shri)
2. Tokenize: split into words
3. Compare tokens with fuzzy matching (Levenshtein)
4. Calculate overlap percentage
5. If >= 80% match → PASS
6. If < 80% → Flag for manual review (don't block)

Examples:
"Ramesh Kumar" vs "RAMESH KUMAR" → 100% ✓
"Ramesh Kumar" vs "R Kumar" → 70% (flag, allow)
"Ramesh Kumar" vs "Suresh Kumar" → 50% (flag, review)
```

**Edge Cases:**
| Scenario | Handling |
|----------|----------|
| Joint account | Match any holder name |
| NRI account | May fail, manual verification |
| New account (no name yet) | Retry after 24 hours |
| Closed account | Error, request different account |

### 4.3 Aadhaar KYC (DigiLocker)

**Purpose:** Full identity verification for high-value features (credit card payments)

**Flow:**
```
User initiates KYC → DigiLocker OAuth
         ↓
User authenticates with Aadhaar OTP
         ↓
Fetch: Name, DOB, Address, Photo
         ↓
Match with profile and agreement
         ↓
KYC verified → Unlock credit card payments
```

**What it Unlocks:**
- Credit card payment option
- Higher payment limits
- Faster dispute resolution
- Priority support

---

## 4A. App Screens (Detailed Specifications)

### 4A.1 Home Screen

**Primary Purpose:** Central hub for rent payment, status tracking, and property overview.

#### Screen Layout (Default State - Payment Available)
```
┌─────────────────────────────────────────┐
│  ☰                          🔔  👤     │
├─────────────────────────────────────────┤
│                                         │
│  Hi, Atri! 👋                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🏠 Your Home                   │    │
│  │                                 │    │
│  │  123 MG Road, Koramangala       │    │
│  │  Bangalore - 560034             │    │
│  │                                 │    │
│  │  Landlord: Ramesh Kumar         │    │
│  │                              ▶  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  RENT DUE                       │    │
│  │                                 │    │
│  │  ₹49,500                        │    │
│  │  ──────────                     │    │
│  │  ₹50,000 rent                   │    │
│  │  - ₹500 cashback applied        │    │
│  │                                 │    │
│  │  Due: Feb 1-7, 2024             │    │
│  │  ⏱️ 3 days left                 │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │      Pay Now →            │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📊 Your Streak                 │    │
│  │                                 │    │
│  │  🔥 5 consecutive payments      │    │
│  │  ████████████░░░░░░             │    │
│  │                                 │    │
│  │  Next milestone: 6 months       │    │
│  │  Unlock: Priority Support       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  💰 Available Cashback          │    │
│  │                                 │    │
│  │  ₹500                           │    │
│  │  Will be applied to next rent   │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  🏠 Home    📋 History    👤 Profile   │
└─────────────────────────────────────────┘
```

#### Home Screen States

**State 1: ZERO STATE (New User - Just Approved)**
```
┌─────────────────────────────────────────┐
│                                         │
│  Hi, Atri! 👋                           │
│                                         │
│  Welcome to Flent!                      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🏠 Your Home                   │    │
│  │  123 MG Road, Koramangala       │    │
│  │  Bangalore - 560034             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  RENT DUE                       │    │
│  │                                 │    │
│  │  ₹50,000                        │    │
│  │                                 │    │
│  │  Due: Feb 1-7, 2024             │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │   Pay Your First Rent →   │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📊 Your Streak                 │    │
│  │                                 │    │
│  │  Start your streak!             │    │
│  │  Pay rent on time to build      │    │
│  │  your payment history.          │    │
│  │  ░░░░░░░░░░░░░░░░░░             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  💰 Cashback                    │    │
│  │                                 │    │
│  │  No cashback yet                │    │
│  │  Earn 1% on every rent payment! │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**State 2: RENT ALREADY PAID THIS MONTH**
```
┌─────────────────────────────────────────┐
│                                         │
│  Hi, Atri! 👋                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✓ RENT PAID                    │    │
│  │                                 │    │
│  │  February 2024                  │    │
│  │  Paid ₹49,500 on Feb 3          │    │
│  │                                 │    │
│  │  Next payment: Mar 1-7          │    │
│  │                                 │    │
│  │  [View Receipt]                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... (streak, cashback cards)           │
│                                         │
└─────────────────────────────────────────┘
```

**State 3: OUTSIDE PAYMENT WINDOW (8th-31st)**
```
┌─────────────────────────────────────────┐
│                                         │
│  Hi, Atri! 👋                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ⚠️ LATE PAYMENT                │    │
│  │                                 │    │
│  │  ₹50,000                        │    │
│  │  (Cashback not applicable)      │    │
│  │                                 │    │
│  │  Payment window closed on       │    │
│  │  Feb 7. Pay anyway to avoid     │    │
│  │  missing this month.            │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │   Pay Without Cashback →  │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**State 4: PENDING STEPS BANNER (QUALIFIED user)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ⚠️ Complete setup to unlock    │    │
│  │     all features                │    │
│  │                                 │    │
│  │  • Credit card payments         │    │
│  │  • Use your accrued cashback    │    │
│  │                         [→]     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... (rest of home screen)              │
│                                         │
└─────────────────────────────────────────┘
```

**State 5: VACANCY COVER STATUS (After 90 days)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🛡️ Vacancy Cover               │    │
│  │                                 │    │
│  │  Status: ACTIVE ✓               │    │
│  │  Your landlord is protected     │    │
│  │  up to ₹50,000                  │    │
│  │                         [Info]  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

#### Property Card - Expandable for Flatmates (Future)
```
┌─────────────────────────────────────────┐
│  🏠 Your Home                      ▼    │
│                                         │
│  123 MG Road, Koramangala               │
│  Bangalore - 560034                     │
│                                         │
│  Landlord: Ramesh Kumar                 │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Flatmates                      │    │
│  │                                 │    │
│  │  👤 You (Primary)               │    │
│  │  ➕ Add flatmate                 │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 4A.2 Payment Flow

**Screen: Payment Confirmation**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Pay Rent                             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Payment Summary                │    │
│  │                                 │    │
│  │  Monthly Rent        ₹50,000    │    │
│  │  Cashback Applied    - ₹500     │    │
│  │  ─────────────────────────────  │    │
│  │  Amount to Pay       ₹49,500    │    │
│  │                                 │    │
│  │  + PG fees (shown at checkout)  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📍 Paying to                   │    │
│  │  Ramesh Kumar                   │    │
│  │  HDFC Bank ****1234             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  💳 Pay using                   │    │
│  │                                 │    │
│  │  ○ UPI                          │    │
│  │  ○ Debit Card                   │    │
│  │  ○ Net Banking                  │    │
│  │  ○ Credit Card  🔒 Complete     │    │
│  │                    setup        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  [ ] Use cashback (₹500)        │    │
│  │      (Auto-applied by default)  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Proceed to Pay →         │    │
│  └─────────────────────────────────┘    │
│                                         │
│    You'll earn ₹500 cashback on this    │
│    payment!                             │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Custom Amount Entry**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Enter Payment Amount                 │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ₹                              │    │
│  │  49,500                         │    │
│  └─────────────────────────────────┘    │
│                                         │
│    Max payable: ₹50,000                 │
│    (Cannot exceed monthly rent)         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Continue →               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Payment Processing**
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│            ⏳                           │
│                                         │
│    Processing payment...                │
│                                         │
│    Please don't close the app.          │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Payment Success**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✓                            │
│                                         │
│    Payment Successful!                  │
│                                         │
│    ₹49,500 paid                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🎉 You earned ₹500 cashback!   │    │
│  │                                 │    │
│  │  Will be applied to your        │    │
│  │  next rent payment.             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Settlement Status              │    │
│  │  ─────────────────              │    │
│  │  Your landlord will receive     │    │
│  │  ₹50,000 by Feb 5, 2024         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        View Receipt             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Back to Home →           │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Screen: Payment Failed**
```
┌─────────────────────────────────────────┐
│                                         │
│            ✗                            │
│                                         │
│    Payment Failed                       │
│                                         │
│    Reason: Card declined                │
│                                         │
│    Your bank may have blocked this      │
│    transaction. Please try again or     │
│    use a different payment method.      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Try Again →              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Use Different Method          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Back to Home             │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 4A.3 Transactions / History Screen

**Default State (With Transactions)**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Transactions                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  💰 Cashback Summary            │    │
│  │                                 │    │
│  │  Available: ₹500                │    │
│  │  Accrued: ₹0                    │    │
│  │  Total earned: ₹2,500           │    │
│  └─────────────────────────────────┘    │
│                                         │
│    February 2024                        │
│  ┌─────────────────────────────────┐    │
│  │  ✓ Rent Payment                 │    │
│  │  Feb 3, 2024 • UPI              │    │
│  │                                 │    │
│  │  Paid: ₹49,500        -₹49,500  │    │
│  │  Cashback earned:       +₹500   │    │
│  │                                 │    │
│  │  Settlement: Completed ✓        │    │
│  │  Landlord received ₹50,000      │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│    January 2024                         │
│  ┌─────────────────────────────────┐    │
│  │  ✓ Rent Payment                 │    │
│  │  Jan 5, 2024 • Net Banking      │    │
│  │                                 │    │
│  │  Paid: ₹49,500        -₹49,500  │    │
│  │  Cashback applied:      -₹500   │    │
│  │  Cashback earned:       +₹500   │    │
│  │                                 │    │
│  │  Settlement: Completed ✓        │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✗ Payment Failed               │    │
│  │  Jan 2, 2024 • Debit Card       │    │
│  │                                 │    │
│  │  Attempted: ₹50,000             │    │
│  │  Reason: Card declined          │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│    December 2023                        │
│  ┌─────────────────────────────────┐    │
│  │  ✓ Rent Payment                 │    │
│  │  Dec 1, 2024 • UPI              │    │
│  │  ...                            │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Zero State (No Transactions Yet)**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Transactions                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  💰 Cashback Summary            │    │
│  │                                 │    │
│  │  Available: ₹0                  │    │
│  │  Total earned: ₹0               │    │
│  └─────────────────────────────────┘    │
│                                         │
│                                         │
│            📋                           │
│                                         │
│    No transactions yet                  │
│                                         │
│    Pay your first rent to see           │
│    your payment history here.           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        Pay Rent →               │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Cashback States Display:**

| User Status | Cashback Display |
|-------------|------------------|
| QUALIFIED (landlord not confirmed) | "Accrued: ₹500 (Complete setup to use)" |
| COMPLETE | "Available: ₹500" |
| Just paid | "Available: ₹500 (Applied to next payment)" |

**Transaction Detail Screen**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Transaction Details                  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ✓ Payment Successful           │    │
│  │                                 │    │
│  │  February 2024 Rent             │    │
│  │  Feb 3, 2024 at 10:32 AM        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Amount Breakdown               │    │
│  │  ─────────────────              │    │
│  │  Monthly Rent        ₹50,000    │    │
│  │  Cashback Applied    - ₹500     │    │
│  │  Amount Paid         ₹49,500    │    │
│  │  PG Fees             + ₹495     │    │
│  │  ─────────────────────────────  │    │
│  │  Total Debited       ₹49,995    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Cashback Earned                │    │
│  │  ─────────────────              │    │
│  │  1% of ₹50,000       ₹500       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Payment Method                 │    │
│  │  ─────────────────              │    │
│  │  UPI                            │    │
│  │  Transaction ID: PAY123456789   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Settlement Status              │    │
│  │  ─────────────────              │    │
│  │  ✓ Settled to landlord          │    │
│  │  Feb 5, 2024                    │    │
│  │  Ref: SET987654321              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Download Receipt 📥         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Share Receipt 📤            │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### 4A.4 Profile Screen

**Default State**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Profile                              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        👤                       │    │
│  │    Atri Sharma                  │    │
│  │    +91 98765 43210              │    │
│  │                                 │    │
│  │    Status: COMPLETE ✓           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🏠 Property Details            │    │
│  │                                 │    │
│  │  123 MG Road, Koramangala       │    │
│  │  Bangalore - 560034             │    │
│  │                                 │    │
│  │  Monthly Rent: ₹50,000          │    │
│  │  Agreement: Jan 1 - Dec 31      │    │
│  │                                 │    │
│  │  Landlord: Ramesh Kumar         │    │
│  │  Status: Verified ✓             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🛡️ Vacancy Cover               │    │
│  │                                 │    │
│  │  Status: Active                 │    │
│  │  Coverage: ₹50,000              │    │
│  │  Valid until: Dec 31, 2024      │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📋 Documents                   │    │
│  │                                 │    │
│  │  • Rent Agreement    Uploaded ✓ │    │
│  │  • Utility Bill      Uploaded ✓ │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🎁 Referral Code               │    │
│  │                                 │    │
│  │  ATRI250                        │    │
│  │  Share and earn ₹250 each!      │    │
│  │                        [Share]  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  ⚙️ Settings                    │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  📞 Help & Support              │    │
│  │                          [→]    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🚪 Log Out                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│                                         │
│    App Version 1.0.0                    │
│                                         │
└─────────────────────────────────────────┘
```

**Profile with Pending Steps**
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │
│  │        👤                       │    │
│  │    Atri Sharma                  │    │
│  │    +91 98765 43210              │    │
│  │                                 │    │
│  │    Status: Incomplete ⚠️        │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │   Complete Setup →        │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ... (rest of profile)                  │
│                                         │
└─────────────────────────────────────────┘
```

### 4A.5 Referral Screen

**Default State**
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│    Refer & Earn                         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │  🎁 Earn ₹250 for every friend  │    │
│  │     who pays rent on Flent!     │    │
│  │                                 │    │
│  │  They get ₹250 too!             │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Your Referral Code             │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │       ATRI250             │  │    │
│  │  │                    [Copy] │  │    │
│  │  └───────────────────────────┘  │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │     Share Invite Link     │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Your Referrals                 │    │
│  │                                 │    │
│  │  Total Earned: ₹500             │    │
│  │  Successful: 2                  │    │
│  │  Pending: 1                     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Referral History               │    │
│  │                                 │    │
│  │  👤 Rahul S.        ✓ ₹250      │    │
│  │     Paid first rent Jan 15      │    │
│  │                                 │    │
│  │  👤 Priya M.        ✓ ₹250      │    │
│  │     Paid first rent Jan 20      │    │
│  │                                 │    │
│  │  👤 Amit K.         ⏳ Pending   │    │
│  │     Signed up, awaiting payment │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  How it works                   │    │
│  │                                 │    │
│  │  1. Share your code with friends│    │
│  │  2. They sign up using your code│    │
│  │  3. They pay their first rent   │    │
│  │  4. You both get ₹250 cashback! │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Zero State (No Referrals Yet)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Your Referrals                 │    │
│  │                                 │    │
│  │  Total Earned: ₹0               │    │
│  │                                 │    │
│  │  No referrals yet               │    │
│  │  Share your code to start       │    │
│  │  earning!                       │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Referral Not Eligible (New User - No Payment Yet)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  🔒 Referrals Locked            │    │
│  │                                 │    │
│  │  Make your first rent payment   │    │
│  │  to unlock referrals.           │    │
│  │                                 │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │     Pay Rent Now →        │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 4B. Technical Gap Analysis

### 4B.1 Identified Gaps

| Area | Gap | Impact | Recommendation |
|------|-----|--------|----------------|
| **Agreement Expiry** | No handling for agreements expiring mid-use | User can't pay rent | Add renewal flow, notify 30 days before |
| **Rent Increase** | No mechanism for mid-year rent changes | Mismatch between agreement and actual rent | Add rent update flow with landlord confirmation |
| **Multiple Landlords** | Agreement may have 2+ landlords | Only one receives payment | Support primary landlord designation |
| **Partial Payments** | User can pay less than full rent | Landlord receives partial, cover affected | Clarify: allow or block partial? |
| **Refund Flow** | Settlement failures need refund | Money stuck | Define refund SLA and notification flow |
| **Dispute Resolution** | Landlord disputes tenancy | Payments blocked | Define dispute workflow and escalation |
| **Account Deletion** | GDPR compliance | Data retention requirements | Define deletion flow, archive vs purge |
| **Session Management** | Multiple device login | Security concern | **SOLVED** - See Section 4C below |
| **Offline Mode** | No network handling | App unusable offline | **SOLVED** - See Section 4C below |
| **Deep Links** | Landlord invite links | App not installed | Handle web fallback, app install prompt |

---

## 4C. Session & State Management Architecture (Critical)

> **Why This Matters:** Previous app versions suffered from edge cases during uploads, logouts, account switches, and network drops. This architecture prevents those issues.

### 4C.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      APP STATE LAYER                            │
│  SwiftUI Views observe @Observable managers                     │
│  • HomeView, PaymentView, OnboardingView                        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ observes
┌─────────────────────────────────▼───────────────────────────────┐
│                  SESSION COORDINATOR                            │
│  Orchestrates response to auth changes:                         │
│  • Coordinates UploadQueue (pause/resume/discard)               │
│  • Coordinates CacheManager (load/clear user data)              │
│  • Coordinates NavigationState (login/logout transitions)       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ observes
┌─────────────────────────────────▼───────────────────────────────┐
│                      AUTH MANAGER                               │
│  Wraps Supabase SDK with observable state machine:              │
│  • UNKNOWN → CHECKING → AUTHENTICATED/UNAUTHENTICATED           │
│  • AUTHENTICATED → SESSION_EXPIRED → REFRESHING                 │
│  • AUTHENTICATED → LOGGING_OUT → UNAUTHENTICATED                │
│  Single source of truth for "who is logged in"                  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ listens to
┌─────────────────────────────────▼───────────────────────────────┐
│                   SUPABASE SWIFT SDK                            │
│  • Token storage (Keychain - automatic)                         │
│  • Token refresh (automatic, ~1hr access, 7d refresh)           │
│  • Auth state events via onAuthStateChange                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4C.2 Auth State Machine

```swift
// AuthManager.swift
@Observable class AuthManager {
    enum State: Equatable {
        case unknown           // App just launched, checking session
        case checking          // Actively verifying session
        case authenticated(User) // Valid session, user logged in
        case unauthenticated   // No session, show login
        case sessionExpired    // Token invalid, attempting refresh
        case loggingOut        // Cleanup in progress
    }

    private(set) var state: State = .unknown
    private(set) var currentUserId: String?
    private var sessionGeneration: Int = 0  // Prevents race conditions

    init(supabase: SupabaseClient) {
        // Listen to Supabase SDK auth events
        supabase.auth.onAuthStateChange { [weak self] event, session in
            self?.handleAuthEvent(event, session: session)
        }
    }

    private func handleAuthEvent(_ event: AuthChangeEvent, session: Session?) {
        switch event {
        case .initialSession:
            state = session != nil ? .authenticated(session!.user) : .unauthenticated
        case .signedIn:
            currentUserId = session?.user.id.uuidString
            state = .authenticated(session!.user)
        case .signedOut:
            currentUserId = nil
            state = .unauthenticated
        case .tokenRefreshed:
            // Stay authenticated, token refreshed silently
            break
        case .userDeleted:
            currentUserId = nil
            state = .unauthenticated
        }
    }

    func logout() async {
        sessionGeneration += 1  // Invalidate all in-flight requests
        state = .loggingOut
        // SessionCoordinator observes this and triggers cleanup
    }
}
```

### 4C.3 Storage Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                    STORAGE DECISIONS                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  KEYCHAIN (Survives reinstall - use carefully)                 │
│  ├── Auth tokens (managed by Supabase SDK)                     │
│  ├── Biometric secrets (if Face ID enabled)                    │
│  └── Install ID (for fresh install detection)                  │
│                                                                │
│  MMKV (Fast, encrypted, cleared on logout)                     │
│  ├── User preferences (notifications, theme)                   │
│  ├── Upload queue (UploadIntent records)                       │
│  ├── Cached user profile                                       │
│  ├── Cached tenancy data                                       │
│  └── Schema version (for migrations)                           │
│                                                                │
│  USER DEFAULTS (App settings only)                             │
│  ├── hasCompletedOnboarding                                    │
│  ├── lastSeenVersion                                           │
│  └── installId (for comparison with Keychain)                  │
│                                                                │
│  FILE SYSTEM (Encrypted Documents directory)                   │
│  ├── Downloaded receipts                                       │
│  ├── Cached agreement PDFs                                     │
│  └── Temp upload files                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4C.4 Upload Queue with Crash Recovery

**The Problem:** App killed during upload = lost file, inconsistent state.

**The Solution:** Persist upload intent BEFORE starting upload.

```swift
// UploadIntent.swift - Persisted in MMKV
struct UploadIntent: Codable, Identifiable {
    let id: UUID
    let userId: String           // CRITICAL: Associate with user
    let localFilePath: String    // Local file location
    let remotePath: String       // Supabase storage destination
    let purpose: UploadPurpose   // agreement, utilityBill, etc.
    let createdAt: Date
    var status: UploadStatus
    var retryCount: Int
    var lastError: String?
}

enum UploadStatus: String, Codable {
    case queued                    // Waiting to start
    case uploading                 // In progress
    case uploadedAwaitingProcess   // File uploaded, backend processing
    case complete                  // Fully done
    case failed                    // Max retries exceeded
    case discarded                 // User logged out, different user
    case needsReauth               // Auth expired, needs user action
}

// UploadQueue.swift
@Observable class UploadQueue {
    private let storage: MMKV
    private let authManager: AuthManager

    // Called on app launch
    func recoverPendingUploads() {
        let pending = fetchIncompleteUploads()

        for upload in pending {
            if upload.userId != authManager.currentUserId {
                // Different user logged in - discard old user's uploads
                updateStatus(upload.id, .discarded)
                deleteLocalFile(upload.localFilePath)
            } else if case .authenticated = authManager.state {
                // Same user, valid auth - resume
                resumeUpload(upload)
            } else {
                // Same user but not authenticated - wait
                updateStatus(upload.id, .needsReauth)
            }
        }
    }

    // Called when user initiates upload
    func queueUpload(file: URL, destination: String, purpose: UploadPurpose) -> UUID {
        // 1. Create intent FIRST (before any network call)
        let intent = UploadIntent(
            id: UUID(),
            userId: authManager.currentUserId!,
            localFilePath: file.path,
            remotePath: destination,
            purpose: purpose,
            createdAt: Date(),
            status: .queued,
            retryCount: 0
        )

        // 2. Persist to MMKV
        saveIntent(intent)

        // 3. Start upload
        startUpload(intent)

        return intent.id
    }
}
```

### 4C.5 Session Coordinator (Orchestration)

```swift
// SessionCoordinator.swift
@Observable class SessionCoordinator {
    let authManager: AuthManager
    let uploadQueue: UploadQueue
    let cacheManager: CacheManager
    let navigationState: NavigationState

    private var cancellables = Set<AnyCancellable>()

    init(...) {
        // Observe auth state changes
        authManager.$state
            .sink { [weak self] newState in
                self?.handleAuthStateChange(newState)
            }
            .store(in: &cancellables)
    }

    private func handleAuthStateChange(_ newState: AuthManager.State) {
        switch newState {
        case .loggingOut:
            // 1. Pause uploads (don't discard yet - give them a chance)
            uploadQueue.pauseAll()

        case .unauthenticated:
            // 2. Previous user fully logged out
            if let previousUserId = authManager.previousUserId {
                // Discard that user's pending uploads
                uploadQueue.discardUploadsForUser(previousUserId)
            }
            // 3. Clear user-specific cache
            cacheManager.clearUserData()
            // 4. Navigate to login
            navigationState.resetToLogin()

        case .authenticated(let user):
            // 5. New user logged in
            uploadQueue.recoverPendingUploads()
            cacheManager.loadUserData(user.id)
            navigationState.navigateToHome()

        case .sessionExpired:
            // 6. Show re-auth prompt if needed
            navigationState.showReauthPrompt()

        default:
            break
        }
    }
}
```

### 4C.6 Edge Case Handling Matrix

| Scenario | Detection | Recovery | User Experience |
|----------|-----------|----------|-----------------|
| **App killed during upload** | UploadIntent exists with status=uploading | Resume on launch if same user | "Resuming upload..." toast |
| **Logout during upload** | State changes to loggingOut | Pause, then discard on unauthenticated | Silent - no orphaned uploads |
| **New account after delete** | userId mismatch in upload queue | Discard old uploads, clean slate | Fresh start, no confusion |
| **Token expired in background** | 401 error during upload | Mark as needsReauth, prompt user | "Please sign in again to complete upload" |
| **Keychain persists after reinstall** | installId mismatch | Clear all data, fresh start | Treated as new install |
| **Race condition on logout** | sessionGeneration counter | Invalidate in-flight requests | No stale data processed |
| **Network drop mid-upload** | URLSession delegate error | Exponential backoff retry (3x) | Progress indicator, then retry |
| **Multiple device login** | Configurable policy | Option: allow all OR invalidate others | If restricted: "Signed out on other device" |

### 4C.7 Fresh Install Detection

```swift
// AppDelegate.swift or App init
func handleFreshInstallIfNeeded() {
    let keychainInstallId = Keychain.string(forKey: "installId")
    let localInstallId = UserDefaults.standard.string(forKey: "installId")

    if keychainInstallId != localInstallId {
        // Either: Fresh install, OR app was deleted and reinstalled
        // Keychain persists but UserDefaults doesn't

        // Clear everything to prevent orphaned data
        try? supabase.auth.signOut()  // Clear Supabase session
        MMKV.default()?.clearAll()    // Clear app cache

        // Set new install ID
        let newId = UUID().uuidString
        Keychain.set(newId, forKey: "installId")
        UserDefaults.standard.set(newId, forKey: "installId")
    }
}
```

### 4C.8 Logout Flow (Ordered Operations)

```swift
func performLogout() async {
    // 1. Mark state (blocks new operations)
    authManager.state = .loggingOut

    // 2. Cancel pending network requests
    URLSession.shared.getAllTasks { tasks in
        tasks.forEach { $0.cancel() }
    }

    // 3. Pause upload queue
    uploadQueue.pauseAll()

    // 4. Sign out from Supabase (clears Keychain tokens)
    try? await supabase.auth.signOut()

    // 5. Clear local cache (MMKV)
    cacheManager.clearUserData()

    // 6. State automatically becomes .unauthenticated via SDK callback
    // 7. SessionCoordinator navigates to login
}
```

### 4C.9 MMKV Schema Versioning

```swift
// For future migrations
struct MMKVMigration {
    static let currentVersion = 1

    static func runIfNeeded() {
        let stored = MMKV.default()?.int32(forKey: "schemaVersion") ?? 0

        if stored < currentVersion {
            // v0 → v1: Initial schema, clear any legacy data
            if stored < 1 {
                MMKV.default()?.clearAll()
            }

            // Future: v1 → v2 migrations here

            MMKV.default()?.set(currentVersion, forKey: "schemaVersion")
        }
    }
}
```

### 4C.10 Backward Compatibility Assessment

| Component | Impact | Status |
|-----------|--------|--------|
| Supabase Auth schema | None - wraps SDK | ✅ Compatible |
| Supabase DB tables | None - no changes | ✅ Compatible |
| Supabase Storage | None - uses existing API | ✅ Compatible |
| MMKV (new) | Fresh implementation | ✅ No conflict |
| Swift SDK version | Uses onAuthStateChange (supported) | ✅ Compatible |

**Verdict:** No backward compatibility issues. Architecture wraps existing systems without modifying them

### 4B.2 Edge Cases to Address

**Onboarding Edge Cases:**
| Scenario | Current Handling | Recommended |
|----------|------------------|-------------|
| Same phone, different user (device change) | ? | OTP + additional verification |
| User re-onboards after deletion | ? | Allow with new waitlist review |
| Agreement shows different tenant name | Flag for review | Show warning, allow with manual verification |
| Rent < ₹45,000 | Block | Show waitlist with "coming soon" message |
| City not in supported list | Block | Show waitlist for city expansion |
| Agreement in regional language | Gemini attempts | Add language detection, show confidence score |

**Payment Edge Cases:**
| Scenario | Current Handling | Recommended |
|----------|------------------|-------------|
| Payment initiated, user closes app | ? | Check status on app reopen, show result |
| Double-tap on pay button | ? | Debounce, disable button after first tap |
| Payment window boundary (11:59 PM on 7th) | ? | Use server time, show clear cutoff |
| Landlord bank account changed | ? | Require re-verification via portal |
| UPI app not installed | ? | Show "Install UPI app" or use different method |

**Settlement Edge Cases:**
| Scenario | Current Handling | Recommended |
|----------|------------------|-------------|
| Settlement to wrong account | ? | Pre-verification via penny drop |
| Landlord account frozen | Retry 3x, refund | Notify landlord to update bank |
| Bank maintenance window | Settlement delayed | Queue with retry, notify both parties |

### 4B.3 Missing Features (Future Scope)

| Feature | Priority | Notes |
|---------|----------|-------|
| Co-tenant support | P1 | Allow multiple tenants per property |
| Multiple properties | P2 | One user, multiple rentals |
| Rent reminders | P1 | Push notifications before due date |
| Auto-pay | P2 | Scheduled UPI mandate |
| Payment receipts PDF | P1 | Downloadable/shareable receipt |
| In-app support chat | P2 | Help without leaving app |
| Dark mode | P3 | iOS system preference |
| Biometric auth | P2 | Face ID/Touch ID for payments |
| Widget | P3 | iOS home screen widget for rent status |

### 4B.4 API Rate Limits & Costs to Monitor

| Service | Rate Limit | Cost Impact | Mitigation |
|---------|------------|-------------|------------|
| Twilio Verify | 5 OTPs/phone/10min | ₹0.50/OTP | Implement cooldown UI |
| Cashfree Mobile 360 | ? | ₹3/verification | Cache results, don't re-verify |
| GCP Document AI | 1000 pages/month free | ₹1/page after | Monitor usage, optimize |
| Gemini API | ? | ₹0.10/request | Batch processing, caching |
| PayU | No limit | 2% transaction | Standard |

### 4B.5 Security Considerations

| Area | Risk | Mitigation |
|------|------|------------|
| Agreement upload | Malicious files | Validate file type, scan before processing |
| Bank details | Data breach | Encrypt at rest, mask in UI |
| OTP | Brute force | Rate limit, lockout after 3 failures |
| Deep links | Phishing | Validate token, short expiry |
| API keys | Exposure | Backend-only, never in app |

---

## 5. Multi-Tenant & Property Deduplication

### 5.1 The Flatmate Problem

**Scenario:**
```
Property: 123 MG Road, Bangalore
Tenant 1: Atri (uploads agreement, pays rent)
Tenant 2: Rahul (flatmate, tries to onboard same property)

Problem: Same rent shouldn't be paid twice!
```

**Solution: Property Deduplication**

```
When new user uploads agreement:
         ↓
Extract property address
         ↓
Normalize address (remove apt/flat variations, standardize)
         ↓
Check existing properties table:
  - Fuzzy match on address (85% threshold)
  - Same city
  - Same rent amount (within 10%)
         ↓
IF MATCH FOUND:
  Check if existing tenancy is active
         ↓
  IF ACTIVE:
    Block onboarding with message:
    "This property already has an active tenant on Secured.
     If you're a co-tenant, ask {existing_tenant} to add you."
         ↓
  IF INACTIVE (ended):
    Allow onboarding (new tenancy)
```

### 5.2 Co-Tenant Support (Future)

```
NOT IN MVP - but design for it:

Primary tenant can "invite" co-tenants
         ↓
Co-tenants verified separately
         ↓
Rent split between co-tenants
         ↓
Each gets proportional cashback
         ↓
Landlord receives full amount

Table: tenancy_members
- tenancy_id
- user_id
- share_percentage
- is_primary
```

---

## 6. Payment Flow Deep Dive

### 6.1 Payment Window Rules

```
WINDOW: 1st - 7th of each month

Pay on 1st-7th: Full cashback earned ✓
Pay on 8th-31st: Payment allowed, NO cashback ✗

Why strict window?
- Encourages timely payment
- Predictable cash flow for landlords
- Reduces support queries about "missed cashback"
```

### 6.2 One Payment Per Month Rule

```
RULE: Only ONE successful rent payment per property per month

Why?
- Prevents duplicate payments
- Prevents cashback gaming
- Simplifies reconciliation

Implementation:
IF payment exists for (tenancy_id, month_year) with status='success':
  Block new payment attempt
  Show: "Rent for {month} already paid on {date}"
```

### 6.3 Payment Methods by User Status

| User Status | UPI | Debit Card | Net Banking | Credit Card |
|-------------|-----|------------|-------------|-------------|
| QUALIFIED (no landlord confirm) | ✓ | ✓ | ✓ | ✗ |
| COMPLETE (landlord + KYC done) | ✓ | ✓ | ✓ | ✓ |

### 6.4 PayU Settlement

```
PAYMENT FLOW:

Tenant initiates payment: ₹50,000 + PG fees
         ↓
PayU processes payment
         ↓
Settlement instruction:
  - Landlord receives: ₹50,000 (FULL rent amount)
  - PG fees: Deducted from tenant payment
         ↓
Settlement T+2 days
         ↓
Landlord receives full rent in bank account

PG FEE STRUCTURE (approximate):
• UPI: ~0.5-1%
• Debit Card: ~1-1.5%
• Credit Card: ~2-2.5%
• Net Banking: ~1.5-2%

TENANT PAYS:
Rent (₹50,000) + PG Fee (~₹500-1,250) = Total debit
```

### 6.5 Settlement Status Tracking

```
Payment statuses:
┌─────────────────────────────────────────────────────────────────────┐
│  INITIATED → PROCESSING → SUCCESS → SETTLING →                     │
│                              ↓         ↓                           │
│                           FAILED    SETTLED                        │
│                              ↓         ↓                           │
│                           REFUNDED  COMPLETED                      │
└─────────────────────────────────────────────────────────────────────┘

Settlement statuses:
PENDING: Payment success, waiting for T+2
PROCESSING: Settlement initiated with bank
SETTLED: Money reached landlord account
FAILED: Settlement failed (retry mechanism)
REFUNDED: Settlement failed 3x, refund to tenant
```

### 6.6 Settlement Failure Handling

```
IF settlement fails:
         ↓
Auto-retry every 4 hours (3 attempts max)
         ↓
After 3 failures:
  - Notify ops team
  - Notify tenant: "Settlement delayed, investigating"
  - Notify landlord: "Payment received, settlement processing"
         ↓
IF not resolved in 24 hours:
  - Auto-refund to tenant
  - Notify both parties
  - Ops follow up on bank issue
```

---

## 7. Transaction History

### 7.1 What Users See

```
TENANT VIEW:
┌─────────────────────────────────────────────────────┐
│ January 2024                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✓ Rent Payment                    -₹49,550     │ │
│ │   Paid on 3rd Jan • UPI                        │ │
│ │   Cashback earned: +₹500                       │ │
│ │   Settlement: Completed                         │ │
│ │   [View Receipt]                               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ December 2023                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✗ Payment Failed                   ₹50,000     │ │
│ │   5th Dec • Card declined                      │ │
│ │   [Retry Payment]                              │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✓ Rent Payment                    -₹50,000     │ │
│ │   6th Dec • Net Banking                        │ │
│ │   Cashback earned: +₹500                       │ │
│ │   Settlement: Completed                         │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 7.2 Failed Payments in History

**Rule:** Show ALL payment attempts, including failures

**Why?**
- Transparency
- Debugging for support
- User understands what happened
- Proof of payment attempts

**What to show for failed:**
- Timestamp
- Amount attempted
- Payment method
- Failure reason (user-friendly)
- Option to retry (if same month, not yet paid)

### 7.3 Settlement Status Display

```
For each successful payment, show:

IMMEDIATE (after payment):
"Payment successful. Settlement in progress."

AFTER T+2:
"Settled to landlord on {date}"

IF DELAYED:
"Settlement processing. Expected by {date}."

IF FAILED:
"Settlement issue. We're working on it. Your landlord will receive payment soon."
```

---

## 8. Vacancy Cover Deep Dive (Assurekit Partnership)

### 8.1 Program Overview

**Insurance Partner:** Assurekit
**Plan:** Annual Plan (paid monthly)
**Premium:** 0.50% of monthly rent (exclusive of GST)

### 8.2 Benefits

| Benefit | Description | Payout | Conditions |
|---------|-------------|--------|------------|
| **Un-occupancy Guarantee** | Property remains vacant for 30 days after tenant moves out, and Flent cannot find replacement | Up to 1 month's rent (max ₹1.5L) | Tenant must have served notice (min 30 days) through Flent platform |
| **Tenant Abandonment** | Tenant abandons property and it remains vacant after security deposit period ends (min 60 days) | Up to 1 month's rent (max ₹1.5L) | Abandonment must be validated through Flent's verification process |

### 8.3 General Conditions

```
WAITING PERIOD:
• 90-day initial waiting period from activation before any claims

ELIGIBILITY:
• Only tenants who complete Flent's verification/vetting process
• Full annual premium must be paid for claim eligibility
• All units must remain enrolled for entire policy period

ACTIVATION:
• Coverage activates after initial fee received + tenant verification complete

TERMINATION:
• Program terminated
• Fees unpaid
• Terms violated
• Landlord removes property from Flent

EXCLUSIONS:
• Landlord rejects qualified replacement tenant (meets terms + 5-10% escalation)
• Property under repair/renovation during unoccupied period
• Misrepresentation or collusion between landlord and tenant

LIMITS:
• Maximum ONE claim per property per policy period (regardless of benefit type)
```

### 8.4 Pricing Example

```
Monthly rent: ₹50,000
Monthly premium: ₹250 (0.50% of rent)
Annual premium: ₹3,000

Coverage amount: ₹50,000 (1 month rent, capped at ₹1.5L)

Note: Prices subject to review when loss ratio hits 65% of collected premium
```

### 8.5 Cover Activation Flow

```
ACTIVATION TIMELINE:

Day 0: Tenant completes verification + First payment
         ↓
Day 1-90: WAITING PERIOD (no claims allowed)
         ↓
Day 91+: COVERAGE ACTIVE
         ↓
Coverage continues until:
  - Agreement ends
  - Tenant offboards
  - Premium unpaid
  - Policy violation
```

### 8.6 Claim Process

```
UN-OCCUPANCY CLAIM:
1. Tenant serves 30-day notice via Flent app
2. Tenant vacates property
3. 30-day replacement window begins
4. Flent attempts to find replacement tenant
5. IF no replacement after 30 days:
   - Landlord files claim via portal
   - Assurekit verification
   - Payout: 1 month rent (max ₹1.5L)

ABANDONMENT CLAIM:
1. Landlord reports tenant abandonment via portal
2. Flent verification process (attempt contact)
3. Security deposit period must end (min 60 days)
4. IF still vacant:
   - Landlord files claim
   - Assurekit verification
   - Payout: 1 month rent (max ₹1.5L)
```

### 8.7 Cover Status Display

```
TENANT VIEW (App):
┌─────────────────────────────────────────────────────┐
│ 🛡️ Vacancy Cover for your Landlord                 │
│                                                     │
│ Status: WAITING PERIOD                              │
│ Active from: March 15, 2024 (Day 45/90)            │
│                                                     │
│ Your landlord will get up to ₹1.5L protection      │
│ if you need to move out unexpectedly.              │
└─────────────────────────────────────────────────────┘

LANDLORD VIEW (Web Portal):
┌─────────────────────────────────────────────────────┐
│ 🛡️ Your Vacancy Cover                              │
│                                                     │
│ Status: ACTIVE ✓                                   │
│ Coverage: Up to ₹50,000 (1 month rent)             │
│ Policy period: Jan 1 - Dec 31, 2024                │
│                                                     │
│ Benefits:                                           │
│ • Un-occupancy Guarantee (30-day vacancy)          │
│ • Tenant Abandonment Protection                     │
│                                                     │
│ [View Policy Details] [File Claim]                 │
└─────────────────────────────────────────────────────┘
```

---

## 9. Cashback System

### 9.1 Earning Rules

```
RULE: 1% cashback on rent amount (before PG fees)

Timing: Credited immediately after payment success
Application: Auto-applied to NEXT month's rent payment

COMPOUNDING EXAMPLE:
Month 1: Rent ₹50,000 → Pay ₹50,000 + PG fees → Earn ₹500 cashback
Month 2: Rent ₹50,000 → Apply ₹500 → Pay ₹49,500 + PG fees → Earn ₹500
Month 3: Rent ₹50,000 → Apply ₹500 → Pay ₹49,500 + PG fees → Earn ₹500
...and so on

Note: Cashback is calculated on BASE RENT (₹50,000), not on amount paid.
This means tenant always earns ₹500 (1% of ₹50K) regardless of previous cashback.

LANDLORD ALWAYS RECEIVES: Full ₹50,000 rent
TENANT BENEFIT: Pays less each month (rent - cashback)
```

### 9.2 Cashback States

```
ACCUMULATED (for QUALIFIED users):
- Earned but locked
- Displayed as "Pending cashback"
- Unlocks when user reaches COMPLETE status

AVAILABLE (for COMPLETE users):
- Can be used on next payment
- Auto-applied by default
- Shows in wallet

USED:
- Applied to a payment
- Shown in transaction history
```

### 9.3 Auto-Apply Behavior

```
DEFAULT: Always auto-apply available cashback

Why auto-apply?
- Users want maximum benefit
- Reduces decision fatigue
- Increases perceived value

Display:
"Rent amount: ₹50,000
 Cashback applied: -₹500
 You pay: ₹49,500"

Toggle option: [Use cashback ✓] (for users who want to accumulate)
```

---

## 10. User States & Permissions

### 10.1 State Machine

```
SIGNED_UP
    │
    ▼ (uploads agreement)
WAITLISTED
    │
    ▼ (admin approves)
APPROVED/QUALIFIED
    │
    ▼ (landlord confirms + KYC)
COMPLETE


Special states:
NOT_ELIGIBLE: Admin rejected (low rent, unsupported city)
SUSPENDED: Fraud or policy violation
CHURNED: User deleted account
```

### 10.2 Permission Matrix

| Feature | SIGNED_UP | WAITLISTED | QUALIFIED | COMPLETE |
|---------|-----------|------------|-----------|----------|
| View dashboard | ✗ | ✓ (limited) | ✓ | ✓ |
| Pay rent | ✗ | ✗ | ✓ | ✓ |
| UPI/Debit/NetBanking | ✗ | ✗ | ✓ | ✓ |
| Credit Card | ✗ | ✗ | ✗ | ✓ |
| Use cashback | ✗ | ✗ | ✗ | ✓ |
| Earn cashback | ✗ | ✗ | ✓ (pending) | ✓ (available) |
| Vacancy cover | ✗ | ✗ | ✗ | ✓ (after 3 payments) |
| Refer friends | ✗ | ✓ | ✓ | ✓ |

---

## 11. Referral System

### 11.1 Referral Mechanics

```
REFERRER REWARD: ₹250 cashback
REFEREE REWARD: ₹250 cashback

Trigger: Referee completes first rent payment

Why first payment (not signup)?
- Ensures quality referrals
- Reduces gaming
- Aligns incentives with business value
```

### 11.2 Referral Flow

```
Referrer shares code: "ATRI250"
         ↓
Referee downloads app
         ↓
Referee enters code during onboarding
         ↓
Code stored, referee completes onboarding
         ↓
Referee pays first rent
         ↓
BOTH get ₹250 credited:
- Referrer: Added to wallet
- Referee: Added to wallet (can use on next payment)
```

### 11.3 Anti-Gaming Rules

```
- One referral per device
- One referral per phone number
- Referrer must have at least 1 successful payment
- Self-referral detection (same bank account, similar names)
```

---

## 12. Edge Cases & Error Handling

### 12.1 Onboarding Edge Cases

| Scenario | Handling |
|----------|----------|
| Rent < ₹45,000 | Show: "Currently serving ₹45K+ rent. Join waitlist for future." |
| City not supported | Show: "Coming to {city} soon! Join waitlist." |
| Agreement expired | Allow if within 30 days of renewal |
| No agreement (verbal) | Cannot proceed - agreement required |
| Foreign landlord | Allow, but manual settlement verification |
| Multiple properties | One at a time (MVP) |

### 12.2 Payment Edge Cases

| Scenario | Handling |
|----------|----------|
| Double payment same month | Block: "Already paid for {month}" |
| Payment during maintenance | Queue and process when up |
| Partial payment | Not allowed - full amount only |
| Payment > ₹2L | Requires additional KYC |
| Chargebacks | Suspend account, investigate |

### 12.3 Landlord Edge Cases

| Scenario | Handling |
|----------|----------|
| Landlord disputes tenancy | Pause payments, investigate |
| Landlord phone changed | OTP to new number, verify via tenant |
| Landlord deceased | Manual process with legal heir |
| Multiple landlords | Primary landlord receives payment |
| Landlord never confirms | Payments allowed, cashback pending |

---

## 13. Database Schema (New Tables)

### 13.1 Core Tables Needed

```sql
-- Landlord profiles (separate from users)
CREATE TABLE landlord_profiles (
  id UUID PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  pan_number VARCHAR(10),
  kyc_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank accounts (for landlords)
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY,
  landlord_id UUID REFERENCES landlord_profiles(id),
  account_number VARCHAR(20) NOT NULL,
  ifsc_code VARCHAR(11) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255),
  penny_drop_verified BOOLEAN DEFAULT FALSE,
  penny_drop_name VARCHAR(255),
  name_match_score DECIMAL(5,2),
  payu_merchant_id VARCHAR(50),
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties (for deduplication)
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  pincode VARCHAR(6),
  normalized_address TEXT, -- For fuzzy matching
  electricity_consumer_number VARCHAR(50),
  ownership_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenancies (link tenant, landlord, property)
CREATE TABLE tenancies (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  landlord_id UUID REFERENCES landlord_profiles(id),
  property_id UUID REFERENCES properties(id),
  monthly_rent_paise BIGINT NOT NULL,
  security_deposit_paise BIGINT,
  agreement_start_date DATE,
  agreement_end_date DATE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, ended
  landlord_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landlord invitations
CREATE TABLE landlord_invitations (
  id UUID PRIMARY KEY,
  tenancy_id UUID REFERENCES tenancies(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  sent_via VARCHAR(20), -- whatsapp, sms, email
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reminder_count INT DEFAULT 0
);

-- Rent payments
CREATE TABLE rent_payments (
  id UUID PRIMARY KEY,
  tenancy_id UUID REFERENCES tenancies(id),
  month_year VARCHAR(7) NOT NULL, -- "2024-01"
  amount_paise BIGINT NOT NULL,
  cashback_applied_paise BIGINT DEFAULT 0,
  cashback_earned_paise BIGINT DEFAULT 0,
  payment_method VARCHAR(20), -- upi, debit, credit, netbanking
  payu_transaction_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'initiated',
  -- initiated, processing, success, failed, refunded
  failure_reason TEXT,
  settled_at TIMESTAMPTZ,
  settlement_status VARCHAR(20),
  -- pending, processing, settled, failed, refunded
  settlement_reference VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenancy_id, month_year, status) -- Prevent duplicate success
);

-- Cashback ledger
CREATE TABLE cashback_ledger (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  payment_id UUID REFERENCES rent_payments(id),
  amount_paise BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL, -- earned, redeemed, expired, bonus
  status VARCHAR(20) DEFAULT 'pending', -- pending, available, used
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacancy covers
CREATE TABLE vacancy_covers (
  id UUID PRIMARY KEY,
  tenancy_id UUID REFERENCES tenancies(id),
  landlord_id UUID REFERENCES landlord_profiles(id),
  cover_amount_paise BIGINT NOT NULL, -- ₹1.5L or 1 month rent
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, active, claimed, expired
  payments_count INT DEFAULT 0,
  activated_at TIMESTAMPTZ,
  expires_at DATE,
  claim_filed_at TIMESTAMPTZ,
  claim_status VARCHAR(20), -- filed, reviewing, approved, paid, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referrer_id UUID REFERENCES users(id),
  referee_id UUID REFERENCES users(id),
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'signed_up',
  -- signed_up, paid, rewarded
  referrer_reward_paise BIGINT,
  referee_reward_paise BIGINT,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 13.2 Existing Tables (Reference)

```
users: 73 rows - User accounts with status enum
waitlist: 30 rows - Document uploads and review status
extracted_rental_info: 28 rows - OCR results
rental_parties: 71 rows - Tenant/landlord contacts
supported_cities: 7 rows - Eligible cities
deleted_users_archive: 83 rows - GDPR compliance
device_tokens: Push notification tokens
notification_queue: Pending notifications
```

---

## 14. External Services Integration

### 14.1 Service Map

```
┌────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  IDENTITY & KYC                    PAYMENTS                        │
│  ──────────────                    ────────                        │
│  Cashfree Secure ID                PayU India                      │
│  ├─ Mobile 360 API                 ├─ Payment Gateway              │
│  └─ Bank Verification              ├─ Split Settlement             │
│                                    └─ Merchant Onboarding          │
│  DigiLocker                                                        │
│  └─ Aadhaar e-KYC                  COMMUNICATION                   │
│                                    ─────────────                   │
│  DOCUMENT PROCESSING               MSG91                           │
│  ───────────────────               ├─ OTP SMS                      │
│  GCP Document AI                   └─ Transactional SMS            │
│  └─ OCR extraction                                                 │
│                                    Gupshup                         │
│  Google Gemini                     └─ WhatsApp Business API        │
│  └─ AI parsing                                                     │
│                                    APNs                            │
│  VALIDATION                        └─ iOS Push Notifications       │
│  ──────────                                                        │
│  SHCIL (optional)                  ANALYTICS                       │
│  └─ Stamp verification             ──────────                      │
│                                    PostHog                         │
│  Firecrawl/Hyperbrowser            └─ Product analytics            │
│  └─ Web scraping for SHCIL                                         │
│                                    Sentry                          │
│                                    └─ Error tracking               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 14.2 API Costs (Estimated)

| Service | Cost | Usage |
|---------|------|-------|
| Cashfree Mobile 360 | ~₹3/verification | On signup |
| Cashfree Penny Drop | ~₹2/verification | On landlord bank add |
| PayU Transaction | ~2% of transaction | On each payment |
| MSG91 OTP | ~₹0.15/SMS | On login, verification |
| Gupshup WhatsApp | ~₹0.50/message | Landlord invitations |
| GCP Document AI | ~₹1/page | On document upload |
| Gemini API | ~₹0.10/request | On extraction |

---

## 15. Tech Stack Summary

### 15.0 Architecture Principles

```
BACKEND-FIRST VERIFICATION:
All verification checks run on Supabase backend, NOT in the mobile app.

WHY?
• Fewer edge cases in mobile app
• Fewer failure scenarios for users
• Centralized retry/fallback logic
• Easier debugging and monitoring
• Consistent behavior across platforms
• Security (API keys stay server-side)

WHAT RUNS ON BACKEND (Edge Functions):
• Mobile 360 API calls (Cashfree)
• Penny Drop verification
• Name matching algorithms
• Agreement OCR + AI extraction
• SHCIL stamp validation
• DigiLocker KYC flow
• Property deduplication checks
• Cashback calculations
• Vacancy cover status updates

WHAT MOBILE APP DOES:
• Collects user input (forms, uploads)
• Displays results/status
• Handles payment gateway redirect
• Shows notifications
• Offline caching of user data

FLOW PATTERN:
App → Supabase Edge Function → External API → Process result → Return to App
                     ↓
              Store in database
                     ↓
              Trigger notifications if needed
```

### 15.1 Mobile (iOS)

```
Framework:      SwiftUI (iOS 16+)
Architecture:   MVVM + Clean Architecture
State:          Combine + @Observable
Storage:        MMKV (fast key-value)
Network:        URLSession + async/await
Auth:           Supabase Swift SDK
Animations:     SwiftUI + Lottie
Analytics:      PostHog iOS SDK
Errors:         Sentry iOS SDK

DESIGN PRINCIPLE:
• Thin client - minimal business logic
• App is a "view" into backend state
• All verification happens server-side
• Graceful degradation on network issues
```

### 15.2 Backend (Supabase)

```
Database:       PostgreSQL (existing)
API:            Edge Functions (Deno/TypeScript)
Auth:           Supabase Auth
Storage:        Supabase Storage
Realtime:       Supabase Realtime (payment status)
```

### 15.3 Web (Landlord Portal)

```
Framework:      Next.js 14 (App Router)
Styling:        Tailwind CSS
Components:     shadcn/ui
Auth:           OTP via Supabase
Deployment:     Vercel
```

---

## 16. Open Questions for Discussion

### 16.1 Business Questions

1. **Cashback expiry:** Should unused cashback expire? (30 days? 90 days? Never?)
2. **Late payment fee:** Should there be a fee for payments after 7th?
3. **Failed payment retry limit:** How many times can user retry in same month?
4. **Landlord confirmation deadline:** What if landlord never confirms? (Currently: allow payments anyway)

### 16.2 Product Questions

1. **Co-tenant support:** Should we allow multiple tenants per property in MVP?
2. **Multiple properties:** Should one user manage multiple properties?
3. **Rent increase handling:** How to handle mid-year rent increases?
4. **Early termination:** What happens if tenant ends agreement early?

### 16.3 Technical Questions

1. **Offline mode:** Required? Or always-online OK for MVP?
2. **SHCIL validation:** Worth the complexity? Or skip for MVP?
3. **Electricity bill OCR:** Build custom or use existing service?

---

## 17. Next Steps (After Approval)

1. **Design Phase:**
   - Create comprehensive FigJam with all flows
   - Design system (colors, typography, components)
   - Screen-by-screen wireframes

2. **Technical Phase:**
   - Set up SwiftUI project structure
   - Create Supabase migrations for new tables
   - Integrate Cashfree APIs
   - Integrate PayU APIs

3. **Parallel Workstreams:**
   - iOS app development
   - Landlord web portal (Next.js)
   - Edge functions for business logic
   - Admin dashboard (internal tool)

---

*This document serves as the comprehensive brainstorming foundation. Once approved, we'll proceed to visual design in FigJam.*
