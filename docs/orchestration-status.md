# Multi-Agent Orchestration Status

> Master coordination document for pixel-perfect implementation of 97 Figma screens
> Orchestrator: Multi-Agent Coordinator
> Created: 2026-01-31

---

## Coordination Overview

### Active Agent Assignments

| Agent | Task | Status | Progress |
|-------|------|--------|----------|
| Master Orchestrator | Overall coordination | ACTIVE | Setup complete |
| Visual QA Agent | Pixel comparison | PENDING | Awaiting screens |
| iOS Implementation Agent | SwiftUI code | STANDBY | Ready |
| Design Token Agent | Token verification | COMPLETE | Verified |

### Workflow State Machine

```
                    +------------------+
                    |   INITIALIZED    |
                    +--------+---------+
                             |
                             v
+----------------+  +--------+---------+  +----------------+
| TOKEN_VERIFIED |<-| ANALYZING_SCREEN |->| IMPLEMENTATION |
+----------------+  +------------------+  +--------+-------+
                                                   |
                    +------------------+           v
                    |  PIXEL_COMPARE   |<---------+
                    +--------+---------+
                             |
              +------+-------+-------+------+
              |      |               |      |
              v      v               v      v
         +----+--+ +-+----+    +----+-+ +--+---+
         | PASS  | | FAIL |    | FIX  | | SKIP |
         | <2%   | | >=2% |    |      | |      |
         +-------+ +------+    +------+ +------+
```

---

## Screen Verification Queue

### Priority 1: Critical Path (28 screens)
These screens are on the user's first interaction path.

#### Group 1: Onboarding & Splash
```
Screen 1-28055: Splash
  - Figma: Available
  - SwiftUI: SplashView.swift
  - Components: Logo, Title, Subtitle, GetStartedButton, LoginLink
  - Critical values:
    * Background: #131313 (black700)
    * Title: "Make your rent work for you"
    * Accent text: #FF9A6D (brand500)
    * Button: Gradient brand400->brand500

Screen 1-28985: Onboarding 1 - "Earn 1% back"
  - Figma: Available
  - SwiftUI: OnboardingSlideView.swift
  - Verify: Carousel pagination dots, text alignment

Screen 1-29025: Onboarding 2 - "More than just cashback"
Screen 1-29065: Onboarding 3
Screen 1-29108: Onboarding 4
```

#### Group 2: Authentication
```
Screen 1-28071: Phone Entry
  - Figma: Available
  - SwiftUI: PhoneEntryView.swift
  - Components: InputField, PrimaryButton, KeyboardAvoiding
  - Critical: Country code selector, input underline color

Screen 1-31590: OTP Screen
  - SwiftUI: OTPVerificationView.swift
  - Components: OTPInputField (4-digit)
  - Critical: Digit box spacing, timer countdown
```

#### Group 5: Home Dashboard (Core)
```
Screen 41-4569: Home Zero State
  - Figma: Available (verified)
  - SwiftUI: HomeView.swift (zeroState)
  - Key measurements from Figma:
    * Header: Hi, {Name} with avatar
    * Rent due card: "Your rent is due in 10 days"
    * Setup card: 270pt width, pl-64, pr-32
    * Setup checklist: 3 items with progress indicators
    * Bottom bar: Due date + Review button

Screen 41-6385: Home with UPI + Cashbacks
  - Figma: Available (verified)
  - SwiftUI: HomeView.swift (emptyWithCashback)
  - Components: PaymentMethodCard, CashbacksTab
  - Critical: Tab selector styling, cashback amount formatting
```

---

### Priority 2: High Value (31 screens)
Payment and setup flows.

#### Group 3: Agreement Upload
```
Already implemented - Need verification only
Screens: 1-29914, 1-30001, 1-30268, 1-30178, 1-30358, 1-30090
SwiftUI: AgreementUploadView.swift
```

