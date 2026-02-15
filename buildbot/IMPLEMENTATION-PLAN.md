# BuildBot Implementation Plan

## Objective
Implement the BuildBot autonomous pixel-perfect screen builder system. This session covers Steps 1-3 (foundation), with the Profile screen (`app/(profile)/index.tsx`, Figma node `41-8760`) as validation target.

**Location**: All BuildBot files live under `buildbot/` at the project root. `autonomous-parity-fixer/` will be **deleted** after BuildBot is complete. BuildBot is **fully self-contained** — zero imports from autonomous-parity-fixer.

---

## Current State Assessment

### What Exists in `autonomous-parity-fixer/` (Will Be Migrated Then Deleted)

**Scripts to recreate in BuildBot** (rewritten, not copied — improved versions):
| Original File | BuildBot Replacement | What Changes |
|---------------|---------------------|-------------|
| `scripts/extract-figma-ai-enhanced.ts` (1905 lines) | `scripts/extract-screen-blueprint.ts` | Zero AI, unlimited depth, 40+ props/node, flat blueprint schema |
| `scripts/check-coverage.ts` (~500 lines) | `scripts/check-coverage.ts` | Migrated as-is, paths updated to buildbot/ |
| `scripts/gemini-pixel-feedback.ts` (~800 lines) | `scripts/gemini-pixel-feedback.ts` | Migrated as-is, paths updated, add MEDIA_RESOLUTION_HIGH |
| `scripts/batch-coverage.ts` (~200 lines) | `scripts/batch-coverage.ts` | Migrated as-is, paths updated |
| `scripts/export-figma-tokens.ts` (~300 lines) | `scripts/export-figma-tokens.ts` | Migrated as-is, paths updated |
| `scripts/apply-figma-fixes.ts` (~300 lines) | `scripts/apply-figma-fixes.ts` | Migrated as-is, paths updated |
| `scripts/universal-converter.ts` (~400 lines) | `scripts/universal-converter.ts` | Migrated as-is, paths updated |
| `visual-comparison/auto-heal-parity.sh` (~200 lines) | `scripts/auto-heal-parity.sh` | Migrated, paths updated to buildbot/ |
| _(none)_ | `scripts/inspector-flash.ts` | NEW — Gemini 3 Flash 5-pass inspector |
| _(none)_ | `scripts/verify-screen.ts` | NEW — Verification pipeline orchestrator |
| _(none)_ | `scripts/maestro-run.sh` | NEW — Maestro env wrapper |

**Config to copy into BuildBot:**
| Original | BuildBot Location | Notes |
|----------|------------------|-------|
| `config/figma.json` | `config/figma.json` | Direct copy |
| `config/design-tokens.json` | `config/design-tokens.json` | Direct copy |
| `config/screen-routes.json` | `config/screen-routes.json` | Direct copy |
| `.env` | `.env` | Direct copy (FIGMA_TOKEN + GEMINI_API_KEY) |
| `.gitignore` | `.gitignore` | Direct copy |

**Data to move into BuildBot:**
| Original | BuildBot Location | Notes |
|----------|------------------|-------|
| `data/ai-enhanced/` (66 dirs) | `data/extractions/` | Move existing extractions |
| `data/combined/` (104 style maps) | `data/style-maps/` | Move existing style maps |
| `reports/coverage/` | `reports/coverage/` | Move existing reports |
| `visual-comparison/figma/` | `data/baselines/` | Move Figma baseline images |
| `visual-comparison/screenshots/` | `data/screenshots/` | Move app screenshots |
| `visual-comparison/diffs/` | `data/diffs/` | Move diff images |

### What Exists Externally (No Change)
| Item | Status |
|------|--------|
| Maestro MCP | Configured in `.mcp.json` with JAVA_HOME wrapper |
| Figma MCP | Available via `mcp__figma__*` tools |
| Shared components | TextInput, PhoneInput, OTPInput, PrimaryButton, TextButton, Text, Screen, Logo, DottedPattern, FileUpload |
| Theme system | colors.ts, typography.ts, spacing.ts, radius.ts, shadows.ts, scale.ts |
| Profile screen | `app/(profile)/index.tsx` exists (~400 lines) with Figma 41-8760 reference |

