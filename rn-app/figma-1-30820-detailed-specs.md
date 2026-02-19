# Figma Node 1:30820 - Agreement Modify Screen - Detailed Specification

**Source**: Figma REST API raw JSON extraction
**Screen Name**: Onboarding / Agreement --modify agreement
**Frame Size**: 393 x 1782 (iPhone viewport)
**Background**: `#131313` (SOLID, via variable)

---

## Overall Layout Structure

The screen uses a **VERTICAL** layout with the following hierarchy:

```
Root Frame (393 x 1782)
  +-- Status Bar (393 x 53, FIXED height)
  +-- Content Container (Frame 1686557268)
      |   paddingLeft: 48, paddingRight: 48
      |   itemSpacing: 40 (gap between content group and button)
      |   layoutMode: VERTICAL
      |   counterAxisAlignItems: CENTER
      |
      +-- Main Content Group (Frame 1686557318)
      |   |   itemSpacing: 48 (between title group + logo, and input container)
      |   |   layoutMode: VERTICAL
      |   |   width: 297 (FILL parent minus 48+48 padding)
      |   |
      |   +-- Title Group (Frame 1686557318 inner - itemSpacing: 48)
      |   |   +-- Logo (Vector 1) - 32x38.4
      |   |   +-- Title Text
      |   |
      |   +-- Input Container (Frame 2095586312)
      |       itemSpacing: 16 (gap between each input field)
      |       width: FILL (297)
      |
      +-- Button Section (button instance)
          itemSpacing: 8 (between pill divider and button frame)
          counterAxisAlignItems: CENTER
```

---

## 1. TITLE SECTION

### Title Text Node (id: 1:30895)

**Characters**: `Let's\u2028fix the details`
- The `\u2028` is a Unicode LINE SEPARATOR (forces line break between "Let's" and "fix the details")
- Line 1: "Let's" (5 chars + line separator)
- Line 2: "fix the details" (15 chars)

**Base Style**:
- fontFamily: `Plus Jakarta Sans`
- fontWeight: 400 (Regular)
- fontSize: **48**
- lineHeightPx: **64** (PIXELS)
- letterSpacing: **-2**
- textAlignHorizontal: LEFT
- textAlignVertical: CENTER
- textAutoResize: HEIGHT
- width: 297 (FILL parent)
- height: 128 (HUG content, 2 lines x 64 lineHeight)
- default fill color: `#FFFFFF` (white)

**Per-Character Color Overrides** (characterStyleOverrides):
The string "Let's\u2028fix the details" has 21 characters (including the line separator at index 5).

| Char Index | Character | Style Override | Color |
|------------|-----------|---------------|-------|
| 0 (base)   | L         | (base style)  | `#FFFFFF` (white) |
| 1-4        | e, t, ', s | override 37  | `#A9A9A9` (r:0.663, g:0.663, b:0.663) |
| 5          | \u2028     | override 38  | (line separator - same font, no visible color) |
| 6-20       | f,i,x, ,t,h,e, ,d,e,t,a,i,l,s | override 36 | `#FF9A6D` (r:1.0, g:0.604, b:0.427) |

**Decoded color mapping**:
- "L" = **white** `#FFFFFF` (base fill, no override)
- "et's" = **gray** `#A9A9A9` (style override 37)
- Line separator = style override 38 (same font, no fill override visible)
- "fix the details" = **brand accent** `#FF9A6D` (style override 36)

**All three override styles share**:
- fontFamily: Plus Jakarta Sans
- fontWeight: 400 (Regular)
- fontSize: 48
- letterSpacing: -2
- lineHeightPx: 64 (PIXELS)

---

## 2. LOGO

**Node**: id 1:30894 (Vector 1) inside Frame 1686557264
- **Size**: width: 32.04, height: 38.4
- **Fill**: `#FFFFFF` (white, SOLID, via variable)
- **strokeWeight**: 0.625
- Position: top-left of content area (first child in title group)

---

## 3. INPUT FIELDS CONTAINER

**Node**: id 1:30896 (Frame 2095586312)
- **layoutMode**: VERTICAL (not visible in snippet but inferred from children layout)
- **itemSpacing**: 16 (gap between each input field)
- **width**: FILL (297px, same as parent content)

### 8 Input Fields Summary

