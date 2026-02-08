# Use Cases Catalog
## Flent Secured - Comprehensive Use Case Documentation

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document catalogs all use cases for the Flent Secured rent payment app. Each use case follows a standard format with preconditions, main flow, alternate flows, and acceptance criteria.

**Total Use Cases: 62**

---

## Actors

| Actor | Description |
|-------|-------------|
| **Tenant** | Primary user who pays rent through the app |
| **Landlord** | Property owner who receives rent payments |
| **System** | Automated backend processes |
| **Bank** | External payment processor (UPI, Net Banking) |
| **Cashfree** | Identity verification provider |

---

## Module 1: Onboarding & Authentication

### UC-ONB-001: New User Views Splash Screen
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-001 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | App installed, first launch |
| **Main Flow** | 1. User opens app<br>2. Splash screen displays with logo<br>3. "Make your rent work for you" headline shown<br>4. "Get Started" and "Log in" buttons visible |
| **Postconditions** | User sees onboarding entry point |
| **Acceptance Criteria** | - Logo renders correctly<br>- Both buttons are tappable<br>- Dark theme applied |
| **Figma** | 1-28055 |

### UC-ONB-002: New User Completes Carousel
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-002 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | User tapped "Get Started" |
| **Main Flow** | 1. Carousel slide 1 displays<br>2. User swipes to slide 2<br>3. User swipes to slide 3<br>4. User taps "Continue" |
| **Alternate Flow** | User taps "Skip" to bypass carousel |
| **Postconditions** | User arrives at Sign Up screen |
| **Acceptance Criteria** | - 3 slides viewable<br>- Pagination dots accurate<br>- Skip works from any slide |

### UC-ONB-003: User Skips Carousel
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-003 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | User on any carousel slide |
| **Main Flow** | 1. User taps "Skip" button<br>2. Navigates directly to Sign Up |
| **Postconditions** | User on Sign Up screen |
| **Acceptance Criteria** | - Skip button visible on all slides<br>- Single tap navigates |

### UC-ONB-004: User Enters Phone Number
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-004 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | User on Sign Up screen |
| **Main Flow** | 1. User taps phone input<br>2. Numeric keyboard appears<br>3. User enters 10-digit number<br>4. Number formats as "98765 43210" |
| **Validation** | 10 digits required, numeric only |
| **Postconditions** | Phone field populated with formatted number |
| **Acceptance Criteria** | - +91 prefix shown<br>- Auto-formatting works<br>- Only digits accepted |
| **Figma** | 1-29108 |

### UC-ONB-005: User Enters Name
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-005 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Phone number entered |
| **Main Flow** | 1. User taps name input<br>2. Keyboard appears<br>3. User enters full name<br>4. Field validates (min 2 chars) |
| **Postconditions** | Name field populated |
| **Acceptance Criteria** | - Text input works<br>- Min 2 character validation |
| **Figma** | 1-31073 |

### UC-ONB-006: User Toggles Consent
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-006 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Phone and name entered |
| **Main Flow** | 1. User reads consent text<br>2. User taps toggle to ON<br>3. "Get Started" button enables |
| **Postconditions** | Consent given, form submittable |
| **Acceptance Criteria** | - Toggle animates<br>- Button state changes<br>- Cashfree link tappable |
| **Figma** | 1-31590 |

### UC-ONB-007: User Submits Sign Up Form
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-007 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | All fields valid, consent ON |
| **Main Flow** | 1. User taps "Get Started"<br>2. Loading state shows<br>3. OTP sent to phone<br>4. OTP modal appears |
| **Error Flow** | API error → Error message displayed |
| **Postconditions** | OTP modal visible |
| **Acceptance Criteria** | - Button shows loading<br>- OTP delivered via SMS<br>- Modal slides up |

