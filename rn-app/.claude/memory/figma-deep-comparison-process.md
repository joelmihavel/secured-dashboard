# Figma Deep Comparison Process

## MANDATORY: Always Perform COMPLETE Deep Data Comparison

**CRITICAL**: This comparison must cover EVERYTHING, not just design tokens:
- Exact text content (including special characters, apostrophes, arrows, spacing)
- Asset positioning and rendering
- UI component structure
- Interaction behaviors
- All visual properties

For EVERY screen during parity testing, follow this exact process:

### Step 1: Load Figma Extracted Data

```bash
# Data location for each screen:
/figma-parity/data/screens/[node-id]/
├── extracted-values.json   # Full node tree with all properties
├── colors-used.json        # All colors used on screen
├── meta.json               # Screen metadata
└── assets/                 # Exported images/icons
```

### Step 2: Extract Key Values from extracted-values.json

For each UI element, extract:

**Geometry:**
- `x`, `y` (position)
- `width`, `height`

**Visual:**
- `fills[].hex` (background color)
- `strokes[].hex` (border color)
- `cornerRadius.all` (border radius)
- `opacity`

**Layout (for containers):**
- `layout.paddingTop/Right/Bottom/Left`
- `layout.gap`
- `layout.mode` (HORIZONTAL/VERTICAL)
- `layout.primaryAlign`, `layout.counterAlign`

**Typography (for text):**
- `typography.fontFamily`
- `typography.fontSize`
- `typography.fontWeight`
- `typography.lineHeight`
- `typography.letterSpacing`
- `typography.textAlign`
- `typography.text` (actual content)

### Step 3: Calculate Gaps Between Elements

Use Y positions to calculate exact gaps:
```
Gap = Element2.y - (Element1.y + Element1.height)

Example:
- Logo: y=756, height=40 → bottom at 796
- Badge: y=809
- Gap = 809 - 796 = 13px
```

### Step 4: Create Comparison Table

ALWAYS output a comparison table like this:

| Element | Figma Value | Implementation | Status |
|---------|-------------|----------------|--------|
| Background | #131313 | `colors.black[700]` | ✅/❌ |
| Element width | 33.375px | `scaled(33.375)` | ✅/❌ |
| ... | ... | ... | ... |

### Step 5: Map to Design Tokens

Convert ALL Figma values to design tokens:

```typescript
// Colors
#131313 → colors.black[700]
#FF9A6D → colors.brand[500]
#000000 → colors.black[900]
#FFFFFF → colors.white

// Spacing (use token if exact match, scaledSpacing if custom)
4px  → spacing.xxs
8px  → spacing.xs
12px → spacing.sm
16px → spacing.md
13px → scaledSpacing(13)  // Custom value

// Radius
4px  → radius.xs
8px  → radius.sm
12px → radius.md

// Typography
fontSize: 12, fontWeight: 500, lineHeight: 20 → typography.bodySmMedium
fontSize: 48, fontWeight: 400, lineHeight: 64 → typography.h1
```

### Step 6: Verify ALL Properties (Beyond Design Tokens)

**A. Design Tokens:**
- [ ] Background color
- [ ] All element colors (fills, strokes)
- [ ] All dimensions (width, height)
- [ ] All spacing (padding, margins, gaps)
- [ ] All border radii
- [ ] All typography (font, size, weight, lineHeight, letterSpacing)
- [ ] Text content and alignment
- [ ] Layout direction (flex row/column)

**B. Visual Properties:**
- [ ] Opacity values
- [ ] Shadows (offset, blur, spread, color)
- [ ] Gradients (colors, stops, direction)
- [ ] Borders (width, style, color)
- [ ] Blend modes

**C. UI Components:**
- [ ] Component hierarchy matches Figma
- [ ] Component naming matches Figma node names
- [ ] Nested component structure correct
- [ ] Component variants (if any)

**D. Assets:**
- [ ] Images match Figma exports
- [ ] Icons match Figma vectors
- [ ] SVG paths match exactly
- [ ] Asset dimensions correct
- [ ] Asset colors correct

**E. Interactions & Animations:**
- [ ] Navigation targets match Figma prototypes
- [ ] Animation timing (duration, delay)
- [ ] Animation easing curves
- [ ] Gesture handlers (tap, swipe, etc.)
- [ ] State transitions (hover, pressed, disabled)

**F. Other Values:**
- [ ] Z-index / layer ordering
- [ ] Scroll behavior
- [ ] Clip/overflow settings
- [ ] Transform values (rotate, scale, translate)
- [ ] Safe area handling

### Step 7: Verify TEXT CONTENT Exactly

**CRITICAL - Compare character by character:**
- [ ] Exact text strings match (copy from `typography.text` field)
- [ ] Special characters: arrows (→ U+2192), curly quotes (' "), em-dashes (—)
- [ ] Apostrophes: curly (') vs straight (')
- [ ] Spacing: single vs double spaces
- [ ] Line breaks: where text wraps

**Example issues found:**
- Figma: "India's" (curly apostrophe) vs Code: "India's" (straight)
- Figma: "Make  your rent" (double space) vs Code: "Make your rent"

### Step 8: Verify ASSETS

**Check all images/icons:**
- [ ] Asset files exist in `/src/assets/` or `/figma-parity/data/screens/[id]/assets/`
- [ ] Asset dimensions match Figma
- [ ] Asset positioning (x, y coordinates converted to styles)
- [ ] Asset opacity
- [ ] Asset transformations (rotation, scale, flip)

### Step 9: Verify UI COMPONENT STRUCTURE

**Match Figma node hierarchy:**
- [ ] Parent-child relationships match
- [ ] Text nodes: single vs split (Figma often has ONE text node with styled ranges)
- [ ] Container nesting levels
- [ ] Component instances match variants

### Step 10: Verify INTERACTIONS

**From Figma `interactions` array:**
- [ ] Navigation targets (destinationId)
- [ ] Trigger types (ON_PRESS, ON_CLICK)
- [ ] Animation timing and easing
- [ ] Haptic feedback

### Step 11: Document Any Deviations

If a value doesn't match exactly, document:
1. What Figma shows
2. What we implemented
3. Why (e.g., "closest token" or "scaled for responsiveness")

## Example: Beta Splash (1-28071)

Key nodes from extracted-values.json:
- `176:2750` - Logo Container (33.375 x 40)
- `176:2751` - Logo Vector (white fill)
- `176:2752` - Badge Frame (96 x 28, #FF9A6D, radius 4, padding 8/4)
- `176:2753` - Badge Text (12px Medium, -0.2 tracking, #000000)

Gap calculation: Badge.y(809) - Logo.bottom(756+40=796) = 13px
