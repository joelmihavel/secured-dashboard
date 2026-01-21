# D01: Database Schema Reference

---
doc_type: data
status: approved
database: PostgreSQL (Supabase)
---

## 📊 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                   │
│                                                                             │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │
│  │   users     │         │  tenancies  │         │  landlord   │          │
│  │  (tenant)   │◄───────►│             │◄───────►│  profiles   │          │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘          │
│         │                       │                       │                  │
│         │                       │                       │                  │
│         ▼                       ▼                       ▼                  │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐          │
│  │   tenant    │         │ agreements  │         │  landlord   │          │
│  │   wallets   │         │             │         │  consents   │          │
│  └─────────────┘         └─────────────┘         └─────────────┘          │
│                                 │                       │                  │
│                                 │                       │                  │
│                                 ▼                       ▼                  │
│                          ┌─────────────┐         ┌─────────────┐          │
│                          │ properties  │         │  vacancy    │          │
│                          │             │         │  covers     │          │
│                          └─────────────┘         └─────────────┘          │
│                                                                             │
│                          ┌─────────────┐         ┌─────────────┐          │
│                          │    rent     │         │  cashback   │          │
│                          │  payments   │────────►│   ledger    │          │
│                          └─────────────┘         └─────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Table Definitions

### 1. users (Tenants)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    mobile VARCHAR(15) NOT NULL UNIQUE,
    mobile_verified BOOLEAN DEFAULT FALSE,
    mobile_verified_at TIMESTAMP,

    -- Profile
    full_name VARCHAR(255),
    email VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    dob DATE,
    profile_picture_url TEXT,

    -- Identity (from Cashfree M360)
    m360_session_id VARCHAR(100),
    identity_data JSONB,  -- Raw M360 response

    -- KYC
    aadhaar_verified BOOLEAN DEFAULT FALSE,
    aadhaar_verified_at TIMESTAMP,
    pan_number VARCHAR(10),
    pan_verified BOOLEAN DEFAULT FALSE,

    -- Onboarding
    onboarding_status VARCHAR(30) DEFAULT 'STARTED',
    -- STARTED, PROFILE_COMPLETE, AGREEMENT_UPLOADED, VERIFIED, ACTIVE
    onboarding_completed_at TIMESTAMP,

    -- Device
    device_id VARCHAR(255),
    fcm_token TEXT,
    app_version VARCHAR(20),
    os_version VARCHAR(50),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP,

    -- Soft delete
    deleted_at TIMESTAMP,

    CONSTRAINT valid_mobile CHECK (mobile ~ '^[6-9][0-9]{9}$')
);

CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_onboarding ON users(onboarding_status);
```

**Sample Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "mobile": "9876543210",
  "mobile_verified": true,
  "full_name": "Priya Sharma",
  "email": "priya@email.com",
  "onboarding_status": "ACTIVE"
}
```

---

### 2. landlord_profiles

```sql
CREATE TABLE landlord_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    full_name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(255),
    mobile_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,

    -- Verification
    otp_verified_at TIMESTAMP,
    verification_method VARCHAR(20),  -- 'SMS', 'WHATSAPP'

    -- Bank Details
    bank_account_number VARCHAR(20),
    bank_ifsc VARCHAR(15),
    bank_account_holder_name VARCHAR(255),
    bank_name VARCHAR(100),
    bank_verified BOOLEAN DEFAULT FALSE,
    bank_verified_at TIMESTAMP,
    penny_drop_reference VARCHAR(100),

    -- PayU Integration
    payu_child_merchant_key VARCHAR(100),
    payu_merchant_id VARCHAR(100),
    payu_onboarding_status VARCHAR(30) DEFAULT 'PENDING',
    -- PENDING, KYC_REQUIRED, ACTIVE, SUSPENDED
    payu_onboarded_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT valid_landlord_mobile CHECK (mobile ~ '^[6-9][0-9]{9}$'),
    CONSTRAINT valid_ifsc CHECK (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$')
);

CREATE INDEX idx_landlord_mobile ON landlord_profiles(mobile);
CREATE INDEX idx_landlord_payu ON landlord_profiles(payu_child_merchant_key);
```

