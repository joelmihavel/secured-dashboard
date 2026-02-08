# E2E Test Specifications
## Flent Secured - End-to-End Test Scenarios (Detox)

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document specifies end-to-end tests using Detox for React Native. E2E tests validate complete user flows from start to finish, running on actual iOS simulators and Android emulators.

**Framework: Detox**
**Target Coverage: 100% of P0 critical paths**
**Test Pyramid Position: Top 10%**

---

## Test Configuration

### Detox Config Reference

```javascript
// .detoxrc.js
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 120000 },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/FlentSecured.app',
      build: 'xcodebuild -workspace ios/FlentSecured.xcworkspace -scheme FlentSecured -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug',
    },
  },
  devices: {
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 15 Pro' } },
    emulator: { type: 'android.emulator', device: { avdName: 'Pixel_6_API_33' } },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
  },
};
```

---

## 1. Onboarding Flow (P0)

### E2E-ONB-001: Complete New User Signup

**Description:** New user completes full onboarding from splash to waitlist

**Preconditions:**
- Fresh app install (no stored session)
- Test phone number not in database
- Backend seeded with test OTP (123456 for test numbers)

**Steps:**

| Step | Action | Element | Expected Result |
|------|--------|---------|-----------------|
| 1 | Launch app | - | Splash screen visible |
| 2 | Tap "Get Started" | `splash-get-started-btn` | Carousel screen |
| 3 | Swipe through 3 slides | Carousel | Pagination updates |
| 4 | Tap "Continue" on slide 3 | `carousel-continue-btn` | Sign Up screen |
| 5 | Enter phone number | `phone-input` | Phone formatted |
| 6 | Enter name | `name-input` | Name displayed |
| 7 | Toggle consent ON | `consent-toggle` | Toggle checked |
| 8 | Tap "Get Started" | `signup-submit-btn` | OTP modal appears |
| 9 | Enter OTP 123456 | `otp-input-*` (6 inputs) | Auto-validates |
| 10 | Wait for verification | - | Loading, then navigate |
| 11 | Upload agreement | `upload-agreement-btn` | File picker opens |
| 12 | Select test PDF | Document picker | Preview shown |
| 13 | Tap "Proceed" | `proceed-btn` | Waitlist screen |
| 14 | Verify waitlist status | `waitlist-status` | Shows "Application in review" |

**Timeout:** 120 seconds

**Test Code:**
```javascript
describe('New User Onboarding', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('E2E-ONB-001: completes full signup flow', async () => {
    // Splash
    await expect(element(by.id('splash-get-started-btn'))).toBeVisible();
    await element(by.id('splash-get-started-btn')).tap();

    // Carousel
    await expect(element(by.id('carousel-screen'))).toBeVisible();
    await element(by.id('carousel-screen')).swipe('left');
    await element(by.id('carousel-screen')).swipe('left');
    await element(by.id('carousel-continue-btn')).tap();

    // Sign Up
    await expect(element(by.id('signup-screen'))).toBeVisible();
    await element(by.id('phone-input')).typeText('9876543210');
    await element(by.id('name-input')).typeText('Test User');
    await element(by.id('consent-toggle')).tap();
    await element(by.id('signup-submit-btn')).tap();

    // OTP
    await expect(element(by.id('otp-screen'))).toBeVisible();
    await element(by.id('otp-input-0')).typeText('1');
    await element(by.id('otp-input-1')).typeText('2');
    await element(by.id('otp-input-2')).typeText('3');
    await element(by.id('otp-input-3')).typeText('4');
    await element(by.id('otp-input-4')).typeText('5');
    await element(by.id('otp-input-5')).typeText('6');

    // Agreement
    await waitFor(element(by.id('agreement-upload-screen')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('upload-agreement-btn')).tap();
    // Note: File picker interaction may need native module mock

    // Waitlist
    await waitFor(element(by.id('waitlist-screen')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.text('Application in review'))).toBeVisible();
  });
});
```

---

### E2E-ONB-002: Skip Carousel Flow

**Description:** User skips carousel and goes directly to signup

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app | Splash visible |
| 2 | Tap "Get Started" | Carousel screen |
| 3 | Tap "Skip" | Sign Up screen directly |

**Test Code:**
```javascript
it('E2E-ONB-002: skips carousel', async () => {
  await device.launchApp({ newInstance: true });
  await element(by.id('splash-get-started-btn')).tap();
  await expect(element(by.id('carousel-screen'))).toBeVisible();
  await element(by.id('carousel-skip-btn')).tap();
  await expect(element(by.id('signup-screen'))).toBeVisible();
});
```

---

### E2E-ONB-003: Returning User Login

**Description:** Existing user logs in with OTP

