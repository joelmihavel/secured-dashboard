# Frontend Components Reference

<!-- STALE-WARNING -->
> ⚠️ **Pre-cleanup-arc doc.** This page was last refreshed before the 2026-04-25/26 cleanup batch (DocAI residency flip, per-service SA migration, Phase 8c audit_logs immutability, Cashfree settlement webhook secret separation, Easy Split → Vendor Adjustments rename, etc.). Specific examples and counts may not match current state. The dated header below reflects when the file was originally written, NOT the current cleanup state. Cross-check against code before relying on details.

> Flent Secured React Native App -- Component Documentation
> Generated from source: `rn-app/src/components/`
> Last updated: 2026-03-08

---

## Table of Contents

- [UI Components](#ui-components)
  - [Buttons](#buttons)
  - [Inputs](#inputs)
  - [Typography](#typography)
  - [Layout](#layout)
  - [File Upload](#file-upload)
  - [Feedback](#feedback)
  - [Misc UI](#misc-ui)
- [Home Components](#home-components)
- [Payment Components](#payment-components)
- [Waitlist Components](#waitlist-components)
- [Pattern Components](#pattern-components)
- [Onboarding Components](#onboarding-components)
- [Composed Components](#composed-components)

---

## UI Components

Shared, reusable primitives used across multiple screens. Located in `src/components/ui/`.

### Buttons

#### PrimaryButton

**File:** `ui/Button/PrimaryButton.tsx`

3D animated gradient button with spring physics, shadow depth, and optional haptic feedback on press.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | -- | Button label text |
| `onPress` | `() => void` | -- | Press handler |
| `disabled` | `boolean` | `false` | Disables interaction and dims appearance |
| `loading` | `boolean` | `false` | Shows ActivityIndicator and disables press |
| `fullWidth` | `boolean` | `false` | Stretches to fill container width |
| `showDivider` | `boolean` | `false` | Renders a decorative divider above the button |
| `style` | `ViewStyle` | -- | Additional container styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** Nearly every screen -- beta-splash, sign-up, OTP, agreement review, setup forms, payment confirmation, waitlist, profile edit.

---

#### BackButton

**File:** `ui/Button/BackButton.tsx`

SVG chevron-left back button. Falls back to `router.back()` when no `onPress` is provided.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPress` | `() => void` | `router.back()` | Custom back navigation |
| `color` | `string` | `colors.white` | Chevron SVG fill color |
| `style` | `ViewStyle` | -- | Additional styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** All screens with back navigation -- OTP, sign-up, setup steps, payment flows, profile sub-screens.

---

#### TextButton

**File:** `ui/Button/TextButton.tsx`

Underlined text link button with opacity animation on press.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | -- | Button text |
| `onPress` | `() => void` | -- | Press handler |
| `underline` | `boolean` | `true` | Shows text underline |
| `disabled` | `boolean` | `false` | Dims appearance |
| `style` | `ViewStyle` | -- | Additional styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** Sign-up ("Already have an account?"), OTP ("Resend code"), agreement review ("Edit"), profile.

---

### Inputs

#### TextInput

**File:** `ui/Input/TextInput.tsx`

Design-system form input with floating label, dark/light variants, and error/success indicator states.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | -- | Input label text |
| `value` | `string` | -- | Current value |
| `onChangeText` | `(text: string) => void` | -- | Value change handler |
| `error` | `string` | -- | Error message (shows red state) |
| `success` | `boolean` | `false` | Shows green check state |
| `disabled` | `boolean` | `false` | Read-only mode |
| `variant` | `'dark' \| 'light'` | `'dark'` | Background variant |
| `hintText` | `string` | -- | Right-side hint text |
| `onHintPress` | `() => void` | -- | Makes hint text tappable |
| `placeholder` | `string` | -- | Placeholder text |
| `keyboardType` | `KeyboardTypeOptions` | -- | Keyboard layout |
| `testID` | `string` | -- | Test identifier |

**Used in:** Sign-up (name), setup forms (account number, IFSC, consumer number), agreement review (editable fields), profile edit.

---

#### PhoneInput

**File:** `ui/Input/PhoneInput.tsx`

Phone number input with country code picker modal, auto-formatting with digit grouping.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | -- | Input label |
| `value` | `string` | -- | Phone number digits |
| `onChangeText` | `(text: string) => void` | -- | Value change handler |
| `countryCode` | `string` | `'+91'` | Selected country code |
| `onCountryChange` | `(code: string) => void` | -- | Country code change handler |
| `error` | `string` | -- | Error message |
| `disabled` | `boolean` | `false` | Read-only mode |
| `placeholder` | `string` | -- | Placeholder text |
| `hintText` | `string` | -- | Right-side hint text |
| `testID` | `string` | -- | Test identifier |

**Used in:** Sign-up screen, invite-landlord screen.

---

#### OTPInput

**File:** `ui/Input/OTPInput.tsx`

Six-digit OTP code input with breathing cursor animation on the active cell.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | -- | Current OTP digits |
| `onChangeText` | `(text: string) => void` | -- | Value change handler |
| `onComplete` | `(code: string) => void` | -- | Called when all 6 digits entered |
| `error` | `string` | -- | Error message (shakes input) |
| `disabled` | `boolean` | `false` | Disables input |
| `autoFocus` | `boolean` | `true` | Auto-focuses on mount |
| `testID` | `string` | -- | Test identifier |
| `TextInputComponent` | `ComponentType` | -- | Optional custom TextInput for testing |

**Used in:** OTP verification screen.

---

### Typography

#### Text

**File:** `ui/Typography/Text.tsx`

Design system text component with named variants and color presets. Supports `inherit` mode for nested text.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `TextVariant` | `'body'` | Font size/weight preset |
| `color` | `TextColor` | `'primary'` | Named color from design tokens |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Text alignment |
| `inherit` | `boolean` | `false` | Inherits parent text styles for nesting |
| `children` | `ReactNode` | -- | Text content |

**Named exports:** `Heading1`, `Heading2`, `Heading3`, `Heading4`, `Heading5`, `BodyText`, `Caption` -- preset wrappers over `Text`.

**Used in:** Every screen and component -- the primary text primitive.

---

#### ScreenTitle

**File:** `ui/Typography/ScreenTitle.tsx`

Two-color screen title with gray/white prefix text and brand-accent suffix text.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gray` | `string` | -- | Gray-colored prefix text |
| `white` | `string` | -- | White-colored middle text |
| `accent` | `string` | -- | Brand orange (#FF9A6D) suffix text |
| `singleLine` | `boolean` | `false` | Forces single-line layout |
| `maxWidth` | `number` | -- | Maximum width constraint |

**Used in:** Agreement upload, setup screens, waitlist, payment screens.

---

### Layout

#### Screen

**File:** `ui/Layout/Screen.tsx`

SafeAreaView wrapper with StatusBar configuration. Provides consistent screen padding and safe area insets.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | -- | Screen content |
| `style` | `ViewStyle` | -- | Additional styles |
| `padded` | `boolean` | `true` | Applies horizontal padding |
| `paddingVariant` | `'default' \| 'narrow' \| 'wide'` | `'default'` | Padding size preset |
| `safeAreaTop` | `boolean` | `true` | Respects top safe area |
| `safeAreaBottom` | `boolean` | `true` | Respects bottom safe area |
| `testID` | `string` | -- | Test identifier |

**Used in:** Every screen as the root wrapper.

---

#### Logo

**File:** `ui/Layout/Logo.tsx`

Flent brand SVG logo mark.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `32` | Logo width/height |
| `color` | `string` | `colors.white` | Fill color |

**Used in:** Beta-splash, carousel, home header.

---

#### OfflineBanner

**File:** `ui/Layout/OfflineBanner.tsx`

Dismissible offline notification banner. Uses `useNetworkStatus` to detect connectivity.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | `'No internet connection'` | Banner message |
| `dismissible` | `boolean` | `true` | Allows user to dismiss |

**Used in:** Root layout (global).

---

#### UpdateBanner

**File:** `ui/Layout/UpdateBanner.tsx`

OTA update progress bar using `useOTAUpdates` hook. Shows download progress and auto-applies critical updates.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| *(none)* | -- | -- | Self-contained; reads state from hook |

**Used in:** Root layout (global).

---

### File Upload

#### FileUploadZone

**File:** `ui/FileUpload/FileUploadZone.tsx`

Dashed-border upload drop zone with document picker integration. Shows accepted file types and size limits.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onFileSelected` | `(file: DocumentResult) => void` | -- | Callback with picked file |
| `acceptedTypes` | `string[]` | `['application/pdf']` | Allowed MIME types |
| `maxSizeBytes` | `number` | `52428800` | Max file size (50MB) |
| `disabled` | `boolean` | `false` | Disables picker |
| `placeholder` | `string` | -- | Custom placeholder text |
| `style` | `ViewStyle` | -- | Additional styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** Agreement upload screen.

---

#### DocumentUploadCard

**File:** `ui/FileUpload/DocumentUploadCard.tsx`

Uploaded document card showing filename, upload progress bar, status badge, and remove/retry actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filename` | `string` | -- | Document filename |
| `status` | `'uploading' \| 'processing' \| 'completed' \| 'failed'` | -- | Current upload phase |
| `progress` | `number` | -- | Upload progress (0-100) |
| `errorMessage` | `string` | -- | Error description on failure |
| `onRemove` | `() => void` | -- | Remove/cancel callback |
| `onRetry` | `() => void` | -- | Retry upload callback |
| `style` | `ViewStyle` | -- | Additional styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** Agreement upload screen (via AgreementUploadSection).

---

### Feedback

#### BottomSheet

**File:** `ui/BottomSheet/index.tsx`

Custom bottom sheet with gesture-based dismissal, BlurView backdrop, keyboard-aware layout, and back-press handling.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | -- | Controls visibility |
| `onClose` | `() => void` | -- | Close callback |
| `children` | `ReactNode` | -- | Sheet content |
| `containerStyle` | `ViewStyle` | -- | Content container styles |
| `paddingHorizontal` | `number` | `16` | Horizontal padding |
| `useSafeArea` | `boolean` | `true` | Respects bottom safe area |
| `onBackPress` | `() => void` | -- | Android back button handler |

**Used in:** Payment method selection, country picker, bank selection, cashback setup.

---

#### AlertBanner

**File:** `ui/AlertBanner/index.tsx`

Inline error/success alert banner with icon.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'error' \| 'success' \| 'warning' \| 'info'` | `'error'` | Banner variant |
| `message` | `string` | -- | Alert message |
| `style` | `ViewStyle` | -- | Additional styles |

**Used in:** Setup forms (verification errors), payment flows, agreement review.

---

#### ErrorBoundary

**File:** `ui/ErrorBoundary.tsx`

Class-based error boundary with transient error auto-recovery (3 retries with 2s delay). Shows fallback UI with support email link.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | -- | Protected content |
| `fallback` | `ReactNode` | -- | Custom fallback UI |

**Used in:** Root layout, wrapping major screen groups.

---

### Misc UI

#### Avatar

**File:** `ui/Avatar.tsx`

User avatar with three-tier fallback chain: remote image URL, then Pokemon-style pixel art generated from userId, then initials circle.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `uri` | `string \| null` | -- | Remote avatar image URL |
| `userId` | `string` | -- | Used for deterministic pixel art generation |
| `name` | `string` | -- | Used for initials fallback |
| `size` | `number` | `40` | Avatar diameter |
| `testID` | `string` | -- | Test identifier |

**Used in:** Home header, profile screen, landlord status card.

---

#### BgLine

**File:** `ui/BgLine.tsx`

Decorative SVG grid lines for background visual treatment.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `style` | `ViewStyle` | -- | Container styles |
| `color` | `string` | `'rgba(255,255,255,0.04)'` | Line stroke color |
| `strokeWidth` | `number` | `1` | SVG stroke width |

**Used in:** Home screen background, setup screens.

---

#### Pill

**File:** `ui/Pill.tsx`

Multi-variant pill/tag badge component.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | -- | Pill label text |
| `variant` | `'default' \| 'muted' \| 'warning' \| 'error' \| 'tag' \| 'tagDisabled' \| 'tagSelected'` | `'default'` | Visual variant |
| `textColor` | `string` | -- | Custom text color override |
| `backgroundColor` | `string` | -- | Custom background override |
| `style` | `ViewStyle` | -- | Additional styles |
| `testID` | `string` | -- | Test identifier |

**Used in:** Payment status badges, cashback entries, setup progress indicators, warning banners.

---

#### SkeletonLoader

**File:** `ui/SkeletonLoader.tsx`

Shimmer loading placeholder using Moti skeleton. Renders a full-screen skeleton matching the home dashboard layout.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `backgroundShape` | `string` | -- | Background pattern key |
| `showCard` | `boolean` | `true` | Shows card placeholder |

**Used in:** Home screen (loading state), dashboard initial load.

---

#### ScrollDownIndicator

**File:** `ui/ScrollDownIndicator.tsx`

Bouncing chevron-down indicator for scrollable content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | -- | Controls visibility |
| `onPress` | `() => void` | -- | Scroll-to-bottom callback |
| `bottom` | `number` | `80` | Bottom offset position |

**Used in:** Agreement review screen (long scrollable content).

---

## Home Components

Dashboard components for the main home screen. Located in `src/components/home/`.

#### HomeHeader

**File:** `home/HomeHeader.tsx`

"Hi, [Name]" greeting header with Flent logo, avatar, and notification bell with unread badge.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userName` | `string` | -- | User's first name |
| `avatarUrl` | `string \| null` | -- | Avatar image URL |
| `userId` | `string` | -- | For avatar fallback generation |
| `onAvatarPress` | `() => void` | -- | Navigate to profile |
| `onNotificationPress` | `() => void` | -- | Navigate to notifications |
| `unreadCount` | `number` | `0` | Notification badge count |

**Used in:** Home dashboard screen (main/index.tsx).

---

#### HeadlineSection

**File:** `home/HeadlineSection.tsx`

Dynamic rent headline section. Renders different messages based on payment state variant.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `HeadlineVariant` | -- | One of: `due`, `overdue`, `missed`, `multiple_overdue`, `paid` |
| `daysUntilDue` | `number` | -- | Days until rent is due (for `due`) |
| `daysOverdue` | `number` | -- | Days past due (for `overdue`) |
| `missedMonth` | `string` | -- | Month name (for `missed`) |

Each variant renders a two-tone headline: gray text for the setup message ("Your rent is", "You missed your") and brand orange for the value/condition. Line breaks separate multi-line headlines.

**Used in:** Home dashboard screen.

---

#### PaymentFlipCard

**File:** `home/PaymentFlipCard.tsx`

Animated 3D flip card. Front face shows current month payment info (amount, due date, cashback). Back face shows a furniture illustration with yearly payment stamps grid. Uses Reanimated for spring-based flip animation with lazy back-face rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `PaymentMonthData` | -- | Payment month data object (see below) |

**PaymentMonthData interface:**

| Field | Type | Description |
|-------|------|-------------|
| `monthName` | `string` | Display month (e.g., "March 2026") |
| `cashbackEarned` | `number` | Cashback amount earned this month |
| `isInsider` | `boolean` | Whether user has "Insider" status |
| `status` | `PaymentStatusType` | One of: `paid`, `late`, `missed`, `upcoming` |
| `onViewReceipt` | `() => void` | Callback for receipt view tap |
| `yearlyStamps` | `PaymentStamp[]` | 12-month payment history for back-face grid |
| `lateCount` | `number` | Total late payments |
| `missedCount` | `number` | Total missed payments |
| `rentDueDay` | `number` | Day of month rent is due |
| `cardIndex` | `number` | Position in carousel (for animation stagger) |

**PaymentStampStatus:** `paid` | `pending` | `missed` | `late` | `future` | `upcoming`

**Used in:** Home dashboard, inside RentStatusCarousel.

---

#### PaymentMethodCard

**File:** `home/PaymentMethodCard.tsx`

Displays a saved payment method (UPI/Card/Netbanking) with type icon, masked details, and edit action.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `method` | `PaymentMethod` | -- | Payment method details |
| `onPress` | `() => void` | -- | Card press handler |
| `onEdit` | `() => void` | -- | Edit button handler |

**Used in:** Home dashboard (selected payment method display).

---

#### SetupChecklist

**File:** `home/SetupChecklist.tsx`

Three-step verification checklist with animated indicator dots showing completion status.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bankDetailsComplete` | `boolean` | -- | Bank verification done |
| `addressProofComplete` | `boolean` | -- | Utility verification done |
| `landlordInvited` | `boolean` | -- | Landlord invite sent |
| `showHeader` | `boolean` | `true` | Shows section header |
| `headerText` | `string` | -- | Custom header text |

**Used in:** Home dashboard (setup incomplete state), SetupProgressCard.

---

#### SetupProgressCard

**File:** `home/SetupProgressCard.tsx`

Setup progress timeline card with step indicators and CTA. Returns `null` when all steps are complete.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bankDetailsComplete` | `boolean` | -- | Bank verification done |
| `addressProofComplete` | `boolean` | -- | Utility verification done |
| `landlordInvited` | `boolean` | -- | Landlord invite sent |
| `onPress` | `() => void` | -- | Card press handler |
| `onCtaPress` | `() => void` | -- | CTA button handler |
| `ctaLabel` | `string` | -- | CTA button text |

**Used in:** Home dashboard, inside RentStatusCarousel.

---

#### CashbacksList

**File:** `home/CashbacksList.tsx`

Cashback balance header with stats and scrollable history list of cashback entries.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `balance` | `number` | -- | Available cashback balance (rupees) |
| `allTimeTotal` | `number` | -- | Total lifetime savings (rupees) |
| `cashbackRate` | `number` | -- | Current cashback percentage |
| `entries` | `CashbackEntry[]` | -- | Cashback history entries |
| `onEntryPress` | `(entry: CashbackEntry) => void` | -- | Entry tap handler |

**Used in:** Home dashboard (Cashbacks tab).

---

#### CashbackEmptyState

**File:** `home/CashbackEmptyState.tsx`

Empty state for cashback tab showing accrued/expected amount when no cashback history exists yet.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `accruedAmount` | `number` | -- | Accrued cashback amount |
| `allTimeTotal` | `number` | -- | Total lifetime savings |
| `cashbackRate` | `number` | -- | Current cashback percentage |

**Used in:** Home dashboard (Cashbacks tab, empty state).

---

#### WarningBanner

**File:** `home/WarningBanner.tsx`

Warning pill banner for late/missed/multiple payment warnings.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `WarningType` | -- | One of: `late`, `missed`, `multiple` |
| `customMessage` | `string` | -- | Override default warning message |

**Used in:** Home dashboard (overdue/missed rent states).

---

#### BottomFooter

**File:** `home/BottomFooter.tsx`

Fixed bottom bar showing due date info, rent amount, and primary CTA button.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dueInDays` | `number` | -- | Days until payment due |
| `amount` | `number` | -- | Amount in rupees |
| `buttonLabel` | `string` | -- | CTA button text |
| `onPress` | `() => void` | -- | CTA press handler |
| `disabled` | `boolean` | `false` | Disables CTA button |

**Used in:** Home dashboard screen (sticky footer).

---

#### StatusNotificationBanner

**File:** `home/StatusNotificationBanner.tsx`

Contextual notification pill for verification and payment states.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `NotificationType` | -- | One of: `verification_pending`, `landlord_rejected`, `rent_due` |
| `customMessage` | `string` | -- | Custom message override |
| `onPress` | `() => void` | -- | Banner press handler |

**Used in:** Home dashboard screen.

---

#### LandlordStatusCard

**File:** `home/LandlordStatusCard.tsx`

Landlord invitation status card showing one of five states: not_invited, invited, reminder_sent, approved, disputed.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `LandlordStatus` | -- | Current landlord invitation state |
| `onSendReminder` | `() => void` | -- | Send reminder callback |
| `onContactSupport` | `() => void` | -- | Contact support callback |

**Used in:** Home dashboard (setup section), invite-landlord screen.

---

#### RentStatusCarousel

**File:** `home/RentStatusCarousel.tsx`

Horizontal FlatList carousel rendering PaymentFlipCards and SetupProgressCards.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `CarouselCardItem[]` | -- | Array of card data items (payment months + setup card) |

**Used in:** Home dashboard screen.

---

#### TabSwitcher

**File:** `home/TabSwitcher.tsx`

"Recent Payments" / "Cashbacks" toggle tabs with animated underline indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `activeTab` | `TabId` | -- | Currently active tab (`'payments'` or `'cashbacks'`) |
| `onTabChange` | `(tab: TabId) => void` | -- | Tab change handler |

**Used in:** Home dashboard screen.

---

#### RecentPaymentsList

**File:** `home/RecentPaymentsList.tsx`

Scrollable list of recent payment entries with status badges and amounts.

**Used in:** Home dashboard (Payments tab).

---

#### EmptyPaymentsState

**File:** `home/EmptyPaymentsState.tsx`

Empty state placeholder when no payment history exists.

**Used in:** Home dashboard (Payments tab, empty state).

---

#### HomeEmptyState

**File:** `home/HomeEmptyState.tsx`

State-machine-driven empty state with 10 variants covering all possible dashboard states (no_tenancy, pending_verification, all_verified, etc.).

**Used in:** Home dashboard screen (various empty/incomplete states).

---

#### FinishSetupSection

**File:** `home/FinishSetupSection.tsx`

Section prompting user to complete remaining setup steps.

**Used in:** Home dashboard (setup incomplete state).

---

#### PaymentBadge

**File:** `home/PaymentBadge.tsx`

Small badge showing payment stamp status (on_time, late, missed, pending).

**Used in:** Home dashboard, payment stamps section.

---

#### CashbackSetupModal

**File:** `home/CashbackSetupModal.tsx`

Bottom sheet modal for cashback verification setup (VerificationCheckSheet).

**Used in:** Home dashboard (cashback section).

---

## Payment Components

Payment flow components. Located in `src/components/payment/`.

### PaymentMethodModal (Orchestrator)

**File:** `payment/PaymentMethodModal/index.tsx`

Payment flow orchestrator managing a multi-step state machine:
`enter-amount` -> `selector` -> `[add-card | add-debit-card | add-netbanking | confirm-payment]` -> Cashfree SDK launch (primary as of 2026-04). PayU is a legacy fallback still wired for older app versions in the natural-soak window.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `visible` | `boolean` | -- | Controls modal visibility |
| `onClose` | `() => void` | -- | Close/dismiss handler |
| `tenancyId` | `string` | -- | Active tenancy ID |
| `rentMonth` | `string` | -- | ISO rent month string |
| `initialView` | `ModalView` | `'enter-amount'` | Starting view |
| `initialPaymentId` | `string` | -- | Pre-seeded payment ID |

**Used in:** Payment initiate screen, home dashboard (pay rent CTA).

---

#### EnterAmountContent

**File:** `payment/PaymentMethodModal/EnterAmountContent.tsx`

Amount entry screen with validation bubbles showing rent breakdown, cashback discount, and convenience fee.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialAmount` | `number` | -- | Pre-filled rent amount (from dashboard upcoming payment) |
| `onProceed` | `(amount: number) => void` | -- | Callback with validated amount to advance to method selection |
| `onBack` | `() => void` | -- | Back navigation handler |

Features validation bubbles that warn about cashback impact (paying less than rent, paying after cutoff day). Formats currency in Indian locale.

**Used in:** PaymentMethodModal (first step).

---

#### MethodSelectorContent

**File:** `payment/PaymentMethodModal/MethodSelectorContent.tsx`

Radio-button-based payment method selection (UPI, Credit Card, Debit Card, Netbanking) with dynamic fee display per method. Credit card eligibility is gated on verification status.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onBack` | `() => void` | -- | Back navigation to amount entry |
| `onProceed` | `(method: PaymentMethodType) => void` | -- | Callback with selected method to advance |
| `isInitiating` | `boolean` | `false` | Shows loading state during payment initiation |

Fee display shows per-method rates (UPI: Free, CC: 1.85%, DC: 0.9%, NB: Rs 15 flat) fetched from server config with hardcoded fallbacks.

**Used in:** PaymentMethodModal (second step).

---

#### ConfirmPaymentContent

**File:** `payment/PaymentMethodModal/ConfirmPaymentContent.tsx`

Receipt-style confirmation screen showing payment summary before launching the payment SDK (Cashfree primary; PayU legacy fallback).

**Used in:** PaymentMethodModal (final step before SDK).

---

#### AddCardContent

**File:** `payment/PaymentMethodModal/AddCardContent.tsx`

Credit card entry form using secure card input fields and `usePaymentFlow` for SDK orchestration.

**Used in:** PaymentMethodModal (when user selects credit card).

---

#### AddNetbankingContent

**File:** `payment/PaymentMethodModal/AddNetbankingContent.tsx`

Bank selection screen with searchable bank list modal for netbanking payments.

**Used in:** PaymentMethodModal (when user selects netbanking).

---

#### PaymentCard

**File:** `payment/PaymentCard.tsx`

Visual credit/debit card display component showing masked card number, expiry, and network logo.

**Used in:** Payment method management screens.

---

#### RadioButton

**File:** `payment/RadioButton.tsx`

Animated radio button (24x24px) with brand orange (#FF9A6D) fill animation.

**Used in:** MethodSelectorContent (payment method selection).

---

#### Shared Types

**File:** `payment/PaymentMethodModal/types.ts`

Shared TypeScript types for the payment modal system:

- `ModalView` -- View state enum: `enter-amount`, `selector`, `add-card`, `add-debit-card`, `add-netbanking`, `confirm-payment`
- `PaymentMethodType` -- `upi`, `card`, `debit_card`, `netbanking`
- `AddMethodContentProps` -- Shared props for add-method views (paymentId, onBack, onInitiatePayment, onReadyForConfirm)
- `MethodSelectorContentProps` -- Selector view props
- `PaymentMethodModalProps` -- Top-level modal props
- `ConfirmPaymentContentProps` -- Confirmation view props

---

## Waitlist Components

Waitlist and onboarding progress components. Located in `src/components/waitlist/`.

#### BenefitsCard

**File:** `waitlist/BenefitsCard.tsx`

"What do you get with Flent Secured?" card listing product benefits with icon rows.

**Used in:** Waitlist screen (pending state).

---

#### ProgressArc

**File:** `waitlist/ProgressArc.tsx`

SVG semicircle gauge showing number of members onboarded toward total batch capacity.

**Used in:** Waitlist screen (pending state).

---

#### ReferralCodeInput

**File:** `waitlist/ReferralCodeInput.tsx`

Four-character referral/invite code input with four individual 64x64px input boxes. Auto-advances focus between cells. Validates alphanumeric characters only.

**Used in:** Waitlist screen (referral section).

---

#### ApplicationTimeline

**File:** `waitlist/ApplicationTimeline.tsx`

Timeline card showing application status steps (submitted, under review, approved/rejected).

**Used in:** Waitlist screen (pending/pending_long states).

---

## Pattern Components

Decorative pattern and background components. Located in `src/components/patterns/`.

#### DottedGridPattern

**File:** `patterns/DottedGridPattern.tsx`

Animated SVG dot grid with a drifting spotlight effect. Renders a grid of circular dots with configurable spacing and a radial fade mask.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dotSize` | `number` | `2` | Diameter of each dot |
| `spacing` | `number` | `16` | Grid spacing between dots |
| `dotOpacity` | `number` | `0.15` | Base dot opacity |
| `dotColor` | `string` | `'#FFFFFF'` | Dot fill color |
| `fadeMask` | `boolean` | `true` | Applies radial gradient fade |
| `animated` | `boolean` | `true` | Enables spotlight animation |

**Used in:** Auth screens (splash, carousel), agreement screens.

---

## Onboarding Components

Illustrations and animations for the onboarding carousel. Located in `src/components/onboarding/`.

#### Illustration1 / Illustration2 / Illustration3

**Files:** `onboarding/Illustration1.tsx`, `Illustration2.tsx`, `Illustration3.tsx`

SVG path-based illustrations with individual `AnimatedPath` components. Each illustration has 290-333 paths with infinite `withRepeat` animations and `cancelAnimation` cleanup.

**Performance note:** Combined, these create approximately 941 simultaneous Reanimated worklets. The carousel uses lazy rendering (active + adjacent slides only) to manage this.

**Used in:** Onboarding carousel screen.

---

## Composed Components

Higher-level composed components combining multiple primitives. Located in `src/components/composed/`.

#### AgreementUploadSection

**File:** `composed/agreement/AgreementUploadSection.tsx`

Composes `FileUploadZone` and `DocumentUploadCard` into a complete upload section with state transitions (idle -> uploading -> processing -> completed/failed).

**Used in:** Agreement upload screen.

---

#### CarouselDots

**File:** `composed/auth/CarouselDots.tsx`

Page indicator dots (8x8px, gap 4px) for the onboarding carousel.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `count` | `number` | -- | Total number of pages |
| `activeIndex` | `number` | -- | Currently active page index |

**Used in:** Onboarding carousel screen.

---

#### ConsentToggle

**File:** `composed/auth/ConsentToggle.tsx`

3D animated toggle switch with consent text for Cashfree M360 identity verification opt-in.

**Used in:** Sign-up screen (M360 consent section).

---

## Component Architecture Notes

**Memoization:** All components use `React.memo` for render optimization with custom comparison where needed.

**Barrel exports:** Each component directory exports via `index.ts` barrel files. Home components export 20+ items from `home/index.ts`.

**Design tokens:** Components reference shared constants from `src/config/theme.ts`:
- Background: `#131313` (colors.black[700])
- Cards: `#202020` (colors.black[500])
- Brand accent: `#FF9A6D` (colors.brand[500])
- Font: PlusJakartaSans (Regular, Medium, SemiBold, Bold)
- Spacing: xs=8, sm=12, md=16, lg=24, xl=32

**Testing:** Components support `testID` props for E2E and integration testing.

**Circular import safety:** Components inside `src/components/` must never import from the parent barrel (`@/src/components`). Always use direct paths (`@/src/components/ui/Typography`, etc.) to prevent circular dependency issues in Hermes release builds.
