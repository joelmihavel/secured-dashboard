# Autonomous Parity Fixer - Orchestration Protocol v2

## Overview

The Autonomous Parity Fixer processes Figma designs **one-by-one (design-by-design)**, converting them to pixel-perfect React Native code through a two-gate system with **React Specialist sub-agents** that do deep code review work.

**Key Principles:**
1. **Design-by-Design**: Each design completes the full pipeline before moving to the next
2. **Sub-Agents Do Deep Work**: Not just coverage fixes - full code review using Figma data
3. **Figma Data is Source of Truth**: Coverage report identifies gaps, Figma data provides solutions
4. **Two Gates**: PRE-FEEDBACK (95%) and POST-FEEDBACK (100%)

---

## Master Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DESIGN-BY-DESIGN PROCESSING PIPELINE                          │
│                                                                                  │
│   For EACH Figma design (screen or component), run full pipeline:               │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 1: FIGMA EXTRACTION                                                │   │
│   │ ─────────────────────────────                                            │   │
│   │ • Script: npx ts-node scripts/extract-figma-ai-enhanced.ts              │   │
│   │ • Input: Figma design ID (e.g., 1:28055)                                │   │
│   │ • Output: data/ai-enhanced/{id}/enhanced-extraction.json                │   │
│   │                                                                          │   │
│   │ Extracts:                                                                │   │
│   │   - Complete component tree with all Figma properties                   │   │
│   │   - Geometry, colors, typography, spacing, effects                      │   │
│   │   - Design token mappings                                               │   │
│   │   - Screenshots for visual reference                                    │   │
│   │   - AI hints for implementation                                         │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      ↓                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 2: CODE GENERATION (if new screen)                                 │   │
│   │ ────────────────────────────────────────                                 │   │
│   │ • Generate initial React Native code from Figma data                    │   │
│   │ • Map Figma node hierarchy to RN component structure                    │   │
│   │ • Apply design tokens                                                   │   │
│   │ • Output: ../rn-app/app/{route}.tsx                                     │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      ↓                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 3: PRE-FEEDBACK GATE (95% threshold)                              │   │
│   │ ──────────────────────────────────────────                              │   │
│   │                                                                          │   │
│   │   ┌───────────────────────────────────────────────────────────────────┐ │   │
│   │   │ LOOP: until coverage ≥ 95% (max 10 iterations)                    │ │   │
│   │   │                                                                    │ │   │
│   │   │  1. RUN COVERAGE CHECK                                            │ │   │
│   │   │     └─ npx ts-node scripts/check-coverage.ts {id}                 │ │   │
│   │   │     └─ Output: reports/coverage/{id}-coverage.json                │ │   │
│   │   │                                                                    │ │   │
│   │   │  2. IF coverage < 95%:                                            │ │   │
│   │   │     ┌───────────────────────────────────────────────────────────┐ │ │   │
│   │   │     │ SPAWN REACT SPECIALIST SUB-AGENT                          │ │ │   │
│   │   │     │                                                            │ │ │   │
│   │   │     │ Agent receives:                                           │ │ │   │
│   │   │     │   • Full Figma extraction (SOURCE OF TRUTH)               │ │ │   │
│   │   │     │   • Coverage report (identifies gaps)                     │ │ │   │
│   │   │     │   • Current RN code                                       │ │ │   │
│   │   │     │   • Design tokens                                         │ │ │   │
│   │   │     │                                                            │ │ │   │
│   │   │     │ Agent does DEEP WORK (not just fixes):                    │ │ │   │
│   │   │     │   • Reviews full Figma structure                          │ │ │   │
│   │   │     │   • Understands design intent                             │ │ │   │
│   │   │     │   • Analyzes RN code patterns                             │ │ │   │
│   │   │     │   • Fixes root causes, not symptoms                       │ │ │   │
│   │   │     │   • Maintains code quality                                │ │ │   │
│   │   │     └───────────────────────────────────────────────────────────┘ │ │   │
│   │   │                                                                    │ │   │
│   │   │  3. Re-run coverage check, repeat if needed                       │ │   │
│   │   └───────────────────────────────────────────────────────────────────┘ │   │
│   │                                                                          │   │
│   │   ✅ Gate PASSES when coverage ≥ 95%                                    │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      ↓                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 4: GEMINI VISUAL FEEDBACK                                          │   │
│   │ ───────────────────────────────                                          │   │
│   │ • Script: npx ts-node scripts/gemini-pixel-feedback.ts {id}             │   │
│   │ • Model: Gemini 2.5 Pro                                                 │   │
│   │                                                                          │   │
│   │ Gemini compares:                                                        │   │
│   │   - Figma screenshot (expected design)                                  │   │
│   │   - RN implementation screenshot (actual render)                        │   │
│   │                                                                          │   │
│   │ Output: analysis/pixel-feedback/{id}-feedback.json                      │   │
│   │   - Visual discrepancies                                                │   │
│   │   - Pixel-level mismatches                                              │   │
│   │   - Structural differences                                              │   │
│   │   - Suggested fixes with severity                                       │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      ↓                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 5: POST-FEEDBACK GATE (100% threshold)                            │   │
│   │ ───────────────────────────────────────────                             │   │
│   │                                                                          │   │
│   │   ┌───────────────────────────────────────────────────────────────────┐ │   │
│   │   │ LOOP: until coverage = 100% (max 10 iterations)                   │ │   │
│   │   │                                                                    │ │   │
│   │   │  1. SPAWN REACT SPECIALIST SUB-AGENT                              │ │   │
│   │   │     ┌───────────────────────────────────────────────────────────┐ │ │   │
│   │   │     │ Agent receives:                                           │ │ │   │
│   │   │     │   • Full Figma extraction                                 │ │ │   │
│   │   │     │   • Gemini visual feedback (NEW)                          │ │ │   │
│   │   │     │   • Coverage report                                       │ │ │   │
│   │   │     │   • Current RN code                                       │ │ │   │
│   │   │     │   • Design tokens                                         │ │ │   │
│   │   │     │                                                            │ │ │   │
│   │   │     │ Agent does DEEP WORK:                                     │ │ │   │
│   │   │     │   • Addresses each Gemini discrepancy                     │ │ │   │
│   │   │     │   • Fixes visual/pixel issues                             │ │ │   │
│   │   │     │   • Resolves remaining coverage gaps                      │ │ │   │
│   │   │     │   • Achieves pixel-perfect parity                         │ │ │   │
│   │   │     └───────────────────────────────────────────────────────────┘ │ │   │
│   │   │                                                                    │ │   │
│   │   │  2. Run coverage check                                            │ │   │
│   │   │                                                                    │ │   │
│   │   │  3. If still < 100%, repeat                                       │ │   │
│   │   └───────────────────────────────────────────────────────────────────┘ │   │
│   │                                                                          │   │
│   │   ✅ Gate PASSES when coverage = 100%                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      ↓                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │ PHASE 6: MARK DESIGN COMPLETE                                            │   │
│   │ ────────────────────────────                                             │   │
│   │ • Update state/processing-status.json with completion                   │   │
│   │ • Update state/batch-progress.json                                      │   │
│   │ • Move to NEXT design                                                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ═══════════════════════════════════════════════════════════════════════════   │
│   REPEAT FOR NEXT DESIGN                                                         │
│   ═══════════════════════════════════════════════════════════════════════════   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Critical: Sub-Agent Deep Work Approach

