# Verification Status Bottom Sheet - Complete Figma Extraction

**Source**: Figma file `IP4bJwxg5koRNfZ63AQJBo`, screen "Home --Empty State / user status --pending" (node `4131:4877`)
**Extracted**: 2026-03-28 from Figma REST API with `geometry=paths`

---

## ARCHITECTURE OVERVIEW

The bottom sheet is composed of these layers (z-order bottom to top):

1. **Backdrop Overlay** (`4131:5213`) - Rectangle covering full screen
2. **Bottom Sheet Container** (`4131:5215`) - The sheet itself, pinned to bottom
   - Handle Bar (`4131:5216`)
   - Content Frame (`4131:5217`)
     - Title Section (`4131:5218`)
     - Home Indicator (`4131:5238`)

Additionally, node `4111:70186` is the **Verification Status Module** that lives on the HOME SCREEN itself (the card-based setup progress section), NOT inside the bottom sheet. Both are documented below.

---

## 1. BACKDROP OVERLAY

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5213` (Rectangle 54) |
| **Size** | 393 x 852 (full screen) |
| **Fill** | `#000000` at 60% opacity |
| **Corner Radius** | 12px |
| **Effects** | `BACKGROUND_BLUR` radius: 8px |

---

## 2. BOTTOM SHEET CONTAINER

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5215` (Frame 2095586552) |
| **Size** | 393 x ~586.6 (width fixed, height HUG) |
| **Position from top** | 265px from screen top (31.1% down) |
| **Layout** | VERTICAL |
| **Counter Axis Align** | CENTER |
| **Item Spacing** | 15px (between handle and content) |
| **Background** | None (transparent - content frame has the bg) |

### 2a. Handle Bar

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5216` (Rectangle 53) |
| **Size** | 48 x 4 |
| **Fill** | `#4D4D4D` (100% opacity) |
| **Corner Radius** | 200px (pill shape) |
| **Layout Align** | INHERIT (centered by parent's CENTER counter-axis) |

### 2b. Content Frame

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5217` (Frame 1686557301) |
| **Size** | 393 x ~567.6 (fill width, HUG height) |
| **Fill** | `#1A1A1A` (100% opacity) |
| **Corner Radii** | TL: 22.79, TR: 22.79, BR: 0, BL: 0 |
| **Layout** | VERTICAL, center-aligned |
| **Item Spacing** | 40px |
| **Padding** | top: 15.19px |
| **Layout Sizing** | H: FILL, V: HUG |

---

## 3. CLOSE BUTTON (top-right of title area)

**Node ID**: `4131:5224` (Frame 1686557276) -- **HIDDEN** (parent `4131:5219` has `visible: false`)

| Property | Value |
|----------|-------|
| **Size** | 28.48 x 28.48 |
| **Fill** | `#EEEEEE` (100% opacity) |
| **Corner Radius** | 101.73px (circle) |
| **Padding** | 8.14px all sides |
| **Icon inside** | Plus/cross icon, 12.2 x 12.2 frame, 7.12 x 7.12 vector |
| **Icon fill** | `#000000` |
| **Icon SVG path** | `M3.05191 3.05191L3.05191 0L4.06922 0L4.06922 3.05191L7.12113 3.05191L7.12113 4.06922L4.06922 4.06922L4.06922 7.12113L3.05191 7.12113L3.05191 4.06922L0 4.06922L0 3.05191L3.05191 3.05191Z` |
| **Visibility** | **HIDDEN** (parent frame `4131:5219` is `visible: false`) |

> Note: The close button and image strip row are both hidden in this design state.

---

## 4. TITLE SECTION

**Container**: `4131:5227` (Frame 1686557311)

| Property | Value |
|----------|-------|
| **Size** | 393 x 104 (fill width, HUG height) |
| **Layout** | VERTICAL |
| **Primary Axis Align** | CENTER |
| **Counter Axis Align** | CENTER |
| **Item Spacing** | 4px (between title and subtitle) |
| **Padding** | left: 48px, right: 48px |

### 4a. Title Text

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5228` |
| **Text** | `"What is your Status?"` |
| **Font** | Plus Jakarta Sans Regular |
| **Weight** | 400 |
| **Size** | 28px |
| **Line Height** | 40px |
| **Letter Spacing** | -1.0 |
| **Color** | `#FFFFFF` (100% opacity) |
| **Text Align** | LEFT, V: CENTER |
| **Auto Resize** | HEIGHT |
| **Width** | 297px (fills parent minus padding) |

**Style override on "Status"**: The word "Status" uses a character style override:
- Fill: `#FF9A6D` (brand accent color, 100% opacity)
- (The rest of the text is `#FFFFFF`)

### 4b. Subtitle Text

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5229` |
| **Text** | `"How you save on rent depends on this."` |
| **Font** | Plus Jakarta Sans Regular |
| **Weight** | 400 |
| **Size** | 12px |
| **Line Height** | 20px |
| **Letter Spacing** | 0 |
| **Color** | `#878787` (100% opacity) |
| **Text Align** | LEFT, V: CENTER |
| **Auto Resize** | HEIGHT |

---

## 5. STATUS EXPLANATIONS SECTION

**Container**: `4131:5230` (Frame 2095586365)

| Property | Value |
|----------|-------|
| **Size** | 393 x 328 (fill width, HUG height) |
| **Layout** | VERTICAL |
| **Item Spacing** | 16px |
| **Padding** | left: 48px, right: 48px |
| **Content width** | 297px (393 - 48 - 48) |

### 5a. Top Divider

| Property | Value |
|----------|-------|
| **Node ID** | `4132:5951` (Vector 51) |
| **Width** | 297px (fills parent) |
| **Stroke** | `#4D4D4D`, weight: 0.25px, align: CENTER |

---

### 5b. PENDING Section

**Container**: `4132:5931` (Frame 2095586772)

| Property | Value |
|----------|-------|
| **Size** | 297 x 140 |
| **Layout** | VERTICAL |
| **Item Spacing** | 16px |

#### 5b-i. Pending Header Row

**Container**: `4131:5317` (Frame 2095586771)

| Property | Value |
|----------|-------|
| **Size** | 297 x 24 |
| **Layout** | HORIZONTAL |
| **Counter Axis Align** | CENTER |
| **Item Spacing** | 8px |

**Left side** (`4131:5318`, Frame 2095586769):
- Layout: HORIZONTAL, gap: 8px, CENTER aligned
- Contains:

  **Avatar** (`4131:5319`, Ellipse 8):
  | Property | Value |
  |----------|-------|
  | Size | 24 x 24 |
  | Fill | `#FFCC8A` + IMAGE overlay |
  | Shape | Circle (ellipse) |

  **Label container** (`4131:5320`, Frame 2095586346):
  | Property | Value |
  |----------|-------|
  | Size | 105 x 20 |
  | Layout | HORIZONTAL, CENTER/CENTER |

  **Label text** (`4131:5321`):
  | Property | Value |
  |----------|-------|
  | Text | `"IF YOUR STATUS IS"` |
  | Font | Plus Jakarta Sans Medium |
  | Weight | 500 |
  | Size | 12px |
  | Line Height | 20px |
  | Letter Spacing | 0 |
  | Color | `#A9A9A9` |

**Right side** (`4131:5322`, Frame 2095586770):
- Layout: HORIZONTAL, gap: 4px, CENTER aligned
- Contains:

  **Pending icon** (16x16 frame `4131:5323`):
  - Contains clock/alert icon vectors
  - Rounded square outline stroke in `#FF9A6D`, weight: 1px
  - Vertical line (stroke `#FF9A6D`): position inside clock face
  - Dot (stroke `#FF9A6D`): at bottom of clock face

  **Icon SVG paths** (inside 12x12 viewBox):
  - Outer rounded square (stroke): `M6 0L6 0.5C8.40357 0.5 9.70545 0.812557 10.4464 1.55355...` (rounded rect with ~1.55 radius)
  - Vertical line: `M0.5 0C0.5 -0.276142...` (2.67px tall line)
  - Dot: `M0 -0.5C-0.276142 -0.5...` (small circle at bottom)

  **"Pending -->" text** (`4131:5328`):
  | Property | Value |
  |----------|-------|
  | Text | `"Pending →"` (note: uses Unicode arrow →) |
  | Font | Plus Jakarta Sans Medium |
  | Weight | 500 |
  | Size | 12px |
  | Line Height | 20px |
  | Color | `#FF9A6D` |
  | Align | CENTER |

#### 5b-ii. Middle Divider

| Property | Value |
|----------|-------|
| **Node ID** | `4131:5330` (Vector 50) |
| **Width** | 297px |
| **Stroke** | `#4D4D4D`, weight: 0.25px |

#### 5b-iii. Pending Explanation

**Container**: `4131:5233` (Frame 1686557332)

| Property | Value |
|----------|-------|
| **Size** | 297 x 84 |
| **Layout** | VERTICAL, primary: CENTER |
| **Item Spacing** | 4px |

**Heading** (`4131:5235`):
| Property | Value |
|----------|-------|
| Text | `"You're almost there."` |
| Font | Plus Jakarta Sans Regular |
| Weight | 400 |
| Size | 14px |
| Line Height | 20px |
| Letter Spacing | 0 |
| Color | `#CBCBCB` |

**Body** (`4131:5234`):
| Property | Value |
|----------|-------|
| Text | `"Your cashback keeps building in the background, but it isn't applied to your rent yet.Every 1% you earn stays accumulated until you finish setup."` |
| Font | Plus Jakarta Sans Regular |
| Weight | 400 |
| Size | 12px |
| Line Height | 20px |
| Letter Spacing | 0 |
| Color | `#878787` |

> Note: There appears to be a missing space between "yet." and "Every" in the Figma text.

---

### 5c. Section Divider (between Pending and Verified)

| Property | Value |
|----------|-------|
| **Node ID** | `4132:5949` (Vector 50) |
| **Width** | 297px |
| **Stroke** | `#4D4D4D`, weight: 0.25px |

---

### 5d. VERIFIED Section

**Container**: `4132:5932` (Frame 2095586773)

| Property | Value |
|----------|-------|
| **Size** | 297 x 140 |
| **Layout** | VERTICAL |
| **Item Spacing** | 16px |

#### 5d-i. Verified Header Row

**Container**: `4132:5933` (Frame 2095586771)

| Property | Value |
|----------|-------|
| **Size** | 297 x 24 |
| **Layout** | HORIZONTAL |
| **Counter Axis Align** | CENTER |
| **Item Spacing** | 8px |

**Left side** (`4132:5934`, Frame 2095586769):
- Layout: HORIZONTAL, gap: 8px, CENTER aligned

  **Avatar** (`4132:5935`, Ellipse 8):
  | Property | Value |
  |----------|-------|
  | Size | 24 x 24 |
  | Fill | `#FFCC8A` + IMAGE overlay |

  **Label** (`4132:5937`):
  | Property | Value |
  |----------|-------|
  | Text | `"IF YOUR STATUS IS"` |
  | Font | Plus Jakarta Sans Medium, 500 |
  | Size | 12px, Line Height: 20px |
  | Color | `#A9A9A9` |

**Right side** (`4132:5952`, Frame 2095586771):
- Layout: HORIZONTAL, gap: 4px, CENTER aligned

  **Verified icon** (16x16 frame `4132:5953`):
  - Contains circle + checkmark vectors
  - Circle outline (stroke `#4CAF50`, weight: 1px)
  - Checkmark (stroke `#4CAF50`, weight: 1px)

  **Icon SVG paths** (inside 12x12 viewBox):
  - Circle (stroke): Full circle path with stroke `#4CAF50`
  - Checkmark (stroke): `M0.353553 0.97978...` path (L-shaped check, 4x2.67)

  **"Verified -->" text** (`4132:5957`):
  | Property | Value |
  |----------|-------|
  | Text | `"Verified →"` |
  | Font | Plus Jakarta Sans Medium |
  | Weight | 500 |
  | Size | 12px |
  | Line Height | 20px |
  | Color | `#4CAF50` (green) |
  | Align | CENTER |

#### 5d-ii. Bottom Divider

| Property | Value |
|----------|-------|
| **Node ID** | `4132:5945` (Vector 50) |
| **Width** | 297px |
| **Stroke** | `#4D4D4D`, weight: 0.25px |

#### 5d-iii. Verified Explanation

**Container**: `4132:5946` (Frame 1686557332)

| Property | Value |
|----------|-------|
| **Size** | 297 x 84 |
| **Layout** | VERTICAL, primary: CENTER |
| **Item Spacing** | 4px |

**Heading** (`4132:5947`):
| Property | Value |
|----------|-------|
| Text | `"You're fully set up"` |
| Font | Plus Jakarta Sans Regular |
| Weight | 400 |
| Size | 14px |
| Line Height | 20px |
| Letter Spacing | 0 |
| Color | `#CBCBCB` |

**Body** (`4132:5948`):
| Property | Value |
|----------|-------|
| Text | `"Now your cashback starts working for you. 1% of your rent is automatically adjusted every month — less out of your pocket, every time you pay."` |
| Font | Plus Jakarta Sans Regular |
| Weight | 400 |
| Size | 12px |
| Line Height | 20px |
| Letter Spacing | 0 |
| Color | `#878787` |

---

## 6. CTA BUTTON (Hidden in this state)

**Node ID**: `4132:5962` (button instance) -- **HIDDEN** (`visible: false`)

| Property | Value |
|----------|-------|
| **Size** | 393 x 62 (fill width, HUG height) |
| **Padding** | left: 48px, right: 48px |
| **Corner Radius** | 12px |
| **Visible** | **false** |

**Button inner** (`I4132:5962;100:1564`):
| Property | Value |
|----------|-------|
| **Size** | 297 x 56 |
| **Fill** | Linear gradient: `#202020` (0%) -> `#0D0D0D` (100%) |
| **Stroke** | `#FF9A6D`, weight: 0.1px, inside |
| **Corner Radius** | 8px |
| **Layout** | HORIZONTAL, CENTER/CENTER |
| **Padding** | 16px all sides |
| **Effects** | DROP_SHADOW: `#995C41` (24% opacity), radius 12, offset (0,6); INNER_SHADOW: `#FFFFFF` (12% opacity), radius 4, offset (0,-3); INNER_SHADOW: `#000000` (100% opacity), radius 0, offset (-2,-4) |

**Button text** (`I4132:5962;100:1565`):
| Property | Value |
|----------|-------|
| Text | `"Start saving on rent →"` |
| Font | Plus Jakarta Sans Medium |
| Weight | 500 |
| Size | 14px |
| Line Height | 20px |
| Color | `#FFFFFF` |

---

## 7. HOME INDICATOR

**Node ID**: `4131:5238` (Home Indicator instance)

| Property | Value |
|----------|-------|
| **Container Size** | 393 x 34 |
| **Bar size** | 152 x 5 |
| **Bar fill** | `#FFFFFF` |
| **Bar corner radius** | 100px (pill) |
| **Position** | Centered in 393px container, 21px from top of container |

---

## 8. HOME SCREEN MODULE (Node 4111:70186)

This is the **inline verification status module** that appears on the home screen itself (NOT inside the bottom sheet). It shows setup step cards.

**Container**: `4111:70186` (Frame 2095586753)

| Property | Value |
|----------|-------|
| **Size** | 329 x 203 (fill width, HUG height) |
| **Layout** | VERTICAL |
| **Item Spacing** | 16px |

### 8a. Section Label

| Property | Value |
|----------|-------|
| **Node ID** | `4111:70187` |
| **Text** | `"COMPLETE SETUP TO ACCESS YOUR CASHBACK"` |
| **Font** | Plus Jakarta Sans Regular, 400 |
| **Size** | 12px |
| **Line Height** | 20px |
| **Color** | `#A9A9A9` |

### 8b. Three Setup Cards Row

**Container**: `4131:2668` (Frame 2095586645)

| Property | Value |
|----------|-------|
| **Layout** | HORIZONTAL |
| **Item Spacing** | 4px |
| **Width** | fills parent (329px) |

Each card is identical structure:

#### Card 1: "Add landlord's bank details" (COMPLETED)

| Property | Value |
|----------|-------|
| **Node ID** | `4131:2669` |
| **Size** | ~107 x 115 (1/3 of row, FILL + GROW) |
| **Opacity** | 0.48 (dimmed - completed) |
| **Fill** | `#202020` |
| **Corner Radius** | 12px |
| **Padding** | 16px all sides |
| **Layout** | VERTICAL, primary: CENTER |
| **Item Spacing** | 16px |
| **Icon** | Checkbox with checkmark, 16x16 frame |
| **Icon fill** | `#FF9A6D` |
| **Icon SVG** | Rounded square with checkmark: `M10.8887 0C12.1953 0 13.262 1.02467...` (13.33x13.33 viewBox) |
| **Text** | `"Add landlord's bank details"` |
| **Text decoration** | **STRIKETHROUGH** |
| **Text color** | `#FF9A6D` |
| **Font** | Plus Jakarta Sans Regular, 400 |
| **Text size** | 12px, line height: 16.92px, letter spacing: -0.24 |

#### Card 2: "Upload address proof" (COMPLETED)

| Property | Value |
|----------|-------|
| **Node ID** | `4131:2685` |
| **Opacity** | 0.48 (dimmed - completed) |
| **Icon** | Same checkbox+checkmark as Card 1 |
| **Text** | `"Upload address proof"` |
| **Text decoration** | **STRIKETHROUGH** |
| All other properties identical to Card 1 |

#### Card 3: "Awaiting Landlord Approval" (PENDING)

| Property | Value |
|----------|-------|
| **Node ID** | `4131:2679` |
| **Opacity** | 1.0 (NOT dimmed - this is the active step) |
| **Icon** | Rounded square outline only (no checkmark), 12x12 |
| **Icon stroke** | `#FF9A6D`, weight: 1px, center |
| **Icon SVG** | Rounded rectangle outline stroke path |
| **Text** | `"Awaiting Landlord Approval"` |
| **Text color** | `#878787` (muted, not accent) |
| **Text decoration** | None (no strikethrough) |
| **Font** | Plus Jakarta Sans Regular, 400 |
| **Text size** | 12px, line height: 16.92px, letter spacing: -0.24 |
| **Text fixed size** | 58 x 51 (FIXED, not HUG) |

### 8c. "How to invite your landlord?" CTA Bar

**Container**: `4111:70199` (Frame 2095586455)

| Property | Value |
|----------|-------|
| **Size** | 329 x 36 (fill width, HUG height) |
| **Fill** | `#1A1A1A` |
| **Corner Radius** | 8px |
| **Layout** | HORIZONTAL |
| **Counter Axis Align** | CENTER |
| **Item Spacing** | 10px |
| **Padding** | top: 8, bottom: 8, left: 12, right: 12 |

**Left text** (`4111:70200`):
| Property | Value |
|----------|-------|
| Text | `"How to invite your landlord?"` |
| Color | `#FF9A6D` |
| Font | Plus Jakarta Sans Regular, 400 |
| Size | 12px, Line Height: 20px |
| Layout | FILL + GROW |

**Right text** (`4111:70201`):
| Property | Value |
|----------|-------|
| Text | `"Learn More"` |
| Color | `#FF9A6D` |
| Font | Plus Jakarta Sans Regular, 400 |
| Size | 12px, Line Height: 20px |
| Decoration | **UNDERLINE** (on "Learn More" portion via style override) |
| Layout | HUG |

---

## COMPLETE SPACING MAP (Bottom Sheet)

```
Sheet Container (393 x ~587)
|
+-- Handle Bar (48 x 4) ................ centered horizontally
|   [15px gap to content frame]
|
+-- Content Frame (393 x ~568)
    bg: #1A1A1A, border-radius: 22.79 22.79 0 0
    padding-top: 15.19px
    |
    +-- [Hidden: Close button row] (visible: false)
    |
    +-- Title Section (393 x 104)
    |   padding: 0 48px
    |   |
    |   +-- "What is your Status?" .... 28px, #FFF + #FF9A6D for "Status"
    |   |   [4px gap]
    |   +-- "How you save..." ......... 12px, #878787
    |
    |   [30.38px gap -- item spacing]
    |
    +-- Status Sections (393 x 328)
    |   padding: 0 48px
    |   |
    |   +-- Divider ................... #4D4D4D, 0.25px
    |   |   [16px gap]
    |   +-- PENDING BLOCK (297 x 140)
    |   |   |
    |   |   +-- Header Row (297 x 24)
    |   |   |   [avatar 24x24] [8px] ["IF YOUR STATUS IS"] [8px] [icon 16x16] [4px] ["Pending →" #FF9A6D]
    |   |   |   [16px gap]
    |   |   +-- Divider ............... #4D4D4D, 0.25px
    |   |   |   [16px gap]
    |   |   +-- Explanation (297 x 84)
    |   |       +-- "You're almost there." ... 14px, #CBCBCB
    |   |       |   [4px gap]
    |   |       +-- "Your cashback keeps..." .. 12px, #878787
    |   |
    |   |   [16px gap]
    |   +-- Divider ................... #4D4D4D, 0.25px
    |   |   [16px gap]
    |   +-- VERIFIED BLOCK (297 x 140)
    |   |   |
    |   |   +-- Header Row (297 x 24)
    |   |   |   [avatar 24x24] [8px] ["IF YOUR STATUS IS"] [8px] [icon 16x16] [4px] ["Verified →" #4CAF50]
    |   |   |   [16px gap]
    |   |   +-- Divider ............... #4D4D4D, 0.25px
    |   |   |   [16px gap]
    |   |   +-- Explanation (297 x 84)
    |   |       +-- "You're fully set up" ... 14px, #CBCBCB
    |   |       |   [4px gap]
    |   |       +-- "Now your cashback..." ... 12px, #878787
    |
    |   [40px gap -- content frame item spacing]
    |
    +-- [Hidden: CTA Button] (visible: false)
    |
    +-- Home Indicator (393 x 34)
        bar: 152 x 5, #FFF, pill shape
```

---

## COLOR PALETTE SUMMARY

| Token | Hex | Usage |
|-------|-----|-------|
| Backdrop | `#000000` @ 60% | Overlay behind sheet |
| Sheet BG | `#1A1A1A` | Content frame background |
| Handle | `#4D4D4D` | Handle bar pill |
| Dividers | `#4D4D4D` @ 0.25px | Section separators |
| Title | `#FFFFFF` | Main heading |
| Title accent | `#FF9A6D` | "Status" word in heading |
| Subtitle | `#878787` | Subtitle text |
| Section heading | `#CBCBCB` | "You're almost there" / "You're fully set up" |
| Section body | `#878787` | Explanation paragraphs |
| Label | `#A9A9A9` | "IF YOUR STATUS IS" |
| Avatar BG | `#FFCC8A` | Circle avatar background |
| Pending accent | `#FF9A6D` | Pending icon + text |
| Verified accent | `#4CAF50` | Verified icon + text (green) |
| Button text | `#FFFFFF` | CTA button (hidden) |
| Home indicator | `#FFFFFF` | Bottom bar |

## TYPOGRAPHY SUMMARY

| Element | Font | Weight | Size | Line Height | Letter Spacing | Color |
|---------|------|--------|------|-------------|----------------|-------|
| Title | Plus Jakarta Sans | Regular (400) | 28px | 40px | -1.0 | #FFFFFF / #FF9A6D |
| Subtitle | Plus Jakarta Sans | Regular (400) | 12px | 20px | 0 | #878787 |
| "IF YOUR STATUS IS" | Plus Jakarta Sans | Medium (500) | 12px | 20px | 0 | #A9A9A9 |
| "Pending →" | Plus Jakarta Sans | Medium (500) | 12px | 20px | 0 | #FF9A6D |
| "Verified →" | Plus Jakarta Sans | Medium (500) | 12px | 20px | 0 | #4CAF50 |
| Section heading | Plus Jakarta Sans | Regular (400) | 14px | 20px | 0 | #CBCBCB |
| Section body | Plus Jakarta Sans | Regular (400) | 12px | 20px | 0 | #878787 |
| Button text | Plus Jakarta Sans | Medium (500) | 14px | 20px | 0 | #FFFFFF |
