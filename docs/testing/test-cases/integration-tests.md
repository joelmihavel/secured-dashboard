# Integration Test Specifications
## Flent Secured - Screen-Level Integration Tests

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document specifies integration tests for screen-level components and their interactions. Integration tests validate that multiple components work together correctly within a screen context, including navigation, state management, and API interactions (mocked).

**Target Coverage: 70%+**
**Framework: React Native Testing Library + Jest**

---

## 1. Onboarding Flow Integration

### 1.1 Splash Screen

**File:** `app/(auth)/splash.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-SPL-001 | Initial render with logo and buttons | Mount Splash screen | - Logo visible<br>- "Get Started" button visible<br>- "Log in" link visible | P0 |
| INT-SPL-002 | Get Started navigates to carousel | Press "Get Started" | - Router navigates to `/carousel` | P0 |
| INT-SPL-003 | Log in navigates to sign-up with login mode | Press "Log in" | - Router navigates to `/sign-up?mode=login` | P0 |
| INT-SPL-004 | Animations complete on mount | Wait for animations | - Fade in complete<br>- No flickering | P1 |

**Test Template:**
```typescript
describe('Splash Screen Integration', () => {
  it('INT-SPL-001: renders logo and action buttons', async () => {
    render(<SplashScreen />);

    expect(screen.getByTestId('flent-logo')).toBeVisible();
    expect(screen.getByText('Get Started')).toBeVisible();
    expect(screen.getByText('Log in')).toBeVisible();
  });

  it('INT-SPL-002: navigates to carousel on Get Started', async () => {
    const mockPush = jest.fn();
    jest.spyOn(router, 'push').mockImplementation(mockPush);

    render(<SplashScreen />);
    fireEvent.press(screen.getByText('Get Started'));

    expect(mockPush).toHaveBeenCalledWith('/carousel');
  });
});
```

### 1.2 Carousel Screen

**File:** `app/(auth)/carousel.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-CAR-001 | Renders 3 carousel slides | Mount screen | - All 3 slides present<br>- Pagination dots (3) visible | P0 |
| INT-CAR-002 | Swipe advances to next slide | Swipe left | - Slide 2 visible<br>- Pagination updates | P0 |
| INT-CAR-003 | Skip button navigates to sign-up | Press "Skip" | - Router navigates to `/sign-up` | P0 |
| INT-CAR-004 | Continue on last slide navigates to sign-up | On slide 3, press "Continue" | - Router navigates to `/sign-up` | P0 |
| INT-CAR-005 | Slide content matches Figma | Each slide | - Correct title<br>- Correct description<br>- Correct illustration | P1 |

### 1.3 Sign Up Screen

**File:** `app/(auth)/sign-up.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-SUP-001 | Renders phone and name inputs | Mount screen | - Phone input visible<br>- Name input visible<br>- Consent toggle visible | P0 |
| INT-SUP-002 | Phone validation on invalid input | Enter 9 digits | - Error message visible<br>- Button disabled | P0 |
| INT-SUP-003 | Name validation on short input | Enter 1 char | - Error message visible | P0 |
| INT-SUP-004 | Button disabled until form valid | Leave form incomplete | - Button disabled (low opacity) | P0 |
| INT-SUP-005 | Button enabled when form complete | Valid phone + name + consent | - Button enabled | P0 |
| INT-SUP-006 | Submit triggers OTP request | Press "Get Started" | - API called with phone<br>- Navigates to OTP screen | P0 |
| INT-SUP-007 | Phone already exists error | API returns 409 | - Error toast/message visible | P0 |
| INT-SUP-008 | Network error handling | API fails | - Retry option shown | P1 |
| INT-SUP-009 | Login mode shows different UI | `?mode=login` | - Different heading<br>- No name field | P0 |

**Test Template:**
```typescript
describe('Sign Up Screen Integration', () => {
  const mockRequestOTP = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestOTP.mockResolvedValue({ success: true });
  });

  it('INT-SUP-005: enables button when form is complete', async () => {
    render(<SignUpScreen />);

    const phoneInput = screen.getByTestId('phone-input');
    const nameInput = screen.getByTestId('name-input');
    const consentToggle = screen.getByTestId('consent-toggle');
    const submitButton = screen.getByTestId('get-started-button');

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Fill form
    fireEvent.changeText(phoneInput, '9876543210');
    fireEvent.changeText(nameInput, 'John Doe');
    fireEvent(consentToggle, 'valueChange', true);

    // Now enabled
    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });
});
```

### 1.4 OTP Screen

**File:** `app/(auth)/otp.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-OTP-001 | Renders OTP input with 6 boxes | Mount screen | - 6 input boxes visible<br>- Phone number displayed | P0 |
| INT-OTP-002 | Auto-focus on first input | Mount screen | - First input focused | P0 |
| INT-OTP-003 | Auto-advance on digit entry | Type digit | - Focus moves to next box | P0 |
| INT-OTP-004 | Backspace moves focus back | Press backspace on empty | - Focus moves to previous box | P0 |
| INT-OTP-005 | Auto-submit on 6th digit | Enter all 6 digits | - Verify API called<br>- Loading state shown | P0 |
| INT-OTP-006 | Wrong code shows error | API returns invalid | - "Wrong Code" message visible<br>- Inputs cleared | P0 |
| INT-OTP-007 | Resend button disabled for 30s | Mount screen | - Resend disabled<br>- Countdown visible | P0 |
| INT-OTP-008 | Resend enabled after 30s | Wait 30s | - Resend button enabled | P0 |
| INT-OTP-009 | Successful verify navigates forward | API returns success | - Navigates to agreement upload | P0 |
| INT-OTP-010 | Max attempts shows lockout | 3 wrong attempts | - Lockout message visible | P0 |