### UC-ONB-008: User Enters OTP
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-008 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | OTP modal visible |
| **Main Flow** | 1. User receives SMS with 6-digit OTP<br>2. User enters OTP in boxes<br>3. Auto-submit on 6th digit<br>4. Verification succeeds |
| **Error Flow** | Wrong OTP → Error shown, can retry |
| **Postconditions** | User authenticated |
| **Acceptance Criteria** | - 6 input boxes<br>- Cursor animation<br>- Auto-advance between boxes |
| **Figma** | 1-29025 |

### UC-ONB-009: User Resends OTP
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-009 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | OTP not received or expired |
| **Main Flow** | 1. User waits 30 seconds<br>2. "Resend" button enables<br>3. User taps Resend<br>4. New OTP sent |
| **Postconditions** | Fresh OTP delivered |
| **Acceptance Criteria** | - 30s cooldown enforced<br>- Timer displayed<br>- Previous OTP invalidated |

### UC-ONB-010: User Uploads Agreement
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-010 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | User authenticated |
| **Main Flow** | 1. Agreement upload screen shows<br>2. User taps upload area<br>3. File picker opens<br>4. User selects PDF<br>5. File uploads with progress |
| **Validation** | PDF only, max 10MB |
| **Postconditions** | Agreement uploaded |
| **Acceptance Criteria** | - File picker works<br>- Progress indicator<br>- Format validation |
| **Figma** | 1-30090 |

### UC-ONB-011: User Reviews Agreement
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-011 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Agreement uploaded |
| **Main Flow** | 1. Agreement preview displays<br>2. User reviews document<br>3. User taps "Proceed"<br>4. Application submitted |
| **Postconditions** | Application in review |
| **Acceptance Criteria** | - PDF preview visible<br>- Delete option available<br>- Proceed submits |
| **Figma** | 1-30001 |

### UC-ONB-012: User Views Waitlist Status
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-012 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Application submitted |
| **Main Flow** | 1. Waitlist screen displays<br>2. Status shows "In Review"<br>3. Member count visible<br>4. Referral code input shown |
| **Postconditions** | User understands status |
| **Acceptance Criteria** | - Status accurate<br>- Member counter animates<br>- Referral input works |
| **Figma** | 41-11206 |

### UC-ONB-013: User Enters Referral Code
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-013 |
| **Actor** | Tenant |
| **Priority** | P2 |
| **Preconditions** | On waitlist screen |
| **Main Flow** | 1. User taps referral input<br>2. Enters 4-digit code<br>3. Taps "Enter Invite Code"<br>4. Priority access granted |
| **Error Flow** | Invalid code → Error message |
| **Postconditions** | Position improved |
| **Acceptance Criteria** | - 4-digit input<br>- Validation feedback<br>- Success confirmation |

### UC-ONB-014: Returning User Logs In
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-ONB-014 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Existing account |
| **Main Flow** | 1. User taps "Log in" on splash<br>2. Phone entry screen shows<br>3. User enters registered number<br>4. OTP flow completes<br>5. Home screen loads |
| **Postconditions** | User authenticated, at home |
| **Acceptance Criteria** | - No carousel shown<br>- Direct to phone entry<br>- State restored |

---

## Module 2: Payment Flow

### UC-PAY-001: User Views Payment Summary
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-001 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | User on home, rent due |
| **Main Flow** | 1. User taps "Review" on home<br>2. Payment transaction screen loads<br>3. Rent breakdown displayed |
| **Postconditions** | User sees payment details |
| **Acceptance Criteria** | - Base rent shown<br>- Maintenance shown<br>- Total calculated correctly |
| **Figma** | 41-9681 |

### UC-PAY-002: User Views Cashback Eligibility
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-002 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | On payment screen, before 7th |
| **Main Flow** | 1. Cashback amount displayed<br>2. Eligibility deadline shown<br>3. Countdown timer visible |
| **Postconditions** | User understands cashback |
| **Acceptance Criteria** | - 1% calculation correct<br>- Timer counts down<br>- Lock icon if setup incomplete |

