# Flent Secured -- Master PRD

## Product Vision

Flent Secured is a rent payment fintech app enabling Indian urban tenants to pay rent via UPI, credit cards, and net banking. Built with React Native (Expo) + Supabase backend. Core value proposition: simple, secure rent payments with payment history and cashback rewards.

The app targets urban Indian tenants (25-40 years old) who currently pay rent via bank transfer or cash. Flent Secured digitizes this process, adds payment tracking, and incentivizes digital payments through a cashback rewards program.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo SDK), Expo Router (file-based routing) |
| State Management | Zustand (auth, waitlist) + React Query (server state) |
| Backend | Supabase (PostgreSQL + 25+ Edge Functions) |
| Design Source | Figma (103 screen variants across 27 routes) |
| Typography | PlusJakartaSans font family (Regular, Medium, SemiBold, Bold) |
| Testing | Jest (unit), Maestro (E2E), BuildBot (pixel verification pipeline) |
| CI/CD | EAS Build + EAS Submit |

## User Journeys (8 Flows)

The app follows a linear onboarding journey that branches into parallel flows once the user reaches the home dashboard.

```
Flow 1: Auth --> Flow 2: OTP --> Flow 3: Waitlist --> Flow 4: Agreement --> Flow 5: Setup --> Flow 6: Home
                                                                                              |
                                                                              +----------------+----------------+
                                                                              |                                 |
                                                                      Flow 7: Payment              Flow 8: Profile & Transactions
```

### Flow 1: Authentication (8 states)
- **Entry**: App launch
- **Path**: Splash --> Beta Splash --> Carousel (3 pages) --> Sign Up (phone number)
- **Screens**: splash, beta-splash, carousel (pages 4-6), sign-up (empty, filled)
- **Exit**: Phone number submitted --> OTP flow

### Flow 2: OTP Verification (4 states)
- **Entry**: Phone number submitted
- **Path**: OTP screen with 4 states
- **States**: empty, filled, error1 (invalid OTP), error2 (expired OTP)
- **Exit**: OTP verified --> Waitlist check

### Flow 3: Waitlist (6 states)
- **Entry**: New user after OTP verification
- **Path**: Waitlist screen with status polling
- **States**: default (pending), accepted, rejected, 24hrs (long wait), referral entry, referral-invalid
- **Exit**: Accepted --> Agreement flow | Rejected --> End

### Flow 4: Agreement (7 states)
- **Entry**: Waitlist accepted
- **Path**: Upload agreement --> Review agreement
- **Screens**: upload (idle, uploading, expired, too-large, manual-review), review (verify, modify)
- **Exit**: Agreement verified --> Setup flow

### Flow 5: Setup (6 states)
- **Entry**: Agreement approved
- **Path**: Post-approval setup steps --> Add bank --> Invite landlord
- **Screens**: setup (3 steps), add-bank (default, bescom), invite-landlord
- **Exit**: Setup complete --> Home

### Flow 6: Home Dashboard (9 states)
- **Entry**: Setup complete (or returning user)
- **Path**: Main dashboard with payment and cashback tabs
- **Screens**: home-empty (4 states), home-active (5 states)
- **Exit**: Pay rent --> Payment flow | Profile icon --> Profile

### Flow 7: Payment (18 states)
- **Entry**: Pay rent CTA from home
- **Path**: Select method --> Add payment --> Processing --> Success/Failed
- **Screens**: select-method (3), add-upi, add-card, add-netbanking, processing, success (2), failed (2), payment-cards (7 component variants)
- **Exit**: Payment complete --> Home | Failed --> Retry

### Flow 8: Profile & Transactions (8 states)
- **Entry**: Profile icon from home
- **Path**: Profile main --> Edit/Payment Methods/Agreement/Transactions
- **Screens**: profile (main, edit, payment-upi, payment-credit, payment-bank, agreement), transactions (no-cashback, with-cashback)
- **Exit**: Back --> Home

