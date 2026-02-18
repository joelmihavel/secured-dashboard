# AutoBot Orchestrator Playbook

Read this document at the start of every session. It defines the complete execution protocol
for building Flent Secured v2 -- a rent payment fintech app for the Indian market.

**Stack**: Expo SDK 52 | React Native 0.76.9 | NativeWind 4 | Supabase | Zustand 5 | React Query 5
**Repository root**: `/Users/atrishabh/Documents/Dev/workspaces/Secured v2-react-native project/montpellier`
**Branch convention**: `atrishabh/<feature-name>`

---

## 1. Prerequisites Checklist

Run these checks before any work begins. Do not proceed if any check fails.

### 1.1 Environment Verification

```bash
# Verify node_modules are installed
cd rn-app && npm install
cd buildbot && npm install

# Verify TypeScript compiles cleanly
cd rn-app && npx tsc --noEmit

# Verify iOS simulator is available
xcrun simctl list devices available | grep "iPhone 17 Pro"
```

### 1.2 iOS Simulator Boot

```bash
# Boot the target simulator
xcrun simctl boot "iPhone 17 Pro"

# Verify it is booted
xcrun simctl list devices booted
```

### 1.3 Expo Dev Server

```bash
# Start the Expo dev server targeting iOS
cd rn-app && npx expo start --ios
```

The dev server must be running for BuildBot screenshot capture and visual verification.

### 1.4 Tool Availability

| Tool | Check Command | Install If Missing |
|------|--------------|-------------------|
| Node.js | `node --version` | Required (>= 18) |
| npm | `npm --version` | Bundled with Node |
| Expo CLI | `npx expo --version` | `npm i -g expo-cli` |
| BuildBot deps | `ls buildbot/node_modules` | `cd buildbot && npm install` |
| Supabase CLI | `supabase --version` | `brew install supabase/tap/supabase` |
| Deno | `deno --version` | `brew install deno` (backend track only) |
| ODiff | `ls buildbot/node_modules/odiff-bin` | `cd buildbot && npm install` |

### 1.5 Pre-Flight Gate

Before executing any story, run the gate script:

```bash
bash autobot/gate.sh <storyId>
```

This validates: dependencies are met, node_modules exist, blueprints are valid (for UI track),
and the CLI tools for the story's track are available.

---

## 2. Session Resume Protocol

Every new Claude Code session begins with this sequence. Execute these steps in order.

### Step 1: Load Accumulated Knowledge

```bash
cat autobot/progress.txt
```

Read the entire file. The "Codebase Patterns" section contains hard-won learnings about font
mapping, line heights, DottedPattern thresholds, screen padding, card patterns, ODiff best
practices, and Figma extraction rules. The "Session Log" section shows what was accomplished
in prior sessions.

### Step 2: Load Conventions

```bash
cat autobot/AGENTS.md
```

This is the canonical source of truth for all conventions. Every subagent must receive the
relevant sections from this file in their prompt.

### Step 3: Find Next Eligible Flow

```bash
node autobot/pick-flow.js
```

Returns JSON of the highest-priority flow with remaining work and satisfied dependencies.
Output includes `progress.total`, `progress.passing`, and `progress.remaining`.

If no output is returned, all flows are complete or blocked.

### Step 4: Check Overall Progress

```bash
node autobot/count-remaining.js
node autobot/count-remaining.js --track ui
node autobot/count-remaining.js --track backend
node autobot/count-remaining.js --track state
```

### Step 5: Review Recent Commits

```bash
git log --oneline -10
```

Check for recent work that may affect the current session. Look for screens that were
recently modified and may need regression testing.

### Step 6: Pick First Story

```bash
node autobot/pick-story.js --flow <flowId>
```

Where `<flowId>` is the flow ID from Step 3. Returns the first eligible story within that flow.

### Step 7: Run Regression Check (if resuming mid-flow)

```bash
bash autobot/check-regression.sh
```

Verifies all previously-passing UI screens still pass. If regressions are detected, fix them
before starting new work.

---

## 3. Per-Screen Execution Steps

Each screen follows a strict pipeline: Gate, Build, Verify, Fix Loop, Quality Review, Test,
Compound, Commit, Report. Never skip steps.

### Step 1: Gate

```bash
bash autobot/gate.sh <storyId>
```

If the gate fails, resolve the blocking issue before proceeding. Common blockers:
- Missing dependency story (build it first or re-prioritize)
- Missing node_modules (run `npm install`)
- Invalid blueprints (re-extract from Figma)

### Step 2: Build (Parallel Subagents)

For UI screens, spawn a **UI Builder** subagent (see Section 6.1) with the blueprint JSON,
relevant progress.txt entries, and AGENTS.md conventions.

For backend work, spawn a **Backend Builder** subagent (see Section 6.3).
For state management, spawn a **State Builder** subagent (see Section 6.4).

Parallel builds are permitted when stories have no dependency relationship. Maximum 5
concurrent subagents per batch.

### Step 3: Verify (Orchestrator)

After the subagent completes, the orchestrator runs verification:

