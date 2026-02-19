# Flow 2: OTP Verification -- PRD

## Overview

The OTP verification flow handles phone number verification via a 6-digit one-time password. This is a single-screen flow with 4 distinct states covering the happy path (empty, filled) and error cases (invalid OTP, expired OTP). The screen uses the DottedPattern background consistent with the auth flow.

**Entry Point**: Phone number submitted from sign-up screen
**Exit Point**: OTP verified --> Flow 3 (Waitlist check)
**Total States**: 4
**Total Stories**: 14 (4 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### OTP Screen (/(auth)/otp)

| State | Figma ID | Description |
|-------|----------|-------------|
| empty | 1-31175 | OTP input empty, 6 blank cells, CTA disabled, resend timer active |
| filled | 1-31073 | All 6 digits entered, CTA enabled, ready to verify |
| error1 | 1-31277 | Invalid OTP entered, error message "Invalid OTP. Please try again.", input cells highlighted red |
| error2 | 1-31380 | Expired OTP, error message "OTP has expired. Please request a new one.", resend CTA active |

**Key Elements**:
- DottedPattern background
- Logo at top
- "Enter OTP" headline text
- "We sent a 6-digit code to +91 XXXXXXXXXX" subtitle with masked phone number
- OTPInput component (6 cells, auto-focus on first cell)
- Error message text (red, visible in error1/error2 states)
- PrimaryButton "Verify" (disabled when empty, enabled when filled)
- "Resend OTP" TextButton with countdown timer
- "Edit phone number" TextButton to go back to sign-up
- Background images (ellipse-26, image-148, rectangle-30)

**Route Params**: `?state=empty`, `?state=filled`, `?state=error1`, `?state=error2`

### State Transitions

```
empty --> (user types 6 digits) --> filled
filled --> (tap Verify, OTP valid) --> [EXIT: Waitlist]
filled --> (tap Verify, OTP invalid) --> error1
filled --> (tap Verify, OTP expired) --> error2
error1 --> (user clears and retypes) --> filled
error2 --> (tap Resend OTP) --> empty (new OTP sent)
any --> (tap "Edit phone number") --> [BACK: Sign Up]
```

### Functional Requirements

1. **Auto-focus**: First OTP cell receives focus on mount
2. **Auto-advance**: Cursor auto-advances to next cell on digit entry
3. **Paste support**: Pasting 6-digit code fills all cells
4. **Backspace**: Backspace clears current cell and moves to previous
5. **Validation**: Only numeric input accepted (0-9)
6. **CTA State**: "Verify" button disabled until all 6 digits entered
7. **Resend Timer**: 30-second countdown before resend becomes active
8. **Resend Logic**: Tap "Resend OTP" triggers new OTP, resets timer
9. **Error Display**: Error message appears below OTP input in red
10. **Error Clear**: Error message clears when user starts retyping
11. **Phone Display**: Shows masked phone number from previous screen
12. **Back Navigation**: "Edit phone number" returns to sign-up with phone number preserved
13. **Loading State**: Button shows loading spinner during API call
14. **Network Error**: Shows generic error toast on network failure

## Shared Components Used

| Component | Usage |
|-----------|-------|
| Screen | Base screen wrapper |
| Text | Headline, subtitle, error message, timer text |
| PrimaryButton | "Verify" CTA |
| TextButton | "Resend OTP", "Edit phone number" |
| OTPInput | 6-digit OTP entry |
| DottedPattern | Background pattern |
| Logo | Top logo |

## Stories

### OTP -- Empty (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 1-31175 (OTP empty) | 1 |
| 1.2 | BUILD: Implement OTP empty state with OTPInput component, resend timer | 5 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### OTP -- Filled (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 1-31073 (OTP filled) | 1 |
| 2.2 | BUILD: Implement OTP filled state with enabled CTA | 3 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### OTP -- Error 1: Invalid OTP (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 1-31277 (OTP error1) | 1 |
| 3.2 | BUILD: Implement error1 state with red error message and highlighted cells | 3 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### OTP -- Error 2: Expired OTP (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 1-31380 (OTP error2) | 1 |
| 4.2 | BUILD: Implement error2 state with expired message and active resend | 3 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | FLOW TEST: Maestro E2E test covering OTP entry, verify, error states, resend | 3 |
| 5.2 | SYSTEM IMPROVEMENT: Refine OTPInput component or pipeline issues discovered | 3 |

**Total: 14 stories, 38 points**

## Dependencies

- **Upstream**: Flow 1 (Auth) -- sign-up screen passes phone number
- **Downstream**: Flow 3 (Waitlist) -- successful OTP verification triggers waitlist check
- **Shared Components**: OTPInput established here, used nowhere else. DottedPattern, PrimaryButton, TextButton patterns from Flow 1.
- **Backend**: `verify-otp` Supabase edge function must be wired

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| verify-otp | Tap "Verify" | success: JWT token, redirect to waitlist | invalid: error1 state | expired: error2 state |
| resend-otp | Tap "Resend OTP" | success: new OTP sent, reset timer | error: toast notification |

## DottedPattern Configuration

| Screen | backgroundShape Key |
|--------|-------------------|
| OTP (all states) | default |

## Exit Criteria

1. All 4 OTP states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 4 states
3. ODiff <=18% for DottedPattern screens
4. OTPInput component fully functional: auto-focus, auto-advance, paste, backspace
5. Error states display correctly with proper styling
6. Resend timer counts down and resets properly
7. Maestro flow test passes: enter OTP --> verify --> success navigation
8. Zero TypeScript errors, zero ESLint warnings
9. No regressions in Flow 1 (Auth) screens
