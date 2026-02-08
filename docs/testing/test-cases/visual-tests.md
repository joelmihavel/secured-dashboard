# Visual Regression Test Specifications
## Flent Secured - Sauce Labs Visual Testing

<!-- FIGMA_STATUS: IN_PROGRESS -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: true -->

---

## Overview

This document specifies visual regression tests using Sauce Labs Visual Testing. These tests capture screenshots of app screens and compare them against Figma baselines to ensure pixel-perfect implementation.

**Platform: Sauce Labs Virtual Device Cloud (VDC)**
**Framework: WebdriverIO + Sauce Visual**
**Baseline Source: Figma screenshots (97 screens)**

---

## Test Infrastructure

### Existing Setup

Location: `tests/visual/`

```
tests/visual/
├── specs/
│   ├── onboarding/
│   │   └── splash.spec.ts
│   ├── payment/
│   │   └── transaction.spec.ts
│   └── profile/
│       └── main.spec.ts
├── wdio.conf.ts
├── package.json
└── fixtures/
    └── figma-baselines/
```

### Configuration Reference

```typescript
// wdio.conf.ts
export const config: WebdriverIO.Config = {
  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  region: 'us',

  specs: ['./specs/**/*.spec.ts'],

  capabilities: [
    {
      platformName: 'iOS',
      'appium:deviceName': 'iPhone 15 Pro Simulator',
      'appium:platformVersion': '17.0',
      'appium:app': 'storage:filename=FlentSecured.app.zip',
      'sauce:options': {
        name: 'Visual Regression - iOS',
        build: process.env.BUILD_ID,
      },
    },
    {
      platformName: 'Android',
      'appium:deviceName': 'Google Pixel 7',
      'appium:platformVersion': '14',
      'appium:app': 'storage:filename=FlentSecured.apk',
      'sauce:options': {
        name: 'Visual Regression - Android',
        build: process.env.BUILD_ID,
      },
    },
  ],

  services: [
    ['sauce', {
      sauceConnect: false,
    }],
    ['visual', {
      apiKey: process.env.SAUCE_VISUAL_API_KEY,
      projectName: 'Flent Secured',
      branch: process.env.GITHUB_REF_NAME || 'main',
    }],
  ],
};
```

---

## 1. Onboarding Screens

### VIS-ONB-001: Splash Screen

**Figma Node:** `1-28055`
**Screen States:** 1

| Test ID | State | Setup | Capture | Diff Threshold |
|---------|-------|-------|---------|----------------|
| VIS-ONB-001-A | Default | Launch app | Full screen | 0.1% |

**Test Code:**
```typescript
describe('Splash Screen Visual', () => {
  it('VIS-ONB-001-A: matches Figma baseline', async () => {
    await driver.pause(1000); // Wait for animations

    await browser.sauceVisualCheck('splash-default', {
      diffingMethod: 'balanced',
      regions: [
        { element: $('~splash-screen'), enableOnly: true },
      ],
    });
  });
});
```

---

### VIS-ONB-002: Carousel Slides

**Figma Nodes:** `1-28071`, `TBD`, `TBD`
**Screen States:** 3 slides

| Test ID | State | Figma Node | Diff Threshold |
|---------|-------|------------|----------------|
| VIS-ONB-002-A | Slide 1 | 1-28071 | 0.1% |
| VIS-ONB-002-B | Slide 2 | TBD | 0.1% |
| VIS-ONB-002-C | Slide 3 | TBD | 0.1% |

**Test Code:**
```typescript
describe('Carousel Visual', () => {
  beforeEach(async () => {
    await $('~splash-get-started-btn').click();
    await driver.pause(500);
  });

  it('VIS-ONB-002-A: slide 1 matches baseline', async () => {
    await browser.sauceVisualCheck('carousel-slide-1');
  });

  it('VIS-ONB-002-B: slide 2 matches baseline', async () => {
    await $('~carousel-screen').touchAction([
      { action: 'press', x: 300, y: 400 },
      { action: 'moveTo', x: 50, y: 400 },
      { action: 'release' },
    ]);
    await driver.pause(300);
    await browser.sauceVisualCheck('carousel-slide-2');
  });

  it('VIS-ONB-002-C: slide 3 matches baseline', async () => {
    // Swipe to slide 3
    for (let i = 0; i < 2; i++) {
      await $('~carousel-screen').touchAction([
        { action: 'press', x: 300, y: 400 },
        { action: 'moveTo', x: 50, y: 400 },
        { action: 'release' },
      ]);
      await driver.pause(300);
    }
    await browser.sauceVisualCheck('carousel-slide-3');
  });
});
```

