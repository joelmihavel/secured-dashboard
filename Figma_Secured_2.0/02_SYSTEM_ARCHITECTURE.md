# Secured 2.0 - System Architecture

---
doc_type: architecture
status: approved
last_updated: 2025-01
---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  SECURED 2.0 ARCHITECTURE                               │
│                                                                                         │
│  ┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐   │
│  │         TENANT (iOS App)            │    │       LANDLORD (Web Portal)         │   │
│  │  ───────────────────────────────── │    │  ───────────────────────────────── │   │
│  │  • Swift / SwiftUI                  │    │  • Next.js / React                  │   │
│  │  • MMKV (State Persistence)         │    │  • Hosted: Vercel                   │   │
│  │  • URLSession (Networking)          │    │  • Domain: landlord.secured.app     │   │
│  └──────────────────┬──────────────────┘    └──────────────────┬──────────────────┘   │
│                     │                                          │                       │
│                     │ HTTPS/REST                               │ HTTPS/REST            │
│                     │                                          │                       │
│                     ▼                                          ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              API GATEWAY                                        │  │
│  │  ─────────────────────────────────────────────────────────────────────────────  │  │
│  │  Supabase Edge Functions + PostgREST                                            │  │
│  │  • Authentication (JWT)                                                          │  │
│  │  • Rate Limiting                                                                 │  │
│  │  • Request Validation                                                            │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                     │                                                                   │
│                     ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           BACKEND SERVICES                                      │  │
│  │                                                                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │  │
│  │  │    Auth     │  │   Payment   │  │ Verification│  │Notification │           │  │
│  │  │   Service   │  │   Service   │  │   Service   │  │   Service   │           │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │  │
│  │         │                │                │                │                    │  │
│  └─────────┼────────────────┼────────────────┼────────────────┼────────────────────┘  │
│            │                │                │                │                       │
│            ▼                ▼                ▼                ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              DATABASE                                           │  │
│  │  ─────────────────────────────────────────────────────────────────────────────  │  │
│  │  Supabase PostgreSQL + Storage                                                   │  │
│  │  • Users, Tenancies, Payments                                                    │  │
│  │  • Agreement files (encrypted)                                                   │  │
│  │  • Row-Level Security (RLS)                                                      │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│  │                          EXTERNAL INTEGRATIONS                                  │  │
│  │                                                                                 │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │  │
│  │  │  PayU     │ │ Cashfree  │ │  Google   │ │   SHCIL   │ │  MSG91/   │        │  │
│  │  │  Split    │ │   M360    │ │  Vision   │ │   Stamp   │ │  Gupshup  │        │  │
│  │  │Settlement │ │           │ │ + Gemini  │ │           │ │           │        │  │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │  │
│  │                                                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Mobile App Architecture (iOS)

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **UI** | SwiftUI | Declarative UI |
| **Architecture** | MVVM + Clean | Separation of concerns |
| **Networking** | URLSession + Combine | API calls |
| **State** | MMKV | Persistent state |
| **DI** | Swift DI / Factory | Dependency injection |
| **Analytics** | Mixpanel / Amplitude | User tracking |
| **Crash** | Sentry | Error monitoring |

### Module Structure

```
Secured/
├── App/
│   ├── SecuredApp.swift
│   └── AppDelegate.swift
│
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift
│   │   ├── Endpoints.swift
│   │   └── NetworkMonitor.swift
│   ├── Storage/
│   │   ├── MMKVManager.swift
│   │   ├── SecureStorage.swift
│   │   └── SessionManager.swift
│   └── Utils/
│       ├── Validators.swift
│       └── Extensions.swift
│
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   ├── ViewModels/
│   │   └── Models/
│   ├── Onboarding/
│   ├── Payment/
│   ├── KYC/
│   └── Profile/
│
├── Shared/
│   ├── Components/
│   ├── Styles/
│   └── Resources/
│
└── Services/
    ├── AuthService.swift
    ├── PaymentService.swift
    └── NotificationService.swift
```

