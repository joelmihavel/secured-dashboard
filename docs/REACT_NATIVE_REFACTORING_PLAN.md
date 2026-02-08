# React Native Refactoring Plan
## SwiftUI to React Native Migration for Pixel-Perfect Figma Implementation

---

## Executive Summary

Migrate the existing iOS SwiftUI Flent Secured app to React Native (Expo SDK 52+) to achieve pixel-perfect Figma design implementation. The current iOS project has 40+ screens with a mature design system that will be preserved and adapted.

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Initialize Expo Project
```bash
npx create-expo-app@latest flent-secured-rn -t expo-template-blank-typescript
cd flent-secured-rn
```

### 1.2 Install Core Dependencies
```bash
# Navigation
npx expo install expo-router expo-linking expo-constants

# UI & Styling
npx expo install nativewind tailwindcss
npx expo install expo-linear-gradient expo-blur

# Animations
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install lottie-react-native moti

# Fonts & Assets
npx expo install expo-font expo-asset expo-image expo-splash-screen

# State & Data
npm install zustand @tanstack/react-query
npm install @supabase/supabase-js

# Utilities
npx expo install expo-haptics expo-secure-store expo-status-bar
npx expo install react-native-safe-area-context react-native-screens
npm install date-fns zod
```

### 1.3 Project Structure
```
flent-secured-rn/
├── app/                          # expo-router file-based routing
│   ├── _layout.tsx              # Root layout with providers
│   ├── index.tsx                # Entry redirect
│   ├── (auth)/                  # Auth flow screens
│   │   ├── _layout.tsx
│   │   ├── splash.tsx           # Screen 1: Splash/Get Started
│   │   ├── beta-splash.tsx      # Screen 13: Beta Launch splash
│   │   ├── carousel.tsx         # Screens 7,8,10: Onboarding carousel
│   │   ├── sign-up.tsx          # Screens 5,6,11,14: Sign up form
│   │   └── otp.tsx              # Screens 3,9,12,15: OTP verification
│   └── (main)/                  # Main app (future screens)
│       └── _layout.tsx
├── src/
│   ├── components/
│   │   ├── ui/                  # Design system components
│   │   └── composed/            # Feature components
│   ├── theme/                   # Design tokens
│   ├── hooks/                   # Custom hooks
│   ├── services/                # API layer
│   ├── stores/                  # Zustand stores
│   ├── utils/                   # Utilities
│   └── types/                   # TypeScript types
├── assets/
│   ├── fonts/                   # Plus Jakarta Sans, Inter
│   ├── images/                  # Logos, icons
│   └── animations/              # Lottie files
└── figma/
    └── baselines/               # Figma screenshots for comparison
```

---

## Phase 2: Design Token System

### 2.1 Colors (from Figma + existing iOS)
| Token | Hex | Usage |
|-------|-----|-------|
| black.700 | #131313 | Primary background |
| black.600 | #1A1A1A | Card/surface background |
| black.500 | #202020 | Disabled backgrounds |
| black.400 | #4D4D4D | Borders, dividers |
| black.300 | #797979 | Muted text |
| black.200 | #A6A6A6 | Secondary text |
| brand.400 | #FFAE8A | Accent light |
| brand.500 | #FF9A6D | Primary accent (orange) |
| brand.600 | #CC7B57 | Accent pressed |
| error | #FF8080 | Error states |
| neutral.200 | #DDDDDD | Primary text (white-ish) |

### 2.2 Typography
| Style | Size | Weight | Font |
|-------|------|--------|------|
| h1 | 48px | Regular | Plus Jakarta Sans |
| h2 | 40px | Regular | Plus Jakarta Sans |
| h3 | 32px | Regular | Plus Jakarta Sans |
| h5 | 24px | Medium | Plus Jakarta Sans |
| bodyMd | 16px | SemiBold | Plus Jakarta Sans |
| bodyMd2 | 14px | Regular | Plus Jakarta Sans |
| bodySm | 12px | Regular | Plus Jakarta Sans |
| button | 16px | SemiBold | Plus Jakarta Sans |
| otpInput | 28px | Bold | Plus Jakarta Sans |

### 2.3 Spacing Scale
```
xxxs: 2, xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48, huge: 64
```

### 2.4 Border Radius
```
sm: 8, md: 12, lg: 16, xl: 24, pill: 200
```

---

## Phase 3: Screen Implementation (15 Screens)

### Screen Inventory from Figma

| # | Node ID | Screen Name | Description | Priority |
|---|---------|-------------|-------------|----------|
| 1 | 1-28055 | SplashScreen | "Make your rent work for you" + Get Started | P0 |
| 2 | 1-28071 | BetaSplashScreen | Logo + "BETA LAUNCH" badge | P0 |
| 3 | 1-28985 | CarouselSlide1 | "Earn 1% back on your rent" | P0 |
| 4 | 1-29025 | CarouselSlide2 | "More than just cashback" | P0 |
| 5 | 1-29065 | CarouselSlide3 | "Your landlord benefits too" | P0 |
| 6 | 1-29108 | SignUpEmpty | Empty form state | P0 |
| 7 | 1-31073 | SignUpFilled | Filled + consent enabled | P0 |
| 8 | 1-31671 | SignUpErrorExists | "This number already exists" | P0 |
| 9 | 1-31590 | SignUpErrorInvalid | "Enter valid number" | P0 |
| 10 | 1-31175 | OTPEmpty | Empty OTP boxes | P0 |
| 11 | 1-31277 | OTPFilled | Filled + Proceed active | P0 |
| 12 | 1-31485 | OTPErrorWrong | "Wrong Code" error | P0 |
| 13 | 1-31380 | OTPErrorAttempts | "Too many Attempts" error | P0 |
| 14 | 1-31753 | (Arrow element) | Navigation element | P1 |
| 15 | 1-31752 | (Arrow element) | Navigation element | P1 |

