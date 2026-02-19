# AutoBot -- Orchestration Guide for Flent Secured

## Context

Flent Secured is a rent payment fintech app built with React Native (Expo SDK 52+, expo-router v4, NativeWind v4, Zustand, Supabase). The Figma file contains **103 screen variants** across 8 user flows. The codebase has **48 route files** and **78+ components** implemented.

AutoBot is the orchestration layer that coordinates screen verification, testing, and certification. **Claude Code drives all work manually.** BuildBot (`buildbot/`) handles pixel-perfect verification. There is no automated story executor -- the human + Claude Code decide what to work on, execute it, and track progress.

---

## 1. Orchestration Model: Claude Code + BuildBot + Maestro

Single orchestration model. No intermediary executors.

```
Human decides what to work on
  |
  v
Claude Code executes (reads AGENTS.md first)
  |
  +-- BuildBot commands (extract, coverage, verify)
  +-- Code implementation (screen builds, fixes)
  +-- Test generation (Jest, Maestro YAML)
  +-- Maestro MCP (screenshots, E2E)
  |
  v
Update state (session-log.md, progress.json, AGENTS.md)
```

### How to Start a Session

1. Read `autobot/state/session-log.md` -- What happened in past sessions?
2. Read `autobot/state/progress.json` -- What screens are done? What is next?
3. Read `autobot/AGENTS.md` -- What do we know? (knowledge + workflow + checklist)
4. Read `autobot/config/execution-order.json` -- Which flow is current?
5. Check the Phase Checklist in AGENTS.md -- Which phase is next for the current flow?
6. Execute the next phase using the Manual Orchestration Workflow in AGENTS.md.
7. Update session-log.md after completing work.

### How to End a Session

1. Update `autobot/state/session-log.md` with what was done and resume instructions
2. Update `autobot/state/progress.json` with screen status changes
3. Update the Phase Checklist in AGENTS.md if phases were completed
4. If new patterns were discovered, add to AGENTS.md with provenance

---

## 2. The Four-Phase Cycle

Every unit of work follows this cycle:

```
PLAN (40%)  -->  WORK (20%)  -->  REVIEW (40%)  -->  LEARN (ongoing)
```

### PLAN (40%)
- Extract the Figma blueprint via `extract-screen-blueprint.ts`
- Read AGENTS.md for accumulated knowledge
- Read PM brief (auto-generated) for functional requirements
- Read Backend brief (auto-generated) for data requirements
- Identify shared components, screen states, DottedPattern shape

### WORK (20%)
- Reuse existing shared components
- Apply design tokens from `src/theme/`
- Use Figma REST API values exclusively
- Build all screen states as prop variations
- Wire to Supabase services and Zustand stores

### REVIEW (40%)
- Static analysis: `tsc --noEmit` + ESLint
- Unit tests: Jest + RNTL
- BuildBot 12-step pipeline
- Fix loop: up to 3 iterations, then BLOCKED
- Regression: re-verify all previously certified screens

### LEARN (ongoing)
- Capture: What was learned? What failed?
- Codify: Write findings into AGENTS.md (from BuildBot learnings only)
- Verify: Check that next build is measurably faster

---

## 3. Directory Structure

```
autobot/
  AGENTS.md                        # Compound knowledge + workflow + phase checklist
  PLAN.md                          # This file (orchestration guide)
  prd/
    master-prd.md                  # High-level product requirements
    flows/
      01-auth-flow.md              # Per-flow PRD (human-readable reference)
      02-otp-flow.md
      03-waitlist-flow.md
      04-agreement-flow.md
      05-setup-flow.md
      06-home-flow.md
      07-payment-flow.md
      08-profile-transactions-flow.md
  solutions/                       # Searchable solution library (tagged by problem type)
    component-recipes/
    figma-interpretation/
    fix-recipes/
    rn-patterns/
  state/
    progress.json                  # Per-screen status: EXTRACTED | COVERAGE_PASS | VERIFIED | CERTIFIED | BLOCKED
    metrics.json                   # Screens verified, tests passing, flows completed
    session-log.md                 # Human-readable session progress (survives /clear)
  config/
    execution-order.json           # Flow priority order
    flow-map.json                  # Figma ID -> route -> flow mapping
  reports/
    screen/                        # Per-screen BuildBot audit reports
    flow/                          # Per-flow summary reports
    regression/                    # Regression test results
    tests/                         # Unit test reports
  scripts/
    lib/
      paths.ts                     # Centralized path constants
      types.ts                     # TypeScript interfaces for all JSON schemas
      utils.ts                     # Shared utilities (log, readJsonSafe, runCommand, etc.)
    bridge-reports.ts              # Bridge BuildBot audits into AutoBot screen summaries
    certify-screen.ts              # CERTIFIED gate: 12-check Definition of Done
    flow-report.ts                 # Flow completion report + health score
    populate-solutions.ts          # Parse learnings into solution library
    regression-check.ts            # Lightweight regression runner for CERTIFIED screens
    maestro-cloud.sh               # Submit Maestro YAML to Maestro Cloud
    resume.sh                      # Session recovery helper
    status.sh                      # Print current progress
  learnings/
    compound-log.md                # Timestamped log of all compound entries
```