### What Sub-Agents Are NOT

Sub-agents are **NOT** simple fix appliers that blindly follow coverage report suggestions:

```
❌ WRONG APPROACH:
   Coverage says "Add fontSize: 48"
   → Agent adds fontSize: 48
   → Done

This is shallow and leads to poor quality code.
```

### What Sub-Agents ARE

Sub-agents are **React Native Specialists** that do comprehensive code review:

```
✅ CORRECT APPROACH:
   1. Agent reads FULL Figma extraction
      → Understands: This is a heading with h1 typography token
      → Understands: It has mixed colors (gray + orange)
      → Understands: It's inside a container with 48px gap

   2. Agent reads coverage report
      → Identifies: fontSize showing 14 instead of 48
      → Identifies: Root cause - using wrong typography spread

   3. Agent reads current RN code
      → Sees: ...typography.bodyMd2 (wrong!)
      → Understands: Should use ...typography.h1

   4. Agent fixes ROOT CAUSE
      → Changes typography spread, not just fontSize
      → Maintains code pattern consistency
      → Adds proper comments
```

### Sub-Agent Context Package

Each sub-agent spawn includes:

| Context Item | Purpose | Source |
|--------------|---------|--------|
| **Figma Extraction** | Source of truth for all design values | `data/ai-enhanced/{id}/enhanced-extraction.json` |
| **Coverage Report** | Identifies what's missing/wrong | `reports/coverage/{id}-coverage.json` |
| **Current RN Code** | What needs to be fixed | `../rn-app/app/{route}.tsx` |
| **Design Tokens** | Token mappings for colors, typography, spacing | `config/design-tokens.json` |
| **Gemini Feedback** | (Post-feedback only) Visual discrepancies | `analysis/pixel-feedback/{id}-feedback.json` |

---

## Sub-Agent Prompt Template

### PRE-FEEDBACK Gate Agent

