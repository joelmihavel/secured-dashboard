# PRD: Onboarding Flow - Chunk 1
## Splash, Carousel, and Phone Authentication

**Document Version:** 1.0
**Last Updated:** 2026-01-30
**Figma File:** HZaVuwWn6B6jOjrmxZ7Kzv
**Status:** Implementation Complete

---

## Overview

This PRD covers the first chunk of the Flent Secured iOS app onboarding flow, encompassing:

1. **Splash/Get Started Screen** - Initial app launch with brand introduction
2. **Animated Intro** - First-time launch video animation (optional)
3. **Onboarding Carousel** - Three slides showcasing app value propositions
4. **Phone Entry Screen** - User authentication via phone number
5. **OTP Verification Screen** - 6-digit code verification

The flow establishes first impressions, communicates core value propositions, and authenticates users via phone-based OTP (one-time password) verification.

---

## User Stories

### As a new user:
- I want to see an engaging onboarding experience so I understand the app's value proposition
- I want to sign up with my phone number so I can create an account quickly
- I want to receive a verification code via SMS so I can prove I own this phone number
- I want clear feedback on errors so I can correct my input

### As a returning user:
- I want to log in with my existing phone number so I can access my account
- I want the app to remember my progress if I abandon onboarding midway

### As the business:
- We want to capture user phone numbers for account creation and communication
- We want to verify phone ownership to prevent fraud
- We want to track conversion through the onboarding funnel
- We want to collect user consent for identity verification

---

## Screen Specifications

### Screen 1: Splash Get Started (node: 1:28055)

**Purpose:** First screen users see when launching the app. Introduces the Flent Secured brand and primary call-to-action.

**Components:**
| Element | Specification |
|---------|---------------|
| Background | `#131313` (black700) with dotted grid pattern overlay |
| Logo | Flent keyhole logo, 33.375x40pt, white, top-left position |
| Headline (Gray) | "Make your rent" - H1/Regular (48px), `#A9A9A9` (neutral500), tracking -2px |
| Headline (Brand) | "work for you" - H1/Regular (48px), `#FF9A6D` (brand500), tracking -2px |
| Subtitle | "Rewards for trustworthy tenants & Free protection for homeowners" - 14px Regular, `#A6A6A6` (black200) |
| Vector Illustration | Abstract shape positioned bottom-right, 333.75x400pt |
| Get Started Button | Custom button with bar indicator, 297px width, gradient `#202020` to `#0D0D0D`, border `#FF9A6D` 0.5px |
| Login Link | "Already a user? Log in" - 14px Regular, white with underline on "Log in" |

**Layout:**
- Horizontal padding: 48pt (sp-48)
- Top padding: 64pt from safe area
- Bottom padding: 64pt (scale/64)
- Gap between headline and subtitle: 16pt
- Gap between button and login link: 24pt

**Interactions:**
| Action | Behavior |
|--------|----------|
| Tap "Get Started" | Navigate to Phone Entry (signup intent) |
| Tap "Log in" | Navigate to Phone Entry (login intent) |
| Swipe left | Transition to Carousel slide 1 |
| Auto-scroll | Automatically transitions to carousel after 4 seconds |

**Accessibility:**
- `get_started_button` identifier for UI testing
- `login_link` identifier for UI testing
- VoiceOver reads combined headline as single element

---

### Screen 2: Splash Animation (node: 1:28071)

**Purpose:** First-time cold launch experience with video background animation.

**Behavior:**
- Shown only on first cold launch (tracked via UserDefaults `hasSeenSplashIntroAnimation`)
- Video loads with 250ms timeout
- If video fails or conditions not met, skips directly to carousel mode

**Video Fallback Conditions:**
- Reduce Motion enabled: Skip video
- Low Power Mode enabled: Skip video
- Thermal state critical/serious: Skip video
- Video file not in bundle: Skip video
- Video load timeout (250ms): Skip video

**Duration:** 3.0 seconds max before auto-transitioning to carousel