---

## Directory Structure

```
buildbot/                              ← Fully self-contained (project root level)
├── IMPLEMENTATION-PLAN.md             ← This file
├── package.json                       ← Dependencies
├── tsconfig.json                      ← TypeScript config
├── .env                               ← API keys (FIGMA_TOKEN, GEMINI_API_KEY)
├── .gitignore                         ← Ignore .env, node_modules, etc.
├── config/
│   ├── figma.json                     ← Figma API config (from autonomous-parity-fixer)
│   ├── design-tokens.json             ← Token mappings (from autonomous-parity-fixer)
│   └── screen-routes.json             ← Figma ID → route mappings (from autonomous-parity-fixer)
├── scripts/
│   ├── extract-screen-blueprint.ts    ← NEW: Core blueprint extractor (replaces extract-figma-ai-enhanced.ts)
│   ├── inspector-flash.ts             ← NEW: Gemini 3 Flash inspector
│   ├── verify-screen.ts              ← NEW: Verification pipeline orchestrator
│   ├── maestro-run.sh                ← NEW: Maestro env wrapper
│   ├── check-coverage.ts             ← MIGRATED from autonomous-parity-fixer
│   ├── gemini-pixel-feedback.ts       ← MIGRATED from autonomous-parity-fixer (+ MEDIA_RESOLUTION_HIGH)
│   ├── batch-coverage.ts             ← MIGRATED from autonomous-parity-fixer
│   ├── export-figma-tokens.ts         ← MIGRATED from autonomous-parity-fixer
│   ├── apply-figma-fixes.ts           ← MIGRATED from autonomous-parity-fixer
│   ├── universal-converter.ts         ← MIGRATED from autonomous-parity-fixer
│   ├── auto-heal-parity.sh           ← MIGRATED from autonomous-parity-fixer/visual-comparison/
│   └── prep-for-claude.sh            ← NEW: Resize images to Claude API-safe dimensions
├── learnings/
│   └── buildbot-learnings.md         ← Persistent learning file
├── agents/
│   ├── extractor.md                  ← Extractor agent instructions
│   ├── builder.md                    ← Builder agent instructions
│   ├── verifier.md                   ← Verifier agent instructions
│   ├── auditor.md                    ← Auditor agent instructions
│   ├── inspector.md                  ← Inspector agent instructions
│   ├── pm-agent.md                   ← PM agent — product context, states, functional validation
│   ├── backend-agent.md              ← Backend agent — API wiring, test data, state simulation
│   └── learning-agent.md             ← Learning agent — WHAT/WHY/HOW learnings extraction
├── state/
│   ├── buildbot-status.json          ← Per-screen certification status
│   └── session-log.md                ← Session tracker for cross-clear persistence
├── data/
│   ├── blueprints/                   ← Blueprint JSON outputs (NEW)
│   ├── baselines/                    ← Figma baseline images (from visual-comparison/figma/)
│   ├── screenshots/                  ← App screenshots (from visual-comparison/screenshots/)
│   ├── diffs/                        ← Pixel diff images (from visual-comparison/diffs/)
│   ├── extractions/                  ← Existing extractions (from data/ai-enhanced/)
│   ├── style-maps/                   ← Existing style maps (from data/combined/)
│   ├── pm-briefs/                    ← PM Agent output (screen context + functional areas)
│   ├── mock/                         ← Backend Agent output (mock data + backend briefs)
│   └── claude-ready/                 ← Claude API-safe resized images (prep-for-claude.sh output)
└── reports/
    ├── coverage/                     ← Coverage reports (from reports/coverage/)
    └── audits/                       ← Audit + inspection reports (NEW)
```

**No transition strategy needed** — BuildBot is fully self-contained from day one. After BuildBot is working, `autonomous-parity-fixer/` is deleted.

---

## Implementation Steps

### Step 1: Project Setup + Migration + Learning System

**1.1 Create `buildbot/package.json` and `buildbot/tsconfig.json`:**
- Mirror `autonomous-parity-fixer/` config (CommonJS, ES2020, ts-node)
- Dependencies: dotenv, ts-node, typescript, @types/node