```bash
# For UI screens -- three-stage verification
bash autobot/verify/ui-extract.sh <routeKey>     # Blueprint exists and is valid
bash autobot/verify/ui-build.sh <routeKey>        # Screen file exists, tsc passes
bash autobot/verify/ui-verify.sh <routeKey>       # BuildBot pipeline (ODiff + Gemini + Inspector)

# For backend functions
bash autobot/verify/backend-impl.sh <functionName>
bash autobot/verify/backend-test.sh <functionName>

# For state management
bash autobot/verify/state-impl.sh <name>
bash autobot/verify/state-test.sh <name>
```

### Step 4: Fix Loop (Expert-Assisted)

If verification fails, enter the fix loop. Maximum 3 attempts per story before blocking.

```
Attempt 1: Self-fix using progress.txt patterns
Attempt 2: Spawn domain expert subagent (Pixel Specialist for ODiff, Debugger for tsc)
Attempt 3: Escalate to Architect or CTO subagent for structural guidance
```

After each fix attempt:
1. Re-run the verification command
2. If it passes, proceed to Step 5
3. If it fails, increment failCount and try the next approach:
   ```bash
   node autobot/mark-story.js <storyId> --fail "description of failure"
   ```
4. If failCount reaches 3, the story is automatically blocked:
   ```bash
   # Story is auto-blocked after 3 failures. Move to next eligible story.
   node autobot/pick-story.js --flow <flowId>
   ```

### Step 5: Quality Review

Spawn a **Code Reviewer** subagent (see Section 6.5) for a pre-commit quality check.
The reviewer checks:
- No hardcoded secrets or API keys
- Shared components are reused (no inline rebuilds)
- Font weights use fontFamily mapping (never RN fontWeight)
- Screen component padding is not duplicated
- TypeScript types are correct
- No console.log statements in production code

### Step 6: Test

```bash
# For UI screens
bash autobot/verify/ui-test.sh <routeKey>

# For state/hooks
bash autobot/verify/state-test.sh <name>

# For backend
bash autobot/verify/backend-test.sh <functionName>

# Full test suite (catch regressions)
cd rn-app && npm test -- --passWithNoTests
```

If no test file exists, this step passes. For new screens, optionally spawn a
**Test Engineer** subagent (see Section 6.6) to write tests.

### Step 7: Compound Engineering Entry

Append an entry to `autobot/progress.txt` using the format in Section 9.

### Step 8: Mark Story and Commit

```bash
# Mark story as passing
node autobot/mark-story.js <storyId> --pass

# Stage and commit
git add -A
git commit -m "feat(<scope>): <description>

[AutoBot] Story <storyId> | Flow: <flowId>
ODiff: <n>% | Gemini: <pass/fail> | Tests: <pass/fail>"
```

### Step 9: Report

Output the screen report (see Section 8) and immediately pick the next story:

```bash
node autobot/pick-story.js --flow <flowId>
```

---

## 4. Expert Team Protocols

Each expert is invoked as a Task tool subagent with a specific `subagent_type`.
Always include the relevant AGENTS.md sections and progress.txt patterns in the subagent prompt.

### 4.1 CTO (Strategic Decisions)

- **subagent_type**: `architect-reviewer`
- **When to invoke**:
  - Architecture decisions affecting 3+ screens or flows
  - Cross-flow impact assessment (e.g., shared component changes)
  - Refactor vs. patch decisions when failCount >= 2
  - Context window management (when to checkpoint, what to offload)
  - Technology choice decisions (new library, pattern change)
- **Context to provide**:
  - `autobot/AGENTS.md` (full file)
  - `autobot/flows.json` (all flow dependencies)
  - `autobot/progress.txt` (session log section)
  - The specific architectural question or decision to be made
  - List of affected screens/flows
- **Response format**:
  ```
  DECISION: <chosen approach>
  RATIONALE: <why this approach>
  IMPACT: <affected screens, flows, components>
  MIGRATION: <steps to implement, if refactoring>
  RISKS: <what could go wrong>
  ```

### 4.2 Architect (Component & State Design)

- **subagent_type**: `architect-reviewer`
- **When to invoke**:
  - New shared component design (before building)
  - State store shape decisions
  - API contract design between frontend and backend
  - Navigation flow design for complex multi-screen flows
  - Blueprint interpretation when node structure is ambiguous
- **Context to provide**:
  - `autobot/AGENTS.md` (UI Conventions and RN Patterns sections)
  - `autobot/context/ui.md` (shared component interfaces)
  - `autobot/context/state.md` (existing store shapes)
  - The specific blueprint JSON if relevant
  - Current screen code if modifying existing
- **Response format**:
  ```
  COMPONENT STRUCTURE:
    - Component hierarchy diagram
    - Props interface
    - State requirements

  STATE DESIGN:
    - Store shape (if new store needed)
    - Selector definitions
    - Action signatures

  API CONTRACT:
    - Request shape
    - Response shape
    - Error cases
  ```

### 4.3 PM (Requirements & Priority)

- **subagent_type**: `product-manager`
- **When to invoke**:
  - Requirements ambiguity (Figma shows conflicting states)
  - Priority conflicts (multiple blocked stories, which to unblock first)
  - Scope decisions (should a feature be included in this sprint)
  - Acceptance criteria clarification
  - Flow dependency conflicts
