# Figma Node 1:30820 — Agreement Modify Screen Specs

> **Source**: Figma REST API `/v1/files/{key}/nodes?ids=1:30820`
> **Screen name**: "Onboarding / Agreement --modify agreement"
> **Status**: READY_FOR_DEV

---

## 1. Root Frame (1:30820)

| Property | Value |
|----------|-------|
| type | FRAME |
| width | 393 |
| height | 1432 |
| clipsContent | true |
| background | `#131313` (SOLID, r=0.0745, g=0.0745, b=0.0745) |

---

## 2. Hierarchy Overview

```
1:30820 — Root Frame (393x1432, bg #131313)
  └── Frame 1686557296 (1:30821) — Main wrapper (VERTICAL, itemSpacing: 64)
        ├── [STATUS BAR — 1:30822, INSTANCE] (hidden: not relevant)
        ├── Frame 1686557300 (1:30825) — Bottom sheet container (WHITE)
        │     ├── Rectangle 53 (1:30826) — Drag handle (28x4, #D9D9D9)
        │     └── Frame 1686557230 (1:30827) — Main content (VERTICAL)
        │           ├── Frame 1686557275 (1:30828) — Payment section (visible: FALSE)
        │           ├── Frame 1686557268 (1:30891) — Navigation header (visible: FALSE)
        │           ├── Title text (1:30895) — "Let's fix the details"
        │           ├── Frame 2095586312 (1:30896) — Input fields section
        │           │     ├── Input 1 (1:30897) — Agreement ID (disabled)
        │           │     ├── Input 2 (1:30898) — Property Name (disabled)
        │           │     ├── Input 3 (1:30899) — Tenant(s) (focus/editable)
        │           │     ├── Input 4 (1:30900) — Landlord(s) (focus/editable)
        │           │     ├── Input 5 (1:30901) — Monthly Rent (focus/editable)
        │           │     ├── Input 6 (1:30902) — One-Time Deposit (focus/editable)
        │           │     ├── Input 7 (1:30903) — Rent Duration (focus/editable)
        │           │     └── Input 8 (1:30904) — Exit Date (focus/editable)
        │           └── Button (1:30905) — "Save Changes"
        └── [HOME INDICATOR — 1:30906, INSTANCE]
```

---

## 3. Bottom Sheet Container — Frame 1686557300 (1:30825)

| Property | Value |
|----------|-------|
| type | FRAME |
| layoutMode | VERTICAL |
| counterAxisAlignItems | CENTER |
| cornerRadius | 22.787622451782227 |
| paddingTop | 15.19174861907959 |
| itemSpacing | 24.0 |
| fills | `#FFFFFF` (SOLID, r=1.0, g=1.0, b=1.0) |
| clipsContent | true |
| width | 393 (FILL parent) |
| layoutSizingVertical | HUG |

---

## 4. Drag Handle — Rectangle 53 (1:30826)

| Property | Value |
|----------|-------|
| type | RECTANGLE |
| width | 28 |
| height | 4 |
| cornerRadius | 200 |
| fill | `#D9D9D9` (r=0.851, g=0.851, b=0.851) |

---

## 5. Main Content Area — Frame 1686557230 (1:30827)

| Property | Value |
|----------|-------|
| type | FRAME |
| layoutMode | VERTICAL |
| paddingTop | 16.0 |
| itemSpacing | 30.38349723815918 |
| counterAxisSizingMode | FIXED |
| width | 393 (FILL parent) |
| layoutSizingVertical | HUG |

---

## 6. Main Content Wrapper (padding container)

The main content wrapper applies horizontal padding:

| Property | Value |
|----------|-------|
| layoutMode | VERTICAL |
| counterAxisAlignItems | CENTER |
| paddingLeft | 48 |
| paddingRight | 48 |
| itemSpacing | 40 |
| width | 393 (FILL parent) |

---

## 7. Title Text (1:30895)