| # | Node ID | Label | Value Text | Variant (Prop 2) | Component ID | Has "Edit" | Has Hint Text |
|---|---------|-------|-----------|-------------------|-------------|------------|---------------|
| 1 | 1:30897 | Agreement ID | e.g. KIA123456789 | **disabled** | 1:25417 | No | No (hidden) |
| 2 | 1:30898 | Property Name | e.g. Prestow Glasglow | **disabled** | 1:25417 | No | No (hidden) |
| 3 | 1:30899 | Tenant(s) | John Appleseed | **focus** | 1:25369 | **Yes** | **Yes** (visible) |
| 4 | 1:30900 | Landlord(s) | Lisa Appleseed | **focus** | 1:25369 | **Yes** | **Yes** (visible) |
| 5 | 1:30901 | Monthly Rent | Rs 40,000 | **focus** | 1:25369 | **Yes** | **Yes** (visible) |
| 6 | 1:30902 | One-Time Deposit | Rs 130,000 | **focus** | 1:25369 | **Yes** | **Yes** (visible) |
| 7 | 1:30903 | Rent Duration | 11 Months | **focus** | 1:25369 | **Yes** | **Yes** (visible) |
| 8 | 1:30904 | Exit Date | 31 Dec 2027 | **focus** | 1:25369 | **Yes** | **Yes** (visible) |

---

## 4. INPUT FIELD VARIANTS - DETAILED SPECS

### Variant A: "disabled" (Fields 1-2: Agreement ID, Property Name)

**Component**: `1:25417` (input component, Property 2 = "disabled")

**Structure**:
```
input (INSTANCE)
  +-- _Input field base (FRAME)
      +-- Input with label (FRAME)
          +-- Frame 4 (FRAME, layoutMode: HORIZONTAL, itemSpacing: 6)
          |   +-- Label (TEXT)
          |   +-- Hint text (TEXT, visible: false)
          |
          +-- Input (FRAME) -- the actual input box
              +-- Content (FRAME, layoutMode: HORIZONTAL, itemSpacing: 8)
                  +-- Left Icon (hidden)
                  +-- Text (TEXT) -- the placeholder/value
                  +-- Right Icon (hidden)
```

**Outer wrapper (_Input field base)**:
- layoutMode: VERTICAL
- itemSpacing: 6 (gap between label row and input box)
- width: FILL (297)
- height: HUG (90px total)

**Label row (Frame 4)**:
- layoutMode: HORIZONTAL
- itemSpacing: 6
- width: FILL (297)

**Label Text**:
- fontFamily: Plus Jakarta Sans
- fontWeight: **500** (Medium)
- fontSize: **12**
- lineHeightPx: **20** (PIXELS)
- letterSpacing: **0**
- color: **`#A9A9A9`** (r:0.663, g:0.663, b:0.663)
- textAlignHorizontal: LEFT
- layoutSizingHorizontal: FILL (grows to fill)

**Hint Text** (hidden in disabled variant):
- visible: **false**
- fontFamily: Plus Jakarta Sans
- fontWeight: 400 (Regular)
- fontSize: 14
- lineHeightPx: 20
- color: `#878787` (r:0.529, g:0.529, b:0.529)
- textAlignHorizontal: RIGHT

**Input Box (Frame "Input")**:
- cornerRadius: **12**
- paddingTop: **16**, paddingBottom: **16**
- paddingLeft: **0** (no explicit left/right padding in disabled variant -- bound to variable, but padding values from absoluteBoundingBox show no horizontal padding for content)
- itemSpacing: **16** (between icon and text inside Content)
- strokeWeight: **1**
- stroke: `visible: false` (stroke exists but is NOT visible in disabled variant)
- stroke color (when visible would be): `#4D4D4D` (r:0.302, g:0.302, b:0.302)
- fill: `visible: false` (background not visible in disabled variant)
- fill color (when visible would be): `#222222` (r:0.133, g:0.133, b:0.133)
- height: 64 (HUG, with padding: 16 top + 32 text + 16 bottom)
- width: FILL (297)
- layoutMode: HORIZONTAL
- counterAxisAlignItems: CENTER

**Value/Placeholder Text (inside Input > Content)**:
- fontFamily: Plus Jakarta Sans
- fontWeight: 400 (Regular)
- fontSize: **20**
- lineHeightPx: **32** (PIXELS)
- letterSpacing: **0**
- color: **`#222222`** (r:0.133, g:0.133, b:0.133) -- same as input fill variable, appears very dark/invisible
- textAlignHorizontal: LEFT
- layoutSizingHorizontal: FILL

### Variant B: "focus" (Fields 3-8: Tenant through Exit Date)

**Component**: `1:25369` (input component, Property 2 = "focus")