## Screen Inventory

| # | Route Key | Route | States | Figma IDs |
|---|-----------|-------|--------|-----------|
| 1 | splash | /(auth)/splash | default, animation | 1-28053, 1-28055 |
| 2 | beta-splash | /(auth)/beta-splash | beta | 1-28071 |
| 3 | carousel | /(auth)/carousel | page4, page5, page6 | 1-28985, 1-29025, 1-29065 |
| 4 | sign-up | /(auth)/sign-up | empty, filled | 1-29108, 1-29914 |
| 5 | otp | /(auth)/otp | empty, filled, error1, error2 | 1-31175, 1-31073, 1-31277, 1-31380 |
| 6 | waitlist | /(waitlist)/index | default, accepted, rejected, 24hrs, referral, referral-invalid | 41-11206, 41-11313, 41-11410, 41-11506, 41-11613, 41-11720 |
| 7 | agreement-upload | /(agreement)/upload | default, uploading, expired, too-large, manual-review | 1-30090, 1-30001, 1-30178, 1-30268, 1-30358 |
| 8 | agreement-review | /(agreement)/review | verify, modify | 1-30448, 1-30820 |
| 9 | setup | /(setup)/index | step1, step2, step3 | 41-10712, 41-10859, 41-11006 |
| 10 | add-bank | /(setup)/add-bank | default, bescom | 1-31485, 1-31590 |
| 11 | invite-landlord | /(setup)/invite-landlord | default | 1-31671 |
| 12 | home-empty | /(main)/index | upi-no-cashbacks, setup-payment, setup-upi, no-cashback | 243-6296, 243-6490, 243-6731, 243-5689 |
| 13 | home-active | /(main)/index | bank-upi, all-methods, late-payment, missed-payment, complete | 243-2762, 243-2967, 243-3170, 243-3378, 243-7185 |
| 14 | payment-select | /(payment)/select-method | before-7th, after-7th, no-setup | 41-9004, 41-9114, 41-8901 |
| 15 | payment-add-upi | /(payment)/add-upi | default | 41-8369 |
| 16 | payment-add-card | /(payment)/add-card | default | 41-8450 |
| 17 | payment-add-netbanking | /(payment)/add-netbanking | default | 41-8529 |
| 18 | payment-processing | /(payment)/processing | default | 41-9460 |
| 19 | payment-success | /(payment)/success | with-cashback, no-cashback | 41-9388, 41-9511 |
| 20 | payment-failed | /(payment)/failed | failed, refunded | 41-9563, 41-9635 |
| 21 | profile | /(profile)/index | main | 41-8760 |
| 22 | profile-edit | /(profile)/edit | edit-profile | 41-8880 |
| 23 | profile-payment | /(profile)/payment-methods | upi, credit, bank | 41-8450, 41-8612, 41-9307 |
| 24 | profile-agreement | /(profile)/agreement | agreement | 41-9811 |
| 25 | transactions | /(transactions)/index | no-cashback, with-cashback | 243-5870, 243-6083 |
| 26 | payment-cards | /(payment)/select-method | credit-unselected, credit-selected, upi-unselected, upi-selected, netbanking-unselected, netbanking-selected, add-more | 243-3794, 243-3816, 243-3838, 243-3923, 243-4008, 243-4030, 243-4052 |
| **TOTAL** | **26 route keys** | **27 routes** | **~66 states** | |

## App Directory Structure