---

### VIS-ONB-003: Sign Up Screen States

**Figma Nodes:** `1-29108`, `1-31073`, `1-31590`
**Screen States:** 4

| Test ID | State | Description | Figma Node |
|---------|-------|-------------|------------|
| VIS-ONB-003-A | Empty | No input | 1-29108 |
| VIS-ONB-003-B | Partial | Phone filled, no name | - |
| VIS-ONB-003-C | Filled | All fields, consent OFF | 1-31073 |
| VIS-ONB-003-D | Ready | All fields, consent ON | 1-31590 |
| VIS-ONB-003-E | Error | Validation error shown | - |

**Test Code:**
```typescript
describe('Sign Up Visual', () => {
  beforeEach(async () => {
    // Navigate to sign up
    await $('~splash-get-started-btn').click();
    await $('~carousel-skip-btn').click();
  });

  it('VIS-ONB-003-A: empty state', async () => {
    await browser.sauceVisualCheck('signup-empty');
  });

  it('VIS-ONB-003-C: filled state', async () => {
    await $('~phone-input').setValue('9876543210');
    await $('~name-input').setValue('Test User');
    await browser.sauceVisualCheck('signup-filled');
  });

  it('VIS-ONB-003-D: ready state with consent', async () => {
    await $('~phone-input').setValue('9876543210');
    await $('~name-input').setValue('Test User');
    await $('~consent-toggle').click();
    await browser.sauceVisualCheck('signup-ready');
  });

  it('VIS-ONB-003-E: error state', async () => {
    await $('~phone-input').setValue('123'); // Invalid
    await $('~name-input').click(); // Trigger validation
    await browser.sauceVisualCheck('signup-error');
  });
});
```

---

### VIS-ONB-004: OTP Screen States

**Figma Node:** `1-29025`
**Screen States:** 4

| Test ID | State | Description |
|---------|-------|-------------|
| VIS-ONB-004-A | Empty | No digits entered |
| VIS-ONB-004-B | Partial | 3 digits entered |
| VIS-ONB-004-C | Complete | All 6 digits, before verify |
| VIS-ONB-004-D | Error | Wrong code message |
| VIS-ONB-004-E | Resend Available | Timer expired |

---

## 2. Home Screen States

### VIS-HOME-001: Zero State Variants

**Figma Node:** `243-6731`
**Screen States:** 9

| Test ID | Variant | Setup |
|---------|---------|-------|
| VIS-HOME-001-A | Zero - No verifications | New user |
| VIS-HOME-001-B | Zero + Bank verified | 1/3 complete |
| VIS-HOME-001-C | Zero + Address verified | 1/3 complete |
| VIS-HOME-001-D | Zero + Bank + Address | 2/3 complete |
| VIS-HOME-001-E | Zero + Invite pending | Landlord not responded |
| VIS-HOME-001-F | Zero + Invite declined | Landlord declined |
| VIS-HOME-001-G | Zero + Cashback locked | Shows potential |
| VIS-HOME-001-H | Zero + Cashback unlockable | Within deadline |
| VIS-HOME-001-I | Zero + Deadline passed | No cashback possible |

**Test Code:**
```typescript
describe('Home Zero States Visual', () => {
  it('VIS-HOME-001-A: zero state no verifications', async () => {
    await setUserState({ status: 'new', verifications: [] });
    await browser.sauceVisualCheck('home-zero-no-verify');
  });

  it('VIS-HOME-001-B: zero state bank verified', async () => {
    await setUserState({
      status: 'new',
      verifications: ['bank']
    });
    await browser.sauceVisualCheck('home-zero-bank-verified');
  });

  // ... other variants
});
```

---

