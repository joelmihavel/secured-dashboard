# Flow 7: Payment -- PRD

## Overview

The payment flow handles the complete rent payment journey from method selection through to success or failure. It is the largest flow by state count (18 states) and covers the core transactional value of the product. The flow includes payment method selection, individual payment method addition screens (UPI, credit card, net banking), a processing screen, and outcome screens (success with/without cashback, failed, refunded). It also includes 7 payment card component variants used within the selection screen.

**Entry Point**: "Pay Rent" CTA from home dashboard
**Exit Point**: Payment success --> Home | Payment failed --> Retry or Home
**Total States**: 18
**Total Stories**: 56 (18 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### 1. Select Payment Method (/(payment)/select-method)

| State | Figma ID | Description |
|-------|----------|-------------|
| before-7th | 41-9004 | All methods set up, before due date (7th), no late fee |
| after-7th | 41-9114 | All methods set up, after due date, late fee applied |
| no-setup | 41-8901 | No payment methods configured, setup prompts |

**Route Params**: (determined by app state, not URL params)

#### before-7th
**Key Elements**:
- "Pay Rent" headline
- Rent amount display (no late fee)
- Payment method cards (PaymentCard components):
  - CreditCardSelect (if credit card added)
  - UPICardSelect (if UPI added)
  - NetbankingCardSelect (if netbanking added)
- RadioButton selection (one method selected at a time)
- Payment summary section (SummaryRow components)
- PrimaryButton "Pay Now"
- Back navigation to home

#### after-7th
**Key Elements**:
- Same layout as before-7th
- Late fee line item added to summary (SummaryRow)
- Warning text about late payment
- Total amount updated with late fee
- Urgency styling (orange/red accents)

#### no-setup
**Key Elements**:
- "Pay Rent" headline
- Empty payment methods area
- CTAs to add each method type:
  - "Add UPI" --> /(payment)/add-upi
  - "Add Credit Card" --> /(payment)/add-card
  - "Add Net Banking" --> /(payment)/add-netbanking
- AddMoreCard component
- PrimaryButton "Pay Now" disabled until method selected

### 2. Add UPI (/(payment)/add-upi)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 41-8369 | UPI ID entry form |

**Key Elements**:
- "Add UPI Payment" headline
- TextInput: UPI ID (e.g., username@upi)
- UPI ID format hint text
- PrimaryButton "Verify & Add"
- TextButton "Cancel" or back navigation
- UPI logo/branding

**Functional Requirements**:
- UPI ID format validation (xxx@provider)
- Verification API call on submit
- Success: adds UPI method, returns to select-method
- Error: shows validation error inline

### 3. Add Credit Card (/(payment)/add-card)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 41-8450 | Credit card entry form |

**Key Elements**:
- "Add Credit Card" headline
- TextInput: Card number (16 digits, formatted with spaces)
- TextInput: Expiry date (MM/YY)
- TextInput: CVV (3 digits, masked)
- TextInput: Cardholder name
- PrimaryButton "Add Card"
- Card brand detection icon (Visa/Mastercard/RuPay)

**Functional Requirements**:
- Card number Luhn validation
- Auto-formatting card number (4-4-4-4)
- Expiry date validation (not expired, valid month)
- CVV masking
- Card brand auto-detection from BIN
- Success: adds card, returns to select-method
- PCI compliance: card data never stored client-side

### 4. Add Net Banking (/(payment)/add-netbanking)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 41-8529 | Net banking bank selection |

**Key Elements**:
- "Add Net Banking" headline
- Popular banks grid (SBI, HDFC, ICICI, Axis, etc.)
- Search/filter TextInput
- Bank list with radio selection
- PrimaryButton "Select Bank"

**Functional Requirements**:
- Bank search filters list in real-time
- Selection highlights chosen bank
- Submit stores bank preference, returns to select-method
- Redirect to bank's net banking portal happens during payment, not here

### 5. Payment Processing (/(payment)/processing)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 41-9460 | Payment processing animation/spinner |

**Key Elements**:
- Processing animation (spinner or branded animation)
- "Processing your payment..." text
- "Do not close the app" warning text
- No back navigation (prevents double payment)
- Amount being processed displayed

**Functional Requirements**:
- Screen locked during processing (no back, no dismiss)
- Polls payment status every 3 seconds
- Timeout after 120 seconds with error handling
- Auto-navigates to success or failed based on result

### 6. Payment Success (/(payment)/success)

| State | Figma ID | Description |
|-------|----------|-------------|
| with-cashback | 41-9388 | Payment successful with cashback reward earned |
| no-cashback | 41-9511 | Payment successful without cashback |

#### with-cashback
**Key Elements**:
- Success icon/animation (green checkmark)
- PaymentStamp "Payment Successful"
- ReceiptCard with payment details:
  - ReceiptRow: Amount paid
  - ReceiptRow: Payment method
  - ReceiptRow: Transaction ID
  - ReceiptRow: Date/time
  - DashedDivider
  - ReceiptRow: Convenience fee
  - ReceiptRow: Total
- CashbackPill showing cashback amount earned
- PrimaryButton "Go to Home"
- TextButton "View Transaction"

#### no-cashback
**Key Elements**:
- Same as with-cashback but without CashbackPill
- All receipt details present
- PrimaryButton "Go to Home"

**Functional Requirements**:
- Display receipt with all transaction details
- Cashback amount shown only if earned
- "Go to Home" navigates to /(main)/index
- "View Transaction" navigates to /(transactions)/[id]
- Share receipt option (optional)

### 7. Payment Failed (/(payment)/failed)

| State | Figma ID | Description |
|-------|----------|-------------|
| failed | 41-9563 | Payment failed with error details |
| refunded | 41-9635 | Payment failed, refund initiated |

#### failed
**Key Elements**:
- Failed icon (red X or warning)
- PaymentStamp "Payment Failed"
- Error reason text
- ReceiptCard with attempted payment details
- PrimaryButton "Retry Payment"
- TextButton "Go to Home"

#### refunded
**Key Elements**:
- Refund icon
- PaymentStamp "Payment Refunded"
- Refund details and timeline
- ReceiptCard with original payment + refund info
- "Refund will be credited in 5-7 business days" text
- PrimaryButton "Go to Home"

**Functional Requirements**:
- Failed: "Retry" returns to select-method with previous selection preserved
- Refunded: Shows refund timeline, no retry option
- Both: "Go to Home" navigates back to dashboard

### 8. Payment Card Components (/(payment)/select-method subcomponents)

| State | Figma ID | Description |
|-------|----------|-------------|
| credit-unselected | 243-3794 | Credit card option, unselected state |
| credit-selected | 243-3816 | Credit card option, selected with radio filled |
| upi-unselected | 243-3838 | UPI option, unselected state |
| upi-selected | 243-3923 | UPI option, selected with radio filled |
| netbanking-unselected | 243-4008 | Net banking option, unselected state |
| netbanking-selected | 243-4030 | Net banking option, selected with radio filled |
| add-more | 243-4052 | "Add payment method" card |

**Key Elements per Card**:
- Payment method icon (credit card, UPI, bank)
- Method name and details (last 4 digits, UPI ID, bank name)
- RadioButton (unselected: empty circle, selected: filled circle)
- Card background: #202020
- Selected state: border highlight with brand accent
- AddMoreCard: "+" icon with "Add payment method" text

**Functional Requirements**:
- Only one method can be selected at a time
- Tap toggles selection (deselects others)
- Selected card gets visual emphasis (border, radio fill)
- AddMoreCard opens method addition flow

## Shared Components Used

| Component | Screens Using It |
|-----------|-----------------|
| Screen | All 7 screens |
| Text | All screens |
| PrimaryButton | select-method, add-upi, add-card, add-netbanking, success, failed |
| TextButton | add-upi, add-netbanking, success, failed |
| TextInput | add-upi (UPI ID), add-card (card fields), add-netbanking (search) |
| PaymentCard | select-method |
| CreditCardSelect | select-method (credit card variant) |
| UPICardSelect | select-method (UPI variant) |
| NetbankingCardSelect | select-method (netbanking variant) |
| AddMoreCard | select-method (add method) |
| RadioButton | select-method (method selection) |
| SummaryRow | select-method (payment summary) |
| ReceiptCard | success, failed |
| ReceiptRow | success, failed |
| PaymentInfoRow | success, failed |
| PaymentStamp | success, failed |
| DashedDivider | success, failed (receipt divider) |
| CashbackPill | success (with-cashback) |
| PaymentMethodRow | select-method |

## Stories

### Select Method -- Before 7th (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 41-9004 (before-7th) | 1 |
| 1.2 | BUILD: Implement payment selection with all methods, summary | 8 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Select Method -- After 7th (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 41-9114 (after-7th) | 1 |
| 2.2 | BUILD: Implement late fee variant with penalty line items | 3 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Select Method -- No Setup (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 41-8901 (no-setup) | 1 |
| 3.2 | BUILD: Implement empty methods state with add CTAs | 5 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Add UPI (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 41-8369 (add-upi) | 1 |
| 4.2 | BUILD: Implement UPI ID entry with validation | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Add Credit Card (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 41-8450 (add-card) | 1 |
| 5.2 | BUILD: Implement credit card form with Luhn validation, auto-format | 8 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Add Net Banking (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 41-8529 (add-netbanking) | 1 |
| 6.2 | BUILD: Implement bank selection grid with search | 5 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Processing (3 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | EXTRACT: Pull blueprint for 41-9460 (processing) | 1 |
| 7.2 | BUILD: Implement processing screen with animation and lock | 3 |
| 7.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Success -- With Cashback (3 stories)
| # | Story | Points |
|---|-------|--------|
| 8.1 | EXTRACT: Pull blueprint for 41-9388 (success with-cashback) | 1 |
| 8.2 | BUILD: Implement success with ReceiptCard, CashbackPill | 8 |
| 8.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Success -- No Cashback (3 stories)
| # | Story | Points |
|---|-------|--------|
| 9.1 | EXTRACT: Pull blueprint for 41-9511 (success no-cashback) | 1 |
| 9.2 | BUILD: Implement success without cashback | 3 |
| 9.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Failed -- Payment Failed (3 stories)
| # | Story | Points |
|---|-------|--------|
| 10.1 | EXTRACT: Pull blueprint for 41-9563 (failed) | 1 |
| 10.2 | BUILD: Implement failed state with retry CTA | 5 |
| 10.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Failed -- Refunded (3 stories)
| # | Story | Points |
|---|-------|--------|
| 11.1 | EXTRACT: Pull blueprint for 41-9635 (refunded) | 1 |
| 11.2 | BUILD: Implement refunded state with timeline | 3 |
| 11.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- Credit Unselected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 12.1 | EXTRACT: Pull blueprint for 243-3794 (credit-unselected) | 1 |
| 12.2 | BUILD: Implement CreditCardSelect unselected variant | 3 |
| 12.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- Credit Selected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 13.1 | EXTRACT: Pull blueprint for 243-3816 (credit-selected) | 1 |
| 13.2 | BUILD: Implement CreditCardSelect selected variant | 2 |
| 13.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- UPI Unselected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 14.1 | EXTRACT: Pull blueprint for 243-3838 (upi-unselected) | 1 |
| 14.2 | BUILD: Implement UPICardSelect unselected variant | 3 |
| 14.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- UPI Selected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 15.1 | EXTRACT: Pull blueprint for 243-3923 (upi-selected) | 1 |
| 15.2 | BUILD: Implement UPICardSelect selected variant | 2 |
| 15.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- Netbanking Unselected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 16.1 | EXTRACT: Pull blueprint for 243-4008 (netbanking-unselected) | 1 |
| 16.2 | BUILD: Implement NetbankingCardSelect unselected variant | 3 |
| 16.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- Netbanking Selected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 17.1 | EXTRACT: Pull blueprint for 243-4030 (netbanking-selected) | 1 |
| 17.2 | BUILD: Implement NetbankingCardSelect selected variant | 2 |
| 17.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Cards -- Add More (3 stories)
| # | Story | Points |
|---|-------|--------|
| 18.1 | EXTRACT: Pull blueprint for 243-4052 (add-more) | 1 |
| 18.2 | BUILD: Implement AddMoreCard component | 2 |
| 18.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 19.1 | FLOW TEST: Maestro E2E test covering select method --> process --> success/failed | 3 |
| 19.2 | SYSTEM IMPROVEMENT: Optimize payment card components, receipt layout, or pipeline | 5 |

**Total: 56 stories, 162 points**

## Dependencies

- **Upstream**: Flow 6 (Home) -- "Pay Rent" CTA initiates this flow
- **Downstream**: Returns to Flow 6 (Home) on completion
- **Shared Components**: PaymentCard, RadioButton, SummaryRow, ReceiptCard, CashbackPill, etc. are payment-specific. TextInput from earlier flows reused for add-upi/card/netbanking.
- **Backend**: `initiate`, `process`, `get-status`, `get-methods` Supabase edge functions via usePayments hook
- **State**: usePayments hook manages payment flow state

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| get-methods | Select screen mount | { methods[]: { type, details, isDefault } } |
| initiate | Tap "Pay Now" | { paymentId, redirectUrl?, status: initiated } |
| process | Processing screen poll | { status: processing/success/failed/refunded } |
| get-status | Success/failed screen | { transactionId, amount, method, cashback?, receipt } |

## Exit Criteria

1. All 18 payment states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 18 states
3. ODiff <=3% for all payment screens
4. Payment method selection with radio buttons works correctly
5. All 3 payment method addition forms validate and submit
6. Processing screen locks navigation, polls status correctly
7. Success screen shows receipt with/without cashback
8. Failed screen shows error with retry, refunded shows timeline
9. All 7 payment card components render correctly in both selected/unselected states
10. Maestro flow test passes: select method --> pay --> processing --> success --> home
11. Zero TypeScript errors, zero ESLint warnings
12. No regressions in Flows 1-6
