# Figma Parity V2 Plan - Figma REST API Data Only

## Core Principle
**Figma REST API data is the ONLY source of truth.** No AI visual guesswork. No assumptions. Every value comes from `enhanced-extraction.json` and `design-tokens.json`.

## What We Already Have (autonomous-parity-fixer system)

### Infrastructure
1. **Figma Extraction Script** (`scripts/extract-figma-ai-enhanced.ts`) - 1904 lines
   - Calls `GET /v1/files/{key}/nodes?ids={nodeId}&geometry=paths` for full node tree
   - Calls `GET /v1/images/{key}?ids={ids}&scale=4&format=png` for screenshots
   - Outputs `data/ai-enhanced/{id}/enhanced-extraction.json` with complete component tree
   - Each node has: `figmaData` (raw API), `computedStyles` (RN-ready), `_designTokens`

2. **Coverage Checker** (`scripts/check-coverage.ts`) - 2803 lines
   - Parses RN code via regex (StyleSheet, inline styles, constants)
   - Compares 14 categories: geometry, positioning, layout, spacing, colors, gradients, images, borders, effects, opacity, typography, textContent, multiStyleText, visibility
   - Outputs `reports/coverage/{id}-coverage.json` with per-category breakdown + uncovered list

3. **Design Tokens** (`config/design-tokens.json`)
   - Color hex → token path (e.g., `#FF9A6D` → `colors.brand[500]`)
   - Typography → token (e.g., `48:64:400` → `typography.h1`)
   - Spacing/Radius value → token

4. **Screen Routes** (`config/screen-routes.json`)
   - Maps 25 routes to 66 Figma screens with states

5. **Existing Extractions** - 66 screens in `data/ai-enhanced/`
6. **Existing Coverage Reports** - 24 screens in `reports/coverage/`

### Two-Gate System (from ORCHESTRATION.md)
- **PRE-FEEDBACK Gate**: Coverage ≥ 95% (max 10 iterations)
- **POST-FEEDBACK Gate**: Coverage = 100% (max 10 iterations)

## Plan

### Phase 0: Refresh Figma Extractions (if stale)
- Existing extractions are from Feb 2-3, 2026 - check if designs changed
- If stale, re-run: `npx ts-node scripts/extract-figma-ai-enhanced.ts {id}`
- Priority screens: the 16 from auto-heal-parity.sh

### Phase 1: Run Coverage Checker on ALL 16 Screens
For each screen in auto-heal-parity.sh:
```
npx ts-node scripts/check-coverage.ts {figmaId}
```
This gives us the ground truth of what's actually wrong - deterministically.

Screens to check (figma_id → route):
| Screen | Figma ID | Route |
|--------|----------|-------|
| splash | 1:28055 | /(auth)/splash |
| carousel | 1:28985 | /(auth)/carousel |
| sign-up | 1:29108 | /(auth)/sign-up |
| otp | 1:31175 | /(auth)/otp |
| home | 243:2762 | /(main) |
| select-method | 41:8901 | /(payment)/select-method |
| processing | 41:9460 | /(payment)/processing |
| success | 41:9388 | /(payment)/success |
| failed | 41:9511 | /(payment)/failed |
| profile | 41:8760 | /(profile) |
| setup | 41:10712 | /(setup) |
| waitlist | 41:11206 | /(waitlist) |
| transactions | 243:5870 | /(transactions) |
| add-upi | 41:8369 | /(payment)/add-upi |
| add-card | 41:8529 | /(payment)/add-card |
| add-netbanking | 41:9224 | /(payment)/add-netbanking |

### Phase 2: Deploy React Specialist Sub-Agents
For each screen with coverage < 95%:

**Agent receives:**
1. Full Figma extraction JSON (enhanced-extraction.json)
2. Coverage report (what's missing/wrong)
3. Current RN code (.tsx file)
4. Design tokens (design-tokens.json)

**Agent does:**
1. Read full Figma extraction → understand component hierarchy
2. Read coverage report → identify gaps (NOT fixes)
3. Read current RN code → find root causes
4. Fix comprehensively using ONLY Figma data values
5. Report changes with Figma data references

### Phase 3: Re-check Coverage
- Run coverage checker again
- Iterate until ≥ 95% per screen

### Phase 4: Screenshot Comparison (auto-heal-parity.sh)
- Run `./scripts/auto-heal-parity.sh` for visual verification
- This is the "eyes" step - confirms visual match

### Phase 5: Sync to FlentApp
```bash
rsync -av rn-app/app/ /Users/atrishabh/FlentApp/app/
rsync -av rn-app/src/ /Users/atrishabh/FlentApp/src/
```

## Key Rules for All Agents
1. **ONLY use values from Figma extraction** - no inventing
2. **Use design tokens** when value maps to a token
3. **Fix root causes** not symptoms (wrong spread, not wrong fontSize)
4. **Maintain code patterns** - don't restructure for fun
5. **Coverage report = where to look, Figma data = what values to use**