---

### 3. properties

```sql
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Address
    address_line_1 VARCHAR(500) NOT NULL,
    address_line_2 VARCHAR(500),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    pincode VARCHAR(10) NOT NULL,

    -- Raw OCR data
    raw_address_text TEXT,

    -- Property Details
    property_type VARCHAR(50),  -- 'APARTMENT', 'HOUSE', 'VILLA', 'PG'

    -- Future: Geolocation
    -- latitude DECIMAL(10, 8),
    -- longitude DECIMAL(11, 8),
    -- google_place_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_properties_pincode ON properties(pincode);
CREATE INDEX idx_properties_city ON properties(city);
```

---

### 4. agreements

```sql
CREATE TABLE agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership
    uploaded_by UUID NOT NULL REFERENCES users(id),

    -- File Storage
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(50),  -- 'PDF', 'JPG', 'PNG'

    -- Upload Session (for resumable uploads)
    upload_session_id VARCHAR(100),
    upload_completed_at TIMESTAMP,

    -- OCR Processing
    ocr_status VARCHAR(30) DEFAULT 'PENDING',
    -- PENDING, PROCESSING, COMPLETED, FAILED
    ocr_started_at TIMESTAMP,
    ocr_completed_at TIMESTAMP,
    ocr_raw_text TEXT,
    ocr_extracted_data JSONB,
    ocr_confidence_score DECIMAL(5, 4),

    -- Extracted Fields (denormalized for quick access)
    extracted_landlord_name VARCHAR(255),
    extracted_landlord_mobile VARCHAR(15),
    extracted_landlord_email VARCHAR(255),
    extracted_tenant_name VARCHAR(255),
    extracted_rent_amount DECIMAL(10, 2),
    extracted_security_deposit DECIMAL(10, 2),
    extracted_start_date DATE,
    extracted_end_date DATE,
    extracted_address TEXT,

    -- Stamp Verification
    stamp_number VARCHAR(100),
    stamp_verified BOOLEAN DEFAULT FALSE,
    stamp_verified_at TIMESTAMP,
    stamp_verification_source VARCHAR(50),  -- 'SHCIL', 'MANUAL'
    stamp_verification_response JSONB,

    -- Status
    status VARCHAR(30) DEFAULT 'UPLOADED',
    -- UPLOADED, OCR_PROCESSING, OCR_COMPLETE, STAMP_VERIFYING,
    -- VERIFIED, VERIFICATION_FAILED, REJECTED

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agreements_user ON agreements(uploaded_by);
CREATE INDEX idx_agreements_status ON agreements(status);
CREATE INDEX idx_agreements_ocr_status ON agreements(ocr_status);
```

**OCR Extracted Data Schema:**
```json
{
  "landlord": {
    "name": "Ramesh Kumar",
    "mobile": "9876543210",
    "email": "ramesh@email.com",
    "address": "..."
  },
  "tenant": {
    "name": "Priya Sharma",
    "mobile": "9123456789"
  },
  "property": {
    "address": "302, Sunshine Apartments...",
    "type": "2BHK Apartment"
  },
  "terms": {
    "monthly_rent": 25000,
    "security_deposit": 75000,
    "start_date": "2025-01-15",
    "end_date": "2026-01-14",
    "rent_due_day": 1
  },
  "stamp": {
    "number": "KARN123456789",
    "date": "2025-01-10",
    "value": 5000
  },
  "confidence": {
    "overall": 0.92,
    "landlord_name": 0.95,
    "rent_amount": 0.98
  }
}
```

---

### 5. tenancies