**1.2 Copy config and env from `autonomous-parity-fixer/`:**
- `config/figma.json` — direct copy
- `config/design-tokens.json` — direct copy
- `config/screen-routes.json` — direct copy
- `.env` — direct copy
- `.gitignore` — direct copy

**1.3 Migrate existing scripts** (update internal paths from `autonomous-parity-fixer/` to `buildbot/`):
- `check-coverage.ts` — update config/data/report paths
- `gemini-pixel-feedback.ts` — update paths + add MEDIA_RESOLUTION_HIGH
- `batch-coverage.ts` — update paths
- `export-figma-tokens.ts` — update paths
- `apply-figma-fixes.ts` — update paths
- `universal-converter.ts` — update paths
- `auto-heal-parity.sh` — update paths

**1.4 Move existing data:**
- `data/ai-enhanced/` → `data/extractions/`
- `data/combined/` → `data/style-maps/`
- `reports/coverage/` → `reports/coverage/`
- `visual-comparison/figma/` → `data/baselines/`
- `visual-comparison/screenshots/` → `data/screenshots/`
- `visual-comparison/diffs/` → `data/diffs/`

**1.5 Create `buildbot/learnings/buildbot-learnings.md`:**
- Seed with lessons from MEMORY.md (8 items)
- Categories: Typography, Spacing, Colors, Layout, Components, Extraction, Process
- Format: `[date] lesson text. Root cause: X. Fix: Y.`

**1.6 Create agent instruction files (8 files):**
Each file is a standalone prompt/instruction set for a sub-agent:

- `agents/extractor.md` (~80 lines): How to run extraction, API patterns, font weight mapping, node type handling
- `agents/builder.md` (~120 lines): Code generation rules, shared component APIs, theme token mapping, known pitfalls
- `agents/verifier.md` (~60 lines): Maestro flow patterns, screenshot capture, simulator quirks
- `agents/auditor.md` (~80 lines): Pixel diff interpretation, Gemini prompt patterns, coverage analysis
- `agents/inspector.md` (~80 lines): Gemini 3 Flash 5-pass protocol, component cropping, Maestro test generation
- `agents/pm-agent.md` (~475 lines): **Product context agent** — screen decomposition, functional area breakdown, state analysis, data requirements, user behavior, error states. Produces PM Brief JSON at `data/pm-briefs/{screenId}-pm-brief.json`. Runs as **Step 3** in verification pipeline.
- `agents/backend-agent.md` (~432 lines): **Backend integration agent** — hook inventory, edge function mapping, test data population, state simulation. Produces Backend Brief JSON at `data/mock/{screenId}-backend-brief.json`. Runs as **Step 4** in verification pipeline.
- `agents/learning-agent.md` (~205 lines): **Self-learning agent** — extracts actionable learnings from fix loop results using WHAT/WHY/HOW format. Runs as **Step 10** after inspection. Updates `learnings/buildbot-learnings.md` with generalized principles (not screen-specific logs).

**1.7 Create `buildbot/state/buildbot-status.json`:**
- Empty initial state: `{ "screens": [], "lastUpdated": "..." }`

**1.8a Create `buildbot/state/session-log.md`:**
- Persistent session tracker that survives `/clear` commands
- Tracks: active screen, pipeline stage, fixes applied, coverage scores, known issues, blockers
- Includes pipeline quick reference and session history log
- Claude reads this on startup to resume context from previous sessions

**1.8 Create `buildbot/scripts/maestro-run.sh`:**
- Wrapper that sets JAVA_HOME and PATH before running maestro
- Matches the existing `.mcp.json` JAVA_HOME pattern

**1.9 Install dependencies:**
- `cd buildbot && npm install`

---

### Step 2: Blueprint Extraction Script (~450 lines)

**File: `buildbot/scripts/extract-screen-blueprint.ts`**

This is the core new script. It **replaces** `extract-figma-ai-enhanced.ts`:

