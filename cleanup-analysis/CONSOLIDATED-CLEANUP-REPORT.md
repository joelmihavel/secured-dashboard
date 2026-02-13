# Consolidated Cleanup Report — Parity System & Codebase Audit

**Date:** 2026-02-13
**Scope:** Full codebase analysis of Secured v2 React Native project
**Goal:** Identify stale code, data, and scripts for removal; consolidate parity system

---

## Executive Summary

The project has **3 generations of parity tooling** layered on top of each other, plus stale artifacts from an abandoned iOS/SwiftUI build. The React Native app itself (rn-app/) is clean and well-organized — the bloat is in the tooling and data directories surrounding it.

**Reclaimable disk space: ~300MB**
**Files to delete: ~150+**
**Stale scripts to remove: 12**
**Stale directories to remove: 7**

---

## Current App Status (Healthy)

| Metric | Value |
|--------|-------|
| Routes | 45 across 9 route groups |
| Components | 78 (all actively used) |
| Assets | 23 (all referenced) |
| Design tokens | 95+ colors, 25+ typography variants |
| State management | Zustand + React Query |
| Backend | Supabase (auth, DB, edge functions) |
| Test coverage | Minimal (2 component tests) |
| Parity status | 8/16 screens PASSING in auto-heal |

---

## The Three Parity Generations

### Gen 1: Root `scripts/` + `docs/*.json` (Jan 29-31) — FULLY STALE
Manual ImageMagick pixel comparison scripts and batch Figma analysis JSON exports. Predates all automation.

**Files:**
- `scripts/pixel-compare.sh` — manual single-screen pixel diff
- `scripts/batch-pixel-compare.sh` — batch wrapper for above
- `scripts/fetch-batch4-screenshots.sh` — one-off Figma screenshot fetcher
- `scripts/setup-gcp-workload-identity.sh` — GCP CI/CD setup (never used in RN)
- `docs/figma-analysis-batch2-home-payment.json` — old batch analysis
- `docs/figma-analysis-batch4.json` — old batch analysis
- `docs/figma-screens-analysis.json` — old screen metadata
- `docs/figma-screens-verification.json` — old verification data

**Verdict: DELETE ALL** — Superseded by Gen 2 and Gen 3.

---

### Gen 2: `autonomous-parity-fixer/` (Feb 2-5) — PARTIALLY ACTIVE
AI-powered extraction + coverage checking + Gemini visual feedback pipeline. The core extraction and coverage scripts are actively used; the orchestration/pipeline scripts are stale.

**KEEP (active core):**
| Script | Purpose |
|--------|---------|
| `extract-figma-ai-enhanced.ts` | Figma REST API data extraction |
| `check-coverage.ts` | Deterministic property coverage checker |
| `universal-converter.ts` | Combines local + MCP data |
| `gemini-pixel-feedback.ts` | 4-batch Gemini visual analysis |
| `batch-coverage.ts` | Batch coverage runner |
| `export-figma-tokens.ts` | Design token generator |
| `apply-figma-fixes.ts` | Applies deterministic fixes |

**DELETE (stale/superseded):**
| Script | Why |
|--------|-----|
| `full-pipeline.ts` | v1, hardcodes FlentApp/ path (WRONG) |
| `full-pipeline-v2.ts` | Never fully operational, superseded by manual orchestration |
| `autonomous-pipeline.ts` | Complex state machine, never completed |
| `orchestrator.ts` | Legacy orchestrator, superseded |
| `full-orchestrator.ts` | Another orchestrator variant, unused |
| `combined-figma-converter.ts` | Precursor to universal-converter |
| `achieve-parity.ts` | Feedback loop script, not independently used |
| `auto-implement-screen.ts` | Auto-gen screens, not used after initial pass |
| `process-design.ts` | Minimal, absorbed into other scripts |
| `state-manager.ts` | Only used by deleted orchestrator |
| `checkpoint-manager.ts` | Only used by deleted orchestrator |

**DELETE (stale config):**
| File | Why |
|------|-----|
| `config/subagent-prompts.json` | Multi-agent templates, never used |
| `config/screens-to-process.json` | Replaced by dynamic config |
| `config/component-templates/` | Never referenced |
| `config/figma-variables-raw.json` | One-time export, stale |

**DELETE (stale data/artifacts):**
| Directory | Size | Why |
|-----------|------|-----|
| `state/` | 68KB | Old orchestrator checkpoints |
| `logs/` | 32KB | Old orchestrator logs |
| `analysis/pixel-feedback/` | 764KB | Old Gemini feedback (can regenerate) |
| `output/` | 8.1MB | Generated component code (one-off, not used) |
| `reports/pipeline-results.json` | — | Empty/minimal |
| `reports/parity-status.json` | — | Stale (shows 30% avg, inconsistent with reality) |
| `reports/batch-coverage-results.json` | — | Old batch run |