| Property | Value |
|----------|-------|
| type | TEXT |
| characters | "Let's\u2028fix the details" |
| fontFamily | Plus Jakarta Sans |
| fontPostScriptName | PlusJakartaSans-Regular |
| fontWeight | 400 (Regular) |
| fontSize | 48 |
| letterSpacing | -2.0 |
| lineHeightPx | 64.0 |
| lineHeightUnit | PIXELS |
| textAlignHorizontal | LEFT |
| textAutoResize | HEIGHT |

### Character Style Overrides

The text has mixed colors via `styleOverrideTable`:

| Range | Text | Override ID | Color |
|-------|------|-------------|-------|
| Chars 0-5 | "Let's" | 37 | `#A9A9A9` (r=0.663, g=0.663, b=0.663) |
| Char 5 | line separator (U+2028) | 38 | Same font properties |
| Chars 6-24 | "fix the details" | 36 | `#FF9A6D` (r=1.0, g=0.604, b=0.427) — brand accent |

All overrides share:
- fontFamily: Plus Jakarta Sans
- fontWeight: 400
- fontSize: 48
- letterSpacing: -2.0
- lineHeightPx: 64.0

---

## 8. Input Fields Section — Frame 2095586312 (1:30896)

| Property | Value |
|----------|-------|
| layoutMode | VERTICAL |
| itemSpacing | 16 |
| width | 297 (FILL, parent 393 - 48*2 padding) |
| layoutSizingVertical | HUG |

---

## 9. Input Component Structure

All inputs are **INSTANCE** of component set `1:25273` ("input").

### Input Component Variants Used:

| Variant | Component ID | Description |
|---------|-------------|-------------|
| Property 1=default, Property 2=disabled | `1:25417` | Read-only fields (Agreement ID, Property Name) |
| Property 1=default, Property 2=focus | `1:25369` | Editable fields (Tenant, Landlord, Rent, Deposit, Duration, Exit Date) |

### Input Component Internal Structure (each):

```
Input INSTANCE
  └── Outer Frame (VERTICAL, itemSpacing: 6)
        ├── Label Row (HORIZONTAL, itemSpacing: 8, counterAxisAlignItems: CENTER)
        │     ├── Label Text (12px, Medium 500, #A9A9A9)
        │     ├── Hint Text (visible: false in most)
        │     └── "Edit" text (visible for focus variants)
        ├── Input Box (HORIZONTAL, paddingTop/Bottom: 16)
        │     ├── Left-Icon (visible: false)
        │     ├── Text Value (20px, Regular 400)
        │     └── Right-Icon (visible: false)
        └── [Hint row if visible]
```

### Individual Input Fields:

#### Input 1 — Agreement ID (1:30897) — DISABLED

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=disabled |
| componentId | 1:25417 |
| label | "Agreement ID" |
| placeholder | "e.g. KIA123456789" |
| hint | "This is a hint text to help user." (visible: false) |
| height | 90 (label 26 + input 64) |
| input box strokeWeight | bottom: 0.5, others: 0 |
| input box stroke color | `#0D0D0D` (r=0.051, g=0.051, b=0.051) |
| input box fill | `#222222` (r=0.133, visible: false — no bg in disabled) |

Label text style:
- fontFamily: Plus Jakarta Sans
- fontWeight: 500 (Medium)
- fontSize: 12
- lineHeightPx: 20
- color: `#A9A9A9` (r=0.663)

Value text style:
- fontFamily: Plus Jakarta Sans
- fontWeight: 400 (Regular)
- fontSize: 20
- lineHeightPx: 32
- color: `#DDDDDD` (r=0.867) — text value color for disabled inputs

#### Input 2 — Property Name (1:30898) — DISABLED

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=disabled |
| componentId | 1:25417 |
| label | "Property Name" |
| placeholder | "e.g. Prestow Glasglow" |
| hint | "This is a hint text to help user." (visible: false) |

Same styling as Input 1.