### VIS-HOME-002: Active State Variants

**Figma Nodes:** `243-5870`, `243-5933`
**Screen States:** 6

| Test ID | Variant | Figma Node |
|---------|---------|------------|
| VIS-HOME-002-A | Active Qualified | 243-5870 |
| VIS-HOME-002-B | Active Complete | 243-5933 |
| VIS-HOME-002-C | Active + Cashback Available | - |
| VIS-HOME-002-D | Active + Late (after 7th) | - |
| VIS-HOME-002-E | Active + Overdue (30+ days) | - |
| VIS-HOME-002-F | Active + Multiple Missed | - |

---

### VIS-HOME-003: Paid State

**Figma Node:** `243-4258`
**Screen States:** 3

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-HOME-003-A | Paid - Settling | Landlord payment pending |
| VIS-HOME-003-B | Paid - Complete | All settled |
| VIS-HOME-003-C | Paid + Cashback | Cashback applied |

---

## 3. Payment Flow Screens

### VIS-PAY-001: Payment Transaction Screen

**Figma Node:** `41-9681`
**Screen States:** 5

| Test ID | Variant | Setup |
|---------|---------|-------|
| VIS-PAY-001-A | Default breakdown | Standard rent |
| VIS-PAY-001-B | With cashback | Eligible user |
| VIS-PAY-001-C | Cashback locked | Not qualified |
| VIS-PAY-001-D | Cashback toggle OFF | User disabled |
| VIS-PAY-001-E | Countdown timer | Before deadline |

**Test Code:**
```typescript
describe('Payment Transaction Visual', () => {
  beforeEach(async () => {
    await setUserState({ status: 'qualified' });
    await navigateToPaymentTransaction();
  });

  it('VIS-PAY-001-A: default breakdown', async () => {
    await browser.sauceVisualCheck('payment-transaction-default');
  });

  it('VIS-PAY-001-B: with cashback', async () => {
    await setUserState({
      status: 'qualified',
      cashbackEligible: true,
      cashbackAmount: 325
    });
    await browser.refresh();
    await browser.sauceVisualCheck('payment-transaction-cashback');
  });

  it('VIS-PAY-001-D: cashback toggle off', async () => {
    await $('~cashback-toggle').click();
    await browser.sauceVisualCheck('payment-transaction-no-cashback');
  });
});
```

---

### VIS-PAY-002: Payment Methods Screen

**Figma Node:** `243-3923`
**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-PAY-002-A | UPI Selected | Default selection |
| VIS-PAY-002-B | Net Banking Selected | - |
| VIS-PAY-002-C | Credit Card Selected | With fee warning |
| VIS-PAY-002-D | Credit Card Disabled | Not qualified |

---

### VIS-PAY-003: Processing States

**Figma Nodes:** `243-4062`, Various
**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-PAY-003-A | Processing | Loading animation |
| VIS-PAY-003-B | Success | Green checkmark |
| VIS-PAY-003-C | Failure | Error message |
| VIS-PAY-003-D | Timeout | Retry prompt |

---

### VIS-PAY-004: Payment Success Screen

**Figma Node:** `243-4258`
**Screen States:** 2

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-PAY-004-A | Success with cashback | Shows cashback earned |
| VIS-PAY-004-B | Success without cashback | Full amount |

---

## 4. Verification Screens

### VIS-VER-001: Bank Entry Screen

**Figma Node:** TBD
**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-VER-001-A | Empty form | Initial state |
| VIS-VER-001-B | IFSC entered | Bank name shown |
| VIS-VER-001-C | All filled | Ready to verify |
| VIS-VER-001-D | Verification failed | Error state |

---

### VIS-VER-002: Address Proof Upload

**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-VER-002-A | Upload prompt | Initial |
| VIS-VER-002-B | Document selected | Preview |
| VIS-VER-002-C | Uploading | Progress bar |
| VIS-VER-002-D | Upload complete | Success |

---

### VIS-VER-003: Landlord Invitation

**Screen States:** 5

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-VER-003-A | Email entry | Initial form |
| VIS-VER-003-B | Sending | Loading state |
| VIS-VER-003-C | Sent pending | Waiting for response |
| VIS-VER-003-D | Resend available | After 24h |
| VIS-VER-003-E | Accepted | Landlord confirmed |

