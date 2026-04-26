# PRD: Phone Authentication Flow

**Product**: Flent Secured iOS App
**Feature**: Phone Number Authentication with OTP Verification
**Version**: 1.0
**Last Updated**: 2026-01-30
**Status**: Implemented

**Figma Design File**: HZaVuwWn6B6jOjrmxZ7Kzv - Flent Secured v1.2 - Dev

---

## Overview

The Phone Authentication Flow is the primary entry point for user authentication in the Flent Secured iOS app. It enables users to sign up or log in using their Indian mobile phone number with OTP (One-Time Password) verification. This flow captures user consent for identity verification (Mobile 360) and determines the appropriate post-authentication routing based on user status.

### Business Objectives

- **User Acquisition**: Frictionless signup with phone-only authentication (no email/password required)
- **Security**: OTP-based verification ensures phone ownership
- **Compliance**: Capture explicit consent for identity verification services
- **User Experience**: Clean, dark-themed UI with clear visual feedback

---

## User Stories

### Primary User Story

> As a **potential Flent user**, I want to **authenticate using my phone number** so that I can **quickly access rent payment services without creating a traditional account**.

### Secondary User Stories

1. As a new user, I want to receive clear feedback when I enter an invalid phone number so I can correct it.
2. As a returning user, I want to log in with my existing phone number to continue where I left off.
3. As a user, I want the OTP to auto-fill from SMS so I don't have to manually type it.
4. As a user, I want to resend OTP if I didn't receive it after a reasonable wait time.

---

## Functional Requirements

### Screen 1: Phone Entry (Figma: 1:29108, 1:31073, 1:31590, 1:31671)

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|---------------------|----------|
| FR1.1 | Display phone number input with +91 country code | Country code is pre-selected and visible; input accepts 10 digits only | P0 |
| FR1.2 | Validate Indian mobile number format | Numbers must start with 6, 7, 8, or 9 and be exactly 10 digits | P0 |
| FR1.3 | Show real-time validation feedback | Error message appears immediately when format is invalid | P0 |
| FR1.4 | Display consent toggle for identity verification | Toggle is visible with descriptive text; default state is OFF | P0 |
| FR1.5 | Enable "Get Started" button only when valid | Button enabled when: valid 10-digit phone + consent toggle ON | P0 |
| FR1.6 | Send OTP on button tap | Call `auth-otp` endpoint with `action: "send_otp"` | P0 |
| FR1.7 | Handle loading state during OTP send | Show loading spinner; disable input and button | P1 |
| FR1.8 | Display API errors clearly | Show error message below input field with red styling | P0 |
| FR1.9 | Auto-focus phone input on screen appear | Keyboard appears automatically after 500ms delay | P2 |
| FR1.10 | Strip non-numeric characters from input | Automatically remove spaces, dashes, letters | P1 |

### Screen 2: OTP Verification (Figma: 1:31175, 1:31277, 1:31380, 1:31485)

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|---------------------|----------|
| FR2.1 | Display 6-digit OTP input field | 6 individual boxes with dash separator (000-000 format) | P0 |
| FR2.2 | Support iOS one-time code autofill | `textContentType: .oneTimeCode` enabled; auto-fills from SMS | P0 |
| FR2.3 | Auto-advance focus on digit entry | Focus moves to next box when digit entered | P0 |
| FR2.4 | Support backspace navigation | Backspace on empty box moves focus to previous box | P1 |
| FR2.5 | Auto-verify when all 6 digits entered | Trigger verification automatically with 300ms delay for visual feedback | P0 |
| FR2.6 | Show resend timer (30 seconds) | Display countdown; enable "Resend" link when timer expires | P0 |
| FR2.7 | Handle invalid OTP error | Clear OTP field; shake animation; display error message | P0 |
| FR2.8 | Handle expired OTP error | Display specific "OTP expired" message; prompt to resend | P0 |
| FR2.9 | Handle max attempts error | Display message and prevent further attempts temporarily | P0 |
| FR2.10 | Route based on auth result | New user -> Name Verification; Existing user -> Check status and route | P0 |
| FR2.11 | Display as bottom sheet overlay | Sheet slides up over dimmed phone entry screen | P1 |

---

## UI Components Specification

### Screen 1: Phone Entry (`PhoneEntryView.swift`)

