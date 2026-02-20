# BuildBot Learnings

Persistent knowledge base. Every agent reads this before starting work.
Updated by the Learning Agent after each fix loop.

---

## Figma Interpretation

### Map Figma fontWeight to fontFamily, never to RN fontWeight
**Why**: RN's `fontWeight` prop resolves to system fonts, not custom font files. Setting `fontWeight: '400'` renders the system default, not PlusJakartaSans-Regular. The visual difference is subtle enough to pass casual review but fails pixel comparison.
**How**: Use the static mapping and set `fontFamily` directly:
- 400 → `PlusJakartaSans-Regular`
- 500 → `PlusJakartaSans-Medium`
- 600 → `PlusJakartaSans-SemiBold`
- 700 → `PlusJakartaSans-Bold`
Never set the `fontWeight` style property on any element using a custom font.

### Use Figma lineHeightPx as-is for RN lineHeight
**Why**: Figma reports `lineHeightPx` as the resolved pixel value. Calculating `lineHeight = fontSize * lineHeightMultiplier` introduces floating-point drift that compounds across multi-line text, causing vertical rhythm misalignment.
**How**: Read `style.lineHeightPx` from the Figma node and assign it directly to `lineHeight` in RN. Don't derive it from fontSize or lineHeightUnit.

### Check fill.visible before rendering any text element
**Why**: Figma designers hide elements by setting `fill.visible=false` rather than deleting nodes. The node still exists in the tree with valid text content, so extractors and builders include it by default. This causes ghost elements to appear in the UI that were intentionally hidden in the design.
**How**: Before rendering any text node, check `fills[0].visible !== false`. If the fill is hidden, exclude the element entirely — don't just set opacity to 0.

### Compose fill opacity and node opacity separately
**Why**: Figma stores fill opacity (per-fill) and node opacity (container-level) independently. The final visual opacity is `fill.opacity * node.opacity`. Using only one of them produces wrong transparency levels, especially on overlapping elements.
**How**: Compute `finalOpacity = fill.opacity * node.opacity`. Apply fill opacity via color alpha channel (e.g., `rgba(r, g, b, fillOpacity)`) and node opacity via RN `opacity` prop only when the node itself is transparent.

### Subtract root node bbox.y when checking if content is below fold
**Why**: Figma `absoluteBoundingBox` uses canvas-absolute coordinates. A screen positioned at y=3857 on the canvas would have its top content at y=3857, not y=0. Comparing raw bbox.y against designHeight causes the extractor to skip ALL nodes when the screen is far from canvas origin.
**How**: Calculate relative position: `relativeY = node.absoluteBoundingBox.y - rootNode.absoluteBoundingBox.y`. Compare `relativeY` against `designHeight`, not `node.absoluteBoundingBox.y`.

### Use maxWidth to force text line wrapping, not width
**Why**: Figma text nodes with a fixed width (e.g., 313px) force text to wrap at that boundary. Using RN `width: 313` works but prevents the text from being narrower on smaller screens. Using `maxWidth: 313` preserves the wrapping behavior while remaining responsive. Without either, wider devices allow text to fit on one line when the design shows two.
**How**: When a Figma text node has `textAutoResize: HEIGHT` (fixed width, variable height), set `maxWidth` equal to the node's width. This forces the same line breaks as Figma without hard-coding width.

### Legend pills with negative y-offset require absolute positioning
**Why**: Figma allows children to have negative y positions within auto-layout frames, which visually places them above the parent's top edge. RN auto-layout (flexbox) cannot produce negative offsets — items always stack positively. Without absolute positioning, these elements render below their intended position.
**How**: When a Figma node has `layoutPositioning: ABSOLUTE` or a negative y within its parent, use `position: 'absolute'` in RN. Calculate the `top` value as: `parent.y + child.y` relative to the grandparent container.

---

## React Native Patterns

### Reuse shared components — never rebuild per screen
**Why**: Rebuilding a TextInput or Button per screen creates visual inconsistency and maintenance burden. Each copy drifts from the design system independently. When the design system updates, N copies need updating instead of 1.
**How**: Import from `@/src/components` barrel. Available shared components: Text, TextInput, PhoneInput, OTPInput, PrimaryButton, TextButton, Screen, Logo, DottedPattern, DocumentUploadCard, FileUploadZone. If a screen needs customization, extend the shared component with props — don't fork it.

### Pass correct backgroundShape to DottedPattern
**Why**: Each screen in Figma has a unique background SVG shape. The DottedPattern component has pre-built shape variants keyed by name. Using `default` when the screen has a specific shape creates a visually different background pattern that fails pixel comparison by 5-10%.
**How**: Check the Figma screen's background frame for the shape asset name. Map it to the available keys: `splash`, `carousel1`, `carousel2`, `carousel3`, `agreement`, `default`. Always verify the key exists before passing it.

### Screen component adds its own padding — don't double-pad
**Why**: The `Screen` wrapper component from `@/src/components` applies SafeArea insets and base padding. Adding `paddingHorizontal` to child views stacks on top of Screen's padding, causing content to be indented too far from the edge. This is especially noticeable on screens where Figma specifies asymmetric padding.
**How**: Check the Screen component's `padded` prop. If `padded={false}`, manage padding manually in child views. If `padded={true}` (default), don't add horizontal padding to direct children.

