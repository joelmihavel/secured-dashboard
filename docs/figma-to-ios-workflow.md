# Pixel-Perfect Figma-to-iOS Implementation Workflow

> A systematic approach to achieving true pixel-to-pixel parity between Figma designs and iOS SwiftUI implementation.

---

## Problem Statement

1. **Figma API data is structural, not visual** - JSON metadata loses visual nuance
2. **AI visual capability is imprecise** - Small details (spacing, alignment, subtle colors) are missed
3. **Cumulative small errors** - Many tiny discrepancies add up to a screen that looks "off"
4. **No objective verification** - Visual judgment alone is not precise enough
5. **Workflow steps easily skipped** - Without enforcement, verification becomes optional
6. **Mock data masks integration issues** - Static views hide ViewModel connectivity problems
7. **Device scaling ignored** - Hardcoded values break on different screen sizes

---

## Core Principle: Component-First, Bottom-Up

Instead of looking at a whole screen and missing details, break into smallest components and perfect each one before assembling.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCREEN LEVEL                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  SECTION: Header                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │ Component:  │  │ Component:  │  │ Component:  │      │    │
│  │  │ BackButton  │  │ Title       │  │ Avatar      │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  SECTION: Body                           │    │
│  │  ┌─────────────┐  ┌─────────────┐                       │    │
│  │  │ Component:  │  │ Component:  │                       │    │
│  │  │ InputField  │  │ Card        │                       │    │
│  │  └─────────────┘  └─────────────┘                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  SECTION: Footer                         │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │          Component: PrimaryButton               │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

BUILD ORDER: Component → Section → Screen
VERIFY AT EACH LEVEL (pixel diff < 0.5%)
```

---

## Critical Rules (NEVER VIOLATE)

### Rule 1: ALWAYS Use Figma REST API for Screenshots
```bash
# CORRECT - REST API provides accurate screenshots
curl -H "X-Figma-Token: $FIGMA_ACCESS_TOKEN" \
  "https://api.figma.com/v1/images/{file_key}?ids={node_id}&scale=3&format=png"

# WRONG - MCP screenshots are less accurate for visual comparison
mcp__figma__get_screenshot  # ❌ NEVER USE FOR PIXEL COMPARISON
```

### Rule 2: Verify Design Tokens EXIST Before Using
Before writing code with `AppColors.neutral400`:
1. Read `AppColors.swift` and verify token exists
2. If not found, use inline hex: `Color(hex: "BABABA")`

**Known gaps in FlentSecured:**
- `neutral400` does NOT exist (only 100, 200, 300, 500, 600, 800, 900)

### Rule 3: Screenshot is Source of Truth (NOT Design Context)
Figma MCP `get_design_context` may return different content than the actual screenshot.

| Source | Shows | Trust Level |
|--------|-------|-------------|
| Figma Screenshot (REST API) | Actual visual | ✅ Source of truth |
| Figma Design Context (MCP) | Structural metadata | ⚠️ Verify against screenshot |

### Rule 4: Use Explicit Padding, NOT Spacer() for Fixed Values
```swift
// ❌ BAD - Spacer() takes ALL remaining space, not Figma's fixed padding
HStack(spacing: 0) {
    Spacer().frame(width: 64)
    Card().frame(width: 270)
    Spacer()  // Takes unpredictable space!
}

// ✅ GOOD - Explicit padding matches Figma exactly
HStack {
    Card().frame(width: DesignScale.scaled(270))
    Spacer(minLength: 0)
}
.padding(.leading, DesignScale.scaled(64))   // Figma: pl-64
.padding(.trailing, DesignScale.scaled(32))  // Figma: pr-32
```

### Rule 5: Handle ViewModel Default Values
```swift
// ❌ BAD - Doesn't handle ViewModel's "there" default
private var userName: String {
    viewModel.firstName.isEmpty ? "Rishabh" : viewModel.firstName
}

// ✅ GOOD - Explicitly check for default values
private var userName: String {
    let name = viewModel.firstName
    return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
}
```

---

## Workflow Phases

### Phase 1: Screen Analysis & Breakdown

1. **Fetch Figma Screenshot** (REST API - MANDATORY)
```bash
FIGMA_TOKEN="$FIGMA_ACCESS_TOKEN"
FILE_KEY="HZaVuwWn6B6jOjrmxZ7Kzv"
NODE_ID="41:4569"