### UC-PAY-003: User Toggles Cashback Off
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-003 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Cashback eligible |
| **Main Flow** | 1. User taps cashback toggle<br>2. Toggle switches to OFF<br>3. Payable amount updates |
| **Postconditions** | Full rent amount shown |
| **Acceptance Criteria** | - Toggle animates<br>- Amount recalculates<br>- Can toggle back ON |

### UC-PAY-004: User Selects UPI Payment
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-004 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | On payment methods screen |
| **Main Flow** | 1. User views payment methods<br>2. Taps UPI card<br>3. "SELECTED" badge appears<br>4. Taps "Continue" |
| **Postconditions** | UPI selected for payment |
| **Acceptance Criteria** | - UPI card selectable<br>- Selection state visible<br>- Continue proceeds |
| **Figma** | 243-4008 |

### UC-PAY-005: User Completes UPI Payment
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-005 |
| **Actor** | Tenant, Bank |
| **Priority** | P0 |
| **Preconditions** | UPI selected |
| **Main Flow** | 1. User taps "Pay Now"<br>2. UPI app opens<br>3. User enters PIN<br>4. Bank authorizes<br>5. Callback to app<br>6. Success screen |
| **Postconditions** | Payment completed |
| **Acceptance Criteria** | - External app launch<br>- Callback handled<br>- Success confirmed |

### UC-PAY-006: User Selects Net Banking
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-006 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | On payment methods screen |
| **Main Flow** | 1. User taps Net Banking card<br>2. Bank selection appears<br>3. User selects bank<br>4. Taps "Continue" |
| **Postconditions** | Net Banking selected |
| **Acceptance Criteria** | - Bank list populated<br>- Selection persists<br>- Continue enabled |

### UC-PAY-007: User Completes Net Banking Payment
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-007 |
| **Actor** | Tenant, Bank |
| **Priority** | P0 |
| **Preconditions** | Net Banking selected |
| **Main Flow** | 1. User taps "Pay Now"<br>2. Browser/WebView opens<br>3. User logs into bank<br>4. User completes 2FA<br>5. Bank redirects back<br>6. Success screen |
| **Postconditions** | Payment completed |
| **Acceptance Criteria** | - WebView loads<br>- Redirect handled<br>- Status tracked |

### UC-PAY-008: User Selects Credit Card
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-008 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | User status = "complete", card saved |
| **Main Flow** | 1. User taps Credit Card option<br>2. Card details shown (masked)<br>3. CVV entry required<br>4. Taps "Continue" |
| **Postconditions** | Credit card selected |
| **Acceptance Criteria** | - Card visible only if complete<br>- 2% fee displayed<br>- CVV input secure |

### UC-PAY-009: User Views Payment Processing
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-009 |
| **Actor** | Tenant, System |
| **Priority** | P0 |
| **Preconditions** | Payment initiated |
| **Main Flow** | 1. Processing screen shows<br>2. Status updates in real-time<br>3. Animation indicates progress<br>4. Completes with result |
| **Postconditions** | Payment status known |
| **Acceptance Criteria** | - Real-time updates<br>- Clear status text<br>- Timeout handled |
| **Figma** | 243-4062 |

### UC-PAY-010: User Views Payment Success
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-010 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Payment successful |
| **Main Flow** | 1. Success screen displays<br>2. Amount confirmed<br>3. Transaction ID shown<br>4. User taps "Done" |
| **Postconditions** | User returns to home |
| **Acceptance Criteria** | - Green success indicator<br>- Receipt details visible<br>- Home shows paid state |
| **Figma** | 243-4258 |

### UC-PAY-011: User Retries Failed Payment
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-011 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Payment failed |
| **Main Flow** | 1. Failure screen displays<br>2. Error reason shown<br>3. User taps "Try Again"<br>4. Returns to payment methods |
| **Postconditions** | Can attempt new payment |
| **Acceptance Criteria** | - Error message clear<br>- Retry option visible<br>- Can change method |

