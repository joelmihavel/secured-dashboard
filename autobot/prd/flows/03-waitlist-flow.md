# Flow 3: Waitlist -- PRD

## Overview

The waitlist flow manages user queueing after OTP verification. New users are placed in a waitlist with a position indicator and estimated wait time. The flow supports 6 states covering the full lifecycle: pending, accepted, rejected, extended wait (24hrs+), and referral code entry (valid/invalid). This is a single-screen flow with rich visual states.

**Entry Point**: Successful OTP verification --> waitlist status check
**Exit Point**: Accepted --> Flow 4 (Agreement) | Rejected --> End
**Total States**: 6
**Total Stories**: 20 (6 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### Waitlist Screen (/(waitlist)/index)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 41-11206 | Pending state with position number, estimated wait time, benefits card, progress arc |
| accepted | 41-11313 | Accepted state with congratulations message, CTA to continue to agreement |
| rejected | 41-11410 | Rejected state with message explaining rejection, option to contact support |
| 24hrs | 41-11506 | Long wait state (>24 hours), updated messaging, referral code prompt to skip |
| referral | 41-11613 | Referral code entry state, text input for code, submit button |
| referral-invalid | 41-11720 | Invalid referral code, error message below input, retry option |

**Route Params**:
- `?state=pending` (default)
- `?state=accepted`
- `?state=rejected`
- `?state=pending_long` (24hrs)
- `?state=referral`
- `?state=referral_invalid`

### State Details

#### Default (Pending)
**Key Elements**:
- ProgressArc showing waitlist position (circular arc with position number)
- "You're on the waitlist!" headline
- Position text: "Position #XX"
- Estimated wait time
- BenefitsCard showing what the user will get once accepted
- ApplicationTimeline showing onboarding steps
- Background: dark screen (#131313)

**Functional Requirements**:
- Polls waitlist status every 30 seconds
- Updates position and estimate in real-time
- ProgressArc animates on position change

#### Accepted
**Key Elements**:
- Success icon/animation
- "You're in!" or "Congratulations!" headline
- Brief welcome message
- PrimaryButton "Continue" to proceed to agreement
- BenefitsCard (now accessible)

**Functional Requirements**:
- CTA navigates to /(agreement)/upload
- Waitlist store updated with accepted status
- No back navigation (can't return to waitlist once accepted)

#### Rejected
**Key Elements**:
- Rejection icon
- "We're sorry" headline
- Explanation text
- "Contact Support" TextButton
- Option to reapply or check later

**Functional Requirements**:
- Support link opens email or in-app help
- No navigation forward
- Can retry after cooldown period

#### 24hrs (Extended Wait)
**Key Elements**:
- Same layout as default but with updated messaging
- "Taking longer than expected" subtitle
- Referral code prompt: "Have a referral code? Skip the wait!"
- TextButton "Enter referral code" to switch to referral state
- Updated ProgressArc (still showing position)

**Functional Requirements**:
- Triggers after 24 hours on waitlist
- Referral code CTA navigates to referral entry state
- Polling continues

#### Referral (Code Entry)
**Key Elements**:
- ReferralCodeInput component (text input for referral code)
- "Enter referral code" headline
- Description text explaining referral benefits
- PrimaryButton "Apply Code"
- TextButton "Skip" or "Back" to return to waitlist view

**Functional Requirements**:
- Text input accepts alphanumeric codes
- CTA disabled until code entered
- Submit calls referral validation API
- Success: transitions to accepted state
- Failure: transitions to referral-invalid state

#### Referral Invalid
**Key Elements**:
- Same layout as referral state
- ReferralCodeInput with error styling (red border)
- Error message: "Invalid referral code" below input
- PrimaryButton "Try Again"
- TextButton to go back to waitlist

**Functional Requirements**:
- Error message displayed in red below input
- Input retains entered code
- "Try Again" clears error and allows re-entry
- Can dismiss and return to waitlist view

### State Transitions

```
[OTP Verified] --> default (pending)
default --> (polled: accepted) --> accepted
default --> (polled: rejected) --> rejected
default --> (>24hrs elapsed) --> 24hrs
24hrs --> (tap referral CTA) --> referral
referral --> (valid code) --> accepted
referral --> (invalid code) --> referral-invalid
referral-invalid --> (retry) --> referral
accepted --> [EXIT: Agreement Upload]
rejected --> [END]
```

## Shared Components Used

| Component | Usage |
|-----------|-------|
| Screen | Base screen wrapper |
| Text | Headlines, descriptions, position text, error messages |
| PrimaryButton | "Continue" (accepted), "Apply Code" (referral) |
| TextButton | "Enter referral code", "Contact Support", "Skip", "Back" |
| TextInput | Used inside ReferralCodeInput |
| ProgressArc | Circular progress indicator with position number |
| BenefitsCard | Feature benefits display card |
| ApplicationTimeline | Onboarding step timeline |
| ReferralCodeInput | Referral code entry input |

## Stories

### Waitlist -- Default/Pending (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 41-11206 (waitlist default) | 1 |
| 1.2 | BUILD: Implement pending state with ProgressArc, BenefitsCard, ApplicationTimeline | 8 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Waitlist -- Accepted (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 41-11313 (waitlist accepted) | 1 |
| 2.2 | BUILD: Implement accepted state with success messaging and CTA | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Waitlist -- Rejected (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 41-11410 (waitlist rejected) | 1 |
| 3.2 | BUILD: Implement rejected state with support CTA | 3 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Waitlist -- 24hrs Extended Wait (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 41-11506 (waitlist 24hrs) | 1 |
| 4.2 | BUILD: Implement extended wait state with referral prompt | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Waitlist -- Referral Entry (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 41-11613 (waitlist referral) | 1 |
| 5.2 | BUILD: Implement referral code entry with ReferralCodeInput | 5 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Waitlist -- Referral Invalid (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 41-11720 (waitlist referral-invalid) | 1 |
| 6.2 | BUILD: Implement invalid referral state with error styling | 3 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | FLOW TEST: Maestro E2E test covering waitlist states, polling, referral entry | 3 |
| 7.2 | SYSTEM IMPROVEMENT: Refine ProgressArc, BenefitsCard, or pipeline issues | 3 |

**Total: 20 stories, 60 points**

## Dependencies

- **Upstream**: Flow 2 (OTP) -- successful verification triggers waitlist check
- **Downstream**: Flow 4 (Agreement) -- accepted state leads to agreement upload
- **Shared Components**: ProgressArc, BenefitsCard, ApplicationTimeline, ReferralCodeInput are waitlist-specific but must be reusable. TextInput pattern from Flow 1.
- **Backend**: `check-status`, `submit-referral`, `poll-status` Supabase edge functions
- **State**: waitlistStore (Zustand) manages waitlist status persistence

## Backend Integration

| Endpoint | Trigger | Response |
|----------|---------|----------|
| check-status | Screen mount, polling | { status: pending/accepted/rejected, position: number, estimatedWait: string } |
| poll-status | 30-second interval | Same as check-status, updates in real-time |
| submit-referral | Tap "Apply Code" | success: status becomes accepted | invalid: error response |

## Exit Criteria

1. All 6 waitlist states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 6 states
3. ODiff <=3% (no DottedPattern on waitlist screens)
4. ProgressArc renders correctly with dynamic position data
5. BenefitsCard and ApplicationTimeline display all content
6. Referral code entry handles valid, invalid, and empty cases
7. State transitions work correctly (polling updates, referral flow)
8. Maestro flow test passes: waitlist pending --> referral entry --> accepted --> navigate to agreement
9. Zero TypeScript errors, zero ESLint warnings
10. No regressions in Flows 1-2