| Feature | extract-figma-ai-enhanced.ts | extract-screen-blueprint.ts |
|---------|---------------------------|----------------------------|
| AI dependency | Requires Gemini API call | Zero AI — pure deterministic |
| Output format | EnhancedScreenOutput (tree + flat) | ScreenBlueprint (flat list + tokens) |
| Screenshots | Fetches per-node screenshots | Fetches only screen-level baseline |
| Depth | maxDepth: 3 | Unlimited depth (depth=999 in API) |
| Properties | Basic (26 properties per node) | Comprehensive (40+ properties per node) |
| Typography | Basic fontSize/lineHeight/fontWeight | Full: letterSpacing, textDecoration, textCase, spans, paragraphSpacing |
| Vectors | Not extracted | Extracts fillGeometry/strokeGeometry paths |
| Gradients | Detects, exports as image | Extracts stop/position data for code recreation |
| Borders | cornerRadius only | Per-corner radii, per-side stroke weights, dash patterns |
| Effects | Not extracted | Shadows, blurs with full parameters |
| Component mapping | None | Auto-maps Figma nodes to RN shared components |
| Design tokens | Mapped via lookup | Mapped inline per node |
| Execution time | 15-60s (with AI) | 5-15s (API only) |

**Key design decisions:**
1. Self-contained — all utilities (figmaColorToHex, token mapping) are inline in the script
2. Loads config from `buildbot/config/figma.json` and `design-tokens.json`
3. Output to `buildbot/data/blueprints/{screenId}-blueprint.json`
4. Fetch Figma baseline image to `buildbot/data/baselines/{screenId}-baseline.png`
5. CLI: `npx ts-node scripts/extract-screen-blueprint.ts 41:8760` or `41-8760`

**Blueprint JSON structure** (as defined in the master plan):
- `meta`: screenId, name, route, dimensions, generatedAt
- `background`: color, hasDottedPattern, backgroundShapeKey
- `nodes[]`: Flat depth-first list with comprehensive properties per node
- `assets[]`: Image/gradient assets with download URLs and local paths
- `tokensUsed`: Color/typography/spacing/radius token reverse-map

**Node property extraction per type:**
- ALL nodes: id, parentId, name, type, depth, visible, geometry, opacity, fills, strokes, effects, borderRadius, clipsContent
- FRAME nodes: + layout (direction, justify, align, gap, padding, sizing)
- TEXT nodes: + typography (fontSize, lineHeight, fontWeight, fontFamily, letterSpacing, textAlign, content, spans, textDecoration, textTransform)
- VECTOR nodes: + vectorPaths (SVG path d data), vectorNetwork
- INSTANCE/COMPONENT: + componentId, componentProperties
- All nodes with fills: + gradient data extraction (stops, positions, handles)

**Component auto-mapping rules** (hardcoded heuristics):
- Frame with TEXT "label" + TEXT "input" → `TextInput`
- Frame with gradient/border + TEXT → `PrimaryButton`
- TEXT node → `Text`
- Frame with "+91" prefix → `PhoneInput`
- Frame with 4-6 equal boxes → `OTPInput`
- Top-level wrapper → `Screen`
- Frame with dotted pattern image → `DottedPattern`

---

### Step 3: Verification Pipeline + Inspector (~600 lines total)

**3.1 File: `buildbot/scripts/verify-screen.ts` (~600 lines)**

Full 12-step verification pipeline orchestrator:

| Step | Name | Purpose |
|------|------|---------|
| 1 | Prerequisites | Validate blueprint + baseline files exist |
| 2 | Load Learnings | Read `learnings/buildbot-learnings.md` for prior knowledge |
| 3 | **PM Agent Brief** | Load product context, functional areas, states, data requirements |
| 4 | **Backend Agent Brief** | Load hook inventory, mock data status, edge function mapping |
| 5 | Screenshot | Validate or capture app screenshot via Maestro |
| 6 | **ODiff Pixel Diff** | Dimension-matched comparison with `--reduce-ram-usage` |
| 7 | Coverage Check | Deterministic property coverage against blueprint |
| 8 | Gemini Visual | AI visual feedback via Gemini 3 Pro |
| 9 | Inspector | 5-pass deep inspection via Gemini 3 Flash |
| 10 | **Learning Agent** | Extract actionable WHAT/WHY/HOW learnings from results |
| 11 | Audit Report | Combined JSON report with all results |
| 12 | Summary | Console summary with pass/fail status |