### UC-PAY-012: User Views Transaction History
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-012 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Has payment history |
| **Main Flow** | 1. User goes to Recent Payments tab<br>2. Transaction list loads<br>3. User taps a transaction<br>4. Detail view opens |
| **Postconditions** | Transaction details visible |
| **Acceptance Criteria** | - List sorted by date<br>- Status icons correct<br>- Details complete |

### UC-PAY-013: User Tracks Refund
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PAY-013 |
| **Actor** | Tenant, System |
| **Priority** | P1 |
| **Preconditions** | Refund initiated |
| **Main Flow** | 1. Transaction shows "Refund Processing"<br>2. Status updates over time<br>3. Shows "Refunded" when complete |
| **Postconditions** | Refund status tracked |
| **Acceptance Criteria** | - Status progression shown<br>- Timeline displayed<br>- Final confirmation |

---

## Module 3: Verification Setup

### UC-VER-001: User Initiates Setup
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-001 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Home zero state |
| **Main Flow** | 1. User taps "Finish Setup"<br>2. Setup sheet slides up<br>3. 3 steps displayed |
| **Postconditions** | Setup options visible |
| **Acceptance Criteria** | - Sheet animates up<br>- All 3 steps shown<br>- Can dismiss |
| **Figma** | 243-6731 |

### UC-VER-002: User Adds Landlord Bank
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-002 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Setup sheet open |
| **Main Flow** | 1. User taps "Add landlord's bank"<br>2. Bank entry form shows<br>3. User enters IFSC code<br>4. Bank auto-detected<br>5. User enters account number<br>6. Penny drop verifies |
| **Postconditions** | Bank verified |
| **Acceptance Criteria** | - IFSC lookup works<br>- Account validated<br>- Success confirmation |

### UC-VER-003: User Uploads Address Proof
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-003 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Setup sheet open |
| **Main Flow** | 1. User taps "Upload address proof"<br>2. File picker opens<br>3. User selects utility bill<br>4. Upload progresses<br>5. Document submitted for review |
| **Postconditions** | Document pending review |
| **Acceptance Criteria** | - Multiple formats accepted<br>- Upload progress shown<br>- Pending status displayed |

### UC-VER-004: User Invites Landlord
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-004 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Setup sheet open |
| **Main Flow** | 1. User taps "Invite landlord"<br>2. Invitation form shows<br>3. User enters landlord email<br>4. User taps "Send Invite"<br>5. Invitation sent |
| **Postconditions** | Invitation pending |
| **Acceptance Criteria** | - Email validated<br>- Send succeeds<br>- Status updates |

### UC-VER-005: User Tracks Landlord Invitation
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-005 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Invitation sent |
| **Main Flow** | 1. Setup sheet shows invitation status<br>2. Status updates as landlord acts<br>3. Accepted/Declined shown |
| **Postconditions** | Final status known |
| **Acceptance Criteria** | - Real-time updates<br>- Clear status text<br>- Action items shown |

### UC-VER-006: User Resends Landlord Invitation
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-006 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Invitation pending > 24h |
| **Main Flow** | 1. "Resend" button appears<br>2. User taps resend<br>3. New invitation sent |
| **Postconditions** | Fresh invitation sent |
| **Acceptance Criteria** | - 24h cooldown enforced<br>- Resend succeeds<br>- Counter resets |

### UC-VER-007: Landlord Accepts Invitation
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-VER-007 |
| **Actor** | Landlord, System |
| **Priority** | P0 |
| **Preconditions** | Landlord received invite |
| **Main Flow** | 1. Landlord clicks invite link<br>2. Confirms tenancy details<br>3. System notifies tenant<br>4. Verification complete |
| **Postconditions** | Tenant fully verified |
| **Acceptance Criteria** | - Real-time notification<br>- Status updates<br>- Home transitions |

---

## Module 4: Home States