- **Context to provide**:
  - `autobot/prd.json` (relevant stories)
  - `autobot/flows.json` (flow dependencies)
  - `autobot/progress.txt` (current progress)
  - The specific ambiguity or conflict to resolve
  - Screenshots or blueprint excerpts if visual
- **Response format**:
  ```
  DECISION: <what to do>
  PRIORITY: <P0/P1/P2>
  ACCEPTANCE CRITERIA: <updated or clarified criteria>
  DEPENDENCIES: <any new dependencies to add>
  SCOPE: <in/out for current sprint>
  ```

### 4.4 Pixel Specialist (Visual Accuracy)

- **subagent_type**: `react-specialist`
- **When to invoke**:
  - ODiff exceeds threshold (3% for regular screens, 18% for DottedPattern)
  - Gemini pixel feedback reports specific mismatches
  - Inspector reports P0 issues (missing elements, wrong colors)
  - Font rendering issues (wrong weight, size, or line height)
  - Layout mismatches (spacing, alignment, positioning)
- **Context to provide**:
  - The current screen file (full source code)
  - The blueprint JSON for the target Figma node
  - Gemini feedback output (the specific pixel issues reported)
  - Inspector output (if available)
  - `autobot/AGENTS.md` (Figma Interpretation Rules section)
  - `autobot/context/ui.md` (theme tokens and typography table)
  - Current ODiff percentage
- **Response format**:
  The specialist returns the corrected screen code with inline comments explaining
  each change. Changes should be minimal -- fix only the pixel issues, do not refactor.

### 4.5 Backend Engineer (Edge Functions & Database)

- **subagent_type**: `backend-developer`
- **When to invoke**:
  - New Supabase edge function implementation
  - RLS policy design or debugging
  - Database migration creation
  - External service integration (PayU, Cashfree, Twilio, API Club)
  - API response shape changes
- **Context to provide**:
  - `autobot/context/backend.md` (full file)
  - `autobot/AGENTS.md` (Backend Conventions section)
  - The PM brief for the story (`buildbot/data/pm-briefs/<id>-pm-brief.json`)
  - The backend brief (`buildbot/data/mock/<id>-backend-brief.json`)
  - Existing shared utilities from `supabase/functions/_shared/`
  - Related existing edge functions for pattern reference
- **Response format**:
  ```
  FUNCTION: <function-name>/index.ts
  METHOD: POST|GET
  AUTH: required|optional|none
  EXTERNAL: <services called>

  REQUEST: { ...shape }
  RESPONSE: { ...shape }
  ERRORS: [ { code, status, message } ]

  RLS: <any new policies needed>
  MIGRATION: <any schema changes>
  ```

### 4.6 Debugger (Error Resolution)

- **subagent_type**: `debugger`
- **When to invoke**:
  - TypeScript compilation errors (`npx tsc --noEmit` fails)
  - Runtime crashes (red screen in simulator)
  - Import resolution failures
  - React hook ordering violations
  - Zustand store type mismatches
  - NativeWind class resolution issues
- **Context to provide**:
  - The full error output (tsc errors, crash stack trace, etc.)
  - The source file(s) referenced in the error
  - `rn-app/tsconfig.json` for TypeScript configuration
  - `autobot/AGENTS.md` (relevant conventions)
  - Import map: `@/` resolves to `rn-app/` root
- **Response format**:
  ```
  ROOT CAUSE: <what is wrong>
  FIX: <exact code change>
  VERIFICATION: <command to confirm fix>
  PREVENTION: <pattern to avoid this in future>
  ```

### 4.7 Code Reviewer (Pre-Commit Quality)

- **subagent_type**: `code-reviewer`
- **When to invoke**:
  - Before every commit (mandatory)
  - After fix loops that required 2+ attempts
  - When modifying shared components
  - When touching auth, payment, or security-related code
- **Context to provide**:
  - The diff of all changed files (`git diff --cached` or `git diff`)
  - `autobot/AGENTS.md` (Quality Gates section)
  - The story's acceptance criteria from `autobot/prd.json`
- **Response format**:
  ```
  VERDICT: APPROVE | REQUEST_CHANGES

  ISSUES:
    - [P0/P1/P2] <description> in <file>:<line>

  SUGGESTIONS:
    - <optional improvement>

  SECURITY:
    - [PASS/FAIL] No hardcoded secrets
    - [PASS/FAIL] Auth checks present
    - [PASS/FAIL] Input validation
  ```

### 4.8 Test Engineer (Test Strategy)

- **subagent_type**: `test-automator`
- **When to invoke**:
  - After a screen passes visual verification (write unit tests)
  - After backend function implementation (write integration tests)
  - When setting up E2E test flows across screens
  - When existing tests fail and need updating
- **Context to provide**:
  - The screen or function source code
  - `autobot/context/testing.md` (test infrastructure reference)
  - Existing test files for pattern reference (e.g., `rn-app/src/components/__tests__/`)
  - `rn-app/jest.config.js` for test configuration
  - The story's acceptance criteria