```
rn-app/
  app/
    _layout.tsx                    # Root layout (journey-aware router)
    index.tsx                      # Entry: auth --> waitlist check --> main
    (auth)/
      _layout.tsx
      splash.tsx
      beta-splash.tsx
      carousel.tsx
      sign-up.tsx
      otp.tsx
    (waitlist)/
      _layout.tsx
      index.tsx
      approved.tsx
    (agreement)/
      _layout.tsx
      upload.tsx
      review.tsx
      success.tsx
    (setup)/
      _layout.tsx
      index.tsx
      add-bank.tsx
      add-utility.tsx
      invite-landlord.tsx
      pending-steps.tsx
    (main)/
      _layout.tsx
      index.tsx
    (payment)/
      _layout.tsx
      select-method.tsx
      add-upi.tsx
      add-card.tsx
      add-netbanking.tsx
      first-rent.tsx
      initiate.tsx
      processing.tsx
      success.tsx
      failed.tsx
    (profile)/
      _layout.tsx
      index.tsx
      edit.tsx
      payment-methods.tsx
      agreement.tsx
      notifications.tsx
      help.tsx
      about.tsx
    (profile-payment)/
      _layout.tsx
      index.tsx
    (transactions)/
      _layout.tsx
      index.tsx
      [id].tsx
    (dev)/
      _layout.tsx
      screen-picker.tsx
```

## Shared Component Library

All shared components live in `rn-app/src/components/`. The cardinal rule: ALWAYS reuse shared components. NEVER rebuild per screen.

### UI Primitives (`ui/`)
| Component | File | Purpose |
|-----------|------|---------|
| Screen | Layout/Screen.tsx | Base screen wrapper with SafeAreaView, StatusBar |
| Text | Typography/Text.tsx | Themed text with variant props |
| PrimaryButton | Button/PrimaryButton.tsx | Main CTA button with loading state |
| TextButton | Button/TextButton.tsx | Text-only button for secondary actions |
| TextInput | Input/TextInput.tsx | Universal text input with hint support |
| PhoneInput | Input/PhoneInput.tsx | Phone number input with country code |
| OTPInput | Input/OTPInput.tsx | 6-digit OTP input with auto-focus |
| Logo | Layout/Logo.tsx | App logo component |
| ErrorBoundary | ErrorBoundary.tsx | Error boundary wrapper |

### File Upload (`ui/FileUpload/`)
| Component | Purpose |
|-----------|---------|
| DocumentUploadCard | Upload card with progress indicator |
| FileUploadZone | Drag/tap zone for file selection |

### Patterns (`patterns/`)
| Component | Purpose |
|-----------|---------|
| DottedPattern | Background pattern with per-screen backgroundShape key |

### Composed (`composed/`)
| Component | Purpose |
|-----------|---------|
| ConsentToggle | Auth consent checkbox |
| CarouselDots | Carousel page indicator |
| AgreementUploadSection | Agreement upload composed view |

### Home (`home/`) -- 20 components
| Component | Purpose |
|-----------|---------|
| HomeHeader | Header with profile icon and notifications |
| HeadlineSection | Rent amount and due date display |
| TabSwitcher | Payments/Cashbacks tab bar |
| PaymentMethodCarousel | Horizontal payment method cards |
| PaymentMethodCard | Individual payment method card |
| PaymentSetupCard | Setup payment method CTA |
| PaymentMethodSelectionSheet | Bottom sheet for method selection |
| RecentPaymentsList | List of recent payments |
| CashbacksList | List of cashback rewards |
| EmptyPaymentsState | Empty state for payments tab |
| CashbackEmptyState | Empty state for cashbacks tab |
| HomeEmptyState | Full empty state for home |
| SetupProgressCard | Setup progress indicator |
| SetupChecklist | Setup steps checklist |
| FinishSetupSection | CTA to complete setup |
| LandlordStatusCard | Landlord invitation status |
| WarningBanner | Late/missed payment warning |
| CashbackSetupModal | Cashback setup modal |
| BottomFooter | Bottom navigation/CTA area |

