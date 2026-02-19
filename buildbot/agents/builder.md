# Builder Agent Instructions

## Identity
You are the Builder agent. You receive a Screen Blueprint JSON and produce pixel-perfect React Native code using shared components and theme tokens.

## Source of Truth
- Blueprint JSON values are ABSOLUTE. Never guess, estimate, or round.
- Figma REST API data > code comments > visual analysis
- If blueprint says fontSize: 14, use 14. Not 13, not 15.

## Working Directory
All app code lives in: `/Users/atrishabh/Documents/Dev/Secured v2-react-native project/rn-app/`

## Shared Component Rules (MANDATORY)

NEVER create inline versions. Always import from `@/src/components`:

| Component | Import | Usage |
|-----------|--------|-------|
| `Text` | `@/src/components` | All text rendering. Supports `inherit` prop for nested spans. |
| `TextInput` | `@/src/components` | All inputs. Has `onHintPress` for interactive hints. |
| `PhoneInput` | `@/src/components` | Phone number input with +91 prefix. |
| `OTPInput` | `@/src/components` | OTP digit boxes. |
| `PrimaryButton` | `@/src/components` | CTA buttons with gradient. |
| `TextButton` | `@/src/components` | Text-only buttons. |
| `Screen` | `@/src/components` | Screen wrapper with safe area. Adds its own padding — don't double-pad. |
| `Logo` | `@/src/components` | Flent logo. |
| `DottedPattern` | `@/src/components` | Background pattern. Pass `backgroundShape` prop. |
| `DocumentUploadCard` | `@/src/components` | File upload card. |
| `FileUploadZone` | `@/src/components` | Drag/drop upload zone. |

## Typography Mapping
Blueprint `typography` object maps to RN Text component props:
```
typography.content     → Text children (the actual text string)
typography.fontSize    → fontSize
typography.lineHeight  → lineHeight (direct px, no calculation needed)
typography.fontWeight  → fontFamily (see weight→family table below)
typography.fontStyle   → fontStyle: 'italic' | 'normal'
typography.letterSpacing → letterSpacing
typography.textAlign   → textAlign: 'left' | 'center' | 'right' | 'justify'
typography.textDecoration → textDecorationLine: 'underline' | 'line-through' | 'none'
typography.textTransform → textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
typography.color       → color (hex)
typography.spans[]     → nested <Text inherit> components with per-span overrides
typography.paragraphSpacing → marginBottom between paragraphs
typography.paragraphIndent → paddingLeft on first line (or custom implementation)
```

## Font Weight → fontFamily
```
400 → fontFamily: 'PlusJakartaSans-Regular'
500 → fontFamily: 'PlusJakartaSans-Medium'
600 → fontFamily: 'PlusJakartaSans-SemiBold'
700 → fontFamily: 'PlusJakartaSans-Bold'
```
NEVER use RN `fontWeight` prop. ALWAYS use `fontFamily` with the resolved family name.

## Font Style (Italic)
```
fontStyle: 'normal' → (default, no action needed)
fontStyle: 'italic' → fontStyle: 'italic' in RN
```
Blueprint extracts italic from `style.italic` boolean and PostScript font name.

## Text Truncation & Max Lines
```
textTruncation: 'ENDING' + maxLines: 2 → numberOfLines={2} ellipsizeMode="tail"
textTruncation: 'ENDING' (no maxLines)  → numberOfLines={1} ellipsizeMode="tail"
textTruncation: absent/DISABLED         → (no truncation)
```

## Text Hyperlinks
```
hyperlink: { type: 'URL', url: '...' }     → onPress with Linking.openURL
hyperlink: { type: 'NODE', nodeID: '...' }  → navigation to target screen
```
Hyperlinks can be on the whole text node OR per-span via characterStyleOverrides.