CLI (single):  `npx ts-node scripts/verify-screen.ts 41-8760 --route "/(profile)"`
CLI (batch):   `npx ts-node scripts/verify-screen.ts --screen otp`
CLI (options): `--skip-inspector --skip-maestro --skip-pm --skip-backend`

**Batch-state mode** (`--screen <routeKey>`):
- Loads all states for a screen from `config/screen-routes.json`
- Runs the full 12-step pipeline for each state sequentially
- Auto-extracts missing blueprints via `extract-screen-blueprint.ts`
- Produces per-state audit reports + combined `{screenKey}-batch-audit.json`
- Batch summary shows pass/fail per state with pixel diff, coverage, inspector scores

**Agent auto-execution** (Steps 3, 4, 10):
- **PM Agent** (Step 3): Auto-generates PM briefs from blueprint — extracts functional areas (depth-2 frames), all screen states from routes config, interactive elements (buttons/inputs), and text data fields
- **Backend Agent** (Step 4): Auto-generates backend briefs by scanning screen source code — identifies hooks (useAuth, useDashboard, etc.), services, Supabase calls, and mock data presence
- **Learning Agent** (Step 10): Analyzes verification results, generates WHAT/WHY/HOW findings, writes per-screen learnings to `reports/learnings/{screenId}-learnings.md` for review and promotion to main learnings file

**ODiff Fix (critical)**:
- ODiff produces truncated PNGs for large images without `--reduce-ram-usage`
- Images with different dimensions are resized to match before comparison
- Images larger than 2000px on longest side are scaled proportionally for both baseline and screenshot
- Uses `--parsable-stdout` for reliable output parsing (format: `diffCount;diffPercentage`)

**3.1a File: `buildbot/scripts/prep-for-claude.sh`**

Preprocesses images before Claude Code views them to avoid API "Could not process image" errors:
- Resizes to max 1568px on longest side (Claude API optimal)
- Validates image integrity with `magick identify` (detects corrupt PNGs)
- Ensures minimum 200px on any edge
- Checks file size < 5MB, re-compresses if needed
- Output: `data/claude-ready/{screenId}/` (screenshot.png, baseline.png, diff.png)
- Usage: `cd buildbot && bash scripts/prep-for-claude.sh [screenId]`

**3.2 File: `buildbot/scripts/inspector-flash.ts` (~400 lines)**

Gemini 3 Flash deep visual inspector. 5-pass protocol:

| Pass | Input | Gemini Prompt Focus | Output |
|------|-------|-------------------|--------|
| 1. Full Screen | App screenshot + Figma screenshot | "List EVERY visible difference" | overallScore, differences[] |
| 2. Component Crops | Cropped pairs per component | "Inspect these 13 properties in detail" | per-component property checks |
| 3. Spacing Ruler | App screenshot + blueprint spacing values | "Measure gaps and compare to Figma values" | spacingMismatches[] |
| 4. Icon/Asset Verify | Cropped icon pairs | "Compare shape, color, size, stroke" | per-asset status |
| 5. State Check | Multiple state screenshots (if applicable) | "Verify state transitions" | per-state results |

Uses Gemini 3 Flash (`gemini-3-flash-preview`) — faster/cheaper than Pro for targeted inspection.

**Critical: High media resolution must be enabled** for all Gemini 3 Flash calls to ensure pixel-level accuracy:
```json
{
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 8192
  },
  "generativeConfig": {
    "mediaResolution": "MEDIA_RESOLUTION_HIGH"
  }
}
```
Without `MEDIA_RESOLUTION_HIGH`, Gemini downscales images and loses fine details (1-2px spacing gaps, thin borders, subtle color differences). This is non-negotiable for pixel-perfect inspection.

**Pixel diff tool: ODiff** (comparison) + **ImageMagick** (preprocessing):

