# Pixel-Perfect Implementation Tracking

> Master tracking document for 97 Figma screens pixel comparison workflow
> Created: 2026-01-31
> Target: < 2% pixel difference for all screens

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Screens | 97 |
| Figma Screenshots Available | 95 |
| Screens Verified (<2% diff) | 0 |
| Screens In Progress | 0 |
| Screens Pending | 97 |
| Average Pixel Diff | N/A |

---

## Workflow Phases

### Phase 1: Screen Analysis & Breakdown
- [ ] Component inventory created
- [ ] Design tokens verified
- [ ] Navigation paths mapped

### Phase 2-4: Component/Section/Screen Implementation
- [ ] Components built and verified (<0.5% diff)
- [ ] Sections assembled (<1% diff)
- [ ] Full screens assembled (<2% diff)

### Phase 5: Mock Data & Visual Testing
- [ ] FigmaMockData structs created
- [ ] isVisualTestMode flags implemented
- [ ] ViewModel default handling complete

### Phase 6-7: Pixel Comparison & Refinement
- [ ] All screens compared
- [ ] Issues identified and fixed
- [ ] Final verification complete

---

## Screen Queue by Priority Group

### Group 1: Onboarding & Splash (5 screens) - PRIORITY: CRITICAL
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 1 | 1-28055 | Splash | 1-28055.png | SplashView.swift | - | PENDING |
| 2 | 1-28985 | Onboarding 1 | 1-28985.png | OnboardingSlideView.swift | - | PENDING |
| 3 | 1-29025 | Onboarding 2 | 1-29025.png | OnboardingSlideView.swift | - | PENDING |
| 4 | 1-29065 | Onboarding 3 | 1-29065.png | OnboardingSlideView.swift | - | PENDING |
| 5 | 1-29108 | Onboarding 4 | 1-29108.png | OnboardingSlideView.swift | - | PENDING |

### Group 2: Authentication (8 screens) - PRIORITY: CRITICAL
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 6 | 1-28071 | Phone Entry | 1-28071.png | PhoneEntryView.swift | - | PENDING |
| 7 | 1-28053 | Phone Entry Variant | 1-28053.png | PhoneEntryView.swift | - | PENDING |
| 8 | 1-31590 | OTP Screen | 1-31590.png | OTPVerificationView.swift | - | PENDING |
| 9 | 1-31752 | Auth Component | 1-31752.png | - | - | PENDING |
| 10 | 1-34343 | Auth State 1 | 1-34343.png | - | - | PENDING |
| 11 | 1-34150 | Auth State 2 | 1-34150.png | - | - | PENDING |
| 12 | 1-33737 | Auth State 3 | 1-33737.png | - | - | PENDING |
| 13 | 1-34236 | Auth State 4 | 1-34236.png | - | - | PENDING |

### Group 3: Agreement Upload (6 screens) - PRIORITY: HIGH (ALREADY IMPLEMENTED)
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 14 | 1-29914 | Upload Initial | 1-29914.png | AgreementUploadView.swift | - | VERIFY |
| 15 | 1-30001 | Upload Progress | 1-30001.png | AgreementUploadView.swift | - | VERIFY |
| 16 | 1-30268 | Error - File Too Large | 1-30268.png | AgreementUploadView.swift | - | VERIFY |
| 17 | 1-30178 | Error - Invalid/Expired | 1-30178.png | AgreementUploadView.swift | - | VERIFY |
| 18 | 1-30358 | Manual Review | 1-30358.png | AgreementUploadView.swift | - | VERIFY |
| 19 | 1-30090 | Upload Success | 1-30090.png | AgreementUploadView.swift | - | VERIFY |

### Group 4: Setup Flow (12 screens) - PRIORITY: HIGH
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 20 | 41-10859 | Upload Address Proof | 41-10859.png | SetupFlowView.swift | - | PENDING |
| 21 | 41-11006 | Invite Landlord | 41-11006.png | InviteLandlordView.swift | - | PENDING |
| 22 | 41-10712 | Setup Variant | 41-10712.png | SetupFlowView.swift | - | PENDING |
| 23 | 41-4969 | Waiting Landlord | 41-4969.png | - | - | PENDING |
| 24 | 41-5587 | Landlord Declined | 41-5587.png | - | - | PENDING |
| 25 | 41-4301 | Setup Step 1 | 41-4301.png | SetupFlowView.swift | - | PENDING |
| 26 | 41-4559 | Setup Step 2 | 41-4559.png | SetupFlowView.swift | - | PENDING |
| 27 | 41-4323 | Setup Step 3 | 41-4323.png | SetupFlowView.swift | - | PENDING |
| 28 | 41-4345 | Setup Step 4 | 41-4345.png | SetupFlowView.swift | - | PENDING |
| 29 | 41-4430 | Setup Step 5 | 41-4430.png | SetupFlowView.swift | - | PENDING |
| 30 | 41-4515 | Setup Step 6 | 41-4515.png | SetupFlowView.swift | - | PENDING |
| 31 | 41-4537 | Setup Step 7 | 41-4537.png | SetupFlowView.swift | - | PENDING |