**KEEP (active data):**
| Directory | Size | Why |
|-----------|------|-----|
| `data/ai-enhanced/` | ~100MB | 66 screen extractions (source of truth) |
| `data/combined/` | ~60MB | 104 style maps (used by converters) |
| `reports/coverage/*.json` | ~500KB | Active coverage reports (Feb 10) |
| `config/figma.json` | — | API config (active) |
| `config/design-tokens.json` | — | Token mappings (active) |
| `config/screen-routes.json` | — | Screen mapping (active) |
| `config/orchestrator-config.json` | — | Gate thresholds (reference) |
| `README.md` | — | System documentation |
| `ORCHESTRATION.md` | — | Pipeline protocol |

---

### Gen 3: `rn-app/scripts/auto-heal-parity.sh` + `rn-app/figma/` (Feb 10-11) — FULLY ACTIVE
Automated ImageMagick-based comparison: downloads Figma baselines, captures simulator screenshots, compares with per-screen thresholds, generates report.

**KEEP (all active):**
- `rn-app/scripts/auto-heal-parity.sh` — the current parity validation backbone
- `rn-app/figma/baselines/` — 18 Figma baseline PNGs
- `rn-app/figma/screenshots/` — latest captures + diffs
- `rn-app/figma/thumbnails/` — thumbnails for API analysis
- `rn-app/figma/parity-report.md` — current status (needs update to 16 screens)

**DELETE (stale rn-app scripts):**
| Script | Why |
|--------|-----|
| `rn-app/scripts/capture-full-page.ts` | References old `figma-parity/` path, superseded |
| `rn-app/scripts/capture-fullpage.sh` | Wrapper for above, also stale |
| `rn-app/scripts/compare-ui-figma.ts` | Hardcoded specs, incomplete, superseded |

---

## Non-Parity Stale Items

### `.serena/` — iOS-Era Artifacts
| File | Why Delete |
|------|-----------|
| `.serena/memories/progress-checkpoint-1.md` | iOS/SwiftUI session, obsolete |
| `.serena/memories/progress-checkpoint-2.md` | iOS/SwiftUI session, obsolete |
| `.serena/memories/progress-report-batch2.md` | iOS batch progress, obsolete |
| `.serena/memories/assumptions-to-test.md` | iOS testing assumptions, obsolete |
| `.serena/memories/deployment-config.md` | iOS deployment config, obsolete |
| `.serena/project.yml` | Configured for Swift, should be TypeScript |

**Action:** Delete all memory files. Update or delete `project.yml`.

### `.playwright-mcp/` — One-Off Screenshots
8 PNG screenshots from Claude Code exploration sessions. ~296KB.
**Action:** DELETE entire directory.

### `.sauce/` — Legacy iOS Testing Config
Sauce Labs XCUITest + web visual configs for iOS app that no longer exists.
**Action:** DELETE entire directory.

### `scratchpad/` — Empty Dev Workspace
Contains only empty `figma_screens/` subdirectory.
**Action:** DELETE entire directory.

### `tests/visual/` — Non-Functional Test Scaffolding
WebdriverIO + Appium + Sauce Labs test suite. Tests reference accessibility IDs and mock launch arguments that don't exist in the RN app. **280MB of node_modules** for tests that can't run.
**Action:** DELETE `node_modules/` immediately (280MB). Archive or delete test specs for future reference.

### `.github/workflows/ci-ios.yml` — Legacy iOS CI
References iOS/.xcodeproj, SwiftLint, XCUITest — none of which exist anymore.
**Action:** DELETE — replaced by RN-specific CI when needed.

### Root-Level Docs — Stale
| File | Action |
|------|--------|
| `README.md` | Empty stub — DELETE |
| `parity-plan-v2.md` | Outdated, superseded by `docs/figma-parity-v2-plan.md` — DELETE |
| `figma-parity-cross-reference-report.md` | One-time verification, outdated — DELETE |
| `docs/gemini-figma-implementation-prompt.md` | Old pipeline prompt — DELETE |
| `docs/REACT_NATIVE_REFACTORING_PLAN.md` | Migration completed — DELETE |

### rn-app Dead Code
| File | Why |
|------|-----|
| `rn-app/src/providers/AuthProvider.tsx` | Never imported by any file. Orphaned. |
| `rn-app/app/(main)/home-pixel-perfect.tsx` | Duplicate of `index.tsx` (if confirmed unused) |
| `rn-app/src/components/ui/Card/` | Empty directory |
| `rn-app/src/components/ui/Feedback/` | Empty directory |
| `rn-app/src/components/composed/home/` | Empty directory |
| `rn-app/src/components/composed/payment/` | Empty directory |
| `rn-app/src/constants/` | Empty directory |
| `rn-app/src/utils/formatters/` | Empty directory |
| `rn-app/src/utils/validators/` | Empty directory |