| Component | Type | Figma Spec | Behavior |
|-----------|------|------------|----------|
| Background | View | #131313 with dotted grid pattern | Full screen, ignores safe area |
| Logo | FlentLogo | 33.375x40pt white keyhole | Top-left, 40pt from safe area |
| Headline | VStack | H1/Regular 48px, -2px tracking | Two-line: "Let's get to" (gray #A9A9A9) + "know you" (brand #FF9A6D) |
| Phone Label | Text | 14px Regular, #797979 | "Phone" above input |
| Phone Input | PhoneInputFieldBox | 56pt height, 12pt radius, #262626 bg | Country picker (80pt) + divider + text field |
| Consent Toggle | ConsentToggleView | System switch + 12px text | Brand tint #FF9A6D, gray text |
| Primary Button | PrimaryButton | Full width, gradient bg | "Get Started", disabled until valid |

**Design Tokens (Phone Input)**:
- Height: 56pt
- Corner radius: 12pt
- Background: #262626
- Border (focused): 1px #FF9A6D
- Border (error): 1px #FF5252
- Country code width: 80pt
- Internal padding: 16pt
- Placeholder: "Enter Number"
- Font: 16px Regular

### Screen 2: OTP Verification (`OTPVerificationView.swift`)

| Component | Type | Figma Spec | Behavior |
|-----------|------|------------|----------|
| Background | ZStack | Dimmed phone entry visible | 30% opacity overlay |
| Sheet | VStack | #1A1A1A, 24px top corners | Slides up from bottom |
| Drag Handle | Rectangle | 40x4px, #4D4D4D, 2px radius | Centered, 16pt from top |
| Title | VStack | H1/Regular 48px | "Let's verify" (gray) + "your number" (brand) |
| Subtitle | Text | 14px Regular, #A6A6A6 | "We've sent a 6-digit code..." |
| OTP Input | OTPInputFieldSixDigit | 6 boxes + dash | See detailed spec below |
| Error Message | HStack | 14px Regular, #FF8080 | Icon + text, conditional |
| Proceed Button | PrimaryButton | Full width | "Proceed", disabled until 6 digits |
| Resend Section | Group | 14px text | Timer or "Resend" link |

**Design Tokens (OTP Input)**:
- Box size: 48x56pt
- Box spacing: 12pt (8pt around dash)
- Background (empty): #262626
- Background (filled): #1A1A1A
- Border (default): 1px #4D4D4D
- Border (focused): 2px #FF9A6D
- Border (error): 2px #FF8080
- Corner radius: 12pt
- Text: 24px SemiBold White, centered
- Cursor: 2px #FF9A6D, 600ms blink

---

## Data Requirements

### Input Data

| Field | Type | Validation | Source |
|-------|------|------------|--------|
| Phone Number | String | 10 digits, starts with 6-9 | User input |
| Country Code | String | "+91" (fixed for India) | Pre-selected |
| Identity Consent | Boolean | Required to proceed | User toggle |
| OTP Code | String | 6 numeric digits | User input / SMS autofill |

### Output Data (from API)

| Field | Type | Description |
|-------|------|-------------|
| user_id | UUID | Supabase user identifier |
| is_new_user | Boolean | True if first-time signup |
| consent_verification_id | UUID | Identity verification record ID |
| consent_status | String | "CONSENT_GIVEN" or null |

### API Endpoints

**1. Send OTP**
```
POST /functions/v1/auth-otp
{
  "action": "send_otp",
  "phone_number": "+919876543210",
  "channel": "sms",
  "consent_for_mobile360": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "verification_sid": "VE...",
    "status": "pending",
    "channel": "sms",
    "phone_masked": "XXXXXX3210",
    "message": "OTP sent via SMS. Please verify to continue."
  }
}
```

**2. Verify OTP**
```
POST /functions/v1/auth-otp
{
  "action": "verify_otp",
  "phone_number": "+919876543210",
  "otp": "123456",
  "consent_for_mobile360": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid-here",
    "is_new_user": true,
    "consent_verification_id": "uuid-here",
    "consent_status": "CONSENT_GIVEN",
    "message": "Phone verified successfully."
  }
}
```

---

## States and Transitions

### Phone Entry States

| State | Trigger | Visual Changes | Next State |
|-------|---------|----------------|------------|
| `idle` | Initial load | Empty input, button disabled | `idle` / `error` |
| `idle` | User types | Input updates, validation runs | `idle` |
| `idle` | Valid phone + consent | Button becomes enabled | `idle` |
| `loading` | Tap "Get Started" | Spinner on button, inputs disabled | `success` / `error` |
| `success` | OTP sent | Navigate to OTP screen | - |
| `error` | Invalid phone format | Error text below input, shake animation | `idle` |
| `error` | API failure | Error text below input | `idle` |

### OTP Verification States

| State | Trigger | Visual Changes | Next State |
|-------|---------|----------------|------------|
| `idle` | Sheet appears | Empty OTP boxes, timer starts (30s) | `idle` |
| `idle` | User enters digit | Box fills, focus advances | `idle` / `verifying` |
| `verifying` | 6 digits entered | Auto-triggers, spinner on button | `verified` / `error` |
| `verified` | OTP correct | Success haptic | Navigate |
| `error` | Wrong OTP | Shake, clear OTP, show message | `idle` |
| `error` | OTP expired | Show "expired" message | `idle` |
| `error` | Max attempts | Show message, disable input | `idle` |
| `resending` | Tap "Resend" | Spinner, then reset timer | `idle` |

---

## Navigation Flow

```
                                   [Splash Screen]
                                         |
                    +--------------------+--------------------+
                    |                                         |
               [Get Started]                              [Log In]
                    |                                         |
                    v                                         v
        +---------------------------+           +---------------------------+
        |    Phone Entry Screen     |           |    Phone Entry Screen     |
        |   (authIntent: .signup)   |           |   (authIntent: .login)    |
        +---------------------------+           +---------------------------+
                    |                                         |
                    |  Send OTP Success                       |
                    v                                         v
        +---------------------------+           +---------------------------+
        |  OTP Verification Sheet   |           |  OTP Verification Sheet   |
        +---------------------------+           +---------------------------+
                    |                                         |
         Verify OTP |                              Verify OTP |
                    v                                         v
             +-------------+                           +-------------+
             | is_new_user |                           | is_new_user |
             +------+------+                           +------+------+
                    |                                         |
        +-----------+-----------+             +---------------+---------------+
        |                       |             |                               |
       true                   false         true                            false
        |                       |             |                               |
        v                       v             v                               v
+---------------+       +-----------+  +---------------+             +-----------------+
| Name          |       | Fetch     |  | Name          |             | Route by Status |
| Verification  |       | Profile   |  | Verification  |             +-----------------+
+---------------+       +-----------+  +---------------+                     |
                              |                              +---------------+---------------+
                              v                              |               |               |
                    +-----------------+                   waitlist        qualified       complete
                    | Route by Status |                      |               |               |
                    +-----------------+                      v               v               v
                            |                          [Waitlist]     [Pending Steps]   [Home]
            +---------------+---------------+
            |               |               |
         waitlist       qualified       complete
            |               |               |
            v               v               v
      [Waitlist]     [Pending Steps]   [Home]
```

### Entry Points

- **Splash Screen**: User taps "Get Started" (signup) or "Log In" (login)
- **Deep Link**: `flent://auth` could trigger phone entry (future)

### Exit Points

- **New User**: `Name Verification` screen
- **Existing Waitlisted**: `Waitlist` screen
- **Existing Qualified**: `Pending Steps` or `Home` (based on tenancy status)
- **Existing Complete**: `Home` screen

---

## Error Handling

### Client-Side Validation Errors

| Error | Message | Recovery |
|-------|---------|----------|
| Empty phone | "Please enter a valid 10-digit phone number" | Type valid number |
| Too short | "Phone number must be 10 digits" | Complete number |
| Invalid prefix | "Phone number must start with 6, 7, 8, or 9" | Correct first digit |
| No consent | "Please allow identity verification to continue" | Enable toggle |
| Incomplete OTP | "Please enter the complete 6-digit code" | Enter all digits |

### API/Network Errors

| Error Code | User Message | Action |
|------------|--------------|--------|
| `INVALID_PHONE` | "Phone number is invalid for this country" | Re-enter phone |
| `RATE_LIMITED` | "Max send attempts reached. Please wait before trying again." | Wait and retry |
| `INVALID_OTP` | "Invalid OTP. Please try again." | Clear and re-enter |
| `OTP_EXPIRED` | "OTP has expired. Please request a new OTP." | Tap Resend |
| `MAX_ATTEMPTS` | "Maximum OTP attempts reached. Please request a new OTP." | Tap Resend |
| `NETWORK_ERROR` | "Something went wrong. Please try again." | Retry action |
| `SERVER_ERROR` | "Something went wrong. Please try again." | Retry action |

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User pastes full phone number with country code | Strip +91 prefix, accept remaining 10 digits |
| User pastes OTP from clipboard | Auto-fill all 6 boxes, trigger verification |
| User backgrounded app during OTP wait | Timer continues; OTP remains valid per backend expiry |
| User force quits app after OTP sent | On re-launch, start from phone entry (no persistent OTP state) |
| OTP arrives after 10-minute expiry | Backend returns expired error; user must request new OTP |
| User has weak network during verification | Show loading state; timeout after 30s; allow retry |
| User taps resend multiple times rapidly | Button disabled during resend; timer prevents spam |
| Phone number already registered | Backend handles; returns existing user flow |

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| VoiceOver labels | All inputs have `accessibilityLabel` and `accessibilityHint` |
| Dynamic Type | Fonts use `Typography` system that scales |
| Color contrast | All text meets WCAG AA (4.5:1 for body, 3:1 for large) |
| Focus order | Logical tab order: Logo > Title > Input > Toggle > Button |
| Error announcements | Error messages announced via `accessibilityLabel` |
| Button states | Loading/disabled states announced |

**Accessibility Identifiers** (for UI testing):
- `phone_input`
- `consent_toggle`
- `continue_button`
- `otp_input`
- `proceed_button`

---

## Analytics Events

| Event | Trigger | Properties |
|-------|---------|------------|
| `phone_entry_viewed` | Screen appears | `auth_intent` |
| `phone_entered` | Valid phone typed | `phone_masked` |
| `otp_requested` | Tap Get Started | `phone_masked`, `channel` |
| `otp_request_failed` | API error | `error_code`, `error_message` |
| `otp_screen_viewed` | OTP sheet appears | `phone_masked` |
| `otp_entered` | 6 digits complete | - |
| `otp_verified` | Verification success | `is_new_user`, `consent_given` |
| `otp_failed` | Verification failure | `error_code`, `attempts_count` |
| `otp_resent` | Tap Resend | `resend_count` |

---

## Technical Implementation

### Files

| File | Path | Purpose |
|------|------|---------|
| `PhoneEntryView.swift` | `Features/Onboarding/Views/` | Phone entry UI |
| `PhoneEntryViewModel.swift` | `Features/Onboarding/ViewModels/` | Phone validation & OTP send logic |
| `OTPVerificationView.swift` | `Features/Onboarding/Views/` | OTP entry UI with bottom sheet |
| `OTPVerificationViewModel.swift` | `Features/Onboarding/ViewModels/` | OTP verification & routing logic |
| `AppCoordinator.swift` | `App/` | Navigation coordination |
| `auth-otp/index.ts` | `supabase/functions/` | Backend OTP handling (Twilio) |

### Dependencies

- **Twilio Verify API**: OTP send and verification
- **Supabase Auth**: User creation and session management
- **HapticManager**: Success/error feedback
- **Typography/AppColors**: Design system compliance

### Test Coverage

- `PhoneEntryViewModelTests.swift`: 23 tests covering validation, API calls, state management
- `OTPVerificationViewModelTests.swift`: 30 tests covering OTP entry, verification, timer, routing

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Signup completion rate | > 85% | Users who complete OTP from phone entry |
| OTP verification success rate | > 95% | Successful verifications / total attempts |
| Average time to complete auth | < 45s | Time from phone entry to verified |
| Resend rate | < 20% | Users who request OTP resend |
| Error rate | < 5% | Auth attempts resulting in error |

---

## Future Considerations

1. **WhatsApp OTP Channel**: Add option to receive OTP via WhatsApp (Twilio supports this)
2. **Voice Call OTP**: Fallback for users not receiving SMS
3. **Country Code Picker**: Expand beyond India (+91)
4. **Biometric Re-auth**: TouchID/FaceID for returning users
5. **Remember Device**: Skip OTP on trusted devices
6. **Rate Limiting UI**: Show cooldown timer when rate limited

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | PM | Initial PRD based on Figma designs and implemented code |