- **Response format**:
  The test file with:
  - Render tests (component mounts without error)
  - Snapshot tests (visual regression baseline)
  - Interaction tests (button presses, input changes)
  - State tests (store updates correctly)
  - Edge case tests (error states, loading states, empty states)

### 4.9 Security Reviewer (Auth & Payment Security)

- **subagent_type**: `security-engineer`
- **When to invoke**:
  - Any code touching authentication (OTP, session management)
  - Payment flow code (PayU integration, payment status)
  - Bank account or card storage code
  - RLS policy changes
  - Code handling PII (phone numbers, names, addresses)
  - Referral code validation (prevent gaming)
- **Context to provide**:
  - The code under review
  - `autobot/context/backend.md` (RLS policies, external services sections)
  - `autobot/AGENTS.md` (Backend Conventions)
  - Related edge functions that handle the same data
- **Response format**:
  ```
  RISK LEVEL: LOW | MEDIUM | HIGH | CRITICAL

  FINDINGS:
    - [SEVERITY] <finding> | REMEDIATION: <fix>

  COMPLIANCE:
    - [PASS/FAIL] PII protection
    - [PASS/FAIL] Auth enforcement
    - [PASS/FAIL] Input sanitization
    - [PASS/FAIL] RLS coverage
    - [PASS/FAIL] Secrets management
    - [PASS/FAIL] Audit logging
  ```

---

## 5. Escalation Chain

When a problem cannot be resolved at the current level, escalate up the chain.
Each level has a maximum time/attempt budget before escalation.

```
Level 1: Self-Fix (progress.txt patterns)
  Budget: 1 attempt
  Action: Search progress.txt for matching patterns. Apply known fix.
  Escalate if: Pattern not found or fix does not resolve the issue.

Level 2: Domain Expert Subagent
  Budget: 1 attempt
  Action: Spawn the appropriate expert (see Section 4).
    - tsc error        -> Debugger
    - ODiff failure     -> Pixel Specialist
    - Runtime crash     -> Debugger
    - API error         -> Backend Engineer
    - State bug         -> Architect
  Escalate if: Expert fix does not resolve or reveals structural issue.

Level 3: Architect / CTO
  Budget: 1 attempt
  Action: Spawn Architect or CTO for structural analysis.
    - Component needs redesign  -> Architect
    - Cross-flow impact         -> CTO
    - Pattern change needed     -> CTO
  Escalate if: Decision requires product/business context.

Level 4: PM
  Budget: 1 attempt
  Action: Spawn PM subagent for requirements clarification.
    - Ambiguous acceptance criteria  -> PM
    - Priority conflict              -> PM
    - Scope question                 -> PM
  Escalate if: PM cannot resolve (needs user input).

Level 5: User
  Action: Stop and ask the user. Provide:
    - What was attempted (all 4 prior levels)
    - The specific blocker
    - Recommended options (2-3 choices)
    - Impact of each option
```

After each escalation, record the learning in `autobot/progress.txt` to prevent
future escalations for the same issue pattern.

---

## 6. Subagent Prompt Templates

These are copy-paste templates for spawning subagents via the Task tool.
Replace placeholders in `{curly braces}` with actual values.

### 6.1 UI Builder

```
You are building a pixel-perfect React Native screen for Flent Secured v2.

PROJECT STACK:
- Expo SDK 52, React Native 0.76.9, NativeWind 4
- TypeScript strict mode
- expo-router 4 (file-based routing)
- Zustand 5 + React Query 5

CONVENTIONS (from AGENTS.md):
- Font mapping: 400->PlusJakartaSans-Regular, 500->Medium, 600->SemiBold, 700->Bold
  NEVER use RN fontWeight prop. Always set fontFamily directly.
- Use lineHeightPx from Figma directly as RN lineHeight value. No conversion.
- Check fill.visible before rendering any element. Skip if visible===false.
- Screen component handles horizontal padding via `padded` prop. Do NOT add
  horizontal padding to direct children when padded={true}.
- Theme colors: bg=#131313, cards=#202020, dividers=#4D4D4D, accent=#FF9A6D
- FILL sizing -> flex: 1 (not width: '100%')
- FIXED sizing -> explicit width/height
- HUG sizing -> omit explicit dimensions

SHARED COMPONENTS (import from @/src/components -- NEVER rebuild inline):
Screen, Text, PrimaryButton, TextButton, TextInput, PhoneInput, OTPInput,
DottedPattern, DocumentUploadCard, FileUploadZone, Logo, ConsentToggle,
CarouselDots, ErrorBoundary

TYPOGRAPHY TOKENS (use Text component's `variant` prop):
h1(48/64/400) h2(40/52/400) h4(28/40/400) h5(24/32/600) h6(20/28/600)
bodyLg(20/32/400) bodyLgMedium(20/32/500) bodyMd(16/24/600)
bodyMdRegular(16/24/400) bodyMd2(14/20/400) bodyMd2Medium(14/20/500)
label(14/20/600) bodySm(12/20/400) bodySmMedium(12/20/500) bodySmSemiBold(12/20/600)

COLOR TOKENS:
black: 800=#0D0D0D 700=#131313 600=#1A1A1A 500=#202020 400=#4D4D4D 300=#797979 200=#A6A6A6
neutral: 100=#EEEEEE 200=#DDDDDD 300=#CBCBCB 500=#A9A9A9 600=#878787 800=#444444
brand: 300=#FFCC8A 400=#FFAE8A 500=#FF9A6D 600=#CC7B57 700=#F06321 800=#E9661C
success=#70BF73 error=#FF8080 error.radix=#E5484D warning=#FFD580

CARD PATTERNS:
- Card-with-dividers: Single container bg=#1A1A1A radius=12, rows separated by
  0.25px #4D4D4D dividers, gap=8
- Menu-stack: Individual cards each bg=#202020 radius=12, separated by gap=4

BLUEPRINT: Read the file at {blueprint_json_path}
LEARNINGS: {paste relevant progress.txt entries here}
SCREEN PATH: {target_file_path}
ROUTE: {route_path}

INSTRUCTIONS:
1. Read the blueprint JSON carefully. Map every visible node to a React Native element.
2. Use shared components wherever possible. Check the list above before creating any
   new component.
3. For DottedPattern screens, use the correct backgroundShape key:
   splash, carousel1, carousel2, carousel3, agreement, or default.
4. Match Figma demo data exactly (names, amounts, dates, placeholder text).
5. Export the screen as a default export compatible with expo-router.
6. After writing the file, run: cd rn-app && npx tsc --noEmit
7. Fix any TypeScript errors before reporting completion.
```