#### Input 3 — Tenant(s) (1:30899) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| componentId | 1:25369 |
| label | "Tenant(s)" |
| label action | "Edit" (visible) |
| value | "John Appleseed" |

Label "Edit" text style:
- fontFamily: Plus Jakarta Sans
- fontWeight: 500 (Medium)
- fontSize: 12
- lineHeightPx: 20
- color: `#A9A9A9`

Value text style:
- fontFamily: Plus Jakarta Sans
- fontWeight: 400 (Regular)
- fontSize: 20
- lineHeightPx: 32
- color: `#DDDDDD` (r=0.867)

Input box (focus variant):
- stroke: bottom only, 0.5px, color `#0D0D0D`
- fill: `#222222` (visible: false — transparent bg)
- paddingTop: 16, paddingBottom: 16

#### Input 4 — Landlord(s) (1:30900) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| label | "Landlord(s)" |
| label action | "Edit" |
| value | "Lisa Appleseed" |

Same styling as Input 3.

#### Input 5 — Monthly Rent (1:30901) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| label | "Monthly Rent" |
| label action | "Edit" |
| value | "₹ 40,000" |

#### Input 6 — One-Time Deposit (1:30902) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| label | "One-Time Deposit" |
| label action | "Edit" |
| value | "₹ 130,000" |

#### Input 7 — Rent Duration (1:30903) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| label | "Rent Duration" |
| label action | "Edit" |
| value | "11 Months" |

#### Input 8 — Exit Date (1:30904) — FOCUS/EDITABLE

| Property | Value |
|----------|-------|
| variant | Property 1=default, Property 2=focus |
| label | "Exit Date" |
| label action | "Edit" |
| value | "31 Dec 2027" |

---

## 10. Input Box Shared Properties (All Inputs)

| Property | Value |
|----------|-------|
| layoutMode | HORIZONTAL |
| counterAxisAlignItems | CENTER |
| paddingTop | 16 |
| paddingBottom | 16 |
| itemSpacing | 16 |
| width | FILL parent (297) |
| height | 64 (HUG, paddingTop 16 + text 32 + paddingBottom 16) |
| cornerRadius | 12 (from parent component, via variable) |
| fill | `#222222` (visible: false — no visible background) |
| stroke | bottom only 0.5px, color `#0D0D0D` |
| individualStrokeWeights | top: 0, right: 0, bottom: 0.5, left: 0 |

---

## 11. Label Row Shared Properties (All Inputs)

| Property | Value |
|----------|-------|
| layoutMode | HORIZONTAL |
| counterAxisAlignItems | CENTER |
| itemSpacing | 8 |
| width | FILL parent (297) |
| height | 20 (HUG) |

Label text:
- fontSize: 12
- fontWeight: 500 (Medium)
- lineHeightPx: 20
- color: `#A9A9A9`
- textAlign: LEFT

"Edit" action text (focus variant only):
- fontSize: 12
- fontWeight: 500 (Medium)
- lineHeightPx: 20
- color: `#A9A9A9`
- textAlign: LEFT

---

## 12. "Save Changes" Button (1:30905)

This is an INSTANCE of component set `104:3129` ("button"), variant "Property 1=default" (componentId: `104:3130`).

### Button Container (Frame 2095586312, I1:30905;100:1564)

| Property | Value |
|----------|-------|
| type | FRAME |
| layoutMode | HORIZONTAL |
| primaryAxisAlignItems | CENTER |
| counterAxisAlignItems | CENTER |
| paddingLeft | 16 |
| paddingRight | 16 |
| paddingTop | 16 |
| paddingBottom | 16 |
| itemSpacing | 10 |
| cornerRadius | 8 |
| width | 297 (FILL parent) |
| height | 56 (HUG: padding 16 + text 24 + padding 16) |
| clipsContent | true |

### Button Fill (Gradient)

Linear gradient (top to bottom, stops at 90.18%):

