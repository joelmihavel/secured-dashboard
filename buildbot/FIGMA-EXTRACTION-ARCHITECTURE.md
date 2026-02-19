# BuildBot Figma Extraction Architecture

> **Audience**: Designers, Engineers, QA
> **Last Updated**: 2026-02-19
> **Owner**: BuildBot / Secured v2 Engineering

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Stages](#pipeline-stages)
3. [What We Extract from Figma](#what-we-extract-from-figma)
4. [Figma Element Coverage Matrix](#figma-element-coverage-matrix)
5. [Design Token Extraction](#design-token-extraction)
6. [Blueprint JSON Schema](#blueprint-json-schema)
7. [Asset Handling](#asset-handling)
8. [What We Skip (and Why)](#what-we-skip-and-why)
9. [Verification & Audit Pipeline](#verification--audit-pipeline)
10. [Known Limitations](#known-limitations)
11. [Appendix: Agent Roles](#appendix-agent-roles)

---

## Overview

BuildBot is a deterministic, zero-AI extraction system that reads the Figma REST API and produces a **Screen Blueprint JSON** for every screen in the design file. The blueprint captures every visual property needed to reconstruct the screen in React Native with pixel-perfect fidelity.

**Key principle**: The Figma REST API is the **single source of truth**. No AI guessing, no visual analysis, no manual approximation. Every value in the blueprint is a direct read from the Figma node tree.

### Architecture at a Glance

```
Figma File (HZaVuwWn6B6jOjrmxZ7Kzv)
       |
       | Figma REST API (depth=999, unlimited traversal)
       v
+---------------------------+
| extract-screen-blueprint  |  Script: scripts/extract-screen-blueprint.ts
| (Core Extractor)          |  Zero AI dependency
+---------------------------+
       |
       | Produces:
       v
+------------------+    +---------------------+    +-----------------+
| Blueprint JSON   |    | Baseline PNG        |    | Asset PNGs      |
| (per screen)     |    | (3x Figma export)   |    | (per image node)|
+------------------+    +---------------------+    +-----------------+
       |
       | Consumed by:
       v
+-----------+  +-----------+  +-----------+  +----------+
| Builder   |  | Verifier  |  | Inspector |  | Auditor  |
| Agent     |  | Agent     |  | Agent     |  | Agent    |
+-----------+  +-----------+  +-----------+  +----------+
       |              |              |             |
       v              v              v             v
  RN Code      Screenshots     Gemini Audits  Coverage Reports
```

---

## Pipeline Stages

### Stage 1: Design Token Export (`export-figma-tokens.ts`)

Extracts Figma Variables (via Figma MCP `get_variable_defs`) and produces `config/design-tokens.json`.

| Token Category | Figma Source | Example |
|---|---|---|
| Colors | `Colours/Brand/500` | `#FF9A6D` -> `colors.brand[500]` |
| Typography | `H4/Regular 400` with `Font()` definitions | fontSize, lineHeight, fontWeight, fontFamily |
| Spacing | `Spacing/sp-8` | `8` -> `spacing.xs` |
| Radius | `Radius/rd-12` | `12` -> `radius.md` |
| Shadows | `Shadow/*` | Raw Figma shadow values |

Also generates **reverse-lookup maps** for downstream mapping:
- `_colorByHex`: `"#FF9A6D"` -> `"colors.brand[500]"`
- `_typographyByStyle`: `"14:20:600"` -> `"typography.label"`
- `_spacingByValue`: `"24"` -> `"spacing.lg"`
- `_radiusByValue`: `"12"` -> `"radius.md"`

### Stage 2: Screen Blueprint Extraction (`extract-screen-blueprint.ts`)

The core extractor. For a given Figma node ID (e.g., `1-29108`):

1. **Fetches the full node tree** via `GET /v1/files/{key}/nodes?ids={nodeId}&depth=999` — also captures top-level `components`, `componentSets`, and `styles` metadata from the response
2. **Fetches a baseline PNG** via `GET /v1/images/{key}?ids={nodeId}&scale=3&format=png`
3. **Traverses every node recursively** extracting 80+ properties per node
4. **Detects background** (solid color, gradient, dotted pattern)
5. **Maps values to design tokens** (post-processing lookup)
6. **Downloads image assets** (nodes with IMAGE fills)
7. **Auto-maps components** to React Native equivalents (Text, PhoneInput, OTPInput, PrimaryButton, etc.)

**Output**: `data/blueprints/{screenId}-blueprint.json` + `data/baselines/{screenId}-baseline.png`

### Stage 3: Route Resolution (`config/screen-routes.json`)

Maps each Figma node ID to its app route, screen name, and state variant:

```
Figma ID  1-29108  ->  Route: /(auth)/sign-up
                       Name:  auth / sign up --enter phone number
                       State: empty
```

Covers 60+ screen variants across 20 route groups (splash, sign-up, OTP, waitlist, agreement, setup, home, payment, profile, transactions).

### Stage 4: Verification Pipeline

After code is generated from the blueprint, the system verifies fidelity through:

1. **ODiff pixel comparison** (app screenshot vs Figma baseline)
2. **Maestro view hierarchy** cross-reference (rendered bounds vs Figma geometry)
3. **Gemini 3 Pro pixel feedback** (4-batch: structural → component → screen → synthesis)
4. **Gemini 3 Flash visual inspection** (5-pass forensic audit)
5. **Coverage checks** (typography, colors, spacing completeness)
6. **AI assertions** (assertWithAI for functional validation)

---

## What We Extract from Figma

### Per-Node Properties (80+ properties)

Every visible node in the Figma tree has these properties extracted:

#### Identity & Structure
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Node ID | `id` | `id` | Unique identifier (e.g., `1:29108`) |
| Parent ID | _(tree position)_ | `parentId` | For hierarchy reconstruction |
| Name | `name` | `name` | Designer-assigned layer name |
| Type | `type` | `type` | FRAME, TEXT, RECTANGLE, VECTOR, INSTANCE, COMPONENT, GROUP, etc. |
| Depth | _(computed)_ | `depth` | Nesting level from root (0 = screen) |
| Visibility | `visible` | `visible` | Only visible nodes are extracted |
| Child IDs | `children[].id` | `childIds` | Ordered list of child node IDs |

#### Geometry & Transform
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Position X | `absoluteBoundingBox.x` | `geometry.x` | Relative to parent, not canvas |
| Position Y | `absoluteBoundingBox.y` | `geometry.y` | Relative to parent, not canvas |
| Width | `absoluteBoundingBox.width` | `geometry.width` | Exact pixel value |
| Height | `absoluteBoundingBox.height` | `geometry.height` | Exact pixel value |
| Rotation | `rotation` | `geometry.rotation` | Radians |
| Opacity | `opacity` | `opacity` | 0-1 range |
| Absolute bounding box | `absoluteBoundingBox` | `absoluteBoundingBox` | Pre-clip axis-aligned bounding box (full {x,y,width,height}) |
| Absolute render bounds | `absoluteRenderBounds` | `absoluteRenderBounds` | Actual visible area after clips/rotations. **`null`** = fully clipped/invisible |

#### Fills (Background/Foreground)
| Fill Type | Properties Captured | Notes |
|---|---|---|
| **SOLID** | `color` (hex), `opacity`, `blendMode` | Most common fill type |
| **IMAGE** | `imageRef`, `scaleMode`, `opacity`, `blendMode`, `imageTransform` (2x3 affine matrix), `imageFilters` (exposure, contrast, saturation, temperature, tint, highlights, shadows) | Triggers asset download |
| **GRADIENT_LINEAR** | `gradientStops[]` (color with alpha, position, opacity), `gradientHandlePositions[]`, `blendMode` | Full gradient definition |
| **GRADIENT_RADIAL** | Same as linear | Handle positions define radial shape |
| **GRADIENT_ANGULAR** | Same as linear | Angular sweep gradients |
| **GRADIENT_DIAMOND** | Same as linear | Diamond gradients |

Each fill captures: `type`, `color`, `opacity`, `visible`, `blendMode`, `imageRef`, `scaleMode`, `imageTransform`, `imageFilters`, `gradientStops`, `gradientHandlePositions`, `boundVariables` (Figma Variable bindings for authoritative token references)

#### Strokes (Borders)
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Color | `strokes[].color` | `strokes[].color` (hex) |
| Weight | `strokeWeight` | `strokes[].weight` |
| Alignment | `strokeAlign` | `strokes[].align` (INSIDE/OUTSIDE/CENTER) |
| Cap | `strokeCap` | `strokes[].cap` |
| Join | `strokeJoin` | `strokes[].join` |
| Dash Pattern | `strokeDashes` | `strokes[].dashPattern` |
| Individual Weights | `individualStrokeWeights` | `individualStrokeWeights` (top/right/bottom/left) |

#### Effects (Shadows, Blurs)
| Effect Type | Properties Captured |
|---|---|
| **DROP_SHADOW** | `color` (hex+alpha), `offset` (x, y), `blur`, `spread` → RN `boxShadow` or legacy `shadowColor/shadowOffset/shadowOpacity/shadowRadius` |
| **INNER_SHADOW** | `color` (hex+alpha), `offset` (x, y), `blur`, `spread` → RN `boxShadow` with `inset` keyword (requires RN 0.76+ New Architecture) |
| **LAYER_BLUR** | `blur` radius |
| **BACKGROUND_BLUR** | `blur` radius |

> **Inner Shadow note:** React Native 0.76+ supports `boxShadow` with `inset` via the New Architecture. Multiple shadows (drop + inner) are expressed as an array: `boxShadow: ['0 4 8 0 #00000033', 'inset 0 -3 4 1 #FFFFFF1F']`.

#### Border Radius & Corner Smoothing
| Property | Figma API Field | Blueprint Field | RN Equivalent |
|---|---|---|---|
| Uniform radius | `cornerRadius` | `borderRadius` (number) | `borderRadius` |
| Per-corner radii | `rectangleCornerRadii` [tl, tr, br, bl] | `borderRadius` (object with `tl`, `tr`, `br`, `bl`) | `borderTopLeftRadius`, etc. |
| Corner smoothing | `cornerSmoothing` | `cornerSmoothing` (0.0–1.0) | `borderCurve: 'continuous'` (iOS, ~0.6 = native iOS corners) |

#### Auto Layout — Parent Properties (on the container FRAME)
| Property | Figma API Field | Blueprint Field | RN Equivalent |
|---|---|---|---|
| Direction | `layoutMode` | `layout.direction` | HORIZONTAL -> `row`, VERTICAL -> `column` |
| Main axis align | `primaryAxisAlignItems` | `layout.justifyContent` | MIN/CENTER/MAX/SPACE_BETWEEN |
| Cross axis align | `counterAxisAlignItems` | `layout.alignItems` | MIN/CENTER/MAX |
| Gap | `itemSpacing` | `layout.gap` | `gap` in RN |
| Padding | `paddingTop/Right/Bottom/Left` | `layout.padding` (4-sided) | Individual padding values |
| Wrap | `layoutWrap` | `layout.wrap` | NO_WRAP/WRAP |
| Horizontal sizing | `layoutSizingHorizontal` | `layout.sizingH` | FIXED/FILL/HUG |
| Vertical sizing | `layoutSizingVertical` | `layout.sizingV` | FIXED/FILL/HUG |
| Wrapped cross-axis align | `counterAxisAlignContent` | `layout.counterAxisAlignContent` | `alignContent` (only when wrap=WRAP) |
| Wrapped cross-axis gap | `counterAxisSpacing` | `layout.counterAxisSpacing` | `columnGap` (only when wrap=WRAP) |
| Reverse Z-index | `itemReverseZIndex` | `layout.itemReverseZIndex` | First child renders on top |

#### Auto Layout — Per-Child Properties (on each child node)
| Property | Figma API Field | Blueprint Field | RN Equivalent |
|---|---|---|---|
| Positioning mode | `layoutPositioning` | `layoutPositioning` | `AUTO` = in flow, `ABSOLUTE` = `position: 'absolute'` |
| Cross-axis self-align | `layoutAlign` | `layoutAlign` | `STRETCH` -> `alignSelf: 'stretch'`, etc. |
| Grow factor | `layoutGrow` | `layoutGrow` | `flex: {value}` (how much child grows in parent) |
| Horizontal sizing mode | `layoutSizingHorizontal` | `layoutSizingHorizontal` | `FILL` → `flex: 1` or `alignSelf: 'stretch'`, `HUG` → auto, `FIXED` → explicit width |
| Vertical sizing mode | `layoutSizingVertical` | `layoutSizingVertical` | `FILL` → `flex: 1` or `alignSelf: 'stretch'`, `HUG` → auto, `FIXED` → explicit height |

#### Size Constraints (per-node)
| Property | Figma API Field | Blueprint Field | RN Equivalent |
|---|---|---|---|
| Min width | `minWidth` | `minWidth` | `minWidth` |
| Max width | `maxWidth` | `maxWidth` | `maxWidth` (critical for text wrapping) |
| Min height | `minHeight` | `minHeight` | `minHeight` |
| Max height | `maxHeight` | `maxHeight` | `maxHeight` |

#### Typography (TEXT Nodes Only)
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Content | `characters` | `typography.content` |
| Font size | `style.fontSize` | `typography.fontSize` |
| Line height (px) | `style.lineHeightPx` | `typography.lineHeight` |
| Line height unit | `style.lineHeightUnit` | `typography.lineHeightUnit` (PIXELS / FONT_SIZE_% / INTRINSIC) |
| Line height % | `style.lineHeightPercentFontSize` | `typography.lineHeightPercent` |
| Font weight | `style.fontWeight` | `typography.fontWeight` |
| Font family | _(resolved from weight)_ | `typography.fontFamily` |
| Font style | `style.italic` / PostScript name | `typography.fontStyle` (normal/italic) |
| Font PostScript name | `style.fontPostScriptName` | `typography.fontPostScriptName` (raw name for debugging) |
| Letter spacing | `style.letterSpacing` | `typography.letterSpacing` |
| Horizontal align | `style.textAlignHorizontal` | `typography.textAlign` |
| Vertical align | `style.textAlignVertical` | `typography.textAlignVertical` |
| Text decoration | `style.textDecoration` | `typography.textDecoration` |
| Text transform | `style.textCase` | `typography.textTransform` |
| Paragraph spacing | `style.paragraphSpacing` | `typography.paragraphSpacing` |
| Paragraph indent | `style.paragraphIndent` | `typography.paragraphIndent` (first-line indent in px) |
| Auto resize | `style.textAutoResize` | `typography.textAutoResize` |
| Text truncation | `textTruncation` | `typography.textTruncation` (ENDING → RN `ellipsizeMode: 'tail'`) |
| Max lines | `maxLines` | `typography.maxLines` (→ RN `numberOfLines`) |
| Text color | `fills[0].color` (first solid fill) | `typography.color` |
| OpenType flags | `style.opentypeFlags` | `typography.openTypeFlags` (ligatures, stylistic sets) |
| Hyperlink | `style.hyperlink` | `typography.hyperlink` ({ type, url?, nodeID? }) |
| **Rich text spans** | `characterStyleOverrides` + `styleOverrideTable` | `typography.spans[]` |

**Rich Text Spans** capture per-character style overrides:
- `start` / `end` character indices
- `color` override
- `fontWeight` override
- `fontFamily` override
- `fontStyle` override (italic)
- `fontSize` override
- `letterSpacing` override
- `lineHeight` override
- `textDecoration` override
- `textCase` override
- `hyperlink` (per-span URL or node link)
- `opentypeFlags` (per-span OpenType features)

#### Vector Paths (VECTOR/BOOLEAN_OPERATION Nodes)
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Fill SVG path data | `fillGeometry[].path` | `vectorPaths[].path` |
| Fill winding rule | `fillGeometry[].windingRule` | `vectorPaths[].windingRule` |
| Stroke SVG path data | `strokeGeometry[].path` | `strokePaths[].path` |
| Stroke winding rule | `strokeGeometry[].windingRule` | `strokePaths[].windingRule` |

#### Ellipse Arc Geometry (ELLIPSE Nodes)
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Starting angle | `arcData.startingAngle` | `arcData.startingAngle` (radians) |
| Ending angle | `arcData.endingAngle` | `arcData.endingAngle` (radians) |
| Inner radius | `arcData.innerRadius` | `arcData.innerRadius` (0-1, for donuts/rings) |

Note: Only captured when the ellipse is not a full circle (i.e., it's an arc, pie, or donut shape).

#### Component / Instance Properties
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Component ID | `componentId` | `componentId` | Which component this instance is based on |
| Component properties | `componentProperties` | `componentProperties` | Instance-level property overrides (variant selections, boolean toggles, text overrides, instance swaps) |
| Component property references | `componentPropertyReferences` | `componentPropertyReferences` | Wires sublayer attributes (`visible`, `characters`) to parent component properties — critical for resolving variant behavior |

#### Responsive Constraints
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Horizontal constraint | `constraints.horizontal` | `constraints.horizontal` (LEFT/RIGHT/CENTER/SCALE/LEFT_RIGHT) |
| Vertical constraint | `constraints.vertical` | `constraints.vertical` (TOP/BOTTOM/CENTER/SCALE/TOP_BOTTOM) |

#### Blend Mode
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Blend mode | `blendMode` | `blendMode` | Only captured if non-default (not NORMAL or PASS_THROUGH) |

#### Clipping & Overflow
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Clips content | `clipsContent` | `clipsContent` | Whether frame clips children to its bounds |
| Overflow direction | `overflowDirection` | `overflowDirection` | `HORIZONTAL_SCROLLING` / `VERTICAL_SCROLLING` / `HORIZONTAL_AND_VERTICAL_SCROLLING` / `NONE` — determines ScrollView behavior |

#### Stroke Advanced Properties
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Strokes in layout | `strokesIncludedInLayout` | `strokesIncludedInLayout` | When true, strokes affect layout sizing (`box-sizing: border-box`) |
| Miter angle | `strokeMiterAngle` | `strokeMiterAngle` | Corner angle for MITER joins (default 28.96°, only stored when non-default) |
| Variable width points | `variableWidthPoints` | `variableWidthPoints` | Width profile for variable-width strokes |
| Fill override table | `fillOverrideTable` | `fillOverrideTable` | Per-region fill overrides on VECTOR nodes |

#### CSS Grid Layout (when `layoutMode: "GRID"`)
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Row count | `gridRowCount` | `gridLayout.rowCount` | Number of grid rows |
| Column count | `gridColumnCount` | `gridLayout.columnCount` | Number of grid columns |
| Row gap | `gridRowGap` | `gridLayout.rowGap` | Distance between rows |
| Column gap | `gridColumnGap` | `gridLayout.columnGap` | Distance between columns |
| Columns sizing | `gridColumnsSizing` | `gridLayout.columnsSizing` | CSS `grid-template-columns` string |
| Rows sizing | `gridRowsSizing` | `gridLayout.rowsSizing` | CSS `grid-template-rows` string |
| Child H align | `gridChildHorizontalAlign` | `gridChildAlign.horizontal` | Per-child: AUTO / MIN / CENTER / MAX |
| Child V align | `gridChildVerticalAlign` | `gridChildAlign.vertical` | Per-child: AUTO / MIN / CENTER / MAX |
| Row span | `gridRowSpan` | `gridSpan.rows` | How many grid rows this child spans |
| Column span | `gridColumnSpan` | `gridSpan.columns` | How many grid columns this child spans |
| Row anchor | `gridRowAnchorIndex` | `gridAnchor.row` | Which row this child is anchored to |
| Column anchor | `gridColumnAnchorIndex` | `gridAnchor.column` | Which column this child is anchored to |

#### Instance-Specific Properties
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Exposed instance | `isExposedInstance` | `isExposedInstance` | Whether instance is exposed as a component property |
| Exposed instances list | `exposedInstances` | `exposedInstances` | IDs of exposed instances at this level |
| Instance overrides | `overrides` | `overrides` | Fields directly overridden on this instance (not inherited) |
| Overridden fields | `overriddenFields` | `overriddenFields` | List of field names that differ from main component |

#### Component Definition Properties (COMPONENT / COMPONENT_SET nodes)
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Property definitions | `componentPropertyDefinitions` | `componentPropertyDefinitions` | Defines what properties a component exposes (VARIANT, BOOLEAN, TEXT, INSTANCE_SWAP types with default values) |

#### Prototyping / Interactions / Transitions (per-node)

> **IMPORTANT**: The Figma REST API uses `interactions` (not `reactions`) with an `actions[]` **array** (not singular `action`). Each interaction has one trigger and potentially multiple actions.

| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Trigger type | `interactions[].trigger.type` | `interactions[].trigger.type` (ON_CLICK, ON_HOVER, ON_PRESS, ON_DRAG, MOUSE_ENTER, MOUSE_LEAVE, AFTER_TIMEOUT, etc.) |
| Trigger delay | `interactions[].trigger.delay` | `interactions[].trigger.delay` (ms) |
| Trigger timeout | `interactions[].trigger.timeout` | `interactions[].trigger.timeout` (ms, for AFTER_TIMEOUT triggers) |
| Action type | `interactions[].actions[].type` | `interactions[].actions[].type` (NODE, BACK, CLOSE, URL, SCROLL_TO, SWAP, etc.) |
| Destination node | `interactions[].actions[].destinationId` | `interactions[].actions[].destinationId` |
| Navigation type | `interactions[].actions[].navigation` | `interactions[].actions[].navigation` (NAVIGATE, SWAP, OVERLAY, SCROLL_TO, CHANGE_TO) |
| Transition type | `interactions[].actions[].transition.type` | `interactions[].actions[].transition.type` (DISSOLVE, **SMART_ANIMATE**, MOVE_IN, MOVE_OUT, PUSH, SLIDE_IN, SLIDE_OUT) |
| Transition duration | `interactions[].actions[].transition.duration` | `interactions[].actions[].transition.duration` (seconds) |
| Easing type | `interactions[].actions[].transition.easing.type` | `.easing.type` (EASE_IN, EASE_OUT, EASE_IN_AND_OUT, LINEAR, CUSTOM_CUBIC_BEZIER) |
| Custom bezier | `interactions[].actions[].transition.easing.easingFunctionCubicBezier` | `.easingFunctionCubicBezier` ({x1, y1, x2, y2}) |
| Preserve scroll | `interactions[].actions[].preserveScrollPosition` | `interactions[].actions[].preserveScrollPosition` |
| Overlay position | `interactions[].actions[].overlayRelativePosition` | `interactions[].actions[].overlayRelativePosition` ({x, y}) |

**Legacy prototyping properties** (node-level, fallback):
| Property | Figma API Field | Blueprint Field |
|---|---|---|
| Transition target | `transitionNodeID` | `transitionNodeID` |
| Transition duration | `transitionDuration` | `transitionDuration` (seconds) |
| Transition easing | `transitionEasing` | `transitionEasing` (easing object) |

Additionally, the blueprint includes a top-level `prototyping` summary:
```json
{
  "prototyping": {
    "hasInteractions": true,
    "flowCount": 3,
    "flows": [
      {
        "sourceNodeId": "1:29115",
        "sourceNodeName": "Continue Button",
        "trigger": "ON_CLICK",
        "destinationNodeId": "1:30090",
        "transitionType": "SMART_ANIMATE",
        "transitionDuration": 0.3
      }
    ]
  }
}
```

#### Scroll Behavior
| Property | Figma API Field | Blueprint Field | RN Equivalent |
|---|---|---|---|
| Scroll behavior | `scrollBehavior` | `scrollBehavior` | `SCROLLS` (default, omitted), `FIXED` → fixed positioning, `STICKY` → sticky headers, `FIXED_WHEN_CHILD_OF_SCROLLING_FRAME` |

#### Mask Properties
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Is mask | `isMask` | `isMask` | Whether this node is a mask layer |
| Mask outline | `isMaskOutline` | `isMaskOutline` | Whether mask uses outline mode |
| Mask type | `maskType` | `maskType` | Mask blend type |

#### Aspect Ratio
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Preserve ratio | `preserveRatio` | `preserveRatio` | Aspect ratio lock; informs `resizeMode` |
| Target aspect ratio | `targetAspectRatio` | `targetAspectRatio` | Original intended proportions |

#### Figma Variable Bindings (Design Tokens)
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Bound variables (node) | `boundVariables` | `boundVariables` | Authoritative Figma Variable bindings — links fills, strokes, effects to design token IDs |
| Bound variables (fill) | `fills[].boundVariables` | `fills[].boundVariables` | Per-fill variable binding (e.g., color bound to a variable) |

> **Note:** `boundVariables` provides the **authoritative** token reference (e.g., `VariableID:...`). This is far more reliable than the hex-based reverse lookup used in `tokensUsed`. Both are captured to provide maximum flexibility.

#### Style References (Named Figma Styles)
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Style references | `styles` | `styleReferences` | Maps style categories (`text`, `fill`, `stroke`, `effect`, `grid`) to shared style IDs |

Combined with the top-level `styleMeta`, this resolves to named styles like `"H1/Regular 400"` or `"Brand/Primary"`.

#### Node State
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Locked | `locked` | `locked` | Whether node is locked in Figma |
| Fixed position | `isFixed` | `isFixed` | Whether node is fixed in scroll |

#### Export Settings
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Export presets | `exportSettings` | `exportSettings` | Format (PNG/SVG/PDF), scale, suffix — informational (extractor has its own export logic) |

#### Dev Status
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Dev status | `devStatus` | `devStatus` | `{ type: "READY_FOR_DEV", description: "..." }` — can gate pipeline processing |

#### Layout Grids
| Property | Figma API Field | Blueprint Field | Notes |
|---|---|---|---|
| Layout grids | `layoutGrids` | `layoutGrids` | Design overlay grids (rows, columns, grid) — informational for spacing verification |
```

---

## Figma Element Coverage Matrix

### Node Types We Extract

| Figma Node Type | Extracted? | Notes |
|---|---|---|
| FRAME | Yes | Full layout + fills + strokes + effects |
| GROUP | Yes | Layout properties extracted |
| TEXT | Yes | Full typography + rich text spans |
| RECTANGLE | Yes | Fills, strokes, radius |
| ELLIPSE | Yes | Full ellipse + arc geometry (`arcData` for arcs, donuts, pies) |
| VECTOR | Yes | SVG path data via `fillGeometry` |
| BOOLEAN_OPERATION | Yes | SVG path data via `fillGeometry` |
| COMPONENT | Yes | Same as FRAME + componentId |
| INSTANCE | Yes | Same as FRAME + componentId + componentProperties + componentPropertyReferences + overrides + isExposedInstance |
| COMPONENT_SET | Yes | Same as FRAME + componentPropertyDefinitions |
| LINE | Yes | Via strokes/geometry |
| STAR | Yes | Via fillGeometry paths |
| POLYGON | Yes | Via fillGeometry paths |
| SLICE | No | Not a visual element |
| SECTION | No | Container only, not visual |

### Fill Types We Extract

| Fill Type | Extracted? | Properties Captured |
|---|---|---|
| SOLID | Yes | Color (hex), opacity, blendMode, boundVariables |
| IMAGE | Yes | imageRef, scaleMode, opacity, blendMode, imageTransform, imageFilters, boundVariables; triggers PNG download |
| GRADIENT_LINEAR | Yes | Stops (color with alpha, position, opacity, boundVariables), handle positions, blendMode |
| GRADIENT_RADIAL | Yes | Same as linear |
| GRADIENT_ANGULAR | Yes | Same as linear |
| GRADIENT_DIAMOND | Yes | Same as linear |

### Effect Types We Extract

| Effect Type | Extracted? | Properties Captured |
|---|---|---|
| DROP_SHADOW | Yes | Color (hex+alpha), offset (x,y), blur, spread |
| INNER_SHADOW | Yes | Same as drop shadow |
| LAYER_BLUR | Yes | Blur radius |
| BACKGROUND_BLUR | Yes | Blur radius |

### What About Figma Features Not Listed?

| Figma Feature | Status | Details |
|---|---|---|
| **Prototyping / Interactions** | Yes | Full `interactions[]` per node: triggers, actions[] array, destinations, transitions. Also legacy `transitionNodeID`/`transitionDuration`/`transitionEasing` |
| **Smart animate / Transitions** | Yes | Extracted as `transition.type: SMART_ANIMATE` with duration + easing in interactions |
| **Variables (design tokens)** | Yes (dual) | `boundVariables` per node + per fill (authoritative Figma Variable bindings) AND `tokensUsed` (hex-based reverse lookup) |
| **Styles (shared styles)** | Yes | `styleReferences` per node (e.g., `{ text: "1:43" }`) + top-level `styleMeta` resolving to named styles (e.g., `"H1/Regular 400"`) |
| **Component metadata** | Yes | Top-level `componentMeta` (key, name, description, componentSetId, documentationLinks) + `componentSetMeta` |
| **Component property wiring** | Yes | `componentPropertyReferences` links sublayer attributes to parent component properties |
| **Corner smoothing** | Yes | iOS superellipse (`cornerSmoothing: 0.6` → `borderCurve: 'continuous'`) |
| **Masks** | Yes | `isMask`, `isMaskOutline`, `maskType` + clip content via `clipsContent` |
| **Scroll behavior** | Yes | `scrollBehavior` (SCROLLS/FIXED/STICKY/FIXED_WHEN_CHILD_OF_SCROLLING_FRAME) |
| **Boolean operations** | Yes | Path data extracted via `fillGeometry` |
| **Blend modes** | Yes | Per-node and per-fill blend modes |
| **Constraints** | Yes | Horizontal and vertical constraints |
| **Auto-layout** | Yes | Full parent + per-child properties including positioning, alignment, sizing modes, size constraints |
| **Stroke geometry** | Yes | `strokeGeometry` path data for complex stroked shapes |
| **Ellipse arcs** | Yes | `arcData` with starting/ending angles + inner radius |
| **Absolute render bounds** | Yes | Actual visible area after clips/rotations (null = invisible) |
| **Aspect ratio** | Yes | `preserveRatio`, `targetAspectRatio` |
| **Dev status** | Yes | `devStatus` (READY_FOR_DEV) — can gate pipeline processing |
| **Export settings** | Yes | Figma-configured export presets (format, scale, suffix) |
| **Layout grids** | Yes | Design overlay grids for spacing verification |
| **Lock state** | Yes | `locked`, `isFixed` |
| **Overflow direction** | Yes | `overflowDirection` (HORIZONTAL_SCROLLING, VERTICAL_SCROLLING, etc.) — determines ScrollView behavior |
| **Strokes in layout** | Yes | `strokesIncludedInLayout` — whether strokes affect layout sizing (box-sizing: border-box) |
| **Stroke miter angle** | Yes | Custom miter angle for sharp corners |
| **CSS Grid layout** | Yes | Full GRID mode properties: row/column count, gaps, sizing templates, per-child alignment/span/anchor |
| **Instance overrides** | Yes | `overrides`, `overriddenFields` — which fields differ from main component |
| **Instance exposure** | Yes | `isExposedInstance`, `exposedInstances` — component property exposure |
| **Component definitions** | Yes | `componentPropertyDefinitions` — VARIANT/BOOLEAN/TEXT/INSTANCE_SWAP property definitions with defaults |
| **Fill override table** | Yes | Per-region fill overrides on VECTOR nodes |
| **Variable width strokes** | Yes | `variableWidthPoints` — width profile for variable-width strokes |
| **Text lists** | Yes | `lineTypes` (ORDERED/UNORDERED/NONE), `lineIndentations` — list bullets and indentation |
| **Text range fills** | Yes | `textRangeFills` — per-character-range fills (gradient text, multi-color) |
| **Version history** | Not extracted | Not part of the node tree |
| **Dev mode annotations** | Not extracted | Not returned by default API; covered by our own extraction |
| **Plugin data** | Not extracted | Plugin-specific metadata is opaque and not relevant |

---

## Design Token Extraction

Tokens are extracted from Figma Variables (not from styles) using the `export-figma-tokens.ts` script.

### Token Categories

| Category | Count | Example Token | Example Value |
|---|---|---|---|
| **Colors** | 29 hex values | `colors.brand[500]` | `#FF9A6D` |
| **Typography** | 16 styles | `typography.label` | 14px / 20px line-height / 600 weight |
| **Spacing** | 11 values | `spacing.lg` | 24px |
| **Radius** | 8 values | `radius.md` | 12px |

### Reverse Lookup

After extraction, every value in the blueprint is cross-referenced against the token maps:

```
Node fill color #FF9A6D  -->  tokensUsed.colors["#FF9A6D"] = "colors.brand[500]"
Node fontSize 14, lineHeight 20, fontWeight 600  -->  tokensUsed.typography["14:20:600"] = "typography.label"
Layout gap 24  -->  tokensUsed.spacing["24"] = "spacing.lg"
Border radius 12  -->  tokensUsed.radius["12"] = "radius.md"
```

This enables code generation to use semantic token names instead of raw values.

---

## Blueprint JSON Schema

Each screen produces a blueprint with this structure:

```json
{
  "meta": {
    "screenId": "1-29108",
    "screenName": "auth / sign up --enter phone number",
    "route": "/(auth)/sign-up",
    "stateName": "empty",
    "dimensions": { "width": 393, "height": 852 },
    "generatedAt": "2026-02-15T13:26:32.797Z",
    "figmaFileKey": "HZaVuwWn6B6jOjrmxZ7Kzv"
  },
  "background": {
    "color": "#131313",
    "hasDottedPattern": false,
    "backgroundShapeKey": "default",
    "gradient": null
  },
  "nodes": [
    {
      "id": "1:29108",
      "parentId": null,
      "name": "auth / sign up --enter phone number",
      "type": "FRAME",
      "depth": 0,
      "visible": true,
      "geometry": { "x": 0, "y": 0, "width": 393, "height": 852, "rotation": 0 },
      "opacity": 1,
      "fills": [{ "type": "SOLID", "visible": true, "color": "#131313", "opacity": 1 }],
      "strokes": [],
      "effects": [],
      "borderRadius": 0,
      "clipsContent": true,
      "layout": {
        "direction": "column",
        "justifyContent": "flex-start",
        "alignItems": "flex-start",
        "gap": 0,
        "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
        "wrap": "NO_WRAP",
        "grow": 0,
        "sizingH": "FIXED",
        "sizingV": "FIXED"
      },
      "rnComponent": "Screen",
      "childIds": ["237:2735", "1:29109", "1:29110"]
    }
  ],
  "assets": [
    {
      "imageRef": "3fc15bf2e66131c93d54c9ad31461a4a869b576d",
      "nodeId": "237:2735",
      "nodeName": "image 149",
      "usage": "image",
      "downloadUrl": "https://...",
      "localPath": "../assets/1-29108_image-149.png"
    }
  ],
  "tokensUsed": {
    "colors": { "#131313": "colors.black[700]", "#FF9A6D": "colors.brand[500]" },
    "typography": { "14:20:600": "typography.label" },
    "spacing": { "24": "spacing.lg", "16": "spacing.md" },
    "radius": { "12": "radius.md" }
  },
  "prototyping": {
    "hasInteractions": true,
    "flowCount": 1,
    "flows": [{ "sourceNodeId": "1:29115", "trigger": "ON_CLICK", "destinationNodeId": "1:30090" }]
  },
  "componentMeta": {
    "1:25300": { "key": "abc123", "name": "Button/Primary", "componentSetId": "1:25273" }
  },
  "componentSetMeta": {
    "1:25273": { "key": "def456", "name": "Button" }
  },
  "styleMeta": {
    "1:43": { "key": "ghi789", "name": "H1/Regular 400", "styleType": "TEXT" }
  }
}
```

---

## Asset Handling

### What Gets Downloaded as a PNG Asset

| Trigger | Example | Download Method |
|---|---|---|
| Node has an IMAGE fill (`fill.type === "IMAGE"`) | Background images, photos, illustrations | Figma Images API at 3x scale |
| Node has visible gradient fills | Complex gradients that need rasterization | Figma Images API at 3x scale |

### Asset Classification

Assets are auto-classified by node name:

| Name Contains | Usage Tag | Example |
|---|---|---|
| `background`, `bg` | `background` | Full-screen background shapes |
| `pattern`, `dotted`, `texture` | `pattern` | DottedPattern overlays |
| `icon` | `icon` | UI icons |
| `image`, `photo` | `image` | Content images |
| `gradient` | `gradient` | Gradient overlays |
| `logo` | `logo` | Brand logos |
| _(other)_ | `decoration` | Default fallback |

### Baseline Screenshot

Every screen also gets a **baseline PNG** exported at 3x scale from the Figma Images API. This is used for pixel-diff comparison against the rendered app screenshot.

---

## What We Skip (and Why)

### Skipped Nodes

| Pattern | Reason |
|---|---|
| `visible: false` | Invisible in Figma; not rendered |
| `StatusBar` / `HW Cutout` / `SafeArea` / `Home Indicator` | System UI elements handled by the OS, not the app |
| Nodes with Y position > 4x screen height below root | Off-canvas elements that are clearly not part of the visible design |

### Not Extracted

| Figma Feature | Why Not |
|---|---|
| Comments & annotations | Collaboration metadata, not visual data |
| Version history | Snapshot-based extraction; version is timestamp |
| Plugin data / shared plugin data | Plugin-specific metadata is opaque |
| Text on path (`TEXT_PATH`) | Beta API (May 2025), not used in current designs |
| Vector network topology (`vectorNetwork`) | `fillGeometry` paths are sufficient for rendering |
| Complex stroke properties | All current design strokes are `BASIC` type |
| `TRANSFORM_GROUP` nodes | Beta API (May 2025), not used in current designs |
| `PATTERN` paint / `TEXTURE` / `NOISE` effects | Beta API (May 2025), not used in current designs |

---

## Verification & Audit Pipeline

After code is generated from a blueprint, BuildBot runs a multi-layer verification:

### Layer 1: Pixel Diff (ODiff)
- Compares app screenshot against Figma baseline
- Threshold: 3% for regular screens, 12% for DottedPattern screens

### Layer 2: View Hierarchy Text Analysis (`analyze-hierarchy.ts`)
- Cross-references Maestro view hierarchy (rendered bounds) against blueprint TEXT nodes
- Three-pass text matching: exact -> normalized -> substring
- Measures position and size deltas with thresholds (position: 4px, size: 3px)

### Layer 2.5: Maestro Structural Verification (`maestro-structural-verify.ts`) — NEW
Deterministic, zero-AI, code-level comparison of Blueprint ↔ Maestro view hierarchy. Runs 8 checks:
1. **Text Content Match** — blueprint `typography.content` vs rendered `accessibilityText` (3-pass matching)
2. **Bounds Comparison** — Figma geometry (scaled to viewport) vs Maestro rendered bounds (±4px position, ±3px size)
3. **Element Count Match** — visible node count parity between blueprint and hierarchy
4. **Interactivity Check** — nodes with `interactions[]` or button names must have `enabled=true` tappable elements
5. **Truncation Check** — `textTruncation: ENDING` + `maxLines` → verify `numberOfLines`/`ellipsizeMode` in rendered text
6. **Scroll Behavior Check** — `scrollBehavior: FIXED/STICKY` → verify fixed positioning; `overflowDirection` → verify scrollable
7. **testID Coverage** — major components (depth 1-2) with `rnComponent` should have testIDs in hierarchy
8. **Visibility Check** — `absoluteRenderBounds === null` (clipped) → should not render; visible nodes should appear

Output: `reports/maestro-structural/{screenId}-structural.json` with code fixes and testID gaps.

### Layer 2.7: Maestro Auto-Heal (`maestro-auto-heal.ts`) — NEW
Closed-loop auto-patch pipeline that reads structural verification report + blueprint and applies deterministic code fixes:

1. **Run structural verify** → get score and issues
2. **Generate patches** from issues + blueprint data (style updates, prop additions, testIDs, shadow fixes)
3. **Apply patches** to screen `.tsx` files via text-based search/replace
4. **Re-verify** → re-run structural verify to confirm fixes worked
5. **Loop** until target score reached or max iterations exhausted

Patch types: `fontSize`, `lineHeight`, `textAlign`, `color`, `padding`, `gap`, `borderRadius`, `borderCurve` (cornerSmoothing), `flex` (FILL sizing), `boxShadow` (inner shadows), `numberOfLines`/`ellipsizeMode` (truncation), `testID` gaps.

Triggered via `--auto-heal` flag on `verify-screen.ts`, or standalone:
```bash
npx tsx scripts/maestro-auto-heal.ts <screenId> --hierarchy <csv> --max-iterations 3 --target-score 85
```

Output: `reports/auto-heal/{screenId}-auto-heal.json`

### Layer 3: Gemini 3 Pro Pixel Feedback (`gemini-pixel-feedback.ts`, model: `gemini-3-pro-preview`)
4-batch analysis pipeline:
- **Batch 0**: Deterministic structural checks (NO AI) — text alignment, text structure, button fills, position deltas
- **Batch 1**: Component-level visual analysis — compares cropped Figma + simulator screenshots
- **Batch 2**: Full screen visual analysis — holistic layout, spacing rhythm, color consistency
- **Batch 3**: Synthesis — consolidates fixes, deduplicates, prioritizes by severity

Now includes checks for: cornerSmoothing, sizing modes (FILL/HUG), inner shadows (INNER_SHADOW → boxShadow inset), text truncation (numberOfLines/ellipsizeMode), scroll behavior (FIXED/STICKY), overflow direction, and boundVariables (design tokens).

### Layer 4: Gemini 3 Flash Inspector (`inspector-flash.ts`, model: `gemini-3-flash-preview`)
5-pass forensic audit:
1. Full screen overview comparison
2. Component-level crop inspection (13 properties per component)
3. Spacing ruler check
4. Icon & asset verification
5. State-specific checks

### Layer 5: Coverage Check
- Validates all blueprint values appear in generated code
- Targets: 100% typography, 100% colors, 100% spacing, 98% overall

### Layer 6: AI Assertions (Enhanced Pipeline)
- Per-screen assertWithAI prompts validate functional correctness
- Defect detection categories: overlapping text, truncated text, misaligned elements, color contrast

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Font weight only maps to 4 variants** (400/500/600/700) | Weights outside this range get mapped to nearest | Only PlusJakartaSans is used in the app; `fontPostScriptName` captured for debugging |
| **Text on path** not supported | Text following a curved path (`TEXT_PATH` node type, beta May 2025) is not extracted | Not used in current designs; Figma API recently added in beta |
| **Smart Selection / Tidy Up** metadata | Figma layout hints not in API | Auto-layout captures the layout intent |
| **`complexStrokeProperties`** not extracted | Advanced brush/dynamic strokes | All instances in current design are `BASIC` type; captured when non-basic |
| **`PATTERN` paint type** (beta May 2025) | New fill type for pattern paints | Not yet used in current designs; will add when stable |
| **`TEXTURE` / `NOISE` effect types** (beta May 2025) | New effect types | Not yet used in current designs; will add when stable |
| **`PROGRESSIVE` blur** (beta May 2025) | New blur variant | Not yet used in current designs; will add when stable |
| **`TRANSFORM_GROUP` node type** (beta May 2025) | New node type for grouped transforms | Not yet used in current designs |
| **`vectorNetwork`** not captured | Full vector network topology (segments, vertices, regions) | `fillGeometry` path data is sufficient for rendering |

---

## Appendix: Agent Roles

BuildBot uses specialized agents for each stage:

| Agent | Role | Key Script |
|---|---|---|
| **Extractor** | Pulls data from Figma API, produces blueprints | `extract-screen-blueprint.ts` |
| **Builder** | Converts blueprint JSON to React Native code | _(Claude-driven, reads blueprint)_ |
| **Verifier** | Captures app screenshots, runs ODiff, validates view hierarchy | `verify-screen.ts` |
| **Pixel Feedback** | Gemini 3 Pro 4-batch pixel analysis (structural + visual) | `gemini-pixel-feedback.ts` |
| **Inspector** | Gemini 3 Flash 5-pass visual inspection | `inspector-flash.ts` |
| **Auditor** | Coverage checks, combined audit reports | `check-coverage.ts` |
| **PM Agent** | Product context, functional validation, state management | _(Claude-driven)_ |
| **Backend Agent** | API wiring, test data, mock state simulation | _(Claude-driven)_ |
| **Learning Agent** | Extracts learnings from build/verify cycles | _(persists to learnings/)_ |

---

## File Reference

```
buildbot/
  config/
    figma.json               -- Figma file key, API base URL, export settings
    design-tokens.json        -- Extracted color/typography/spacing/radius tokens
    screen-routes.json        -- Figma node ID -> app route mapping (60+ screens)
    enhanced-pipeline.json    -- Verification assertions per screen
  scripts/
    extract-screen-blueprint.ts  -- Core extractor (1689 lines, zero AI)
    export-figma-tokens.ts       -- Figma Variables -> design-tokens.json
    analyze-hierarchy.ts         -- Maestro hierarchy vs Figma blueprint text diff
    maestro-structural-verify.ts -- Deterministic 8-check Blueprint ↔ Hierarchy structural diff (zero AI)
    maestro-auto-heal.ts         -- Closed-loop auto-patch: verify → patch → re-verify (zero AI)
    verify-screen.ts             -- Full verification pipeline orchestrator
    check-coverage.ts            -- Blueprint-to-code coverage validation
    inspector-flash.ts           -- Gemini 3 Flash 5-pass visual inspector
    gemini-pixel-feedback.ts     -- Gemini-based pixel comparison
    universal-converter.ts       -- Figma-to-RN code converter
    apply-figma-fixes.ts         -- Automated code fixes from audit findings
    prep-for-claude.sh           -- Image resizing for Claude API limits
    batch-screenshots.sh         -- Batch screenshot capture
    auto-heal-parity.sh          -- Automated parity healing loop
  agents/
    extractor.md, builder.md, verifier.md, inspector.md,
    auditor.md, pm-agent.md, backend-agent.md, learning-agent.md
  data/
    blueprints/     -- Blueprint JSON per screen (60+ files)
    baselines/      -- Figma-exported PNG baselines
    assets/         -- Downloaded image assets per screen
    screenshots/    -- App simulator screenshots
    diffs/          -- ODiff pixel comparison images
    hierarchies/    -- Maestro view hierarchy CSVs
    claude-ready/   -- Resized images for Claude API
  reports/
    audits/         -- Combined audit reports
    coverage/       -- Coverage check results
    hierarchy/      -- Hierarchy analysis reports
```