### 6.2 Fix Agent (Pixel Corrections)

```
A screen failed BuildBot visual verification. Fix the pixel differences with
minimal code changes.

SCREEN FILE: {screen_file_path}
Read the current code from this file.

VERIFICATION RESULTS:
- ODiff: {odiff_percentage}%
- Threshold: {threshold}% ({reason_for_threshold})
- Gemini Feedback: {gemini_output}
- Inspector Issues: {inspector_output}

BLUEPRINT: Read the file at {blueprint_json_path}

CONVENTIONS REMINDER:
- fontWeight is NEVER used as an RN prop. Use fontFamily mapping:
  400->PlusJakartaSans-Regular, 500->Medium, 600->SemiBold, 700->Bold
- lineHeightPx from Figma maps directly to RN lineHeight
- Screen component handles padding. Don't double-pad.
- FILL -> flex:1, FIXED -> explicit size, HUG -> no explicit size
- Check fill.visible before rendering

INSTRUCTIONS:
1. Read the current screen code.
2. Read the blueprint JSON.
3. Compare the Gemini feedback against the blueprint to identify exact mismatches.
4. Apply the MINIMUM changes needed to fix the pixel differences.
   Do NOT refactor or reorganize code. Only fix what the feedback identifies.
5. Common fixes:
   - Wrong color -> check blueprint fill colors, apply correct hex
   - Wrong font size/weight -> check blueprint text styles, match exactly
   - Wrong spacing -> check blueprint padding/gap values
   - Missing element -> check blueprint for nodes not rendered
   - Wrong alignment -> check blueprint layoutAlign values
6. After applying fixes, run: cd rn-app && npx tsc --noEmit
7. Report what was changed and why.
```

### 6.3 Backend Builder

```
You are implementing a Supabase edge function for Flent Secured v2.

PROJECT STACK:
- Supabase Edge Functions (Deno runtime)
- TypeScript
- Shared utilities in supabase/functions/_shared/

CONVENTIONS (from AGENTS.md):
- All edge functions follow the pattern in existing functions
- Use shared utilities: cors.ts, supabase.ts, validation.ts, errors.ts,
  crypto.ts, audit.ts, idempotency.ts
- All mutations must create audit log entries via logAudit()
- All endpoints must handle CORS (OPTIONS preflight + corsHeaders)
- Auth-required endpoints: extract user from supabase.auth.getUser()
- Use service role client for cross-user operations
- All amounts in paise (integer, not float)
- All dates in ISO 8601

PM BRIEF: Read the file at {pm_brief_path}
BACKEND BRIEF: Read the file at {backend_brief_path}
FUNCTION NAME: {function_name}
FUNCTION PATH: supabase/functions/{function_name}/index.ts

EXISTING PATTERNS: Read these files for reference:
- supabase/functions/_shared/cors.ts
- supabase/functions/_shared/errors.ts
- supabase/functions/_shared/supabase.ts

INSTRUCTIONS:
1. Read the PM brief and backend brief for requirements.
2. Read existing shared utilities to understand available helpers.
3. Implement the edge function following existing patterns.
4. Include: input validation, auth check (if required), error handling,
   audit logging, CORS headers, proper response codes.
5. After writing, verify with: deno check supabase/functions/{function_name}/index.ts
```

### 6.4 State Builder

