# AutoBot Compound Learning Log

Append-only. Each entry: iteration → learning → codified where.

---

## 2026-02-15 — Bootstrap
- Seeded AGENTS.md from BuildBot learnings (25+ entries)
- Sources: buildbot/learnings/buildbot-learnings.md, MEMORY.md
- Codified in: autobot/AGENTS.md (all sections)

## 2026-02-15 — Context Management System (Session 1 Post-Mortem)
- **Root cause**: 6+ extraction agents returned ~50K each, overflowing orchestrator context
- **Solution**: Three-tier information architecture
  - Tier 1: Agent returns ≤500 chars inline (status + file paths + flags)
  - Tier 2: Summary JSON on disk (~2-5K, read only when routing decisions)
  - Tier 3: Raw data on disk (unlimited, read only when actively working)
- **Execution**: Max 3 agents per wave, checkpoint between waves, graceful stop at 70% context
- **Session continuity**: remaining-work.json for interrupted sessions
- **Single source of truth**: autobot/AGENTS.md "Context Management System" section
- **Source**: Direct observation of session death

## 2026-02-15 — Learning Sync Architecture
- **Problem**: BuildBot learnings and AGENTS.md can drift with two independent write paths
- **Fix**: BuildBot canonical → COMPOUND reads it → propagates to AGENTS.md
- **Codified in**: autobot/PLAN.md Section 17, autobot/AGENTS.md (Learning Sync Rules)

## 2026-02-15 — Testing Infrastructure Bootstrap (Session 2)
- **Gap identified**: No testing agent team, no integration/backend/performance tests, no Maestro Cloud pipeline, no testIDs on builder output
- **Solution**: Three-layer testing architecture
  - Layer 1: Unit tests (Jest + RNTL) — screen render, text content, navigation, loading/error/empty states
  - Layer 2: Integration tests (Jest + MSW) — hook→service→API chain verification at network level
  - Layer 3: E2E tests (Maestro) — screen state tests, flow E2E, regression
- **testID Convention**: Mandatory for all builders — `{screenName}-{purpose}-{type}` pattern
- **Pipeline expansion**: 12→15 steps (added unit test, integration test, Maestro state test between existing steps)
- **Test stories**: 78 new stories across 8 flow PRDs + 6 backend-validation + 7 app-production = 91 new stories
- **Test health checks**: Automated gating rules in PLAN.md (e.g., unit pass rate < 95% blocks new builds)
- **Key principle**: Test failures don't block visual certification — track visualStatus and testStatus independently
- **Codified in**:
  - buildbot/agents/test-agent.md (test generation rules)
  - buildbot/agents/maestro-agent.md (E2E test rules)
  - buildbot/agents/builder.md (testID convention section)
  - autobot/AGENTS.md (Testing Patterns section)
  - autobot/PLAN.md (15-step pipeline + health checks)
  - autobot/prd/flows/09-backend-validation-prd.json
  - autobot/prd/flows/10-app-production-prd.json
  - autobot/state/test-dashboard.json
  - autobot/state/metrics.json (testing + production_readiness)
  - rn-app/jest.config.js (coverage includes app/**)
