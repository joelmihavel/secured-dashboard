# Flow 8: Profile & Transactions -- PRD

## Overview

The profile and transactions flow provides account management and payment history capabilities. It covers the profile main screen (with navigation to sub-screens), profile editing, payment method management (UPI, credit card, bank account views), agreement details, and the transaction history screen (with and without cashback data). This flow can be executed in parallel with Flow 7 (Payment) since it has no dependencies on the payment flow.

**Entry Point**: Profile icon from home dashboard (or direct navigation)
**Exit Point**: Back --> Home
**Total States**: 8
**Total Stories**: 26 (8 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### 1. Profile Main (/(profile)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| main | 41-8760 | Profile main screen with user info, menu items |

**Key Elements**:
- User avatar (circular image, placeholder if none)
- User name display
- Phone number display
- Menu items list:
  - "My Profile" --> /(profile)/edit
  - "Payment Methods" --> /(profile)/payment-methods
  - "Notifications" --> /(profile)/notifications
  - "Agreement" --> /(profile)/agreement
  - "Help & Support" --> /(profile)/help
  - "About" --> /(profile)/about
- Each menu item: icon + label + chevron right
- "Log Out" TextButton at bottom
- Back navigation to home

**Functional Requirements**:
- User data loaded from profile API
- Avatar shows initials if no photo
- Each menu item navigates to respective sub-screen
- "Log Out" clears auth state, navigates to splash
- Pull-to-refresh updates profile data

### 2. Edit Profile (/(profile)/edit)

| State | Figma ID | Description |
|-------|----------|-------------|
| edit-profile | 41-8880 | Editable profile form with name, email, phone |

**Key Elements**:
- "My Profile" or "Edit Profile" headline
- Avatar with edit/camera icon overlay
- TextInput: Full name
- TextInput: Email address
- TextInput: Phone number (read-only, pre-filled from auth)
- PrimaryButton "Save Changes"
- TextButton "Cancel" or back navigation
- Form validation indicators

**Functional Requirements**:
- Phone number is read-only (cannot change post-verification)
- Name is editable with minimum length validation
- Email validation (format check)
- "Save Changes" calls update API, shows success toast
- "Cancel" or back discards changes
- Avatar tap opens image picker (camera/gallery)
- Loading state during save

### 3. Payment Methods (/(profile)/payment-methods)

| State | Figma ID | Description |
|-------|----------|-------------|
| payment-upi | 41-8450 | UPI payment methods list |
| payment-credit-card | 41-8612 | Credit card payment methods list |
| payment-bank | 41-9307 | Bank account payment methods list |

**Route Params**: `?tab=upi`, `?tab=credit`, `?tab=bank`

#### payment-upi
**Key Elements**:
- "Payment Methods" headline
- Tab bar: UPI | Credit Card | Bank Account (UPI active)
- List of saved UPI IDs
- Each item: UPI icon + UPI ID + default badge (if default) + delete icon
- "Add UPI" CTA at bottom
- Empty state if no UPI methods

#### payment-credit-card
**Key Elements**:
- Same tab bar (Credit Card active)
- List of saved credit cards
- Each item: card brand icon + masked number (xxxx xxxx xxxx 1234) + expiry + default badge + delete
- "Add Credit Card" CTA
- Empty state if no cards

#### payment-bank
**Key Elements**:
- Same tab bar (Bank Account active)
- List of saved bank accounts
- Each item: bank icon + bank name + masked account number + IFSC + default badge + delete
- "Add Bank Account" CTA
- Empty state if no accounts

**Functional Requirements**:
- Tab switching shows relevant payment methods
- "Set as Default" action available per method
- Delete confirmation dialog before removal
- Add CTA navigates to respective add-method screen
- Default method indicated with badge
- Swipe-to-delete or tap delete icon

### 4. Agreement (/(profile)/agreement)

| State | Figma ID | Description |
|-------|----------|-------------|
| agreement | 41-9811 | Agreement details view (read-only) |

**Key Elements**:
- "Agreement Details" headline
- Agreement summary card:
  - Tenant name
  - Landlord name
  - Property address
  - Monthly rent
  - Agreement period (start - end date)
  - Agreement status (active/expired)
- "View Full Agreement" TextButton (opens PDF viewer)
- "Upload New Agreement" PrimaryButton (if expired or update needed)
- Back navigation

**Functional Requirements**:
- Read-only display of current agreement details
- PDF viewer for full agreement document
- Re-upload option if agreement is expiring or expired
- Data loaded from agreement API

### 5. Transactions (/(transactions)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| no-cashback | 243-5870 | Transaction history list without cashback column |
| with-cashback | 243-6083 | Transaction history list with cashback amounts |

#### no-cashback
**Key Elements**:
- "Transactions" headline
- Transaction list (ScrollView/FlatList)
- Each transaction row:
  - Date
  - Payment method icon + name
  - Amount paid
  - Status badge (success/failed/pending/refunded)
- Empty state if no transactions
- Filter/sort options (optional)

#### with-cashback
**Key Elements**:
- Same as no-cashback plus:
  - CashbackPill on eligible transactions
  - Cashback amount column
  - Total cashback earned summary at top
- Transactions with cashback visually distinguished

**Functional Requirements**:
- Transactions sorted by date (newest first)
- Tap transaction navigates to /(transactions)/[id] detail
- Status badges color-coded (green=success, red=failed, yellow=pending, blue=refunded)
- Pagination or infinite scroll for long lists
- Pull-to-refresh updates list
- Filter by date range or status (optional)
- Cashback amounts shown inline when earned

## Shared Components Used

| Component | Screens Using It |
|-----------|-----------------|
| Screen | All screens |
| Text | All screens |
| PrimaryButton | edit (Save), agreement (Upload New), payment-methods (Add) |
| TextButton | profile (Log Out), edit (Cancel), agreement (View Full) |
| TextInput | edit (name, email) |
| CashbackPill | transactions (with-cashback) |
| PaymentMethodRow | payment-methods (all tabs) |
| RadioButton | payment-methods (default selection) |
| DashedDivider | transactions (section dividers) |

## Stories

### Profile -- Main (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 41-8760 (profile main) | 1 |
| 1.2 | BUILD: Implement profile main with menu items, user info, logout | 5 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Profile -- Edit (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 41-8880 (edit profile) | 1 |
| 2.2 | BUILD: Implement edit form with avatar, name, email, save | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Methods -- UPI (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 41-8450 (payment-upi) | 1 |
| 3.2 | BUILD: Implement UPI methods tab with list, add, delete | 5 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Methods -- Credit Card (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 41-8612 (payment-credit-card) | 1 |
| 4.2 | BUILD: Implement credit card methods tab with masked numbers | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Payment Methods -- Bank Account (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 41-9307 (payment-bank) | 1 |
| 5.2 | BUILD: Implement bank account methods tab | 5 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Profile -- Agreement (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 41-9811 (profile agreement) | 1 |
| 6.2 | BUILD: Implement agreement details view with PDF viewer CTA | 5 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Transactions -- No Cashback (3 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | EXTRACT: Pull blueprint for 243-5870 (transactions no-cashback) | 1 |
| 7.2 | BUILD: Implement transaction list without cashback column | 5 |
| 7.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Transactions -- With Cashback (3 stories)
| # | Story | Points |
|---|-------|--------|
| 8.1 | EXTRACT: Pull blueprint for 243-6083 (transactions with-cashback) | 1 |
| 8.2 | BUILD: Implement transaction list with CashbackPill, totals | 3 |
| 8.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 9.1 | FLOW TEST: Maestro E2E test covering profile --> edit --> payment methods --> transactions | 3 |
| 9.2 | SYSTEM IMPROVEMENT: Optimize list rendering, tab transitions, or profile patterns | 3 |

**Total: 26 stories, 78 points**

## Dependencies

- **Upstream**: Flow 6 (Home) -- profile icon navigates here. But this flow has NO blocking dependency on Flows 7.
- **Downstream**: None (terminal flow, navigates back to home)
- **Parallel Execution**: Can run concurrently with Flow 7 (Payment) after Flow 6 is certified
- **Shared Components**: TextInput, PrimaryButton, TextButton from earlier flows. CashbackPill shared with payment success screen. PaymentMethodRow may be shared with or distinct from payment select-method components.
- **Backend**: `get`, `update` (profile), `get-payment-methods` (methods), agreement status via useProfile hook
- **State**: useProfile hook for profile data, React Query for transaction lists

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| profile/get | Screen mount | { name, email, phone, avatar, agreementStatus } |
| profile/update | Tap "Save Changes" | { success, updatedFields } |
| get-payment-methods | Payment methods tab mount | { methods[]: { type, details, isDefault } } |
| delete-payment-method | Delete action | { success } |
| set-default-method | Set as default action | { success } |
| get-transactions | Transactions screen mount | { transactions[]: { id, date, amount, method, status, cashback? } } |
| get-agreement | Agreement screen mount | { agreementDetails, pdfUrl, status } |

## Known Issues

- **Profile Main (41-8760)**: Flagged as FIX_LOOP_1 in buildbot-status. The profile main screen may have a build loop issue that needs investigation during the BUILD story. Ensure the fix resolves the underlying cause rather than suppressing symptoms.

## Exit Criteria

1. All 8 profile/transaction states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 8 states
3. ODiff <=3% for all screens (no DottedPattern in this flow)
4. Profile main shows all menu items with correct navigation
5. Edit profile saves changes correctly with validation
6. Payment methods tabs switch correctly, show/hide methods per type
7. Agreement details display accurately from backend data
8. Transaction list renders correctly with and without cashback
9. Log out clears state and navigates to splash
10. FIX_LOOP_1 on profile main resolved
11. Maestro flow test passes: profile --> edit --> save --> payment methods --> transactions --> back
12. Zero TypeScript errors, zero ESLint warnings
13. No regressions in Flows 1-6 (and Flow 7 if completed)