```
You are implementing state management for Flent Secured v2.

PROJECT STACK:
- Zustand 5 with Immer middleware
- React Query 5 (TanStack Query)
- TypeScript strict mode

CONVENTIONS (from AGENTS.md):
- Zustand stores use zustand/middleware/immer for immutable updates
- React Query: 5min staleTime, 2 retries, exponential backoff
- Auth tokens stored in expo-secure-store (encrypted)
- No refetch on window focus (mobile pattern)
- Service layer wraps all Supabase edge function calls
- camelCase in frontend, snake_case in API responses (service layer maps)

STATE CONTEXT: Read autobot/context/state.md for existing stores and hooks.
BACKEND CONTEXT: Read autobot/context/backend.md for edge function contracts.

STORE/HOOK NAME: {name}
FILE PATH: {file_path}
RELATED SERVICE: {service_file_path}

INSTRUCTIONS:
1. Read existing stores and hooks for pattern reference:
   - rn-app/src/stores/ (Zustand stores)
   - rn-app/src/hooks/ (React Query hooks)
   - rn-app/src/services/api/ (service layer)
2. Follow the exact patterns used in existing code:
   - Store: interface + create + actions + selectors
   - Hook: atomic query/mutation hooks + combined hook
   - Service: types + callEdgeFunction wrapper + response mapping
3. Export all types, store, hooks, selectors, and validation helpers.
4. After writing, run: cd rn-app && npx tsc --noEmit
```

### 6.5 Code Reviewer

```
You are reviewing code changes for Flent Secured v2 before commit.

PROJECT: React Native fintech app (Expo SDK 52, Supabase backend)
STORY: {story_id} -- {story_title}
ACCEPTANCE CRITERIA:
{acceptance_criteria_list}

CHANGED FILES:
{diff_output}

QUALITY GATES (all must pass):
1. npx tsc --noEmit -- zero TypeScript errors
2. No hardcoded secrets, API keys, or tokens
3. Shared components reused (no inline rebuilds of Screen, Text, PrimaryButton,
   TextButton, TextInput, PhoneInput, OTPInput, DottedPattern, DocumentUploadCard,
   FileUploadZone, Logo, ConsentToggle, CarouselDots, ErrorBoundary)
4. Font weights use fontFamily mapping (never RN fontWeight prop)
5. Screen component padding is not duplicated in children
6. No console.log in production code (console.error in error handlers is OK)
7. All amounts in paise (integer arithmetic, no floats)
8. Proper error handling (try/catch, error states, user-facing messages)
9. Accessibility: testID props on interactive elements
10. No TODO/FIXME/HACK comments without linked issue

INSTRUCTIONS:
Review each changed file against the quality gates and acceptance criteria.
Report your verdict as APPROVE or REQUEST_CHANGES with specific issues.
```

### 6.6 Test Writer

```
You are writing tests for Flent Secured v2 components and screens.

PROJECT STACK:
- Jest 29 + React Native Testing Library
- TypeScript
- @testing-library/react-native for component tests
- jest.config.js at rn-app/jest.config.js

COMPONENT/SCREEN UNDER TEST:
Read the file at {source_file_path}

EXISTING TEST PATTERNS:
Read these files for reference:
- rn-app/src/components/__tests__/PrimaryButton.test.tsx
- rn-app/src/components/__tests__/Text.test.tsx
- rn-app/src/components/__tests__/Screen.test.tsx

TEST FILE PATH: {test_file_path}

INSTRUCTIONS:
1. Write tests following the existing patterns in the codebase.
2. Include:
   - Render test: component mounts without errors
   - Snapshot test: renders correctly (toMatchSnapshot)
   - Props test: each prop variation renders correctly
   - Interaction test: button presses, input changes fire callbacks
   - State test: conditional renders based on state props
   - Error state test: error props render error UI
   - Loading state test: loading props render loading UI
   - Empty state test: empty/null data renders fallback
3. Mock external dependencies (navigation, stores, services).
4. Use testID selectors, not text selectors where possible.
5. After writing, run: cd rn-app && npx jest {test_file_path} --passWithNoTests
```

---

## 7. Error Handling Patterns

Common failures encountered during builds and their resolution protocols.

### 7.1 TypeScript Compilation Failure

```
TRIGGER: `npx tsc --noEmit` exits non-zero
EXPERT: Debugger (subagent_type: debugger)
SELF-FIX PATTERNS:
  - Missing import -> add import statement
  - Type mismatch on component prop -> check component interface in context/ui.md
  - Missing module -> run npm install
  - Cannot find module '@/...' -> verify path alias in tsconfig.json
RESOLUTION: Fix all errors, re-run tsc, confirm zero errors
```

### 7.2 ODiff Exceeds Threshold

```
TRIGGER: BuildBot verify-screen reports ODiff > threshold
THRESHOLDS: 3% regular | 18% DottedPattern | 8% dynamic content
EXPERT: Pixel Specialist (subagent_type: react-specialist)
SELF-FIX PATTERNS:
  - Wrong background color -> check blueprint root node fill
  - Missing element -> check blueprint for unrendered visible nodes
  - Wrong font -> verify fontFamily mapping (400/500/600/700)
  - Wrong spacing -> check blueprint padding, margin, gap values
  - DottedPattern inherent diff -> if < 18%, this is expected
RESOLUTION: Apply minimum pixel fixes, re-run verify-screen
```

### 7.3 Blueprint Missing Nodes