IMAGE_URL=$(curl -s -H "X-Figma-Token: $FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=$NODE_ID&scale=3&format=png" \
  | jq -r ".images[\"$NODE_ID\"]")

curl -s -o figma_baseline.png "$IMAGE_URL"
```

2. **Get Design Context** - Extract typography, spacing, colors, layout properties

3. **Verify Design Tokens Exist** - Read AppColors.swift, Typography.swift, Spacing.swift, Radius.swift

4. **Create Component Inventory**
| # | Component Name | Node ID | Figma Dimensions | Priority |
|---|----------------|---------|------------------|----------|
| 1 | SetupStepItem | 41:XXXX | 345×56 | High |
| 2 | PaymentCard | 41:XXXX | 270×180 | High |

**USER FEEDBACK**: Present inventory, wait for approval

---

### Phase 2: Component-by-Component Implementation

For EACH component (smallest to largest):

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPONENT LOOP (repeat for each component)                      │
├─────────────────────────────────────────────────────────────────┤
│  1. FETCH component screenshot (Figma REST API)                  │
│  2. GET component design context                                 │
│  3. EXTRACT exact values:                                        │
│     ├── Typography: font, size, weight, line-height              │
│     ├── Spacing: padding (T/R/B/L), margins, gaps                │
│     ├── Colors: background, text, border, shadow                 │
│     ├── Dimensions: width, height, min/max                       │
│     └── Border: width, color, radius                             │
│  4. MAP to design tokens (verify they exist!)                    │
│  5. IMPLEMENT in SwiftUI (no hardcoded values)                   │
│  6. BUILD & SCREENSHOT component in isolation                    │
│  7. PIXEL DIFF against Figma (target < 0.5%)                     │
│  8. IF diff > 0.5%: fix ONE issue, re-diff, repeat               │
│  9. USER FEEDBACK: Present side-by-side, wait for approval       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 3: Section Assembly

After ALL components pass verification:
1. Combine verified components into sections
2. Apply section spacing from Figma
3. Screenshot section
4. Pixel diff against Figma section (target < 1%)
5. **USER FEEDBACK**: Section approved

---

### Phase 4: Screen Assembly

1. Combine verified sections into full screen
2. Apply screen-level layout
3. Multi-device verification (iPhone SE, 14 Pro, 15 Pro Max)
4. **USER FEEDBACK**: Full screen approved

---

### Phase 5: Mock Data & Visual Testing

```swift
struct ScreenNameView: View {
    var isVisualTestMode: Bool = true

    private struct FigmaMockData {
        static let userName = "Rishabh"      // Exact Figma value
        static let amount = "32,500"         // Exact Figma value
        static let daysUntilDue = 10         // Exact Figma value
    }

    private var displayName: String {
        guard !isVisualTestMode else { return FigmaMockData.userName }
        let name = viewModel.firstName
        return (name.isEmpty || name == "there") ? FigmaMockData.userName : name
    }
}
```

---

### Phase 6: Full Screen Pixel Comparison

```bash
# Capture simulator screenshot
xcrun simctl io booted screenshot simulator.png

# Resize to match Figma width (1179px at @3x)
magick simulator.png -resize 1179x sim_resized.png

# Crop Figma to match viewport height
SIM_HEIGHT=$(identify -format "%h" sim_resized.png)
magick figma_baseline.png -crop "1179x${SIM_HEIGHT}+0+0" +repage figma_cropped.png

# Run pixel comparison
DIFF=$(magick compare -metric AE -fuzz 5% figma_cropped.png sim_resized.png null: 2>&1)

# Calculate percentage
TOTAL=$(identify -format "%[fx:w*h]" figma_cropped.png)
PERCENT=$(python3 -c "print(f'{($DIFF / $TOTAL) * 100:.2f}')")
echo "Pixel difference: ${PERCENT}%"

# Generate visual diff (red = differences)
magick compare -highlight-color red -fuzz 5% figma_cropped.png sim_resized.png diff.png