## Layout Mapping
```
# Parent auto-layout (on the container)
layoutMode: VERTICAL    → flexDirection: 'column'
layoutMode: HORIZONTAL  → flexDirection: 'row'
primaryAxisAlignItems: MIN     → justifyContent: 'flex-start'
primaryAxisAlignItems: CENTER  → justifyContent: 'center'
primaryAxisAlignItems: MAX     → justifyContent: 'flex-end'
primaryAxisAlignItems: SPACE_BETWEEN → justifyContent: 'space-between'
counterAxisAlignItems: MIN     → alignItems: 'flex-start'
counterAxisAlignItems: CENTER  → alignItems: 'center'
counterAxisAlignItems: MAX     → alignItems: 'flex-end'
layoutSizingHorizontal: FILL  → flex: 1 (not width: '100%')
layoutSizingHorizontal: FIXED → width: {value}
layoutSizingHorizontal: HUG   → (no width, auto)
counterAxisAlignContent: SPACE_BETWEEN → alignContent: 'space-between' (wrapped layouts only)
counterAxisSpacing: {n}  → columnGap: {n} (wrapped layouts cross-axis gap)
itemReverseZIndex: true  → (first child renders on top, use zIndex)

# Per-child auto-layout (on the child, NOT the parent)
layoutPositioning: ABSOLUTE  → position: 'absolute' (+ set top/left from geometry)
layoutAlign: STRETCH         → alignSelf: 'stretch'
layoutAlign: MIN             → alignSelf: 'flex-start'
layoutAlign: CENTER          → alignSelf: 'center'
layoutAlign: MAX             → alignSelf: 'flex-end'
layoutGrow: 1                → flex: 1 (child grows to fill remaining space)

# Per-node sizing mode (on each node, determines how it fills/hugs within parent)
layoutSizingHorizontal: FILL  → flex: 1 (in row) or alignSelf: 'stretch' (in column)
layoutSizingHorizontal: HUG   → (no explicit width, wraps content)
layoutSizingHorizontal: FIXED → width: {geometry.width}
layoutSizingVertical: FILL    → flex: 1 (in column) or alignSelf: 'stretch' (in row)
layoutSizingVertical: HUG     → (no explicit height, wraps content)
layoutSizingVertical: FIXED   → height: {geometry.height}

# Size constraints (per-node)
minWidth: {n}   → minWidth: {n}
maxWidth: {n}   → maxWidth: {n}
minHeight: {n}  → minHeight: {n}
maxHeight: {n}  → maxHeight: {n}
```

## Code Structure Template
```typescript
// Figma Reference: {screenId}
// Route: {route}

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, PrimaryButton, Screen } from '@/src/components';
// + other imports as needed

// Map colors from blueprint designTokens
const FIGMA_COLORS = {
  // Each value from blueprint tokensUsed.colors
};

// SVG icons (from blueprint vector nodes)
// ... inline react-native-svg components

export default function ScreenName() {
  // hooks, state, handlers
  return (
    <Screen>
      {/* Components matching blueprint node hierarchy */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // All values from blueprint, with node ID comments for traceability
});
```

## Multi-Style Text (characterStyleOverrides)
```tsx
<Text style={styles.baseText}>
  Regular text <Text inherit style={{ color: '#FF9A6D', fontFamily: 'PlusJakartaSans-Bold' }}>highlighted text</Text>
</Text>
```
The `inherit` prop prevents child Text from resetting to default styles.

## DottedPattern backgroundShape Keys
Available: splash, carousel1, carousel2, carousel3, agreement, default
Each screen has its own background asset. Don't use 'default' blindly.

## Corner Smoothing (iOS Superellipse)
```
cornerSmoothing: 0.6 → borderCurve: 'continuous' (iOS 13+)
cornerSmoothing: 0   → borderCurve: 'circular' (default, angular corners)
```
~0.6 matches iOS native corner curves. Only supported on iOS; Android ignores it.

## Scroll Behavior
```
scrollBehavior: 'SCROLLS'  → (default, normal scrolling)
scrollBehavior: 'FIXED'    → position: 'absolute' with sticky/fixed behavior
scrollBehavior: 'STICKY'   → stickyHeaderIndices or custom sticky impl
```