```
TRIGGER: Blueprint JSON has fewer nodes than expected for the screen
EXPERT: Architect (subagent_type: architect-reviewer)
SELF-FIX PATTERNS:
  - Extraction depth too shallow -> re-extract with depth=999
  - Node filtered by shouldSkipNode -> increase height threshold
  - Component instance not expanded -> check Figma component nesting
RESOLUTION:
  1. Re-extract: cd buildbot && npx tsx scripts/extract-screen-blueprint.ts --node <figmaId> --depth 999
  2. Validate: bash autobot/verify/ui-extract.sh <routeKey>
  3. If still missing, consult Architect for manual component mapping
```

### 7.4 Dependency Not Met

```
TRIGGER: gate.sh reports dependency story not passing
EXPERT: PM (subagent_type: product-manager)
SELF-FIX PATTERNS:
  - Backend dep not built yet -> check if it can be mocked
  - State dep not built -> build it first (re-prioritize)
  - Circular dependency -> consult Architect for decoupling
RESOLUTION: Build the dependency first, or get PM approval to mock/skip
```

### 7.5 Runtime Crash

```
TRIGGER: Red screen in iOS simulator or app fails to render
EXPERT: Debugger (subagent_type: debugger)
SELF-FIX PATTERNS:
  - Hook called conditionally -> move hooks before any early returns
  - Undefined is not an object -> add null checks / optional chaining
  - Text strings must be rendered within <Text> -> wrap loose strings
  - Maximum update depth exceeded -> check useEffect dependencies
  - Navigation error -> verify route path matches file structure
RESOLUTION: Fix the crash, verify app renders, re-run verification
```

### 7.6 Security Concern

```
TRIGGER: Code review flags security issue, or code touches auth/payment
EXPERT: Security Reviewer (subagent_type: security-engineer)
SELF-FIX PATTERNS:
  - Hardcoded API key -> move to environment variable
  - Missing auth check -> add supabase.auth.getUser() verification
  - PII in logs -> remove logging of phone numbers, names, etc.
  - Missing RLS -> add row-level security policy
RESOLUTION: Fix the security issue, get Security Reviewer APPROVE verdict
```

### 7.7 Test Failure

```
TRIGGER: Jest test suite fails
EXPERT: Test Engineer (subagent_type: test-automator)
SELF-FIX PATTERNS:
  - Snapshot mismatch -> update snapshot if change is intentional: npx jest -u
  - Missing mock -> add mock for new dependency
  - Async timeout -> increase timeout or await properly
  - Import error -> check module mock setup in jest.config.js
RESOLUTION: Fix failing tests, run full suite to check for regressions
```

---

## 8. Progress Reporting Format

Standardized reporting ensures consistent tracking across sessions.

### Per-Screen Report

After completing each screen (pass or fail):

```
[Screen: {routeKey}] {PASS|FAIL} | ODiff: {n}% | Gemini: {pass|fail} | Inspector: {n} issues
```

Examples:
```
[Screen: splash] PASS | ODiff: 2.1% | Gemini: pass | Inspector: 0 issues
[Screen: sign-up] FAIL | ODiff: 14.3% | Gemini: fail | Inspector: 3 issues
```

### Per-Flow Report

After completing or exhausting all screens in a flow:

```
[Flow: {flowId}] {n}/{total} screens passing | Next: {next_screen_or_flow}
```

Examples:
```
[Flow: auth] 4/5 screens passing | Next: otp (2 fix attempts remaining)
[Flow: auth] 5/5 screens passing | Next: Flow waitlist
```

### Session Summary

At the end of each session (before context fills):

```
SESSION SUMMARY [{date}]
Flows touched: {list}
Screens built: {n} | Screens passing: {n} | Screens blocked: {n}
Stories completed: {n} | Total remaining: {n}
Key learnings: {brief list of new patterns discovered}
Next session start: {flow}:{screen}:{storyId}
```

---

## 9. Compound Engineering Format

Every completed task appends an entry to `autobot/progress.txt` in this format.
These entries are searchable patterns that prevent re-solving the same problems.

```
[{DATE}] [{Flow}: {flowId}] [{Screen}: {routeKey}] [{PASS|FAIL}]
WHAT: One-line description of what was done
WHY: Root cause of the issue, or "clean implementation" if no issues
HOW: Pattern or fix that was applied
```

### Examples

```
[2026-02-17] [Flow: auth] [Screen: splash] [PASS]
WHAT: Built splash screen with DottedPattern and Logo
WHY: Clean implementation
HOW: Used DottedPattern backgroundShape="splash", Logo centered with flex layout

[2026-02-17] [Flow: auth] [Screen: sign-up] [PASS]
WHAT: Fixed ODiff from 12% to 2.8% on sign-up screen
WHY: PhoneInput label color was #CBCBCB instead of #878787
HOW: Changed Text color prop from "secondary" to "muted" for input labels

[2026-02-17] [Flow: auth] [Screen: otp] [FAIL]
WHAT: OTP screen fails BuildBot verification after 3 attempts
WHY: OTPInput box sizing differs from Figma -- component uses 39x64 but Figma shows 42x64
HOW: Blocked -- requires OTPInput shared component modification (escalated to Architect)
```

