# Figma Parity Implementation Guidelines

## MANDATORY: Design Tokens + Responsive Scaling

When implementing ANY screen from Figma, follow these rules:

### 1. Use Design Tokens (NOT hardcoded values)

| Figma Value | Use Token |
|-------------|-----------|
| Colors (#131313, #FF9A6D, etc.) | `colors.black[700]`, `colors.brand[500]` |
| Border radius (4, 8, 12, etc.) | `radius.xs`, `radius.sm`, `radius.md` |
| Padding/Spacing (4, 8, 12, 16, 24, etc.) | `spacing.xxs`, `spacing.xs`, `spacing.sm`, `spacing.md`, `spacing.lg` |
| Typography (font, size, weight) | `typography.bodySmMedium`, `typography.h1`, etc. |

### 2. Responsive Scaling Rules

**Fixed values (use tokens directly):**
- Border radius: `radius.xs` (4pt) - stays constant
- Small padding: `spacing.xs` (8pt) - stays constant
- Typography sizes - use `typography.*` tokens

**Scaled values (wrap with scaling functions):**
- Custom gaps not in tokens: `scaledSpacing(13)`
- Content widths: `scaledWidth(297)`
- Large layout spacing: `scaled(64)`

### 3. Token Reference

```typescript
// Spacing tokens
spacing.xxs = 4    // Figma 4px
spacing.xs = 8     // Figma 8px
spacing.sm = 12    // Figma 12px
spacing.md = 16    // Figma 16px
spacing.lg = 24    // Figma 24px
spacing.xl = 32    // Figma 32px
spacing.xxl = 40   // Figma 40px
spacing.xxxl = 48  // Figma 48px
spacing.huge = 64  // Figma 64px

// Radius tokens
radius.xs = 4      // Figma 4px
radius.sm = 8      // Figma 8px
radius.md = 12     // Figma 12px
radius.lg = 16     // Figma 16px
radius.xl = 24     // Figma 24px
radius.pill = 200  // Figma pill/capsule

// Color tokens
colors.black[900] = #000000
colors.black[700] = #131313  // App background
colors.black[500] = #202020
colors.black[400] = #4D4D4D
colors.black[300] = #797979
colors.black[200] = #A6A6A6
colors.brand[500] = #FF9A6D  // Primary accent
colors.neutral[500] = #A9A9A9
colors.white = #FFFFFF
```

### 4. Import Pattern

```typescript
import {
  colors,
  spacing,
  radius,
  typography,
  scaled,
  scaledSpacing,
  scaledWidth
} from '@/src/theme';
```

### 5. Figma Data Location

All extracted Figma data is in `/figma-parity/data/screens/[node-id]/`:
- `colors-used.json` - All colors on the screen
- `layout.json` - Component positions and sizes
- `typography.json` - Font styles used
- `screenshot.png` - Visual reference

### 6. Scaling Behavior Across iPhones

| Device | Width | Scale Factor |
|--------|-------|--------------|
| iPhone SE | 375pt | 0.95x |
| iPhone 15 | 393pt | 1.0x (base) |
| iPhone 15 Pro Max | 430pt | 1.09x |

- Design tokens = FIXED (consistent across devices)
- `scaledSpacing()` = PROPORTIONAL (scales with screen)