**Preconditions:**
- Phone number exists in database
- No active session

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app | Splash screen |
| 2 | Tap "Log in" | Sign Up (login mode) |
| 3 | Enter existing phone | Phone input filled |
| 4 | Tap "Continue" | OTP screen |
| 5 | Enter valid OTP | Home screen (not onboarding) |

---

### E2E-ONB-004: OTP Error Handling

**Description:** Wrong OTP shows error, retry works

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-4 | Complete to OTP screen | OTP input visible |
| 5 | Enter wrong OTP (000000) | "Wrong Code" error |
| 6 | Clear and enter correct OTP | Proceeds normally |

**Test Code:**
```javascript
it('E2E-ONB-004: handles wrong OTP', async () => {
  // ... navigate to OTP screen

  // Enter wrong OTP
  for (let i = 0; i < 6; i++) {
    await element(by.id(`otp-input-${i}`)).typeText('0');
  }

  await waitFor(element(by.text('Wrong Code')))
    .toBeVisible()
    .withTimeout(5000);

  // Clear and retry
  for (let i = 5; i >= 0; i--) {
    await element(by.id(`otp-input-${i}`)).clearText();
  }

  // Enter correct OTP
  const correctOtp = '123456';
  for (let i = 0; i < 6; i++) {
    await element(by.id(`otp-input-${i}`)).typeText(correctOtp[i]);
  }

  // Should proceed
  await waitFor(element(by.id('agreement-upload-screen')))
    .toBeVisible()
    .withTimeout(10000);
});
```

---

## 2. Payment Flow - UPI (P0)

### E2E-PAY-001: Complete UPI Payment

**Description:** User completes rent payment via UPI

**Preconditions:**
- User logged in with "qualified" status
- Rent due this month
- Mock UPI app response configured

**Steps:**

| Step | Action | Element | Expected Result |
|------|--------|---------|-----------------|
| 1 | From Home, tap "Review" | `home-review-btn` | Payment Transaction |
| 2 | Verify rent breakdown | `rent-breakdown` | Base + Maintenance = Total |
| 3 | Verify cashback visible | `cashback-badge` | Cashback amount shown |
| 4 | Tap "Pay ₹X now" | `pay-now-btn` | Payment Methods screen |
| 5 | UPI selected by default | `upi-method` | Highlighted |
| 6 | Tap "Continue" | `continue-btn` | UPI app opens (mocked) |
| 7 | Mock UPI success callback | - | Processing screen |
| 8 | Wait for success | - | Payment Success screen |
| 9 | Tap "Done" | `done-btn` | Home with Paid state |

**Test Code:**
```javascript
describe('UPI Payment Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      userDefaults: { loggedInUser: 'test_qualified_user' }
    });
  });

  it('E2E-PAY-001: completes UPI payment', async () => {
    // Home with rent due
    await expect(element(by.id('home-review-btn'))).toBeVisible();
    await element(by.id('home-review-btn')).tap();

    // Payment Transaction
    await expect(element(by.id('rent-breakdown'))).toBeVisible();
    await expect(element(by.id('cashback-badge'))).toBeVisible();
    await element(by.id('pay-now-btn')).tap();

    // Payment Methods
    await expect(element(by.id('upi-method'))).toBeVisible();
    await expect(element(by.id('upi-method'))).toHaveToggleValue(true);
    await element(by.id('continue-btn')).tap();

    // Mock UPI completion (handled by test server)
    await device.sendUserNotification({
      trigger: { type: 'push' },
      payload: { type: 'payment_success', amount: 32500 }
    });

    // Success
    await waitFor(element(by.id('payment-success-screen')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('done-btn')).tap();

    // Home - Paid state
    await expect(element(by.id('home-paid-status'))).toBeVisible();
  });
});
```

---

### E2E-PAY-002: Payment with Cashback Toggle Off

**Description:** User pays full rent without cashback

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-3 | Navigate to Payment Transaction | Cashback visible |
| 4 | Toggle cashback OFF | Total increases, cashback hidden |
| 5 | Complete payment | Full amount paid |

---

### E2E-PAY-003: Payment Failure and Retry

**Description:** Handle payment failure and successful retry

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-6 | Start payment flow | Processing screen |
| 7 | Mock payment failure | Error message shown |
| 8 | Tap "Try Again" | Payment Methods screen |
| 9 | Complete payment | Success |

---

## 3. Payment Flow - Net Banking (P0)

### E2E-PAY-004: Complete Net Banking Payment

**Description:** User pays via net banking

**Preconditions:**
- User logged in
- Rent due

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-4 | Navigate to Payment Methods | Methods visible |
| 5 | Tap "Net Banking" | Net Banking selected |
| 6 | Tap "Continue" | Bank selection screen |
| 7 | Select bank (e.g., HDFC) | Bank highlighted |
| 8 | Tap "Continue" | WebView opens (bank) |
| 9 | Mock successful bank auth | Processing screen |
| 10 | Wait for success | Payment Success |