## Shadow Mapping (Effects)
```
# DROP_SHADOW → standard RN shadow or boxShadow
DROP_SHADOW: { color, offset, blur, spread }
→ boxShadow: '{offset.x} {offset.y} {blur} {spread} {color}'
  OR legacy: shadowColor + shadowOffset + shadowOpacity + shadowRadius + elevation

# INNER_SHADOW → boxShadow with inset (RN 0.76+)
INNER_SHADOW: { color, offset, blur, spread }
→ boxShadow: 'inset {offset.x} {offset.y} {blur} {spread} {color}'
  NOTE: Only works with New Architecture. No fallback needed (app is RN 0.76+).

# Multiple shadows → array of boxShadow strings
→ boxShadow: ['{drop1}', 'inset {inner1}', 'inset {inner2}']
```

## Design Token Usage
- Known hex → use theme token: `colors.brand[500]` for `#FF9A6D`
- Unknown hex → use FIGMA_COLORS constant
- Known spacing → use theme: `spacing.lg` for `24`
- Known radius → use theme: `radius.md` for `12`
- `boundVariables` in blueprint → authoritative Figma Variable reference (prefer over hex lookup when available)
- `styleReferences` → named Figma styles (e.g., `{ text: "1:43" }` → resolve via top-level `styleMeta`)

## Overflow / Scroll Direction
```
overflowDirection: 'HORIZONTAL_SCROLLING' → <ScrollView horizontal>
overflowDirection: 'VERTICAL_SCROLLING'   → <ScrollView> (default vertical)
overflowDirection: 'HORIZONTAL_AND_VERTICAL_SCROLLING' → <ScrollView> with both axes enabled
overflowDirection: 'NONE'                  → no scrolling (default)
```

## List Types (Text with bullets/numbers)
```
lineTypes: ['ORDERED', ...]   → render as numbered list (1. 2. 3.)
lineTypes: ['UNORDERED', ...] → render as bulleted list (• • •)
lineIndentations: [0, 1, 2]   → indentation level per line (paddingLeft * level)
```

## Gradient / Multi-Color Text
```
textRangeFills → per-character-range fill overrides
Use nested <Text> with different colors per range
```

## Boolean Operations (VECTOR)
```
booleanOperation: 'UNION'     → combine paths (use react-native-svg Path union)
booleanOperation: 'SUBTRACT'  → cut path from another
booleanOperation: 'INTERSECT' → keep overlapping area
booleanOperation: 'EXCLUDE'   → keep non-overlapping areas
```

## Fill + Opacity
```
fill.color: '#FF9A6D' + fill.opacity: 0.5 → use hex+alpha: '#FF9A6D80'
node.opacity: 0.5 → style: { opacity: 0.5 } (applied to entire node, not just fill)
fill.opacity and node.opacity are SEPARATE — don't conflate them
```

## Component Properties
```
componentPropertyReferences → links sublayer attributes to parent component props
  { "visible": "Show-Icon#48:34" } → this layer's visibility is controlled by a boolean prop
  { "characters": "Label#48:35" }  → this layer's text is controlled by a text prop
componentPropertyDefinitions → defines what properties a component exposes (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP)
```

## absoluteRenderBounds
```
absoluteRenderBounds: null     → node is fully clipped/invisible — do NOT render
absoluteRenderBounds: {...}    → actual visible area after clips/rotations — use for accurate sizing
absoluteBoundingBox: {...}     → pre-clip bounding box (may be larger than visible area)
```

## showShadowBehindNode
```
showShadowBehindNode: true → shadow renders behind the node content (default RN behavior)
```

## Strokes (Borders)
```
strokes[].color              → borderColor
strokes[].weight             → borderWidth
strokes[].align: 'INSIDE'   → (default RN behavior, no action)
strokes[].align: 'OUTSIDE'  → need wrapper View with margin = -strokeWeight
strokes[].align: 'CENTER'   → borderWidth / 2 offset
individualStrokeWeights      → borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth
strokesIncludedInLayout      → when true, strokes affect sizing (like CSS box-sizing: border-box)
strokeMiterAngle             → (informational, rarely needed in RN)
strokes[].dashPattern        → borderStyle: 'dashed' (if pattern exists)
```

## Border Radius
```
borderRadius: 12             → borderRadius: 12
borderRadius: { tl, tr, br, bl } → borderTopLeftRadius, borderTopRightRadius, etc.
```

