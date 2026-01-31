# Pixel-Perfect Implementation Quick Start Guide

> Get started with pixel-perfect verification for FlentSecured iOS app

---

## Prerequisites

1. **Xcode installed** with iOS Simulator
2. **ImageMagick installed** for pixel comparison
   ```bash
   brew install imagemagick
   ```
3. **Python 3** for percentage calculations

---

## Quick Start (5 minutes)

### Step 1: Boot Simulator
```bash
xcrun simctl boot "iPhone 17"
open -a Simulator
```

### Step 2: Build the App
```bash
cd /Users/atrishabh/Documents/Dev/Secured\ v2/ios/FlentSecured
xcodebuild -scheme FlentSecured -destination 'platform=iOS Simulator,name=iPhone 17'
```

Or open in Xcode and press Cmd+R.

### Step 3: Navigate to Target Screen
Launch the app and navigate to the screen you want to verify.

### Step 4: Run Pixel Comparison
```bash
# Make script executable
chmod +x /Users/atrishabh/Documents/Dev/Secured\ v2/scripts/pixel-compare.sh

# Run comparison
/Users/atrishabh/Documents/Dev/Secured\ v2/scripts/pixel-compare.sh \
  "/private/tmp/claude-501/-Users-atrishabh-Documents-Dev/02a8fb93-1b76-4373-9d05-447368f836a9/scratchpad/figma_screens/41-4569.png" \
  "Home Zero State"
```

### Step 5: Review Results
- If **PASS** (< 2%): Move to next screen
- If **FAIL** (>= 2%): Review diff image, fix issues, repeat

---

## Screen Priority Order

Start with these screens in order:

### Critical Path (Do First)
| # | Node ID | Screen | Figma File |
|---|---------|--------|------------|
| 1 | 1-28055 | Splash | 1-28055.png |
| 2 | 1-28985 | Onboarding 1 | 1-28985.png |
| 3 | 1-28071 | Phone Entry | 1-28071.png |
| 4 | 1-31590 | OTP | 1-31590.png |
| 5 | 41-4569 | Home Zero State | 41-4569.png |
| 6 | 41-7005 | Payment Method | 41-7005.png |

### High Value (Do Second)
| # | Node ID | Screen | Figma File |
|---|---------|--------|------------|
| 7 | 41-6385 | Home UPI+Cashbacks | 41-6385.png |
| 8 | 41-9746 | Payment Breakdown | 41-9746.png |
| 9 | 1-29914 | Agreement Upload | 1-29914.png |
| 10 | 41-11006 | Invite Landlord | 41-11006.png |

---

## Manual Pixel Comparison Commands

### Capture Screenshot
```bash
xcrun simctl io booted screenshot /tmp/simulator.png
```

### Resize to Figma Width (1179px @ 3x)
```bash
magick /tmp/simulator.png -resize 1179x /tmp/sim_resized.png
```

### Crop Figma to Match
```bash
SIM_HEIGHT=$(identify -format "%h" /tmp/sim_resized.png)
magick /path/to/figma.png -crop "1179x${SIM_HEIGHT}+0+0" +repage /tmp/figma_cropped.png
```

### Calculate Difference
```bash
DIFF=$(magick compare -metric AE -fuzz 5% /tmp/figma_cropped.png /tmp/sim_resized.png null: 2>&1)
TOTAL=$(identify -format "%[fx:w*h]" /tmp/figma_cropped.png)
python3 -c "print(f'{($DIFF / $TOTAL) * 100:.2f}%')"
```

### Generate Visual Diff
```bash
magick compare -highlight-color red -fuzz 5% /tmp/figma_cropped.png /tmp/sim_resized.png /tmp/diff.png
```

### Side-by-Side
```bash
magick /tmp/figma_cropped.png /tmp/sim_resized.png /tmp/diff.png +append /tmp/comparison.png
open /tmp/comparison.png
```

---

## Common Fixes

### Issue: Colors Don't Match
**Check**: Are you using design tokens?
```swift
// Bad
Color(hex: "FF9A6D")

// Good
AppColors.brand500
```

### Issue: Spacing Off
**Check**: Are you using Spacing tokens?
```swift
// Bad
.padding(16)

// Good
.padding(Spacing.md)
```

### Issue: Font Wrong
**Check**: Are you using Typography tokens?
```swift
// Bad
.font(.system(size: 14))

// Good
.font(Typography.bodyMd2)
```

### Issue: neutral400 Doesn't Exist
**Fix**: Use inline hex
```swift
// Bad
AppColors.neutral400

// Good
Color(hex: "BABABA")
```

### Issue: Spacer Takes Wrong Space
**Fix**: Use padding for fixed values
```swift
// Bad
HStack {
    Card()
    Spacer().frame(width: 64)
}

// Good
HStack {
    Card()
}
.padding(.trailing, 64)
```

---

## Target Metrics

| Level | Target Diff | Pass Criteria |
|-------|-------------|---------------|
| Component | < 0.5% | Individual UI elements |
| Section | < 1.0% | Groups of components |
| Screen | < 2.0% | Full screen comparison |

---

## Key Directories

| Purpose | Path |
|---------|------|
| Project | /Users/atrishabh/Documents/Dev/Secured v2/ios/FlentSecured/ |
| Figma Screenshots | /private/tmp/.../scratchpad/figma_screens/ |
| Design Tokens | .../Core/DesignSystem/ |
| Feature Views | .../Features/{Feature}/Views/ |
| Scripts | /Users/atrishabh/Documents/Dev/Secured v2/scripts/ |
| Tracking | /Users/atrishabh/Documents/Dev/Secured v2/docs/pixel-perfect-tracking.md |

---

## Workflow Checklist

- [ ] Simulator booted (iPhone 17)
- [ ] App built and running
- [ ] Navigated to target screen
- [ ] Screenshot captured
- [ ] Pixel comparison run
- [ ] Diff percentage recorded
- [ ] If > 2%: Fix issues, repeat
- [ ] If < 2%: Move to next screen
- [ ] Update tracking document

---

## Getting Help

### View All Figma Screenshots
```bash
ls /private/tmp/claude-501/-Users-atrishabh-Documents-Dev/02a8fb93-1b76-4373-9d05-447368f836a9/scratchpad/figma_screens/
```

### Check Design Tokens
```bash
cat /Users/atrishabh/Documents/Dev/Secured\ v2/ios/FlentSecured/Core/DesignSystem/AppColors.swift
cat /Users/atrishabh/Documents/Dev/Secured\ v2/ios/FlentSecured/Core/DesignSystem/Typography.swift
cat /Users/atrishabh/Documents/Dev/Secured\ v2/ios/FlentSecured/Core/DesignSystem/Spacing.swift
```

### View Tracking Status
```bash
cat /Users/atrishabh/Documents/Dev/Secured\ v2/docs/pixel-perfect-tracking.md
```