### State Management

```swift
// Session State (persisted in MMKV)
struct AppSession: Codable {
    var userId: String?
    var accessToken: String?
    var refreshToken: String?
    var onboardingState: OnboardingState?
    var pendingUpload: UploadSession?
    var pendingPayment: PaymentSession?
}

enum OnboardingState: String, Codable {
    case started
    case otpVerified
    case consentGiven
    case profileComplete
    case agreementUploaded
    case agreementVerified
    case pendingLandlord
    case active
}

// Recovery on app launch
func recoverSession() async {
    let session = MMKVManager.shared.getSession()

    if let pendingPayment = session.pendingPayment {
        await PaymentService.checkStatus(pendingPayment.txnId)
    }

    if let pendingUpload = session.pendingUpload {
        await UploadService.resume(pendingUpload)
    }
}
```

---

## 🌐 Web Portal Architecture (Landlord)

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 | React + SSR |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Forms** | React Hook Form | Form handling |
| **Validation** | Zod | Schema validation |
| **State** | React Query | Server state |
| **Hosting** | Vercel | Edge deployment |

### Route Structure

```
app/
├── page.tsx                    # Redirect to /confirm
├── confirm/
│   └── [token]/
│       ├── page.tsx            # Token validation + form
│       └── loading.tsx
├── cover/
│   └── [tenancyId]/
│       └── page.tsx            # Vacancy cover acceptance
├── bank/
│   └── [tenancyId]/
│       └── page.tsx            # Bank details form
├── success/
│   └── page.tsx                # Confirmation screen
└── api/
    ├── validate-token/
    ├── send-otp/
    ├── verify-otp/
    ├── confirm-tenancy/
    └── verify-bank/
```

---

## 🔌 API Architecture

### Supabase Edge Functions

```
supabase/functions/
├── auth/
│   ├── send-otp/
│   ├── verify-otp/
│   └── refresh-token/
├── onboarding/
│   ├── m360-fetch/
│   ├── upload-agreement/
│   └── process-ocr/
├── tenancy/
│   ├── create/
│   ├── update/
│   └── landlord-invite/
├── payment/
│   ├── initiate/
│   ├── webhook/
│   └── release-settlement/
├── landlord/
│   ├── validate-token/
│   ├── confirm/
│   └── verify-bank/
└── notifications/
    ├── send-push/
    ├── send-sms/
    └── send-email/
```

### API Response Format

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "uuid"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid mobile number",
    "details": { "field": "mobile" }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "uuid"
  }
}
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
│                                                                 │
│  Mobile App                    Backend                          │
│  ──────────                    ───────                          │
│                                                                 │
│  POST /auth/send-otp ─────────►                                │
│  { mobile: "9876543210" }      Generate OTP                     │
│                                Store in Redis (5 min TTL)       │
│                                Send via MSG91                   │
│  ◄───────────────────────────  { request_id }                  │
│                                                                 │
│  POST /auth/verify-otp ───────►                                │
│  { mobile, otp, request_id }   Validate OTP                     │
│                                Create/fetch user                │
│                                Generate JWT                     │
│  ◄───────────────────────────  { access_token, refresh_token } │
│                                                                 │
│  All subsequent requests:                                       │
│  Authorization: Bearer {access_token}                          │
│                                                                 │
│  POST /auth/refresh ──────────►                                │
│  { refresh_token }             Validate refresh token          │
│                                Generate new access token        │
│  ◄───────────────────────────  { access_token }                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Architecture

### Data Encryption

| Data Type | At Rest | In Transit |
|-----------|---------|------------|
| User PII | AES-256 | TLS 1.3 |
| Bank Details | AES-256 + field-level | TLS 1.3 |
| Agreements | AES-256 (Supabase Storage) | TLS 1.3 |
| OTP | Redis (5 min TTL) | TLS 1.3 |
| Tokens | JWT (signed) | TLS 1.3 |

### API Security

