# AI Visual Comparison Workflow

## GOLDEN RULE: AI = Eyes, Figma Data = Source of Truth

**AI models (Gemini 2.5 Pro, Claude Opus 4.5) are used ONLY to SPOT mismatches.**
**All implementation values MUST come from deterministic Figma extracted data.**

## The Workflow

### Step 1: AI Visual Comparison (Eyes Only)

Use **Gemini 3 Pro** (`gemini-3-pro-preview`) or **Claude Opus 4.5** to compare:
- Figma baseline screenshot (`/figma-parity/data/screens/[id]/screenshot.png` or `/rn-app/figma/baselines/`)
- Current app screenshot (from simulator)

AI identifies:
- "The heading color looks different"
- "The spacing between logo and text seems off"
- "The button shadow appears missing"
- "The text content doesn't match"
- "The background image position is wrong"

**AI does NOT provide:**
- Specific pixel values
- Color hex codes
- Font sizes
- Any implementation code

### Step 2: Look Up in Figma Data

Once AI spots an issue, find the EXACT value in extracted Figma data:

```
/figma-parity/data/screens/[node-id]/
├── extracted-values.json   ← Source of truth for ALL values
├── colors-used.json        ← All colors on screen
├── assets/                 ← Exported images/SVGs
└── manifest.json           ← Asset list
```

For each AI-identified issue:
1. Find the relevant node in `extracted-values.json`
2. Extract the EXACT value from Figma
3. Map to design token if available
4. Implement using that deterministic value

### Step 3: Implementation

**NEVER use AI-suggested values. ALWAYS use Figma data.**

```typescript
// ❌ WRONG - AI suggested "looks like 16px"
marginBottom: 16,

// ✅ CORRECT - From extracted-values.json node 1:28062 layout.gap = 40
marginBottom: spacing.xxl,  // 40px from Figma
```

## Example Workflow

**AI says:** "The heading text color looks wrong - the first two lines should be gray, third line orange"

**Action:**
1. Open `extracted-values.json`
2. Find node `1:28066` (Main Heading)
3. Check `fills[].hex` → `#FFFFFF` (but screenshot shows mixed colors)
4. Check Figma screenshot to see styled text ranges
5. Implement exact colors from Figma: `#A9A9A9` for gray, `#FF9A6D` for orange

**AI says:** "The gap between logo and heading seems too small"

**Action:**
1. Open `extracted-values.json`
2. Find Container node `1:28062`
3. Check `layout.gap` → `40`
4. Implement: `marginBottom: spacing.xxl` (40px)

## Why This Approach?

1. **Deterministic**: Same Figma data always produces same implementation
2. **Traceable**: Every value can be traced to a Figma node
3. **No hallucination**: AI can't invent incorrect values
4. **Pixel-perfect**: Values are exact, not approximated
5. **Scalable**: Works for any screen, any complexity

## AI Prompts for Visual Comparison

### For Gemini 3 Pro / Claude Opus 4.5:

```
Compare these two images:
1. Figma design (reference)
2. Current implementation (screenshot)

List ALL visual differences you can spot:
- Colors that don't match
- Spacing that looks different
- Text content mismatches
- Missing or incorrect elements
- Position differences
- Shadow/effect differences

DO NOT provide specific values or code.
ONLY identify WHAT looks different and WHERE.
```

## Remember

- AI = Detective (finds problems)
- Figma Data = Evidence (provides facts)
- Developer = Judge (implements based on evidence)