```markdown
# React Native Specialist - PRE-FEEDBACK Gate

You are a React Native specialist tasked with achieving pixel-perfect
implementation of a Figma design. You do DEEP code review, not surface fixes.

## Your Context

### 1. Figma Extraction (SOURCE OF TRUTH)
{contents of enhanced-extraction.json}

This contains the COMPLETE design specification. Every value you use
MUST come from this data. DO NOT imagine or assume values.

### 2. Coverage Report (IDENTIFIES GAPS)
{contents of coverage-report.json}

This tells you WHAT is missing, but NOT how to fix it.
Use the Figma extraction to determine the correct fix.

### 3. Current React Native Code
{contents of current .tsx file}

### 4. Design Tokens
{contents of design-tokens.json}

## Your Task

1. **Understand the Design**
   - Review the full Figma extraction
   - Understand component hierarchy
   - Note all styling requirements

2. **Analyze the Gaps**
   - Review each uncovered property
   - Identify ROOT CAUSE (not symptom)
   - Example: If fontSize is wrong, check if it's using wrong typography spread

3. **Do Deep Code Review**
   - Look at code patterns
   - Check component structure
   - Verify design token usage

4. **Fix Comprehensively**
   - Fix root causes, not symptoms
   - Maintain code quality
   - Use design tokens correctly
   - Add necessary comments

5. **Report Your Changes**
   - List each change made
   - Explain why (linked to Figma data)

## Key Rules

- ONLY use values from Figma extraction
- DO NOT invent or assume values
- Maintain existing code patterns
- Use design tokens where available
- Focus on quality, not just coverage numbers
```

### POST-FEEDBACK Gate Agent

```markdown
# React Native Specialist - POST-FEEDBACK Gate

You are achieving 100% pixel-perfect parity. You have Gemini visual feedback
in addition to coverage data.

## Your Context

### 1. Figma Extraction (SOURCE OF TRUTH)
{contents of enhanced-extraction.json}

### 2. Gemini Visual Feedback (VISUAL DISCREPANCIES)
{contents of pixel-feedback.json}

Gemini compared screenshots and found these issues:
- {discrepancy 1}
- {discrepancy 2}
...

### 3. Coverage Report (REMAINING GAPS)
{contents of coverage-report.json}

### 4. Current React Native Code
{contents of current .tsx file}

## Your Task

1. **Address Gemini Discrepancies First**
   - Each visual issue needs attention
   - Cross-reference with Figma data
   - Fix pixel-level differences

2. **Fix Remaining Coverage Gaps**
   - Resolve any uncovered properties
   - Use Figma extraction for values

3. **Achieve Pixel-Perfect Parity**
   - Every detail must match
   - Shadow calculations correct
   - Typography precise
   - Colors exact

4. **Final Quality Check**
   - Code is clean
   - Patterns consistent
   - Tokens used correctly
```

---

## File Structure

```
autonomous-parity-fixer/
├── scripts/
│   ├── extract-figma-ai-enhanced.ts    # Phase 1: Extraction
│   ├── generate-rn-code.ts             # Phase 2: Code generation
│   ├── check-coverage.ts               # Coverage checker
│   ├── gemini-pixel-feedback.ts        # Phase 4: Visual feedback
│   └── orchestrator.ts                 # Main orchestration
│
├── data/
│   └── ai-enhanced/
│       └── {designId}/
│           ├── enhanced-extraction.json  # Figma data
│           └── screenshots/
│
├── analysis/
│   └── pixel-feedback/
│       └── {designId}-feedback.json    # Gemini results
│
├── reports/
│   └── coverage/
│       └── {designId}-coverage.json    # Coverage results
│
├── config/
│   ├── design-tokens.json              # Token mappings
│   ├── screen-routes.json              # Figma ID → RN route
│   ├── screens-to-process.json         # List of all designs
│   └── orchestrator-config.json        # Gate thresholds
│
└── state/
    ├── batch-progress.json             # Overall progress
    └── processing-status.json          # Per-design status
```

---

## Key Paths Reference

| Resource | Path |
|----------|------|
| **RN App** | `../rn-app/` |
| **Design Tokens** | `config/design-tokens.json` |
| **Screen Routes** | `config/screen-routes.json` |
| **Screens to Process** | `config/screens-to-process.json` |
| **Batch Progress** | `state/batch-progress.json` |
| **Processing Status** | `state/processing-status.json` |
| **Coverage Reports** | `reports/coverage/` |
| **Figma Extractions** | `data/ai-enhanced/` |
| **Gemini Feedback** | `analysis/pixel-feedback/` |

---

## Coverage Categories

The coverage checker verifies 14 categories of Figma properties:

