# Flow 6: Home Dashboard -- PRD

## Overview

The home dashboard is the central hub of the app and the most complex screen in the product. It serves as the primary surface after onboarding, displaying rent payment status, payment methods, recent transactions, and cashback rewards. The screen has two major variants (empty and active) with 9 total states across them. It uses 20+ sub-components making it the highest-effort flow to build and certify.

**Entry Point**: Setup complete (or returning authenticated user)
**Exit Point**: Pay rent --> Flow 7 (Payment) | Profile icon --> Flow 8 (Profile)
**Total States**: 9
**Total Stories**: 29 (9 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### Home -- Empty States (/(main)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| upi-no-cashbacks | 243-6296 | UPI payment method set up, no cashback history, empty payments tab |
| setup-payment | 243-6490 | No payment methods configured, setup payment CTA prominent |
| setup-upi | 243-6731 | Payment setup in progress, UPI being added |
| no-cashback | 243-5689 | Transaction view without any cashback rewards |

### Home -- Active States (/(main)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| bank-upi | 243-2762 | Bank/UPI payment methods active, recent payments visible |
| all-methods | 243-2967 | All payment methods (UPI + credit + netbanking) configured, toggle switches, complete setup |
| late-payment | 243-3170 | Late payment warning banner, overdue rent, urgency messaging |
| missed-payment | 243-3378 | Missed payment state, stronger warning, penalty information |
| complete | 243-7185 | Fully completed setup with all methods, active payment history |

## Screen Architecture

The home screen is composed of modular sections stacked vertically in a ScrollView:

```
HomeHeader
  |-- Profile icon (navigates to profile)
  |-- Notification bell
  |-- User greeting

HeadlineSection
  |-- Monthly rent amount
  |-- Due date
  |-- Payment status indicator

WarningBanner (conditional: late-payment, missed-payment only)
  |-- Warning icon
  |-- Warning text
  |-- Days overdue

PaymentMethodCarousel
  |-- PaymentMethodCard (per method)
  |-- PaymentSetupCard (if methods missing)
  |-- AddMoreCard (if can add more)

FinishSetupSection (conditional: incomplete setup)
  |-- SetupProgressCard
  |-- SetupChecklist

TabSwitcher
  |-- "Payments" tab
  |-- "Cashbacks" tab

[Payments Tab Content]
  |-- RecentPaymentsList (if payments exist)
  |-- EmptyPaymentsState (if no payments)

[Cashbacks Tab Content]
  |-- CashbacksList (if cashbacks exist)
  |-- CashbackEmptyState (if no cashbacks)

BottomFooter
  |-- PrimaryButton "Pay Rent" (main CTA)
```

## State Details

### Empty States

#### upi-no-cashbacks (243-6296)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel (UPI card only), TabSwitcher, EmptyPaymentsState (payments tab), CashbackEmptyState (cashbacks tab), BottomFooter
**Key Behavior**: UPI method shown in carousel, both tabs show empty states, Pay Rent CTA active

#### setup-payment (243-6490)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentSetupCard (prominent CTA), FinishSetupSection, TabSwitcher, EmptyPaymentsState, BottomFooter
**Key Behavior**: No payment methods, setup CTA is primary focus, Pay Rent CTA may be disabled or leads to setup

#### setup-upi (243-6731)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel (UPI being added), FinishSetupSection, TabSwitcher, EmptyPaymentsState, BottomFooter
**Key Behavior**: UPI setup in progress, partial completion state

#### no-cashback (243-5689)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel, TabSwitcher (cashbacks tab active), CashbackEmptyState, BottomFooter
**Key Behavior**: Transaction history visible but no cashback rewards earned yet

### Active States

#### bank-upi (243-2762)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel (Bank + UPI cards), TabSwitcher, RecentPaymentsList, BottomFooter
**Key Behavior**: Two payment methods shown, recent payments listed, cashbacks tab may show data

#### all-methods (243-2967)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel (UPI + Credit + Netbanking), FinishSetupSection (complete), TabSwitcher, RecentPaymentsList, CashbacksList, BottomFooter
**Key Behavior**: All three payment methods configured, toggle switches visible, complete setup shown

#### late-payment (243-3170)
**Visible Sections**: HomeHeader, HeadlineSection, WarningBanner (late), PaymentMethodCarousel, TabSwitcher, RecentPaymentsList, BottomFooter
**Key Behavior**: Warning banner prominent in orange/amber, "X days overdue" messaging, Pay Rent CTA emphasized

#### missed-payment (243-3378)
**Visible Sections**: HomeHeader, HeadlineSection, WarningBanner (missed), PaymentMethodCarousel, TabSwitcher, RecentPaymentsList, BottomFooter
**Key Behavior**: Stronger warning in red, penalty information, urgent Pay Rent CTA

#### complete (243-7185)
**Visible Sections**: HomeHeader, HeadlineSection, PaymentMethodCarousel (all methods), TabSwitcher, RecentPaymentsList, CashbacksList, BottomFooter
**Key Behavior**: Fully set up, healthy payment history, cashback rewards visible, ideal state

## Shared Components Used (20 components)

| Component | File | Used In States |
|-----------|------|---------------|
| HomeHeader | home/HomeHeader.tsx | All 9 states |
| HeadlineSection | home/HeadlineSection.tsx | All 9 states |
| TabSwitcher | home/TabSwitcher.tsx | All 9 states |
| BottomFooter | home/BottomFooter.tsx | All 9 states |
| PaymentMethodCarousel | home/PaymentMethodCarousel.tsx | All except setup-payment |
| PaymentMethodCard | home/PaymentMethodCard.tsx | States with payment methods |
| PaymentSetupCard | home/PaymentSetupCard.tsx | setup-payment, setup-upi |
| PaymentMethodSelectionSheet | home/PaymentMethodSelectionSheet.tsx | When adding methods |
| RecentPaymentsList | home/RecentPaymentsList.tsx | Active states with payments |
| CashbacksList | home/CashbacksList.tsx | States with cashbacks |
| EmptyPaymentsState | home/EmptyPaymentsState.tsx | Empty states (payments tab) |
| CashbackEmptyState | home/CashbackEmptyState.tsx | States without cashbacks |
| HomeEmptyState | home/HomeEmptyState.tsx | Full empty state variant |
| SetupProgressCard | home/SetupProgressCard.tsx | Incomplete setup states |
| SetupChecklist | home/SetupChecklist.tsx | Incomplete setup states |
| FinishSetupSection | home/FinishSetupSection.tsx | setup-payment, setup-upi, all-methods |
| LandlordStatusCard | home/LandlordStatusCard.tsx | When landlord invited |
| WarningBanner | home/WarningBanner.tsx | late-payment, missed-payment |
| CashbackSetupModal | home/CashbackSetupModal.tsx | First cashback interaction |
| Screen | ui/Layout/Screen.tsx | All 9 states |
| Text | ui/Typography/Text.tsx | All 9 states |
| PrimaryButton | ui/Button/PrimaryButton.tsx | BottomFooter (Pay Rent) |

## Stories

### Home Empty -- UPI No Cashbacks (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 243-6296 (upi-no-cashbacks) | 1 |
| 1.2 | BUILD: Implement home with UPI card, empty tabs | 8 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Empty -- Setup Payment (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 243-6490 (setup-payment) | 1 |
| 2.2 | BUILD: Implement home with no methods, setup CTA | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Empty -- Setup UPI (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 243-6731 (setup-upi) | 1 |
| 3.2 | BUILD: Implement home with UPI setup in progress | 5 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Empty -- No Cashback (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 243-5689 (no-cashback) | 1 |
| 4.2 | BUILD: Implement home with transactions but no cashbacks | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Active -- Bank/UPI (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 243-2762 (bank-upi) | 1 |
| 5.2 | BUILD: Implement home with bank + UPI methods, recent payments | 8 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Active -- All Methods (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 243-2967 (all-methods) | 1 |
| 6.2 | BUILD: Implement home with all 3 payment methods, toggle switches | 5 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Active -- Late Payment (3 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | EXTRACT: Pull blueprint for 243-3170 (late-payment) | 1 |
| 7.2 | BUILD: Implement home with WarningBanner (late), overdue styling | 5 |
| 7.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Active -- Missed Payment (3 stories)
| # | Story | Points |
|---|-------|--------|
| 8.1 | EXTRACT: Pull blueprint for 243-3378 (missed-payment) | 1 |
| 8.2 | BUILD: Implement home with WarningBanner (missed), penalty info | 5 |
| 8.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Home Active -- Complete (3 stories)
| # | Story | Points |
|---|-------|--------|
| 9.1 | EXTRACT: Pull blueprint for 243-7185 (complete) | 1 |
| 9.2 | BUILD: Implement fully configured home with all sections populated | 5 |
| 9.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 10.1 | FLOW TEST: Maestro E2E test covering home states, tab switching, navigation to payment/profile | 3 |
| 10.2 | SYSTEM IMPROVEMENT: Optimize home component architecture, address rendering issues | 5 |

**Total: 29 stories, 100 points**

## Dependencies

- **Upstream**: Flow 5 (Setup) -- setup completion unlocks home dashboard
- **Downstream**: Flow 7 (Payment) -- "Pay Rent" CTA navigates to payment select. Flow 8 (Profile) -- profile icon navigates to profile.
- **Shared Components**: 20 home-specific components all in `src/components/home/`. These are the highest-reuse components in the app since all 9 states compose from the same set.
- **Backend**: `get-summary`, `get-payments`, `get-cashbacks` Supabase edge functions via useDashboard hook
- **State**: useDashboard hook manages all home data (payments, cashbacks, methods, status)

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| get-summary | Screen mount, pull-to-refresh | { rentAmount, dueDate, paymentStatus, setupProgress, methods[] } |
| get-payments | Payments tab active | { payments[]: { id, date, amount, method, status } } |
| get-cashbacks | Cashbacks tab active | { cashbacks[]: { id, amount, source, date } } |
| get-methods | PaymentMethodCarousel render | { methods[]: { type, lastFour, isDefault } } |

## Complexity Notes

This is the most complex flow due to:
1. **9 states** from a single route with dramatically different layouts
2. **20 sub-components** that must compose correctly across states
3. **Conditional rendering** -- sections show/hide based on state
4. **Dynamic data** -- payment lists, cashback amounts, method cards all from API
5. **Tab switching** -- payments vs. cashbacks with independent data loading
6. **Warning states** -- late/missed payment banners with urgency styling

Recommended approach: Build the first state (upi-no-cashbacks) as the base implementation establishing all 20 components, then iterate through remaining states as configuration changes.

## Exit Criteria

1. All 9 home states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 9 states
3. ODiff <=3% (home screens do not use DottedPattern)
4. All 20 sub-components render correctly across all states
5. TabSwitcher toggles between payments and cashbacks tabs
6. PaymentMethodCarousel displays correct methods per state
7. WarningBanner shows correctly for late-payment and missed-payment
8. Empty states display appropriate messaging
9. "Pay Rent" CTA navigates to payment select
10. Profile icon navigates to profile screen
11. Maestro flow test passes: home load --> tab switch --> scroll --> tap Pay Rent
12. Zero TypeScript errors, zero ESLint warnings
13. No regressions in Flows 1-5