**ODiff** (`odiff-bin`) — high-performance pixel comparison with antialiasing support:
- npm package: `odiff-bin` — native binary, extremely fast (~10x faster than JS-based solutions)
- Built-in antialiasing detection — intelligently ignores antialiased edge pixels
- Output: diff image highlighting mismatched areas in red
- Configurable threshold, diff percentage output, diff mask generation

```bash
# CLI usage with required flags:
npx odiff baseline.png screenshot.png diff.png \
  --antialiasing \
  --threshold 0.1 \
  --reduce-ram-usage \
  --parsable-stdout

# Output (parsable): "diffCount;diffPercentage" (e.g., "2378871;5.16")
# Exit codes: 0=match, 22=pixel-diff, 21=layout-diff
# CRITICAL: --reduce-ram-usage prevents truncated PNG output on large images
# diffPercentage < 3% = PASS for regular screens, < 12% for DottedPattern screens
```

**ImageMagick** — image preprocessing (cropping, resizing, validation):
- Used for Inspector Pass 2 component cropping
- Used for resizing screenshots/baselines to match dimensions before ODiff
- Used for scaling large images (>2000px) proportionally before comparison
- Used for `prep-for-claude.sh` to resize images to Claude API-safe dimensions
- Used for corruption detection (`magick identify` fails on truncated PNGs)

```bash
# Crop component region for Inspector Pass 2
magick {screenshot} -crop {w}x{h}+{x}+{y} +repage {output}

# Resize to match dimensions (force exact dims for ODiff)
magick {screenshot} -resize {width}x{height}! {output}

# Validate image integrity (exits non-zero for corrupt PNGs)
magick identify {image}

# Resize for Claude API (preserve aspect ratio, max 1568px longest side)
magick {image} -resize "1568x1568>" -quality 95 {output}
```

Crop coordinates derived from blueprint node geometry (converted from Figma absolute coords to screen-relative coords).

Output: `buildbot/reports/audits/{screenId}-inspection.json`

Also generates Maestro regression tests: `rn-app/.maestro/buildbot/tests/{screenId}-visual-audit.yaml`

---

### Step 4: Validate on Profile Screen

After Steps 1-3 are built:

1. Run `cd buildbot && npx ts-node scripts/extract-screen-blueprint.ts 41-8760` → verify blueprint JSON
2. Run `npx ts-node scripts/verify-screen.ts 41-8760 --route "/(profile)"` → verify pipeline works
3. Review audit report for Profile screen
4. If issues found, test fix loop manually
5. Record learnings from validation

### Step 5: Delete `autonomous-parity-fixer/`

Once validation passes:
1. Verify all data has been moved to `buildbot/`
2. Delete `autonomous-parity-fixer/` directory
3. Update MEMORY.md to point all paths to `buildbot/`

---

## Parallelization Strategy

These work streams are independent and can run in parallel:

| Stream | Files | Dependencies |
|--------|-------|-------------|
| A: Project Setup + Config Migration | package.json, tsconfig, .env, config/, .gitignore | None |
| B: Script Migration | 7 migrated scripts (check-coverage, gemini-pixel-feedback, etc.) | A (needs config/) |
| C: Data Migration | Move data/ai-enhanced, data/combined, visual-comparison, reports | A (needs dirs) |
| D: Learning System | learnings/, agents/ | None |
| E: Blueprint Extractor | scripts/extract-screen-blueprint.ts | A (needs config/) |
| F: Inspector | scripts/inspector-flash.ts | None |
| G: Verify Orchestrator | scripts/verify-screen.ts | E, F, B must exist |
| H: Maestro Setup | scripts/maestro-run.sh | None |

**Execution order:**
1. Streams A, D, F, H in parallel (no dependencies)
2. Streams B, C, E after A completes
3. Stream G after B+E+F complete
4. Step 4 validation after all complete
5. Step 5 deletion after validation passes

---

## File Size Estimates