**Current Implementation:** Video disabled, starts directly in carousel mode

---

### Screen 3: Carousel Slide 1 - Good Habits (node: 1:28985)

**Purpose:** First carousel slide emphasizing rewards for good payment behavior.

**Components:**
| Element | Specification |
|---------|---------------|
| Background | `#131313` with carousel-specific background shape |
| Logo | Flent keyhole, 26.7x32pt (smaller than Get Started) |
| Headline (Gray) | "Good Habits" - H1/Regular 48px, `#A9A9A9` |
| Headline (Brand) | "Deserve Recognition" - H1/Regular 48px, `#FF9A6D` |
| Subtitle | "we make it worth it for you to pay your rent on time" - 14px Regular, `#A6A6A6` |
| Page Indicators | 3 dots, 8x8pt each, 8pt gap, active=`#FF9A6D`, inactive=`#4D4D4D` |
| Background Shape | Gradient overlay from `#131313` to transparent, 331pt height |

**Interactions:**
| Action | Behavior |
|--------|----------|
| Swipe left | Transition to Carousel slide 2 |
| Swipe right | Return to Get Started screen |
| Tap dot indicator | Jump to corresponding slide |
| Auto-scroll | Transitions every 4 seconds |

---

### Screen 4: Carousel Slide 2 - Earn Everytime (node: 1:29025)

**Purpose:** Second carousel slide highlighting cashback rewards.

**Components:**
| Element | Specification |
|---------|---------------|
| Headline (Gray) | "Earn Everytime" |
| Headline (Brand) | "You Pay On Time" |
| Subtitle | "Get 1% back on your rent when you pay through UPI, netbanking, or cards." |
| Subtitle Color | `#A9A9A9` (neutral500) - slightly different from slide 1 |

**Same layout as Carousel Slide 1 with different content and indicator showing position 2.**

---

### Screen 5: Carousel Slide 3 - It Gets Better (node: 1:29065)

**Purpose:** Third carousel slide introducing progressive benefits.

**Components:**
| Element | Specification |
|---------|---------------|
| Headline (Gray) | "It Gets Better" |
| Headline (Brand) | "With Time" |
| Subtitle | "Pay via Secured to unlock smarter renting benefits." |
| Subtitle Color | `#A9A9A9` (neutral500) |

**Same layout as Carousel Slides 1-2 with different content and indicator showing position 3.**

---

### Screen 6: Phone Entry - Empty State (node: 1:29108)

**Purpose:** Capture user's phone number and name for account creation/login.

**Components:**
| Element | Specification |
|---------|---------------|
| Background | `#131313` with dotted grid pattern |
| Logo | Flent keyhole, 33.375x40pt, top-left |
| Headline (Gray) | "Let's get to" - H1/Regular 48px, `#A9A9A9` |
| Headline (Brand) | "know you" - H1/Regular 48px, `#FF9A6D` |
| Phone Label | "Phone" - 14px Regular, `#797979` (black300) |
| Phone Input | Box style, 56pt height, `#262626` background, 12pt radius |
| Country Code | "+91" with chevron, 80pt width, divider separator |
| Phone Placeholder | "Enter Number" - 16px Regular, gray |
| Name Label | "Name" - 14px Regular, `#797979` |
| Name Input | Box style matching phone, placeholder "e.g. John Appleseed" |
| Consent Toggle | iOS Switch with brand tint + consent text |
| Consent Text | 12px Regular, `#797979`, describes identity verification consent |
| Get Started Button | PrimaryButton, disabled until valid input + consent |

**Layout:**
- Horizontal padding: 48pt
- Top padding: 40pt from safe area
- Gap between logo and headline: 40pt
- Gap between headline and phone input: 32pt
- Gap between phone and name inputs: 24pt
- Gap between consent and button: 16pt
- Bottom padding: 64pt

**Validation Rules:**
- Phone: Exactly 10 digits, must start with 6, 7, 8, or 9
- Name: Non-empty after trimming whitespace
- Consent: Must be enabled

---