---

## 4. Verification Setup (P0)

### E2E-VER-001: Complete All Verification Steps

**Description:** User completes bank, address, and landlord setup

**Preconditions:**
- New user with zero state home
- Test IFSC returns valid bank

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From Home, tap "Finish Setup" | Setup sheet opens |
| 2 | Tap "Add landlord's bank" | Bank entry form |
| 3 | Enter IFSC "HDFC0001234" | Bank name appears |
| 4 | Enter account "1234567890" | Input accepted |
| 5 | Confirm account number | Match validated |
| 6 | Tap "Verify" | Penny drop processing |
| 7 | Wait for verification | Success, step checked |
| 8 | Tap "Upload address proof" | Upload screen |
| 9 | Upload test document | Preview shown |
| 10 | Confirm upload | Success, step checked |
| 11 | Tap "Invite landlord" | Invite form |
| 12 | Enter landlord email | Email validated |
| 13 | Tap "Send Invite" | Invitation sent |
| 14 | Verify all steps complete | Home active state |

**Test Code:**
```javascript
describe('Verification Setup', () => {
  it('E2E-VER-001: completes all verification steps', async () => {
    // Start from zero state home
    await expect(element(by.id('finish-setup-btn'))).toBeVisible();
    await element(by.id('finish-setup-btn')).tap();

    // Bank verification
    await element(by.id('add-bank-step')).tap();
    await element(by.id('ifsc-input')).typeText('HDFC0001234');
    await waitFor(element(by.id('bank-name-display')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('account-input')).typeText('1234567890');
    await element(by.id('confirm-account-input')).typeText('1234567890');
    await element(by.id('verify-bank-btn')).tap();
    await waitFor(element(by.id('bank-verified-check')))
      .toBeVisible()
      .withTimeout(15000);

    // Address proof
    await element(by.id('upload-address-step')).tap();
    await element(by.id('upload-document-btn')).tap();
    // Mock document selection
    await element(by.id('confirm-upload-btn')).tap();
    await waitFor(element(by.id('address-verified-check')))
      .toBeVisible()
      .withTimeout(10000);

    // Landlord invite
    await element(by.id('invite-landlord-step')).tap();
    await element(by.id('landlord-email-input')).typeText('landlord@test.com');
    await element(by.id('send-invite-btn')).tap();
    await waitFor(element(by.id('invite-sent-status')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify home updated
    await element(by.id('close-setup-sheet')).tap();
    await expect(element(by.id('home-active-state'))).toBeVisible();
  });
});
```

---

### E2E-VER-002: Bank Verification Failure Retry

**Description:** Handle failed penny drop and retry

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-5 | Enter bank details | Form filled |
| 6 | Submit (API returns failure) | Error message |
| 7 | Correct account number | Input updated |
| 8 | Retry verification | Success |

---

## 5. Profile Management (P1)

### E2E-PRF-001: View and Sign Out

**Description:** Navigate to profile and sign out

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap profile avatar | Profile screen |
| 2 | Verify user info | Name, member date visible |
| 3 | Scroll to Sign Out | Sign Out button visible |
| 4 | Tap "Sign Out" | Confirmation modal |
| 5 | Confirm sign out | Returns to Splash |

---

### E2E-PRF-002: Edit Payment Method

**Description:** Update saved UPI ID

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Profile | Profile screen |
| 2 | Tap "Edit UPI Method" | UPI edit screen |
| 3 | Enter new UPI ID | Input updated |
| 4 | Save changes | Success toast |
| 5 | Verify update persisted | New UPI shown |

---

## 6. Deep Links (P1)

### E2E-DPL-001: Payment Deep Link

**Description:** Open app via payment deep link

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open URL `flent://payment` | App launches |
| 2 | If logged in | Payment Transaction screen |
| 3 | If not logged in | Login, then Payment |

**Test Code:**
```javascript
describe('Deep Links', () => {
  it('E2E-DPL-001: opens payment from deep link', async () => {
    await device.launchApp({
      url: 'flent://payment',
      newInstance: true,
      userDefaults: { loggedInUser: 'test_qualified_user' }
    });

    await waitFor(element(by.id('payment-transaction-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

---

### E2E-DPL-002: Landlord Accept Deep Link

**Description:** Landlord opens acceptance link

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open URL `flent://invite/accept?token=xxx` | App launches |
| 2 | Verify token | Acceptance screen |
| 3 | Tap "Confirm" | Success message |

---

## 7. Push Notifications (P1)

### E2E-PSH-001: Payment Due Notification

**Description:** Tap notification opens payment screen

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send push notification (payment_due) | Notification appears |
| 2 | Tap notification | App opens |
| 3 | Verify screen | Payment Transaction |

