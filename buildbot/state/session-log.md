# BuildBot Session Log

> **Purpose**: Persistent progress tracker that survives `/clear`. Claude reads this on startup to resume context.
> **Updated by**: Claude at each pipeline stage. Manual edits welcome.

---

## Current Session

**Started**: 2026-02-15
**Goal**: Build and certify all screens to pixel-perfect Figma parity

### Active Screen: `41-8760` (My Profile / Main Screen)
- **Route**: `/(profile)/index`
- **Status**: `FIX_LOOP_1` (iteration 2)
- **Pipeline Stage**: Inspector (step 9) — BLOCKED by Claude API image error
- **Blueprint**: `data/blueprints/41-8760-blueprint.json` (162 nodes, 1 asset)
- **Baseline**: `data/baselines/41-8760-baseline.png` (1179x4476, 281KB)
- **Screenshot**: `data/screenshots/41-8760.png` (1206x2622, 160KB)

#### Fixes Applied (iteration 2)
1. Title maxWidth:313 for 2-line wrap
2. Demo chart data (mixed statuses instead of all-unpaid)
3. Legend pills positioned above chart (absolute, top:6)
4. Added Payment Information section (card with 3 items + dividers)
5. Added Support section (card with 2 items + divider)
6. Added App section (card with Sign Out + Delete Account)
7. Chart clip wrapper (overflow:hidden)
8. DEMO_CHART_DATA updated to match Figma exactly: JAN=ontime, FEB=late, MAR-DEC=unpaid
9. Removed Credit Card XX25 (fill.visible=false in Figma node 41:8837)
10. Removed unused styles: userSubtitleRow, userCardInfo

#### Coverage Before Fixes
- Overall: 97.2%

#### Visual Score Before Fixes
- Inspector score: 52/100

#### Known Issues (from inspection report)
- P0: Chart bars invisible
- P0: Legend pills wrong position + wrong colors
- P1: Title single-line instead of two-line
- P1: Chart shows too many months (should show JAN-MAY with scroll)
- P1: Scroll indicator wrong proportions

#### Blocker — RESOLVED
- **Claude API "Could not process image" error** — FIXED
- Root cause 1: ODiff produced truncated PNGs without `--reduce-ram-usage` flag
- Root cause 2: Baseline (1179x4476px) too large for Claude API (optimal max 1568px)
- Fix 1: Added `--reduce-ram-usage` and `--parsable-stdout` to ODiff invocation
- Fix 2: Dimension matching — resize screenshot to baseline dims before comparison
- Fix 3: Large image scaling — both images scaled proportionally if >2000px longest side
- Fix 4: `prep-for-claude.sh` — resizes images to Claude-safe dims before viewing

### Queued Screen: `1-30090` (Agreement Upload - Idle)
- **Route**: `/(agreement)/upload`
- **Status**: `EXTRACTED`
- **Blueprint**: `data/blueprints/1-30090-blueprint.json` (46 nodes, 3 assets)
- **Baseline**: `data/baselines/1-30090-baseline.png` (1179x2556, 1.35MB)
- **Next Step**: Build screen from blueprint

---

## Pipeline Quick Reference

```
1. Extract Blueprint    → scripts/extract-screen-blueprint.ts {figmaId}
2. Build Screen         → Claude implements from blueprint
3. Capture Screenshot   → Maestro or manual
4. Verify Pipeline      → scripts/verify-screen.ts {screenId} --route {route}
   Steps: Prerequisites → Learnings → PM Brief → Backend Brief →
          Screenshot → ODiff → Coverage → Gemini → Inspector →
          Learning Agent → Audit Report → Summary
5. Fix Loop             → Apply fixes from audit, re-verify
6. Certify              → All checks pass → status = CERTIFIED
```

## Completed Screens
_(none yet — 41-8760 is first screen in pipeline)_

---

## How to Resume After `/clear`

1. Read this file: `buildbot/state/session-log.md`
2. Read status: `buildbot/state/buildbot-status.json`
3. Read learnings: `buildbot/learnings/buildbot-learnings.md`
4. Read agent instructions for the current pipeline step under `buildbot/agents/`
5. Continue from the **Pipeline Stage** listed under the active screen above

---

## Session History

### 2026-02-15 (Session 2)
- Fixed ODiff truncated PNG issue: added `--reduce-ram-usage` + `--parsable-stdout` flags
- Fixed dimension mismatch: resize screenshot to baseline dims before comparison
- Added large image scaling: both images scaled proportionally if >2000px
- Created `scripts/prep-for-claude.sh` for Claude API-safe image preprocessing
- Updated output parser for ODiff parsable stdout format (`diffCount;diffPercentage`)
- Updated IMPLEMENTATION-PLAN.md with PM Agent, Backend Agent, Learning Agent
- **Added batch-state mode**: `--screen <routeKey>` processes all Figma states of one screen
- **PM Agent auto-generates briefs**: extracts functional areas, states, interactive elements, data fields from blueprint
- **Backend Agent auto-generates briefs**: scans app source for hooks, services, mock data
- **Learning Agent writes findings**: WHAT/WHY/HOW format to `reports/learnings/{screenId}-learnings.md`
- **Auto-extraction**: pipeline auto-extracts missing blueprints before verification
- Tested batch-state on OTP screen: 4 states processed, all briefs generated
- Verified ODiff produces valid PNGs: 5.16% diff on resized profile screen images
- Next: Re-run full verification pipeline on 41-8760

### 2026-02-15 (Session 1)
- Extracted blueprint for 41-8760 (My Profile) — 162 nodes
- Extracted blueprint for 1-30090 (Agreement Upload) — 46 nodes
- Ran initial verify pipeline for 41-8760
- Manual inspection produced 14 issues (2 P0, 5 P1, 5 P2, 2 P3)
- Applied 10 fixes (fix loop iteration 2)
- Re-ran pipeline — hit Claude API image error at inspector step
- Created session-log.md for cross-clear persistence