### UC-HOME-001: User Views Zero State
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-001 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | No verifications complete |
| **Main Flow** | 1. Home loads<br>2. Setup prompts displayed<br>3. Rent due countdown shown |
| **Postconditions** | User sees setup path |
| **Acceptance Criteria** | - Prompts visible<br>- Countdown accurate<br>- Setup CTA present |

### UC-HOME-002: User Views Active State
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-002 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | All verifications complete |
| **Main Flow** | 1. Home loads<br>2. Full payment options shown<br>3. Cashback visible<br>4. Review button active |
| **Postconditions** | User can pay |
| **Acceptance Criteria** | - All features unlocked<br>- Accurate data<br>- Payment enabled |
| **Figma** | 243-5870 |

### UC-HOME-003: User Views Paid State
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-003 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Current month paid |
| **Main Flow** | 1. Home loads<br>2. "Paid" status shown<br>3. Next due date displayed |
| **Postconditions** | User sees success |
| **Acceptance Criteria** | - Green paid indicator<br>- Receipt accessible<br>- Next month preview |

### UC-HOME-004: User Views Overdue State
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-004 |
| **Actor** | Tenant |
| **Priority** | P0 |
| **Preconditions** | Payment past due |
| **Main Flow** | 1. Home loads<br>2. Warning banner shows<br>3. Overdue amount displayed<br>4. Pay now prominently shown |
| **Postconditions** | User prompted to pay |
| **Acceptance Criteria** | - Warning visible<br>- Amount accurate<br>- CTA emphasized |

### UC-HOME-005: User Views Payment Methods
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-005 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | On home screen |
| **Main Flow** | 1. User sees payment card carousel<br>2. Can swipe between methods<br>3. Selected method highlighted |
| **Postconditions** | User knows active method |
| **Acceptance Criteria** | - Carousel swipes<br>- Selection persists<br>- Details masked appropriately |

### UC-HOME-006: User Views Cashback Tab
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-HOME-006 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Has cashback history |
| **Main Flow** | 1. User taps "Cashbacks" tab<br>2. Accrued amount shown<br>3. All-time total displayed<br>4. Rate percentage shown |
| **Postconditions** | User sees cashback summary |
| **Acceptance Criteria** | - Amounts accurate<br>- Rate calculated<br>- History available |

---

## Module 5: Profile Management

### UC-PROF-001: User Views Profile
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-001 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | User authenticated |
| **Main Flow** | 1. User taps avatar on home<br>2. Profile screen loads<br>3. All sections visible |
| **Postconditions** | Profile displayed |
| **Acceptance Criteria** | - Avatar correct<br>- All sections present<br>- Data accurate |
| **Figma** | 41-8760 |

### UC-PROF-002: User Views Payment History Chart
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-002 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | On profile screen |
| **Main Flow** | 1. Chart displays at top<br>2. Months shown (JAN-MAY)<br>3. Status colors indicate (On time/Late/Not Paid) |
| **Postconditions** | User sees payment pattern |
| **Acceptance Criteria** | - Chart renders<br>- Legend clear<br>- Data accurate |

### UC-PROF-003: User Edits Profile Details
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-003 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | On profile screen |
| **Main Flow** | 1. User taps name "edit"<br>2. Edit screen opens<br>3. User modifies name<br>4. Taps "Save Changes" |
| **Postconditions** | Profile updated |
| **Acceptance Criteria** | - Edit UI works<br>- Validation applies<br>- Changes persist |
| **Figma** | 41-8880 |

### UC-PROF-004: User Views Agreement
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-004 |
| **Actor** | Tenant |
| **Priority** | P2 |
| **Preconditions** | Agreement uploaded |
| **Main Flow** | 1. User taps "View Agreement"<br>2. Agreement PDF displays |
| **Postconditions** | Agreement visible |
| **Acceptance Criteria** | - PDF renders<br>- Can zoom/scroll |