### Payment (`payment/`) -- 10 components
| Component | Purpose |
|-----------|---------|
| PaymentCard | Payment method selection card |
| CreditCardSelect | Credit card selection variant |
| UPICardSelect | UPI selection variant |
| NetbankingCardSelect | Net banking selection variant |
| AddMoreCard | Add payment method card |
| RadioButton | Radio selection for payment methods |
| SummaryRow | Payment summary line item |
| ReceiptCard | Payment receipt container |
| ReceiptRow | Receipt line item |
| PaymentInfoRow | Payment info display row |
| PaymentStamp | Payment status stamp (success/failed) |
| DashedDivider | Dashed line divider |
| CashbackPill | Cashback amount badge |
| PaymentMethodRow | Payment method in list |

### Waitlist (`waitlist/`) -- 4 components
| Component | Purpose |
|-----------|---------|
| ReferralCodeInput | Referral code entry input |
| BenefitsCard | Waitlist benefits display |
| ApplicationTimeline | Application progress timeline |
| ProgressArc | Circular progress indicator |

### Icons (`icons/`)
| Component | Purpose |
|-----------|---------|
| AgreementIcons | SVG icons for agreement flow |

## Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| colors.black[700] | #131313 | Screen background |
| colors.black[500] | #202020 | Card backgrounds |
| colors.black[400] | #2A2A2A | Input backgrounds |
| colors.brand[500] | #FF9A6D | Primary accent, CTAs |
| colors.gray[400] | #878787 | Labels, secondary text |
| colors.gray[300] | #A9A9A9 | Tertiary text |
| colors.gray[200] | #CBCBCB | Body text |
| colors.gray[100] | #DDDDDD | Primary text |
| colors.white | #FFFFFF | High-contrast text |
| colors.error | #FF4444 | Error states |
| colors.success | #4CAF50 | Success states |

### Typography
- Font family: PlusJakartaSans
- Weights: Regular (400), Medium (500), SemiBold (600), Bold (700)
- All weights mapped as fontFamily (not fontWeight) for React Native compatibility

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| xxs | 4px | Micro spacing |
| xs | 8px | Tight spacing |
| sm | 12px | Small gaps |
| md | 16px | Standard padding |
| lg | 24px | Section spacing |
| xl | 32px | Large gaps |
| xxl | 40px | Hero spacing |
| xxxl | 48px | Major sections |
| huge | 64px | Top-level spacing |

### Border Radius
| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 12px |
| lg | 16px |
| xl | 24px |
| xxl | 40px |
| pill | 200px |

### Full Token Reference
Complete design tokens: `buildbot/config/design-tokens.json`

## Backend Architecture

### Supabase Edge Functions (25+)
All production flows wired to real Supabase edge functions (no mocks in production path).

| Service | Functions |
|---------|-----------|
| Auth | sign-up, verify-otp, refresh-token, logout |
| Waitlist | check-status, submit-referral, poll-status |
| Agreement | upload, verify, get-status, modify |
| Setup | get-steps, add-bank, add-utility, invite-landlord |
| Dashboard | get-summary, get-payments, get-cashbacks |
| Payments | initiate, process, get-status, get-methods |
| Profile | get, update, get-payment-methods |
| Notifications | get, mark-read |

### State Management
| Store | Type | Purpose |
|-------|------|---------|
| authStore | Zustand | Auth state, tokens, user info |
| waitlistStore | Zustand | Waitlist status, referral |
| Server state | React Query | All API data with caching |

### Hooks
| Hook | Purpose |
|------|---------|
| useAuth | Authentication operations |
| useRequireAuth | Auth guard for protected routes |
| useAgreement | Agreement upload and review |
| useDashboard | Home dashboard data |
| usePayments | Payment operations |
| useSetup | Setup flow state |
| useWaitlist | Waitlist status |
| useProfile | Profile data |

## Acceptance Criteria (Per Screen)

Every screen state must pass ALL of the following before certification:

### Visual Fidelity
1. All typography matches Figma (fontFamily, fontSize, fontWeight as fontFamily, color, lineHeight)
2. All colors match design token values (no hardcoded hex outside tokens)
3. All spacing and padding match blueprint measurements
4. DottedPattern uses correct backgroundShape for the screen
5. Border radius values match design tokens