### Group 5: Home Dashboard (15 screens) - PRIORITY: CRITICAL
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 32 | 41-4569 | Home Zero State | 41-4569.png | HomeView.swift | - | PENDING |
| 33 | 41-6385 | Home UPI + Cashbacks | 41-6385.png | HomeView.swift | - | PENDING |
| 34 | 41-6598 | Home Variant 1 | 41-6598.png | HomeView.swift | - | PENDING |
| 35 | 41-6811 | Home Variant 2 | 41-6811.png | HomeView.swift | - | PENDING |
| 36 | 41-3677 | Home Overdue | 41-3677.png | HomeView.swift | - | PENDING |
| 37 | 41-3472 | Home State 1 | 41-3472.png | HomeView.swift | - | PENDING |
| 38 | 41-5792 | Home State 2 | 41-5792.png | HomeView.swift | - | PENDING |
| 39 | 41-5998 | Home State 3 | 41-5998.png | HomeView.swift | - | PENDING |
| 40 | 41-6204 | Home State 4 | 41-6204.png | HomeView.swift | - | PENDING |
| 41 | 41-3186 | Home State 5 | 41-3186.png | HomeView.swift | - | PENDING |
| 42 | 41-3267 | Home State 6 | 41-3267.png | HomeView.swift | - | PENDING |
| 43 | 41-5175 | Home State 7 | 41-5175.png | HomeView.swift | - | PENDING |
| 44 | 41-5381 | Home State 8 | 41-5381.png | HomeView.swift | - | PENDING |
| 45 | 41-3885 | Home State 9 | 41-3885.png | HomeView.swift | - | PENDING |
| 46 | 41-4093 | Home State 10 | 41-4093.png | HomeView.swift | - | PENDING |

### Group 6: Payment Method Selection (10 screens) - PRIORITY: HIGH
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 47 | 41-7005 | Choose Payment Method | 41-7005.png | PaymentMethodSelectionView.swift | - | PENDING |
| 48 | 41-9114 | Payment Method + Fees | 41-9114.png | PaymentMethodsView.swift | - | PENDING |
| 49 | 41-7246 | Payment Selection 1 | 41-7246.png | PaymentMethodsView.swift | - | PENDING |
| 50 | 41-7460 | Payment Selection 2 | 41-7460.png | PaymentMethodsView.swift | - | PENDING |
| 51 | 41-7674 | Payment Card 1 | 41-7674.png | PaymentMethodsView.swift | - | PENDING |
| 52 | 41-7675 | Payment Card 2 | 41-7675.png | PaymentMethodsView.swift | - | PENDING |
| 53 | 41-7676 | Payment Card 3 | 41-7676.png | PaymentMethodsView.swift | - | PENDING |
| 54 | 41-7741 | Payment Method 4 | 41-7741.png | PaymentMethodsView.swift | - | PENDING |
| 55 | 41-8367 | Profile Section Header | 41-8367.png | ProfileView.swift | - | PENDING |
| 56 | 41-8369 | Payment/Profile | 41-8369.png | ProfileView.swift | - | PENDING |

### Group 7: Payment Flow & Breakdown (12 screens) - PRIORITY: HIGH
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 57 | 41-9746 | Payment Breakdown | 41-9746.png | PaymentBreakdownView.swift | - | PENDING |
| 58 | 41-9635 | Payment State 1 | 41-9635.png | PaymentView.swift | - | PENDING |
| 59 | 41-9460 | Payment State 2 | 41-9460.png | PaymentView.swift | - | PENDING |
| 60 | 41-9563 | Payment Confirmation | 41-9563.png | PaymentSummaryView.swift | - | PENDING |
| 61 | 41-9681 | Payment State 3 | 41-9681.png | PaymentView.swift | - | PENDING |
| 62 | 41-9511 | Payment State 4 | 41-9511.png | PaymentView.swift | - | PENDING |
| 63 | 41-8612 | Payment State 5 | 41-8612.png | PaymentView.swift | - | PENDING |
| 64 | 41-8693 | Payment State 6 | 41-8693.png | PaymentView.swift | - | PENDING |
| 65 | 41-8695 | Payment State 7 | 41-8695.png | PaymentView.swift | - | PENDING |
| 66 | 41-8760 | Payment State 8 | 41-8760.png | PaymentView.swift | - | PENDING |
| 67 | 41-8880 | Payment State 9 | 41-8880.png | PaymentView.swift | - | PENDING |
| 68 | 41-8901 | Payment State 10 | 41-8901.png | PaymentView.swift | - | PENDING |