### Screen 7: Phone Entry - Filled State (node: 1:31073)

**Purpose:** Shows the screen state when user has entered valid data.

**Visual Changes from Empty State:**
| Element | Change |
|---------|--------|
| Phone Input | Shows entered number, no placeholder |
| Name Input | Shows entered name |
| Get Started Button | Enabled state with gradient `#FFAE8A` to `#FF9A6D` |

**Button States:**
- **Enabled:** Gradient background, full opacity
- **Disabled:** `#202020` solid, 50% opacity
- **Loading:** Shows ProgressView, disabled interaction

---

### Screen 8: Phone Entry - Error 1 (node: 1:31590)

**Purpose:** Shows validation error for invalid phone number format.

**Error Display:**
| Element | Specification |
|---------|---------------|
| Input Border | 1px `#FF8080` (error red) |
| Error Icon | `exclamationmark.circle.fill`, 14pt, `#FF8080` |
| Error Text | 14px Regular, `#FF8080` |
| Animation | Shake animation on error, haptic feedback |

**Error Messages:**
- "Phone number must be 10 digits"
- "Phone number must start with 6, 7, 8, or 9"
- "Please enter a valid 10-digit phone number"

---

### Screen 9: Phone Entry - Error 2 (node: 1:31671)

**Purpose:** Shows error for API/network failures or phone not found.

**Error Messages:**
- "Failed to send OTP. Please try again."
- "Something went wrong. Please try again."
- (For login) "Phone not registered" (from auth service)

---

### Screen 10: OTP Verification (node: 1:31175)

**Purpose:** Verify phone ownership via 6-digit OTP code.

**Components:**
| Element | Specification |
|---------|---------------|
| Background | `#1A1A1A` (black600) - bottom sheet style |
| Drag Indicator | 48x4pt capsule, `#4D4D4D`, top center |
| Headline | "Let's verify your number" - H4 (28px), white |
| Subtitle | "We've sent a 6-digit code to your phone..." - 14px Regular, `#A6A6A6` |
| OTP Input | 6 boxes with dash separator (3-3 format) |
| OTP Box | 48x56pt, 12pt radius, `#262626` empty, `#1A1A1A` filled |
| Cursor | 2px wide, brand color, blinking 0.6s interval |
| Proceed Button | PrimaryButton, disabled until 6 digits entered |
| Resend Link | "Didn't receive the code? Resend" / "Resend available in Xs" |

**Layout:**
- Horizontal padding: 24pt
- Top padding: 16pt (drag indicator) + 32pt (content)
- Gap between header elements: 12pt
- Gap between OTP and button: 16pt + spacer + 16pt
- Bottom padding: 24pt

**OTP Input Behavior:**
- Hidden TextField captures all input
- Visual boxes reflect entered state
- Auto-submit when 6 digits entered
- Auto-verify with 0.2s delay after complete entry

**Resend Timer:**
- 30-second countdown before resend available
- Timer text: "Resend available in Xs"
- Link enabled text: "Didn't receive the code? Resend"

---

## Functional Requirements

### FR1: Onboarding Carousel

**Description:** Auto-scrolling carousel that introduces app value propositions.

**Acceptance Criteria:**
- [ ] User can swipe between Get Started and 3 carousel pages
- [ ] Page indicators show current position (1 of 3 for carousel)
- [ ] Auto-scroll advances every 4 seconds
- [ ] Manual swipe resets auto-scroll timer
- [ ] Tapping page indicator jumps to that slide
- [ ] "Get Started" button navigates to Phone Entry
- [ ] "Log in" link navigates to Phone Entry with login intent
- [ ] Video intro plays on first launch only (when enabled)
- [ ] Carousel remembers position during session

---

### FR2: Phone Number Entry

**Description:** Capture and validate user phone number with country code.