#### Group 4: Setup Flow
```
Screen 41-11006: Invite Landlord
  - SwiftUI: InviteLandlordView.swift
  - Critical: Phone input, WhatsApp invite button styling

Screen 41-10859: Upload Address Proof
  - SwiftUI: SetupFlowView.swift
  - Critical: Document upload UI, progress indicator
```

#### Group 6: Payment Method Selection
```
Screen 41-7005: Choose Payment Method
  - Figma: Available (verified)
  - SwiftUI: PaymentMethodSelectionView.swift
  - Components: Bottom sheet, Radio buttons
  - Critical values:
    * Sheet background: #1A1A1A (black600)
    * Selected radio: #FF9A6D (brand500)
    * "Set it up" button styling
```

#### Group 7: Payment Flow
```
Screen 41-9746: Payment Breakdown
  - SwiftUI: PaymentBreakdownView.swift
  - Components: Line items, total calculation
  - Critical: Rent + Maintenance + Cashback formatting
```

---

### Priority 3: Medium Value (23 screens)
Status and transaction screens.

#### Group 8: Application Status
```
Screen 41-11206: Welcome - In Review
  - SwiftUI: ApplicationStatusView.swift
  - Components: Status timeline, progress indicator
```

#### Group 9: Transactions
```
Screen 41-9811: Transaction Detail
  - SwiftUI: TransactionDetailView.swift
  - Components: Receipt card, download button
```

---

### Priority 4: Low Value (15 screens)
Settings and misc screens.

#### Group 10: Profile & Settings
```
Screens: 1-31277, 1-31073, 1-31175, 1-31380, 1-31485
SwiftUI: ProfileView.swift, SettingsView.swift
```

#### Group 11: Modals & Components
```
Screens: 1-31753 through 1-31758, 41-4765, 41-8450, 41-8529
Reusable components across the app
```

---

## Implementation Checklist Per Screen

### Phase Checklist Template
```markdown
## Screen: [Node ID] - [Name]

### Phase 1: Analysis
- [ ] Figma screenshot captured (@3x, 1179px width)
- [ ] Design context extracted
- [ ] Components identified
- [ ] Design tokens mapped

### Phase 2: Component Implementation
For each component:
- [ ] Exact dimensions from Figma
- [ ] Colors verified against AppColors
- [ ] Typography verified against Typography
- [ ] Spacing verified against Spacing
- [ ] Pixel diff < 0.5%

### Phase 3: Section Assembly
- [ ] Components combined
- [ ] Section spacing applied
- [ ] Pixel diff < 1%

### Phase 4: Screen Assembly
- [ ] All sections combined
- [ ] Screen-level layout applied
- [ ] Navigation working

### Phase 5: Mock Data
- [ ] FigmaMockData struct created
- [ ] isVisualTestMode flag implemented
- [ ] ViewModel defaults handled

### Phase 6: Pixel Comparison
- [ ] Simulator screenshot captured
- [ ] magick compare executed
- [ ] Pixel diff calculated

### Phase 7: Refinement
- [ ] Issues identified from diff
- [ ] One issue fixed at a time
- [ ] Re-compared after each fix
- [ ] Final diff < 2%

### Sign-off
- [ ] Comparison image saved
- [ ] Status updated in tracking
- [ ] Next screen started
```

---

## Coordination Messages

### To Visual QA Agent
```json
{
  "from": "multi-agent-coordinator",
  "to": "visual-qa-agent",
  "type": "task_assignment",
  "payload": {
    "task": "pixel_comparison",
    "screens": ["41-4569", "1-28055", "41-7005"],
    "figma_dir": "/private/tmp/.../figma_screens/",
    "target_diff": 2.0,
    "priority": "critical"
  }
}
```

