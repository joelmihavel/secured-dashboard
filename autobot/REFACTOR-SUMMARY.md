# AutoBot Refactor Summary

**Date**: 2026-02-15
**Goal**: Remove Ralph (unused sequential story executor), streamline for Claude Code manual orchestration.

---

## Files Deleted

### Ralph (sequential story executor)
| Path | Description |
|------|-------------|
| `scripts/ralph/ralph.sh` | Ralph execution script |
| `scripts/ralph/CLAUDE.md` | Ralph prompt template |
| `scripts/ralph/` (directory) | Entire Ralph directory |
| `scripts/` (directory, now empty) | Parent directory removed |

### PRD story files (Ralph format -- not used for execution)
| Path | Description |
|------|-------------|
| `autobot/prd/flows/01-auth-prd.json` | 36 stories |
| `autobot/prd/flows/02-otp-prd.json` | 20 stories |
| `autobot/prd/flows/03-waitlist-prd.json` | 28 stories |
| `autobot/prd/flows/04-agreement-prd.json` | 32 stories |
| `autobot/prd/flows/05-setup-prd.json` | 28 stories |
| `autobot/prd/flows/06-home-prd.json` | 40 stories |
| `autobot/prd/flows/07-payment-prd.json` | 58 stories |
| `autobot/prd/flows/08-profile-transactions-prd.json` | 36 stories |
| `autobot/prd/flows/09-backend-validation-prd.json` | 6 stories |
| `autobot/prd/flows/10-app-production-prd.json` | 7 stories |
| `prd.json` (project root) | Active Ralph queue (copy of auth flow) |

### State files (unused)
| Path | Description |
|------|-------------|
| `autobot/state/test-dashboard.json` | Test health dashboard (never actively used) |

### One-time prompts
| Path | Description |
|------|-------------|
| `autobot/PROMPT-FILL-GAPS.md` | One-time generation prompt for testing infrastructure |

---

## Files Preserved (unchanged)

### PRD reference docs
- `autobot/prd/master-prd.md` -- High-level product requirements
- `autobot/prd/flows/01-auth-flow.md` through `08-profile-transactions-flow.md` -- Per-flow human-readable PRDs

### State
- `autobot/state/session-log.md` -- Session history (appended to, not replaced)
- `autobot/state/progress.json` -- Per-screen status (unchanged)

### Config
- `autobot/config/flow-map.json` -- Figma ID to route mapping (unchanged)

### Learnings
- `autobot/learnings/compound-log.md` -- Timestamped learning log (unchanged)

### Solutions
- `autobot/solutions/` -- All subdirectories preserved (component-recipes, figma-interpretation, fix-recipes, rn-patterns)

### Reports
- `autobot/reports/` -- All subdirectories preserved (flow, regression, screen, tests)

### BuildBot (entirely untouched)
- `buildbot/` -- All scripts, agents, configs, data, state preserved as-is

---

## Files Refactored

### autobot/AGENTS.md (compound knowledge base)
**Removed:**
- "Compound Knowledge Flywheel" framing (Ralph-oriented)
- "Compound Status" section (Ralph metrics)
- Ralph-specific decision log entries ("Use snarktank/ralph...")
- "50/50 rule" reference in decisions (kept in PLAN.md)

**Added:**
- "Manual Orchestration Workflow" -- 10-phase workflow describing the actual process from extraction to backend verification, with exact commands for each phase
- "Phase Checklist by Flow" -- Table tracking which of the 10 phases is complete for each of the 8 flows
- "Current Progress" -- Quick-reference summary at top

**Preserved (all technical knowledge intact):**
- Figma Interpretation Gotchas (8 rules)
- React Native Patterns That Work (5 patterns)
- Patterns That Failed (4 entries)
- Data and State Patterns (3 rules)
- Context Management Rules (three-tier system, execution rules, agent output contract)
- Learning Sync Rules
- Pipeline Rules (6 rules)
- Testing Patterns (naming, testID, data chain, unit layers, Maestro, MSW)
- Component Reference table
- Design Tokens (colors, typography, spacing)

### autobot/PLAN.md (orchestration guide)
**Rewritten from scratch.** Went from 1018 lines to ~298 lines.

**Removed:**
- Section 2: System Architecture diagram (showed Ralph Loop)
- Section 5: PRD Architecture (prd.json format, story structure)
- Section 9: Ralph Loop (setup, CLAUDE.md template, execution commands, per-flow execution)
- Section 14: Files to Create (bootstrap checklist -- already done)
- Section 16: Claude Code Teams Integration (hybrid model, team agent types, coordination rules, examples)
- Section 17: Learning Sync detailed specification (moved essentials to Section 7)
- Test health checks table (test-dashboard.json removed)
- Expanded 15-step pipeline (reverted to actual 12-step)

**Added:**
- Section 1: Orchestration Model -- Claude Code + BuildBot + Maestro (single model)
- "How to Start a Session" / "How to End a Session" checklists

**Preserved:**
- Four-Phase Cycle (PLAN/WORK/REVIEW/LEARN)
- Directory Structure (updated to reflect deletions)
- Verification Infrastructure (layers 1-5, fix loop, pixel thresholds)
- Execution Order (all 8 flows with status)
- Context Management (streamlined)
- Learning Sync (essential rules)
- Definition of Done (screen + flow)
- Quality Rules

### autobot/scripts/resume.sh
- Removed Ralph/prd.json status section
- Updated resume instructions to point to AGENTS.md workflow
- Added verified/coverage_pass/blocked status counts
- Fixed RN_APP_DIR path (now correctly points to rn-app/)

### autobot/state/metrics.json
- Simplified from complex nested structure (sessions, compound_indicators, testing, production_readiness) to flat structure
- Now tracks: screens_verified, screens_coverage_pass, screens_extracted, screens_total, tests_passing, unit_tests, maestro_yamls, flows_completed, flows_total, velocity_trend

### autobot/config/execution-order.json
- Removed `branch`, `estimatedStories` fields (Ralph-specific)
- Removed tracks 9 (backend-validation) and 10 (app-production) -- these were Ralph story tracks
- Updated flow statuses to reflect current state (auth=verified, otp=coverage-pass, waitlist=extracted)

### autobot/state/session-log.md
- Appended Session 5 documenting the refactor
- Includes current progress snapshot and resume instructions

---

## What the Refactored System Looks Like

```
autobot/
  AGENTS.md           # Knowledge base + 10-phase workflow + phase checklist per flow
  PLAN.md             # Orchestration guide (how to use the system)
  REFACTOR-SUMMARY.md # This file
  prd/
    master-prd.md     # Product reference
    flows/*.md        # Per-flow product reference (8 files)
  state/
    session-log.md    # Session history (append-only)
    progress.json     # Per-screen machine-readable status
    metrics.json      # Simple metrics (screens, tests, flows)
  config/
    execution-order.json  # Which flow to work on next
    flow-map.json         # Figma ID -> route -> flow mapping
  scripts/
    resume.sh         # Quick session resume helper
    status.sh         # Print current status
  solutions/          # Tagged solution library (4 subdirs)
  reports/            # BuildBot audit reports + test reports
  learnings/
    compound-log.md   # Timestamped learning entries
```

## How to Use the Refactored System

1. **Know where we are**: Read `session-log.md` + check Phase Checklist in `AGENTS.md`
2. **Know what to do next**: Check `execution-order.json` for current flow, then Phase Checklist for next incomplete phase
3. **Execute the work**: Follow the Manual Orchestration Workflow in AGENTS.md (10 phases with exact commands)
4. **Track progress**: Update `session-log.md` after each session, update `progress.json` per screen, update Phase Checklist per flow