### Card-with-dividers vs menu-stack: two different patterns
**Why**: Figma uses two visually similar but structurally different patterns for lists. Confusing them produces wrong spacing and background behavior.
**How**:
- **Card-with-dividers**: Single card container (bg #202020, radius 12) with items separated by thin 0.25px #4D4D4D dividers. Use `gap: 8` between all children. Items have NO individual background.
- **Menu-stack**: Individual cards (each has its own bg #202020, radius 12) separated by `gap: 4`. Each item is independently styled.
Check whether Figma groups items under one parent frame with a background fill (card) or separate sibling frames each with their own fill (menu-stack).

### Figma layoutSizingHorizontal FILL means flexGrow, not width 100%
**Why**: `width: '100%'` is relative to the parent's content area after padding, which can cause overflow or underflow when siblings exist. `flexGrow: 1` correctly fills remaining space in a flex container, which is what Figma's FILL sizing behavior does.
**How**: Map Figma layout sizing: `FILL` → `flex: 1` (or `flexGrow: 1`), `FIXED` → explicit width/height, `HUG` → no explicit size (let content determine).

---

## Data and State

### Always provide demo data with mixed statuses for chart components
**Why**: When charts have no data or all-same-status data, bars render at minimum height (1px) with colors that blend into the dark background (#4D4D4D on #131313). This makes the entire chart appear empty, which is indistinguishable from a rendering bug. Visual inspection then flags P0 "bars invisible" issues that are actually data issues.
**How**: Create demo data that exercises all visual states. For payment history: at least one `ontime` (tall white bar), one `late` (medium white bar), and remaining `unpaid` (1px dark bar). Match the exact distribution shown in Figma (e.g., JAN=ontime/99px, FEB=late/56px, MAR-DEC=unpaid/1px).

### Demo data must exactly match Figma placeholder content
**Why**: Coverage checks and visual inspections compare rendered text against Figma content. If mock data says "John Doe" but Figma says "Rohan Joshi", the coverage check flags a text content mismatch. More importantly, different name lengths affect layout (line wrapping, truncation) which causes visual diffs.
**How**: Extract placeholder text from Figma nodes (`characters` field) and use those exact strings in demo/mock data. Only deviate for fields that are explicitly dynamic (e.g., user's actual name from auth).

### Check Figma visible property on all elements before rendering
**Why**: Designers use visibility toggling to create state variants within the same Figma frame. An element with `visible: false` or `fill.visible: false` is intentionally hidden in that state. Rendering it produces UI elements the user was never meant to see.
**How**: During extraction, mark elements with `visible: false` as `shouldRender: false`. During building, skip any node marked as not visible. The check applies to both the node's `visible` property and individual fill visibility.

---

## Pipeline and Process

### Extract at unlimited depth (depth=999)
**Why**: Default extraction depth misses nested component internals. A button component at depth 3 contains text, icon, and background at depths 4-6. Shallow extraction sees "Button" but not its contents, so the builder cannot replicate typography, colors, or icon sizing inside components.
**How**: Always pass `depth=999` or equivalent unlimited depth to the Figma API `nodes` endpoint. The performance cost is minimal compared to the cost of re-extracting with more depth.

### Use 4x design height threshold for shouldSkipNode, not 1x
**Why**: Scrollable screens in Figma extend well beyond the viewport height (e.g., profile screen is 1492px tall vs 852px viewport). A 1x threshold skips all content below the fold, which for profile-type screens means Payment Information, Support, and App sections are never extracted. The entire lower half of the screen goes missing.
**How**: Set the shouldSkipNode threshold to `designHeight * 4` (e.g., 3408px for a 852px screen). This captures all content in even the longest scrollable screens while still filtering out off-canvas elements.

### DottedPattern screens have inherent visual differences
**Why**: DottedPattern backgrounds use SVG rendering in the app but bitmap images in Figma baselines. The SVG-to-bitmap conversion introduces antialiasing differences at dot boundaries. This is not a rendering bug — the visual result is identical to the human eye.
**How**: Inspector and Gemini automatically filter DottedPattern background issues for screens with `hasDottedPattern: true` in their blueprint. These differences are expected and should not block certification.

### Batch agents in groups of 5 max to manage context
**Why**: Running more than 5 concurrent agents causes context window pressure on the orchestrator. Each agent's output needs to be processed, and the orchestrator must maintain enough context to synthesize results and make decisions. Beyond 5, quality of orchestration degrades.
**How**: When processing multiple screens, chunk into batches of 5. Complete one batch before starting the next. Use `run_in_background=true` for agents within a batch. Checkpoint progress to `state/buildbot-status.json` between batches.

### Checkpoint to memory at 50% context consumption
**Why**: Large screen builds can consume significant context. If the agent hits context limits before completing, all in-progress work and decisions are lost. Checkpointing at 50% ensures there's always enough remaining context to complete the current task and hand off cleanly.
**How**: After completing 50% of planned work items, write current status to `state/buildbot-status.json` and update `MEMORY.md`. Include: completed items, remaining items, key decisions made, blockers encountered.

### Validate PNG integrity at every image I/O boundary
**Why**: Corrupt, empty, or non-PNG files (e.g., Figma API returning JSON error as .png) cause silent cascading failures. Claude API enters a "death loop" on corrupt images, and Gemini API returns 400 errors with no useful context. These failures are hard to diagnose because the files pass `fs.existsSync()` checks.
**How**: Use the `validateImageFile()` function at every boundary: (1) after downloading from Figma API — check buffer has PNG magic bytes before writing to disk; (2) before passing to ODiff — reject 0-byte or non-PNG files; (3) after resize/crop — confirm output is valid; (4) before base64-encoding for API calls — block corrupt images from reaching Gemini/Claude. The function checks: file exists, size > 0, size >= 67 bytes (minimum PNG), and first 8 bytes match PNG signature `89 50 4E 47 0D 0A 1A 0A`. Also detects JSON masquerading as PNG (first byte `0x7b`).