# Side-by-side comparison
magick figma_cropped.png sim_resized.png diff.png +append comparison.png
```

---

### Phase 7: Iterative Refinement

**Gap Analysis Template:**
| Component | Figma Value | Current Code | Status |
|-----------|-------------|--------------|--------|
| Card width | 270pt | DesignScale.scaled(270) | ✅ |
| Left padding | 64pt | .padding(.leading, 64) | ❌ Use DesignScale |
| Button text | "+ Add Payment" | "Get Started" | ❌ FIX |

**Fix Loop:**
1. Analyze diff (red areas)
2. Identify issue type (spacing? color? font?)
3. Fix ONE issue
4. Re-run diff
5. Repeat until < target %

**USER FEEDBACK**: Present side-by-side, wait for "Screen approved"

---

## Handling Edge Cases

### Dynamic Content
| Region | Solution |
|--------|----------|
| Status bar | Exclude from diff (first 54px) |
| User avatars | Use placeholder matching Figma |
| Timestamps | Use fixed mock data |

### Scale Factors
Always fetch Figma at @3x to match simulator (1179 × 2556 for iPhone 14 Pro)

### Scrollable Content
Compare viewport sections individually, or scroll and stitch screenshots

---

## Definition of Done

**TRUE parity:**
- Pixel diff < 0.5% (components) / < 2% (screen)
- Every color is exact hex match
- Every dimension is exact pixel match
- Every font property matches exactly

**NEVER stop because:**
- "It looks close"
- "I can't figure out the issue"

---

## Quick Reference

### ImageMagick Commands
```bash
magick compare -metric AE -fuzz 5% img1.png img2.png null: 2>&1  # Pixel count
magick compare -highlight-color red -fuzz 5% img1.png img2.png diff.png  # Visual diff
magick img1.png img2.png img3.png +append output.png  # Side-by-side
```

### Design Tokens (FlentSecured)
```swift
// Colors
AppColors.black700    // #131313
AppColors.black500    // #202020
AppColors.brand500    // #FF9A6D
AppColors.neutral300  // #CBCBCB
// NOTE: neutral400 does NOT exist

// Typography
Typography.h4         // 28px Regular
Typography.bodyMd2    // 14px Regular
Typography.bodySm     // 12px Regular

// Spacing
Spacing.xs=8, sm=12, md=16, lg=24, xl=32

// Radius
Radius.xs=4, sm=8, md=12, lg=16
```

---

## Common Issues & Fixes

| Issue | Root Cause | Fix |
|-------|------------|-----|
| Token doesn't exist | Used `AppColors.neutral400` | Use `Color(hex: "BABABA")` |
| Spacer takes wrong space | Used `Spacer()` for fixed padding | Use `.padding()` modifier |
| Screenshot ≠ design context | MCP returns different variant | Trust screenshot |
| Card shifted | Mixed Spacer and padding | Use explicit padding only |
| Font looks wrong | Hardcoded font name | Use `Typography.*` token |
| Scaling breaks | Hardcoded pixel values | Use `DesignScale.scaled()` |
| ViewModel shows "there" | Default value not handled | Check for default values |

---

## Success Criteria

### Per Phase
- [ ] **Phase 1**: Component inventory approved
- [ ] **Phase 2**: Each component < 0.5% diff, side-by-side approved
- [ ] **Phase 3**: Each section < 1% diff, approved
- [ ] **Phase 4**: Full screen < 2% diff, multi-device passed
- [ ] **Final**: User signed off "Screen approved"

---

## Learnings (Session 2026-01-31)

**HomeZeroStateFigmaView - Initial: ~8% diff**

| Issue | Fix |
|-------|-----|
| `AppColors.neutral400` doesn't exist | Use `Color(hex: "BABABA")` |
| `Spacer()` takes flexible space | Use `.padding()` modifiers |
| Design context showed "Get Started" | Trust screenshot ("+ Add Payment") |
| ViewModel returns "there" and "₹0" | Check for default values |

**Key Insight:** When Figma shows fixed padding (pl-64, pr-32), use SwiftUI `.padding()`, NOT `Spacer()`.
