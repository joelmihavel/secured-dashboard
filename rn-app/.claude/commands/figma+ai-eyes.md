# /figma+ai-eyes

AI-powered visual comparison for Figma-to-implementation parity testing.

## Usage
```
/figma+ai-eyes [screen-node-id]
```

Example: `/figma+ai-eyes 1-28055`

## GOLDEN RULE

**AI = Eyes (spot mismatches) | Figma Data = Source of Truth (all values)**

AI models identify WHERE issues exist. All implementation values come from deterministic Figma data.

## AI Models for Visual Comparison

| Model | Model ID | Use Case |
|-------|----------|----------|
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Primary visual comparison |
| **Claude Opus 4.5** | `claude-opus-4-5-20251101` | Secondary/verification |

**IMPORTANT**: These models are used ONLY as "eyes" to spot differences. They do NOT provide implementation values.

## Workflow

### Step 1: Load Resources

Load for the specified screen:
1. Figma baseline: `/rn-app/figma/baselines/[screen-name]-[node-id].png`
2. Figma data: `/figma-parity/data/screens/[node-id]/extracted-values.json`
3. Current implementation file

### Step 2: AI Visual Comparison (Eyes Only)

Use Gemini 3 Pro or Claude Opus 4.5 to compare Figma baseline vs current app screenshot.

**Prompt template:**
```
Compare these two images:
1. Figma design (reference/ground truth)
2. Current app implementation

List ALL visual differences you can spot:
- Colors that don't match
- Spacing/gaps that look different
- Text content mismatches
- Missing or incorrect elements
- Position/alignment differences
- Shadow/effect differences
- Asset/image issues

DO NOT provide specific pixel values, hex codes, or implementation code.
ONLY identify WHAT looks different and WHERE on screen.
```

**AI outputs (examples):**
- "Heading color mismatch - first lines should be gray, not white"
- "Logo-to-heading spacing looks too small"
- "Button shadow appears missing or too faint"
- "Text content 'India's' has wrong apostrophe character"
- "Background shape position is off - should be more centered"

**AI does NOT output:**
- Specific pixel values (e.g., "16px")
- Color hex codes (e.g., "#A9A9A9")
- Font sizes
- Implementation code

### Step 3: Look Up Figma Data

For each AI-identified issue, find EXACT value in `extracted-values.json`:

```json
{
  "nodeId": "1:28066",
  "name": "Main Heading",
  "fills": [{ "hex": "#A9A9A9" }],
  "typography": {
    "fontSize": 48,
    "lineHeight": 64,
    "letterSpacing": -2,
    "text": "Make  your rent  work for you→"
  }
}
```

### Step 4: Create Comparison Table

| Category | AI Finding | Figma Node | Figma Value | Action |
|----------|------------|------------|-------------|--------|
| Color | "Heading should be gray" | 1:28066 | #A9A9A9 | Use colors.neutral[500] |
| Spacing | "Gap looks too small" | 1:28062 | gap: 40 | Use spacing.xxl |
| Text | "Wrong apostrophe" | 1:28067 | India's (curly) | Fix to ' character |

### Step 5: Implement Fixes

**ALWAYS use Figma data, NEVER AI-suggested values:**

```typescript
// ❌ WRONG - AI suggested "looks like gray"
color: 'gray',

// ✅ CORRECT - From Figma node 1:28066 fills[].hex
color: colors.neutral[500],  // #A9A9A9 from Figma
```

## Categories to Check

### A. Design Tokens
- Colors, spacing, radius, typography

### B. Text Content (Character by Character!)
- Exact strings from `typography.text`
- Special characters: → ' " —
- Spacing: single vs double spaces

### C. Assets
- Images exist and positioned correctly
- Dimensions match Figma
- Opacity, transforms (rotation, scale, flip)

### D. UI Structure
- Component hierarchy matches Figma node tree
- Text: single vs split nodes

### E. Interactions
- Navigation targets
- Animation timing
- Haptic feedback

## Output

After running this skill, produce:
1. Full comparison table with all AI findings + Figma values
2. List of fixes applied (with Figma node references)
3. Confirmation that ALL values came from Figma data (not AI suggestions)