### Group 8: Application Status & Review (8 screens) - PRIORITY: MEDIUM
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 69 | 41-11206 | Welcome - In Review | 41-11206.png | ApplicationStatusView.swift | - | PENDING |
| 70 | 41-11825 | Setting Things Up | 41-11825.png | ApplicationStatusView.swift | - | PENDING |
| 71 | 41-11313 | Status Variant 1 | - | ApplicationStatusView.swift | - | NO_FIGMA |
| 72 | 41-11410 | Status Variant 2 | - | ApplicationStatusView.swift | - | NO_FIGMA |
| 73 | 41-11506 | Status Variant 3 | - | ApplicationStatusView.swift | - | NO_FIGMA |
| 74 | 41-11613 | Status Variant 4 | - | ApplicationStatusView.swift | - | NO_FIGMA |
| 75 | 41-11720 | Status Variant 5 | - | ApplicationStatusView.swift | - | NO_FIGMA |
| 76 | 1-30820 | Status Confirmation | 1-30820.png | ApplicationStatusView.swift | - | PENDING |

### Group 9: Transactions & History (6 screens) - PRIORITY: MEDIUM
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 77 | 41-3184 | Transactions Header | 41-3184.png | TransactionsView.swift | - | PENDING |
| 78 | 41-9004 | Transaction State 1 | 41-9004.png | TransactionsView.swift | - | PENDING |
| 79 | 41-9224 | Transaction Detail 1 | - | TransactionDetailView.swift | - | NO_FIGMA |
| 80 | 41-9307 | Transaction State 2 | 41-9307.png | TransactionsView.swift | - | PENDING |
| 81 | 41-9388 | Transaction State 3 | 41-9388.png | TransactionsView.swift | - | PENDING |
| 82 | 41-9811 | Transaction Detail 2 | 41-9811.png | TransactionDetailView.swift | - | PENDING |

### Group 10: Profile & Settings (5 screens) - PRIORITY: LOW
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 83 | 1-31277 | Profile Main | 1-31277.png | ProfileView.swift | - | PENDING |
| 84 | 1-31073 | Settings 1 | 1-31073.png | SettingsView.swift | - | PENDING |
| 85 | 1-31175 | Settings 2 | 1-31175.png | SettingsView.swift | - | PENDING |
| 86 | 1-31380 | Settings 3 | 1-31380.png | SettingsView.swift | - | PENDING |
| 87 | 1-31485 | Settings 4 | 1-31485.png | SettingsView.swift | - | PENDING |

### Group 11: Misc States & Modals (10 screens) - PRIORITY: LOW
| # | Node ID | Screen Name | Figma File | Swift File | Pixel Diff | Status |
|---|---------|-------------|------------|------------|------------|--------|
| 88 | 1-31671 | Misc State 1 | 1-31671.png | - | - | PENDING |
| 89 | 1-31753 | Component 1 | 1-31753.png | - | - | PENDING |
| 90 | 1-31754 | Component 2 | 1-31754.png | - | - | PENDING |
| 91 | 1-31756 | Component 3 | 1-31756.png | - | - | PENDING |
| 92 | 1-31757 | Component 4 | 1-31757.png | - | - | PENDING |
| 93 | 1-31758 | Component 5 | 1-31758.png | - | - | PENDING |
| 94 | 1-30448 | State | 1-30448.png | - | - | PENDING |
| 95 | 41-4765 | Modal 1 | 41-4765.png | - | - | PENDING |
| 96 | 41-8450 | Modal 2 | 41-8450.png | - | - | PENDING |
| 97 | 41-8529 | Modal 3 | 41-8529.png | - | - | PENDING |

---

## Verification Commands

### Screenshot Capture
```bash
# Boot iPhone 17 simulator
xcrun simctl boot "iPhone 17"

# Capture screenshot
xcrun simctl io booted screenshot /tmp/simulator_screenshot.png
```

