# Secured 2.0 - Product Overview

---
doc_type: overview
status: approved
last_updated: 2025-01
---

## 🎯 Product Vision

**Secured** is a rent payment app that creates a win-win ecosystem:
- **Tenants** get 1% cashback on every rent payment
- **Landlords** get ₹1.5L vacancy assurance cover (free)

---

## 💡 Value Proposition

### For Tenants
| Benefit | Details |
|---------|---------|
| **1% Cashback** | Earn ₹250 on ₹25,000 rent |
| **Payment Tracking** | Digital rent receipts |
| **Credit Building** | Future: Rent reporting to bureaus |
| **Convenience** | Pay via UPI, Cards, Netbanking |

### For Landlords
| Benefit | Details |
|---------|---------|
| **₹1.5L Vacancy Cover** | Free insurance if tenant abandons |
| **Guaranteed Payments** | Rent via Secured = tracked |
| **Zero Effort** | Just confirm once via web |
| **Direct Settlement** | Rent in bank (T+2) |

### For Secured (Business Model)
| Revenue | Details |
|---------|---------|
| **1% Platform Fee** | Retained from each payment |
| **Cashback Arbitrage** | Unexpired cashback = profit |
| **Future: Insurance Premium** | If cover scales |
| **Future: Credit Products** | Rent-backed lending |

---

## 🏗️ Product Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SECURED ECOSYSTEM                              │
│                                                                             │
│  ┌─────────────────────┐         ┌─────────────────────┐                   │
│  │    TENANT (iOS)     │         │   LANDLORD (Web)    │                   │
│  │  ─────────────────  │         │  ─────────────────  │                   │
│  │  • Onboarding       │         │  • Confirm Tenancy  │                   │
│  │  • Agreement Upload │◄───────►│  • Accept Cover     │                   │
│  │  • Pay Rent         │   Link  │  • View Settlements │                   │
│  │  • Track Cashback   │         │  • Claim (Future)   │                   │
│  └──────────┬──────────┘         └──────────┬──────────┘                   │
│             │                               │                               │
│             └───────────────┬───────────────┘                               │
│                             │                                               │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SECURED BACKEND                              │   │
│  │  ───────────────────────────────────────────────────────────────── │   │
│  │  • Supabase (PostgreSQL)     • Edge Functions                      │   │
│  │  • Agreement Storage         • Webhook Handlers                    │   │
│  │  • State Machines            • Notification Service                │   │
│  └──────────┬──────────────────────────────────────────┬───────────────┘   │
│             │                                          │                    │
│             ▼                                          ▼                    │
│  ┌─────────────────────┐                 ┌─────────────────────┐           │
│  │   INTEGRATIONS      │                 │   PAYMENTS          │           │
│  │  ─────────────────  │                 │  ─────────────────  │           │
│  │  • Cashfree M360    │                 │  • PayU Gateway     │           │
│  │  • Google Vision    │                 │  • Split Settlement │           │
│  │  • Gemini AI (OCR)  │                 │  • Child Merchants  │           │
│  │  • DigiLocker       │                 │  • Webhooks         │           │
│  │  • MSG91/Gupshup    │                 │                     │           │
│  └─────────────────────┘                 └─────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 👥 User Personas

### Tenant: Priya (28, Software Engineer)
- Rents 2BHK in Bangalore, ₹30,000/month
- Pain: Manual transfers, no receipts, landlord chases
- Goal: Easy payments, some savings

### Landlord: Ramesh (55, Multiple Properties)
- Owns 3 rental properties
- Pain: Tenants leaving without notice, rent delays
- Goal: Guaranteed rent, protection against vacancy

---

## 📱 Platform Breakdown

### Mobile App (iOS - Swift/SwiftUI)
| Module | Screens | Priority |
|--------|---------|----------|
| Onboarding | 8 | P0 |
| Home/Dashboard | 3 | P0 |
| Payment | 5 | P0 |
| KYC | 4 | P1 |
| Referral | 3 | P1 |
| Profile | 4 | P2 |

**Total: ~27 screens**