### UC-PROF-005: User Edits Payment Method
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-005 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | Payment method saved |
| **Main Flow** | 1. User taps "Edit UPI Method"<br>2. Edit form opens<br>3. User updates details<br>4. Saves changes |
| **Postconditions** | Method updated |
| **Acceptance Criteria** | - Edit flow works<br>- Validation applies<br>- Changes reflect in payments |

### UC-PROF-006: User Contacts Support
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-006 |
| **Actor** | Tenant |
| **Priority** | P2 |
| **Preconditions** | On profile screen |
| **Main Flow** | 1. User taps "Contact Support"<br>2. Support options shown<br>3. User selects channel |
| **Postconditions** | Support contact initiated |
| **Acceptance Criteria** | - Options available<br>- External app opens |

### UC-PROF-007: User Signs Out
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-007 |
| **Actor** | Tenant |
| **Priority** | P1 |
| **Preconditions** | User authenticated |
| **Main Flow** | 1. User taps "Sign Out"<br>2. Confirmation modal appears<br>3. User confirms<br>4. Session cleared, splash shown |
| **Postconditions** | User logged out |
| **Acceptance Criteria** | - Confirmation required<br>- Data cleared<br>- Redirect to splash |

### UC-PROF-008: User Deletes Account
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-PROF-008 |
| **Actor** | Tenant |
| **Priority** | P2 |
| **Preconditions** | User authenticated |
| **Main Flow** | 1. User taps "Delete Account"<br>2. Warning shown<br>3. OTP verification required<br>4. Final confirmation<br>5. Account deleted |
| **Postconditions** | Account removed |
| **Acceptance Criteria** | - Multi-step confirmation<br>- OTP required<br>- Complete data deletion |

---

## Module 6: System & Notifications

### UC-SYS-001: System Sends Payment Reminder
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-SYS-001 |
| **Actor** | System |
| **Priority** | P1 |
| **Trigger** | Rent due in 3 days |
| **Main Flow** | 1. System checks due dates<br>2. Push notification sent<br>3. User taps notification<br>4. Opens payment screen |
| **Postconditions** | User reminded |
| **Acceptance Criteria** | - Timing accurate<br>- Deep link works |

### UC-SYS-002: System Sends Payment Confirmation
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-SYS-002 |
| **Actor** | System |
| **Priority** | P1 |
| **Trigger** | Payment completed |
| **Main Flow** | 1. Payment succeeds<br>2. Push notification sent<br>3. Email receipt sent |
| **Postconditions** | User notified |
| **Acceptance Criteria** | - Immediate notification<br>- Receipt delivered |

### UC-SYS-003: System Sends Verification Update
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-SYS-003 |
| **Actor** | System |
| **Priority** | P1 |
| **Trigger** | Landlord responds |
| **Main Flow** | 1. Landlord accepts/declines<br>2. Push notification sent<br>3. App state updates |
| **Postconditions** | User informed |
| **Acceptance Criteria** | - Real-time notification<br>- State accurate |

### UC-SYS-004: System Handles Deep Link
| Attribute | Description |
|-----------|-------------|
| **ID** | UC-SYS-004 |
| **Actor** | System |
| **Priority** | P1 |
| **Trigger** | Deep link opened |
| **Main Flow** | 1. User taps deep link<br>2. App launches/resumes<br>3. Auth checked<br>4. Navigates to destination |
| **Postconditions** | User at correct screen |
| **Acceptance Criteria** | - Auth enforced<br>- Navigation works<br>- Params passed |

---

## Summary

| Module | Use Cases | P0 | P1 | P2 |
|--------|-----------|----|----|-----|
| Onboarding & Auth | 14 | 9 | 3 | 2 |
| Payment Flow | 13 | 8 | 5 | 0 |
| Verification Setup | 7 | 5 | 2 | 0 |
| Home States | 6 | 4 | 2 | 0 |
| Profile Management | 8 | 0 | 5 | 3 |
| System & Notifications | 4 | 0 | 4 | 0 |
| **Total** | **62** | **26** | **21** | **5** |

---

*Document generated: 2026-01-31*
*Next review: When new features added*