**Structure**: Same as disabled but with key differences:
```
input (INSTANCE)
  +-- _Input field base (FRAME)
      +-- Input with label (FRAME)
          +-- Frame 3 (FRAME, layoutMode: HORIZONTAL, itemSpacing: 6)
          |   +-- Label (TEXT, layoutGrow: 1, FILL)
          |   +-- Hint text (TEXT, visible: true, "Edit")
          |
          +-- Input (FRAME) -- the actual input box
              +-- Content (FRAME)
                  +-- Left Icon (hidden)
                  +-- Text (TEXT) -- the value text
                  +-- Right Icon (hidden)
```

**Key Differences from "disabled"**:

1. **Hint Text is VISIBLE** and shows **"Edit"** (not "This is a hint text...")
   - fontFamily: Plus Jakarta Sans
   - fontWeight: 400 (Regular)
   - fontSize: **14**
   - lineHeightPx: **20**
   - letterSpacing: **0**
   - color: **`#878787`** (r:0.529, g:0.529, b:0.529)
   - textAlignHorizontal: **RIGHT**
   - layoutSizingHorizontal: HUG

2. **Input Box border**:
   - stroke: `visible: false` BUT uses **individualStrokeWeights**:
     - top: **0**, right: **0**, bottom: **0.5**, left: **0**
   - So only a **bottom border** at 0.5px weight
   - stroke color: **`#0D0D0D`** (r:0.051, g:0.051, b:0.051) -- very subtle/nearly invisible
   - fill: `visible: false` (transparent background)
   - cornerRadius: NOT specified differently (inherits component default)

3. **Value Text color**:
   - color: **`#DDDDDD`** (r:0.867, g:0.867, b:0.867) -- bright, clearly visible
   - All other text properties same as disabled variant (fontSize: 20, lineHeight: 32, weight: 400)

4. **Label**: Same style as disabled (Medium 500, 12px, `#A9A9A9`)

---

## 5. SPACING SUMMARY

### Vertical Spacing (top to bottom):
| From | To | Gap (px) |
|------|----|----------|
| Status bar bottom | Logo top | 64 (outer frame itemSpacing) |
| Logo bottom | Title top | 48 (title group itemSpacing) |
| Title bottom | First input (Agreement ID) top | 48 (main content itemSpacing) |
| Input field 1 bottom | Input field 2 top | 16 (input container itemSpacing) |
| Input field 2 bottom | Input field 3 top | 16 |
| Input field 3 bottom | Input field 4 top | 16 |
| Input field 4 bottom | Input field 5 top | 16 |
| Input field 5 bottom | Input field 6 top | 16 |
| Input field 6 bottom | Input field 7 top | 16 |
| Input field 7 bottom | Input field 8 top | 16 |
| Input field 8 bottom | Button section top | 40 (content container itemSpacing) |

### Horizontal Padding:
- Screen (393px) -> Content area: **48px left, 48px right** = 297px content width
- Input box internal: **paddingTop: 16, paddingBottom: 16** (no left/right padding visible)

### Within Each Input Field:
- Label row to Input box: **6px** (vertical, _Input field base itemSpacing)
- Label to Edit text: **6px** horizontal gap (Frame 3/4 itemSpacing)
- Content items spacing: **8px** (icon to text, inside Input > Content)

---

## 6. BUTTON SECTION

### Button Instance (id: 1:30905)
**Component**: `104:3130` (button component, Property 1 = "default")

**Outer Button Frame**:
- layoutMode: VERTICAL
- counterAxisAlignItems: CENTER
- itemSpacing: **8** (between pill divider and button content frame)
- cornerRadius: **12**
- width: 297 (FIXED)
- height: HUG (66)

**Children**:

#### 6a. Pill Divider (Rectangle 140, id: I1:30905;137:37)
- width: **24**, height: **2**
- cornerRadius: **200** (fully rounded)
- fill: **`#4D4D4D`** (r:0.302, g:0.302, b:0.302, SOLID)
- Position: centered horizontally (parent counterAxisAlignItems: CENTER)

#### 6b. Button Content Frame (Frame 2095586312, id: I1:30905;100:1564)
- layoutMode: HORIZONTAL
- primaryAxisAlignItems: CENTER
- counterAxisAlignItems: CENTER
- paddingLeft: **16**, paddingRight: **16**, paddingTop: **16**, paddingBottom: **16**
- width: FILL (297)
- height: HUG (56 = 16+24+16)
- cornerRadius: **8**

