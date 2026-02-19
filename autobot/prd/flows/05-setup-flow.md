# Flow 5: Setup -- PRD

## Overview

The setup flow guides newly approved users through post-agreement configuration. It covers three sequential setup steps (property details, bank account, utility connections), a dedicated bank account entry screen (with a BESCOM utility variant), and a landlord invitation screen. This flow transforms a verified user into a ready-to-pay tenant.

**Entry Point**: Agreement verified --> Setup index
**Exit Point**: Setup complete --> Flow 6 (Home Dashboard)
**Total States**: 6
**Total Stories**: 20 (6 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### 1. Setup Index (/(setup)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| step1 | 41-10712 | Post-approval step 1 -- initial property/payment setup |
| step2 | 41-10859 | Post-approval step 2 -- bank account and utility setup |
| step3 | 41-11006 | Post-approval step 3 -- landlord invitation and final confirmation |

**Route Params**: `?step=1`, `?step=2`, `?step=3`

#### Step 1
**Key Elements**:
- Step indicator (1 of 3, progress bar or dots)
- "Set up your payment" or similar headline
- Property address confirmation (from agreement data)
- Monthly rent amount display
- Payment due date selection
- PrimaryButton "Continue" to proceed to step 2

**Functional Requirements**:
- Pre-populated with data from verified agreement
- User confirms or adjusts payment details
- Validation before proceeding
- Step indicator shows 1/3 active

#### Step 2
**Key Elements**:
- Step indicator (2 of 3)
- "Add your bank details" headline
- Bank account section with CTA to navigate to add-bank screen
- Utility connection section (optional, with CTA to add-utility)
- PrimaryButton "Continue" to proceed to step 3
- TextButton "Skip" for optional items

**Functional Requirements**:
- Bank account addition is required
- Utility connection is optional (can skip)
- Shows completion status for each item
- Back navigation returns to step 1

#### Step 3
**Key Elements**:
- Step indicator (3 of 3)
- "Invite your landlord" headline
- Landlord invitation CTA to navigate to invite-landlord screen
- Summary of completed setup items
- PrimaryButton "Complete Setup" to finish
- All three steps shown with completion checkmarks

**Functional Requirements**:
- Landlord invitation is recommended but can be skipped
- "Complete Setup" finalizes onboarding, navigates to home
- Shows summary of all configured items
- Cannot go back past step 1

### 2. Add Bank (/(setup)/add-bank)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 1-31485 | Bank account entry form with IFSC, account number, confirm account number |
| bescom | 1-31590 | BESCOM utility number entry variant |

#### Default (Bank Account)
**Key Elements**:
- "Add bank details" headline
- TextInput: Bank name or IFSC code (with bank lookup)
- TextInput: Account number
- TextInput: Confirm account number
- TextInput: Account holder name
- PrimaryButton "Add Bank Account"
- DottedPattern background
- Background images (ellipse-26, image-148, rectangle-30)

**Functional Requirements**:
- IFSC code lookup auto-fills bank name and branch
- Account number fields must match
- All fields required
- Validation on each field (format, length)
- Success adds bank to user profile, returns to setup index
- Loading state during API call

#### BESCOM (Utility)
**Key Elements**:
- "Add BESCOM number" headline
- TextInput: BESCOM account number
- Validation text explaining format
- PrimaryButton "Add BESCOM"
- DottedPattern background
- Background images

**Functional Requirements**:
- BESCOM number validation (specific format)
- Success adds utility to user profile, returns to setup
- Optional -- user can skip via back navigation

### 3. Invite Landlord (/(setup)/invite-landlord)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 1-31671 | Landlord invitation form with name, phone, email fields |

**Key Elements**:
- "Invite your landlord" headline
- TextInput: Landlord name
- TextInput: Landlord phone number (PhoneInput variant)
- TextInput: Landlord email (optional)
- PrimaryButton "Send Invitation"
- TextButton "Skip for now"
- DottedPattern background
- Background images (ellipse-26, image-148, rectangle-30)

**Functional Requirements**:
- Name and phone required, email optional
- Phone validation (10-digit Indian mobile)
- Email validation (format check)
- "Send Invitation" calls API, shows success toast, returns to setup
- "Skip for now" returns to setup without sending
- Invitation can be resent later from profile

### State Transitions

```
[Agreement Verified] --> setup/step1
setup/step1 --> (continue) --> setup/step2
setup/step2 --> (add bank CTA) --> add-bank/default
setup/step2 --> (add utility CTA) --> add-bank/bescom
add-bank/default --> (success) --> setup/step2
add-bank/bescom --> (success) --> setup/step2
setup/step2 --> (continue) --> setup/step3
setup/step3 --> (invite landlord CTA) --> invite-landlord/default
invite-landlord/default --> (sent or skip) --> setup/step3
setup/step3 --> (complete setup) --> [EXIT: Home Dashboard]
```

## Shared Components Used

| Component | Screens Using It |
|-----------|-----------------|
| Screen | setup, add-bank, invite-landlord |
| Text | All screens (headlines, labels, descriptions) |
| PrimaryButton | All screens (Continue, Add Bank, Send Invitation, Complete Setup) |
| TextButton | setup (Skip), invite-landlord (Skip for now) |
| TextInput | add-bank (all fields), invite-landlord (name, email) |
| PhoneInput | invite-landlord (landlord phone) |
| DottedPattern | add-bank (both states), invite-landlord |

## Stories

### Setup -- Step 1 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 41-10712 (setup step1) | 1 |
| 1.2 | BUILD: Implement step 1 with property/payment confirmation | 5 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Setup -- Step 2 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 41-10859 (setup step2) | 1 |
| 2.2 | BUILD: Implement step 2 with bank/utility CTAs | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Setup -- Step 3 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 41-11006 (setup step3) | 1 |
| 3.2 | BUILD: Implement step 3 with landlord CTA and completion summary | 5 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Add Bank -- Default (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 1-31485 (add-bank default) | 1 |
| 4.2 | BUILD: Implement bank account form with IFSC lookup, validation | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Add Bank -- BESCOM (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 1-31590 (add-bank bescom) | 1 |
| 5.2 | BUILD: Implement BESCOM utility entry form | 3 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Invite Landlord -- Default (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 1-31671 (invite-landlord default) | 1 |
| 6.2 | BUILD: Implement landlord invitation form with name, phone, email | 5 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | FLOW TEST: Maestro E2E test covering setup steps --> add bank --> invite landlord --> complete | 3 |
| 7.2 | SYSTEM IMPROVEMENT: Refine TextInput validation patterns or multi-step navigation | 3 |

**Total: 20 stories, 62 points**

## Dependencies

- **Upstream**: Flow 4 (Agreement) -- verified agreement provides pre-populated data
- **Downstream**: Flow 6 (Home) -- setup completion unlocks home dashboard
- **Shared Components**: TextInput, PhoneInput, PrimaryButton, TextButton from earlier flows. DottedPattern for add-bank and invite-landlord screens.
- **Backend**: `get-steps`, `add-bank`, `add-utility`, `invite-landlord` Supabase edge functions
- **State**: useSetup hook manages setup progress and step state

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| get-steps | Screen mount | { currentStep, completedItems[], pendingItems[] } |
| add-bank | Tap "Add Bank Account" | { success, bankId, bankName } |
| add-utility | Tap "Add BESCOM" | { success, utilityId } |
| invite-landlord | Tap "Send Invitation" | { success, invitationId, status } |
| complete-setup | Tap "Complete Setup" | { success, redirectTo: home } |

## DottedPattern Configuration

| Screen | backgroundShape Key |
|--------|-------------------|
| setup index (all steps) | (none -- verify from blueprint, may not use DottedPattern) |
| add-bank default | default |
| add-bank bescom | default |
| invite-landlord | default |

## Exit Criteria

1. All 6 setup states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 6 states
3. ODiff <=18% for DottedPattern screens, <=3% for non-DottedPattern
4. Multi-step navigation works correctly (step 1 --> 2 --> 3)
5. Bank account form validates and submits correctly
6. BESCOM utility entry works as optional addition
7. Landlord invitation sends successfully or can be skipped
8. "Complete Setup" transitions to home dashboard
9. Maestro flow test passes: step 1 --> step 2 --> add bank --> step 3 --> invite landlord --> complete
10. Zero TypeScript errors, zero ESLint warnings
11. No regressions in Flows 1-4