**Acceptance Criteria:**
- [ ] Phone input with +91 country code prefix (non-editable)
- [ ] Input restricted to numeric characters only
- [ ] Input limited to 10 digits maximum
- [ ] Validation: Must be 10 digits, start with 6/7/8/9
- [ ] Real-time validation feedback (error clears on typing)
- [ ] Name input required (non-empty after trim)
- [ ] Consent toggle required before proceeding
- [ ] Continue button enabled only when all conditions met
- [ ] Loading state shown during OTP send
- [ ] Error states display with shake animation and haptic
- [ ] Auto-focus phone field on screen appear

---

### FR3: OTP Verification

**Description:** Verify phone ownership via 6-digit SMS code.

**Acceptance Criteria:**
- [ ] 6-digit OTP input with visual box representation
- [ ] Dash separator between digits 3 and 4 (XXX-XXX format)
- [ ] Auto-submit when 6 digits entered
- [ ] Hidden TextField for actual input capture
- [ ] Blinking cursor in active box
- [ ] SMS auto-fill supported via `.oneTimeCode` content type
- [ ] 30-second countdown before resend available
- [ ] Resend button disabled during countdown
- [ ] Error state shows in red, clears on new input
- [ ] Success haptic on complete entry
- [ ] Error haptic on validation failure
- [ ] OTP cleared after failed verification attempt

---

### FR4: Authentication Intent Handling

**Description:** Support both signup and login flows from single phone entry.

**Acceptance Criteria:**
- [ ] "Get Started" button sets signup intent
- [ ] "Log in" link sets login intent
- [ ] Auth service receives intent for appropriate handling
- [ ] New users continue to Name Verification after OTP
- [ ] Existing users route based on their account status
- [ ] User name passed through to OTP verification screen

---

### FR5: Error Handling

**Description:** Graceful error handling throughout authentication flow.

**Acceptance Criteria:**
- [ ] Network errors display friendly message
- [ ] Invalid phone format shows specific error
- [ ] OTP verification failure clears input and shows error
- [ ] Multiple failed OTP attempts handled (service level)
- [ ] Timeout errors handled gracefully
- [ ] All errors dismissible by user interaction

---

## Data Requirements

### Input Data

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| phoneNumber | String | 10 digits, starts with 6/7/8/9 | Yes |
| countryCode | String | Fixed "+91" | Yes (auto) |
| name | String | Non-empty after trim | Yes |
| consentGiven | Bool | Must be true | Yes |
| otpCode | String | 6 numeric digits | Yes (OTP screen) |
| authIntent | Enum | signup/login | Yes |

### Output Data

| Field | Type | Description |
|-------|------|-------------|
| fullPhoneNumber | String | "+91" + phoneNumber |
| otpSent | Bool | OTP successfully sent |
| otpExpiresIn | Int | Seconds until OTP expires (default 300) |
| authResult | AuthResult | Verification result with user status |
| isNewUser | Bool | Whether user is registering for first time |

### API Endpoints

**Send OTP:**
```
POST /auth/send-otp
Body: { phone: "+91XXXXXXXXXX" }
Response: { success: Bool, message: String, expiresIn: Int }
```

**Verify OTP:**
```
POST /auth/verify-otp
Body: { phone: "+91XXXXXXXXXX", otp: "XXXXXX", consentForMobile360: Bool }
Response: { success: Bool, isNewUser: Bool, error: String?, userStatus: String? }
```

---

## States

### Splash/Carousel States

| State | Description | Visual |
|-------|-------------|--------|
| Get Started | Initial screen with CTA | Full UI visible |
| Carousel (1-3) | Value proposition slides | Smaller logo, no button |
| Video Intro | First launch animation | Video background |
| Transitioning | Between slides | Animation in progress |

### Phone Entry States

| State | Description | Visual |
|-------|-------------|--------|
| Empty | No input entered | Placeholders visible, button disabled |
| Partial | Some input entered | Input visible, button disabled |
| Valid | All validation passed | Button enabled |
| Loading | Sending OTP | Button shows spinner |
| Error | Validation/API error | Red border, error message, shake |

### OTP Verification States