```sql
CREATE TABLE tenancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    tenant_id UUID NOT NULL REFERENCES users(id),
    landlord_id UUID REFERENCES landlord_profiles(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    agreement_id UUID NOT NULL REFERENCES agreements(id),

    -- Terms (from OCR)
    monthly_rent DECIMAL(10, 2) NOT NULL,
    security_deposit DECIMAL(10, 2),
    agreement_start_date DATE NOT NULL,
    agreement_end_date DATE NOT NULL,
    rent_due_day INTEGER DEFAULT 1,

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_LANDLORD',
    -- PENDING_LANDLORD, ACTIVE, NOTICE_PERIOD, ENDED, DISPUTED

    -- Landlord Confirmation
    landlord_confirmed_at TIMESTAMP,
    landlord_confirmation_ip VARCHAR(45),
    landlord_confirmation_user_agent TEXT,

    -- Payment Stats (denormalized for quick access)
    total_payments_made INTEGER DEFAULT 0,
    last_payment_date DATE,
    next_payment_due DATE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    ended_reason VARCHAR(100),

    -- Constraints
    CONSTRAINT valid_dates CHECK (agreement_end_date > agreement_start_date),
    CONSTRAINT valid_rent CHECK (monthly_rent > 0)
);

CREATE INDEX idx_tenancies_tenant ON tenancies(tenant_id);
CREATE INDEX idx_tenancies_landlord ON tenancies(landlord_id);
CREATE INDEX idx_tenancies_status ON tenancies(status);
CREATE UNIQUE INDEX idx_tenancies_active ON tenancies(tenant_id, property_id)
    WHERE status IN ('PENDING_LANDLORD', 'ACTIVE');
```

---

### 6. landlord_invitations

```sql
CREATE TABLE landlord_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenancy_id UUID NOT NULL REFERENCES tenancies(id),

    -- Token
    token VARCHAR(100) NOT NULL UNIQUE,
    short_token VARCHAR(20) UNIQUE,

    -- Pre-filled Data
    prefilled_name VARCHAR(255),
    prefilled_email VARCHAR(255),
    prefilled_mobile VARCHAR(15),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, OPENED, COMPLETED, EXPIRED, REVOKED

    -- Delivery
    sent_via TEXT[],  -- ['EMAIL', 'SMS', 'WHATSAPP']
    sent_at TIMESTAMP,

    -- Tracking
    opened_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Expiry
    expires_at TIMESTAMP NOT NULL,

    -- Reminders
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON landlord_invitations(token);
CREATE INDEX idx_invitations_short ON landlord_invitations(short_token);
CREATE INDEX idx_invitations_tenancy ON landlord_invitations(tenancy_id);
```

---

### 7. landlord_consents

```sql
CREATE TABLE landlord_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    landlord_id UUID NOT NULL REFERENCES landlord_profiles(id),
    tenancy_id UUID NOT NULL REFERENCES tenancies(id),

    -- Consent Type
    consent_type VARCHAR(50) NOT NULL,
    -- TENANCY_CONFIRMATION, VACANCY_COVER_ACCEPTANCE,
    -- COMMUNICATION_OPT_IN, CLAIM_AUTHORIZATION

    -- Consent Details
    consent_given BOOLEAN NOT NULL,
    consent_text TEXT NOT NULL,
    consent_version VARCHAR(20) NOT NULL,

    -- Audit Trail
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),

    -- Timestamps
    given_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_reason TEXT
);

CREATE INDEX idx_consents_landlord ON landlord_consents(landlord_id);
CREATE INDEX idx_consents_tenancy ON landlord_consents(tenancy_id);
CREATE INDEX idx_consents_type ON landlord_consents(consent_type);
```

---

### 8. vacancy_covers

```sql
CREATE TABLE vacancy_covers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    tenancy_id UUID NOT NULL UNIQUE REFERENCES tenancies(id),
    landlord_id UUID NOT NULL REFERENCES landlord_profiles(id),

    -- Policy Details
    cover_amount DECIMAL(10, 2) NOT NULL DEFAULT 150000.00,
    premium_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    premium_paid_by VARCHAR(20) DEFAULT 'SECURED',

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    -- PENDING_ACCEPTANCE, PENDING_ACTIVATION, ACTIVE,
    -- CLAIM_INITIATED, CLAIM_APPROVED, CLAIM_REJECTED,
    -- EXPIRED, CANCELLED

    -- Activation
    payments_required INTEGER DEFAULT 3,
    payments_completed INTEGER DEFAULT 0,
    accepted_at TIMESTAMP,
    activated_at TIMESTAMP,

    -- Policy Period
    cover_start_date DATE,
    cover_end_date DATE,

    -- Insurance Partner (extensible)
    insurer_policy_id VARCHAR(100),
    insurer_reference JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vacancy_cover_status ON vacancy_covers(status);
CREATE INDEX idx_vacancy_cover_landlord ON vacancy_covers(landlord_id);
```

