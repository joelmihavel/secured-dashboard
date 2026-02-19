# Flow 1: Authentication -- PRD

## Overview

The authentication flow is the user's first interaction with Flent Secured. It covers the app launch experience through to phone number submission. The flow establishes brand identity through the splash screens, communicates value through the carousel, and captures the user's phone number for OTP verification.

**Entry Point**: App launch (cold start)
**Exit Point**: Phone number submitted --> Flow 2 (OTP Verification)
**Total States**: 8
**Total Stories**: 26 (8 states x 3 + 1 flow test + 1 system improvement)

## Screens & States

### 1. Splash (/(auth)/splash)

| State | Figma ID | Description |
|-------|----------|-------------|
| default | 1-28053 | Static splash screen with Flent Secured logo centered, "Get Started" CTA button at bottom |
| animation | 1-28055 | Animated splash variant with DottedPattern background, gradient overlay, logo animation |

**Key Elements**:
- Logo component (centered)
- DottedPattern background (backgroundShape: "splash")
- "Get Started" PrimaryButton at bottom
- Brand gradient overlay (animation state)
- Background image (image-149)

**Functional Requirements**:
- Auto-advance to beta-splash after animation completes (if animation state)
- Tap "Get Started" navigates to carousel
- StatusBar light content

### 2. Beta Splash (/(auth)/beta-splash)

| State | Figma ID | Description |
|-------|----------|-------------|
| beta | 1-28071 | Beta launch variant with "BETA LAUNCH" badge, same layout as splash |

**Key Elements**:
- Logo component (centered)
- "BETA LAUNCH" text badge
- Background image (image-149)
- Navigation to carousel on tap

**Functional Requirements**:
- Displays beta indicator
- Tap anywhere or after timeout navigates to carousel

### 3. Carousel (/(auth)/carousel)

| State | Figma ID | Description |
|-------|----------|-------------|
| page4 | 1-28985 | Feature highlight page 4 -- illustrates a key product benefit |
| page5 | 1-29025 | Feature highlight page 5 -- illustrates a key product benefit |
| page6 | 1-29065 | Final carousel page with "Get Started" CTA to sign up |

**Key Elements**:
- DottedPattern background (backgroundShape per page)
- Feature illustration image
- Headline text (bold, white)
- Description text (regular, gray)
- CarouselDots indicator (3 dots, active state matches current page)
- PrimaryButton "Get Started" (page 6 only, or all pages)
- Background shape image (background-shape, image-149)

**Route Params**: `?page=4`, `?page=5`, `?page=6`

**Functional Requirements**:
- Horizontal swipe between pages
- CarouselDots updates on page change
- "Get Started" on final page navigates to sign-up
- Back swipe works between pages
- Page indicator reflects current position

### 4. Sign Up (/(auth)/sign-up)

| State | Figma ID | Description |
|-------|----------|-------------|
| empty | 1-29108 | Empty phone number input, CTA disabled, consent toggle unchecked |
| filled | 1-29914 | Phone number entered, CTA enabled, consent toggle checked |

**Key Elements**:
- DottedPattern background (backgroundShape: default or sign-up)
- Logo at top
- "Enter your phone number" headline
- PhoneInput component with +91 country code prefix
- ConsentToggle for terms acceptance
- PrimaryButton "Continue" (disabled when empty, enabled when filled + consent)
- "By continuing..." terms text
- Background images (ellipse-26, image-148, rectangle-30)

**Route Params**: `?state=empty`, `?state=filled`

**Functional Requirements**:
- Phone number validation (10 digits, Indian mobile format)
- PrimaryButton disabled until: valid phone + consent checked
- Keyboard auto-opens on mount
- ConsentToggle must be checked to proceed
- "Continue" submits phone number, navigates to OTP screen
- Error handling for network failures

## Shared Components Used

| Component | Screens Using It |
|-----------|-----------------|
| Screen | All 4 screens |
| Text | All 4 screens |
| PrimaryButton | splash, carousel (page6), sign-up |
| DottedPattern | splash (animation), carousel (all), sign-up |
| Logo | splash, beta-splash, sign-up |
| PhoneInput | sign-up |
| ConsentToggle | sign-up |
| CarouselDots | carousel |