### Component Breakdown

#### Shared Components (Build First)
1. **PrimaryButton** - Gradient button with press animation
2. **Text** - Typography wrapper with design tokens
3. **PhoneInput** - Country code + phone number input
4. **TextInput** - Standard text input with label
5. **OTPInput** - 6-digit OTP boxes with auto-focus
6. **ConsentToggle** - Toggle switch with label
7. **Logo** - Keyhole logo component
8. **DottedPattern** - Background dot pattern
9. **CarouselDots** - Page indicator dots

#### Screen Components
1. **SplashScreen** - Hero text + CTA + login link
2. **BetaSplashScreen** - Centered logo with badge
3. **OnboardingCarousel** - Swipeable carousel with 3 slides
4. **SignUpScreen** - Form with phone, name, consent (4 states)
5. **OTPScreen** - Bottom sheet with OTP input (4 states)

---

## Phase 4: Implementation Workflow

### Per-Screen Process (Pixel-Perfect)

```
For each screen:
1. FETCH: Get Figma screenshot via MCP (already done)
2. EXTRACT: Document exact values (colors, spacing, typography)
3. VERIFY: Check design tokens exist, create if missing
4. BUILD: Implement component bottom-up
5. COMPARE: Screenshot simulator vs Figma
6. DIFF: Run pixel comparison (target < 2%)
7. FIX: Iterate until passing threshold
8. COMMIT: Git commit with Figma node reference
```

### Parallel Work Streams

```
Stream A (Foundation):          Stream B (Screens):
├─ Project setup               ├─ Wait for Stream A
├─ Design tokens               ├─ SplashScreen
├─ Shared components           ├─ BetaSplashScreen
├─ Navigation setup            ├─ OnboardingCarousel
└─ Font loading                ├─ SignUpScreen
                               └─ OTPScreen
```

---

## Phase 5: Quality Gates

### Visual Regression Testing
- Screenshot each screen in simulator
- Compare against Figma baselines
- Track pixel diff percentage

### Acceptance Criteria
- [ ] All 15 screens implemented
- [ ] Pixel diff < 2% for each screen
- [ ] All screen states covered (empty, filled, error)
- [ ] Animations match iOS feel
- [ ] Fonts render correctly (Plus Jakarta Sans)
- [ ] Safe area handling correct
- [ ] Dark theme consistent

---

## Implementation Order

### Day 1: Foundation
1. Create Expo project
2. Install dependencies
3. Set up folder structure
4. Create design token files (colors, typography, spacing, radius)
5. Add custom fonts (Plus Jakarta Sans)
6. Create base components (Text, PrimaryButton)

### Day 2: Auth Flow - Part 1
7. Implement SplashScreen (node 1-28055)
8. Implement BetaSplashScreen (node 1-28071)
9. Implement OnboardingCarousel (nodes 1-28985, 1-29025, 1-29065)

### Day 3: Auth Flow - Part 2
10. Implement SignUpScreen with all 4 states
11. Implement OTPScreen with all 4 states
12. Wire up navigation flow

### Day 4: Polish & Testing
13. Visual comparison testing
14. Fix pixel discrepancies
15. Add animations/haptics
16. Final review

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Expo SDK 52+ | Faster iteration, OTA updates, managed builds |
| Navigation | expo-router v4 | File-based, type-safe, modern |
| Styling | NativeWind + StyleSheet | Speed of Tailwind + precision of StyleSheet |
| State | Zustand | Simple, performant, TS-friendly |
| Animations | Reanimated 3 | 60fps, gesture support |
| Fonts | expo-font | Native font loading |

---

## File Mapping: SwiftUI → React Native

| SwiftUI File | React Native File |
|--------------|-------------------|
| AppColors.swift | src/theme/colors.ts |
| Typography.swift | src/theme/typography.ts |
| Spacing.swift | src/theme/spacing.ts |
| PrimaryButton.swift | src/components/ui/Button/PrimaryButton.tsx |
| InputField.swift | src/components/ui/Input/TextInput.tsx |
| OTPInputField.swift | src/components/ui/Input/OTPInput.tsx |
| SplashView.swift | app/(auth)/splash.tsx |
| PhoneEntryView.swift | app/(auth)/sign-up.tsx |
| OTPVerificationView.swift | app/(auth)/otp.tsx |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Font rendering differences | Test on multiple devices, use font metrics |
| Gradient rendering | Use expo-linear-gradient, verify angles |
| Background pattern | SVG or canvas-based recreation |
| Bottom sheet behavior | @gorhom/bottom-sheet for native feel |
| OTP input focus | Custom focus management with refs |

---

## Success Metrics

- **Pixel Parity**: < 2% diff from Figma for each screen
- **Performance**: 60fps animations, < 2s TTI
- **Code Quality**: TypeScript strict mode, no any types
- **Test Coverage**: Visual tests for all screen states

---

## Next Steps

1. **Approve this plan** - Confirm approach is acceptable
2. **Initialize project** - Run setup commands
3. **Create design tokens** - Port from iOS design system
4. **Build shared components** - Button, Input, Text
5. **Implement screens** - In priority order
6. **Visual testing** - Compare against Figma baselines

---

*Plan created: 2026-01-31*
*Source: Figma File HZaVuwWn6B6jOjrmxZ7Kzv*