---

### 9. rent_payments

```sql
CREATE TABLE rent_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    tenancy_id UUID NOT NULL REFERENCES tenancies(id),
    tenant_id UUID NOT NULL REFERENCES users(id),
    landlord_id UUID NOT NULL REFERENCES landlord_profiles(id),

    -- Payment Period
    rent_month DATE NOT NULL,

    -- Amounts
    rent_amount DECIMAL(10, 2) NOT NULL,
    cashback_applied DECIMAL(10, 2) DEFAULT 0,
    amount_paid DECIMAL(10, 2) NOT NULL,
    landlord_amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    cashback_earned DECIMAL(10, 2) NOT NULL,

    -- PayU Details
    payu_txnid VARCHAR(100) NOT NULL UNIQUE,
    payu_payment_id VARCHAR(100),
    payment_mode VARCHAR(50),
    landlord_sub_txnid VARCHAR(100),
    platform_sub_txnid VARCHAR(100),

    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    -- INITIATED, PENDING, SUCCESS, SETTLEMENT_RELEASED,
    -- SETTLED, FAILED, REFUNDED

    -- Settlement
    settlement_released_at TIMESTAMP,
    settlement_status VARCHAR(30),
    expected_settlement_date DATE,
    actual_settlement_date DATE,

    -- Timestamps
    initiated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_monthly_payment UNIQUE(tenancy_id, rent_month),
    CONSTRAINT valid_amounts CHECK (
        rent_amount > 0 AND
        landlord_amount > 0 AND
        platform_fee >= 0
    )
);

CREATE INDEX idx_payments_tenant ON rent_payments(tenant_id);
CREATE INDEX idx_payments_landlord ON rent_payments(landlord_id);
CREATE INDEX idx_payments_tenancy ON rent_payments(tenancy_id);
CREATE INDEX idx_payments_status ON rent_payments(status);
CREATE INDEX idx_payments_month ON rent_payments(rent_month);
CREATE INDEX idx_payments_payu ON rent_payments(payu_txnid);
```

---

### 10. cashback_ledger

```sql
CREATE TABLE cashback_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL REFERENCES users(id),
    payment_id UUID REFERENCES rent_payments(id),

    -- Cashback Details
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'RENT_CASHBACK',
    -- RENT_CASHBACK, REFERRAL_BONUS, PROMO, REDEMPTION

    -- For redemptions, this is negative
    description TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, CREDITED, REDEEMED, EXPIRED, CANCELLED

    -- Redemption
    redeemed_against_payment_id UUID REFERENCES rent_payments(id),

    -- Timestamps
    earned_at TIMESTAMP DEFAULT NOW(),
    credited_at TIMESTAMP,
    expires_at TIMESTAMP,
    redeemed_at TIMESTAMP
);

CREATE INDEX idx_cashback_tenant ON cashback_ledger(tenant_id);
CREATE INDEX idx_cashback_status ON cashback_ledger(status);
CREATE INDEX idx_cashback_payment ON cashback_ledger(payment_id);
```

---

### 11. tenant_wallets

```sql
CREATE TABLE tenant_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL UNIQUE REFERENCES users(id),

    -- Balance
    available_balance DECIMAL(10, 2) DEFAULT 0.00,
    pending_balance DECIMAL(10, 2) DEFAULT 0.00,

    -- Lifetime Stats
    total_earned DECIMAL(10, 2) DEFAULT 0.00,
    total_redeemed DECIMAL(10, 2) DEFAULT 0.00,
    total_expired DECIMAL(10, 2) DEFAULT 0.00,

    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT non_negative_balance CHECK (available_balance >= 0)
);

CREATE INDEX idx_wallet_tenant ON tenant_wallets(tenant_id);
```