---

## 5. Profile Screens

### VIS-PRF-001: Profile Main

**Figma Node:** `41-8760`
**Screen States:** 2

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-PRF-001-A | With payment history | Chart visible |
| VIS-PRF-001-B | No payment history | Empty state |

---

### VIS-PRF-002: Payment History Chart

**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-PRF-002-A | All on time | Green bars |
| VIS-PRF-002-B | Mixed history | Multi-color |
| VIS-PRF-002-C | Late payments | Orange bars |
| VIS-PRF-002-D | Missed payments | Red bars |

---

## 6. Waitlist Screen

### VIS-WAIT-001: Waitlist Status

**Figma Node:** `41-11206`
**Screen States:** 4

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-WAIT-001-A | Application in review | Initial state |
| VIS-WAIT-001-B | With referral input | Input visible |
| VIS-WAIT-001-C | Member count display | Shows position |
| VIS-WAIT-001-D | Approved | Ready to proceed |

---

## 7. Error States

### VIS-ERR-001: Common Error States

**Screen States:** 5

| Test ID | Variant | Description |
|---------|---------|-------------|
| VIS-ERR-001-A | Network error | No connection |
| VIS-ERR-001-B | Server error | 500 response |
| VIS-ERR-001-C | Session expired | Auth error |
| VIS-ERR-001-D | Not found | 404 screen |
| VIS-ERR-001-E | Rate limited | Too many requests |

---

## Device Matrix

### iOS Devices

| Device | Resolution | Priority |
|--------|------------|----------|
| iPhone 15 Pro | 393 x 852 | P0 |
| iPhone 15 Pro Max | 430 x 932 | P1 |
| iPhone SE (3rd) | 375 x 667 | P1 |
| iPad Pro 11" | 834 x 1194 | P2 |

### Android Devices

| Device | Resolution | Priority |
|--------|------------|----------|
| Pixel 7 | 412 x 915 | P0 |
| Pixel 7 Pro | 412 x 892 | P1 |
| Samsung S23 | 360 x 780 | P1 |
| Samsung S23 Ultra | 384 x 824 | P1 |

---

## Diff Thresholds

| Screen Type | Threshold | Rationale |
|-------------|-----------|-----------|
| Static screens | 0.1% | Tight match |
| Animated screens | 0.5% | Animation variance |
| Charts/graphs | 1.0% | Data-dependent |
| Input states | 0.3% | Cursor variance |

---

## Baseline Management

### Updating Baselines

```bash
# Capture new baselines after Figma update
npm run visual:baseline --update

# Review diffs before accepting
npm run visual:review

# Accept specific changes
npm run visual:accept --screens=splash,carousel
```

### Figma Sync Workflow

1. Figma design updated
2. Change detection script runs
3. Affected screens flagged
4. New baselines captured
5. PR created with baseline updates
6. Review and merge

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Visual Regression

on:
  pull_request:
    paths: ['rn-app/src/**', 'rn-app/app/**']

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd tests/visual && npm ci
      - run: cd tests/visual && npm test
        env:
          SAUCE_USERNAME: ${{ secrets.SAUCE_USERNAME }}
          SAUCE_ACCESS_KEY: ${{ secrets.SAUCE_ACCESS_KEY }}
          SAUCE_VISUAL_API_KEY: ${{ secrets.SAUCE_VISUAL_API_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: visual-diffs
          path: tests/visual/diffs/
```

---

## Summary

| Category | Screen Count | States | Priority |
|----------|-------------|--------|----------|
| Onboarding | 4 | 16 | P0 |
| Home | 3 | 18 | P0 |
| Payment | 4 | 15 | P0 |
| Verification | 3 | 13 | P1 |
| Profile | 2 | 6 | P1 |
| Waitlist | 1 | 4 | P2 |
| Errors | 1 | 5 | P1 |
| **Total** | **18** | **77** | - |

**Total Visual Test Cases: 77 across 18 screen groups**

---

*Document generated: 2026-01-31*
*Next review: When Figma designs update*
