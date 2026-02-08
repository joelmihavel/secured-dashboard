# Manual Testing Runbook
## Flent Secured - Step-by-Step Testing Procedures

<!-- FIGMA_STATUS: N/A -->
<!-- LAST_VERIFIED: 2026-01-31 -->
<!-- AUTO_UPDATE: false -->

---

## Overview

This runbook provides step-by-step procedures for manual testing of the Flent Secured app. Use this guide for exploratory testing, regression testing, and validating new features before release.

---

## Pre-Testing Setup

### Test Environment

| Environment | Purpose | API URL |
|-------------|---------|---------|
| Development | Feature development | dev.api.flentsecured.com |
| Staging | Pre-release testing | staging.api.flentsecured.com |
| Production | Live app | api.flentsecured.com |

### Test Accounts

| Account Type | Phone | OTP | Status |
|--------------|-------|-----|--------|
| New User | +91 9999900001 | 123456 | None |
| Waitlisted | +91 9999900002 | 123456 | waitlisted |
| Qualified | +91 9999900003 | 123456 | qualified |
| Complete | +91 9999900004 | 123456 | complete |
| Overdue | +91 9999900005 | 123456 | overdue |

### Device Requirements

**Minimum:**
- iOS: iPhone with iOS 15+
- Android: Phone with Android 10+

**Recommended:**
- iPhone 13/14/15 Pro
- Pixel 5/6/7
- iPad Pro (for tablet testing)

---

## Test Procedures

### TP-001: New User Onboarding

**Objective:** Verify complete new user signup flow

**Preconditions:**
- Fresh app install or logged out state
- Use test phone: +91 9999900001

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Launch app | Splash screen appears with logo, "Get Started" and "Log in" buttons | [ ] |
| 2 | Tap "Get Started" | Carousel screen appears with first slide | [ ] |
| 3 | Swipe left | Second slide appears | [ ] |
| 4 | Swipe left | Third slide appears with "Continue" button | [ ] |
| 5 | Tap "Continue" | Sign up screen appears | [ ] |
| 6 | Enter phone: 9999900001 | Phone formats to "99999 00001" | [ ] |
| 7 | Enter name: Test User | Name displays correctly | [ ] |
| 8 | Toggle consent ON | Toggle turns on, button enables | [ ] |
| 9 | Tap "Get Started" | Loading, then OTP screen appears | [ ] |
| 10 | Enter OTP: 123456 | Auto-submits on 6th digit | [ ] |
| 11 | Wait for verification | Agreement upload screen appears | [ ] |
| 12 | Tap "Upload Agreement" | Document picker opens | [ ] |
| 13 | Select PDF file | Preview shows | [ ] |
| 14 | Tap "Proceed" | Waitlist screen appears | [ ] |
| 15 | Verify status | "Application in review" message | [ ] |

**Post-Conditions:**
- User session persists on app restart
- User data visible in admin panel

---

### TP-002: Returning User Login

**Objective:** Verify existing user can log in

**Preconditions:**
- Use test phone: +91 9999900003 (qualified user)

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Launch app | Splash screen | [ ] |
| 2 | Tap "Log in" | Sign up screen in login mode | [ ] |
| 3 | Enter phone: 9999900003 | Phone accepted | [ ] |
| 4 | Tap "Continue" | OTP screen | [ ] |
| 5 | Enter OTP: 123456 | Verification starts | [ ] |
| 6 | Wait | Home screen appears (not onboarding) | [ ] |

---

### TP-003: UPI Payment Flow

**Objective:** Complete rent payment via UPI

**Preconditions:**
- Logged in as qualified user
- Rent due this month

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | From Home, tap "Review" | Payment Transaction screen | [ ] |
| 2 | Verify breakdown | Base rent + Maintenance = Total | [ ] |
| 3 | Verify cashback shown | Cashback amount displayed if eligible | [ ] |
| 4 | Tap "Pay ₹X now" | Payment Methods screen | [ ] |
| 5 | Verify UPI selected | UPI card highlighted | [ ] |
| 6 | Tap "Continue" | UPI app prompt or redirect | [ ] |
| 7 | Complete in UPI app | Return to app | [ ] |
| 8 | Wait for processing | Success screen | [ ] |
| 9 | Tap "Done" | Home with Paid status | [ ] |

---

### TP-004: Verification Setup

**Objective:** Complete all verification steps

**Preconditions:**
- Logged in as new user with zero state

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | From Home, tap "Finish Setup" | Setup sheet opens | [ ] |
| 2 | Tap "Add landlord's bank" | Bank entry form | [ ] |
| 3 | Enter IFSC: HDFC0001234 | Bank name appears: HDFC Bank | [ ] |
| 4 | Enter account: 1234567890 | Accepted | [ ] |
| 5 | Confirm account | Matches | [ ] |
| 6 | Tap "Verify" | Loading, then success | [ ] |
| 7 | Tap "Upload address proof" | Upload screen | [ ] |
| 8 | Select document | Preview shows | [ ] |
| 9 | Confirm | Upload success | [ ] |
| 10 | Tap "Invite landlord" | Invite form | [ ] |
| 11 | Enter email | Validated | [ ] |
| 12 | Tap "Send Invite" | Success, pending status | [ ] |
| 13 | Close sheet | All steps checked | [ ] |