### Web Portal (Landlord)
| Module | Pages | Priority |
|--------|-------|----------|
| Tenancy Confirmation | 3 | P0 |
| Vacancy Cover | 2 | P0 |
| Dashboard (Future) | 3 | P2 |

**Total: ~8 pages**

---

## 🔄 Core Flows Summary

### Flow 1: Tenant Onboarding
```
[OTP Auth] → [Waitlist] → [Agreement Upload] → [OCR] → [Verification] → [Active]
```
- **Duration:** 5-10 minutes
- **Drop-off Risk:** Agreement upload, verification wait

### Flow 2: Landlord Confirmation
```
[Email/SMS] → [Open Link] → [OTP] → [Confirm Tenancy] → [Accept Cover]
```
- **Duration:** 2-3 minutes
- **Drop-off Risk:** Not opening link, skipping cover

### Flow 3: Payment
```
[Payment Window] → [Initiate] → [PayU Checkout] → [Split] → [Settlement]
```
- **Duration:** 1-2 minutes
- **Success Rate Target:** >95%

### Flow 4: Vacancy Cover
```
[3 Payments] → [Activated] → [Tenant Leaves] → [Claim] → [Payout]
```
- **Duration:** Lifecycle (months)
- **Claim Rate:** TBD with insurer

---

## 📊 Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                         │
│                                                                             │
│  TENANT INPUT                PROCESSING                 OUTPUT              │
│  ────────────               ──────────                 ──────               │
│                                                                             │
│  Mobile Number ──────► Cashfree M360 ──────► Verified Identity             │
│                                                                             │
│  Agreement PDF ──────► Google Vision ──────► Extracted Text                │
│                        + Gemini AI          + Structured Data               │
│                                                                             │
│  Landlord Info ──────► SHCIL Check ──────► Stamp Verification              │
│  (from OCR)            Firecrawl                                            │
│                                                                             │
│  Bank Details ──────► Penny Drop API ──────► Verified Account              │
│  (Landlord)                                                                 │
│                                                                             │
│  Rent Payment ──────► PayU Split ──────► Landlord: 99%                     │
│                                          Secured: 1%                        │
│                                                                             │
│  Aadhaar ──────► DigiLocker ──────► KYC Complete                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚦 Launch Checklist

### Phase 1: MVP (Current)
- [x] Tenant onboarding flow
- [x] Agreement OCR + verification
- [x] Landlord web confirmation
- [x] PayU Split Settlement integration
- [x] Basic cashback system
- [ ] Push notifications
- [ ] Email templates

### Phase 2: Post-Launch
- [ ] Aadhaar KYC for cashback adjustment
- [ ] Referral system
- [ ] Landlord dashboard
- [ ] Settlement tracking

### Phase 3: Scale
- [ ] Vacancy cover claims
- [ ] Credit bureau reporting
- [ ] Android app
- [ ] Multi-language support

---

## 🔐 Security & Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Data Encryption** | AES-256 at rest, TLS 1.3 in transit |
| **PII Handling** | Masked display, audit logs |
| **Consent Management** | Explicit opt-in, versioned |
| **DPDPA Compliance** | Purpose limitation, data minimization |
| **Payment Security** | PCI-DSS via PayU |

---

## 📈 Success Metrics

### North Star
**Monthly Rent Volume Processed**

### Supporting Metrics
| Metric | Week 1 | Month 1 | Month 3 |
|--------|--------|---------|---------|
| App Downloads | 500 | 5,000 | 20,000 |
| Completed Onboarding | 200 | 2,000 | 10,000 |
| Active Tenancies | 100 | 1,000 | 5,000 |
| Rent Payments | 50 | 800 | 4,000 |
| GMV (₹) | 12.5L | 2Cr | 10Cr |

---

## 🤖 Agent Context

When building features for Secured:

1. **Tech Stack:** iOS (Swift/SwiftUI), Supabase, PayU, Cashfree
2. **Primary User:** Tenant (mobile), Landlord (web)
3. **Key Constraint:** Payment window 1st-7th of month
4. **Critical Path:** Tenant onboard → Landlord confirm → Payment enabled
5. **Revenue Event:** Successful rent payment (1% retained)