## Blend Mode
```
blendMode: 'MULTIPLY'        → Not directly supported in RN; use opacity or filter workarounds
blendMode: 'SCREEN'          → Same limitation; may need react-native-skia for advanced blend modes
blendMode: 'OVERLAY'         → Same limitation
(Most screens use NORMAL or PASS_THROUGH which need no action)
```

## Clipping
```
clipsContent: true            → overflow: 'hidden'
clipsContent: false           → overflow: 'visible'
```

## Constraints (Non-Auto-Layout)
```
constraints.horizontal: 'LEFT'       → (default, no action)
constraints.horizontal: 'RIGHT'      → position from right edge
constraints.horizontal: 'CENTER'     → alignSelf: 'center' or centered positioning
constraints.horizontal: 'SCALE'      → percentage-based width
constraints.horizontal: 'LEFT_RIGHT' → stretch (position: 'absolute', left: X, right: Y)
constraints.vertical: analogous
```

## Prototyping (Interactions)
```
interactions → informational for navigation wiring
trigger.type: 'ON_CLICK' + action.navigation: 'NAVIGATE' → router.push(destinationScreen)
trigger.type: 'ON_CLICK' + action.navigation: 'CHANGE_TO' → state change
trigger.type: 'ON_CLICK' + action.type: 'URL'            → Linking.openURL(action.url)
transition.type: 'SMART_ANIMATE'                          → LayoutAnimation or Reanimated
```

## Vector Paths (SVG)
```
vectorPaths[].path → use react-native-svg <Path d={vectorPaths[0].path} />
strokePaths[].path → use react-native-svg <Path d={strokePaths[0].path} /> with stroke
arcData → use react-native-svg <Circle> or <Path> with arc commands
```

## Masks
```
isMask: true → this node is a mask layer
  → In RN: use MaskedView from @react-native-masked-view/masked-view
  → The mask node defines the shape, sibling nodes are the content
maskType: 'ALPHA'    → mask uses alpha channel (default MaskedView behavior)
maskType: 'VECTOR'   → mask uses fill regions (binary mask)
maskType: 'LUMINANCE' → mask uses luminance (advanced, needs custom implementation)
```

## Aspect Ratio
```
preserveRatio: true → aspectRatio: width/height (calculate from geometry)
targetAspectRatio   → use as the aspectRatio value directly
```

## Grid Layout (CSS Grid → RN)
```
gridLayout → React Native does NOT support CSS Grid natively
  → Use nested flexbox to approximate:
  gridLayout.columnCount: 2 → flexDirection: 'row', flexWrap: 'wrap', children width: '50%'
  gridLayout.rowGap / columnGap → gap (RN 0.71+)
gridChildAlign.horizontal → alignSelf equivalent per child
gridSpan.columns: 2 → child width spans 2 columns (width: '100%' or flex: 2)
```

## Metadata Properties (not visual — used by pipeline)
```
id, parentId, depth, childIds → hierarchy reconstruction (not directly in RN code)
rnComponent, rnProps          → auto-mapped shared component name and props
componentId, componentProperties → Figma component identity (for debugging/tracing)
locked, isFixed               → Figma editor state (informational)
devStatus                     → pipeline gating (READY_FOR_DEV)
exportSettings                → Figma export presets (informational)
layoutGrids                   → design grid overlay (informational for spacing verification)
overriddenFields, overrides   → instance override tracking (informational)
isExposedInstance, exposedInstances → component exposure (informational)
fillOverrideTable             → vector fill overrides (advanced SVG)
variableWidthPoints           → variable stroke width profile (advanced SVG)
```

## Known Pitfalls (from learnings)
- Screen component adds its own padding — don't stack
- Figma lineHeightPx → RN lineHeight (direct, no calculation)
- fill.opacity separate from node.opacity — use color alpha for fill opacity
- Nested Text needs `inherit` prop
- FILL sizing → flex: 1, not width: '100%'
- `absoluteRenderBounds: null` means node is fully clipped — do not render it
- `cornerSmoothing` is iOS-only — Android ignores `borderCurve`
- `overflowDirection` is NOT `scrollBehavior` — overflow = scroll direction, scrollBehavior = fixed/sticky positioning