---

## Consolidated Parity System (Post-Cleanup)

After cleanup, the parity system will be:

```
ACTIVE PARITY TOOLING
├── autonomous-parity-fixer/          (Figma data extraction & analysis)
│   ├── scripts/
│   │   ├── extract-figma-ai-enhanced.ts   ← Extract Figma node data
│   │   ├── check-coverage.ts              ← Deterministic coverage check
│   │   ├── universal-converter.ts         ← Convert to style maps
│   │   ├── gemini-pixel-feedback.ts       ← AI visual feedback
│   │   ├── batch-coverage.ts              ← Batch runner
│   │   ├── export-figma-tokens.ts         ← Design token generation
│   │   └── apply-figma-fixes.ts           ← Apply fixes from gaps
│   ├── config/
│   │   ├── figma.json                     ← API config
│   │   ├── design-tokens.json             ← Token mappings
│   │   ├── screen-routes.json             ← Screen → route map
│   │   └── orchestrator-config.json       ← Gate thresholds
│   ├── data/
│   │   ├── ai-enhanced/                   ← 66 screen extractions
│   │   └── combined/                      ← 104 style maps
│   ├── reports/coverage/                  ← Active coverage reports
│   ├── README.md
│   └── ORCHESTRATION.md
│
├── rn-app/scripts/auto-heal-parity.sh    (Automated visual comparison)
├── rn-app/figma/                          (Baselines, screenshots, diffs)
│
└── docs/figma-parity-v2-plan.md          (Operational plan & screen list)
```

**Workflow:**
1. `extract-figma-ai-enhanced.ts` → pulls Figma data for a screen
2. `universal-converter.ts` → converts to style maps
3. Developer applies fixes manually (or with `apply-figma-fixes.ts`)
4. `check-coverage.ts` → verifies deterministic property coverage (≥95%)
5. `auto-heal-parity.sh` → visual screenshot comparison (≥92% match)
6. `gemini-pixel-feedback.ts` → AI visual feedback for remaining gaps

---

## Disk Space Impact

| What | Size | Action |
|------|------|--------|
| `tests/visual/node_modules/` | 280MB | DELETE |
| `autonomous-parity-fixer/output/` | 8.1MB | DELETE |
| `autonomous-parity-fixer/analysis/` | 764KB | DELETE |
| `autonomous-parity-fixer/state/` | 68KB | DELETE |
| `autonomous-parity-fixer/logs/` | 32KB | DELETE |
| `.playwright-mcp/` | 296KB | DELETE |
| `.sauce/` | 8KB | DELETE |
| `scratchpad/` | 0KB | DELETE |
| Root scripts/ | 23KB | DELETE |
| Stale docs/JSON | ~200KB | DELETE |
| **TOTAL RECLAIMABLE** | **~290MB** | |

---

## Action Plan (Ordered)

### Phase 1: Safe Deletions (zero risk)
- Delete empty directories in rn-app/src/
- Delete `.playwright-mcp/`
- Delete `scratchpad/`
- Delete `.serena/memories/*.md`
- Delete `tests/visual/node_modules/`

### Phase 2: Stale Artifact Removal (low risk)
- Delete root `scripts/` directory (4 old scripts)
- Delete `.sauce/` directory
- Delete root markdown files (`parity-plan-v2.md`, `figma-parity-cross-reference-report.md`, `README.md`)
- Delete `docs/*.json` batch analysis files
- Delete `docs/gemini-figma-implementation-prompt.md`
- Delete `docs/REACT_NATIVE_REFACTORING_PLAN.md`
- Delete `.github/workflows/ci-ios.yml`

### Phase 3: Parity Fixer Cleanup (medium risk — verify no active use first)
- Delete 11 stale scripts from `autonomous-parity-fixer/scripts/`
- Delete 4 stale config files from `autonomous-parity-fixer/config/`
- Delete `autonomous-parity-fixer/{state,logs,analysis,output}/`
- Delete stale reports from `autonomous-parity-fixer/reports/`

### Phase 4: App Code Cleanup (verify imports first)
- Delete `rn-app/scripts/capture-full-page.ts`
- Delete `rn-app/scripts/capture-fullpage.sh`
- Delete `rn-app/scripts/compare-ui-figma.ts`
- Delete `rn-app/src/providers/AuthProvider.tsx`
- Verify and potentially delete `rn-app/app/(main)/home-pixel-perfect.tsx`