**Test Code:**
```javascript
it('E2E-PSH-001: opens payment from notification', async () => {
  await device.launchApp({ newInstance: true });

  await device.sendUserNotification({
    trigger: { type: 'push' },
    payload: {
      type: 'payment_due',
      tenancyId: 'test-tenancy-123'
    }
  });

  await waitFor(element(by.id('payment-transaction-screen')))
    .toBeVisible()
    .withTimeout(5000);
});
```

---

## 8. Offline Behavior (P1)

### E2E-OFF-001: Home Loads with Cached Data

**Description:** App shows cached data when offline

**Preconditions:**
- User previously logged in (data cached)
- Device offline

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable network | Offline mode |
| 2 | Launch app | Splash loads |
| 3 | Navigate to Home | Cached home data shown |
| 4 | Offline indicator visible | Banner or icon |
| 5 | Enable network | Data refreshes |

**Test Code:**
```javascript
it('E2E-OFF-001: shows cached data offline', async () => {
  // First, seed cache with online session
  await device.launchApp({ newInstance: true });
  // ... login and load data
  await device.terminateApp();

  // Now go offline and relaunch
  await device.setNetworkCondition({ offline: true });
  await device.launchApp({ newInstance: false });

  await expect(element(by.id('home-screen'))).toBeVisible();
  await expect(element(by.id('offline-indicator'))).toBeVisible();

  // Re-enable network
  await device.setNetworkCondition({ offline: false });
  await waitFor(element(by.id('offline-indicator')))
    .not.toBeVisible()
    .withTimeout(5000);
});
```

---

## 9. Error Recovery (P0)

### E2E-ERR-001: Session Expired Mid-Flow

**Description:** Handle session expiry during payment

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1-4 | Start payment flow | Payment Methods |
| 5 | Server invalidates session | 401 response |
| 6 | App detects expiry | Login prompt |
| 7 | Re-authenticate | Resume at payment |

---

### E2E-ERR-002: Network Error Recovery

**Description:** Retry after network error

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start any API action | Loading state |
| 2 | Network fails | Error message |
| 3 | Tap "Retry" | Re-attempts action |
| 4 | Network restored | Success |

---

## 10. Smoke Test Suite (CI Gate)

### E2E-SMK-001: Critical Path Smoke

**Description:** Fast smoke test covering critical paths

**Timeout:** 5 minutes max

**Test Code:**
```javascript
describe('Smoke Tests', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('E2E-SMK-001: app launches and shows splash', async () => {
    await expect(element(by.id('splash-screen'))).toBeVisible();
  });

  it('E2E-SMK-002: navigation works', async () => {
    await element(by.id('splash-get-started-btn')).tap();
    await expect(element(by.id('carousel-screen'))).toBeVisible();
  });

  it('E2E-SMK-003: form inputs work', async () => {
    await element(by.id('carousel-skip-btn')).tap();
    await element(by.id('phone-input')).typeText('9876543210');
    await expect(element(by.id('phone-input'))).toHaveText('98765 43210');
  });
});
```

---

## Test Data Requirements

### Test Users

| ID | Phone | Status | Purpose |
|----|-------|--------|---------|
| test_new | +91 9999900001 | None | Fresh signup tests |
| test_waitlisted | +91 9999900002 | waitlisted | Waitlist tests |
| test_qualified | +91 9999900003 | qualified | Payment tests |
| test_complete | +91 9999900004 | complete | Full feature tests |
| test_overdue | +91 9999900005 | overdue | Late payment tests |

### Test OTP

All test phone numbers accept OTP: `123456`

### Test Bank Details

| IFSC | Bank Name | Account |
|------|-----------|---------|
| HDFC0001234 | HDFC Bank | 1234567890 |
| SBIN0001234 | State Bank | 9876543210 |
| TEST0000001 | Test Bank (always fails) | * |

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: E2E Tests

on:
  pull_request:
    paths: ['rn-app/**']

jobs:
  e2e-ios:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - name: Setup
        run: |
          brew tap wix/brew
          brew install applesimutils
          cd rn-app && npm ci
      - name: Build
        run: cd rn-app && npx detox build --configuration ios.sim.debug
      - name: Test
        run: cd rn-app && npx detox test --configuration ios.sim.debug --headless
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-artifacts
          path: rn-app/artifacts/
```

---

## Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| Onboarding | 4 | P0 |
| Payment - UPI | 3 | P0 |
| Payment - Net Banking | 1 | P0 |
| Verification | 2 | P0 |
| Profile | 2 | P1 |
| Deep Links | 2 | P1 |
| Push Notifications | 1 | P1 |
| Offline | 1 | P1 |
| Error Recovery | 2 | P0 |
| Smoke | 3 | P0 |
| **Total** | **21** | **P0: 15, P1: 6** |

---

*Document generated: 2026-01-31*
*Next review: When Figma designs update*