### File Purposes

| File | Purpose | Survives /clear |
|------|---------|-----------------|
| `AGENTS.md` | Accumulated knowledge + workflow + phase checklist | Yes |
| `progress.json` | Machine-readable build status per screen | Yes |
| `metrics.json` | Screens verified, tests passing, flows completed | Yes |
| `session-log.md` | Human-readable progress tracker | Yes |
| `compound-log.md` | Timestamped learning entries | Yes |

---

## 4. Verification Infrastructure

### Layer 1: Static Analysis
```bash
npx tsc --noEmit            # Zero type errors
npx eslint . --max-warnings 0  # Zero lint warnings
```

### Layer 2: Unit Tests
```bash
npx jest --passWithNoTests
```
Tests cover: rendering, prop variations, accessibility, press handlers, loading/error/empty states.

### Layer 3: Visual Verification (BuildBot 12-Step Pipeline)

| Step | Action | Tool |
|------|--------|------|
| 1 | Check prerequisites (files, config) | Node.js |
| 2 | Load learnings from previous runs | Node.js |
| 3 | Generate PM brief from blueprint | AI agent |
| 4 | Generate Backend brief from source scan | AI agent |
| 5 | Capture app screenshot | Maestro |
| 6 | Pixel diff against Figma baseline | ODiff |
| 7 | Property coverage check | Node.js |
| 8 | Visual audit (Gemini Pro) | Gemini API |
| 9 | Deep inspection (Gemini Flash 5-pass) | Gemini API |
| 10 | Extract learnings | Learning agent |
| 11 | Generate audit report | Node.js |
| 12 | Summary with pass/fail | Node.js |

### Layer 4: Regression
After every certification, re-verify all previously certified screens.

### Layer 5: Flow Tests (Maestro E2E)
After all screens in a flow are certified, run end-to-end flow tests via Maestro.

### Layer 4 & 5 Infrastructure (Certification Scripts)

Six scripts in `autobot/scripts/` implement Layers 4-5 and the certification pipeline:

#### `bridge-reports.ts` — Bridge BuildBot → AutoBot
```bash
cd autobot && npx ts-node scripts/bridge-reports.ts <screenId>   # single screen
cd autobot && npx ts-node scripts/bridge-reports.ts --all        # all screens
```
Reads BuildBot audit reports + unit test reports + progress.json, combines into unified `ScreenSummary` at `autobot/reports/screen/{id}-summary.json`.

#### `populate-solutions.ts` — Generate Solution Library
```bash
cd autobot && npx ts-node scripts/populate-solutions.ts
```
Parses `buildbot/learnings/buildbot-learnings.md` into categorized .md files in `solutions/`. Also scans audit reports for recurring failures. Generates `solutions/INDEX.md`.

#### `regression-check.ts` — Layer 4 Regression Runner
```bash
cd autobot && npx ts-node scripts/regression-check.ts
```
Runs `tsc --noEmit` + `jest` globally, then per-CERTIFIED-screen checks coverage and git change detection. Exits 0 if all pass, 1 if any fail. No API calls.

#### `certify-screen.ts` — CERTIFIED Gate (12 checks)
```bash
cd autobot && npx ts-node scripts/certify-screen.ts <figmaId>         # single
cd autobot && npx ts-node scripts/certify-screen.ts --screen <key>    # batch
```
Checks: blueprint exists, all states audited, shared components used, tsc passes, unit tests pass, audit passed, pixel diff passed, coverage >= 95%, Gemini clean, regression passes, learnings exist, progress updated. Promotes VERIFIED → CERTIFIED on all-pass.

#### `flow-report.ts` — Layer 5 Flow Completion
```bash
cd autobot && npx ts-node scripts/flow-report.ts <flowId>
```
Requires all screens in flow to be CERTIFIED. Aggregates pixel diff, coverage, inspector scores, test pass rate. Calculates health score. Updates execution-order.json and metrics.json.