```typescript
// Rate Limiting
const rateLimits = {
  'auth/send-otp': { window: '1m', max: 3 },
  'auth/verify-otp': { window: '1m', max: 5 },
  'payment/initiate': { window: '1h', max: 10 },
  'default': { window: '1m', max: 60 }
};

// Request Validation
const validateRequest = (schema: ZodSchema, body: unknown) => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
};

// JWT Verification
const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'secured.app'
  });
};
```

### Supabase RLS

```sql
-- Users can only access their own data
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (auth.uid() = id);

-- Tenants can only see their tenancies
CREATE POLICY "tenant_tenancies" ON tenancies
  FOR SELECT USING (tenant_id = auth.uid());

-- Payments visible to tenant
CREATE POLICY "tenant_payments" ON rent_payments
  FOR SELECT USING (tenant_id = auth.uid());
```

---

## 🔗 External Integrations

### 1. PayU Split Settlement

```typescript
// Environment
const PAYU_CONFIG = {
  sandbox: {
    base_url: 'https://sandboxsecure.payu.in',
    info_url: 'https://info.payu.in'
  },
  production: {
    base_url: 'https://secure.payu.in',
    info_url: 'https://info.payu.in'
  }
};

// Create Payment with Split
async function createSplitPayment(params: PaymentParams) {
  const splitRequest = {
    splitInfo: [
      {
        merchantKey: params.landlordPayuKey,
        aggregatorSubTxnId: `LL_${params.txnId}`,
        aggregatorSubAmt: params.landlordAmount,
        aggregatorCharges: 0
      },
      {
        merchantKey: SECURED_PAYU_KEY,
        aggregatorSubTxnId: `PL_${params.txnId}`,
        aggregatorSubAmt: params.platformFee,
        aggregatorCharges: params.platformFee
      }
    ]
  };

  const hash = calculatePayUHash({
    ...params,
    split_payments: JSON.stringify(splitRequest)
  });

  return {
    ...params,
    split_payments: JSON.stringify(splitRequest),
    hash
  };
}
```

### 2. Cashfree Mobile 360

```typescript
// M360 Integration
async function fetchM360Data(mobile: string, consent: ConsentData) {
  // 1. Create session
  const session = await cashfree.mobile360.createSession({
    mobile,
    consent: {
      obtained: true,
      timestamp: consent.timestamp,
      purpose: 'Identity verification for rent payment app'
    }
  });

  // 2. OTP already verified via our flow, use session token

  // 3. Fetch data
  const data = await cashfree.mobile360.fetchData(session.id);

  return {
    name: data.name,
    email: data.email,
    dob: data.dob,
    employment: data.employment
  };
}
```

### 3. Google Vision + Gemini (OCR)

```typescript
// OCR Pipeline
async function processAgreement(fileUrl: string) {
  // 1. Extract text with Vision API
  const rawText = await vision.documentTextDetection(fileUrl);

  // 2. Structure with Gemini
  const prompt = `
    Extract the following from this rental agreement:
    - Landlord: name, mobile, email
    - Tenant: name
    - Property: full address
    - Terms: monthly rent, security deposit, start date, end date
    - Stamp: number, date

    Agreement text:
    ${rawText}

    Return as JSON.
  `;

  const structured = await gemini.generateContent(prompt);
  return JSON.parse(structured);
}
```

### 4. SHCIL Stamp Verification

```typescript
// Stamp Verification via Firecrawl/Hyperbrowser
async function verifyStamp(stampNumber: string) {
  const result = await firecrawl.scrape({
    url: `https://www.shcilestamp.com/verify/${stampNumber}`,
    extractors: ['stamp_status', 'stamp_date', 'stamp_value']
  });

  return {
    valid: result.stamp_status === 'Valid',
    date: result.stamp_date,
    value: result.stamp_value
  };
}
```

### 5. Notifications (MSG91 / Gupshup)

```typescript
// SMS via MSG91
async function sendSMS(mobile: string, template: string, vars: object) {
  return msg91.send({
    mobile: `91${mobile}`,
    template_id: SMS_TEMPLATES[template],
    variables: vars
  });
}

