# Secured 2.0 - Product Documentation Index

> **Version:** 2.0
> **Last Updated:** January 2025
> **Status:** Production Ready

---

## 📁 Documentation Structure

```
Figma_Secured_2.0/
├── 00_INDEX.md                    ← You are here
├── 01_OVERVIEW.md                 ← Product overview, value prop, key metrics
├── 02_SYSTEM_ARCHITECTURE.md      ← Technical architecture, integrations
│
├── flows/
│   ├── F01_TENANT_ONBOARDING.md   ← Mobile app: OTP → Agreement → Verification
│   ├── F02_LANDLORD_WEB.md        ← Web forms: Confirmation → Cover acceptance
│   ├── F03_PAYMENT.md             ← PayU Split Settlement flow
│   ├── F04_KYC_AADHAAR.md         ← DigiLocker integration
│   ├── F05_REFERRAL.md            ← Referral system
│   └── F06_VACANCY_COVER.md       ← Insurance claim flow (baseline)
│
├── screens/
│   ├── S01_MOBILE_SCREENS.md      ← All iOS app screens
│   └── S02_WEB_SCREENS.md         ← Landlord web portal screens
│
├── data/
│   ├── D01_DATABASE_SCHEMA.md     ← Complete PostgreSQL schema
│   ├── D02_API_CONTRACTS.md       ← API endpoints and payloads
│   └── D03_STATE_MACHINES.md      ← All state transitions
│
├── edge_cases/
│   ├── E01_ONBOARDING_ERRORS.md   ← Onboarding failure scenarios
│   ├── E02_PAYMENT_ERRORS.md      ← Payment failure handling
│   └── E03_VERIFICATION_ERRORS.md ← KYC/verification failures
│
└── connections/
    └── C01_FLOW_CONNECTIONS.md    ← Inter-flow dependencies and triggers
```

---

## 🎯 Quick Navigation

### For Product Managers
- [Product Overview](./01_OVERVIEW.md)
- [User Flows](./flows/)
- [Screen Inventory](./screens/)

### For Developers/Agents
- [System Architecture](./02_SYSTEM_ARCHITECTURE.md)
- [Database Schema](./data/D01_DATABASE_SCHEMA.md)
- [API Contracts](./data/D02_API_CONTRACTS.md)
- [State Machines](./data/D03_STATE_MACHINES.md)

### For QA/Testing
- [Edge Cases](./edge_cases/)
- [Flow Connections](./connections/C01_FLOW_CONNECTIONS.md)

---

## 🔑 Key Entities

| Entity | Description | Primary Identifiers |
|--------|-------------|---------------------|
| `Tenant` | App user who pays rent | `user_id`, `mobile` |
| `Landlord` | Property owner (web user) | `landlord_id`, `mobile` |
| `Property` | Rental property | `property_id`, `address` |
| `Tenancy` | Tenant-Landlord-Property link | `tenancy_id` |
| `Agreement` | Rental agreement document | `agreement_id` |
| `Payment` | Monthly rent payment | `payment_id`, `payu_txnid` |
| `VacancyCover` | Insurance policy | `cover_id` |

---

## 🔄 Core User Journeys

### Journey 1: New Tenant Onboarding
```
Download App → OTP Login → Join Waitlist → Upload Agreement →
OCR Extraction → Verification → Landlord Invitation → Active Tenancy
```

### Journey 2: Landlord Confirmation
```
Receive Email/SMS → Open Web Link → Verify OTP →
Confirm Tenancy → Accept Vacancy Cover → Done
```

### Journey 3: Monthly Rent Payment
```
Payment Window Opens (1st) → Pay Rent → PayU Checkout →
Split Settlement → Landlord Receives 99% → Tenant Gets 1% Cashback
```

### Journey 4: Vacancy Cover Activation
```
3 Successful Payments → Cover Activates →
Tenant Vacates → Landlord Claims → Payout
```

---

## 📊 Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| Onboarding Completion Rate | % completing full onboarding | >70% |
| Landlord Confirmation Rate | % landlords confirming within 7 days | >60% |
| Payment Success Rate | % successful payments | >95% |
| Cashback Redemption Rate | % cashback used | Track |
| Cover Activation Rate | % tenancies with active cover | >80% |

---

## 🏷️ Document Tags (for Agent Parsing)

Each document contains YAML frontmatter with:

```yaml
---
doc_type: flow | screen | data | edge_case | connection
flow_id: F01 | F02 | F03 | etc.
entities: [tenant, landlord, payment, etc.]
integrations: [payu, cashfree, digilocker, etc.]
status: draft | review | approved
---
```

---

## 🤖 Agent Instructions

When reading this documentation:

1. **Start with `01_OVERVIEW.md`** to understand the product
2. **For specific flows**, navigate to `flows/F0X_*.md`
3. **For implementation details**, check `data/` directory
4. **For error handling**, refer to `edge_cases/`
5. **For dependencies between flows**, see `connections/`

Each flow document contains:
- Mermaid diagrams (render-ready)
- Screen specifications with data points
- API calls with request/response
- State transitions
- Error scenarios

---

## 📝 Change Log

| Date | Version | Changes |
|------|---------|---------|
| Jan 2025 | 2.0 | Initial documentation with PayU Split Settlement |