### Pattern Categories

When appending entries, tag them mentally by category for future searchability:

- **Font issues**: Wrong fontFamily, fontWeight used instead of fontFamily, wrong lineHeight
- **Color issues**: Wrong hex color, opacity not applied, fill.visible not checked
- **Layout issues**: Double padding, wrong flex direction, missing gap
- **Component issues**: Wrong shared component, missing props, incorrect variant
- **Blueprint issues**: Missing nodes, wrong depth, node filtering
- **ODiff issues**: Threshold selection, DottedPattern inherent diff, image sizing
- **State issues**: Store shape, selector signature, hook composition
- **Backend issues**: RLS, edge function errors, external service integration

---

## 10. Context Management Protocol

### Context Window Monitoring

The orchestrator monitors context usage throughout the session:

| Threshold | Action |
|-----------|--------|
| 0-50% | Normal operation. Build screens, run verifications. |
| 50% | Offload large tasks to subagents. Avoid reading large files directly. |
| 70% | Delegate all remaining work to subagents. Write checkpoint. |
| 80% | Stop all work. Write session summary. Compact and preserve state. |

### Checkpoint Format

When approaching context limits, write a checkpoint to `autobot/progress.txt`:

```
[{DATE}] [checkpoint] Context at ~{n}%
CURRENT: Flow {flowId}, Screen {routeKey}, Story {storyId}
STATUS: {what was in progress}
NEXT: {exact next step to take}
BLOCKERS: {any unresolved issues}
```

### Session Handoff

When a session ends (context fills), ensure these are up to date:
1. `autobot/progress.txt` -- all learnings and session log entries appended
2. `autobot/prd.json` -- all story statuses updated via `mark-story.js`
3. Git -- all passing work committed
4. The next session resumes from Section 2 (Session Resume Protocol)

---

## 11. Parallel Execution Strategy

### Safe Parallelism Rules

Subagents can run in parallel only when their work does not overlap:

| Parallel-Safe | Not Parallel-Safe |
|---------------|-------------------|
| Different screens in same flow | Same screen, different states |
| UI screen + backend function | Screen that imports the function being built |
| Two independent flows | Flow with dependency on the other |
| Tests for completed screens | Tests + active screen modification |

### Batch Size

Maximum 5 concurrent subagents per batch. After each batch:
1. Collect all results
2. Run verification on each
3. Fix any failures (sequentially -- fixes may conflict)
4. Commit passing work
5. Start next batch

### Parallel Workflow Example

```
Batch 1 (auth flow, P0):
  [Agent 1] UI Builder -> splash screen
  [Agent 2] UI Builder -> beta-splash screen
  [Agent 3] State Builder -> auth store

Wait for all -> Verify all -> Fix failures -> Commit

Batch 2 (auth flow, P0):
  [Agent 1] UI Builder -> carousel screen
  [Agent 2] UI Builder -> sign-up screen (depends on auth store from Batch 1)
  [Agent 3] Test Writer -> splash tests

Wait for all -> Verify all -> Fix failures -> Commit
```

---

## 12. Quick Reference Commands

```bash
# === Session Start ===
cat autobot/progress.txt                           # Load learnings
cat autobot/AGENTS.md                              # Load conventions
node autobot/pick-flow.js                          # Next eligible flow
node autobot/count-remaining.js                    # Overall progress
git log --oneline -10                              # Recent commits

# === Story Lifecycle ===
node autobot/pick-story.js --flow <flowId>         # Next story in flow
bash autobot/gate.sh <storyId>                     # Pre-flight check
node autobot/mark-story.js <storyId> --pass        # Mark passing
node autobot/mark-story.js <storyId> --fail "msg"  # Mark failed (auto-blocks at 3)
node autobot/mark-story.js <storyId> --skip --reason "msg"  # Skip story

# === Verification ===
bash autobot/verify/ui-extract.sh <routeKey>       # Blueprint valid
bash autobot/verify/ui-build.sh <routeKey>         # Screen exists + tsc
bash autobot/verify/ui-verify.sh <routeKey>        # Full BuildBot pipeline
bash autobot/verify/ui-test.sh <routeKey>          # Jest tests
bash autobot/verify/backend-impl.sh <funcName>     # Edge function exists + deno check
bash autobot/verify/backend-test.sh <funcName>     # Deno tests
bash autobot/verify/state-impl.sh <name>           # tsc check
bash autobot/verify/state-test.sh <name>           # Jest tests

# === Quality ===
bash autobot/check-regression.sh                   # All passing screens still pass
cd rn-app && npx tsc --noEmit                      # TypeScript check
cd rn-app && npm test -- --passWithNoTests          # Full test suite

# === BuildBot (run from buildbot/) ===
npx tsx scripts/extract-screen-blueprint.ts --node <figmaId> --depth 999
npx tsx scripts/verify-screen.ts --screen <routeKey>
npx tsx scripts/gemini-pixel-feedback.ts --screen <figmaId>
npx tsx scripts/check-coverage.ts --screen <figmaId>

# === Git ===
git add -A && git commit -m "feat(<scope>): <msg>"
git push origin HEAD
```