| State | Description | Visual |
|-------|-------------|--------|
| Empty | No digits entered | All boxes empty, cursor in first |
| Partial | 1-5 digits entered | Filled boxes, cursor in next |
| Complete | 6 digits entered | All boxes filled, auto-verifying |
| Verifying | API call in progress | Button shows spinner |
| Error | Wrong OTP | Red borders, error text |
| Resend Cooldown | Timer active | Countdown text, disabled link |
| Resend Ready | Timer complete | Active resend link |

---

## Navigation Flow

```
                                    +------------------+
                                    |     App Launch   |
                                    +--------+---------+
                                             |
                              (First Launch?)v
                               +-------------+-------------+
                               |                           |
                        [Yes]  v                    [No]   v
                    +----------+----------+    +-----------+----------+
                    |   Video Intro       |    |   Check Auth State   |
                    |   (if enabled)      |    +----------+-----------+
                    +----------+----------+               |
                               |                          v
                               v              (Authenticated?)
                    +----------+----------+   +-----+-----+
                    |   Get Started       |<--| No        |
                    |   Screen            |   +-----------+
                    +----------+----------+
                               |
              +----------------+----------------+
              |                                 |
     [Get Started]                        [Log In]
              |                                 |
              v                                 v
    +---------+----------+           +----------+---------+
    |  Phone Entry       |           |  Phone Entry       |
    |  (signup intent)   |           |  (login intent)    |
    +---------+----------+           +----------+---------+
              |                                 |
              +-----------------+---------------+
                                |
                                v
                    +-----------+-----------+
                    |    OTP Verification   |
                    +-----------+-----------+
                                |
                     (Verification Success?)
                    +-----------+-----------+
                    |                       |
             [Yes]  v                 [No]  v
         +----------+--------+    +--------+---------+
         |  Check isNewUser  |    |  Show Error      |
         +----------+--------+    |  Clear OTP       |
                    |             +---------+--------+
         +----------+----------+            |
         |                     |            v
    [New User]           [Existing]    (Retry OTP)
         |                     |
         v                     v
    +----+----+         +------+------+
    |  Name   |         | Route by    |
    | Verify  |         | UserStatus  |
    +---------+         +-------------+
```

---

## Design System References

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| black700 | #131313 | Primary background |
| black600 | #1A1A1A | Secondary background, OTP sheet |
| black500 | #202020 | Disabled button |
| black400 | #4D4D4D | Borders, inactive indicators |
| black300 | #797979 | Muted text, labels |
| black200 | #A6A6A6 | Secondary text |
| neutral500 | #A9A9A9 | Gray headline text |
| brand500 | #FF9A6D | Primary accent, active states |
| brand400 | #FFAE8A | Button gradient light |
| error | #FF8080 | Error states |

### Typography

| Style | Spec | Usage |
|-------|------|-------|
| H1 | 48px Regular, -2px tracking, 64px line-height | Headlines |
| H4 | 28px Regular, -1px tracking, 40px line-height | OTP sheet title |
| bodyMd2 | 14px Regular, 20px line-height | Subtitles, consent |
| bodySm | 12px Regular, 20px line-height | Small text |
| button | 16px SemiBold, 24px line-height | Button labels |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| sp-48 (xxxl) | 48pt | Screen horizontal padding |
| sp-40 (xxl) | 40pt | Section gaps |
| sp-32 (xl) | 32pt | Large gaps |
| sp-24 (lg) | 24pt | Medium gaps |
| sp-16 (md) | 16pt | Standard gaps |
| sp-12 (sm) | 12pt | Compact gaps |
| sp-8 (xs) | 8pt | Small gaps |

### Components

| Component | File | Description |
|-----------|------|-------------|
| PrimaryButton | PrimaryButton.swift | Main action button with gradient |
| OTPInputField | OTPInputField.swift | 6-digit OTP input |
| OTPDigitBox | OTPInputField.swift | Individual OTP digit container |
| DottedGridPattern | BackgroundPatterns.swift | Background texture |
| FlentLogo | BackgroundPatterns.swift | Brand logo component |
| PhoneInputFieldBox | PhoneEntryView.swift | Phone input with country code |
| NameInputFieldBox | PhoneEntryView.swift | Name text input |
| ConsentToggleView | PhoneEntryView.swift | Consent switch with text |