---

### TP-005: Cashback Toggle

**Objective:** Verify cashback can be toggled

**Preconditions:**
- Qualified user with cashback eligible

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Payment Transaction | Cashback shown | [ ] |
| 2 | Note total with cashback | E.g., ₹32,175 | [ ] |
| 3 | Toggle cashback OFF | Total increases to full rent | [ ] |
| 4 | Note new total | E.g., ₹32,500 | [ ] |
| 5 | Toggle cashback ON | Total decreases back | [ ] |

---

### TP-006: OTP Error Handling

**Objective:** Verify wrong OTP handling

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to OTP screen | OTP input visible | [ ] |
| 2 | Enter wrong OTP: 000000 | "Wrong Code" message | [ ] |
| 3 | Verify inputs cleared | Empty, ready for retry | [ ] |
| 4 | Enter wrong OTP again | "Wrong Code" again | [ ] |
| 5 | Third wrong attempt | "Too many attempts" lockout | [ ] |
| 6 | Wait 15 minutes | Lockout expires | [ ] |

---

### TP-007: Network Error Handling

**Objective:** Verify app handles network errors gracefully

**Preconditions:**
- Device airplane mode toggle ready

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enable airplane mode | Network disconnected | [ ] |
| 2 | Attempt to load Home | Error message or cached data | [ ] |
| 3 | Disable airplane mode | Network restored | [ ] |
| 4 | Pull to refresh | Data loads | [ ] |
| 5 | Start payment, enable airplane | Error message with retry | [ ] |
| 6 | Tap retry | Retries when online | [ ] |

---

### TP-008: Profile and Logout

**Objective:** Verify profile access and logout

**Steps:**

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Tap profile avatar | Profile screen | [ ] |
| 2 | Verify user info | Name, member date visible | [ ] |
| 3 | Scroll down | All sections visible | [ ] |
| 4 | Tap "Sign Out" | Confirmation modal | [ ] |
| 5 | Confirm | Returns to Splash | [ ] |
| 6 | Restart app | Still on Splash (logged out) | [ ] |

---

## Exploratory Testing Areas

### Touch & Gesture Testing

| Area | What to Test |
|------|--------------|
| Buttons | Double-tap, long-press, rapid taps |
| Inputs | Paste, emoji, special characters |
| Carousel | Swipe speed, overscroll |
| Modals | Swipe dismiss, tap outside |
| Lists | Scroll momentum, pull-to-refresh |

### Orientation & Size

| Test | Expected |
|------|----------|
| Portrait only | No rotation for most screens |
| Split view (iPad) | Graceful handling |
| Dynamic type (iOS) | Text scales appropriately |
| Font scaling (Android) | Layout adapts |

### Interruption Testing

| Interruption | Expected Behavior |
|--------------|-------------------|
| Incoming call | App pauses, resumes correctly |
| Notification | Can view and return |
| Low battery popup | App continues |
| App switch | State preserved |

---

## Bug Reporting Template

### Bug Report Format

```markdown
## Bug Title
[Clear, concise description]

## Environment
- Device: [iPhone 15 Pro / Pixel 7]
- OS Version: [iOS 17.2 / Android 14]
- App Version: [1.2.3]
- Environment: [Staging / Production]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Result
[What should happen]

## Actual Result
[What actually happened]

## Screenshots/Videos
[Attach files]

## Severity
- [ ] Critical - App crash, data loss
- [ ] High - Feature broken, no workaround
- [ ] Medium - Feature broken, workaround exists
- [ ] Low - Minor UI issue

## Frequency
- [ ] Always (100%)
- [ ] Often (50-99%)
- [ ] Sometimes (10-50%)
- [ ] Rarely (< 10%)

## Additional Context
[Any other relevant information]
```

---

## Test Execution Checklist

### Pre-Release Checklist

| Category | Tests | Status |
|----------|-------|--------|
| Onboarding | TP-001, TP-002 | [ ] |
| Payment | TP-003, TP-005 | [ ] |
| Verification | TP-004 | [ ] |
| Error Handling | TP-006, TP-007 | [ ] |
| Profile | TP-008 | [ ] |
| Exploratory | All areas | [ ] |

### Sign-Off

| Role | Name | Date |
|------|------|------|
| QA Tester | | |
| QA Lead | | |
| Dev Lead | | |

---

*Document generated: 2026-01-31*
*Review: Before each release*