### Code Quality
6. TypeScript compiles without errors (`tsc --noEmit`)
7. ESLint passes with zero warnings
8. Shared components reused (no per-screen rebuilds)
9. All existing tests pass (`npx jest`)

### BuildBot Verification
10. Blueprint extracted from Figma REST API
11. Coverage check passes (>=98% property coverage)
12. ODiff pixel diff <=3% (or <=18% for DottedPattern screens)
13. Gemini visual inspection passes (no critical findings)

### Functional
14. All interactive elements work (buttons, inputs, navigation)
15. State transitions function correctly
16. Error states display properly
17. Loading states render appropriately

## AutoBot Story Structure

Each screen state follows a 3-story pattern:

1. **Extract**: Pull Figma blueprint, generate style map
2. **Build**: Implement/fix screen to match blueprint using shared components
3. **Verify + Certify**: Run BuildBot verification pipeline, achieve certification

Additional per-flow stories:
- **Flow Test**: Maestro E2E test covering the entire flow
- **System Improvement**: Address any pipeline or component improvements discovered during the flow

### Story Estimation
- Extract: 1 point (automated)
- Build: 3-8 points (depends on complexity)
- Verify + Certify: 2 points (semi-automated)
- Flow Test: 3 points
- System Improvement: 2-5 points

## Flow PRD Index

| Flow | PRD File | States | Stories |
|------|----------|--------|---------|
| 1. Authentication | [01-auth-flow.md](flows/01-auth-flow.md) | 8 | 26 |
| 2. OTP Verification | [02-otp-flow.md](flows/02-otp-flow.md) | 4 | 14 |
| 3. Waitlist | [03-waitlist-flow.md](flows/03-waitlist-flow.md) | 6 | 20 |
| 4. Agreement | [04-agreement-flow.md](flows/04-agreement-flow.md) | 7 | 23 |
| 5. Setup | [05-setup-flow.md](flows/05-setup-flow.md) | 6 | 20 |
| 6. Home Dashboard | [06-home-flow.md](flows/06-home-flow.md) | 9 | 29 |
| 7. Payment | [07-payment-flow.md](flows/07-payment-flow.md) | 18 | 56 |
| 8. Profile & Transactions | [08-profile-transactions-flow.md](flows/08-profile-transactions-flow.md) | 8 | 26 |
| **TOTAL** | | **66 states** | **214 stories** |

## Execution Order

Flows must be executed in dependency order for the onboarding chain (Flows 1-6). Flows 7 and 8 can run in parallel after Flow 6 is certified.

```
Phase 1 (Sequential): Flow 1 --> Flow 2 --> Flow 3 --> Flow 4 --> Flow 5 --> Flow 6
Phase 2 (Parallel):   Flow 7 | Flow 8
```

### Rationale
- Flows 1-5 establish shared component patterns that later flows depend on
- Flow 6 (Home) is the hub that connects to Flows 7 and 8
- Flow 8 (Profile) shares no dependencies with Flow 7 (Payment) and can run concurrently

## Success Metrics

| Metric | Target |
|--------|--------|
| Screen states certified | 66/66 (100%) |
| BuildBot coverage | >=98% per screen |
| ODiff pixel accuracy | <=3% (<=18% DottedPattern) |
| TypeScript errors | 0 |
| ESLint warnings | 0 |
| Test pass rate | 100% |
| Maestro flow tests | 8/8 passing |
| Shared component reuse | 100% (no per-screen rebuilds) |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Figma API rate limits | Extraction delays | Batch extractions, cache blueprints |
| DottedPattern pixel diff variance | False failures | Use 18% threshold for DottedPattern screens |
| Component regressions | Multi-screen impact | Run full test suite after each change |
| State simulation complexity (Home) | Build delays | Use mock data presets, test states independently |
| Payment flow real API integration | Testing difficulty | Use Supabase test environment |