| File | Est. Lines | Complexity | Source |
|------|-----------|------------|--------|
| `scripts/extract-screen-blueprint.ts` | ~450 | High | NEW |
| `scripts/inspector-flash.ts` | ~400 | High | NEW |
| `scripts/verify-screen.ts` | ~600 | High | NEW |
| `scripts/maestro-run.sh` | ~15 | Low | NEW |
| `scripts/check-coverage.ts` | ~500 | - | MIGRATED |
| `scripts/gemini-pixel-feedback.ts` | ~800 | - | MIGRATED + enhanced |
| `scripts/batch-coverage.ts` | ~200 | - | MIGRATED |
| `scripts/export-figma-tokens.ts` | ~300 | - | MIGRATED |
| `scripts/apply-figma-fixes.ts` | ~300 | - | MIGRATED |
| `scripts/universal-converter.ts` | ~400 | - | MIGRATED |
| `scripts/auto-heal-parity.sh` | ~200 | - | MIGRATED |
| `scripts/prep-for-claude.sh` | ~147 | Low | NEW |
| `learnings/buildbot-learnings.md` | ~109 | Low | NEW |
| `agents/extractor.md` | ~80 | Low | NEW |
| `agents/builder.md` | ~120 | Medium | NEW |
| `agents/verifier.md` | ~60 | Low | NEW |
| `agents/auditor.md` | ~80 | Low | NEW |
| `agents/inspector.md` | ~80 | Low | NEW |
| `agents/pm-agent.md` | ~475 | Medium | NEW |
| `agents/backend-agent.md` | ~432 | Medium | NEW |
| `agents/learning-agent.md` | ~205 | Medium | NEW |
| `state/buildbot-status.json` | ~5 | Low | NEW |
| `state/session-log.md` | ~89 | Low | NEW |
| `package.json` | ~25 | Low | NEW |
| `tsconfig.json` | ~15 | Low | NEW |
| **Total** | **~5,627** | | |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Figma API rate limiting | Blueprint script fetches fewer endpoints (no per-node screenshots) |
| Gemini 3 Flash not available | Fall back to Gemini 3 Pro; inspector is optional |
| Maestro MCP not working | Test with list_devices first; fall back to CLI wrapper script |
| Blueprint schema too large | Keep nodes[] flat; skip invisible nodes; limit to visible bounds |
| Context window overflow | Each agent gets only its scoped files; file-based handoff; max 40% context per agent |
| Migrated scripts break with new paths | Search-and-replace all `autonomous-parity-fixer` path references |
| Data migration misses files | Verify file counts before/after move |
| ODiff truncated PNGs on large images | Fixed: `--reduce-ram-usage` flag + scale images >2000px before comparison |
| Claude API "Could not process image" | Fixed: `prep-for-claude.sh` resizes to 1568px max + validates integrity |
| Context lost across `/clear` | Fixed: `state/session-log.md` + `state/buildbot-status.json` for persistence |
| PM/Backend briefs missing | Pipeline logs warning and continues — agents are optional but recommended |
| Learnings become stale logs | Learning Agent enforces WHAT/WHY/HOW format, rejects screen-specific entries |

---

## Success Criteria

After this session:
- [x] `buildbot/` directory fully self-contained with all config, scripts, and data
- [x] All 7 migrated scripts run correctly with updated paths
- [x] `extract-screen-blueprint.ts` runs on Profile screen and produces valid blueprint JSON
- [x] Blueprint contains comprehensive properties (typography with spans, gradients, vectors, per-corner radii)
- [x] Learning system files created and seeded (WHAT/WHY/HOW format)
- [x] Agent instruction files created: 8 agents (extractor, builder, verifier, auditor, inspector, pm-agent, backend-agent, learning-agent)
- [x] Maestro wrapper script works
- [x] `verify-screen.ts` 12-step pipeline with PM, Backend, and Learning agents integrated
- [x] `inspector-flash.ts` runs 5-pass inspection with `MEDIA_RESOLUTION_HIGH`
- [ ] Combined audit report generated for Profile screen (re-verification pending)
- [x] `autonomous-parity-fixer/` can be safely deleted
- [x] ODiff fixed: `--reduce-ram-usage` + dimension matching + proportional scaling for large images
- [x] Claude API image errors resolved: `prep-for-claude.sh` preprocesses images to safe dimensions
- [x] Session persistence: `state/session-log.md` tracks progress across `/clear` commands