---

## 2. Home Screen Integration

### 2.1 Home - Zero State

**File:** `app/(main)/index.tsx` with zero state

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-HZS-001 | Renders setup prompts when no verifications | User status = new | - "Finish Setup" card visible<br>- 3 verification steps shown | P0 |
| INT-HZS-002 | Bank verification step shows as pending | No bank added | - "Add landlord's bank" step visible<br>- Not checked | P0 |
| INT-HZS-003 | Address proof step shows as pending | No proof uploaded | - "Upload address proof" step visible | P0 |
| INT-HZS-004 | Landlord invite step shows as pending | No invite sent | - "Invite landlord" step visible | P0 |
| INT-HZS-005 | Tapping step opens corresponding sheet | Press any step | - Bottom sheet opens with correct form | P0 |
| INT-HZS-006 | Cashback locked badge visible | Not eligible | - Locked icon<br>- "Complete setup to unlock" text | P1 |
| INT-HZS-007 | Rent amount displays correctly | Rent = 32,500 | - "₹32,500" visible in rent card | P0 |

### 2.2 Home - Active State

**File:** `app/(main)/index.tsx` with active state

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-HAS-001 | Renders payment card when rent due | Payment pending | - Rent due card visible<br>- "Review" button visible | P0 |
| INT-HAS-002 | Shows cashback if eligible | User qualified + before 7th | - Cashback badge visible<br>- Amount shown | P0 |
| INT-HAS-003 | Shows countdown timer | Rent due in future | - "Rent due in X days" visible | P1 |
| INT-HAS-004 | Review button navigates to payment | Press "Review" | - Navigates to payment transaction | P0 |
| INT-HAS-005 | Recent payments section visible | Has payment history | - Transaction list visible | P1 |
| INT-HAS-006 | Late payment warning shown | After 7th | - Warning banner visible<br>- No cashback badge | P0 |

### 2.3 Home - Paid State

**File:** `app/(main)/index.tsx` with paid state

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-HPS-001 | Shows paid confirmation | Payment complete | - "Paid" status visible<br>- Green checkmark | P0 |
| INT-HPS-002 | Shows settlement status | Landlord not paid yet | - "Settling with landlord" status | P1 |
| INT-HPS-003 | Shows cashback earned | Cashback applied | - Cashback amount in summary | P1 |

---

## 3. Payment Flow Integration

### 3.1 Payment Transaction Screen