| Stop | Position | Color | Hex |
|------|----------|-------|-----|
| 1 | 0% | r=0.1255, g=0.1255, b=0.1255 | `#202020` |
| 2 | 100% | r=0.051, g=0.051, b=0.051 | `#0D0D0D` |

Gradient handle positions:
- Start: (0.502, 0.0)
- End: (0.502, 0.902)

### Button Stroke

| Property | Value |
|----------|-------|
| type | SOLID |
| color | `#FF9A6D` (r=1.0, g=0.604, b=0.427) — brand accent |
| strokeWeight | 0.1 |
| strokeAlign | INSIDE |

### Button Effects (Shadows)

1. **DROP_SHADOW** (visible):
   - color: rgba(153, 92, 65, 0.24) — `#995C41` at 24% opacity
   - offset: (0, 6)
   - radius: 12
   - spread: -2

2. **INNER_SHADOW** (visible):
   - color: rgba(255, 255, 255, 0.12) — white at 12% opacity
   - offset: (0, -3)
   - radius: 4
   - spread: 1

3. **INNER_SHADOW** (visible: false — inactive):
   - color: `#444444` (r=0.267)
   - offset: (0, -10)
   - radius: 0
   - spread: 1

4. **INNER_SHADOW** (visible):
   - color: `#000000` (black)
   - offset: (-2, -4)
   - radius: 0
   - spread: 1

### Button Indicator Line — Rectangle 140 (I1:30905;137:37)

| Property | Value |
|----------|-------|
| type | RECTANGLE |
| width | 24 |
| height | 2 |
| cornerRadius | 200 |
| fill | `#4D4D4D` (r=0.302, SOLID) |

### Button Text (I1:30905;100:1565)

| Property | Value |
|----------|-------|
| characters | "Save Changes" |
| fontFamily | Plus Jakarta Sans |
| fontPostScriptName | PlusJakartaSans-Medium |
| fontWeight | 500 (Medium) |
| fontSize | 16 |
| lineHeightPx | 24 |
| letterSpacing | 0 |
| textAlignHorizontal | CENTER |
| textAlignVertical | CENTER |
| color | `#FFFFFF` (white, r=1.0) |
| textAutoResize | WIDTH_AND_HEIGHT |

### Button Wrapper (outer, 1:30905)

| Property | Value |
|----------|-------|
| layoutMode | VERTICAL |
| counterAxisAlignItems | CENTER |
| itemSpacing | 8 |
| cornerRadius | 12 |
| width | 297 (FIXED) |
| height | 66 (HUG: indicator 2 + gap 8 + button 56) |

### Button Interaction

| Property | Value |
|----------|-------|
| trigger | ON_PRESS |
| action | CHANGE_TO node 104:3131 |
| transition | SMART_ANIMATE, EASE_OUT, 300ms |

---

## 13. Payment Section — Frame 1686557275 (1:30828) — HIDDEN

**visible: false** — This section is hidden on the modify screen.

Contains (for reference if needed later):
- "Pay Rent" title: fontSize 28, fontWeight 400, letterSpacing -0.56
- Total payable rent section
- Landlord payment info
- "Pay Now" button: fontSize 14, fontWeight 600, black bg, cornerRadius 200
- Payment app options (Google Pay, PayTM, PhonePe)

---

## 14. Navigation Header — Frame 1686557268 (1:30891) — HIDDEN

**visible: false** — Navigation header is hidden on this screen.

Contains:
- Back arrow vector (white fill, 32x38.4)
- "13:13" time display

---

## 15. Component Registry

| Component ID | Name | Description |
|-------------|------|-------------|
| 1:25417 | input (disabled) | Property 1=default, Property 2=disabled |
| 1:25369 | input (focus) | Property 1=default, Property 2=focus |
| 104:3130 | button (default) | Property 1=default |
| 1:25 | Home Indicator | iOS home indicator |
| 1:7 | Status Bar / 16 Pro | Status bar |
| 1:11929 | Outline Icon Library (heart) | Icon set component |

---

## 16. Text Style Registry