### To iOS Implementation Agent
```json
{
  "from": "multi-agent-coordinator",
  "to": "ios-implementation-agent",
  "type": "task_assignment",
  "payload": {
    "task": "implement_screen",
    "node_id": "41-4569",
    "screen_name": "Home Zero State",
    "swift_file": "HomeView.swift",
    "design_tokens": {
      "background": "AppColors.black700",
      "card_bg": "AppColors.black600",
      "accent": "AppColors.brand500"
    }
  }
}
```

---

## Dependency Graph

```
Splash (1-28055)
    |
    v
Onboarding 1-4 (1-28985, 1-29025, 1-29065, 1-29108)
    |
    v
Phone Entry (1-28071)
    |
    v
OTP (1-31590)
    |
    v
Agreement Upload (1-29914..1-30090) -----> App Status (41-11206)
    |
    v
Home Zero State (41-4569)
    |
    +---> Setup Flow (41-4301..41-4537)
    |         |
    |         v
    |    Invite Landlord (41-11006)
    |         |
    |         v
    |    Address Proof (41-10859)
    |
    +---> Payment Method (41-7005)
              |
              v
         Payment Flow (41-9746..41-8901)
              |
              v
         Home Active States (41-6385..41-4093)
              |
              v
         Transactions (41-3184..41-9811)
              |
              v
         Profile/Settings (1-31277..1-31485)
```

---

## Known Issues & Blockers

### Issue 1: neutral400 Token Missing
**Problem**: AppColors.neutral400 does not exist in design system
**Solution**: Use `Color(hex: "BABABA")` inline
**Affected screens**: Multiple home states

### Issue 2: Spacer vs Padding
**Problem**: `Spacer()` takes flexible space, not fixed
**Solution**: Use `.padding()` modifiers for fixed values
**Affected screens**: Home dashboard cards

### Issue 3: ViewModel Default Values
**Problem**: ViewModel returns "there" for firstName, "0" for amounts
**Solution**: Check for default values in view layer
```swift
private var displayName: String {
    guard !isVisualTestMode else { return FigmaMockData.userName }
    let name = viewModel.firstName
    return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
}
```

---

## Session Timeline

### 2026-01-31 Session 1
- [x] Read workflow document
- [x] Analyzed screen mapping (97 screens, 11 groups)
- [x] Verified design tokens exist
- [x] Created pixel-perfect-tracking.md
- [x] Created pixel-compare.sh script
- [x] Created batch-pixel-compare.sh script
- [x] Created this orchestration status document
- [ ] Boot simulator
- [ ] Start screen 1 (Splash)

---

## Next Actions

1. **Boot iPhone 17 Simulator**
   ```bash
   xcrun simctl boot "iPhone 17"
   ```

2. **Build FlentSecured Project**
   ```bash
   cd /Users/atrishabh/Documents/Dev/Secured\ v2/ios/FlentSecured
   xcodebuild -scheme FlentSecured -destination 'platform=iOS Simulator,name=iPhone 17'
   ```

3. **Start with Splash Screen (1-28055)**
   - Navigate to Splash in app
   - Run pixel comparison
   - Fix issues until < 2%

4. **Progress Through Critical Path**
   - Onboarding 1-4
   - Phone Entry
   - OTP
   - Home Zero State

5. **Update Tracking After Each Screen**
   - Record pixel diff %
   - Document any fixes made
   - Move to next screen

---

## Resource Links

| Resource | Path |
|----------|------|
| Workflow Doc | /Users/atrishabh/Documents/Dev/Secured v2/docs/figma-to-ios-workflow.md |
| Tracking Doc | /Users/atrishabh/Documents/Dev/Secured v2/docs/pixel-perfect-tracking.md |
| Figma Screenshots | /private/tmp/.../figma_screens/ |
| Project | /Users/atrishabh/Documents/Dev/Secured v2/ios/FlentSecured/ |
| Design Tokens | /Users/atrishabh/Documents/Dev/Secured v2/ios/FlentSecured/Core/DesignSystem/ |
| Scripts | /Users/atrishabh/Documents/Dev/Secured v2/scripts/ |