**File:** `app/(main)/payment-transaction.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PTR-001 | Renders rent breakdown | Navigate to screen | - Base rent visible<br>- Maintenance visible<br>- Total visible | P0 |
| INT-PTR-002 | Cashback toggle visible when eligible | User eligible | - Toggle visible<br>- Cashback amount shown | P0 |
| INT-PTR-003 | Toggling cashback updates total | Toggle cashback OFF | - Total increases<br>- Cashback line removed | P0 |
| INT-PTR-004 | Pay button shows correct amount | Any state | - Button shows "Pay ₹X now" | P0 |
| INT-PTR-005 | Pay button navigates to methods | Press "Pay" | - Navigates to payment methods | P0 |
| INT-PTR-006 | Countdown timer accurate | Timer running | - Hours:minutes:seconds update | P1 |
| INT-PTR-007 | Cashback locked if incomplete setup | User not qualified | - Lock icon visible<br>- "Finish setup" prompt | P0 |

### 3.2 Payment Methods Screen

**File:** `app/(main)/payment-methods.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PMT-001 | Renders all payment methods | Navigate to screen | - UPI option visible<br>- Net Banking visible<br>- Credit Card visible | P0 |
| INT-PMT-002 | UPI selected by default | Initial state | - UPI card has selected indicator | P1 |
| INT-PMT-003 | Selecting method updates UI | Tap Net Banking | - Net Banking selected<br>- UPI deselected | P0 |
| INT-PMT-004 | Continue with UPI opens UPI flow | Select UPI, press Continue | - UPI app intent triggered | P0 |
| INT-PMT-005 | Credit card shows fee warning | Select Credit Card | - "2% + GST fee" warning visible | P1 |
| INT-PMT-006 | Disabled methods grayed out | User not qualified for CC | - Credit Card grayed<br>- Not selectable | P1 |

### 3.3 Payment Processing Screen

**File:** `app/(main)/payment-processing.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PPR-001 | Shows processing animation | Mount screen | - Loading spinner visible<br>- "Processing" text | P0 |
| INT-PPR-002 | Updates status in real-time | Status changes | - Status text updates<br>- Progress indicator updates | P0 |
| INT-PPR-003 | Success navigates to success screen | Payment completes | - Navigates to payment-success | P0 |
| INT-PPR-004 | Failure shows retry option | Payment fails | - Error message visible<br>- "Try Again" button visible | P0 |
| INT-PPR-005 | Timeout after 2 minutes | No response | - Timeout message<br>- Retry option | P0 |

### 3.4 Payment Success Screen

**File:** `app/(main)/payment-success.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PSC-001 | Shows success animation | Mount screen | - Checkmark animation plays | P0 |
| INT-PSC-002 | Shows payment summary | Payment complete | - Amount paid visible<br>- Cashback earned visible | P0 |
| INT-PSC-003 | Done button returns to home | Press "Done" | - Navigates to home<br>- Home shows paid state | P0 |
| INT-PSC-004 | Share receipt option available | Payment complete | - Share button visible | P2 |

---

## 4. Verification Setup Integration

### 4.1 Bank Details Entry

**File:** Component within setup flow

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-BNK-001 | IFSC input validates format | Enter IFSC | - 11 char validation<br>- Bank name appears on valid IFSC | P0 |
| INT-BNK-002 | Account number validation | Enter account | - Numeric only<br>- Min/max length check | P0 |
| INT-BNK-003 | Confirm account must match | Enter mismatch | - Error shown<br>- Button disabled | P0 |
| INT-BNK-004 | Submit triggers penny drop | Valid details | - Loading state<br>- API called | P0 |
| INT-BNK-005 | Penny drop success updates UI | Verification passes | - Success message<br>- Step marked complete | P0 |
| INT-BNK-006 | Penny drop failure shows retry | Verification fails | - Error message<br>- Retry button | P0 |

### 4.2 Address Proof Upload

**File:** Component within setup flow

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-ADR-001 | Shows document type options | Open upload | - Utility bill option<br>- Bank statement option | P0 |
| INT-ADR-002 | Opens document picker | Tap upload | - Document picker opens | P0 |
| INT-ADR-003 | Validates file type | Select wrong type | - Error: "Only PDF supported" | P0 |
| INT-ADR-004 | Validates file size | Select large file | - Error: "Max 10MB" | P0 |
| INT-ADR-005 | Shows preview after selection | Select valid file | - Preview visible<br>- Confirm/Cancel options | P0 |
| INT-ADR-006 | Upload progress visible | Uploading | - Progress bar<br>- Percentage | P1 |
| INT-ADR-007 | Upload success updates UI | Upload complete | - Success message<br>- Step marked complete | P0 |

### 4.3 Landlord Invitation

**File:** Component within setup flow

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-LNV-001 | Email input with validation | Enter email | - Email format validation | P0 |
| INT-LNV-002 | Phone input alternative | Toggle to phone | - Phone input appears | P1 |
| INT-LNV-003 | Send invitation API call | Press "Send Invite" | - Loading state<br>- API called | P0 |
| INT-LNV-004 | Success shows pending status | Invite sent | - "Invitation Sent" message<br>- Timer shown | P0 |
| INT-LNV-005 | Resend disabled for 24h | Recently sent | - Resend button disabled<br>- Countdown shown | P0 |
| INT-LNV-006 | Landlord accepts updates UI | Webhook received | - "Landlord Confirmed" status | P0 |
| INT-LNV-007 | Landlord declines shows message | Decline event | - Decline message<br>- Support link | P1 |