---

### 12. user_consents (Tenant)

```sql
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id),

    -- Consent Type
    consent_type VARCHAR(50) NOT NULL,
    -- IDENTITY_VERIFICATION, TERMS_OF_SERVICE, PRIVACY_POLICY,
    -- MARKETING_COMMUNICATIONS, CREDIT_PULL

    -- Consent Details
    consent_given BOOLEAN NOT NULL,
    consent_text TEXT NOT NULL,
    consent_version VARCHAR(20) NOT NULL,

    -- Audit
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_id VARCHAR(255),

    -- Timestamps
    given_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX idx_user_consents_user ON user_consents(user_id);
CREATE INDEX idx_user_consents_type ON user_consents(consent_type);
```

---

## 🔄 Common Queries

### Get Tenant Dashboard Data
```sql
SELECT
    u.id,
    u.full_name,
    t.id as tenancy_id,
    t.status as tenancy_status,
    t.monthly_rent,
    p.address_line_1,
    p.city,
    l.full_name as landlord_name,
    vc.status as cover_status,
    vc.payments_completed,
    w.available_balance as cashback_balance,
    (
        SELECT COUNT(*)
        FROM rent_payments rp
        WHERE rp.tenancy_id = t.id AND rp.status = 'SUCCESS'
    ) as successful_payments
FROM users u
JOIN tenancies t ON t.tenant_id = u.id
JOIN properties p ON p.id = t.property_id
LEFT JOIN landlord_profiles l ON l.id = t.landlord_id
LEFT JOIN vacancy_covers vc ON vc.tenancy_id = t.id
LEFT JOIN tenant_wallets w ON w.tenant_id = u.id
WHERE u.id = $1 AND t.status IN ('PENDING_LANDLORD', 'ACTIVE');
```

### Check Payment Eligibility
```sql
SELECT
    t.id as tenancy_id,
    t.status,
    t.monthly_rent,
    l.payu_child_merchant_key,
    l.payu_onboarding_status,
    (
        SELECT id FROM rent_payments
        WHERE tenancy_id = t.id
        AND rent_month = DATE_TRUNC('month', CURRENT_DATE)
        AND status IN ('SUCCESS', 'PENDING')
    ) as existing_payment
FROM tenancies t
JOIN landlord_profiles l ON l.id = t.landlord_id
WHERE t.tenant_id = $1
AND t.status = 'ACTIVE';
```

### Get Landlord Pending Confirmations
```sql
SELECT
    li.id,
    li.token,
    li.status,
    li.expires_at,
    t.id as tenancy_id,
    u.full_name as tenant_name,
    p.address_line_1,
    a.extracted_rent_amount
FROM landlord_invitations li
JOIN tenancies t ON t.id = li.tenancy_id
JOIN users u ON u.id = t.tenant_id
JOIN properties p ON p.id = t.property_id
JOIN agreements a ON a.id = t.agreement_id
WHERE li.prefilled_mobile = $1
AND li.status = 'PENDING'
AND li.expires_at > NOW();
```

---

## 📊 Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| users | mobile | Auth lookup |
| landlord_profiles | mobile | Auth lookup |
| landlord_profiles | payu_child_merchant_key | Payment routing |
| tenancies | (tenant_id, status) | Dashboard queries |
| rent_payments | payu_txnid | Webhook verification |
| rent_payments | (tenancy_id, rent_month) | Duplicate prevention |
| cashback_ledger | (tenant_id, status) | Wallet calculations |

---

## 🔐 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Tenant can only see their own data
CREATE POLICY tenant_own_data ON users
    FOR ALL USING (id = auth.uid());

CREATE POLICY tenant_own_tenancies ON tenancies
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY tenant_own_payments ON rent_payments
    FOR ALL USING (tenant_id = auth.uid());

-- Landlord policies (via service role for web)
-- Handled at application level
```