### Pixel Comparison
```bash
# Resize simulator to match Figma width (1179px at @3x)
magick /tmp/simulator_screenshot.png -resize 1179x /tmp/sim_resized.png

# Get simulator height for cropping
SIM_HEIGHT=$(identify -format "%h" /tmp/sim_resized.png)

# Crop Figma to match
magick /path/to/figma.png -crop "1179x${SIM_HEIGHT}+0+0" +repage /tmp/figma_cropped.png

# Calculate pixel difference
DIFF=$(magick compare -metric AE -fuzz 5% /tmp/figma_cropped.png /tmp/sim_resized.png null: 2>&1)

# Calculate percentage
TOTAL=$(identify -format "%[fx:w*h]" /tmp/figma_cropped.png)
PERCENT=$(python3 -c "print(f'{($DIFF / $TOTAL) * 100:.2f}')")
echo "Pixel difference: ${PERCENT}%"

# Generate visual diff
magick compare -highlight-color red -fuzz 5% /tmp/figma_cropped.png /tmp/sim_resized.png /tmp/diff.png

# Side-by-side comparison
magick /tmp/figma_cropped.png /tmp/sim_resized.png /tmp/diff.png +append /tmp/comparison.png
```

---

## Design Token Reference

### Colors (AppColors.swift)
```swift
// Black scale
black700 = #131313  // Primary background
black600 = #1A1A1A  // Card background
black500 = #202020  // Disabled/elevated
black400 = #4D4D4D  // Borders
black300 = #797979  // Muted text
black200 = #A6A6A6  // Secondary text

// Neutral scale (NO neutral400!)
neutral100 = #EEEEEE
neutral200 = #DDDDDD
neutral300 = #CBCBCB
neutral500 = #A9A9A9
neutral600 = #878787
neutral800 = #444444
neutral900 = #222222

// Brand
brand400 = #FFAE8A  // Accent light
brand500 = #FF9A6D  // Primary accent
brand600 = #CC7B57  // Accent dark

// Semantic
success = #70BF73
error = #FF8080
warning = #FFD580
```

### Typography (Typography.swift)
```swift
h1 = 48px Regular
h2 = 40px Regular
h3 = 32px Regular
h4 = 28px Regular
h5 = 24px Medium
h6 = 20px SemiBold
bodyLg = 20px Regular
bodyMd = 16px SemiBold
bodyMd2 = 14px Regular
bodySm = 12px Regular
```

### Spacing (Spacing.swift)
```swift
xxs = 4pt
xs = 8pt
sm = 12pt
md = 16pt
lg = 24pt
xl = 32pt
xxl = 40pt
xxxl = 48pt
huge = 64pt
```

### Radius (Radius.swift)
```swift
xs = 4pt
sm = 8pt
md = 12pt
lg = 16pt
xl = 24pt
xxl = 40pt
pill = 200pt
```

---

## Figma File Info

- **File Key**: HZaVuwWn6B6jOjrmxZ7Kzv
- **Screenshots Location**: /private/tmp/claude-501/-Users-atrishabh-Documents-Dev/02a8fb93-1b76-4373-9d05-447368f836a9/scratchpad/figma_screens/
- **Reference Device**: iPhone 14 Pro (393pt width, 852pt height)
- **Screenshot Scale**: @3x (1179 x 2556 pixels)

---

## Common Issues & Fixes

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Token doesn't exist | Used `AppColors.neutral400` | Use `Color(hex: "BABABA")` |
| Spacer takes wrong space | Used `Spacer()` for fixed padding | Use `.padding()` modifier |
| Screenshot != design context | MCP returns different variant | Trust screenshot |
| Card shifted | Mixed Spacer and padding | Use explicit padding only |
| Font looks wrong | Hardcoded font name | Use `Typography.*` token |
| Scaling breaks | Hardcoded pixel values | Use `DesignScale.scaled()` |
| ViewModel shows "there" | Default value not handled | Check for default values |

---

## Session Log

### 2026-01-31 - Initial Setup
- Created tracking document
- Analyzed 97 screens across 11 feature groups
- 95 Figma screenshots available
- Design tokens verified in AppColors, Typography, Spacing, Radius
- Ready to begin pixel comparison workflow

---

## Next Steps

1. **Boot iPhone 17 Simulator**
2. **Build FlentSecured app**
3. **Start with Group 1 (Splash)** - Screen 1-28055
4. **Navigate to screen, capture, compare**
5. **Fix issues until < 2% diff**
6. **Update this tracking document**
7. **Proceed to next screen**