---

## Analytics Events

| Event | Trigger | Properties |
|-------|---------|------------|
| splash_viewed | Screen appear | - |
| intro_skipped | User taps during video | - |
| intro_completed | Video animation ends | - |
| get_started_tapped | CTA button tap | - |
| login_tapped | Login link tap | - |
| carousel_slide_viewed | Slide becomes visible | slideIndex: Int |
| phone_entry_started | Screen appear | intent: signup/login |
| phone_submitted | OTP send initiated | - |
| otp_screen_viewed | OTP screen appear | phone: String (masked) |
| otp_submitted | Verification initiated | - |
| otp_verified | Verification success | isNewUser: Bool |
| otp_failed | Verification failed | error: String |
| otp_resend_tapped | Resend link tap | - |

---

## Error Messages

| Code | Message | Context |
|------|---------|---------|
| PHONE_INVALID_LENGTH | "Phone number must be 10 digits" | Validation |
| PHONE_INVALID_PREFIX | "Phone number must start with 6, 7, 8, or 9" | Validation |
| PHONE_INVALID_FORMAT | "Please enter a valid 10-digit phone number" | General validation |
| OTP_SEND_FAILED | "Failed to send OTP. Please try again." | API error |
| OTP_INVALID | "Invalid OTP. Please try again." | Wrong code |
| OTP_EXPIRED | "OTP has expired. Please request a new one." | Timeout |
| OTP_INCOMPLETE | "Please enter the complete 6-digit code" | Validation |
| CONSENT_REQUIRED | "Please allow identity verification to continue" | Missing consent |
| NETWORK_ERROR | "Something went wrong. Please try again." | Generic error |

---

## Testing Checklist

### Unit Tests

- [ ] PhoneEntryViewModel validation logic
- [ ] OTPVerificationViewModel state transitions
- [ ] SplashViewModel mode management
- [ ] Phone number formatting (filter non-numeric)
- [ ] OTP digit handling (paste, backspace)
- [ ] Resend timer countdown

### UI Tests

- [ ] Carousel swipe navigation
- [ ] Get Started button navigation
- [ ] Login link navigation
- [ ] Phone input focus and entry
- [ ] Name input entry
- [ ] Consent toggle interaction
- [ ] OTP box input and cursor
- [ ] Error state display
- [ ] Loading state display
- [ ] Resend link enable/disable

### Accessibility Tests

- [ ] VoiceOver navigation through carousel
- [ ] VoiceOver announces button states
- [ ] VoiceOver reads error messages
- [ ] Dynamic Type support
- [ ] Reduce Motion respected
- [ ] Color contrast ratios

---

## Implementation Status

| Screen | SwiftUI View | ViewModel | Status |
|--------|--------------|-----------|--------|
| Splash/Get Started | SplashCarouselView.swift | SplashViewModel.swift | Complete |
| Carousel 1-3 | SplashCarouselView.swift | SplashViewModel.swift | Complete |
| Phone Entry | PhoneEntryView.swift | PhoneEntryViewModel.swift | Complete |
| OTP Verification | OTPVerificationView.swift | OTPVerificationViewModel.swift | Complete |

---

## Open Questions / Future Considerations

1. **Country Code Selection:** Currently hardcoded to +91 (India). Should we support multiple countries?

2. **Biometric Login:** Should returning users be able to use Face ID/Touch ID instead of OTP?

3. **Remember Me:** Should we persist phone number for faster login?

4. **Rate Limiting:** What are the limits on OTP requests? How do we handle abuse?

5. **Deep Linking:** Should onboarding support deep links for marketing campaigns?

6. **A/B Testing:** Consider testing different carousel content for conversion optimization.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Product Manager | Initial PRD based on Figma designs and implementation |