**Button Background (gradient fill)**:
- type: GRADIENT_LINEAR
- direction: top to bottom (~90 degrees)
- Stop 1 (position 0.0): **`#202020`** (r:0.125, g:0.125, b:0.125)
- Stop 2 (position 1.0): **`#0D0D0D`** (r:0.051, g:0.051, b:0.051)

**Button Stroke**:
- type: SOLID
- color: **`#FF9A6D`** (r:1.0, g:0.604, b:0.427) -- brand accent
- strokeWeight: **0.1**
- strokeAlign: INSIDE

**Button Effects**:
1. **DROP_SHADOW** (visible):
   - color: rgba(153, 92, 65, 0.24) -- `#995C41` at 24% opacity
   - offset: x=0, y=6
   - radius: 12
   - spread: -2

2. **INNER_SHADOW** (visible):
   - color: rgba(255, 255, 255, 0.12) -- white at 12% opacity
   - offset: x=0, y=-3
   - radius: 4
   - spread: 1

3. **INNER_SHADOW** (visible):
   - color: rgba(0, 0, 0, 1.0) -- `#000000` fully opaque
   - offset: x=-2, y=-4
   - radius: 0
   - spread: 1

**Button Text** (id: I1:30905;100:1565):
- characters: **"Save Changes"**
- fontFamily: Plus Jakarta Sans
- fontWeight: **500** (Medium)
- fontSize: **16**
- lineHeightPx: **24** (PIXELS)
- letterSpacing: **0**
- color: **`#FFFFFF`** (white)
- textAlignHorizontal: CENTER
- textAlignVertical: CENTER
- textAutoResize: WIDTH_AND_HEIGHT

---

## 7. COLOR REFERENCE (RGB to Hex)

| Figma RGB | Hex | Usage |
|-----------|-----|-------|
| r:1.0, g:1.0, b:1.0 | `#FFFFFF` | Title "L", button text, logo |
| r:0.663, g:0.663, b:0.663 | `#A9A9A9` | Title "et's", input labels |
| r:1.0, g:0.604, b:0.427 | `#FF9A6D` | Title "fix the details", button stroke |
| r:0.529, g:0.529, b:0.529 | `#878787` | "Edit" text, hint text |
| r:0.867, g:0.867, b:0.867 | `#DDDDDD` | Focus variant value text |
| r:0.133, g:0.133, b:0.133 | `#222222` | Disabled variant value text (invisible), input bg (hidden) |
| r:0.302, g:0.302, b:0.302 | `#4D4D4D` | Disabled input border (hidden), pill divider |
| r:0.051, g:0.051, b:0.051 | `#0D0D0D` | Focus variant bottom border, button gradient stop 2 |
| r:0.125, g:0.125, b:0.125 | `#202020` | Button gradient stop 1 |
| r:0.075, g:0.075, b:0.075 | `#131313` | Screen background |
| r:0.6, g:0.361, b:0.255 | `#995C41` | Button drop shadow (24% opacity) |

---

## 8. FONT WEIGHT REFERENCE

| Style | PostScript Name | Weight | Usage |
|-------|----------------|--------|-------|
| Regular | PlusJakartaSans-Regular | 400 | Title text, input values, "Edit" text, hint text |
| Medium | PlusJakartaSans-Medium | 500 | Input labels (12px), button text (16px) |

---

## 9. ABSOLUTE POSITIONS (for verification)

All Y positions relative to frame top (350):

| Element | Y position | Height |
|---------|-----------|--------|
| Status bar | 350 | 53 |
| Logo | 467 | 38.4 |
| Title | 553.4 | 128 |
| Agreement ID (field 1) | 729.4 | 90 |
| Property Name (field 2) | 835.4 | 90 |
| Tenant(s) (field 3) | 941.4 | 90 |
| Landlord(s) (field 4) | 1047.4 | 90 |
| Monthly Rent (field 5) | 1153.4 | 90 |
| One-Time Deposit (field 6) | 1259.4 | 90 |
| Rent Duration (field 7) | 1365.4 | 90 |
| Exit Date (field 8) | 1471.4 | 90 |
| Button section | 1601.4 | 66 |

Gap verification:
- Logo (467) to Title (553.4) = 86.4 (logo height 38.4 + gap 48) = CORRECT
- Title (553.4+128=681.4) to Field 1 (729.4) = 48 = CORRECT (main content itemSpacing)
- Field 1 (729.4+90=819.4) to Field 2 (835.4) = 16 = CORRECT (input container itemSpacing)
- Field 8 (1471.4+90=1561.4) to Button (1601.4) = 40 = CORRECT (content container itemSpacing)