| Style ID | Name | Font Size | Weight |
|----------|------|-----------|--------|
| 1:43 | H1/Regular 400 | 48 | 400 |
| 1:270 | sm/Medium 500 | 12 | 500 |
| 1:90 | md-1/Regular 400 | 20 | 400 |
| 1:108 | lg/Regular 400 | 20 | 400 |
| 86:2605 | md-2/Medium 500 | 16 | 500 |

---

## 17. Color Summary

| Usage | Hex | RGBA (0-1) |
|-------|-----|------------|
| Screen background | `#131313` | r=0.0745, g=0.0745, b=0.0745 |
| Bottom sheet bg | `#FFFFFF` | r=1.0, g=1.0, b=1.0 |
| Drag handle | `#D9D9D9` | r=0.851, g=0.851, b=0.851 |
| Title grey text | `#A9A9A9` | r=0.663, g=0.663, b=0.663 |
| Title accent text | `#FF9A6D` | r=1.0, g=0.604, b=0.427 |
| Label text | `#A9A9A9` | r=0.663, g=0.663, b=0.663 |
| Input value text | `#DDDDDD` | r=0.867, g=0.867, b=0.867 |
| Input box stroke | `#0D0D0D` | r=0.051, g=0.051, b=0.051 |
| Input box fill (invisible) | `#222222` | r=0.133 (visible: false) |
| Button text | `#FFFFFF` | r=1.0, g=1.0, b=1.0 |
| Button gradient start | `#202020` | r=0.1255 |
| Button gradient end | `#0D0D0D` | r=0.051 |
| Button stroke | `#FF9A6D` | r=1.0, g=0.604, b=0.427 |
| Button indicator | `#4D4D4D` | r=0.302 |

---

## 18. Spacing Summary

| Context | Property | Value |
|---------|----------|-------|
| Bottom sheet top padding | paddingTop | 15.19 |
| Bottom sheet → content gap | itemSpacing | 24 |
| Content top padding | paddingTop | 16 |
| Content sections gap | itemSpacing | 30.38 |
| Horizontal padding (content) | paddingLeft/Right | 48 |
| Title → inputs gap | itemSpacing | 40 |
| Between input fields | itemSpacing | 16 |
| Input label → input box | itemSpacing | 6 |
| Input box internal padding | paddingTop/Bottom | 16 |
| Input box icon-text spacing | itemSpacing | 16 |
| Label row items | itemSpacing | 8 |
| Button indicator → button | itemSpacing | 8 |
| Button internal padding | padding (all) | 16 |
| Button internal item spacing | itemSpacing | 10 |

---

## 19. Typography Summary

| Element | Font | Size | Weight | Line Height | Letter Spacing | Color |
|---------|------|------|--------|-------------|---------------|-------|
| Title "Let's" | Plus Jakarta Sans | 48 | 400 | 64px | -2.0 | #A9A9A9 |
| Title "fix the details" | Plus Jakarta Sans | 48 | 400 | 64px | -2.0 | #FF9A6D |
| Input label | Plus Jakarta Sans | 12 | 500 | 20px | 0 | #A9A9A9 |
| Input "Edit" action | Plus Jakarta Sans | 12 | 500 | 20px | 0 | #A9A9A9 |
| Input value | Plus Jakarta Sans | 20 | 400 | 32px | 0 | #DDDDDD |
| Button text | Plus Jakarta Sans | 16 | 500 | 24px | 0 | #FFFFFF |

---

## 20. Sizing Summary

| Element | Width | Height |
|---------|-------|--------|
| Root frame | 393 | 1432 |
| Bottom sheet | 393 | HUG |
| Content area | 393 | HUG |
| Content (after padding) | 297 | HUG |
| Drag handle | 28 | 4 |
| Each input (outer) | 297 | 90 |
| Input box | 297 | 64 |
| Label row | 297 | 20 |
| Button (outer) | 297 | 66 |
| Button (inner container) | 297 | 56 |
| Button indicator line | 24 | 2 |