| Category | Figma Properties | RN Properties |
|----------|------------------|---------------|
| **geometry** | width, height | width, height, flex |
| **positioning** | constraints, x/y | position, top/left/right/bottom |
| **layout** | layoutMode, layoutSizing, axisAlign | flexDirection, flex, justifyContent, alignItems |
| **spacing** | padding*, itemSpacing | padding*, gap |
| **colors** | fills[].color | backgroundColor |
| **gradients** | fills[].gradientStops | LinearGradient |
| **images** | fills[].imageRef, scaleMode | Image, resizeMode |
| **borders** | cornerRadius, strokes | borderRadius, borderWidth, borderColor |
| **effects** | effects[] (shadows) | shadow* props |
| **opacity** | opacity | opacity |
| **typography** | style.* | fontSize, fontWeight, lineHeight, letterSpacing |
| **textContent** | characters | Text content |
| **multiStyleText** | characterStyleOverrides | Nested Text components |
| **visibility** | visible | conditional rendering |

---

## Running the Pipeline

### Process All Designs (Batch)

```bash
npx ts-node scripts/orchestrator.ts --all
```

### Process Single Design

```bash
npx ts-node scripts/orchestrator.ts --design 1-28055
```

### Individual Scripts

```bash
# Phase 1: Extract Figma data
npx ts-node scripts/extract-figma-ai-enhanced.ts 1:28055 "Splash / get-started"

# Coverage check
npx ts-node scripts/check-coverage.ts 1-28055

# Phase 4: Gemini feedback
npx ts-node scripts/gemini-pixel-feedback.ts 1-28055
```

---

## Example Complete Run

```
Design: 1-28055 (Splash / get-started)

═══════════════════════════════════════════════════════════════
PHASE 1: EXTRACTION
═══════════════════════════════════════════════════════════════
[Bash] npx ts-node scripts/extract-figma-ai-enhanced.ts 1:28055 "Splash / get-started"
       → data/ai-enhanced/1-28055/enhanced-extraction.json created

═══════════════════════════════════════════════════════════════
PHASE 3: PRE-FEEDBACK GATE (95% threshold)
═══════════════════════════════════════════════════════════════

Iteration 1:
[Bash] npx ts-node scripts/check-coverage.ts 1-28055
       → Coverage: 45%
       ❌ Below 95% threshold

[Task] Spawn React Specialist Sub-Agent
       → Agent reads: Figma extraction, coverage report, RN code
       → Agent does deep code review
       → Agent fixes: typography spreads, layout structure, spacing
       → Agent reports changes made

Iteration 2:
[Bash] npx ts-node scripts/check-coverage.ts 1-28055
       → Coverage: 87%
       ❌ Below 95% threshold

[Task] Spawn React Specialist Sub-Agent
       → Agent fixes remaining: colors, text content, borders

Iteration 3:
[Bash] npx ts-node scripts/check-coverage.ts 1-28055
       → Coverage: 97.8%
       ✅ PRE-FEEDBACK GATE PASSED

═══════════════════════════════════════════════════════════════
PHASE 4: GEMINI VISUAL FEEDBACK
═══════════════════════════════════════════════════════════════
[Bash] npx ts-node scripts/gemini-pixel-feedback.ts 1-28055
       → analysis/pixel-feedback/1-28055-feedback.json created
       → 2 minor discrepancies found

═══════════════════════════════════════════════════════════════
PHASE 5: POST-FEEDBACK GATE (100% threshold)
═══════════════════════════════════════════════════════════════

Iteration 1:
[Task] Spawn React Specialist Sub-Agent
       → Agent reads: Figma data, Gemini feedback, coverage report
       → Agent fixes: visual discrepancies, remaining coverage gaps

[Bash] npx ts-node scripts/check-coverage.ts 1-28055
       → Coverage: 100%
       ✅ POST-FEEDBACK GATE PASSED

═══════════════════════════════════════════════════════════════
PHASE 6: MARK COMPLETE
═══════════════════════════════════════════════════════════════
[Edit] state/processing-status.json
       → Design 1-28055 marked complete

[Edit] state/batch-progress.json
       → completed: 1, pending: 102

═══════════════════════════════════════════════════════════════
DESIGN 1-28055 COMPLETE - Moving to next design
═══════════════════════════════════════════════════════════════
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Extraction fails | Retry 3x, then mark FAILED |
| Coverage check fails | Check script, retry |
| PRE-FEEDBACK gate fails after 10 iterations | Mark FAILED, log blockers |
| POST-FEEDBACK gate fails after 10 iterations | Mark NEEDS_REVIEW |
| API rate limit | Exponential backoff wait |
| Sub-agent fails | Retry with more context |

---

## Golden Rules

1. **Figma Extraction is Source of Truth** - Every value comes from the extraction
2. **Coverage Report Identifies Gaps** - But doesn't provide solutions
3. **Sub-Agents Do Deep Work** - Not surface-level fixes
4. **Design-by-Design** - Complete one before starting next
5. **Quality Over Speed** - Pixel-perfect is the goal
6. **Use Design Tokens** - Maintain consistency with token system