## Stories

### Splash -- Default (3 stories)
| # | Story | Points |
|---|-------|--------|
| 1.1 | EXTRACT: Pull blueprint for 1-28053 (splash default) | 1 |
| 1.2 | BUILD: Implement splash default state matching blueprint | 5 |
| 1.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Splash -- Animation (3 stories)
| # | Story | Points |
|---|-------|--------|
| 2.1 | EXTRACT: Pull blueprint for 1-28055 (splash animation) | 1 |
| 2.2 | BUILD: Implement splash animation state with DottedPattern | 5 |
| 2.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Beta Splash (3 stories)
| # | Story | Points |
|---|-------|--------|
| 3.1 | EXTRACT: Pull blueprint for 1-28071 (beta splash) | 1 |
| 3.2 | BUILD: Implement beta splash state | 3 |
| 3.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Carousel -- Page 4 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 4.1 | EXTRACT: Pull blueprint for 1-28985 (carousel page 4) | 1 |
| 4.2 | BUILD: Implement carousel page 4 with DottedPattern | 5 |
| 4.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Carousel -- Page 5 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 5.1 | EXTRACT: Pull blueprint for 1-29025 (carousel page 5) | 1 |
| 5.2 | BUILD: Implement carousel page 5 | 3 |
| 5.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Carousel -- Page 6 (3 stories)
| # | Story | Points |
|---|-------|--------|
| 6.1 | EXTRACT: Pull blueprint for 1-29065 (carousel page 6) | 1 |
| 6.2 | BUILD: Implement carousel page 6 with CTA | 3 |
| 6.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Sign Up -- Empty (3 stories)
| # | Story | Points |
|---|-------|--------|
| 7.1 | EXTRACT: Pull blueprint for 1-29108 (sign-up empty) | 1 |
| 7.2 | BUILD: Implement sign-up empty state with PhoneInput | 5 |
| 7.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Sign Up -- Filled (3 stories)
| # | Story | Points |
|---|-------|--------|
| 8.1 | EXTRACT: Pull blueprint for 1-29914 (sign-up filled) | 1 |
| 8.2 | BUILD: Implement sign-up filled state | 3 |
| 8.3 | VERIFY+CERTIFY: Run BuildBot pipeline, achieve certification | 2 |

### Flow-Level Stories (2 stories)
| # | Story | Points |
|---|-------|--------|
| 9.1 | FLOW TEST: Maestro E2E test covering splash --> carousel --> sign-up | 3 |
| 9.2 | SYSTEM IMPROVEMENT: Address component or pipeline issues discovered during auth flow | 3 |

**Total: 26 stories, 72 points**

## Dependencies

- **Upstream**: None (this is the first flow)
- **Downstream**: Flow 2 (OTP) depends on sign-up completion
- **Shared Components**: This flow establishes patterns for Screen, DottedPattern, PrimaryButton, Logo, Text that all subsequent flows depend on

## DottedPattern Configuration

| Screen | backgroundShape Key |
|--------|-------------------|
| splash (animation) | splash |
| carousel page 4 | carousel1 |
| carousel page 5 | carousel2 |
| carousel page 6 | carousel3 |
| sign-up | default |

**Rule**: Each screen has its own Figma background asset. Available keys: splash, carousel1-3, agreement, default. Never use "default" blindly -- verify the correct key from the blueprint.

## Exit Criteria

1. All 8 screen states achieve CERTIFIED status in BuildBot
2. Coverage >=98% for all 8 states
3. ODiff <=18% for DottedPattern screens, <=3% for non-DottedPattern
4. Maestro flow test passes: splash --> beta-splash --> carousel (swipe 3 pages) --> sign-up (enter phone) --> navigate to OTP
5. Zero TypeScript errors, zero ESLint warnings
6. All shared components (Screen, DottedPattern, PrimaryButton, Logo, PhoneInput, ConsentToggle, CarouselDots) established and reusable
7. No regressions in existing tests