#### `maestro-cloud.sh` — Cloud E2E Submission
```bash
cd autobot && bash scripts/maestro-cloud.sh <flow-name-or-yaml>
```
Resolves flow name to YAML, submits to Maestro Cloud, writes result to `autobot/reports/flow/{name}-cloud.json`.

### Fix Loop Protocol
1. Parse failure reason from BuildBot report
2. Search AGENTS.md and solutions/ for known fixes
3. Apply fix
4. Re-run verification
5. If 3 iterations fail, mark BLOCKED

### Pixel Diff Thresholds

| Screen Type | Threshold | Reason |
|-------------|-----------|--------|
| Standard | 3% | Normal tolerance |
| DottedPattern | 12% | Inherent rendering variance |
| Dynamic data | 8% | Text content varies |
| DottedPattern + Dynamic | 18% | Combined variance |

---

## 5. Execution Order

Flows ordered by user journey priority. Earlier flows establish patterns for later ones.

### Flow 1: Auth (4 screens, 7 states) -- VERIFIED
Splash, Beta Splash, Carousel (3 slides), Sign-Up (empty).
Establishes DottedPattern, Logo, PrimaryButton, PhoneInput patterns.

### Flow 2: OTP (1 screen, 4 states) -- COVERAGE PASS
OTP verification with empty, filled, wrong-code, max-attempts states.
Introduces OTPInput component and error state patterns.

### Flow 3: Waitlist (1 screen, 6 states) -- EXTRACTED
Waitlist pending, submitted, approved, position variants.

### Flow 4: Agreement (2 screens, 7 states)
Upload (5 states) and review (2 states).
Introduces FileUpload, DocumentUploadCard, multi-state patterns.

### Flow 5: Setup (3 screens, 6 states)
Setup index, add-bank, invite-landlord.

### Flow 6: Home Dashboard (2 screen groups, 9+ states)
Most complex screen. Empty states and active states.

### Flow 7: Payment (8 screens, 17 states)
Select method, add UPI/card/netbanking, processing, success, failed.

### Flow 8: Profile + Transactions (2 screen groups, 8 states)
Profile views, edit, payment methods, transaction list/detail.

---

## 6. Context Management

### When Using Parallel Agents

Full specification lives in AGENTS.md "Context Management Rules" section.

Key points:
- Max 3 concurrent agents per wave
- Agents write ALL work to filesystem, return <=500 char summary
- Checkpoint between waves
- At 70%+ context: stop cleanly, update session-log.md

### Session Continuity

On session start, read these files IN ORDER:
1. `autobot/state/session-log.md` -- What happened in past sessions?
2. `autobot/state/progress.json` -- What is done / what is next?
3. `autobot/AGENTS.md` -- What do we know?
4. `autobot/config/execution-order.json` -- Which flow is current?

---

## 7. Learning Sync

### BuildBot Learnings Are Canonical
```
buildbot/learnings/buildbot-learnings.md   <-- WRITES (Learning Agent after each verify)
         |
         | Read this before updating AGENTS.md
         v
autobot/AGENTS.md                          <-- WRITES (only from buildbot learnings)
```

### Rules
1. Always read BuildBot learnings before adding to AGENTS.md
2. Never generate learnings from AI analysis alone
3. Every AGENTS.md entry has provenance: `(source: buildbot-learning YYYY-MM-DD)`
4. Remove entries that BuildBot has contradicted
5. Log provenance in `autobot/learnings/compound-log.md`

---

## 8. Definition of Done

A screen is **CERTIFIED** when:
- [ ] Figma blueprint extracted and validated
- [ ] All screen states implemented
- [ ] Shared components reused (no per-screen rebuilds)
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Unit tests pass (Jest + RNTL)
- [ ] BuildBot 12-step pipeline passes
- [ ] Pixel diff within threshold for screen type
- [ ] Property coverage > 95%
- [ ] Gemini visual audit passes
- [ ] Regression on all certified screens passes
- [ ] Learnings captured (AGENTS.md updated)
- [ ] progress.json updated to CERTIFIED

A flow is **COMPLETE** when:
- [ ] All screens in the flow are certified
- [ ] Maestro E2E flow test passes
- [ ] Flow summary report generated

---

## 9. Quality Rules

- Blueprint values are absolute truth -- no AI guesswork
- Max 3 fix loop iterations, then BLOCKED
- Test failures don't block visual certification (track independently)
- 50/50 rule: balance feature work with system improvement
- Every 5-10 certifications, run a system improvement pass