---

## 5. Profile Integration

### 5.1 Profile Main Screen

**File:** `app/(main)/profile.tsx`

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PRM-001 | Renders user info | Navigate to profile | - Name visible<br>- Member since date | P0 |
| INT-PRM-002 | Payment history chart renders | Has payment history | - Bar chart visible<br>- Legend visible | P1 |
| INT-PRM-003 | Payment methods section visible | Has saved methods | - UPI/Bank/Card sections | P0 |
| INT-PRM-004 | Edit UPI navigates | Tap "Edit UPI" | - Navigates to UPI edit screen | P1 |
| INT-PRM-005 | Sign out prompts confirmation | Tap "Sign Out" | - Confirmation modal | P0 |
| INT-PRM-006 | Sign out clears session | Confirm sign out | - Session cleared<br>- Navigates to splash | P0 |
| INT-PRM-007 | Delete account shows warning | Tap "Delete Account" | - Warning modal<br>- 30-day notice | P1 |

---

## 6. Navigation Integration

### 6.1 Tab Navigation

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-NAV-001 | Tab bar visible on main screens | On home | - Home tab active<br>- Profile tab visible | P0 |
| INT-NAV-002 | Tab switching works | Tap Profile tab | - Profile screen shows<br>- Tab highlighted | P0 |
| INT-NAV-003 | Tab bar hidden during payment | On payment screen | - No tab bar visible | P1 |
| INT-NAV-004 | Deep link opens correct screen | Open `flent://payment` | - Payment screen opens | P0 |

### 6.2 Stack Navigation

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-STK-001 | Back gesture works | On nested screen | - Swipe back returns to previous | P0 |
| INT-STK-002 | Back button works | Press back | - Returns to previous screen | P0 |
| INT-STK-003 | Modal dismiss works | On modal | - Swipe down dismisses | P1 |
| INT-STK-004 | Prevented navigation on dirty form | Unsaved changes | - Warning shown before exit | P1 |

---

## 7. State Management Integration

### 7.1 Auth State

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-AUT-001 | Persisted auth redirects to home | Valid token stored | - Splash auto-navigates to home | P0 |
| INT-AUT-002 | Expired token redirects to login | Expired token | - Redirects to sign-up | P0 |
| INT-AUT-003 | Logout clears all state | Sign out | - All stores reset<br>- Secure storage cleared | P0 |
| INT-AUT-004 | Token refresh on background | Token near expiry | - New token fetched<br>- Session continues | P1 |

### 7.2 Payment State

| Test ID | Scenario | Setup | Assertions | Priority |
|---------|----------|-------|------------|----------|
| INT-PAY-001 | Payment state persists during flow | Start payment | - State maintained across screens | P0 |
| INT-PAY-002 | Payment state cleared on success | Complete payment | - State reset for next payment | P0 |
| INT-PAY-003 | Payment state cleared on cancel | Cancel payment | - State reset | P0 |
| INT-PAY-004 | Offline payment queued | Submit while offline | - Queued indicator<br>- Retry when online | P1 |

---

## Test Environment Setup

### Required Mocks

```typescript
// Navigation mock
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

// Supabase mock
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}));

// Secure Storage mock
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
```

### Test Utilities

```typescript
// Custom render with providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    initialState = {},
    ...options
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider initialState={initialState.auth}>
        <PaymentProvider initialState={initialState.payment}>
          {children}
        </PaymentProvider>
      </AuthProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
```

---

## Summary

| Category | Test Count | Priority Distribution |
|----------|------------|----------------------|
| Onboarding | 23 | P0: 18, P1: 5 |
| Home States | 17 | P0: 12, P1: 5 |
| Payment Flow | 23 | P0: 16, P1: 6, P2: 1 |
| Verification | 20 | P0: 14, P1: 5, P2: 1 |
| Profile | 7 | P0: 4, P1: 3 |
| Navigation | 8 | P0: 5, P1: 3 |
| State Management | 8 | P0: 5, P1: 3 |
| **Total** | **106** | **P0: 74, P1: 30, P2: 2** |

---

*Document generated: 2026-01-31*
*Next review: When Figma designs update*