// WhatsApp via Gupshup
async function sendWhatsApp(mobile: string, template: string, vars: object) {
  return gupshup.sendTemplateMessage({
    phone: `91${mobile}`,
    template: WA_TEMPLATES[template],
    params: vars
  });
}

// Push via FCM
async function sendPush(userId: string, notification: PushNotification) {
  const user = await db.users.findById(userId);
  if (!user.fcm_token) return;

  return fcm.send({
    token: user.fcm_token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: notification.data
  });
}
```

---

## 📊 Monitoring & Observability

### Logging

```typescript
// Structured logging
const logger = {
  info: (event: string, data: object) => {
    console.log(JSON.stringify({
      level: 'info',
      event,
      ...data,
      timestamp: new Date().toISOString()
    }));
  },
  error: (event: string, error: Error, data?: object) => {
    console.error(JSON.stringify({
      level: 'error',
      event,
      error: error.message,
      stack: error.stack,
      ...data,
      timestamp: new Date().toISOString()
    }));
  }
};

// Usage
logger.info('payment_initiated', {
  tenancy_id: '...',
  amount: 25000,
  user_id: '...'
});
```

### Metrics

| Metric | Type | Tags |
|--------|------|------|
| `api_requests_total` | Counter | endpoint, status |
| `api_latency_ms` | Histogram | endpoint |
| `payment_success_rate` | Gauge | - |
| `onboarding_completion` | Counter | step |
| `ocr_processing_time` | Histogram | - |

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| API Error Rate | > 5% for 5 min | Critical |
| Payment Failures | > 10% for 15 min | Critical |
| OCR Failures | > 20% for 30 min | Warning |
| Settlement Delay | > 30 min | Warning |
| Database Connection | Pool exhausted | Critical |

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPLOYMENT                                        │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   App Store     │ ◄─── iOS App (TestFlight → Production)                │
│  └─────────────────┘                                                        │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │     Vercel      │ ◄─── Landlord Web Portal (Next.js)                    │
│  │   (Edge CDN)    │      Auto-deploy from main branch                      │
│  └─────────────────┘                                                        │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │    Supabase     │ ◄─── Database + Edge Functions + Storage              │
│  │    (Managed)    │      Migrations via CLI                                │
│  └─────────────────┘                                                        │
│                                                                             │
│  Environments:                                                              │
│  • Development: dev.secured.app                                             │
│  • Staging: staging.secured.app                                             │
│  • Production: secured.app                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Agent Build Instructions

When building Secured:

### Mobile App (iOS)
```bash
# Prerequisites
- Xcode 15+
- Swift 5.9+
- CocoaPods or SPM

# Setup
1. Clone repo
2. Install dependencies: pod install
3. Open .xcworkspace
4. Configure signing
5. Set environment (dev/staging/prod)
6. Build and run
```

### Web Portal
```bash
# Prerequisites
- Node.js 18+
- pnpm

# Setup
1. Clone repo
2. pnpm install
3. cp .env.example .env.local
4. Configure Supabase keys
5. pnpm dev
```

### Backend (Supabase)
```bash
# Prerequisites
- Supabase CLI
- Docker (for local)

# Setup
1. supabase init
2. supabase start (local)
3. Apply migrations: supabase db push
4. Deploy functions: supabase functions deploy
```

### Key Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# PayU
PAYU_MERCHANT_KEY=
PAYU_SALT=
PAYU_ENV=sandbox|production

# Cashfree
CASHFREE_CLIENT_ID=
CASHFREE_CLIENT_SECRET=

# Google Cloud
GOOGLE_CLOUD_PROJECT=
GOOGLE_VISION_KEY=
GEMINI_API_KEY=

# Notifications
MSG91_AUTH_KEY=
MSG91_SENDER_ID=
GUPSHUP_API_KEY=
FCM_SERVER_KEY=
```

